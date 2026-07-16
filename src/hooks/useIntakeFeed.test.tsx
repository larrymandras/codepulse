import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }));
vi.mock("../../convex/_generated/api", () => ({
  api: { forge: { listIntakeCommands: "mock-listIntakeCommands" } },
}));

import { useIntakeFeed, formatCountdown } from "./useIntakeFeed";
import type { IntakeCommandRow } from "./useIntake";

const serverRow = (over: Partial<IntakeCommandRow> = {}): IntakeCommandRow => ({
  commandId: "cmd-1",
  status: "queued",
  hostId: "h1",
  destination: "global",
  workspaceId: null,
  storageId: null,
  githubUrl: "https://github.com/acme/repo",
  subpath: null,
  fileName: null,
  report: null,
  error: null,
  createdAt: 1000,
  expiresAt: 999999,
  ...over,
});

// The hook consumes useIntakeCommandsRaw, which maps raw Convex docs through
// adaptIntakeCommand — feed it raw-doc-shaped objects.
const rawDoc = (over: Record<string, unknown> = {}) => ({
  commandId: "cmd-1",
  status: "queued",
  hostId: "h1",
  intakePayload: { destination: "global", githubUrl: "https://github.com/acme/repo" },
  createdAt: 1000,
  expiresAt: 999999,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIntakeFeed", () => {
  it("isLoading while the query is undefined and nothing is pending locally", () => {
    const { result } = renderHook(() => useIntakeFeed());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows).toEqual([]);
  });

  it("handleEnqueued prepends an optimistic row immediately", () => {
    mockUseQuery.mockReturnValue([]);
    const { result } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ status: "pending", fileName: "SKILL.md" })));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].status).toBe("pending");
    expect(result.current.activeCount).toBe(1);
  });

  it("handleEnqueueFailed flips the optimistic row to failed with the reason", () => {
    mockUseQuery.mockReturnValue([]);
    const { result } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ status: "pending" })));
    act(() => result.current.handleEnqueueFailed("cmd-1", "network down"));
    expect(result.current.rows[0].status).toBe("failed");
    expect(result.current.rows[0].error).toBe("network down");
  });

  it("drops the optimistic row once a server row shares its commandId", () => {
    mockUseQuery.mockReturnValue([]);
    const { result, rerender } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ status: "pending", fileName: "SKILL.md" })));
    mockUseQuery.mockReturnValue([rawDoc()]);
    rerender();
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].status).toBe("queued");
  });

  it("labelFor remembers the uploaded filename after the server row (fileName null) wins", () => {
    mockUseQuery.mockReturnValue([]);
    const { result, rerender } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ status: "pending", fileName: "SKILL.md" })));
    mockUseQuery.mockReturnValue([rawDoc()]);
    rerender();
    expect(result.current.labelFor(result.current.rows[0])).toBe("SKILL.md");
  });

  it("labelFor falls back to the repo label for GitHub rows", () => {
    mockUseQuery.mockReturnValue([rawDoc({ intakePayload: { destination: "global", githubUrl: "https://github.com/acme/repo", subpath: "skills/foo" } })]);
    const { result } = renderHook(() => useIntakeFeed());
    expect(result.current.labelFor(result.current.rows[0])).toBe("acme/repo skills/foo");
  });

  it("caps merged rows at 20", () => {
    mockUseQuery.mockReturnValue(
      Array.from({ length: 20 }, (_, i) => rawDoc({ commandId: `srv-${i}` }))
    );
    const { result } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ commandId: "local-1", status: "pending" })));
    expect(result.current.rows).toHaveLength(20);
    expect(result.current.rows[0].commandId).toBe("local-1");
  });

  it("does not run the 1 Hz tick without a queued row, runs it with one", () => {
    vi.useFakeTimers();
    mockUseQuery.mockReturnValue([rawDoc({ status: "done" })]);
    const { result, rerender } = renderHook(() => useIntakeFeed());
    const before = result.current.now;
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current.now).toBe(before);
    mockUseQuery.mockReturnValue([rawDoc({ status: "queued" })]);
    rerender();
    act(() => void vi.advanceTimersByTime(1100));
    expect(result.current.now).toBeGreaterThan(before);
  });
});

describe("formatCountdown", () => {
  it("formats m:ss and clamps at 0:00", () => {
    expect(formatCountdown(125000)).toBe("2:05");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});
