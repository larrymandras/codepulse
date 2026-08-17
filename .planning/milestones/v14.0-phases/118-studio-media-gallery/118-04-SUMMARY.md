---
phase: 118-studio-media-gallery
plan: 04
subsystem: database
tags: [convex, query, mutation, storage, self-hosted, vitest]

requires:
  - phase: 118-01
    provides: "D-01 resolved BRANCH: convex-storage — media.thumbStorageId is the populated field, verified via a control-paired live storage round-trip"
  - phase: 118-03
    provides: "media/mediaStyles/mediaModels tables live on the self-hosted Convex backend, with by_contentHash/by_createdAt/by_deletedAt/by_kind indexes"
provides:
  - "convex/media.ts: list/listTrash/listStyles/listModels bounded queries, all take(500)-capped"
  - "One resolveThumbnailUrl helper implementing D-01 transport neutrality, called from list/listTrash/listStyles"
  - "deriveHasProvenance pure D-07 boolean — provenance-absence sentinel produced at render time (118-10), never stored"
  - "toggleStar/softDelete/restore as deliberately PUBLIC mutations (D-08 browser half), each patching exactly one field"
  - "convex/media.test.ts — 13 passing tests + 1 named it.todo for 118-05's public/internal split control"
affects: [118-05, 118-06, 118-09, 118-10]

tech-stack:
  added: []
  patterns:
    - "handler/export split (plain async function + thin query({})/mutation({}) wrapper), same shape as convex/loom.ts and convex/galdr.ts, so every export is unit-testable without booting the Convex runtime"
    - "q.eq(field, undefined) / q.gt(field, undefined) on an optional-field index to select absent/present rows — the same idiom convex/controlVerbSwaps.ts:116 already establishes in this repo"
    - "single branch-neutral resolver helper for a multi-transport field (D-01), called from every read path rather than inlined per query"

key-files:
  created:
    - convex/media.ts
    - convex/media.test.ts
    - .planning/phases/118-studio-media-gallery/118-04-SUMMARY.md
  modified: []

key-decisions:
  - "No-provenance sentinel ('No provenance recorded') is produced at the RENDERING layer (118-10), never by this module — the query returns raw undefined fields plus a derived hasProvenance boolean, exactly as the plan's recommended choice specified. Confirmed, not overridden."
  - "resolveThumbnailUrl returns null for a row carrying only thumbRelPath (the unresolved local-static-origin branch) rather than attempting an origin-join with no configured origin — this deployment resolved BRANCH: convex-storage (118-01) and no static origin exists to join against."
  - "list/listTrash filter via the by_deletedAt index using q.eq/q.gt against undefined (not null, and not a hardcoded numeric bound for the trash case), then re-sort the already-capped batch by the schema's own createdAt/deletedAt field in memory for exact ordering, since Convex index .order() only sorts by the index's own key fields."
  - "toggleStar/softDelete/restore stay plain mutation(), never internalMutation() — per CLAUDE.md's SEED-008 decision and 118-CONTEXT.md's auth_model instruction, explicitly not revisited in this plan."

requirements-completed: [D-01, D-02, D-07, D-08]

duration: ~6min (task-commit span 16:02-16:08; excludes the earlier context/plan-reading phase, not separately timestamped)
completed: 2026-08-14
---

# Phase 118 Plan 04: Studio Gallery Read Surface + Browser Write Surface Summary

**`convex/media.ts`'s four bounded gallery/trash/styles/models queries plus the three public star/soft-delete/restore mutations, both built on a single D-01-neutral thumbnail resolver and a pure D-07 provenance-derivation function, with 13 control-paired tests and 2 mutation-proven assertions.**

## Performance

- **Duration:** ~6 min task-commit span (16:02:38–16:08:10 ET); the plan-reading/context phase before the first commit was not separately timestamped
- **Completed:** 2026-08-14
- **Tasks:** 3/3 completed
- **Files modified:** 2 created (`convex/media.ts`, `convex/media.test.ts`)

## Accomplishments

- **Task 1 — Read surface.** `list`, `listTrash`, `listStyles`, `listModels` are all `take(GALLERY_ROW_CAP=500)`-bounded — zero `.collect()` calls in the file (grep-verified). `list`/`listTrash` filter the `by_deletedAt` index with `q.eq("deletedAt", undefined)` / `q.gt("deletedAt", undefined)` (the same "index on `undefined` matches the absent field" idiom `convex/controlVerbSwaps.ts:116` already establishes here), then re-sort the already-capped batch by `createdAt`/`deletedAt` in memory since Convex's `.order()` only sorts by the chosen index's own key fields. `resolveThumbnailUrl` is defined exactly once and called from three sites (`list`, `listTrash`, `listStyles` — grep-verified 1 definition + 3 call sites).
- **Task 2 — Browser write surface.** `toggleStar`/`softDelete`/`restore` are plain `mutation()`, never `internalMutation()` (grep-verified: 3 `= mutation({` matches, 0 `internalMutation(` matches). Each `ctx.db.patch` call names exactly one field (`starred` or `deletedAt` — quoted below). `softDelete`/`restore` are idempotent: an already-set/-cleared `deletedAt` triggers an early return with **no** `patch` call, so repeated clicks cannot extend the 30-day grace period (T-118-15). All three refuse with `ConvexError({code:"NOT_FOUND"})` on a missing row, never a bare `Error`.
- **Task 3 — Tests.** `convex/media.test.ts`: 13 passing tests + 1 named `it.todo` (referencing `118-05`), organized in 4 `describe` blocks matching the plan's required techniques (pure-function D-07 control pair with an adversarial prompt-shaped filename; fake-`ctx.storage` D-01 branch-neutrality tests including the dead-field control; mock-`ctx.db` D-08 mutation-half tests with `patch`-not-called controls for both idempotency guards and both `toggleStar` directions; source-level Pitfall-4 declaration check). Mutation-tested two assertions — both went RED, reverted, confirmed GREEN with an empty `git diff`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gallery/Trash/Styles/Models queries** — `49202ba1` (feat)
2. **Task 2: toggleStar/softDelete/restore public mutations** — `a66bc70c` (feat)
3. **Task 3: convex/media.test.ts control-paired tests** — `66ec5798` (test)

Each commit verified post-commit with `git show --stat HEAD`: every commit touched only `convex/media.ts` or `convex/media.test.ts`, no accidental sweeps from the concurrent session active in this checkout today.

## Files Created/Modified

- `convex/media.ts` — four bounded queries (`list`, `listTrash`, `listStyles`, `listModels`), `resolveThumbnailUrl` (D-01), `deriveHasProvenance` (D-07), three public mutations (`toggleStar`, `softDelete`, `restore` — D-08)
- `convex/media.test.ts` — 13 tests + 1 `it.todo`, no runtime deploy

## Decisions Made

- **No-provenance sentinel produced at the rendering layer, not here.** Per the plan's own recommended choice: this module returns raw `undefined` fields plus a derived `hasProvenance` boolean; the literal string `"No provenance recorded"` is plan 118-10's job. Rationale (also written as an in-file comment): a Convex row storing the sentinel as data would be indistinguishable from a real prompt whose text happens to match it, and would poison the `Missing Provenance` filter chip.
- **`resolveThumbnailUrl` does not attempt a `thumbRelPath` origin-join.** `118-D01-EVIDENCE.md` resolved `BRANCH: convex-storage` live in plan 118-01 — no static origin exists on this deployment to join `thumbRelPath` against, so a row carrying only that field resolves to `null` (broken-thumbnail placeholder) rather than fabricating a URL from an unpopulated field. Verified by a control test asserting `ctx.storage.getUrl` is NOT called in that case.
- **`toggleStar`/`softDelete`/`restore` stay public `mutation()`.** Per `118-CONTEXT.md`'s `<auth_model priority="critical">` instruction and CLAUDE.md's SEED-008 decision — not revisited, not flagged as a vulnerability, and the file itself carries the split rationale at the seam (naming `ingestMedia`, the upload-URL generator, and the janitor as the functions that must be `internalMutation` in 118-05).

## Deviations from Plan

None — plan executed as written. The one place this plan's own text left an open call ("Decide and document where the sentinel is produced... If you choose otherwise, state why") was resolved by taking the plan's own recommended choice, which is not a deviation.

## Mutation-Proof Evidence (Task 3 acceptance criterion)

Two assertions broken, confirmed RED, reverted from a scratchpad backup (`cp`, never `git checkout --`, per this repo's own lesson about that command discarding uncommitted work), confirmed GREEN again with an empty `git diff convex/media.ts`.

**Mutation 1 — `deriveHasProvenance`'s `||` changed to `&&`:**
```
FAIL  convex/media.test.ts > D-07: hasProvenance is derived, never inferred from the filename > false when prompt/model/provider are all absent (adversarial filename); true when prompt+model are present (control) — asserted together
AssertionError: expected false to be true // Object.is equality
 ❯ convex/media.test.ts:62:46
```

**Mutation 2 — `softDelete`'s idempotency early-return removed:**
```
FAIL  convex/media.test.ts > D-08: toggleStar / softDelete / restore > softDelete on an already-deleted row patches NOTHING (control — call count, not truthy return)
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
 ❯ convex/media.test.ts:140:23
```

Post-revert: `npx tsc --noEmit` exits 0; `npx vitest run convex/media.test.ts` → 13 passed | 1 todo; `git diff --stat convex/media.ts` empty.

## `ctx.db.patch` call sites (Task 2 acceptance criterion — quoted verbatim)

```
299:  await ctx.db.patch(args.id, { starred: !existing.starred });
327:  await ctx.db.patch(args.id, { deletedAt: Date.now() });
345:  await ctx.db.patch(args.id, { deletedAt: undefined });
```

Each names exactly one field.

## `npm test` Before/After (full suite)

- **Before** (118-03 baseline, quoted from `118-03-SUMMARY.md`): **4407 passed | 0 failed** (324 test files passed, 17 skipped; 197 todo)
- **After** (this plan): **4435 passed | 0 failed** (326 test files passed, 17 skipped; 198 todo)

The +28 tests / +2 files exceed this plan's own +13 tests / +1 file (`media.test.ts`) because `118-07`'s `hooks/__tests__/studioWatch.test.mjs` landed in the same interval (`535f4966`, `1d48017f`). Nothing this plan touched broke; 0 failed both before and after.

**Attribution corrected by the orchestrator 2026-08-14.** This paragraph originally credited those `118-07` commits to "the concurrent session active in this checkout." That is **wrong**: `118-07` is a plan of THIS phase, executed by this phase's own wave-2 executor, and its commits are part of the Phase 118 record. The inference was reasonable from inside a fresh executor context — the commits genuinely did appear mid-session and were not this plan's — but it is a provenance error, and left standing it would tell a later reader (or the phase verifier) that another workstream built part of Phase 118. The concurrent session is real and *is* active in this checkout, but its only commit today is `0f29a778` (`src/components/EStopButton.tsx`), which is unrelated to this phase and swept nothing.

## Issues Encountered

**Plan-defect correction (not a code bug):** the plan's Task 1 acceptance criterion `grep -c "\.collect()" convex/media.ts` returns 0 is literal-string matching, blind to comments vs. code. My first draft's own doc-comments referenced `.collect()` in prose (explaining why the file avoids it), which the literal grep counted as 2 hits against a check expecting 0. Reworded the comments to describe the same rationale without the literal substring (`"reading the whole table unbounded"` instead of `` `.collect()`-ing the whole table ``) rather than treating the check as wrong — the check's intent (verify no unbounded reads) was correct; only my own prose tripped its literal implementation.

## User Setup Required

None — no external service configuration required, no deploy performed (per the plan's explicit "this plan does not deploy" — 118-05 deploys the module once).

## Next Phase Readiness

- `convex/media.ts` is typecheck-clean (`npx tsc --noEmit` exits 0) and fully tested, but **not yet deployed** — plan 118-05 adds `ingestMedia`, the thumbnail `generateUploadUrl` wrapper, and the janitor's permanent-delete as `internalMutation`s in this same file, then deploys the whole module once.
- 118-05's Task list should include converting `media.test.ts`'s Pitfall-4 `it.todo` into a real assertion once an `internalMutation(` export exists in the file — the `it.todo` title already names `118-05` explicitly for discoverability.
- `resolveThumbnailUrl`, `deriveHasProvenance`, `toggleStarHandler`, `softDeleteHandler`, `restoreHandler` are all exported plain functions, ready for 118-09/118-10's UI layer to import for client-side logic reuse if needed (though the UI-SPEC's contract is that the UI never re-derives `hasProvenance` — it consumes the query's own field).
- No modifications were made to `.planning/STATE.md` or `.planning/ROADMAP.md` — the orchestrator should update those.

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-14*
