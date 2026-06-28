"use client";

import { useEffect, useState } from "react";
import type { ConventionScope } from "@/server/conventions/merge";
import { DocIcon } from "./icons";

// Editing conventions is a desk task: on phones (and touch devices with no
// hover) the Save button is hidden (globals.css), so the textarea must be
// read-only too — otherwise you could type a whole doc with no way to save it.
// Same query as the `.desktop-only` rule so the two always agree.
const COMPACT_QUERY = "(max-width: 640px), (hover: none) and (pointer: coarse)";

/**
 * One editable convention layer in the tree. Collapsed by default; expanding it
 * reveals a textarea pre-filled with the current markdown. Saving posts to the
 * conventions API, which writes a new version.
 */
export function ConventionEditor({
  label,
  scope,
  teamId,
  repoId,
  markdown,
  version,
}: {
  label: string;
  scope: ConventionScope;
  teamId?: string;
  repoId?: string;
  markdown: string;
  version: number;
}) {
  const hasDoc = version > 0;

  // Decide read-only after mount (browser-only state), like NewDot, so the
  // server render and first client paint match and there's no hydration drift.
  // Re-checks on resize/orientation change so flipping a phone keeps it locked.
  const [readOnly, setReadOnly] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const sync = () => setReadOnly(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <details
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 14px",
        background: "var(--panel-2)",
      }}
    >
      <summary style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: hasDoc ? "var(--accent)" : "var(--muted)", display: "flex" }}>
          <DocIcon />
        </span>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span
          style={{
            color: hasDoc ? "var(--good)" : "var(--muted)",
            fontSize: 12,
            border: "1px solid var(--border)",
            borderRadius: 999,
            padding: "0 8px",
          }}
        >
          {hasDoc ? `v${version}` : "not set"}
        </span>
      </summary>

      <form
        action="/api/conventions"
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}
      >
        <input type="hidden" name="scope" value={scope} />
        {teamId && <input type="hidden" name="teamId" value={teamId} />}
        {repoId && <input type="hidden" name="repoId" value={repoId} />}
        <textarea
          name="markdown"
          rows={12}
          defaultValue={markdown}
          readOnly={readOnly}
          aria-readonly={readOnly}
          placeholder="Describe what good code looks like for this layer (markdown)…"
          style={{
            width: "100%",
            background: "var(--panel)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 12px",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            // Locked layers read as muted and show the no-edit cursor.
            opacity: readOnly ? 0.7 : 1,
            cursor: readOnly ? "not-allowed" : "text",
          }}
        />
        {/* Editing conventions is a desk task — hide the save/create on phones. */}
        <div className="desktop-only">
          <button
            type="submit"
            style={{
              background: "var(--accent)",
              color: "#0b0c10",
              border: "none",
              borderRadius: 8,
              padding: "8px 14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {hasDoc ? `Save as v${version + 1}` : "Create conventions"}
          </button>
        </div>
      </form>
    </details>
  );
}
