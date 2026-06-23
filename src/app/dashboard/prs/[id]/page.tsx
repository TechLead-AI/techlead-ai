import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { getPullRequestDetail } from "@/server/db/pull-request";
import { Card, Stat, Tag, StatusBadge } from "@/components/ui";
import { CommentCard } from "@/components/comment-card";
import { formatDate } from "@/lib/format";

export default async function PullRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // getPullRequestDetail scopes by org, so cross-org access returns null.
  const pr = await getPullRequestDetail(user.orgId, id);
  if (!pr) notFound();

  // Visibility: a junior may only view their own PRs.
  const isManager = user.role === "manager" || user.role === "admin";
  if (!isManager && user.id !== pr.authorId) {
    redirect(`/dashboard/juniors/${user.id}`);
  }

  const date = (d: Date) => formatDate(d);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <a href={`/dashboard/juniors/${pr.authorId}`} style={{ fontSize: 13 }}>
            ← {pr.authorName}
          </a>
          <h1 style={{ margin: "6px 0 4px" }}>
            #{pr.number} — {pr.title}
          </h1>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {pr.repoFullName} · by {pr.authorName} (@{pr.authorLogin}) · opened{" "}
            {date(pr.createdAt)}
          </div>
        </div>

        {/* Status / lines / reviews share the title's row, pushed right. */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Card>
            <Stat label="Status" value={<StatusBadge status={pr.status} />} />
          </Card>
          <Card>
            <Stat label="Lines changed" value={pr.linesChanged} />
          </Card>
          <Card>
            <Stat label="Reviews" value={pr.reviews.length} />
          </Card>
        </div>
      </div>

      {pr.reviews.length === 0 ? (
        <Card>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            This PR hasn&apos;t been reviewed yet.
          </p>
        </Card>
      ) : (
        pr.reviews.map((review, i) => (
          <Card
            key={review.id}
            title={
              pr.reviews.length > 1
                ? `Review ${pr.reviews.length - i} · ${date(review.createdAt)}`
                : undefined
            }
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <Tag>{review.modelVersion}</Tag>
              {review.issueDensity !== null && (
                <Tag>density {review.issueDensity}</Tag>
              )}
              {review.repeatRate !== null && (
                <Tag>repeats {Math.round(review.repeatRate * 100)}%</Tag>
              )}
              <Tag>{review.commentCount} comment(s)</Tag>
            </div>

            <p style={{ marginTop: 0 }}>{review.summary}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {review.comments.length === 0 ? (
                <p style={{ color: "var(--muted)", margin: 0 }}>
                  No inline comments — clean run.
                </p>
              ) : (
                review.comments.map((c) => <CommentCard key={c.id} comment={c} />)
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
