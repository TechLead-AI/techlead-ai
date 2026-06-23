import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/server/db/client";
import { reviewPullRequest } from "./service";
import { FakeReviewer } from "./reviewer";

/**
 * Integration test against the local Postgres (docker compose). Each test makes
 * its own org and deletes it afterwards (cascade cleans children).
 */

const createdOrgIds: string[] = [];

afterEach(async () => {
  for (const id of createdOrgIds.splice(0)) {
    await prisma.org.delete({ where: { id } }).catch(() => {});
  }
});

async function seedPR(opts: { linesChanged?: number } = {}) {
  const org = await prisma.org.create({ data: { name: "Test Org" } });
  createdOrgIds.push(org.id);
  const junior = await prisma.user.create({
    data: {
      orgId: org.id,
      role: "junior",
      githubLogin: "junior-dev",
      name: "Junior Dev",
      isMentoredJunior: true,
    },
  });
  const repo = await prisma.repo.create({
    data: { orgId: org.id, fullName: "acme/app" },
  });
  const pr = await prisma.pullRequest.create({
    data: {
      orgId: org.id,
      repoId: repo.id,
      authorId: junior.id,
      number: 1,
      title: "Add login",
      linesChanged: opts.linesChanged ?? 100,
    },
  });
  return { org, junior, repo, pr };
}

const DIFF_WITH_SECRET = [
  "+++ b/src/auth.ts",
  "@@ -0,0 +1,2 @@",
  '+const apiKey = "sk-live-abcdef";',
  "+console.log(apiKey);",
].join("\n");

describe("reviewPullRequest", () => {
  it("stores a review, comments, and a metrics snapshot", async () => {
    const { org, pr } = await seedPR();

    const { reviewId, skipped } = await reviewPullRequest({
      orgId: org.id,
      pullRequestId: pr.id,
      headSha: "sha1",
      diff: DIFF_WITH_SECRET,
      reviewer: new FakeReviewer(),
      modelVersion: "fake",
    });

    expect(skipped).toBe(false);

    const comments = await prisma.comment.findMany({ where: { reviewId } });
    expect(comments.length).toBeGreaterThanOrEqual(2);
    expect(comments.some((c) => c.severity === "blocker")).toBe(true);

    const metrics = await prisma.pRMetrics.findUnique({ where: { reviewId } });
    expect(metrics).not.toBeNull();
    expect(metrics!.commentCount).toBe(comments.length);
    expect(metrics!.issueDensity).toBeGreaterThan(0);
  });

  it("is idempotent: the same commit is not reviewed twice", async () => {
    const { org, pr } = await seedPR();
    const first = await reviewPullRequest({
      orgId: org.id,
      pullRequestId: pr.id,
      headSha: "same-sha",
      diff: DIFF_WITH_SECRET,
      reviewer: new FakeReviewer(),
    });
    const second = await reviewPullRequest({
      orgId: org.id,
      pullRequestId: pr.id,
      headSha: "same-sha",
      diff: DIFF_WITH_SECRET,
      reviewer: new FakeReviewer(),
    });
    expect(second.skipped).toBe(true);
    expect(second.reviewId).toBe(first.reviewId);

    const reviewCount = await prisma.review.count({
      where: { pullRequestId: pr.id },
    });
    expect(reviewCount).toBe(1);
  });

  it("detects repeats using history from an earlier PR", async () => {
    const { org, junior, repo } = await seedPR();

    // First PR with a console.log (convention category).
    const pr1 = await prisma.pullRequest.findFirstOrThrow({
      where: { orgId: org.id },
    });
    await reviewPullRequest({
      orgId: org.id,
      pullRequestId: pr1.id,
      headSha: "sha-a",
      diff: ["+++ b/a.ts", "@@ -0,0 +1,1 @@", "+console.log(1);"].join("\n"),
      reviewer: new FakeReviewer(),
    });

    // Second PR, same kind of mistake again.
    const pr2 = await prisma.pullRequest.create({
      data: {
        orgId: org.id,
        repoId: repo.id,
        authorId: junior.id,
        number: 2,
        title: "More work",
        linesChanged: 50,
      },
    });
    const { reviewId } = await reviewPullRequest({
      orgId: org.id,
      pullRequestId: pr2.id,
      headSha: "sha-b",
      diff: ["+++ b/b.ts", "@@ -0,0 +1,1 @@", "+console.log(2);"].join("\n"),
      reviewer: new FakeReviewer(),
    });

    const repeated = await prisma.comment.findFirst({
      where: { reviewId, repeatOfId: { not: null } },
    });
    expect(repeated).not.toBeNull();
  });
});
