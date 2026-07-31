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
 * ack and its `swap.state` event push (via the mocked `subscribeEvent`), which is the live
 * transport regardless of `VITE_BRAINS_STUB`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useGlobalBrainOverride,
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

function okAck(overrides: { model_override?: unknown; voice_override_name?: unknown } = {}) {
  return {
    type: "ack",
    request_id: "x",
    status: "ok",
    model_override: null,
    voice_override_name: null,
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

  // 2026-07-31 live finding: per-profile telemetry (activeEngineSnapshots) is permanently empty
  // because astridr-repo's router.py emitter never sends profileId/uses a different key name
  // than the Convex ingest expects (untracked "Astridr Phase 184.1" per 103-CONTRACT.md) — so in
  // production, activeEngines is ALWAYS {} and every profile/mixed reading falls straight to
  // "none" today. lastTurnModel is the fallback that keeps the badge honest instead of blank.
  it("falls back to lastTurn (fleet-wide) when nothing is reported at all and a last-turn model is known", () => {
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines: {},
      lastTurnModel: "claude-sonnet-5",
    });
    expect(result.source).toBe("lastTurn");
    expect(result.model).toBe("claude-sonnet-5");
  });

  it("falls back to lastTurn for a supplied profileId with no reported engine but a known last-turn model", () => {
    const result = resolveActiveBrain({
      globalOverride: null,
      activeEngines: { "assistant-default": null },
      profileId: "assistant-default",
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

describe("useLastTurnModel / useResolvedBrain — 'No brain reported' fallback (2026-07-31 live finding)", () => {
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
