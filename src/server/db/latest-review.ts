import { prisma } from "./client";

/**
 * The most recent review in an org — the data behind the manager's "New review"
 * popup (the toast that announces a freshly reviewed PR). Org-scoped like every
 * dashboard query, and limited to mentored juniors' PRs (the only PRs we review).
 *
 * Only reviews from the last hour count as "new" (the same window the NewDot
 * uses): an older review is not announced at all. So the popup is genuinely a
 * heads-up about something that just happened, never a stale notice.
 */
const ONE_HOUR_MS = 60 * 60 * 1000;
export interface LatestReviewNotice {
  /** The review run's id — used by the client to show each notice only once. */
  reviewId: string;
  pullRequestId: string;
  prNumber: number;
  prTitle: string;
  /** Who opened the PR. */
  authorName: string;
  /** How many review comments this run produced. */
  issueCount: number;
}

/** The newest review from the last hour, or null if there isn't one. */
export async function getLatestReviewNotice(
  orgId: string,
): Promise<LatestReviewNotice | null> {
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);
  const review = await prisma.review.findFirst({
    where: {
      orgId,
      pullRequest: { author: { isMentoredJunior: true } },
      createdAt: { gte: oneHourAgo },
    },
    orderBy: { createdAt: "desc" },
    include: {
      pullRequest: { include: { author: { select: { name: true } } } },
      _count: { select: { comments: true } },
    },
  });
  if (!review) return null;

  return {
    reviewId: review.id,
    pullRequestId: review.pullRequestId,
    prNumber: review.pullRequest.number,
    prTitle: review.pullRequest.title,
    authorName: review.pullRequest.author.name,
    issueCount: review._count.comments,
  };
}
