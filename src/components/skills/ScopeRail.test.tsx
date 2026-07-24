/**
 * ScopeRail test (Plan 100-03, UX-02/D-01/D-02) — jsdom render assertions.
 *
 * Mocks @/hooks/usePendingLifecycleMoves's useDraggingSkill to inject the
 * currently-dragged skill (no ConvexProvider/router needed — ScopeRail is
 * pure presentation + event forwarding).
 *
 * Covers:
 *  - all three entries render with correct labels even when counts are zero
 *  - valid drag-over highlight (active-global skill -> Cold Storage)
 *  - invalid drag-over highlight + inline reject hint (dormant skill -> Project)
 *  - no-op drag-over (own-scope) shows NO highlight (honest, no fake feedback)
 *  - dragOver/drop forward to the parent with e.preventDefault()
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScopeRail } from "./ScopeRail";
import type { SkillLike } from "@/lib/skills";

const mockSetDraggingSkill = vi.fn();

vi.mock("@/hooks/usePendingLifecycleMoves", () => ({
  useDraggingSkill: vi.fn(),
}));

import { useDraggingSkill } from "@/hooks/usePendingLifecycleMoves";
const mockUseDraggingSkill = vi.mocked(useDraggingSkill);

function renderRail(overrides: Partial<React.ComponentProps<typeof ScopeRail>> = {}) {
  const props = {
    dropTargetScope: null,
    onDragOverScope: vi.fn(),
    onDragLeaveScope: vi.fn(),
    onDropOnScope: vi.fn(),
    ...overrides,
  };
  const utils = render(<ScopeRail {...props} />);
  return { ...utils, props };
}

const activeGlobalSkill: SkillLike = { name: "legal-nda", origins: ["claude-code"] };
const dormantSkill: SkillLike = { name: "old-skill", origins: ["claude-code:available"] };
// Shadowed = dormant copy + a live active copy. Dragged from the Cold Storage
// lane it must resolve as dormant (CR-02).
const shadowedSkill: SkillLike = {
  name: "legal",
  origins: ["claude-code:available", "claude-code"],
};

describe("ScopeRail", () => {
  beforeEach(() => {
    mockUseDraggingSkill.mockReturnValue({
      draggingSkill: null,
      draggingLane: "active",
      setDraggingSkill: mockSetDraggingSkill,
    });
  });

  it("renders three always-visible entries with correct labels, regardless of count", () => {
    renderRail();
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("Cold Storage")).toBeInTheDocument();
  });

  it("shows the valid primary highlight when an active-global skill drags over Cold Storage", () => {
    mockUseDraggingSkill.mockReturnValue({
      draggingSkill: activeGlobalSkill,
      draggingLane: "active",
      setDraggingSkill: mockSetDraggingSkill,
    });
    const { container } = renderRail({ dropTargetScope: "cold" });
    const coldEntry = container.querySelector('[data-scope="cold"]')!;
    expect(coldEntry.className).toContain("bg-primary/30");
    expect(coldEntry.className).toContain("border-primary");
    expect(coldEntry.className).toContain("shadow-[var(--glow-sm)]");
  });

  it("shows the destructive not-allowed highlight + inline hint when a dormant skill drags over Project", () => {
    mockUseDraggingSkill.mockReturnValue({
      draggingSkill: dormantSkill,
      draggingLane: "active",
      setDraggingSkill: mockSetDraggingSkill,
    });
    const { container } = renderRail({ dropTargetScope: "project" });
    const projectEntry = container.querySelector('[data-scope="project"]')!;
    expect(projectEntry.className).toContain("cursor-not-allowed");
    expect(projectEntry.className).toContain("border-destructive/40");
    expect(screen.getByText("Restore to Global first, then move.")).toBeInTheDocument();
  });

  it("shows NO highlight for a no-op (own-scope) drag-over — honest, no fake feedback", () => {
    mockUseDraggingSkill.mockReturnValue({
      draggingSkill: activeGlobalSkill,
      draggingLane: "active",
      setDraggingSkill: mockSetDraggingSkill,
    });
    const { container } = renderRail({ dropTargetScope: "global" });
    const globalEntry = container.querySelector('[data-scope="global"]')!;
    expect(globalEntry.className).not.toContain("border-primary");
    expect(globalEntry.className).not.toContain("border-destructive");
    expect(globalEntry.className).toContain("border-transparent");
  });

  it("threads the origin lane: a shadowed row dragged from Cold Storage over Cold Storage shows NO valid highlight — resolves as a no-op, not a destructive archive (CR-02)", () => {
    mockUseDraggingSkill.mockReturnValue({
      draggingSkill: shadowedSkill,
      draggingLane: "cold",
      setDraggingSkill: mockSetDraggingSkill,
    });
    const { container } = renderRail({ dropTargetScope: "cold" });
    const coldEntry = container.querySelector('[data-scope="cold"]')!;
    // lane="cold" → resolveScopeDrop returns { kind: "noop" }. Under the old
    // default-"active" lane it would resolve to an ARCHIVE of the live active
    // copy and paint the valid highlight — the exact CR-02 regression.
    expect(coldEntry.className).not.toContain("bg-primary/30");
    expect(coldEntry.className).toContain("border-transparent");
  });

  it("forwards dragOver and drop to the parent, calling preventDefault", () => {
    const onDragOverScope = vi.fn();
    const onDropOnScope = vi.fn();
    const { container } = renderRail({ onDragOverScope, onDropOnScope });
    const globalEntry = container.querySelector('[data-scope="global"]')!;

    const dragOverNotCancelled = fireEvent.dragOver(globalEntry, { dataTransfer: {} });
    expect(onDragOverScope).toHaveBeenCalledWith("global");
    expect(dragOverNotCancelled).toBe(false); // preventDefault() was called

    const dropNotCancelled = fireEvent.drop(globalEntry, { dataTransfer: {} });
    expect(onDropOnScope).toHaveBeenCalledWith("global", expect.anything());
    expect(dropNotCancelled).toBe(false); // preventDefault() was called
  });
});
