import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillGrid } from "../SkillGrid";

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
    isAutoAssigned: true,
    useCount: 0,
    discoveredAt: 0,
    _creationTime: 0,
  },
];

describe("SkillGrid", () => {
  test("renders skill cards with display names", () => {
    render(
      <SkillGrid
        skills={mockSkills}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.getByText("Plan Phase")).toBeInTheDocument();
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
  });

  test("renders category icons on cards", () => {
    render(
      <SkillGrid
        skills={mockSkills}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.getByText("📋")).toBeInTheDocument();
    expect(screen.getByText("⚖️")).toBeInTheDocument();
  });

  test("calls onLaunch with skill name when card clicked", () => {
    const onLaunch = vi.fn();
    render(
      <SkillGrid skills={mockSkills} editMode={false} onLaunch={onLaunch} />
    );
    fireEvent.click(screen.getByText("Plan Phase"));
    expect(onLaunch).toHaveBeenCalledWith("gsd-plan-phase");
  });

  test("shows dashed border on auto-assigned skills in edit mode", () => {
    const { container } = render(
      <SkillGrid
        skills={mockSkills}
        editMode={true}
        onLaunch={vi.fn()}
      />
    );
    const cards = container.querySelectorAll("[data-skill]");
    const ndaCard = Array.from(cards).find(
      (c) => c.getAttribute("data-skill") === "legal-nda"
    );
    expect(ndaCard?.className).toContain("border-dashed");
  });
});
