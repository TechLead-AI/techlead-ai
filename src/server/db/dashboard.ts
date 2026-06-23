import { prisma } from "./client";
import type { Category } from "@/server/review/types";

/**
 * Read queries that power the dashboards (DESIGN.md component 7). Every query is
 * scoped by orgId so one org can never read another's data (multi-tenant rule).
 */

export interface TrendPoint {
  reviewId: string;
  pullRequestId: string;
  prNumber: number;
  prTitle: string;
  issueDensity: number;
  repeatRate: number;
  createdAt: Date;
}

export interface JuniorSummary {
  id: string;
  name: string;
  githubLogin: string;
  reviewCount: number;
  latestDensity: number | null;
  latestRepeatRate: number | null;
  /** "improving" | "flat" | "worsening" | "new" based on density trend. */
  trend: TrendDirection;
}

export type TrendDirection = "improving" | "flat" | "worsening" | "new";

/** A pointer from a chart back to the comment (and its PR) that produced it. */
export interface CommentRef {
  pullRequestId: string;
  prNumber: number;
  message: string;
  /** Set on team-wide breakdowns so the UI can name who it belongs to. */
  authorName?: string;
}

/** One category bar plus the comments that make it up (for drill-down). */
export interface CategoryBreakdown {
  category: string;
  count: number;
  items: CommentRef[];
}

export interface JuniorProfile {
  id: string;
  name: string;
  githubLogin: string;
  trend: TrendPoint[];
  categoryMix: CategoryBreakdown[];
  topRecurringMistakes: CategoryBreakdown[];
  trendDirection: TrendDirection;
}

/** List mentored juniors in an org with a one-glance summary. */
export async function listJuniors(orgId: string): Promise<JuniorSummary[]> {
  const juniors = await prisma.user.findMany({
    where: { orgId, isMentoredJunior: true },
    orderBy: { name: "asc" },
  });

  const summaries: JuniorSummary[] = [];
  for (const j of juniors) {
    const metrics = await prisma.pRMetrics.findMany({
      where: { orgId, pullRequest: { authorId: j.id } },
      orderBy: { createdAt: "asc" },
      select: { issueDensity: true, repeatRate: true },
    });
    const densities = metrics.map((m) => m.issueDensity);
    const last = metrics[metrics.length - 1];
    summaries.push({
      id: j.id,
      name: j.name,
      githubLogin: j.githubLogin,
      reviewCount: densities.length,
      latestDensity: last ? last.issueDensity : null,
      latestRepeatRate: last ? last.repeatRate : null,
      trend: trendDirection(densities),
    });
  }
  return summaries;
}

/** Full per-junior profile: trends, category mix, recurring mistakes. */
export async function getJuniorProfile(
  orgId: string,
  juniorId: string,
): Promise<JuniorProfile | null> {
  const junior = await prisma.user.findFirst({
    where: { id: juniorId, orgId },
  });
  if (!junior) return null; // wrong org or unknown — isolation enforced here.

  const metrics = await prisma.pRMetrics.findMany({
    where: { orgId, pullRequest: { authorId: juniorId } },
    orderBy: { createdAt: "asc" },
    include: { pullRequest: { select: { id: true, number: true, title: true } } },
  });

  const trend: TrendPoint[] = metrics.map((m) => ({
    reviewId: m.reviewId,
    pullRequestId: m.pullRequest.id,
    prNumber: m.pullRequest.number,
    prTitle: m.pullRequest.title,
    issueDensity: m.issueDensity,
    repeatRate: m.repeatRate,
    createdAt: m.createdAt,
  }));

  // Category mix across all their comments, each carrying a pointer back to its
  // PR so the dashboard can drill down from a bar to the actual comments.
  const comments = await prisma.comment.findMany({
    where: { orgId, review: { pullRequest: { authorId: juniorId } } },
    select: {
      category: true,
      repeatOfId: true,
      message: true,
      review: { select: { pullRequest: { select: { id: true, number: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const toRef = (c: (typeof comments)[number]): CommentRef => ({
    pullRequestId: c.review.pullRequest.id,
    prNumber: c.review.pullRequest.number,
    message: c.message,
  });

  const categoryMix = groupByCategory(comments.map((c) => ({ category: c.category, ref: toRef(c) })));
  const topRecurringMistakes = groupByCategory(
    comments.filter((c) => c.repeatOfId).map((c) => ({ category: c.category, ref: toRef(c) })),
  );

  return {
    id: junior.id,
    name: junior.name,
    githubLogin: junior.githubLogin,
    trend,
    categoryMix,
    topRecurringMistakes,
    trendDirection: trendDirection(trend.map((t) => t.issueDensity)),
  };
}

/** Group comment refs by category into count-sorted breakdowns for the charts. */
function groupByCategory(
  rows: { category: string; ref: CommentRef }[],
): CategoryBreakdown[] {
  const byCategory = new Map<string, CommentRef[]>();
  for (const r of rows) {
    const list = byCategory.get(r.category) ?? [];
    list.push(r.ref);
    byCategory.set(r.category, list);
  }
  return [...byCategory.entries()]
    .map(([category, items]) => ({ category, count: items.length, items }))
    .sort((a, b) => b.count - a.count);
}

export interface TeamOverview {
  juniors: JuniorSummary[];
  commonMistakes: CategoryBreakdown[];
}

/** Team-wide view: roster + most common mistake categories across all juniors. */
export async function getTeamOverview(orgId: string): Promise<TeamOverview> {
  const juniors = await listJuniors(orgId);

  const comments = await prisma.comment.findMany({
    where: { orgId, review: { pullRequest: { author: { isMentoredJunior: true } } } },
    select: {
      category: true,
      message: true,
      review: {
        select: {
          pullRequest: {
            select: { id: true, number: true, author: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const commonMistakes = groupByCategory(
    comments.map((c) => ({
      category: c.category,
      ref: {
        pullRequestId: c.review.pullRequest.id,
        prNumber: c.review.pullRequest.number,
        message: c.message,
        authorName: c.review.pullRequest.author.name,
      },
    })),
  );

  return { juniors, commonMistakes };
}

/** One severity bar plus the comments behind it (for drill-down). */
export interface SeverityBreakdown {
  severity: string;
  count: number;
  items: CommentRef[];
}

export interface TeamStats {
  juniorCount: number;
  reviewCount: number;
  /** Average issue density across all reviewed PRs, or null if none yet. */
  avgDensity: number | null;
  /** Per-severity comment counts (with drill-down), highest severity first. */
  severityBreakdown: SeverityBreakdown[];
  /** Open PRs carrying a blocker or major — what needs a manager's eyes now. */
  openHighSeverityPrCount: number;
}

const SEVERITY_ORDER = ["blocker", "major", "minor", "nit"] as const;

/** Headline numbers for the team page (DESIGN.md component 7, team view). */
export async function getTeamStats(orgId: string): Promise<TeamStats> {
  const juniorWork = { author: { isMentoredJunior: true } };

  const [juniorCount, reviewCount, metrics, comments, openHighSeverityPrCount] =
    await Promise.all([
      prisma.user.count({ where: { orgId, isMentoredJunior: true } }),
      prisma.review.count({ where: { orgId, pullRequest: juniorWork } }),
      prisma.pRMetrics.findMany({
        where: { orgId, pullRequest: juniorWork },
        select: { issueDensity: true },
      }),
      prisma.comment.findMany({
        where: { orgId, review: { pullRequest: juniorWork } },
        select: {
          severity: true,
          message: true,
          review: {
            select: {
              pullRequest: {
                select: { id: true, number: true, author: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Open PRs with at least one blocker/major — the actionable backlog.
      prisma.pullRequest.count({
        where: {
          orgId,
          status: "open",
          author: { isMentoredJunior: true },
          reviews: { some: { comments: { some: { severity: { in: ["blocker", "major"] } } } } },
        },
      }),
    ]);

  const avgDensity = metrics.length
    ? Math.round(
        (metrics.reduce((sum, m) => sum + m.issueDensity, 0) / metrics.length) * 10,
      ) / 10
    : null;

  const bySeverity = new Map<string, CommentRef[]>();
  for (const c of comments) {
    const list = bySeverity.get(c.severity) ?? [];
    list.push({
      pullRequestId: c.review.pullRequest.id,
      prNumber: c.review.pullRequest.number,
      message: c.message,
      authorName: c.review.pullRequest.author.name,
    });
    bySeverity.set(c.severity, list);
  }
  const severityBreakdown: SeverityBreakdown[] = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: bySeverity.get(severity)?.length ?? 0,
    items: bySeverity.get(severity) ?? [],
  }));

  return { juniorCount, reviewCount, avgDensity, severityBreakdown, openHighSeverityPrCount };
}

/**
 * Juniors a manager should look at: trending worse, or stuck repeating mistakes
 * (at least half their latest comments repeat a past one). Pure so it is easy to
 * test. Brand-new juniors are never flagged — too little signal.
 */
export function needsAttention(juniors: JuniorSummary[]): JuniorSummary[] {
  return juniors.filter(
    (j) =>
      j.trend === "worsening" ||
      (j.trend !== "new" && (j.latestRepeatRate ?? 0) >= 0.5),
  );
}

/**
 * Decide a trend from a time-ordered density series. Lower density is better,
 * so a falling series means the junior is improving. Uses the average of the
 * first half vs the second half to avoid noise from a single PR.
 */
export function trendDirection(densities: number[]): TrendDirection {
  // Fewer than two reviews is not a trend yet — treat as brand new.
  if (densities.length < 2) return "new";
  const mid = Math.floor(densities.length / 2);
  const firstHalf = densities.slice(0, mid);
  const secondHalf = densities.slice(mid);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const before = avg(firstHalf);
  const after = avg(secondHalf);
  const delta = after - before;
  // 10% of the earlier average is the "meaningful change" threshold.
  const threshold = Math.max(before * 0.1, 0.5);
  if (delta < -threshold) return "improving";
  if (delta > threshold) return "worsening";
  return "flat";
}
