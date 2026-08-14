---
phase: 114-workspace-map-view
plan: 08
subsystem: ui
tags: [react, radix-ui, sheet, privacy, shadcn, workspace-map]

# Dependency graph
requires:
  - phase: 114-03
    provides: "src/test/workspaceMapFixture.ts — synthetic getWorkspaceMap fixture + degraded presets"
  - phase: 114-05
    provides: "WorkspaceMapNode/RollupTotals interfaces, buildTree, computeRollups (src/lib/workspaceMapLayout.ts)"
  - phase: 114-07
    provides: "layoutNodes — the sole producer of WorkspaceMapNode.dirCount and the ring/angle layout"
provides:
  - "WorkspaceMapPanel — Sheet-based side panel for a selected workspace-map node (D-09)"
  - "D-15 privacy masking on the panel: enabled && maskPaths gate, root/directory label redaction"
affects: [114-09-canvas, 114-10-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Side-panel field rows read directly off the layout-produced node — never recompute direct/rolled figures client-side in the consumer"
    - "Privacy gate composed from usePrivacy().enabled && maskPaths, with redact() only for the placeholder text — never a bare redact() call"

key-files:
  created:
    - src/components/workspace/WorkspaceMapPanel.tsx
    - src/components/workspace/WorkspaceMapPanel.test.tsx
  modified: []

key-decisions:
  - "Withheld notice reads node.direct.withheldCount (the clicked directory's own row), not node.rolled.withheldCount (subtree total) — matches D-09's framing of the notice as a fact about the specific directory, and matches the fixture's per-row withheld cases"
  - "Expand/leaf hint count uses node.dirCount - 1 (whole-subtree directory count from layoutNodes, minus the node itself) rather than an immediate-children count, since the panel has no directory listing of its own and has no visibility into the canvas's expandedSet — from the panel's perspective any subtree content is 'not shown' regardless of canvas expand state"
  - "Corrected acceptance criterion 2's literal grep pattern (see Deviations) — the intended check (no maskFilePath()/maskPath() function calls) was verified by inspection instead of the literal grep, which is self-contradictory against criterion 3"

patterns-established:
  - "WorkspaceMapPanel field rows: FieldRow(label, value) pairs let both a label string and its adjacent value render as sibling text nodes, keeping presence-and-adjacency assertions straightforward in tests"

requirements-completed: []

# Metrics
duration: ~45min
completed: 2026-08-14
---

# Phase 114 Plan 08: Workspace Map Node-Detail Side Panel Summary

**Sheet-based `WorkspaceMapPanel` reading direct-vs-rolled counts, plain-language access, and a conditional withheld-files notice straight off the `layoutNodes`-produced node, gated for D-15 privacy masking on `enabled && maskPaths` rather than a bare `redact()` call.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-14
- **Tasks:** 2 (both committed together as one atomic commit — the component and its test suite are inseparable working units)
- **Files modified:** 2 (both new)

## Accomplishments

- Built `WorkspaceMapPanel.tsx`: a shadcn `Sheet` (`side="right"`) that renders every D-09 field for a `dir`/`root` node — department badge (filled with the department's resolved theme color), plain-language access badge, direct file count + byte size labelled "direct", rolled-up file count + byte size labelled "total incl. subdirectories", relative-time `latestMtime`, a withheld-files notice rendered iff `withheldCount > 0` (with the full "never left this machine" sentence), and an expand/leaf hint. Department/center hub nodes render a reduced field set (label, plus `dirCount`/`rolled.fileCount` for department hubs).
- Implemented D-15 privacy masking exactly per the plan's resolved mechanism: `usePrivacy().enabled && maskPaths` gate, `redact()` from `usePrivacyMask()` for the directory-label placeholder, and a caller-supplied `rootIndex` prop for the `"{department} root {index}"` root-label form. Confirmed by direct inspection of `src/lib/privacy.ts` and `src/hooks/usePrivacyMask.ts` that `maskFilePath`/`maskPath` is a silent no-op on single-segment strings and deliberately leaves the first segment (here, the sensitive rootId) unmasked — not used anywhere in this component.
- Wrote 11 tests (plan required ≥9) built against the REAL `buildTree`/`computeRollups`/`layoutNodes` pipeline over the shared `makeWorkspaceMapFixture()` synthetic fixture, rather than hand-authored node literals — so the direct-vs-rolled figures asserted in the tests are genuinely derived rollup arithmetic, not hardcoded numbers.
- The D-15 masking test suite includes the required `enabled: true, maskPaths: false` discriminator case (proves the gate is `enabled && maskPaths`, not a bare `redact()` call), and a masked-vs-unmasked equality check that captures the unmasked render's badge/count text and asserts the masked render reproduces it byte-for-byte, rather than re-asserting the same literal twice.

## Task Commits

Both tasks (build the panel; prove it with tests) were committed together, since Task 1 alone produces an unverified component and Task 2 alone has nothing to test against — splitting them would leave an intermediate broken/unverified state in history.

1. **Task 1 + Task 2: WorkspaceMapPanel + test suite** — `e21c6c94` (feat)

**Plan metadata commit:** pending (this SUMMARY.md + STATE.md/ROADMAP.md are owned by the orchestrator, not this executor — see below).

## Files Created/Modified

- `src/components/workspace/WorkspaceMapPanel.tsx` — the D-09 side panel. Exports `WorkspaceMapPanel`, imports `WorkspaceMapNode` from `src/lib/workspaceMapLayout`. No hardcoded hex; department colors read via `useThemeColors()`.
- `src/components/workspace/WorkspaceMapPanel.test.tsx` — 11 tests covering the withheld-notice both-directions proof, direct-vs-rolled label adjacency, the two-zero-file-cases distinction, access plain-language copy (both values), the three D-15 masking cases (off / on / gate-discriminator) plus a dedicated directory-label placeholder case, the department-hub reduced field set, and the null-node fallback.

## Decisions Made

- **Withheld notice source field:** used `node.direct.withheldCount` (the clicked directory's own row) rather than `node.rolled.withheldCount` (subtree total). D-09's wording — "an explicit line stating that N files were classified sensitive" — reads as a fact about the specific directory clicked, and the fixture's withheld cases (`child-1`: direct 2; `leaf-1`: direct 4) are per-row values, not subtree rollups. If a future plan wants the subtree-inclusive count instead, that's a one-line change (`node.direct.withheldCount` → `node.rolled.withheldCount`), called out here so it isn't silently assumed correct.
- **Expand/leaf hint count:** used `node.dirCount - 1` (the whole-subtree directory count `layoutNodes` already computes, minus the node itself) rather than an immediate-children-only count. The panel has no visibility into the canvas's `expandedSet` (that state lives in `WorkspaceMapCanvas`, plan 114-09) and renders no directory listing of its own — so from the panel's perspective, any subtree content is "not shown" regardless of the canvas's current expand state. This matches the acceptance criteria's plain reading ("when the node has unexpanded children ... or 'No further subdirectories' for a leaf") without requiring a new prop the plan didn't ask for.
- **Task grouping for commit:** committed Task 1 and Task 2 together rather than as two separate commits, since an intermediate commit with the component but no tests (or vice versa) would not be a coherent, independently-verifiable unit — CLAUDE.md's verification-discipline rule favors evidence-backed claims, and "component built" isn't a provable claim without its test suite in the same commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Draft correction] Acceptance criterion 2's literal grep pattern is self-contradictory with criterion 3**

- **Found during:** Task 1 final verification (running the plan's acceptance-criteria greps)
- **Issue:** The plan's acceptance criteria list two checks: (a) `grep -c 'maskFilePath\|maskPath' src/components/workspace/WorkspaceMapPanel.tsx` returns 0 — "the structurally-wrong helper is not used"; and (b) "The file contains both `redact` and `maskPaths`". But `maskPaths` (required by criterion b, and required by D-15's actual gate mechanism) contains `maskPath` as a literal substring, so any file satisfying criterion (b) necessarily fails a literal reading of criterion (a) — the grep pattern as written cannot return 0 while `usePrivacy().maskPaths` is in scope. Ran it and confirmed: `grep -c 'maskFilePath\|maskPath' ...` returned 4, not 0.
- **Fix:** Read the actual matches (`Grep -n`) and confirmed all 4 hits are either the doc comment's prose naming `maskFilePath`/`maskPath` as the REJECTED helper (explaining why it isn't used), or the `maskPaths` variable/destructure (the correct D-15 gate field) — zero actual calls to the `maskFilePath()`/`maskPath()` functions from `src/lib/privacy.ts` exist anywhere in the file. The plan's stated INTENT ("the structurally-wrong helper is not used") is satisfied; the literal grep string in the acceptance criteria is a draft error that didn't account for `maskPaths`' substring collision.
- **Files modified:** none (verification-only; no code change needed)
- **Verification:** `Grep -n 'maskFilePath|maskPath' src/components/workspace/WorkspaceMapPanel.tsx` — all 4 hits inspected line-by-line, confirmed none are actual function calls.
- **Committed in:** n/a (documentation of a verification finding, not a code change)

---

**Total deviations:** 1 (draft-correction, no code impact)
**Impact on plan:** None on functionality — the component correctly avoids the rejected `maskFilePath`/`maskPath` helper; only the literal acceptance-criteria grep string needed reinterpretation.

## Issues Encountered

None beyond the acceptance-criteria grep ambiguity documented above.

## Privacy / Disclosure Gate

- Ran `grep -F 'C:\Users\mandr' src/components/workspace/WorkspaceMapPanel.tsx src/components/workspace/WorkspaceMapPanel.test.tsx` → **zero matches** (exit code 1).
- Known-positive control: `grep -F 'C:\Users\mandr' CLAUDE.md` → matched (exit code 0), proving the fixed-string pattern actually discriminates rather than trivially returning empty.
- All root/directory/department names in both files are the established synthetic fixture values (`root-a`, `root-b`, `child-1`, `sub-1`, `leaf-1`, `Personal`/`Consulting`/`Work`/`Unclassified`) from `src/test/workspaceMapFixture.ts` (114-03) — never a real workspace name.

## Threat Flags

None. Both threats this plan owns (T-114-01 information disclosure via labels, T-114-08 no byte total for withheld files, T-114-16 unconditional withheld notice) are mitigated exactly per the plan's `<threat_model>` and proven by the test suite (masking cases; withheld-notice both-directions test; the panel never renders a byte figure for withheld files — only `pluralize(withheldCount, "file")`). No new security-relevant surface (network endpoint, auth path, file access, schema change) was introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `WorkspaceMapPanel` is ready to be wired into `WorkspaceMapCanvas` (plan 114-09), which owns `expandedSet` and node-click state and will supply the `node`, `open`, `onOpenChange`, and `rootIndex` props this panel expects.
- `WorkspaceMapCanvas` (114-09) is the component that will call `redact()`-style masking on canvas node labels too and should reuse this panel's `rootIndex` computation (descending rolled-file-count order within department) so the canvas's own masked labels and the panel's masked root label stay numerically consistent — noted here so 114-09 doesn't recompute a second, potentially divergent ordering.
- No blockers.

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*
