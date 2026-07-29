/**
 * GlobalSwapContext.test.tsx — 103-18-T1 (gap closure: WR-01).
 *
 * Unit-level coverage for `GlobalSwapProvider`/`useGlobalSwap` in isolation from `BrainPicker`'s
 * own wiring — the end-to-end proof that real `BrainPicker` hosts drive this same provider
 * correctly (including the WR-01 reproduction itself and the 103-14 restore-through-hoisting
 * check) lives in `BrainPicker.test.tsx`'s "103-18" describe blocks instead, per this plan's own
 * requirement that at least one test exercise the REAL `GlobalSwapModal`. `GlobalSwapModal` is
 * mocked here to a plain marker so these tests assert purely on the PROVIDER's own contract —
 * instance count, mount surviving a consumer unmounting, and the selection nonce — without
 * depending on `GlobalSwapModal`'s internal phase/outcome logic (already covered by
 * `GlobalSwapModal.test.tsx`).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GlobalSwapProvider, useGlobalSwap } from "./GlobalSwapContext";
import type { GlobalSwapProfile } from "@/components/brains/GlobalSwapModal";
import type { CatalogueEntry } from "@/lib/brainsApi";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/components/brains/GlobalSwapModal", () => ({
  GlobalSwapModal: (props: {
    target: { id: string; name: string };
    profiles: unknown[];
    open: boolean;
    onOpenChange: (next: boolean) => void;
    selectionNonce: number;
  }) => (
    <div
      data-testid="global-swap-modal-marker"
      data-target-id={props.target.id}
      data-open={props.open ? "true" : "false"}
      data-selection-nonce={props.selectionNonce}
      data-profile-count={props.profiles.length}
    >
      <button type="button" onClick={() => props.onOpenChange(false)}>
        mock-close
      </button>
    </div>
  ),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function fixtureEntry(id: string): CatalogueEntry {
  return { id, name: id, vendor: "", group: "api", billing: "api", costTier: "normal" };
}

const ONE_PROFILE: GlobalSwapProfile[] = [
  {
    profileId: "assistant-default",
    currentModel: "prior-model",
    currentModelDisplayName: "Prior Model",
    mode: "inherited",
    hasConfiguredDefault: false,
  },
];

/** Stand-in for a `BrainPicker` host (`BrainHeaderBadge` / the Chat composer pill) — calls
 * `openGlobalSwap` directly on click, exactly what `BrainPicker.handleSelect`'s global branch
 * does after 103-18. */
function Opener({ id, label }: { id: string; label: string }) {
  const { openGlobalSwap } = useGlobalSwap();
  return (
    <button type="button" onClick={() => openGlobalSwap(fixtureEntry(id), ONE_PROFILE)}>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------

describe("GlobalSwapProvider — exactly one modal instance app-wide (103-18, WR-01)", () => {
  it("renders exactly one GlobalSwapModal even with two independent host consumers mounted", () => {
    render(
      <GlobalSwapProvider>
        <Opener id="codex-cli" label="open-from-header-badge" />
        <Opener id="grok" label="open-from-chat-pill" />
      </GlobalSwapProvider>
    );

    // Neither host has requested a swap yet -- the provider mounts nothing.
    expect(screen.queryByTestId("global-swap-modal-marker")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-from-chat-pill" }));
    expect(screen.getAllByTestId("global-swap-modal-marker")).toHaveLength(1);
    expect(screen.getByTestId("global-swap-modal-marker")).toHaveAttribute(
      "data-target-id",
      "grok"
    );

    // The OTHER host requests a swap too -- still exactly one instance; the target is replaced,
    // never a second modal mounted alongside it (103-CONTRACT.md §8: no second dispatch path).
    fireEvent.click(screen.getByRole("button", { name: "open-from-header-badge" }));
    expect(screen.getAllByTestId("global-swap-modal-marker")).toHaveLength(1);
    expect(screen.getByTestId("global-swap-modal-marker")).toHaveAttribute(
      "data-target-id",
      "codex-cli"
    );
  });
});

describe("GlobalSwapProvider — mount survives a consumer unmounting (103-18, WR-01: route-change simulation)", () => {
  it("keeps the modal instance mounted and open after the requesting consumer unmounts", () => {
    const { rerender } = render(
      <GlobalSwapProvider>
        <Opener id="codex-cli" label="open" />
      </GlobalSwapProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByTestId("global-swap-modal-marker")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("global-swap-modal-marker")).toHaveAttribute(
      "data-target-id",
      "codex-cli"
    );

    // Simulate a route change: the requesting host unmounts. `GlobalSwapProvider` itself stays --
    // React reconciles it as the same element at the same position across this rerender, exactly
    // as it does across a real React Router nested-route navigation (`DashboardLayout`, the actual
    // provider's mount point, is never remounted by a child route change under its <Outlet/>).
    rerender(
      <GlobalSwapProvider>
        <div>picker unmounted</div>
      </GlobalSwapProvider>
    );

    expect(screen.getByTestId("global-swap-modal-marker")).toBeInTheDocument();
    expect(screen.getByTestId("global-swap-modal-marker")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("global-swap-modal-marker")).toHaveAttribute(
      "data-target-id",
      "codex-cli"
    );
  });

  it("bumps selectionNonce on every openGlobalSwap call, including a repeat request for the same target (103-16/CR-01)", () => {
    render(
      <GlobalSwapProvider>
        <Opener id="codex-cli" label="open" />
      </GlobalSwapProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    const firstNonce = screen
      .getByTestId("global-swap-modal-marker")
      .getAttribute("data-selection-nonce");
    expect(firstNonce).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "mock-close" }));
    fireEvent.click(screen.getByRole("button", { name: "open" })); // same target id, again

    const secondNonce = screen
      .getByTestId("global-swap-modal-marker")
      .getAttribute("data-selection-nonce");
    expect(secondNonce).not.toBe(firstNonce);
  });
});

describe("useGlobalSwap — provider boundary", () => {
  it("throws when called outside a GlobalSwapProvider", () => {
    function Bare() {
      useGlobalSwap();
      return null;
    }
    // Suppress the expected React error-boundary console noise for this one deliberate throw.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(
      "useGlobalSwap must be used within a GlobalSwapProvider"
    );
    spy.mockRestore();
  });
});
