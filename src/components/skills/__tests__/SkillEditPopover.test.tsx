import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillEditPopover } from "../SkillEditPopover";

const mockCategories = [
  { name: "gsd", displayName: "Project Management", icon: "📋" },
  { name: "legal", displayName: "Legal", icon: "⚖️" },
];

describe("SkillEditPopover", () => {
  test("renders with pre-filled values", () => {
    render(
      <SkillEditPopover
        skillName="gsd-plan-phase"
        displayName="Plan Phase"
        description="Create detailed plans"
        categoryName="gsd"
        hidden={false}
        categories={mockCategories}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("Plan Phase")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Create detailed plans")).toBeInTheDocument();
  });

  test("calls onSave with updated values", () => {
    const onSave = vi.fn();
    render(
      <SkillEditPopover
        skillName="gsd-plan-phase"
        displayName="Plan Phase"
        description=""
        categoryName="gsd"
        hidden={false}
        categories={mockCategories}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    const nameInput = screen.getByDisplayValue("Plan Phase");
    fireEvent.change(nameInput, { target: { value: "Phase Planner" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Phase Planner" })
    );
  });

  test("calls onCancel when cancel clicked", () => {
    const onCancel = vi.fn();
    render(
      <SkillEditPopover
        skillName="gsd-plan-phase"
        displayName="Plan Phase"
        description=""
        categoryName="gsd"
        hidden={false}
        categories={mockCategories}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });
});
