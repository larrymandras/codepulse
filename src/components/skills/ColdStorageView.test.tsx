/**
 * ColdStorageView test (Phase 98 Plan 04) — jsdom render assertions.
 *
 * Covers:
 *  - refreshed copy: no more "/manage-skills" terminal instruction, points
 *    to the row ⋯ menu instead
 *  - dormant rows render via SkillRow, which now carries the ⋯ menu
 *  - empty state still renders when no skills match
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ColdStorageView } from "./ColdStorageView";
import { DORMANT_ORIGIN } from "@/lib/skills";
import type { RowSkill } from "./SkillRow";

// ColdStorageView renders SkillRow, which now always renders
// SkillLifecycleMenu (useQuery/useMutation) — stub convex/react so this
// suite doesn't need a real ConvexProvider. The menu's own behavior is
// covered by SkillLifecycleMenu.test.tsx.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

const dormantSkill: RowSkill = {
  name: "cold-tool",
  displayName: "Cold Tool",
  description: "A dormant skill",
  overrideDescription: null,
  favorite: false,
  origins: [DORMANT_ORIGIN],
  useCount: 0,
};

const handlers = () => ({
  onRecordUse: vi.fn(),
  onOpenInChat: vi.fn(),
  onEdit: vi.fn(),
  onToggleFavorite: vi.fn(),
});

describe("ColdStorageView", () => {
  it("no longer instructs the operator to run /manage-skills in a terminal", () => {
    render(<ColdStorageView skills={[dormantSkill]} {...handlers()} />);
    expect(screen.queryByText(/\/manage-skills/i)).not.toBeInTheDocument();
  });

  it("points to the row's ⋯ menu for restore/delete", () => {
    render(<ColdStorageView skills={[dormantSkill]} {...handlers()} />);
    expect(
      screen.getByText(/Use the ⋯ menu on a row to restore or permanently delete it\./i)
    ).toBeInTheDocument();
  });

  it("renders each dormant skill's row with its ⋯ lifecycle menu", () => {
    render(<ColdStorageView skills={[dormantSkill]} {...handlers()} />);
    expect(screen.getByText("Cold Tool")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Skill actions for Cold Tool" })
    ).toBeInTheDocument();
  });

  it("shows the empty state when no skills match", () => {
    render(<ColdStorageView skills={[]} {...handlers()} />);
    expect(screen.getByText("[ NO SKILLS MATCH ]")).toBeInTheDocument();
  });

  it("shows the dormant count badge", () => {
    render(<ColdStorageView skills={[dormantSkill]} {...handlers()} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
