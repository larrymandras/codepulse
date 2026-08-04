/**
 * SkillsInCategory test (Plan 100-05, UX-01 completeness audit) — no test
 * file existed for this row surface before this plan; added to close the
 * ⋯ menu-consistency gap alongside AllSkillsOverview/ColdStorageView.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SkillsInCategory } from "./SkillsInCategory";
import { SkillLaunchProvider } from "./SkillLaunchProvider";
import type { RowSkill } from "./SkillRow";

// SkillsInCategory renders SkillRow, which always renders
// SkillLifecycleMenu (useQuery/useMutation) — stub convex/react so this
// suite doesn't need a real ConvexProvider. The menu's own behavior is
// covered by SkillLifecycleMenu.test.tsx.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

// SkillLifecycleMenu's always-on Run submenu (D-02) resolves useRunLaunch ->
// useSkillLaunch, which requires SkillLaunchProvider + a router context.
vi.mock("@/components/forge/ForgeLaunchModal", () => ({
  ForgeLaunchModal: (props: { open: boolean }) => (
    <div data-testid="forge-modal-stub" data-open={String(props.open)} />
  ),
}));

function renderCategory(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <SkillLaunchProvider>{ui}</SkillLaunchProvider>
    </MemoryRouter>
  );
}

const categories = [
  { name: "legal", displayName: "Legal", icon: "⚖️", color: "red" },
  { name: "gsd", displayName: "Project Management", icon: "📋", color: "indigo" },
];

const skill: RowSkill = {
  name: "legal-nda",
  displayName: "NDA Generator",
  description: "Generate NDAs",
  overrideDescription: null,
  favorite: false,
  origins: ["claude-code"],
  useCount: 3,
};

const handlers = () => ({
  onBack: vi.fn(),
  onEditSkill: vi.fn(),
  onReassignSkill: vi.fn(),
  onToggleFavorite: vi.fn(),
});

describe("SkillsInCategory", () => {
  it("UX-01 audit: each row hosts the scope-gated ⋯ lifecycle menu", () => {
    renderCategory(
      <SkillsInCategory
        categoryName="legal"
        categoryDisplayName="Legal"
        categoryIcon="⚖️"
        categoryColor="red"
        skills={[skill]}
        categories={categories}
        {...handlers()}
      />
    );
    expect(screen.getByRole("button", { name: "Skill actions for NDA Generator" })).toBeInTheDocument();
  });

  it("back button invokes onBack", () => {
    const h = handlers();
    renderCategory(
      <SkillsInCategory
        categoryName="legal"
        categoryDisplayName="Legal"
        categoryIcon="⚖️"
        categoryColor="red"
        skills={[skill]}
        categories={categories}
        {...h}
      />
    );
    fireEvent.click(screen.getByLabelText("Back"));
    expect(h.onBack).toHaveBeenCalled();
  });

  it("renders the terminal empty state when no skills match", () => {
    renderCategory(
      <SkillsInCategory
        categoryName="legal"
        categoryDisplayName="Legal"
        categoryIcon="⚖️"
        categoryColor="red"
        skills={[]}
        categories={categories}
        {...handlers()}
      />
    );
    expect(screen.getByText("[ NO SKILLS FOUND IN SECTOR ]")).toBeInTheDocument();
  });

  it("dropping a skill on another category's move target calls onReassignSkill", () => {
    const h = handlers();
    renderCategory(
      <SkillsInCategory
        categoryName="legal"
        categoryDisplayName="Legal"
        categoryIcon="⚖️"
        categoryColor="red"
        skills={[skill]}
        categories={categories}
        {...h}
      />
    );
    const target = screen.getByTitle("Drop to move to Project Management");
    fireEvent.drop(target, { dataTransfer: { getData: () => "legal-nda" } });
    expect(h.onReassignSkill).toHaveBeenCalledWith("legal-nda", "gsd");
  });
});
