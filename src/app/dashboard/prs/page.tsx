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
  { key: "latestDensity", label: "Density", type: "number", align: "right" },
  { key: "commentCount", label: "Comments", type: "number", align: "right" },
  { key: "createdAt", label: "Opened", type: "date", align: "right" },
];

export default async function AllPullRequestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // The all-PRs view is a manager/admin tool; juniors see only their own work.
  if (user.role === "junior") redirect(`/dashboard/juniors/${user.id}`);

  const prs = await getAllPullRequests(user.orgId);
  const byAuthor = countByAuthor(prs);
  const byDay = countByDay(prs);

  const rows = prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    href: `/dashboard/prs/${pr.id}`,
    author: pr.authorName,
    authorHref: `/dashboard/juniors/${pr.authorId}`,
    repo: pr.repoFullName,
    latestDensity: pr.latestDensity,
    commentCount: pr.commentCount,
    createdAt: pr.createdAt.getTime(),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ margin: 0 }}>All pull requests</h1>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <Card title="PRs per junior">
            <PieChart data={byAuthor} />
          </Card>
        </div>
        <div style={{ flex: 1, minWidth: 300 }}>
          <Card title="PRs per day">
            <Histogram data={byDay} />
          </Card>
        </div>
      </div>

      <Card title={`All PRs (${prs.length})`}>
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
