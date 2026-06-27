import { describe, it, expect } from "vitest";
import { countByAuthor, countByDay } from "./pr-stats";
import type { PRListItem } from "@/server/db/pull-request";

function pr(authorName: string, createdAt: Date): PRListItem {
  return {
    id: Math.random().toString(36).slice(2),
    number: 1,
    title: "t",
    status: "open",
    authorId: "a",
    authorName,
    repoFullName: "colman/app",
    createdAt,
    latestDensity: null,
    commentCount: 0,
    highSeverityCount: 0,
  };
}

describe("countByAuthor", () => {
  it("counts PRs per author, most prolific first", () => {
    const rows = countByAuthor([
      pr("Elyan", new Date("2026-06-01")),
      pr("Elyan", new Date("2026-06-02")),
      pr("Raz", new Date("2026-06-03")),
    ]);
    expect(rows).toEqual([
      { label: "Elyan", count: 2 },
      { label: "Raz", count: 1 },
    ]);
  });

  it("is empty for no PRs", () => {
    expect(countByAuthor([])).toEqual([]);
  });
});

describe("countByDay", () => {
  it("fills the full day span, zeros included", () => {
    const rows = countByDay([
      pr("A", new Date(2026, 5, 1, 9)),
      pr("B", new Date(2026, 5, 1, 18)),
      pr("C", new Date(2026, 5, 4, 12)),
    ]);
    // Jun 1, 2, 3, 4 -> four buckets.
    expect(rows).toHaveLength(4);
    expect(rows[0].count).toBe(2); // two on Jun 1
    expect(rows[1].count).toBe(0); // Jun 2 empty
    expect(rows[2].count).toBe(0); // Jun 3 empty
    expect(rows[3].count).toBe(1); // one on Jun 4
    expect(rows[0].label).toBe("01/06");
  });

  it("carries each day's PRs as drill-down links", () => {
    const rows = countByDay([pr("A", new Date(2026, 5, 1, 9))]);
    expect(rows[0].prs).toHaveLength(1);
    expect(rows[0].prs[0].href).toMatch(/^\/dashboard\/prs\//);
    expect(rows[0].prs[0].text).toBe("#1 t");
    // Empty days carry no PRs.
    expect(rows.find((r) => r.count === 0)?.prs ?? []).toEqual([]);
  });

  it("is empty for no PRs", () => {
    expect(countByDay([])).toEqual([]);
  });
});
