import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SkillRow } from "./SkillRow";
import { SkillLaunchProvider } from "./SkillLaunchProvider";
import { DORMANT_ORIGIN } from "@/lib/skills";
import { usePendingMove, useDraggingSkill } from "@/hooks/usePendingLifecycleMoves";

// Phase 98: SkillRow now always renders SkillLifecycleMenu, which calls
// useQuery/useMutation (host list, lifecycle commands, enqueueLifecycle) —
// stub convex/react so these tests don't need a real ConvexProvider. The
// menu's own behavior is covered by SkillLifecycleMenu.test.tsx.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

// Plan 100-05: SkillRow reads the pending overlay + dragging-skill setter
// from context via these two hooks — mocked directly so tests don't need a
// real SkillControlSurfaceProvider.
vi.mock("@/hooks/usePendingLifecycleMoves", () => ({
  usePendingMove: vi.fn(),
  useDraggingSkill: vi.fn(),
}));

// Phase 99: SkillLifecycleMenu's always-on Run submenu (D-02) resolves
// useRunLaunch -> useSkillLaunch, which requires SkillLaunchProvider + a
// router context (useNavigate) — every render site needs both now, mirroring
// SkillLifecycleMenu.test.tsx's own convention.
vi.mock("@/components/forge/ForgeLaunchModal", () => ({
  ForgeLaunchModal: (props: { open: boolean }) => (
    <div data-testid="forge-modal-stub" data-open={String(props.open)} />
  ),
}));

function renderRow(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <SkillLaunchProvider>{ui}</SkillLaunchProvider>
    </MemoryRouter>
  );
}

const writeText = vi.fn();
const setDraggingSkill = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  setDraggingSkill.mockReset();
  vi.mocked(usePendingMove).mockReturnValue(undefined);
  vi.mocked(useDraggingSkill).mockReturnValue({
    draggingSkill: null,
    draggingLane: "active",
    setDraggingSkill,
  });
});

const skill = {
  name: "legal-nda",
  displayName: "NDA Generator",
  description: "Generate NDAs",
  overrideDescription: null,
  origins: ["claude-code"],
  useCount: 5,
  favorite: false,
};

const handlers = () => ({
  onEdit: vi.fn(),
  onToggleFavorite: vi.fn(),
});

describe("SkillRow", () => {
  it("copy copies the invocation and shows Copied, without recording a launch (D-13)", async () => {
    // D-13: SkillRowProps has no onRecordUse — there is nothing to call, and
    // this render (with only onEdit/onToggleFavorite) proves copy needs no
    // recording handler to function.
    const h = handlers();
    renderRow(<SkillRow skill={skill} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/legal-nda"));
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
  });

  it("shows Failed when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const h = handlers();
    renderRow(<SkillRow skill={skill} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(screen.getByText("Failed")).toBeTruthy());
  });

  it("dormant skill renders a dormant badge and Dormant copy feedback", async () => {
    const h = handlers();
    renderRow(<SkillRow skill={{ ...skill, origins: [DORMANT_ORIGIN] }} {...h} />);
    expect(screen.getByText("dormant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(screen.getByText("Dormant")).toBeTruthy());
  });

  it("secondary actions: edit, favorite (no inline chat button — retired D-13/Pitfall 1-2)", () => {
    const h = handlers();
    renderRow(<SkillRow skill={skill} {...h} />);
    expect(screen.queryByLabelText("Open legal-nda in Chat")).toBeNull();
    fireEvent.click(screen.getByLabelText("Edit legal-nda"));
    expect(h.onEdit).toHaveBeenCalledWith("legal-nda");
    fireEvent.click(screen.getByLabelText("Toggle favorite legal-nda"));
    expect(h.onToggleFavorite).toHaveBeenCalledWith("legal-nda");
  });

  it("sets the drag payload to the skill name", () => {
    const h = handlers();
    const { container } = renderRow(<SkillRow skill={skill} {...h} />);
    const row = container.querySelector('[data-skill="legal-nda"]')!;
    const setData = vi.fn();
    fireEvent.dragStart(row, { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith("text/plain", "legal-nda");
  });

  it("pending move (D-05): row gets opacity-70 and a pulsing --status-info indicator", () => {
    vi.mocked(usePendingMove).mockReturnValue({
      commandId: "cmd-1",
      action: "archive",
      destination: "cold",
    });
    const h = handlers();
    const { container } = renderRow(<SkillRow skill={skill} {...h} />);
    const row = container.querySelector('[data-skill="legal-nda"]')!;
    expect(row.className).toContain("opacity-70");
    const indicator = screen.getByTestId("pending-indicator");
    expect(indicator.className).toContain("bg-[var(--status-info)]");
    expect(indicator.className).toContain("animate-pulse");
  });

  it("no pending move: neither opacity-70 nor the pending indicator renders", () => {
    vi.mocked(usePendingMove).mockReturnValue(undefined);
    const h = handlers();
    const { container } = renderRow(<SkillRow skill={skill} {...h} />);
    const row = container.querySelector('[data-skill="legal-nda"]')!;
    expect(row.className).not.toContain("opacity-70");
    expect(screen.queryByTestId("pending-indicator")).toBeNull();
  });

  it("dormant (no pending) keeps opacity-50 distinct from the pending opacity-70", () => {
    vi.mocked(usePendingMove).mockReturnValue(undefined);
    const h = handlers();
    const { container } = renderRow(
      <SkillRow skill={{ ...skill, origins: [DORMANT_ORIGIN] }} {...h} />
    );
    const row = container.querySelector('[data-skill="legal-nda"]')!;
    expect(row.className).toContain("opacity-50");
    expect(row.className).not.toContain("opacity-70");
  });

  it("reports the dragged skill + default active lane on dragStart, clears on dragEnd", () => {
    const h = handlers();
    const { container } = renderRow(<SkillRow skill={skill} {...h} />);
    const row = container.querySelector('[data-skill="legal-nda"]')!;
    fireEvent.dragStart(row, {
      dataTransfer: { setData: vi.fn(), effectAllowed: "" },
    });
    // No lane prop → defaults "active" so resolveScopeDrop stays correct (CR-02).
    expect(setDraggingSkill).toHaveBeenCalledWith(skill, "active");
    fireEvent.dragEnd(row);
    expect(setDraggingSkill).toHaveBeenCalledWith(null);
  });

  it("threads lane=\"cold\" through dragStart so a Cold-Storage row resolves as dormant (CR-02)", () => {
    const h = handlers();
    const { container } = renderRow(<SkillRow skill={skill} lane="cold" {...h} />);
    const row = container.querySelector('[data-skill="legal-nda"]')!;
    fireEvent.dragStart(row, {
      dataTransfer: { setData: vi.fn(), effectAllowed: "" },
    });
    expect(setDraggingSkill).toHaveBeenCalledWith(skill, "cold");
  });

  it("shows no selection checkbox unless onToggleSelect is provided", () => {
    const h = handlers();
    renderRow(<SkillRow skill={skill} {...h} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("renders a checkbox and toggles selection without starting a drag (bulk-select)", () => {
    const h = handlers();
    const onToggleSelect = vi.fn();
    renderRow(<SkillRow skill={skill} {...h} onToggleSelect={onToggleSelect} />);
    const box = screen.getByRole("checkbox", { name: /select legal-nda/i });
    expect(box).toHaveAttribute("aria-checked", "false");
    fireEvent.click(box);
    expect(onToggleSelect).toHaveBeenCalledWith("legal-nda");
    // Clicking the checkbox must not fire a drag-start on the row.
    expect(setDraggingSkill).not.toHaveBeenCalled();
  });

  it("reflects the selected state on the checkbox", () => {
    const h = handlers();
    renderRow(<SkillRow skill={skill} {...h} selected onToggleSelect={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: /select legal-nda/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});
