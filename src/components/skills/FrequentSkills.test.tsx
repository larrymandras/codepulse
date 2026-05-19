import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FrequentSkills } from "./FrequentSkills";

describe("FrequentSkills", () => {
  it("renders nothing when no skills have been used", () => {
    const skills = [
      { name: "legal-nda", displayName: "NDA", categoryColor: "red", useCount: 0 },
      { name: "asi-briefing", displayName: "Briefing", categoryColor: "indigo" },
    ];
    const { container } = render(
      <FrequentSkills skills={skills} onLaunch={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders skills sorted by useCount descending", () => {
    const skills = [
      { name: "legal-nda", displayName: "NDA", categoryColor: "red", useCount: 3 },
      { name: "legal-review", displayName: "Review", categoryColor: "red", useCount: 10 },
      { name: "asi-briefing", displayName: "Briefing", categoryColor: "indigo", useCount: 1 },
    ];
    render(
      <FrequentSkills skills={skills} onLaunch={vi.fn()} />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Review");
    expect(buttons[1]).toHaveTextContent("NDA");
    expect(buttons[2]).toHaveTextContent("Briefing");
  });

  it("limits to 6 skills maximum", () => {
    const skills = Array.from({ length: 10 }, (_, i) => ({
      name: `skill-${i}`,
      displayName: `Skill ${i}`,
      categoryColor: "gray",
      useCount: 10 - i,
    }));
    render(
      <FrequentSkills skills={skills} onLaunch={vi.fn()} />
    );
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("renders displayName on buttons", () => {
    const skills = [
      { name: "legal-nda", displayName: "NDA Generator", categoryColor: "red", useCount: 5 },
    ];
    render(
      <FrequentSkills skills={skills} onLaunch={vi.fn()} />
    );
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
  });
});
