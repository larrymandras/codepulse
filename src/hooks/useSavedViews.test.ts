/**
 * Wave 0 unit tests for useSavedViews hook (KG-10).
 *
 * Tests:
 * 1. saveView strips searchQuery from persisted filters (D-06)
 * 2. saveView passes a truthy shareToken to the mutation
 * 3. buildShareUrl returns /knowledge-graph?view=<token> shape (D-03)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { KgLens, KgFilters } from "./useKnowledgeGraph";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock convex/react — useQuery returns an empty array (Convex loaded)
// useMutation returns a spy that resolves immediately
const mockSaveMutation = vi.fn().mockResolvedValue("fake-id");
const mockRemoveMutation = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn((fn: unknown) => {
    // Distinguish save vs remove by inspecting the fn reference identity.
    // We key on the string representation since the api object is mocked below.
    const fnStr = String(fn);
    if (fnStr.includes("remove")) return mockRemoveMutation;
    return mockSaveMutation;
  }),
}));

// Mock the generated api — only the savedKgViews namespace is needed
vi.mock("../../convex/_generated/api", () => ({
  api: {
    savedKgViews: {
      list: "savedKgViews:list",
      save: "savedKgViews:save",
      remove: "savedKgViews:remove",
    },
  },
}));

// Mock sonner — we don't want real toasts in tests
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sampleFilters: KgFilters = {
  entityType: "person",
  predicate: "knows",
  agentId: null,
  entityName: "Alice",
  hops: 2,
  asOf: null,
  limit: 50,
  searchQuery: "some ephemeral search text",  // must NOT appear in persisted filters
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSavedViews", () => {
  beforeEach(() => {
    mockSaveMutation.mockClear();
    mockRemoveMutation.mockClear();

    // Stub window.location.origin for buildShareUrl tests
    Object.defineProperty(window, "location", {
      value: { origin: "https://codepulse.example.com" },
      writable: true,
      configurable: true,
    });

    // Stub crypto.randomUUID for deterministic shareToken in tests
    Object.defineProperty(global, "crypto", {
      value: { randomUUID: vi.fn(() => "test-uuid-1234") },
      writable: true,
      configurable: true,
    });
  });

  // -------------------------------------------------------------------------
  // Test 1: searchQuery is excluded from persisted filters (D-06)
  // -------------------------------------------------------------------------
  it("saveView passes filters object WITHOUT searchQuery key to the mutation", async () => {
    const { useSavedViews } = await import("./useSavedViews");
    const { result } = renderHook(() => useSavedViews());

    await act(async () => {
      await result.current.saveView(
        "My View",
        "entity" as KgLens,
        sampleFilters,
        "Alice",
        2,
      );
    });

    expect(mockSaveMutation).toHaveBeenCalledOnce();
    const callArgs = mockSaveMutation.mock.calls[0][0];

    // The persisted filters must NOT contain searchQuery
    expect(callArgs.filters).not.toHaveProperty("searchQuery");

    // The other filter fields should be preserved
    expect(callArgs.filters.entityType).toBe("person");
    expect(callArgs.filters.entityName).toBe("Alice");
    expect(callArgs.filters.hops).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Test 2: saveView passes a truthy shareToken to the mutation (D-03)
  // -------------------------------------------------------------------------
  it("saveView passes a truthy shareToken string to the mutation", async () => {
    const { useSavedViews } = await import("./useSavedViews");
    const { result } = renderHook(() => useSavedViews());

    await act(async () => {
      await result.current.saveView(
        "View With Token",
        "overview" as KgLens,
        sampleFilters,
        "",
        1,
      );
    });

    expect(mockSaveMutation).toHaveBeenCalledOnce();
    const callArgs = mockSaveMutation.mock.calls[0][0];

    // shareToken must be a non-empty string
    expect(typeof callArgs.shareToken).toBe("string");
    expect(callArgs.shareToken.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test 3: buildShareUrl returns correct shape (D-03)
  // -------------------------------------------------------------------------
  it("buildShareUrl returns a URL ending with /knowledge-graph?view=<token>", async () => {
    const { useSavedViews } = await import("./useSavedViews");
    const { result } = renderHook(() => useSavedViews());

    const url = result.current.buildShareUrl("abc");
    expect(url).toMatch(/\/knowledge-graph\?view=abc$/);
    expect(url).toBe("https://codepulse.example.com/knowledge-graph?view=abc");
  });
});
