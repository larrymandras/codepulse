/**
 * GlobalSwapModal.test.tsx — 103-04-T2, rewritten 103-12-T1/T2 (gap closure: defect #5 + CR-03).
 *
 * Proves D-09 (informational-only confirm friction) and D-11 (pinned-default shadowed-count
 * disclosure, mode-preserving revert) against real fixture data — plus, new for this plan, the
 * §8-compliant single-axis dispatch and D-14/D-15 honest result reporting (defect #5) and the
 * CR-03 revert-survives-Done lifecycle fix.
 *
 * `useCommandDispatch` is mocked directly (asserts the live `swap.set` axis with
 * `toHaveBeenCalledWith` on the exact command object). `@/hooks/useResolvedBrain`'s
 * `useGlobalBrainOverride` is mocked directly (a plain mutable object + `rerender`, simulating the
 * server-pushed `swap.state` readback landing after the ack) — this is the D-14/D-15 confirmation
 * source per 103-12-PLAN.md's interfaces section. `@/lib/brainsApi` is ALSO mocked, even though the
 * component no longer imports it at all post-103-12 — this is deliberate: it is the anti-stub-
 * masking proof surface. `expect(mockDispatchSwap).not.toHaveBeenCalled()` asserted after every
 * dispatch test is the direct 103-CONTRACT.md §8 compliance check (no per-profile
 * `gateway.model.set` fan-out for the global axis) and would catch a regression that reintroduced
 * the fan-out this plan deletes.
 *
 * ── Moved/retired coverage from the pre-103-12 suite (per 103-12-PLAN.md's explicit instruction
 * to record this, not silently drop it) ──
 * The old suite asserted a `Promise.allSettled` per-profile fan-out (`gateway.model.set` dispatched
 * once per profile, a partial-failure fixture showing one row `ok` and one `error`, and a STUB chip
 * on per-profile result rows). That entire axis is deleted by 103-CONTRACT.md §8 — a global swap
 * never dispatches `gateway.model.set` at all, so there is no per-row partial-failure surface to
 * test anymore (D-12 applied to a one-command axis: one command has one outcome). Those assertions
 * are replaced below by the single-outcome-row tests in the "dispatch" describe block, and the old
 * "fires the live swap.set global override and the per-profile gateway.model.set fan-out" test is
 * replaced by "fires exactly the live swap.set command and never touches the deferred per-profile
 * fan-out." The STUB-chip-on-result-row test is retired outright — `BRAINS_STUB_ACTIVE` must never
 * render on this surface at all now (the global axis is live by definition, D-16 amendment), and a
 * dedicated test below asserts that directly.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogueEntry } from "@/lib/brainsApi";
import { GLOBAL_SWAP_CONFIRM_TIMEOUT_MS, GlobalSwapModal, type GlobalSwapProfile } from "./GlobalSwapModal";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn();
vi.mock("@/hooks/useCommandDispatch", () => ({
  useCommandDispatch: () => ({
    dispatch: (...args: unknown[]) => mockDispatch(...args),
    isConnected: true,
  }),
}));

// Mutable — reassigned per-test (never mutated in place) and re-read on every render, so a test can
// simulate the server-pushed swap.state readback landing by reassigning + calling `rerender`.
let mockGlobalOverride: { modelOverride: string | null; voiceOverride: string | null } = {
  modelOverride: null,
  voiceOverride: null,
};
vi.mock("@/hooks/useResolvedBrain", () => ({
  useGlobalBrainOverride: () => mockGlobalOverride,
}));

// Anti-stub-masking proof surface only — GlobalSwapModal.tsx imports NOTHING from this module
// post-103-12 (grep -c "brainsApi" returns 0), so `mockDispatchSwap` staying at zero calls across
// every test in this file is the direct 103-CONTRACT.md §8 compliance assertion.
const mockDispatchSwap = vi.fn();
vi.mock("@/lib/brainsApi", () => ({
  brainsApi: {
    isStub: true,
    dispatchSwap: (...args: unknown[]) => mockDispatchSwap(...args),
  },
  get BRAINS_STUB_ACTIVE() {
    return false;
  },
}));

const mockToastFn = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => mockToastFn(...args), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TARGET_NORMAL: CatalogueEntry = {
  id: "anthropic-sonnet-5",
  name: "Sonnet 5",
  vendor: "anthropic_direct",
  group: "api",
  billing: "api",
  costTier: "normal",
};

const TARGET_EXPENSIVE: CatalogueEntry = {
  id: "anthropic-opus-4-8",
  name: "Opus 4.8",
  vendor: "anthropic_direct",
  group: "api",
  billing: "api",
  costTier: "expensive",
};

const THREE_PROFILES: GlobalSwapProfile[] = [
  {
    profileId: "assistant-default",
    displayName: "Assistant",
    currentModel: "claude-cli-sonnet5",
    currentModelDisplayName: "Sonnet 5 (CLI)",
    mode: "pinned",
  },
  {
    profileId: "consulting",
    displayName: "Consulting",
    currentModel: "ollama-llama3",
    currentModelDisplayName: "Llama 3 (local)",
    mode: "inherited",
  },
  {
    profileId: "personal",
    displayName: "Personal",
    currentModel: "codex-cli",
    currentModelDisplayName: "Codex CLI",
    mode: "session",
  },
];

const TWO_OF_THREE_PINNED: GlobalSwapProfile[] = [
  { ...THREE_PROFILES[0], mode: "pinned" },
  { ...THREE_PROFILES[1], mode: "pinned" },
  { ...THREE_PROFILES[2], mode: "inherited" },
];

const ALL_PINNED: GlobalSwapProfile[] = THREE_PROFILES.map((p) => ({ ...p, mode: "pinned" }));
const NONE_PINNED: GlobalSwapProfile[] = THREE_PROFILES.map((p) => ({ ...p, mode: "inherited" }));

// 103-14: a global override already in force before this swap dispatches — every profile mirrors
// it (global override wins outright, 103-CONTRACT.md §9), which is also how the component resolves
// a display name for the value it captures to restore to.
const PRIOR_OVERRIDE_MODEL_ID = "claude-haiku-4-5-20251001";
const PRIOR_OVERRIDE_DISPLAY_NAME = "Haiku 4.5";

const PROFILES_UNDER_PRIOR_OVERRIDE: GlobalSwapProfile[] = THREE_PROFILES.map((p) => ({
  ...p,
  currentModel: PRIOR_OVERRIDE_MODEL_ID,
  currentModelDisplayName: PRIOR_OVERRIDE_DISPLAY_NAME,
}));

const PINNED_AND_INHERITED_PAIR: GlobalSwapProfile[] = [
  {
    profileId: "assistant-default",
    displayName: "Assistant",
    currentModel: "claude-cli-sonnet5",
    currentModelDisplayName: "Sonnet 5 (CLI)",
    mode: "pinned",
  },
  {
    profileId: "consulting",
    displayName: "Consulting",
    currentModel: "ollama-llama3",
    currentModelDisplayName: "Llama 3 (local)",
    mode: "inherited",
  },
];

function rowContainerFor(text: string): HTMLElement {
  const el = screen.getByText(text);
  const row = el.closest("div");
  if (!row) throw new Error(`No row container found for "${text}"`);
  return row;
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });
  mockDispatchSwap.mockReset();
  mockToastFn.mockReset();
  mockGlobalOverride = { modelOverride: null, voiceOverride: null };
});

// ─── Confirm state ────────────────────────────────────────────────────────────

describe("GlobalSwapModal confirm state", () => {
  it("renders one row per affected profile with current -> new engine", () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    for (const p of THREE_PROFILES) {
      const row = rowContainerFor(p.displayName!);
      expect(row.textContent).toContain(p.currentModelDisplayName);
      expect(row.textContent).toContain(TARGET_NORMAL.name);
    }
  });

  it("renders the pinned-default shadowing disclosure with a computed count of 2 when 2 of 3 profiles are pinned (D-11 amended)", () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={TWO_OF_THREE_PINNED}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(
      screen.getByText(
        "2 profiles have a pinned default that will be shadowed while this global override is in force."
      )
    ).toBeInTheDocument();
  });

  it("computes the pinned-default count rather than hardcoding it — 'all pinned' and 'none pinned' fixtures produce different output", () => {
    const { rerender } = render(
      <GlobalSwapModal target={TARGET_NORMAL} profiles={ALL_PINNED} open selectionNonce={1} onOpenChange={() => {}} />
    );
    expect(
      screen.getByText(
        "3 profiles have a pinned default that will be shadowed while this global override is in force."
      )
    ).toBeInTheDocument();

    rerender(
      <GlobalSwapModal target={TARGET_NORMAL} profiles={NONE_PINNED} open selectionNonce={1} onOpenChange={() => {}} />
    );
    expect(screen.queryByText(/pinned default that will be shadowed/)).not.toBeInTheDocument();
  });

  it("never uses the word 'overwritten' — a global swap shadows pinned defaults, it never writes them (D-11 amended)", () => {
    const { container } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={ALL_PINNED}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );
    expect(container.textContent).not.toMatch(/overwritten/i);
  });

  it("renders the expensive-tier cost warning with no second confirmation surface", () => {
    render(
      <GlobalSwapModal
        target={TARGET_EXPENSIVE}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(
      screen.getByText(
        "This model may be expensive per token — 3 profiles will be switched to it."
      )
    ).toBeInTheDocument();
    // The frictions do not stack — no per-row inline "Confirm swap" ritual (BrainPickerRow's
    // expensive-tier expansion) appears inside the global-swap modal.
    expect(screen.queryByText("Confirm swap")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Swap all profiles to/ })).toHaveLength(1);
  });

  it("renders no text input — the row list is the friction, not type-to-confirm", () => {
    const { container } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );
    expect(container.querySelectorAll("input")).toHaveLength(0);
  });
});

// ─── Dispatch (confirm -> result), §8 compliance + D-14/D-15 honest reporting ─

describe("GlobalSwapModal dispatch (103-CONTRACT.md §8, D-14/D-15)", () => {
  it("fires exactly the live swap.set command and never touches the deferred per-profile fan-out", async () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        value: TARGET_NORMAL.id,
        restore: false,
      })
    );
    // The direct §8-compliance assertion — the single most important test in this file.
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });

  it("reports success only after the swap.state readback confirms the target model — never from the ack alone", async () => {
    const { rerender } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );

    await screen.findByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`);
    // Ack alone is not enough — no success claim yet.
    expect(screen.queryByText(`Switched to ${TARGET_NORMAL.name}.`)).not.toBeInTheDocument();

    // The server-pushed swap.state readback lands.
    mockGlobalOverride = { modelOverride: TARGET_NORMAL.id, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(await screen.findByText(`Switched to ${TARGET_NORMAL.name}.`)).toBeInTheDocument();
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });

  it("reports the server's own error text and claims nothing switched", async () => {
    mockDispatch.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "error",
      error: "backend unreachable",
    });
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );

    const row = await screen.findByText(/Failed — backend unreachable/);
    expect(row.textContent).toContain("Every profile is still on its prior engine");
    expect(screen.queryByText(/Switched to/)).not.toBeInTheDocument();
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });

  it("never renders a success claim when the ack is ok but the swap.state readback never arrives (regression guard for the old ack-equals-success shortcut)", async () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );

    await screen.findByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`);
    expect(screen.queryByText(`Switched to ${TARGET_NORMAL.name}.`)).not.toBeInTheDocument();
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });

  it("falls back to an honest accepted-but-unconfirmed reading after the bounded wait, still never claiming success", async () => {
    vi.useFakeTimers();
    try {
      render(
        <GlobalSwapModal
          target={TARGET_NORMAL}
          profiles={PINNED_AND_INHERITED_PAIR}
          open
          selectionNonce={1}
          onOpenChange={() => {}}
        />
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
        );
      });

      expect(
        screen.getByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`)
      ).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(GLOBAL_SWAP_CONFIRM_TIMEOUT_MS + 100);
      });

      expect(
        screen.getByText(
          `Accepted — no confirmation received yet. No profile is confirmed on ${TARGET_NORMAL.name} yet.`
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(`Switched to ${TARGET_NORMAL.name}.`)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never renders the BRAINS_STUB_ACTIVE chip on the result surface — the global axis is live by definition (D-16 amendment)", async () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );

    await screen.findByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`);
    expect(screen.queryByText("STUB")).not.toBeInTheDocument();
  });
});

// ─── Dismiss / revert (CR-03: survives Done, renders a real result) ───────────

describe("GlobalSwapModal dismiss and revert", () => {
  async function swapAndConfirm(rerenderFn: (ui: React.ReactElement) => void, onOpenChange: (open: boolean) => void) {
    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );
    await screen.findByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`);
    mockGlobalOverride = { modelOverride: TARGET_NORMAL.id, voiceOverride: null };
    rerenderFn(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText(`Switched to ${TARGET_NORMAL.name}.`);
  }

  it("fires a summary toast with a 'Revert global swap' action once the swap is confirmed", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    await swapAndConfirm(rerender, onOpenChange);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(mockToastFn).toHaveBeenCalledWith(
      `All profiles switched to ${TARGET_NORMAL.name}.`,
      expect.objectContaining({
        action: expect.objectContaining({ label: "Revert global swap" }),
      })
    );
  });

  it("invoking Revert reopens the dialog BEFORE dispatching, sends exactly swap.set restore:true, and renders a confirmed revert result", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    await swapAndConfirm(rerender, onOpenChange);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const [, toastOptions] = mockToastFn.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    mockDispatch.mockClear();
    mockDispatchSwap.mockClear();
    onOpenChange.mockClear();

    toastOptions.action.onClick();

    // CR-03: the dialog is genuinely reopened BEFORE the dispatch fires, never a real command with
    // no visible surface.
    expect(onOpenChange).toHaveBeenCalledWith(true);

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        restore: true,
      })
    );
    expect(mockDispatchSwap).not.toHaveBeenCalled();

    await screen.findByText("Accepted — confirming the global override was cleared…");

    // The server-pushed swap.state readback confirms the override is cleared (null).
    mockGlobalOverride = { modelOverride: null, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    expect(
      await screen.findByText("Global override cleared — profiles are back on their own defaults.")
    ).toBeInTheDocument();
  });

  it("does not resurrect the Revert action on a revert's own dismissal (a revert of a revert is not the D-10 affordance)", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    await swapAndConfirm(rerender, onOpenChange);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const [, toastOptions] = mockToastFn.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    mockToastFn.mockClear();
    toastOptions.action.onClick();

    mockGlobalOverride = { modelOverride: null, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText("Global override cleared — profiles are back on their own defaults.");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(mockToastFn).toHaveBeenCalledWith("Global override cleared.");
    const revertCall = mockToastFn.mock.calls.find(
      (call) => typeof call[1] === "object" && call[1]?.action?.label === "Revert global swap"
    );
    expect(revertCall).toBeUndefined();
  });
});

// ─── Revert-to-prior (103-14: OBS 7 gap closure) ──────────────────────────────
//
// `astridr/api/ws_commands.py:233`: `restore=True` clears the override, `value` is ignored — the
// pre-103-14 `runRevert` hardcoded exactly that, so a revert following a swap that had a real prior
// global override in force silently discarded it instead of restoring it (observed live 2026-07-29,
// 103-13-T1: badge `claude-haiku-4-5-20251001 (global)` -> swap to `claude-opus-4-8` -> "Revert
// global swap" -> badge `unknown`, not back to Haiku 4.5). These tests exercise the restore branch
// directly and prove the prior value is captured at dispatch time, not read live at revert time.

describe("GlobalSwapModal revert-to-prior (103-14)", () => {
  it("reverting a swap that had a prior global override dispatches value:<prior>, restore:false — never the old unconditional restore:true", async () => {
    mockGlobalOverride = { modelOverride: PRIOR_OVERRIDE_MODEL_ID, voiceOverride: null };
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );
    await screen.findByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`);

    mockGlobalOverride = { modelOverride: TARGET_NORMAL.id, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText(`Switched to ${TARGET_NORMAL.name}.`);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const [, toastOptions] = mockToastFn.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    mockDispatch.mockClear();
    mockDispatchSwap.mockClear();

    toastOptions.action.onClick();

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        value: PRIOR_OVERRIDE_MODEL_ID,
        restore: false,
      })
    );
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ restore: true })
    );
    expect(mockDispatchSwap).not.toHaveBeenCalled();
  });

  it("captures the prior override at dispatch time — a live modelOverride change between the swap and the revert click does not corrupt the restore target", async () => {
    mockGlobalOverride = { modelOverride: PRIOR_OVERRIDE_MODEL_ID, voiceOverride: null };
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );
    await screen.findByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`);

    mockGlobalOverride = { modelOverride: TARGET_NORMAL.id, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText(`Switched to ${TARGET_NORMAL.name}.`);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const [, toastOptions] = mockToastFn.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];

    // A THIRD swap happens elsewhere (e.g. another tab) before this toast's Revert is clicked —
    // the live modelOverride reading has moved on again. `runRevert` must still restore to the
    // value captured when THIS swap dispatched, not whatever `modelOverride` reads now.
    mockGlobalOverride = { modelOverride: "some-other-engine", voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    mockDispatch.mockClear();
    toastOptions.action.onClick();

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        value: PRIOR_OVERRIDE_MODEL_ID,
        restore: false,
      })
    );
  });

  it("resolves confirmed only once the readback matches the restored value — never from the ack alone — and names the restored engine", async () => {
    mockGlobalOverride = { modelOverride: PRIOR_OVERRIDE_MODEL_ID, voiceOverride: null };
    const onOpenChange = vi.fn();
    let resolveAck: ((ack: { type: "ack"; request_id: string; status: string }) => void) | null =
      null;

    const { rerender } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );
    await screen.findByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`);
    mockGlobalOverride = { modelOverride: TARGET_NORMAL.id, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText(`Switched to ${TARGET_NORMAL.name}.`);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const [, toastOptions] = mockToastFn.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];

    mockDispatch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAck = resolve;
        })
    );

    toastOptions.action.onClick();

    // Reopened, dispatch in flight — pending copy names the restore target, not a generic clear.
    await screen.findByText(`Reverting to ${PRIOR_OVERRIDE_DISPLAY_NAME}…`);

    await act(async () => {
      resolveAck!({ type: "ack", request_id: "", status: "ok" });
    });

    await screen.findByText(`Accepted — confirming the revert to ${PRIOR_OVERRIDE_DISPLAY_NAME}…`);
    // Ack alone is not enough — no restored-success claim yet.
    expect(
      screen.queryByText(`Reverted to ${PRIOR_OVERRIDE_DISPLAY_NAME}.`)
    ).not.toBeInTheDocument();

    // The server-pushed swap.state readback lands, matching the restored value.
    mockGlobalOverride = { modelOverride: PRIOR_OVERRIDE_MODEL_ID, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    expect(await screen.findByText(`Reverted to ${PRIOR_OVERRIDE_DISPLAY_NAME}.`)).toBeInTheDocument();
    expect(
      screen.queryByText("Global override cleared — profiles are back on their own defaults.")
    ).not.toBeInTheDocument();
  });

  it("falls back to an honest accepted-but-unconfirmed reading naming the restore target after the bounded wait, never a bare 'cleared' claim", async () => {
    vi.useFakeTimers();
    try {
      mockGlobalOverride = { modelOverride: PRIOR_OVERRIDE_MODEL_ID, voiceOverride: null };
      const onOpenChange = vi.fn();

      const { rerender } = render(
        <GlobalSwapModal
          target={TARGET_NORMAL}
          profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
          open
          selectionNonce={1}
          onOpenChange={onOpenChange}
        />
      );

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
        );
      });
      await act(async () => {
        mockGlobalOverride = { modelOverride: TARGET_NORMAL.id, voiceOverride: null };
        rerender(
          <GlobalSwapModal
            target={TARGET_NORMAL}
            profiles={PROFILES_UNDER_PRIOR_OVERRIDE}
            open
            selectionNonce={1}
            onOpenChange={onOpenChange}
          />
        );
      });
      expect(screen.getByText(`Switched to ${TARGET_NORMAL.name}.`)).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Done" }));
      const [, toastOptions] = mockToastFn.mock.calls[0] as [
        string,
        { action: { label: string; onClick: () => void } },
      ];

      await act(async () => {
        toastOptions.action.onClick();
      });

      expect(
        screen.getByText(`Accepted — confirming the revert to ${PRIOR_OVERRIDE_DISPLAY_NAME}…`)
      ).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(GLOBAL_SWAP_CONFIRM_TIMEOUT_MS + 100);
      });

      expect(
        screen.getByText(
          `Accepted — no confirmation received yet that the global override was restored to ${PRIOR_OVERRIDE_DISPLAY_NAME}.`
        )
      ).toBeInTheDocument();
      expect(
        screen.queryByText(`Reverted to ${PRIOR_OVERRIDE_DISPLAY_NAME}.`)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Accepted — no confirmation received yet that the global override was cleared.")
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("still dispatches restore:true and renders the unchanged clear-case copy when no prior override was in force", async () => {
    mockGlobalOverride = { modelOverride: null, voiceOverride: null };
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
    );
    await screen.findByText(`Accepted — confirming the switch to ${TARGET_NORMAL.name}…`);
    mockGlobalOverride = { modelOverride: TARGET_NORMAL.id, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );
    await screen.findByText(`Switched to ${TARGET_NORMAL.name}.`);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const [, toastOptions] = mockToastFn.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    mockDispatch.mockClear();

    toastOptions.action.onClick();

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith({
        type: "swap.set",
        target: "brain",
        restore: true,
      })
    );

    await screen.findByText("Accepted — confirming the global override was cleared…");
    mockGlobalOverride = { modelOverride: null, voiceOverride: null };
    rerender(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={PINNED_AND_INHERITED_PAIR}
        open
        selectionNonce={1}
        onOpenChange={onOpenChange}
      />
    );
    expect(
      await screen.findByText("Global override cleared — profiles are back on their own defaults.")
    ).toBeInTheDocument();
  });
});
