import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/server/auth/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isManager = user.role === "manager" || user.role === "admin";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "24px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 16,
          borderBottom: "1px solid var(--border)",
          marginBottom: 24,
        }}
      >
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt=""
              height={24}
              // Fixed height, auto width keeps the (non-square) logo undistorted.
              style={{ height: 24, width: "auto", borderRadius: 6, display: "block" }}
            />
            <span style={{ fontWeight: 700, color: "var(--text)" }}>Tech Lead AI</span>
          </span>
          {isManager && <a href="/dashboard">Team</a>}
          {isManager && <a href="/dashboard/prs">All PRs</a>}
          {isManager && <a href="/dashboard/manage-conventions">Conventions</a>}
          {isManager && <a href="/dashboard/review">Review a PR</a>}
          {isManager && <a href="/dashboard/add-junior">Add junior</a>}
        </nav>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            {user.name} · {user.role}
          </span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              style={{
                background: "transparent",
                color: "var(--muted)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
