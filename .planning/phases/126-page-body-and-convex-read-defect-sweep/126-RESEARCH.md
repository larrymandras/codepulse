# Phase 126: Page Body and Convex Read Defect Sweep - Research

**Researched:** 2026-08-24
**Domain:** Convex read-ceiling remediation (bounded reads, blob/file storage) + frontend live-DOM
measurement scaffolding + Playwright evidence-defect fix
**Confidence:** HIGH on Q1's byte-size/API findings (measured against real repo data + official
Convex API docs), HIGH on Q2/Q3/Q6/Q7 (measured or directly read from source), MEDIUM on Q4/Q5
(mechanical facts are HIGH-confidence; root cause is deliberately NOT established, per D-07)

> ## ⚠ SUPERSEDED IN PART — READ THIS FIRST (added by the orchestrator, 2026-08-24)
>
> This research was written BEFORE the D-06 mechanism was settled. Its **evidence stands and its
> recommendation does not.** Larry chose neither mechanism this file weighs.
>
> **BINDING: `126-CONTEXT.md` § D-06-REVISED.** The graph blob is **serialized once and split
> across N ROWS carrying a monotonic `seq`, read back by ONE indexed range query and rejoined.**
> `getProjectGraph` STAYS a `query`; `src/hooks/useProjectGraph.ts` stays a reactive `useQuery`
> passthrough and is NOT to grow a `fetch()` stage. In-repo precedent: `forgeLogChunks`
> (`convex/schema.ts:1723-1731`).
>
> **Both mechanisms recommended below are REJECTED:** a single document field (measured at
> 99-101% of the 1 MiB ceiling — the two repos alone are 769 KB of 1024 KB, leaving the vault
> 129 B/element to fit at all) and Convex file storage (unreadable from a `query`; would move the
> write into the httpAction and change the subscription model).
>
> Every file-storage implementation instruction still present in this file — the "Primary
> recommendation" below, the 6-step shape in the `tool-galaxy` section, the schema-change row, and
> the planner recommendation — is **obsolete**. The file-storage API analysis is retained because
> it is the EVIDENCE that rejected that option, not a design to follow.

## Summary

Seven todos, three Convex-side sharing one operator deploy, four frontend/test-side. The highest-
leverage finding is on `/tool-galaxy` (D-05/D-06): the precomputed-blob remedy D-06 locked in has
**two decisive sub-findings that change what "read one row" means in practice**. First, a
weighted, measured estimate of the real graph's serialized size (~1.03 MB combined) sits at
essentially the edge of Convex's 1 MiB document-size ceiling — not "comfortably under" as D-06's
own text hoped to confirm. Second, and more consequential: Convex's `query` functions cannot call
`ctx.storage.get()` to read file-storage byte content — only `getUrl()`/`getMetadata()` — so if
the blob is stored as a file (the safer choice given the first finding), `getProjectGraph` must
become a URL-returning query and the frontend must add a plain `fetch()` step outside Convex's
reactive subscription. **Both findings together invalidated D-06's "single row" wording** — see
D-06-REVISED; the orchestrator re-measured and the single-document option lands at 99-101% of the
1 MiB ceiling, so neither mechanism this file weighs survived.

**Primary recommendation — SUPERSEDED, retained only to show what was rejected.** ~~use Convex
file storage for the graph blob, written from the `runtime-ingest` httpAction, with
`getProjectGraph` reduced to a cheap URL+metadata query and `useProjectGraph.ts` gaining a
`fetch()` stage.~~ **The binding design is chunked rows + one indexed range query (D-06-REVISED),
which keeps `getProjectGraph` a `query` and `useProjectGraph.ts` unchanged.** Reuse `ALERT_COUNT_SCAN_CAP`'s value (`2000`) verbatim for D-03's new
held-count query. Copy `listRecentRuntimeWindow`'s shape for D-03 but use the stronger
`take(CAP+1)` truncation check already established in `graphSnapshots.ts`'s sweep, not
`listRecentRuntimeWindow`'s simpler `length === MAX_ROWS` check.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/inbox`'s tab counts declare their cap rather than pretending to be totals. `listAll`
  stays bounded; the page surfaces that it is truncated. Rejected: per-tab filtered count queries;
  raising `DEFAULT_LIST_ALL_LIMIT`.
- **D-02:** The Held tab shows a precise "N of M"; other tabs get a generic truncation marker.
  Held's true count already exists in the client for free via the shell's `listHeldUnacked`
  subscription (`DashboardLayout.tsx:138`). Rejected: uniform generic marker for every tab; a
  single notice with no per-tab marks.
- **D-03:** Add a COUNT-ONLY query returning `{count, truncated}`, index-scoped on `by_itemType`
  with a hard `.take()` cap. Do NOT touch `listHeldUnacked`. Rejected: a separate bounded row
  query; bounding the shared query and paginating the server consumer.
- **D-04:** The badge's count must remain TRUE, not merely bounded — its `truncated` flag is what
  D-02's display consumes. Pick the cap high enough that `truncated` is false in normal operation.
- **D-05:** The `/tool-galaxy` failure is a READ-CEILING breach, not a slow query. Measured live
  2026-08-24: `nodeCount: 4001`, `linkCount: 2590` — 6,591 rows read against Convex's 4,096-read
  ceiling. `getProjectGraph` performs two unbounded `.collect()`s on `by_snapshot_version`.
- **D-06 — AMENDED BY D-06-REVISED (2026-08-24). Read D-06-REVISED in `126-CONTEXT.md` as the
  binding text; the "single row" wording below is WITHDRAWN and both mechanisms it names are
  REJECTED in favour of N chunk rows read by one indexed query.**
  Remedy is a PRECOMPUTED BLOB read in a single row. The writer (already an
  `internalMutation`) serializes the graph into one document or Convex file storage;
  `getProjectGraph` reads one row. Rejected: splitting into two queries (works today but leaves
  only 95 rows of node headroom); a `.take()` cap (renders an incomplete, misleadingly-partial
  graph); lowering the upstream 1,500-per-source emit cap (degrades every consumer).
- **Note for planner:** the stored snapshot is already truncated upstream (graphify emitted 71,016
  nodes for astridr-repo, 1,500 stored). Whatever the remedy, the graph on screen is a sample.
- **D-07:** `/automation` and the Alert Rules row-overlap get a MEASURE-FIRST task inside their own
  plan. Each plan opens with a task whose acceptance criteria are the measurement itself, not a
  fix; the fix task is written against what it found.
- **D-08:** The un-diagnosed list is TWO, not three (`/tool-galaxy` was root-caused as D-05).
  Remaining hypotheses: `/automation` placeholder cards + invalid expressions, and Alert Rules
  rows overlapping.

### Claude's Discretion

- Exact wording/placement of the truncation markers (D-01/D-02) — presentation detail.
- The specific cap value for D-03's count query — for research/planning to determine against real
  row sizes. **This research answers it** (see the `inbox` section below).
- ~~the blob's storage mechanism under D-06 (document field vs Convex file storage)~~ **NO LONGER
  DISCRETIONARY** — settled by D-06-REVISED as chunked rows + one indexed query. Remaining
  discretion is the chunk-size constant and the keep-or-retire call on the entity row tables.

### Deferred Ideas (OUT OF SCOPE)

- The other nine pending todos (not folded into Phase 126; ROADMAP fixes scope at exactly seven).
- `gsd-sdk query todo.match-phase 126` returned all 16 pending todos at an identical, signal-free
  score — not used for scoping.
- `/tool-galaxy`'s graph being a SAMPLE (1,500 of 71,016 nodes for astridr-repo) is out of scope;
  whether a sampled graph is worth rendering at all is a later-phase product question.
</user_constraints>

## Phase Requirement IDs

**Not yet assigned.** CONTEXT.md and ROADMAP.md do not carry `REQ-ID`s for this phase — the
orchestrator's brief confirms these are "TBD — to be derived at planning time from the seven
todos." Do not invent IDs here; the planner should mint them (e.g. `DEFECT-01`..`DEFECT-07` or
similar) when it writes PLAN.md, one per todo, and record the mapping in REQUIREMENTS.md at that
time.

---

## Todo 1 — `inbox-listheldunacked-unbounded-every-route.md` (Convex, root-caused)

### What must change
`convex/inbox.ts:206-214` (`listHeldUnackedHandler`) stays exactly as-is — `convex/inboxIngest.ts:174`
calls it via `ctx.runQuery` to feed `focus_digest.py`, which needs the true unbounded set
`[VERIFIED: convex/inbox.ts:206-214, convex/inboxIngest.ts:174 both read directly]`. A **new**,
separate bounded query is added instead, mirroring `alerts.ts`'s `countBySeverity`.

### Q2 — cap value for the new count-only query

**Live measurement, this session (2026-08-24), read-only query, `npx convex run
inbox:listHeldUnacked '{}' --env-file selfhosted.envfile`, piped through a count-only script (no
row content printed):**

```
count: 57
```

CONTEXT.md recorded **46** at planning time earlier the same day (2026-08-21's original todo also
said 46; CONTEXT.md's D-10 also measured 46). So the live count grew from 46 to 57 within part of
one day. **I am not extrapolating a daily rate from this** — a 2-point sample over a few hours
cannot distinguish steady growth from a burst, and asserting a rate would be exactly the kind of
unverified claim CLAUDE.md's evidence-discipline rule forbids. What is solid: the count is
double-digit and growing, not static.

**Precedent in this exact codebase, same risk class:** `convex/alerts.ts:122`
`ALERT_COUNT_SCAN_CAP = 2000`, justified at `alerts.ts:109-121` against a live measurement of
1 unacknowledged / 102 total alert rows (~20x headroom over the whole table, reasoned as "exists
for the future alert-storm case, not a live one").

**Recommendation:** reuse `2000` verbatim (e.g. `HELD_COUNT_SCAN_CAP = 2000`) rather than invent a
new number:
- ~35x headroom over the current 57-row live count.
- Index-scoped on the existing `by_itemType` index (`schema.ts:2121`, `["itemType", "createdAt"]`
  — same index `listHeldUnackedHandler` already uses), so `.take(2000)` costs at most ~2,000
  reads, well under the 4,096-read ceiling (~49% of budget) — same order of magnitude as
  `ALERT_COUNT_SCAN_CAP`'s own cost.
- Reuses a value this codebase has already reviewed and accepted for the identical "every-route
  badge, needs a truncated flag" shape, rather than introducing a second magic number for
  reviewers to reconcile.
- **No schema change required** — `by_itemType` already exists.

### Q3 — the reference implementation to copy, and where to deviate from it

CONTEXT.md points at `convex/events.ts:259-286` (`listRecentRuntimeWindow`, Phase 125 plan 02).
Read in full; the shape is:

```ts
const WINDOW_SEC = 60;
const MAX_ROWS = 500;

export const listRecentRuntimeWindow = query({
  args: {},                                    // no client-supplied window — load-bearing
  handler: async (ctx) => {
    const nowSec = Date.now() / 1000;
    const lo = nowSec - WINDOW_SEC;
    const rows = await ctx.db
      .query("runtime_events")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", lo).lte("timestamp", nowSec))
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(MAX_ROWS);
    return {
      rows: rows.map((r) => ({ _id: r._id, eventType: r.eventType, timestamp: r.timestamp })),
      truncated: rows.length === MAX_ROWS,       // <-- see deviation below
    };
  },
});
```

Idiom to copy for D-03: a module-level constant cap, `args: {}` (no client-widenable window — its
own comment at `events.ts:253-258` explains why: every public Convex function here is callable
with no credential), and a returned `truncated` boolean.

**Where to deviate — the `truncated` computation.** `listRecentRuntimeWindow` uses
`rows.length === MAX_ROWS` on a plain `.take(MAX_ROWS)`. This works safely there because the query
is *also* time-window-bound (`gte`/`lte` on `by_timestamp`) — hitting exactly `MAX_ROWS` within a
fixed 60s window and having *exactly* zero more rows outside the cap is a coincidence the window
already makes unlikely. D-03's held-count query has **no complementary bound** — it is a raw
index-scoped count with nothing else narrowing it — so an exact-boundary collision (57 rows
existing, cap set to exactly 57) is not similarly improbable over time. The stronger, already-
established idiom in this same codebase is `graphSnapshots.ts:252-259` (the sweep mutation):
`.take(CAP + 1)` then compare `length > CAP`, so an extra row beyond the cap is the signal, never
an equality guess. **Recommend the planner use `take(CAP + 1)` + `length > CAP`** for D-03, one
extra read (2001 vs 2000, negligible against the 4,096 ceiling) buying a strictly correct
`truncated` flag instead of a boundary-collision false positive.

`convex/alerts.ts:143`'s existing `countBySeverity` also uses the simpler `length ===
ALERT_COUNT_SCAN_CAP` form — so this codebase currently has BOTH idioms live for the same class of
query. This research recommends the `CAP+1` form for D-03 specifically because D-04 requires the
`truncated` flag to be genuinely reliable (Held's "N of M" display depends on it), which is a
stricter bar than `countBySeverity`'s badge-only consumer.

### Verification note
`convex/inboxIngest.ts:174`'s consumer needs a test crossing the held-count cap boundary (not one
that passes because the fixture is under it) — same discipline `eventsWindow.test.ts` (125-02)
already demonstrates for `listRecentRuntimeWindow`'s 600-row storm case.

---

## Todo 2 — `tool-galaxy-getprojectgraph-timeout.md` (Convex, root-caused by D-05)

### Q1 — D-06 blob storage mechanism (highest-value question)

**Table shapes, read directly (`convex/schema.ts:1940-1959`):**

```ts
graphSnapshotNodes: defineTable({
  snapshotId: v.string(), version: v.number(), nodeId: v.string(),
  label: v.string(), type: v.string(), community: v.optional(v.float64()), source: v.string(),
}).index("by_snapshot_version", ["snapshotId", "version"]),

graphSnapshotLinks: defineTable({
  snapshotId: v.string(), version: v.number(),
  source: v.string(), target: v.string(), relation: v.string(),
}).index("by_snapshot_version", ["snapshotId", "version"]),
```

The writer, `upsertGraphSnapshot`, is confirmed already an `internalMutation`
(`convex/graphSnapshots.ts:55`). `getProjectGraph` is confirmed a `query`
(`convex/graphSnapshots.ts:416`), consumed via `useQuery` in `src/hooks/useProjectGraph.ts:23-28`.

**Live re-confirmation of D-05's numbers, this session (read-only, `graphSnapshots:listSnapshots`,
a bounded meta-only query):**

```json
{ "nodeCount": 4001, "linkCount": 2590,
  "sources": [
    { "source": "astridr-repo", "kind": "graphify", "emittedNodeCount": 1500, "emittedLinkCount": 1052, "nodeCount": 71016, "linkCount": 112646, "truncated": true },
    { "source": "codepulse",    "kind": "graphify", "emittedNodeCount": 1500, "emittedLinkCount": 519,  "nodeCount": 25310, "linkCount": 32652,  "truncated": true },
    { "source": "vault",        "kind": "vault",     "emittedNodeCount": 1001, "emittedLinkCount": 1019, "nodeCount": 1001,  "linkCount": 1165,   "truncated": true }
  ] }
```

Exact match to D-05's `4001`/`2590`. `1500 + 1500 + 1001 = 4001` nodes; `1052 + 519 + 1019 = 2590`
links — confirms the per-source emitted breakdown feeding the eventual blob.

**Byte-size estimate — methodology and result.** No existing bounded query can sample real stored
`graphSnapshotNodes`/`graphSnapshotLinks` rows without either running the already-failing
unbounded query or deploying a new probe function (both out of scope for a read-only researcher).
Instead, I measured the **producer-side** data this graph is built from: this repo's own
`graphify-out/graph.json` (codepulse) and the sibling `astridr-repo/graphify-out/graph.json`
(astridr-repo) — the exact source trees `graphify` walks to emit the ingested nodes. Their node
counts corroborate they are the right source: codepulse local graph has 25,684 nodes vs. the
ingested meta's `nodeCount: 25310` for that source; astridr-repo local graph has 71,456 vs.
`nodeCount: 71016` — both within normal day-to-day drift of a nightly regenerated graph.

Script (Node, run locally, aggregate output only — no page content or personal vault content was
read or printed):

```js
// per node: JSON.stringify({id:'graphify:<repo>:'+n.id, label:n.label, type:n.file_type, community:n.community??null, source:'<repo>'})
```

| Source | Emitted nodes | Measured avg node JSON bytes | Emitted links | Measured avg link JSON bytes |
|---|---|---|---|---|
| astridr-repo | 1500 | **181.3** `[VERIFIED: astridr-repo/graphify-out/graph.json, 5000-node sample]` | 1052 | **189.7** `[VERIFIED: same source, 5000-link sample]` |
| codepulse | 1500 | **157.1** `[VERIFIED: codepulse/graphify-out/graph.json, 5000-node sample]` | 519 | **154.7** `[VERIFIED: same source, 5000-link sample]` |
| vault | 1001 | **~130 (ESTIMATED)** — not measured; I did not scan Larry's personal vault contents for this. Estimated from the fixture's short `vault:Note.md`-style ids being materially shorter than repo paths. | 1019 | **~120 (ESTIMATED)**, same caveat |

Weighted totals:
- Nodes: `(1500×181.3 + 1500×157.1 + 1001×130) / 4001` ≈ 159.4 bytes/node → **≈ 638 KB** for 4001 nodes.
- Links: `(1052×189.7 + 519×154.7 + 1019×120)` ≈ **≈ 402 KB** for 2590 links.
- **Combined ≈ 1.04 MB (≈1,040,000 bytes).**

**Convex's document size limit is 1 MiB = 1,048,576 bytes**
`[CITED: https://docs.convex.dev/production/state/limits]`. My combined estimate is **~99% of
that limit**, with no margin for: the wrapping `sources`/count/generatedAt fields on the same
document, Convex's internal per-document accounting overhead beyond raw JSON byte length, the
`community` field's actual (unestimated, assumed small) contribution, or the vault estimate being
too low. This is **not** "comfortably under" — the orchestrator's own conditional
("if the blob approaches or exceeds the document limit, (b) is forced") is closer to true than
false here.

**This estimate is corroborated by existing repo comments that predate this research and were
written for an unrelated reason**: `convex/runtimeIngest.ts:633-636` and `:1713-1715` both state
row-based storage was chosen specifically "to avoid Convex array-element (8192) and doc-size
(~1 MiB) limits" for this exact graph — i.e., a prior engineer already flagged this graph as
close to the 1 MiB ceiling, independently of this session's byte count.

**Array-length limit:** 4,001 and 2,590 are both comfortably under Convex's 8,192-element-per-array
limit `[CITED: same limits page]` — that ceiling is not the binding constraint here; document
*size* is.

### Q1 — THE DECISIVE FILE-STORAGE FACT

Fetched directly from Convex's own API reference (not training-data memory):

| Interface | Used by | Methods | Can read a stored file's bytes? |
|---|---|---|---|
| `StorageReader` | **query** functions (and read access in mutations) | `getUrl()`, `getMetadata()` (deprecated) | **No** — no `get()` method exists on this interface `[CITED: https://docs.convex.dev/api/interfaces/server.StorageReader]` |
| `StorageWriter` | **mutation** functions | `getUrl()`, `getMetadata()`, `generateUploadUrl()`, `delete()` | **No** — no `get()` or `store()` `[CITED: https://docs.convex.dev/api/interfaces/server.StorageWriter]` |
| `StorageActionWriter` | **actions and httpActions only** | adds `get()` (returns `Blob`) and `store()` | **Yes** `[CITED: https://docs.convex.dev/api/interfaces/server.StorageActionWriter]` |

**This is decisive, exactly as the orchestrator flagged.** Two consequences, both load-bearing for
the planner:

1. **The reader.** `getProjectGraph` is a `query` (confirmed above). If D-06's blob lives in
   Convex file storage, `getProjectGraph` can never return the graph's byte content directly — it
   can only return a URL (`ctx.storage.getUrl(storageId)`, which IS available to a query). The
   frontend must then do a plain `fetch(url)` to retrieve the JSON, **outside** Convex's reactive
   `useQuery` subscription. `useProjectGraph.ts` (currently 8 lines, one `useQuery` call) needs a
   second stage: fetch-on-URL-change, with its own loading/error state.
2. **The writer.** `upsertGraphSnapshot` is an `internalMutation` (confirmed above) — mutations get
   `StorageWriter`, which has **no `store()`**. It cannot write the blob to file storage itself.
   Its caller, `runtimeIngest` (`convex/runtimeIngest.ts:552`, confirmed `export const
   runtimeIngest = httpAction(...)`), **is** an httpAction and therefore gets `StorageActionWriter`
   with `store()`. **The blob write must happen in the httpAction (or a companion
   `internalAction` it calls), not inside `upsertGraphSnapshot`.**

### Recommendation (research, not a locked decision — D-06 explicitly left this to research)

Given the size finding (≈99% of the 1 MiB ceiling, no real headroom, and D-06 itself already
rejected a *less* risky alternative — the split-query option — specifically for leaving "only 95
rows of headroom"), a single-document-field blob is the weaker of the two options D-06 named, not
the safer one.

> **⚠ THE 6 STEPS BELOW ARE OBSOLETE — DO NOT IMPLEMENT THEM.** D-06-REVISED rejected file storage
> outright (it is unreadable from a `query`, and `getProjectGraph` is a `query`). They are retained
> only as the record of what was evaluated. **The binding shape is:** the writer serializes
> `{nodes, links}` once and splits the string across N rows with a monotonic `seq` in a
> `by_snapshot_version_seq`-style index; `getProjectGraph` reads them with ONE indexed range query
> and rejoins; the writer deletes the prior version's chunks. Points 6 and the operational context
> that follow the steps DO still apply — the keep-or-retire call on
> `graphSnapshotNodes`/`graphSnapshotLinks` is still live and still the planner's to make.

> **OBSOLETE — the block below is the REJECTED file-storage design, quoted verbatim for the
> record. It is not a plan. Do not implement any of it.** Point 6, which follows OUTSIDE this
> quote, is still live.
>
> ~~Recommend Convex file storage~~, with this concrete shape:
>
> 1. In `runtimeIngest.ts`'s `runtimeIngest` httpAction, at the graph-snapshot branch (`:1713-1725`),
>    serialize `{nodes, links}` to a JSON string and call `await ctx.storage.store(new
>    Blob([json], {type: "application/json"}))` to get a `storageId`.
> 2. Pass `blobStorageId: storageId` to `internal.graphSnapshots.upsertGraphSnapshot` (new arg).
>    `graphSnapshots` schema gains one **additive optional** field, e.g.
>    `blobStorageId: v.optional(v.id("_storage"))` — same backward-compatible pattern already used
>    for `storedVersions` (`schema.ts:1933`, added optional for exactly this reason). This IS a
>    schema change (see Q7 below) but a non-breaking one.
> 3. `getProjectGraph` reads the meta doc and returns `{ url: await ctx.storage.getUrl(meta.blobStorageId), nodeCount, linkCount, sources, generatedAt }` — no `nodes`/`links` arrays. This read is cheap (one meta-doc lookup + one storage URL lookup), nowhere near the 4,096 ceiling.
> 4. `useProjectGraph.ts` changes from a single `useQuery` passthrough to: `useQuery` for the cheap
>    metadata+URL, plus a `useEffect`/`fetch(url)` for the actual graph payload, keyed on the URL (or
>    `blobStorageId`) so a new ingest's new URL triggers a refetch. This is a real, scoped frontend
>    task — not a drop-in.
> 5. Delete the previous blob (`ctx.storage.delete(oldStorageId)`) on each new ingest, in the same
>    httpAction/action, to avoid unbounded file-storage growth — this codebase's established
>    "no silent unbounded growth" convention (mirrors `retentionCoverage.ts`'s whole framing).
>

**STILL LIVE, and independent of which storage mechanism won —** the planner must make this
call explicitly:

6. **Decide the fate of `graphSnapshotNodes`/`graphSnapshotLinks`.** Grepped every `.ts` file in
   `convex/` for these two table names: the only files touching them are `graphSnapshots.ts`
   (writer + sweep), `graphSnapshots.test.ts`, `schema.ts`, and `retentionCoverage.ts`
   (bookkeeping only) — **no other production consumer exists**
   `[VERIFIED: Grep "graphSnapshotNodes|graphSnapshotLinks" across convex/**/*.ts, 6 files, none outside graphSnapshots.ts/its tests/schema/retentionCoverage]`.
   `src/lib/kg-graph.test.ts:554` only references the shape in a comment for an unrelated function
   (`toGraphData`) — confirmed by reading the surrounding test, not a real consumer. If
   `getProjectGraph` moves entirely to reading the blob, these two entity tables become pure write
   cost with zero read benefit unless something else is decided to consume them. **This is a
   decision the planner must make explicitly** (stop writing entity rows entirely vs. keep writing
   them for some other reason) rather than silently doing both — leaving both means every ingest
   pays for the JSON blob serialize/store AND ~4,001+2,590 row inserts for no reader.

**Operational context worth carrying into planning:** `graphSnapshotNodes`/`graphSnapshotLinks`
held 502,636 documents (25.7% of the entire self-hosted database) as of 2026-08-21, because their
only bound — `sweepGraphSnapshotVersions` — sat commented out in `crons.ts` for 29 days
`[CITED: convex/retentionCoverage.ts:11-18]`. That cron was **re-enabled 2026-08-21**
`[VERIFIED: convex/crons.ts:158-190, "RE-ENABLED 2026-08-21"]` and now runs hourly, independent of
this phase. If the entity-row writes are retired as part of D-06, the sweep becomes a no-op
(nothing left to sweep) rather than a problem — but this is downstream of the decision in point 6
above, not a reason to defer it.

**I did not deploy or test this end-to-end** — per the operational constraint, this is a
read-only-verified architecture recommendation (API surface, size estimate, and existing-consumer
grep are all directly evidenced; the store/fetch flow itself is unexercised in this session).

---

## Todo 3 — `inbox-page-undercounts-held-behind-200-cap.md` (Convex, product decision resolved by D-01/D-02)

`Inbox.tsx:184`: `const inboxRecords = (useQuery(api.inbox.listAll, {}) ?? ...)` — confirmed the
200-row-capped read D-01/D-02 are about. `Inbox.tsx:320-322` derives `heldItems` from
`inboxRecords`; `Inbox.tsx:355` computes `unreadHeld = heldItems.filter((i) => !i.read).length` —
this is the "Held 9" the operator saw, confirmed still the current shape (line numbers shifted a
few lines from the todo's `:130,317-362` citation, current content at `:320-363`, same logic).

D-02's "zero new read cost" claim rests on a real Convex mechanism, not just phrasing: the Convex
React client **deduplicates identical `useQuery(fn, args)` subscriptions by reference-counting
across components** — `DashboardLayout.tsx:138`'s `useQuery(api.inbox.listHeldUnacked)` and a new
identical call inside `Inbox.tsx` share one live subscription; adding the second call does not add
a new server-side read. This is standard Convex client behavior, not something added by D-02 —
worth the planner citing explicitly in the plan so a reviewer doesn't mistake it for a new query.

**Implementation shape:** `Inbox.tsx` adds `const heldUnacked = useQuery(api.inbox.listHeldUnacked)`
(same call as the badge) and uses `heldUnacked?.length` as the Held tab's "of M" denominator,
falling back to a generic truncation marker for the other tabs (which have no free true count) per
D-01. No schema change, no new Convex function beyond D-03's count query (which is a *different*
query, for the badge itself — see Todo 1).

---

## Todo 4 — `alert-rules-engine-rows-overlap.md` (Frontend, NOT root-caused — D-07 measure-first)

### Q4 — scope for the measurement task

Current markup confirmed unchanged from the todo's citation (no line drift — last touched by
Phase 122-04, per `git log --grep`, unrelated motion-token work):

- `src/components/AlertRulesEngine.tsx:75` and `:205` — row containers:
  `group relative flex items-center gap-4 px-5 py-4 border-b border-primary/10 ... overflow-hidden`
- `:108-109` and `:218-219` — name `text-base ... truncate`, condition
  `text-sm text-muted-foreground truncate mt-0.5`
- `:388` — list container: `flex flex-col max-h-[500px] overflow-y-auto bg-background/30
  custom-scrollbar`

Two near-identical row-rendering blocks exist (`:75`/`:108-109` and `:205`/`:218-219`) — the
measurement task should check BOTH, since a fix applied to only one would leave the other
untouched with no signal that it was missed.

### Measurement instrument — what exists in this repo

`e2e/polish-geometry.spec.ts` is the established pattern for exactly this kind of claim: measure
`getBoundingClientRect()` on real rendered elements in a real browser, log the raw numbers as a
single `console.log` line tagged for transcription (e.g. `HEADER-ZONES-EVIDENCE ${JSON.stringify(...)}`),
then assert on the measured relationship — never infer geometry from class names alone. The
existing 900px sidebar/Settings collision block (`polish-geometry.spec.ts:360-477`) is the closest
structural precedent: it walks descendants, computes `scrollWidth`/`clientWidth`/`getBoundingClientRect()`,
and explicitly separates "genuinely overflowing past the viewport edge" (`rightOverflow`) from a
by-design-clipped false positive (Radix `sr-only`) — the same false-positive class the todo itself
flags as worth checking for Alert Rules ("a Radix ScrollArea clipping defect... worth checking
whether an ancestor of this panel does the same"). Recommend the measurement task follow this same
shape: measure each row's own rect, its two text children's rects, and the left column's rect,
compare row-to-row pitch, and check whether `:388`'s `overflow-y-auto` container is (or contains) a
Radix primitive with the `display:table`-viewport clipping behavior this codebase has already hit
once (`radix-scrollarea-table-clips-content`, Phase 123).

I did not attempt to measure this live myself — the todo explicitly requires a running dev server
and D-07 requires the measurement to happen inside the phase's own plan, not research.

---

## Todo 5 — `automation-page-placeholder-cards-and-invalid-expression.md` (Frontend, NOT root-caused)

### Q4 — files/queries touched, and the two symptoms' mechanical sources

**Symptom 2 (parser) — fully traceable statically, not a live-DOM question:**

`src/lib/cronToHuman.ts:13-24`:
```ts
export function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid expression";
  ...
}
```
Called from `src/components/CronJobList.tsx:69` as `cronToHuman(job.expression)`. `job.expression`
is populated by `Automation.tsx:40-45`'s `schedulesToCronJobs()`, which maps
`CRON_SCHEDULES[].interval` — a **human-readable display string** like `"Every 5 min"` or
`"Daily 03:00 UTC"` (`src/lib/cronSchedules.ts:11-22`) — directly into `expression`. `CronSchedule`
(`cronSchedules.ts:1-8`) has no field anywhere holding an actual 5-field cron string (`* * * * *`);
it only carries `interval` (display text) and `intervalSeconds` (a number). Splitting `"Every 5
min"` on whitespace yields 3 tokens, never 5 — `cronToHuman` therefore returns `"Invalid
expression"` for **every** row, deterministically, regardless of live data. This matches the
observed symptom exactly (all 12 rows fail identically; the raw interval text renders correctly
*beside* the error because `CronJobList.tsx:66` renders `job.expression` raw and `:69` separately
renders `cronToHuman(job.expression)`).

I am reporting this because Q4 explicitly asked "which parser produces the string" and this is
directly, deterministically traceable from source with no live measurement needed — it is not a
hypothesis about behavior, it is a category mismatch visible in the two files' field shapes. I have
**not** written or suggested a fix, and D-07 still governs how the planner structures this task —
but the planner may reasonably treat this specific sub-symptom as resolvable without D-07's
measure-first ceremony, since there is no live signal left to gather (the input shape is a static
module constant, not data from a query). **Flagging this distinction explicitly so the planner can
decide whether to split the two symptoms into separate tasks** rather than assuming both need the
same measurement step.

**Symptom 1 (3 dead stat cards) — genuinely needs live measurement, not resolvable from source alone:**

`Automation.tsx:48-52`: `summary = useAutomationSummary()` → `useQuery(api.automation.cronSummary)`
(`src/hooks/useAutomation.ts:4-6`). The other 3 cards (`Runs (1h)`, `Failed (1h)`, `Avg Duration`,
`Automation.tsx:103-114`) all derive from `summaryState = useMetricState(summary, undefined,
{}).state` — if `summary` stays `undefined` forever (Convex's own "still loading" signal, not an
error), `MetricCard` shows its loading skeleton indefinitely with no console error, matching "purple
skeleton placeholder bars that never resolve" exactly. The 4th card (`Configured Schedules`) reads
a static import (`CRON_SCHEDULES.length`, `state="ready"`), not a query, which is why it alone
renders correctly — this is the control the todo itself names as available.

One mechanical observation for whoever writes the measurement task, **not a diagnosis**: `cronSummary`
(`convex/automation.ts:135-155`) does
```ts
await ctx.db.query("cronExecutions").withIndex("by_timestamp")
  .filter((q) => q.gte(q.field("timestamp"), oneHourAgo)).collect();
```
— `by_timestamp` is a plain, single-field index (`schema.ts:434-435`, `["timestamp"]`), and no
range bound is passed to `withIndex` itself (only to a post-scan `.filter()`). This is the same
unbounded-`.collect()`-over-a-growing-table shape this whole phase is built around; `cronExecutions`
is in `retentionCoverage.ts`'s `COVERAGE_PRUNED` list (so it is bounded by calendar retention, not
literally infinite) but could still be large enough to breach the 4,096-read or 16 MiB ceiling. Its
three sibling queries in the same file (`recentCrons`, `recentHeartbeats`, `recentJobs`, all of
which the page's OTHER sections consume successfully) all use `.take(limit)` instead. **Whether
this is the actual cause of the hang is unverified** — a throwing query behaves differently (per
CLAUDE.md's own documented lesson: "A Convex query that throws is unhandled at the `useQuery`
boundary: it unmounts the React tree and blanks EVERY page using that hook") than the observed
"rest of the page renders fine, only 3 tiles hang" symptom, so this may not be a simple throw. This
discrepancy is exactly why D-07 requires a live measurement rather than accepting this as the
answer — recommend the measurement task specifically capture whether `cronSummary`'s subscription
ever resolves, errors, or genuinely never settles, and how large `cronExecutions` currently is.

**Files/queries this page touches, for the measurement task's scope:**
`src/pages/Automation.tsx`, `src/hooks/useAutomation.ts`, `convex/automation.ts` (`cronSummary`,
`recentCrons`, `recentHeartbeats`, `recentJobs`), `src/lib/cronSchedules.ts`, `src/lib/cronToHuman.ts`,
`src/components/CronJobList.tsx`. Also on this page but likely unrelated to either symptom:
`api.pipelineCheckpoints.overview/recent`, `api.integrationCalls.overview/recent` (their own tiles
render fine per the todo's screenshot description — only the top 4 cards and cron rows are broken).

### Measurement instrument
Same as Todo 4 — `e2e/polish-geometry.spec.ts`'s pattern (in-browser evaluate + logged JSON) for
any DOM-level claim; for the query-resolution question specifically, a live-server console/network
check (or a Playwright `page.waitForFunction` polling the DOM for the tile's resolved value vs. a
timeout) is the right instrument, following the same "poll the real thing, not a fixed sleep"
discipline `e2e/quick-commands-stop.spec.ts:267-277`'s `page.waitForFunction` already demonstrates
in this repo (there, polling a real `HTMLAudioElement`'s `currentTime`; here, polling for the tile's
rendered value to leave its skeleton state, or for a network/console error to appear).

---

## Todo 6 — `sidebar-4px-horizontal-overflow-separator.md` (Frontend, one class)

### Q6 — the overflowing element, confirmed with current line numbers

**Line numbers have drifted from the todo's `:458,463` citation** (filed 2026-08-21; Phase 125
added content above this point in the file). Current locations, confirmed by direct read:

- `DashboardLayout.tsx:482`: `<nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Main navigation">`
- `DashboardLayout.tsx:487`: `{i > 0 && <Separator className="my-2 mx-3" />}`

Markup and mechanism are otherwise unchanged from the todo's own diagnosis (confirmed by direct
read, not re-derived): the shadcn `Separator` carries `data-[orientation=horizontal]:w-full`; inside
the nav's `px-2` content box (216px), `w-full` resolves to 215px, and `mx-3` offsets it 12px right,
putting its right edge at 235px against the nav's 231px `clientWidth` — a 4px overhang that flips
`overflow-x` to `auto` (browser behavior once `overflow-y` is non-`visible`) and draws the
scrollbar. **Do not cite `:458/:463` in the plan — use `:482/:487`.**

The todo's own recommended remedies are still valid (drop `mx-3` and pad the wrapper instead, or
add `w-auto` to override `w-full`) — this research adds no new option, only confirms the location
and re-verifies the mechanism reading matches current code.

---

## Todo 7 — `polish-geometry-spec-measures-cold-page.md` (Test/evidence)

### Q5 — what the spec measures, why cold-page invalidates it, and the fix pattern

Read `e2e/polish-geometry.spec.ts` in full (567 lines). The `Header three-zone min-content
measurement` block (`:207-358`, added by plan 124-10 for D-06) does:

```ts
await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
await page.goto('/');
const header = page.locator('header').first();
await gateOrSkip(page, header, ...);
await expect(header).toBeVisible();
const evidence = await header.evaluate((headerEl, w) => { /* measures min-content of 3 zones */ }, width);
```

**No wait exists anywhere in this file for `SystemChip` or `BrainHeaderBadge` specifically** — the
only gate is `expect(header).toBeVisible()`, which asserts the header *container* renders, not that
its async Convex-subscribed children have resolved past their `null`-until-loaded state (per the
todo: both components render `null` until their subscriptions resolve). This is exactly the defect
class CLAUDE.md's own memory note describes: "an axe capture taken before the query resolves
records a clean page that isn't" — here it's a geometry sum, not an axe capture, but the mechanism
(measuring before an async child resolves) is identical.

**This repo's own established fix pattern for "must be measured after real content resolves, not
after a fixed timeout" exists and is directly citable: `e2e/serif-trial.spec.ts:57-70`:**

```ts
// FAIL, do not skip and do not pass, if no populated .briefing-voice element appears. A capture
// taken before the query resolves (or against a genuinely empty feed) records a clean page that
// is not clean -- this repo has already lost four accessibility findings to exactly this defect
// class (Phase 123).
try {
  await expect(voiceLocator.first()).toBeVisible({ timeout: 15000 });
} catch {
  throw new Error('SERIF-TRIAL FAILED: no .briefing-voice element appeared on /briefings within 15s...');
}
```

This waits on a **locator for the actual rendered content** (not a bare `page.waitForTimeout`),
with an explicit timeout, and treats a timeout as a hard failure (never a silent skip or pass) —
exactly what the todo's own fix note asks for ("preferably a wait on the two components actually
rendering... rather than a bare timeout, so the spec is deterministic rather than racing a fixed
delay"). Recommend the header-zones block add
`await expect(page.locator('[data-testid="system-chip"], ...')).toBeVisible({ timeout: 15000 })`
(exact selector TBD by whoever inspects `SystemChip`/`BrainHeaderBadge`'s actual rendered markup —
I did not locate a `data-testid` on either component in this pass; the implementer should confirm
one exists or add one) before the `header.evaluate(...)` measurement call, mirroring
`serif-trial.spec.ts`'s try/throw shape rather than `gateOrSkip`'s skip shape (skipping here would
hide the exact race this todo exists to close).

### Verification when fixed
Per the todo: run cold and warm and assert the two numbers now **agree** — a single passing run
cannot distinguish "the race is fixed" from "the race did not fire this time."

---

## Cross-cutting: Q7 — deploy/ordering constraints

**Deploy command, verbatim from `CLAUDE.md`:**
```
npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```
`--env-file` is not optional; a bare `npx convex deploy` can target the retired cloud deployment.
`convex deploy` ships the **working tree**, not HEAD — `git status --porcelain` at the time of this
research shows only the two untracked phase-scaffold files
(`.planning/phases/126.../.gitkeep`, `phase-state.json`), no other uncommitted changes in the
shared checkout `[VERIFIED: git status --porcelain, run this session]`. **This is a point-in-time
snapshot only** — the planner/executor must re-run this check immediately before the actual deploy,
since this is a shared checkout other sessions can dirty at any time (per CLAUDE.md's own
documented shared-checkout incidents).

**Does either Convex change require a schema change?**

| Change | Schema change? | Detail |
|---|---|---|
| D-03 (new held-count query) | **No** | Reuses the existing `by_itemType` index (`schema.ts:2121`, already `["itemType", "createdAt"]`) on the existing `inbox` table. New query function only. |
| D-05/D-06 (tool-galaxy blob) | **Yes** | Under D-06-REVISED this is a NEW TABLE for the chunk rows (`snapshotId`, `version`, `seq`, `chunk`) plus its `by_snapshot_version_seq` index — not merely an optional field. A new table with a new index is additive and does not alter existing tables, so it remains a safe forward-only deploy, but the planner must note it is a larger schema delta than the optional-field pattern the earlier draft assumed. Precedent for the row shape: `forgeLogChunks` (`schema.ts:1723-1731`). **Watch the deploy output for a `Deleted table indexes:` line** — per CLAUDE.md that is the only announcement of a schema rollback, and this is a shared checkout where `convex deploy` ships the WORKING TREE. |

**Consequence:** the single shared deploy is not purely a function-only deploy — it carries at
least one schema change. Per CLAUDE.md's self-hosted operational rules, this is routine (additive
optional fields are the established safe pattern here, not a novel risk), but the planner should
sequence the schema-touching plan (D-06) so its schema.ts diff is reviewed on its own before the
shared deploy, rather than bundled invisibly with D-03/D-01/D-02's pure-function changes.

---

## Recommendations for the planner (concrete, file-scoped)

1. **D-03 (`convex/inbox.ts`):** add `HELD_COUNT_SCAN_CAP = 2000` (module constant, same value as
   `alerts.ts:122`'s `ALERT_COUNT_SCAN_CAP`) and a new `query` (e.g. `countHeldUnacked`) using
   `.withIndex("by_itemType", q => q.eq("itemType", "held")).take(HELD_COUNT_SCAN_CAP + 1)`, then
   `{ count: Math.min(rows.length, HELD_COUNT_SCAN_CAP), truncated: rows.length > HELD_COUNT_SCAN_CAP }`
   (note: rows still need the `ackedAt === undefined` filter `listHeldUnackedHandler` applies —
   applying it post-`.take()` on a `.take(CAP+1)` risks undercounting if acked rows appear inside
   the capped window; the planner should verify whether filtering before or after the cap changes
   the true/false boundary and pick accordingly, since D-04 requires the flag to be honest).
2. **D-01/D-02 (`src/layouts/DashboardLayout.tsx`, `src/pages/Inbox.tsx`):** wire the new
   `countHeldUnacked` query into `DashboardLayout.tsx`'s badge (replacing its current
   `useQuery(api.inbox.listHeldUnacked)` read, which stays available for `Inbox.tsx`'s own "N of M"
   display since it's a different consumer with a different need — the digest's
   `listHeldUnacked` itself is untouched per D-03). `Inbox.tsx` adds
   `useQuery(api.inbox.listHeldUnacked)` for the Held tab's true "N of M" (dedup'd for free against
   any other live subscriber of that exact query+args), and a generic truncation marker for the
   other tabs driven by `listAll`'s own `.length === DEFAULT_LIST_ALL_LIMIT` check.
3. **D-06-REVISED (`convex/graphSnapshots.ts`, `convex/schema.ts`) — NOT file storage:** add a
   chunk-row table + `by_snapshot_version_seq` index; serialize `{nodes, links}` once in the
   existing `internalMutation` writer, split across N rows with a monotonic `seq`, delete the
   prior version's chunks, and rebuild `getProjectGraph` to read them with ONE indexed range
   query and rejoin. **`convex/runtimeIngest.ts` and `src/hooks/useProjectGraph.ts` are NOT in
   scope** — the whole point of the chunked shape is that `getProjectGraph` stays a `query`, so
   the hook and every `useQuery` consumer are untouched. This is still the largest single task in
   the phase — recommend the planner give it its own plan, not bundle it with D-01/D-02/D-03.
   Verification must assert round-trip fidelity, the ~N-row read cost, and `seq` ordering, each
   with a control that fails — see § Validation Architecture.
4. **Todo 4 (Alert Rules) and Todo 5 (Automation):** each gets a measure-first task per D-07, using
   `polish-geometry.spec.ts`'s in-browser-evaluate + logged-JSON pattern. Consider splitting Todo
   5 into two sub-tasks given the researched split above (parser mismatch is statically traceable;
   stat-card hang needs live measurement) — but this is the planner's call under D-07, not locked
   here.
5. **Todo 6 (sidebar):** trivial, one class, cite `DashboardLayout.tsx:482/487` (not `:458/:463`).
6. **Todo 7 (polish-geometry evidence):** add a `toBeVisible({timeout})` wait on
   `SystemChip`/`BrainHeaderBadge`'s actual rendered output before the header-zones measurement,
   mirroring `serif-trial.spec.ts:57-70`'s fail-don't-skip shape. Locate or add a stable selector
   for both components first.
7. **Sequencing:** D-03/D-01/D-02 have no schema change and can deploy independently of D-06's
   schema change if the planner wants to de-risk the shared deploy — but CONTEXT.md's "one operator
   deploy" framing suggests batching is intended. Either way, re-run `git status --porcelain`
   immediately before the actual deploy.

---

## Package Legitimacy Audit

**Not applicable.** This phase adds no new npm/PyPI packages — every remedy above uses Convex APIs
already present in this project's existing `convex` dependency (`ctx.storage`, `.withIndex`,
`.take()`) and existing Playwright/Vitest tooling already installed. No `slopcheck` run was
needed.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Self-hosted Convex backend | All three Convex-side todos | Yes — confirmed via live `npx convex run` calls this session | n/a (self-hosted) | — |
| `npx convex run` CLI | Read-only measurement (this research) | Yes — used successfully with `--env-file` | n/a | — |
| Local `graphify-out/graph.json` (codepulse + astridr-repo) | Q1's byte-size estimate | Yes — both present and sampled | n/a | If regenerated/stale, re-sample before trusting the byte estimate for planning |

No missing dependencies block this phase.

## Sources

### Primary (HIGH confidence)
- `[VERIFIED]` `npx convex run graphSnapshots:listSnapshots '{}'` — live read-only query, this session, confirms D-05's 4001/2590 figures exactly.
- `[VERIFIED]` `npx convex run inbox:listHeldUnacked '{}'` — live read-only query, this session, count=57.
- `[CITED: https://docs.convex.dev/production/state/limits]` — 1 MiB document size, 8192 array elements, 32,000 documents/16 MiB scanned per transaction.
- `[CITED: https://docs.convex.dev/api/interfaces/server.StorageReader]` — query/mutation storage interface has no `get()`.
- `[CITED: https://docs.convex.dev/api/interfaces/server.StorageWriter]` — mutation storage interface has no `store()`.
- `[CITED: https://docs.convex.dev/api/interfaces/server.StorageActionWriter]` — only actions/httpActions get `get()`/`store()`.
- Direct reads: `convex/graphSnapshots.ts`, `convex/schema.ts`, `convex/inbox.ts`, `convex/alerts.ts`, `convex/events.ts`, `convex/automation.ts`, `convex/runtimeIngest.ts`, `convex/http.ts`, `convex/retentionCoverage.ts`, `convex/crons.ts`, `src/layouts/DashboardLayout.tsx`, `src/pages/Inbox.tsx`, `src/pages/Automation.tsx`, `src/components/AlertRulesEngine.tsx`, `src/components/CronJobList.tsx`, `src/lib/cronToHuman.ts`, `src/lib/cronSchedules.ts`, `src/hooks/useProjectGraph.ts`, `e2e/polish-geometry.spec.ts`, `e2e/serif-trial.spec.ts`, `e2e/quick-commands-stop.spec.ts`.
- All seven todo files under `.planning/todos/pending/`.
- `126-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `125-02-SUMMARY.md`.

### Secondary (MEDIUM confidence)
- `[ESTIMATED]` weighted node/link byte-size totals (~638 KB nodes, ~402 KB links, ~1.04 MB
  combined) — built from measured per-source averages for astridr-repo and codepulse (from real
  local `graphify-out/graph.json` files, sampled 5000 rows each) but the vault source's ~130/~120
  byte-per-row figures are estimated, not measured (I chose not to scan Larry's personal Obsidian
  vault for this). Vault is only 1001 of 4001 nodes and 1019 of 2590 links, so even a 2x error in
  the vault estimate moves the combined total by roughly ±65 KB — not enough to flip the
  conclusion that the document-field option has effectively no headroom, but the exact percentage
  (I used "~99%") should be treated as approximate, not exact.
- `[VERIFIED via WebSearch, corroborated by official docs]` Convex has no native `.count()` —
  counting requires reading the rows (confirmed by `docs.convex.dev`'s own "Why doesn't Convex have
  SELECT or COUNT" article, cross-referenced against this repo's existing `alerts.ts`/`events.ts`
  take-then-`.length` idiom).

### Tertiary (LOW confidence / explicitly flagged as unverified)
- The mechanical observation that `cronSummary`'s unbounded `.collect()` might be involved in
  Automation's 3 dead stat cards — flagged explicitly as unverified in the Todo 5 section; the
  observed symptom shape (rest of page renders, only 3 tiles hang) does not cleanly match this
  repo's own documented "a throwing query blanks the whole page" behavior, so this is a lead for
  the measurement task, not a finding.
- Growth-rate framing for held-unacked inbox rows (46→57 same day) — reported as two data points,
  explicitly not extrapolated into a rate.

## Metadata

**Confidence breakdown:**
- Q1 (blob mechanism): HIGH on the API-surface facts (official docs, three separate interface
  pages) and on the D-05 re-measurement (live query); MEDIUM on the exact byte-size percentage
  (estimated from real but partial sampling, vault portion unmeasured).
- Q2/Q3 (inbox cap + reference pattern): HIGH — live-measured count, direct reads of both reference
  implementations, precedent cap value already in production code.
- Q4/Q5 (Alert Rules, Automation): HIGH on all mechanical facts (file:line, parser code, query
  code); by design NOT a diagnosis per D-07 — do not read the parser finding as license to skip
  the measurement task, only as a possible basis for splitting it.
- Q6 (sidebar): HIGH — re-verified against current file, line numbers corrected.
- Q7 (deploy): HIGH — command cited verbatim from CLAUDE.md, schema-change determination made from
  direct schema.ts reads, git status is a live snapshot with an explicit re-check caveat.

**Research date:** 2026-08-24
**Valid until:** Convex live-row counts (57 held-unacked, 4001/2590 graph nodes/links) will drift
daily — re-verify both with a fresh `npx convex run` before finalizing D-03's cap or citing D-05's
numbers in a plan more than a few days old. The API-surface findings (StorageReader/Writer/
ActionWriter, 1 MiB limit) are stable Convex platform facts, not expected to change on a weekly
timescale.

## What I could not determine, and why

1. **Exact byte size of the real stored `graphSnapshotNodes`/`graphSnapshotLinks` rows.** No
   existing bounded Convex query can sample them without either running the already-failing
   unbounded `getProjectGraph` or deploying a new probe function — both outside a read-only
   researcher's remit on a live, shared, self-hosted instance. I substituted a measured estimate
   from the producer-side `graphify-out/graph.json` files instead (see Sources, Secondary), which
   is a real, defensible proxy but not a direct measurement of the stored rows themselves.
2. **The vault source's per-node/per-link byte size.** I did not scan Larry's personal Obsidian
   vault content to measure real note-path lengths, since that would mean reading potentially
   private personal-vault file paths for a byte-counting exercise — I estimated instead and flagged
   the estimate's bounded impact on the overall conclusion (±65 KB on a ~1.04 MB total).
3. **Whether `cronSummary`'s unbounded `.collect()` is actually why 3 Automation stat cards hang.**
   I found a mechanically plausible unbounded-read shape, but the observed symptom (rest of the
   page renders normally) does not cleanly match this repo's own documented behavior for a
   throwing Convex query. D-07 requires this to stay a hypothesis for the phase's own measurement
   task to resolve, and I have deliberately not gone further than flagging the discrepancy.
4. **Whether the Alert Rules overlap is caused by a Radix ScrollArea `display:table` clipping
   defect (as the todo speculates) or something else.** This needs live `getBoundingClientRect()`
   measurement against a running dev server, which is squarely the measure-first task's job under
   D-07, not research's.
5. **The exact current size/row-count of `cronExecutions`**, which would settle how close
   `cronSummary`'s unbounded scan is to the read/byte ceiling. I did not query it live because
   `cronSummary` itself is the query under suspicion and I did not want to risk exercising the
   same failure path speculated about in Todo 5 without the measurement task's own structured
   before/after framing (D-07's explicit purpose).

---

## Validation Architecture

*Appended by the plan-phase orchestrator, 2026-08-24. The plan-phase workflow greps for this exact
heading to build `126-VALIDATION.md`; without it the plans fail the Nyquist Dimension-8 gate.
Every claim below was verified first-hand by the orchestrator.*

### Test infrastructure (verified present)

| Property | Value |
|---|---|
| Frameworks | Vitest (unit/component) + Playwright **1.61.1** (`npx playwright --version`) |
| Config files | `vitest.config.ts`, `playwright.config.ts` — both confirmed at repo root by `ls` |
| Quick run | `npx vitest run <file>` |
| Full suite | `npm test` (= `vitest`) · `npm run test:e2e` (= `playwright test`) |
| Estimated runtime | **NOT MEASURED this session — do not quote a figure until it is.** Same refusal `125-VALIDATION.md` made, for the same reason. |

`package.json` also exposes `test:e2e:authed` (`--project=chromium-authed`) and `test:e2e:noauth`.
The `test:e2e:noauth:help` script is a long inline operator note, and anything in this phase that
runs a noauth e2e spec inherits its traps: the noauth server must be started FIRST in its own
terminal; `playwright.config.ts`'s `webServer` is hardcoded to **5173** and **will report itself
healthy while noauth specs target 5181**; and the empty-string env assignment must be issued **from
Git Bash, never PowerShell** (PS 5.1 deletes a var assigned `''`, silently leaving the Clerk gate
live).

### Existing coverage for the seven items — including the zeros

Enumerated by `ls convex/*.test.ts` and `ls e2e/`, not by a filtered grep:

| Item | Existing test | Status |
|---|---|---|
| 1. `listHeldUnacked` unbounded (D-03) | `convex/inboxIngest.test.ts` exists; **`convex/inbox.test.ts` does NOT** | **GAP** — the module holding `listAll` / `listHeldUnackedHandler` has no unit test at all |
| 2. `/tool-galaxy` chunked blob (D-06-REVISED) | `convex/graphSnapshots.test.ts` | Exists — extend, do not replace |
| 3. Inbox undercount (D-01/D-02) | none for `src/pages/Inbox.tsx` | **GAP** |
| 4. Alert Rules row overlap | `e2e/alerts.spec.ts`; `polish-geometry.spec.ts:495` already navigates `/alerts` | Partial — no row-pitch measurement |
| 5. `/automation` | none found for `src/pages/Automation.tsx` | **GAP** |
| 6. Sidebar 4px overflow | `e2e/polish-geometry.spec.ts` Block 2 already walks every `<body>` descendant for horizontal overflow and names the culprit | **This is the instrument — reuse it, do not write a new one** |
| 7. Cold-page geometry spec | the spec IS the subject | see below |

**Two directly reusable reference tests for D-03**, both already in this repo and both solving this
exact risk class: `convex/alertsCountBounded.test.ts` (Phase 124's bounded sibling badge) and
`convex/eventsWindow.test.ts` (the 125-02 bounded-read reference CONTEXT.md points D-03 at). Copy
their assertion shape rather than invent one.

### Wave 0 requirements

- `convex/inbox.test.ts` — **must be created**; it does not exist, and items 1 and 3 both land in
  that module.
- A component test for `src/pages/Inbox.tsx` covering the D-02 "N of M" / generic-marker branch.
- No framework install needed — both runners and both configs are present.

### The chunked-blob verification note (D-06-REVISED)

A test asserting only "the page rendered" would not have caught the original defect either, and
must not be accepted as coverage. Three properties need separate assertions:

1. **Round-trip fidelity** — rejoin the N chunks and assert the parsed result is deep-equal to what
   was serialized. A boundary that splits a multi-byte character or drops a byte yields a
   `JSON.parse` throw or, worse, a silently truncated array. Assert on the rejoined VALUE, not on
   the absence of a throw.
2. **Read cost** — assert the number of documents read is ~N (the chunk count), not 6,591. This is
   the property that actually fixes D-05, and it is invisible to any rendering assertion.
3. **Ordering** — assert reassembly is `seq`-ordered and fails loudly on a gap. An indexed range
   query returning chunks out of order produces corrupt JSON, not a missing-data error.

Pair each with a control that could have come out the other way: a deliberately corrupted,
out-of-order, or gapped chunk set must FAIL. A guard that cannot fire is indistinguishable from one
never violated.

### Manual-only verifications

Success criterion 1 requires assertions on the RENDERED result — "a node count, a parsed schedule,
a measured row pitch" — never on the absence of an error string. Criterion 2 is a cross-surface
agreement between the sidebar badge and the `/inbox` Held tab. Splitting honestly:

| Behavior | Automatable? | Why |
|---|---|---|
| Chunked-blob round-trip, read cost, ordering | **Yes** — Vitest, extending `convex/graphSnapshots.test.ts` | Pure data properties |
| D-03 count query bound + `truncated` flag | **Yes** — Vitest, per `alertsCountBounded.test.ts` | Pure data properties |
| `/tool-galaxy` renders a node count | **Yes** — Playwright; assert the count, not "no error" | Rendered value is readable from the DOM |
| Sidebar badge vs Held tab agree (criterion 2) | **Yes, and it MUST be** — ONE spec reading BOTH numbers in a SINGLE page state | Reading them in separate runs structurally cannot catch a contradiction |
| Alert Rules row pitch | **Yes** — measured pitch, per the D-07 measurement task | |
| `/automation` renders parsed schedules | **Yes** for the rendered string; the stat-card hang needs live measurement first (D-07) | |
| **Whether the truncation markers are legible and non-misleading to a human** | **NO — operator judgement** | D-01/D-02 exist to stop a human misreading two numbers. A passing string-match does not establish that a person reading the tabs is no longer misled. |

**Phase 125-13 is the standing precedent and the reason this table is split:** every automated
assertion there passed against a signal a human could not actually see. The truncation markers are
the same shape of risk — their entire purpose is a human's reading — so at least one operator look
is required before criterion 2 is called met.

### Sampling rate

- After every task commit: `npx vitest run <the file that task touched>`
- After every plan wave: `npm test`
- Before `/gsd-verify-work`: full Vitest suite green; the e2e specs touched by items 4/6/7 green;
  the two-run cold/warm agreement for item 7; PLUS the operator look at the truncation markers.

### Item 7's verification is prescribed by its own todo, and is unusual — do not simplify it

`.planning/todos/pending/polish-geometry-spec-measures-cold-page.md` specifies: run the spec twice,
cold and warm, and assert the two measurements **agree**. That agreement IS the test — a single
passing run cannot distinguish "the race is fixed" from "the race did not fire this time." The todo
also records that the defect **inverts** a conclusion rather than merely blurring it: at 375px the
cold reading says the zones fit (268 vs 327 available), the settled reading says they overflow by
39px (366.2). The fix must wait on `SystemChip` and `BrainHeaderBadge` actually rendering, **not** a
bare timeout. Note the spec's assertion is `culprits.length === 0`, so it passes correctly today —
this is an EVIDENCE defect, not a test failure, and "the test is green" is not a reason to skip it.
