import type { ReviewComment } from "./types";

/**
 * Auto-post gates — Layer 2 of DESIGN.md component 4. Because there is no human
 * in the loop, these rules decide what actually gets posted:
 *  - confidence threshold: drop comments the model isn't sure about
 *  - nit budget: keep only the few most-confident nits, summarise the rest
 *
 * Returns every comment annotated with `posted` and a `dropReason`, so the
 * caller can store all of them but only post the ones that pass.
 */

export interface GateConfig {
  /** Comments below this confidence are not posted. */
  confidenceThreshold: number;
  /** Maximum number of nit-severity comments to post per review. */
  nitBudget: number;
}

export const DEFAULT_GATES: GateConfig = {
  confidenceThreshold: 0.7,
  nitBudget: 3,
};

export type DropReason = "low_confidence" | "over_nit_budget" | null;

export interface GatedComment {
  comment: ReviewComment;
  posted: boolean;
  dropReason: DropReason;
}

export function applyGates(
  comments: ReviewComment[],
  config: GateConfig = DEFAULT_GATES,
): GatedComment[] {
  // First pass: confidence threshold applies to every comment.
  const afterConfidence: GatedComment[] = comments.map((comment) => {
    if (comment.confidence < config.confidenceThreshold) {
      return { comment, posted: false, dropReason: "low_confidence" };
    }
    return { comment, posted: true, dropReason: null };
  });

  // Second pass: among the confident nits, keep only the most-confident few.
  const confidentNitIndexes = afterConfidence
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.posted && g.comment.severity === "nit")
    .sort((a, b) => b.g.comment.confidence - a.g.comment.confidence)
    .map(({ i }) => i);

  const overBudget = new Set(confidentNitIndexes.slice(config.nitBudget));
  return afterConfidence.map((g, i) => {
    if (overBudget.has(i)) {
      return { comment: g.comment, posted: false, dropReason: "over_nit_budget" };
    }
    return g;
  });
}

/** Convenience: just the comments that should be posted. */
export function postedComments(gated: GatedComment[]): ReviewComment[] {
  return gated.filter((g) => g.posted).map((g) => g.comment);
}
