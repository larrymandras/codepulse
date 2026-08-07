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

// ---------------------------------------------------------------------------
// COST-01 (2026-08-07): the tests above MIRROR the logic rather than calling
// it, which is why they stayed green while the real handler did an UNBOUNDED
// `.collect()` over the runtime firehose table — the read shape CLAUDE.md's
// "Self-Hosted Convex — Operational Rules" blames for the 2026-07-21/22 outage
// and the 2026-08-02 Analytics blackout, and which its own neighbour
// `sessionCalls` was capped for at Phase 105 D-12.
//
// These exercise the REAL exported handler via `._handler` (the aggregates.test.ts
// convention), so a future regression in production code actually fails here.
// ---------------------------------------------------------------------------
import { cacheStats as cacheStatsQuery, CACHE_STATS_READ_CAP } from "./llm";

function makeLlmCtx(rows: any[]) {
  const chain = {
    withIndex: () => chain,
    filter: () => chain,
    order: () => chain,
    take: (n: number) => Promise.resolve(rows.slice(0, n)),
    collect: () => Promise.resolve(rows),
  };
  return { db: { query: () => chain } } as any;
}

const anthropicRow = (i: number) => ({
  provider: "anthropic_direct",
  model: "claude-sonnet-5",
  promptTokens: 10,
  cacheReadInputTokens: 90,
  cacheCreationInputTokens: 0,
  timestamp: i,
});

describe("cacheStats — real handler, bounded read (COST-01)", () => {
  it("CONTROL: computes the same hit rate the mirrored spec does", async () => {
    const ctx = makeLlmCtx([
      { provider: "anthropic_advisor", model: "claude-sonnet-4-6", promptTokens: 20, cacheReadInputTokens: 8402, cacheCreationInputTokens: 0 },
      { provider: "anthropic_direct", model: "claude-sonnet-4-6", promptTokens: 100, cacheReadInputTokens: 0, cacheCreationInputTokens: 1000 },
      { provider: "openrouter", model: "gpt-4.1", promptTokens: 5000 },
    ]);
    const r = await (cacheStatsQuery as any)._handler(ctx, {});
    expect(r.overall.calls).toBe(2);
    expect(r.overall.totalPromptTokens).toBe(9522);
    expect(r.overall.hitRate).toBeCloseTo(8402 / 9522, 6);
  });

  it("caps the read instead of collecting the whole window", async () => {
    const rows = Array.from({ length: CACHE_STATS_READ_CAP + 500 }, (_, i) => anthropicRow(i));
    const r = await (cacheStatsQuery as any)._handler(makeLlmCtx(rows), {});
    // Only the capped slice is aggregated — never all 8500.
    expect(r.overall.calls).toBe(CACHE_STATS_READ_CAP);
    expect(r.truncated).toBe(true);
    expect(r.cap).toBe(CACHE_STATS_READ_CAP);
  });

  it("reports truncated:false when the window fits under the cap", async () => {
    const r = await (cacheStatsQuery as any)._handler(makeLlmCtx([anthropicRow(1)]), {});
    expect(r.truncated).toBe(false);
    expect(r.overall.calls).toBe(1);
  });

  it("still ignores non-anthropic providers through the real handler", async () => {
    const r = await (cacheStatsQuery as any)._handler(
      makeLlmCtx([{ provider: "openrouter", model: "gpt-4.1", promptTokens: 100 }]),
      {}
    );
    expect(r.overall.calls).toBe(0);
    expect(r.overall.hitRate).toBe(0); // no divide-by-zero
  });
});
