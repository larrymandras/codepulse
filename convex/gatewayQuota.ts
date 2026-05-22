import { internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ============================================================
// GATEWAY QUOTA SNAPSHOTS — Phase 68 observability data layer
// ============================================================

/**
 * deduplicateByProvider — Pure helper for latestByProvider query.
 * Exported for unit testing in gatewayQuota.test.ts.
 * Given rows ordered newest-first, returns the first (most recent) row
 * per provider.
 */
export function deduplicateByProvider<
  T extends { provider: string; timestamp: number }
>(rows: T[]): T[] {
  const byProvider = new Map<string, T>();
  for (const row of rows) {
    if (!byProvider.has(row.provider)) {
      byProvider.set(row.provider, row);
    }
  }
  return Array.from(byProvider.values());
}

/**
 * pollAndStore — internalAction that fetches /quota from the Astridr gateway
 * and writes one snapshot per provider into gatewayQuotaSnapshots.
 *
 * T-68-01: never logs ASTRIDR_API_KEY value.
 */
export const pollAndStore = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiBase = process.env.ASTRIDR_API_URL;
    const apiKey = process.env.ASTRIDR_API_KEY;

    if (!apiBase) {
      console.warn("[gatewayQuota] ASTRIDR_API_URL is not set — skipping quota poll");
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    let res: Response;
    try {
      res = await fetch(`${apiBase}/quota`, { headers });
    } catch (err) {
      console.warn("[gatewayQuota] /quota fetch failed:", (err as Error).message);
      return;
    }

    if (!res.ok) {
      console.warn(`[gatewayQuota] /quota returned ${res.status}`);
      return;
    }

    // QuotaStatus[] from Astridr (snake_case Python response)
    interface QuotaStatus {
      provider: string;
      billing_type: string;
      used_today: number;
      daily_limit: number | null;
      spend_usd: number;
      spend_cap_usd: number | null;
      remaining_pct: number;
    }

    let statuses: QuotaStatus[];
    try {
      statuses = (await res.json()) as QuotaStatus[];
    } catch (err) {
      console.warn("[gatewayQuota] /quota JSON parse failed:", (err as Error).message);
      return;
    }

    const timestamp = Date.now() / 1000;

    for (const s of statuses) {
      await ctx.runMutation(internal.gatewayQuota.insertSnapshot, {
        provider: s.provider,
        billingType: s.billing_type,
        usedToday: s.used_today,
        dailyLimit: s.daily_limit ?? undefined,
        spendUsd: s.spend_usd,
        spendCapUsd: s.spend_cap_usd ?? undefined,
        remainingPct: s.remaining_pct,
        timestamp,
      });
    }
  },
});

/**
 * insertSnapshot — internalMutation that writes a single quota snapshot row.
 */
export const insertSnapshot = internalMutation({
  args: {
    provider: v.string(),
    billingType: v.string(),
    usedToday: v.float64(),
    dailyLimit: v.optional(v.float64()),
    spendUsd: v.float64(),
    spendCapUsd: v.optional(v.float64()),
    remainingPct: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("gatewayQuotaSnapshots", { ...args });
  },
});

/**
 * latestByProvider — Returns the most recent quota snapshot for each provider.
 * D-05: current-only (no history) — deduplicates to single row per provider.
 */
export const latestByProvider = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("gatewayQuotaSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);

    return deduplicateByProvider(rows);
  },
});
