import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FrequentSkills } from "./FrequentSkills";

describe("FrequentSkills", () => {
  it("renders nothing when no skills have been used", () => {
    const skills = [
      { name: "legal-nda", description: "NDAs", useCount: 0 },
      { name: "asi-briefing", description: "Briefing" },
    ];
    const { container } = render(
      <FrequentSkills skills={skills as any} onLaunchSkill={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders skills sorted by useCount descending", () => {
    const skills = [
      { name: "legal-nda", description: "NDAs", useCount: 3 },
      { name: "legal-review", description: "Review", useCount: 10 },
      { name: "asi-briefing", description: "Briefing", useCount: 1 },
    ];
    render(
      <FrequentSkills skills={skills as any} onLaunchSkill={vi.fn()} />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("legal-review");
    expect(buttons[1]).toHaveTextContent("legal-nda");
    expect(buttons[2]).toHaveTextContent("asi-briefing");
  });

  it("limits to 6 skills maximum", () => {
    const skills = Array.from({ length: 10 }, (_, i) => ({
      name: `skill-${i}`,
      description: `Skill ${i}`,
      useCount: 10 - i,
    }));
    render(
      <FrequentSkills skills={skills as any} onLaunchSkill={vi.fn()} />
    );
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("shows use count badge", () => {
    const skills = [
      { name: "legal-nda", description: "NDAs", useCount: 5 },
    ];
    render(
      <FrequentSkills skills={skills as any} onLaunchSkill={vi.fn()} />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
