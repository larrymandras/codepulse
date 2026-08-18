import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getBillingType, PROVIDER_BILLING } from "./lib/providers";

export const recordCall = mutation({
  args: {
    provider: v.string(),
    model: v.string(),
    promptTokens: v.float64(),
    completionTokens: v.float64(),
    totalTokens: v.float64(),
    latencyMs: v.float64(),
    cost: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
    agentId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    goalId: v.optional(v.string()),   // Phase 149 PULSE-01 — swarm cost join
    traceId: v.optional(v.string()),  // Phase 94 TRACE-01 — per-turn trace grouping
    cacheReadInputTokens: v.optional(v.float64()),      // prompt-cache hit monitoring
    cacheCreationInputTokens: v.optional(v.float64()),  // prompt-cache write monitoring
    round: v.optional(v.float64()), // Phase 105 D-10 — per-round trace-waterfall join key
  },
  handler: async (ctx, args) => {
    const billingType = getBillingType(args.provider);
    await ctx.db.insert("llmMetrics", {
      provider: args.provider,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      latencyMs: args.latencyMs,
      cost: args.cost,
      sessionId: args.sessionId,
      timestamp: args.timestamp,
      agentId: args.agentId,
      toolName: args.toolName,
      billingType,
      goalId: args.goalId,
      traceId: args.traceId,
      cacheReadInputTokens: args.cacheReadInputTokens,
      cacheCreationInputTokens: args.cacheCreationInputTokens,
      round: args.round,
    });
  },
});

/**
 * Prompt-cache hit rate for Anthropic providers (cache_control only applies
 * there), windowed (default 24h so it stays responsive instead of being diluted
 * by historical pre-fix rows) and broken down per-model — the main agent
 * (sonnet/opus) caches a large stable system prefix, while the haiku classifier
 * has too small a prefix to cache, so a single org-wide number hides the win.
 *
 * hitRate = cache_read / total prompt tokens, where
 * total = uncached input + cache writes + cache reads.
 */
type CacheAcc = { calls: number; read: number; creation: number; uncached: number };

function shapeCacheAcc(a: CacheAcc) {
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

/**
 * Bounded read cap for `cacheStats` (COST-01, 2026-08-07).
 *
 * This query previously did an UNBOUNDED `.collect()` over `llmMetrics` with
 * only a timestamp lower bound — the exact read shape its neighbour
 * `sessionCalls` was capped for at Phase 105 D-12, and the one CLAUDE.md's
 * "Self-Hosted Convex — Operational Rules" blames for the 2026-07-21/22 outage
 * and the 2026-08-02 Analytics blackout. It is called on every Analytics page
 * load (`src/pages/Analytics.tsx:69`) against the runtime firehose table, and
 * a Convex query that throws unmounts the React tree — so blowing the syscall
 * cap here blanks the whole page, not one tile.
 *
 * Sized above `LLM_WINDOW_READ_CAP` (4000, aggregates.ts) because that cap
 * covers ONE hour while this query's default window is 24. Measured live on
 * 2026-08-07: 191 rows/24h and 727 rows/168h, so this leaves ~10x headroom at
 * the default window.
 */
export const CACHE_STATS_READ_CAP = 8000;

export const cacheStats = query({
  args: { windowHours: v.optional(v.float64()), sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const hours = args.windowHours ?? 24;
    const cutoff = Date.now() / 1000 - hours * 3600;
    // Per-session rollup when sessionId is given (uses the existing by_session index);
    // otherwise the global window. Both feed the same aggregation below.
    //
    // `.take(CACHE_STATS_READ_CAP)` not `.collect()`: bounded by construction.
    // Truncation is REPORTED (see `truncated` in the return) rather than
    // silently under-reporting a hit rate — an undercounted cache ratio reads
    // as a real efficiency problem and would send someone optimizing a prompt
    // that was fine.
    const all = args.sessionId
      ? await ctx.db
          .query("llmMetrics")
          .withIndex("by_session", (q) =>
            q.eq("sessionId", args.sessionId!).gte("timestamp", cutoff)
          )
          .filter((q) => q.neq(q.field("archived"), true))
          .take(CACHE_STATS_READ_CAP)
      : await ctx.db
          .query("llmMetrics")
          .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
          .filter((q) => q.neq(q.field("archived"), true))
          .take(CACHE_STATS_READ_CAP);
    const truncated = all.length >= CACHE_STATS_READ_CAP;

    const overall: CacheAcc = { calls: 0, read: 0, creation: 0, uncached: 0 };
    const perModel: Record<string, CacheAcc> = {};
    for (const r of all) {
      if (!r.provider.startsWith("anthropic")) continue; // cache only applies to Anthropic
      const read = r.cacheReadInputTokens ?? 0;
      const creation = r.cacheCreationInputTokens ?? 0;
      const uncached = r.promptTokens ?? 0;
      overall.calls++;
      overall.read += read;
      overall.creation += creation;
      overall.uncached += uncached;
      if (!perModel[r.model]) perModel[r.model] = { calls: 0, read: 0, creation: 0, uncached: 0 };
      const m = perModel[r.model];
      m.calls++;
      m.read += read;
      m.creation += creation;
      m.uncached += uncached;
    }

    const byModel = Object.entries(perModel)
      .map(([model, a]) => ({ model, ...shapeCacheAcc(a) }))
      .sort((x, y) => y.totalPromptTokens - x.totalPromptTokens);

    return {
      windowHours: hours,
      overall: shapeCacheAcc(overall),
      byModel,
      truncated,
      cap: CACHE_STATS_READ_CAP,
    };
  },
});

/**
 * Bounded read cap for `sessionCalls` (Phase 105 D-12). The previous
 * unbounded full-table read is exactly the class of read that caused the
 * 2026-07-21/22 outage and the 2026-08-02 Analytics blackout on this
 * single-node self-hosted SQLite backend (CLAUDE.md's "Self-Hosted Convex —
 * Operational Rules").
 */
export const SESSION_CALLS_READ_CAP = 1000;

/**
 * Non-archived llmMetrics rows for the Trace Waterfall (Phase 94 TRACE-02),
 * capped at SESSION_CALLS_READ_CAP and reported honestly via `truncated`
 * (Phase 105 D-12) instead of the previous unbounded read that claimed to
 * show "the whole session". When a session exceeds the cap, the MOST RECENT
 * rows are kept (read in descending order, then reversed back to ascending)
 * so the client's chronological grouping-by-traceId is unaffected and the
 * truncation banner's "most recent {cap}" copy is literally true. No
 * server-side grouping/cost estimation/cache derivation; the UI component
 * owns presentation (D-14/D-13).
 */
export const sessionCalls = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const descRows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(SESSION_CALLS_READ_CAP);

    const truncated = descRows.length >= SESSION_CALLS_READ_CAP;
    const rows = descRows.slice().reverse();

    return { rows, truncated, cap: SESSION_CALLS_READ_CAP };
  },
});

export const recentCalls = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(50);
  },
});

export const recentCallsPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .paginate(args.paginationOpts);
  },
});

export const costByModel = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const all = await ctx.db.query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();
    const grouped: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const r of all) {
      const key = r.model;
      if (!grouped[key]) grouped[key] = { calls: 0, tokens: 0, cost: 0 };
      grouped[key].calls++;
      grouped[key].tokens += r.totalTokens;
      grouped[key].cost += r.cost ?? 0;
    }
    return grouped;
  },
});

const PROVIDER_BREAKDOWN_DEFAULT_DAYS = 30;
const PROVIDER_BREAKDOWN_ROW_CAP = 8000;

export const providerBreakdown = query({
  args: { lookbackDays: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const days = args.lookbackDays ?? PROVIDER_BREAKDOWN_DEFAULT_DAYS;
    const cutoff = Date.now() / 1000 - days * 86400;
    const all = await ctx.db.query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .filter((q) => q.neq(q.field("archived"), true))
      .take(PROVIDER_BREAKDOWN_ROW_CAP);
    if (all.length >= PROVIDER_BREAKDOWN_ROW_CAP) {
      // Loud on purpose: past the cap these per-provider totals UNDERCOUNT, and
      // a silent undercount on a cost surface is exactly what D-03 forbids.
      console.warn(
        `[llm.providerBreakdown] hit the ${PROVIDER_BREAKDOWN_ROW_CAP}-row cap over ${days}d — ` +
          `totals undercount. Move this onto the aggregates rollups (CR-01 gap plan).`
      );
    }
    const grouped: Record<string, { calls: number; totalLatency: number; cost: number }> = {};
    for (const r of all) {
      if (!grouped[r.provider]) grouped[r.provider] = { calls: 0, totalLatency: 0, cost: 0 };
      grouped[r.provider].calls++;
      grouped[r.provider].totalLatency += r.latencyMs;
      grouped[r.provider].cost += r.cost ?? 0;
    }
    return Object.entries(grouped).map(([provider, data]) => ({
      provider,
      calls: data.calls,
      avgLatency: Math.round(data.totalLatency / data.calls),
      cost: data.cost,
    }));
  },
});

export const rollupCosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const oneDayAgo = now - 86400;

    const recent = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(1000);

    const dayMetrics = recent.filter((m) => m.timestamp >= oneDayAgo);
    const byProvider: Record<string, { cost: number; tokens: number; calls: number }> = {};

    for (const m of dayMetrics) {
      if (!byProvider[m.provider]) byProvider[m.provider] = { cost: 0, tokens: 0, calls: 0 };
      byProvider[m.provider].cost += m.cost ?? 0;
      byProvider[m.provider].tokens += m.totalTokens;
      byProvider[m.provider].calls++;
    }

    // Store daily rollup as metricSnapshots
    for (const [provider, data] of Object.entries(byProvider)) {
      await ctx.db.insert("metricSnapshots", {
        metricName: `llm_daily_cost_${provider}`,
        value: data.cost,
        tags: { provider, tokens: data.tokens, calls: data.calls, type: "daily_rollup" },
        timestamp: now,
      });
    }

    return { providers: Object.keys(byProvider).length };
  },
});

/** Phase 67 D-01: Subscription provider usage (call count + token total).
 *  Used by Analytics page Subscription Usage MetricCard. */
/**
 * Providers whose calls bill against a subscription rather than per-token API spend.
 * Derived from PROVIDER_BILLING rather than hardcoded, so adding a subscription
 * provider to the registry flows through here automatically — `lib/providers.ts`
 * is explicit that provider arrays must never be duplicated elsewhere.
 */
export const SUBSCRIPTION_PROVIDERS = (
  Object.keys(PROVIDER_BILLING) as (keyof typeof PROVIDER_BILLING)[]
).filter((p) => PROVIDER_BILLING[p] === "subscription");

/**
 * Total documents this query may read in one call.
 *
 * CORRECTED 2026-08-11 (second pass): an earlier version of this comment said the
 * old `.collect()` "grows without limit" and was "guaranteed" to cross Convex's
 * system-operations ceiling. That was wrong and is left here rather than quietly
 * rewritten. `llmMetrics` as a TABLE is indeed keep-forever (excluded from
 * RETENTION_DAYS, guarded by a positive test in retention.test.ts) — but the read
 * is a 30-day SLIDING window, so it does not grow without bound. Measured
 * 2026-08-11: 5,274 rows in that window, DOWN from the ~7,080 Phase 104 recorded
 * on 2026-08-01, because the window slides as activity moves.
 *
 * The better-supported mechanism (documented by Phase 104's `providerBreakdown`
 * comment, removed when Phase 121 migrated that query onto the `aggregates`
 * rollups): Analytics fires ~10 queries concurrently, and the combined load
 * tips a memory-loaded instance over. Backend memory was 32.5 GiB last night
 * versus 18 GiB after the nightly restart.
 *
 * This cap is therefore defence-in-depth, not the load-bearing fix. What actually
 * helps here is reading ~864 rows instead of 5,274 — a ~6x cut in this query's
 * share of that concurrent load.
 */
const SUBSCRIPTION_READ_BUDGET = 8000;

export const subscriptionUsage = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;

    // Read only rows that CAN match, via by_provider (["provider", "timestamp"]),
    // instead of materializing the whole 30-day window and filtering in JS. The
    // old .collect() timed out ("too many system operations"), which blanked the
    // entire Analytics page rather than one widget, because an unhandled useQuery
    // throw unmounts the React tree.
    //
    // Measured after the fix on 2026-08-11: 864 subscription calls / 20.75M tokens,
    // returned in ~1s with truncated=false. (An earlier take(1000) sample of the
    // window showed 100% billingType "api" and suggested the answer was ~zero —
    // that sample was wrong, not the data: by_timestamp returns from the OLDEST
    // end of the window, and the subscription traffic is recent. Recorded because
    // a bounded sample from one end of an index is not a sample of the range.)
    let totalCalls = 0;
    let totalTokens = 0;
    let budget = SUBSCRIPTION_READ_BUDGET;
    let truncated = false;

    for (const provider of SUBSCRIPTION_PROVIDERS) {
      if (budget <= 0) {
        truncated = true;
        break;
      }
      const rows = await ctx.db
        .query("llmMetrics")
        .withIndex("by_provider", (q) =>
          q.eq("provider", provider).gte("timestamp", cutoff),
        )
        .filter((q) => q.neq(q.field("archived"), true))
        .take(budget);

      // Hitting the cap exactly means there may be more rows we did not read.
      // Reported rather than silently undercounted — a total that is quietly
      // low is worse than one labelled incomplete.
      if (rows.length === budget) truncated = true;
      budget -= rows.length;

      for (const r of rows) {
        totalCalls++;
        totalTokens += r.totalTokens;
      }
    }

    return { calls: totalCalls, tokens: totalTokens, truncated };
  },
});

export const backfillAgentId = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Process in batches of 100 to avoid mutation timeout
    const rows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .filter((q) => q.eq(q.field("agentId"), undefined))
      .take(100);

    let patched = 0;
    for (const row of rows) {
      // Attempt to derive agentId via sessionId -> agents table lookup
      let derivedAgentId: string | undefined;

      if (row.sessionId) {
        const agent = await ctx.db
          .query("agents")
          .withIndex("by_session", (q) => q.eq("sessionId", row.sessionId!))
          .first();
        if (agent) {
          derivedAgentId = agent.agentId;
        }
      }

      await ctx.db.patch(row._id, {
        agentId: derivedAgentId ?? "_unknown",
      });
      patched++;
    }

    // Return processed count: caller repeats until processed === 0
    return { processed: rows.length, patched };
  },
});
