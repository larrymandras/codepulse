import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(resolve(__dirname, "../configApi.ts"), "utf-8");

describe("configApi.costGuardrailConfig", () => {
  it("bug_005_wraps_query_in_try_catch", () => {
    // The runQuery call should be inside a try-catch to return structured errors
    const queryCall = src.indexOf("ctx.runQuery(api.forecasts.getCostGuardrails)");
    expect(queryCall).toBeGreaterThan(-1);

    // Check that a try block precedes the query call
    const beforeQuery = src.slice(0, queryCall);
    const lastTry = beforeQuery.lastIndexOf("try {");
    const lastCatch = beforeQuery.lastIndexOf("catch");
    // There should be a try that hasn't been closed by a catch before the query
    expect(lastTry).toBeGreaterThan(-1);
    expect(lastTry).toBeGreaterThan(lastCatch);
  });
});
