// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { NewDot } from "./new-dot";

describe("NewDot", () => {
  it("shows a dot for something created within the last hour", async () => {
    render(<NewDot since={Date.now() - 60 * 1000} />); // a minute ago
    // The dot only appears after mount (avoids a hydration mismatch).
    await waitFor(() => expect(screen.getByLabelText("new")).toBeInTheDocument());
  });

  it("shows nothing for something older than an hour", async () => {
    render(<NewDot since={Date.now() - 2 * 60 * 60 * 1000} />); // two hours ago
    // Give the post-mount effect a chance to run, then assert it stays empty.
    await Promise.resolve();
    expect(screen.queryByLabelText("new")).toBeNull();
  });
});
