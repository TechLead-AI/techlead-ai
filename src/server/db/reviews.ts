import { prisma } from "./client";
import { mergeConventions, type ConventionLayer } from "@/server/conventions/merge";
import type { PriorComment } from "@/server/review/repeat";
import type { PipelineResult } from "@/server/review/pipeline";
import type { Category } from "@/server/review/types";

/**
 * Database access for reviews: gathering the context a review needs, and storing
 * the result. Kept separate from the pipeline so the pipeline stays pure.
 */

/** The junior's prior comments across the org, for repeat detection. */
export async function gatherHistory(
  orgId: string,
  authorId: string,
): Promise<PriorComment[]> {
  const comments = await prisma.comment.findMany({
    where: { orgId, review: { pullRequest: { authorId } } },
    select: { id: true, category: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return comments.map((c) => ({
    id: c.id,
    category: c.category as Category,
    createdAt: c.createdAt,
  }));
}

/**
 * Merge the latest org-, team- and repo-level conventions into one markdown
 * block. The author's team layer is included when they belong to one.
 */
export async function gatherConventions(
  orgId: string,
  repoId: string,
  teamId?: string | null,
): Promise<string> {
  const or: Record<string, unknown>[] = [{ scope: "org" }, { scope: "repo", repoId }];
  if (teamId) or.push({ scope: "team", teamId });

  const docs = await prisma.conventionDoc.findMany({
    where: { orgId, OR: or },
    orderBy: { version: "desc" },
  });

  // Keep only the highest version per scope.
  const seen = new Set<string>();
  const layers: ConventionLayer[] = [];
  for (const d of docs) {
    if (seen.has(d.scope)) continue;
    seen.add(d.scope);
    layers.push({ scope: d.scope, version: d.version, markdown: d.markdown });
  }
  return mergeConventions(layers);
}

export interface StoreReviewArgs {
  orgId: string;
  pullRequestId: string;
  headSha: string;
  modelVersion: string;
  tokenCost: number;
  result: PipelineResult;
}

/**
 * Persist a full review run: the Review row, every Comment, and the frozen
 * PRMetrics snapshot — all in one transaction. Returns the new review id.
 */
export async function storeReviewRun(args: StoreReviewArgs): Promise<string> {
  const { orgId, pullRequestId, headSha, modelVersion, tokenCost, result } = args;

  return prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        orgId,
        pullRequestId,
        headSha,
        modelVersion,
        tokenCost,
        summary: result.summary,
      },
    });

    for (const pc of result.comments) {
      await tx.comment.create({
        data: {
          orgId,
          reviewId: review.id,
          filePath: pc.comment.filePath,
          lineStart: pc.comment.lineStart,
          lineEnd: pc.comment.lineEnd,
          category: pc.comment.category,
          severity: pc.comment.severity,
          confidence: pc.comment.confidence,
          message: pc.comment.message,
          why: pc.comment.why,
          suggestion: pc.comment.suggestion,
          conventionRef: pc.comment.conventionRef,
          posted: pc.posted,
          repeatOfId: pc.repeatOfId,
        },
      });
    }

    await tx.pRMetrics.create({
      data: {
        orgId,
        pullRequestId,
        reviewId: review.id,
        issueDensity: result.metrics.issueDensity,
        repeatRate: result.metrics.repeatRate,
        categoryMix: result.metrics.categoryMix,
        commentCount: result.metrics.commentCount,
      },
    });

    return review.id;
  });
}
