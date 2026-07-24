import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillBulkBar } from "./SkillBulkBar";

const cats = [
  { name: "legal", displayName: "Legal" },
  { name: "dev", displayName: "Development" },
];

function setup(count = 2) {
  const handlers = {
    onFavorite: vi.fn(),
    onMoveToCategory: vi.fn(),
    onArchive: vi.fn(),
    onClear: vi.fn(),
  };
  render(<SkillBulkBar count={count} categories={cats} {...handlers} />);
  return handlers;
}

describe("SkillBulkBar", () => {
  it("renders nothing when the selection is empty", () => {
    const { container } = render(
      <SkillBulkBar
        count={0}
        categories={cats}
        onFavorite={vi.fn()}
        onMoveToCategory={vi.fn()}
        onArchive={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the selected count and fires Favorite / Archive / Clear", () => {
    const h = setup(3);
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /favorite/i }));
    expect(h.onFavorite).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /archive/i }));
    expect(h.onArchive).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /clear selection/i }));
    expect(h.onClear).toHaveBeenCalledOnce();
  });

  it("opens the Move picker and moves to the chosen category", () => {
    const h = setup();
    // Picker is closed initially.
    expect(screen.queryByRole("option", { name: "Development" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /move/i }));
    fireEvent.click(screen.getByRole("option", { name: "Development" }));
    expect(h.onMoveToCategory).toHaveBeenCalledWith("dev");
  });
});
