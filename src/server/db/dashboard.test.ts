import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "./client";
import {
  trendDirection,
  listJuniors,
  getJuniorProfile,
  getTeamOverview,
  getTeamStats,
  needsAttention,
  type JuniorSummary,
} from "./dashboard";
import { reviewPullRequest } from "@/server/review/service";
import { FakeReviewer } from "@/server/review/reviewer";

describe("trendDirection (pure)", () => {
  it("is 'new' with fewer than two points (no trend yet)", () => {
    expect(trendDirection([])).toBe("new");
    expect(trendDirection([5])).toBe("new");
  });
  it("is 'improving' when density falls", () => {
    expect(trendDirection([10, 9, 4, 2])).toBe("improving");
  });
  it("is 'worsening' when density rises", () => {
    expect(trendDirection([2, 3, 8, 10])).toBe("worsening");
  });
  it("is 'flat' when density barely moves", () => {
    expect(trendDirection([5, 5.1, 4.9, 5])).toBe("flat");
  });
});

// --- DB-backed tests ---

const createdOrgIds: string[] = [];
afterEach(async () => {
  for (const id of createdOrgIds.splice(0)) {
    await prisma.org.delete({ where: { id } }).catch(() => {});
  }
});

async function makeOrgWithJunior(name: string) {
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
    data: { orgId: org.id, fullName: "acme/app" },
  });
  return { org, junior, repo };
}

async function addReviewedPR(
  orgId: string,
  repoId: string,
  authorId: string,
  number: number,
  diff: string,
) {
  const pr = await prisma.pullRequest.create({
    data: { orgId, repoId, authorId, number, title: `PR ${number}`, linesChanged: 100 },
  });
  await reviewPullRequest({
    orgId,
    pullRequestId: pr.id,
    headSha: `sha-${number}`,
    diff,
    reviewer: new FakeReviewer(),
  });
}

const NIT_DIFF = ["+++ b/a.ts", "@@ -0,0 +1,1 @@", "+console.log(1);"].join("\n");

describe("dashboard queries", () => {
  it("lists juniors with their review counts", async () => {
    const { org, junior, repo } = await makeOrgWithJunior("alpha");
    await addReviewedPR(org.id, repo.id, junior.id, 1, NIT_DIFF);
    await addReviewedPR(org.id, repo.id, junior.id, 2, NIT_DIFF);

    const juniors = await listJuniors(org.id);
    expect(juniors).toHaveLength(1);
    expect(juniors[0].reviewCount).toBe(2);
  });

  it("builds a profile with trend, category mix, and recurring mistakes", async () => {
    const { org, junior, repo } = await makeOrgWithJunior("beta");
    await addReviewedPR(org.id, repo.id, junior.id, 1, NIT_DIFF);
    await addReviewedPR(org.id, repo.id, junior.id, 2, NIT_DIFF); // repeat

    const profile = await getJuniorProfile(org.id, junior.id);
    expect(profile).not.toBeNull();
    expect(profile!.trend).toHaveLength(2);
    const convention = profile!.categoryMix.find((c) => c.category === "convention");
    expect(convention!.count).toBeGreaterThanOrEqual(2);
    // Each bar carries pointers back to the PRs that produced it (drill-down).
    expect(convention!.items[0].pullRequestId).toBeTruthy();
    // The second console.log repeats the first -> a recurring mistake.
    expect(profile!.topRecurringMistakes[0].category).toBe("convention");
  });

  it("enforces org isolation: cannot read a junior from another org", async () => {
    const a = await makeOrgWithJunior("one");
    const b = await makeOrgWithJunior("two");
    // Ask org B for org A's junior -> null.
    const profile = await getJuniorProfile(b.org.id, a.junior.id);
    expect(profile).toBeNull();
  });

  it("summarises common mistakes for the team", async () => {
    const { org, junior, repo } = await makeOrgWithJunior("gamma");
    await addReviewedPR(org.id, repo.id, junior.id, 1, NIT_DIFF);
    const overview = await getTeamOverview(org.id);
    expect(overview.juniors).toHaveLength(1);
    expect(overview.commonMistakes.length).toBeGreaterThan(0);
    // Team mistakes are drillable and labelled by author.
    expect(overview.commonMistakes[0].items[0].authorName).toBe("Dev gamma");
  });

  it("computes team stats: counts, avg density, severity breakdown", async () => {
    const { org, junior, repo } = await makeOrgWithJunior("delta");
    const SECRET = [
      "+++ b/c.ts",
      "@@ -0,0 +1,1 @@",
      '+const apiKey = "sk-live-secret123";',
    ].join("\n");
    await addReviewedPR(org.id, repo.id, junior.id, 1, SECRET);

    const stats = await getTeamStats(org.id);
    expect(stats.juniorCount).toBe(1);
    expect(stats.reviewCount).toBe(1);
    expect(stats.avgDensity).not.toBeNull();
    // The hard-coded secret is a blocker, so high-severity count is at least 1.
    expect(stats.openHighSeverity).toBeGreaterThanOrEqual(1);
    expect(stats.severityCounts.find((s) => s.severity === "blocker")!.count).toBe(1);
  });
});

describe("needsAttention (pure)", () => {
  const base = (over: Partial<JuniorSummary>): JuniorSummary => ({
    id: "x",
    name: "X",
    githubLogin: "x",
    reviewCount: 3,
    latestDensity: 5,
    latestRepeatRate: 0,
    trend: "flat",
    ...over,
  });

  it("flags worsening juniors", () => {
    expect(needsAttention([base({ trend: "worsening" })])).toHaveLength(1);
  });

  it("flags juniors stuck repeating mistakes", () => {
    expect(needsAttention([base({ trend: "flat", latestRepeatRate: 0.6 })])).toHaveLength(1);
  });

  it("does not flag steady or brand-new juniors", () => {
    const steady = base({ trend: "flat", latestRepeatRate: 0.1 });
    const fresh = base({ trend: "new", latestRepeatRate: 1 });
    expect(needsAttention([steady, fresh])).toHaveLength(0);
  });
});
