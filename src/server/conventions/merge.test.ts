import { describe, it, expect } from "vitest";
import { mergeConventions, type ConventionLayer } from "./merge";

describe("mergeConventions", () => {
  it("orders layers broad-to-specific regardless of input order", () => {
    const layers: ConventionLayer[] = [
      { scope: "repo", version: 2, markdown: "repo rule" },
      { scope: "org", version: 1, markdown: "org rule" },
      { scope: "team", version: 3, markdown: "team rule" },
    ];
    const merged = mergeConventions(layers);
    expect(merged.indexOf("org rule")).toBeLessThan(merged.indexOf("team rule"));
    expect(merged.indexOf("team rule")).toBeLessThan(merged.indexOf("repo rule"));
  });

  it("includes the version in each heading", () => {
    const merged = mergeConventions([
      { scope: "org", version: 5, markdown: "x" },
    ]);
    expect(merged).toContain("Organisation conventions (v5)");
  });

  it("skips empty layers", () => {
    const merged = mergeConventions([
      { scope: "org", version: 1, markdown: "   " },
      { scope: "team", version: 1, markdown: "team rule" },
    ]);
    expect(merged).not.toContain("Organisation");
    expect(merged).toContain("team rule");
  });

  it("falls back to a default when there are no conventions", () => {
    expect(mergeConventions([])).toMatch(/general best practices/i);
  });
});
