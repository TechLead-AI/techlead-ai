import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "./client";
import { getLatestReviewNotice } from "./latest-review";
import { reviewPullRequest } from "@/server/review/service";
import { FakeReviewer } from "@/server/review/reviewer";

const createdOrgIds: string[] = [];
afterEach(async () => {
  for (const id of createdOrgIds.splice(0)) {
    await prisma.org.delete({ where: { id } }).catch(() => {});
  }
});

async function setup(name: string) {
  const org = await prisma.org.create({ data: { name } });
  createdOrgIds.push(org.id);
  const junior = await prisma.user.create({
    data: {
      orgId: org.id,
      role: "junior",
      githubLogin: `dev-${name}`,
      name: `Dev ${name}`,
      isMentoredJunior: true,
    },
  });
  const repo = await prisma.repo.create({
    data: { orgId: org.id, fullName: "colman/app" },
  });
  return { org, junior, repo };
}

const SECRET_DIFF = [
  "+++ b/cfg.ts",
  "@@ -0,0 +1,1 @@",
  '+const apiKey = "sk-live-secret123";',
].join("\n");

async function reviewedPR(
  org: { id: string },
  junior: { id: string },
  repo: { id: string },
  number: number,
  title: string,
) {
  const pr = await prisma.pullRequest.create({
    data: {
      orgId: org.id,
      repoId: repo.id,
      authorId: junior.id,
      number,
      title,
      linesChanged: 20,
    },
  });
  await reviewPullRequest({
    orgId: org.id,
    pullRequestId: pr.id,
    headSha: `sha-${number}`,
    diff: SECRET_DIFF,
    reviewer: new FakeReviewer(),
  });
  return pr;
}

describe("getLatestReviewNotice", () => {
  it("returns null when the org has no reviews yet", async () => {
    const { org } = await setup("empty");
    expect(await getLatestReviewNotice(org.id)).toBeNull();
  });

  it("returns the newest review with author, title, and issue count", async () => {
    const { org, junior, repo } = await setup("alpha");
    await reviewedPR(org, junior, repo, 1, "Older PR");
    const newest = await reviewedPR(org, junior, repo, 2, "Newest PR");

    const notice = await getLatestReviewNotice(org.id);
    expect(notice).not.toBeNull();
    expect(notice!.pullRequestId).toBe(newest.id);
    expect(notice!.prTitle).toBe("Newest PR");
    expect(notice!.authorName).toBe("Dev alpha");
    expect(notice!.issueCount).toBeGreaterThan(0);
  });

  it("enforces org isolation: another org's review is never returned", async () => {
    const a = await setup("one");
    const b = await setup("two");
    await reviewedPR(a.org, a.junior, a.repo, 1, "Org A PR");

    expect(await getLatestReviewNotice(b.org.id)).toBeNull();
  });

  it("ignores reviews older than an hour", async () => {
    const { org, junior, repo } = await setup("stale");
    const pr = await reviewedPR(org, junior, repo, 1, "Reviewed a while ago");
    // Backdate the review past the one-hour window.
    await prisma.review.updateMany({
      where: { pullRequestId: pr.id },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });

    expect(await getLatestReviewNotice(org.id)).toBeNull();
  });

  it("returns a recent review even when an older one is the same PR's latest", async () => {
    const { org, junior, repo } = await setup("mixed");
    const oldPr = await reviewedPR(org, junior, repo, 1, "Old PR");
    await prisma.review.updateMany({
      where: { pullRequestId: oldPr.id },
      data: { createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    });
    const freshPr = await reviewedPR(org, junior, repo, 2, "Fresh PR");

    const notice = await getLatestReviewNotice(org.id);
    expect(notice).not.toBeNull();
    expect(notice!.pullRequestId).toBe(freshPr.id);
    expect(notice!.prTitle).toBe("Fresh PR");
  });
});
