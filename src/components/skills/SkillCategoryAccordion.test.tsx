import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillCategoryAccordion } from "./SkillCategoryAccordion";

const mockSkills = [
  { name: "legal-nda", displayName: "Nda", description: "Generate NDAs" },
  { name: "legal-review", displayName: "Review", description: "Review contracts" },
];

describe("SkillCategoryAccordion", () => {
  it("renders category name and skill count", () => {
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={false}
        onToggle={vi.fn()}
        onLaunchSkill={vi.fn()}
      />
    );
    expect(screen.getByText("Legal")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show skills when collapsed", () => {
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={false}
        onToggle={vi.fn()}
        onLaunchSkill={vi.fn()}
      />
    );
    expect(screen.queryByText("Nda")).not.toBeInTheDocument();
  });

  it("shows skills when expanded", () => {
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={true}
        onToggle={vi.fn()}
        onLaunchSkill={vi.fn()}
      />
    );
    expect(screen.getByText("Nda")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("calls onToggle when header is clicked", () => {
    const onToggle = vi.fn();
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={false}
        onToggle={onToggle}
        onLaunchSkill={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Legal"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("calls onLaunchSkill with skill name when a skill button is clicked", () => {
    const onLaunchSkill = vi.fn();
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={true}
        onToggle={vi.fn()}
        onLaunchSkill={onLaunchSkill}
      />
    );
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onLaunchSkill).toHaveBeenCalledWith("legal-nda");
  });
});
