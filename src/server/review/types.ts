import { z } from "zod";

/**
 * The shape of a single review comment produced by the engine, before it is
 * stored. Mirrors the Comment model in prisma/schema.prisma (Layer 1 in
 * DESIGN.md component 4).
 */
export const SEVERITIES = ["blocker", "major", "minor", "nit"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CATEGORIES = [
  "bug",
  "security",
  "design",
  "test",
  "convention",
  "readability",
  "naming",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Severity weights used to compute issue density. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  blocker: 8,
  major: 4,
  minor: 2,
  nit: 0.5,
};

export const ReviewCommentSchema = z.object({
  filePath: z.string().min(1),
  lineStart: z.number().int().nonnegative(),
  lineEnd: z.number().int().nonnegative(),
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES),
  confidence: z.number().min(0).max(1),
  message: z.string().min(1),
  // The mentoring — why this matters. Mandatory by product rule.
  why: z.string().min(1),
  suggestion: z.string().optional(),
  conventionRef: z.string().optional(),
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

/** A full structured review returned by the model. */
export const ReviewResultSchema = z.object({
  summary: z.string().min(1),
  comments: z.array(ReviewCommentSchema),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
