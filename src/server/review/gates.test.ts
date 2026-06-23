import { describe, it, expect } from "vitest";
import { applyGates, postedComments, DEFAULT_GATES } from "./gates";
import type { ReviewComment } from "./types";

function comment(overrides: Partial<ReviewComment>): ReviewComment {
  return {
    filePath: "src/a.ts",
    lineStart: 1,
    lineEnd: 1,
    category: "convention",
    severity: "nit",
    confidence: 0.9,
    message: "msg",
    why: "because",
    ...overrides,
  };
}

describe("applyGates — confidence", () => {
  it("drops comments below the confidence threshold", () => {
    const gated = applyGates([
      comment({ severity: "major", confidence: 0.5 }),
      comment({ severity: "major", confidence: 0.8 }),
    ]);
    expect(gated[0]).toMatchObject({ posted: false, dropReason: "low_confidence" });
    expect(gated[1]).toMatchObject({ posted: true, dropReason: null });
  });
});

describe("applyGates — nit budget", () => {
  it("keeps only the most-confident nits up to the budget", () => {
    const comments = [
      comment({ severity: "nit", confidence: 0.95 }),
      comment({ severity: "nit", confidence: 0.9 }),
      comment({ severity: "nit", confidence: 0.85 }),
      comment({ severity: "nit", confidence: 0.8 }),
      comment({ severity: "nit", confidence: 0.75 }),
    ];
    const gated = applyGates(comments, { confidenceThreshold: 0.7, nitBudget: 3 });
    const posted = postedComments(gated);
    expect(posted).toHaveLength(3);
    // The three highest-confidence nits survive.
    expect(posted.map((c) => c.confidence)).toEqual([0.95, 0.9, 0.85]);
    // The rest are dropped for budget, not confidence.
    const dropped = gated.filter((g) => !g.posted);
    expect(dropped.every((g) => g.dropReason === "over_nit_budget")).toBe(true);
  });

  it("never drops non-nit comments for budget", () => {
    const comments = [
      comment({ severity: "blocker", confidence: 0.9 }),
      comment({ severity: "major", confidence: 0.9 }),
      comment({ severity: "minor", confidence: 0.9 }),
      comment({ severity: "nit", confidence: 0.9 }),
      comment({ severity: "nit", confidence: 0.9 }),
      comment({ severity: "nit", confidence: 0.9 }),
      comment({ severity: "nit", confidence: 0.9 }),
    ];
    const posted = postedComments(applyGates(comments, DEFAULT_GATES));
    // 3 non-nits + 3 nits (budget) = 6
    expect(posted).toHaveLength(6);
    expect(posted.filter((c) => c.severity !== "nit")).toHaveLength(3);
  });
});
