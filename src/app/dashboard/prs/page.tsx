import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getAllPullRequests } from "@/server/db/pull-request";
import { countByAuthor, countByDay } from "@/server/stats/pr-stats";
import { Card } from "@/components/ui";
import { PieChart, Histogram } from "@/components/figures";
import { SortableTable, type Column } from "@/components/sortable-table";

const PR_COLUMNS: Column[] = [
  { key: "number", label: "PR #", type: "number" },
  { key: "title", label: "Title", type: "link", hrefKey: "href" },
  { key: "author", label: "Junior", type: "link", hrefKey: "authorHref" },
  { key: "repo", label: "Repo", type: "text" },
  { key: "status", label: "Status", type: "status" },
  { key: "latestDensity", label: "Density", type: "number", align: "left" },
  { key: "highSeverityCount", label: "Blockers + majors", type: "number", align: "left" },
  { key: "commentCount", label: "Comments", type: "number", align: "left" },
  { key: "createdAt", label: "Opened", type: "date", align: "left" },
];

export default async function AllPullRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ attention?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // The all-PRs view is a manager/admin tool; juniors see only their own work.
  if (user.role === "junior") redirect(`/dashboard/juniors/${user.id}`);

  const { attention } = await searchParams;
  // "attention" = open PRs carrying a blocker or major — the ones that need eyes.
  const filtering = attention === "open-high";

  const all = await getAllPullRequests(user.orgId);
  const prs = filtering
    ? all.filter((pr) => pr.status === "open" && pr.highSeverityCount > 0)
    : all;

  // Charts always reflect the full set, not the filtered table.
  const byAuthor = countByAuthor(all);
  const byDay = countByDay(all);

  const rows = prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    href: `/dashboard/prs/${pr.id}`,
    author: pr.authorName,
    authorHref: `/dashboard/juniors/${pr.authorId}`,
    repo: pr.repoFullName,
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
            : `All PRs (${prs.length})`
        }
      >
        {filtering && (
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Showing only open PRs that have a blocker or major.{" "}
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
