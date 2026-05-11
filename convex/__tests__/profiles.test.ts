import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(resolve(__dirname, "../profiles.ts"), "utf-8");

describe("profiles.recordMetrics", () => {
  it("bug_003_recordMetrics_calls_requireAuth", () => {
    // Extract the recordMetrics handler block from source
    const mutationStart = src.indexOf("export const recordMetrics");
    expect(mutationStart).toBeGreaterThan(-1);

    // Get the handler body (from 'handler:' to the next 'export const' or end)
    const handlerStart = src.indexOf("handler:", mutationStart);
    const nextExport = src.indexOf("export const", mutationStart + 1);
    const handlerBlock = src.slice(handlerStart, nextExport > -1 ? nextExport : undefined);

    expect(handlerBlock).toContain("requireAuth");
  });
});
