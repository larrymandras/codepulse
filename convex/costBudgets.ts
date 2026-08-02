/**
 * convex/costBudgets.ts — Phase 104 (Cost Intelligence), Plan 04.
 *
 * D-10: every period boundary in this file is computed in UTC, never local
 * time. Two reasons, both already load-bearing elsewhere in this codebase:
 *   1. `convex/crons.ts` schedules the aggregation cron on `hourUTC` — a
 *      budget's own day/week/month edge must land on the same clock the
 *      crons already use.
 *   2. `convex/aggregates.ts` `rollupDaily` floors on
 *      `Math.floor(now / 86400) * 86400` (UTC midnight) and
 *      `src/components/SDKSpendGuard.tsx`'s `projectDayEndSpend` floors
 *      identically. A local-time boundary would put a budget's day on a
 *      different edge than the rollup buckets that measure it, silently
 *      mis-scoring every burn-rate projection near a boundary.
 *
 * D-09: one table, one `scope` discriminator ("global" | "model" |
 * "provider" | "quota") — a future per-profile scope is a new scope value,
 * not a new subsystem.
 * D-11: exactly two firing points per row — `warnFraction` (default 0.8)
 * and `limit` itself. Not a free-form levels list.
 * D-07: `unit` ("usd" | "quota_pct") is derived server-side from `scope`
 * and is never a caller argument — no fictional dollar ever enters a quota
 * budget.
 * D-12 / D-19: `seedFromLegacyCaps` folds this repo's two remaining
 * independent legacy cap sources (`SDKSpendGuard`'s hardcoded constants and
 * `forecasts.ts`'s `agentConfigs["intelligence.budget_cap"]`) into the
 * first two rows of this table.
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ============================================================
// Types (exported — plans 104-06, 104-07, 104-08 consume these exact names)
// ============================================================

export type BudgetScope = "global" | "model" | "provider" | "quota";
export type BudgetPeriod = "daily" | "weekly" | "monthly";

export type BudgetRow = {
  _id: Id<"costBudgets">;
  scope: BudgetScope;
  scopeKey: string;
  period: BudgetPeriod;
  limit: number;
  warnFraction: number;
  unit: "usd" | "quota_pct";
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
};

// ============================================================
// Pure UTC period-boundary helpers — no ctx, seconds not millis
// (D-10). Follows the SDKSpendGuard.tsx / modelPricing.ts convention of
// exporting pure functions so they're unit-testable without convex-test.
// ============================================================

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_WEEK = 604800;
// Epoch day 0 (1970-01-01T00:00:00Z) was a Thursday. The preceding Monday
// 00:00 UTC is therefore 345600 seconds BEFORE epoch (1969-12-29T00:00:00Z).
// Do NOT "simplify" this constant to 0 or to a round week count — it is the
// exact distance from epoch to the nearest preceding Monday, and every
// weekly boundary below is computed relative to it.
const MONDAY_ANCHOR_OFFSET = 345600;

export function periodStartFor(period: BudgetPeriod, nowSec: number): number {
  if (period === "daily") {
    return Math.floor(nowSec / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  }
  if (period === "weekly") {
    return (
      Math.floor((nowSec - MONDAY_ANCHOR_OFFSET) / SECONDS_PER_WEEK) * SECONDS_PER_WEEK +
      MONDAY_ANCHOR_OFFSET
    );
  }
  // monthly — first instant of the current UTC calendar month.
  const d = new Date(nowSec * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
}

export function periodEndFor(period: BudgetPeriod, nowSec: number): number {
  if (period === "daily") {
    return periodStartFor("daily", nowSec) + SECONDS_PER_DAY;
  }
  if (period === "weekly") {
    return periodStartFor("weekly", nowSec) + SECONDS_PER_WEEK;
  }
  // monthly — the start of the NEXT calendar month. Never add "30 days":
  // a projection to period end must land on the real month boundary, or
  // every alert built on this names a wrong date.
  const d = new Date(nowSec * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
}

export function periodHours(period: BudgetPeriod, nowSec: number): number {
  return (periodEndFor(period, nowSec) - periodStartFor(period, nowSec)) / 3600;
}

// ============================================================
// Write mutations — every handler opens with the Clerk identity gate
// (T-104-13, reproduced verbatim from convex/alertRuleCustom.ts:46-48)
// ============================================================

const SCOPES: BudgetScope[] = ["global", "model", "provider", "quota"];
const PERIODS: BudgetPeriod[] = ["daily", "weekly", "monthly"];

function assertValidScope(scope: string): asserts scope is BudgetScope {
  if (!(SCOPES as string[]).includes(scope)) {
    throw new ConvexError(`scope must be one of ${SCOPES.join(", ")}`);
  }
}

function assertValidPeriod(period: string): asserts period is BudgetPeriod {
  if (!(PERIODS as string[]).includes(period)) {
    throw new ConvexError(`period must be one of ${PERIODS.join(", ")}`);
  }
}

/** D-07: unit is DERIVED from scope, never taken from the caller. */
function unitForScope(scope: BudgetScope): "usd" | "quota_pct" {
  return scope === "quota" ? "quota_pct" : "usd";
}

function assertValidLimit(limit: number, unit: "usd" | "quota_pct"): void {
  if (unit === "usd") {
    if (!(limit > 0 && limit < 1_000_000)) {
      throw new ConvexError("Budget limit must be greater than 0 and less than 1,000,000 (usd)");
    }
  } else {
    if (!(limit > 0 && limit <= 100)) {
      throw new ConvexError("Budget limit must be greater than 0 and at most 100 (quota_pct)");
    }
  }
}

function assertValidWarnFraction(warnFraction: number): void {
  if (!(warnFraction > 0 && warnFraction < 1)) {
    throw new ConvexError("warnFraction must be greater than 0 and less than 1");
  }
}

export const create = mutation({
  args: {
    scope: v.string(),
    scopeKey: v.optional(v.string()),
    period: v.string(),
    limit: v.float64(),
    warnFraction: v.optional(v.float64()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // T-104-13: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    assertValidScope(args.scope);
    assertValidPeriod(args.period);

    const scopeKey = args.scopeKey ?? "";
    if (args.scope === "global") {
      if (scopeKey !== "") {
        throw new ConvexError("scopeKey must be empty for a global-scope budget");
      }
    } else if (scopeKey === "") {
      throw new ConvexError(`scopeKey is required for a ${args.scope}-scope budget`);
    }

    // D-07: unit is derived server-side from scope — never a caller argument.
    const unit = unitForScope(args.scope);
    assertValidLimit(args.limit, unit);

    const warnFraction = args.warnFraction ?? 0.8;
    assertValidWarnFraction(warnFraction);

    const existing = await ctx.db
      .query("costBudgets")
      .withIndex("by_scope_key_period", (q) =>
        q.eq("scope", args.scope).eq("scopeKey", scopeKey).eq("period", args.period)
      )
      .first();
    if (existing) {
      throw new ConvexError(
        `A ${args.period} budget already exists for scope "${args.scope}" / key "${scopeKey}"`
      );
    }

    const now = Date.now() / 1000;
    return await ctx.db.insert("costBudgets", {
      scope: args.scope,
      scopeKey,
      period: args.period,
      limit: args.limit,
      warnFraction,
      unit,
      enabled: args.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("costBudgets"),
    limit: v.optional(v.float64()),
    warnFraction: v.optional(v.float64()),
    enabled: v.optional(v.boolean()),
    // Accepted only so a caller attempting to change one of these three
    // immutable fields gets the explicit rejection below, rather than
    // Convex's generic "unknown argument" error.
    scope: v.optional(v.string()),
    scopeKey: v.optional(v.string()),
    period: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // T-104-13: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    // scope / scopeKey / period are IMMUTABLE after creation — changing
    // them would silently re-target every dedup key plan 104-06 stores in
    // an alert's `details` (keyed on (budgetId, level, periodStart), which
    // implicitly assumes a row's identity never moves).
    if (args.scope !== undefined || args.scopeKey !== undefined || args.period !== undefined) {
      throw new ConvexError(
        "scope, scopeKey and period are immutable after creation — delete and recreate the budget instead"
      );
    }

    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("Budget not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() / 1000 };
    if (args.limit !== undefined) {
      assertValidLimit(args.limit, row.unit as "usd" | "quota_pct");
      patch.limit = args.limit;
    }
    if (args.warnFraction !== undefined) {
      assertValidWarnFraction(args.warnFraction);
      patch.warnFraction = args.warnFraction;
    }
    if (args.enabled !== undefined) {
      patch.enabled = args.enabled;
    }

    await ctx.db.patch(args.id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("costBudgets") },
  handler: async (ctx, args) => {
    // T-104-13: Require authenticated Clerk identity.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    await ctx.db.delete(args.id);
  },
});

// ============================================================
// Read queries — no identity gate (matches the sibling read convention)
// ============================================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    // small table by design (D-09); full scan is intentional. Plan 104-06
    // reads it once per hour — keep row count in the low double digits
    // (RESEARCH.md Pitfall 5).
    return await ctx.db.query("costBudgets").collect();
  },
});

export const get = query({
  args: { id: v.id("costBudgets") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByScope = query({
  args: {
    scope: v.string(),
    scopeKey: v.optional(v.string()),
    period: v.string(),
  },
  handler: async (ctx, args) => {
    const scopeKey = args.scopeKey ?? "";
    const row = await ctx.db
      .query("costBudgets")
      .withIndex("by_scope_key_period", (q) =>
        q.eq("scope", args.scope).eq("scopeKey", scopeKey).eq("period", args.period)
      )
      .first();
    // A DISABLED budget is not a configured cap. `costBudgetEval` already
    // skips disabled rows (`allBudgets.filter((b) => b.enabled)`), so without
    // this the display and the evaluator disagreed: SDKSpendGuard painted a
    // live gauge, an "On Track" badge and a projection against a threshold
    // that would never fire an alert. Returning null puts the caller on its
    // honest "No daily budget set." branch — `undefined` still means loading.
    // Found 2026-08-02 at Phase 104's validation gate.
    return row && row.enabled ? row : null;
  },
});

// ============================================================
// Migration — folds this repo's remaining independent legacy cap sources
// into the first two costBudgets rows (D-12, D-19). Idempotent and
// additive: each seed reads by_scope_key_period first and skips when a row
// already exists. Never patches or deletes.
//
// Manual invocation: `npx convex run costBudgets:seedFromLegacyCaps '{}'`
// Must be run BEFORE plan 104-08 rewires SDKSpendGuard / CostForecastPanel
// onto costBudgets rows, or both panels will render their "no budget
// configured" state. Not registered as a cron (convex/crons.ts) — per
// CLAUDE.md's self-hosted Convex rules, no bulk mutation runs unattended
// against the live instance.
// ============================================================

export const seedFromLegacyCaps = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    let seededDaily = false;
    let seededMonthly = false;
    let monthlySkippedReason: string | null = null;

    // Seed 1 (D-12): src/components/SDKSpendGuard.tsx:8-9 —
    // DAILY_CAP = 5.00, ALERT_THRESHOLD = 0.8. Carried across so the
    // operator's existing gauge does not silently change value on deploy.
    const existingDaily = await ctx.db
      .query("costBudgets")
      .withIndex("by_scope_key_period", (q) =>
        q.eq("scope", "global").eq("scopeKey", "").eq("period", "daily")
      )
      .first();
    if (!existingDaily) {
      await ctx.db.insert("costBudgets", {
        scope: "global",
        scopeKey: "",
        period: "daily",
        limit: 5.0,
        warnFraction: 0.8,
        unit: "usd",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
      seededDaily = true;
    }

    // Seed 2 (D-19): convex/forecasts.ts's monthly cap, currently read from
    // agentConfigs["intelligence.budget_cap"] (own setBudgetCap mutation,
    // own getBudgetConfig query, own classifyBudgetStatus 80%/100% tiers —
    // matched here by warnFraction: 0.8 so CostForecastPanel's rendered
    // status does not shift on migration). Never invent a monthly limit
    // the operator never set — a budget with no prior value is skipped
    // honestly rather than shipping a fictional threshold.
    const existingMonthly = await ctx.db
      .query("costBudgets")
      .withIndex("by_scope_key_period", (q) =>
        q.eq("scope", "global").eq("scopeKey", "").eq("period", "monthly")
      )
      .first();
    if (existingMonthly) {
      monthlySkippedReason = "a global monthly costBudgets row already exists";
    } else {
      const legacyConfig = await ctx.db
        .query("agentConfigs")
        .withIndex("by_key", (q) => q.eq("configKey", "intelligence.budget_cap"))
        .first();
      const legacyValue =
        legacyConfig != null && typeof legacyConfig.value === "number" ? legacyConfig.value : null;
      if (legacyValue != null && legacyValue > 0) {
        await ctx.db.insert("costBudgets", {
          scope: "global",
          scopeKey: "",
          period: "monthly",
          limit: legacyValue,
          warnFraction: 0.8,
          unit: "usd",
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
        seededMonthly = true;
      } else {
        monthlySkippedReason =
          'no positive-number agentConfigs["intelligence.budget_cap"] row exists to migrate — no monthly budget was invented';
      }
    }
    // Leave the agentConfigs row itself in place: plan 104-08 stops reading
    // it, but deleting it is a mutation with no upside.

    return { seededDaily, seededMonthly, monthlySkippedReason };
  },
});
