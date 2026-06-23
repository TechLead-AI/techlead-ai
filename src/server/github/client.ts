import { App } from "octokit";
import type { ReviewComment } from "@/server/review/types";

/**
 * GitHub App client (DESIGN.md component 1 & 5). Used only on the live path
 * (Step 6); the demo runs without credentials. The pure payload builders are
 * unit-tested; the network calls are thin wrappers over Octokit.
 */

const SEVERITY_LABEL: Record<ReviewComment["severity"], string> = {
  blocker: "🛑 Blocker",
  major: "⚠️ Major",
  minor: "🔸 Minor",
  nit: "💡 Nit",
};

/** Format one review comment as GitHub-flavoured markdown. */
export function formatCommentBody(c: ReviewComment): string {
  const lines = [`**${SEVERITY_LABEL[c.severity]} · ${c.category}** — ${c.message}`, "", c.why];
  if (c.suggestion) lines.push("", `**Suggestion:** ${c.suggestion}`);
  if (c.conventionRef) lines.push("", `_Convention: ${c.conventionRef}_`);
  return lines.join("\n");
}

export interface ReviewPayload {
  commit_id: string;
  body: string;
  event: "COMMENT";
  comments: { path: string; line: number; side: "RIGHT"; body: string }[];
}

/** Build a single batched GitHub review from the comments that passed the gates. */
export function buildReviewPayload(
  headSha: string,
  summary: string,
  postedComments: ReviewComment[],
): ReviewPayload {
  return {
    commit_id: headSha,
    body: `## Tech Lead AI review\n\n${summary}`,
    event: "COMMENT",
    comments: postedComments.map((c) => ({
      path: c.filePath,
      line: c.lineEnd,
      side: "RIGHT",
      body: formatCommentBody(c),
    })),
  };
}

function getApp(): App {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials are not configured");
  }
  return new App({ appId, privateKey: privateKey.replace(/\\n/g, "\n") });
}

async function octokitForRepo(repoFullName: string) {
  const [owner, repo] = repoFullName.split("/");
  const app = getApp();
  const { data: installation } = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    { owner, repo },
  );
  return { octokit: await app.getInstallationOctokit(installation.id), owner, repo };
}

/** Fetch the unified diff of a PR. */
export async function fetchPrDiff(
  repoFullName: string,
  prNumber: number,
): Promise<string> {
  const { octokit, owner, repo } = await octokitForRepo(repoFullName);
  const res = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: "diff" },
  });
  // With the diff media type the body is the raw diff string.
  return res.data as unknown as string;
}

/** Post all comments + the summary as one batched review. */
export async function postReview(
  repoFullName: string,
  prNumber: number,
  payload: ReviewPayload,
): Promise<void> {
  const { octokit, owner, repo } = await octokitForRepo(repoFullName);
  await octokit.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", {
    owner,
    repo,
    pull_number: prNumber,
    ...payload,
  });
}
