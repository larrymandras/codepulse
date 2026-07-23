/**
 * QuickDeck test (Phase 99 Plan 05, LAUNCH-04, D-03/D-13).
 *
 * Primary chip click now opens the Run target chooser (Plan 04's
 * RunTargetChooser) rather than copying — copy is demoted to a secondary
 * hover-reveal icon that no longer records a launch (D-13, onUse is gone).
 * The passive "open in chat" hover affordance is retired (onOpenInChat is
 * gone) — superseded by the Chat target inside the chooser.
 *
 * RunTargetChooser needs SkillLaunchProvider (context) + a router
 * (useNavigate) to render — mirrors RunTargetChooser.test.tsx's own harness
 * conventions (ForgeLaunchModal stubbed, react-router-dom's useNavigate
 * spied with the actual module otherwise preserved).
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QuickDeck } from "./QuickDeck";
import { SkillLaunchProvider } from "./SkillLaunchProvider";
import { DORMANT_ORIGIN } from "@/lib/skills";

// Radix DropdownMenu/Popover use ResizeObserver internally — jsdom doesn't
// provide it (same shim as RunTargetChooser.test.tsx / SkillLifecycleMenu.test.tsx).
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom"
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@/components/forge/ForgeLaunchModal", () => ({
  ForgeLaunchModal: (props: { open: boolean }) => (
    <div data-testid="forge-modal-stub" data-open={String(props.open)} />
  ),
}));

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  mockNavigate.mockClear();
  window.localStorage.clear();
});

const skills = [
  { name: "gsd-code-review", displayName: "Code Review", categoryIcon: "📋", origins: ["claude-code"], useCount: 11, favorite: false },
  { name: "legal-nda", displayName: "NDA", categoryIcon: "⚖️", origins: ["claude-code"], useCount: 3, favorite: true, command: "/legal nda <file>" },
  { name: "cold-thing", displayName: "Cold", categoryIcon: "⚡", origins: [DORMANT_ORIGIN], useCount: 99, favorite: true },
  { name: "never-used", displayName: "Never", categoryIcon: "⚡", origins: ["claude-code"], useCount: 0, favorite: false },
];

const noop = () => {};

function renderDeck(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <SkillLaunchProvider>{ui}</SkillLaunchProvider>
    </MemoryRouter>
  );
}

describe("QuickDeck", () => {
  it("pins favorites first, excludes dormant and never-used non-favorites", () => {
    renderDeck(<QuickDeck skills={skills} onToggleFavorite={noop} />);
    const chips = screen.getAllByTestId("deck-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("/legal nda");
    expect(chips[1]).toHaveTextContent("/gsd-code-review");
    expect(screen.queryByText(/cold-thing/)).toBeNull();
  });

  it("clicking a chip opens the Run target chooser (D-03) instead of copying", async () => {
    renderDeck(<QuickDeck skills={skills} onToggleFavorite={noop} />);
    // Radix's DropdownMenuTrigger opens on pointerdown (not click) — mirror
    // that exact event (same convention as RunTargetChooser.test.tsx).
    fireEvent.pointerDown(screen.getAllByTestId("deck-chip")[1], {
      button: 0,
      ctrlKey: false,
    });
    expect(await screen.findByText("Send to Chat")).toBeInTheDocument();
    expect(screen.getByText("Launch as Forge Agent")).toBeInTheDocument();
    expect(screen.getByText("Dispatch to Ástríðr")).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("clicking the secondary Copy icon writes the clipboard and records nothing", async () => {
    renderDeck(<QuickDeck skills={skills} onToggleFavorite={noop} />);
    screen.getByLabelText("Copy invocation for legal-nda").click();
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/legal nda"));
    await waitFor(() => expect(screen.getByText("copied")).toBeTruthy());
    // D-13: no recordSkillLaunch/onUse hook exists on QuickDeck any more —
    // there is nothing left to assert was NOT called except the absence of
    // the prop itself (QuickDeckProps has no onUse), which tsc enforces.
  });

  it("says 'copy failed' when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    renderDeck(<QuickDeck skills={skills} onToggleFavorite={noop} />);
    screen.getByLabelText("Copy invocation for gsd-code-review").click();
    await waitFor(() => expect(screen.getByText("copy failed")).toBeTruthy());
  });

  it("the favorite toggle still fires and does not copy", () => {
    const onToggleFavorite = vi.fn();
    renderDeck(<QuickDeck skills={skills} onToggleFavorite={onToggleFavorite} />);
    screen.getByLabelText("Toggle favorite legal-nda").click();
    expect(onToggleFavorite).toHaveBeenCalledWith("legal-nda");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("renders nothing when the deck is empty", () => {
    renderDeck(
      <QuickDeck
        skills={[{ name: "a", displayName: "A", categoryIcon: "⚡", origins: ["claude-code"], useCount: 0, favorite: false }]}
        onToggleFavorite={noop}
      />
    );
    // QuickDeck itself renders null when the deck is empty — assert its own
    // "Command deck" section is absent (a sibling ForgeLaunchModal stub from
    // SkillLaunchProvider is expected to be in the tree regardless).
    expect(screen.queryByLabelText("Command deck")).toBeNull();
  });
});
