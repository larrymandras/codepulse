---
phase: 123-accessibility-remediation
plan: 05
subsystem: ui
tags: [accessibility, wcag, contrast, animate-pulse, loading-state]

requires: []
provides:
  - "The two non-shell color-contrast violators (CodeVaultGraph.tsx's graph loading text, RunTimeline.tsx's thinking indicator) cleared to 0 across all 8 re-measured cells"
  - "123-LOADING-STATE-FINDING.md: a controlled two-condition measurement proving animate-pulse's own opacity keyframe (not the text token) drives a no-alpha token below AA, plus the full class sweep this mechanism implicates"
affects: []

tech-stack:
  added: []
  patterns:
    - "Deleting a text-*/NN alpha modifier is NOT sufficient when the element also carries animate-pulse: Tailwind's default pulse keyframe drives element opacity to 0.5 at the trough, which composites even a full-strength token below AA. Verified live: CodeVaultGraph's text-primary (no alpha) still failed at 2.92-3.09:1 in cyan/emerald/aubergine after deleting /70. The working remedy is stepping the TOKEN itself to one bright enough to survive the trough (text-foreground), not just removing alpha."
    - "readable theme is a legitimate, already-existing must-differ control for any animate-pulse-driven contrast claim: index.css:757's blanket `[data-theme=\"readable\"] * { animation: none !important; }` means readable never sees the trough, so a fix that only helps readable (and not cyan/emerald/aubergine) hasn't addressed the mechanism."
    - "Synthetic-node injection (e.g. e2e/lib/contrast.ts's paintedColorOfClass) is a valid technique for controlled two-condition axe measurements of an element whose real render state depends on live/unavailable backend data -- inject the exact class string onto a themed live page (same bg-background ancestor) rather than fabricating a page."

key-files:
  created:
    - .planning/phases/123-accessibility-remediation/123-LOADING-STATE-FINDING.md
    - .planning/phases/123-accessibility-remediation/a11y-loading-state/ (8 capture JSONs)
  modified:
    - src/components/graph/CodeVaultGraph.tsx
    - src/components/RunTimeline.tsx

key-decisions:
  - "Escalated beyond the plan's literal Task 2 instruction for CodeVaultGraph.tsx (\"delete the /70, per D-04's default remedy\"): re-measuring after that literal edit showed 3 real color-contrast violations remaining at 2.92-3.09:1 in cyan/emerald/aubergine (readable exempt via its animation:none blanket rule). Deleting alpha alone does not address the mechanism Task 1 confirmed (animate-pulse's own opacity trough). Applied the same text-foreground remedy already chosen for RunTimeline.tsx, which does survive the trough -- one remedy pattern for one confirmed mechanism, consistent with D-01's letter."
  - "Swept CodeVaultGraph.tsx:678 ('Loading 3D render…', inside the lazy 3D-view Suspense fallback) alongside the plan's named :892 site. Same file (already in files_modified), same identical text-primary/70 ... animate-pulse class string, same mechanism, never independently reachable during the axe scan (renderMode defaults to \"2d\" per :133) but real, unmeasured code carrying the same defect. Fixing both keeps the file internally consistent and satisfies D-01's 'fix the class, not the instance' rather than leaving a matching bug one function away."
  - "Population re-derivation found the plan's predicted text-primary/[0-9]+ count (6 -> 5) and its predicted node count (6 nodes) were both stale: the live pre-fix count in CodeVaultGraph.tsx was 3 occurrences (2x /70 + 1x /40 on an untouched icon), and 123-04-SUMMARY.md had already corrected the node prediction to 5 (timing-dependent aubergine LiveRun cell). Recorded the actual re-derived figures (3 -> 1 occurrences; 6/5/3/0 nodes across the fix's stages) rather than forcing a match to the plan's stale numbers, per plan_authority."

requirements-completed: []
# A11Y-02 is NOT completed by this plan -- it spans most of Phase 123's 13 plans. This plan
# clears the only two non-shell color-contrast sites the current 20-cell matrix measures;
# the phase-level requirement stays open pending the remaining sweep plans and the widened
# 47-route scan (123-08/123-03).

duration: 48min
completed: 2026-08-20
---

# Phase 123 Plan 05: Non-shell loading-state contrast fix (D-01/D-04) Summary

**Confirms via a controlled two-condition measurement that `animate-pulse`'s own opacity keyframe — not the text token's alpha modifier — is what drove a no-alpha `--muted-foreground` token to 2.68:1, then fixes both non-shell `color-contrast` violators (`CodeVaultGraph.tsx`'s graph loading text, `RunTimeline.tsx`'s thinking indicator) to 0 across all 8 re-measured cells, escalating past the plan's literal "delete the alpha" instruction once live re-measurement showed that alone was insufficient.**

## Performance

- **Duration:** 48 min
- **Started:** 2026-08-20T11:15:00-04:00 (first file read)
- **Completed:** 2026-08-20T12:03:00-04:00
- **Tasks:** 2
- **Files modified:** 2 source files + 1 new finding doc + 8 new capture JSONs

## Accomplishments

- **Task 1 — controlled measurement, verdict CONFIRMED.** `RunTimeline.tsx`'s `showThinking` branch is live-data-gated (`streaming && blocks.length === 0`), unreachable on demand in this environment, so the two-condition control was run by injecting the component's exact markup/class strings onto the real themed `/live-run` page (same technique as `e2e/lib/contrast.ts`'s `paintedColorOfClass`). Condition (a) — `animate-pulse` present, frozen at the Tailwind default keyframe trough (`opacity: .5`) via a negative `animation-delay` + pause — measured axe `fgColor #4d5561`/`bgColor #05060a`, **2.68:1**, FAIL. Condition (b) — `animate-pulse` absent (mirrors `reducedMotion` branch), `opacity: 1` — measured **7.89:1**, PASS. Verdict recorded as the literal word **confirmed**.
- Full-corpus class sweep: `grep -rlF "animate-pulse" src/ --include="*.tsx" | grep -v '\.test\.tsx' | grep -v "__tests__" | wc -l` → **39 files**; `grep -rhoF ... | wc -l` → **71 occurrences** (never `grep -c`). Narrowed to the text-carrying mechanism (Phase 120's "6 loading-text" bucket, corrected for `SessionComparison.tsx`'s drop-out — it no longer carries `animate-pulse` at all, refactored to the shared skeleton-only `<LoadingState>`) plus `RunTimeline.tsx` itself. In-scope subset (renders on one of the 5 measured pages): exactly the 2 sites the plan named. 6 sibling instances on unmeasured routes (`KGSearchResults.tsx`, `KnowledgeGraph.tsx` x4, `Memory.tsx`, `IntegrationHealth.tsx`) explicitly deferred with a named reason (not on a measured page, not in this plan's `files_modified`), not silently dropped.
- `120-SANCTIONED-PATTERNS.md` read in full and cross-checked: contains exactly one sanctioned pattern (`GlobalSwapModal.tsx`'s post-swap toast undo), governing an unrelated POLISH-03 toast/dialog concern. No rule bears on this population.
- **Task 2 — remedy, with a mid-task escalation.** `RunTimeline.tsx:81` stepped from `text-(--muted-foreground)` to `text-foreground` (D-04's "step to a quieter token" fallback for a confirmed-animation cause); `reducedMotion` branch left intact. `CodeVaultGraph.tsx:892` first had `/70` deleted per the plan's literal D-04-default instruction — re-measuring showed this was **insufficient**: 3 real `color-contrast` violations remained at 2.92-3.09:1 in cyan/emerald/aubergine (target `.h-\[600px\] > .text-base`), with `readable` alone passing because `index.css:757`'s blanket `animation: none !important` rule means it never sees the animate-pulse trough at all — itself a clean must-differ control proving the failure is animation-driven, not token-driven. Escalated `CodeVaultGraph.tsx:892` and the sibling `:678` ("Loading 3D render…", same class string, same file, swept alongside per D-01) to the same `text-foreground` remedy. Re-measured: **0 color-contrast violations across all 8 cells** (Graphs + LiveRun x 4 themes), all-violations total also 0.
- `text-primary/[0-9]+` in `CodeVaultGraph.tsx`: **3 → 1** (live re-derivation; only the untouched `Network` icon's `/40` remains — the plan's predicted "6 → 5" was stale). Hex count in `RunTimeline.tsx`: 0, unchanged. `reducedMotion` references in `RunTimeline.tsx`: 3, unchanged. `npx tsc --noEmit` exits 0. `CodeVaultGraph.test.tsx` (40 tests, loading text unchanged), `__tests__/blocks.test.tsx`, and `__tests__/RunTimeline.test.tsx` (safety net) all pass.
- Scratch probe (`e2e/.scratch/loading-state-probe.spec.ts`) deleted after use; `git status --porcelain e2e/` confirmed clean.

## Task Commits

1. **Task 1: Measure why a no-modifier token read 2.68:1, with a must-differ control** — `c6813ffe` (docs)
2. **Task 2: Remedy both loading states and prove all six nodes clear AA** — `54585ac3` (fix)

## Files Created/Modified

- `src/components/graph/CodeVaultGraph.tsx` — 2 sites changed (`:892` graph loading text, `:678` 3D-loading text, sibling instance swept alongside): `text-primary/70` → `text-foreground` (delete-alpha alone measured insufficient; escalated). `bg-card/50`, `border-primary/20`, and the untouched icon's `text-primary/40` left alone.
- `src/components/RunTimeline.tsx` — 1 site changed (`:81`): `text-(--muted-foreground)` → `text-foreground`. `reducedMotion` branch, ternary structure, and "Thinking..." text unchanged.
- `.planning/phases/123-accessibility-remediation/123-LOADING-STATE-FINDING.md` — New. Full controlled-measurement record, class sweep, in-scope/deferred split, sanctioned-patterns cross-check.
- `.planning/phases/123-accessibility-remediation/a11y-loading-state/*.json` — New, 8 files. Final (post-escalation) raw per-cell axe capture, committed per the 123-04 precedent.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: escalated past the plan's literal "delete /70" instruction for `CodeVaultGraph.tsx` once live re-measurement proved it insufficient, applying the same `text-foreground` remedy that already worked for `RunTimeline.tsx`; swept `CodeVaultGraph.tsx:678`'s identical sibling instance alongside `:892` since it's in the same already-open file; recorded the plan's stale predicted counts (6→5 nodes, 6→5 occurrences) as corrected by live re-derivation (3→1 occurrences; 0 final node count) rather than forcing agreement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `CodeVaultGraph.tsx`'s literal D-04-default remedy (delete `/70`) left the element failing AA**
- **Found during:** Task 2, first re-measurement pass
- **Issue:** The plan's action text instructs deleting `/70` from `text-primary/70` "per D-04's default remedy," independent of Task 1's verdict. Task 1 had already confirmed the cause is `animate-pulse`'s own opacity trough, which composites even a full-strength (no-alpha) token below AA if the token isn't bright enough. Applying only the literal instruction and re-measuring showed exactly that: 3 nodes still failing at 2.92-3.09:1.
- **Fix:** Stepped `text-primary` → `text-foreground` at both `:892` and the sibling `:678`, mirroring the remedy Task 2's own instructions already specify for the confirmed-animation case (used for `RunTimeline.tsx`). Re-measured: 0 violations.
- **Files modified:** `src/components/graph/CodeVaultGraph.tsx`
- **Verification:** Live axe re-run on all 8 cells post-escalation, parsed from raw JSON, 0 `color-contrast` nodes.
- **Committed in:** `54585ac3` (Task 2 commit) — the intermediate delete-only state was never committed separately; both edits landed as one commit reflecting the final, verified state.

**2. [Rule 1 - Bug, class sweep] `CodeVaultGraph.tsx:678`'s identical, unmeasured sibling instance**
- **Found during:** Task 2 baseline check (`grep -n "text-primary" src/components/graph/CodeVaultGraph.tsx`)
- **Issue:** The exact same `text-primary/70 font-mono text-base animate-pulse` class string appears a second time in the same file, inside the lazy 3D-view's `Suspense` fallback ("Loading 3D render…"). Never independently measured (unreachable during the axe scan because `renderMode` defaults to `"2d"`), but a real, live instance of the identical confirmed defect.
- **Fix:** Swept alongside `:892` with the same `text-foreground` remedy, per D-01's "fixed as a class... not just the two flagged instances."
- **Files modified:** `src/components/graph/CodeVaultGraph.tsx`
- **Verification:** `grep -n "text-primary" src/components/graph/CodeVaultGraph.tsx` post-fix shows only `:902`'s untouched icon alpha remaining out of the animate-pulse family; `npx tsc --noEmit` and the two affected test suites pass.
- **Committed in:** `54585ac3` (Task 2 commit)

**Impact on plan:** Both are within `CodeVaultGraph.tsx`, already in `files_modified`; no scope expansion beyond the plan's own file list. Net effect: the plan's Task 2 acceptance criterion ("all six non-shell measured contrast nodes clear AA") is met, plus one additional never-measured sibling instance of the same defect closed in the same file.

### Findings Reported, Not Absorbed

**6 sibling instances of the identical `animate-pulse`-driven text-contrast mechanism exist outside this plan's scope**, recorded in full in `123-LOADING-STATE-FINDING.md`'s "Remainder" section: `KGSearchResults.tsx:60`, `KnowledgeGraph.tsx:940,1712,1752,1806` (all `text-primary/70 ... animate-pulse`, `/knowledge-graph` route), `Memory.tsx:815` (`text-muted-foreground animate-pulse`, `/memory` route), and `IntegrationHealth.tsx:60` (`text-yellow-400 animate-pulse` — a second, distinct defect: a hardcoded Tailwind colour bypassing the token system entirely, not routed among the 5 measured pages). None render on the 5 pages `e2e/theme-contrast.spec.ts` currently measures and none are in this plan's `files_modified`, so A11Y-02's current criterion does not reach them. Deferred for a future sweep (a widened `PAGES` list, or a dedicated follow-up plan), not silently dropped.

## Issues Encountered

None beyond the two documented above (both resolved, neither blocking).

## User Setup Required

None. All measurement ran against the pre-existing `dev:noauth` server already provided in the execution environment (`http://127.0.0.1:5181`, reused, never restarted).

## Next Phase Readiness

- Both non-shell `color-contrast` sites the current 20-cell matrix can reach are closed at 0/8 re-measured cells; combined with 123-04's app-shell fix, the full 20-cell matrix (once re-run in aggregate by a later plan) should read 0 `color-contrast` for both shell and these two loading states.
- `123-LOADING-STATE-FINDING.md` names 6 further sibling instances of the identical mechanism on unmeasured routes, for whichever plan widens `e2e/theme-contrast.spec.ts`'s `PAGES` list (123-03/123-08) or a dedicated follow-up to pick up.
- The `readable`-theme-as-control pattern (blanket `animation: none`) is now a documented, reusable must-differ check for any future `animate-pulse`-driven contrast claim.
- No blockers.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*

## Self-Check: PASSED

Files confirmed present on disk: `src/components/graph/CodeVaultGraph.tsx` (modified, present), `src/components/RunTimeline.tsx` (modified, present), `.planning/phases/123-accessibility-remediation/123-LOADING-STATE-FINDING.md` (YES), `.planning/phases/123-accessibility-remediation/a11y-loading-state/` (8 JSON files, YES). Both task commit hashes (`c6813ffe`, `54585ac3`) confirmed present via `git log --oneline --all | grep`. No missing items.
