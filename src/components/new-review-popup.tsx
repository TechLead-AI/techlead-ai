"use client";

import { useEffect, useState } from "react";
import type { LatestReviewNotice } from "@/server/db/latest-review";

/**
 * A popup that announces the most recent review to a manager, wherever they are
 * in the dashboard. It states who opened the PR, the PR's title, and how many
 * issues the review found, with a button to open the PR.
 *
 * Shown once per review per browser: the first load after a new review shows it,
 * and any later refresh or navigation does not. We remember the last review id a
 * browser has seen in localStorage and mark the current one seen as soon as we
 * show it. (This is exactly the demo flow: many managers refresh and each sees
 * the popup once, then it's gone for them.)
 *
 * Like NewDot, "have we seen this?" depends on browser-only state, so we render
 * nothing on the server and on the first client paint, then decide after mount —
 * which avoids a React hydration mismatch.
 */
const SEEN_KEY = "tlai_seen_review";

export function NewReviewPopup({ notice }: { notice: LatestReviewNotice }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alreadySeen = false;
    try {
      alreadySeen = window.localStorage.getItem(SEEN_KEY) === notice.reviewId;
    } catch {
      // Private mode / storage disabled: just show it this once.
    }
    if (!alreadySeen) setOpen(true);
  }, [notice.reviewId]);

  // Mark this review seen only once the manager actually dismisses or acts on
  // it — never merely on mount. Otherwise a fast navigation past the popup
  // would record it as seen and the manager would never see it again.
  function markSeen() {
    try {
      window.localStorage.setItem(SEEN_KEY, notice.reviewId);
    } catch {
      // Private mode / storage disabled: nothing to remember.
    }
  }

  function close() {
    markSeen();
    setOpen(false);
  }

  // Let Escape close the popup, like any well-behaved dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `close` is stable enough here; re-bind only when open toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const issues =
    notice.issueCount === 1 ? "1 issue" : `${notice.issueCount} issues`;

  return (
    // Clicking the backdrop (anywhere outside the card) closes the popup.
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New review"
        // Clicks inside the card must not bubble to the backdrop (which closes).
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.45)",
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            color: "var(--muted)",
            border: "none",
            borderRadius: 6,
            fontSize: 18,
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <SparkIcon />
          <span
            style={{
              color: "var(--warn)",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontSize: 13,
            }}
          >
            New
          </span>
        </div>

        <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--text)" }}>
          {notice.prTitle}
        </h3>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
          Opened by {notice.authorName} · {issues}
        </p>

        <a
          href={`/dashboard/prs/${notice.pullRequestId}`}
          onClick={markSeen}
          style={{
            display: "inline-block",
            marginTop: 16,
            padding: "8px 16px",
            background: "var(--warn)",
            color: "#1a1205",
            fontWeight: 600,
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          View PR
        </a>
      </div>
    </div>
  );
}

/** A minimal four-point sparkle — the "something new" glyph, in warm yellow/orange. */
function SparkIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="var(--warn)"
      role="img"
      aria-label="new"
    >
      <path d="M12 2l2.2 6.3 6.3 2.2-6.3 2.2L12 22l-2.2-6.3L3.5 13.5l6.3-2.2L12 2z" />
    </svg>
  );
}
