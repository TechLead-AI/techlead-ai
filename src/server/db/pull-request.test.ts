import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "./client";
import { getPullRequestDetail } from "./pull-request";
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

// A diff with a hard-coded secret -> a high-severity, posted comment.
const SECRET_DIFF = [
  "+++ b/cfg.ts",
  "@@ -0,0 +1,1 @@",
  '+const apiKey = "sk-live-secret123";',
].join("\n");

describe("getPullRequestDetail", () => {
  it("returns the PR header, its review, and full comment data", async () => {
    const { org, junior, repo } = await setup("alpha");
    const pr = await prisma.pullRequest.create({
      data: {
        orgId: org.id,
        repoId: repo.id,
        authorId: junior.id,
        number: 7,
        title: "Add config",
        linesChanged: 30,
      },
    });
    await reviewPullRequest({
      orgId: org.id,
      pullRequestId: pr.id,
      headSha: "sha-7",
      diff: SECRET_DIFF,
      reviewer: new FakeReviewer(),
    });

    const detail = await getPullRequestDetail(org.id, pr.id);
    expect(detail).not.toBeNull();
    expect(detail!.number).toBe(7);
    expect(detail!.title).toBe("Add config");
    expect(detail!.repoFullName).toBe("colman/app");
    expect(detail!.authorName).toBe("Dev alpha");
    expect(detail!.reviews).toHaveLength(1);

    const review = detail!.reviews[0];
    expect(review.comments.length).toBeGreaterThan(0);
    const secret = review.comments.find((c) => c.category === "security");
    expect(secret).toBeDefined();
    expect(secret!.severity).toBe("blocker");
    expect(secret!.why).not.toHaveLength(0); // mentoring is mandatory
  });

  it("returns reviews newest-first when a PR is reviewed twice", async () => {
    const { org, junior, repo } = await setup("beta");
    const pr = await prisma.pullRequest.create({
      data: {
        orgId: org.id,
        repoId: repo.id,
        authorId: junior.id,
        number: 1,
        title: "Iterated PR",
        linesChanged: 10,
      },
    });
    await reviewPullRequest({
      orgId: org.id, pullRequestId: pr.id, headSha: "sha-a",
      diff: SECRET_DIFF, reviewer: new FakeReviewer(),
    });
    await reviewPullRequest({
      orgId: org.id, pullRequestId: pr.id, headSha: "sha-b",
      diff: SECRET_DIFF, reviewer: new FakeReviewer(),
    });

    const detail = await getPullRequestDetail(org.id, pr.id);
    expect(detail!.reviews).toHaveLength(2);
    expect(detail!.reviews[0].createdAt.getTime()).toBeGreaterThanOrEqual(
      detail!.reviews[1].createdAt.getTime(),
    );
  });

  it("enforces org isolation: another org cannot read the PR", async () => {
    const a = await setup("one");
    const b = await setup("two");
    const pr = await prisma.pullRequest.create({
      data: {
        orgId: a.org.id,
        repoId: a.repo.id,
        authorId: a.junior.id,
        number: 1,
        title: "Private",
        linesChanged: 5,
      },
    });
    const detail = await getPullRequestDetail(b.org.id, pr.id);
    expect(detail).toBeNull();
  });
});
