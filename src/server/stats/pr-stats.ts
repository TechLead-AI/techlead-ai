import type { PRListItem } from "@/server/db/pull-request";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Pure aggregations over a list of PRs, used by the all-PRs page charts. Kept
 * separate from the DB query so they are trivial to unit-test.
 */

export interface CountSlice {
  label: string;
  count: number;
}

/** A link to one PR, for the histogram's hover drill-down. */
export interface DayPR {
  href: string;
  /** e.g. "#42 Fix login". */
  text: string;
}

export interface DayCount {
  /** Local-midnight timestamp for the day. */
  dateMs: number;
  /** Short "M/D" label for the axis. */
  label: string;
  count: number;
  /** The PRs opened that day, newest first (for hover/click drill-down). */
  prs: DayPR[];
}

/** PRs per author, most prolific first. */
export function countByAuthor(prs: PRListItem[]): CountSlice[] {
  const byAuthor = new Map<string, number>();
  for (const pr of prs) {
    byAuthor.set(pr.authorName, (byAuthor.get(pr.authorName) ?? 0) + 1);
  }
  return [...byAuthor.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Local-midnight timestamp for a date — the key a day-filter matches on. */
export function startOfDayMs(d: Date): number {
  return startOfDay(d).getTime();
}

/**
 * PRs per calendar day across the full span (earliest→latest), filling days
 * with no PRs as zero so it reads as a real time histogram. Each day also
 * carries its PRs so the chart can show them on hover and filter on click.
 */
export function countByDay(prs: PRListItem[]): DayCount[] {
  if (prs.length === 0) return [];

  const byDay = new Map<number, PRListItem[]>();
  for (const pr of prs) {
    const t = startOfDayMs(pr.createdAt);
    const bucket = byDay.get(t) ?? [];
    bucket.push(pr);
    byDay.set(t, bucket);
  }

  const times = [...byDay.keys()];
  const min = Math.min(...times);
  const max = Math.max(...times);

  const out: DayCount[] = [];
  for (const d = new Date(min); d.getTime() <= max; d.setDate(d.getDate() + 1)) {
    const t = startOfDay(d).getTime();
    const dayPrs = byDay.get(t) ?? [];
    out.push({
      dateMs: t,
      // Local DD/MM — this runs only on the server, so no hydration concern.
      label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      count: dayPrs.length,
      prs: dayPrs.map((pr) => ({
        href: `/dashboard/prs/${pr.id}`,
        text: `#${pr.number} ${pr.title}`,
      })),
    });
  }
  return out;
}
