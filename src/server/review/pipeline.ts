import type { Reviewer, ReviewInput } from "./reviewer";
import type { ReviewComment } from "./types";
import { applyGates, type GateConfig, DEFAULT_GATES, type DropReason } from "./gates";
import { detectRepeats, type PriorComment } from "./repeat";
import { computeMetrics, type PRMetricsValues } from "@/server/grading/metrics";

/**
 * The review pipeline (DESIGN.md component 3): gather -> review -> summarise,
 * then post-process (gates, repeat detection, metrics). Built as discrete steps
 * so a self-check pass and fix-acknowledgment can be slotted in later.
 *
 * Context gathering (diff, conventions, history) happens in the caller; this
 * function takes the gathered context plus a Reviewer, so it is fully testable
 * offline with the FakeReviewer.
 */
export interface PipelineContext extends ReviewInput {
  /** The junior's prior comments, for repeat detection. */
  history: PriorComment[];
  linesChanged: number;
}

/** One processed comment, ready to store. */
export interface ProcessedComment {
  comment: ReviewComment;
  posted: boolean;
  dropReason: DropReason;
  repeatOfId: string | null;
}

export interface PipelineResult {
  summary: string;
  comments: ProcessedComment[];
  metrics: PRMetricsValues;
}

export async function runReviewPipeline(
  reviewer: Reviewer,
  context: PipelineContext,
  gates: GateConfig = DEFAULT_GATES,
): Promise<PipelineResult> {
  // Step 1: review (context already gathered by the caller).
  const result = await reviewer.review(context);

  // Step 2: gates decide what gets posted.
  const gated = applyGates(result.comments, gates);

  // Step 3: repeat detection (mentoring memory).
  const repeats = detectRepeats(result.comments, context.history);
  const repeatById = new Map(repeats.map((r) => [r.comment, r.repeatOfId]));

  const comments: ProcessedComment[] = gated.map((g) => ({
    comment: g.comment,
    posted: g.posted,
    dropReason: g.dropReason,
    repeatOfId: repeatById.get(g.comment) ?? null,
  }));

  // Step 4: grade. Metrics are computed over ALL comments found, not just the
  // posted ones — they measure the junior's work, not what we chose to show.
  const metrics = computeMetrics(
    comments.map((c) => ({
      severity: c.comment.severity,
      category: c.comment.category,
      isRepeat: c.repeatOfId !== null,
    })),
    context.linesChanged,
  );

  return { summary: result.summary, comments, metrics };
}
