import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }));
vi.mock("../../convex/_generated/api", () => ({
  api: { forge: { listForgeCommands: "mock-listForgeCommands", listJobs: "mock-listJobs" } },
}));

import { useForgeCommands } from "./useForge";

// Raw Convex forgeCommands doc shape (adaptCommand maps these).
const rawDoc = (over: Record<string, unknown> = {}) => ({
  commandId: "c1",
  commandType: "launch",
  status: "queued",
  hostId: "h1",
  resolvedForgeJobId: null,
  createdAt: 1000,
  ...over,
});

describe("useForgeCommands — job-list command filter (FORGE-QUEUED-CARDS bug)", () => {
  beforeEach(() => mockUseQuery.mockReset());

  it("returns only launch commands — a done lifecycle/intake command never leaks in", () => {
    // Regression for the permanent 'Queued…' cards: lifecycle/intake commands
    // never get a resolvedForgeJobId, so ForgeJobList.visiblePendingRows can't
    // reconcile them away, and their `done` status maps to "pending" → they'd
    // render forever. The job list must surface launch commands only.
    mockUseQuery.mockReturnValue([
      rawDoc({ commandId: "launch-1", commandType: "launch", status: "queued" }),
      rawDoc({ commandId: "life-done", commandType: "lifecycle", status: "done" }),
      rawDoc({ commandId: "intake-done", commandType: "intake", status: "done" }),
    ]);
    const { result } = renderHook(() => useForgeCommands(null));
    expect(result.current.commands.map((c) => c.commandId)).toEqual(["launch-1"]);
  });

  it("returns [] during load (query undefined)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { result } = renderHook(() => useForgeCommands(null));
    expect(result.current.commands).toEqual([]);
  });
});
