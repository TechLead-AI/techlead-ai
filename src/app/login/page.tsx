import { prisma } from "@/server/db/client";

// Reads live data, so never prerender it.
export const dynamic = "force-dynamic";

/**
 * Demo login screen: pick who to sign in as. In production this is replaced by
 * "Sign in with GitHub" — the rest of the app is unchanged.
 */
export default async function LoginPage() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { org: true },
  });

  return (
    <main style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px" }}>
      <h1>Tech Lead AI</h1>
      <p style={{ color: "var(--muted)" }}>
        Demo sign-in — choose a user. (Replaced by GitHub OAuth in production.)
      </p>

      {users.length === 0 && (
        <p>
          No users yet. Run <code>npm run db:seed</code> first.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
        {users.map((u) => (
          <form key={u.id} action="/api/auth/login" method="post">
            <input type="hidden" name="userId" value={u.id} />
            <button
              type="submit"
              data-testid={`login-${u.githubLogin}`}
              style={{
                width: "100%",
                textAlign: "left",
                background: "var(--panel)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "12px 16px",
                cursor: "pointer",
              }}
            >
              <strong>{u.name}</strong>{" "}
              <span style={{ color: "var(--muted)" }}>
                · {u.role} · {u.org.name}
              </span>
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
