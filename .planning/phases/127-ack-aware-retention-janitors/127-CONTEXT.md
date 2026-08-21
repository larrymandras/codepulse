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

**Copy its SHAPE, not its READ.** `alerts.ts:171-174` does an unbounded
`.collect()` over the unacknowledged set. That is tolerable there only because
`alerts` is 102 rows and is itself bounded by that same auto-ack. Replicating it
here would reintroduce the unbounded-read defect class *inside the very mechanism
built to prevent unbounded growth* — on the two tables where unbounded growth is
the problem. Both auto-close steps MUST be bounded `.take(n)` and cursor-seeked,
like `pruneTrashBatchHandler`. Fixing `alerts.ts` itself is out of scope.

Why auto-close-then-delete rather than deleting by age directly, even for
`card`/`notification` where nothing external reads the unacked set:
1. One delete mechanism keyed on one closed-at field, matching the D-08 template.
   Direct age deletion needs a SECOND index and a SECOND cursor shape (a range on
   `createdAt` with an inverted not-closed condition), doubling what must be got
   right and verified.
2. It buys an audit/undo window — an auto-closed but not-yet-deleted row stays
   queryable, so a badly chosen M is visible and reversible before data is gone.
3. It is the house style: make the machine action indistinguishable from a human
   one, then let normal downstream logic handle it.

The cost of choosing this is real and is disclosed in D-05.

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

**The two carve-outs are NOT symmetric, and the difference is load-bearing:**

| | auto-close step | delete step |
|---|---|---|
| `itemType === "held"` | excluded | **excluded** — never touched in either direction |
| `priority === "money"` | excluded | **NOT excluded** |

`money` blocks only *silent* closure. Once a human genuinely acks a money item it
is ordinary closed data and ages out on the normal grace window. `held` is
excluded from both steps — even a held row a human acks is left alone, because
this phase must not partially touch a table whose read side another phase owns
(D-11).

Consequence, stated plainly: a `money` row that a human never acks stays forever.
That is the same accepted tradeoff `alerts.ts` already makes for `critical`.

NOT carved out: `itemType === "alert"`. It appears only in a stale union comment
(`inbox.ts:44`, `schema.ts:2106`) and has zero live rows. `itemType` is
`v.string()`, so that union is a comment, not a validator — live data also
contains `signal` (26 rows), which the comment omits.

`signal` needs no special case, and is in fact the clearest justification for
age-based auto-ack existing at all. `convex/inbox.ts:64-74` documents that
Ástríðr writes MACHINE-only signal rows (emitter `watch_pulse_grace`) that exist
purely to be counted, and that **"Nothing ever acks them — the producing module
is read-only by design"**, so they accumulated as permanently-unread
notifications. Phase 188.5 WR-04 let such a row be *born* read by honouring a
caller-supplied `ackedAt`; the 26 unacked signal rows measured today either
predate that change or come from a caller not supplying it. Either way they fall
into the ordinary non-held, non-money auto-ack path correctly.

### D-04: `ideationFindings` carve-out is `severity` in {critical, high}

Never auto-dismissed; human-only closure. Same shape as D-03's `money`.

There is no external consumer to protect here: `convex/briefings.ts:194-197`
reads `.withIndex("by_dismissed", q => q.eq("dismissed", false)).take(20)` —
undismissed, newest 20 only. Auto-dismiss is therefore materially less risky than
auto-ack is on `inbox`.

### D-05: Windows, and the disclosure that the second one cannot fire yet

| Table | Auto-close M | Grace G | Worst case (non-carve-out) |
|---|---|---|---|
| `inbox` | 30d unacked -> auto-ack | 14d after ack | 44d |
| `ideationFindings` | 180d open -> auto-dismiss | 90d after dismiss | 270d |

**Why `inbox`'s grace is 14d and not 30d — a disclosed UX cost.**
`convex/inbox.ts:64-74` derives `read: row.ackedAt != null`. So an auto-acked
card **displays as read for the whole grace window before it is deleted** — it
tells the operator they saw something they did not. Direct deletion would not lie
this way (a vanished card at least makes no claim), but it would need a second
index and a second cursor shape (see D-02). 14 days keeps the lie short while
preserving the audit/undo window that makes a badly-chosen M visible and
reversible before data is gone. If that tradeoff is unacceptable, the alternative
is direct age-based deletion for `card`/`notification`/`signal` and it should be
decided at planning time, not discovered in review.

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

### Revision on a second design pass (same day)

After receiving the measurements, Codex superseded its own first answer. The
correction it made to itself is the one worth recording: **the mechanism cannot
be keyed on `ackedAt`/`dismissedAt` as the primary gate, because that field is
almost never set.** Expiry is keyed on `createdAt` age; the closed-at field is
only the delete step's cursor. Four things came out of that pass and are folded
in above:

1. **The two guarantees have different strengths** (Verification A vs B). The
   absent-field property is enforced by the index and survives any future edit;
   the carve-outs are ordinary predicates with no backstop. Testing both the same
   way would look thorough and prove half of what it claims. This is the single
   most valuable thing either pass produced.
2. **The carve-outs are asymmetric** — `money` blocks silent closure only, `held`
   blocks both steps (D-03 table).
3. **Grace on `inbox` cut 30d -> 14d**, once the `read: row.ackedAt != null`
   derivation made the "an auto-acked card lies about being read" cost concrete
   (D-05).
4. **Copy the auto-ack shape from `alerts.ts`, not its unbounded `.collect()`**
   (D-02).

Both passes were checked against live code rather than accepted; every citation
in this document was verified individually against the tree on 2026-08-21.

## Verification Criteria

Modeled on `convex/media.test.ts:577-736`, which already establishes this repo's
control-pairing convention for exactly this function shape.

**The two safety guarantees in this phase have DIFFERENT STRENGTHS, so they need
different proof shapes. Conflating them is the easiest way to ship a test suite
that looks thorough and proves half of what it claims.**

- The `ackedAt`/`dismissedAt`-absent guarantee is **STRUCTURAL**: the index range
  never returns those rows. It survives a future edit that deletes every
  post-query predicate in the file.
- The `held`/`money`/`critical`/`high` carve-outs are **ORDINARY POST-QUERY
  PREDICATES**. They have no database-level backstop, and a careless future edit
  can silently remove them. Nothing would fail except a test written to catch it.

### A. Structural guarantee — assert at the QUERY layer, not the outcome layer

Seed a row with `ackedAt` absent. Call the delete step's query directly with a
cursor/cutoff range that WOULD include it if `ackedAt` were `0`. Assert the **raw
query result length is 0** — proving the database never returned it, rather than
that something filtered it afterwards.
**Control:** seed a second row with `ackedAt = 0` explicitly (not absent) under
the same cutoff and assert it IS returned. Without this the range query could be
returning empty unconditionally and the test would pass for the wrong reason.
Write this BEFORE trusting D-06's "no backfill required" claim.

### B. Predicate guarantees — require a real mutation-testing control

Seed one `itemType="held"` and one `itemType="card"` row, both unacked,
`createdAt` 400 days ago (past M and G). Run the chain to convergence. Assert the
held row's `ackedAt` is STILL undefined AND the row still exists; the card row is
gone.
**Control that makes the test worth having:** delete the `itemType !== "held"`
line in the handler and re-run the identical test — the held row must now ALSO be
auto-acked and deleted. If removing the guard does not flip the outcome, the test
is not exercising the exclusion and proves nothing. Same shape and same control
requirement for `priority === "money"` and for `severity IN {critical, high}`.

This is the focus_digest regression guard. It is not optional.

### C. Cursor advances on skip

A batch consisting ENTIRELY of excluded rows still advances the cursor and does
not reschedule with an unchanged one — direct regression test for
`retentionCursor.ts:122-139`. Note this is **not a rare edge case**: `held` alone
is 2.7% of the unacked population, so skipped rows will appear in nearly every
real batch. The test is load-bearing, not decorative.

### D. Batch/reschedule bounds

Full batch reschedules with an advanced cursor; short batch does not; ceiling
reached does zero further work. Adapt `media.test.ts:636-713` near-verbatim.

### E. Coverage gate green

Both tables moved to `COVERAGE_BOUNDED_BY_CRON` and both crons registered LIVE
(not commented out). Last gate before the phase is closed.

### F. First-run watch

Observe the first backlog-draining run in `docker logs convex-backend`, not just
the cron's own success line. The backend is single-node SQLite and mass
tombstones have OOM-crash-looped it before (`retention.ts:28-33`). An instrument
that cannot see the failure mode reports success right up until it doesn't.

**The backlog is known, not estimated** — it does not need a cold-start plan:
`inbox` has roughly 1,651 unacked x ~0.973 non-held x ~0.93 non-money ≈ **2,130
auto-ack-eligible rows**, about 11 batches at 200; `ideationFindings` has **≤470**,
about 3 batches. Both drain inside a single nightly chain.

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
