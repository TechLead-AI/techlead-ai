import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getTeamOverview, getTeamStats, needsAttention } from "@/server/db/dashboard";
import { Card, Stat } from "@/components/ui";
import { BarList, TrendBadge, type BarDatum } from "@/components/charts";
import { SortableTable, type Column } from "@/components/sortable-table";

const ROSTER_COLUMNS: Column[] = [
  { key: "name", label: "Name", type: "link", hrefKey: "href", subKey: "login" },
  { key: "reviewCount", label: "Reviews", type: "number" },
  { key: "latestDensity", label: "Latest density", type: "number", align: "left" },
  { key: "latestRepeatRate", label: "Repeat rate", type: "percent", align: "left" },
  { key: "trend", label: "Trend", type: "badge" },
];

export default async function DashboardHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Juniors land on their own profile — no team-wide view, no leaderboard.
  if (user.role === "junior") {
    redirect(`/dashboard/juniors/${user.id}`);
  }

  const [overview, stats] = await Promise.all([
    getTeamOverview(user.orgId),
    getTeamStats(user.orgId),
  ]);
  const attention = needsAttention(overview.juniors);

  // Common-mistake bars drill down to the actual comments, labelled by author.
  const mistakeBars: BarDatum[] = overview.commonMistakes.map((m) => ({
    label: m.category,
    count: m.count,
    items: m.items.map((it) => ({
      href: `/dashboard/prs/${it.pullRequestId}`,
      text: `${it.authorName ?? "?"} · #${it.prNumber} — ${it.message}`,
    })),
  }));

  const rosterRows = overview.juniors.map((j) => ({
    name: j.name,
    href: `/dashboard/juniors/${j.id}`,
    login: `@${j.githubLogin}`,
    reviewCount: j.reviewCount,
    latestDensity: j.latestDensity,
    latestRepeatRate: j.latestRepeatRate,
    trend: j.trend,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>Team</h1>
        {/* Stat blocks pushed to the right of the heading's row. */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Card>
            <Stat label="Mentored juniors" value={stats.juniorCount} />
          </Card>
          <Card>
            <Stat label="Reviews run" value={stats.reviewCount} />
          </Card>
          <Card>
            <Stat label="Avg issue density" value={stats.avgDensity ?? "—"} />
          </Card>
          <Card>
            <Stat label="Open blockers + majors" value={stats.openHighSeverity} />
          </Card>
        </div>
      </div>

      {attention.length > 0 && (
        <Card title="Needs attention">
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Trending worse, or stuck repeating the same mistakes — good 1:1 topics.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {attention.map((j) => (
              <li key={j.id} style={{ marginBottom: 4 }}>
                <a href={`/dashboard/juniors/${j.id}`}>{j.name}</a>{" "}
                <TrendBadge trend={j.trend} />{" "}
                <span style={{ color: "var(--muted)", fontSize: 13 }}>
                  repeat rate {Math.round((j.latestRepeatRate ?? 0) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Juniors">
        {overview.juniors.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No mentored juniors yet.</p>
        ) : (
          <SortableTable
            columns={ROSTER_COLUMNS}
            rows={rosterRows}
            initialSortKey="name"
          />
        )}
      </Card>

      <Card title="Comments by severity">
        <BarList
          data={stats.severityCounts.map((s) => ({
            label: s.severity,
            count: s.count,
          }))}
        />
      </Card>

      <Card title="Most common mistakes across the team">
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Recurring themes here are good candidates to add to your team conventions.
          Click a category to see the comments behind it.
        </p>
        <BarList data={mistakeBars} />
      </Card>
    </div>
  );
}
