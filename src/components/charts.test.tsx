// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LineChart, BarList, TrendBadge } from "./charts";

const pt = (value: number, label = "d") => ({ value, label });

describe("LineChart", () => {
  it("renders a placeholder with no data", () => {
    render(<LineChart points={[]} />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it("renders one hit-area circle per point", () => {
    const { container } = render(<LineChart points={[pt(1), pt(2), pt(3)]} />);
    expect(container.querySelector("polyline")).not.toBeNull();
    // Each point has an invisible hit-target circle plus a visible dot.
    expect(container.querySelectorAll('circle[fill="transparent"]')).toHaveLength(3);
  });

  it("links a point that has an href", () => {
    const { container } = render(
      <LineChart points={[{ value: 5, label: "Jun 1", href: "/dashboard/prs/abc" }]} />,
    );
    expect(container.querySelector('a[href="/dashboard/prs/abc"]')).not.toBeNull();
  });

  it("keeps the plot area non-negative at a sliver width", () => {
    // Below the floor the x-axis would invert and coordinates go NaN.
    const { container } = render(<LineChart points={[pt(1), pt(2)]} width={20} />);
    const lines = [...container.querySelectorAll("line")];
    const xAxis = lines.find((l) => l.getAttribute("y1") === l.getAttribute("y2"))!;
    expect(Number(xAxis.getAttribute("x2"))).toBeGreaterThan(
      Number(xAxis.getAttribute("x1")),
    );
  });
});

describe("BarList", () => {
  it("renders one row per item with its count", () => {
    render(<BarList data={[{ label: "bug", count: 4 }, { label: "naming", count: 2 }]} />);
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("expands to show contributing items on click", () => {
    render(
      <BarList
        data={[
          {
            label: "convention",
            count: 1,
            items: [{ href: "/dashboard/prs/p1", text: "#1 — console.log" }],
          },
        ]}
      />,
    );
    // Collapsed: the drill-down link is not shown yet.
    expect(screen.queryByText(/console\.log/)).toBeNull();
    fireEvent.click(screen.getByText("convention"));
    const link = screen.getByText("#1 — console.log");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/dashboard/prs/p1");
  });
});

describe("TrendBadge", () => {
  it("shows growth-framed wording for improving", () => {
    render(<TrendBadge trend="improving" />);
    expect(screen.getByText(/improving/i)).toBeInTheDocument();
  });
});
