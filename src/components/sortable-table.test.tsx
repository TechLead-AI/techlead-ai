// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SortableTable, type Column } from "./sortable-table";

const columns: Column[] = [
  { key: "name", label: "Name", type: "link", hrefKey: "href", subKey: "login" },
  { key: "reviews", label: "Reviews", type: "number" },
];

const rows = [
  { name: "Raz", href: "/j/raz", login: "@raz", reviews: 4 },
  { name: "Adi", href: "/j/adi", login: "@adi", reviews: 1 },
  { name: "Elyan", href: "/j/elyan", login: "@elyan", reviews: 7 },
];

function bodyNames() {
  const rowsEls = screen.getAllByRole("row").slice(1); // skip header
  // The first cell is a link; read its anchor text (ignoring the muted @login).
  return rowsEls.map((r) => within(r).getAllByRole("link")[0].textContent);
}

describe("SortableTable", () => {
  it("renders link cells with href and muted sub-text", () => {
    render(<SortableTable columns={columns} rows={rows} initialSortKey="name" />);
    const link = screen.getByText("Raz").closest("a");
    expect(link).toHaveAttribute("href", "/j/raz");
    expect(screen.getByText("@raz")).toBeInTheDocument();
  });

  it("sorts by the initial key ascending", () => {
    render(<SortableTable columns={columns} rows={rows} initialSortKey="name" />);
    expect(bodyNames()).toEqual(["Adi", "Elyan", "Raz"]);
  });

  it("re-sorts when a header is clicked, and toggles direction", () => {
    render(<SortableTable columns={columns} rows={rows} initialSortKey="name" />);
    // /reviews/ matches even once the active sort arrow is appended.
    const reviewsHeader = () => screen.getByRole("columnheader", { name: /reviews/i });
    // Click Reviews -> numeric defaults to descending (7, 4, 1).
    fireEvent.click(reviewsHeader());
    expect(bodyNames()).toEqual(["Elyan", "Raz", "Adi"]);
    // Click again -> ascending (1, 4, 7).
    fireEvent.click(reviewsHeader());
    expect(bodyNames()).toEqual(["Adi", "Raz", "Elyan"]);
  });

  it("renders the issues column: high-severity count plus total", () => {
    const issueCols: Column[] = [
      { key: "high", label: "Issues", type: "issues", subKey: "total" },
    ];
    render(
      <SortableTable
        columns={issueCols}
        rows={[{ high: 2, total: 12 }]}
        initialSortKey="high"
      />,
    );
    expect(screen.getByText("2 high")).toBeInTheDocument();
    expect(screen.getByText("· 12")).toBeInTheDocument();
  });

  it("shows only the total when there are no high-severity issues", () => {
    const issueCols: Column[] = [
      { key: "high", label: "Issues", type: "issues", subKey: "total" },
    ];
    render(
      <SortableTable
        columns={issueCols}
        rows={[{ high: 0, total: 5 }]}
        initialSortKey="high"
      />,
    );
    expect(screen.queryByText(/high/)).toBeNull();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows a dash when a PR has no comments at all", () => {
    const issueCols: Column[] = [
      { key: "high", label: "Issues", type: "issues", subKey: "total" },
    ];
    render(
      <SortableTable
        columns={issueCols}
        rows={[{ high: 0, total: 0 }]}
        initialSortKey="high"
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("filters rows by the search box across searchKeys", () => {
    render(
      <SortableTable
        columns={columns}
        rows={rows}
        initialSortKey="name"
        searchKeys={["name"]}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ely" } });
    expect(bodyNames()).toEqual(["Elyan"]);
  });

  it("matches a date substring via a searchable text field", () => {
    const dated = [
      { name: "Raz", href: "/j/raz", login: "@raz", reviews: 4, opened: "27/06/2026" },
      { name: "Adi", href: "/j/adi", login: "@adi", reviews: 1, opened: "25/06/2026" },
    ];
    render(
      <SortableTable
        columns={columns}
        rows={dated}
        initialSortKey="name"
        searchKeys={["name", "opened"]}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "27/06" } });
    expect(bodyNames()).toEqual(["Raz"]);
  });
});
