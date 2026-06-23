import { describe, it, expect } from "vitest";
import { formatDate, formatDayMonth } from "./format";

describe("formatDate", () => {
  it("formats from epoch ms deterministically as DD/MM/YYYY (UTC)", () => {
    expect(formatDate(Date.UTC(2026, 5, 9, 12))).toBe("09/06/2026");
  });

  it("accepts an ISO string and a Date, zero-padding day and month", () => {
    expect(formatDate("2026-01-01T00:00:00Z")).toBe("01/01/2026");
    expect(formatDate(new Date(Date.UTC(2026, 11, 25)))).toBe("25/12/2026");
  });
});

describe("formatDayMonth", () => {
  it("formats as DD/MM (UTC)", () => {
    expect(formatDayMonth(Date.UTC(2026, 4, 14))).toBe("14/05");
  });
});
