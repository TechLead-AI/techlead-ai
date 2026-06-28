"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useElementWidth } from "./use-element-width";
import type { CountSlice, DayCount } from "@/server/stats/pr-stats";

/**
 * SVG figures for the all-PRs page: a pie chart (PRs per junior) and a histogram
 * (PRs per day). Dependency-free. The pie is interactive — hovering a slice (or
 * its legend row) shows the junior and their PR count.
 */

const PALETTE = [
  "#6ea8fe",
  "#4ade80",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fb923c",
];

// Pie and histogram share this height so the two cards line up side by side.
const FIGURE_HEIGHT = 180;

/** A pie chart with an interactive legend. */
export function PieChart({ data, size = FIGURE_HEIGHT }: { data: CountSlice[]; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <p style={{ color: "var(--muted)" }}>No data yet.</p>;

  const r = size / 2;
  const colored = data.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));
  const single = colored.length === 1;

  return (
    // pie + legend always share one row; on mobile the pie shrinks (see
    // globals.css) and the legend takes the rest, so names never wrap below it.
    <div className="pie-figure">
      <div className="pie-canvas" style={{ "--pie-size": `${size}px` } as CSSProperties}>
        {/* viewBox lets the drawing scale cleanly when the box shrinks. */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height="100%"
          role="img"
          aria-label="PRs per junior"
          style={{ display: "block" }}
        >
          {single ? (
            <SliceLink href={colored[0].href}>
              <circle
                cx={r}
                cy={r}
                r={r}
                fill={colored[0].color}
                onMouseEnter={() => setHover(0)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: colored[0].href ? "pointer" : "default" }}
              />
            </SliceLink>
          ) : (
            slicePaths(colored, total, r, hover, setHover)
          )}
        </svg>
        {hover !== null && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 12,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              textAlign: "center",
            }}
          >
            <strong>{colored[hover].label}</strong>
            <br />
            {colored[hover].count} PR{colored[hover].count === 1 ? "" : "s"} (
            {Math.round((colored[hover].count / total) * 100)}%)
          </div>
        )}
      </div>

      <ul className="pie-legend">
        {colored.map((d, i) => (
          <li
            key={d.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              cursor: d.href ? "pointer" : "default",
              opacity: hover === null || hover === i ? 1 : 0.5,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: d.color,
                display: "inline-block",
              }}
            />
            {/* The name links to that junior's filtered view when available. */}
            {d.href ? <a href={d.href}>{d.label}</a> : <span>{d.label}</span>}
            <span style={{ color: "var(--muted)" }}>
              {d.count} ({Math.round((d.count / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function slicePaths(
  data: (CountSlice & { color: string })[],
  total: number,
  r: number,
  hover: number | null,
  setHover: (i: number | null) => void,
) {
  let angle = -Math.PI / 2; // start at 12 o'clock
  return data.map((d, i) => {
    const start = angle;
    const end = angle + (d.count / total) * 2 * Math.PI;
    angle = end;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = r + r * Math.cos(start);
    const y1 = r + r * Math.sin(start);
    const x2 = r + r * Math.cos(end);
    const y2 = r + r * Math.sin(end);
    const path = `M ${r} ${r} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    return (
      <SliceLink key={d.label} href={d.href}>
        <path
          d={path}
          fill={d.color}
          opacity={hover === null || hover === i ? 1 : 0.5}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          style={{ cursor: d.href ? "pointer" : "default" }}
        />
      </SliceLink>
    );
  });
}

/** Wraps a slice in an SVG link when the slice has somewhere to go. */
function SliceLink({ href, children }: { href?: string; children: ReactNode }) {
  return href ? <a href={href}>{children}</a> : <>{children}</>;
}

const HMARGIN = { top: 10, right: 10, bottom: 42, left: 26 };
// At most this many PR titles in the hover popover; the rest are summarised.
const POPOVER_LIMIT = 6;

/**
 * A vertical-bar histogram of PRs per day. Hovering a day with PRs shows the
 * list of PRs opened that day; clicking the bar filters the table to that day
 * (via a `?day=<dateMs>` link the All-PRs page reads).
 */
export function Histogram({
  data,
  width = 360,
  height = FIGURE_HEIGHT,
}: {
  data: DayCount[];
  /** Fallback width; the chart grows to fill its container when it can. */
  width?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Fill the card on wide screens; shrink to fit on a phone.
  const { ref, width: w } = useElementWidth(width);

  if (data.length === 0) return <p style={{ color: "var(--muted)" }}>No data yet.</p>;

  const plotW = w - HMARGIN.left - HMARGIN.right;
  const plotH = height - HMARGIN.top - HMARGIN.bottom;
  const baseY = HMARGIN.top + plotH;
  const max = Math.max(...data.map((d) => d.count), 1);
  const bandW = plotW / data.length;
  const axis = "var(--border)";
  const tickText = { fontSize: 10, fill: "var(--muted)" } as const;

  // Thin labels in busy stretches: within a run of consecutive active days,
  // label every other day, anchored so the most recent day is always labelled
  // (so a 5-day run shows the last, third-from-last, and so on). Isolated days
  // are always labelled.
  const DAY = 24 * 60 * 60 * 1000;
  const labelDays = new Set<number>();
  const active = data.filter((d) => d.count > 0);
  const runs: DayCount[][] = [];
  for (const d of active) {
    const run = runs[runs.length - 1];
    if (run && d.dateMs - run[run.length - 1].dateMs <= DAY * 1.5) run.push(d);
    else runs.push([d]);
  }
  for (const run of runs) {
    run.forEach((d, k) => {
      const fromEnd = run.length - 1 - k;
      if (fromEnd % 2 === 0) labelDays.add(d.dateMs);
    });
  }

  const hovered = hover != null ? data[hover] : null;
  const hoverX = hover != null ? HMARGIN.left + hover * bandW + bandW / 2 : 0;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height }}>
      {/* Absolute so the SVG's own width never widens the card: the wrapper
          width is driven by its container, and `w` is measured from it. */}
      <svg
        width={w}
        height={height}
        role="img"
        aria-label="PRs per day"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* y axis: 0 and max */}
        <line x1={HMARGIN.left} y1={HMARGIN.top} x2={HMARGIN.left} y2={baseY} stroke={axis} />
        <text x={HMARGIN.left - 4} y={HMARGIN.top + 4} textAnchor="end" {...tickText}>
          {max}
        </text>
        <text x={HMARGIN.left - 4} y={baseY} textAnchor="end" {...tickText}>
          0
        </text>

        {/* x axis baseline */}
        <line x1={HMARGIN.left} y1={baseY} x2={HMARGIN.left + plotW} y2={baseY} stroke={axis} />

        {data.map((d, i) => {
          const h = (d.count / max) * plotH;
          const cx = HMARGIN.left + i * bandW + bandW / 2;
          const barW = Math.max(bandW * 0.7, 1);
          const interactive = d.count > 0;
          const active = hover === i;
          const bar = (
            <g
              onMouseEnter={interactive ? () => setHover(i) : undefined}
              onMouseLeave={interactive ? () => setHover(null) : undefined}
              style={{ cursor: interactive ? "pointer" : "default" }}
            >
              {/* Full-height invisible hit target so hovering/clicking a short
                  bar (or its day) is easy. */}
              <rect
                x={HMARGIN.left + i * bandW}
                y={HMARGIN.top}
                width={bandW}
                height={plotH}
                fill="transparent"
              />
              <rect
                x={cx - barW / 2}
                y={baseY - h}
                width={barW}
                height={h}
                fill="var(--accent)"
                opacity={hover === null || active ? 1 : 0.55}
                rx={1}
              >
                {/* Single string child: adjacent text nodes in an SVG <title> get
                    coalesced by the browser and break hydration. */}
                <title>{`${d.label}: ${d.count}`}</title>
              </rect>
            </g>
          );
          return (
            <g key={d.dateMs}>
              {/* Clicking a day with PRs filters the table to that day. */}
              {interactive ? (
                <a href={`/dashboard/prs?day=${d.dateMs}`}>{bar}</a>
              ) : (
                bar
              )}
              {/* Label active days, thinned within consecutive runs (see above),
                  rotated so they don't overlap. */}
              {labelDays.has(d.dateMs) && (
                <text
                  x={cx}
                  y={baseY + 6}
                  textAnchor="end"
                  transform={`rotate(-55 ${cx} ${baseY + 6})`}
                  {...tickText}
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && hovered.prs.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(hoverX, 90), w - 90),
            top: Math.max(baseY - (hovered.count / max) * plotH - 8, HMARGIN.top),
            transform: "translate(-50%, -100%)",
            background: "var(--panel-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 12,
            width: 180,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {hovered.label} · {hovered.count} PR{hovered.count === 1 ? "" : "s"}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {hovered.prs.slice(0, POPOVER_LIMIT).map((pr) => (
              <li
                key={pr.href}
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {pr.text}
              </li>
            ))}
          </ul>
          {hovered.prs.length > POPOVER_LIMIT && (
            <div style={{ color: "var(--muted)", marginTop: 2 }}>
              +{hovered.prs.length - POPOVER_LIMIT} more — click to see all
            </div>
          )}
        </div>
      )}
    </div>
  );
}
