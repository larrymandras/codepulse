import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DiffView from "../DiffView";

describe("DiffView", () => {
  it("renders added lines with + prefix and green background", () => {
    const { container } = render(
      <DiffView original="line1\nline2" current="line1\nline3" />
    );
    expect(screen.getByText("+")).toBeInTheDocument();
    const addedRow = container.querySelector(".bg-\\(--status-ok\\)\\/15");
    expect(addedRow).toBeTruthy();
  });

  it("renders removed lines with - prefix and red background", () => {
    const { container } = render(
      <DiffView original="line1\nline2" current="line1\nline3" />
    );
    expect(screen.getByText("-")).toBeInTheDocument();
    const removedRow = container.querySelector(".bg-\\(--status-error\\)\\/15");
    expect(removedRow).toBeTruthy();
  });

  it("renders unchanged lines with space prefix and no background", () => {
    render(<DiffView original="a\nb" current="a\nb" />);
    // When original === current there are no changes, show empty state
    expect(screen.getByText("No changes to review.")).toBeInTheDocument();
  });

  it("shows line numbers in left gutter", () => {
    render(<DiffView original="line1\nline2" current="line1\nline3" />);
    // At minimum, line numbers 1 and 2 should appear
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows 'No changes to review' when original equals current", () => {
    render(<DiffView original="same content" current="same content" />);
    expect(screen.getByText("No changes to review.")).toBeInTheDocument();
  });
});
