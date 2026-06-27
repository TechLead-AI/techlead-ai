import { reviewPullRequest } from "@/server/review/service";
import { isGithubConfigured, postStoredReview } from "@/server/github/post";

/**
 * The unit of work the queue carries. The webhook fetches the diff before
 * enqueuing, so the worker always has everything it needs and just runs the
 * shared review service. `github` is set for webhook-originated jobs so the
 * worker can post the review back; manual reviews omit it.
 */
export interface ReviewJobData {
  orgId: string;
  pullRequestId: string;
  headSha: string;
  diff: string;
  github?: { repoFullName: string; prNumber: number };
}

export const REVIEW_QUEUE = "review-pr";

/** A human-readable label for a job, for the worker's progress logs. */
function jobLabel(data: ReviewJobData): string {
  return data.github
    ? `PR #${data.github.prNumber} (${data.github.repoFullName})`
    : `PR ${data.pullRequestId}`;
}

/** Process one review job. Exported separately so it can be unit-tested. */
export async function handleReviewJob(data: ReviewJobData): Promise<void> {
  const label = jobLabel(data);
  console.log(`Reviewing ${label}...`);

  const { reviewId, skipped } = await reviewPullRequest({
    orgId: data.orgId,
    pullRequestId: data.pullRequestId,
    headSha: data.headSha,
    diff: data.diff,
  });

  if (skipped) {
    console.log(`Skipped ${label} — this commit was already reviewed.`);
    return;
  }

  // Post back to GitHub only for fresh, webhook-originated reviews.
  if (data.github && isGithubConfigured()) {
    await postStoredReview(data.github.repoFullName, data.github.prNumber, reviewId);
    console.log(`Posted review for ${label}.`);
  } else {
    console.log(`Stored review for ${label} (no GitHub post).`);
  }
}
