"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { TrendBadge } from "./charts";
import { NewDot } from "./new-dot";
import { StatusBadge } from "./ui";
import { formatDate } from "@/lib/format";
import type { TrendDirection } from "@/server/db/dashboard";

/**
 * A generic, sortable (and optionally searchable) table. Columns are declared
 * with plain data — no render functions — so the whole spec stays serializable
 * and a server component can hand it rows directly.
 *
 * Clicking any header sorts by that column (toggling direction); a search box
 * (when `searchKeys` is given) filters rows by substring across those keys.
 */
export type ColumnType =
  | "text"
  | "number"
  | "percent"
  | "date"
  | "link"
  | "badge"
  | "status"
  | "issues";

export interface Column {
  key: string;
  label: string;
  type?: ColumnType; // defaults to "text"
  align?: "left" | "right";
  /** For type "link": the row field holding the href. */
  hrefKey?: string;
  /**
   * For type "link": a muted secondary text shown after the link.
   * For type "issues": the row field holding the total comment count
   * (`key` itself holds the high-severity count, which drives the sort).
   */
  subKey?: string;
  /**
   * For type "link": the row field holding an epoch-ms timestamp. When the
   * value is within the last hour a "new" dot is shown before the link.
   */
  newSinceKey?: string;
}

export type Row = Record<string, unknown>;

export interface SortableTableProps {
  columns: Column[];
  rows: Row[];
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
  /** When set, render a search box filtering rows by these row fields. */
  searchKeys?: string[];
  searchPlaceholder?: string;
  emptyMessage?: string;
}

// "issues" sorts by its high-severity count (column.key) so the most
// actionable PRs surface first.
const NUMERIC: ColumnType[] = ["number", "percent", "date", "issues"];

export function SortableTable({
  columns,
  rows,
  initialSortKey,
  initialSortDir = "asc",
  searchKeys,
  searchPlaceholder = "Search…",
  emptyMessage = "Nothing to show.",
}: SortableTableProps) {
  const [sortKey, setSortKey] = useState(initialSortKey ?? columns[0]?.key);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [query, setQuery] = useState("");

  const colByKey = useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered =
      q && searchKeys?.length
        ? rows.filter((r) =>
            searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)),
          )
        : rows;

    const col = colByKey.get(sortKey);
    const numeric = col ? NUMERIC.includes(col.type ?? "text") : false;
    const dir = sortDir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Missing values always sort to the bottom, regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (numeric) return (Number(av) - Number(bv)) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, query, searchKeys, sortKey, sortDir, colByKey]);

  function onHeaderClick(col: Column) {
    if (col.key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      // Numbers and dates read best high-to-low first.
      setSortDir(NUMERIC.includes(col.type ?? "text") ? "desc" : "asc");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {searchKeys?.length ? (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            width: "100%",
            maxWidth: 320,
            background: "var(--panel-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 14,
          }}
        />
      ) : null}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
            {columns.map((c) => {
              const active = c.key === sortKey;
              const align = c.align ?? "left";
              return (
                <th
                  key={c.key}
                  onClick={() => onHeaderClick(c)}
                  style={{
                    padding: "6px 8px",
                    textAlign: align,
                    cursor: "pointer",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    color: active ? "var(--text)" : "var(--muted)",
                  }}
                >
                  {c.label}
                  {active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "12px 8px", color: "var(--muted)" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            visible.map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      padding: "10px 8px",
                      textAlign: c.align ?? "left",
                      verticalAlign: "top",
                    }}
                  >
                    <Cell column={c} row={row} />
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const muted: CSSProperties = { color: "var(--muted)", fontSize: 12 };

/** Render one cell according to its column type. */
function Cell({ column, row }: { column: Column; row: Row }) {
  const value = row[column.key];

  switch (column.type) {
    case "badge":
      return <TrendBadge trend={value as TrendDirection} />;
    case "status":
      return <StatusBadge status={String(value ?? "")} />;
    case "percent":
      return <>{value == null ? "—" : `${Math.round(Number(value) * 100)}%`}</>;
    case "date":
      return <>{value == null ? "—" : formatDate(Number(value))}</>;
    case "number":
      return <>{value == null ? "—" : String(value)}</>;
    case "issues": {
      // One dense cell in place of separate "Blockers + majors" and
      // "Comments" columns: high-severity count (coloured when present) then
      // the total. `value` (column.key) is the high-severity count.
      const high = Number(value ?? 0);
      const total = column.subKey ? Number(row[column.subKey] ?? 0) : 0;
      if (total === 0) return <span style={muted}>—</span>;
      return (
        <span style={{ fontSize: 13 }}>
          {high > 0 && (
            <strong style={{ color: "var(--bad)" }}>{high} high</strong>
          )}
          <span style={{ ...muted, marginLeft: high > 0 ? 6 : 0 }}>
            {high > 0 ? `· ${total}` : total}
          </span>
        </span>
      );
    }
    case "link": {
      const href = column.hrefKey ? String(row[column.hrefKey] ?? "") : "";
      const sub = column.subKey ? row[column.subKey] : null;
      const since = column.newSinceKey ? row[column.newSinceKey] : null;
      return (
        <>
          {since != null && <NewDot since={Number(since)} />}
          <a href={href}>{String(value ?? "")}</a>
          {sub ? <span style={{ ...muted, marginLeft: 6 }}>{String(sub)}</span> : null}
        </>
      );
    }
    default:
      return <>{value == null ? "—" : String(value)}</>;
  }
}
