# Phase 127: Ack-Aware Retention Janitors - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning
**Design input:** Codex (independent design pass), corrected against live measurement — see "Where the design was corrected"

<domain>
## Phase Boundary

Two tables are the last unbounded growth in CodePulse's Convex database that a
retention *window* cannot fix. Phase 126's coverage gate
(`convex/retentionCoverage.ts`) classified every one of the 145 schema tables;
these two are the only ones left in `COVERAGE_PRUNE_PROPOSED` carrying a note
that says, in effect, "do not calendar-prune this":

1. **`inbox`** — 2,800 rows, +100.0/day. `schema.ts:2112` has
   `ackedAt: v.optional(v.float64())`. `pruneBatchV3` deletes by whole-table
   `_creationTime` and cannot read that field, so enrolling it in
   `RETENTION_DAYS` would delete items the operator never saw.
2. **`ideationFindings`** — 470 rows, +5.1/day. `schema.ts:892-898` has
   `dismissed`, `dismissedAt`, `acknowledgedAt`, `convertedAt`. It is a triage
   queue; deleting an open finding loses work.

This phase gives each table a janitor keyed on *the operator's own action*
rather than on calendar age — the shape `media.pruneTrashBatch`
(`convex/media.ts:707-788`, Phase 118 D-08) already established for `media`'s
`deletedAt` — and moves both into `COVERAGE_BOUNDED_BY_CRON`, whose values are
machine-checked against comment-stripped `crons.ts` by
`convex/retentionCoverage.test.ts:130-142`.

**Out of scope, deliberately** — see D-10 and D-11.

## The measurement that shapes this phase

The obvious design — "delete acked/dismissed rows after N days" — bounds almost
nothing. Measured on the live self-hosted backend 2026-08-21:

```
ideationFindings   dismissed=true:    0 rows
                   dismissed=false: 470 rows        -> 100% UNDISMISSED
inbox              acked:   321
                   unacked: 1,651 of 1,972 clean    -> 83.7% UNACKED
```

Nobody has ever dismissed a finding. A `dismissedAt`-keyed janitor on
`ideationFindings` would delete **exactly zero rows, forever** — an inert
mechanism that looks like a fix, which is the precise failure class the coverage
gate exists to catch. On `inbox` an `ackedAt`-keyed janitor reaches at most 16%
of the table.

**The never-acknowledged set IS the table. Bounding it is the whole phase.**

What makes it tractable — unacked `inbox` rows by `itemType`
(1,651 unacked of 1,972 cleanly-parsed rows):

```
card            1,233   74.7%
notification      347   21.0%
held               45    2.7%   <- the ONLY type with an external consumer
signal             26    1.6%
```

Only 2.7% is `held`. Exempting it entirely still bounds 97.3% of the growth.

## Implementation Decisions

### D-01: Two janitors, not one shared generic

`internal.inbox.autoCloseAndPrune` in `inbox.ts` and
`internal.ideation.autoCloseAndPrune` in `ideation.ts`. Different carve-out
fields, different closure-field shapes (`ackedAt: v.optional(v.float64())` vs
`dismissed: v.boolean()` + `dismissedAt: v.optional(v.number())`), different
windows. A parameterized generic risks the carve-out logic silently swapping
between tables. Matches this repo's convention: `media.ts`'s janitor lives
beside the rest of that table's mutations, not in a shared janitor module.

No profile partitioning inside the `inbox` janitor despite `profileId` existing —
there is no retention reason to prune per-profile, and it would triple the chain
for no benefit.

### D-02: Auto-close first, then ONE deletion path

Each janitor is a self-rescheduling chain with two bounded steps:

1. **Auto-close**: bounded, cursor-seeked read of still-open rows older than
   window **M**; carve-out predicate applied AFTER the query returns, never
   folded into the index query (the pattern `retention.ts:236-241` establishes
   for `PRUNE_PREDICATES`). Patch `ackedAt` / `dismissed`+`dismissedAt`.
2. **Delete**: bounded, cursor-seeked range read on the closed-at field with
   cutoff `now - G`, exactly like `pruneTrashBatchHandler`'s `by_deletedAt`
   range read (`media.ts:737-743`).

Rejected: two separate deletion branches (one for human-closed, one for
force-expiring stale-unclosed). One index, one query shape, one cutoff is
simpler and matches the D-08 template. Auto-close converts "operator never saw
this" into a normal, auditable state that stays queryable for its whole grace
window, rather than an immediate delete.

Precedent: `alerts.autoAcknowledgeStaleInternal` (`convex/alerts.ts:166-189`)
already auto-acks stale alerts at 24h while exempting `severity === "critical"`.
This is the same shape with longer windows and per-table carve-outs. Unlike
`alerts` — which is `COVERAGE_KEEP_FOREVER` — these two tables then delete.

### D-03: `inbox` carve-out is `itemType === "held"` (CORRECTED — this is the one that matters)

`held` rows are consumed EXTERNALLY. `convex/inbox.ts` `listHeldUnackedHandler`
returns every `itemType="held"` row where `ackedAt === undefined`, across all
profiles; `convex/inboxIngest.ts:174` `inboxReadHeldUnacked` serves that query to
Ástríðr's `focus_digest.py`, which filters to `heldReason="focus"`.

**Auto-acking a held row silently removes it from Larry's focus digest.** That is
a feature regression wearing the costume of cleanup, and nothing would report it.

So: `itemType === "held"` is NEVER auto-closed and NEVER deleted by this janitor.
At 45 unacked rows it is not a growth problem, and the 97.3% that is a growth
problem is untouched by the coupling.

Additional carve-out: `priority === "money"` (138 unacked rows) is never
auto-acked, mirroring `alerts.ts:178`'s `severity !== "critical"`.

NOT carved out: `itemType === "alert"`. It appears only in a stale union comment
(`inbox.ts:44`, `schema.ts:2106`) and has zero live rows. `itemType` is
`v.string()`, so that union is a comment, not a validator — live data also
contains `signal` (26 rows), which the comment omits.

### D-04: `ideationFindings` carve-out is `severity` in {critical, high}

Never auto-dismissed; human-only closure. Same shape as D-03's `money`.

There is no external consumer to protect here: `convex/briefings.ts:194-197`
reads `.withIndex("by_dismissed", q => q.eq("dismissed", false)).take(20)` —
undismissed, newest 20 only. Auto-dismiss is therefore materially less risky than
auto-ack is on `inbox`.

### D-05: Windows, and the disclosure that the second one cannot fire yet

| Table | Auto-close M | Grace G | Worst case (non-carve-out) |
|---|---|---|---|
| `inbox` | 30d unacked -> auto-ack | 30d after ack | 60d |
| `ideationFindings` | 180d open -> auto-dismiss | 90d after dismiss | 270d |

Asymmetry rationale: `inbox` is operational noise at 100/day; a stale unacked
card is abandoned within a month (`inbox.ts:231-244`'s `dismissAllCards` exists
precisely because pre-dedup-fix cards piled up and needed manual clearing — a
30d auto-ack would have prevented it). `ideationFindings` is a triage queue at
5.1/day; a finding open for months may mean "still unfixed and important", not
"abandoned".

**DISCLOSURE, verified 2026-08-21:** the oldest `ideationFindings` row has
`_creationTime` 2026-05-20 — **94 days old**. At M=180d the auto-dismiss step
matches ZERO rows and the delete step therefore has nothing to act on for
approximately **86 more days** (~2026-11-15). This is inert-by-design, not
broken, and the phase MUST make the two distinguishable: the janitor is required
to log a line that says it ran and matched nothing, so a zero-delete run is
attributable. Planning may instead choose to shorten M for
`ideationFindings` — that is an open decision, and the reason it is called out
here rather than buried.

**Carve-out rows remain technically unbounded.** A `money` inbox item or a
`critical` finding that a human never closes lives forever. This is a disclosed
tradeoff identical in shape to the one already accepted for `alerts`. If a hard
outer ceiling (e.g. 365d force-expire) is wanted instead, that is a planning
decision, not an implementation detail.

### D-06: Indexes, and why no backfill is required

`inbox` — one new index:
```
.index("by_ackedAt", ["ackedAt", "createdAt"])
```
Serves both steps: `.eq("ackedAt", undefined)` for open rows ordered by
`createdAt`; `.gte("ackedAt", cursor).lt("ackedAt", cutoff)` for the delete step.

`ideationFindings` — widen `.index("by_dismissed", ["dismissed"])`
(`schema.ts:902`) to `["dismissed", "createdAt"]`, and add
`.index("by_dismissedAt", ["dismissedAt"])`.

**No data backfill.** Convex indexes an absent field under `undefined`, and
`undefined < null < all other values`. This is documented twice in this
codebase already — `convex/controlVerbSwaps.ts:105-109` citing
docs.convex.dev/database/types, and independently re-derived at
`convex/media.ts:733-736` for `deletedAt`. So the ~2,800 rows with `ackedAt`
absent sort BELOW any real numeric cursor and are naturally excluded from the
delete range. Unacked rows are **structurally unreachable** by the delete step,
not merely filtered out — a materially stronger safety property than a predicate.

Both `ideationFindings` dismiss writers (`ideation.ts:31-38` `dismissFinding`
and `ideationFindings.ts:71-78` `dismiss` — duplicates of each other) set
`dismissedAt` together with `dismissed: true`, so the same guarantee holds there.
There are zero dismissed rows anyway.

Widening `by_dismissed` is non-breaking: every current caller uses
`.eq("dismissed", x)` with no dependence on the single-field shape. Confirm the
push reports the index change and that `retentionCoverage`'s deploy check still
prints "No indexes are deleted by this push", or account for it if it does not.

### D-07: Cadence and caps

```
crons.daily("inbox-janitor",             { hourUTC: 8, minuteUTC:  0 }, internal.inbox.autoCloseAndPrune, {});
crons.daily("ideation-findings-janitor", { hourUTC: 8, minuteUTC: 15 }, internal.ideation.autoCloseAndPrune, {});
```

Daily is ample at 100/day and 5.1/day — no need for the hourly cadence
`sweep-graph-snapshot-versions` uses for its backlog. 15-minute offset follows
this file's own anti-contention discipline.

**Note when planning:** `sweep-graph-snapshot-versions` is
`crons.interval({ hours: 1 })`, so it also fires at 08:00 UTC. It is capped at
1,000 deletes and these two are tiny, so contention is unlikely — but the slot is
not actually empty, and 08:20/08:35 would avoid it entirely.

Batch size 200, matching `TRASH_PRUNE_BATCH_SIZE` (`media.ts:638`). Per-chain cap
mirroring `TRASH_PRUNE_MAX_BATCHES = 100` (`media.ts:649`); even a cap of 20
drains any realistic backlog in 2-3 runs.

**Unverified assumption to settle in implementation:** `media.ts:627-636` proves
`ctx.db.delete()` counts toward the 4,096-READ ceiling. There is no equivalent
proof in this codebase that `ctx.db.patch()` does. The auto-close step is a patch
loop. Budget conservatively as if it does (200 reads + 200 patches = 400 per
step, ~800 across both, still >5x headroom) and verify empirically — the same way
`media.ts:624-636` insists on re-deriving the arithmetic rather than trusting a
ceiling's name, after Phase 115 hit the read ceiling three times bisecting
against the wrong number.

### D-08: The cursor MUST advance past carved-out rows

`convex/retentionCursor.ts:122-139` documents why `partitionBatchForPrune`
sources `lastCreationTime` from EVERY iterated doc, not only the ones acted on: a
predicate that skips without advancing the cursor re-reads the same stuck batch
forever, burning the entire batch cap on zero progress.

The auto-close step's carve-out has the IDENTICAL shape — some rows in the batch
are skipped, not acted on. This is the single most likely defect an implementer
will reintroduce. It gets its own acceptance check (see Verification 3), not just
a comment.

### D-09: Coverage move is part of this phase, not a follow-up

Move both from `COVERAGE_PRUNE_PROPOSED` (`retentionCoverage.ts:165-166`) into
`COVERAGE_BOUNDED_BY_CRON` (`retentionCoverage.ts:72-82`):
```
inbox:            "internal.inbox.autoCloseAndPrune",
ideationFindings: "internal.ideation.autoCloseAndPrune",
```
`retentionCoverage.test.ts:130-142` machine-checks these against
comment-stripped `crons.ts`. Doing the move inside this phase is what makes the
mechanism's death detectable later; leaving them proposed would reproduce the
`sweepGraphSnapshotVersions` failure this gate was built for.

### D-10: OUT OF SCOPE — the `status: "converted"` gap

`convex/ideation.ts:97-110` `linkTask` sets `status: "converted"` and
`convertedAt` but never touches `dismissed`. A finding converted into a task
therefore stays "open" by this janitor's definition and is never auto-dismissed.

This is a pre-existing app-level gap, not a regression — today such a finding
never leaves the table either way. The janitor is keyed on `dismissed` alone
because that is the field both writer files agree on and the only one indexed.
Converting a finding probably SHOULD dismiss it; that is a separate decision and
must not be smuggled into this phase.

### D-11: OUT OF SCOPE — the unbounded reads on `inbox`

`listHeldUnackedHandler` and `dismissAllCards` (`inbox.ts:231-244`) both
`.collect()` over `inbox` without a bound. This is already logged on the roadmap
as `inbox-listheldunacked-unbounded-every-route` and is owned by Phase 126.

The roadmap carries a standing caution that the fix must NOT cap that shared
query, because `inboxIngest.ts:174` consumes it server-side for `focus_digest.py`
and needs the true unbounded set. **This phase must not cap it either.** The
janitor reduces the severity of that read over time by keeping the table smaller;
it does not close it.

## Where the design was corrected

Codex produced the design independently and its structure is adopted almost
whole — the auto-close-then-single-delete shape (D-02), the cursor-advance trap
(D-08), the index reasoning (D-06), and the verification controls all come from
it. Three corrections were applied after measuring the live backend:

1. **`held` was not exempted.** Codex carved out `itemType === "alert"` — a value
   that exists only in a stale comment and has zero live rows — and did not carve
   out `held`, which is the one type an external consumer reads. Implementing as
   designed would have broken `focus_digest.py`. Corrected in D-03.
2. **The acked/unacked split was listed as an unmeasured "Task 0".** It is now
   measured (see above) and the numbers change the shape of the answer: the
   never-acknowledged set is the table, not an edge case.
3. **The 180d window's inertness was not surfaced.** The oldest finding is 94
   days old, so that window matches nothing for ~86 more days. Disclosed in D-05.

One thing Codex flagged that measurement CONFIRMED: the `status: "converted"` gap
(D-10) is real — `linkTask` was read and does set status without dismissing.

One thing this session got wrong and corrected before it reached the design: an
apparent `priority: "card"` data-quality defect was a PARSING artifact — 28 of
2,000 rows contain a `|` inside `body`/`title`, misaligning a naive column split.
Restricted to the 1,972 cleanly-parsed rows every priority is a valid enum
member. **There is no data-quality defect; do not write one into the plan.**

## Verification Criteria

Modeled on `convex/media.test.ts:577-736`, which already establishes this repo's
control-pairing convention for exactly this function shape.

1. **The proof that matters most** — an open row, however old, is never deleted
   in the same run that deletes a closed row of the same age. Seed one row closed
   91 days ago (past G) and one created 91 days ago but never closed and not past
   M+G; assert the first is deleted and the second survives IN THE SAME
   INVOCATION.
   **Control:** disable the auto-close step (or set M so large it cannot fire)
   and confirm the SAME test then shows the never-closed row surviving where it
   otherwise would not — if the assertion does not move, the test is not
   exercising the boundary it claims to.
2. **`held` is untouchable** — a `held` row older than M+G is neither auto-acked
   nor deleted, paired with a same-age `card` row that IS, in the same batch.
   This is the focus_digest regression guard and it is not optional.
3. **Cursor advances on skip** — a batch in which EVERY row is carved out still
   advances the cursor and does not reschedule with an unchanged one. Direct
   regression test for `retentionCursor.ts:122-139`.
4. **Carve-out discriminates** — a `money`/`critical` row older than M is not
   auto-closed while a same-age `normal`/`medium` row is, in the same batch.
   Proves the predicate discriminates rather than refusing everything.
5. **Absent field is unreachable** — seed a row with `ackedAt`/`dismissedAt`
   absent and confirm the delete range never matches it at any cursor value.
   Write this BEFORE trusting D-06's "no backfill needed" claim.
6. **Batch/reschedule bounds** — full batch reschedules with an advanced cursor;
   short batch does not; ceiling reached does zero work. Adapt
   `media.test.ts:636-713`.
7. **Coverage gate green** with both tables moved and both crons registered
   LIVE (not commented out). This is the last gate before the phase is closed.
8. **First-run watch** — after deploy, observe the first backlog-draining run in
   `docker logs convex-backend`, not just the cron's own success line. The
   backend is single-node SQLite and mass tombstones have OOM-crash-looped it
   before (`retention.ts:28-33`). An instrument that cannot see the failure mode
   reports success right up until it doesn't.

## Canonical References

- Template: `convex/media.ts:707-788` (`pruneTrashBatchHandler`), constants at
  `media.ts:638,649`, absent-field reasoning at `media.ts:733-736`
- Auto-close precedent: `convex/alerts.ts:166-189`
- Cursor trap: `convex/retentionCursor.ts:122-139`
- Predicate-after-query pattern: `convex/retention.ts:236-241`
- Index ordering: `convex/controlVerbSwaps.ts:105-109`
- Coverage gate + its machine check: `convex/retentionCoverage.ts:12-18,72-82,165-166`,
  `convex/retentionCoverage.test.ts:130-142`
- Tables: `convex/schema.ts:884-902` (ideationFindings), `2099-2118` (inbox)
- External consumer: `convex/inbox.ts` listHeldUnackedHandler,
  `convex/inboxIngest.ts:174`
