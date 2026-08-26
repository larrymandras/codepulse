---
phase: 120-polish-verified-defects
plan: 04
subsystem: ui
tags: [react, tailwind, status-badge, design-tokens, testing]

# Dependency graph
requires:
  - phase: 120-01, 120-02, 120-03
    provides: kill-list removal, dead-CSS deletion, pulse-dot de-animation already landed on master before this plan started (no file overlap with this plan's edit surface)
provides:
  - "Quiet-badge law (only Failed/failed renders filled) applied to both job-status badge implementations in the repo"
  - "D-15 spine-word vocabulary (Running/Succeeded/Failed/Cancelled) applied to StatusBadge.tsx and ForgeStatusBadge.tsx with all honest exceptions preserved and documented"
  - "SC#4 (auth_failed distinct from failed) re-proven as a paired-control test after the fill removal changed how the distinction is carried"
  - "120-BADGE-INVENTORY.md: a re-derived, corrected D-17 work-list for Phase 122's TOKEN-05 shared StatusBadge primitive"
affects: [122-token-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Quiet status chip shape: text-(--status-X) border border-(--status-X)/40 bg-transparent (or the bracket-token equivalent text-[var(--status-X)] border-[var(--status-X)]/N bg-transparent in files that already used bracket syntax) replaces bg-(--status-X) text-white fills everywhere except the error/failed semantic"
    - "SC#4-style distinctness guards must be paired controls across two renders (assert token present on A / absent on B AND present on B / absent on A), never a one-sided substring match on a colour word"

key-files:
  created:
    - src/components/StatusBadge.test.tsx
    - .planning/phases/120-polish-verified-defects/120-BADGE-INVENTORY.md
  modified:
    - src/components/StatusBadge.tsx
    - src/components/forge/ForgeStatusBadge.tsx
    - src/components/forge/ForgeStatusBadge.test.tsx

key-decisions:
  - "D-17's boundary as written in CONTEXT.md could not hold: StatusBadge.tsx's fill law necessarily propagates to all 22 real consumers (re-derived; plan/context said 19), not just Executions, because they share one lookup table. Documented in 120-BADGE-INVENTORY.md §2 as a fact, not a scope decision."
  - "Kept the quiet-chip shape per-file-consistent rather than repo-wide-consistent: StatusBadge.tsx uses the parenthesis token form (text-(--status-X)) already dominant in that file's imports; ForgeStatusBadge.tsx kept its pre-existing bracket form (text-[var(--status-X)])."

requirements-completed: [POLISH-05]

# Metrics
duration: ~20min
completed: 2026-08-17
---

# Phase 120 Plan 04: Status Badge Quiet Law + Spine Vocabulary Summary

**Only `Failed`/`failed` renders filled in both job-status badge implementations now; `completed`/`stopped` read `Succeeded`/`Cancelled`; SC#4 is proven by a paired-control test instead of a substring match on a fill colour word; and a corrected 22-consumer inventory (not the plan's stated 19) is handed to Phase 122.**

## Performance

- **Duration:** ~20 min (uncommitted — see note below)
- **Completed:** 2026-08-17T17:37:18Z
- **Tasks:** 3/3
- **Files modified:** 3 (StatusBadge.tsx, ForgeStatusBadge.tsx, ForgeStatusBadge.test.tsx)
- **Files created:** 2 (StatusBadge.test.tsx, 120-BADGE-INVENTORY.md)

## Accomplishments

- `src/components/StatusBadge.tsx`: `ok`/`warn`/`info` semantics converted from a saturated
  `bg-(--status-*) text-white` fill to a quiet `text-(--status-*) border border-(--status-*)/40
  bg-transparent` treatment. `error` stays filled. `completed`'s label changed from `"DONE"` to
  `"SUCCEEDED"`; all 21 other entries across five unrelated vocabularies (execution mode, voice
  call, roster, swarm task, quality) are byte-for-byte untouched. New direct test file added — this
  component had 22 real consumers and no test before this plan.
- `src/components/forge/ForgeStatusBadge.tsx`: the same quiet treatment applied to all 8 non-`failed`
  entries plus the unknown-status fallback chip; `failed` stays the one filled entry
  (`bg-red-900/60`). `completed`→"Succeeded", `stopped`→"Cancelled"; five states (`auth_failed`,
  `queued`, `pending`, `stopping_pending`, `expired`) keep distinct labels with a stated reason.
  `colorScheme` derivation, `data-status`/`aria-label`, the `animate-spin` condition and icon
  choices are unchanged.
- `ForgeStatusBadge.test.tsx`: the old one-sided `/amber/i` proxy for SC#4 replaced with a genuine
  paired control (auth_failed carries `--status-warn` and NOT `--status-error`; failed carries
  `--status-error` and NOT `--status-warn`, asserted in one test across two renders). Added an
  iterating fill-law test (failed has the one fill; each of the other 8 statuses has none). Also
  fixed one test the plan did not predict would break — see Deviations.
- `120-BADGE-INVENTORY.md`: re-derived the StatusBadge.tsx consumer list from scratch (found 22,
  not the plan's stated 19 — see Deviations), tabulated which vocabulary each of the 22 sites feeds
  the badge, identified the 3 genuinely-remaining filled badges outside both modules
  (`skills/IntakeStatusBadge.tsx`'s `RowStatusBadge`/`SeverityBadge`/`VerdictBadge`), and produced
  the full D-15 exceptions register across both modules.

## Task Commits

**Not committed — per plan `<output>` and the orchestrator's explicit instruction, this is a
shared checkout and the orchestrator commits all work with explicit paths after this executor
returns.** No `git add` or `git commit` was run. `git status --short` at completion:

```
 M src/components/StatusBadge.tsx
 M src/components/forge/ForgeStatusBadge.test.tsx
 M src/components/forge/ForgeStatusBadge.tsx
?? .planning/phases/120-polish-verified-defects/120-BADGE-INVENTORY.md
?? src/components/StatusBadge.test.tsx
```

(`.planning/STATE.md` also shows as modified in `git status` — that change was made by the
orchestrator/a concurrent session before this executor started, not by this plan; it was not
touched here, per instruction.)

## Files Created/Modified

- `src/components/StatusBadge.tsx` — quiet fill law + `completed`→`SUCCEEDED` spine word + header/inline comments naming D-15/D-16
- `src/components/StatusBadge.test.tsx` — new direct test file (7 tests): D-15 relabel + swarm-`done` control, D-16 fill/quiet assertions for `failed`/`completed`/`running`/`live`, unmapped-status fallback
- `src/components/forge/ForgeStatusBadge.tsx` — quiet fill law across 8 entries + fallback chip, `completed`→`Succeeded`, `stopped`→`Cancelled`, 5 documented D-15 exceptions, SC#4 comment rewritten for the token-based (not fill-based) distinction
- `src/components/forge/ForgeStatusBadge.test.tsx` — label expectations updated (Succeeded/Cancelled); old one-sided amber substring test replaced with paired-control SC#4 guard; new iterating fill-law test (9 tests); fixed `stopping_pending uses amber` test (see Deviations)
- `.planning/phases/120-polish-verified-defects/120-BADGE-INVENTORY.md` — new, D-17 work-list for Phase 122 (§1 what changed, §2 22-site propagation table with re-derivation command + raw output, §3 genuinely-remaining filled sites, §4 D-15 exceptions register, unscoped regression gate totals, "what I dropped and why")

## Decisions Made

- Kept the two modules' existing token-syntax conventions rather than unifying them: `StatusBadge.tsx`
  uses `text-(--status-X)` (the parenthesis CSS-var form already dominant among its 22 consumers'
  broader codebase usage), `ForgeStatusBadge.tsx` uses `text-[var(--status-X)]` (the bracket form
  the file already used before this plan). Unifying the two forms was out of scope (D-02 no-refactor)
  and not required by any acceptance criterion.
- Wrote several in-code comments deliberately avoiding the literal label strings they describe (e.g.
  referring to "the field name itself" rather than writing `"Completed"` in quotes) so the exact-match
  grep acceptance criteria (`grep -c 'Succeeded'` = 1, `grep -cE '"Completed"|"Stopped"'` = 0, etc.)
  hold precisely rather than being inflated by explanatory prose. This is a documentation-style
  tradeoff, not a code behavior change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan under-predicted which Forge tests would break under the fill removal**
- **Found during:** Task 2 (ForgeStatusBadge quiet law)
- **Issue:** `<interfaces>` §C in the plan listed exactly four tests expected to break (completed
  label, stopped label, the auth_failed amber test, and — noted as safe — the failed red/amber test).
  It did not mention `"stopping_pending uses amber and animates"` (originally ~line 110), which
  asserted `badge.outerHTML` matches `/amber/i`. Removing the `bg-amber-900/40` fill from
  `stopping_pending` (D-16) also removed the only literal occurrence of the word "amber" in that
  render, so this test would have failed silently as a false regression if left unedited.
- **Fix:** Rewrote the test to assert the real property — `badge.className` contains `--status-warn`
  (the token that now carries the colour) — while leaving its `data-color-scheme` assertion
  (a genuinely separate, unchanged derived value) as-is. Added an explanatory comment noting this
  was one of the plan's own predicted-safe assertions that in fact broke.
- **Files modified:** `src/components/forge/ForgeStatusBadge.test.tsx`
- **Verification:** `npx vitest run src/components/forge/ForgeStatusBadge.test.tsx` — 37/37 pass.

**2. [Rule 1 - Bug] Plan's stated StatusBadge.tsx consumer count (19) undercounted the live import graph (22)**
- **Found during:** Task 3 (badge inventory)
- **Issue:** The plan's own re-derivation instruction ("re-derive the consumer list yourself rather
  than trusting this plan") caught that the interfaces-section count of 19 consumers was wrong. My
  first re-derivation attempt used a regex anchored to three specific import forms
  (`@/components/StatusBadge`, `./StatusBadge`, `../StatusBadge`) and also returned 19 — matching
  the plan's number and appearing to confirm it. Only a second, broader pass (`from ["'][^"']*
  \bStatusBadge["']`, unanchored to a specific relative-path depth) surfaced three more consumers
  — `pages/Security.tsx`, `pages/Quality.tsx`, `pages/McpInventory.tsx` — that import via the
  `../components/StatusBadge` form (one directory level up then into `components/`), which neither
  the plan's original search nor my first attempt matched. This is the same class of grep
  false-negative documented in project LESSONS: a plausible-looking anchored pattern silently
  excludes a valid but differently-shaped match.
- **Fix:** Used the unanchored pattern, confirmed 22 real consumers (23 raw hits minus this plan's
  own new same-directory test file), and wrote the correction — with both search commands and their
  raw output — into `120-BADGE-INVENTORY.md` §2 rather than silently using the corrected number.
- **Files modified:** `.planning/phases/120-polish-verified-defects/120-BADGE-INVENTORY.md`
- **Verification:** Command and raw `rg` output are reproduced verbatim in the inventory file; anyone
  can re-run `rg --no-heading -n "from [\"'][^\"']*\bStatusBadge[\"']" src` from repo root to confirm.

**3. [Rule 3 - Blocking, resolved as a documented plan-vs-code disagreement, no code change] `data-color-scheme` grep acceptance criterion cannot be satisfied at "is 1" without deleting a pre-existing comment**
- **Found during:** Task 2 acceptance-criteria verification
- **Issue:** The plan's acceptance criteria state `grep -c 'data-color-scheme' ... is 1`. The
  UNEDITED, pre-120-04 file already contained 2 matches: a comment line (`// data-color-scheme
  mapping — preserved from forge for test compatibility`) and the JSX attribute itself
  (`data-color-scheme={colorScheme}`). This is not something Task 2's edits introduced — verified by
  reading the file before making any change (see the Read tool output captured at the start of this
  plan's execution). Deleting the pre-existing comment to force the grep count to 1 would remove
  documentation for no substantive reason and isn't something this plan's scope (fill law + two
  labels) calls for.
- **Fix:** No code change. The criterion this plan's own acceptance list treats as load-bearing is
  actually "the `colorScheme` ternary chain is byte-identical in the diff" (also listed, and true —
  confirmed by inspection, the derivation logic at lines ~118-131 is untouched). Documented here as
  a stale acceptance-criterion count rather than silently satisfying a wrong number.
- **Files modified:** none (documentation-only finding)
- **Verification:** `grep -c 'data-color-scheme' src/components/forge/ForgeStatusBadge.tsx` → 2
  (unchanged from pre-edit state); `git diff` shows the `colorScheme` ternary block is untouched.

---

**Total deviations:** 3 (2 auto-fixed bugs in test coverage/documentation, 1 documented plan-vs-code
disagreement with no code change required).
**Impact on plan:** All three tighten correctness (a genuinely-broken test now passes for the right
reason; the inventory Phase 122 inherits is accurate rather than repeating a wrong count) or avoid an
unnecessary edit. No scope creep — no consumer files were edited, no shared primitive was created.

## Issues Encountered

None beyond the deviations above. tsc and the full unscoped test suite were clean throughout; no
build or environment issues.

## Acceptance Criteria Verification (literal output)

**Task 1 — StatusBadge.tsx:**
```
npx tsc --noEmit                                                          → exit 0, no output
grep -c 'bg-(--status-error) text-white' StatusBadge.tsx                  → 1
grep -cE 'bg-\(--status-(ok|warn|info)\)' StatusBadge.tsx                 → 0
grep -c 'bg-muted text-muted-foreground' StatusBadge.tsx                  → 1
grep -c 'SUCCEEDED' StatusBadge.tsx                                       → 1
grep -c '"DONE"' StatusBadge.tsx                                          → 1
grep -ciE '#[0-9a-f]{3,6}|rgba?\(' StatusBadge.tsx                        → 0
npx vitest run StatusBadge.test.tsx JobsPanel.test.tsx
  BlackboardPanel.test.tsx IdeationRow.test.tsx                           → 4 files / 35 tests, all pass
```

**Task 2 — ForgeStatusBadge.tsx:**
```
npx tsc --noEmit                                                          → exit 0, no output
npx vitest run ForgeStatusBadge.test.tsx                                  → 37 tests pass (was 28 pre-edit)
grep -c 'bg-red-900/60' ForgeStatusBadge.tsx                              → 1
grep -cE 'bg-(green|blue|amber)-900|bg-zinc-800' ForgeStatusBadge.tsx     → 0
grep -c 'Succeeded' ForgeStatusBadge.tsx                                  → 1
grep -c 'Cancelled' ForgeStatusBadge.tsx                                  → 1
grep -cE '"Completed"|"Stopped"' ForgeStatusBadge.tsx                     → 0
grep -c 'data-color-scheme' ForgeStatusBadge.tsx                          → 2 (pre-existing; see Deviation #3)
grep -c 'Auth Failed' ForgeStatusBadge.tsx                                → 1
grep -ciE '#[0-9a-f]{3,6}|rgba?\(' ForgeStatusBadge.tsx                   → 0
```

**Task 3 — Inventory:**
```
test -s 120-BADGE-INVENTORY.md                                           → non-empty
grep -c 'file:line\|\.tsx:' 120-BADGE-INVENTORY.md                       → 53
npx tsc --noEmit                                                          → exit 0
```

**Full unscoped regression gate (mandatory per the orchestrator's plan-check addition):**
```
Baseline (before Task 1):  npx vitest run
  Test Files  334 passed | 17 skipped (351)
  Tests       4668 passed | 197 todo (4865)

After Tasks 1-3:            npx vitest run
  Test Files  335 passed | 17 skipped (352)
  Tests       4684 passed | 197 todo (4881)
```
Delta is exactly the new/expanded test files this plan touched (+1 file, +16 tests — 7 new in
`StatusBadge.test.tsx`, +9 net in `ForgeStatusBadge.test.tsx` growing 28→37). Zero new failures,
zero regressions in the other 15 test files (of the 17 that cover `StatusBadge.tsx`'s consumers)
that this plan's scoped Task 1/2 runs did not touch directly.

## Attended (not automatable) Verification — NOT PERFORMED, needs a human pass

The plan's `<verification>` section names one check this executor cannot perform: "with `dev:noauth`
running, open `/executions` and the Forge page and confirm by eye that only Failed rows read as
filled and that an `auth_failed` Forge badge is still obviously not a `failed` one." This executor
has no browser/visual-rendering tool available. All jsdom class-string assertions above pass, but per
the plan's own caveat ("A jsdom class-string assertion is not a rendered colour") this is not a
substitute for the visual check. **Recommend:** run `npm run dev` (or `dev:noauth` if configured),
open `/executions` and a Forge job list/detail view, and visually confirm (1) only Failed/failed rows
show a solid colour fill, everything else is text+outline, and (2) an `auth_failed` Forge badge still
reads as distinctly different from a `failed` one (amber/warn text+border vs. the red fill) before
treating POLISH-05 as visually verified end-to-end.

## User Setup Required

None — no external service configuration required. Frontend-only change; no Convex deploy needed.

## Next Phase Readiness

- Phase 122's TOKEN-05 (shared `StatusBadge` primitive) has a corrected, re-derived work-list in
  `120-BADGE-INVENTORY.md`: the real 22-consumer propagation surface (with per-site vocabulary),
  the 3 genuinely-remaining filled sites outside both modules (`IntakeStatusBadge.tsx`'s
  `RowStatusBadge`/`SeverityBadge`/`VerdictBadge`), and the full D-15 label-exception register with
  each exception's stated false claim, ready to seed the shared primitive's requirements.
- One pre-existing, unrelated oddity surfaced during re-derivation and flagged (not fixed, per
  D-01/D-02 scope discipline): `WarRoomTaskCard.tsx:66` passes `task.priority` (not a status) to
  `StatusBadge`, which has never had a matching `legacyMap` entry — it has always silently rendered
  through the `idle` fallback. Worth a future defect sweep or Phase 122 cleanup, not this plan's job.
- Blocker/concern: the attended visual check above has not been performed by anyone yet. It should
  happen before POLISH-05 is treated as fully verified at the milestone level.

---
*Phase: 120-polish-verified-defects*
*Completed: 2026-08-17*
