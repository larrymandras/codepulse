import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SkillRow } from "./SkillRow";
import { SkillLaunchProvider } from "./SkillLaunchProvider";
import { DORMANT_ORIGIN } from "@/lib/skills";

// Phase 98: SkillRow now always renders SkillLifecycleMenu, which calls
// useQuery/useMutation (host list, lifecycle commands, enqueueLifecycle) —
// stub convex/react so these tests don't need a real ConvexProvider. The
// menu's own behavior is covered by SkillLifecycleMenu.test.tsx.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
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

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
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
});
