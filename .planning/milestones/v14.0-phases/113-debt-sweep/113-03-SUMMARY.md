---
phase: 113-debt-sweep
plan: 03
subsystem: ui
tags: [react, convex, skills, origin-split, tech-debt]

# Dependency graph
requires:
  - phase: 113-01
    provides: "hooks/skillScan.mjs: PLUGIN_ORIGIN (\"claude-code:plugin\") isolates plugin skills from the personal claude-code origin"
  - phase: 113-02
    provides: "convex/skillSync.ts + convex/registry.ts: server-side prune guard protecting undeclared origins"
provides:
  - "src/lib/skills.ts: PLUGIN_ORIGIN constant + all four D-17 sites (resolveLifecycleActions, resolveScopeDrop x2, originLabel) accept claude-code:plugin with parity to claude-code"
  - "src/components/OriginBadge.tsx: BADGE_STYLES['claude-code:plugin'] entry renders a distinct 'Plugin' badge"
  - "src/components/skills/SkillLifecycleMenu.tsx: scopeLabel maps claude-code:plugin to 'global'"
  - "src/pages/Skills.tsx: isGlobalOrigin file-local helper — Global chip filter + count include plugin-origin skills"
affects: [113-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "File-local named-predicate-per-site for a new origin variant, not a shared cross-file isGlobalOrigin() extraction (D-17's explicit rejected-alternative) — each of the 4 skills.ts sites and Skills.tsx's isGlobalOrigin are independently editable, following skills.ts's own DORMANT_ORIGIN/PROJECT_PREFIX precedent"
    - "Control-first regression test: write the test against the UNMODIFIED file, capture its failure verbatim, only then apply the fix — used for the Skills.tsx Global-chip regression"

key-files:
  created:
    - src/components/OriginBadge.test.tsx
    - src/pages/Skills.test.tsx
  modified:
    - src/lib/skills.ts
    - src/lib/skills.test.ts
    - src/components/OriginBadge.tsx
    - src/components/skills/SkillLifecycleMenu.tsx
    - src/components/skills/SkillLifecycleMenu.test.tsx
    - src/pages/Skills.tsx

key-decisions:
  - "Task 3's isGlobalOrigin helper mirrors Skills.tsx's own pre-existing isProjectOrigin multi-value idiom (file-local, not shared) — matches D-17's explicit rejection of a cross-file isGlobalOrigin() extraction; this is a same-file, same-shape helper for the SAME two call sites within Skills.tsx, not the rejected cross-file predicate"
  - "Skills.test.tsx's mock useQuery must return REFERENTIALLY STABLE arrays for every unmatched query path (a shared STABLE_EMPTY const, never a fresh [] literal per call) — several hooks in the page's tree (useIntakeFeed, useForgeHostsRaw, SkillControlSurfaceProvider's useLifecycleCommands) key a useMemo/useEffect off that reference; a fresh array per mock call defeats the memoization and drives an infinite render loop. First harness attempt OOM-crashed the Vitest worker before this fix — see Issues Encountered."

patterns-established:
  - "Origin-literal-as-named-local extended one origin further: PLUGIN_ORIGIN joins DORMANT_ORIGIN/PROJECT_PREFIX in skills.ts as the file's third named origin constant"

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-08-11
---

# Phase 113 Plan 03: Frontend Origin-Coupling Fix (D-17 consumer half) Summary

**All eight verified `"claude-code"`-exact-match coupling sites across `src/lib/skills.ts`, `src/components/OriginBadge.tsx`, `src/components/skills/SkillLifecycleMenu.tsx`, and `src/pages/Skills.tsx` now accept `claude-code:plugin` with byte-identical behaviour parity, closing the ~57-skill Global-tab disappearance that 113-01's origin split would otherwise cause once 113-04 migrates the live table.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-11T14:53:00-04:00
- **Completed:** 2026-08-11T15:07:40-04:00
- **Tasks:** 3
- **Files modified:** 8 (6 modified, 2 created)

## Accomplishments

- `src/lib/skills.ts`: added file-local `PLUGIN_ORIGIN = "claude-code:plugin"` constant beside `DORMANT_ORIGIN`/`PROJECT_PREFIX`; `resolveLifecycleActions`'s `moveDestinationIsProject`, `resolveScopeDrop`'s `isActiveGlobal`, and `originLabel` all accept the plugin origin. `resolveScopeDrop`'s archive-enqueue `sourceOrigin` now derives from the skill's own `activeOrigin` instead of a hardcoded `"claude-code"` literal (T-113-11) — closing a data-targeting bug where an archive command could otherwise be enqueued against the wrong origin for every plugin skill.
- `src/components/OriginBadge.tsx`: new `BADGE_STYLES["claude-code:plugin"]` entry renders a distinct "Plugin" badge instead of the prior silent `null` (verified failure mode from 113-PATTERNS.md — `styleFor` returned `undefined` for the unmapped key).
- `src/components/skills/SkillLifecycleMenu.tsx`: `scopeLabel` maps `claude-code:plugin` to `"global"` alongside `claude-code`, proven via the shadow-blocked Restore tooltip's rendered text (the only reachable observable for this private helper).
- `src/pages/Skills.tsx`: new file-local `isGlobalOrigin` helper (mirrors the file's own pre-existing `isProjectOrigin` multi-value idiom) replaces both `.includes("claude-code")` sites — the Global chip's filtered list (`visibleSkills`) and its displayed count (`chipCounts`).
- `src/lib/skillVault.ts` was NOT touched — confirmed via `grep -rn 'claude-code:plugin' src/lib/skillVault.ts` returning nothing; its `classifyOrigin` already falls through any unmapped origin to `"global"` by design.
- No shared cross-file `isGlobalOrigin()` predicate was extracted — every site got its own mechanical, file-local edit, per D-17's explicit rejection of that alternative.

## Task Commits

Each task was committed atomically:

1. **Task 1: Accept the plugin origin in src/lib/skills.ts's four sites (D-17)** — `4425fe03` (feat)
2. **Task 2: Scope label and origin badge accept the plugin origin (D-17)** — `fd4011a2` (feat)
3. **Task 3: Global chip filter and count include plugin skills, control-first (D-17)** — `42ccac28` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `src/lib/skills.ts` — `PLUGIN_ORIGIN` constant; `resolveLifecycleActions`, `resolveScopeDrop`, `originLabel` accept it; fallback comment at the drag matrix's default branch updated
- `src/lib/skills.test.ts` — 5 net new tests (was 50, now 55): `originLabel` plugin-distinctness, `moveDestinationIsProject` parity, `resolveScopeDrop` global/project/cold parity (cold combined with the claude-code non-regression assertion per the plan's instruction), multi-scope rejection with a dual-global-origin fixture
- `src/components/OriginBadge.tsx` — one new `BADGE_STYLES` entry, no other change
- `src/components/OriginBadge.test.tsx` — new file, 4 tests: plugin badge renders, claude-code badge unchanged, project badge unchanged (startsWith branch undisturbed), and the CONTROL — an unrecognized origin still renders nothing
- `src/components/skills/SkillLifecycleMenu.tsx` — `scopeLabel` accepts the plugin origin; JSDoc updated
- `src/components/skills/SkillLifecycleMenu.test.tsx` — 2 net new tests (was 30, now 32): the shadow-blocked Restore tooltip's "global" wording asserted identical for a claude-code-shadowed and a plugin-shadowed fixture
- `src/pages/Skills.tsx` — `isGlobalOrigin` helper; both origin-coupling sites replaced; stale comment at :82-86 updated to name the plugin origin
- `src/pages/Skills.test.tsx` — new file, 3 tests: Global chip list includes both personal and plugin skills (never project), Global count is 2, Project chip is unaffected (count 1, list unchanged)

## Decisions Made

See `key-decisions` in frontmatter. In brief: `isGlobalOrigin` in `Skills.tsx` is a same-file convenience helper for that file's own two call sites (matching the file's existing `isProjectOrigin` shape) — not the cross-file `isGlobalOrigin()` predicate D-17 explicitly rejected extracting. And the Skills.test.tsx mock harness required care around referential stability of mocked `useQuery` return values to avoid an infinite-render OOM (see Issues Encountered).

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria were independently re-verified (grep counts re-run after each edit, full suite green, `tsc --noEmit` clean, every new test mutation-proven) rather than assumed.

## Issues Encountered

- **First Skills.test.tsx harness attempt OOM-crashed the Vitest worker.** The initial mock `useQuery` implementation returned a fresh `[]` literal on every call for unmatched query paths (`api.forge.listHosts`, `api.forge.listIntakeCommands`, `api.forge.listLifecycleCommands`, etc.). Several hooks in the page's component tree (`useIntakeFeed`'s reconciliation `useEffect`, `useForgeHostsRaw`'s `useMemo`, `SkillControlSurfaceProvider`'s `useLifecycleCommands`) key their memoization on that array's *reference*, matching the real Convex `useQuery`'s contract of returning a stable reference when the underlying data hasn't changed. A fresh array per mock call broke that contract: `useIntakeFeed`'s effect (`useEffect(() => setPendingLocal(prev => prev.filter(...)), [serverCommands])`) fired every render because `serverCommands`'s identity changed every time, and `.filter()` on an already-empty array still returns a *new* empty-array reference, so the state update never stabilized — an infinite render loop that exhausted the Node heap (~4GB) before any test result printed. Fixed by hoisting a single shared `STABLE_EMPTY` array constant (and a stable `categories` array) outside the mock's per-call closure, returned by reference on every invocation. Full mutation-proof-equivalent evidence: the OOM reproduced deterministically on the first attempt and vanished immediately after the stability fix, with no other code change.

## User Setup Required

None — no external service configuration required. This plan is frontend-only; no `npx convex` command of any kind was run (no `deploy`, no `env list`), matching the plan's hard constraints.

## Next Phase Readiness

- **DEBT-05 is NOT closed by this plan.** It spans plans 113-01 (producer, complete), 113-02 (server guard, complete), 113-03 (this plan, frontend consumer, complete), and 113-04 (the live-table migration, not yet run). The `requirements-completed` field above is correctly `[]` — do not mark DEBT-05 complete until 113-04 lands.
- The live Convex `skills` table still has 0 rows at `claude-code:plugin` today (188-01's producer split has run locally, but 113-04's migration of the 188 existing `claude-code` rows has not). This plan's fix is validated entirely against synthetic fixtures asserting on code behavior (per the upstream-state note in this plan's dispatch) — it does not and cannot depend on live row counts.
- Once 113-04 migrates the ~57 plugin-sourced rows in the live table, the Skills page's Global tab will correctly include them immediately — no further frontend change is needed; this plan's fix is already live in the codebase.
- `src/lib/skillVault.ts` remains untouched and correct by design (re-confirmed via a fresh grep this session, not merely cited from 113-PATTERNS.md).

## Control Evidence (Task 3, required by the plan)

Per the plan's mandate, `src/pages/Skills.test.tsx` was run against the **UNMODIFIED** `src/pages/Skills.tsx` before any edit was made. It failed exactly as predicted — reproducing the ~57-skill Global-tab disappearance:

```
FAIL src/pages/Skills.test.tsx (3 tests | 2 failed) 85ms
  × Global chip renders BOTH the personal and the plugin skill by name, never the project skill 57ms
  × Global chip's displayed count is 2 for the fixture (1 personal + 1 plugin) 12ms

TestingLibraryElementError: Unable to find an element with the text: plugin-skill. This
could be because the text is broken up by multiple elements. In this case, you can
provide a function for your text matcher to make your matcher more flexible.
 ❯ src/pages/Skills.test.tsx:218:19

Error: expect(element).toHaveTextContent()
Expected element to have text content:
  global:2
Received:
  global:1
 ❯ src/pages/Skills.test.tsx:224:47

Test Files  1 failed (1)
     Tests  2 failed | 1 passed (3)
```

(The one passing test was the Project-chip assertion — untouched by this defect, confirming the control is scoped to exactly the Global chip.) After the fix, the identical three tests all pass — see Mutation Proofs below for the second, targeted mutation confirming the fix itself (not just the pre-fix state) is load-bearing.

## Mutation Proofs

Every new/modified assertion was proven load-bearing: the guarding code was reverted to its pre-fix form, the test was confirmed to fail, then the fix was restored and the suite re-verified green.

**Task 1 (`src/lib/skills.ts`):**
- Mutation A — reverted the archive `sourceOrigin` to the hardcoded literal `"claude-code"`. Result: `resolveScopeDrop: plugin source -> cold enqueues archive...` failed (`sourceOrigin` expected `"claude-code:plugin"`, received `"claude-code"`). Reverted — 55/55 passed.
- Mutation B — reverted `isActiveGlobal` to drop the `PLUGIN_ORIGIN` branch (`activeOrigin === "claude-code"` only). Result: 2 tests failed (the global/project resolveScopeDrop test and the cold/sourceOrigin test), both correctly flipping to `{kind: "noop"}` for the plugin fixture. Reverted — 55/55 passed.

**Task 2:**
- `src/components/OriginBadge.tsx` — deleted the new `BADGE_STYLES["claude-code:plugin"]` entry. Result: `renders a distinct badge for the plugin origin (not null)` failed (`expected null not to be null`). Reverted — 4/4 passed.
- `src/components/skills/SkillLifecycleMenu.tsx` — reverted `scopeLabel` to drop the plugin branch (`origin === "claude-code"` only). Result: `shadowed-by-claude-code:plugin renders the SAME 'global' scope wording` failed (received `"Shadowed by an active claude-code:plugin skill..."` instead of `"...global skill..."`). Reverted — 32/32 passed.

**Task 3 (`src/pages/Skills.tsx`):**
- Reverted `isGlobalOrigin` to `(s) => (s.origins ?? []).some((o) => o === "claude-code")` (dropping the plugin branch). Result: reproduced the exact pre-fix control failure verbatim (plugin-skill absent, count 1 instead of 2; 2 failed, 1 passed). Reverted — 3/3 passed.

## Full-Suite and Type-Check Evidence

- `npx tsc --noEmit` — exits 0 (no output), run after each task's edits and once more after the final revert-and-restore cycle.
- `npx vitest run src/lib/skills.test.ts src/components/OriginBadge.test.tsx src/components/skills/SkillLifecycleMenu.test.tsx src/pages/Skills.test.tsx` — 4 files, 94 tests, all passed.
- `npx vitest run` (full suite) — **304 files passed | 17 skipped (321)**, **4037 tests passed | 193 todo (4230)**, **0 failures**, wall clock **36.17s** (VALIDATION.md baseline: 298 files / 3958 tests / 37.98s — the file/test-count growth reflects 113-01/113-02's own additions plus this plan's, not a regression; wall clock is within the baseline's range).
- `grep -rn 'claude-code:plugin' src/lib/skillVault.ts` — no matches, confirming the file was correctly left untouched.

## Self-Check

- FOUND: src/lib/skills.ts
- FOUND: src/lib/skills.test.ts
- FOUND: src/components/OriginBadge.tsx
- FOUND: src/components/OriginBadge.test.tsx
- FOUND: src/components/skills/SkillLifecycleMenu.tsx
- FOUND: src/components/skills/SkillLifecycleMenu.test.tsx
- FOUND: src/pages/Skills.tsx
- FOUND: src/pages/Skills.test.tsx
- FOUND: .planning/phases/113-debt-sweep/113-03-SUMMARY.md
- FOUND (git log): 4425fe03, fd4011a2, 42ccac28

## Shared-Checkout Note

`.planning/STATE.md` was modified throughout this session by a concurrent session's in-flight work. Per the shared-checkout protocol, it was never staged, touched, or included in any commit made by this plan. Every commit's `git show --stat HEAD` was checked immediately after committing and contained only the intended files. **STATE.md updates are deliberately skipped by this plan** — the orchestrator or a subsequent session should reconcile STATE.md separately. `ROADMAP.md` was updated via `gsd-sdk query roadmap.update-plan-progress 113` and verified with a scoped diff before the final metadata commit.

## Adversarial Verification

A phase-verifier gate run against this plan's HEAD (`f0c94890`) confirmed three defects. All
three are closed by two follow-up commits on top of `f0c94890`; the plan's own scope (eight
frontend sites, D-17) is otherwise unchanged.

### Defect 1 (HIGH, blocked plan 113-04) — `convex/forge.ts` was a ninth coupling site missing from 113-RESEARCH.md's inventory

`convex/forge.ts:517`'s `GLOBAL_ORIGIN = "claude-code"` constant gated two LAYER-1 pre-flight
refusals in `validateLifecyclePreflight` — the shadow refusal (`restore` → `global`, :648) and
the collision refusal (`move` → `global`, :661) — and neither was updated by this plan or any
other 113 plan to recognize `claude-code:plugin`. Once 113-04 migrates the ~57 plugin rows onto
that origin, both backend refusals would have silently stopped firing for plugin-origin skills.
This is the real guard (CLAUDE.md: every public Convex function is callable with no credential;
the frontend check is defense in depth, not the boundary), so this was a genuine, not merely
theoretical, gap.

**Research gap worth surfacing to the phase verifier:** 113-RESEARCH.md's coupling-site
inventory covered only the four `src/lib/skills.ts` sites plus three more across
`OriginBadge.tsx`/`SkillLifecycleMenu.tsx`/`Skills.tsx` (the "eight verified coupling sites" this
plan closed) — it never traced `convex/forge.ts`'s independent, deliberately-duplicated
`GLOBAL_ORIGIN`/`DORMANT_ORIGIN` literals (duplicated *by design*, per the file's own docblock,
because `convex/` does not import from `src/`). A grep for the string `"claude-code"` bounded to
`src/` would miss this entirely; the inventory needed to include `convex/`. Recommend this be
folded into how future origin-taxonomy research passes scope their grep.

**Fix** (`d55d86f8`): added a duplicated `PLUGIN_ORIGIN = "claude-code:plugin"` literal to
`convex/forge.ts` (same pattern as the existing `DORMANT_ORIGIN` duplication — no cross-bundle
import added) and OR'd it into both LAYER-1 guards. Updated the "keep these in sync" docblock to
name all three literals (`GLOBAL_ORIGIN`, `PLUGIN_ORIGIN`, `DORMANT_ORIGIN`) now that it would
otherwise be a false claim about the code beneath it. Added two tests to `convex/forge.test.ts`
mirroring the existing `:956`/`:992` cases with a plugin-origin row. Mutation-proven: reverted
both guard changes, ran `convex/forge.test.ts` — both new tests failed
(`expected [Function] to throw an error`, received `undefined`, i.e. the refusal silently stopped
firing); restored, diffed byte-identical to the pre-revert fix, re-ran — 166/166 passed (up from
164 baseline).

### Defect 2 (MEDIUM) — `src/lib/skills.test.ts:360` vacuous assertion

`expect(resolveScopeDrop(activePlugin, "global")).toEqual({ kind: "noop" })` passed against both
the post-fix code and the genuine pre-fix blob (`git show 4425fe03^:src/lib/skills.ts`) — the
pre-fix unrecognized-origin fallback returns `{kind:"noop"}` unconditionally for *every*
`targetScope`, so this specific assertion could never have caught a regression. Verified by
extracting the real pre-fix source into the repo temporarily (not a re-typed approximation),
importing it from a throwaway test file, and observing `PRE-FIX global: {"kind":"noop"}` —
identical to post-fix.

**Fix** (`8e766b4f`): dropped the vacuous global-target line, keeping only the
`-> project opens the dialog` assertion, which does discriminate: the same pre-fix extraction
produced `PRE-FIX project: {"kind":"noop"}`, not `{kind:"dialog"}`. Added a comment recording why
the global-target case is deliberately absent. The scratch pre-fix file and discrimination test
were deleted after producing the transcript below; neither was committed.

### Defect 3 (MEDIUM) — `src/lib/skills.test.ts:382-388` deleted, not replaced

The `dualGlobal` multiScope test was doubly broken: (1) unreachable — `hooks/skillScan.mjs:218-221`
dedups any name present under both `claude-code` and `claude-code:plugin`, keeping the personal
copy, so no live skill can ever carry both origins; and (2) 100% vacuous even setting reachability
aside — `resolveLifecycleActions`'s `multiScope` is computed purely as
`nonDormantOrigins.length > 1`, with no dependency on which origin strings are present, so it
never depended on the `PLUGIN_ORIGIN` literal this plan introduced. The same pre-fix extraction
confirms this: `PRE-FIX multiScope: true drop: {"kind":"reject","hint":"Active in multiple
scopes — disambiguation ships in a later release."}` — byte-identical to the post-fix result for
the identical fixture.

Because the `multiScope` branch is origin-value-agnostic by construction, **no fixture involving
it can discriminate this fix** — the "replace with a reachable fixture" option offered by the
defect report is not achievable for this branch. The test was therefore **deleted** (`8e766b4f`),
not replaced, and that choice plus its reasoning is recorded here per the defect's own
instruction to state the reason plainly when deleting rather than replacing.

### Discrimination proof transcript (defects 2 and 3)

```
stdout | ... defect 2 control: pre-fix global-target result (was asserted vacuously at :360)
PRE-FIX global: {"kind":"noop"}

stdout | ... defect 2 proof: pre-fix project-target result DIFFERS from post-fix
PRE-FIX project: {"kind":"noop"}

stdout | ... defect 3 control: pre-fix multiScope result ... is BYTE-IDENTICAL to post-fix
PRE-FIX multiScope: true drop: {"kind":"reject","hint":"Active in multiple scopes — disambiguation ships in a later release."}

 Test Files  1 passed (1)
      Tests  3 passed (3)
```

### Verification evidence (post-fix, full suite)

- `npx vitest run convex/forge.test.ts` — 166 passed | 21 todo (187), 0 failed.
- `npx vitest run src/lib/skills.test.ts` — 54 passed (54), 0 failed.
- `npx vitest run` (full suite) — **304 files passed | 17 skipped (321)**, **4038 tests passed |
  193 todo (4231)**, **0 failures**, wall clock 35.41s. Baseline stated in this task's dispatch:
  4037 passed / 304 files. Net +1 matches the arithmetic exactly: +2 new `forge.test.ts` cases
  (defect 1), +0 net in `skills.test.ts` (defect 2 replaced one test with one test), -1 in
  `skills.test.ts` (defect 3's deletion) = +2 -1 = +1.
- `npx tsc --noEmit` — exits 0, no output.

### Commits

- `d55d86f8` — `fix(113-03-verify): forge.ts LAYER-1 shadow/collision guards accept plugin origin`
  (defect 1: `convex/forge.ts`, `convex/forge.test.ts`)
- `8e766b4f` — `test(113-03-verify): fix two vacuous plugin-origin assertions in skills.test.ts`
  (defects 2 and 3: `src/lib/skills.test.ts`)

### DEBT-05 status — unchanged

This verification round does not change DEBT-05's completion status. It still spans 113-01
(complete), 113-02 (complete), 113-03 (this plan, complete, now with defects closed), and 113-04
(not yet run). `requirements-completed` remains correctly `[]` in this file's frontmatter.

---
*Phase: 113-debt-sweep*
*Completed: 2026-08-11*
