---
phase: 106-consolidation-hardening
plan: 02
subsystem: infra
tags: [vite, rollup, bundle-analysis, code-splitting, build-tooling]

# Dependency graph
requires:
  - phase: 106-01
    provides: DEBT-01 verify-and-close (typed-api sweep, clean), DEBT-02 pre-flight NO-GO context
provides:
  - "an opt-in chunk-composition-report Vite plugin (ANALYZE_BUNDLE=1 npm run build) emitting dist/chunk-composition.json with per-chunk module attribution"
  - "a measured, module-level baseline of the production bundle's oversized chunks (106-BUNDLE-ANALYSIS.md)"
  - "a ranked, mechanism-named remediation candidate list for plan 106-04"
affects: [106-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "inline Vite plugin convention (matches the existing drop-unused-ort-wasm plugin): generateBundle hook, opt-in via process.env gate, emitFile for build-time reports"

key-files:
  created:
    - .planning/phases/106-consolidation-hardening/106-BUNDLE-ANALYSIS.md
  modified:
    - vite.config.ts

key-decisions:
  - "Capped module attribution at top 30 per chunk (plan-specified) with an otherModulesCount/otherModulesBytes tail so numbers still reconcile — the 1,560-module entry-chunk tail (2.67 MB pre-minification) is real but not individually attributable at this cap."
  - "Classified react-force-graph-3d and useSpeechRecognition as lazy (isDynamicEntry:false but reachable only via a lazy()-wrapped importer), not entry — verified against source, not assumed from the isDynamicEntry flag alone, since chunks shared between two lazy importers get split out as regular non-entry, non-dynamic-entry chunks."

patterns-established:
  - "Reproducible bundle measurement: ANALYZE_BUNDLE=1 npm run build + dist/chunk-composition.json, byte figures always cited from the JSON rather than eyeballed from the Vite stdout table."

requirements-completed: [DEBT-03]

# Metrics
duration: 9min
completed: 2026-08-04
---

# Phase 106 Plan 02: Bundle Composition Baseline Summary

**Opt-in `chunk-composition-report` Vite plugin plus a measured, module-attributed baseline confirming all four of D-09's chunk sizes exactly and surfacing a new finding — the "useSpeechRecognition" chunk is ~94% unused refractor/Prism language grammars, not the voice stack.**

## Performance

- **Duration:** 9 min (17:14 → 17:23, git commit timestamps)
- **Started:** 2026-08-04T17:14:48-04:00
- **Completed:** 2026-08-04T17:23:02-04:00
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Added an additive, opt-in (`ANALYZE_BUNDLE=1`) `chunk-composition-report` plugin to `vite.config.ts` that emits `dist/chunk-composition.json` with per-chunk `fileName`/`renderedBytes`/`isEntry`/`isDynamicEntry` and the top 30 modules by `renderedLength` (plus a reconciling tail count/bytes) — a default `npm run build` is unaffected (verified: no `chunk-composition.json` emitted, identical chunk-size warnings).
- Ran the real build with the plugin enabled and recorded the baseline in `106-BUNDLE-ANALYSIS.md`: all four of D-09's chunk figures reproduced exactly (`index` 2,047.37 kB, `react-force-graph-3d` 1,293.89 kB, `useSpeechRecognition` 638.56 kB, `WarRoom` 485.00 kB — confirmed under the 500 kB threshold).
- Classified every chunk over 500 kB as entry / lazy-route with file:line proof (not assumption): only `index-fgkf2HV8.js` is genuinely an unconditional-load defect; `react-force-graph-3d` and `useSpeechRecognition` are both reachable only behind `lazy()` boundaries.
- New finding beyond D-09: the `useSpeechRecognition` chunk's actual byte weight is dominated (~94% of captured pre-minification module bytes) by `refractor`'s full language-grammar registry (via `react-syntax-highlighter`'s `Prism` full-bundle import in `CodeBlock.tsx`/`ChatBubble.tsx`), not the voice/speech dependency chain the chunk's auto-generated name implies.
- Produced a ranked, mechanism-named, byte-sourced remediation candidate list for plan 106-04: (1) refractor/Prism full-bundle trim (~774,578 bytes), (2) four App.tsx pages (`Settings`/`Memory`/`Security`/`Capabilities`) still statically imported instead of `lazy()` (134,533 measured bytes, plus named-but-unmeasured additional candidates: `Alerts`/`Infrastructure`/`SelfHealing`/`BuildProgress`/`Briefings`/`Automation`/`Executions`/`Ideation`/`SessionDetail`), (3) `Dashboard`→`@xyflow` lazy conversion (234,442 bytes, flagged with its landing-page loading-spinner tradeoff), (4) `@dnd-kit/core` (84,979 bytes, likely a side-effect of fixing #2's `Settings.tsx`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add an opt-in chunk-composition report plugin to vite.config.ts** - `0a5923ef` (feat)
2. **Task 2: Record the measured baseline in 106-BUNDLE-ANALYSIS.md** - `e554fae5` (docs)

_No TDD tasks in this plan — build-config and documentation only._

## Files Created/Modified
- `vite.config.ts` - added the opt-in `chunk-composition-report` inline plugin (additive; `drop-unused-ort-wasm` untouched)
- `.planning/phases/106-consolidation-hardening/106-BUNDLE-ANALYSIS.md` - measured baseline, module attribution, D-09 confirmation, remediation candidates

## Decisions Made
- Kept the module-attribution cap at exactly the plan-specified top 30 per chunk; where a remediation candidate's bytes fell in the uncaptured tail (e.g. most of the entry chunk's 1,560-module, 2.67 MB tail; the 9 additional non-lazy App.tsx pages beyond the 4 measured), the report says so explicitly rather than guessing a number — satisfies the plan's "taken from the JSON, not guessed" requirement.
- Classified `react-force-graph-3d` and `useSpeechRecognition` as lazy by tracing their sole import sites to `lazy()`-wrapped components (`CodeVaultGraph.tsx:67`, `SkillVaultView.tsx:28`, `App.tsx:36`/`45`), not by trusting `isDynamicEntry` alone — both chunks report `isDynamicEntry:false` because they are shared dependency chunks split out from two different lazy importers each, not dynamic-entry points themselves. Verifying this distinction was necessary to avoid mis-classifying a genuinely-lazy chunk as a defect (or vice versa).
- Documented the pre-minification vs post-minification measurement caveat explicitly (module `renderedLength` sums exceed a chunk's final `renderedBytes`) so a future reader doesn't misread the report as internally inconsistent.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria and automated verification commands passed on the first attempt; no auto-fixes, no blocked package installs, no architectural questions arose.

## Issues Encountered

None. One pre-existing, unrelated dirty file (`src/pages/Chat.tsx`) was present in the working tree before this plan started (confirmed via the session's initial `git status` snapshot, predating any action in this plan) and remains untouched — `git status --porcelain src convex` is therefore not literally empty, but the diff is entirely pre-existing and this plan touched zero application source files (only `vite.config.ts`, staged and committed individually in Task 1).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 106-04 (remediation) has a ranked, byte-sourced target list ready to execute against: the four static-import App.tsx pages are the lowest-risk/highest-confidence win (established `lazy()` pattern, zero UX tradeoff), the refractor/Prism full-bundle trim is the second target (well-evidenced, needs a language allowlist decision), and the `Dashboard`/`@xyflow` lazy conversion is flagged as a discretionary call given its landing-page tradeoff.
- The `ANALYZE_BUNDLE=1 npm run build` reproduction path is available for 106-04 to re-measure against after each remediation and confirm real byte reductions, not assumed ones.
- No blockers for 106-03 or 106-04 introduced by this plan.

---
*Phase: 106-consolidation-hardening*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: `vite.config.ts`
- FOUND: `.planning/phases/106-consolidation-hardening/106-BUNDLE-ANALYSIS.md`
- FOUND: `.planning/phases/106-consolidation-hardening/106-02-SUMMARY.md`
- FOUND commit `0a5923ef` (Task 1: chunk-composition-report plugin)
- FOUND commit `e554fae5` (Task 2: 106-BUNDLE-ANALYSIS.md)
- FOUND commit `ebdbc2d2` (plan summary)
