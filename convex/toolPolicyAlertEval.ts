/**
 * convex/toolPolicyAlertEval.ts — Phase 105 (Tool & Trace Observability), Plan 04.
 *
 * D-06: Ástríðr's tool-access policy fails OPEN on a malformed config —
 * `load_config()` degrades `tool_clusters` to a blank-slate PERMISSIVE policy
 * on boot, or retains the last-known-good policy on a bad reload. Both kinds
 * silently widen (or narrowly preserve) tool access with no operator-visible
 * signal beyond a local log line — this file is that signal.
 *
 * Only the two FAIL-OPEN kinds alert (`ALERTING_POLICY_KINDS` below).
 * `tool_call_leaked_as_text` and `execution_denied` never do: a denial is the
 * policy working correctly, not a failure. Alerting on those would train
 * operators to ignore alerts — the isolation control in
 * `toolPolicyAlertEval.test.ts` proves this in code, not just in prose.
 *
 * D-06 (hard constraint, structurally identical to Phase 104 D-14): this
 * evaluator runs at the TAIL of the existing `internal.aggregates.computeHourly`
 * cron (see the call site in `convex/aggregates.ts`) — never its own
 * `convex/crons.ts` entry. `internal.alerts.evaluateInternal` (the Phase 6
 * general alert-rule cron) has been DISABLED since 2026-07-14
 * (`convex/crons.ts:27-32`) after its fan-out read pattern hit the 15s
 * syscall cap on self-hosted Convex; a failing cron execution retries on its
 * own backoff regardless of schedule, so a new cron here would reopen that
 * exact incident. This file performs exactly one kind of write (an `alerts`
 * insert) and schedules exactly one delivery function (see the scheduling
 * GUARD comment on `evaluateToolPolicyAlerts`'s single call site below) —
 * no policy write, no tool disable, no astridr dispatch. This phase
 * OBSERVES; it never enforces.
 */
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Exactly the two fail-open policy-event kinds this file ever alerts on.
 * `tool_call_leaked_as_text` and `execution_denied` (astridr's other two
 * `tool_policy_event` kinds, see convex/toolPolicyEvents.ts) are deliberately
 * absent — a denial is the policy working as designed, not a failure.
 */
export const ALERTING_POLICY_KINDS = [
  "malformed_policy_boot",
  "malformed_policy_reload_rejected",
] as const;

/** Hard cap on the per-kind, per-window `toolPolicyEvents` read — never an unbounded scan. */
export const POLICY_EVENT_READ_CAP = 200;

/** Truncation length for the `error` field forwarded into the alert message/webhook payload. */
export const POLICY_ERROR_SNIPPET_LEN = 200;

/**
 * Authority: `convex/webhookDelivery.ts:244-249`'s `colorMap` accepts exactly
 * `critical | error | warning | info`. `malformed_policy_boot` and
 * `malformed_policy_reload_rejected` must NEVER collapse into one severity:
 * boot degrades to a FULLY PERMISSIVE policy — every tool becomes reachable,
 * the worse case — while reload-rejected RETAINS the last-known-good policy
 * (fails safe). Collapsing the two hides which failure mode actually
 * occurred at a glance — astridr Phase 182's own warning against exactly
 * this class of mistake.
 */
export function policyAlertSeverity(kind: string): "error" | "warning" {
  return kind === "malformed_policy_boot" ? "error" : "warning";
}

function truncateError(error: string): string {
  if (error.length <= POLICY_ERROR_SNIPPET_LEN) return error;
  return `${error.slice(0, POLICY_ERROR_SNIPPET_LEN)}... [truncated]`;
}

/**
 * UI-SPEC copywriting contract. `field`/`error` are only ever rendered as a
 * pair (astridr always sends them together for both malformed_policy_* kinds
 * — see convex/schema.ts's toolPolicyEvents doc comment) — when either is
 * absent the whole parenthetical is omitted rather than printing `undefined`
 * for the missing half.
 */
export function buildToolPolicyAlertMessage(args: {
  kind: string;
  count: number;
  field?: string;
  error?: string;
  windowStartSec: number;
}): string {
  const windowIso = new Date(args.windowStartSec * 1000).toISOString();
  const parenthetical =
    args.field !== undefined && args.error !== undefined
      ? ` (field "${args.field}": ${truncateError(args.error)})`
      : "";
  const countClause = `${args.count} event(s) in the hour beginning ${windowIso}.`;

  if (args.kind === "malformed_policy_boot") {
    return `Tool-access policy was malformed at startup and degraded to a fully permissive policy${parenthetical}. ${countClause}`;
  }
  if (args.kind === "malformed_policy_reload_rejected") {
    return `A tool-access policy reload was rejected as malformed; the previously loaded policy is still in effect${parenthetical}. ${countClause}`;
  }
  // Defensive fallback — ALERTING_POLICY_KINDS is the only caller-supplied
  // source of `kind`, so this branch is unreachable in practice.
  return `Tool-access policy event (${args.kind})${parenthetical}. ${countClause}`;
}

type ToolPolicyEventRow = {
  field?: string;
  error?: string;
  timestamp: number;
};

/**
 * Runs once per hour, called from the TAIL of `computeHourly`
 * (D-06, Task 2's call site in `convex/aggregates.ts`) — see this file's
 * header comment for why a dedicated cron is forbidden here.
 *
 * Reads performed, all bounded:
 *   - Per kind in ALERTING_POLICY_KINDS (exactly 2): one `toolPolicyEvents`
 *     `by_event` index-range read, capped at POLICY_EVENT_READ_CAP.
 *   - Per kind that has at least one event in the window: one `alerts`
 *     `by_source` index read (dedup) — bounded by however many prior alerts
 *     share this exact `tool-policy:{kind}` source string, which the
 *     per-completed-hour dedup key keeps small (at most one per kind per
 *     hour, by construction).
 * No read here ever touches `toolPolicyEvents` outside the completed hour.
 *
 * Per-kind isolation (mirrors costBudgetEval.ts's per-budget-row isolation):
 * one kind's failure is caught and counted here, never allowed to stop the
 * other kind — and (via the try/catch at the computeHourly call site, Task 2)
 * never allowed to fail the hourly rollup itself.
 */
export async function evaluateToolPolicyAlerts(
  ctx: MutationCtx,
  nowSec: number
): Promise<{ fired: number; skippedDeduped: number; skippedNoEvents: number; errors: number }> {
  // Same last-completed-hour boundary computeHourly uses, derived from the
  // passed `nowSec` and never from a second `Date.now()` call, so the two
  // cannot disagree by milliseconds.
  const windowStart = Math.floor(nowSec / 3600) * 3600 - 3600;
  const windowEnd = windowStart + 3600;

  let fired = 0;
  let skippedDeduped = 0;
  let skippedNoEvents = 0;
  let errors = 0;

  for (const kind of ALERTING_POLICY_KINDS) {
    try {
      const rows = (await ctx.db
        .query("toolPolicyEvents")
        .withIndex("by_event", (q: any) =>
          q.eq("event", kind).gte("timestamp", windowStart).lt("timestamp", windowEnd)
        )
        .take(POLICY_EVENT_READ_CAP)) as unknown as ToolPolicyEventRow[];

      if (rows.length === 0) {
        skippedNoEvents++;
        continue;
      }

      const source = `tool-policy:${kind}`;

      // PERFORMANCE INVARIANT (do not remove the createdAt lower bound):
      // `alerts` is retained forever (retention.ts), so an unbounded scan of
      // every alert ever fired for this source would grow by potentially one
      // row per hour, forever — inside `computeHourly`, the one mutation
      // that must not blow the self-hosted 15s syscall cap. The `by_source`
      // index is composite ["source","createdAt"], so this range-bounds for
      // free. This cannot drop a match: an alert for this window is always
      // written DURING or after it, so its createdAt >= windowStart always
      // holds. Removing this bound is a live incident, not a cleanup.
      const priorAlerts = (await ctx.db
        .query("alerts")
        .withIndex("by_source", (q: any) => q.eq("source", source).gte("createdAt", windowStart))
        .collect()) as unknown as Array<{ details?: { windowStart?: number } }>;
      const alreadyFired = priorAlerts.some((a) => a.details?.windowStart === windowStart);
      if (alreadyFired) {
        skippedDeduped++;
        continue;
      }

      // field/error come from the MOST RECENT row in the window (last in the
      // ascending-by-timestamp `by_event` index order).
      const mostRecent = rows[rows.length - 1];
      const message = buildToolPolicyAlertMessage({
        kind,
        count: rows.length,
        field: mostRecent.field,
        error: mostRecent.error,
        windowStartSec: windowStart,
      });

      // Insert DIRECTLY into `alerts` — never through the public mutation on
      // that module (Phase 104 D-17: that mutation does not deliver).
      const alertId = await ctx.db.insert("alerts", {
        severity: policyAlertSeverity(kind),
        source,
        message,
        acknowledged: false,
        status: "active",
        createdAt: nowSec,
        webhookStatus: "pending",
        details: {
          kind,
          windowStart,
          windowEnd,
          count: rows.length,
          field: mostRecent.field,
          error: mostRecent.error,
          truncated: rows.length >= POLICY_EVENT_READ_CAP,
        },
      });

      // GUARD: this scheduler call is the ONLY function this file ever
      // schedules — no policy write, no tool disable, no astridr dispatch
      // (this phase observes, never enforces — the phase boundary).
      await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
        alertId,
        attempt: 1,
      });
      fired++;
    } catch (err) {
      // Per-kind isolation: one malformed kind's evaluation must never block
      // the other kind, and (via the caller's own try/catch at
      // computeHourly's tail) never fail the hourly rollup itself.
      console.warn(`[evaluateToolPolicyAlerts] kind ${kind} failed:`, (err as Error).message);
      errors++;
    }
  }

  return { fired, skippedDeduped, skippedNoEvents, errors };
}
