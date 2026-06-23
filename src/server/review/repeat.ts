import type { ReviewComment, Category } from "./types";

/**
 * Repeat detection — what turns a reviewer into a mentor (DESIGN.md component 3).
 * v1 is deliberately simple: a new comment is a "repeat" if the junior has
 * already been given feedback in the same category on an earlier review.
 * Smarter cross-file semantic matching is a later improvement.
 */

export interface PriorComment {
  id: string;
  category: Category;
  createdAt: Date;
}

export interface RepeatResult {
  comment: ReviewComment;
  /** Id of the earlier comment this repeats, or null if it's new. */
  repeatOfId: string | null;
}

export function detectRepeats(
  comments: ReviewComment[],
  history: PriorComment[],
): RepeatResult[] {
  // Most recent prior comment per category.
  const latestByCategory = new Map<Category, PriorComment>();
  for (const prior of history) {
    const existing = latestByCategory.get(prior.category);
    if (!existing || prior.createdAt > existing.createdAt) {
      latestByCategory.set(prior.category, prior);
    }
  }

  return comments.map((comment) => {
    const prior = latestByCategory.get(comment.category);
    return { comment, repeatOfId: prior ? prior.id : null };
  });
}
