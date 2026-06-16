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

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Convex react bindings — useQuery returns workspaces, useMutation a no-op.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock the host hook so the picker renders an online host (not the Skeleton).
vi.mock("@/hooks/useForge", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useForge")>(
    "@/hooks/useForge"
  );
  return {
    ...actual,
    useForgeHosts: vi.fn(() => [
      { hostId: "desktop", lastSeenAt: Date.now(), hostname: "Desktop" },
    ]),
  };
});

import { ForgeLaunchModal } from "./ForgeLaunchModal";

const noop = () => {};

function renderModal() {
  return render(
    <ForgeLaunchModal
      open={true}
      onClose={noop}
      onLaunched={noop}
      onLaunchFailed={noop}
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
