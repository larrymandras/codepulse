import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryTabs } from "../CategoryTabs";

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

describe("CategoryTabs", () => {
  test("renders All tab and category tabs", () => {
    render(
      <CategoryTabs
        categories={mockCategories}
        activeCategory={null}
        onSelect={vi.fn()}
        editMode={false}
      />
    );
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("📋 Project Management")).toBeInTheDocument();
    expect(screen.getByText("⚖️ Legal")).toBeInTheDocument();
  });

  test("calls onSelect with category name when tab clicked", () => {
    const onSelect = vi.fn();
    render(
      <CategoryTabs
        categories={mockCategories}
        activeCategory={null}
        onSelect={onSelect}
        editMode={false}
      />
    );
    fireEvent.click(screen.getByText("⚖️ Legal"));
    expect(onSelect).toHaveBeenCalledWith("legal");
  });

  test("calls onSelect with null when All tab clicked", () => {
    const onSelect = vi.fn();
    render(
      <CategoryTabs
        categories={mockCategories}
        activeCategory="gsd"
        onSelect={onSelect}
        editMode={false}
      />
    );
    fireEvent.click(screen.getByText("All"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  test("highlights the active category", () => {
    render(
      <CategoryTabs
        categories={mockCategories}
        activeCategory="gsd"
        onSelect={vi.fn()}
        editMode={false}
      />
    );
    const activeTab = screen.getByText("📋 Project Management").closest("button");
    expect(activeTab?.className).toContain("bg-indigo");
  });
});
