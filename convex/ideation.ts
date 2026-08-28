import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { partitionBatchForPrune } from "./retentionCursor";

export const recordFinding = mutation({
  args: {
    scanType: v.string(),
    severity: v.string(),
    category: v.string(),
    location: v.string(),
    description: v.string(),
    suggestedFix: v.optional(v.string()),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ideationFindings")
      .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
      .filter((q) => q.eq(q.field("dismissed"), false))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("ideationFindings", {
      ...args,
      dismissed: false,
      createdAt: Date.now() / 1000,
    });
  },
});

export const listFindings = query({
  args: {
    dismissed: v.optional(v.boolean()),
  },
  handler: async (ctx, { dismissed }) => {
    if (dismissed !== undefined) {
      return await ctx.db
        .query("ideationFindings")
        .withIndex("by_dismissed", (q) => q.eq("dismissed", dismissed))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("ideationFindings").order("desc").collect();
  },
});

export const findingStats = query({
  handler: async (ctx) => {
    const active = await ctx.db
      .query("ideationFindings")
      .withIndex("by_dismissed", (q) => q.eq("dismissed", false))
      .collect();
    const stats = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of active) {
      if (f.severity in stats) {
        stats[f.severity as keyof typeof stats]++;
      }
    }
    return stats;
  },
});

const VALID_STATUSES = ["open", "acknowledged", "converted", "dismissed"] as const;

export const updateFindingStatus = mutation({
  args: {
    id: v.id("ideationFindings"),
    status: v.string(),
  },
  handler: async (ctx, { id, status }) => {
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    const now = Date.now() / 1000;
    const patch: Record<string, unknown> = { status };
    if (status === "acknowledged") {
      patch.acknowledgedAt = now;
    } else if (status === "converted") {
      patch.convertedAt = now;
    } else if (status === "dismissed") {
      patch.dismissed = true;
      patch.dismissedAt = now;
    }
    await ctx.db.patch(id, patch);
  },
});

export const linkTask = mutation({
  args: {
    id: v.id("ideationFindings"),
    taskId: v.string(),
  },
  handler: async (ctx, { id, taskId }) => {
    const now = Date.now() / 1000;
    await ctx.db.patch(id, {
      taskId,
      status: "converted",
      convertedAt: now,
    });
  },
});

// ============================================================
// Phase 127 (JANITOR-02) — ack-aware auto-dismiss/prune janitor
// ============================================================
//
// Purpose: `ideationFindings` is a 470-row triage queue growing at 5.1
// rows/day in which nobody has ever dismissed anything (0 of 470 rows are
// dismissed, measured 2026-08-21). A `dismissedAt`-keyed delete step alone
// would therefore delete exactly zero rows forever -- an inert mechanism
// that looks like a fix. Auto-dismissing findings at IDEATION_AUTODISMISS_AGE_SEC
// is what gives the delete step anything to act on. Mirrors the sibling
// `inbox` janitor's bounded, cursor-seeked, self-rescheduling two-step
// chain shape (plan 127-02) -- deliberately NOT sharing code with it (D-01
// rejects a parameterized generic across tables, because the carve-out
// logic could silently swap between them).

/**
 * Ctx shape the janitor needs: `db` (read/write) and `scheduler`
 * (self-reschedule via `runAfter`). Narrowed from the generated
 * `MutationCtx` the same way `media.ts`'s `JanitorCtx` narrows its own ctx
 * -- so a fake ctx implementing only these two surfaces is enough to
 * unit-test the handler without booting the Convex runtime.
 */
type JanitorCtx = Pick<MutationCtx, "db" | "scheduler">;

/**
 * D-05's M (auto-dismiss age threshold), held at 180 days per R-01 rather
 * than shortened to 90. R-01's disclosure: a finding left open for months
 * may mean "still unfixed and important" rather than "abandoned" -- the
 * consequence of keeping M at 180 is that the auto-dismiss step below
 * matches ZERO rows until roughly 2026-11-16 (the oldest row was 94 days
 * old on 2026-08-21). The mandatory log line in the chain handler below is
 * the ONLY thing that will distinguish a correct, dormant mechanism from a
 * dead one for those ~83 days -- that is why R-01 promoted it from a
 * nicety to a hard requirement.
 */
export const IDEATION_AUTODISMISS_AGE_SEC = 180 * 24 * 60 * 60;

/** D-05's G -- grace period between `dismissed: true` and permanent delete. */
export const IDEATION_DISMISSED_GRACE_SEC = 90 * 24 * 60 * 60;

/**
 * Batch size, re-derived against the 4,096-READ ceiling this deployment
 * actually enforces -- transcribed live error text at
 * `convex/graphSnapshots.ts:505`: "Too many reads in a single function
 * execution (limit: 4096)". This is NOT the 16,000/32,000-document figures
 * on Convex's published limits page -- those are WRITE ceilings, and this
 * repo has already lost sessions to bisecting a batch cap against the wrong
 * one (see `convex/retention.ts`'s `BATCH_SIZE` comment and
 * `convex/media.ts`'s `TRASH_PRUNE_BATCH_SIZE` comment for the identical
 * arithmetic on sibling janitors). A `.take(IDEATION_JANITOR_BATCH_SIZE)`
 * read costs up to 200 reads; `ctx.db.patch()` (auto-dismiss step) and
 * `ctx.db.delete()` (delete step) are each budgeted conservatively as if
 * they ALSO count as a read (they do, per the graphSnapshots.ts citation
 * above), so worst case is 200 (query read) + 200 (patch/delete-as-read) =
 * ~400 reads/invocation -- comfortably under 4,096 with >10x headroom.
 */
export const IDEATION_JANITOR_BATCH_SIZE = 200;

/**
 * Per-chain batch ceiling (D-02), matching `retention.ts`'s
 * `MAX_BATCHES_PER_NIGHT` shape and the sibling `inbox` janitor: a run that
 * would exceed this defers its remainder to the next scheduled invocation
 * instead of self-rescheduling forever. At 200 rows/batch this bounds one
 * chain to 100 * 200 = 20,000 rows acted on before it stops. The known
 * worst-case backlog on this table is <=470 rows / ~3 batches (T-127-11),
 * so this ceiling is pure headroom today, not a functional limit.
 */
export const IDEATION_JANITOR_MAX_BATCHES = 100;

/**
 * Inter-batch delay in MILLISECONDS -- the one non-seconds constant in this
 * section, because `ctx.scheduler.runAfter` takes milliseconds regardless
 * of the table's own units (every `ideationFindings` timestamp is epoch
 * SECONDS). Matches `retention.ts`'s `RESCHEDULE_DELAY_MS` /
 * `media.ts`'s `TRASH_PRUNE_RESCHEDULE_MS` -- a moment between batches so a
 * long sweep doesn't starve ingest/browser reads on this single-node
 * SQLite instance.
 */
const IDEATION_JANITOR_RESCHEDULE_MS = 3000;

/**
 * shouldAutoDismiss -- D-04's carve-out: a `severity` of `critical` or
 * `high` is NEVER auto-dismissed, human-only closure. Written as its own
 * named predicate (never inlined at the call site) so T-127-09's
 * mutation-testing control (plan 127-07) has one exact line to mutate, and
 * so a future editor cannot accidentally fold this into `shouldDeleteDismissed`
 * below without the diff being visible at both declarations.
 */
export function shouldAutoDismiss(row: { severity: string }): boolean {
  return row.severity !== "critical" && row.severity !== "high";
}

/**
 * shouldDeleteDismissed -- unconditionally true. There is deliberately NO
 * delete-step carve-out: a `critical`/`high` finding can only ever reach
 * `dismissed: true` by a HUMAN dismissing it (`shouldAutoDismiss` above
 * already excludes those severities from the auto-dismiss step), and a
 * human-dismissed finding is ordinary closed data with nothing left to
 * protect. Written as an explicit named predicate rather than passed as
 * `undefined` so the asymmetry with `shouldAutoDismiss` stays visible at
 * both call sites and a future edit cannot silently make the two steps
 * share one guard (Pitfall 4, `127-RESEARCH.md`).
 */
export function shouldDeleteDismissed(_row: { severity: string }): boolean {
  return true;
}

/**
 * runIdeationAutoDismissStep -- the auto-dismiss half of the chain (D-05).
 * Bounded, cursor-seeked read through the widened `by_dismissed` index:
 * fixed `dismissed = false`, ranged on `createdAt` from `cursor`
 * (inclusive) up to `nowSec - IDEATION_AUTODISMISS_AGE_SEC` (exclusive),
 * ascending, `.take(IDEATION_JANITOR_BATCH_SIZE)`. Chained-builder form for
 * this two-field eq+range read verified against `convex/retention.ts:341-347`'s
 * `.gte(...).lt(...)` shape -- `127-RESEARCH.md`'s quoted code is a draft
 * only, corrected here against the live query builder.
 *
 * `shouldAutoDismiss`-matching rows get `{ dismissed: true, dismissedAt:
 * nowSec }` patched together, matching what both existing human dismiss
 * writers (`dismissFinding` above, `convex/ideationFindings.ts`'s `dismiss`)
 * already do -- so the absent-field ordering guarantee the delete step
 * relies on (an un-dismissed row's `dismissedAt` stays wholly absent, never
 * a stray value) holds for janitor-written rows too.
 *
 * The cursor advances from `lastCursorValue` -- sourced from EVERY row the
 * batch iterated, dismissed or carved out by `shouldAutoDismiss` -- never
 * from only the rows actually patched (D-08): a batch made entirely of
 * carved-out critical/high rows must still make forward progress, or the
 * chain stalls re-reading the same window forever.
 */
async function runIdeationAutoDismissStep(
  ctx: JanitorCtx,
  cursor: number,
  nowSec: number
): Promise<{ actedCount: number; batchLength: number; nextCursor: number }> {
  const cutoff = nowSec - IDEATION_AUTODISMISS_AGE_SEC;
  const batch = await ctx.db
    .query("ideationFindings")
    .withIndex("by_dismissed", (q: any) =>
      q.eq("dismissed", false).gte("createdAt", cursor).lt("createdAt", cutoff)
    )
    .order("asc")
    .take(IDEATION_JANITOR_BATCH_SIZE);

  const { toDelete: toDismiss, lastCursorValue } = partitionBatchForPrune(
    batch,
    shouldAutoDismiss,
    (doc: any) => doc.createdAt
  );

  for (const row of toDismiss) {
    await ctx.db.patch(row._id, { dismissed: true, dismissedAt: nowSec });
  }

  return {
    actedCount: toDismiss.length,
    batchLength: batch.length,
    // D-08: advance from lastCursorValue over every iterated row, never
    // from cursor unchanged and never from only the acted-on rows. An
    // empty batch (lastCursorValue null) leaves the cursor where it was.
    nextCursor: lastCursorValue ?? cursor,
  };
}

/**
 * runIdeationDeletePruneStep -- the permanent-delete half of the chain
 * (D-05's grace period G). Bounded, cursor-seeked read through
 * `by_dismissedAt` as a range on `dismissedAt`: seek from `cursor`
 * (inclusive) up to `nowSec - IDEATION_DISMISSED_GRACE_SEC` (exclusive),
 * ascending, `.take(IDEATION_JANITOR_BATCH_SIZE)`.
 *
 * Undismissed rows are STRUCTURALLY excluded from this range, not merely
 * filtered out of it: Convex indexes an absent field only under
 * `undefined`, and orders `undefined < null < all other values` (cited at
 * `convex/controlVerbSwaps.ts:109`, re-derived independently at
 * `convex/media.ts:733-736`'s `by_deletedAt` scan), so an absent
 * `dismissedAt` sorts below any real cursor value and this range never
 * matches it. That guarantee survives an edit that deletes every
 * post-query predicate in this file -- unlike the `severity` carve-out
 * above, which is enforced by `shouldDeleteDismissed`/`shouldAutoDismiss`
 * alone and has NO database-level backstop (T-127-09). The two guarantees
 * have different strengths, which is why plans 127-05 (automated test) and
 * 127-07 (manual mutation-testing control) test them differently.
 *
 * Split with `shouldDeleteDismissed` (unconditionally true -- see its own
 * docstring for why there is no delete-step carve-out) and `ctx.db.delete`
 * each returned row. Cursor advances from `lastCursorValue` over every
 * iterated row (D-08), same discipline as the auto-dismiss step.
 */
async function runIdeationDeletePruneStep(
  ctx: JanitorCtx,
  cursor: number,
  nowSec: number
): Promise<{ actedCount: number; batchLength: number; nextCursor: number }> {
  const cutoff = nowSec - IDEATION_DISMISSED_GRACE_SEC;
  const batch = await ctx.db
    .query("ideationFindings")
    .withIndex("by_dismissedAt", (q: any) =>
      q.gte("dismissedAt", cursor).lt("dismissedAt", cutoff)
    )
    .order("asc")
    .take(IDEATION_JANITOR_BATCH_SIZE);

  const { toDelete, lastCursorValue } = partitionBatchForPrune(
    batch,
    shouldDeleteDismissed,
    (doc: any) => doc.dismissedAt ?? 0
  );

  for (const row of toDelete) {
    await ctx.db.delete(row._id);
  }

  return {
    actedCount: toDelete.length,
    batchLength: batch.length,
    nextCursor: lastCursorValue ?? cursor,
  };
}

/**
 * Renders an epoch-SECONDS cutoff as a human-readable UTC date for R-01's
 * mandatory log line below. A `fmt(cutoff)` that printed a 1970 date would
 * be the loudest possible signal that a seconds/milliseconds error had
 * slipped in -- this repo has shipped that exact defect before (CLAUDE.md's
 * "Telemetry timestamps are epoch SECONDS" lesson) -- so the cutoff is
 * always rendered, never logged as the raw number alone.
 */
function fmtCutoffSec(cutoffSec: number): string {
  return new Date(cutoffSec * 1000).toISOString();
}

export interface AutoCloseAndPruneArgs {
  step?: "dismissing" | "deleting";
  cursor?: number;
  batchesDone?: number;
}

export interface AutoCloseAndPruneResult {
  /** The step the NEXT scheduled invocation (if any) will run -- equal to
   * the step just processed unless this call was the one that transitioned
   * "dismissing" -> "deleting". */
  step: "dismissing" | "deleting";
  actedCount: number;
  nextCursor: number;
  rescheduled: boolean;
}

/**
 * autoCloseAndPruneHandler -- the two-step self-rescheduling chain (D-02),
 * exported plain so it is directly unit-testable with a fake `JanitorCtx`,
 * without booting the Convex runtime (this repo has no `convex-test`
 * harness -- see `runtimeIngest.test.ts:9`).
 *
 * "dismissing" auto-dismisses eligible open findings past
 * `IDEATION_AUTODISMISS_AGE_SEC`; a short (drained) "dismissing" batch
 * transitions to "deleting" with the cursor reset to 0. "deleting"
 * permanently removes findings dismissed for longer than
 * `IDEATION_DISMISSED_GRACE_SEC`; a short "deleting" batch ends the chain.
 * A full batch in either step reschedules the SAME step with the cursor
 * advanced. Both steps share ONE batch budget carried across the
 * transition -- `batchesDone` is only ever incremented, never reset; only
 * the cursor resets on transition. Mirrors the sibling `inbox` janitor's
 * chain shape (plan 127-02) without sharing code with it (D-01).
 */
export async function autoCloseAndPruneHandler(
  ctx: JanitorCtx,
  args: AutoCloseAndPruneArgs,
  nowSec: number
): Promise<AutoCloseAndPruneResult> {
  const step = args.step ?? "dismissing";
  const cursor = args.cursor ?? 0;
  const batchesDone = args.batchesDone ?? 0;

  // D-02 entry guard, before ANY read: once this chain has already used its
  // per-chain ceiling, do no work at all -- the remainder waits for the
  // next scheduled invocation rather than looping.
  if (batchesDone >= IDEATION_JANITOR_MAX_BATCHES) {
    console.log(
      `ideation: auto-close/prune per-chain batch cap (${IDEATION_JANITOR_MAX_BATCHES}) already reached at step "${step}"; remainder deferred to the next scheduled run`
    );
    return { step, actedCount: 0, nextCursor: cursor, rescheduled: false };
  }

  const stepResult =
    step === "dismissing"
      ? await runIdeationAutoDismissStep(ctx, cursor, nowSec)
      : await runIdeationDeletePruneStep(ctx, cursor, nowSec);

  const batchesUsedAfter = batchesDone + 1;
  const batchWasFull = stepResult.batchLength >= IDEATION_JANITOR_BATCH_SIZE;
  const canReschedule = batchesUsedAfter < IDEATION_JANITOR_MAX_BATCHES;

  let nextStep: "dismissing" | "deleting" = step;
  let nextCursorForSchedule = stepResult.nextCursor;
  let rescheduled = false;

  if (batchWasFull) {
    // Same step, more eligible rows may remain past this batch's window.
    rescheduled = canReschedule;
  } else if (step === "dismissing") {
    // Short "dismissing" batch: the auto-dismiss window is drained.
    // Transition to "deleting" with a reset cursor (D-02). batchesDone
    // carries forward via batchesUsedAfter below -- never reset here.
    nextStep = "deleting";
    nextCursorForSchedule = 0;
    rescheduled = canReschedule;
  }
  // else: short "deleting" batch -- that window is drained too. The chain
  // ends here; rescheduled stays false.

  if (rescheduled) {
    await ctx.scheduler.runAfter(
      IDEATION_JANITOR_RESCHEDULE_MS,
      internal.ideation.autoCloseAndPrune,
      { step: nextStep, cursor: nextCursorForSchedule, batchesDone: batchesUsedAfter }
    );
  }

  // R-01's mandatory log line -- fires on EVERY invocation that reaches
  // this point, including one that acted on zero rows, and is NEVER nested
  // inside an `if (actedCount > 0)` guard. At M=180d this janitor matches
  // zero rows until roughly 2026-11-16 (the oldest ideationFindings row was
  // 94 days old on 2026-08-21); for those ~83 days this line is the ONLY
  // evidence distinguishing a correct, dormant mechanism from a dead one. A
  // zero-row run must be attributable to a real, logged cutoff -- not to
  // silence.
  const cutoffSec =
    step === "dismissing"
      ? nowSec - IDEATION_AUTODISMISS_AGE_SEC
      : nowSec - IDEATION_DISMISSED_GRACE_SEC;
  console.log(
    `ideation: auto-close/prune ran step "${step}", acted on ${stepResult.actedCount} row(s), cutoff ${fmtCutoffSec(cutoffSec)}${rescheduled ? `, rescheduled to step "${nextStep}"` : ""}`
  );

  return {
    step: nextStep,
    actedCount: stepResult.actedCount,
    nextCursor: nextCursorForSchedule,
    rescheduled,
  };
}

/**
 * `internalMutation`, same rationale as `media.ts`'s `pruneTrashBatch`
 * (T-127-13): this reaches an irreversible permanent delete with no UI
 * control anywhere in this phase -- only the nightly cron
 * (`convex/crons.ts`, wired by a later wave-2 plan) may reach it.
 */
export const autoCloseAndPrune = internalMutation({
  args: {
    step: v.optional(v.union(v.literal("dismissing"), v.literal("deleting"))),
    cursor: v.optional(v.number()),
    batchesDone: v.optional(v.number()),
  },
  handler: async (ctx, args) => autoCloseAndPruneHandler(ctx, args, Date.now() / 1000),
});
