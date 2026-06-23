import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/server/db/client";
import { runManualReview } from "./manual";
import { FakeReviewer } from "./reviewer";

const createdOrgIds: string[] = [];
afterEach(async () => {
  for (const id of createdOrgIds.splice(0)) {
    await prisma.org.delete({ where: { id } }).catch(() => {});
  }
});

async function setup() {
  const org = await prisma.org.create({ data: { name: "Manual Org" } });
  createdOrgIds.push(org.id);
  const junior = await prisma.user.create({
    data: { orgId: org.id, role: "junior", githubLogin: "m-dev", name: "M", isMentoredJunior: true },
  });
  const repo = await prisma.repo.create({ data: { orgId: org.id, fullName: "acme/x" } });
  return { org, junior, repo };
}

const DIFF = ["+++ b/x.ts", "@@ -0,0 +1,1 @@", "+console.log(1);"].join("\n");

describe("runManualReview", () => {
  it("creates a PR and reviews it", async () => {
    const { org, junior, repo } = await setup();
    const res = await runManualReview({
      orgId: org.id,
      authorId: junior.id,
      repoId: repo.id,
      title: "My change",
      diff: DIFF,
      reviewer: new FakeReviewer(),
    });
    const pr = await prisma.pullRequest.findUnique({ where: { id: res.pullRequestId } });
    expect(pr?.number).toBe(1);
    const comments = await prisma.comment.count({ where: { reviewId: res.reviewId } });
    expect(comments).toBeGreaterThan(0);
  });

  it("derives linesChanged from the diff's added lines", async () => {
    const { org, junior, repo } = await setup();
    const threeAdded = [
      "+++ b/y.ts",
      "@@ -0,0 +1,3 @@",
      "+const a = 1;",
      "+const b = 2;",
      "+const c = 3;",
    ].join("\n");
    const res = await runManualReview({
      orgId: org.id,
      authorId: junior.id,
      repoId: repo.id,
      title: "Sized by diff",
      diff: threeAdded,
      reviewer: new FakeReviewer(),
    });
    const pr = await prisma.pullRequest.findUnique({ where: { id: res.pullRequestId } });
    expect(pr?.linesChanged).toBe(3);
  });

  it("increments PR numbers per repo", async () => {
    const { org, junior, repo } = await setup();
    const a = await runManualReview({
      orgId: org.id, authorId: junior.id, repoId: repo.id,
      title: "1", diff: DIFF, reviewer: new FakeReviewer(),
    });
    const b = await runManualReview({
      orgId: org.id, authorId: junior.id, repoId: repo.id,
      title: "2", diff: DIFF, reviewer: new FakeReviewer(),
    });
    const prA = await prisma.pullRequest.findUnique({ where: { id: a.pullRequestId } });
    const prB = await prisma.pullRequest.findUnique({ where: { id: b.pullRequestId } });
    expect(prA?.number).toBe(1);
    expect(prB?.number).toBe(2);
  });

  it("rejects an author from another org", async () => {
    const a = await setup();
    const b = await setup();
    await expect(
      runManualReview({
        orgId: b.org.id,
        authorId: a.junior.id, // belongs to org A
        repoId: b.repo.id,
        title: "x", diff: DIFF, reviewer: new FakeReviewer(),
      }),
    ).rejects.toThrow(/author not found/i);
  });
});
