# Phase 110: Convex Durability - Research

**Researched:** 2026-08-10
**Domain:** Convex self-hosted backend operations — batch-capped retention pruning, live-instance observability, native (Rust) backend memory behavior
**Confidence:** HIGH on DUR-01/DUR-02 design (all claims verified against live code + live instance). MEDIUM-HIGH on DUR-03 (no bounding knob found for the strongest candidate mechanism; verified via the upstream open-source repo, not the vendor's own attribution).

## Summary

CONTEXT.md's 11 decisions are locked and already cite file:line for the "what". This document answers the "how" for the five seams CONTEXT.md leaves open, all grounded in the actual code and the live self-hosted instance (read-only probes only, per the safety brief).

**DUR-01/DUR-02 (the prune chain):** The cleanest way to add a per-table predicate without touching `RETENTION_DAYS`'s existing shape (and without breaking `retention.test.ts`'s `Object.entries(RETENTION_DAYS)` iteration or `retentionCursor.test.ts`'s pure-function tests) is a **sibling, optional predicate map** keyed by table name, consulted only inside `pruneBatchV3`'s delete loop. This requires one real correctness fix independent of aggregates: today `lastCreationTime` (which drives the cursor) is computed only from **deleted** docs; once a predicate can **skip** a doc without deleting it, `lastCreationTime` must be computed from every doc the *batch read* (not every doc it deleted), or a batch full of skipped (`period:"daily"`) rows would leave the cursor stuck at the same position forever — a self-inflicted repeat of the exact head-rescan bug `retentionCursor.ts` already fixed once. The rotation cursor (D-05/D-06) fits the **existing get-existing-or-patch idiom** already used four times on `agentConfigs` elsewhere in this repo (`webhookDelivery.ts`), not the insert-only/growing idiom used by the two other `agentConfigs`-backed cursors in `aggregates.ts` — those grow by design as operator-run resumable backfills; D-06 explicitly wants "never grows."

**DUR-02 (observability):** `retention-health-check.ps1` can read `RETENTION_DAYS` from the deployed source of truth with **zero new quoting risk** — add a thin `query` that returns the object literally, called via the exact same `npx convex run` invocation the script already uses, with no inline query string at all (no template, no nested quotes). This is simpler than the script's existing per-table probe pattern, not harder.

**DUR-03 (memory growth):** The running image (`sha256:f0de0647e4...`, built 2026-07-21) is a genuine Rust binary reading environment-var-driven "knobs" (`crates/common/src/knobs.rs`, confirmed live in this exact binary via `grep -a` with a known-present/known-absent control pair). All of the general-purpose memory-bounding knobs in that file (`UDF_CACHE_MAX_SIZE`, `MODULE_CACHE_MAX_SIZE_BYTES`, `INDEX_CACHE_SIZE`, `FUNRUN_*_CACHE_SIZE`, `DOCUMENTS_IN_MEMORY`) sum to roughly **1.5 GiB of bounded budget** — nowhere close to explaining the observed 8→45 GiB, ~0.17 GiB/h climb. Two upstream GitHub issues on `get-convex/convex-backend` are directly relevant: **#525** describes exactly this growth pattern on self-hosted instances, but its mechanism (uncoordinated search-index segment LRUs) requires `.searchIndex()`/`.vectorIndex()` usage, which this schema has **zero** of (verified) — so it almost certainly does not apply here. **#495** is a much stronger match: on self-hosted SQLite, `index_scan` ignores `.take()`/`size_hint` and materializes the **entire** index range into memory before truncating — which the issue itself calls out as making "any retention sweep that reads a wide `createdAt < cutoff` range unable to ever catch up... the table grows unbounded." This is a **code defect upstream, not a knob** — DUR-03 legitimately closes as "probed, no bounding knob exists for the strongest candidate mechanism, root cause documented with upstream evidence."

**Primary recommendation:** Implement DUR-01/02 as described (sibling predicate map + get-existing-or-patch rotation cursor + a thin `RETENTION_DAYS`-echoing query for the PS1). For DUR-03, document the two upstream issues (#495 primary, #525 ruled out) as the evidence base and close per D-09's explicitly-permitted "documented, not fixed" branch.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Aggregates pruning (DUR-01) | API/Backend (Convex `internalMutation`) | Database/Storage (SQLite persistence layer) | Pruning logic and the predicate live in `convex/retention.ts`; the actual delete executes against the self-hosted SQLite persistence layer, whose `index_scan` behavior (see DUR-03) directly bounds how safely this can scale. |
| Prune-pass observability (DUR-02) | Ops tooling (PowerShell, outside the app tiers) | API/Backend (Convex `query`) | The health check is a standalone operational script; it reads live state via the Convex CLI's `run` command, which is itself a thin client of the backend's query engine. |
| Memory-growth diagnosis (DUR-03) | Database/Storage (native Rust backend process) | — | The growth lives entirely inside the `convex-local-backend` process — no CodePulse application code is implicated; this is infrastructure research, not app-tier work. |

## Standard Stack

No new libraries. This phase touches only:
- `convex/retention.ts`, `convex/retentionCursor.ts`, `convex/retention.test.ts` (TypeScript, existing Convex functions)
- `convex-selfhost/retention-health-check.ps1` (PowerShell 5.1, existing script, not version-controlled until Phase 113)
- `CLAUDE.md` (documentation)
- A new phase evidence file (`.planning/phases/110-convex-durability/`)

No installation step, no version pin to verify.

## Package Legitimacy Audit

Not applicable. This phase installs no new npm/pip/cargo packages — it modifies existing first-party Convex functions and an existing first-party PowerShell script, and reads already-running infrastructure (`docker`, `npx convex run`, the live `convex-backend` container). Skipping the slopcheck gate is correct here, not a degradation.

## Architecture Patterns

### Data flow for the aggregates prune (DUR-01/DUR-02)

```
crons.ts (09:00 UTC daily)
   |
   v
startNightlyPrune  --reads rotation cursor from agentConfigs (D-06)-->  tableIndex = rotationCursor ?? 0
   |
   v
pruneBatchV3(tableIndex, nowMs, deletedSoFar, batchesUsed, cursorMs)
   |
   |-- table = PRUNED_TABLES[tableIndex]   (18 entries; aggregates is one more)
   |-- cutoffMs = nowMs - RETENTION_DAYS[table] * 86400 * 1000   (unchanged for all 18 tables)
   |
   v
ctx.db.query(table).withIndex("by_creation_time", cursorMs..cutoffMs).order("asc").take(200)
   |
   v
for each doc in batch:
   predicate = PRUNE_PREDICATES[table]            <-- NEW, optional, only "aggregates" has one
   if (!predicate || predicate(doc)) ctx.db.delete(doc._id)
   lastCreationTime = doc._creationTime            <-- NEW: unconditional, not just on delete
   |
   v
planNextPruneStep({ batchLength: batch.length, lastCreationTime, ... })   <-- UNCHANGED function
   |
   |-- continue-table / next-table / done / cap-reached
   |
   v
on cap-reached: patch rotation cursor = current tableIndex     (D-05: resume here tomorrow)
on done:        patch rotation cursor = 0                      (D-05: wrap for a fresh full pass)
```

### Recommended shape for the per-table predicate (research focus #1)

**The seam:** `convex/retention.ts:151-157` (the `by_creation_time` query) and the delete loop at `convex/retention.ts:159-165`.

**Enumerated options, per CONTEXT.md's "Claude's Discretion":**

1. **Predicate function on a sibling map** (recommended): `export const PRUNE_PREDICATES: Partial<Record<string, (doc: any) => boolean>> = { aggregates: (doc) => doc.period !== "daily" }`. `RETENTION_DAYS` itself is untouched — every existing line that reads `RETENTION_DAYS[table]` as a plain number (`retention.ts:138`, and every assertion in `retention.test.ts`) keeps working with zero changes.
2. **Index-scoped variant** (rejected): would mean querying `aggregates` through `by_type_period_bucket` or a new index scoped to `period:"hourly"` instead of `by_creation_time`. Rejected because D-02 explicitly requires the *existing* cursor-seek machinery, which is keyed on `by_creation_time` — swapping indexes per table reintroduces exactly the kind of per-table special-casing the single generic loop was built to avoid, and the cursor's monotonic-seek guarantee (the property `retentionCursor.test.ts` exists to protect) is only proven for `by_creation_time`.
3. **Policy descriptor on the `RETENTION_DAYS` entry** (rejected): would mean changing `RETENTION_DAYS: Record<string, number>` to `Record<string, number | {days: number, predicate: ...}>`, which breaks every `RETENTION_DAYS[table] * 86400 * 1000` arithmetic call site and every existing test that does `Number.isInteger(RETENTION_DAYS[table])` unless each site adds an unwrap. More surface area changed for the same outcome as option 1.

**Option 1 is what "the existing code most naturally admits."** It changes:
- `convex/retention.ts`: add the `PRUNE_PREDICATES` export near `RETENTION_DAYS`, add `aggregates: 90` to `RETENTION_DAYS` (alongside a doc comment following the `prompts`/`promptVersions` D-13 precedent already in this file at lines 79-95), and change the delete loop from unconditional `ctx.db.delete` to a predicate-gated one.
- **The required correctness fix, independent of aggregates**: `lastCreationTime` (`retention.ts:160,164`) currently updates only inside the delete branch. It must move to update from **every** doc the batch returned, deleted or skipped — see "Common Pitfalls" below for why this is not optional.

```typescript
// convex/retention.ts — illustrative, not final code
export const RETENTION_DAYS: Record<string, number> = {
  // ...existing 18 entries unchanged...
  aggregates: 90, // D-04: hourly-only; daily rows are exempted via PRUNE_PREDICATES below, kept forever
};

// D-02/D-03: optional per-table gate, consulted inside pruneBatchV3's delete loop.
// A table absent from this map is pruned unconditionally, exactly as today.
export const PRUNE_PREDICATES: Partial<Record<string, (doc: any) => boolean>> = {
  // D-01/D-03: "hourly" rows age out; "daily" rows are the re-priceable cost-history
  // aggregates and must never be deleted by this chain (Phase 104 D-04). This is the
  // POSITIVE guard D-03 asks for — assert it directly against this function, not a comment.
  aggregates: (doc) => doc.period !== "daily",
};

// inside pruneBatchV3's handler, replacing the unconditional delete loop:
let deleted = 0;
let lastCreationTime: number | null = null;
const predicate = PRUNE_PREDICATES[table];
for (const doc of batch) {
  if (!predicate || predicate(doc)) {
    await ctx.db.delete(doc._id);
    deleted++;
  }
  lastCreationTime = doc._creationTime; // unconditional — see Pitfall 1 below
}
```

**D-03's positive guard, directly testable** (matches the existing `retention.test.ts` file-reading pattern used for the D-13 exemption):
```typescript
import { PRUNE_PREDICATES } from "./retention";
it("the aggregates predicate can never delete a period:daily row", () => {
  expect(PRUNE_PREDICATES.aggregates!({ period: "daily" })).toBe(false);
  expect(PRUNE_PREDICATES.aggregates!({ period: "hourly" })).toBe(true);
});
```

### The units trap, resolved (bucket_start seconds vs. _creationTime ms)

CONTEXT.md flags this explicitly. The resolution: **the prune's cutoff and cursor continue to operate purely on `_creationTime` in milliseconds, exactly as they do for the other 17 tables — the predicate never needs to read `bucket_start` at all.** `bucket_start`/`period` only decide *class membership* (is this row ever prunable), not *when* it becomes eligible. This is safe, not merely convenient:

- For live-written hourly rows (the overwhelming majority — `incrementEventBucket`/`computeHourly` write within the hour they represent), `_creationTime ≈ bucket_start * 1000`, so a 90-day `_creationTime` cutoff and a 90-day `bucket_start` cutoff agree to within the hour.
- For **backfilled** rows (`insertBucketsBatch`, called from the one-shot operator-gated backfill action at `analyticsRollup.ts:297-326`), `_creationTime` = whenever the backfill ran, which can be far more recent than the `bucket_start` the row represents. Cutting on `_creationTime` means such a row survives 90 days **from when it was written**, not 90 days from the date it represents — strictly *more* conservative than a `bucket_start` cutoff would be. It can never cause a reader-visible bucket to disappear early; it can only make an already-stale-looking bucket linger a bit longer than its `bucket_start` alone would suggest. That is the correct failure direction for a durability phase.

### Collision with `analyticsRollup.ts`'s `clearHistoricalBucketsPage` (research focus #1, canonical ref)

`clearHistoricalBucketsPage` (`convex/analyticsRollup.ts:273-292`) is a **second, pre-existing** deleter over `aggregates`, called only from the one-shot operator-gated backfill action (not on any cron — confirmed by `crons.ts`, which has no entry referencing `analyticsRollup`). It deletes rows where `metric_type IN ("events","sankey_edge")`, `period:"hourly"`, `bucket_start < cutoffHour`, via the `by_type_period_bucket` index — a **different index and different predicate field** (`bucket_start`, not `_creationTime`) than the new nightly-prune predicate.

**No correctness collision**: both mechanisms only ever delete `ctx.db.delete(id)` by a freshly-queried `_id`; deleting an already-deleted document is a Convex no-op error path only if the row is gone (query simply won't return it), not a data-corruption risk. **The only real interaction** is redundant scanning if an operator manually re-runs the backfill action while the nightly prune is also mid-run on `aggregates` — a narrow window (the backfill is manual/rare, the nightly prune runs once at 09:00 UTC). Document this second writer in the `PRUNE_PREDICATES` comment (as the code sample above already does) so a future editor doesn't "discover" it as a surprise.

### Rotation cursor shape (research focus #2, D-05/D-06)

**Precedent in this exact codebase**, two competing idioms on `agentConfigs`:

| Idiom | Used by | Shape | Fits D-06? |
|---|---|---|---|
| Insert-only, "last row by `_creationTime` wins" | `aggregates.ts` `DAILY_ROLLUP_BACKFILL_CURSOR_KEY`, `TOKEN_SPLIT_BACKFILL_CURSOR_KEY` (both `aggregates.ts:699-704`, `825-830`) | `ctx.db.insert(...)` every call, never patched, grows forever | **No** — D-06 says "never grows" |
| Get-existing-or-patch | `webhookDelivery.ts` `webhook-discord-url`, `webhook-slack-url`, `notification-preferences`, `last-digest-at` (`webhookDelivery.ts:47-64`, `213-232`, `728-743`) | `existing ? ctx.db.patch(existing._id, {...}) : ctx.db.insert(...)`, one row forever | **Yes** — this is the idiom to copy |

**Recommended key name**: `"retention.rotationCursor"` (dotted namespace, matching the *style* of `phase104.tokenSplitBackfill.cursor`/`phase104.tokenSplitBackfill.cursor` even though those are the insert-only idiom — the naming convention, not the growth behavior, is what's worth reusing). **Value shape**: a plain integer, `0 <= v < PRUNED_TABLES.length` — the tableIndex to start at tonight.

**Failure modes and handling** (research focus #2):

| Failure mode | Cause | Handling |
|---|---|---|
| Row missing | First run after this phase ships, or the row was manually deleted | Default to `0` — identical to today's hardcoded behavior, so a missing cursor is never worse than the status quo |
| Row present but non-numeric / `NaN` | Hand-edit gone wrong, or a schema mismatch | `Number.isInteger(v)` check; on failure, treat as missing → `0` |
| Row present but out of range (`>= PRUNED_TABLES.length` or `< 0`) | `RETENTION_DAYS` **loses** keys between nights (a table removed) and the old cursor now points past the end, or a hand-edit wrote a negative number | Bounds check `0 <= v < PRUNED_TABLES.length`; out-of-range → `0`. This is the same bounds check that protects against `RETENTION_DAYS` gaining OR losing keys — no special-case needed for either direction, since the check is purely `v < PRUNED_TABLES.length` at read time (evaluated fresh every run against whatever `RETENTION_DAYS` currently contains) |
| `RETENTION_DAYS` gains keys between nights | A future phase adds a 19th table | No special handling needed — the existing cursor (e.g. `7`) is still valid for the new, longer array; the new table is simply reached later in the rotation, same as it would be appended at the end today |

**Where it's written**: only at the two chain-terminal branches of `pruneBatchV3` — `cap-reached` (write `args.tableIndex`, so tomorrow resumes exactly where tonight stopped — this is the direct fix for D-05's stated problem) and `done` (write `0`, wrapping for a fresh full pass). **Not** written at `continue-table`/`next-table` — those are interior steps of the same run, and writing there would mean a per-batch `agentConfigs` write, which is the per-run-write growth D-08 explicitly rejects.

**Whether `planNextPruneStep`'s tests need to change**: **No.** `retentionCursor.test.ts` calls `planNextPruneStep` directly with explicit `tableIndex`/`tableCount` arguments (default `tableCount: 14` in its `step()` helper, `retentionCursor.test.ts:26` — this is a self-consistent test fixture, not a read of the real `RETENTION_DAYS`, so it is unaffected by `RETENTION_DAYS` growing to 19 entries). D-05's rotation only changes what `startNightlyPrune` passes as the **initial** `tableIndex` — it never changes `planNextPruneStep`'s contract, inputs, or outputs. New tests should be **added** (e.g., "a rotation cursor is written on cap-reached" as an assertion against a small pure helper extracted for that decision, mirroring how `planNextPruneStep` itself was extracted to stay testable without a `convex-test` harness) rather than any existing test edited.

### D-07: reading `RETENTION_DAYS` live from PowerShell (research focus #3)

**Recommended mechanism**: add a thin, no-argument `query` to `convex/retention.ts` that returns `RETENTION_DAYS` verbatim:

```typescript
// convex/retention.ts
import { query } from "./_generated/server"; // + existing internalMutation import

// D-07: lets retention-health-check.ps1 read the live policy map instead of
// hand-copying it. A read of the SAME exported object pruneBatchV3 iterates —
// not a second copy, and nothing to keep in sync.
export const listRetentionPolicy = query({
  args: {},
  handler: async () => RETENTION_DAYS,
});
```

Called from PowerShell exactly like the script's existing `docker stats`/`npx convex run --inline-query` calls, but **simpler** — no inline query string, no nested quoting at all:

```powershell
$policyJson = (cmd /c "cd /d `"$CodepulseDir`" && npx convex run retention:listRetentionPolicy --env-file `"$EnvFile`" 2>&1") -join "`n"
$policy = $policyJson | ConvertFrom-Json    # PSCustomObject with one property per table
foreach ($table in $policy.PSObject.Properties.Name) {
    $days = $policy.$table
    # ...existing per-table probe body, unchanged...
}
```

This satisfies every constraint D-07/discretion lists: (1) it is a **read of the source of truth** — the query returns the literal `RETENTION_DAYS` object `pruneBatchV3` itself imports, so there is no second copy to drift; (2) it needs **no nested quoting** at all, which is strictly safer than the existing per-table probe's single-quoted-JS-inside-`cmd /c` pattern (the constraint that pattern exists to satisfy is automatically met by having no literal to quote); (3) it reuses the **exact same invocation shape** (`npx convex run ... --env-file ...`) the script already uses elsewhere, so no new PS1 pattern is introduced. The alternative considered — a generated JSON artifact written at deploy time — was rejected: it would need its own regeneration trigger (a `predeploy` hook, or a manual step someone forgets), which is exactly the "second copy that goes stale" failure D-07 exists to eliminate. A live query has no staleness window at all.

The stale 14-entry `$RetentionDays` hashtable (`retention-health-check.ps1:38-54`) and its "Keep in sync" comment are deleted outright, replaced by the `ConvertFrom-Json` read above.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Reading a live Convex value from PowerShell | A new bespoke CLI wrapper or a hand-parsed `docker exec` call | `npx convex run <module>:<fn> --env-file ... ` (already the script's own established pattern) | Already proven to work quoting-safely in this exact script; a second invocation style is needless surface area |
| Per-run retention audit trail | A new `retentionRuns` table | The chain's own terminal log line (`retention: all tables pruned`) + a health-check run, per D-08 | D-08 explicitly rejects adding writes to the module that exists to reduce them |
| Detecting whether a table "caught up" | A boolean flag on each table | The three-way disambiguation already in `retention-health-check.ps1` (oldest-doc overhang vs. empty vs. timeout) plus the terminal log line, per D-08/`<specifics>` | A single "caught up" boolean is ambiguous between pruned, empty, and nothing-aged-out — CONTEXT.md is explicit this is a design requirement, not an implementation detail |

**Key insight:** every piece of new machinery this phase needs (a predicate, a cursor, a live-read query) already has a close relative elsewhere in this exact codebase. The job is picking the right existing idiom to copy, not inventing new ones — CONTEXT.md's canonical refs and code_context sections already did most of this discovery; this research's job was resolving which of two or three existing idioms fits each decision's stated constraints.

## Common Pitfalls

### Pitfall 1: `lastCreationTime` computed only from deleted docs — the predicate's silent self-defeat

**What goes wrong:** If the per-table predicate gates only the `ctx.db.delete()` call and `lastCreationTime` is left updating only inside that same conditional (as it does today, `retention.ts:160-164`), a batch consisting entirely of skipped rows (e.g., 200 consecutive `period:"daily"` rows, which is plausible for `aggregates` since daily rows interleave with hourly ones by insertion order) leaves `lastCreationTime === null`. `planNextPruneStep` then receives `batchLength: 200` (full — looks like more work remains) with `lastCreationTime: null`, and its own `Math.max(lastCreationTime ?? cursorMs, cursorMs)` clamp (`retentionCursor.ts:111`, deliberately defensive) resolves to the **unchanged** `cursorMs`. The next batch re-seeks to the exact same position, re-reads the exact same 200 skipped rows, and repeats — burning the entire `MAX_BATCHES_PER_NIGHT` budget on zero net progress, silently, every night, until the cap fires.
**Why it happens:** The predicate is new; the cursor-advancement logic was written and tested against a world where "the batch length" and "the number of docs advanced past" were always the same number. A per-table predicate is the first thing to break that assumption.
**How to avoid:** Compute `lastCreationTime` from every doc the query *returned*, unconditionally — as the illustrative code above does — never from only the deleted subset. `planNextPruneStep` itself needs no change; it was already written defensively enough (`retentionCursor.ts:100-113`) to handle this correctly once given the right input.
**Warning signs:** A capped or stalled run whose log shows the batch cap hit at `aggregates` with `pruned 0 docs` (or a suspiciously low, repeating count) despite the table having plenty of prunable hourly rows.

### Pitfall 2: SQLite `index_scan` reads the whole range before truncating (upstream #495)

**What goes wrong:** On this exact backend flavor (self-hosted, SQLite persistence), a `.withIndex(...).take(N)` read materializes the **entire** matched index interval into memory before the `take(N)` truncation is applied — confirmed via the open upstream issue, not merely suspected (see DUR-03 sources). For the retention prune, every batch's query is `.gte(cursorMs).lt(cutoffMs).take(200)` — the interval width is `cutoffMs - cursorMs`, which is small in steady state (one night's worth of newly-eligible docs) but can be **large** on the very first night this phase ships for `aggregates` (D-04 already measured the actual backlog: only 90 rows older than 90 days, so this specific table's first-pass interval is small) or on any table whose prune has fallen behind for other reasons.
**Why it happens:** `crates/sqlite/src/lib.rs`'s `index_scan` takes a `_size_hint` parameter that is prefixed with `_` — i.e., deliberately unused — and its SQL has no `LIMIT` clause.
**How to avoid:** Nothing to change in this phase's own code — `BATCH_SIZE=200` and the narrow `cursorMs..cutoffMs` window are already the mitigation (they bound the interval width, not just the result count). Do not "helpfully" widen `BATCH_SIZE` or the batch cap to make the prune finish faster; per this defect, a wider interval costs memory proportional to *every row in the interval*, not just the 200 that get kept.
**Warning signs:** A `SystemTimeoutError` or a memory spike on a bounded-looking query (`.take(N)` for small `N`) against a large table — this is the exact symptom CONTEXT.md's `<specifics>` section already recorded live on 2026-08-10 (`aggregates` `>30d` probe at `take(5001)` timed out while `>90d` returned instantly, because the `>90d` interval is far narrower).

### Pitfall 3: mistaking "closed = fixed" for an upstream GitHub issue

Not applicable here — both #495 and #525 are **open** as of this research (verified via `gh issue view --json state`), so no risk of citing a stale "fixed" status. Recorded per this project's own verification discipline (`state_reason`/who-closed matters more than open/closed) in case a planner re-checks this later and finds one closed — re-verify `state_reason` at that time rather than assuming either direction.

## Code Examples

### Get-existing-or-patch idiom (copy for the rotation cursor, D-06)

```typescript
// Source: convex/webhookDelivery.ts:47-64 (existing pattern in this repo)
const configKey = `webhook-${args.channel}-url`;
const existing = await ctx.db
  .query("agentConfigs")
  .withIndex("by_key", (q) => q.eq("configKey", configKey))
  .first();
if (existing) {
  await ctx.db.patch(existing._id, { value: args.url, updatedAt: Date.now() / 1000 });
} else {
  await ctx.db.insert("agentConfigs", { configKey, value: args.url, updatedAt: Date.now() / 1000 });
}
```

### The cursor-seek query the predicate must not disturb

```typescript
// Source: convex/retention.ts:151-157 — unchanged shape; the predicate applies
// AFTER this query returns, inside the delete loop, never inside the query itself.
const batch = await ctx.db
  .query(table as any)
  .withIndex("by_creation_time", (q: any) =>
    q.gte("_creationTime", cursorMs).lt("_creationTime", cutoffMs)
  )
  .order("asc")
  .take(BATCH_SIZE);
```

### Binary-level knob confirmation (verified live, DUR-03)

```
$ MSYS_NO_PATHCONV=1 docker exec convex-backend grep -a -c "DOCUMENT_RETENTION_DELAY" /convex/convex-local-backend
1
$ MSYS_NO_PATHCONV=1 docker exec convex-backend grep -a -c "DEFINITELY_NOT_A_REAL_ENV_VAR_9X7Q2" /convex/convex-local-backend
0
```
Control pair confirms `grep -a` against the binary is a valid technique (known-present string found, known-absent string not found) before trusting its absence-of-knob conclusions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Head-rescan (`.order("asc").take(200)` from the head every batch) | Cursor-seeked, cutoff-bounded range scan | 2026-07-30 (`retentionCursor.ts`) | Already shipped and verified live; this phase does not touch it, only extends it to `aggregates` and adds rotation |
| 14-entry hand-copied `$RetentionDays` in the PS1 | Live read of the deployed `RETENTION_DAYS` via a thin query | This phase (D-07) | Closes the exact gap D-07's evidence documents: 4 of 18 tables were invisible to every health check that has ever run |

**Not deprecated, still current as of this research:** the batch-capped/sequential/3s-apart prune design itself, `DOCUMENT_RETENTION_DELAY=1800`, the `mem_limit: 64g` container cap, `ConvexNightlyRestart`'s escalation order (`docker restart` before `compose up --force-recreate`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SNAPSHOT_MANAGER`/MVCC in-memory version retention beyond the named "knobs" (not individually itemized in this research) is not independently ruled out as a growth contributor — only the named cache knobs (~1.5 GiB) and the two GitHub issues were investigated, not every subsystem in a 1970-line knobs file | DUR-03 / Memory-growth root cause | If wrong, DUR-03's documented root cause is incomplete rather than false — the negative evidence for the *named* knobs still stands, but "no bounding knob exists" would need re-stating as "no bounding knob was found among the candidates investigated" |
| A2 | Issue #495 (SQLite `index_scan` materializing the whole range) is presented as the **strongest candidate contributor** to the memory-growth pattern, but no live experiment in this repo isolated it as *the* cause (D-09 explicitly rejects a multi-day attribution study as disproportionate) | DUR-03 | If wrong (i.e., #495 is a real but minor contributor and the dominant driver is something else entirely), DUR-03 still closes correctly per D-09's "documented" branch — the risk is only that the write-up overstates confidence in this specific mechanism |
| A3 | The running container's image build date (2026-07-21, confirmed via `docker image inspect`) is assumed to contain the same `index_scan` behavior as the `main` branch commit (`f760918`) the issue was verified against, since #495's body states "not version-specific... reproduces on current main" | DUR-03 | Low risk — the issue explicitly claims version-independence, and no fix commit exists (issue is open, no linked PR) to have been picked up or missed by either build |

## Open Questions

1. **Does the planner want a new pure helper extracted for the rotation-cursor value computation (mirroring `retentionCursor.ts`'s extraction), or is inlining acceptable inside `pruneBatchV3`?**
   - What we know: `planNextPruneStep` is the only chain-logic this repo can unit-test (no `convex-test` harness); the *rotation write* (which value to persist, at which two terminal branches) is new logic in the same spirit.
   - What's unclear: whether the planner judges this worth its own dependency-free function + test file, or whether two `if` branches inside the existing mutation are proportionate.
   - Recommendation: extract if the planner wants it independently testable (matches this repo's established pattern of pulling chain-decision logic out of the untestable mutation); inline is not wrong, just less consistent with precedent.

2. **Exact evidence-file name/location for D-11's write-up.**
   - What we know: precedent is `108-ENGINE-05-EVIDENCE.md`, `109-LIVE-EVIDENCE.md`, `107-OCC-EVIDENCE.md` — phase-number-prefixed, topic-suffixed, living in the phase directory.
   - What's unclear: whether DUR-02's "two independent pieces of live evidence pasted verbatim" and DUR-03's root-cause write-up share one file (`110-DUR-EVIDENCE.md`) or split (DUR-02 and DUR-03 evidence differ in kind — a log transcript vs. a research/GitHub-issue citation).
   - Recommendation: one file, `110-DUR-EVIDENCE.md`, with clearly separated `## DUR-02` and `## DUR-03` sections — matches how CONTEXT.md itself already groups these two decisions' evidence requirements separately while keeping them in one phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Docker Desktop / WSL2 | Reading live container state (DUR-02, DUR-03 evidence) | Yes (verified live this session) | — | — |
| `convex-backend` container | All three requirements — the live instance under test | Yes, running (verified: `docker exec`, `curl :3210/version` reachable) | Image `sha256:f0de0647e4...`, built 2026-07-21 | — |
| `npx convex` CLI | DUR-02's PS1 reads, D-07's new query invocation | Yes (already used extensively by `retention-health-check.ps1`) | — | — |
| PowerShell 5.1 | `retention-health-check.ps1` execution | Yes (host shell, per project conventions) | 5.1 | — |
| `gh` CLI with GitHub API access | Verifying upstream `get-convex/convex-backend` issues (DUR-03 research only, not phase execution) | Yes (used in this research session) | — | Not needed at execution time — this was research-only tooling |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — everything needed for DUR-01/02/03 is already running and already used by existing scripts in this repo.

## Validation Architecture

`workflow.nyquist_validation` is not set to `false` in `.planning/config.json` (the `workflow` key present there is `{_auto_chain_active, use_worktrees}` only) — treated as enabled.

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest (existing, `convex/**/*.test.ts` + `src/**/*.test.tsx`) |
| Config file | Project-root Vitest config (existing; no new config needed) |
| Quick run command | `npx vitest run convex/retention.test.ts convex/retentionCursor.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| DUR-01 | `aggregates` is pruned batch-capped/cursor-seeked, never bulk | unit | `npx vitest run convex/retention.test.ts -t "aggregates"` | ❌ Wave 0 — new assertions needed in `retention.test.ts` (positive predicate guard + `RETENTION_DAYS.aggregates === 90`) |
| DUR-01 | A `period:"daily"` row can never be deleted by the new predicate | unit | `npx vitest run convex/retention.test.ts -t "period:daily"` | ❌ Wave 0 — the exact assertion shown in "Code Examples" above |
| DUR-01 | The predicate-skip case doesn't stall the cursor (Pitfall 1) | unit | New test in `retentionCursor.test.ts` or a new pure helper's own test file, asserting `lastCreationTime` sourcing is independent of delete count | ❌ Wave 0 |
| DUR-02 | A complete nightly pass covers every `RETENTION_DAYS` table including `aggregates` and the 4 currently-invisible tables | live observable, not unit-testable | See "manual/live legs" below | ❌ — inherently requires the live instance, no automated command produces this |
| DUR-03 | Memory-growth root cause documented with evidence (knob found+measured, or knob absent+documented) | source assertion / live observable | See "manual/live legs" below | ❌ — inherently requires the live instance / upstream research, no automated command |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/retention.test.ts convex/retentionCursor.test.ts` — must stay green through every DUR-01 code change; this is the fastest signal that D-02's "existing chain, not a parallel one" constraint hasn't been violated.
- **Per wave merge:** `npm test` (full suite) — catches any unrelated regression from touching `convex/retention.ts`, a file several other modules' tests may indirectly assume the shape of (e.g. `retention.test.ts`'s own table-existence check against `schema.ts`).
- **Phase gate:** Full suite green, **plus** the two live legs below captured verbatim in `110-DUR-EVIDENCE.md`, before `/gsd:verify-work`.

### The three live/manual legs (DUR-01 confirmation, DUR-02, DUR-03) — concrete signals, never "looks correct"

**DUR-01 live confirmation** (in addition to the unit tests above):
- Command: `MSYS_NO_PATHCONV=1 docker exec convex-backend ...` via `npx convex run --inline-query` (the pattern already in `retention-health-check.ps1:105-115`), querying: `await ctx.db.query('aggregates').withIndex('by_type_period_bucket', q => q.eq('metric_type','cost').eq('period','daily')).take(5)` before and after the first post-deploy nightly prune.
- Expected output: identical (or growing, never shrinking) daily-row count across the run — a shrinking count is a hard fail (the predicate is deleting daily rows) and must block the phase.
- Control: also run the equivalent query for `period:"hourly"` and confirm its count either drops or its oldest `_creationTime` moves forward — an hourly count that never changes across multiple nightly runs is evidence the predicate is (wrongly) skipping *everything*, the opposite failure mode.

**DUR-02 — the two-leg evidence D-08 specifies, pasted verbatim into `110-DUR-EVIDENCE.md`:**
1. `docker logs convex-backend --tail <N> --since <the cron's fire window>` (per this project's own logging-rotation lesson: never `--since` alone without a `--tail` bound and a positive control — see `health-report.md` §7) filtered for the literal line `retention: all tables pruned`. **This line is reachable only if the chain reached its final `done` action** — i.e., every table including `aggregates` and the rotation all advanced. Its *presence* is the disambiguator CONTEXT.md's `<specifics>` calls for: a table reading "caught up" is ambiguous between pruned/empty/nothing-aged-out, but this terminal line can only be logged once, at the true end of a full pass.
2. A `retention-health-check.ps1` run (post-D-07) whose output shows **every** key from the live `listRetentionPolicy` query — no longer just the 14 hand-copied ones — with a status of `ok`/`empty-or-caught-up` for each, and zero `TIMEOUT`. Cross-check the printed table count against `Object.keys(RETENTION_DAYS).length` (19 after this phase) as an explicit control: a health-check run that only ever prints 14 or 18 tables despite the live map having 19 is itself a bug in D-07's implementation, not a clean pass.

**DUR-03 — closes on either branch, both are "done", neither is "looks correct":**
- **Knob-found branch:** a specific env var name, its default, and a **measured** before/after `docker stats`/cgroup `anon` sample across at least one full inter-restart cycle (per D-10, `ConvexNightlyRestart` left running throughout) — pasted verbatim, with the comparison explicitly against the ~0.17 GiB/h baseline already on record in `health-report.md`.
- **Knob-absent branch (the one this research's evidence points toward):** the two GitHub issue citations (`get-convex/convex-backend#495`, `#525`) with their `state`/`state_reason` re-verified at write-up time (not assumed from this research session), the explicit ruling-out of #525 (zero `.searchIndex()`/`.vectorIndex()` in `schema.ts` — reconfirm with the same grep this research used, as a control against schema drift between now and execution), and a one-line addition to CLAUDE.md's "Self-Hosted Convex — Operational Rules" section per D-11 stating `ConvexNightlyRestart` is deliberate and citing this evidence file.

### Wave 0 Gaps

- [ ] `convex/retention.test.ts` — needs 3 new assertions: `RETENTION_DAYS.aggregates === 90`, the positive `PRUNE_PREDICATES.aggregates` guard (D-03), and (if `PRUNE_PREDICATES` iteration is added to the "every key is a real table" guard) a table-existence check on `PRUNE_PREDICATES`'s keys too.
- [ ] `convex/retentionCursor.test.ts` or a new sibling test file — needs coverage for whichever shape the rotation-cursor value computation takes (Open Question 1) plus a Pitfall-1-shaped regression test (a full batch of all-skipped docs must still advance the cursor).
- [ ] `.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md` — does not exist yet; this is the pasted-verbatim evidence artifact D-08/D-11 require, not a code file.
- No test framework install needed — Vitest is already fully wired for `convex/*.test.ts`.

## Security Domain

Not applicable — `security_enforcement` is not referenced in `.planning/config.json`, but this phase touches no auth, session, input-validation, or cryptography surface. It modifies an internal cron mutation (no external input), an ops script that already runs with admin-key access to the same instance it always has, and documentation. No new ASVS-relevant surface is introduced.

## Sources

### Primary (HIGH confidence — read directly, this session)
- `convex/retention.ts` (full file, 216 lines)
- `convex/retentionCursor.ts` (full file, 121 lines)
- `convex/retention.test.ts` (full file, 104 lines)
- `convex/retentionCursor.test.ts` (full file, 134 lines)
- `convex/schema.ts:945-994` (`aggregates` table + surrounding tables), `convex/schema.ts:261-276` (`agentConfigs`/`configChanges`)
- `convex/analyticsRollup.ts:1-40, 230-330` (`clearHistoricalBucketsPage`, `insertBucketsBatch`)
- `convex/crons.ts` (full file)
- `convex/dataRetention.ts:1-40`
- `convex/costDerived.ts:360-490` (`unpricedModels`, `computePeriodSpend`, `deriveBreakdown` caller survey)
- `convex/analytics.ts:1-110` (all 4 heavy analytics queries)
- `convex/alerts.ts:820-870, 1040-1070` (`sdk_spend_usd_today` condition evaluator, both call sites)
- `convex/briefings.ts:155-185` (daily digest cost read)
- `convex/webhookDelivery.ts` (get-existing-or-patch precedent, 4 call sites)
- `convex/aggregates.ts:487-835` (insert-only cursor precedent, both backfill cursors)
- `C:/Users/mandr/convex-selfhost/retention-health-check.ps1` (full file, 212 lines)
- `C:/Users/mandr/convex-selfhost/restart-convex.ps1` (full file)
- `C:/Users/mandr/convex-selfhost/retention-root-cause.ps1` (full file)
- `C:/Users/mandr/convex-selfhost/health-report.md` (full file, 2026-08-06 root-cause report)
- `C:/Users/mandr/convex-selfhost/docker-compose.yml` (full file)
- `C:/Users/mandr/convex-selfhost/retention-health.log` (tail, live 2026-08-10 run)
- `C:/Users/mandr/convex-selfhost/restart-convex.log` (tail, 2026-08-06→08-10 readings)
- `C:/Users/mandr/convex-selfhost/soak-watch.state.json`
- Live `docker exec`/`docker inspect`/`curl :3210/version` probes against `convex-backend`, this session (image digest, build date, binary `--help`, `run_backend.sh`, `grep -a` control pair against the binary)
- `https://github.com/get-convex/convex-backend/blob/main/crates/common/src/knobs.rs` (fetched raw via `gh api`, 1970 lines, grepped for cache/memory/retention knobs)
- `https://github.com/get-convex/convex-backend/issues/495` ("Self-hosted SQLite backend: index_scan materializes the entire index range... OOM on large tables") — full body read, OPEN, filed 2026-06-25
- `https://github.com/get-convex/convex-backend/issues/525` ("Self-hosted: in-process searchlight disk cache and segment LRUs are uncoordinated — RAM growth...") — full body + comments read, OPEN, filed 2026-08-09

### Secondary (MEDIUM confidence)
- `gh api search/issues` result set across `get-convex/convex-backend` for "memory self-hosted" — used to select which issues to read in full; not all 8 results were opened (e.g. #101, #225, #312, #435, #466, #519 were seen only as titles, not read).

### Tertiary (LOW confidence)
- None relied upon for any claim in this document.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new dependencies
- Architecture (DUR-01/DUR-02 predicate + cursor design): HIGH — every claim traced to a specific file:line in this repo, cross-checked against the existing test files' actual assertions (not assumed)
- DUR-03 root-cause: MEDIUM-HIGH — the "no bounding knob among the named caches" claim is HIGH confidence (read the actual source, confirmed the binary contains it via a controlled `grep`); the "#495 is the strongest candidate contributor" claim is MEDIUM (well-sourced and directly on-point, but not confirmed as *the* mechanism via a live experiment, which D-09 explicitly declines to fund)
- Pitfalls: HIGH — Pitfall 1 is derived directly from reading `planNextPruneStep`'s actual clamp logic, not speculation; Pitfall 2 is a direct quote/citation of an open upstream issue plus this project's own already-recorded matching symptom (the `>30d` timeout)

**Research date:** 2026-08-10
**Valid until:** 30 days (2026-09-09) for the code-level findings (DUR-01/DUR-02 design); the DUR-03 upstream-issue citations should be re-verified for `state`/`state_reason` at execution time regardless of date, since GitHub issue state can change at any point and D-11's write-up explicitly depends on citing accurate status.
