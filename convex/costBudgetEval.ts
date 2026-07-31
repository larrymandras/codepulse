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
