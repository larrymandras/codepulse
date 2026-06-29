/**
 * Prompt-cache monitoring — unit tests.
 *
 * Mirrors two pieces of real logic (convex-test is not installed in this repo,
 * matching the runtimeIngest.test.ts convention):
 *   (a) runtimeIngest llm_call cache-field coalescing (camelCase + snake_case)
 *   (b) llm.cacheStats hit-rate aggregation (Anthropic-only, ratio math)
 */
import { describe, it, expect } from "vitest";

// (a) mirrors runtimeIngest.ts llm_call branch
function coalesceCacheFields(d: Record<string, any>) {
  return {
    cacheReadInputTokens: d.cacheReadInputTokens ?? d.cache_read_input_tokens,
    cacheCreationInputTokens: d.cacheCreationInputTokens ?? d.cache_creation_input_tokens,
  };
}

// (b) mirrors llm.ts cacheStats handler
type Row = {
  provider: string;
  promptTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
};
function cacheStats(rows: Row[]) {
  let read = 0, creation = 0, uncached = 0, calls = 0;
  for (const r of rows) {
    if (!r.provider.startsWith("anthropic")) continue;
    calls++;
    read += r.cacheReadInputTokens ?? 0;
    creation += r.cacheCreationInputTokens ?? 0;
    uncached += r.promptTokens ?? 0;
  }
  const totalPrompt = read + creation + uncached;
  return {
    calls,
    cacheReadInputTokens: read,
    cacheCreationInputTokens: creation,
    uncachedInputTokens: uncached,
    totalPromptTokens: totalPrompt,
    hitRate: totalPrompt > 0 ? read / totalPrompt : 0,
  };
}

describe("llm_call cache-field coalescing", () => {
  it("reads camelCase from Ástríðr telemetry", () => {
    expect(coalesceCacheFields({ cacheReadInputTokens: 8402, cacheCreationInputTokens: 0 }))
      .toEqual({ cacheReadInputTokens: 8402, cacheCreationInputTokens: 0 });
  });
  it("falls back to snake_case", () => {
    expect(coalesceCacheFields({ cache_read_input_tokens: 100, cache_creation_input_tokens: 25 }))
      .toEqual({ cacheReadInputTokens: 100, cacheCreationInputTokens: 25 });
  });
  it("leaves fields undefined when absent (Convex optional, never null)", () => {
    expect(coalesceCacheFields({})).toEqual({
      cacheReadInputTokens: undefined,
      cacheCreationInputTokens: undefined,
    });
  });
});

describe("cacheStats hit rate", () => {
  it("computes read / total-prompt and ignores non-anthropic providers", () => {
    const s = cacheStats([
      { provider: "anthropic_advisor", promptTokens: 20, cacheReadInputTokens: 8402, cacheCreationInputTokens: 0 },
      { provider: "anthropic_direct", promptTokens: 100, cacheReadInputTokens: 0, cacheCreationInputTokens: 1000 },
      { provider: "openrouter", promptTokens: 5000 }, // ignored — no Anthropic caching
    ]);
    expect(s.calls).toBe(2);
    expect(s.cacheReadInputTokens).toBe(8402);
    expect(s.cacheCreationInputTokens).toBe(1000);
    expect(s.uncachedInputTokens).toBe(120);
    expect(s.totalPromptTokens).toBe(9522);
    expect(s.hitRate).toBeCloseTo(8402 / 9522, 6);
  });
  it("is 0 with no anthropic traffic (no divide-by-zero)", () => {
    expect(cacheStats([{ provider: "openrouter", promptTokens: 100 }]).hitRate).toBe(0);
    expect(cacheStats([]).hitRate).toBe(0);
  });
});
