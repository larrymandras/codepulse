/**
 * ForgeLaunchModal test (Phase 80, FI-07) — jsdom render assertions.
 *
 * Asserts the trimmed-port contract:
 *  - Host picker present (D-08)
 *  - NO dangerous-mode control (D-06)
 *  - NO inline workspace-create control (D-07)
 *  - Agent / Workspace / Mode / Prompt fields present
 *
 * Convex hooks (useQuery/useMutation) and useForgeHosts are mocked so the modal
 * renders without a live backend (mirrors src/test/setup.ts conventions).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Convex react bindings — useQuery returns workspaces, useMutation a
// controllable mock (mockLaunch) so CR-02 tests can resolve/reject it.
const mockLaunch = vi.fn().mockResolvedValue(undefined);
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => mockLaunch),
}));

// Mock the host hook so the picker renders an online host (not the Skeleton).
vi.mock("@/hooks/useForge", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useForge")>(
    "@/hooks/useForge"
  );
  return {
    ...actual,
    // The modal consumes useForgeHostsRaw (undefined = loading, [] = no hosts).
    useForgeHostsRaw: vi.fn(() => [
      { hostId: "desktop", lastSeenAt: Date.now(), hostname: "Desktop" },
    ]),
  };
});

import { ForgeLaunchModal } from "./ForgeLaunchModal";

const noop = () => {};

function renderModal(props?: { open?: boolean; initialPrompt?: string }) {
  return render(
    <ForgeLaunchModal
      open={props?.open ?? true}
      onClose={noop}
      onLaunched={noop}
      onLaunchFailed={noop}
      initialPrompt={props?.initialPrompt}
    />
  );
}

describe("ForgeLaunchModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the modal title 'Launch Job'", () => {
    renderModal();
    // "Launch Job" appears as the DialogTitle AND the submit button (mode=goal).
    // The title is exposed as a heading-role element by Radix DialogTitle.
    const matches = screen.getAllByText("Launch Job");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(
      matches.some((el) => el.getAttribute("data-slot") === "dialog-title")
    ).toBe(true);
  });

  it("renders the Host picker (D-08)", () => {
    renderModal();
    expect(screen.getByLabelText("Host")).toBeInTheDocument();
  });

  it("renders the Agent picker", () => {
    renderModal();
    expect(screen.getByLabelText("Agent")).toBeInTheDocument();
  });

  it("renders the Workspace picker", () => {
    renderModal();
    expect(screen.getByLabelText("Workspace")).toBeInTheDocument();
  });

  it("renders the Mode segmented control (Goal / Chat)", () => {
    renderModal();
    expect(screen.getByText("Goal")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
  });

  it("renders the Prompt textarea", () => {
    renderModal();
    expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
  });

  it("has NO dangerous-mode control (D-06)", () => {
    renderModal();
    // No "Dangerous" text anywhere, and no dangerous-mode switch.
    expect(screen.queryByText(/dangerous/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/dangerous mode/i)).not.toBeInTheDocument();
  });

  it("has NO inline workspace-create control (D-07)", () => {
    renderModal();
    expect(screen.queryByText(/\+ New workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Create workspace/i)).not.toBeInTheDocument();
  });

  it("shows the no-workspaces empty-state copy when none exist", () => {
    renderModal();
    expect(
      screen.getByText("No workspaces synced from this host yet.")
    ).toBeInTheDocument();
  });
});

// ─── D-11: initialPrompt prop prefills the prompt textarea (Phase 99 Plan 01) ──

describe("ForgeLaunchModal — initialPrompt (D-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: renders with initialPrompt shows the prompt field prefilled", () => {
    renderModal({ initialPrompt: "/gsd-plan-phase 99" });
    expect(screen.getByLabelText("Prompt")).toHaveValue("/gsd-plan-phase 99");
  });

  it("Test 2: renders with open and NO initialPrompt shows an empty prompt field", () => {
    renderModal();
    expect(screen.getByLabelText("Prompt")).toHaveValue("");
  });

  it("Test 3: toggling open false→true re-applies initialPrompt", () => {
    const { rerender } = render(
      <ForgeLaunchModal
        open={false}
        onClose={noop}
        onLaunched={noop}
        onLaunchFailed={noop}
        initialPrompt="/gsd-discuss-phase 99"
      />
    );
    rerender(
      <ForgeLaunchModal
        open={true}
        onClose={noop}
        onLaunched={noop}
        onLaunchFailed={noop}
        initialPrompt="/gsd-discuss-phase 99"
      />
    );
    expect(screen.getByLabelText("Prompt")).toHaveValue("/gsd-discuss-phase 99");
  });
});

// ─── CR-02 (99-07): onLaunchConfirmed fires only after `await launch()` resolves ──
// onLaunched is the optimistic pre-await paint (fires immediately, before the
// mutation is even called) — it must never be conflated with confirmation.
// recordSkillLaunch (wired by the caller to onLaunchConfirmed) must never fire
// on a rejected enqueue.

describe("ForgeLaunchModal — onLaunchConfirmed (CR-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderAndSubmit(props: {
    onLaunched?: (row: unknown) => void;
    onLaunchFailed?: (commandId: string, message: string) => void;
    onLaunchConfirmed?: () => void;
  }) {
    render(
      <ForgeLaunchModal
        open={true}
        onClose={noop}
        onLaunched={props.onLaunched ?? noop}
        onLaunchFailed={props.onLaunchFailed ?? noop}
        onLaunchConfirmed={props.onLaunchConfirmed}
        initialPrompt="/x"
      />
    );
    fireEvent.click(screen.getByText("Launch Job", { selector: "button" }));
  }

  it("calls onLaunched (optimistic) immediately, BEFORE the mutation resolves", async () => {
    let resolveLaunch!: () => void;
    mockLaunch.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLaunch = resolve;
      })
    );
    const onLaunched = vi.fn();
    const onLaunchConfirmed = vi.fn();
    renderAndSubmit({ onLaunched, onLaunchConfirmed });

    await waitFor(() => expect(onLaunched).toHaveBeenCalledTimes(1));
    // Mutation is still pending — confirmation must NOT have fired yet.
    expect(onLaunchConfirmed).not.toHaveBeenCalled();

    resolveLaunch();
    await waitFor(() => expect(onLaunchConfirmed).toHaveBeenCalledTimes(1));
  });

  it("does NOT call onLaunchConfirmed when the mutation REJECTS — calls onLaunchFailed instead", async () => {
    mockLaunch.mockRejectedValue(new Error("enqueue failed"));
    const onLaunchFailed = vi.fn();
    const onLaunchConfirmed = vi.fn();
    renderAndSubmit({ onLaunchFailed, onLaunchConfirmed });

    await waitFor(() => expect(onLaunchFailed).toHaveBeenCalledTimes(1));
    expect(onLaunchConfirmed).not.toHaveBeenCalled();
  });

  it("calls onLaunchConfirmed exactly once when the mutation resolves", async () => {
    mockLaunch.mockResolvedValue(undefined);
    const onLaunchConfirmed = vi.fn();
    const onLaunchFailed = vi.fn();
    renderAndSubmit({ onLaunchConfirmed, onLaunchFailed });

    await waitFor(() => expect(onLaunchConfirmed).toHaveBeenCalledTimes(1));
    expect(onLaunchFailed).not.toHaveBeenCalled();
  });
});
