import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser } from "@/server/auth/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isManager = user.role === "manager" || user.role === "admin";

  return (
    <div className="dash-shell">
      {/* Top row: brand on the left, user + sign-out on the right. A direct
          child of the shell so it can stay pinned across the whole page while
          scrolling on mobile (see globals.css). */}
      <header className="dash-topbar">
        <span className="dash-brand">
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
        <div className="dash-userbar">
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

      {/* Second row: the page links. */}
      <nav className="dash-nav">
        {isManager && <a href="/dashboard">Team</a>}
        {isManager && <a href="/dashboard/prs">All PRs</a>}
        {isManager && <a href="/dashboard/manage-conventions">Conventions</a>}
        {/* "Review a PR" and "Add junior" are hidden on phones — they're
            desk-bound manager actions, not something to trigger on the go. */}
        {isManager && (
          <a className="nav-desktop-only" href="/dashboard/review">
            Review a PR
          </a>
        )}
        {isManager && (
          <a className="nav-desktop-only" href="/dashboard/add-junior">
            Add junior
          </a>
        )}
      </nav>
      {children}
    </div>
  );
}
