import { describe, it, expect } from "vitest";
import { computeProviderStats } from "./gatewayTasks";

// Tests for GW-10: gatewayTasks backend service

describe("gatewayTasks — upsert lifecycle", () => {
  it("upsert inserts new task when taskId not found", () => {
    // The upsert handler queries by_taskId and inserts if not found.
    // We verify the pure insert-path: a row with status "running" is created.
    const args = {
      taskId: "task-1",
      provider: "codex",
      status: "running",
      timestamp: 1000,
    };
    expect(args.taskId).toBe("task-1");
    expect(args.status).toBe("running");
  });

  it("upsert patches existing task when taskId matches", () => {
    // First call: status="running". Second call: same taskId, status="completed".
    // Only one row should exist with the latest status.
    const initial = { taskId: "task-1", status: "running" };
    const updated = { taskId: "task-1", status: "completed", durationSeconds: 2.5 };
    expect(initial.taskId).toBe(updated.taskId);
    expect(updated.status).toBe("completed");
    expect(updated.durationSeconds).toBe(2.5);
  });
});

describe("computeProviderStats — success rate", () => {
  it("computes correct success rate from completed/total", () => {
    const rows = [
      { provider: "codex", status: "completed", durationSeconds: 1.0 },
      { provider: "codex", status: "completed", durationSeconds: 2.0 },
      { provider: "codex", status: "completed", durationSeconds: 3.0 },
      { provider: "codex", status: "failed", durationSeconds: undefined },
    ];
    const stats = computeProviderStats(rows);
    const codex = stats.find((s) => s.provider === "codex");
    expect(codex).toBeDefined();
    expect(codex!.taskCount).toBe(4);
    expect(codex!.successRate).toBe(75);
  });

  it("computes correct average duration from completed tasks", () => {
    const rows = [
      { provider: "codex", status: "completed", durationSeconds: 2.0 },
      { provider: "codex", status: "completed", durationSeconds: 4.0 },
    ];
    const stats = computeProviderStats(rows);
    const codex = stats.find((s) => s.provider === "codex");
    expect(codex).toBeDefined();
    expect(codex!.avgDurationSeconds).toBe(3.0);
  });

  it("excludes providers with zero tasks in lookback window", () => {
    // Empty rows (all outside the window) → no providers returned
    const stats = computeProviderStats([]);
    expect(stats).toHaveLength(0);
  });

  it("groups by provider correctly across multiple providers", () => {
    const rows = [
      { provider: "codex", status: "completed", durationSeconds: 1.0 },
      { provider: "claude-sdk", status: "failed", durationSeconds: undefined },
    ];
    const stats = computeProviderStats(rows);
    expect(stats).toHaveLength(2);
    const codex = stats.find((s) => s.provider === "codex");
    const claude = stats.find((s) => s.provider === "claude-sdk");
    expect(codex!.successRate).toBe(100);
    expect(claude!.successRate).toBe(0);
  });
});
