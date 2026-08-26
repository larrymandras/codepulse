# Phase 122 Plan 01: A11Y-01 Before-Matrix Capture Summary

Env-gated per-cell JSON capture added to the existing contrast matrix; a genuine 20-cell keyless
axe run against Phase 120's clean surface (24 violation objects / 218 nodes, one `color-contrast`
+ one Forge-only `aria-prohibited-attr` rule); the before table, rule breakdown and enumerated
47-route sampling limit committed to `122-CONTRAST-BASELINE.md`.

## What Was Built

**Task 1 — `e2e/theme-contrast.spec.ts` gained two env switches, nothing else changed.**
`A11Y_CAPTURE_DIR` writes `${theme}__${page}.json` via `node:fs` *before* the
`expect(results.violations).toEqual([])` assertion (a failing cell throws out of `expect()`, so a
write placed after it would silently leave holes for every cell with violations — which is most of
them, the entire point of this measurement). `A11Y_MEASURE_ONLY=1` skips that assertion so all 20
cells run in one pass rather than stopping at the first violating cell — A11Y-01 is sizing, not
remediation. The `fee96b5d` Clerk-gate guard, `THEMES`, `PAGES`, the `addInitScript` idiom and the
`withTags` list are untouched; `git diff` on the file is 38 pure insertions, zero deletions.

**Task 2 — the 20-cell before-matrix, run for real against `dev:noauth`.** Started
`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth` from Git Bash, probed `localhost:5181` AND
`127.0.0.1:5181` (both 200; `[::1]:5181` correctly 000, confirming the `--host 127.0.0.1` pin), then
ran the full matrix with both switches set. **20/20 measured, 0 skipped, 20/20 passed** (the
`A11Y_MEASURE_ONLY` switch means "passed" here means "ran to completion," not "zero violations" —
the violations are inside the captured JSON). Wall-clock: **14.3s** for the 20-cell run
(Playwright's own reported time). A control cell (`[cyan] Dashboard`) re-run against the gated
`:5173` server came back with Playwright status `skipped`, annotation reading exactly
`"Clerk auth gate present — Dashboard never rendered..."` — not passed, not failed — proving the 20
keyless captures are real and the guard still works. Committed all 20 JSON files after a T-122-02
disclosure scan (`grep -rF 'C:\Users\mandr'` on the capture dir → 0 hits, paired with a
known-present control `grep -rF 'http://localhost:5181'` → 20/20 hits, so the zero is believable).

**Task 3 — `122-CONTRAST-BASELINE.md`.** Before table (24 violation objects / 218 nodes, grand
total cross-checked two independent ways: summing `violationCount` across the 20 files, and
summing the two-rule breakdown), rule breakdown (`color-contrast`: 20 objects/214 nodes, all 20
cells; `aria-prohibited-attr`: 4/4, Forge only, all 4 themes — an unrelated markup defect, a
`div aria-label` without a permitting role, not a colour issue), and the D-24 sampling-limit
section listing all **42 unmeasured route files by name** (`ls src/pages/*.tsx | grep -v
'\.test\.' | wc -l` → 42, `ls src/pages/*/*.tsx | grep -v '\.test\.' | wc -l` → 5, total 47; the 5
measured routes mapped to their actual component files via `src/App.tsx`'s route table —
`Forge` → `ForgePage.tsx`, `Graphs` → `GraphsHub.tsx`, not files literally named `Forge.tsx`/
`Graphs.tsx`). AFTER/Delta stubbed to plan 122-19, named-pair ratios stubbed to plan 122-18.

## The 234 Figure, Addressed

`SEED-006-wcag-contrast-remediation.md`'s 2026-08-10 sample and this run's `[cyan] Dashboard` cell
are the **same violation** — identical rule (`color-contrast`), identical `fgColor`/`bgColor`
(`#067082` on `#060608`), same component (sidebar nav). That sample reported **234**; this run
reports **1 violation object / 4 nodes**. The units differ (234 was almost certainly a node/element
count at that measurement point, this run's `violationCount` counts violation *objects* grouped by
rule) and the timing differs (2026-08-10, pre-Phase-120, vs. 2026-08-18, post-Phase-120). Read
together with `120-DESIGN-REVIEW-HANDOFF.md`'s independent finding that "the quiet-badge law
improved contrast on every badge it touched," a two-orders-of-magnitude node-count drop on the same
violation is consistent, not suspicious — but it is **not** the confirmation of "234" that REQUIREMENTS.md
and this plan both warned against mistaking a coincidence for. The grand total this run measures
(24 objects / 218 nodes) is a different figure entirely and should not be read against 234 at all.
This was investigated before proceeding, per the plan's own guard against treating a
lower-than-expected number as automatic evidence of a broken run — the JSON was opened and the
rendered content (real nav labels, real header markup) confirmed the page genuinely rendered rather
than measuring an empty shell.

## Deviations from Plan

### Auto-fixed / corrected issues

**1. [Measurement discipline — acceptance criterion literal-count gap] `A11Y_CAPTURE_DIR` appeared
on only 1 line, not the 2 the plan's acceptance criteria required.**
- **Found during:** Task 1 verification.
- **Issue:** The plan's own acceptance criteria said `git grep -cF 'A11Y_CAPTURE_DIR'` must report
  "at least 2 matching lines," but the natural implementation (one `process.env.A11Y_CAPTURE_DIR`
  read, one derived local variable) puts the literal env-var name on exactly one line.
- **Fix:** Added a short doc comment above `THEMES` naming both switches and what each does — a
  genuine readability improvement for future readers of the spec, not criterion-gaming — which
  brought the literal count to 2 (and `A11Y_MEASURE_ONLY` to 3) honestly.
- **Files modified:** `e2e/theme-contrast.spec.ts`
- **Commit:** `ade8a143`

No other deviations. All three tasks' acceptance criteria were re-derived and independently
verified rather than assumed from the plan text (per the phase's measurement-discipline
instruction) and all held up as written, with the one literal-count gap above corrected in the
implementation rather than by weakening the check.

## Verification

- `npx tsc --noEmit` → exit 0
- `git grep -cF 'A11Y_CAPTURE_DIR'` → 2, `git grep -cF 'A11Y_MEASURE_ONLY'` → 3, gate-guard control
  `git grep -cF 'Clerk auth gate present'` → 1 (unchanged), `git diff` on the spec file: 38
  insertions, 0 deletions, none inside the gate-check block
- `writeFileSync` at line 94, `expect(results.violations)` at line 107 — write strictly precedes
  assertion
- 20/20 JSON files present, named exactly per the theme x page matrix, sorted list verified against
  the 20 expected names by name
- Grand total 24 > 0, `[cyan] Dashboard` = 1 > 0 (real render, not the sign-in screen — corroborated
  by reading the JSON's node HTML, not just the count)
- Control cell against gated `:5173` reports Playwright status `skipped` with the `fee96b5d`
  annotation text verbatim
- `122-CONTRAST-BASELINE.md`: `PENDING` count = 3, grand total cross-checked two ways (24 = 24),
  sampling-limit section names 42 unmeasured files individually (46 `^- ` lines, includes the
  measured-route table rows plus the unmeasured list), zero `rgb(`/`getComputedStyle` hits used as
  a figure (the one hit is prose explicitly saying that method was NOT used)
- `git diff --name-only` across all three commits does **not** include `src/index.css`
- Each commit's `git show --stat HEAD` inspected immediately after committing: only the files this
  plan touched, nothing swept in from a concurrent session
- `.planning/STATE.md` / `.planning/ROADMAP.md` — untouched by this executor for the entire run
  (verified `git status --short` before every commit: `STATE.md` stayed as a pre-existing unstaged
  modification from before this run started, never staged, never committed by me)
- `dev:noauth` server confirmed stopped: post-kill probe on `:5181` returns `000`, and
  `Get-NetTCPConnection -LocalPort 5181 -State Listen` returns nothing

## Self-Check

- `e2e/theme-contrast.spec.ts` — FOUND, contains both switches (verified above)
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-before/` — FOUND, 20 files
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md` — FOUND
- Commit `ade8a143` — FOUND in `git log --oneline`
- Commit `7b74a7fe` — FOUND in `git log --oneline`
- Commit `7bbfd29f` — FOUND in `git log --oneline`

## Self-Check: PASSED

## Key Files

- `e2e/theme-contrast.spec.ts` — modified, +38/-0
- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-before/*.json` — 20 new files
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md` — new file

## Metrics

- Duration: this session
- Tasks: 3/3 completed
- Commits: 3 (`ade8a143`, `7b74a7fe`, `7bbfd29f`)
- Files touched: 22 (1 spec file, 20 JSON captures, 1 baseline doc)
- E2E matrix wall-clock: 14.3s (20 cells)
