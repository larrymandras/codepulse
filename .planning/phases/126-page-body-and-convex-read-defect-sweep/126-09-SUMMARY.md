# Plan 126-09 — Operator Deploy — SUMMARY

**Executed:** 2026-08-25, by the orchestrator with Larry's explicit go-ahead
**Requirements:** SWEEP-01, SWEEP-02, SWEEP-03, SWEEP-05
**Status:** COMPLETE

---

## Task 1 — Working-tree audit (pre-deploy)

`convex deploy` ships the WORKING TREE, not HEAD, in a checkout another session was active in all
day. Audited before pushing:

| Check | Result |
|---|---|
| Dirty paths | **only** `.planning/phases/126-.../phase-state.json` — no code shipped uncommitted |
| Branch / HEAD | `master` @ `6ffbd472`, 41 ahead of `origin/master` (`5239a557`) |
| `convex/` commits carried | 9 mine + **1 not mine** — `62727941` |
| Schema delta | purely additive: `blobChunkCount`, `graphSnapshotBlobChunks` + its index, and `links.usageCount`/`lastUsedAt` |
| Deletions in schema diff | **0** |
| Full suite immediately prior | 364 files / **5,122 passed / 0 failed** |

**`62727941` is not mine and is LOAD-BEARING.** It declares `links.usageCount`/`lastUsedAt`, added
by a concurrent session. Without it this deploy would have **FAILED** schema validation, because
live `links` rows already carry `usageCount` (measured: 1 of 25 rows) that master would not have
declared. Carrying it is correct, not contamination.

---

## Task 2 — The deploy

```
npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile -y
```

Verbatim, the lines that matter:

```
✔ No indexes are deleted by this push
Schema validation complete.
✔ Added table indexes:
  [+] graphSnapshotBlobChunks.by_snapshot_version_seq   snapshotId, version, seq, _creationTime
✔ Deployed Convex functions to http://127.0.0.1:3210
```

- **"No indexes are deleted by this push"** — CLAUDE.md names this as the ONLY announcement of a
  destructive schema rollback. Stated explicitly, as the plan requires, rather than assumed.
- **"Schema validation complete"** — the point `62727941` existed to get past.
- The added index has **`seq` as its trailing declared field**, which is D-06-REVISED's binding
  requirement (`_creationTime` is appended implicitly by Convex after the declared keys).

---

## Task 3 — Live verification

### The before/after control, and an honest correction to it

The plan's ORIGINAL control — `inbox:countHeldUnacked` ABSENT → PRESENT — was **void before this
plan ran**: a concurrent session deployed this working tree twice earlier in the day, so the
function was already live. That is recorded in the plan text.

**The replacement control I named was also badly chosen, and I am recording that rather than
quietly substituting a better one.** I proposed watching `graphSnapshotBlobChunks` go ABSENT →
PRESENT in `npx convex function-spec`. It read **0 before AND 0 after** — because `function-spec`
lists FUNCTIONS, not tables, so it can never show a table name. A guaranteed zero in both
directions, the same class of trap CLAUDE.md already records for `internal.*` lookups.

**The control that actually discriminated** is the deploy output itself: `[+]
graphSnapshotBlobChunks.by_snapshot_version_seq` is an index that did not exist before this push
and does now.

A second, independent control was run on the probe itself: `getProjectGraph` returned a zero-length
result pre-backfill, which is ambiguous between "returned null" and "my probe is broken", so
`graphSnapshots:listSnapshots` was run as a control and returned 909 chars of real data — proving
the probe works and the null was genuine.

### Live measurements

**Pre-backfill.** `getProjectGraph` returned `null` — correct: the meta doc predates chunking, has
no `blobChunkCount`, and the reader takes its documented graceful-skip path rather than throwing.

**The graph had GROWN since D-05 measured it.** Live at deploy time: `nodeCount: 4011`,
`linkCount: 2664` = **6,675 rows** in the old unbounded path, against the 4,096 ceiling. D-05
measured 4001/2590 = 6,591. The defect was real and worsening.

**Backfill:**

```json
{ "blobChunkCount": 8, "linkCount": 2664, "nodeCount": 4011,
  "pages": 8, "snapshotId": "astridr-project-graph",
  "sourceVersion": 64, "status": "backfilled" }
```

8 chunks against `GRAPH_BLOB_MAX_CHUNKS = 16` — real headroom, and a NAMED status rather than a
bare success, per the contract.

**The fix, asserted on the rendered value (criterion 1), not on the absence of an error:**

```
raw length:      1,321,815 chars
nodes returned:  4011      meta nodeCount: 4011   MATCH
links returned:  2664      meta linkCount: 2664   MATCH
```

`getProjectGraph` returns the COMPLETE graph — 1.32 MB reassembled in `seq` order — from **8 chunk
reads** instead of 6,675 row reads. SWEEP-02 closed, on live data.

### Idempotence, proven live — the highest-value check here

Re-running the backfill is exactly what an operator does when unsure a run succeeded:

```json
{ "blobChunkCount": 8, "pages": 0, "sourceVersion": 65,
  "status": "alreadyChunked", ... }
```

`pages: 0` — nothing re-paged; graph re-verified intact at 4011/2664 afterwards.

**Why this matters more than it looks.** Plan 126-02 RETIRED the entity-row writes. So without the
`alreadyChunked` guard, a re-run would have found zero entity rows, proceeded with empty
accumulators, and **published an EMPTY version over the live graph** — silent destruction, no
error. That guard came from a cross-AI review finding; the phase's own tests did not catch it.

---

## What is NOT closed by this deploy

- **41 commits remain unpushed.** `origin/master` is at `5239a557`. Pushing is Larry's call.
- **`bifrost.list` performs an unbounded every-route `.collect()`** feeding the command palette —
  live, deployed, and the SAME defect class SWEEP-01 exists to remove. It belongs to another
  session's work. Phase 126 closes its own instance of that defect and not this one.
- Three other confirmed defects in that session's Bifröst work (prototype-chain icon lookup,
  middle-click telemetry gap, Windows-broken scanner) are reported and unfixed.
