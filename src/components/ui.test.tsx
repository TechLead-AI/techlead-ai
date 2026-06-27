// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, Stat, SeverityBadge, StatusBadge, Tag } from "./ui";

describe("Card", () => {
  it("renders its title and children inside the card panel", () => {
    const { container } = render(
      <Card title="Reviews">
        <p>body</p>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Reviews" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(container.querySelector("section.card")).not.toBeNull();
  });

  it("omits the heading when no title is given", () => {
    render(
      <Card>
        <span>just content</span>
      </Card>,
    );
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("merges a caller's style onto the card", () => {
    const { container } = render(<Card style={{ minWidth: 280 }}>x</Card>);
    const section = container.querySelector("section.card") as HTMLElement;
    expect(section.style.minWidth).toBe("280px");
  });
});

describe("Stat", () => {
  it("renders the label and value with their responsive classes", () => {
    const { container } = render(<Stat label="Reviews" value={42} />);
    expect(container.querySelector(".stat-label")?.textContent).toBe("Reviews");
    expect(container.querySelector(".stat-value")?.textContent).toBe("42");
  });
});

describe("badges and tags", () => {
  it("shows the severity text", () => {
    render(<SeverityBadge severity="blocker" />);
    expect(screen.getByText("blocker")).toBeInTheDocument();
  });

  it("shows the status text", () => {
    render(<StatusBadge status="open" />);
    expect(screen.getByText("open")).toBeInTheDocument();
  });

  it("renders tag children", () => {
    render(<Tag>naming</Tag>);
    expect(screen.getByText("naming")).toBeInTheDocument();
  });
});
