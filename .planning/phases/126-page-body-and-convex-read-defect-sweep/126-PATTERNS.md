# Phase 126: Page Body and Convex Read Defect Sweep - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 11 modified + 2 created = 13
**Analogs found:** 13 / 13 (2 items — Alert Rules CSS fix, Automation parser fix — are explicitly
D-07 measure-first; their eventual FIX code has no analog because the fix isn't chosen yet. The
*measurement instrument* for both does have a strong in-repo analog, mapped below.)

All line numbers below were read directly this session (2026-08-24), not carried over from
CONTEXT.md/RESEARCH.md citations — where a citation had drifted (Todo 6's `DashboardLayout.tsx`),
the corrected number is used and the drift is noted.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/inbox.ts` (new `countHeldUnacked` query + `HELD_COUNT_SCAN_CAP`) | service/query | CRUD (count-only, bounded) | `convex/alerts.ts:109-145` `countBySeverity`/`ALERT_COUNT_SCAN_CAP` | exact — identical risk class, same file group |
| `convex/inbox.test.ts` (does not exist — CREATE) | test | request-response (unit) | `convex/alertsCountBounded.test.ts` (whole file) | exact |
| `convex/schema.ts` (new chunk table + index) | model/schema | batch (chunked blob) | `forgeLogChunks` (`schema.ts:1723-1731`) | exact — named as in-repo precedent by D-06-REVISED itself |
| `convex/graphSnapshots.ts` `upsertGraphSnapshot` (writer, gains chunk-insert) | mutation | batch/transform | its own existing chunked node/link insert loop (`:102-121`) + `convex/forge.ts` `appendLogChunk` (`:1554-1582`) | exact (in-file) / exact (cross-file) |
| `convex/graphSnapshots.ts` `getProjectGraph` (reader, rewritten) | query | CRUD (range read + rejoin) | `convex/forge.ts` `listJobLogs` (`:1584-1600`) | **SHAPE ONLY — its ordering is a COUNTER-EXAMPLE, see the warning at that section. Copy the range-read structure; do NOT copy its index choice.** |
| `convex/graphSnapshots.test.ts` (extend) | test | request-response (unit, fake-ctx) | its own `makeGraphSweepCtx` factory (`:364-446`) | exact — extend, don't replace |
| `src/layouts/DashboardLayout.tsx` `InboxCountBadge` (`:133-155`) | component | request-response (subscription) | itself (existing component, swap query) | exact |
| `src/layouts/DashboardLayout.tsx` nav separator (`:482,487`) | component | n/a (CSS) | itself | exact (drift corrected: NOT `:458/:463`) |
| `src/pages/Inbox.tsx` (`:174-185`, `:317-363`) | component/page | CRUD (derived counts) | itself (existing `counts` construction) | exact |
| `src/components/InboxFilterBar.tsx` (whole file, 71 lines) | component | request-response (props→render) | itself | exact |
| `src/pages/Automation.tsx` / `useAutomation.ts` / `convex/automation.ts` `cronSummary` | page/hook/query | CRUD (measure-first, D-07) | `convex/automation.ts`'s own sibling queries `recentCrons`/`recentHeartbeats`/`recentJobs` (all `.take(limit)`-bounded already, same file) | role-match — for the eventual bound-fix only |
| `src/lib/cronToHuman.ts` / `CronJobList.tsx` | utility/component | transform | none — no existing cron-string builder in this codebase | **no analog** |
| `src/components/AlertRulesEngine.tsx` rows (`:75,108-109,205,218-219,388`) | component | request-response (measure-first, D-07) | `radix-scrollarea-table-clips-content` lesson (memory, not code) — CSS fix TBD by measurement | **no code analog**, see below |
| `e2e/polish-geometry.spec.ts` Header three-zone block (`:207-358`, fix for Todo 7) | test | request-response (E2E wait) | `e2e/serif-trial.spec.ts:57-70` (try/throw-on-timeout, not skip) | exact |
| `e2e/polish-geometry.spec.ts` 900px sidebar/Settings collision block (`:360-459`) | test | request-response (E2E measurement instrument) | itself — reused AS the instrument for Todo 4 (Alert Rules) and re-confirming Todo 6 (sidebar) | exact — reuse, don't rewrite |

## Pattern Assignments

### `convex/inbox.ts` — new `countHeldUnacked` query (D-03/D-04)

**Analog:** `convex/alerts.ts:109-145` (`countBySeverity` / `ALERT_COUNT_SCAN_CAP`) — the
identical "runs on every route via the shell badge" risk class, already solved once in this exact
codebase (Phase 124, D-13). **Secondary analog for the truncation-boundary idiom:**
`convex/graphSnapshots.ts:252-259` (the sweep's `.take(CAP + 1)` + `length > CAP` form) — RESEARCH.md
explicitly recommends this over `alerts.ts`'s own `length === CAP` form for D-03, because D-04
requires the `truncated` flag to be strictly correct, not merely "usually correct."

**Imports pattern** (`convex/inbox.ts:14-15`, already present in the target file):
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
```

**Constant + query pattern to copy** (`convex/alerts.ts:109-131`):
```typescript
// D-13 (124-CONTEXT.md, first half): countBySeverity is about to run on EVERY
// route once the shell subscribes to it, so an unbounded `.collect()` here is
// an app-wide DoS risk, not a one-widget one. ...
const ALERT_COUNT_SCAN_CAP = 2000;

export const countBySeverity = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .order("desc")
      .take(ALERT_COUNT_SCAN_CAP);
    ...
    return { ...counts, truncated: active.length === ALERT_COUNT_SCAN_CAP };
  },
});
```

**Deviation to apply — the stronger `truncated` idiom** (`convex/graphSnapshots.ts:252-259`):
```typescript
// BOUNDED READ, never .collect(): take CAP+1 so "more remain" is visible
// from the extra row without reading the whole version.
const staleNodes = await ctx.db
  .query("graphSnapshotNodes")
  .withIndex("by_snapshot_version", (q) =>
    q.eq("snapshotId", meta.snapshotId).eq("version", versionToDelete)
  )
  .take(MAX_DELETES_PER_INVOCATION + 1);

// The extra row is the signal, not a row to delete: more nodes remain.
let moreRemain = staleNodes.length > MAX_DELETES_PER_INVOCATION;
```
For D-03: `.withIndex("by_itemType", q => q.eq("itemType", "held")).take(HELD_COUNT_SCAN_CAP + 1)`,
then `{ count: Math.min(rows.length, CAP), truncated: rows.length > CAP }`. Reuse `2000` verbatim
for `HELD_COUNT_SCAN_CAP` (same value as `ALERT_COUNT_SCAN_CAP`, ~35x headroom over the live
57-row count measured 2026-08-24). **Open question for the planner, flagged by RESEARCH.md, not
resolved here:** `listHeldUnackedHandler` (`convex/inbox.ts:206-214`) filters `ackedAt === undefined`
*after* an unbounded `.collect()`; the new count query must decide whether to apply that same filter
before or after `.take(CAP+1)` — filtering after a capped take risks undercounting if acked rows
fall inside the capped window.

**The `args: {}` idiom to preserve** (`convex/events.ts:253-260`, the WHY, not just the WHAT):
```typescript
// args: {} — NO client-supplied window. This is load-bearing, not tidiness: every
// public Convex function on this deployment is callable with no credential (CLAUDE.md,
// measured 2026-08-11)...
export const listRecentRuntimeWindow = query({
  args: {},
  handler: async (ctx) => { ... }
});
```
`countHeldUnacked` must take **no client-supplied cap** for the same reason — a caller-widenable
limit on a publicly-callable function reopens the exact DoS D-13/D-03 exist to close.

**Existing handler this query sits beside** (`convex/inbox.ts:196-219`, do not touch):
```typescript
export async function listHeldUnackedHandler(ctx: { db: InboxDb } | any) {
  const rows = await ctx.db
    .query("inbox")
    .withIndex("by_itemType", (q) => q.eq("itemType", "held"))
    .collect();
  return rows.filter((row) => row.ackedAt === undefined);
}
export const listHeldUnacked = query({ args: {}, handler: async (ctx) => listHeldUnackedHandler(ctx) });
```
`convex/inboxIngest.ts:174` (`inboxReadHeldUnacked` httpAction) calls `api.inbox.listHeldUnacked`
directly — this is the cross-repo consumer (`focus_digest.py`) D-03 must not touch.

---

### `convex/inbox.test.ts` — new file (D-03's test coverage; module has ZERO tests today)

**Analog 1 — the exact risk class, whole-file structure:** `convex/alertsCountBounded.test.ts`
(154 lines, read in full). Copy its shape: a `makeRecordingDb` that records `{table, index, bounds,
limit}` per query use (not just the returned rows), so the test can fail on a `.collect()` that
still *returns correct counts on a small table* — the exact failure mode a value-only assertion
would miss.

```typescript
// convex/alertsCountBounded.test.ts:31-70 — copy this factory shape verbatim,
// adjusted for inbox's withIndex(q => q.eq("itemType", "held")) instead of
// alerts' withIndex(q => q.eq("acknowledged", false)).
function makeRecordingDb(rows: unknown[] = []) {
  const uses: IndexUse[] = [];
  return {
    uses,
    query(table: string) {
      const use: IndexUse = { table, index: "", bounds: [], limit: null };
      const chain = {
        withIndex(index: string, cb?: (q: unknown) => unknown) { ... },
        order() { return chain; },
        async take(n: number) { use.limit = n; uses.push(use); return rows.slice(0, n); },
        async collect() { uses.push(use); return rows; }, // records limit: null — the regression
      };
      return chain;
    },
  };
}
```

**Assertions to copy** (`convex/alertsCountBounded.test.ts:88-141`):
- `use.limit` is a number, `>= 1000` (never `null` — catches a reintroduced `.collect()`).
- `truncated: true` at exactly `HELD_COUNT_SCAN_CAP` rows, `false` at `CAP - 1` (both boundary
  sides, per the "control that could have come out the other way" discipline).

**Analog 2 — boundary-crossing test discipline** (`convex/eventsWindow.test.ts:1-21`, comment
block): "Proves ... that BOTH of its bounds hold independently ... Neither assertion alone would
catch the shape this plan exists to avoid." Apply the same two-sided-bound discipline if D-03's
query ends up with more than one constraint (index `eq` + `take`).

**Analog 3 — this module's own existing test pattern for its *other* handlers**
(`convex/inboxIngest.test.ts:1-31`, already imports and directly unit-tests
`raiseHandler`/`ackHandler`/`listAllHandler`/`listHeldUnackedHandler` via the `InboxDb` interface
shape, no fake-ctx-recording needed since those don't need bound-verification). If `countHeldUnacked`
is also exported as a plain `*Handler` function (mirroring `inbox.ts`'s existing convention at
`:76,120,138,182,206,231`), `inbox.test.ts` can test it the same simple way `inboxIngest.test.ts`
tests its siblings — but the recording-db harness above is still required for the READ-BOUND
assertion specifically, since a plain `InboxDb`-shaped fake (built from arrays) cannot distinguish
a bounded `.take()` from an unbounded `.collect()` the way `makeRecordingDb` can.

---

### `convex/schema.ts` — new chunk table (D-06-REVISED)

**Analog:** `forgeLogChunks` (`convex/schema.ts:1721-1731`), read in full — the ONLY in-repo
precedent for "payload chunked across rows with a monotonic seq":
```typescript
// Append-only log chunks from Forge daemon. Lines arrive pre-scrubbed (T-3-BYPASS upstream).
// Retention enforced by sweep cron: 7-day TTL + ~1 MB per-job cap (D-2). Phase 81.
forgeLogChunks: defineTable({
  hostId:     v.string(),
  forgeJobId: v.string(),
  lines:      v.array(v.string()),    // already scrubbed by Forge (T-3-BYPASS upstream)
  seq:        v.number(),             // D-1: monotonic per (host,job) — ordering + dedup (REQUIRED)
  sentAt:     v.optional(v.string()), // client flush time (ISO)
})
  .index("by_host_job",     ["hostId", "forgeJobId"])          // listJobLogs / retention sweep
  .index("by_host_job_seq", ["hostId", "forgeJobId", "seq"]),  // D-1 idempotency unique-check
```

**Adaptation for the graph blob:** key by `(snapshotId, version, seq)` instead of `(hostId,
forgeJobId, seq)` — `graphSnapshots`/`graphSnapshotNodes`/`graphSnapshotLinks` already use
`snapshotId` + `version` as their compound key (`schema.ts:1897-1899,1942-1950`), so the new table
should match that existing convention rather than inventing a third naming scheme in the same file.
Two indexes, same division of labor as `forgeLogChunks`: a `["snapshotId","version"]` index for the
bulk read (mirrors `by_host_job`/`by_snapshot_version`) and a `["snapshotId","version","seq"]`
index if ordered/unique-per-seq lookups are needed (mirrors `by_host_job_seq`). The payload field
should hold a `v.string()` chunk of the serialized `{nodes,links}` JSON (not `v.array(v.string())`
— `forgeLogChunks.lines` is an array because Forge sends line-delimited text; this blob is one
continuous JSON string sliced by byte/char offset, so a single `v.string()` per row is the right
shape, sized under the 1 MiB per-document ceiling with headroom, per D-06-REVISED's binding text).

**Existing table headers in the same file to match style with** (`convex/schema.ts:1894-1950`):
```typescript
// Phase 83, GH-01: Graph Snapshot tables...
// One meta row per snapshotId. Holds the activeVersion pointer and aggregate counts.
graphSnapshots: defineTable({ ... }),
// Entity rows for graph nodes, keyed by (snapshotId, version).
graphSnapshotNodes: defineTable({ ... }).index("by_snapshot_version", ["snapshotId", "version"]),
```

---

### `convex/graphSnapshots.ts` — writer (`upsertGraphSnapshot`, D-06-REVISED)

**Analog 1 (in-file, closest):** the function's OWN existing chunked-insert loop
(`convex/graphSnapshots.ts:102-121`) — this file already knows how to insert N rows in bounded
batches with a shared version key; the new blob-chunk insert is the same shape applied to string
slices instead of node/link objects:
```typescript
// 5. Insert graphSnapshotNodes rows in chunks of 1,000 (defensive headroom).
const CHUNK = 1000;
for (let i = 0; i < args.nodes.length; i += CHUNK) {
  const batch = args.nodes.slice(i, i + CHUNK);
  for (const node of batch) {
    await ctx.db.insert("graphSnapshotNodes", {
      snapshotId: args.snapshotId,
      version:    newVersion,
      nodeId:     node.id,
      ...
    });
  }
}
```

**Analog 2 (cross-file, seq-chunk precedent):** `convex/forge.ts:1554-1582` (`appendLogChunk`) —
shows the idempotent-insert-with-seq idiom the new writer should mirror for the blob chunks
(though the graph writer serializes+splits in ONE mutation call rather than receiving pre-chunked
input over HTTP, so the idempotency check itself doesn't port — only the insert shape does):
```typescript
export const appendLogChunk = internalMutation({
  args: { hostId: v.string(), forgeJobId: v.string(), lines: v.array(v.string()), seq: v.number(), sentAt: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("forgeLogChunks")
      .withIndex("by_host_job_seq", (q) => q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("seq", args.seq))
      .unique();
    if (existing) return;
    await ctx.db.insert("forgeLogChunks", { hostId: args.hostId, forgeJobId: args.forgeJobId, lines: args.lines, seq: args.seq, sentAt: args.sentAt });
  },
});
```

**Binding constraints from D-06-REVISED (not optional, not this pattern-mapper's discretion):**
serialize `{nodes, links}` ONCE, split the string into N chunks each under the 1 MiB per-row
ceiling with headroom, monotonic `seq` per chunk, and — mirroring this SAME file's existing
pointer-last write-ordering discipline (`upsertGraphSnapshot`'s own doc comment, step 7: "patch-or-
insert graphSnapshots meta doc with activeVersion = newVersion" LAST) — the new chunk rows must be
fully inserted for the new version BEFORE the meta doc's pointer flips, and the PRIOR version's
chunk rows must be deleted (mirroring `sweepGraphSnapshotVersions`'s bounded-delete idiom at
`:252-294`, not a raw `.collect()`-then-delete-all).

---

### `convex/graphSnapshots.ts` — reader (`getProjectGraph`, D-06-REVISED)

**Analog:** `convex/forge.ts:1584-1600` (`listJobLogs`) — the closest in-repo shape for "read a
bounded, ordered set of chunk rows via ONE indexed query and hand back something the caller
reassembles":

> **⚠ COUNTER-EXAMPLE WARNING — do NOT copy this reader's index choice.** The block below is quoted
> for its STRUCTURE (one indexed range read, bounded, oldest-first). Its ORDERING is not safe to
> reuse for a blob.
>
> Verified from the installed package (`node_modules/convex/dist/cjs-types/server/query.d.ts:12-14,37`):
> `withIndex` iterates "over an index range **in index order**" and "Results will be returned in
> index order." **The ordering guarantee therefore comes from `seq` being IN THE INDEX — not from
> `.order("asc")`.**
>
> `listJobLogs` queries `by_host_job` = `["hostId","forgeJobId"]` (`convex/schema.ts:1730`), which
> does **not** contain `seq`. After the equality prefix, index order falls back to the implicit
> `_creationTime` — so its chunks come back in insertion-time order, not `seq` order.
> `by_host_job_seq` exists but is used at exactly ONE site, `convex/forge.ts:1567`, for the D-1
> idempotency unique-check, which is what `convex/schema.ts:1731`'s own comment says.
>
> **The live trap:** `by_snapshot_version` = `["snapshotId","version"]` ALREADY EXISTS on the
> entity tables. Reusing it for chunk rows and applying `.order("asc")` reproduces exactly this
> bug — `_creationTime` order — and for a JSON blob that is silent corruption, surfacing as a
> `JSON.parse` throw or a truncated graph rather than a missing-data error. **The new chunk table
> MUST be read through an index whose trailing field is `seq`** (e.g.
> `by_snapshot_version_seq` = `["snapshotId","version","seq"]`).
>
> Do not let `convex/forgeLogIngest.test.ts:389` reassure you — it is a COMMENT asserting "Chunks
> ordered by seq ascending (oldest first) — as returned by listJobLogs", a property `listJobLogs`
> does not guarantee. It is a claim, not evidence.

```typescript
export const listJobLogs = query({
  args: { hostId: v.string(), forgeJobId: v.string() },
  handler: async (ctx, args) => {
    // Oldest chunk first — terminal display reads top-to-bottom.
    return await ctx.db
      .query("forgeLogChunks")
      .withIndex("by_host_job", (q) => q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId))
      .order("asc")
      .take(LOG_CHUNK_LIMIT);
  },
});
```
(Note: `listJobLogs` returns the raw chunk docs and lets the CALLER concatenate `lines` arrays —
by contrast, `getProjectGraph` must do the rejoin itself server-side, since it currently returns a
parsed `{nodes, links}` shape and `useProjectGraph.ts` is NOT to gain new client-side logic per
D-06-REVISED's binding text.)

**Existing reader being replaced, for the shape of what stays the same** (`convex/graphSnapshots.ts:416-462`):
```typescript
export const getProjectGraph = query({
  args: { snapshotId: v.optional(v.string()) },
  handler: async (ctx, { snapshotId = "astridr-project-graph" }) => {
    const meta = await ctx.db.query("graphSnapshots").withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId)).unique();
    if (!meta) return null;  // graceful-skip: no data yet — PRESERVE this
    // REPLACE the two .collect()s below with ONE indexed range query over the new chunk table:
    const nodes = await ctx.db.query("graphSnapshotNodes").withIndex("by_snapshot_version", (q) => q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)).collect();
    const links = await ctx.db.query("graphSnapshotLinks").withIndex("by_snapshot_version", (q) => q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)).collect();
    return { snapshotId: meta.snapshotId, sources: meta.sources, nodeCount: meta.nodeCount, linkCount: meta.linkCount, ..., nodes: nodes.map(...), links: links.map(...) };
  },
});
```
Preserve: the `snapshotId` default arg, the `meta` lookup + graceful-skip-null, and the return
shape's field names (`nodeCount`, `linkCount`, `sources`, `generatedAt`, `nodes`, `links`) —
`src/hooks/useProjectGraph.ts` and its consumers are NOT in scope and must see an unchanged
contract. Replace only the two `.collect()` calls with ONE indexed range read over the new chunk table
keyed to `meta.activeVersion`, then `JSON.parse(chunks.map(c => c.chunk).join(""))` to rejoin.

**Name the index explicitly and make its trailing field `seq`** — e.g.
`.withIndex("by_snapshot_version_seq", q => q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion))`
over an index defined as `["snapshotId", "version", "seq"]`. `seq` ordering is a property of the
INDEX, not of `.order("asc")` (see the counter-example warning above). **Do NOT reuse the existing
`by_snapshot_version` index for the chunk rows** — it lacks `seq` and would order by
`_creationTime`. Bound the read with `.take(CAP + 1)` so "more chunks remain" is visible rather
than silent, matching `graphSnapshots.ts:252-259`'s in-file idiom, and treat an over-cap result as
an error rather than rejoining a partial blob — a truncated blob is corrupt, not merely
incomplete.

---

### `convex/graphSnapshots.test.ts` — extend (D-06-REVISED verification)

**Analog:** the file's OWN existing `makeGraphSweepCtx` factory (`:364-446`) — a fake `ctx.db`
that RECORDS every read via a closure-scoped `rowsRead` counter, returned as `readCount()`:
```typescript
function makeGraphSweepCtx(opts: { metas: any[]; nodesByVersion?: ...; linksByVersion?: ... }) {
  let rowsRead = 0;
  const ctx: any = {
    db: {
      query: (table: string) => ({
        collect: async () => { ...; rowsRead += metas.length; return metas; },
        withIndex: (_name: string, fn: any) => {
          ...
          return {
            take: async (n: number) => { const rows = ...; rowsRead += rows.length; return rows; },
            collect: async () => { throw new Error(`REGRESSION: unbounded .collect() on ${table}`); },
          };
        },
      }),
      delete: async (id: string) => { ...; rowsRead += 1; ... },
    },
  };
  return { ctx, patches, deleted, warnings, metas, restore, readCount: () => rowsRead };
}
```
**Do not invent a new harness.** Add a sibling factory (or extend this one) modelling the new
chunk table, and write three tests per RESEARCH.md's "Validation Architecture" section, each with a
FAILING control:
1. **Round-trip fidelity** — seed N chunks, rejoin, `expect(parsed).toEqual(original)`; corrupt one
   chunk (drop a char) and assert the rejoin throws or mismatches.
2. **Read cost** — `expect(h.readCount()).toBeLessThan(10)` (roughly the chunk count) where the OLD
   code would have read 6,591; assert this against a fixture sized like the real 4,001/2,590 data,
   not a 3-row toy fixture that would pass even against the unbounded `.collect()`.
3. **Ordering** — seed chunks out of `seq` order or with a gap; assert the reassembly either
   reorders correctly (if the read applies `.order("asc")`) or FAILS LOUDLY on a gap (never silently
   returns corrupt JSON).

---

### `src/layouts/DashboardLayout.tsx` — `InboxCountBadge` (D-03 wiring)

**Analog:** itself — this is a query swap inside an existing 23-line component, not a new pattern.

**Current code** (`:133-155`):
```typescript
function InboxCountBadge() {
  // D-10 (amended 2026-08-21): listHeldUnacked — not the per-profile inbox
  // read (needs a profileId the shell doesn't have) or listAll (caps at 200
  // against 2,777 live rows). Counts unacked `held` rows only — 46 live at
  // planning time.
  const held = useQuery(api.inbox.listHeldUnacked);
  if (held == null) return null;
  const count = held.length;
  if (count === 0) return null; // D-12 state 3: never a visible zero
  return (
    <Badge className={cn("rounded-sm px-1.5 py-0", BADGE_DATA_TYPE, "bg-(--surface-3) text-(--foreground) border border-(--hairline)")} aria-label={`${count} unread in Inbox`}>
      ...
```
**Change:** swap `useQuery(api.inbox.listHeldUnacked)` for `useQuery(api.inbox.countHeldUnacked)`;
`count`/`truncated` come directly off the returned `{count, truncated}` object instead of
`held.length`. Preserve the `== null` (unresolved) and `count === 0` (never-visible-zero) guards
unchanged — those are D-12's existing states, untouched by D-03/D-04.

**Sidebar separator (Todo 6, unrelated fix in the same file)** — confirmed current location
`DashboardLayout.tsx:482,487` (NOT `:458/:463` as the stale todo citation says):
```typescript
<nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Main navigation">
  {navGroups.map((grp, i) => {
    ...
    {i > 0 && <Separator className="my-2 mx-3" />}
```
No code analog needed — todo's own remedy (drop `mx-3`, pad the wrapper instead, or add `w-auto`)
is a one-class CSS edit against code already fully read.

---

### `src/pages/Inbox.tsx` + `src/components/InboxFilterBar.tsx` (D-01/D-02)

**Analog:** itself — extend the existing `counts` construction and pass-through to
`InboxFilterBar`, do not invent a new data path.

**Existing query + counts derivation to extend** (`Inbox.tsx:184-185`, `:320-363`):
```typescript
const inboxRecords = (useQuery(api.inbox.listAll, {}) ?? []) as unknown as InboxRowDoc[];
...
const inboxItems = inboxRecords.map(inboxRowToInboxItem);
const cardItems = inboxItems.filter((i) => i.type === "card");
const heldItems = inboxItems.filter((i) => i.type === "held");
...
const unreadHeld = heldItems.filter((i) => !i.read).length;
const counts: Record<InboxFilter, number> = { all: ..., held: unreadHeld, ... };
```
**Add** (per D-02, RESEARCH.md's confirmed shape): `const heldUnacked =
useQuery(api.inbox.listHeldUnacked);` — the SAME query `DashboardLayout.tsx` subscribes to, so
Convex's reference-counted subscription dedup means this costs zero new server reads (cite this
mechanism explicitly in the plan per RESEARCH.md's own recommendation, so a reviewer doesn't
mistake it for a new query). Use `heldUnacked?.length` as the Held tab's true "of M" denominator.
For the OTHER tabs (no free true count), derive a generic truncation flag from
`inboxRecords.length === DEFAULT_LIST_ALL_LIMIT` (the existing `listAll` cap, imported or mirrored
from `convex/inbox.ts:173`).

**`InboxFilterBar` render loop to extend** (`InboxFilterBar.tsx:41-70`, whole file read):
```typescript
export function InboxFilterBar({ filter, counts, onChange }: InboxFilterBarProps) {
  return (
    <div className="flex items-center gap-1 px-4 border-b border-(--border) shrink-0">
      {TABS.map((tab) => {
        const isActive = filter === tab.id;
        const count = counts[tab.id] ?? 0;
        return (
          <button key={tab.id} className={...} onClick={() => onChange(tab.id)}>
            {tab.label}
            {count > 0 && <span className="ml-1.5 text-sm bg-(--muted) ...">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
```
**Change:** the component needs a new prop carrying per-tab truncation info (exact shape/wording is
Claude's Discretion per CONTEXT.md — e.g. `totals?: Partial<Record<InboxFilter, {of: number} |
{genericTruncated: true}>>`), rendered as either a "9 of 46" suffix (Held) or a generic marker
(other tabs, only when their own truncation flag is true). Keep the existing `count > 0 &&` badge
render as the base case; the truncation marker is additive, not a replacement.

---

### `src/pages/Automation.tsx` / `convex/automation.ts` (Todo 5, D-07 measure-first)

**No fix analog — D-07 forbids writing one before measurement.** The one useful IN-FILE analog for
whichever remedy the measurement task lands on: `convex/automation.ts`'s own sibling queries
already use the bounded shape `cronSummary` lacks:
```typescript
// recentCrons, recentHeartbeats, recentJobs (all in this same file) — already bounded:
return await ctx.db.query("cronExecutions").withIndex("by_jobName", ...).order("desc").take(args.limit ?? 10);
```
against `cronSummary`'s own unbounded shape (`convex/automation.ts:135-157`):
```typescript
export const cronSummary = query({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() / 1000 - 3600;
    const recent = await ctx.db
      .query("cronExecutions")
      .withIndex("by_timestamp")
      .filter((q) => q.gte(q.field("timestamp"), oneHourAgo))
      .collect();   // <-- unbounded, no range passed to withIndex itself
    ...
  },
});
```
If the measurement task confirms this `.collect()` is the cause, the fix is `.withIndex("by_timestamp",
q => q.gte("timestamp", oneHourAgo))` (an actual range bound, not a post-scan `.filter()`) plus a
`.take()` cap — the same "index bound + hard take + truncated flag" idiom used everywhere else in
this phase (`alerts.ts`/`events.ts`/`graphSnapshots.ts` above). **This is NOT a locked fix** — flag
it to the planner as the candidate, not the answer.

**Parser mismatch (statically traceable, not measurement-gated per RESEARCH.md's own carve-out):**
`src/lib/cronToHuman.ts:13-15` expects a 5-field cron string; `CronSchedule.interval`
(`src/lib/cronSchedules.ts:1-8`) is a human-readable label like `"Every 5 min"`, never a real cron
expression. **No analog exists in this codebase for a real cron-string builder** — `CronSchedule`
already carries `intervalSeconds` and an optional `dailyUTC: {hour, minute}` (`cronSchedules.ts:7`),
which is enough to construct a genuine 5-field string for the `dailyUTC` rows at least; there is no
existing helper to copy for the interval-only rows (they have no minute/hour granularity to render
as cron fields). Flag as **no analog — new logic**, not a copy-from-elsewhere task.

---

### `src/components/AlertRulesEngine.tsx` (Todo 4, D-07 measure-first)

**No fix analog — D-07 measure-first.** Current row markup, confirmed unchanged from the todo's
citation (`:75-110`, `:388`):
```typescript
<div className={`group relative flex items-center gap-4 px-5 py-4 border-b border-primary/10 ... overflow-hidden ${...}`}>
  ...
  <div className="flex-1 min-w-0 relative z-10 flex flex-col pr-4 border-r border-primary/10">
    <span className="text-base text-white font-medium tracking-wide truncate">{rule.name}</span>
    <p className="text-sm text-muted-foreground truncate mt-0.5">{rule.condition}</p>
  </div>
  ...
</div>
...
<div className="flex flex-col max-h-[500px] overflow-y-auto bg-background/30 custom-scrollbar">
```
The todo's own hypothesis (Radix ScrollArea `display:table`-viewport clipping) has a NAMED memory
precedent in this repo (`radix-scrollarea-table-clips-content`, Phase 123) but `:388`'s
`overflow-y-auto` container is a plain div, not confirmed to wrap a Radix primitive — that
confirmation is exactly what the measurement task must do. No code fix to map until it does.

---

### `e2e/polish-geometry.spec.ts` — Todo 7 (cold-page evidence defect)

**Analog:** `e2e/serif-trial.spec.ts:57-70` — fail-don't-skip wait on real rendered content:
```typescript
try {
  await expect(voiceLocator.first()).toBeVisible({ timeout: 15000 });
} catch {
  throw new Error(
    'SERIF-TRIAL FAILED: no .briefing-voice element appeared on /briefings within 15s -- ' +
      'the trial cannot be run against an empty feed. This is a failure, not a skip.',
  );
}
```
**Target being fixed** — the Header three-zone block (`e2e/polish-geometry.spec.ts:207-217`):
```typescript
test(`${width}px — header zone min-content vs available width`, async ({ page }) => {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  const header = page.locator('header').first();
  await gateOrSkip(page, header, `the ${width}px header-zones measurement`);
  await expect(header).toBeVisible();
  const evidence = await header.evaluate((headerEl, w) => { /* measures min-content of 3 zones */ }, width);
```
**Change:** insert a `toBeVisible({timeout: 15000})` wait (mirroring `serif-trial.spec.ts`'s
try/throw, NOT `gateOrSkip`'s skip-on-timeout) on `SystemChip`/`BrainHeaderBadge`'s actual rendered
output — RESEARCH.md flags that neither component was confirmed to carry a `data-testid`; the
implementer must add one or find an existing stable selector before this wait can be written. Place
the new wait between `gateOrSkip(...)` and the `header.evaluate(...)` call, so the cold-page race
(measuring before the async Convex-subscribed children resolve) cannot recur. `gateOrSkip` itself
(`:74-83`) stays unchanged — that gate is for the Clerk auth screen, a different concern from this
component-resolution race.

---

### `e2e/polish-geometry.spec.ts` — reuse as instrument for Todo 4 / Todo 6

**Analog to REUSE, not rewrite:** the "900px sidebar/Settings collision" block (`:360-459`), the
in-repo template for "measure real rendered geometry, log it as one JSON line, assert on the
measured relationship":
```typescript
const culprits: OverflowCulprit[] = [];
document.querySelectorAll('body *').forEach((node) => {
  const el = node as HTMLElement;
  if (el.classList.contains('sr-only')) return; // deliberately hidden, not a collision
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return; // not actually rendered/visible
  const scrollOverflow = el.scrollWidth - el.clientWidth;
  const rightOverflow = rect.right - innerWidth;
  if (rightOverflow > 1) {
    culprits.push({ tag: el.tagName, className: ..., scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, right: rect.right, overflowAmount: Math.max(scrollOverflow, rightOverflow) });
  }
});
```
```typescript
console.log(`SETTINGS-900-EVIDENCE ${JSON.stringify(evidence)}`);
expect(evidence.culprits.length, `culprit list must be empty; found: ${JSON.stringify(evidence.culprits)}`).toBe(0);
```
**For Todo 4 (Alert Rules measurement task):** adapt this walker scoped to
`AlertRulesEngine`'s row container (`:75`/`:205`) instead of `body *`, measuring row-to-row pitch
and the two text children's rects per RESEARCH.md's Q4 recommendation, with the SAME `sr-only`
exclusion and `rightOverflow`-vs-`scrollOverflow` distinction (the distinction the file itself
learned to make live, per its own `:399-411` comment — don't rediscover it, cite it).
**For Todo 6:** this same walker, run against the sidebar, is the confirmation instrument that the
`mx-3`/`w-full` fix actually removed the 4px overhang — reuse, do not write a second one.

---

## Shared Patterns

### No-silent-caps: bounded read + `truncated` flag
**Source:** `convex/alerts.ts:109-145`, `convex/events.ts:246-286`, `convex/graphSnapshots.ts:252-259`
**Apply to:** `convex/inbox.ts`'s new `countHeldUnacked`, and (candidate, D-07-gated) `convex/automation.ts`'s `cronSummary`
```typescript
const CAP = 2000; // module constant, never a client-supplied arg
export const someQuery = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query(TABLE).withIndex(IDX, (q) => q.eq(FIELD, VALUE)).take(CAP + 1);
    return { ...derive(rows.slice(0, CAP)), truncated: rows.length > CAP };
  },
});
```

### Chunked-row payload split across N docs with monotonic `seq`
**Source:** `forgeLogChunks` (`convex/schema.ts:1721-1731`), `convex/forge.ts:1554-1600`
**Apply to:** the new graph-blob chunk table + `graphSnapshots.ts` writer/reader (D-06-REVISED)

### Fake-`ctx` with a read counter, not just a value-return mock
**Source:** `convex/graphSnapshots.test.ts:364-446` (`readCount()`), `convex/alertsCountBounded.test.ts:31-70` (`uses[]` recording index/bounds/limit)
**Apply to:** `convex/inbox.test.ts` (new), `convex/graphSnapshots.test.ts` extension — any test
whose whole POINT is proving a bound was applied must assert on the recorded QUERY SHAPE, not only
the returned VALUE, because a surviving `.collect()` returns correct values on a small fixture too.

### Measure real DOM geometry, log one JSON line, assert the relationship
**Source:** `e2e/polish-geometry.spec.ts:360-459` (900px collision walker), `:207-358` (header zones)
**Apply to:** Todo 4 (Alert Rules), Todo 6 (sidebar confirmation) — never infer geometry from class
names; always `getBoundingClientRect()`/`scrollWidth`/`clientWidth` on the real rendered page.

### Wait on real rendered content, fail-don't-skip on timeout
**Source:** `e2e/serif-trial.spec.ts:57-70`
**Apply to:** `e2e/polish-geometry.spec.ts`'s Header three-zone block (Todo 7) — a bare
`page.waitForTimeout` or an absent wait races the async Convex subscription; `toBeVisible({timeout})`
inside a `try/throw` (not `test.skip`) is this repo's established fix for exactly this defect class.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/cronToHuman.ts` (real cron-string construction, if the measurement task confirms this as part of the fix) | utility | transform | No existing cron-string builder in this codebase — `CronSchedule` carries `intervalSeconds`/`dailyUTC` but nothing yet turns those into a 5-field cron expression. New logic, not a copy. |
| `src/components/AlertRulesEngine.tsx` (the eventual CSS/layout fix) | component | request-response | D-07 measure-first — the fix is unknown until the measurement task runs; only the *instrument* (polish-geometry.spec.ts's walker) has an analog, not the fix itself. |

## Metadata

**Analog search scope:** `convex/*.ts` (inbox, alerts, events, graphSnapshots, automation, forge,
forgeLogIngest, inboxIngest + their `.test.ts` siblings), `convex/schema.ts`,
`src/layouts/DashboardLayout.tsx`, `src/pages/Inbox.tsx`, `src/pages/Automation.tsx`,
`src/hooks/useAutomation.ts`, `src/lib/cronToHuman.ts`, `src/lib/cronSchedules.ts`,
`src/components/InboxFilterBar.tsx`, `src/components/AlertRulesEngine.tsx`,
`src/components/CronJobList.tsx`, `e2e/polish-geometry.spec.ts`, `e2e/serif-trial.spec.ts`.
**Files scanned:** 22 read directly this session, all excerpts above quoted from live reads (no
citation taken on faith from CONTEXT.md/RESEARCH.md without re-confirming the line numbers).
**Pattern extraction date:** 2026-08-24
