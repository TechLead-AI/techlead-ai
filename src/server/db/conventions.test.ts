import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "./client";
import { getConventionTree, saveConvention } from "./conventions";
import { gatherConventions } from "./reviews";

const createdOrgIds: string[] = [];
afterEach(async () => {
  for (const id of createdOrgIds.splice(0)) {
    await prisma.org.delete({ where: { id } }).catch(() => {});
  }
});

async function setup(name: string) {
  const org = await prisma.org.create({ data: { name } });
  createdOrgIds.push(org.id);
  const team = await prisma.team.create({ data: { orgId: org.id, name: "Backend" } });
  const repo = await prisma.repo.create({ data: { orgId: org.id, fullName: "colman/app" } });
  return { org, team, repo };
}

describe("saveConvention", () => {
  it("creates v1 then bumps to v2 instead of mutating", async () => {
    const { org } = await setup("ver");
    const v1 = await saveConvention({ orgId: org.id, scope: "org", markdown: "first" });
    expect(v1.version).toBe(1);
    const v2 = await saveConvention({ orgId: org.id, scope: "org", markdown: "second" });
    expect(v2.version).toBe(2);
    // Both rows still exist — history preserved.
    const count = await prisma.conventionDoc.count({ where: { orgId: org.id, scope: "org" } });
    expect(count).toBe(2);
  });

  it("rejects a team from another org (isolation)", async () => {
    const a = await setup("a");
    const b = await setup("b");
    await expect(
      saveConvention({ orgId: b.org.id, scope: "team", teamId: a.team.id, markdown: "x" }),
    ).rejects.toThrow(/team not found/i);
  });
});

describe("getConventionTree", () => {
  it("returns org, teams and repos with their latest versions", async () => {
    const { org, team, repo } = await setup("tree");
    await saveConvention({ orgId: org.id, scope: "org", markdown: "org rules" });
    await saveConvention({ orgId: org.id, scope: "team", teamId: team.id, markdown: "team rules" });
    await saveConvention({ orgId: org.id, scope: "team", teamId: team.id, markdown: "team rules v2" });
    await saveConvention({ orgId: org.id, scope: "repo", repoId: repo.id, markdown: "repo rules" });

    const tree = await getConventionTree(org.id);
    expect(tree.org.markdown).toBe("org rules");
    expect(tree.teams).toHaveLength(1);
    expect(tree.teams[0].name).toBe("Backend");
    expect(tree.teams[0].version).toBe(2);
    expect(tree.teams[0].markdown).toBe("team rules v2");
    expect(tree.repos[0].fullName).toBe("colman/app");
    expect(tree.repos[0].markdown).toBe("repo rules");
  });
});

describe("gatherConventions with a team", () => {
  it("includes the team layer only when a teamId is given", async () => {
    const { org, team, repo } = await setup("merge");
    await saveConvention({ orgId: org.id, scope: "org", markdown: "ORG LAYER" });
    await saveConvention({ orgId: org.id, scope: "team", teamId: team.id, markdown: "TEAM LAYER" });
    await saveConvention({ orgId: org.id, scope: "repo", repoId: repo.id, markdown: "REPO LAYER" });

    const withTeam = await gatherConventions(org.id, repo.id, team.id);
    expect(withTeam).toContain("TEAM LAYER");
    expect(withTeam).toContain("ORG LAYER");
    expect(withTeam).toContain("REPO LAYER");

    const withoutTeam = await gatherConventions(org.id, repo.id);
    expect(withoutTeam).not.toContain("TEAM LAYER");
  });
});
