// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { NewReviewPopup } from "./new-review-popup";
import type { LatestReviewNotice } from "@/server/db/latest-review";

const notice: LatestReviewNotice = {
  reviewId: "rev_1",
  pullRequestId: "pr_1",
  prNumber: 42,
  prTitle: "Add retry logic to the uploader",
  authorName: "Dana Junior",
  issueCount: 3,
};

describe("NewReviewPopup", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the author, title, and issue count after mount", async () => {
    render(<NewReviewPopup notice={notice} />);
    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "New review" })).toBeInTheDocument(),
    );
    expect(screen.getByText("Add retry logic to the uploader")).toBeInTheDocument();
    expect(screen.getByText(/Opened by Dana Junior/)).toBeInTheDocument();
    expect(screen.getByText(/3 issues/)).toBeInTheDocument();
  });

  it("uses the singular 'issue' for a single issue", async () => {
    render(<NewReviewPopup notice={{ ...notice, issueCount: 1 }} />);
    await waitFor(() => expect(screen.getByText(/1 issue\b/)).toBeInTheDocument());
  });

  it("links the View PR button to the PR detail page", async () => {
    render(<NewReviewPopup notice={notice} />);
    const link = await screen.findByRole("link", { name: "View PR" });
    expect(link).toHaveAttribute("href", "/dashboard/prs/pr_1");
  });

  it("closes when the X button is clicked", async () => {
    render(<NewReviewPopup notice={notice} />);
    const close = await screen.findByRole("button", { name: "Close" });
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when the backdrop (anywhere outside the card) is clicked", async () => {
    render(<NewReviewPopup notice={notice} />);
    const dialog = await screen.findByRole("dialog");
    // The backdrop is the dialog's parent; clicking the card itself must not close.
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes when Escape is pressed", async () => {
    render(<NewReviewPopup notice={notice} />);
    await screen.findByRole("dialog");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not show again once the review has been dismissed", async () => {
    // Dismissing (not merely mounting) is what marks rev_1 as seen.
    const first = render(<NewReviewPopup notice={notice} />);
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    first.unmount();

    // A fresh mount of the same review id stays hidden.
    render(<NewReviewPopup notice={notice} />);
    await Promise.resolve();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows again on a fresh mount if it was never dismissed", async () => {
    // Mounting then navigating away (without dismissing) must NOT mark it seen,
    // so the manager still gets to see it next time.
    const first = render(<NewReviewPopup notice={notice} />);
    await screen.findByRole("dialog");
    first.unmount();

    render(<NewReviewPopup notice={notice} />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });

  it("shows again when a different (newer) review arrives", async () => {
    const first = render(<NewReviewPopup notice={notice} />);
    await screen.findByRole("dialog");
    first.unmount();

    render(<NewReviewPopup notice={{ ...notice, reviewId: "rev_2" }} />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  });
});
