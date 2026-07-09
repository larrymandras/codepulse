import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillReviewDrawer } from "./SkillReviewDrawer";
import { DORMANT_ORIGIN } from "@/lib/skills";

const categories = [
  { name: "sales", displayName: "Sales", icon: "üíº" },
  { name: "legal", displayName: "Legal", icon: "‚öñÔ∏è" },
];

const skills = [
  {
    name: "sales-icp",
    displayName: "sales-icp",
    description: "Build an ICP",
    origins: ["claude-code"],
    categoryName: "sales",
    categoryDisplayName: "Sales",
    categoryIcon: "üíº",
    isAutoAssigned: true,
    upstream: "https://github.com/zubair-trabzada/ai-sales-team-claude",
  },
  {
    name: "cold-skill",
    displayName: "cold-skill",
    description: "Dormant one",
    origins: [DORMANT_ORIGIN],
    categoryName: null,
    categoryDisplayName: null,
    categoryIcon: "‚ö°",
    isAutoAssigned: true,
    upstream: "unknown",
  },
];

const noop = vi.fn();

function setup(over = {}) {
  const props = {
    skills, categories,
    onAccept: vi.fn(), onMove: vi.fn(), onHide: vi.fn(),
    onAcceptAll: vi.fn(), onClose: vi.fn(),
    ...over,
  };
  render(<SkillReviewDrawer {...props} />);
  return props;
}

describe("SkillReviewDrawer", () => {
  it("is an accessible dialog listing the pending skills", () => {
    setup();
    expect(screen.getByRole("dialog", { name: /review auto-categorized skills/i })).toBeTruthy();
    expect(screen.getByText(/2 skills were categorized by prefix/i)).toBeTruthy();
    expect(screen.getByText("sales-icp")).toBeTruthy();
  });

  it("warns when a skill is dormant and when it has no upstream", () => {
    setup();
    expect(screen.getByText(/dormant, not loaded/i)).toBeTruthy();
    expect(screen.getByText(/no upstream, cannot check updates/i)).toBeTruthy();
  });

  it("accept, hide and accept-all fire with the right skill", () => {
    const props = setup();
    screen.getAllByRole("button", { name: /^accept$/i })[0].click();
    expect(props.onAccept).toHaveBeenCalledWith("sales-icp");

    screen.getAllByRole("button", { name: /^hide$/i })[1].click();
    expect(props.onHide).toHaveBeenCalledWith("cold-skill");

    screen.getByRole("button", { name: /accept all 2/i }).click();
    expect(props.onAcceptAll).toHaveBeenCalled();
  });

  it("shows an empty state and no accept-all when nothing is pending", () => {
    setup({ skills: [] });
    expect(screen.getByText(/nothing pending/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /accept all/i })).toBeNull();
  });

  it("close button invokes onClose", () => {
    const props = setup();
    screen.getByRole("button", { name: /^close$/i }).click();
    expect(props.onClose).toHaveBeenCalled();
  });
});

void noop;
