// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConventionEditor } from "./convention-editor";

/** Stub matchMedia so we can simulate a phone (matches) vs a desktop (no match). */
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConventionEditor", () => {
  it("shows the version badge and a save label when a doc exists", () => {
    mockMatchMedia(false);
    render(<ConventionEditor label="Org" scope="org" markdown="# rules" version={1} />);
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save as v2/i })).toBeInTheDocument();
  });

  it("offers to create conventions when none exist yet", () => {
    mockMatchMedia(false);
    render(<ConventionEditor label="Frontend" scope="team" markdown="" version={0} />);
    expect(screen.getByText("not set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create conventions/i })).toBeInTheDocument();
  });

  it("leaves the textarea editable on desktop", () => {
    mockMatchMedia(false);
    render(<ConventionEditor label="Org" scope="org" markdown="# rules" version={1} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).not.toHaveAttribute("readonly");
  });

  it("locks the textarea read-only on a phone (where saving is hidden)", () => {
    mockMatchMedia(true);
    render(<ConventionEditor label="Org" scope="org" markdown="# rules" version={1} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("readonly");
  });
});
