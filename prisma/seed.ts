import "dotenv/config";
import { prisma } from "../src/server/db/client";
import { reviewPullRequest } from "../src/server/review/service";
import { FakeReviewer } from "../src/server/review/reviewer";
import { CONVENTION_TEMPLATE } from "../src/server/conventions/merge";

/**
 * Seed realistic demo data by running the REAL review pipeline (offline fake
 * reviewer) so comments and metrics are genuine. The data tells a story:
 *  - Elyan is improving (messy early PRs, clean later ones) — the standout
 *  - Lidor is steady
 *  - Raz is stuck repeating the same mistake
 *  - Adi is brand new (one PR)
 *  - Norm Scully is worsening (clean early PRs, messy later ones)
 */

function diff(file: string, lines: string[]): string {
  return [`+++ b/${file}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join("\n");
}

const SMELLS = {
  secret: 'const apiKey = "sk-live-secret123";',
  emptyCatch: "try { doThing(); } catch (e) {}",
  consoleLog: "console.log(value);",
  anyType: "let data: any = fetchData();",
  todo: "// TODO: handle the edge case",
  clean: "return user.id;",
};

async function reviewAndBackdate(
  orgId: string,
  prId: string,
  sha: string,
  d: string,
  daysAgo: number,
) {
  const { reviewId } = await reviewPullRequest({
    orgId,
    pullRequestId: prId,
    headSha: sha,
    diff: d,
    reviewer: new FakeReviewer(),
    modelVersion: "fake-reviewer-v1",
  });
  // Backdate so the dashboards show a trend over time. createdAt is the base
  // for the system clock; we set it explicitly here for the demo only.
  const when = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  await prisma.review.update({ where: { id: reviewId }, data: { createdAt: when } });
  await prisma.comment.updateMany({ where: { reviewId }, data: { createdAt: when } });
  await prisma.pRMetrics.update({ where: { reviewId }, data: { createdAt: when } });
  await prisma.pullRequest.update({ where: { id: prId }, data: { createdAt: when } });
}

async function makePR(
  orgId: string,
  repoId: string,
  authorId: string,
  number: number,
  title: string,
  status: "open" | "merged" | "closed" = "merged",
) {
  return prisma.pullRequest.create({
    data: { orgId, repoId, authorId, number, title, linesChanged: 120, status },
  });
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.org.deleteMany({});

  console.log("Creating org, manager, repo, conventions...");
  // Org + repo names match the real GitHub org/repo the live webhook targets,
  // so seeded demo history and real reviews appear under one coherent identity.
  const org = await prisma.org.create({ data: { name: "TechLead-AI" } });

  await prisma.user.create({
    data: {
      orgId: org.id,
      role: "manager",
      githubLogin: "shir-lead",
      name: "Shir",
    },
  });

  // Two teams so the conventions tree has real branches to show.
  const backend = await prisma.team.create({
    data: { orgId: org.id, name: "Backend" },
  });
  const frontend = await prisma.team.create({
    data: { orgId: org.id, name: "Frontend" },
  });

  const repo = await prisma.repo.create({
    data: { orgId: org.id, fullName: "TechLead-AI/pr-review-tests" },
  });

  await prisma.conventionDoc.create({
    data: { orgId: org.id, scope: "org", version: 1, markdown: CONVENTION_TEMPLATE },
  });
  await prisma.conventionDoc.create({
    data: {
      orgId: org.id,
      scope: "team",
      teamId: backend.id,
      version: 1,
      markdown:
        "## Backend team rules\n- Prefer explicit error handling over silent catches.\n- No `any` in new code — model the type.",
    },
  });
  await prisma.conventionDoc.create({
    data: {
      orgId: org.id,
      scope: "repo",
      repoId: repo.id,
      version: 1,
      markdown: "## Repo rules\n- No `console.log` in committed code.\n- No secrets in source.",
    },
  });

  // --- Junior 1: Elyan (improving — the standout) ---
  console.log("Seeding Elyan (improving)...");
  const elyan = await prisma.user.create({
    data: { orgId: org.id, teamId: backend.id, role: "junior", githubLogin: "elyan-dev", name: "Elyan", isMentoredJunior: true },
  });
  const elyanPRs = [
    { d: diff("auth.ts", [SMELLS.secret, SMELLS.emptyCatch, SMELLS.consoleLog, SMELLS.anyType]), days: 40 },
    { d: diff("api.ts", [SMELLS.emptyCatch, SMELLS.consoleLog, SMELLS.todo]), days: 28 },
    { d: diff("utils.ts", [SMELLS.consoleLog]), days: 14 },
    { d: diff("clean.ts", [SMELLS.clean]), days: 3 },
  ];
  for (let i = 0; i < elyanPRs.length; i++) {
    const pr = await makePR(org.id, repo.id, elyan.id, i + 1, `Elyan feature ${i + 1}`);
    await reviewAndBackdate(org.id, pr.id, `elyan-sha-${i}`, elyanPRs[i].d, elyanPRs[i].days);
  }

  // --- Junior 2: Raz (stuck repeating the same mistake) ---
  console.log("Seeding Raz (stuck)...");
  const raz = await prisma.user.create({
    data: { orgId: org.id, teamId: backend.id, role: "junior", githubLogin: "raz-dev", name: "Raz", isMentoredJunior: true },
  });
  for (let i = 0; i < 4; i++) {
    const pr = await makePR(org.id, repo.id, raz.id, 100 + i, `Raz feature ${i + 1}`);
    await reviewAndBackdate(
      org.id,
      pr.id,
      `raz-sha-${i}`,
      diff(`feature${i}.ts`, [SMELLS.consoleLog, SMELLS.anyType]),
      35 - i * 8,
    );
  }

  // --- Junior 3: Lidor (steady) ---
  console.log("Seeding Lidor (steady)...");
  const lidor = await prisma.user.create({
    data: { orgId: org.id, teamId: frontend.id, role: "junior", githubLogin: "lidor-dev", name: "Lidor", isMentoredJunior: true },
  });
  for (let i = 0; i < 3; i++) {
    const pr = await makePR(org.id, repo.id, lidor.id, 200 + i, `Lidor feature ${i + 1}`);
    await reviewAndBackdate(
      org.id,
      pr.id,
      `lidor-sha-${i}`,
      diff(`mod${i}.ts`, [SMELLS.anyType]),
      30 - i * 10,
    );
  }

  // --- Junior 4: Adi (brand new, one PR) ---
  console.log("Seeding Adi (new)...");
  const adi = await prisma.user.create({
    data: { orgId: org.id, role: "junior", githubLogin: "adi-dev", name: "Adi", isMentoredJunior: true },
  });
  const adiPR = await makePR(org.id, repo.id, adi.id, 300, "Adi first PR");
  await reviewAndBackdate(org.id, adiPR.id, "adi-sha-0", diff("hello.ts", [SMELLS.todo]), 2);

  // --- Junior 5: Norm Scully (worsening — clean early, messy later) ---
  console.log("Seeding Norm Scully (worsening)...");
  const norm = await prisma.user.create({
    data: { orgId: org.id, teamId: frontend.id, role: "junior", githubLogin: "norm-dev", name: "Norm Scully", isMentoredJunior: true },
  });
  const normPRs = [
    { d: diff("start.ts", [SMELLS.clean]), days: 32 },
    { d: diff("grow.ts", [SMELLS.consoleLog]), days: 22 },
    { d: diff("slip.ts", [SMELLS.consoleLog, SMELLS.anyType, SMELLS.emptyCatch]), days: 12 },
    {
      d: diff("mess.ts", [SMELLS.secret, SMELLS.emptyCatch, SMELLS.consoleLog, SMELLS.anyType, SMELLS.todo]),
      days: 4,
    },
  ];
  for (let i = 0; i < normPRs.length; i++) {
    const pr = await makePR(org.id, repo.id, norm.id, 400 + i, `Norm feature ${i + 1}`);
    await reviewAndBackdate(org.id, pr.id, `norm-sha-${i}`, normPRs[i].d, normPRs[i].days);
  }

  // --- A couple of OPEN PRs carrying blockers/majors: the actionable backlog
  // the manager's "Open blocker/major PRs" stat links to. ---
  console.log("Seeding open high-severity PRs...");
  const razOpen = await makePR(org.id, repo.id, raz.id, 110, "Raz hotfix (WIP)", "open");
  await reviewAndBackdate(
    org.id,
    razOpen.id,
    "raz-open-0",
    diff("hotfix.ts", [SMELLS.secret, SMELLS.emptyCatch, SMELLS.consoleLog]),
    1,
  );
  const normOpen = await makePR(org.id, repo.id, norm.id, 410, "Norm new endpoint (WIP)", "open");
  await reviewAndBackdate(
    org.id,
    normOpen.id,
    "norm-open-0",
    diff("endpoint.ts", [SMELLS.secret, SMELLS.emptyCatch]),
    1,
  );

  const counts = {
    orgs: await prisma.org.count(),
    users: await prisma.user.count(),
    prs: await prisma.pullRequest.count(),
    reviews: await prisma.review.count(),
    comments: await prisma.comment.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
