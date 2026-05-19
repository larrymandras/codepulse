import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryGrid } from "../CategoryGrid";

vi.mock("../CategoryCard", () => ({
  CategoryCard: ({
    category,
    skillCount,
    onSelect,
    onEdit,
    isDropTarget,
  }: any) => (
    <div
      data-testid={`category-card-${category.name}`}
      data-skill-count={skillCount}
      data-is-drop-target={isDropTarget}
      onClick={onSelect}
    >
      {category.displayName} ({skillCount})
    </div>
  ),
}));

const mockCategories = [
  {
    _id: "1" as any,
    name: "gsd",
    displayName: "Project Management",
    icon: "📋",
    color: "indigo",
    description: "Planning and execution",
    sortOrder: 0,
    _creationTime: 0,
  },
  {
    _id: "2" as any,
    name: "legal",
    displayName: "Legal",
    icon: "⚖️",
    color: "red",
    description: "Contracts and compliance",
    sortOrder: 1,
    _creationTime: 0,
  },
];

const defaultProps = {
  categories: mockCategories,
  skillCounts: { gsd: 12, legal: 5 } as Record<string, number>,
  onSelectCategory: vi.fn(),
  onEditCategory: vi.fn(),
  onAddCategory: vi.fn(),
};

describe("CategoryGrid", () => {
  test("renders all category cards with correct skill counts", () => {
    render(<CategoryGrid {...defaultProps} />);

    const gsdCard = screen.getByTestId("category-card-gsd");
    expect(gsdCard).toBeInTheDocument();
    expect(gsdCard).toHaveAttribute("data-skill-count", "12");
    expect(gsdCard).toHaveTextContent("Project Management (12)");

    const legalCard = screen.getByTestId("category-card-legal");
    expect(legalCard).toBeInTheDocument();
    expect(legalCard).toHaveAttribute("data-skill-count", "5");
    expect(legalCard).toHaveTextContent("Legal (5)");
  });

  test("renders Add Category card", () => {
    render(<CategoryGrid {...defaultProps} />);

    const addCard = screen.getByTestId("add-category-card");
    expect(addCard).toBeInTheDocument();
    expect(addCard).toHaveTextContent("Add Category");
  });

  test("calls onAddCategory when Add card is clicked", () => {
    const onAddCategory = vi.fn();
    render(<CategoryGrid {...defaultProps} onAddCategory={onAddCategory} />);

    fireEvent.click(screen.getByTestId("add-category-card"));
    expect(onAddCategory).toHaveBeenCalledTimes(1);
  });
});
