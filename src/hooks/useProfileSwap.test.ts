/**
 * useProfileSwap.test.ts — Phase 109 Plan 06, Task 1 (TDD).
 *
 * `@/hooks/useCommandDispatch` is mocked directly (a bare `mockDispatch` spy, no auto-toast) —
 * the same idiom `BrainPicker.test.tsx`/`GlobalSwapModal.test.tsx` already establish, so this file
 * tests only THIS hook's own dispatch-bounding/outcome-machine logic, not `useCommandDispatch`'s
 * own transport-level toast behavior.
 *
 * `@/hooks/useResolvedBrain`'s `useProfileBrainOverrides` is mocked directly (a controllable
 * `mockProfileOverrides` object) so the D-05 readback can be driven precisely without a real WS
 * transport. `@/hooks/useActiveEngine` is mocked directly (a controllable `mockActiveEngines` map)
 * — used only for the error toast's "still on X" naming, never the confirm source.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StrictMode, useEffect } from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useProfileSwap,
  PROFILE_SWAP_CONFIRM_TIMEOUT_MS,
  PROFILE_SWAP_DISPATCH_TIMEOUT_MS,
  type ProfileSwapOutcome,
} from "./useProfileSwap";
import type { CatalogueEntry } from "../lib/brainsApi";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDispatch = vi.fn();
vi.mock("@/hooks/useCommandDispatch", () => ({
  useCommandDispatch: () => ({
    dispatch: (...args: unknown[]) => mockDispatch(...args),
    isConnected: true,
  }),
}));

let mockProfileOverrides: Record<string, { model: string; source: string | null }> = {};
vi.mock("@/hooks/useResolvedBrain", () => ({
  useProfileBrainOverrides: () => mockProfileOverrides,
}));

let mockActiveEngines: Record<string, { model: string } | undefined> = {};
vi.mock("@/hooks/useActiveEngine", () => ({
  useActiveEngine: () => mockActiveEngines,
}));

const mockToastFn = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastWarning = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => mockToastFn(...args), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  }),
}));

function okAck(overrides: Record<string, unknown> = {}) {
  return { type: "ack", request_id: "", status: "ok", ...overrides };
}

function errorAck(error: string) {
  return { type: "ack", request_id: "", status: "error", error };
}

const ENTRY_A: CatalogueEntry = {
  id: "codex-cli",
  name: "Codex CLI",
  vendor: "codex",
  group: "api",
  billing: "api",
  costTier: "normal",
};

const ENTRY_B: CatalogueEntry = {
  id: "antigravity-cli",
  name: "Antigravity CLI",
  vendor: "antigravity",
  group: "api",
  billing: "api",
  costTier: "normal",
};

beforeEach(() => {
  mockDispatch.mockReset();
  mockDispatch.mockResolvedValue(okAck());
  mockProfileOverrides = {};
  mockActiveEngines = {};
  mockToastFn.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockToastWarning.mockReset();
});

// ---------------------------------------------------------------------------

describe("useProfileSwap — constants", () => {
  it("PROFILE_SWAP_CONFIRM_TIMEOUT_MS is 4000, matching the global axis's bound", () => {
    expect(PROFILE_SWAP_CONFIRM_TIMEOUT_MS).toBe(4000);
  });

  it("PROFILE_SWAP_DISPATCH_TIMEOUT_MS is 15000, matching the global axis's dispatch bound", () => {
    expect(PROFILE_SWAP_DISPATCH_TIMEOUT_MS).toBe(15000);
  });
});

describe("useProfileSwap — ProfileSwapOutcome has exactly five members (compile-time exhaustive switch)", () => {
  function assertNever(x: never): never {
    throw new Error("unexpected outcome status: " + JSON.stringify(x));
  }

  // If a 6th member were ever added to the union without a matching case below, `tsc --noEmit`
  // fails at the `default` branch — this is a TYPE-level guarantee, not a runtime guess dressed
  // up as one.
  function describeForTest(outcome: ProfileSwapOutcome): string {
    switch (outcome.status) {
      case "pending":
        return "pending";
      case "confirming":
        return "confirming";
      case "confirmed":
        return "confirmed";
      case "accepted":
        return "accepted";
      case "error":
        return outcome.reason;
      default:
        return assertNever(outcome);
    }
  }

  it("switches exhaustively over all five variants with no default fallthrough reached", () => {
    const variants: ProfileSwapOutcome[] = [
      { status: "pending" },
      { status: "confirming" },
      { status: "confirmed" },
      { status: "accepted" },
      { status: "error", reason: "boom" },
    ];
    for (const v of variants) {
      expect(() => describeForTest(v)).not.toThrow();
    }
    expect(describeForTest({ status: "error", reason: "boom" })).toBe("boom");
  });
});

describe("useProfileSwap — swapTo dispatch shape", () => {
  it("dispatches exactly { type: 'swap.set', target: 'brain', value, restore: false, profile_id } once", async () => {
    const { result } = renderHook(() => useProfileSwap("assistant-default"));

    act(() => {
      result.current.swapTo(ENTRY_A);
    });

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "swap.set",
      target: "brain",
      value: "codex-cli",
      restore: false,
      profile_id: "assistant-default",
    });
  });

  it("sets outcome to pending and target to the entry immediately, before the dispatch settles", () => {
    let resolveDispatch: (v: unknown) => void = () => {};
    mockDispatch.mockImplementation(() => new Promise((resolve) => (resolveDispatch = resolve)));
    const { result } = renderHook(() => useProfileSwap("assistant-default"));

    act(() => {
      result.current.swapTo(ENTRY_A);
    });

    expect(result.current.outcome).toEqual({ status: "pending" });
    expect(result.current.target).toEqual(ENTRY_A);

    resolveDispatch(okAck());
  });
});

describe("useProfileSwap — an ok ack moves pending -> confirming; the readback confirms only on a matching model", () => {
  it("moves to confirming after an ok ack, does NOT confirm on a readback naming a different model, and DOES confirm on a matching readback (paired control)", async () => {
    const { result, rerender } = renderHook(() => useProfileSwap("assistant-default"));

    act(() => {
      result.current.swapTo(ENTRY_A);
    });
    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirming" }));

    // A readback for a genuinely DIFFERENT model must NOT confirm — an always-confirm
    // implementation must fail this half of the test.
    mockProfileOverrides = { "assistant-default": { model: "some-other-model", source: null } };
    rerender();
    expect(result.current.outcome).toEqual({ status: "confirming" });

    // CONTROL: the matching readback DOES confirm, in the same test, proving the probe itself
    // works (an always-stay-confirming implementation must fail this half).
    mockProfileOverrides = { "assistant-default": { model: "codex-cli", source: "operator" } };
    rerender();
    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirmed" }));
    expect(mockToastSuccess).toHaveBeenCalledWith("assistant-default switched to Codex CLI.");
  });
});

describe("useProfileSwap — an error ack never enters confirming and never schedules a confirm timeout", () => {
  it("resolves straight to { status: 'error', reason } and stays there past the confirm bound", async () => {
    mockDispatch.mockResolvedValue(errorAck("No credentials configured"));
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useProfileSwap("assistant-default"));

      await act(async () => {
        result.current.swapTo(ENTRY_A);
      });

      expect(result.current.outcome).toEqual({
        status: "error",
        reason: "No credentials configured",
      });
      expect(mockToastError).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(PROFILE_SWAP_CONFIRM_TIMEOUT_MS + 100);
      });

      // Never entered confirming, so it can never have transitioned to accepted.
      expect(result.current.outcome).toEqual({
        status: "error",
        reason: "No credentials configured",
      });
      expect(mockToastWarning).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useProfileSwap — a never-returning dispatch resolves to error at the 15s bound, not a hang", () => {
  it("settles as an honest error once PROFILE_SWAP_DISPATCH_TIMEOUT_MS elapses", async () => {
    mockDispatch.mockImplementation(() => new Promise(() => {})); // never resolves
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useProfileSwap("assistant-default"));

      await act(async () => {
        result.current.swapTo(ENTRY_A);
      });
      expect(result.current.outcome).toEqual({ status: "pending" });

      await act(async () => {
        vi.advanceTimersByTime(PROFILE_SWAP_DISPATCH_TIMEOUT_MS + 100);
      });

      expect(result.current.outcome.status).toBe("error");
      expect(mockToastError).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useProfileSwap — the bounded fallback (accepted) at exactly the 4s boundary, toast fires once", () => {
  it("moves confirming -> accepted after PROFILE_SWAP_CONFIRM_TIMEOUT_MS and fires the warning toast exactly once, even well past the boundary", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useProfileSwap("assistant-default"));

      await act(async () => {
        result.current.swapTo(ENTRY_A);
      });
      expect(result.current.outcome).toEqual({ status: "confirming" });

      await act(async () => {
        vi.advanceTimersByTime(PROFILE_SWAP_CONFIRM_TIMEOUT_MS + 100);
      });

      expect(result.current.outcome).toEqual({ status: "accepted" });
      expect(mockToastWarning).toHaveBeenCalledTimes(1);
      expect(mockToastWarning.mock.calls[0][0]).toMatch(/not yet confirmed|may still be in progress/);

      // Advancing well past the boundary again must not re-fire the toast.
      await act(async () => {
        vi.advanceTimersByTime(PROFILE_SWAP_CONFIRM_TIMEOUT_MS * 5);
      });
      expect(mockToastWarning).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useProfileSwap — a late matching readback while accepted still resolves to confirmed", () => {
  it("resolves accepted -> confirmed on a late readback and fires the normal success toast", async () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(() => useProfileSwap("assistant-default"));

      await act(async () => {
        result.current.swapTo(ENTRY_A);
      });
      await act(async () => {
        vi.advanceTimersByTime(PROFILE_SWAP_CONFIRM_TIMEOUT_MS + 100);
      });
      expect(result.current.outcome).toEqual({ status: "accepted" });

      mockProfileOverrides = { "assistant-default": { model: "codex-cli", source: "operator" } };
      rerender();

      expect(result.current.outcome).toEqual({ status: "confirmed" });
      expect(mockToastSuccess).toHaveBeenCalledWith("assistant-default switched to Codex CLI.");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useProfileSwap — restore() confirms on absence, paired with a still-present control profile", () => {
  it("confirms once THIS profile's entry is absent, while a second profile remains present in the same payload (an empty map cannot pass this)", async () => {
    mockProfileOverrides = {
      "assistant-default": { model: "codex-cli", source: "operator" },
      consulting: { model: "claude-opus-4-8", source: "operator" },
    };
    const { result, rerender } = renderHook(() => useProfileSwap("assistant-default"));

    act(() => {
      result.current.restore();
    });
    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirming" }));

    // CONTROL first: the entry is still PRESENT (nothing changed yet) — must not confirm.
    rerender();
    expect(result.current.outcome).toEqual({ status: "confirming" });

    // Now only THIS profile's entry is removed; the control profile ("consulting") remains
    // present in the very same payload — proving the check is per-profile absence, not
    // "the whole map happens to be empty."
    mockProfileOverrides = { consulting: { model: "claude-opus-4-8", source: "operator" } };
    rerender();

    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirmed" }));
  });

  it("dispatches the restore form with no value", async () => {
    const { result } = renderHook(() => useProfileSwap("assistant-default"));

    act(() => {
      result.current.restore();
    });

    await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: "swap.set",
      target: "brain",
      restore: true,
      profile_id: "assistant-default",
    });
  });
});

describe("useProfileSwap — starting a new swapTo resets state and a superseded stale dispatch cannot clobber it (race protection)", () => {
  it("a stale error resolving after a newer swapTo already confirmed does not overwrite the newer state", async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    mockDispatch.mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve))
    );
    const { result } = renderHook(() => useProfileSwap("assistant-default"));

    act(() => {
      result.current.swapTo(ENTRY_A);
    });
    expect(result.current.outcome).toEqual({ status: "pending" });

    // Supersede A before its dispatch has settled — B's own dispatch uses the default
    // mockResolvedValue(okAck()) and settles quickly.
    await act(async () => {
      result.current.swapTo(ENTRY_B);
    });
    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirming" }));
    expect(result.current.target).toEqual(ENTRY_B);

    // Resolve A's STALE dispatch with an ERROR — an implementation with no epoch guard would
    // incorrectly flip the outcome to "error" for what is now B's swap.
    await act(async () => {
      resolveFirst(errorAck("stale failure for A"));
    });

    expect(result.current.outcome).toEqual({ status: "confirming" });
    expect(result.current.target).toEqual(ENTRY_B);
  });
});

describe("useProfileSwap — every timer is cleared on unmount", () => {
  it("clears the pending confirm timeout on unmount", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { result, unmount } = renderHook(() => useProfileSwap("assistant-default"));

    await act(async () => {
      result.current.swapTo(ENTRY_A);
    });
    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirming" }));

    const callsBeforeUnmount = clearTimeoutSpy.mock.calls.length;
    unmount();
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);

    clearTimeoutSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Phase 109-10 — gap closure for the 109-09 live gate's Probe D failure.
//
// The live gate found that on the dev server the outcome machine never left
// `pending`: the "· switching to …" suffix never cleared and NEITHER toast ever
// fired. Root cause: the mount effect set `unmountedRef.current = true` in its
// cleanup and never reset it on remount, so React StrictMode's dev-only
// mount→cleanup→remount latched the ref `true` and both dispatch continuations
// dead-ended at their `unmountedRef` guard before reaching `setOutcome`.
//
// WHY THIS FILE'S OTHER 15 CASES ARE GREEN AND MISSED IT: every one of them
// renders the hook ONCE. `unmountedRef` is only latched by a cleanup that is
// followed by a re-run of the effect ON THE SAME INSTANCE.
//
// AND WHY AN EXPLICIT unmount() + fresh renderHook() WOULD NOT REPRODUCE IT
// EITHER: `useRef` is per-instance, so a brand-new render gets a brand-new
// `unmountedRef` initialised to `false`. Only StrictMode's cleanup-then-re-run
// against the SAME fiber preserves the latched ref. The boundary has to be
// crossed the way production crosses it.
// ---------------------------------------------------------------------------

describe("useProfileSwap — StrictMode remount (109-10 regression guard)", () => {
  it("CONTROL: StrictMode double-invokes effects in this environment, so the remount boundary is genuinely crossed", () => {
    const effectLog: string[] = [];
    renderHook(
      () =>
        useEffect(() => {
          effectLog.push("mount");
          return () => {
            effectLog.push("cleanup");
          };
        }, []),
      { wrapper: StrictMode }
    );

    // If this control ever fails, the regression test below is measuring nothing
    // and must not be trusted as a passing guard.
    expect(effectLog).toEqual(["mount", "cleanup", "mount"]);
  });

  it("re-arms after a StrictMode mount->cleanup->remount: reaches confirming, then confirmed on a matching readback, firing the success toast once", async () => {
    const { result, rerender } = renderHook(() => useProfileSwap("assistant-default"), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.swapTo(ENTRY_A);
    });

    // Before the fix this stayed { status: "pending" } forever — the ack's
    // continuation returned early at the `unmountedRef` guard.
    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirming" }));

    mockProfileOverrides = { "assistant-default": { model: "codex-cli", source: "operator" } };
    rerender();

    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirmed" }));
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith("assistant-default switched to Codex CLI.");
  });

  it("restore() also re-arms after a StrictMode remount, confirming on absence with a still-present control profile", async () => {
    mockProfileOverrides = {
      "assistant-default": { model: "codex-cli", source: "operator" },
      "other-profile": { model: "antigravity-cli", source: "operator" },
    };

    const { result, rerender } = renderHook(() => useProfileSwap("assistant-default"), {
      wrapper: StrictMode,
    });

    act(() => {
      result.current.restore();
    });
    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirming" }));

    // THIS profile absent, the control profile still present in the same payload —
    // an empty map cannot pass this.
    mockProfileOverrides = { "other-profile": { model: "antigravity-cli", source: "operator" } };
    rerender();

    await waitFor(() => expect(result.current.outcome).toEqual({ status: "confirmed" }));
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "assistant-default restored to its own default engine."
    );
  });

  it("GUARD INTACT: a dispatch that resolves after a genuine unmount still never advances the machine or fires a toast", async () => {
    // The fix RESETS `unmountedRef` on mount; it must not delete the guard. If a
    // later simplification removes the ref entirely, this case turns red.
    let releaseDispatch: (v: unknown) => void = () => {};
    mockDispatch.mockReturnValue(
      new Promise((resolve) => {
        releaseDispatch = resolve;
      })
    );

    const { result, unmount } = renderHook(() => useProfileSwap("assistant-default"));

    act(() => {
      result.current.swapTo(ENTRY_A);
    });

    unmount();

    // The ack lands only AFTER the component is genuinely gone.
    await act(async () => {
      releaseDispatch(okAck());
      await Promise.resolve();
    });

    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastWarning).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
  });
});
