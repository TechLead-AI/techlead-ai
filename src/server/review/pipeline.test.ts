import { describe, it, expect } from "vitest";
import { runReviewPipeline, type PipelineContext } from "./pipeline";
import { FakeReviewer, parseAddedLines } from "./reviewer";
import type { Reviewer } from "./reviewer";
import type { ReviewResult } from "./types";

const baseContext: PipelineContext = {
  prTitle: "Add feature",
  conventions: "Be tidy.",
  diff: "",
  recentMistakeCategories: [],
  history: [],
  linesChanged: 100,
};

/** A reviewer that returns a fixed, controlled result. */
function fixedReviewer(result: ReviewResult): Reviewer {
  return { review: async () => result };
}

describe("runReviewPipeline", () => {
  it("runs the fake reviewer end to end on a diff with smells", async () => {
    const diff = [
      "+++ b/src/app.ts",
      "@@ -0,0 +1,2 @@",
      '+const apiKey = "sk-live-12345";',
      "+console.log(apiKey);",
    ].join("\n");

    const result = await runReviewPipeline(new FakeReviewer(), {
      ...baseContext,
      diff,
    });

    // Hard-coded secret (blocker) + console.log (nit).
    const severities = result.comments.map((c) => c.comment.severity);
    expect(severities).toContain("blocker");
    expect(severities).toContain("nit");
    expect(result.metrics.commentCount).toBe(result.comments.length);
  });

  it("applies gates: low-confidence comments are not posted", async () => {
    const result: ReviewResult = {
      summary: "s",
      comments: [
        {
          filePath: "a.ts",
          lineStart: 1,
          lineEnd: 1,
          category: "bug",
          severity: "major",
          confidence: 0.4,
          message: "m",
          why: "w",
        },
      ],
    };
    const out = await runReviewPipeline(fixedReviewer(result), baseContext);
    expect(out.comments[0].posted).toBe(false);
    expect(out.comments[0].dropReason).toBe("low_confidence");
  });

  it("flags a repeat when the category was seen before", async () => {
    const result: ReviewResult = {
      summary: "s",
      comments: [
        {
          filePath: "a.ts",
          lineStart: 1,
          lineEnd: 1,
          category: "naming",
          severity: "minor",
          confidence: 0.9,
          message: "m",
          why: "w",
        },
      ],
    };
    const out = await runReviewPipeline(fixedReviewer(result), {
      ...baseContext,
      history: [
        { id: "old-1", category: "naming", createdAt: new Date("2026-01-01") },
      ],
    });
    expect(out.comments[0].repeatOfId).toBe("old-1");
    expect(out.metrics.repeatRate).toBe(1);
  });

  it("computes metrics over all comments, not just posted ones", async () => {
    const result: ReviewResult = {
      summary: "s",
      comments: [
        // dropped for low confidence, but still counts toward the grade
        {
          filePath: "a.ts",
          lineStart: 1,
          lineEnd: 1,
          category: "bug",
          severity: "blocker",
          confidence: 0.3,
          message: "m",
          why: "w",
        },
      ],
    };
    const out = await runReviewPipeline(fixedReviewer(result), baseContext);
    expect(out.comments[0].posted).toBe(false);
    expect(out.metrics.commentCount).toBe(1);
    expect(out.metrics.issueDensity).toBeGreaterThan(0);
  });
});

describe("parseAddedLines", () => {
  it("tracks file and line numbers of added lines", () => {
    const diff = [
      "+++ b/src/x.ts",
      "@@ -0,0 +5,2 @@",
      "+first",
      "+second",
    ].join("\n");
    const lines = parseAddedLines(diff);
    expect(lines).toEqual([
      { file: "src/x.ts", line: 5, text: "first" },
      { file: "src/x.ts", line: 6, text: "second" },
    ]);
  });
});
