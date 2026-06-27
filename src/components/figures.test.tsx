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
});
