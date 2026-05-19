import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillList } from "../SkillList";

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

const mockSkills = [
  {
    _id: "s1" as any,
    name: "gsd-plan-phase",
    displayName: "Plan Phase",
    description: "Create detailed plans",
    categoryIcon: "📋",
    categoryColor: "indigo",
    categoryName: "gsd",
    hidden: false,
    isAutoAssigned: false,
    useCount: 5,
    discoveredAt: 0,
    _creationTime: 0,
  },
  {
    _id: "s2" as any,
    name: "legal-nda",
    displayName: "NDA Generator",
    description: "Draft NDAs",
    categoryIcon: "⚖️",
    categoryColor: "red",
    categoryName: "legal",
    hidden: false,
    isAutoAssigned: false,
    useCount: 0,
    discoveredAt: 0,
    _creationTime: 0,
  },
];

describe("SkillList", () => {
  test("renders category headers with icons and counts", () => {
    render(
      <SkillList
        skills={mockSkills}
        categories={mockCategories}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.getByText("📋")).toBeInTheDocument();
    expect(screen.getByText("Project Management")).toBeInTheDocument();
    const countBadges = screen.getAllByText("1");
    expect(countBadges.length).toBe(2);
  });

  test("renders skill cards within their category section", () => {
    render(
      <SkillList
        skills={mockSkills}
        categories={mockCategories}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.getByText("Plan Phase")).toBeInTheDocument();
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
  });

  test("calls onLaunch when skill card clicked", () => {
    const onLaunch = vi.fn();
    render(
      <SkillList
        skills={mockSkills}
        categories={mockCategories}
        editMode={false}
        onLaunch={onLaunch}
      />
    );
    fireEvent.click(screen.getByText("Plan Phase"));
    expect(onLaunch).toHaveBeenCalledWith("gsd-plan-phase");
  });

  test("hides empty categories", () => {
    const emptyCategory = {
      _id: "3" as any,
      name: "empty",
      displayName: "Empty Cat",
      icon: "🔮",
      color: "gray",
      description: "",
      sortOrder: 2,
      _creationTime: 0,
    };
    render(
      <SkillList
        skills={mockSkills}
        categories={[...mockCategories, emptyCategory]}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.queryByText("Empty Cat")).not.toBeInTheDocument();
  });
});
