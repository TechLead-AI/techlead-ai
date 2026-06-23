// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
  it("draws one bar per day bucket", () => {
    const { container } = render(
      <Histogram
        data={[
          { dateMs: 1, label: "6/1", count: 2 },
          { dateMs: 2, label: "6/2", count: 0 },
          { dateMs: 3, label: "6/3", count: 1 },
        ]}
      />,
    );
    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });
});
