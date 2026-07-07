---
phase: 95-hardening-security-audit-key-rotation-dependency-majors
plan: 01
subsystem: infra
tags: [typescript, tsconfig, dependency-majors, dead-code-removal, react-day-picker, vitest, vite-build]

# Dependency graph
requires: []
provides:
  - "Dead react-day-picker primitive deleted (calendar.tsx), package + lockfile clean"
  - "TypeScript 6.0.3 installed, tsc --noEmit green via single tsconfig types-array fix"
  - "Redundant @types/diff + @types/js-yaml stubs removed"
  - "REQUIREMENTS.md HARD-03/HARD-04 wording reflects actual resolution"
  - "Settled/green shipped tree ready for the Plan 03 /cso security audit"
affects: [95-02, 95-03, 95-04]

# Tech tracking
tech-stack:
  added: [typescript@6.0.3]
  patterns: ["tsconfig compilerOptions.types array as the single-root-cause fix for TS6 ambient-global resolution"]

key-files:
  created: []
  modified: [tsconfig.json, package.json, package-lock.json, ".planning/REQUIREMENTS.md"]

key-decisions:
  - "Applied Option A (tsconfig types:[\"node\"]) over Option B (per-file globalThis casts) — one-line config change resolves all Node-global errors across convex/ + src/ without touching any of the 5 prod break-site files"
  - "Verified the four D-10 folded majors (diff@8, js-yaml@5, jsdom@29, react-easy-crop@6) were already merged to master 2026-07-04 and are green under the new TS 6.0.3 bar — no fresh bump commits needed for them, only the REQUIREMENTS.md folded-scope note"
  - "Deleted calendar.tsx rather than migrating react-day-picker 9->10 — zero real consumers verified, resolves HARD-04 at the root"

requirements-completed: [HARD-03, HARD-04]

# Metrics
duration: ~10min
completed: 2026-07-07
---

# Phase 95 Plan 01: Dependency Majors — TS6 Bump & Dead-Code Deletion Summary

**TypeScript 5.9.3 to 6.0.3 landed green via a single tsconfig `types: ["node"]` fix, react-day-picker fully deleted (not migrated), and the two now-redundant `@types/diff`/`@types/js-yaml` stubs removed — full green bar (tsc + 164/164 passing test files + vite build) confirmed on the settled tree.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-07T12:23:47Z (approx, per STATE.md handoff marker)
- **Completed:** 2026-07-07T12:29:42Z
- **Tasks:** 3 completed
- **Files modified:** 4 (tsconfig.json, package.json, package-lock.json, .planning/REQUIREMENTS.md) + 1 deleted (src/components/ui/calendar.tsx)

## Accomplishments

- Deleted `src/components/ui/calendar.tsx` (verified sole `react-day-picker` importer, zero real consumers) and dropped `react-day-picker` from package.json + lockfile — resolves CI-red PR #49 at the root, no migration performed
- Bumped TypeScript 5.9.3 → 6.0.3 and fixed the entire 22-error-class PR #50 breakage (all "Node global not found": `process`/`fs`/`path`/`Buffer`/`__dirname`/`global`) with one tsconfig line (`compilerOptions.types: ["node"]`) — zero edits to any of the 5 prod break-site files
- Removed redundant `@types/diff@7` and `@types/js-yaml@4` DefinitelyTyped stubs (both major-mismatched with and superseded by the runtime packages' own bundled types)
- Ran the full green bar: `npx tsc --noEmit` (0 errors), `npx vitest run` (164 test files passed, 18 pre-existing skips, 1643 tests passed, 0 failed), `npm run build` (exits 0)
- Updated `.planning/REQUIREMENTS.md` — HARD-03 and HARD-04 both marked complete with wording reflecting the actual resolution (tsconfig fix + folded-scope note; deletion, not migration)

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete the dead react-day-picker primitive (HARD-04)** - `221bbe8` (feat)
2. **Task 2: Bump TypeScript to 6.0.3 and resolve node globals at the tsconfig level (HARD-03)** - `b8af8cf` (feat)
3. **Task 3: Remove redundant @types stubs, run the full green bar, update REQUIREMENTS.md wording** - `30dbf7f` (chore)

_No plan-metadata commit issued separately — REQUIREMENTS.md update was folded into Task 3 per plan spec._

## Files Created/Modified

- `src/components/ui/calendar.tsx` - DELETED (dead react-day-picker primitive, zero consumers)
- `tsconfig.json` - Added `compilerOptions.types: ["node"]` — the single-root-cause fix for TS 6.0's ambient-global resolution change
- `package.json` - `typescript` bumped to `^6.0.3`; `react-day-picker`, `@types/diff`, `@types/js-yaml` removed
- `package-lock.json` - Regenerated to match the above dependency changes
- `.planning/REQUIREMENTS.md` - HARD-03/HARD-04 wording rewritten to reflect actual resolution; both marked `[x]` and `Complete` in the traceability table

## Decisions Made

- **Option A over Option B for the TS6 fix:** the plan explicitly directed the tsconfig `types` array as the default remediation over per-file `globalThis` casts (the pre-existing `convex/ingestAuth.ts` workaround pattern). Verified empirically — after adding `"types": ["node"]`, `tsc --noEmit` went from 42 errors (more than PR #50's 22, since Phase 93/94 added new test files carrying the same root-cause pattern: `evalScores.test.ts`, `runtimeIngest.test.ts`, `docCommentsApi.test.ts`) straight to 0, confirming the single-root-cause diagnosis held even against the larger current test surface.
- **D-10 folded majors verified, not re-bumped:** `diff@8.0.3`, `js-yaml@5.2.1`, `jsdom@29.1.1`, `react-easy-crop@6.0.2` were already at target on master (merged 2026-07-04) — no `npm install` needed for them. Their green status is confirmed retroactively by this plan's full green bar (tsc + vitest + build all pass with these versions installed), and the REQUIREMENTS.md folded-scope note records this per D-10/Pitfall 1 from RESEARCH.md.
- **No new `@types/react-day-picker` cleanup needed** — the library ships its own types; nothing extra to remove beyond the runtime package itself.

## Deviations from Plan

None - plan executed exactly as written. The only notable (non-deviation) observation: the live error count on TS 6.0.3 before the fix was 42, not PR #50's originally-mined 22, because Phase 93/94 added new test files (`evalScores.test.ts`, `runtimeIngest.test.ts`, `docCommentsApi.test.ts`) exhibiting the identical root-cause pattern (Node globals unresolved). This did not require any plan deviation — the same single tsconfig fix resolved all of them, confirming RESEARCH.md's single-root-cause diagnosis rather than contradicting it.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shipped code tree is settled on TS 6.0.3 with react-day-picker gone and REQUIREMENTS.md current — ready for Plan 03's `/cso` security audit to certify the actual state (per D-11 ordering: majors first, audit last).
- HARD-01 (`/cso` audit) and HARD-02 (key-rotation close-out) remain untouched by this plan, as directed — they are scoped to later plans (03/04) in this phase.
- No blockers for subsequent plans in Phase 95.

---
*Phase: 95-hardening-security-audit-key-rotation-dependency-majors*
*Completed: 2026-07-07*
