import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { Card } from "@/components/ui";

/**
 * Add a mentored junior by hand (admin/manager only). The webhook only reviews
 * PRs from users flagged as mentored juniors, so this is how a manager brings a
 * new team member into the review loop without re-running onboarding.
 */
export default async function AddJuniorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Admin/manager tool only; juniors land on their own profile.
  if (user.role === "junior") redirect(`/dashboard/juniors/${user.id}`);

  const { error } = await searchParams;
  const teams = await prisma.team.findMany({
    where: { orgId: user.orgId },
    orderBy: { name: "asc" },
  });

  const inputStyle = {
    width: "100%",
    background: "var(--panel-2)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <h1 style={{ margin: 0 }}>Add a junior</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Register a mentored junior so their pull requests get reviewed
        automatically. Their GitHub login is how the webhook matches their PRs.
      </p>

      {error && (
        <div
          style={{
            color: "var(--bad)",
            border: "1px solid var(--bad)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <Card>
        <form
          action="/api/juniors"
          method="post"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <label>
            <div style={{ marginBottom: 6 }}>Name</div>
            <input name="name" required placeholder="Jordan Lee" style={inputStyle} />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>GitHub login</div>
            <input
              name="githubLogin"
              required
              placeholder="jordan-dev"
              style={inputStyle}
            />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Team (optional)</div>
            <select name="teamId" defaultValue="" style={inputStyle}>
              <option value="">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            style={{
              background: "var(--accent)",
              color: "#0b0c10",
              border: "none",
              borderRadius: 8,
              padding: "12px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add junior
          </button>
        </form>
      </Card>
    </div>
  );
}
