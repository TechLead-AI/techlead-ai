"use client";

import { useState } from "react";
import { useElementWidth } from "./use-element-width";
import type { TrendDirection } from "@/server/db/dashboard";

/**
 * Small, dependency-free presentational components for the dashboards. Charts
 * are hand-drawn SVG so there is no chart library to learn or maintain. They are
 * client components so the user can hover for details and click through to the
 * underlying PR / comments.
 */

/** One point on a line chart: a value plus what to show and where to go. */
export interface LinePoint {
  value: number;
  /** Shown in the hover tooltip, e.g. a date. */
  label: string;
  /** Short label for the x-axis tick (e.g. just the date). Falls back to label. */
  axisLabel?: string;
  /** Optional: clicking the point navigates here (e.g. the PR page). */
  href?: string;
}

const MARGIN = { top: 10, right: 12, bottom: 22, left: 34 };
// Floor so a sliver-width container can't push the plot area negative (which
// would invert the axes and produce NaN coordinates). Real containers are wider.
const MIN_PLOT_WIDTH = 180;

/**
 * A line chart of a numeric series (e.g. issue density over time) with x and y
 * axes. Hovering a point shows its label and value; clicking a point with an
 * href navigates to it (the PR that produced that data point).
 */
export function LineChart({
  points,
  width = 340,
  height = 140,
  color = "var(--accent)",
}: {
  points: LinePoint[];
  /** Fallback width; the chart grows to fill its container when it can. */
  width?: number;
  height?: number;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Fill the card on wide screens; shrink to fit on a phone.
  const { ref, width: measuredW } = useElementWidth(width);
  const w = Math.max(measuredW, MIN_PLOT_WIDTH);

  if (points.length === 0) {
    return <p style={{ color: "var(--muted)" }}>No data yet.</p>;
  }

  const plotW = w - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const baseY = MARGIN.top + plotH;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: MARGIN.left + (points.length > 1 ? i * stepX : plotW / 2),
    y: MARGIN.top + plotH - (p.value / max) * plotH,
  }));
  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const axis = "var(--border)";
  const tickText = { fontSize: 10, fill: "var(--muted)" } as const;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height }}>
      {/* Absolute so the SVG's own width never widens the card: the wrapper
          width is driven by its container, and `w` is measured from it. */}
      <svg
        width={w}
        height={height}
        role="img"
        aria-label="trend line"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* y axis with 0 and max ticks */}
        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={baseY} stroke={axis} />
        <text x={MARGIN.left - 5} y={MARGIN.top + 4} textAnchor="end" {...tickText}>
          {max}
        </text>
        <text x={MARGIN.left - 5} y={baseY} textAnchor="end" {...tickText}>
          0
        </text>

        {/* x axis with first and last labels */}
        <line x1={MARGIN.left} y1={baseY} x2={MARGIN.left + plotW} y2={baseY} stroke={axis} />
        <text x={MARGIN.left} y={height - 6} textAnchor="start" {...tickText}>
          {points[0].axisLabel ?? points[0].label}
        </text>
        {points.length > 1 && (
          <text x={MARGIN.left + plotW} y={height - 6} textAnchor="end" {...tickText}>
            {points[points.length - 1].axisLabel ?? points[points.length - 1].label}
          </text>
        )}

        <polyline
          points={polyline}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => {
          const p = points[i];
          const active = hover === i;
          const node = (
            <g
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: p.href ? "pointer" : "default" }}
            >
              {/* Generous invisible hit target so you don't need pixel-perfect aim. */}
              <circle cx={c.x} cy={c.y} r={14} fill="transparent" />
              {/* Visible dot grows and gains a ring when hovered. */}
              <circle
                cx={c.x}
                cy={c.y}
                r={active ? 6 : 3.5}
                fill={color}
                stroke={active ? "var(--bg)" : "none"}
                strokeWidth={active ? 2 : 0}
              />
            </g>
          );
          // An SVG anchor makes the point a real link when there is somewhere
          // to go; otherwise it is just a hoverable dot.
          return p.href ? (
            <a key={i} href={p.href}>
              {node}
            </a>
          ) : (
            <g key={i}>{node}</g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(coords[hover].x, 0), w - 8),
            top: coords[hover].y,
            transform: "translate(-50%, -120%)",
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          <strong>{points[hover].value}</strong>{" "}
          <span style={{ color: "var(--muted)" }}>{points[hover].label}</span>
        </div>
      )}
    </div>
  );
}

/** A drill-down link shown when a bar is expanded. */
export interface BarItem {
  href: string;
  text: string;
}

export interface BarDatum {
  label: string;
  count: number;
  /** Contributing items; when present the bar is expandable. */
  items?: BarItem[];
}

/**
 * A horizontal bar list for category counts. Each row is label / track / count.
 * The label and count have a fixed width and never shrink, and every bar lives
 * in the same flex:1 track — so all bars share one 0–100% baseline and line up,
 * regardless of how long any single bar is.
 *
 * When a row carries `items`, clicking it expands an inline list of the
 * contributing comments, each linking to the PR it came from.
 */
export function BarList({ data }: { data: BarDatum[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (data.length === 0) {
    return <p style={{ color: "var(--muted)" }}>Nothing here yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d) => {
        const expandable = (d.items?.length ?? 0) > 0;
        const isOpen = open === d.label;
        return (
          <div key={d.label}>
            <div
              onClick={expandable ? () => setOpen(isOpen ? null : d.label) : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: expandable ? "pointer" : "default",
              }}
            >
              <span
                style={{
                  width: 110,
                  flexShrink: 0,
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                {expandable && (
                  <span style={{ display: "inline-block", width: 12 }}>
                    {isOpen ? "▾" : "▸"}
                  </span>
                )}
                {d.label}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    height: 16,
                    width: `${(d.count / max) * 100}%`,
                    minWidth: 4,
                    background: "var(--accent)",
                    borderRadius: 4,
                  }}
                />
              </div>
              <span
                style={{ width: 28, flexShrink: 0, textAlign: "right", fontSize: 13 }}
              >
                {d.count}
              </span>
            </div>

            {expandable && isOpen && (
              <ul
                style={{
                  margin: "6px 0 10px 122px",
                  paddingLeft: 14,
                  fontSize: 13,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {d.items!.map((item, i) => (
                  <li key={i}>
                    <a href={item.href}>{item.text}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Arrows point in the direction of progress (up = improving), independent of the
// underlying metric where lower is better.
const TREND_STYLE: Record<TrendDirection, { label: string; color: string }> = {
  improving: { label: "↑ improving", color: "var(--good)" },
  flat: { label: "→ steady", color: "var(--muted)" },
  worsening: { label: "↓ slipping", color: "var(--bad)" },
  new: { label: "• new", color: "var(--accent)" },
};

/** A small coloured badge describing a junior's trend (growth-framed). */
export function TrendBadge({ trend }: { trend: TrendDirection }) {
  const s = TREND_STYLE[trend];
  return (
    <span
      style={{
        color: s.color,
        border: `1px solid ${s.color}`,
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}
