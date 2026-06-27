import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the side-effecting dependencies so we test the handler's branching
// (review -> maybe post back) and its progress logging in isolation.
const reviewPullRequest = vi.fn();
const postStoredReview = vi.fn();
const isGithubConfigured = vi.fn();

vi.mock("@/server/review/service", () => ({
  reviewPullRequest: (...args: unknown[]) => reviewPullRequest(...args),
}));
vi.mock("@/server/github/post", () => ({
  postStoredReview: (...args: unknown[]) => postStoredReview(...args),
  isGithubConfigured: () => isGithubConfigured(),
}));

import { handleReviewJob, type ReviewJobData } from "./jobs";

const webhookJob: ReviewJobData = {
  orgId: "org1",
  pullRequestId: "pr1",
  headSha: "sha1",
  diff: "+ hello",
  github: { repoFullName: "TechLead-AI/pr-review-tests", prNumber: 6 },
};

describe("handleReviewJob", () => {
  let logs: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    logs = [];
    vi.spyOn(console, "log").mockImplementation((msg: string) => {
      logs.push(msg);
    });
    reviewPullRequest.mockResolvedValue({ reviewId: "rev1", skipped: false });
    isGithubConfigured.mockReturnValue(true);
  });

  it("reviews and posts back a fresh webhook job, logging each step", async () => {
    await handleReviewJob(webhookJob);

    expect(reviewPullRequest).toHaveBeenCalledOnce();
    expect(postStoredReview).toHaveBeenCalledWith(
      "TechLead-AI/pr-review-tests",
      6,
      "rev1",
    );
    expect(logs).toContain("Reviewing PR #6 (TechLead-AI/pr-review-tests)...");
    expect(logs).toContain("Posted review for PR #6 (TechLead-AI/pr-review-tests).");
  });

  it("does not post back when the commit was already reviewed", async () => {
    reviewPullRequest.mockResolvedValue({ reviewId: "rev1", skipped: true });

    await handleReviewJob(webhookJob);

    expect(postStoredReview).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("Skipped PR #6"))).toBe(true);
  });

  it("does not post back when GitHub is not configured", async () => {
    isGithubConfigured.mockReturnValue(false);

    await handleReviewJob(webhookJob);

    expect(postStoredReview).not.toHaveBeenCalled();
    expect(logs).toContain(
      "Stored review for PR #6 (TechLead-AI/pr-review-tests) (no GitHub post).",
    );
  });

  it("handles a manual job (no github) without posting back", async () => {
    const manualJob: ReviewJobData = {
      orgId: "org1",
      pullRequestId: "pr2",
      headSha: "sha2",
      diff: "+ world",
    };

    await handleReviewJob(manualJob);

    expect(postStoredReview).not.toHaveBeenCalled();
    expect(logs).toContain("Reviewing PR pr2...");
    expect(logs).toContain("Stored review for PR pr2 (no GitHub post).");
  });
});
