import { prisma } from "@/server/db/client";
import { reviewPullRequest } from "./service";
import { parseAddedLines, type Reviewer } from "./reviewer";

/**
 * Manual "review this PR" trigger (DESIGN.md demo path / MVP Step 5). Creates a
 * pull request from pasted details + diff and runs the same review service the
 * GitHub webhook uses — so both paths share one pipeline.
 *
 * The PR size (linesChanged) is derived from the diff, not asked for: the person
 * triggering a review should only have to paste the change, nothing more.
 */
export interface ManualReviewArgs {
  orgId: string;
  authorId: string;
  repoId: string;
  title: string;
  diff: string;
  /** Injectable for tests. */
  reviewer?: Reviewer;
  modelVersion?: string;
}

export interface ManualReviewResult {
  pullRequestId: string;
  reviewId: string;
  authorId: string;
}

export async function runManualReview(
  args: ManualReviewArgs,
): Promise<ManualReviewResult> {
  // Author and repo must belong to the caller's org (isolation).
  const [author, repo] = await Promise.all([
    prisma.user.findFirst({ where: { id: args.authorId, orgId: args.orgId } }),
    prisma.repo.findFirst({ where: { id: args.repoId, orgId: args.orgId } }),
  ]);
  if (!author) throw new Error("Author not found in this org");
  if (!repo) throw new Error("Repo not found in this org");

  // Next PR number for this repo.
  const last = await prisma.pullRequest.findFirst({
    where: { repoId: args.repoId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const number = (last?.number ?? 0) + 1;

  // Size the PR by the lines it adds, so density normalises correctly without
  // asking the trigger-er for a number.
  const linesChanged = Math.max(parseAddedLines(args.diff).length, 1);

  const pr = await prisma.pullRequest.create({
    data: {
      orgId: args.orgId,
      repoId: args.repoId,
      authorId: args.authorId,
      number,
      title: args.title,
      linesChanged,
    },
  });

  const headSha = `manual-${pr.id}`;
  const { reviewId } = await reviewPullRequest({
    orgId: args.orgId,
    pullRequestId: pr.id,
    headSha,
    diff: args.diff,
    reviewer: args.reviewer,
    modelVersion: args.modelVersion,
  });

  return { pullRequestId: pr.id, reviewId, authorId: args.authorId };
}
