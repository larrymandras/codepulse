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
 * pollAndStore — internalAction that fetches /quota from the CLI-gateway
 * sidecar and writes one snapshot per provider into gatewayQuotaSnapshots.
 *
 * D-20 (Phase 104): this previously targeted Ástríðr's main web API base URL
 * env var (`web.py`, default `:8181`), which has NO `/quota` route at all.
 * The only `/quota` route in the entire astridr-repo lives on the SEPARATE
 * CLI-gateway sidecar (`gateway/gateway/app.py:302`, its own host and port,
 * not proxied by the main API). As a direct result, `gatewayQuotaSnapshots`
 * has never filled — verified live 2026-07-30 (`npx convex run
 * gatewayQuota:latestByProvider` returned `[]`). Repointed at
 * `CLI_GATEWAY_URL`, the sidecar's own base URL, with NO fallback to that
 * old main-API env var — a silent fallback to a URL that 404s is exactly
 * what produced this dead poller in the first place.
 * D-07's quota-burn threshold depends on this table actually filling — plan
 * 104-11 owns the live confirmation that snapshots land on the running
 * instance before any threshold is built on top of it.
 *
 * T-68-01: never logs the API key value.
 */
export const pollAndStore = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiBase = process.env.CLI_GATEWAY_URL;
    // Falls back to ASTRIDR_API_KEY so an existing single-key deployment
    // keeps working without requiring a second secret to be provisioned.
    const apiKey = process.env.CLI_GATEWAY_API_KEY ?? process.env.ASTRIDR_API_KEY;

    if (!apiBase) {
      console.warn(
        "[gatewayQuota] CLI_GATEWAY_URL is not set — skipping quota poll (see Phase 104 D-20)"
      );
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
