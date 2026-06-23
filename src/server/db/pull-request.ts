import { prisma } from "./client";
import type { Category, Severity } from "@/server/review/types";

/**
 * Read query for the PR detail page (the page every chart and list links to).
 * Org-scoped like every dashboard query, so one org can never read another's PR.
 *
 * A PR can be reviewed more than once (re-review on a new push), so we return
 * every review run, newest first, each with its summary, frozen metrics, and the
 * full set of comments (all Layer 1 fields — DESIGN.md component 4).
 */

export interface PRCommentDetail {
  id: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  category: Category;
  severity: Severity;
  confidence: number;
  message: string;
  why: string;
  suggestion: string | null;
  conventionRef: string | null;
  /** False when a gate suppressed the comment (kept for the record). */
  posted: boolean;
  /** Set when this comment repeats an earlier mistake (mentoring memory). */
  repeatOfId: string | null;
}

export interface PRReviewDetail {
  id: string;
  headSha: string;
  modelVersion: string;
  summary: string;
  createdAt: Date;
  issueDensity: number | null;
  repeatRate: number | null;
  commentCount: number;
  comments: PRCommentDetail[];
}

export interface PRDetail {
  id: string;
  number: number;
  title: string;
  status: string;
  linesChanged: number;
  createdAt: Date;
  repoFullName: string;
  authorId: string;
  authorName: string;
  authorLogin: string;
  reviews: PRReviewDetail[];
}

/** One row in the all-PRs list (the smart table + the summary charts). */
export interface PRListItem {
  id: string;
  number: number;
  title: string;
  status: string;
  authorId: string;
  authorName: string;
  repoFullName: string;
  createdAt: Date;
  /** Latest review's density, or null if not reviewed. */
  latestDensity: number | null;
  /** Comments on the latest review. */
  commentCount: number;
  /** Blocker + major comments on the latest review. */
  highSeverityCount: number;
}

/**
 * Every junior PR in the org, newest first, with each one's latest-review
 * density and comment count. Powers the all-PRs page (table + charts).
 */
export async function getAllPullRequests(orgId: string): Promise<PRListItem[]> {
  const prs = await prisma.pullRequest.findMany({
    where: { orgId, author: { isMentoredJunior: true } },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true } },
      repo: { select: { fullName: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { metrics: true, comments: { select: { severity: true } } },
      },
    },
  });

  return prs.map((pr) => {
    const latest = pr.reviews[0];
    const comments = latest?.comments ?? [];
    const highSeverityCount = comments.filter(
      (c) => c.severity === "blocker" || c.severity === "major",
    ).length;
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      status: pr.status,
      authorId: pr.author.id,
      authorName: pr.author.name,
      repoFullName: pr.repo.fullName,
      createdAt: pr.createdAt,
      latestDensity: latest?.metrics?.issueDensity ?? null,
      commentCount: comments.length,
      highSeverityCount,
    };
  });
}

export async function getPullRequestDetail(
  orgId: string,
  pullRequestId: string,
): Promise<PRDetail | null> {
  const pr = await prisma.pullRequest.findFirst({
    where: { id: pullRequestId, orgId },
    include: {
      repo: { select: { fullName: true } },
      author: { select: { id: true, name: true, githubLogin: true } },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          metrics: true,
          comments: { orderBy: [{ posted: "desc" }, { severity: "asc" }] },
        },
      },
    },
  });
  if (!pr) return null; // wrong org or unknown — isolation enforced here.

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    status: pr.status,
    linesChanged: pr.linesChanged,
    createdAt: pr.createdAt,
    repoFullName: pr.repo.fullName,
    authorId: pr.author.id,
    authorName: pr.author.name,
    authorLogin: pr.author.githubLogin,
    reviews: pr.reviews.map((r) => ({
      id: r.id,
      headSha: r.headSha,
      modelVersion: r.modelVersion,
      summary: r.summary,
      createdAt: r.createdAt,
      issueDensity: r.metrics?.issueDensity ?? null,
      repeatRate: r.metrics?.repeatRate ?? null,
      commentCount: r.comments.length,
      comments: r.comments.map((c) => ({
        id: c.id,
        filePath: c.filePath,
        lineStart: c.lineStart,
        lineEnd: c.lineEnd,
        category: c.category as Category,
        severity: c.severity as Severity,
        confidence: c.confidence,
        message: c.message,
        why: c.why,
        suggestion: c.suggestion,
        conventionRef: c.conventionRef,
        posted: c.posted,
        repeatOfId: c.repeatOfId,
      })),
    })),
  };
}
