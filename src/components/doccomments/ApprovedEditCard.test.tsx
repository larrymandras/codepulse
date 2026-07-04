import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApprovedEditCard } from "./ApprovedEditCard";
import type { DocComment } from "../../lib/docCommentsApi";

const comment = {
  id: "c1", status: "approved", proposed_edit: "validate and sanitize inputs",
  anchor: { quote: "validate inputs" }, comment: "x", author: "l",
} as unknown as DocComment;

describe("ApprovedEditCard", () => {
  it("renders a word-diff and fires Apply", () => {
    const onApply = vi.fn();
    render(<ApprovedEditCard comment={comment} onApply={onApply} applying={false} />);
    expect(screen.getByText(/sanitize/)).toBeInTheDocument();      // added word visible
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith("c1");
  });
});
