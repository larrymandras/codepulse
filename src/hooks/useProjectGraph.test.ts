/**
 * useProjectGraph hook tests (Phase 84, plan 01)
 *
 * Verifies the raw three-state Convex passthrough:
 *   (1) undefined → loading (Convex not yet resolved)
 *   (2) null      → no snapshot ingested
 *   (3) object    → live data returned verbatim (same reference)
 *   (4) snapshotId forwarding — with/without
 *
 * convex/react is mocked — no Convex backend required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — must be declared before the import that uses them
// ---------------------------------------------------------------------------

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    graphSnapshots: {
      getProjectGraph: "graphSnapshots:getProjectGraph",
    },
  },
}));

import { useQuery } from "convex/react";
import { useProjectGraph } from "./useProjectGraph";

const mockUseQuery = vi.mocked(useQuery);

describe("useProjectGraph", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("returns undefined when useQuery returns undefined (loading state)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useProjectGraph());
    expect(result.current).toBeUndefined();
  });

  it("returns null when useQuery returns null (no snapshot ingested)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockUseQuery as any).mockReturnValue(null);
    const { result } = renderHook(() => useProjectGraph());
    expect(result.current).toBeNull();
  });

  it("returns the snapshot object verbatim when useQuery resolves to data", () => {
    const snapshotData = {
      snapshotId: "astridr-project-graph",
      sources: [
        {
          source: "graphify:codepulse:",
          kind: "graphify",
          nodeCount: 10,
          linkCount: 8,
          emittedNodeCount: 10,
          emittedLinkCount: 8,
          truncated: false,
        },
      ],
      nodeCount: 10,
      linkCount: 8,
      storedNodeCount: 10,
      storedLinkCount: 8,
      generatedAt: Date.now() / 1000,
      nodes: [{ id: "a.ts", label: "a.ts", type: "file", community: null, source: "graphify:codepulse:" }],
      links: [],
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockUseQuery as any).mockReturnValue(snapshotData);
    const { result } = renderHook(() => useProjectGraph());
    // Same reference — no wrapping/unwrapping
    expect(result.current).toBe(snapshotData);
  });

  it("forwards { snapshotId } as query arg when snapshotId is provided", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useProjectGraph("my-snapshot"));
    const calls = mockUseQuery.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toEqual({ snapshotId: "my-snapshot" });
  });

  it("forwards {} as query arg when snapshotId is omitted", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderHook(() => useProjectGraph());
    const calls = mockUseQuery.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toEqual({});
  });
});
