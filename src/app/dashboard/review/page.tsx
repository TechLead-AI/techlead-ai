import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { prisma } from "@/server/db/client";
import { Card } from "@/components/ui";

const SAMPLE_DIFF = `+++ b/src/payment.ts
@@ -0,0 +1,5 @@
+const stripeKey = "sk-live-do-not-commit";
+let result: any = chargeCard();
+try { settle(result); } catch (e) {}
+console.log("charged", result);
+// TODO: add idempotency key`;

export default async function ReviewPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "junior") redirect(`/dashboard/juniors/${user.id}`);

  const [juniors, repos] = await Promise.all([
    prisma.user.findMany({
      where: { orgId: user.orgId, isMentoredJunior: true },
      orderBy: { name: "asc" },
    }),
    prisma.repo.findMany({ where: { orgId: user.orgId }, orderBy: { fullName: "asc" } }),
  ]);

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
      <h1 style={{ margin: 0 }}>Review a PR</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        Paste a diff to run a real review now. (The GitHub App does this
        automatically on every PR — this is the same pipeline, triggered by hand.)
      </p>

      <Card>
        <form
          action="/api/review/manual"
          method="post"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <label>
            <div style={{ marginBottom: 6 }}>Junior</div>
            <select name="authorId" required style={inputStyle}>
              {juniors.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} (@{j.githubLogin})
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Repo</div>
            <select name="repoId" required style={inputStyle}>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>PR title</div>
            <input name="title" defaultValue="Add payment handling" style={inputStyle} />
          </label>

          <label>
            <div style={{ marginBottom: 6 }}>Diff</div>
            <textarea
              name="diff"
              rows={10}
              defaultValue={SAMPLE_DIFF}
              style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }}
            />
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
            Run review
          </button>
        </form>
      </Card>
    </div>
  );
}
