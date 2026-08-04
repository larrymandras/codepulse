/**
 * RunTargetChooser test (Phase 99 Plan 04, LAUNCH-04, D-01).
 *
 * Covers the `useRunLaunch` hook's dispatch/navigation contract, the
 * presentational `RunTargetItems` list (labels + last-pick checkmark), and
 * the standalone `RunTargetChooser` dropdown wiring.
 *
 * ForgeLaunchModal is mocked to a lightweight open/closed stub (its own
 * behavior is covered by ForgeLaunchModal.test.tsx and
 * SkillLaunchProvider.test.tsx) — this suite only asserts that picking
 * "forge" routes through the shared SkillLaunchProvider context. convex/react
 * is mocked because SkillLaunchProvider calls useMutation directly.
 * react-router's useNavigate is spied (actual module preserved) so
 * MemoryRouter still works for anything else in the tree.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Radix DropdownMenu/Popover use ResizeObserver internally — jsdom doesn't
// provide it (same shim as RunChatPopover.test.tsx / SkillLifecycleMenu.test.tsx).
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
vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>(
      "react-router"
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

import {
  useRunLaunch,
  RunTargetItems,
  RunTargetChooser,
  type DeckSkillLike,
} from "./RunTargetChooser";
import { SkillLaunchProvider } from "./SkillLaunchProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import type { RunTarget } from "@/lib/skillRun";

/** RunTargetItems renders DropdownMenuItems — Radix requires a Menu ancestor. */
function renderItems(lastTarget: RunTarget, onPick: (t: RunTarget) => void) {
  return render(
    <DropdownMenu open>
      <DropdownMenuContent forceMount>
        <RunTargetItems lastTarget={lastTarget} onPick={onPick} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const TEST_SKILL: DeckSkillLike = { name: "x", displayName: "X Skill" };

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <SkillLaunchProvider>{ui}</SkillLaunchProvider>
    </MemoryRouter>
  );
}

function Harness({ skill = TEST_SKILL }: { skill?: DeckSkillLike }) {
  const launch = useRunLaunch(skill);
  return (
    <div>
      <div data-testid="chat-open">{String(launch.chatOpen)}</div>
      <div data-testid="astridr-open">{String(launch.astridrOpen)}</div>
      <div data-testid="last-target">{launch.lastTarget}</div>
      <button onClick={() => launch.pick("chat")}>pick-chat</button>
      <button onClick={() => launch.pick("forge")}>pick-forge</button>
      <button onClick={() => launch.pick("astridr")}>pick-astridr</button>
      <button onClick={() => launch.submitChat("/x 1")}>submit-chat</button>
      <button onClick={() => launch.submitAstridr("/x 1", "business")}>
        submit-astridr
      </button>
    </div>
  );
}

describe("RunTargetItems", () => {
  it("Test 1: renders 3 rows with the exact labels", () => {
    renderItems("chat", () => {});
    expect(screen.getByText("Send to Chat")).toBeInTheDocument();
    expect(screen.getByText("Launch as Forge Agent")).toBeInTheDocument();
    expect(screen.getByText("Dispatch to Ástríðr")).toBeInTheDocument();
  });

  it("Test 2: only the row matching lastTarget renders a checkmark + text-primary tint", () => {
    renderItems("astridr", () => {});

    const astridrItem = screen.getByTestId("run-target-item-astridr");
    expect(astridrItem).toHaveClass("text-primary");
    expect(
      astridrItem.querySelector('[data-testid="run-target-check"]')
    ).toBeInTheDocument();

    const chatItem = screen.getByTestId("run-target-item-chat");
    expect(chatItem).not.toHaveClass("text-primary");
    expect(
      chatItem.querySelector('[data-testid="run-target-check"]')
    ).not.toBeInTheDocument();

    const forgeItem = screen.getByTestId("run-target-item-forge");
    expect(forgeItem).not.toHaveClass("text-primary");
    expect(
      forgeItem.querySelector('[data-testid="run-target-check"]')
    ).not.toBeInTheDocument();
  });
});

describe("useRunLaunch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("Test 3: pick() dispatches per target (forge -> launchForge/context, chat/astridr -> local popover open)", () => {
    renderWithProvider(<Harness />);

    fireEvent.click(screen.getByText("pick-chat"));
    expect(screen.getByTestId("chat-open").textContent).toBe("true");
    expect(screen.getByTestId("last-target").textContent).toBe("chat");

    fireEvent.click(screen.getByText("pick-astridr"));
    expect(screen.getByTestId("astridr-open").textContent).toBe("true");
    expect(screen.getByTestId("last-target").textContent).toBe("astridr");

    fireEvent.click(screen.getByText("pick-forge"));
    expect(screen.getByTestId("forge-modal-stub")).toHaveAttribute(
      "data-open",
      "true"
    );
    expect(screen.getByTestId("last-target").textContent).toBe("forge");
  });

  it("Test 4: submitChat navigates without a profile key; submitAstridr includes profile", () => {
    renderWithProvider(<Harness />);

    fireEvent.click(screen.getByText("submit-chat"));
    expect(mockNavigate).toHaveBeenCalledWith("/chat", {
      state: { autoSend: { text: "/x 1", skillName: "x" } },
    });

    mockNavigate.mockClear();

    fireEvent.click(screen.getByText("submit-astridr"));
    expect(mockNavigate).toHaveBeenCalledWith("/chat", {
      state: {
        autoSend: { text: "/x 1", skillName: "x", profile: "business" },
      },
    });
  });
});

describe("RunTargetChooser (standalone)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("Test 5: clicking the trigger opens the dropdown; picking Chat opens RunChatPopover", async () => {
    renderWithProvider(
      <RunTargetChooser skill={TEST_SKILL}>
        <button type="button">Trigger</button>
      </RunTargetChooser>
    );

    // Radix's DropdownMenuTrigger opens on pointerdown (not click) — mirror
    // that exact event so the menu content actually mounts (same convention
    // as SkillLifecycleMenu.test.tsx's openMenu()).
    fireEvent.pointerDown(screen.getByText("Trigger"), {
      button: 0,
      ctrlKey: false,
    });

    const chatItem = await screen.findByText("Send to Chat");
    fireEvent.click(chatItem);

    expect(await screen.findByText("Run X Skill")).toBeInTheDocument();
  });
});
