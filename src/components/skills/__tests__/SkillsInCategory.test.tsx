import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillsInCategory } from "../SkillsInCategory";

const mockSkills = [
  {
    name: "gsd-plan-phase",
    displayName: "Plan Phase",
    description: "Create detailed phase plans",
    overrideDescription: null,
    useCount: 12,
    isAutoAssigned: false,
    favorite: true,
  },
  {
    name: "gsd-execute-phase",
    displayName: "Execute Phase",
    description: "Run phase plans",
    overrideDescription: null,
    useCount: 0,
    isAutoAssigned: true,
    favorite: false,
  },
  {
    name: "gsd-progress",
    displayName: "Check Progress",
    description: null,
    overrideDescription: "Custom progress description",
    useCount: 3,
    isAutoAssigned: false,
    favorite: false,
  },
];

const mockCategories = [
  { name: "gsd", displayName: "Project Management", icon: "📋", color: "indigo" },
  { name: "legal", displayName: "Legal", icon: "⚖️", color: "red" },
];

const defaultProps = {
  categoryName: "gsd" as string | null,
  categoryDisplayName: "Project Management",
  categoryIcon: "📋",
  categoryColor: "indigo",
  skills: mockSkills,
  categories: mockCategories,
  onBack: vi.fn(),
  onLaunch: vi.fn(),
  onEditSkill: vi.fn(),
  onReassignSkill: vi.fn(),
  onToggleFavorite: vi.fn(),
};

describe("SkillsInCategory", () => {
  test("renders category name and back button", () => {
    render(<SkillsInCategory {...defaultProps} />);

    expect(screen.getByText("Project Management")).toBeInTheDocument();
    expect(screen.getByText("📋")).toBeInTheDocument();
    expect(screen.getByLabelText("Back")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("renders all skills with display names", () => {
    render(<SkillsInCategory {...defaultProps} />);

    expect(screen.getByText("Plan Phase")).toBeInTheDocument();
    expect(screen.getByText("Execute Phase")).toBeInTheDocument();
    expect(screen.getByText("Check Progress")).toBeInTheDocument();
  });

  test("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    render(<SkillsInCategory {...defaultProps} onBack={onBack} />);

    fireEvent.click(screen.getByLabelText("Back"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  test("calls onLaunch when launch button is clicked", () => {
    const onLaunch = vi.fn();
    render(<SkillsInCategory {...defaultProps} onLaunch={onLaunch} />);

    const launchButtons = screen.getAllByText("Launch");
    fireEvent.click(launchButtons[0]);
    expect(onLaunch).toHaveBeenCalledWith("gsd-plan-phase");
  });

  test("calls onEditSkill when edit button is clicked", () => {
    const onEditSkill = vi.fn();
    render(<SkillsInCategory {...defaultProps} onEditSkill={onEditSkill} />);

    const editButtons = screen.getAllByTitle("Edit Metadata");
    fireEvent.click(editButtons[0]);
    expect(onEditSkill).toHaveBeenCalledWith("gsd-plan-phase");
  });

  test("shows drop targets for other categories", () => {
    render(<SkillsInCategory {...defaultProps} />);

    const dropTargets = screen.getAllByTitle(/Drop to move to/);
    expect(dropTargets.length).toBe(1);
  });

  test("calls onReassignSkill when skill is dropped on target", () => {
    const onReassignSkill = vi.fn();
    render(<SkillsInCategory {...defaultProps} onReassignSkill={onReassignSkill} />);

    const dropTarget = screen.getByTitle("Drop to move to Legal");
    fireEvent.drop(dropTarget, {
      dataTransfer: { getData: () => "gsd-plan-phase" },
    });
    expect(onReassignSkill).toHaveBeenCalledWith("gsd-plan-phase", "legal");
  });
});
