import { prisma } from "@/server/db/client";
import {
  gatherConventions,
  gatherHistory,
  storeReviewRun,
} from "@/server/db/reviews";
import { runReviewPipeline } from "./pipeline";
import { createReviewer } from "./factory";
import type { Reviewer } from "./reviewer";

/**
 * The review service ties the database to the pipeline. Both the manual trigger
 * (Step 5) and the GitHub webhook (Step 6) call this, so they share one path.
 *
 * Idempotent on (pullRequestId, headSha): the same commit is never reviewed
 * twice — important for webhook retries.
 */
export interface ReviewPullRequestArgs {
  orgId: string;
  pullRequestId: string;
  headSha: string;
  diff: string;
  /** Inject a reviewer in tests; defaults to the env-selected one. */
  reviewer?: Reviewer;
  modelVersion?: string;
}

export interface ReviewServiceResult {
  reviewId: string;
  /** True if this commit had already been reviewed and we skipped. */
  skipped: boolean;
}

export async function reviewPullRequest(
  args: ReviewPullRequestArgs,
): Promise<ReviewServiceResult> {
  const { orgId, pullRequestId, headSha, diff } = args;

  // Idempotency: skip if this exact commit was already reviewed.
  const existing = await prisma.review.findUnique({
    where: { pullRequestId_headSha: { pullRequestId, headSha } },
  });
  if (existing) {
    return { reviewId: existing.id, skipped: true };
  }

  const pr = await prisma.pullRequest.findUniqueOrThrow({
    where: { id: pullRequestId },
    select: {
      title: true,
      repoId: true,
      authorId: true,
      linesChanged: true,
      author: { select: { teamId: true } },
    },
  });

  const [conventions, history] = await Promise.all([
    gatherConventions(orgId, pr.repoId, pr.author.teamId),
    gatherHistory(orgId, pr.authorId),
  ]);

  const recentMistakeCategories = [...new Set(history.map((h) => h.category))];

  const selected = args.reviewer
    ? { reviewer: args.reviewer, modelVersion: args.modelVersion ?? "injected" }
    : createReviewer();

  const result = await runReviewPipeline(selected.reviewer, {
    prTitle: pr.title,
    conventions,
    diff,
    recentMistakeCategories,
    history,
    linesChanged: pr.linesChanged,
  });

  const reviewId = await storeReviewRun({
    orgId,
    pullRequestId,
    headSha,
    modelVersion: selected.modelVersion,
    tokenCost: 0,
    result,
  });

  return { reviewId, skipped: false };
}
