// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PieChart, Histogram } from "./figures";

describe("PieChart", () => {
  it("shows a placeholder when there is no data", () => {
    render(<PieChart data={[]} />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it("draws a slice per author and lists counts in the legend", () => {
    const { container } = render(
      <PieChart data={[{ label: "Elyan", count: 3 }, { label: "Raz", count: 1 }]} />,
    );
    expect(container.querySelectorAll("path")).toHaveLength(2);
    expect(screen.getByText("Elyan")).toBeInTheDocument();
    expect(screen.getByText(/3 \(75%\)/)).toBeInTheDocument();
  });

  it("draws a full circle for a single author", () => {
    const { container } = render(<PieChart data={[{ label: "Solo", count: 5 }]} />);
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("draws a full circle (not an invisible arc) when one author holds every PR", () => {
    const { container } = render(
      <PieChart data={[{ label: "Solo", count: 5 }, { label: "None", count: 0 }]} />,
    );
    // The 100% slice is a circle; the 0% slice draws nothing (no degenerate path).
    expect(container.querySelector("circle")).not.toBeNull();
    expect(container.querySelectorAll("path")).toHaveLength(0);
    // Both still appear in the legend.
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("links each slice and legend row to its filtered view when given an href", () => {
    const { container } = render(
      <PieChart
        data={[
          { id: "e", label: "Elyan", count: 3, href: "/dashboard/prs?author=e" },
          { id: "r", label: "Raz", count: 1, href: "/dashboard/prs?author=r" },
        ]}
      />,
    );
    // One slice link + one legend link per author.
    expect(container.querySelectorAll('a[href="/dashboard/prs?author=e"]')).toHaveLength(2);
    expect(container.querySelectorAll('a[href="/dashboard/prs?author=r"]')).toHaveLength(2);
  });
});

describe("Histogram", () => {
  const sample = [
    { dateMs: 1, label: "6/1", count: 2, prs: [
      { href: "/dashboard/prs/a", text: "#1 first" },
      { href: "/dashboard/prs/b", text: "#2 second" },
    ] },
    { dateMs: 2, label: "6/2", count: 0, prs: [] },
    { dateMs: 3, label: "6/3", count: 1, prs: [{ href: "/dashboard/prs/c", text: "#3 third" }] },
  ];

  it("draws a hit target plus a bar per day bucket", () => {
    const { container } = render(<Histogram data={sample} />);
    // Each day has an invisible full-height hit target and a visible bar.
    expect(container.querySelectorAll("rect")).toHaveLength(6);
  });

  it("links each day with PRs to its day-filtered view", () => {
    const { container } = render(<Histogram data={sample} />);
    expect(container.querySelector('a[href="/dashboard/prs?day=1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/dashboard/prs?day=3"]')).not.toBeNull();
    // The empty day is not a link.
    expect(container.querySelector('a[href="/dashboard/prs?day=2"]')).toBeNull();
  });

  it("shows the day's PRs on hover", () => {
    const { container } = render(<Histogram data={sample} />);
    const firstDay = container.querySelector('a[href="/dashboard/prs?day=1"] g')!;
    fireEvent.mouseEnter(firstDay);
    expect(screen.getByText("#1 first")).toBeInTheDocument();
    expect(screen.getByText("#2 second")).toBeInTheDocument();
  });

  it("keeps the plot area non-negative at a sliver width", () => {
    // Below the floor the x-axis would invert (x2 < x1). It must not.
    const { container } = render(<Histogram data={sample} width={20} />);
    const lines = [...container.querySelectorAll("line")];
    const xAxis = lines.find((l) => l.getAttribute("y1") === l.getAttribute("y2"))!;
    expect(Number(xAxis.getAttribute("x2"))).toBeGreaterThan(
      Number(xAxis.getAttribute("x1")),
    );
  });
});
