import { prisma } from "./client";
import type { ConventionScope } from "@/server/conventions/merge";

/**
 * Read/write for the convention docs that managers edit on the website
 * (DESIGN.md component 2). Conventions are layered org → team → repo and
 * versioned: a save never mutates an existing row, it creates the next version,
 * so reviews that referenced an older version stay coherent.
 */

export interface ConventionLayerView {
  /** The current markdown, or "" if this layer has none yet. */
  markdown: string;
  /** Highest version on record, or 0 if none yet. */
  version: number;
}

export interface ConventionTree {
  org: ConventionLayerView;
  teams: (ConventionLayerView & { teamId: string; name: string })[];
  repos: (ConventionLayerView & { repoId: string; fullName: string })[];
}

/** The whole org's conventions, grouped for a tree view. */
export async function getConventionTree(orgId: string): Promise<ConventionTree> {
  const [orgDoc, teams, repos] = await Promise.all([
    prisma.conventionDoc.findFirst({
      where: { orgId, scope: "org" },
      orderBy: { version: "desc" },
    }),
    prisma.team.findMany({ where: { orgId }, orderBy: { name: "asc" } }),
    prisma.repo.findMany({ where: { orgId }, orderBy: { fullName: "asc" } }),
  ]);

  const teamDocs = await Promise.all(
    teams.map((t) =>
      prisma.conventionDoc.findFirst({
        where: { orgId, scope: "team", teamId: t.id },
        orderBy: { version: "desc" },
      }),
    ),
  );
  const repoDocs = await Promise.all(
    repos.map((r) =>
      prisma.conventionDoc.findFirst({
        where: { orgId, scope: "repo", repoId: r.id },
        orderBy: { version: "desc" },
      }),
    ),
  );

  return {
    org: { markdown: orgDoc?.markdown ?? "", version: orgDoc?.version ?? 0 },
    teams: teams.map((t, i) => ({
      teamId: t.id,
      name: t.name,
      markdown: teamDocs[i]?.markdown ?? "",
      version: teamDocs[i]?.version ?? 0,
    })),
    repos: repos.map((r, i) => ({
      repoId: r.id,
      fullName: r.fullName,
      markdown: repoDocs[i]?.markdown ?? "",
      version: repoDocs[i]?.version ?? 0,
    })),
  };
}

export interface SaveConventionArgs {
  orgId: string;
  scope: ConventionScope;
  teamId?: string | null;
  repoId?: string | null;
  markdown: string;
}

/**
 * Save a convention layer as a new version. Validates that the team/repo belongs
 * to the org (isolation) before writing.
 */
export async function saveConvention(args: SaveConventionArgs) {
  const { orgId, scope, markdown } = args;
  const teamId = scope === "team" ? args.teamId ?? null : null;
  const repoId = scope === "repo" ? args.repoId ?? null : null;

  if (scope === "team") {
    if (!teamId) throw new Error("teamId is required for team conventions");
    const team = await prisma.team.findFirst({ where: { id: teamId, orgId } });
    if (!team) throw new Error("Team not found in this org");
  }
  if (scope === "repo") {
    if (!repoId) throw new Error("repoId is required for repo conventions");
    const repo = await prisma.repo.findFirst({ where: { id: repoId, orgId } });
    if (!repo) throw new Error("Repo not found in this org");
  }

  const current = await prisma.conventionDoc.findFirst({
    where: { orgId, scope, teamId, repoId },
    orderBy: { version: "desc" },
  });
  const version = (current?.version ?? 0) + 1;

  return prisma.conventionDoc.create({
    data: { orgId, scope, teamId, repoId, version, markdown },
  });
}
