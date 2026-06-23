import type { ConventionScope } from "@/server/conventions/merge";
import { DocIcon } from "./icons";

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
          }}
        />
        <div>
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
