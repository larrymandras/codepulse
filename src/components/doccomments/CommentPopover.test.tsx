import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentPopover } from "./CommentPopover";

const rect = { top: 10, left: 10, bottom: 20, right: 20, width: 10, height: 10 } as DOMRect;

describe("CommentPopover", () => {
  it("submits the typed instruction", () => {
    const onSubmit = vi.fn();
    render(<CommentPopover rect={rect} onSubmit={onSubmit} onCancel={vi.fn()} submitting={false} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "tighten this" } });
    fireEvent.click(screen.getByRole("button", { name: /comment/i }));
    expect(onSubmit).toHaveBeenCalledWith("tighten this");
  });

  it("renders nothing without a rect", () => {
    const { container } = render(<CommentPopover rect={null} onSubmit={vi.fn()} onCancel={vi.fn()} submitting={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
