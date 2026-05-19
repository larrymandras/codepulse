import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryCard } from "../CategoryCard";

const mockCategory = {
  _id: "cat1" as any,
  name: "gsd",
  displayName: "Get Shit Done",
  description: "Planning, execution, and milestone tracking",
  icon: "🚀",
  color: "indigo",
};

describe("CategoryCard", () => {
  test("renders display name, icon, and skill count", () => {
    render(
      <CategoryCard
        category={mockCategory}
        skillCount={12}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
      />
    );
    expect(screen.getByText("Get Shit Done")).toBeInTheDocument();
    expect(screen.getByText("🚀")).toBeInTheDocument();
    expect(screen.getByText("12 skills")).toBeInTheDocument();
  });

  test("calls onSelect when card body is clicked", () => {
    const onSelect = vi.fn();
    render(
      <CategoryCard
        category={mockCategory}
        skillCount={5}
        onSelect={onSelect}
        onEdit={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("category-card"));
    expect(onSelect).toHaveBeenCalledWith("gsd");
  });

  test("calls onEdit when gear icon is clicked and does NOT call onSelect", () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    render(
      <CategoryCard
        category={mockCategory}
        skillCount={5}
        onSelect={onSelect}
        onEdit={onEdit}
      />
    );
    fireEvent.click(screen.getByTestId("category-edit-btn"));
    expect(onEdit).toHaveBeenCalledWith(mockCategory);
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("shows drop-target styling when isDropTarget is true", () => {
    render(
      <CategoryCard
        category={mockCategory}
        skillCount={3}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        isDropTarget={true}
      />
    );
    const card = screen.getByTestId("category-card");
    expect(card.className).toContain("border-dashed");
    expect(card.className).toContain("border-indigo-400");
  });
});
