import { describe, test, expect } from "vitest";
import { TOOLS, assembleBlocks } from "../insightsChat";

describe("insightsChat — TOOLS schema", () => {
  test("TOOLS has 5 entries", () => {
    expect(TOOLS).toHaveLength(5);
  });

  test("each tool has type: 'function'", () => {
    for (const tool of TOOLS) {
      expect(tool.type).toBe("function");
    }
  });

  test("each tool has a function.name string", () => {
    for (const tool of TOOLS) {
      expect(typeof tool.function.name).toBe("string");
      expect(tool.function.name.length).toBeGreaterThan(0);
    }
  });

  test("each tool function.parameters has type: 'object' (valid JSON Schema)", () => {
    for (const tool of TOOLS) {
      expect(tool.function.parameters.type).toBe("object");
    }
  });

  test("tool names are the expected set", () => {
    const names = TOOLS.map((t) => t.function.name);
    expect(names).toContain("cost_summary");
    expect(names).toContain("error_counts");
    expect(names).toContain("agent_status");
    expect(names).toContain("session_list");
    expect(names).toContain("alert_summary");
  });
});

describe("insightsChat — assembleBlocks", () => {
  test("cost_summary returns a metric block", () => {
    const result = assembleBlocks("cost_summary", { totalCost: 42.5 });
    expect(result.type).toBe("metric");
    expect(result.label).toBe("Total Cost");
    expect(result.value).toBe(42.5);
  });

  test("error_counts returns a metric block", () => {
    const result = assembleBlocks("error_counts", { errorCount: 3, total: 10 });
    expect(result.type).toBe("metric");
    expect(result.label).toBe("Error Count");
    expect(result.value).toBe(3);
  });

  test("agent_status returns a table block", () => {
    const result = assembleBlocks("agent_status", {
      agents: [{ name: "Bot", status: "active", lastSeen: "2026-04-13" }],
    });
    expect(result.type).toBe("table");
    expect(result.columns).toEqual(["Agent", "Status", "Last Seen"]);
    expect(Array.isArray(result.rows)).toBe(true);
    expect((result.rows as unknown[][])[0]).toEqual(["Bot", "active", "2026-04-13"]);
  });

  test("session_list returns a table block", () => {
    const result = assembleBlocks("session_list", {
      sessions: [{ id: "s-001", status: "completed", agent: "gpt-4o" }],
    });
    expect(result.type).toBe("table");
    expect(result.columns).toEqual(["Session", "Status", "Agent"]);
    expect((result.rows as unknown[][])[0]).toEqual(["s-001", "completed", "gpt-4o"]);
  });

  test("alert_summary returns a metric block", () => {
    const result = assembleBlocks("alert_summary", { unread: 2, total: 5 });
    expect(result.type).toBe("metric");
    expect(result.label).toBe("Active Alerts");
  });

  test("unknown_tool returns a markdown fallback block", () => {
    const result = assembleBlocks("unknown_tool", {});
    expect(result.type).toBe("markdown");
    expect(typeof result.content).toBe("string");
  });
});
