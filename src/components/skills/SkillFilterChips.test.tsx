import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillFilterChips, type SkillChip } from "./SkillFilterChips";

const counts: Record<SkillChip, number> = {
  all: 474,
  favorites: 18,
  mostused: 40,
  unused: 213,
  recent: 9,
  global: 180,
  project: 22,
  cold: 80,
};

describe("SkillFilterChips", () => {
  it("renders all chips with their counts", () => {
    render(<SkillFilterChips active="all" counts={counts} onSelect={vi.fn()} />);
    expect(screen.getByTestId("skill-chip-all")).toHaveTextContent("474");
    expect(screen.getByTestId("skill-chip-favorites")).toHaveTextContent("18");
    expect(screen.getByTestId("skill-chip-unused")).toHaveTextContent("213");
    expect(screen.getByTestId("skill-chip-cold")).toHaveTextContent("80");
  });

  it("marks the active chip via aria-pressed", () => {
    render(<SkillFilterChips active="favorites" counts={counts} onSelect={vi.fn()} />);
    expect(screen.getByTestId("skill-chip-favorites")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("skill-chip-all")).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onSelect with the chip id when clicked", () => {
    const onSelect = vi.fn();
    render(<SkillFilterChips active="all" counts={counts} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("skill-chip-project"));
    expect(onSelect).toHaveBeenCalledWith("project");
  });
});
