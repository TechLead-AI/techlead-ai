import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getJuniorProfile, type CategoryBreakdown } from "@/server/db/dashboard";
import { Card, Stat } from "@/components/ui";
import { LineChart, BarList, TrendBadge, type BarDatum } from "@/components/charts";
import { formatDate, formatDayMonth } from "@/lib/format";

/** Turn category breakdowns into expandable bars that link to each PR. */
function toBars(rows: CategoryBreakdown[]): BarDatum[] {
  return rows.map((r) => ({
    label: r.category,
    count: r.count,
    items: r.items.map((it) => ({
      href: `/dashboard/prs/${it.pullRequestId}`,
      text: `#${it.prNumber} — ${it.message}`,
    })),
  }));
}

export default async function JuniorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Visibility: a junior may only view their own profile.
  const isManager = user.role === "manager" || user.role === "admin";
  if (!isManager && user.id !== id) {
    redirect(`/dashboard/juniors/${user.id}`);
  }

  // getJuniorProfile scopes by org, so cross-org access returns null.
  const profile = await getJuniorProfile(user.orgId, id);
  if (!profile) notFound();

  const densityPoints = profile.trend.map((t) => ({
    value: t.issueDensity,
    label: `#${t.prNumber} · ${formatDate(t.createdAt)}`,
    axisLabel: formatDayMonth(t.createdAt),
    href: `/dashboard/prs/${t.pullRequestId}`,
  }));
  const repeatPoints = profile.trend.map((t) => ({
    value: Math.round(t.repeatRate * 100),
    label: `#${t.prNumber} · ${formatDate(t.createdAt)}`,
    axisLabel: formatDayMonth(t.createdAt),
    href: `/dashboard/prs/${t.pullRequestId}`,
  }));
  const latest = profile.trend[profile.trend.length - 1];

  // Side-by-side cards share the row (stretching to equal height) and wrap on
  // narrow screens.
  const halfRow = { display: "flex", gap: 24, flexWrap: "wrap", alignItems: "stretch" } as const;
  const half = { flex: 1, minWidth: 280 } as const;

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0 }}>{profile.name}</h1>
          <span style={{ color: "var(--muted)" }}>@{profile.githubLogin}</span>
          <TrendBadge trend={profile.trendDirection} />
        </div>
        {/* Stat blocks pushed to the right of the name's row. */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Card>
            <Stat label="Reviews" value={profile.trend.length} />
          </Card>
          <Card>
            <Stat label="Latest issue density" value={latest ? latest.issueDensity : "—"} />
          </Card>
          <Card>
            <Stat
              label="Latest repeat rate"
              value={latest ? `${Math.round(latest.repeatRate * 100)}%` : "—"}
            />
          </Card>
        </div>
      </div>

      <div style={halfRow}>
        <Card title="Issue density over time (lower is better)" style={half}>
          <LineChart points={densityPoints} color="var(--good)" />
        </Card>
        <Card title="Repeat-mistake rate over time (lower is better)" style={half}>
          <LineChart points={repeatPoints} color="var(--warn)" />
        </Card>
      </div>

      <div style={halfRow}>
        <Card title="Where the feedback lands (by category)" style={half}>
          <BarList data={toBars(profile.categoryMix)} />
        </Card>
        <Card title="Top recurring mistakes — the 1:1 agenda" style={half}>
          {profile.topRecurringMistakes.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              No repeated mistakes yet — great sign.
            </p>
          ) : (
            <BarList data={toBars(profile.topRecurringMistakes)} />
          )}
        </Card>
      </div>

      <Card title="Recent reviews">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {[...profile.trend].reverse().map((t) => (
            <li key={t.reviewId}>
              <a href={`/dashboard/prs/${t.pullRequestId}`}>
                PR #{t.prNumber} — {t.prTitle}
              </a>{" "}
              <span style={{ color: "var(--muted)" }}>
                (density {t.issueDensity}, repeats {Math.round(t.repeatRate * 100)}%)
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
