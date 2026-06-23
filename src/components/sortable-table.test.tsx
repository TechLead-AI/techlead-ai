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
});
