import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getAllPullRequests } from "@/server/db/pull-request";
import { countByAuthor, countByDay, startOfDayMs } from "@/server/stats/pr-stats";
import { Card } from "@/components/ui";
import { PieChart, Histogram } from "@/components/figures";
import { SortableTable, type Column } from "@/components/sortable-table";

const PR_COLUMNS: Column[] = [
  { key: "number", label: "PR #", type: "number" },
  // A "new" dot appears next to PRs opened within the last hour.
  { key: "title", label: "Title", type: "link", hrefKey: "href", newSinceKey: "createdAt" },
  { key: "author", label: "Junior", type: "link", hrefKey: "authorHref" },
  { key: "repo", label: "Repo", type: "text" },
  { key: "status", label: "Status", type: "status" },
  { key: "latestDensity", label: "Density", type: "number", align: "left" },
  // High-severity count + total comments, collapsed into one dense column.
  { key: "highSeverityCount", label: "Issues", type: "issues", subKey: "commentCount", align: "left" },
  { key: "createdAt", label: "Opened", type: "date", align: "left" },
];

export default async function AllPullRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ attention?: string; day?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // The all-PRs view is a manager/admin tool; juniors see only their own work.
  if (user.role === "junior") redirect(`/dashboard/juniors/${user.id}`);

  const { attention, day } = await searchParams;
  // "attention" = open PRs carrying a blocker or major — the ones that need eyes.
  const filtering = attention === "open-high";
  // "day" = a local-midnight timestamp from clicking a "PRs per day" bar.
  const dayMs = day != null && day !== "" ? Number(day) : null;
  const dayFiltering = dayMs != null && Number.isFinite(dayMs);

  const all = await getAllPullRequests(user.orgId);
  let prs = all;
  if (filtering) prs = prs.filter((pr) => pr.status === "open" && pr.highSeverityCount > 0);
  if (dayFiltering) prs = prs.filter((pr) => startOfDayMs(pr.createdAt) === dayMs);

  // Charts always reflect the full set, not the filtered table.
  const byAuthor = countByAuthor(all);
  const byDay = countByDay(all);
  // The chart's own local "DD/MM" label for the selected day (kept consistent
  // with the bar the user clicked, rather than reformatting the timestamp).
  const dayLabel = dayFiltering ? byDay.find((d) => d.dateMs === dayMs)?.label : null;

  const rows = prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    href: `/dashboard/prs/${pr.id}`,
    author: pr.authorName,
    authorHref: `/dashboard/juniors/${pr.authorId}`,
    // Just the repo name — the org/owner prefix is the same for every row and
    // only made the table heavier.
    repo: pr.repoFullName.split("/").pop() ?? pr.repoFullName,
    status: pr.status,
    latestDensity: pr.latestDensity,
    highSeverityCount: pr.highSeverityCount,
    commentCount: pr.commentCount,
    createdAt: pr.createdAt.getTime(),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ margin: 0 }}>All pull requests</h1>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "stretch" }}>
        <Card title="PRs per junior" style={{ flex: 1, minWidth: 300 }}>
          <PieChart data={byAuthor} />
        </Card>
        <Card title="PRs per day" style={{ flex: 1, minWidth: 300 }}>
          <Histogram data={byDay} />
        </Card>
      </div>

      <Card
        title={
          filtering
            ? `Open PRs with blockers or majors (${prs.length})`
            : dayFiltering
              ? `PRs opened on ${dayLabel ?? "that day"} (${prs.length})`
              : `All PRs (${prs.length})`
        }
      >
        {filtering && (
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Showing only open PRs that have a blocker or major.{" "}
            <a href="/dashboard/prs">Show all PRs</a>
          </p>
        )}
        {dayFiltering && (
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Showing only PRs opened on {dayLabel ?? "the selected day"}.{" "}
            <a href="/dashboard/prs">Show all PRs</a>
          </p>
        )}
        <SortableTable
          columns={PR_COLUMNS}
          rows={rows}
          initialSortKey="createdAt"
          initialSortDir="desc"
          searchKeys={["title", "author", "repo"]}
          searchPlaceholder="Search by PR title, junior, or repo…"
          emptyMessage="No pull requests yet."
        />
      </Card>
    </div>
  );
}
