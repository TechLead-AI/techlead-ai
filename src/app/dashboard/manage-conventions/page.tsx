import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { getConventionTree } from "@/server/db/conventions";
import { Card } from "@/components/ui";
import { ConventionEditor } from "@/components/convention-editor";

export const dynamic = "force-dynamic";

/**
 * Manage conventions (DESIGN.md component 2). A directory tree makes the
 * org → team → repo layering obvious: the organization at the root, then a
 * folder of teams and a folder of repos, each leaf an editable layer.
 */
export default async function ManageConventionsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Editing the team's definition of "good" is a manager/admin job.
  if (user.role === "junior") redirect(`/dashboard/juniors/${user.id}`);

  const [org, tree] = await Promise.all([
    prisma.org.findUnique({ where: { id: user.orgId }, select: { name: true } }),
    getConventionTree(user.orgId),
  ]);

  const branch = { marginLeft: 20, marginTop: 10, display: "flex", flexDirection: "column", gap: 10 } as const;
  const folder = { fontWeight: 600, color: "var(--muted)" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ margin: "0 0 6px" }}>Manage conventions</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Conventions are layered <strong>organization → team → repository</strong>;
          more specific layers refine the broader ones. Saving creates a new
          version, so past reviews stay coherent.
        </p>
      </div>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Root: the organization */}
          <div style={folder}>📁 {org?.name ?? "Organization"}</div>
          <div style={{ marginLeft: 20 }}>
            <ConventionEditor
              label="Organization conventions"
              scope="org"
              markdown={tree.org.markdown}
              version={tree.org.version}
            />
          </div>

          {/* Teams */}
          <div style={folder}>📁 Teams</div>
          {tree.teams.length === 0 ? (
            <p style={{ marginLeft: 20, color: "var(--muted)" }}>No teams yet.</p>
          ) : (
            <div style={branch}>
              {tree.teams.map((t) => (
                <ConventionEditor
                  key={t.teamId}
                  label={`${t.name} team`}
                  scope="team"
                  teamId={t.teamId}
                  markdown={t.markdown}
                  version={t.version}
                />
              ))}
            </div>
          )}

          {/* Repositories */}
          <div style={folder}>📁 Repositories</div>
          {tree.repos.length === 0 ? (
            <p style={{ marginLeft: 20, color: "var(--muted)" }}>No repositories yet.</p>
          ) : (
            <div style={branch}>
              {tree.repos.map((r) => (
                <ConventionEditor
                  key={r.repoId}
                  label={r.fullName}
                  scope="repo"
                  repoId={r.repoId}
                  markdown={r.markdown}
                  version={r.version}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
