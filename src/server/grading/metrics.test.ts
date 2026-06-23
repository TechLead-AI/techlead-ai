import { describe, it, expect } from "vitest";
import {
  issueDensity,
  repeatRate,
  categoryMix,
  computeMetrics,
  type GradableComment,
} from "./metrics";

function c(
  severity: GradableComment["severity"],
  category: GradableComment["category"],
  isRepeat = false,
): GradableComment {
  return { severity, category, isRepeat };
}

describe("issueDensity", () => {
  it("is weighted severity per 100 lines", () => {
    // blocker(8) + major(4) = 12 over 200 lines -> 6 per 100
    const comments = [c("blocker", "bug"), c("major", "design")];
    expect(issueDensity(comments, 200)).toBe(6);
  });

  it("is zero with no comments", () => {
    expect(issueDensity([], 100)).toBe(0);
  });

  it("does not divide by zero on an empty diff", () => {
    expect(issueDensity([c("nit", "naming")], 0)).toBe(50);
  });
});

describe("repeatRate", () => {
  it("is the fraction of repeated mistakes", () => {
    const comments = [
      c("major", "bug", true),
      c("minor", "design", false),
      c("nit", "naming", true),
      c("minor", "test", false),
    ];
    expect(repeatRate(comments)).toBe(0.5);
  });

  it("is zero with no comments", () => {
    expect(repeatRate([])).toBe(0);
  });
});

describe("categoryMix", () => {
  it("counts comments per category", () => {
    const comments = [c("major", "bug"), c("minor", "bug"), c("nit", "naming")];
    expect(categoryMix(comments)).toEqual({ bug: 2, naming: 1 });
  });
});

describe("computeMetrics", () => {
  it("assembles the full snapshot", () => {
    const comments = [
      c("blocker", "security", true),
      c("nit", "naming", false),
    ];
    const m = computeMetrics(comments, 100);
    expect(m.commentCount).toBe(2);
    expect(m.issueDensity).toBe(8.5); // (8 + 0.5) / 100 * 100
    expect(m.repeatRate).toBe(0.5);
    expect(m.categoryMix).toEqual({ security: 1, naming: 1 });
  });
});
