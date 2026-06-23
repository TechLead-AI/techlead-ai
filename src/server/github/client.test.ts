import { describe, it, expect } from "vitest";
import { formatCommentBody, buildReviewPayload } from "./client";
import type { ReviewComment } from "@/server/review/types";

const comment: ReviewComment = {
  filePath: "src/a.ts",
  lineStart: 10,
  lineEnd: 12,
  category: "security",
  severity: "blocker",
  confidence: 0.95,
  message: "Hard-coded secret.",
  why: "Secrets in source get leaked.",
  suggestion: "Use an env var.",
  conventionRef: "Security",
};

describe("formatCommentBody", () => {
  it("includes severity, message, why, suggestion and convention", () => {
    const body = formatCommentBody(comment);
    expect(body).toContain("Blocker");
    expect(body).toContain("Hard-coded secret.");
    expect(body).toContain("Secrets in source get leaked.");
    expect(body).toContain("Use an env var.");
    expect(body).toContain("Security");
  });
});

describe("buildReviewPayload", () => {
  it("maps comments into one batched COMMENT review", () => {
    const payload = buildReviewPayload("abc123", "Overall: tighten security.", [comment]);
    expect(payload.event).toBe("COMMENT");
    expect(payload.commit_id).toBe("abc123");
    expect(payload.body).toContain("Overall: tighten security.");
    expect(payload.comments).toHaveLength(1);
    expect(payload.comments[0]).toMatchObject({
      path: "src/a.ts",
      line: 12,
      side: "RIGHT",
    });
  });

  it("produces an empty comment list when nothing passed the gates", () => {
    const payload = buildReviewPayload("sha", "Looks clean.", []);
    expect(payload.comments).toEqual([]);
  });
});
