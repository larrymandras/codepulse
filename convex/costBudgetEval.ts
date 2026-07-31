/**
 * convex/costBudgetEval.ts — Phase 104 (Cost Intelligence), Plan 06.
 *
 * D-13: "spike" = the current burn rate projected to the budget's period
 * boundary — the exact algorithm `SDKSpendGuard.tsx`'s `projectDayEndSpend`
 * already implements, generalized here from its fixed 24-hour/single-dollar-
 * cap shape to any `costBudgets` period.
 *
 * D-14 (hard constraint, not a preference): `evaluateBudgets` (Task 2) is
 * invoked from the TAIL of the existing `internal.aggregates.computeHourly`
 * cron (Task 3) — see the call site in `convex/aggregates.ts`. No new
 * scheduled function and no new `convex/crons.ts` entry exist anywhere in
 * this phase. `internal.alerts.evaluateInternal` (the Phase 6 general
 * alert-rule cron) has been DISABLED since 2026-07-14
 * (`convex/crons.ts:27-32`): its fan-out read pattern (`.collect()` over all
 * unacknowledged alerts + a 200-row recent-events window + an
 * all-active-sessions `.collect()` + a per-rule loop across 40+ static
 * rules) hit the 15s syscall cap on self-hosted Convex, and a failing cron
 * execution retries on its own backoff regardless of schedule — the retry
 * storms starved ingest mutations. `computeHourly` has ALREADY read this
 * hour's `llmMetrics` and already writes the `tokens_prompt`/
 * `tokens_completion` buckets this file reads back through
 * `computePeriodSpend` — evaluating here adds a small, BOUNDED amount of
 * additional read work (see `evaluateBudgets`'s own doc comment, Task 2),
 * not a new unbounded scan. Accepted cost: alert latency up to one hour.
 *
 * D-16: alert-only. This file performs exactly one kind of write (an
 * `alerts` insert) and schedules exactly one function
 * (`internal.webhookDelivery.sendAlertWebhook`) — no brain swap, no
 * throttle, no dispatch to any Ástríðr-facing surface, and no alert message
 * implies enforcement (see `buildAlertMessage`'s forbidden-word list).
 */
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { periodStartFor, periodEndFor, periodHours, type BudgetPeriod } from "./costBudgets";
import { computePeriodSpend } from "./costDerived";

// ============================================================
// Pure math — projection (D-13) and classification (D-11), no ctx.
// Kept ctx-free so they are unit-testable without convex-test, matching the
// SDKSpendGuard.tsx / modelPricing.ts / costBudgets.ts convention.
// ============================================================

/**
 * `SDKSpendGuard.tsx`'s `projectDayEndSpend` verbatim, with `24` replaced by
 * `periodHoursValue` and the module's fixed-dollar spend-cap constant
 * replaced by `limitValue`. `projectedHitTime` is anchored on the CALLER's
 * `periodStartSec` (not a re-derived UTC day start) — a weekly or monthly
 * budget must project onto its own period origin, not always onto today's
 * midnight.
 */
export function projectPeriodEndSpend(
  spend: number,
  elapsedHours: number,
  periodHoursValue: number,
  limitValue: number,
  periodStartSec: number
): { projectedTotal: number; willExceed: boolean; projectedHitTime: Date | null } {
  if (elapsedHours <= 0) {
    return { projectedTotal: 0, willExceed: false, projectedHitTime: null };
  }
  const hourlyRate = spend / elapsedHours;
  const projectedTotal = hourlyRate * periodHoursValue;
  const willExceed = projectedTotal > limitValue;
  const projectedHitTime =
    willExceed && hourlyRate > 0
      ? new Date((periodStartSec + (limitValue / hourlyRate) * 3600) * 1000)
      : null;
  return { projectedTotal, willExceed, projectedHitTime };
}

/**
 * D-11: exactly two firing levels — "error" (breach, at the limit) and
 * "warning" (either the warn fraction OR a D-13 spike). Precedence matters:
 * breach beats warn beats spike beats nothing.
 */
export function classifyBudgetLevel(
  spend: number,
  projectedTotal: number,
  limitValue: number,
  warnFraction: number
): "warning" | "error" | null {
  if (spend >= limitValue) return "error";
  if (spend >= warnFraction * limitValue) return "warning";
  // D-13 spike: actual spend has NOT yet reached the warn fraction, but the
  // current burn rate is projected to breach the limit before the period
  // ends. This is the one branch that isn't obvious from D-11 alone — it
  // still fires at "warning" severity (D-11 has exactly two firing levels;
  // a spike is not a third, separate severity).
  if (projectedTotal >= limitValue) return "warning";
  return null;
}

const FORBIDDEN_WORDS = ["throttle", "swap", "stop", "block", "disable", "cap enforced"];

/**
 * UI-SPEC's Copywriting Contract, verbatim: "{scope label} budget at {pct}%
 * (${spend} of ${limit}) — projected to hit ${limit} by ~{time}." D-16: never
 * names an action the system does not perform — see FORBIDDEN_WORDS above
 * (checked by this file's own test via containsForbiddenEnforcementWord).
 */
export function buildAlertMessage(args: {
  scopeLabel: string;
  spend: number;
  limitValue: number;
  unit: "usd" | "quota_pct";
  projectedTotal: number;
  projectedHitTime: Date | null;
  unpricedTokens: number;
}): string {
  const pct = Math.round((args.spend / args.limitValue) * 100);
  const fmtMoney = (n: number) => `$${n.toFixed(4)}`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  const fmt = args.unit === "quota_pct" ? fmtPct : fmtMoney;

  let message = `${args.scopeLabel} budget at ${pct}% (${fmt(args.spend)} of ${fmt(args.limitValue)})`;
  if (args.projectedHitTime !== null) {
    // D-16 honesty: only ever write a projection clause when a real hit
    // time was computed — the null case omits the clause entirely rather
    // than rendering "unknown" as if it were a fact.
    const timeLabel = args.projectedHitTime.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    message += ` — projected to hit ${fmt(args.limitValue)} by ~${timeLabel}.`;
  } else {
    message += ".";
  }
  if (args.unpricedTokens > 0) {
    message += ` ${args.unpricedTokens} tokens in this window are unpriced and are not included.`;
  }
  return message;
}

/** Exported so the test file can assert the guard without duplicating the literal word list. */
export function containsForbiddenEnforcementWord(message: string): boolean {
  const lower = message.toLowerCase();
  return FORBIDDEN_WORDS.some((w) => lower.includes(w));
}

// ============================================================
// evaluateBudgets — the D-14 tail-append entry point (Task 2/3).
// ============================================================

type CostBudgetRow = {
  _id: Id<"costBudgets">;
  scope: string;
  scopeKey: string;
  period: BudgetPeriod;
  limit: number;
  warnFraction: number;
  unit: "usd" | "quota_pct";
  enabled: boolean;
};

type GatewayQuotaSnapshotRow = {
  provider: string;
  remainingPct: number;
  timestamp: number;
};

function scopeLabelFor(scope: string, scopeKey: string, period: BudgetPeriod): string {
  if (scope === "global") return `Global ${period}`;
  const scopeWord = scope.charAt(0).toUpperCase() + scope.slice(1);
  return `${scopeWord} ${scopeKey} ${period}`;
}

/**
 * Runs once per enabled budget row, called from the TAIL of `computeHourly`
 * (D-14, Task 3's call site in `convex/aggregates.ts`).
 *
 * Reads performed, all bounded (RESEARCH.md Pitfall 4/5 discipline — cite
 * the concrete bound, never claim "adds nothing"):
 *   - One `costBudgets` whole-table `.collect()` — low double-digit rows by
 *     design (D-09); this is the SAME "small table, full scan is fine"
 *     assumption `costBudgets.list`/`modelPricing.list` already make.
 *   - Per "usd"-unit budget: one `computePeriodSpend` call, which itself
 *     reads at most ~31 daily bucket-sets (skipped entirely for a same-day
 *     budget) plus the current day's hourly bucket-sets via
 *     `aggregates.by_type_period_bucket` — never `llmMetrics`.
 *   - Per "quota_pct"-unit budget: one `gatewayQuotaSnapshots.by_provider`
 *     index read, `.order("desc").take(1)` — a single-row bounded read.
 *   - Per budget that reaches a non-null classification: one
 *     `alerts.by_source` index read (dedup) — bounded by however many prior
 *     alerts share this exact `cost-budget:{budgetId}:{level}` source
 *     string, which D-15's per-period dedup keeps small.
 * No read here ever touches `llmMetrics` directly.
 *
 * Per-budget-row isolation (RESEARCH.md's evalScores.ts precedent): one
 * malformed row's failure is caught and counted here, never allowed to stop
 * the remaining budgets — and (via the try/catch at the computeHourly call
 * site, Task 3) never allowed to fail the hourly rollup itself.
 */
export async function evaluateBudgets(
  ctx: MutationCtx,
  nowSec: number
): Promise<{
  evaluated: number;
  fired: number;
  skippedDeduped: number;
  skippedNoData: number;
  errors: number;
}> {
  // Whole-table read of a table that stays in the low double digits by
  // design (D-09) — the same bounded-full-scan assumption costBudgets.ts's
  // own `list` query documents.
  const allBudgets = (await ctx.db.query("costBudgets").collect()) as unknown as CostBudgetRow[];
  const budgets = allBudgets.filter((b) => b.enabled);

  let evaluated = 0;
  let fired = 0;
  let skippedDeduped = 0;
  let skippedNoData = 0;
  let errors = 0;

  for (const budget of budgets) {
    try {
      evaluated++;

      const periodStart = periodStartFor(budget.period, nowSec);
      const hours = periodHours(budget.period, nowSec);
      const elapsedHours = (nowSec - periodStart) / 3600;

      let spend: number;
      let unpricedTokens = 0;

      if (budget.unit === "quota_pct") {
        // D-07: a quota-scope budget is evaluated against
        // gatewayQuotaSnapshots in quota-percent units, never a dollar
        // figure. One bounded, single-row index read per quota budget.
        const rows = (await ctx.db
          .query("gatewayQuotaSnapshots")
          .withIndex("by_provider", (q: any) => q.eq("provider", budget.scopeKey))
          .order("desc")
          .take(1)) as unknown as GatewayQuotaSnapshotRow[];
        const snapshot = rows[0];
        if (!snapshot) {
          // No live snapshot for this provider — never evaluate an absent
          // reading as 0% used (the exact surface-asserting-more-than-it-
          // knows failure this phase is written against). Skip honestly.
          skippedNoData++;
          continue;
        }
        // remainingPct is a 0-1 FRACTION (convex/gatewayQuota.ts's own doc
        // comment + src/components/GatewayQuotaPanel.tsx's
        // `Math.round(snapshot.remainingPct * 100)` usage both confirm
        // this) — consumed % is therefore `100 - remainingPct * 100`,
        // landing in the same 0-100 unit `costBudgets.assertValidLimit`
        // already enforces for a quota_pct budget's `limit`.
        spend = 100 - snapshot.remainingPct * 100;
      } else {
        const result = await computePeriodSpend(ctx, {
          scope: budget.scope as "global" | "model" | "provider",
          scopeKey: budget.scopeKey,
          periodStart,
          nowSec,
        });
        spend = result.billedUsd;
        unpricedTokens = result.unpricedTokens;
      }

      const { projectedTotal, projectedHitTime } = projectPeriodEndSpend(
        spend,
        elapsedHours,
        hours,
        budget.limit,
        periodStart
      );
      const level = classifyBudgetLevel(spend, projectedTotal, budget.limit, budget.warnFraction);
      if (level === null) continue;

      // D-15 dedup: fire once per (budgetId, level, periodStart); re-arm at
      // the period reset. NO status filter — an acknowledged or resolved
      // prior alert still suppresses a re-fire (mirrors
      // convex/evalScores.ts:1168-1178's cross-status dedup exactly).
      // Because `level` is part of the source string, an escalation from
      // "warning" to "error" within the same period still gets through.
      const source = `cost-budget:${budget._id}:${level}`;
      // PERFORMANCE INVARIANT (do not remove the createdAt lower bound):
      // `alerts` is in retention.ts's "kept forever" set, so an unbounded
      // read of every alert ever fired for this (budget, level) pair would
      // grow by one row per period, forever — inside `computeHourly`, the one
      // mutation that must not blow the self-hosted 15s syscall cap (D-14).
      // The `by_source` index is composite `["source", "createdAt"]`, so the
      // read range-bounds for free. This cannot drop a match: an alert for
      // period P is always written DURING P, hence its `createdAt >= P`.
      const priorAlerts = (await ctx.db
        .query("alerts")
        .withIndex("by_source", (q: any) =>
          q.eq("source", source).gte("createdAt", periodStart)
        )
        .collect()) as unknown as Array<{ details?: { periodStart?: number } }>;
      const priorPeriodStarts = new Set(
        priorAlerts.map((a) => a.details?.periodStart).filter((p): p is number => typeof p === "number")
      );
      if (priorPeriodStarts.has(periodStart)) {
        skippedDeduped++;
        continue;
      }

      // D-17: insert DIRECTLY into `alerts` — never through the public
      // mutation on that module, which does not deliver (convex/evalScores.ts:
      // 1230-1233 is the citation this shape is copied from).
      const scopeLabel = scopeLabelFor(budget.scope, budget.scopeKey, budget.period);
      const message = buildAlertMessage({
        scopeLabel,
        spend,
        limitValue: budget.limit,
        unit: budget.unit,
        projectedTotal,
        projectedHitTime,
        unpricedTokens,
      });

      const alertId = await ctx.db.insert("alerts", {
        severity: level,
        source,
        message,
        acknowledged: false,
        status: "active",
        createdAt: nowSec,
        webhookStatus: "pending",
        details: {
          budgetId: budget._id,
          level,
          periodStart,
          periodEnd: periodEndFor(budget.period, nowSec),
          scope: budget.scope,
          scopeKey: budget.scopeKey,
          unit: budget.unit,
          spend,
          limit: budget.limit,
          warnFraction: budget.warnFraction,
          projectedTotal,
          projectedHitTimeSec: projectedHitTime ? projectedHitTime.getTime() / 1000 : null,
          unpricedTokens,
        },
      });

      // D-16 GUARD: this is the ONLY function this file ever schedules.
      // No profileConfigs write, no activeEngineSnapshots write, no
      // astridrCommands dispatch — alert-only.
      await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
        alertId,
        attempt: 1,
      });
      fired++;
    } catch (err) {
      // Per-budget-row isolation: one malformed row must never block the
      // rest, and (via the caller's own try/catch, Task 3) never fail
      // computeHourly.
      console.warn(`[evaluateBudgets] budget ${budget._id} failed:`, (err as Error).message);
      errors++;
    }
  }

  return { evaluated, fired, skippedDeduped, skippedNoData, errors };
}
