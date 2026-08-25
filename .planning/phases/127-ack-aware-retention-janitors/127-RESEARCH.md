# Phase 127: Ack-Aware Retention Janitors - Research

**Researched:** 2026-08-25 (revised same day after a mid-flight design correction — see note below)
**Domain:** Convex self-hosted backend — bounded, self-rescheduling cron mutations (cursor-seeked batch prune)
**Confidence:** HIGH

**Revision note:** This document was corrected after an adversarial review changed R-02 in
`127-CONTEXT.md`. The `inbox` janitor no longer stamps `ackedAt` — it stamps a NEW
`closedAt: v.optional(v.float64())` field instead, because `ackedAt` is the only
schema representation of "the operator saw this" and two live frontend surfaces render
read/unread state from it. Every section below reflects the revised design. The janitor's
original `ackedAt`-keyed index proposal is superseded by the `closedAt`-keyed one throughout.

<user_constraints>
## User Constraints (from CONTEXT.md)

`127-CONTEXT.md` is not a discuss-phase Decisions/Discretion/Deferred output — it is a complete,
independently-verified design doc (Codex's design, corrected against live measurement, itself
verified line-by-line against the tree on 2026-08-21, with a citation-drift re-check and one
substantive R-02 revision on 2026-08-25). There is no "Claude's Discretion" section: every
decision below is LOCKED. The planner must not re-derive or second-guess any of them; research's
job (this document) was to supply the factual substrate underneath them, not to relitigate them.

### Locked Decisions

- **D-01** — Two separate janitors: `internal.inbox.autoCloseAndPrune` (in `inbox.ts`) and
  `internal.ideation.autoCloseAndPrune` (in `ideation.ts`). No shared generic, no profile
  partitioning inside the `inbox` janitor.
- **D-02** — Each janitor is a self-rescheduling TWO-STEP chain: (1) bounded, cursor-seeked
  auto-close of stale-open rows with the carve-out applied AFTER the query returns, never folded
  into the index query; (2) bounded, cursor-seeked delete on the closed-at field range. One
  index, one query shape, one cutoff per step — not two separate deletion branches. Copy
  `alerts.autoAcknowledgeStaleInternal`'s auto-ack SHAPE, never its unbounded `.collect()`.
- **D-03** — `inbox` carve-out: `itemType === "held"` is excluded from BOTH auto-close and
  delete (external consumer, `focus_digest.py`, via `inboxIngest.ts:174`). `priority === "money"`
  is excluded from auto-close ONLY — once humanly closed it ages out normally. These two
  carve-outs are asymmetric and that asymmetry is load-bearing. `itemType === "alert"` is NOT
  carved out (stale comment only, zero live rows). `signal` rows get no special case.
- **D-04** — `ideationFindings` carve-out: `severity` in `{critical, high}`, never
  auto-dismissed, human-only closure.
- **D-05** — Windows: `inbox` 30d unacked→auto-close, 14d grace after close (worst case 44d).
  `ideationFindings` 180d open→auto-dismiss, 90d grace after dismiss (worst case 270d). D-05's
  original disclosure ("an auto-acked card displays as read for the grace window") was
  **superseded by R-02's revision below** — the janitor no longer touches `ackedAt` at all, so
  that specific cost no longer applies; a different, smaller cost replaces it (see R-02). Carve-out
  rows remain technically unbounded forever — a disclosed, accepted tradeoff identical in shape
  to `alerts`' existing `critical` exemption.
- **D-06** — New/widened indexes, no backfill required (Convex's `undefined < null < all other
  values` index ordering structurally excludes not-yet-closed/undismissed rows from the delete
  range): `inbox` gets `.index("by_closedAt", ["closedAt", "createdAt"])` — **REVISED, see R-02**;
  the original proposal keyed the index on the `ackedAt` field itself, superseded.
  `ideationFindings`'s `.index("by_dismissed", ["dismissed"])` widens to
  `["dismissed", "createdAt"]`, plus a new `.index("by_dismissedAt", ["dismissedAt"])` — this half
  is UNCHANGED by the revision.
- **D-07** — Cadence: two `crons.daily()` registrations (see R-04 for the final settled UTC
  times), batch size 200 (matches `TRASH_PRUNE_BATCH_SIZE`), per-chain cap mirroring
  `TRASH_PRUNE_MAX_BATCHES = 100`. Budget conservatively: 200 reads + 200 patches = 400/step,
  assuming (unverified at CONTEXT.md write time, settled by this research — see D-07's own
  research question below) `ctx.db.patch()` counts toward the ~4,096-read ceiling exactly like
  `ctx.db.delete()` already proven to. **Post-revision note:** the auto-close step's patch count
  now also includes a one-time backfill of already-acked rows (`ackedAt != null`, `closedAt`
  absent) that need `closedAt` stamped — measured 321 rows one-time, then ~16/day ongoing. This
  does not change the per-batch arithmetic (still bounded by the same `.take(200)`), only the
  TOTAL number of batches the initial backlog-draining run needs.
- **D-08** — The cursor MUST advance past carved-out (skipped) rows, sourced from EVERY iterated
  doc, not only acted-on ones — the identical shape `partitionBatchForPrune` already encodes and
  is already tested for. Gets its own required acceptance check (Verification C), not just a
  comment.
- **D-09** — Moving both tables from `COVERAGE_PRUNE_PROPOSED` to `COVERAGE_BOUNDED_BY_CRON` is
  PART OF THIS PHASE, not a follow-up — this is what makes the mechanism's future death
  detectable via `retentionCoverage.test.ts`'s machine check.
- **D-10 (OUT OF SCOPE)** — The `status: "converted"` gap in `ideation.ts`'s `linkTask` (sets
  status without touching `dismissed`) is a pre-existing app-level gap. Do not fix it in this
  phase; do not smuggle a "converted implies dismissed" change in.
- **D-11 (OUT OF SCOPE)** — The unbounded `.collect()` reads on `inbox`
  (`listHeldUnackedHandler`, `dismissAllCards`) are Phase 126's territory. This phase must not
  cap `listHeldUnacked` — `inboxIngest.ts:174` needs the TRUE unbounded set for
  `focus_digest.py`. The janitor reduces the severity of that read over time by shrinking the
  table; it does not close the gap.

### Planning-time resolutions (settled 2026-08-25, also locked — no deviation)

- **R-01** — `ideationFindings` auto-dismiss window stays **M = 180d** (rejected shortening to
  90d). Consequence: auto-dismiss matches ZERO rows until ~2026-11-16. **The janitor MUST emit
  a log line stating it ran and matched nothing** — this is now a hard requirement, not a
  nicety, because for ~83 days that log line is the ONLY evidence distinguishing "correct and
  dormant" from "dead on arrival."
- **R-02 (REVISED 2026-08-25 after adversarial review) — `inbox` stays auto-close-then-delete
  at G = 14d, but closes into a NEW field, `closedAt`, NEVER into `ackedAt`.**
  The original resolution had the janitor stamp `ackedAt`, accepting the disclosed cost that an
  auto-acked card displays as read for the grace window. That framed the choice as a false
  binary (auto-ack vs. direct-delete); a third option dominates both. `ackedAt` is the ONLY
  schema representation of "the operator saw this," and TWO live consumers render read/unread
  state from it directly (verified by this research, both confirmed live 2026-08-25):
  `src/pages/Inbox.tsx:130` (`read: row.ackedAt != null`) and
  `src/components/control-center/IntelligenceFeedPanel.tsx:64` (`stripeClass` suppresses the
  unread stripe when `ackedAt != null`). The held-only badge queries
  (`convex/inbox.ts` `countHeldUnackedHandler`, `listHeldUnackedHandler`) are NOT affected — they
  are scoped to `itemType === "held"`, which D-03 carves out of both janitor steps entirely.
  **Revised mechanism:** add `closedAt: v.optional(v.float64())` to the `inbox` table. The
  auto-close step stamps `closedAt` for BOTH cases in one pass: a row a human already acked
  (`ackedAt != null`, `closedAt` still absent) and a row aged past M that is not carved out. The
  delete step cursors on `closedAt` alone, via the new `by_closedAt` index (see D-06). This
  preserves D-02's one-index/one-cursor-shape and the 14-day audit/undo window unchanged, and
  makes the structural absent-field guarantee (D-06) if anything CLEANER — `closedAt` has
  exactly one writer (this janitor) versus `ackedAt`'s five. What it gives up is D-02's third
  rationale ("make the machine action indistinguishable from a human one") — that principle is
  sound only where nothing reads the distinction, and two surfaces do. **New disclosed cost**
  (replacing the old one): an auto-closed card stays visibly **UNREAD** for its 14-day grace
  window and then disappears, rather than going quiet first — the honest rendering of what
  actually happened, at the price of one new schema field and ~321 one-time + ~16/day ongoing
  extra patches to backfill `closedAt` on already-acked rows. `ideationFindings` is deliberately
  NOT changed to match — its `dismissed`/`dismissedAt` fields carry no read/unread rendering
  semantics anywhere in the app, so the problem this revision fixes does not exist there; D-01's
  "two janitors, not one shared generic" continues to justify the asymmetry.
- **R-03** — **No outer force-expire ceiling.** Carve-out rows (`money`, `critical`/`high`) stay
  unbounded forever, by design — rejected adding a third code path per janitor.
- **R-04** — Cron slots are **08:20 UTC** (`inbox-janitor`) and **08:35 UTC**
  (`ideation-findings-janitor`) — NOT the 08:00/08:15 D-07 originally proposed, because
  `sweep-graph-snapshot-versions` is `crons.interval({ hours: 1 })` and also fires at 08:00 UTC
  (confirmed live in `crons.ts` by this research — see Sources). The 15-minute offset between
  the two new janitors is preserved.

### Deferred Ideas (OUT OF SCOPE)

Same as D-10/D-11 above — there is no separate "Deferred Ideas" list in this CONTEXT.md; the two
out-of-scope items are folded into the numbered decisions themselves. Also explicitly
out-of-scope per this research's own tasking: capping `inbox.listHeldUnacked`/`dismissAllCards`
(D-11/Phase 126's), fixing `alerts.ts`'s unbounded `.collect()`, and closing the
`status: "converted"` gap (D-10).
</user_constraints>

### Phase Requirement IDs — not yet assigned

REQUIREMENTS.md has no entry for Phase 127 yet (confirmed by direct read 2026-08-25 — the
traceability table ends at SWEEP-07/Phase 126). Per the task framing, requirement IDs are to be
derived at planning time from D-01..D-11 + R-01..R-04. This research's read: the natural
granularity is **one requirement per table-janitor plus one for the coverage move**, e.g.
`JANITOR-01` (inbox auto-close+prune, covering D-01/D-02/D-03/D-05/D-06/D-07/D-08/R-01/R-02/R-04
as they apply to `inbox`, including the `closedAt` field addition), `JANITOR-02` (same for
`ideationFindings`), `JANITOR-03` (the D-09 coverage-bucket move + its machine-check staying
green). A finer per-decision breakdown (11+4 separate IDs) would over-fragment a single cohesive
mechanism; a single `JANITOR-01` covering both tables would understate that D-03/D-04's
carve-outs are genuinely different per table and each needs its own Verification B
mutation-testing pass. Three requirement IDs is this research's recommendation, not a locked
decision — the planner should confirm the split.

## Summary

This phase's design is already locked in `127-CONTEXT.md` (D-01..D-11, R-01..R-04) and this
research does not revisit it. Every citation in CONTEXT.md was re-derived against the live tree
2026-08-25 for this document; results are reported plainly below (mostly HOLD, a few genuine
drifts/corrections, plus the substantive R-02 revision superseding the original `ackedAt`-stamp
design with a new `closedAt` field — this document reflects the REVISED design throughout). The
two open technical questions CONTEXT.md deferred — the `patch()` read-cost assumption (D-07) and
the index-widen deploy-diff behavior (D-06) — are now settled as far as they can be without a
live deploy (forbidden for this research pass): both get a clear, evidence-backed recommendation,
with the residual uncertainty on the second one flagged as a mandatory implementation-time
verification step, not a guess.

**Primary recommendation:** Implement `internal.inbox.autoCloseAndPrune` and
`internal.ideation.autoCloseAndPrune` as faithful structural clones of
`pruneTrashBatchHandler` (`convex/media.ts:707-788`), reusing `partitionBatchForPrune`
(`convex/retentionCursor.ts:141-154`) unmodified for the carve-out/cursor-advance logic in
both the auto-close and delete steps. `inbox`'s auto-close step stamps a NEW `closedAt` field
(never `ackedAt`, per R-02's revision); `ideationFindings` keeps its existing
`dismissed`/`dismissedAt` fields unchanged. Keep D-07's conservative 200+200=400-read budget per
step — the evidence supports treating `ctx.db.patch()` identically to the already-proven
`ctx.db.delete()` for read-ceiling purposes, and 400 leaves >10x headroom under the
empirically-confirmed ~4,096-read ceiling regardless. Widen `by_dismissed`, add `by_dismissedAt`,
and add the NEW `by_closedAt` index (not an index on `ackedAt`) as designed, but treat the deploy's
index-diff output as a **required read**, not an assumption: this repo has no docs-confirmed
precedent for whether widening an index's field list under the same name prints as an in-place
change or as a delete+add pair.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Auto-close stale unacked `inbox` rows (stamps `closedAt`) / undismissed `ideationFindings` rows | API / Backend (Convex `internalMutation`) | — | Pure server-side cron work; no client ever calls it (D-01 names both as `internal.*`) |
| Bounded delete of closed-and-aged-out rows | API / Backend (Convex `internalMutation`) | — | Same self-rescheduling chain as the auto-close step, sharing one cursor field (`closedAt` for `inbox`, `dismissedAt` for `ideationFindings`) |
| Cron scheduling (08:20/08:35 UTC) | API / Backend (`convex/crons.ts`) | — | Registration only; no UI surface |
| Coverage-gate bookkeeping (`COVERAGE_BOUNDED_BY_CRON`) | API / Backend (`convex/retentionCoverage.ts`) | Database / Storage (machine-checked against `crons.ts`) | A ratchet test, not a runtime component — belongs beside the policy data it audits |
| Indexes (new `by_closedAt`, widened `by_dismissed`, new `by_dismissedAt`) | Database / Storage (`convex/schema.ts`) | — | Schema-only change; no query-shape change for existing read paths. `ackedAt`'s existing semantics and its two frontend consumers are untouched by construction |
| Existing UI surfaces (`/inbox`, `IntelligenceFeedPanel`, briefings digest) | Browser / Client, Frontend (React) | — | Explicitly untouched by this phase's DATA (R-02's revision exists specifically to guarantee this); D-11 separately fences off `listHeldUnacked`/`dismissAllCards` |

Nothing in this phase's scope crosses into the Browser/Client or CDN tiers — it is a pure
backend janitor phase, matching Phase 118's `media.pruneTrashBatch` shape exactly. The R-02
revision is itself evidence of why this map matters: the original design would have made a
backend-only change (stamping `ackedAt`) with an unintended Browser/Client-tier side effect (two
components silently changing what they render) — precisely the kind of cross-tier leak this
mapping step exists to catch before it reaches implementation.

## Standard Stack

No new external packages. This phase is internal Convex code only (`internalMutation`,
`internalQuery`, `v` validators, `ctx.scheduler.runAfter`), all already in
`package.json`'s `convex: ^1.42.0` dependency (confirmed installed: `npx convex --version` →
**1.42.1**, matching the self-hosted `convex-backend` container image, confirmed
`docker ps` → `convex-backend  Up 11 hours (healthy)  ghcr.io/get-convex/convex-backend:latest`).

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. The Package Legitimacy Gate is skipped;
no `[SLOP]`/`[SUS]`/`[ASSUMED]` disposition is needed for any dependency.

## Architecture Patterns

### The `pruneTrashBatchHandler` template, in implementable detail (RQ-3)

Read in full: `convex/media.ts:605-825` (constants at `:638`, `:649`; handler at
`:707-788`; wrapper at `:796` onward). The shape the two new janitors must clone:

**1. Ctx narrowing.** A minimal type describing exactly the `ctx.db`/`ctx.scheduler`
(and, for `media`, `ctx.storage`) surface the handler needs, so a hand-built fake object
is enough to unit-test it without `convex-test` (not installed — see RQ-6 below):

```typescript
// media.ts:614-621
type JanitorCtx = MediaCtx & {
  storage: MediaCtx["storage"] & { delete: (id: any) => Promise<void> };
  scheduler: { runAfter: (delayMs: number, fnRef: any, args: any) => Promise<any> };
};
```
The `inbox`/`ideationFindings` janitors need no `storage` member (no blobs) — their `JanitorCtx`
is strictly smaller: `{ db, scheduler }`.

**2. Named constants, arithmetic justified inline (not just a bare number):**
```typescript
// media.ts:638,649
export const TRASH_PRUNE_BATCH_SIZE = 200;
export const TRASH_PRUNE_MAX_BATCHES = 100;
const TRASH_PRUNE_RESCHEDULE_MS = 3000;
```
D-07 sets the two new janitors to the same `BATCH_SIZE = 200`; per-chain cap can be much
smaller (D-07 suggests 20 is ample — the known backlog is ~2,130 auto-close-eligible `inbox`
rows / ~11 batches at 200 (plus the ~321-row `closedAt` backfill for already-acked rows, well
inside the same headroom), and ≤470 `ideationFindings` rows / ~3 batches).

**3. Handler signature — plain exported function, ctx/args/nowMs, NOT a bare `internalMutation`
callback** (this is what makes it independently unit-testable per-media.test.ts's convention):
```typescript
// media.ts:707-711
export async function pruneTrashBatchHandler(
  ctx: JanitorCtx,
  args: { cursorMs?: number; batchesDone?: number },
  nowMs: number
): Promise<{ deletedCount: number; nextCursorMs: number; rescheduled: boolean }>
```
The two new janitors need a richer return shape and args shape because they have TWO steps
(auto-close, then delete) sharing one chain — see "Two-step chain shape" below.

**4. Entry guard — refuse ALL work, not even a read, once the per-chain cap is hit:**
```typescript
// media.ts:720-725
if (batchesDone >= TRASH_PRUNE_MAX_BATCHES) {
  console.log(`... per-chain batch cap (${TRASH_PRUNE_MAX_BATCHES}) already reached; remainder deferred to the next scheduled run`);
  return { deletedCount: 0, nextCursorMs: cursorMs, rescheduled: false };
}
```

**5. Cursor-seeked, cutoff-bounded range read — the query shape both new janitors' delete
steps must copy exactly, substituting `closedAt` (inbox) / `dismissedAt` (ideationFindings) for
`deletedAt`:**
```typescript
// media.ts:737-743
const batch = await ctx.db
  .query("media")
  .withIndex("by_deletedAt", (q: any) =>
    q.gte("deletedAt", cursorMs).lt("deletedAt", cutoffMs)
  )
  .order("asc")
  .take(TRASH_PRUNE_BATCH_SIZE);
```
For the AUTO-CLOSE step, the query shape is different in kind — it is not a range on the
closed-at field (that field is what's being SET), it is an equality match on "still open"
ordered by age, matching D-02/D-06's (REVISED) `by_closedAt`/widened `by_dismissed` index design:
```typescript
// inbox auto-close step (new — matches D-06's REVISED by_closedAt = ["closedAt","createdAt"])
const batch = await ctx.db
  .query("inbox")
  .withIndex("by_closedAt", (q) =>
    q.eq("closedAt", undefined).lt("createdAt", closeCutoffMs)
  )
  .order("asc")     // oldest-first by createdAt (index's 2nd field)
  .take(BATCH_SIZE);
```
Note this query catches BOTH rows this step must act on: a row a human already acked
(`ackedAt != null`, `closedAt` still absent — needs `closedAt` backfilled) and a row aged past M
untouched by any human action (also `closedAt` absent). Both are indistinguishable to this
query by design — the auto-close step's loop body decides what to write (see point 6), but the
QUERY correctly returns both in one pass, which is what keeps this a one-index/one-query-shape
mechanism per D-02/R-02. Convex's `withIndex` callback chains one range per field in the order
the index declares them — `.eq("closedAt", undefined)` fixes the first field, and `createdAt`'s
range (`.lt(closeCutoffMs)`) is expressed in the SAME callback. Verify the exact chained-builder
form against this repo's other two-field range queries at implementation time (e.g.
`convex/inbox.ts:161-165`'s `by_profile` usage for the general shape); the pseudocode above is
illustrative of the INDEX design, not a copy-pasteable final query.

**6. Loop body — per-row action, cursor high-water-mark tracked from EVERY row, not just
acted-on ones (this is D-08's trap — see Common Pitfalls):**
```typescript
// media.ts:745-763 (delete step's loop)
let deletedCount = 0;
let lastDeletedAt = cursorMs;
for (const row of batch) {
  if (row.thumbStorageId) { try { await ctx.storage.delete(row.thumbStorageId); } catch (err) { /* log, continue */ } }
  await ctx.db.delete(row._id);
  deletedCount++;
  if (typeof row.deletedAt === "number") lastDeletedAt = row.deletedAt;
}
```
The two new janitors have no blob-delete step. The `inbox` auto-close step's loop body: for
each row in the batch, if not carved out (`itemType !== "held"` AND `priority !== "money"`),
`ctx.db.patch(row._id, { closedAt: now })` — this single patch correctly handles BOTH the
already-acked backfill case and the aged-out case, since both simply need `closedAt` set. The
`ideationFindings` auto-close step's loop body patches `{ dismissed: true, dismissedAt: now }`
when not carved out (`severity` not in `{critical, high}`) — unchanged from the original design.
Both delete steps' loop bodies `ctx.db.delete(row._id)` when not carved out. In every case the
cursor high-water-mark MUST still advance from every row regardless of whether it was acted on.
Use `partitionBatchForPrune` (below) rather than reimplementing this loop by hand — it already
encodes the correct behavior and is unit-tested.

**7. Full-batch vs short-batch reschedule decision:**
```typescript
// media.ts:765-779
const batchesUsedAfter = batchesDone + 1;
const batchWasFull = batch.length >= TRASH_PRUNE_BATCH_SIZE;
const rescheduled = batchWasFull && batchesUsedAfter < TRASH_PRUNE_MAX_BATCHES;
if (rescheduled) {
  await ctx.scheduler.runAfter(TRASH_PRUNE_RESCHEDULE_MS, internal.media.pruneTrashBatch, {
    cursorMs: lastDeletedAt,
    batchesDone: batchesUsedAfter,
  });
}
```

**8. The `internalMutation` wrapper** (`media.ts:796` onward) is a thin shell: `args` validators
matching the handler's arg shape, body calling `pruneTrashBatchHandler(ctx, args, Date.now())`.

### Two-step chain shape (new for this phase, not in the `media.ts` template)

D-02 requires auto-close-then-delete as ONE chain per table. The cleanest adaptation
(inferred from the template's own conventions, not found verbatim anywhere in this repo — this
is the one piece of net-new design shape, though the two STEPS themselves are each faithful
clones of the template):

- One `internalMutation` (`internal.inbox.autoCloseAndPrune`) whose args carry a `phase:
  "closing" | "deleting"` discriminant (or two separate cursor fields, one per step, with
  `phase` inferred from which is present) plus that step's own `cursorMs`/`batchesDone`.
- On `"closing"`: run the auto-close batch (query `by_closedAt`/`closedAt===undefined` for
  `inbox`, `by_dismissed`/`dismissed===false` for `ideationFindings`; patch; track cursor by
  `createdAt`). If short batch (closing exhausted), transition to `"deleting"` with a FRESH
  `cursorMs: 0`/`batchesDone: 0` for that step (mirrors `planNextPruneStep`'s `"next-table"`
  transition, `retentionCursor.ts:115-117`, which resets the cursor to 0 when moving between
  distinct index scopes). If full batch, reschedule `"closing"` with the advanced cursor.
- On `"deleting"`: run the delete batch (query the closed-at field range — `by_closedAt` for
  `inbox`, `by_dismissedAt` for `ideationFindings`; `partitionBatchForPrune` for carve-outs;
  `ctx.db.delete`). Short batch → chain ends (log and return, no reschedule). Full batch →
  reschedule `"deleting"`.
- A single **per-invocation-chain batch cap** should bound the WHOLE two-step chain (not one
  cap per step) — otherwise a chain could spend 100 batches closing and then start a fresh
  100-batch budget deleting, doubling the disclosed worst case with no cap governing it. Carry
  `batchesDone` across the phase transition rather than resetting it to 0 at the `"closing"` →
  `"deleting"` boundary.

This structure keeps ONE scheduled function, ONE args shape, and reuses
`partitionBatchForPrune`/the template's reschedule-decision arithmetic in both steps — matching
D-02's "one query shape, one cutoff" preference while satisfying the two-step requirement.

### D-08's cursor-advance trap: is `partitionBatchForPrune` directly reusable? (RQ-4)

**Yes, directly, for both steps, with no modification needed.** Read in full:
`convex/retentionCursor.ts:141-154`.

```typescript
export function partitionBatchForPrune<T extends { _id: unknown; _creationTime: number }>(
  batch: readonly T[],
  predicate?: (doc: T) => boolean
): { toDelete: T[]; lastCreationTime: number | null }
```

The function is generic over `T extends { _id: unknown; _creationTime: number }` and returns
`lastCreationTime` sourced from **every** iterated doc (deleted or skipped) — exactly the
property D-08 needs. Two things to verify before assuming it drops in unmodified:

1. **The generic field name is `_creationTime`, Convex's SYSTEM field — not `createdAt`,
   `closedAt`, or `dismissedAt`.** `inbox`'s auto-close step cursors on `createdAt` (an
   application field) and its delete step cursors on `closedAt` (the new field, per R-02's
   revision); `ideationFindings`'s auto-close step cursors on `createdAt` and delete step on
   `dismissedAt`. `partitionBatchForPrune`'s signature only reads `doc._creationTime` internally
   to compute `lastCreationTime` — **it is NOT general over an arbitrary cursor field name as
   written**. Two options: (a) call it as-is and separately track the application-field cursor
   high-water-mark in the caller's own loop (duplicating the "every doc, not just acted-on ones"
   logic instead of reusing it — the exact defect class D-08 warns against reintroducing), or
   (b) generalize `partitionBatchForPrune` to accept a `cursorField: (doc: T) => number`
   extractor instead of hardcoding `_creationTime`, then have both `retention.ts`'s existing call
   site and the two new janitors pass an extractor (`(doc) => doc._creationTime` preserves
   current behavior exactly, zero risk to the existing caller). **(b) is the correct fix** — it
   is the only option that lets the new janitors reuse the TESTED cursor-advance logic rather
   than re-deriving it by hand, and it is a pure backward-compatible signature widening
   (existing call site `retention.ts:352` passes no third arg today and would need one, but the
   change is mechanical).
2. Confirm at implementation time whether `partitionBatchForPrune`'s existing test suite (if any exercises it directly — check `convex/retentionCursor.test.ts` if present, or `retention.test.ts`) needs updating for the new signature. This research did not locate a dedicated `retentionCursor.test.ts`; `retention.test.ts` and `retention-health-check`-adjacent tests should be grepped for direct calls to `partitionBatchForPrune` before assuming zero blast radius.

**Recommendation for the planner:** task the generic extractor change as its own small task
(touches a shared, already-tested module) before the two new janitor mutations that depend on
it, with an explicit regression test asserting `retention.ts`'s existing behavior is unchanged
when the extractor is `(doc) => doc._creationTime`.

### Recommended module structure

No new files needed — matches D-01's "lives beside the rest of that table's mutations"
convention:
```
convex/
├── inbox.ts              # + autoCloseAndPruneHandler, autoCloseAndPrune (internalMutation)
├── ideation.ts            # + autoCloseAndPruneHandler, autoCloseAndPrune (internalMutation)
├── retentionCursor.ts     # generalize partitionBatchForPrune's cursor-field extractor
├── retentionCoverage.ts   # move inbox/ideationFindings PRUNE_PROPOSED -> BOUNDED_BY_CRON
├── crons.ts               # + 2 new crons.daily() registrations at 08:20/08:35 UTC
├── schema.ts              # + closedAt field + by_closedAt index (inbox); widen by_dismissed,
│                          #   + by_dismissedAt (ideationFindings). ackedAt is UNCHANGED.
├── inbox.test.ts          # + janitor tests (new describe blocks, media.test.ts convention)
└── ideation.test.ts       # + janitor tests (same convention)
```

### Anti-Patterns to Avoid

- **Do not stamp `ackedAt` from the janitor.** This was the original R-02 design and was
  explicitly superseded — `ackedAt` has two live frontend read/unread consumers
  (`src/pages/Inbox.tsx:130`, `src/components/control-center/IntelligenceFeedPanel.tsx:64`).
  Use the new `closedAt` field exclusively.
- **Do not fold the carve-out predicate into the index query** (D-02 is explicit: apply it
  AFTER the query returns, per `retention.ts:236-241`'s `PRUNE_PREDICATES` pattern — quoted
  below). Folding it into the query would require a compound index per carve-out combination
  and defeats the "one index, one query shape" simplicity D-02 chose.
- **Do not copy `alerts.autoAcknowledgeStaleInternal`'s unbounded `.collect()`**
  (`convex/alerts.ts:171-174`, quoted in full below) — copy its SHAPE (auto-ack stale +
  severity/type carve-out), never its read pattern.
- **Do not reset `batchesDone` to 0 at the auto-close→delete phase transition** within one
  chain invocation — see "Two-step chain shape" above.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor-advance-past-skipped-rows | A hand-rolled `for` loop tracking a high-water-mark manually | `partitionBatchForPrune` (generalized per RQ-4) | Already tested against exactly this defect (D-08); a hand-rolled copy risks reintroducing the bug the helper exists to prevent |
| Predicate-after-query carve-out shape | A compound index encoding `itemType != "held"` | `PRUNE_PREDICATES`-style post-query filter (`retention.ts:236-241`) | Matches D-02's explicit choice; compound-index carve-outs don't compose across the asymmetric held/money split (D-03) |
| Self-rescheduling batch chain | A custom `while` loop inside one mutation (would blow the same read ceiling in one shot) | `ctx.scheduler.runAfter` chain, `pruneTrashBatchHandler` shape | Every existing bounded-mutation in this repo (media, workspace, graphSnapshots, retention) uses this shape; it is the house style for exactly this reason |
| "Which field means closed" ambiguity on `inbox` | Reusing `ackedAt` as both the user-action signal AND the janitor's lifecycle cursor | A dedicated `closedAt` field, exactly the way `media.ts` uses `deletedAt` distinct from any user-action field | R-02's revision — conflating the two is precisely the bug this revision fixes; two live frontend surfaces already depend on `ackedAt` meaning ONLY "a human acted" |

**Key insight:** every piece this phase needs already exists in this codebase in a tested,
battle-hardened form (three of the last five phases hit real production incidents building
these exact patterns from scratch — `retentionCursor.ts`'s own module docstring is a full
incident writeup). There is no part of this phase that should be written from a blank page.

## Common Pitfalls

### Pitfall 1: The cursor-advance trap (D-08) — reintroducing the head-rescan bug

**What goes wrong:** A batch consisting entirely of carved-out rows (e.g. all `held`) gets
skipped without advancing the cursor, so the next batch re-reads the identical rows, finds them
all skipped again, and burns the whole per-chain batch cap on zero progress.
**Why it happens:** It is natural to write "for each row, if not carved out, delete it" and
track `lastCursor` only inside the `if` branch — this is exactly what
`retentionCursor.ts:126-139`'s docstring documents happened conceptually the first time.
**How to avoid:** Use `partitionBatchForPrune` (generalized, see RQ-4) unmodified; never
hand-track the cursor inside a conditional branch.
**Warning signs:** A test asserting "all-excluded batch still advances the cursor" is REQUIRED
(Verification C) precisely because this is not a rare edge case — `held` alone is 2.7% of the
unacked `inbox` population, so an all-excluded batch will occur in normal operation, not just
adversarial testing.

### Pitfall 2: Trusting the wrong read ceiling

**What goes wrong:** Budgeting against the Convex docs' published "16,000 documents written" or
"32,000 documents scanned" limits (confirmed live via WebFetch of
`docs.convex.dev/production/state/limits` 2026-08-25: "Documents Scanned: 32,000... Documents
Written: 16,000 per transaction") instead of this **self-hosted instance's empirically observed
~4,096-read ceiling.**
**Why it happens:** The publicly documented numbers are real Convex platform limits, but this
repo has hit a DIFFERENT, lower, empirically-reproduced ceiling on THIS self-hosted deployment
multiple times — the literal observed error text is quoted verbatim in this codebase:
`convex/graphSnapshots.ts:505`: `"Too many reads in a single function execution (limit: 4096)"`.
This is not a training-data guess; it is a live error message this repo's own comments transcribe
from an actual production failure (Phase 115). Do not resolve this discrepancy by trusting either
number over the other in the abstract — trust the number this specific deployment has actually
enforced, which is 4,096.
**How to avoid:** Budget every new mutation against 4,096, not 16,000 or 32,000. D-07's
200(read)+200(patch)=400/step arithmetic already does this correctly, and the added
already-acked `closedAt` backfill (321 one-time rows) does not change the per-BATCH arithmetic,
only the total batch count of the first backlog-draining run.
**Warning signs:** Any comment or plan citing "16,000" or "32,000" as the binding ceiling for a
mutation on this deployment should be treated as suspect and corrected — CLAUDE.md itself
flags this as a repeat mistake ("Phase 115 hit the read ceiling three times bisecting against
the wrong number").

### Pitfall 3: Assuming `alerts.autoAcknowledgeStaleInternal`'s shape is safe to copy verbatim

**What goes wrong:** `convex/alerts.ts:171-174` does `ctx.db.query("alerts").withIndex(...).collect()`
— genuinely unbounded. Copying this for `inbox` (2,800 rows, +100/day) or `ideationFindings`
(470 rows, +5.1/day) reintroduces the unbounded-read defect class inside the very mechanism
built to prevent unbounded growth.
**Why it's tolerable in `alerts.ts` but not here:** `alerts` is itself bounded to ~102 rows by
that same auto-ack (a small, self-limiting table); `inbox`/`ideationFindings` are the two tables
in this codebase where unbounded growth IS the problem this phase exists to solve.
**How to avoid:** Bound both steps with `.take(n)`, cursor-seeked, exactly like
`pruneTrashBatchHandler` — never `.collect()`.

### Pitfall 4: Silently swapping which carve-out is symmetric

**What goes wrong:** D-03's table is explicit that `held` is excluded from BOTH auto-close and
delete, while `money` is excluded from auto-close ONLY (a human-closed money row ages out
normally). An implementer who writes one carve-out predicate and reuses it for both steps will
silently make `money` behave like `held` (permanently exempt from delete too) or vice versa.
**How to avoid:** Two distinct predicates, or one predicate function taking a `step: "close" |
"delete"` parameter that explicitly branches on it — never one boolean reused unchanged across
both steps. This is exactly what Verification B's mutation-testing control is designed to catch,
per-carve-out, per-step.

### Pitfall 5: Stamping `ackedAt` from the janitor — the defect R-02's revision exists to prevent

**What goes wrong:** The most natural-looking implementation of "auto-close an inbox item" is to
set `ackedAt`, since that is the field the ORIGINAL design proposed and the field every other
part of this codebase already treats as "closed." Doing so silently changes what TWO live
frontend components render, with no error and no test failure anywhere in the existing suite
(neither `Inbox.test.tsx` nor any `IntelligenceFeedPanel` test currently exercises a
janitor-stamped row, because the janitor doesn't exist yet).
**Why it happens:** `ackedAt` looks like the obvious "this row is done" field — it is even named
for exactly that purpose in the RAISE/ack/dismiss mutations (`convex/inbox.ts`'s `ackHandler`/
`dismissHandler`). The trap is that "the operator acted on this" and "this row is no longer part
of the active/growing set" are two DIFFERENT properties that happen to have shared one field
until this phase needed to separate them.
**How to avoid:** Use the new, janitor-exclusive `closedAt` field. Never write to `ackedAt` from
`internal.inbox.autoCloseAndPrune`.
**Warning signs:** Any code review or test that finds `ctx.db.patch(..., { ackedAt: ... })`
inside the new janitor's auto-close step is a direct regression of R-02's revision and should be
rejected immediately — this is exactly the kind of "looks like a fix, isn't" mechanism this
repo's CLAUDE.md's "Eight" root-cause patterns warn about generally (Pattern 7: "ask what
happens when it succeeds" — here, a `.patch({ackedAt})` mechanism "succeeding" IS the failure
mode, because it succeeds at bounding the table while silently breaking two UI surfaces).

## Code Examples

### Predicate-after-query pattern (D-02's model)

```typescript
// convex/retention.ts:253-255 — verified live 2026-08-25, unchanged from CONTEXT.md's citation
export const PRUNE_PREDICATES: Partial<Record<string, (doc: any) => boolean>> = {
  aggregates: (doc) => doc.period !== "daily",
};
// applied at retention.ts:352:
const { toDelete, lastCreationTime } = partitionBatchForPrune(batch, PRUNE_PREDICATES[table]);
```

### Auto-ack precedent, shape to copy (not its read pattern, and not its field choice)

```typescript
// convex/alerts.ts:166-189 — verified live 2026-08-25, matches CONTEXT.md's citation exactly
export const autoAcknowledgeStaleInternal = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const twentyFourHoursAgo = now - 86400;
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();               // <- UNBOUNDED. Copy the shape below, not this line.
    let count = 0;
    for (const a of active) {
      if (a.severity !== "critical" && a.createdAt < twentyFourHoursAgo) {
        await ctx.db.patch(a._id, {
          acknowledged: true,
          acknowledgedBy: "auto-acknowledge",
          acknowledgedAt: now,
        });
        count++;
      }
    }
    return { acknowledged: count };
  },
});
```
Note `alerts` has no equivalent problem to `inbox`'s: `acknowledged`/`acknowledgedAt` here have
no separate frontend read/unread rendering consumer the way `inbox.ackedAt` does — this is
precisely why `alerts` can safely reuse one field for both "closed" and "acted on," and `inbox`
cannot (R-02's revision).

### Index ordering (absent field sorts below any real cursor)

```typescript
// convex/controlVerbSwaps.ts:105-109 — verified live 2026-08-25, matches CONTEXT.md's citation
// "Convex indexes an absent field only under `undefined` ... `undefined < null < all other
// values`. See docs.convex.dev\database\types: an index query on `undefined` matches documents
// missing that field."
```
This guarantee now needs to hold for the NEW `closedAt` field (not `ackedAt`, per R-02's
revision) — the property itself is general (it is about how Convex orders indexes, not specific
to any one field name), so there is no reason to expect it behaves differently for `closedAt`
than it already does for `deletedAt` (`media.ts:733-736`) or `ackedAt` (the original, now-moot
proposal). Independently confirmed via `docs.convex.dev` WebFetch 2026-08-25 for the general
`db.patch()` semantics (shallow merge, field removal on explicit `undefined`); the specific
`undefined < null < ...` ordering claim was NOT independently re-confirmed against a fresh docs
fetch in this session (the fetched `/database/writing-data` page did not surface it) — it rests
on this repo's own prior citation of `docs.convex.dev/database/types`, unchanged since
`controlVerbSwaps.ts` was written. Treat as CITED (repo-internal, prior-verified), not freshly
re-verified this session.

### The two duplicate `ideationFindings` dismiss writers (D-06's "same guarantee holds" claim — UNCHANGED by R-02)

```typescript
// convex/ideation.ts:30-38
export const dismissFinding = mutation({
  args: { id: v.id("ideationFindings") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { dismissed: true, dismissedAt: Date.now() / 1000 });
  },
});

// convex/ideationFindings.ts:70-78 — genuine duplicate, confirmed byte-equivalent in effect
export const dismiss = mutation({
  args: { id: v.id("ideationFindings") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { dismissed: true, dismissedAt: Date.now() / 1000 });
  },
});
```
Both always set `dismissedAt` together with `dismissed: true` — D-06's "no backfill needed,
absent-field ordering protects the delete range" claim holds for both writers. `ideationFindings`
is untouched by R-02's revision.

### The two frontend consumers of `ackedAt` that motivated R-02's revision

```typescript
// src/pages/Inbox.tsx:119-138, inboxRowToInboxItem() — verified live 2026-08-25
function inboxRowToInboxItem(row: InboxRowDoc): InboxItem {
  return {
    // ...
    read: row.ackedAt != null,   // <- would flip true for every janitor-stamped row under the ORIGINAL design
    // ...
  };
}

// src/components/control-center/IntelligenceFeedPanel.tsx:63-71, stripeClass() — verified live 2026-08-25
function stripeClass(row: FeedRowDoc): string {
  if (row.ackedAt != null) return "";   // <- would suppress the unread stripe for every janitor-stamped row
  if (row.priority === "money" || row.priority === "high") {
    return "border-l-2 border-l-(--status-error)";
  }
  // ...
}
```
Both confirmed live 2026-08-25 by direct read, matching the correction's citations exactly.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Whole-table `_creationTime` cutoff prune (`pruneBatchV3` pre-2026-07-30) | Cursor-seeked range read via `by_creation_time`, tombstones never re-walked | 2026-07-30 | Fixed a silent nightly SystemTimeout that had killed the entire prune chain for 2+ nights |
| Coverage silently absent for un-enrolled tables | `retentionCoverage.ts` ratchet — every schema table must appear in exactly one bucket | 2026-08-21 | This phase's `inbox`/`ideationFindings` move from `COVERAGE_PRUNE_PROPOSED` to `COVERAGE_BOUNDED_BY_CRON` is itself part of this ratchet, not a follow-up (D-09) |
| Bounding a table's own physical delete count as the WRITE ceiling (16,000 docs) | Bounding against the READS ceiling (4,096), because deletes (and, per this research's finding, very likely patches) count as reads | Phase 115 (2026-08-12), re-affirmed repeatedly through Phase 126 | Central to D-07's arithmetic; this research finds no counter-evidence and reinforces treating patch identically to delete |
| Stamp `ackedAt` from the janitor (R-02's ORIGINAL resolution) | Stamp a dedicated `closedAt` field, leave `ackedAt` exclusively user-action | 2026-08-25, same-day adversarial-review correction | Prevents a silent UI regression across two frontend components; this document was itself revised to reflect this change |

**Deprecated/outdated:** Any future implementer instinct to reach for "just add the field to
`RETENTION_DAYS` in `retention.ts`" for `inbox`/`ideationFindings` — `retention.ts:59-65`'s own
comment already documents why that was rejected (whole-table `_creationTime` cutoff cannot
distinguish handled from unhandled rows), and this is precisely why `COVERAGE_PRUNE_PROPOSED`
exists as a separate, deliberately-not-yet-enrolled bucket. Also deprecated as of 2026-08-25: any
plan text (including an earlier draft of this very research document) describing `inbox`'s
janitor as stamping `ackedAt` — superseded by R-02's revision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ctx.db.patch()` counts toward the same ~4,096-read ceiling as `ctx.db.delete()`, so 200 patches ≈ 200 reads (this now includes the `closedAt` backfill patches for already-acked rows, not just newly-aged-out ones — no change to the per-batch arithmetic, only to total batch count on the first run) | Common Pitfalls (RQ-1), D-07's budget | If wrong (patch is cheaper), the 400/step budget is over-conservative but still safe — no risk of failure, only unnecessarily small batches. If wrong the OTHER direction (patch is MORE expensive per-op than delete, e.g. due to the shallow-merge read), the 400/step budget could be insufficient at scale; the mitigation is D-07's own instruction to "verify empirically" during implementation (run once against the live backlog and confirm no `SystemTimeout`/read-ceiling error before trusting the cron unattended) |
| A2 | Widening an existing index's field list under the same name (`by_dismissed`) is safe and non-breaking for all current callers | D-06, RQ-5 | Confirmed true for CALLERS (every current caller uses `.eq("dismissed", x)` only — verified live in `ideationFindings.ts`, `ideation.ts`, `briefings.ts:194-197`). NOT confirmed for the DEPLOY OUTPUT itself — whether Convex reports this as "index changed" vs "index deleted + index added" is undocumented by Convex's own docs (confirmed via WebFetch of `docs.convex.dev/database/reading-data/indexes/` 2026-08-25: "indexes are identified by name alone... the exact behavior for field list modifications is not explicitly documented"). If the deploy prints a deletion for `by_dismissed`, that is almost certainly benign but MUST be read and confirmed, not assumed silent, per D-06's own instruction and this repo's CLAUDE.md incident history (a prior "surgical" deploy silently deleted 3 live indexes). The brand-new `by_closedAt` index has no analogous risk — it is purely additive (new field, new index), not a widen |
| A3 | `undefined < null < all other values` index ordering (D-06's "no backfill" guarantee) holds on this deployment's convex-backend version (1.42.1), and holds identically for the NEW `closedAt` field, not just `ackedAt`/`deletedAt` | Code Examples, D-06 | This is a repo-internal CITED claim (`controlVerbSwaps.ts:105-109` → `docs.convex.dev/database/types`), not independently re-fetched this session (the fetched writing-data doc did not surface it). Two independent repo call sites (`controlVerbSwaps.ts`, `media.ts:733-736`) already depend on this exact property in production with no reported failure, which is corroborating evidence; the property is general to Convex's indexing engine, not field-specific, so there is no reason to expect `closedAt` behaves differently — but it was not re-verified against a fresh docs fetch in THIS research pass |

## Open Questions

1. **Does `partitionBatchForPrune` need its cursor-field extractor generalized, or should the
   two new janitors track the cursor high-water-mark by hand?**
   - What we know: the function currently hardcodes `doc._creationTime`; both new janitors need
     to cursor on application fields (`createdAt`, `closedAt`, `dismissedAt`), not the system field.
   - What's unclear: whether generalizing the shared helper (touching `retention.ts`'s existing
     call site) is judged in-scope for this phase, or whether the planner prefers a
     phase-127-local duplicate of the cursor-advance logic to avoid touching a shared,
     already-relied-upon module.
   - Recommendation: generalize it (RQ-4 above) — a duplicate risks the exact defect class D-08
     exists to prevent, and the change is a backward-compatible signature widening with a
     one-line adaptation at the existing call site.

2. **Does the deploy for the widened `by_dismissed` index print a delete line for it, and does
   `retentionCoverage`'s own deploy-adjacent tooling need updating to expect that?** (The new
   `by_closedAt` index has no analogous question — it is purely additive.)
   - What we know: Convex identifies indexes by name (confirmed via docs); the delete/change
     distinction for a field-list change under an unchanged name is undocumented.
   - What's unclear: the literal deploy output text on THIS self-hosted instance running
     convex-backend 1.42.1 specifically.
   - Recommendation: this must be answered empirically, once, at the real deploy step
     (`npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`, per
     CLAUDE.md's mandatory form) — read the full deploy output before considering D-06 satisfied,
     and record what it said (this is a `checkpoint`/verification task for the plan, not
     something this research can settle without deploying).

3. **Are there any OTHER frontend or backend consumers of `inbox` rows that assume `ackedAt` is
   the only "row is done" signal, beyond the two identified in R-02's revision?**
   - What we know: `Inbox.tsx:130` and `IntelligenceFeedPanel.tsx:64` are confirmed. This
     research grepped for `ackedAt` usage but did not perform an exhaustive whole-repo consumer
     audit beyond the files CONTEXT.md's revision and this research's own verification pass
     named.
   - Recommendation: the planner should include a task-level grep for `ackedAt` across
     `src/**` and `convex/**` (not just the two named files) before considering the `closedAt`
     migration complete, since a THIRD consumer reading `ackedAt` as a closure signal would face
     the identical silent-regression risk R-02's revision exists to prevent.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Self-hosted `convex-backend` container | All work in this phase | ✓ | image `ghcr.io/get-convex/convex-backend:latest`, container `convex-backend` `Up 11 hours (healthy)` (checked 2026-08-25) | — |
| `convex` CLI / npm package | Deploy step | ✓ | 1.42.1 (CLI), `^1.42.0` in `package.json` | — |
| `vitest` | Unit tests for both janitors | ✓ (already the repo's test runner; `npm test` → `vitest`) | — | — |
| `convex-test` (a runtime harness for simulating real Convex query/index semantics in tests) | Would strengthen Verification A's structural-guarantee test | ✗ — confirmed NOT installed (grepped every `convex/*.test.ts` in the repo; all cite its absence explicitly, e.g. `runtimeIngest.test.ts:9`) | — | Hand-rolled in-memory mock `ctx.db` per `media.test.ts`'s `makeJanitorMockCtx` convention — see Validation Architecture below for the honest limitation this implies |

**Missing dependencies with no fallback:** none — the missing `convex-test` has a documented,
already-in-use fallback (the hand-rolled mock convention).

**Missing dependencies with fallback:** `convex-test` — see Validation Architecture, Verification
A, for why this specific gap matters more here than elsewhere in the repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (no version pin found in `package.json` beyond the root devDependency; confirmed live 2026-08-25 as the sole runner — `"test": "vitest"`) |
| Config file | `vitest.config.ts` (includes `convex/**/*.test.ts` per its `include` array, line 59) |
| Quick run command | `npx vitest run convex/inbox.test.ts convex/ideation.test.ts` |
| Full suite command | `npm test` (equivalently `npx vitest run`) |

**No `convex-test` runtime harness in this repo.** Every Convex test file in `convex/` uses a
hand-rolled, in-memory fake `ctx.db` (documented explicitly at `runtimeIngest.test.ts:9` and
repeated verbatim across ~25 other test files, confirmed via repo-wide grep 2026-08-25). This is
the load-bearing fact for how Verification A must be implemented — see below.

### Phase Requirements → Test Map

Requirement IDs are not yet assigned in REQUIREMENTS.md (this phase's traceability row does not
exist yet — see the Phase Requirement IDs section above for this research's recommendation).
Mapped here by CONTEXT.md's own Verification Criteria labels (A-F):

| Verification | Behavior | Test Type | Automated Command | File Exists? |
|--------------|----------|-----------|-------------------|-------------|
| A | Absent `closedAt` (inbox, REVISED from `ackedAt`) / `dismissedAt` (ideationFindings) structurally excluded from the delete-step's index range | unit (query-layer, NOT outcome-layer) | `npx vitest run convex/inbox.test.ts -t "structural"` | ❌ Wave 0 — new file/describe block |
| B | `held`/`money`/`critical`+`high` carve-outs survive a guard-deletion mutation-testing control | unit (mutation-testing pair: real run + guard-deleted re-run) | `npx vitest run convex/inbox.test.ts -t "carve-out"` / `convex/ideation.test.ts -t "carve-out"` | ❌ Wave 0 |
| C | An all-excluded batch still advances the cursor and does not reschedule with an unchanged cursor | unit, direct regression test for `retentionCursor.ts:122-139`'s documented failure mode | `npx vitest run convex/inbox.test.ts -t "cursor advances on skip"` | ❌ Wave 0 |
| D | Full-batch reschedule / short-batch stop / ceiling-reached-does-zero-further-work | unit, adapted near-verbatim from `media.test.ts:636-713` | `npx vitest run convex/inbox.test.ts -t "batch"` | ❌ Wave 0 |
| E | Both tables in `COVERAGE_BOUNDED_BY_CRON`, both crons registered LIVE | unit, existing machine-check | `npx vitest run convex/retentionCoverage.test.ts` | ✅ mechanism already exists (`retentionCoverage.test.ts:130-142`); only the DATA (the two map entries + two live cron registrations) is new |
| F | First backlog-draining run observed in `docker logs convex-backend`, not just the cron's own success line | manual (cannot be automated — requires a real deploy + real cron firing against the live single-node backend) | `docker logs convex-backend --since 1h \| grep -i "inbox\|ideation"` (read-only, post-deploy) | N/A — deliberately manual per CONTEXT.md's own framing; do not attempt to script a fake "first run" |

**New, implicit Verification (not lettered in CONTEXT.md but required by R-02's revision):** a
regression test asserting the auto-close step's patch call **never includes `ackedAt` in the
patched fields**, and a separate test asserting `Inbox.tsx`'s `read` derivation /
`IntelligenceFeedPanel`'s `stripeClass` are unaffected by a `closedAt`-only patch (or, at minimum,
a source-level grep-style assertion — following this repo's own `media.test.ts:740-743`
convention of asserting on the SOURCE TEXT of the handler — that the auto-close handler's patch
call site never names `ackedAt`). This is the most direct test of the thing the correction exists
to prevent, and CONTEXT.md's lettered list predates the revision, so the planner should add it
explicitly rather than assume it is implied by Verification B.

### The critical distinction the planner must preserve: A is structural, B is a predicate

CONTEXT.md is explicit and this research independently confirms the distinction is real and
non-trivial to implement correctly, especially given the "no `convex-test`" constraint:

- **Verification A (structural)** must assert that the RAW QUERY RESULT never includes a row
  whose `closedAt`/`dismissedAt` is absent — i.e. it must prove the database-level index range
  itself excludes it, not that a JavaScript filter downstream removes it after the fact.
  **This is now, if anything, a cleaner test than the original `ackedAt`-based design would have
  produced**: `closedAt` has exactly ONE writer in the entire codebase (the new janitor itself),
  versus `ackedAt`'s five (`raiseHandler`, `ackHandler`, `dismissHandler`, `dismissAllCards`, and
  now — under the ORIGINAL rejected design — the janitor too). A single-writer field is easier to
  reason about and to seed correctly in a test fixture. **The honest limitation to disclose to
  the planner:** because this repo has no `convex-test` runtime harness, "the database-level
  index range" in a unit test necessarily means a **hand-rolled mock query builder that
  reimplements Convex's `undefined`-exclusion behavior in JavaScript** — exactly the pattern
  `media.test.ts:513-560`'s `makeJanitorMockCtx` already uses (its `.take()` implementation
  filters `r.deletedAt !== undefined` as an explicit line, confirmed live at `media.test.ts:548`).
  This means Verification A's "proof" is only as strong as the mock's fidelity to real Convex
  semantics — it demonstrates the HANDLER queries the index correctly (asks for the right
  range), not that Convex's real index genuinely excludes undefined values (that property rests
  on A3's docs citation, not on this test). State this limitation explicitly in the plan rather
  than letting the test's green result imply more than it proves. The control described in
  CONTEXT.md (seed a row with the field explicitly `0`, assert it IS returned under the same
  cutoff) is exactly what makes this mock-based test meaningful rather than tautological — keep
  it, adapted to `closedAt`.
- **Verification B (predicate)** needs a real behavioral mutation-testing control: run the
  handler once with the carve-out predicate intact, once with it deliberately removed (achieved
  by literally deleting the guard line and re-running, or — more practically for an automated
  CI-safe test — parameterizing the handler's carve-out check so the test can inject a
  no-op predicate and assert the outcome flips). CONTEXT.md's phrasing ("delete the
  `itemType !== "held"` line in the handler and re-run") describes a MANUAL mutation-testing
  step, not something `npm test` runs unattended. **Report honestly: this must be a documented
  manual verification step performed once during implementation** (confirm the test fails
  correctly when the guard is manually removed, then restore the guard) — it is not, and cannot
  be, part of the automated regression suite that runs on every future commit, unless the plan
  additionally builds a parameterized-predicate seam purely for testability (adds complexity;
  CONTEXT.md does not ask for this and this research does not recommend inventing it).

### Sampling Rate
- **Per task commit:** `npx vitest run convex/inbox.test.ts convex/ideation.test.ts convex/retentionCoverage.test.ts`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green, PLUS the one manual mutation-testing pass for Verification B
  documented as performed (not merely claimed), PLUS Verification F's first-run log observation
  after the real deploy, PLUS the new implicit `ackedAt`-never-touched regression test above.

### Wave 0 Gaps
- [ ] `convex/inbox.test.ts` — new `describe` blocks for the `autoCloseAndPrune` handler
      (Verifications A, B, C, D as they apply to `inbox`'s carve-outs, all against `closedAt`
      not `ackedAt`), plus the new `ackedAt`-never-patched regression test
- [ ] `convex/ideation.test.ts` — same, for `ideationFindings`'s carve-outs
      (`severity in {critical, high}`), against `dismissed`/`dismissedAt` (unchanged by R-02)
- [ ] No shared fixture/conftest gap — this repo's convention is per-file `makeJanitorMockCtx`-
      style local mock builders (see `media.test.ts:513`), not a shared `conftest.py`-equivalent.
      Each new test file should define its own mock ctx builder following that exact pattern.
- [ ] `retentionCursor.ts`'s `partitionBatchForPrune` generalization (RQ-4) needs its own test
      update wherever it is currently exercised directly (grep `convex/retention.test.ts` and any
      `retentionCursor.test.ts` for direct calls before changing the signature).
- [ ] Consider (not required by CONTEXT.md, but flagged by Open Question 3) a lightweight test or
      manual check confirming no OTHER `src/**`/`convex/**` consumer reads `ackedAt` as a general
      closure signal beyond the two already identified.

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` (confirmed absent from
the file entirely — treated as enabled per the default rule), but this phase adds no new
externally-reachable surface: both janitors are `internal.*` mutations reachable only by
`ctx.scheduler`/the two new cron registrations, matching every other retention mechanism in this
codebase (`media.pruneTrashBatch`, `retention.pruneBatchV3` are also `internalMutation`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new endpoint; `internalMutation`/`internalQuery` are not externally callable at all (unlike this deployment's public `mutation`/`query` functions, which CLAUDE.md's SEED-008 decision already documents as reachable without a credential) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A — the phase's whole design intentionally keeps both janitors as `internal.*`, which is itself the correct access-control posture for an irreversible batch-delete mechanism (matches `media.pruneTrashBatch`'s own T-118-02 rationale, cited in `media.ts:790-795`) |
| V5 Input Validation | Yes | `v.` validators on both `internalMutation`s' `args` (cursor/batch-count numeric fields) and the new `closedAt: v.optional(v.float64())` schema field, same pattern as every other janitor/field in this codebase |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded read/DoS via a mass-delete mutation (this repo's own historical incident class, 2026-07-21/22 tombstone OOM crash-loop) | Denial of Service | Bounded `.take()`, cursor-seeked, per-chain batch cap — the entire template this phase adapts exists specifically to prevent this |
| A carve-out predicate silently regressing (feature/data-loss regression, not a classic security threat but load-bearing for a live external consumer, `focus_digest.py`) | Tampering (of the safety invariant, not of data by an attacker) | Verification B's mutation-testing control; no database-level backstop exists for this class, which is exactly why CONTEXT.md insists on it |
| A backend field write silently changing frontend-rendered state with no error anywhere (this phase's own R-02 near-miss) | Tampering (of an implicit UI contract, not of data integrity) | Dedicated `closedAt` field instead of overloading `ackedAt`; the new implicit regression test asserting the janitor never patches `ackedAt` |

## Sources

### Primary (HIGH confidence — direct read of the live tree, 2026-08-25)
- `convex/media.ts:605-825` — the `pruneTrashBatchHandler` template, constants, and docstrings
- `convex/retentionCursor.ts` (full file) — `partitionBatchForPrune`, `planNextPruneStep`, cursor-advance trap docstring
- `convex/retention.ts` (full file) — `RETENTION_DAYS`, `PRUNE_PREDICATES`, `pruneBatchV3`, `oldestPrunableDoc`
- `convex/alerts.ts:150-189` — `autoAcknowledgeStaleInternal`
- `convex/inbox.ts` (full file) — `raiseHandler`, `ackHandler`, `listHeldUnackedHandler`, `countHeldUnackedHandler`, `dismissAllCardsHandler`
- `convex/ideation.ts`, `convex/ideationFindings.ts` (full files) — `dismissFinding`/`dismiss` duplicate writers, `linkTask`, `briefings.ts:194-197` consumer
- `convex/schema.ts:884-903` (ideationFindings), `:2145-2176` (inbox) — table + index definitions
- `convex/retentionCoverage.ts`, `convex/retentionCoverage.test.ts` (full files) — coverage buckets and the machine-checked cron-liveness gate
- `convex/crons.ts` (full file) — confirms `sweep-graph-snapshot-versions` is hourly (fires at :00 every hour, including 08:00 UTC) and `retention-prune`/`studio-trash-prune` slots
- `convex/controlVerbSwaps.ts:97-117` — absent-field index ordering citation
- `convex/inboxIngest.ts:150-181` — `inboxReadHeldUnacked` httpAction, external consumer confirmation
- `convex/media.test.ts:498-745` — test conventions: `makeJanitorMockCtx`, control-pairing, mutation-testing style, the `.collect()`-absence source-level check
- `src/pages/Inbox.tsx:107-138` — `inboxRowToInboxItem()`, the actual `read: row.ackedAt != null` derivation (frontend, not backend as CONTEXT.md's original citation location might imply) — one of the two consumers that motivated R-02's revision, re-verified 2026-08-25
- `src/components/control-center/IntelligenceFeedPanel.tsx:50-74` — `stripeClass()`, the second consumer that motivated R-02's revision, verified live 2026-08-25 (`row.ackedAt != null` suppresses the unread stripe at line 64, exactly as the correction states)
- `docker ps` (read-only) — `convex-backend` container confirmed healthy; `npx convex --version` → 1.42.1

### Secondary (MEDIUM confidence — official docs, fetched and cross-checked 2026-08-25)
- [docs.convex.dev/production/state/limits](https://docs.convex.dev/production/state/limits) — official published ceilings: 32,000 documents scanned, 16,000 documents written, 16 MiB data read/written per transaction. **Does not match this deployment's empirically observed ~4,096-read ceiling** — see Pitfall 2; this repo's own transcribed live error message (`graphSnapshots.ts:505`) is trusted over the published figure for THIS self-hosted instance.
- [docs.convex.dev/database/writing-data](https://docs.convex.dev/database/writing-data) — confirms `db.patch()` semantics (shallow merge, `undefined` removes a field) and that reads/writes both consume transaction budget, but does not give a patch-specific numeric cost
- [docs.convex.dev/database/reading-data/indexes/](https://docs.convex.dev/database/reading-data/indexes/) — confirms indexes are identified by name; confirms `npx convex deploy` deletes indexes no longer present in schema; does NOT document the widen-under-same-name case (Open Question 2)

### Tertiary (LOW confidence — WebSearch only, not independently re-verified this session)
- The `undefined < null < all other values` docs.convex.dev/database/types ordering claim (A3) — resting on this repo's own prior citation, not re-fetched fresh this session (the writing-data fetch did not surface it)

## Metadata

**Confidence breakdown:**
- Standard stack / architecture: HIGH — no new dependencies, entire pattern already exists and is battle-tested in this exact codebase
- `patch()`-counts-as-read arithmetic (D-07): MEDIUM-HIGH — strong circumstantial evidence (delete() proven, insert()-then-query proven via a different mechanism, both point the same direction) but no direct empirical proof of `patch()` specifically; D-07's own conservative budget (400/step, >10x headroom under 4,096) absorbs the residual uncertainty regardless of which way it resolves
- Index-widen deploy-diff behavior (D-06/RQ-5): LOW-MEDIUM — Convex's own docs do not resolve this; flagged as a mandatory one-time empirical verification at the real deploy step, not assumed. The NEW `by_closedAt` index carries none of this uncertainty (purely additive)
- Pitfalls / cursor-advance reuse (RQ-4): HIGH — read the actual function, confirmed its exact hardcoded dependency on `_creationTime`, and identified precisely what generalization is needed
- R-02's revision (`closedAt` vs `ackedAt`): HIGH — both motivating frontend consumers independently confirmed live by direct read (`Inbox.tsx:130`, `IntelligenceFeedPanel.tsx:64`), matching the correction's citations exactly

**Research date:** 2026-08-25 (revised same day)
**Valid until:** Citations should be re-derived again at plan-write time and at implementation
time regardless of this "valid until" estimate — this document itself demonstrates line numbers
drift within days on an actively-worked repo, AND that a substantive design decision (R-02) can
change same-day after an adversarial review. Treat 7 days as the outer bound before re-checking
file:line citations; re-check `127-CONTEXT.md`'s "Planning-time resolutions" section specifically
for further revisions before treating any single field/index name in this document as final. The
other locked decisions (D-01, D-03, D-04, D-08 through D-11, R-01, R-03, R-04) are stable
indefinitely since they are locked decisions, not measurements.
