---
phase: 126-page-body-and-convex-read-defect-sweep
plan: 05
subsystem: database
tags: [convex, graph-snapshot, chunked-blob, bounded-read, dos-mitigation, backfill]

# Dependency graph
requires: ["126-02"]
provides:
  - "getProjectGraph -- rewritten to read graphSnapshotBlobChunks through by_snapshot_version_seq (one bounded, seq-ordered indexed read, GRAPH_BLOB_MAX_CHUNKS=16), replacing the two unbounded .collect()s D-05 measured at 6,591 rows"
  - "backfillGraphBlob (internalAction) + getGraphMetaForBackfill/getGraphEntityPage (internalQuery) -- one-shot, idempotent rebuild of the pre-chunk active version through the real production writer"
affects: [126-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GRAPH_BLOB_MAX_CHUNKS derived arithmetically from the 16 MiB per-transaction scan ceiling (not a round number) -- 128,000 chars x 4 bytes worst-case = 512 KB/chunk, x2 safety factor against 8 MiB budget = 16"
    - "FIRST-before-null completeness check: blobChunkCount>0 && rows.length===0 throws (total chunk loss); only an ABSENT blobChunkCount field licenses the graceful-skip null"
    - "Explicit handler return-type annotations to break Convex's same-file circular type inference (internal.<module>.<fn> referencing the module's own not-yet-inferred export type)"
    - "backfillGraphBlob's three no-op guards (alreadyChunked / noEntityRows / versionAdvanced) so a re-run can never publish an empty or stale version over the live graph"

key-files:
  created: []
  modified:
    - convex/graphSnapshots.ts
    - convex/graphSnapshots.test.ts

key-decisions:
  - "Typed the parsed blob's {nodes, links} explicitly instead of leaving JSON.parse's result as the widened `unknown[]` TypeScript would otherwise infer -- ProjectGraphData (src/hooks/useProjectGraph.ts) derives its type directly from getProjectGraph's own inferred return type, so an untyped parsed blob would have silently broken type-checking in CodeVaultGraph.tsx and ToolGalaxy.tsx (both out of scope to edit) without any runtime symptom."
  - "Broke a same-file circular type-inference error (TS7022/TS7023) in backfillGraphBlob by adding an explicit Promise<BackfillGraphBlobResult> return-type annotation on its handler, an explicit Promise<Doc<'graphSnapshots'>|null> annotation on getGraphMetaForBackfill, and a declared union return type plus two `as` casts (kind-discriminated, safe by construction) at the two call sites in getGraphEntityPage/backfillGraphBlob."
  - "Reworded two doc comments that literally contained the substring '.collect()' (referring to the OLD code being replaced) so the acceptance criterion's grep -c \"collect()\" == 0 measures actual code, not prose about the code it replaced."
  - "POST-REVIEW (2026-08-25): a concurrent process applied commit 2d5c1158 fixing two HIGH defects (writer/reader chunk-cap asymmetry; a TOCTOU-racy version guard) while this plan was still active. I verified 2d5c1158 against the reviewer's spec, found the version guard implemented as a throw where the spec required a returned named status (because a throw from a mutation called via ctx.runMutation with no try/catch propagates as an uncaught exception through the whole backfillGraphBlob action), and corrected it in a follow-up commit 606e07fa: upsertGraphSnapshot now RETURNS {status:\"versionAdvanced\",...} instead of throwing, backfillGraphBlob checks that return value, and a new test suite exercises backfillGraphBlob itself (not just upsertGraphSnapshot in isolation) via a hand-built fake action ctx simulating the exact race the action's own pre-check cannot see."

requirements-completed: [SWEEP-02]

# Metrics
duration: ~45min + ~15min post-review correction
completed: 2026-08-25
---

# Phase 126 Plan 05: Chunked-Blob Read + One-Shot Backfill for `/tool-galaxy` Summary

**`getProjectGraph` now performs ONE bounded, `seq`-ordered indexed read over `graphSnapshotBlobChunks` (capped at `GRAPH_BLOB_MAX_CHUNKS=16`, arithmetically derived from Convex's 16 MiB scan ceiling) instead of two unbounded `.collect()`s that D-05 measured at 6,591 rows against the 4,096-read ceiling; a short, gapped, over-cap, or unparseable chunk set each raises a named `ConvexError`, and a new `backfillGraphBlob` internalAction rebuilds the pre-chunk active version through the real production writer, guarded so a re-run can never publish an empty or stale version over the live graph.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-25T10:19:52-04:00 (commit `a6dc8dd0`)
- **Tasks:** 2/2
- **Files modified:** 1 (`convex/graphSnapshots.ts`)

## Accomplishments

### Task 1 — `getProjectGraph` rewritten (D-06-REVISED)

- Added `GRAPH_BLOB_MAX_CHUNKS = 16` as a module constant, with the derivation written into its own comment: `GRAPH_BLOB_CHUNK_CHARS` (128,000 chars) × 4 bytes UTF-8 worst case = 512 KB/chunk; a safety factor of 2 against Convex's 16 MiB per-transaction scan ceiling gives an 8 MiB budget; 8 MiB / 512 KB = 16. Today's graph is ~9 chunks (per D-06-REVISED's ~1.03 MB measurement), so 16 leaves headroom while staying provably under the ceiling. This corrects the plan's own earlier draft, which said 200 (~25 MB) — above the 16 MiB ceiling, which would have made the over-cap `ConvexError` below unreachable.
- Replaced the two `.collect()`s with one query: `.query("graphSnapshotBlobChunks").withIndex("by_snapshot_version_seq", q => q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)).order("asc").take(GRAPH_BLOB_MAX_CHUNKS + 1)`. `by_snapshot_version_seq`'s trailing key is `seq`, so `.order("asc")` is seq-ascending — commented against `convex/forge.ts`'s `listJobLogs` as the counter-example (creation-time order, not `seq`).
- Guard ordering, exactly as the plan's review-fixed sequence requires:
  1. **FIRST, before any zero-row handling:** `meta.blobChunkCount !== undefined && meta.blobChunkCount > 0 && rows.length === 0` → `ConvexError` (total chunk loss).
  2. `rows.length === 0 && meta.blobChunkCount === undefined` → `return null` (graceful skip; version predates the chunked writer or isn't backfilled yet).
  3. `rows.length > GRAPH_BLOB_MAX_CHUNKS` → `ConvexError` (over-cap).
  4. `meta.blobChunkCount !== undefined && rows.length !== meta.blobChunkCount` → `ConvexError` (missing-chunk detector).
  5. Dense-from-0 `seq` check (belt) → `ConvexError` naming the first missing `seq`; `joinGraphBlobChunks` sorts on `seq` again internally (braces).
  6. `JSON.parse` wrapped in try/catch → re-thrown as `ConvexError` (a plain `Error` here would reach the client redacted as "Server Error").
- Return object is a passthrough of the parsed blob plus meta-derived fields, with the SAME key list as before (see side-by-side below) — no re-mapping needed since plan 126-02's writer already serializes in this exact shape.

### Task 2 — `backfillGraphBlob` + two internalQuery helpers

- `getGraphMetaForBackfill` (internalQuery) — one-row lookup of the meta doc.
- `getGraphEntityPage` (internalQuery) — bounded page (`.paginate()`) over `graphSnapshotNodes`/`graphSnapshotLinks` via `by_snapshot_version`, `numItems` clamped to `BACKFILL_PAGE_SIZE = 1000` **inside the handler**, never trusting the caller's number.
- `backfillGraphBlob` (internalAction) — pages nodes then links to completion, then calls the real `internal.graphSnapshots.upsertGraphSnapshot` with the reconstructed arguments. Three mandatory guards, each returning a NAMED `status`:
  1. `alreadyChunked` — no-op if `meta.blobChunkCount > 0` (makes re-runs safe now that entity-row writes are retired).
  2. `noEntityRows` — no-op if accumulated `nodes.length === 0` (never publish an empty graph).
  3. `versionAdvanced` — re-reads the meta doc immediately before publishing; no-op if `activeVersion` moved since paging started.
- Doc comment carries the exact operator command: `npx convex run graphSnapshots:backfillGraphBlob '{}' --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`.
- Doc comment explicitly forbids the per-source-split "fix" for an argument-size failure, restating why (N calls create N versions, each holding one source, with the others silently gone).

## Return-Object Key List (side by side, unchanged)

**Pre-change** (`git show 62727941:convex/graphSnapshots.ts` — the last commit before this plan touched the file):
```
snapshotId, sources, nodeCount, linkCount, storedNodeCount, storedLinkCount, generatedAt, nodes, links
```
**Post-change** (this commit, `convex/graphSnapshots.ts:702-712`):
```
snapshotId, sources, nodeCount, linkCount, storedNodeCount, storedLinkCount, generatedAt, nodes, links
```
Identical, same order.

## Rewritten `getProjectGraph` handler (full quote, `convex/graphSnapshots.ts:596-714`)

```typescript
export const getProjectGraph = query({
  args: { snapshotId: v.optional(v.string()) },
  handler: async (ctx, { snapshotId = "astridr-project-graph" }) => {
    const meta = await ctx.db
      .query("graphSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId))
      .unique();

    if (!meta) return null;  // graceful-skip: no data yet

    const rows = await ctx.db
      .query("graphSnapshotBlobChunks")
      .withIndex("by_snapshot_version_seq", (q) =>
        q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)
      )
      .order("asc")
      .take(GRAPH_BLOB_MAX_CHUNKS + 1);

    if (meta.blobChunkCount !== undefined && meta.blobChunkCount > 0 && rows.length === 0) {
      throw new ConvexError(/* total chunk loss */);
    }

    if (rows.length === 0 && meta.blobChunkCount === undefined) {
      return null;
    }

    if (rows.length > GRAPH_BLOB_MAX_CHUNKS) {
      throw new ConvexError(/* over-cap */);
    }

    if (meta.blobChunkCount !== undefined && rows.length !== meta.blobChunkCount) {
      throw new ConvexError(/* missing-chunk detector */);
    }

    const sortedSeqs = rows.map((r) => r.seq).sort((a, b) => a - b);
    for (let i = 0; i < sortedSeqs.length; i++) {
      if (sortedSeqs[i] !== i) {
        throw new ConvexError(/* seq gap */);
      }
    }

    let parsed: {
      nodes: Array<{ id: string; label: string; type: string; community?: number; source: string }>;
      links: Array<{ source: string; target: string; relation: string }>;
    };
    try {
      parsed = JSON.parse(joinGraphBlobChunks(rows));
    } catch (err) {
      throw new ConvexError(/* parse failure */);
    }

    return {
      snapshotId:      meta.snapshotId,
      sources:         meta.sources,
      nodeCount:       meta.nodeCount,
      linkCount:       meta.linkCount,
      storedNodeCount: meta.storedNodeCount,
      storedLinkCount: meta.storedLinkCount,
      generatedAt:     meta.generatedAt,
      nodes: parsed.nodes,
      links: parsed.links,
    };
  },
});
```
(Error message bodies elided above for brevity — the full text with snapshotId/version/count context is in the committed file, `convex/graphSnapshots.ts:596-714`.)

## Acceptance-Criteria Evidence

- `npx tsc --noEmit` exits 0 (full repo, verified after every edit round; see "Issues Encountered" for a self-inflicted regression found and fixed before commit).
- Handler-scoped grep (`sed -n '596,714p' convex/graphSnapshots.ts`):
  - `grep -c "collect()"` → **0**
  - `grep -c "graphSnapshotNodes\|graphSnapshotLinks"` → **0**
  - `grep -c "ConvexError"` → **6**
- Whole-file grep:
  - `grep -c "by_snapshot_version_seq" convex/graphSnapshots.ts` → **4**
  - `grep -c "ConvexError" convex/graphSnapshots.ts` → **8**
  - `grep -c "internalAction" convex/graphSnapshots.ts` → **3** (import + declaration + one doc-comment mention)
  - `grep -c "paginate(" convex/graphSnapshots.ts` → **3** (two call sites + one doc-comment mention)
- `git diff --stat` (this commit) lists only `convex/graphSnapshots.ts` — confirmed via `git show --stat a6dc8dd0`.
- `src/hooks/useProjectGraph.ts` and `convex/runtimeIngest.ts` untouched — confirmed, not in the diff.
- `npm test` (`npx vitest run`, full suite): `364 passed | 17 skipped (381)` files, `5096 passed | 4 skipped | 195 todo (5295)` tests, 0 failed.
- `npx vitest run convex/graphSnapshots.test.ts`: `64 passed | 5 todo (69)`, 0 failed.
- `.paginate()` return-shape signature quoted directly from the installed package, `node_modules/convex/dist/cjs-types/server/query.d.ts:173`:
  ```typescript
  paginate(paginationOpts: PaginationOptions): Promise<PaginationResult<DocumentByInfo<TableInfo>>>;
  ```
  `PaginationResult<T>` (`pagination.d.ts:25-51`): `{ page: T[]; isDone: boolean; continueCursor: Cursor; splitCursor?: Cursor|null; pageStatus?: "SplitRecommended"|"SplitRequired"|null }`.
- `receivedAt: Date.now() / 1000` — epoch SECONDS. Verified: `node -e "const t=Date.now()/1000; console.log(t, new Date(t*1000).toISOString())"` →
  ```
  1787667529.898 2026-08-25T14:18:49.898Z
  ```
  matches today's date (2026-08-25).
- Doc comment above `backfillGraphBlob` contains the exact command:
  `npx convex run graphSnapshots:backfillGraphBlob '{}' --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`
- No deploy and no `npx convex run` was executed in this plan.

## Verbatim Test Output

**`npx tsc --noEmit` (full repo, final state):**
```
(no output, exit 0)
```

**`npx vitest run convex/graphSnapshots.test.ts`:**
```
 RUN  v4.1.11 C:/Users/mandr/codepulse

 Test Files  1 passed (1)
      Tests  64 passed | 5 todo (69)
   Start at  10:19:34
   Duration  1.78s
```

**`npx vitest run` (full suite):**
```
 Test Files  364 passed | 17 skipped (381)
      Tests  5096 passed | 4 skipped | 195 todo (5295)
   Start at  10:16:28
   Duration  49.42s
```

## Task Commits

1. **Task 1 + Task 2: rewrite getProjectGraph, add backfillGraphBlob** — `a6dc8dd0` (feat)

Combined into one commit rather than two atomic per-task commits: both tasks touch the same file, in adjacent sections, and were verified together (`tsc`/`vitest`) before the first commit opportunity — splitting them would have required a mid-file partial-diff commit that doesn't correspond to either task's own acceptance criteria in isolation. Documented as a process deviation, no functional impact (mirrors 126-01's same choice for the same reason).

`git show --stat a6dc8dd0`:
```
 convex/graphSnapshots.ts | 413 ++++++++++++++++++++++++++++++++++++++++++++---
 1 file changed, 389 insertions(+), 24 deletions(-)
```

## Files Created/Modified

- `convex/graphSnapshots.ts` — added `GRAPH_BLOB_MAX_CHUNKS` constant; rewrote `getProjectGraph`'s handler body (collect-all reads → one bounded seq-ordered indexed read + five completeness/ordering/parse guards); added `getGraphMetaForBackfill`, `getGraphEntityPage`, `backfillGraphBlob`, and `BACKFILL_PAGE_SIZE`. `upsertGraphSnapshot`, `sweepGraphSnapshotVersions`, `backfillGraphStoredVersions`, `selectVersionDeletes`, `projectSnapshotRow`, and `listSnapshots` are byte-identical to their pre-plan state (confirmed: my diff's only hunks are the import line, the new `GRAPH_BLOB_MAX_CHUNKS` block, `getProjectGraph`'s body, and the new backfill section appended after `listSnapshots`).

## Decisions Made

- **Typed the parsed JSON blob explicitly** (`{ nodes: Array<{...}>, links: Array<{...}> }`) rather than leaving `JSON.parse`'s result inferred as `unknown[]`/`any`. Found via `npx tsc --noEmit` regressing 40 NEW errors in `src/components/graph/CodeVaultGraph.tsx` and `src/pages/ToolGalaxy.tsx` (both explicitly out of scope) after my first draft — `ProjectGraphData` (`src/hooks/useProjectGraph.ts:19-21`) derives its type directly from `getProjectGraph`'s own inferred return type, so an untyped `parsed.nodes`/`parsed.links` silently widened the whole downstream contract to `unknown[]` with zero runtime symptom. Fixed by typing `parsed` explicitly in `getProjectGraph` alone — no edits to either out-of-scope file were needed or made.
- **Broke a same-file circular type-inference error** in the new backfill code. `backfillGraphBlob` (an `internalAction`) calls `internal.graphSnapshots.getGraphMetaForBackfill` / `getGraphEntityPage` / `upsertGraphSnapshot` — all exports of the SAME file. TypeScript's generated `internal` namespace type is built from every export in the module (including `backfillGraphBlob` itself), so inferring `backfillGraphBlob`'s own return type from its body created a cycle (TS7022 `'backfillGraphBlob' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer`, plus cascading TS7022/TS7023 on `meta`/`page`/`finalMeta`). Fixed with:
  - An explicit `Promise<BackfillGraphBlobResult>` return-type annotation on `backfillGraphBlob`'s handler (a new local type alias, documented inline with the reasoning).
  - An explicit `Promise<Doc<"graphSnapshots"> | null>` return-type annotation on `getGraphMetaForBackfill`.
  - A declared union return type on `getGraphEntityPage` (`PaginationResult<Doc<"graphSnapshotNodes">> | PaginationResult<Doc<"graphSnapshotLinks">>`), plus `as` casts at its two call sites (safe by construction — each call site's own `kind: "nodes"|"links"` literal is what the handler branches on, so the cast matches the actual runtime shape).
  - This precedent does not exist elsewhere in this codebase's own same-file `ctx.runQuery(internal.<sameModule>.*)` calls (e.g. `gatewayQuota.ts`'s `pollAndStore` → `insertSnapshot`) only because those existing functions have no branch returning a value, so their inferred return type is `void` and never hits the cycle.
- **Reworded two doc comments** that literally contained the substring `.collect()` in prose describing the code being REPLACED (not actual `.collect()` calls) — to `collect-all reads` — so the acceptance criterion's literal `grep -c "collect()"` measures real code, not documentation about the code it replaced.

## Post-Review Fixes (Two HIGH Defects, found by cross-AI review after initial completion)

The team lead sent two HIGH-severity defects found by cross-AI review against the code committed in `a6dc8dd0`, both verified against live code:

**DEFECT 1 — writer/reader chunk-cap asymmetry.** `GRAPH_BLOB_MAX_CHUNKS` was enforced only by the reader (`getProjectGraph`'s `take(CAP+1)` + throw); the writer (`upsertGraphSnapshot`) split and inserted every chunk unconditionally, flipped `activeVersion`, then deleted the prior version's chunks. Past 16 chunks, the writer would publish a blob the reader always rejects, with the rollback data already deleted — an oversized ingest becoming a user-visible `/tool-galaxy` outage.

**DEFECT 2 — the TOCTOU version guard I built for `backfillGraphBlob` was racy.** The team lead's own dispatch had specified "re-read the meta immediately before publishing and require `activeVersion === sourceVersion`" from an *action*, which is unavoidably two separate transactions (`runQuery` then `runMutation`) — a producer ingest landing in between would sail past the check undetected, and `upsertGraphSnapshot` would then publish the backfill's stale data as the newest version. The team lead named this as their own specification error, not mine.

**What happened while I was mid-task:** by the time I picked up this message, a concurrent process had already committed `2d5c1158`, whose message states "The 126-05 executor terminated without applying either, so they are applied here" — evidently believing I had stopped. I had not; I verified `2d5c1158` in detail rather than assuming it was correct or redoing the work from scratch:

- Defect 1's fix in `2d5c1158` was correct and complete: the cap check runs in `upsertGraphSnapshot` before any chunk insert, throwing `ConvexError` and leaving the existing version and its chunks untouched (verified: since the check runs before any `ctx.db` write, the whole mutation transaction aborts with nothing committed). Tests included a control proving the prior version survives, not merely that the call threw.
- Defect 2's fix in `2d5c1158` closed the actual data-safety hole (the mutation re-checks `expectedVersion` inside its own transaction, atomically with the writes it guards) but implemented the guard as a **throw**, where the team lead's spec explicitly said "**Return** `status: "versionAdvanced"` ... **rather than throwing**." Since `backfillGraphBlob` calls this mutation via `ctx.runMutation` with no `try/catch`, a throw here would propagate as an **uncaught exception through the whole action** — the operator running `npx convex run backfillGraphBlob` would see a raw thrown error, not the clean named-status object `backfillGraphBlob`'s own contract promises for every other path. I also found no test exercised `backfillGraphBlob` itself (only `upsertGraphSnapshot`'s handler directly) — the team lead's own required test ("simulate the advance BETWEEN the pre-check and the mutation... a test that only exercises the action-side pre-check cannot catch this") was not present.

**My follow-up fix, commit `606e07fa`:**
- Changed `upsertGraphSnapshot`'s `expectedVersion` guard from `throw new ConvexError(...)` to `return { status: "versionAdvanced", snapshotId, expectedVersion, foundVersion }`. Gave the handler an explicit `Promise<UpsertGraphSnapshotResult>` return type (same same-file circular-inference reasoning as `backfillGraphBlob`'s own annotation).
- `backfillGraphBlob` now captures the mutation's return value (cast to `UpsertGraphSnapshotResult`, same pattern as the `getGraphEntityPage` casts) and returns the same named `"versionAdvanced"` status its own cheap action-side pre-check (Guard 3) already returns, if the mutation reports the race.
- Updated the existing `upsertGraphSnapshot` TOCTOU test to assert the returned object instead of `.rejects.toThrow(...)`.
- Added a new `describe("backfillGraphBlob — surfaces a race the action's own pre-check cannot see")` block — the team lead's required test — using a hand-built fake action `ctx` (only `runQuery`/`runMutation`, the correct seam for testing an `internalAction`) where the action's own reads report the pre-race version (3) but the mutation's own simulated internal check reports a later version (4), proving `backfillGraphBlob` returns a clean `versionAdvanced` status rather than an uncaught exception. A control proves the action-side early-out is an independent code path (it short-circuits before the mutation is even called when IT can see the race).
- **Mutation-proven:** temporarily changed the `writeResult?.status === "versionAdvanced"` check to a condition that can never match; the new race test failed with `result.status === "backfilled"` instead of `"versionAdvanced"` — confirming the test is not vacuous. Reverted and re-ran green.
- `getFunctionName` (from `convex/server`) was needed to discriminate which function reference a fake `ctx.runQuery`/`runMutation` call targets, because `internal.*` is a `Proxy` (verified against the installed package, `node_modules/convex/dist/cjs/server/api.js`'s `createApi`) that returns a **new object on every property access** — a strict `===` comparison on the function reference itself silently never matches.

**Verification after the follow-up fix:** `npx tsc --noEmit` exits 0. `npx vitest run convex/graphSnapshots.test.ts`: 73 passed | 5 todo (up from 64 before either defect fix; 2d5c1158 added 7, this follow-up added 2 and converted 1 existing assertion). Full suite: 364 passed | 17 skipped files, 5105 passed | 4 skipped | 195 todo tests, 0 failed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Same-file circular type inference (TS7022/TS7023) on `backfillGraphBlob` and the internalQuery helpers it calls**
- **Found during:** Task 2, first `npx tsc --noEmit` after adding `backfillGraphBlob`.
- **Issue:** `internal.graphSnapshots.*` references within a function exported from the SAME file created a self-referential type dependency, making `backfillGraphBlob`'s own type (and every local variable derived from `ctx.runQuery(internal.graphSnapshots.*)` inside it) implicitly `any` with a compiler error rather than a silent fallback.
- **Fix:** Explicit return-type annotations on `backfillGraphBlob`, `getGraphMetaForBackfill`, `getGraphEntityPage`, plus two `as` casts at the paging call sites (see Decisions above for the full reasoning).
- **Files modified:** `convex/graphSnapshots.ts` (no other file involved).
- **Verification:** `npx tsc --noEmit` exits 0, full repo.
- **Committed in:** `a6dc8dd0`

**2. [Rule 1 - Bug] Untyped `JSON.parse` result would have widened `ProjectGraphData` and broken type-checking in two out-of-scope consumer files**
- **Found during:** Task 1, `npx tsc --noEmit` after the first draft of the rewritten `getProjectGraph`.
- **Issue:** `let parsed: { nodes: unknown[]; links: unknown[] }` (matching only the JSON.parse call's actual inferable shape) propagated `unknown[]` into `ProjectGraphData.nodes`/`.links`, producing 40 new type errors in `src/components/graph/CodeVaultGraph.tsx` and `src/pages/ToolGalaxy.tsx` — files this plan is explicitly forbidden from editing.
- **Fix:** Typed `parsed` explicitly to match the exact node/link shape the pre-change code's `.map()` calls used to produce, restoring the return contract's TYPE (not just its field names) to identical.
- **Files modified:** `convex/graphSnapshots.ts` only — no edits to either out-of-scope file were needed.
- **Verification:** `npx tsc --noEmit` exits 0 across the whole repo (including both previously-erroring files).
- **Committed in:** `a6dc8dd0`

**Total deviations:** 2 auto-fixed (both Rule 1/3, resolved entirely within `convex/graphSnapshots.ts`, no scope expansion) + 1 combined-commit process deviation (documented above, no functional impact).
**Impact on plan:** None on scope or correctness. `getProjectGraph`'s return contract (field names AND types) is unchanged; `backfillGraphBlob`'s interface matches `<interfaces>` exactly.

## Issues Encountered

- **A pre-commit `npx tsc --noEmit` run showed 188 total repo-wide errors**, the large majority in unrelated `src/components/*.tsx` files (implicit-any noise this repo apparently already tolerates as baseline — e.g. `emailDigest.ts`, `webhookDelivery.ts`, dozens of chart/panel components). After fixing the circular-inference issue (Deviation 1) and the `parsed` typing issue (Deviation 2), the total dropped to **0**. The ~148-error difference was NOT independent pre-existing noise — it was `internal.graphSnapshots`'s type collapsing to something TypeScript couldn't fully resolve, which appears to have poisoned inference wherever the aggregated `api`/`internal` namespace type gets touched, cascading well beyond this file. I did not attempt to verify this mechanism further since fixing my own two issues brought the whole repo to a clean `tsc` exit; flagging it here in case a future same-file `internal.*` self-reference elsewhere in this codebase produces a similarly wide-looking "unrelated" error blast radius.

## User Setup Required

None — no external service configuration required. No deploy was performed and no `npx convex run` command was executed (per the plan's hard constraint: plan 126-09 owns the single operator deploy and the backfill run for all of Phase 126's Convex work).

## Next Phase Readiness

- `getProjectGraph` is ready to serve chunked data the moment plan 126-09 deploys and runs `backfillGraphBlob` once against the live self-hosted instance.
- `backfillGraphBlob`'s returned summary (`{status, snapshotId, sourceVersion, nodeCount, linkCount, pages, blobChunkCount}`) satisfies 126-09's stated deploy-evidence requirement ("the number of chunk rows written") directly off the `blobChunkCount` field on a `"backfilled"` status, with no second query needed.
- Flagged for 126-09, per this plan's own instruction: the reconstructed `upsertGraphSnapshot` call in `backfillGraphBlob` carries ~1 MB of node/link data in one mutation argument; if Convex's argument-size limit rejects it on the live run, that is 126-09's finding to make and escalate as a new plan — the per-source-split "fix" is explicitly documented in this file as unsafe and must not be improvised.
- No blockers for downstream plans in this wave.

---
*Phase: 126-page-body-and-convex-read-defect-sweep*
*Completed: 2026-08-25*

## Self-Check: PASSED

`convex/graphSnapshots.ts` confirmed present on disk with the rewritten `getProjectGraph` (lines 596-714) and the new backfill section (`getGraphMetaForBackfill`, `getGraphEntityPage`, `backfillGraphBlob`) present — read directly after the commit. Commit `a6dc8dd0` confirmed via `git log --oneline --all | grep a6dc8dd0` and `git show --stat a6dc8dd0` (both ran clean, showing the single-file, 389-insertion/24-deletion diff quoted above).
