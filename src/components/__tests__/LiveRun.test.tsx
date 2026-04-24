import { describe, it, expect } from "vitest";
import { appendBlocksWithDedup } from "../../pages/LiveRun";

describe("appendBlocksWithDedup", () => {
  it("keeps text blocks from run.blocks", () => {
    const result = appendBlocksWithDedup([], [{ type: "text", text: "hello" }]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("text");
  });

  it("drops tool_use blocks from run.blocks", () => {
    const result = appendBlocksWithDedup([], [
      { type: "text", text: "hi" },
      { type: "tool_use", name: "search", arguments: {} },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("text");
  });

  it("drops tool_result blocks from run.blocks", () => {
    const result = appendBlocksWithDedup([], [
      { type: "tool_result", tool_call_id: "tc_1", result: "data" },
    ]);
    expect(result).toHaveLength(0);
  });

  it("caps at BLOCK_CAP (500)", () => {
    const existing = Array.from({ length: 498 }, (_, i) => ({
      type: "text",
      text: `block-${i}`,
    }));
    const incoming = [
      { type: "text", text: "new-1" },
      { type: "text", text: "new-2" },
      { type: "text", text: "new-3" },
    ];
    const result = appendBlocksWithDedup(existing, incoming);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});
