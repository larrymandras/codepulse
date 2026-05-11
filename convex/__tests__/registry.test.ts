import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(resolve(__dirname, "../registry.ts"), "utf-8");

describe("registry.syncInventory", () => {
  it("bug_004_mcpServers_loop_uses_map_lookup_not_query", () => {
    // The mcpServers for-loop should use a Map from the collected data,
    // not issue a separate ctx.db.query("mcpServers") per iteration.
    const loopStart = src.indexOf('for (const server of snap.mcpServers)');
    expect(loopStart).toBeGreaterThan(-1);

    // Find the closing of this for-loop block (next section marker or detect removed)
    const loopEnd = src.indexOf("Detect removed MCP servers", loopStart);
    const loopBlock = src.slice(loopStart, loopEnd);

    // There should be NO ctx.db.query("mcpServers") inside the loop
    expect(loopBlock).not.toContain('query("mcpServers")');
  });
});
