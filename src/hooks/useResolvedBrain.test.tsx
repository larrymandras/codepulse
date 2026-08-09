/**
 * useResolvedBrain.test.tsx — 103-09-T1.
 *
 * `@/contexts/AstridrWSContext` is mocked directly (controllable `status`/`sendCommand`/
 * `subscribeEvent`, plus a throw-mode for the out-of-provider case) so the global-override axis
 * can be driven precisely. `convex/react` + the generated Convex API module are mocked directly
 * (not `@/hooks/useActiveEngine`) so the REAL `useActiveEngine` hook and REAL `deriveMixedState`
 * pure function run underneath — the same idiom `useActiveEngine.test.ts` and
 * `BrainHeaderBadge.test.tsx` already establish.
 *
 * ANTI-STUB-MASKING: this file imports nothing from `@/lib/brainsApi` and never mocks it — the
 * global axis under test here is fed exclusively through the mocked `useAstridrWS().sendCommand`
 * ack and its `swap.state` event push (via the mocked `subscribeEvent`), the same live transport
 * every brain surface uses (Phase 109 D-01 retired the build-time stub seam entirely).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useGlobalBrainOverride,
  useProfileBrainOverrides,
  resolveActiveBrain,
  useResolvedBrain,
  useLastTurnModel,
} from "./useResolvedBrain";
import type { ActiveEngineMap } from "./useActiveEngine";
import type { ActiveEngine } from "../lib/brainsApi";

// ─── Astridr WS mock ──────────────────────────────────────────────────────────

type WSEventCallback = (event: Record<string, unknown>) => void;

let mockStatus: "connected" | "reconnecting" | "disconnected" = "connected";
let mockAstridrWSThrows = false;
const mockSendCommand = vi.fn();
let capturedSwapStateCallback: WSEventCallback | undefined;
let capturedRunCompletedCallback: WSEventCallback | undefined;
const mockUnsubscribe = vi.fn();
const mockSubscribeEvent = vi.fn((eventType: string, callback: WSEventCallback) => {
  if (eventType === "swap.state") capturedSwapStateCallback = callback;
  if (eventType === "run.completed") capturedRunCompletedCallback = callback;
  return mockUnsubscribe;
});

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => {
    if (mockAstridrWSThrows) {
      throw new Error("useAstridrWS must be used within AstridrWSProvider");
    }
    return {
      status: mockStatus,
      sendCommand: mockSendCommand,
      subscribe: vi.fn(),
      subscribeEvent: mockSubscribeEvent,
      reconnect: vi.fn(),
    };
  },
}));

// ─── useActiveEngine's Convex deps mock (so the real hook + deriveMixedState run) ──

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
vi.mock("../../convex/_generated/api", () => ({
  api: {
    activeEngine: { latestByProfile: "activeEngine:latestByProfile" },
    profiles: { listConfigs: "profiles:listConfigs" },
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEngine(
  profileId: string,
  model: string,
  overrides: Partial<ActiveEngine> = {}
): ActiveEngine {
  return {
    profileId,
    model,
    mode: "pinned",
    selectionPath: "codepulse-default",
    timestamp: 1700000000000,
    ...overrides,
  };
}

function seedEngines(snapshots: ActiveEngine[], profileIds: string[]) {
  mockUseQuery.mockImplementation((ref: unknown) => {
    if (ref === "activeEngine:latestByProfile") return snapshots;
    if (ref === "profiles:listConfigs") return profileIds.map((profileId) => ({ profileId }));
    return undefined;
  });
}

function okAck(
  overrides: {
    model_override?: unknown;
    voice_override_name?: unknown;
    profile_overrides?: unknown;
  } = {}
) {
  return {
    type: "ack",
    request_id: "x",
    status: "ok",
    model_override: null,
    voice_override_name: null,
    profile_overrides: {},
    ...overrides,
  };
}

beforeEach(() => {
  mockStatus = "connected";
  mockAstridrWSThrows = false;
  mockSendCommand.mockReset();
  mockSendCommand.mockResolvedValue(okAck());
  capturedSwapStateCallback = undefined;
  capturedRunCompletedCallback = undefined;
  mockUnsubscribe.mockReset();
  mockSubscribeEvent.mockClear();
  mockUseQuery.mockReset();
  mockUseQuery.mockReturnValue(undefined);
  seedEngines([], []);
});

// ---------------------------------------------------------------------------

describe("useGlobalBrainOverride — snapshot on connect (WR-07 regression, THE FIX)", () => {
  it("sends exactly { type: 'swap.get_state' } once status is connected", async () => {
    renderHook(() => useGlobalBrainOverride());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(1));
    expect(mockSendCommand).toHaveBeenCalledWith({ type: "swap.get_state" });
  });

  it("does NOT send swap.get_state while status is disconnected", async () => {
    mockStatus = "disconnected";
    renderHook(() => useGlobalBrainOverride());
    // Give any stray async work a tick to (not) run.
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSendCommand).not.toHaveBeenCalled();
  });

  it("issues a SECOND swap.get_state after a connected -> disconnected -> connected transition", async () => {
    const { rerender } = renderHook(() => useGlobalBrainOverride());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(1));

    mockStatus = "disconnected";
    rerender();
    await Promise.resolve();
    expect(mockSendCommand).toHaveBeenCalledTimes(1);

    mockStatus = "connected";
    rerender();
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(2));
  });

  it("updates the override from a live swap.state push, independent of the snapshot pull", async () => {
    const { result } = renderHook(() => useGlobalBrainOverride());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(1));
    expect(capturedSwapStateCallback).toBeDefined();

    act(() => {
      capturedSwapStateCallback?.({
        event_type: "swap.state",
        data: { model_override: "codex-cli", voice_override_name: null },
      });
    });

    await waitFor(() => expect(result.current.modelOverride).toBe("codex-cli"));
  });

  it("coerces a non-string ack field to null rather than rendering a malformed payload (T-103-32)", async () => {
    mockSendCommand.mockResolvedValue(
      okAck({ model_override: 12345, voice_override_name: "" })
    );
    const { result } = renderHook(() => useGlobalBrainOverride());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.modelOverride).toBeNull());
    expect(result.current.voiceOverride).toBeNull();
  });

  it("degrades to nulls without throwing when rendered outside AstridrWSProvider", () => {
    mockAstridrWSThrows = true;
    let hookResult: ReturnType<typeof useGlobalBrainOverride> | undefined;
    expect(() => {
      const { result } = renderHook(() => useGlobalBrainOverride());
      hookResult = result.current;
    }).not.toThrow();
    expect(hookResult).toEqual({ modelOverride: null, voiceOverride: null });
    expect(mockSendCommand).not.toHaveBeenCalled();
  });
});

describe("useProfileBrainOverrides — snapshot on connect + swap.state push (D-05/D-06)", () => {
  it("sends { type: 'swap.get_state' } once status is connected", async () => {
    renderHook(() => useProfileBrainOverrides());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalled());
    expect(mockSendCommand).toHaveBeenCalledWith({ type: "swap.get_state" });
  });

  it("hydrates the per-profile override map from the swap.get_state ack", async () => {
    mockSendCommand.mockResolvedValue(
      okAck({
        profile_overrides: {
          "assistant-default": { model: "claude-opus-4-8", source: "operator" },
        },
      })
    );
    const { result } = renderHook(() => useProfileBrainOverrides());
    await waitFor(() =>
      expect(result.current).toEqual({
        "assistant-default": { model: "claude-opus-4-8", source: "operator" },
      })
    );
  });

  it("a profile absent from the ack's profile_overrides has no entry in the map (absent, never null)", async () => {
    mockSendCommand.mockResolvedValue(
      okAck({ profile_overrides: { consulting: { model: "codex-cli", source: null } } })
    );
    const { result } = renderHook(() => useProfileBrainOverrides());
    await waitFor(() => expect(result.current.consulting).toBeDefined());
    expect(result.current["assistant-default"]).toBeUndefined();
    expect("assistant-default" in result.current).toBe(false);
  });

  it("updates the map from a live swap.state push", async () => {
    const { result } = renderHook(() => useProfileBrainOverrides());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalled());
    expect(capturedSwapStateCallback).toBeDefined();

    act(() => {
      capturedSwapStateCallback?.({
        event_type: "swap.state",
        data: { profile_overrides: { consulting: { model: "codex-cli", source: null } } },
      });
    });

    await waitFor(() =>
      expect(result.current).toEqual({ consulting: { model: "codex-cli", source: null } })
    );
  });

  it("drops an entry whose model is a non-string, paired with a control entry in the same payload that IS valid and IS kept (T-103-32)", async () => {
    mockSendCommand.mockResolvedValue(
      okAck({
        profile_overrides: {
          "assistant-default": { model: 12345, source: "operator" },
          consulting: { model: "codex-cli", source: null },
        },
      })
    );
    const { result } = renderHook(() => useProfileBrainOverrides());
    await waitFor(() =>
      expect(result.current).toEqual({ consulting: { model: "codex-cli", source: null } })
    );
    expect(result.current["assistant-default"]).toBeUndefined();
  });

  it("leaves the prior value in place on a non-ok ack, rather than clearing a real reading", async () => {
    mockSendCommand.mockResolvedValueOnce(
      okAck({
        profile_overrides: {
          "assistant-default": { model: "claude-opus-4-8", source: "operator" },
        },
      })
    );
    const { result, rerender } = renderHook(() => useProfileBrainOverrides());
    await waitFor(() =>
      expect(result.current).toEqual({
        "assistant-default": { model: "claude-opus-4-8", source: "operator" },
      })
    );

    mockSendCommand.mockResolvedValueOnce({ type: "ack", request_id: "x", status: "error", error: "boom" });
    mockStatus = "disconnected";
    rerender();
    mockStatus = "connected";
    rerender();

    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual({
      "assistant-default": { model: "claude-opus-4-8", source: "operator" },
    });
  });

  it("degrades to an empty map without throwing when rendered outside AstridrWSProvider", () => {
    mockAstridrWSThrows = true;
    let hookResult: ReturnType<typeof useProfileBrainOverrides> | undefined;
    expect(() => {
      const { result } = renderHook(() => useProfileBrainOverrides());
      hookResult = result.current;
    }).not.toThrow();
    expect(hookResult).toEqual({});
    expect(mockSendCommand).not.toHaveBeenCalled();
  });
});

describe("useResolvedBrain — pre-existing override, ZERO swap.state events (2026-07-28 live regression)", () => {
  it("resolves { source: 'global', model } from the swap.get_state ack alone, with no swap.state event ever emitted", async () => {
    mockSendCommand.mockResolvedValue(
      okAck({ model_override: "claude-haiku-4-5-20251001", voice_override_name: null })
    );
    seedEngines([], []);

    const { result } = renderHook(() => useResolvedBrain());

    await waitFor(() => expect(result.current.source).toBe("global"));
    expect(result.current.model).toBe("claude-haiku-4-5-20251001");
    // The regression this test guards against: the badge/pill used to be blind to exactly this
    // case because they only ever subscribed to swap.state and never requested a snapshot.
    expect(capturedSwapStateCallback).toBeDefined();
  });
});

describe("resolveActiveBrain (pure)", () => {
  it("D-06: a pinned profile override wins even while a DIFFERENT global override is simultaneously active (precedence-inversion fix)", () => {
    const result = resolveActiveBrain({
      globalOverride: "claude-haiku-4-5-20251001",
      activeEngines: {},
      profileId: "assistant-default",
      profileOverrides: {
        "assistant-default": { model: "claude-opus-4-8", source: "operator" },
      },
    });
    expect(result).toEqual({
      source: "override",
      model: "claude-opus-4-8",
      mode: "pinned",
      distinctModels: ["claude-opus-4-8"],
    });
  });

  it("CONTROL: with the SAME global override active but NO profile override for this profile, returns source:'global' — precedence below the new rung is unchanged", () => {
    const result = resolveActiveBrain({
      globalOverride: "claude-haiku-4-5-20251001",
      activeEngines: {},
      profileId: "assistant-default",
      profileOverrides: {},
    });
    expect(result).toEqual({
      source: "global",
      model: "claude-haiku-4-5-20251001",
      distinctModels: [],
    });
  });

  it("D-06: a profile override also wins over that profile's own telemetry when no global override is active", () => {
    const activeEngines: ActiveEngineMap = {
      "assistant-default": makeEngine("assistant-default", "anthropic-sonnet-5"),
    };
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines,
      profileId: "assistant-default",
      profileOverrides: {
        "assistant-default": { model: "claude-opus-4-8", source: null },
      },
    });
    expect(result.source).toBe("override");
    expect(result.model).toBe("claude-opus-4-8");
    expect(result.mode).toBe("pinned");
  });

  it("global beats profile even when telemetry is present for that exact profile (BSC-01 trap)", () => {
    const activeEngines: ActiveEngineMap = {
      "assistant-default": makeEngine("assistant-default", "anthropic-sonnet-5"),
    };
    const result = resolveActiveBrain({
      globalOverride: "claude-haiku-4-5-20251001",
      activeEngines,
      profileId: "assistant-default",
    });
    expect(result).toEqual({
      source: "global",
      model: "claude-haiku-4-5-20251001",
      distinctModels: [],
    });
  });

  it("resolves the profile reading (mode/expiresAt included) when no global override is active", () => {
    const activeEngines: ActiveEngineMap = {
      "assistant-default": makeEngine("assistant-default", "anthropic-sonnet-5", {
        mode: "session",
        expiresAt: 1234,
      }),
    };
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines,
      profileId: "assistant-default",
    });
    expect(result.source).toBe("profile");
    expect(result.model).toBe("anthropic-sonnet-5");
    expect(result.mode).toBe("session");
    expect(result.expiresAt).toBe(1234);
  });

  it("resolves mixed when no global override and profiles disagree, with no profileId given", () => {
    const activeEngines: ActiveEngineMap = {
      "assistant-default": makeEngine("assistant-default", "anthropic-sonnet-5"),
      consulting: makeEngine("consulting", "claude-cli-sonnet5"),
    };
    const result = resolveActiveBrain({ globalOverride: null, activeEngines });
    expect(result.source).toBe("mixed");
    expect(result.model).toBeNull();
    expect(result.distinctModels.sort()).toEqual(
      ["anthropic-sonnet-5", "claude-cli-sonnet5"].sort()
    );
  });

  it("resolves none when nothing is reported at all", () => {
    const result = resolveActiveBrain({ globalOverride: null, activeEngines: {} });
    expect(result.source).toBe("none");
    expect(result.model).toBeNull();
  });

  it("resolves none for a supplied profileId with a known-but-unreported (null) engine", () => {
    const activeEngines: ActiveEngineMap = { "assistant-default": null };
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines,
      profileId: "assistant-default",
    });
    expect(result.source).toBe("none");
    expect(result.model).toBeNull();
  });

  // Historical note, corrected (see useLastTurnModel's own docstring): this test originally
  // documented per-profile telemetry as "permanently empty" due to an emitter bug fixed by Phase
  // 108's D-01/D-11. The rung stays in place regardless, because D-03's boot seed makes it nearly
  // (not entirely) unreachable, and it costs nothing where it stays honest (D-07, FLEET-only).
  it("falls back to lastTurn (fleet-wide) when nothing is reported at all and a last-turn model is known", () => {
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines: {},
      lastTurnModel: "claude-sonnet-5",
    });
    expect(result.source).toBe("lastTurn");
    expect(result.model).toBe("claude-sonnet-5");
  });

  it("D-07: a scoped (profileId supplied) read with no telemetry and no override returns 'none', NOT lastTurn — even when a last-turn model is known (another profile's model is not this profile's engine)", () => {
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines: { "assistant-default": null },
      profileId: "assistant-default",
      lastTurnModel: "claude-sonnet-5",
    });
    expect(result.source).toBe("none");
    expect(result.model).toBeNull();
  });

  it("CONTROL: the FLEET read (no profileId) with the SAME lastTurnModel still returns 'lastTurn' — proves the D-07 restriction is scope-specific, not a removal of the rung", () => {
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines: {},
      lastTurnModel: "claude-sonnet-5",
    });
    expect(result.source).toBe("lastTurn");
    expect(result.model).toBe("claude-sonnet-5");
  });

  it("still resolves none, not lastTurn, when no last-turn model has been observed either", () => {
    const result = resolveActiveBrain({ globalOverride: null, activeEngines: {}, lastTurnModel: null });
    expect(result.source).toBe("none");
    expect(result.model).toBeNull();
  });

  it("a real profile reading still wins over lastTurn (lastTurn is the last rung, not a preference)", () => {
    const activeEngines: ActiveEngineMap = {
      "assistant-default": makeEngine("assistant-default", "anthropic-sonnet-5"),
    };
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines,
      profileId: "assistant-default",
      lastTurnModel: "claude-sonnet-5",
    });
    expect(result.source).toBe("profile");
    expect(result.model).toBe("anthropic-sonnet-5");
  });

  it("a global override still wins over lastTurn", () => {
    const result = resolveActiveBrain({
      globalOverride: "claude-haiku-4-5-20251001",
      activeEngines: {},
      lastTurnModel: "claude-sonnet-5",
    });
    expect(result.source).toBe("global");
    expect(result.model).toBe("claude-haiku-4-5-20251001");
  });
});

describe("useLastTurnModel / useResolvedBrain — honest-absent-state fallback (2026-07-31 live finding)", () => {
  it("useLastTurnModel starts null and updates from a live run.completed push", async () => {
    const { result } = renderHook(() => useLastTurnModel());
    expect(result.current).toBeNull();
    expect(capturedRunCompletedCallback).toBeDefined();

    act(() => {
      capturedRunCompletedCallback?.({
        event_type: "run.completed",
        data: { session_id: "s1", model: "claude-sonnet-5" },
      });
    });

    await waitFor(() => expect(result.current).toBe("claude-sonnet-5"));
  });

  it("useLastTurnModel keeps the last real model through a fast-path turn with no/empty model", async () => {
    const { result } = renderHook(() => useLastTurnModel());

    act(() => {
      capturedRunCompletedCallback?.({ event_type: "run.completed", data: { model: "claude-sonnet-5" } });
    });
    await waitFor(() => expect(result.current).toBe("claude-sonnet-5"));

    act(() => {
      capturedRunCompletedCallback?.({ event_type: "run.completed", data: { model: "" } });
    });
    expect(result.current).toBe("claude-sonnet-5");
  });

  it("useResolvedBrain resolves { source: 'lastTurn' } instead of blanking to 'none' once a turn has completed, with no per-profile telemetry ever reported", async () => {
    seedEngines([], []);
    const { result } = renderHook(() => useResolvedBrain());
    await waitFor(() => expect(result.current.source).toBe("none"));

    act(() => {
      capturedRunCompletedCallback?.({
        event_type: "run.completed",
        data: { model: "claude-sonnet-5" },
      });
    });

    await waitFor(() => expect(result.current.source).toBe("lastTurn"));
    expect(result.current.model).toBe("claude-sonnet-5");
  });
});
