---
phase: 123-accessibility-remediation
plan: 10
subsystem: ui
tags: [accessibility, contrast, wcag, tailwind, playwright, tokens]

requires:
  - phase: 123-02
    provides: shared sentinel-guarded rasteriser (e2e/lib/contrast.ts), paintedColorOfClass/sampleColor/contrastRatio
  - phase: 123-08
    provides: the 188/188-measured contrast matrix and the recovered dev-server gap
provides:
  - a STATUS_FILL_MATRIX in e2e/contrast-isolation.spec.ts measuring 3 candidate foregrounds x 4 status-fill backgrounds x 4 themes (48 rows, family:"status-fill")
  - all 8 sites of the bg-(--status-*) / text-(--foreground) defect class remedied to a measured foreground
  - the ScanResultsPanel.tsx header comment corrected to stop re-seeding the defective pairing
  - a closed todo (warn-fill-foreground-pairing-sub-aa.md) and a newly-filed one (ideationrow-text-white-raw-palette-class.md)
affects: [123-11, 123-12, 123-13]

tech-stack:
  added: []
  patterns:
    - "status-fill contrast pairings measured by token (bg-(--token) / text-(--token)), not by opacity-modifier class -- reuses paintedColorOfClass + sampleColor directly, no compositeSample needed since neither side carries alpha"
    - "single foreground (text-(--primary-foreground)) proven by measurement to clear 4.5:1 against all three status-fill backgrounds these components use, so one remedy token covers the whole site class"

key-files:
  created:
    - .planning/todos/pending/ideationrow-text-white-raw-palette-class.md
  modified:
    - e2e/contrast-isolation.spec.ts
    - src/components/IdeationRow.tsx
    - src/components/InboxCard.tsx
    - src/components/ScanResultsPanel.tsx
    - src/components/TaskDetail.tsx
    - .planning/todos/completed/warn-fill-foreground-pairing-sub-aa.md (moved from pending/, closed)

key-decisions:
  - "TaskDetail.tsx:67's assembled template was changed directly (text-(--foreground) -> text-(--primary-foreground)) rather than moving the foreground into PRIORITY_COLORS, because Task 1's table showed --primary-foreground clears 4.5:1 against all three of --status-error/-warn/-ok in every theme -- one token proven against all three backgrounds, per the plan's own branching instruction."
  - "All 8 sites took the same remedy token (--primary-foreground), not because it was pattern-matched from StatusBadge's warn entry, but because the status-fill matrix measured it clearing 4.5:1 against every background these 8 sites actually use (none use --status-error-fill, the background StatusBadge's error remedy pairs against a different foreground for)."

patterns-established:
  - "Pattern: when a component's badge foreground/background pairing needs remediation, measure the candidate foreground against every background the SITE actually uses (not just the one StatusBadge control covers) before reusing a control's remedy token across a class."

requirements-completed: [A11Y-02]

duration: ~35min
completed: 2026-08-20
---

# Phase 123 Plan 10: Status-Fill Contrast Remediation Summary

**Measured and remedied all 8 `bg-(--status-*) text-(--foreground)` sites (~1.4-1.8:1) to `text-(--primary-foreground)`, proven by rasterisation to clear 4.5:1 against every background those sites use, in all four themes.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files modified:** 6 (1 test file, 4 components, 2 todo files touched: 1 closed, 1 created)

## Accomplishments

- Added a `STATUS_FILL_MATRIX` to `e2e/contrast-isolation.spec.ts` measuring `--foreground`, `--primary-foreground`, and `--status-error-on-fill` against `--status-error`, `--status-warn`, `--status-ok`, and `--status-error-fill` in all 4 themes (48 rows tagged `family: "status-fill"`, merged into the same single-worker ledger write as the existing 240-row opacity-modifier matrix + 8-row C6 before-control — 296 rows total).
- Calibrated the harness against StatusBadge's recorded figure: `--foreground` on `--status-warn` measured **1.83:1 (cyan), 1.83:1 (emerald), 1.39:1 (readable), 1.37:1 (aubergine)** — reproducing the recorded ~1.4-1.8:1 (cyan/emerald landed a hair above the upper bound but both are comfortably below the 4.5 assertion threshold). `--primary-foreground` on `--status-warn` measured **10.69 / 10.69 / 11.34 / 11.47**, clearing 4.5 in every theme.
- Remedied all 8 sites of the class to `text-(--primary-foreground)`, the one foreground the measured table showed clearing 4.5:1 against all three backgrounds these sites use (worst-theme ratios: **5.45:1** on `--status-error`, **10.69:1** on `--status-warn`, **9.85:1** on `--status-ok`).
- Corrected `ScanResultsPanel.tsx`'s header comment (`:10-14`), which previously documented the defective `text-(--foreground)` pairing and would have re-seeded it into new code.
- Closed `.planning/todos/pending/warn-fill-foreground-pairing-sub-aa.md` (the todo this plan resolves) and filed a new one for the out-of-class `text-white` sites in `IdeationRow.tsx`.

## Task Commits

1. **Task 1: Measure all 8 status-fill pairings across all four themes** - `4b210b27` (test)
2. **Task 2: Remedy all 8 sites per their own measured ratio and correct the re-seeding comment** - `f23f32df` (fix)

Each commit verified against its own SHA (`git show --format= --name-only <sha>`) — no foreign files present in either.

## Files Created/Modified

- `e2e/contrast-isolation.spec.ts` — added `STATUS_FILL_FOREGROUNDS`/`STATUS_FILL_BACKGROUNDS` constants, `measureStatusFillPairing()`, the per-theme measurement loop (pushed into the same `rows` array the existing matrix writes), updated `expectedIsolationRows` to include the 48 new rows, and the two calibration assertion blocks.
- `src/components/IdeationRow.tsx:30` — `medium` severity foreground swapped to `text-(--primary-foreground)`.
- `src/components/InboxCard.tsx:97-99` — `RiskBadge`'s `styles` map, all three foregrounds swapped.
- `src/components/ScanResultsPanel.tsx:39,41,43` — `severityBadgeClass`'s three returns swapped; header comment `:10-14` corrected.
- `src/components/TaskDetail.tsx:67` — the assembled priority-badge template's foreground swapped (see Decisions).
- `.planning/todos/pending/ideationrow-text-white-raw-palette-class.md` — new, files the out-of-scope `text-white` sites.
- `.planning/todos/completed/warn-fill-foreground-pairing-sub-aa.md` — moved from `pending/`, `status: closed`, resolution recorded.

## Decisions Made

See `key-decisions` in frontmatter. In short: measure first, then pick the single token the measurement supports rather than assuming StatusBadge's warn-tier remedy transfers — it happened to transfer to all 8 sites here because none of them use the `--status-error-fill` background StatusBadge's error remedy is paired against, but that was confirmed by the table, not assumed.

## Deviations from Plan

### Auto-fixed / plan-text corrections

**1. [Rule 1 - plan-text was stale] `warn-fill-foreground-pairing-sub-aa.md` under-counted the sites and missed `TaskDetail.tsx`'s real location**
- **Found during:** Task 2 read-first pass
- **Issue:** The pending todo this plan resolves (planted 2026-08-19) named only 4 sites and cited `TaskDetail.tsx:29` as carrying `bg-(--status-warn)` with "no explicit fg — inherits". The plan's own `<interfaces>` block (independently re-derived live, 2026-08-20) had already corrected this to 8 sites with `TaskDetail.tsx:67` as the real (assembled) foreground site — confirmed by reading the file.
- **Fix:** Followed the plan's re-derived interfaces, not the stale todo. Recorded the correction in the todo's own closing note so it doesn't mislead a future reader.
- **Files modified:** `.planning/todos/completed/warn-fill-foreground-pairing-sub-aa.md`
- **Committed in:** `f23f32df` (Task 2 commit)

**2. [Not a defect, a plan-text imprecision] Task 2's acceptance criterion for `TaskDetail.tsx` assumed `text-(--foreground)` appears only at `:67`**
- **Found during:** Task 2 verification
- **Issue:** `grep -Fc "text-(--foreground)" src/components/TaskDetail.tsx` returns **11**, not 0, after the swap — the file uses that token extensively elsewhere (dialog title, status text, agent name, description, due date, etc.), none of which are paired with a `bg-(--status-*)` fill and none of which are part of this defect class.
- **Resolution:** Verified the actual badge site directly instead: `grep -n "PRIORITY_COLORS\[task.priority\]" src/components/TaskDetail.tsx` shows `:67` now reads `text-(--primary-foreground)` — the one and only occurrence of that literal string paired with `${PRIORITY_COLORS[...]}` is fixed; the other 11 are correctly untouched.
- **No files changed as a result** — this is a verification-method note, not a fix.

**3. [Organizational only] The todo-close landed in commit `f23f32df` (Task 2), not split across both task commits**
- **Found during:** staging Task 1
- **Issue:** `git mv` on the pending→completed todo rename stages immediately; when Task 1 was committed with only `e2e/contrast-isolation.spec.ts` explicitly `git add`-ed, the already-staged rename (frontmatter still at its pre-edit "pending" state, edits not yet re-staged) rode along into commit `4b210b27`. The subsequent content edits to that same file were then staged and committed in `f23f32df` alongside Task 2, so the todo's final "closed" state landed one commit later than its bare rename.
- **Verification:** Both commits checked by `git show --format= --name-only <own-sha>` — no files outside this plan's scope appeared in either. Not a concurrent-session sweep; both commits are entirely this plan's own work, just split slightly differently than the two-task structure implied.
- **No further action** — noted here per the sequential-execution protocol's verify-by-own-SHA requirement.

---

**Total deviations:** 1 plan-text correction applied, 1 verification-method clarification, 1 organizational note. No scope creep, no unrelated fixes, no foreign files in either commit.
**Impact on plan:** None of the above changed what was shipped — all 8 sites are remedied and measured exactly as the plan's re-derived interfaces specified.

## Issues Encountered

- The plan's Task 2 verify command (`npm test -- src/components/IdeationRow src/components/InboxCard src/components/ScanResultsPanel src/components/TaskDetail`) only matches one existing test file (`InboxCard.test.tsx` — 10 tests, all passing); `IdeationRow.tsx`, `ScanResultsPanel.tsx`, and `TaskDetail.tsx` have no unit test files in this repo. `npx tsc --noEmit` exits 0 for all four.

## Next Phase Readiness

- `e2e/.artifacts/123-isolation-pass2.json` now carries the full status-fill measured table (`family: "status-fill"`, 48 rows) for any later plan that needs to re-derive or re-verify these ratios.
- Plans 123-11/123-12 (the opacity-modifier ratio-gated sweeps) are unaffected by this plan's changes — different defect class, different files.
- 123-13 (operator closeout checkpoint) can now count this plan's todo (`warn-fill-foreground-pairing-sub-aa.md`) as closed and the new `ideationrow-text-white-raw-palette-class.md` as a filed, unscheduled backlog item.

## Self-Check: PASSED

All 8 created/modified files found on disk; all 3 commits (`4b210b27`, `f23f32df`, `4a47ac02`) found
in `git log --oneline --all`; `git status --short` clean after the final tracking commit.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*
