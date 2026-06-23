import {
  SEVERITY_WEIGHT,
  type Category,
  type ReviewComment,
} from "@/server/review/types";

/**
 * Grading — Layer 3 of DESIGN.md component 4. Pure functions that turn a set of
 * review comments into the per-PR metric snapshot. The snapshot is frozen once
 * written, so these must be deterministic.
 */

/** A comment as it matters for grading: severity + whether it repeats a past mistake. */
export interface GradableComment {
  severity: ReviewComment["severity"];
  category: Category;
  isRepeat: boolean;
}

export interface PRMetricsValues {
  issueDensity: number;
  repeatRate: number;
  categoryMix: Record<string, number>;
  commentCount: number;
}

/** Weighted severity per 100 lines changed. Higher = more/worse issues. */
export function issueDensity(
  comments: GradableComment[],
  linesChanged: number,
): number {
  const weighted = comments.reduce(
    (sum, c) => sum + SEVERITY_WEIGHT[c.severity],
    0,
  );
  // Guard against divide-by-zero on empty diffs.
  const lines = Math.max(linesChanged, 1);
  return round((weighted / lines) * 100);
}

/** Share (0..1) of comments that repeat a past mistake. */
export function repeatRate(comments: GradableComment[]): number {
  if (comments.length === 0) return 0;
  const repeats = comments.filter((c) => c.isRepeat).length;
  return round(repeats / comments.length);
}

/** Count of comments per category. */
export function categoryMix(
  comments: GradableComment[],
): Record<string, number> {
  const mix: Record<string, number> = {};
  for (const c of comments) {
    mix[c.category] = (mix[c.category] ?? 0) + 1;
  }
  return mix;
}

/** The full per-PR snapshot. */
export function computeMetrics(
  comments: GradableComment[],
  linesChanged: number,
): PRMetricsValues {
  return {
    issueDensity: issueDensity(comments, linesChanged),
    repeatRate: repeatRate(comments),
    categoryMix: categoryMix(comments),
    commentCount: comments.length,
  };
}

/** Round to 2 decimals so stored metrics are stable and readable. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
