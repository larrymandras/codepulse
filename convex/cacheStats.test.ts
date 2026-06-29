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

// (b) mirrors llm.ts cacheStats handler (overall + per-model)
type Row = {
  provider: string;
  model?: string;
  promptTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
};
type Acc = { calls: number; read: number; creation: number; uncached: number };
function shape(a: Acc) {
  const total = a.read + a.creation + a.uncached;
  return {
    calls: a.calls,
    cacheReadInputTokens: a.read,
    cacheCreationInputTokens: a.creation,
    uncachedInputTokens: a.uncached,
    totalPromptTokens: total,
    hitRate: total > 0 ? a.read / total : 0,
  };
}
function cacheStats(rows: Row[]) {
  const overall: Acc = { calls: 0, read: 0, creation: 0, uncached: 0 };
  const perModel: Record<string, Acc> = {};
  for (const r of rows) {
    if (!r.provider.startsWith("anthropic")) continue;
    const read = r.cacheReadInputTokens ?? 0;
    const creation = r.cacheCreationInputTokens ?? 0;
    const uncached = r.promptTokens ?? 0;
    overall.calls++; overall.read += read; overall.creation += creation; overall.uncached += uncached;
    const key = r.model ?? "unknown";
    if (!perModel[key]) perModel[key] = { calls: 0, read: 0, creation: 0, uncached: 0 };
    const m = perModel[key];
    m.calls++; m.read += read; m.creation += creation; m.uncached += uncached;
  }
  const byModel = Object.entries(perModel)
    .map(([model, a]) => ({ model, ...shape(a) }))
    .sort((x, y) => y.totalPromptTokens - x.totalPromptTokens);
  return { overall: shape(overall), byModel };
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
  it("computes overall read / total-prompt and ignores non-anthropic providers", () => {
    const s = cacheStats([
      { provider: "anthropic_advisor", model: "claude-sonnet-4-6", promptTokens: 20, cacheReadInputTokens: 8402, cacheCreationInputTokens: 0 },
      { provider: "anthropic_direct", model: "claude-sonnet-4-6", promptTokens: 100, cacheReadInputTokens: 0, cacheCreationInputTokens: 1000 },
      { provider: "openrouter", model: "gpt-4.1", promptTokens: 5000 }, // ignored — no Anthropic caching
    ]);
    expect(s.overall.calls).toBe(2);
    expect(s.overall.cacheReadInputTokens).toBe(8402);
    expect(s.overall.cacheCreationInputTokens).toBe(1000);
    expect(s.overall.uncachedInputTokens).toBe(120);
    expect(s.overall.totalPromptTokens).toBe(9522);
    expect(s.overall.hitRate).toBeCloseTo(8402 / 9522, 6);
  });
  it("breaks down per model, sorted by total prompt tokens desc", () => {
    const s = cacheStats([
      { provider: "anthropic_advisor", model: "claude-sonnet-4-6", promptTokens: 100, cacheReadInputTokens: 9000 },
      { provider: "anthropic_advisor", model: "claude-haiku-4-5", promptTokens: 6000, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
    ]);
    expect(s.byModel.map((m) => m.model)).toEqual(["claude-sonnet-4-6", "claude-haiku-4-5"]);
    const sonnet = s.byModel.find((m) => m.model === "claude-sonnet-4-6")!;
    const haiku = s.byModel.find((m) => m.model === "claude-haiku-4-5")!;
    expect(sonnet.hitRate).toBeCloseTo(9000 / 9100, 6); // main agent caches
    expect(haiku.hitRate).toBe(0); // classifier: prefix below cache minimum
  });
  it("is 0 with no anthropic traffic (no divide-by-zero)", () => {
    expect(cacheStats([{ provider: "openrouter", model: "gpt-4.1", promptTokens: 100 }]).overall.hitRate).toBe(0);
    expect(cacheStats([]).overall.hitRate).toBe(0);
    expect(cacheStats([]).byModel).toEqual([]);
  });
});
