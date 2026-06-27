import type { PRCommentDetail } from "@/server/db/pull-request";
import { SeverityBadge, Tag } from "./ui";

/**
 * Renders one review comment with all of its Layer 1 data (DESIGN.md component
 * 4): location, severity, category, the message, the mandatory "why" (the
 * mentoring), an optional suggestion, the convention it maps to, plus whether it
 * was actually posted and whether it repeats a past mistake.
 */
export function CommentCard({ comment }: { comment: PRCommentDetail }) {
  const location =
    comment.lineStart === comment.lineEnd
      ? `${comment.filePath}:${comment.lineStart}`
      : `${comment.filePath}:${comment.lineStart}–${comment.lineEnd}`;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 14,
        background: "var(--panel-2)",
        // Suppressed comments are dimmed but still shown — they are part of the
        // record even though a gate kept them off GitHub.
        opacity: comment.posted ? 1 : 0.6,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
      >
        <SeverityBadge severity={comment.severity} />
        <Tag>{comment.category}</Tag>
        <code style={{ color: "var(--muted)", fontSize: 12, wordBreak: "break-all" }}>
          {location}
        </code>
        <span style={{ flex: 1 }} />
        {comment.repeatOfId && (
          <span style={{ color: "var(--warn)", fontSize: 12 }}>↻ repeat</span>
        )}
        {!comment.posted && (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>not posted</span>
        )}
        <span style={{ color: "var(--muted)", fontSize: 12 }}>
          {Math.round(comment.confidence * 100)}% confident
        </span>
      </div>

      <p style={{ margin: "10px 0 6px", fontWeight: 600 }}>{comment.message}</p>
      <p style={{ margin: "0 0 6px", color: "var(--muted)" }}>
        <span style={{ color: "var(--text)" }}>Why: </span>
        {comment.why}
      </p>

      {comment.suggestion && (
        <p style={{ margin: "0 0 6px" }}>
          <span style={{ color: "var(--muted)" }}>Suggestion: </span>
          {comment.suggestion}
        </p>
      )}

      {comment.conventionRef && (
        <div style={{ marginTop: 8 }}>
          <Tag>📘 {comment.conventionRef}</Tag>
        </div>
      )}
    </div>
  );
}
