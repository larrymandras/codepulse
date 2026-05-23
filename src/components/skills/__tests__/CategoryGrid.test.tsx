import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryGrid } from "../CategoryGrid";

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

    const navItems = screen.getAllByTestId("category-nav-item");
    expect(navItems).toHaveLength(2);

    expect(screen.getByText("Project Management")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    expect(screen.getByText("Legal")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  test("renders Add Category button", () => {
    render(<CategoryGrid {...defaultProps} />);

    expect(screen.getByText("New Category")).toBeInTheDocument();
  });

  test("calls onAddCategory when Add button is clicked", () => {
    const onAddCategory = vi.fn();
    render(<CategoryGrid {...defaultProps} onAddCategory={onAddCategory} />);

    fireEvent.click(screen.getByText("New Category"));
    expect(onAddCategory).toHaveBeenCalledTimes(1);
  });
});
