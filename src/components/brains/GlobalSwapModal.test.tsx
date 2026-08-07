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
import { SWAP_HISTORY_CAP, type SwapHistoryRow } from "@/hooks/useControlVerbSwaps";
import type { CatalogueEntry } from "@/lib/brainsApi";
import {
  GLOBAL_SWAP_CONFIRM_TIMEOUT_MS,
  GLOBAL_SWAP_DISPATCH_TIMEOUT_MS,
  GlobalSwapModal,
  type GlobalSwapProfile,
} from "./GlobalSwapModal";

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

// D-15 (108-06): only `useControlVerbSwaps` (the useQuery-backed read) is mocked, the SAME shape
// as `BrainHeaderBadge.test.tsx` mocking `useActiveEngine` — `filterBrainSwaps`/
// `describeSwapOutcome`/`SWAP_HISTORY_CAP` stay REAL (via `importOriginal`) so these tests exercise
// the real filter/outcome logic together with the real render, not a hand-copied mirror of either.
const mockUseControlVerbSwaps = vi.fn<(profileId: string | undefined) => SwapHistoryRow[]>();
vi.mock("@/hooks/useControlVerbSwaps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useControlVerbSwaps")>();
  return {
    ...actual,
    useControlVerbSwaps: (profileId: string | undefined) => mockUseControlVerbSwaps(profileId),
  };
});

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

// 103-17: `hasConfiguredDefault`/`configuredDefault`/`configuredDefaultDisplayName` are the CONFIG
// signal `pinnedCount`/the shadowing warning now read — set independently of `mode` (the
// UNCHANGED, telemetry-shaped field) everywhere below so no test in this file can accidentally
// prove the two are still coupled.
const THREE_PROFILES: GlobalSwapProfile[] = [
  {
    profileId: "assistant-default",
    displayName: "Assistant",
    currentModel: "claude-cli-sonnet5",
    currentModelDisplayName: "Sonnet 5 (CLI)",
    mode: "pinned",
    hasConfiguredDefault: true,
    configuredDefault: "claude-cli-sonnet5",
    configuredDefaultDisplayName: "Sonnet 5 (CLI)",
  },
  {
    profileId: "consulting",
    displayName: "Consulting",
    currentModel: "ollama-llama3",
    currentModelDisplayName: "Llama 3 (local)",
    mode: "inherited",
    hasConfiguredDefault: false,
    configuredDefault: null,
    configuredDefaultDisplayName: null,
  },
  {
    profileId: "personal",
    displayName: "Personal",
    currentModel: "codex-cli",
    currentModelDisplayName: "Codex CLI",
    mode: "session",
    hasConfiguredDefault: false,
    configuredDefault: null,
    configuredDefaultDisplayName: null,
  },
];

// Both config-pinned profiles share the SAME configured default name so the count-only assertions
// below get a single, unambiguous name in the warning text.
const TWO_OF_THREE_PINNED: GlobalSwapProfile[] = [
  {
    ...THREE_PROFILES[0],
    hasConfiguredDefault: true,
    configuredDefault: "anthropic/claude-sonnet-5",
    configuredDefaultDisplayName: "Sonnet 5",
  },
  {
    ...THREE_PROFILES[1],
    hasConfiguredDefault: true,
    configuredDefault: "anthropic/claude-sonnet-5",
    configuredDefaultDisplayName: "Sonnet 5",
  },
  { ...THREE_PROFILES[2], hasConfiguredDefault: false, configuredDefault: null, configuredDefaultDisplayName: null },
];

const ALL_PINNED: GlobalSwapProfile[] = THREE_PROFILES.map((p) => ({
  ...p,
  mode: "pinned",
  hasConfiguredDefault: true,
  configuredDefault: "anthropic/claude-sonnet-5",
  configuredDefaultDisplayName: "Sonnet 5",
}));
const NONE_PINNED: GlobalSwapProfile[] = THREE_PROFILES.map((p) => ({
  ...p,
  mode: "inherited",
  hasConfiguredDefault: false,
  configuredDefault: null,
  configuredDefaultDisplayName: null,
}));

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
    hasConfiguredDefault: true,
    configuredDefault: "claude-cli-sonnet5",
    configuredDefaultDisplayName: "Sonnet 5 (CLI)",
  },
  {
    profileId: "consulting",
    displayName: "Consulting",
    currentModel: "ollama-llama3",
    currentModelDisplayName: "Llama 3 (local)",
    mode: "inherited",
    hasConfiguredDefault: false,
    configuredDefault: null,
    configuredDefaultDisplayName: null,
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
  // D-15: honest-empty default, matching what the real hook returns when GlobalSwapModal's
  // genuinely-global `profileId={undefined}` call skips the query.
  mockUseControlVerbSwaps.mockReset();
  mockUseControlVerbSwaps.mockReturnValue([]);
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
        "2 profiles have a pinned default (Sonnet 5) that will be shadowed while this global override is in force."
      )
    ).toBeInTheDocument();
  });

  it("computes the pinned-default count rather than hardcoding it — 'all pinned' and 'none pinned' fixtures produce different output", () => {
    const { rerender } = render(
      <GlobalSwapModal target={TARGET_NORMAL} profiles={ALL_PINNED} open selectionNonce={1} onOpenChange={() => {}} />
    );
    expect(
      screen.getByText(
        "3 profiles have a pinned default (Sonnet 5) that will be shadowed while this global override is in force."
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

// ─── Pinned-default count is a CONFIG signal, not a telemetry one (103-17, OBS 8 gap closure) ──
//
// Live checkpoint 2026-07-29 (103-13-T1): `profiles:listConfigs` showed all three real profiles
// (consulting, business, personal) each carrying `modelPreferences.primary =
// "anthropic/claude-sonnet-5"`, while `activeEngine:latestByProfile` had ZERO rows for any of
// them — every profile's telemetry `mode` therefore read "inherited". The pre-fix
// `pinnedCount = profiles.filter(p => p.mode === "pinned").length` read 0 in exactly that shape.
// These tests pin the fix at the component boundary: `hasConfiguredDefault` (not `mode`) drives
// the count and the warning names what's actually being shadowed.

describe("GlobalSwapModal pinned-default count driven by config, not telemetry mode (103-17, OBS 8)", () => {
  const THREE_UNREPORTED_BUT_CONFIGURED: GlobalSwapProfile[] = [
    {
      profileId: "consulting",
      displayName: "consulting",
      currentModel: "auto",
      currentModelDisplayName: "Auto",
      mode: "inherited",
      hasConfiguredDefault: true,
      configuredDefault: "anthropic/claude-sonnet-5",
      configuredDefaultDisplayName: "Sonnet 5",
    },
    {
      profileId: "business",
      displayName: "business",
      currentModel: "auto",
      currentModelDisplayName: "Auto",
      mode: "inherited",
      hasConfiguredDefault: true,
      configuredDefault: "anthropic/claude-sonnet-5",
      configuredDefaultDisplayName: "Sonnet 5",
    },
    {
      profileId: "personal",
      displayName: "personal",
      currentModel: "auto",
      currentModelDisplayName: "Auto",
      mode: "inherited",
      hasConfiguredDefault: true,
      configuredDefault: "anthropic/claude-sonnet-5",
      configuredDefaultDisplayName: "Sonnet 5",
    },
  ];

  it("reports a pinned-default count of 3 and names the shadowed default when mode is 'inherited' for all three (live OBS 8 shape)", () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_UNREPORTED_BUT_CONFIGURED}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(
      screen.getByText(
        "3 profiles have a pinned default (Sonnet 5) that will be shadowed while this global override is in force."
      )
    ).toBeInTheDocument();
    // The current -> new rows still show the honest "Auto" reading -- this component-level test
    // does not itself prove D-14 (that's BrainPicker's derivation, pinned in BrainPicker.test.tsx),
    // but it proves GlobalSwapModal renders exactly what it's given rather than inferring "Auto"
    // is wrong from the presence of a configured default.
    for (const p of THREE_UNREPORTED_BUT_CONFIGURED) {
      const row = rowContainerFor(p.displayName!);
      expect(row.textContent).toContain("Auto");
    }
  });

  it("does not count a profile with no configured default even if its telemetry mode happens to read 'pinned' (config and telemetry are independent signals)", () => {
    const mixed: GlobalSwapProfile[] = [
      {
        ...THREE_UNREPORTED_BUT_CONFIGURED[0],
        mode: "pinned",
        hasConfiguredDefault: false,
        configuredDefault: null,
        configuredDefaultDisplayName: null,
      },
      THREE_UNREPORTED_BUT_CONFIGURED[1],
      THREE_UNREPORTED_BUT_CONFIGURED[2],
    ];
    render(
      <GlobalSwapModal target={TARGET_NORMAL} profiles={mixed} open selectionNonce={1} onOpenChange={() => {}} />
    );

    // Only 2 of 3 are actually config-pinned -- the first profile's telemetry-reported "pinned"
    // mode must never itself be counted (the exact coupling this fix removes).
    expect(
      screen.getByText(
        "2 profiles have a pinned default (Sonnet 5) that will be shadowed while this global override is in force."
      )
    ).toBeInTheDocument();
  });

  it("MUTATION-CHECK REGRESSION GUARD: fails if pinnedCount is ever recoupled to `mode` instead of `hasConfiguredDefault` — see this describe block's own docstring for the manual mutation performed during 103-17 execution", () => {
    // A profile whose telemetry `mode` is "pinned" but which has NO configured default at all —
    // the inverse of the live OBS 8 shape. If `pinnedCount` were ever recoupled to `mode`, this
    // fixture would render the shadowing warning; the fix must render nothing.
    const modePinnedButNotConfigured: GlobalSwapProfile[] = [
      {
        profileId: "assistant-default",
        displayName: "Assistant",
        currentModel: "claude-cli-sonnet5",
        currentModelDisplayName: "Sonnet 5 (CLI)",
        mode: "pinned",
        hasConfiguredDefault: false,
        configuredDefault: null,
        configuredDefaultDisplayName: null,
      },
    ];
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={modePinnedButNotConfigured}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(screen.queryByText(/pinned default.*that will be shadowed/)).not.toBeInTheDocument();
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

// ── UAT gap (2026-07-29, 103-UAT.md test 16): a never-settling dispatch must not trap the operator ──
//
// Observed live: clicking confirm sent ZERO WS frames and the dialog sat on "Switching to Claude
// Haiku 4.5…" indefinitely, with Done resolved to `<button disabled>` and no Cancel and no close X
// (this component renders `showCloseButton={false}`), so the only way out was a page reload. The
// operator was shown in-flight progress for a command that never left the browser.
//
// Root cause, independent of how often it triggers: AstridrWSContext.sendCommand queues the command
// when the socket is not OPEN and returns a promise that is NEITHER resolved NOR rejected and has NO
// timeout, and runSwap/runRevert awaited it with no try/catch and no finally — so setIsBusy(false)
// never ran. Both failure shapes are covered below: a promise that never settles, and one that
// rejects.

describe("GlobalSwapModal — a dispatch that never settles cannot trap the operator (UAT test 16)", () => {
  beforeEach(() => {
    mockGlobalOverride = { modelOverride: null, voiceOverride: null };
  });

  it("reports an honest failure and re-enables Done when the dispatch never settles", async () => {
    // The exact live shape: sendCommand queued the command and never settled the promise.
    mockDispatch.mockReturnValue(new Promise(() => {}));

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

      // Before the bound elapses the pending reading is legitimate.
      expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(GLOBAL_SWAP_DISPATCH_TIMEOUT_MS + 100);
      });

      // Honest failure, not a fabricated success and not a permanent "Switching to…".
      expect(screen.getByText(/never delivered|no response/i)).toBeInTheDocument();
      expect(screen.queryByText(`Switched to ${TARGET_NORMAL.name}.`)).not.toBeInTheDocument();
      // THE assertion: the operator can leave.
      expect(screen.getByRole("button", { name: "Done" })).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-enables Done when the dispatch REJECTS (ack timeout / queue full)", async () => {
    mockDispatch.mockRejectedValue(new Error("Command timeout"));

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

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).not.toBeDisabled()
    );
    expect(screen.queryByText(`Switched to ${TARGET_NORMAL.name}.`)).not.toBeInTheDocument();
  });

  it("does not trap the operator when a REVERT's dispatch rejects either", async () => {
    // A successful swap first, so the toast's revert path has a prior override to restore.
    mockDispatch.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });

    const { rerender } = render(
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
    await screen.findByText(`Switched to ${TARGET_NORMAL.name}.`);

    // Now the revert leg fails.
    mockDispatch.mockRejectedValue(new Error("Command queue full"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const [, toastOptions] = mockToastFn.mock.calls[mockToastFn.mock.calls.length - 1] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    await act(async () => {
      toastOptions.action.onClick();
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Done" })).not.toBeDisabled()
    );
  });
});

// ── UAT test 11 follow-up: a FAILED action must not claim the override took effect ─────────────
//
// Found while live-inducing a swap failure (103-UAT.md test 11): the result surface's row-list header
// was unconditionally "Profiles now governed by the global override:" for any swap action, so on a
// FAILURE it directly contradicted the outcome line right above it, which correctly said "Every
// profile is still on its prior engine."

describe("GlobalSwapModal — a failed action's row-list header stays honest (UAT test 11)", () => {
  beforeEach(() => {
    mockGlobalOverride = { modelOverride: null, voiceOverride: null };
  });

  it("does not claim profiles are governed by the override after a FAILED swap", async () => {
    mockDispatch.mockResolvedValue({
      type: "ack",
      request_id: "",
      status: "error",
      error: "engine unavailable",
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

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: `Swap all profiles to ${TARGET_NORMAL.name}` })
      );
    });

    expect(
      await screen.findByText("Profiles unchanged — still on their prior engine:")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Profiles now governed by the global override:")
    ).not.toBeInTheDocument();
    // The outcome line and the list header must agree.
    expect(screen.getByText(/still on its prior engine/)).toBeInTheDocument();
  });

  it("still shows the governed-by header on a SUCCESSFUL swap", async () => {
    mockDispatch.mockResolvedValue({ type: "ack", request_id: "", status: "ok" });

    const { rerender } = render(
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

    expect(
      await screen.findByText("Profiles now governed by the global override:")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Profiles unchanged — still on their prior engine:")
    ).not.toBeInTheDocument();
  });
});

// ─── Swap-history section (D-15, TELE-02, 108-06) ─────────────────────────────
//
// GlobalSwapModal is the ALL-PROFILES axis (103-CONTRACT.md §8) — it has no single profile to
// scope a history read by, so `SwapHistorySection` always calls `useControlVerbSwaps(undefined)`.
// These tests mock `useControlVerbSwaps` directly (the same pattern `BrainHeaderBadge.test.tsx`
// uses for `useActiveEngine`) so the row-rendering/filtering/truncation logic is provable
// independent of that fact, and one test below asserts the `undefined` call directly.

const SWAP_SUCCESS_ROW: SwapHistoryRow = {
  _id: "row-success",
  verb: "swap_model",
  target: "anthropic-sonnet-5",
  resolved: "anthropic-sonnet-5",
  path: "claude-native",
  channel: "chat",
  timestamp: 1754530300,
};

const SWAP_REFUSED_ROW: SwapHistoryRow = {
  _id: "row-refused",
  verb: "swap_model",
  target: "anthropic-opus-4-8",
  path: "refused",
  reason: "affinity_guard",
  channel: "chat",
  timestamp: 1754530200,
};

const SWAP_VOICE_ROW: SwapHistoryRow = {
  _id: "row-voice",
  verb: "swap_voice",
  voiceId: "voice-warm",
  resolved: "voice-warm",
  path: "claude-native",
  channel: "voice",
  timestamp: 1754530400,
};

describe("GlobalSwapModal swap-history section (D-15, TELE-02)", () => {
  it("renders a success and a refusal, and the refusal reads as a refusal (T-108-24) — asserted on rendered text, not a prop", () => {
    mockUseControlVerbSwaps.mockReturnValue([SWAP_SUCCESS_ROW, SWAP_REFUSED_ROW]);
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText("Switched")).toBeInTheDocument();
    const refusedRow = screen.getByText("Refused — affinity_guard").closest("div");
    expect(refusedRow).not.toBeNull();
    expect(refusedRow!.textContent).toContain("anthropic-opus-4-8");
    // The two outcomes are on separate rows, not merged into one ambiguous line.
    expect(refusedRow!.textContent).not.toContain("Switched");
  });

  it("renders an honest empty message and no history rows when there is nothing to show (covers both a genuinely-global call and a real profile with zero rows)", () => {
    mockUseControlVerbSwaps.mockReturnValue([]);
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText("No swap history to show yet.")).toBeInTheDocument();
    expect(screen.queryByText("Switched")).not.toBeInTheDocument();
    expect(screen.queryByText(/Refused/)).not.toBeInTheDocument();
  });

  it("renders the truncation caption from the imported SWAP_HISTORY_CAP constant and caps the rendered rows at it, never a hardcoded 20", () => {
    const manyRows: SwapHistoryRow[] = Array.from({ length: SWAP_HISTORY_CAP + 5 }, (_, i) => ({
      ...SWAP_SUCCESS_ROW,
      _id: `row-${i}`,
      timestamp: SWAP_SUCCESS_ROW.timestamp + i,
    }));
    mockUseControlVerbSwaps.mockReturnValue(manyRows);
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText(`Showing the last ${SWAP_HISTORY_CAP} swaps`)).toBeInTheDocument();
    expect(screen.getAllByText("Switched")).toHaveLength(SWAP_HISTORY_CAP);
  });

  // 108-06 gap closure (adversarial gate): the caption was previously rendered unconditionally for
  // any non-empty list — a 2-row list said "Showing the last 20 swaps," a fabricated reading of the
  // data. These two tests pin the fix at the render boundary: the "last N" caption must be ABSENT
  // below the cap and PRESENT only once the list is genuinely at the cap. Both assert on real
  // rendered DOM (screen.getByText/queryByText), never a mock's call args.
  it("does NOT render the 'Showing the last N swaps' caption when the list is below the cap (gap closure)", () => {
    mockUseControlVerbSwaps.mockReturnValue([SWAP_SUCCESS_ROW, SWAP_REFUSED_ROW]);
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(screen.queryByText(`Showing the last ${SWAP_HISTORY_CAP} swaps`)).not.toBeInTheDocument();
    // Truthful count instead — never a number the UI isn't actually showing.
    expect(screen.getByText("Showing 2 swaps")).toBeInTheDocument();
  });

  it("renders the 'Showing the last N swaps' caption only once the list is genuinely at the cap (gap closure)", () => {
    const capRows: SwapHistoryRow[] = Array.from({ length: SWAP_HISTORY_CAP }, (_, i) => ({
      ...SWAP_SUCCESS_ROW,
      _id: `cap-row-${i}`,
      timestamp: SWAP_SUCCESS_ROW.timestamp + i,
    }));
    mockUseControlVerbSwaps.mockReturnValue(capRows);
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText(`Showing the last ${SWAP_HISTORY_CAP} swaps`)).toBeInTheDocument();
    expect(screen.queryByText(`Showing ${SWAP_HISTORY_CAP} swaps`)).not.toBeInTheDocument();
  });

  it("does not render a swap_voice row — the D-15 brain-only filter guard", () => {
    mockUseControlVerbSwaps.mockReturnValue([SWAP_VOICE_ROW]);
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByText("No swap history to show yet.")).toBeInTheDocument();
    expect(screen.queryByText("voice-warm")).not.toBeInTheDocument();
  });

  it("queries with no profile scope — GlobalSwapModal is genuinely global and never invents a profileId (108-06-PLAN.md's own stated fallback)", () => {
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    expect(mockUseControlVerbSwaps).toHaveBeenCalledWith(undefined);
  });

  it("wraps the section in SectionErrorBoundary so a failing history read cannot take down the rest of the confirm dialog", () => {
    mockUseControlVerbSwaps.mockImplementation(() => {
      throw new Error("simulated swap-history read failure");
    });
    render(
      <GlobalSwapModal
        target={TARGET_NORMAL}
        profiles={THREE_PROFILES}
        open
        selectionNonce={1}
        onOpenChange={() => {}}
      />
    );

    // The rest of the confirm dialog — including the profile row list — survives.
    expect(screen.getByText(`Swap all profiles to ${TARGET_NORMAL.name}?`)).toBeInTheDocument();
    for (const p of THREE_PROFILES) {
      expect(screen.getByText(p.displayName!)).toBeInTheDocument();
    }
  });
});
