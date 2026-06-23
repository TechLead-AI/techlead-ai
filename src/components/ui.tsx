import type { CSSProperties, ReactNode } from "react";

/**
 * A simple panel/card used across the dashboards. Accepts an optional `style`
 * so callers can, e.g., make side-by-side cards flex to equal height.
 */
export function Card({
  title,
  children,
  style,
}: {
  title?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 20,
        ...style,
      }}
    >
      {title && <h3 style={{ margin: "0 0 12px" }}>{title}</h3>}
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/** Severity → colour. Severity describes the code, never the person (DESIGN.md). */
const SEVERITY_COLOR: Record<string, string> = {
  blocker: "var(--bad)",
  major: "var(--warn)",
  minor: "var(--accent)",
  nit: "var(--nit)",
};

/** A small coloured pill for a comment's severity. */
export function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity] ?? "var(--muted)";
  return (
    <span
      style={{
        color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: "1px 8px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {severity}
    </span>
  );
}

/** PR status → colour (GitHub's convention: open green, merged purple, closed red). */
const STATUS_COLOR: Record<string, string> = {
  open: "var(--good)",
  merged: "#a78bfa",
  closed: "var(--bad)",
};

/** A coloured pill for a pull request's status. */
export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "var(--muted)";
  return (
    <span
      style={{
        color,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 600,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

/** A neutral tag, e.g. for a comment's category or convention reference. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        color: "var(--muted)",
        background: "var(--panel-2)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "1px 8px",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
