---
phase: 122-tokens-primitives-contrast-measurement
plan: 13
subsystem: ui
tags: [react, tailwind-v4, design-tokens, vitest, motion]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "122-09's shared six-state vocabulary (src/lib/metricState.ts, src/hooks/useMetricState.ts) and 122-10's badge law precedent for token-driven arbitrary-value classes"
provides:
  - "MetricCard.tsx rewritten in place to the six-state contract (state prop, default \"ready\")"
  - "Compile-time exhaustiveness guarantee (assertNever) for unhandled MetricState members"
  - "Corpus-derived state-coverage test (renders every key in METRIC_STATE_COPY, not an enumerated list)"
  - "data-testid=\"metric-card\" as MetricCard's stable outer-wrapper test hook, replacing the removed .glow-card selector"
affects: [122-14, 122-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exhaustive switch + assertNever(x: never) for a discriminated-union prop, so an unhandled union member is a tsc compile error, not a silent fallthrough"
    - "getComputedStyle(document.documentElement).getPropertyValue('--token') read-once-at-mount pattern for JS motion config that needs a CSS custom property value (useThemeColors.ts precedent)"

key-files:
  created:
    - src/components/MetricCard.test.tsx
  modified:
    - src/components/MetricCard.tsx
    - src/components/ToolUsagePanel.test.tsx

key-decisions:
  - "No replacement --shadow-* token invented for the removed resting glow; used the stock Tailwind shadow-sm utility instead (border + shadow-sm + bg-card/60 already separate the tile from its surface, and the closed token layer has no elevation token to build one from)"
  - "320ms (not the plan's suggested-but-optional exact figure) chosen for the count-up spring, read from --duration-slow via getComputedStyle since useSpring takes a JS number, not a CSS value"
  - "Severity dot and trend arrow are withheld in every state except ready/stale, since both are confident-figure assertions the tile should not make about a value it isn't showing"
  - "Legacy src/components/__tests__/MetricCard.test.tsx left untouched (out of files_modified scope) rather than merged or deleted -- still passes unchanged"

patterns-established:
  - "Pattern: discriminated-union rendering via switch + assertNever(x: never) is the house idiom for 'unhandled state must be a compile error' -- reusable for StatusBadge-style components with a similar open union risk"

requirements-completed: [TOKEN-04]

# Metrics
duration: 55min
completed: 2026-08-19
---

# Phase 122 Plan 13: MetricCard Six-State Rewrite Summary

**MetricCard.tsx rewritten in place to consume 122-09's shared six-state vocabulary via an exhaustive switch (unhandled states are a tsc compile error), stripping glow-card/text-white/hardcoded trend colors/inline rgba() and retiming its motion literal onto --duration-slow.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-19T17:36:01Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `MetricCard` now renders all six states (`loading` / `ready` / `empty` / `stale` / `unavailable` /
  `error`) purely from `src/lib/metricState.ts`'s copy/icon/tone table -- it defines no state copy of
  its own, and a source-level test proves it (mutation-tested: temporarily inlining `"no signal yet"`
  turned the guard RED, reverting turned it GREEN).
- Added an optional `state?: MetricState` prop, defaulting to `"ready"`, so every currently-unmigrated
  render site (plan 122-14's job next wave) keeps behaving exactly as before -- proven by a dedicated
  backward-compatibility control test using the pre-rewrite prop set with no `state` prop.
- Unhandled `MetricState` members are a **compile error**, not a silent fallthrough: an exhaustive
  `switch` over `state` with a `default: return assertNever(state)` branch. Proven with a real mutation
  (see below) rather than asserted: adding a synthetic 7th state to the shared module produced a genuine
  `tsc --noEmit` type error (`Argument of type '"synthetic7"' is not assignable to parameter of type
  'never'`) AND a runtime throw inside `assertNever` that failed the coverage test -- both signals fired,
  then both were reverted and re-verified green.
- Task 2's corpus-derived ratchet: `renders every state currently defined by the shared vocabulary
  without throwing` derives its list via `Object.keys(METRIC_STATE_COPY)` at test time, not a literal
  six-name array -- an enumerated list would not have caught the synthetic-state mutation; this one does
  (see Mutation Proofs below).
- Stripped, per D-13: `glow-card` class, hardcoded `text-white`, hardcoded `text-emerald-500`/
  `text-red-500` trend colors (now `text-(--status-ok)`/`text-(--status-error)`), and the inline
  `rgba(255,255,255,0.02)` resting box-shadow. `hoverCardShadow`'s `color-mix` formula is unchanged
  (`color-mix` count in the file: 4 before, 4 after).
- Moved the count-up spring's `useSpring({ duration: 400 })` literal onto `--duration-slow` (320ms),
  read once via `getComputedStyle` (the established `useThemeColors.ts` pattern for JS code that needs a
  token value) with a 320ms fallback for environments where the stylesheet hasn't loaded (e.g. Vitest,
  which does not process CSS per `vitest.config.ts`).
- Also retimed the card's own hover-border-color transition, which the acceptance criteria's
  `duration-[0-9]+` grep would otherwise still catch: `duration-300` -> `duration-slow ease-house`
  (322ms's near-neighbor per the 122-TOKEN-LAW.md precedent for retiming authored durations onto the
  nearest house token).
- Hero numeral moved to the design law's `40px / font-light (300) / tabular-nums / font-mono`, from the
  prior `text-3xl font-medium` (30px/500, Geist).
- No elevation shadow token invented for the removed glow (the plan's "if the surface needs one" was
  conditional): `src/index.css` has no `--shadow-*` custom property to build one from and the token
  layer is closed. Added the stock Tailwind `shadow-sm` utility instead -- not a custom token, already
  used repo-wide (`AgentDetailPanel.tsx`, `AlertRulesEngine.tsx`, etc.) for exactly this purpose.

## Task Commits

1. **Task 1+2 (combined): Rewrite MetricCard, add state-coverage ratchet, fix fallout** -
   `fde030a5` (feat) — both tasks landed in one commit; Task 2's guard test and population
   re-derivation were folded into the same test file created for Task 1 rather than a separate commit,
   since splitting them would have left an intermediate commit with a half-finished test file.

## Files Created/Modified

- `src/components/MetricCard.tsx` - Six-state rewrite: exhaustive switch, shared-vocabulary copy,
  token-only colors, retimed motion.
- `src/components/MetricCard.test.tsx` - New. 15 tests: one per behavior line, backward-compat control,
  token-count assertions, D-20 centralization guard, corpus-derived state-coverage ratchet.
- `src/components/ToolUsagePanel.test.tsx` - One-line selector fix (`.glow-card` ->
  `[data-testid="metric-card"]`), direct fallout of the D-13-mandated `glow-card` removal.

## Consumer Population (Task 2 -- re-derived, units named)

Per the plan's counting-discipline requirement, all three populations were re-measured rather than
quoted, scoped to `src/**/*.tsx` excluding `*.test.tsx`:

| Population | Command | Result |
|---|---|---|
| Files that **mention** `MetricCard` | `git grep -l 'MetricCard' -- 'src/*.tsx' \| grep -v '\.test\.'` | **32 files** |
| Files that **render** `<MetricCard` | `git grep -lE '<MetricCard' -- 'src/*.tsx' \| grep -v '\.test\.'` | **24 files** |
| Render **occurrences** (`<MetricCard` tokens) | `git grep -oE '<MetricCard' -- 'src/**/*.tsx' \| grep -v '\.test\.' \| wc -l` | **84 occurrences** |

Note: `git grep`'s pathspec glob crosses directory boundaries (per this repo's own measurement
discipline note), so `src/*.tsx` and `src/**/*.tsx` returned identical file sets for every query above
-- both forms are shown in the table for traceability, not because they disagreed.

**Reconciling 122-CONTEXT.md D-13's "36 files":** it matches **none** of the three re-derived
populations above (32 mention / 24 render / 84 occurrences). For completeness, two adjacent
measurements were also taken and neither is 36 either: `git grep -l 'MetricCard' -- 'src/*.tsx'`
**including** test files = 40; import-statement-only mentions (`^import .*MetricCard`), non-test = 26,
including test files = 28. None of the five populations measured equal 36. This is left unreconciled
per the plan's explicit instruction ("state which figure, or that it corresponds to none, do not
reconcile it silently") -- 122-14's own plan text independently re-derives the render-site population
as 24 files and does not depend on the "36" figure, so this discrepancy does not block downstream work.

122-14's `files_modified` list (24 files) matches this plan's **render** population exactly (24 files),
confirming 122-14 is scoped correctly regardless of the "36" discrepancy.

## Decisions Made

- **No new elevation token invented.** The plan's "replace the removed glow with a real elevation
  shadow if the surface needs one" was conditional and the token layer (`src/index.css`) is closed with
  no `--shadow-*` custom property to draw from. Used the stock Tailwind `shadow-sm` utility (not a
  custom hex/rgba literal, not a new token) as the elevation replacement, alongside the unchanged
  `color-mix`-driven hover glow.
- **320ms for the count-up spring**, read from `--duration-slow` at mount rather than hardcoded, per
  D-09's instruction that this literal "must read a token" — judged appropriate rather than too fast,
  since it's this app's slowest deliberate-motion token and a tile count-up is not an ambient loop
  needing bespoke timing.
- **Severity dot and trend arrow withheld outside `ready`/`stale`.** Not explicitly required by the
  plan's behavior lines, but follows directly from D-14: both are confident assertions about a value
  the tile isn't currently showing in `loading`/`empty`/`unavailable`/`error`, and rendering them would
  reintroduce the exact fabrication class this rewrite removes.
- **Legacy `src/components/__tests__/MetricCard.test.tsx` left untouched.** It predates this plan (Phase
  5 origin, last touched by the UI-02 borderless redesign), sits outside this plan's `files_modified`
  scope, and still passes unmodified after the rewrite (4 tests, 7 pre-existing `test.todo` stubs from
  an unrelated older redesign). It duplicates coverage with the new `MetricCard.test.tsx` but consolidating
  or deleting it was judged out of scope for this plan -- flagged here rather than silently merged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `ToolUsagePanel.test.tsx`'s `.glow-card` selector broke when `glow-card` was
removed from `MetricCard.tsx`**
- **Found during:** Task 1 full-suite verification (`npx vitest run`)
- **Issue:** `label.closest(".glow-card")` returned `null` once `MetricCard`'s outer wrapper stopped
  carrying the `glow-card` class (D-13's explicit removal requirement) — this is a mechanical
  consequence of a change the plan itself mandates, in a file outside this plan's `files_modified` list.
- **Fix:** Added `data-testid="metric-card"` to `MetricCard`'s outer wrapper as a stable test hook
  (component change), and updated the one broken selector in `ToolUsagePanel.test.tsx` to use it.
- **Files modified:** `src/components/MetricCard.tsx`, `src/components/ToolUsagePanel.test.tsx`
- **Verification:** `npx vitest run` -- zero failures (see Full Suite below); `git grep -n "glow-card"`
  swept across the whole repo afterward to confirm no other test depends on the removed class (found
  `src/pages/GraphsHub.test.tsx` already using a `?? labelEl.parentElement!` fallback that tolerates
  exactly this change, and `src/components/HeroStatsBar.test.tsx` already asserting `glow-card`'s
  *absence*, both pre-existing and unaffected).
- **Committed in:** `fde030a5` (same commit as Task 1, since it's inseparable fallout of the same edit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug, mechanical test fallout)
**Impact on plan:** Necessary for the full suite to stay green after the D-13-mandated `glow-card`
removal. No scope creep beyond the one broken selector.

## Mutation Proofs

Both performed live during execution, in this order: mutate -> run targeted test -> confirm RED for the
right reason -> revert -> confirm GREEN. Neither mutation left the module unparseable (both are
syntactically valid changes, per the plan's explicit caution that a collection/import error would read
as a false RED).

**1. D-20 centralization guard ("defines no copy string of its own...")**
- Mutation: temporarily changed `{stateEntry.label}` in the empty/unavailable/error render branch to
  `{state === "empty" ? "no signal yet" : stateEntry.label}`, reintroducing the literal string as a code
  token.
- Result: RED — `AssertionError: expected true to be false`, at the exact `source.includes(...)` line,
  for the exact reason (the literal now appears in the stripped-of-comments source).
- Reverted; re-ran — GREEN, `git diff --stat` on `MetricCard.tsx` confirmed byte-identical to the
  committed state before the mutation.

**2. Corpus-derived state-coverage ratchet ("renders every state currently defined...")**
- Mutation: added a synthetic 7th member `"synthetic7"` to `MetricState`'s type union and a matching
  entry to `METRIC_STATE_COPY` in `src/lib/metricState.ts` (not to `MetricCard.tsx` — the point is the
  ratchet must catch a change in the *upstream* vocabulary module).
- Result: RED in two independent ways —
  - `npx tsc --noEmit`: `src/components/MetricCard.tsx(254,26): error TS2345: Argument of type
    '"synthetic7"' is not assignable to parameter of type 'never'.` (the exhaustiveness guarantee
    firing at compile time, exactly as designed)
  - `npx vitest run`: `Error: MetricCard: unhandled state "synthetic7"` thrown from `assertNever`,
    failing the coverage test at runtime (Vitest/esbuild does not typecheck, so this is the independent
    runtime guarantee)
- An enumerated `["loading","ready","empty","stale","unavailable","error"]` test would **not** have
  caught this — `Object.keys(METRIC_STATE_COPY)` is what surfaces the new key to the render loop.
- Reverted both the type union and the table entry; re-ran `npx tsc --noEmit` (exit 0) and
  `npx vitest run src/components/MetricCard.test.tsx` (15/15 passed); `git diff --stat -- src/lib/metricState.ts`
  confirmed empty (byte-identical to HEAD).

## Verification

- `npx vitest run src/components/MetricCard.test.tsx` — **15/15 passed**
- `npx vitest run src/components/__tests__/MetricCard.test.tsx` (legacy, out of scope, unmodified) —
  **4 passed, 7 todo** (pre-existing todos, unrelated to this plan)
- `npx vitest run src/components/ToolUsagePanel.test.tsx` — **passed** after the selector fix
- Full suite (`npx vitest run`): **345 files passed | 17 skipped (362)**, **4857 tests passed | 197
  todo (5054)** — **zero new failures** against the recorded baseline (344 files / 4842 passed / 0
  failed). The +1 file / +15 tests is exactly this plan's new `MetricCard.test.tsx`.
- `npx tsc --noEmit` — exit 0
- `npm run build` — exit 0 (only pre-existing chunk-size warnings, unrelated to this plan)
- Built-stylesheet checks (per the jsdom-cannot-see-dead-classes warning, D-13's arbitrary-value trend
  classes and the retimed duration/ease classes are template-literal-composed, not static JSX
  className literals, so they were verified against `dist/assets/*.css` rather than jsdom):
  - `.text-\(--status-ok\){color:var(--status-ok)}` — present
  - `.text-\(--status-error\),.text-\(--status-error\)\/60{color:var(--status-error)}` — present
    (comma-joined selector, as this repo's Tailwind v4 build is known to emit)
  - `.duration-slow{transition-duration:var(--duration-slow)}` — present
  - `.ease-house{--tw-ease:var(--ease-house);transition-timing-function:var(--ease-house)}` — present
  - `.shadow-sm{...}` and `font-size:40px` (from `text-[40px]`) and `.font-light{...}` — all present
- Acceptance-criteria grep controls, all measured directly against the committed file:
  - `git grep -cF 'glow-card' -- src/components/MetricCard.tsx` = 0
  - `git grep -cF 'text-white' -- src/components/MetricCard.tsx` = 0
  - `git grep -cE 'text-(emerald|red)-[0-9]{3}' -- src/components/MetricCard.tsx` = 0
  - `git grep -cF 'rgba(' -- src/components/MetricCard.tsx` = 0
  - `git grep -cF 'color-mix' -- src/components/MetricCard.tsx` = 4 (unchanged from pre-edit baseline
    of 4 — the hover-glow and severity-dot-glow formulas both survive intact)
  - `git grep -cE 'duration: 400|duration-[0-9]+' -- src/components/MetricCard.tsx` = 0

## Issues Encountered

None beyond the ToolUsagePanel fallout documented above under Deviations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 122-14 (wave 6) can proceed against the measured **24-file / 84-occurrence** render-site population;
  its own `files_modified` list of 24 files already matches the re-derived render-file count exactly.
- The `state` prop's default (`"ready"`) is a deliberate migration bridge (T-122-13-A in this plan's
  threat register) — every one of those 24 files still renders with the old, undeclared behavior until
  122-14 migrates it. Nothing in this plan enforces that migration; that enforcement is 122-14's own
  ledger plus (per the threat register) a later ratchet.
- The legacy `src/components/__tests__/MetricCard.test.tsx` duplicate-coverage question (see Decisions)
  is unresolved and not blocking — flagged for whoever next touches `MetricCard.tsx`'s test surface.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*
