import { prisma } from "@/server/db/client";

/**
 * GitHub pull_request webhook handling (DESIGN.md components 1 & 5). The pure
 * parsing/decision helpers are unit-tested; processPullRequestEvent takes its
 * side-effecting dependencies (fetch diff, enqueue) by injection so it is
 * testable without real GitHub or a running queue.
 */

export interface PullRequestEvent {
  action: string;
  draft: boolean;
  repoFullName: string;
  number: number;
  title: string;
  headSha: string;
  authorLogin: string;
  linesChanged: number;
}

/** Actions worth reviewing: a new PR, new commits, or a draft going ready. */
const REVIEWABLE_ACTIONS = new Set([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
]);

export function shouldReviewAction(action: string, draft: boolean): boolean {
  if (draft) return false; // skip drafts (DESIGN.md component 1)
  return REVIEWABLE_ACTIONS.has(action);
}

/** Pull the fields we need out of a raw pull_request webhook payload. */
export function parsePullRequestEvent(payload: any): PullRequestEvent | null {
  const pr = payload?.pull_request;
  if (!pr || !payload?.repository) return null;
  return {
    action: String(payload.action ?? ""),
    draft: Boolean(pr.draft),
    repoFullName: String(payload.repository.full_name ?? ""),
    number: Number(pr.number ?? 0),
    title: String(pr.title ?? "Untitled"),
    headSha: String(pr.head?.sha ?? ""),
    authorLogin: String(pr.user?.login ?? ""),
    linesChanged: Number(pr.additions ?? 0) + Number(pr.deletions ?? 0),
  };
}

export type WebhookOutcome =
  | "ignored_action"
  | "unknown_repo"
  | "not_mentored_junior"
  | "queued";

export interface ProcessDeps {
  fetchDiff: (repoFullName: string, prNumber: number) => Promise<string>;
  enqueue: (data: {
    orgId: string;
    pullRequestId: string;
    headSha: string;
    diff: string;
    github?: { repoFullName: string; prNumber: number };
  }) => Promise<void>;
}

/**
 * Resolve the org + author, ensure the PR row exists, fetch the diff and
 * enqueue a review — but only for mentored juniors on reviewable actions.
 */
export async function processPullRequestEvent(
  event: PullRequestEvent,
  deps: ProcessDeps,
): Promise<WebhookOutcome> {
  if (!shouldReviewAction(event.action, event.draft)) return "ignored_action";

  const repo = await prisma.repo.findFirst({
    where: { fullName: event.repoFullName },
  });
  if (!repo) return "unknown_repo";

  const author = await prisma.user.findFirst({
    where: { orgId: repo.orgId, githubLogin: event.authorLogin },
  });
  // Only mentored juniors are reviewed (DESIGN.md component 1).
  if (!author || !author.isMentoredJunior) return "not_mentored_junior";

  // Upsert the PR row (it may already exist from an earlier push).
  const pr = await prisma.pullRequest.upsert({
    where: { repoId_number: { repoId: repo.id, number: event.number } },
    create: {
      orgId: repo.orgId,
      repoId: repo.id,
      authorId: author.id,
      number: event.number,
      title: event.title,
      linesChanged: Math.max(event.linesChanged, 1),
    },
    update: { title: event.title, linesChanged: Math.max(event.linesChanged, 1) },
  });

  const diff = await deps.fetchDiff(event.repoFullName, event.number);
  await deps.enqueue({
    orgId: repo.orgId,
    pullRequestId: pr.id,
    headSha: event.headSha,
    diff,
    github: { repoFullName: event.repoFullName, prNumber: event.number },
  });
  return "queued";
}
