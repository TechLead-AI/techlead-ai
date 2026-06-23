import { prisma } from "@/server/db/client";
import { buildReviewPayload, postReview } from "./client";
import type { ReviewComment } from "@/server/review/types";

/** True when GitHub App credentials are present (live path enabled). */
export function isGithubConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

/**
 * Load a stored review and post its passed-the-gates comments to GitHub as one
 * batched review. Called by the worker for webhook-originated reviews.
 */
export async function postStoredReview(
  repoFullName: string,
  prNumber: number,
  reviewId: string,
): Promise<void> {
  const review = await prisma.review.findUniqueOrThrow({
    where: { id: reviewId },
    include: { comments: { where: { posted: true } } },
  });

  const comments: ReviewComment[] = review.comments.map((c) => ({
    filePath: c.filePath,
    lineStart: c.lineStart,
    lineEnd: c.lineEnd,
    category: c.category,
    severity: c.severity,
    confidence: c.confidence,
    message: c.message,
    why: c.why,
    suggestion: c.suggestion ?? undefined,
    conventionRef: c.conventionRef ?? undefined,
  }));

  const payload = buildReviewPayload(review.headSha, review.summary, comments);
  await postReview(repoFullName, prNumber, payload);
}
