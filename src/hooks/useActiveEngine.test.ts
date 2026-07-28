/**
 * useActiveEngine.test.ts — 103-03-T1.
 *
 * `deriveMixedState` is tested directly as a pure function (no Convex runtime
 * needed). The `useActiveEngine` hook-level cases mock `convex/react`'s
 * `useQuery`, following this repo's existing hook-test idiom
 * (src/hooks/useSavedViews.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { deriveMixedState, useActiveEngine, type ActiveEngineMap } from "./useActiveEngine";
import type { ActiveEngine } from "../lib/brainsApi";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// deriveMixedState (pure)
// ---------------------------------------------------------------------------

describe("deriveMixedState", () => {
  it("reports mixed=true and both distinct model values for two profiles on different models", () => {
    const engines: ActiveEngineMap = {
      "assistant-default": makeEngine("assistant-default", "anthropic-sonnet-5"),
      consulting: makeEngine("consulting", "claude-cli-sonnet5"),
    };

    const result = deriveMixedState(engines);

    expect(result.mixed).toBe(true);
    expect(result.distinctModels.sort()).toEqual(
      ["anthropic-sonnet-5", "claude-cli-sonnet5"].sort()
    );
    expect(result.single).toBeUndefined();
  });

  it("reports mixed=false and the single agreed model when all profiles agree", () => {
    const engines: ActiveEngineMap = {
      "assistant-default": makeEngine("assistant-default", "anthropic-sonnet-5"),
      consulting: makeEngine("consulting", "anthropic-sonnet-5"),
    };

    const result = deriveMixedState(engines);

    expect(result.mixed).toBe(false);
    expect(result.distinctModels).toEqual(["anthropic-sonnet-5"]);
    expect(result.single?.model).toBe("anthropic-sonnet-5");
  });

  it("reports mixed=false and no engine for an empty map, and never throws", () => {
    expect(() => deriveMixedState({})).not.toThrow();

    const result = deriveMixedState({});

    expect(result.mixed).toBe(false);
    expect(result.distinctModels).toEqual([]);
    expect(result.single).toBeUndefined();
  });

  it("excludes null (unreported) entries from the model comparison", () => {
    const engines: ActiveEngineMap = {
      "assistant-default": makeEngine("assistant-default", "anthropic-sonnet-5"),
      consulting: null,
    };

    const result = deriveMixedState(engines);

    expect(result.mixed).toBe(false);
    expect(result.distinctModels).toEqual(["anthropic-sonnet-5"]);
  });
});

// ---------------------------------------------------------------------------
// useActiveEngine (hook)
// ---------------------------------------------------------------------------

describe("useActiveEngine", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("returns an empty object (not undefined) while the query is loading", () => {
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useActiveEngine());

    expect(result.current).toEqual({});
  });

  it("returns an empty object (not undefined) for an empty query result", () => {
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "activeEngine:latestByProfile") return [];
      if (queryRef === "profiles:listConfigs") return [];
      return undefined;
    });

    const { result } = renderHook(() => useActiveEngine());

    expect(result.current).toEqual({});
  });

  it("keys the map by profileId with the server-reported engine", () => {
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "activeEngine:latestByProfile") {
        return [makeEngine("assistant-default", "anthropic-sonnet-5")];
      }
      if (queryRef === "profiles:listConfigs") {
        return [{ profileId: "assistant-default" }];
      }
      return undefined;
    });

    const { result } = renderHook(() => useActiveEngine());

    expect(result.current["assistant-default"]?.model).toBe("anthropic-sonnet-5");
  });

  it("includes a profile present in profileConfigs but absent from telemetry as a null-valued key, not a missing key", () => {
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "activeEngine:latestByProfile") return [];
      if (queryRef === "profiles:listConfigs") return [{ profileId: "consulting" }];
      return undefined;
    });

    const { result } = renderHook(() => useActiveEngine());

    expect("consulting" in result.current).toBe(true);
    expect(result.current.consulting).toBeNull();
  });

  it("never returns undefined for the whole map even with mixed loading states", () => {
    mockUseQuery.mockImplementation((queryRef: unknown) => {
      if (queryRef === "activeEngine:latestByProfile") return undefined;
      if (queryRef === "profiles:listConfigs") return [{ profileId: "assistant-default" }];
      return undefined;
    });

    const { result } = renderHook(() => useActiveEngine());

    expect(result.current).toBeDefined();
    expect(result.current["assistant-default"]).toBeNull();
  });
});
