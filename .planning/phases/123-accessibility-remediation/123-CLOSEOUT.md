---
phase: 123-accessibility-remediation
plan: 13
title: The final gate run, discriminating controls, operator checkpoint, and requirement-closure evidence
purpose: D-10, D-12 (both halves), D-18, C6, C7
status: Tasks 1, 2 and 3 all complete. Phase 123 closed.
---

# 123 Closeout — The Real Gate, Every Discriminating Control, and the Operator Checkpoint

This section is written by an automated executor. It reports measured evidence only — no claim
below states a conclusion the accompanying command output does not support.

**Reader's note on document order.** §1–§11 below are Task 1's original text, written before the
operator ran Task 2. Five commits landed between Task 1 closing and Task 2's checkpoint being run
(all operator-authorized, all outside every plan's `files_modified`) — where they change a figure
or a finding Task 1 recorded, the original text is left in place and a correction is appended
immediately after it, per this project's Stale Docs rule, rather than silently rewritten. §12
below is Task 2's operator checkpoint, run after those five commits.

**Environment.** `dev:noauth` reused on `http://127.0.0.1:5181` (Clerk gate down, started earlier
this session from Git Bash with an empty `VITE_CLERK_PUBLISHABLE_KEY`) — probed `200` before any
run in this task, never restarted.

---

## 1. The gate result

**Command** (assertions ON — `A11Y_MEASURE_ONLY` unset, per the operator's `hold-and-size` decision
at `123-CRITERION-DECISION.md`, `A11Y_SCAN_ALL` also unset so the default 20-cell criterion matrix
ran, not the widened 188):

```
PW_BASE_URL=http://localhost:5181 \
  PLAYWRIGHT_JSON_OUTPUT_FILE=.planning/phases/123-accessibility-remediation/123-final-report.json \
  node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --reporter=json
```

**Recorded run (the one committed as `123-final-report.json`):**

```
stats: {"startTime":"2026-08-20T20:01:22.948Z","duration":10462.766,"expected":21,"skipped":0,"unexpected":0,"flaky":0}
```

- **Exit code 0.**
- `stats.expected` = **21** — matches the acceptance criterion exactly (20 criterion cells: 5
  routes × 4 themes, plus the C5 population-count test at the bottom of the spec). This was
  checked **before** the zero below was accepted, per this plan's own measurement discipline: a run
  that silently enumerated fewer than 21 tests would not have earned a trusted zero.
- `stats.skipped` = **0**. `e2e/.a11y-skip-log.txt` does not exist after the run (global-teardown's
  own truncate-at-start behavior; an empty/absent log is what a `skipped: 0` run leaves behind).
- All 21 declared tests passed: the 20 criterion cells (Analytics, Dashboard, Forge, Graphs,
  LiveRun × cyan, emerald, readable, aubergine) plus `route table: population is 47 (not 62),
  criterion set is 5, generated cell count matches themes x routes`.
- **Per-rule violation count across the 20 criterion cells: 0 objects / 0 nodes, every rule id,
  every theme.** `expect(results.violations).toEqual([])` is satisfied for all 20 cells in this
  run — stated as that assertion holding, not as "contrast is fixed."

**This run is real, but it is not the only outcome this exact command produced today** — see
§6 below. The recorded run is reported in full; the instability observed across other attempts of
the identical command is disclosed rather than omitted, per this plan's `<plan_authority>`
instruction that a red result reported honestly is the correct outcome and a green one assembled
by discarding red attempts is the defect this phase exists to remove. Nothing was discarded: every
attempt this session is logged in §6, and the recorded run is simply the most recent one, run last,
with nothing between it and this document's writing.

---

## 2. All seven discriminating controls (C1–C7)

| # | Control | Result | Source |
|---|---|---|---|
| C1 | Unguarded run of an all-skipping matrix must exit 0 | **Confirmed**: `guardedRun.exitCode` non-zero, `unguardedRun.exitCode === 0` with the identical `skipped: 3` — both asserted and passing in `a11y-gate-guard.spec.ts`'s own test `"C1 -- unguarded control exits 0..."` | `a11y-gate-guard.spec.ts`, run this session, 5/5 (§4) |
| C2 | The rejected `test.afterAll` mechanism must be shown to corrupt cell status | **Confirmed**: `afterallRun.report.stats.skipped === 3` (all three skips remain genuinely "skipped") while exactly one OTHER test (the control cell, per file-declaration order) flips from "passed" to "failed" carrying the hook's error with no skip annotation — asserted in test `"C2 -- the rejected afterAll mechanism corrupts status..."` | same |
| C3 | The isolation harness flags a deliberately sub-AA fixture and passes a known-compliant one, per theme | **Confirmed** (`contrast-isolation.spec.ts`, this session, 8/8 passing): `text-muted-foreground/30` on `--background` measured below 4.5:1 in all 4 themes; `text-foreground` on `--background` measured above 4.5:1 in all 4 themes. Both directions differ. | §5 |
| C4 | The corpus sweep found every `/NN` site — must-differ population control | **Re-confirmed this session** (not re-derived fresh, already closed by 123-11/123-12): both sweep plans reconciled their live population 1:1 against `123-CONTRAST-RESULT.md` § 3 with zero unreconciled occurrences (bucket B: 111/111; bucket A: 50/50). Discrimination pair used in those plans: `DashboardLayout.tsx` → 0 (cleaned by 123-04), `DetailConfigTab.tsx`/`ToolExecutionPanel.tsx` → non-zero (bucket's largest member). No new derivation needed here — this task inherits, and does not repeat, that closed measurement. | `123-11-SUMMARY.md`, `123-12-SUMMARY.md` |
| C5 | The widened 47×4 scan actually scanned 47 routes, not the 62-file glob | **Confirmed in this run**: the population test asserts `ALL_ROUTES.length === 47`, `ALL_ROUTES.length !== 62`, `CRITERION_PAGES.length === 5`, and `generatedCellCount === THEMES.length * routes.length` — all four passed in this session's gate run (test 21/21, listed in §1). Note: this run used the **20-cell criterion matrix**, not the widened 188 (per the operator's `hold-and-size` decision) — C5's assertion on `ALL_ROUTES.length` still runs and still passes regardless of which matrix drove the loop, since it checks the table, not the loop variable. | `123-final-report.json`, this run |
| C6 | Before/after contrast claim paired with pre-change class strings measured from git, rasterised the same way | **Confirmed** (`contrast-isolation.spec.ts`'s `isolation-before` rows, this session): both `DashboardLayout.tsx` probes (`text-muted-foreground/80`, `text-primary/60`) confirmed present at `PRE_123_SHA` via `git show`, then measured live: below 4.5:1 on `--card` in 3 of 4 themes at that anchor (cyan 4.813/3.361, emerald 4.804/3.264, readable 3.825/4.751, aubergine 3.676/3.112) — a real "before" measurement, not assumed. Both classes are now absent from `DashboardLayout.tsx` (123-04). | `contrast-isolation.spec.ts` test output, §5 |
| C7 | No test is `"status": "failed"` while its annotations include `type: "skip"` | **0** on this run's `123-final-report.json` (computed directly: `flattenTests(report).filter(t => t.results[0].status === 'failed' && t.annotations.some(a => a.type === 'skip')).length === 0`). Paired known-positive: `a11y-gate-guard.spec.ts`'s own internal C2 fixture run (the rejected `afterAll` mechanism) produces **≥1** failed test with no skip annotation — the spec's own test `"C7 -- zero unexplained failures..."` asserts `countFailures(guardedRun.report) === 0` **and** `countFailures(afterallRun.report) >= 1` in the same test, both held, passing. | Computed against `123-final-report.json` + `a11y-gate-guard.spec.ts` run, §3 |

**None read "pending."** Every one of C1–C7 has a measured result from this session or is
inherited from a closed, already-measured prior plan (C4), as the interfaces block instructs.

---

## 3. C7 in detail

Computed directly against the committed `123-final-report.json`:

```js
flattenTests(report).filter(
  t => t.results[0]?.status === "failed" && t.annotations.some(a => a.type === "skip")
).length
// => 0
```

**Paired known-positive** (from `a11y-gate-guard.spec.ts`'s own C2 fixture, run this session as part
of the 5/5 in §4): the rejected `test.afterAll` mechanism produces exactly 1 test whose status is
`"failed"` — but that failed test carries **no** `type: "skip"` annotation (the afterAll's thrown
error attaches to the LAST-declared test, the control cell, not to one of the three skip cells,
per the corrected finding already on record in that spec's own comment). So the literal
"failed AND skip-annotated" signature is 0 in **both** reports — it never occurs, by the corruption
mechanism actually observed. The generalized, still-discriminating form the spec itself asserts
(and which this document adopts, per the plan's own instruction to pair C7 with a known-positive):
**zero tests report `"failed"` at all** in the guarded/real-production-code report (3 skips stay
skipped, control stays passed), while the C2/afterAll fixture has **at least 1** failed test. Both
figures: `countFailures(guardedRun.report) = 0`, `countFailures(afterallRun.report) >= 1` — both
asserted and passing in `a11y-gate-guard.spec.ts`. The predicate is shown to fire in one direction
and not the other, rather than being trivially true against a report with no skips in it at all.

---

## 4. `e2e/a11y-gate-guard.spec.ts` (D-11/D-12 durable, C1, C2, C7)

```
stats: {"startTime":"2026-08-20T20:01:47.936Z","duration":2962.59,"expected":5,"skipped":0,"unexpected":0,"flaky":0}
```

**5/5, exit 0.** The five tests: "guarded run: exits non-zero, skip stays skipped, control still
passes (D-11/D-12)"; "C1 -- unguarded control exits 0..."; "C2 -- the rejected afterAll mechanism
corrupts status..."; "C7 -- zero unexplained failures..."; "the guard's locator is bound to
AuthGuard's real copy, not a stale string." All five passed.

---

## 5. `e2e/contrast-isolation.spec.ts` (D-02 pass 2, C3, C6)

```
stats: {"startTime":"2026-08-20T20:01:57.412Z","duration":8338.053,"expected":8,"skipped":0,"unexpected":0,"flaky":0}
```

**8/8, exit 0.** Matches `123-CONTRAST-RESULT.md` § "Section 2"'s own prior "8 passed" record — no
regression, no extension needed (the widened scan surfaced no new surface beyond the four generic
`DEFAULT_SURFACES`).

---

## 6. `e2e/theme-rendered-result.spec.ts` (Phase 122's frozen figure)

```
stats: {"startTime":"2026-08-20T20:02:13.609Z","duration":76013.25,"expected":47,"skipped":0,"unexpected":0,"flaky":0}
```

**47/47, exit 0** (run with `--workers=1` so the module-scope `allSamples` aggregate check in
section 6 of that file sees every sample the whole run took, not one worker's partial subset).
Unchanged by this phase's harness refactor, as the plan's acceptance criteria require.

---

## 7. `npm test`, `npx tsc --noEmit`, `npm run build`

- **`npm test`** (full default run, both `unit` and `browser` vitest projects): exit 0. `Test
  Files 347 passed | 17 skipped (364)`, `Tests 4881 passed | 2 skipped | 197 todo (5080)`. No
  `FAIL` lines, no unhandled-error summary. The environment note warned this session that a
  concurrent session's `browser (chromium)` project had been failing uniformly on
  `src/test/setup.ts` import (`TypeError: Illegal invocation`) as of earlier work — **that does
  not reproduce in this run**; the browser project's files land in the 17-skipped bucket or pass,
  not fail. Re-run scoped to `--project unit` to compare directly against 123-11/123-12's own
  reported baseline: `npx vitest run --project unit` → exit 0, `Test Files 346 passed | 17 skipped
  (363)`, `Tests 4879 passed | 2 skipped | 197 todo (5078)` — **identical pass counts** to
  `123-11-SUMMARY.md`/`123-12-SUMMARY.md`'s own recorded "346/346 test files, 4879/4879 tests
  passed, 0 failures" (their phrasing omitted the skip bucket; the pass figures match exactly). No
  new failures against that stashed-source control.
- **`npx tsc --noEmit`**: exit 0, no output.
- **`npm run build`**: exit 0. `✓ built in 1.10s`. One warning, pre-existing and unrelated to this
  phase: "Some chunks are larger than 500 kB after minification" (a bundling-size advisory, not an
  error, not touched by this plan's scope).

---

## 8. LiveRun (criterion route) is intermittently flaky against the exact recorded-clean gate command — named in full

**This is the one thing that did not come back uniformly clean, and it is reported here in full
rather than folded into the single clean run recorded in §1.**

The identical command in §1 was run **four** times total this session (not counting the
already-closed measurement runs from 123-11/123-12). Three of the four full-matrix attempts, plus
one earlier isolated recheck, are logged below in the order run:

| # | Scope | Result | Failing cell(s) | Violation | 
|---|---|---|---|---|
| 1 | full 21-cell | **FAIL** (exit 1), `expected:19 unexpected:2` | `[emerald] LiveRun` | `scrollable-region-focusable` |
| 1 | (same run) | | `[readable] LiveRun` | `color-contrast` — badge, 4.26:1 vs 4.5:1 required, `<span data-slot="badge" data-variant="secondary">`, `#7c8595` on `#1d2230`, 14px normal |
| 2 | `--grep "LiveRun"` (2 cells only) | **FAIL** (exit 1), `expected:0 unexpected:2` | `[emerald] LiveRun`, `[readable] LiveRun` | both `scrollable-region-focusable` this time (not the same violation as run 1) |
| 3 | `--grep "LiveRun" --repeat-each=3` (12 cells, all 4 themes × 3 repeats) | **PASS** (exit 0), `expected:12` | none | — |
| 4 | full 21-cell | **FAIL** (exit 1), `expected:18 unexpected:3` | `[cyan]`, `[emerald]`, `[readable]` LiveRun | all three `scrollable-region-focusable` |
| 5 | full 21-cell (**this is the run committed as `123-final-report.json`**) | **PASS** (exit 0), `expected:21` | none | — |

**Root cause, traced, not guessed.** `LiveRun`'s `JobsPanel.tsx:88` renders `<div
className="overflow-y-auto max-h-[280px]">` around a live Convex query result
(`useSubagentJobs()`, real-time subscription over the `subagentJobs` table — genuinely live data,
not a fixture). `axe`'s `scrollable-region-focusable` rule (WCAG 2.1.1, keyboard accessibility)
only fires when that div's content is tall enough to actually overflow and become scrollable — a
function of how many terminal-state missions are currently in the live table at the instant each
browser navigation happens. This is the same "live-data-dependent list — timing race" pattern this
phase's own ledger already names for `Ideation`, `Executions`, `HrCatalog`, and (Task 3, 123-12)
`Capabilities`/`HivePage`/`Bifrost`/`Memory` — this is the first time it has been observed to reach
a **criterion** route rather than one of the 42 backlog routes.

Run 1's `[readable] LiveRun` `color-contrast` hit (a secondary-variant badge at 4.26:1, just under
the 4.5:1 line) is plausibly the same mechanism from a different angle: which specific job rows are
present, and therefore which badge variant/label combination paints, depends on the same live query
result. It did not reproduce in runs 2–5.

**This is not a regression from any of this phase's 47 edited files** — `JobsPanel.tsx` was
touched by 123-12, but only for its Lucide-icon test-selector rework (`:96`'s fallback-clock icon
class), not the scrollable container at `:88`, which this plan's `git log -p` shows has been
`overflow-y-auto max-h-[280px]` since before this phase began. No `src/` file was edited by this
Task 1 (its `files_modified` is `123-CLOSEOUT.md` only) — this finding is reported, not
remediated, matching the disposition every other live-data-dependent route in this ledger already
received.

**Disposition:** Recorded as a **residual gap** in §9 below, not treated as blocking this task's
own gate result (the run actually committed, §1, is clean and its `stats.expected` was checked
before its zero was trusted). Flagged explicitly for whoever picks up the sized 42-route backlog
item (`.planning/todos/pending/a11y-02-widened-scan-42-route-backlog.md`) or a future
`scrollable-region-focusable` remediation pass, since `JobsPanel.tsx:88` needing a `tabIndex={0}`
(or equivalent keyboard-focusability) when its content actually overflows is a real, structural,
reproducible-under-the-right-data-volume defect independent of any theme or opacity token — outside
this phase's `text-*/NN` contrast scope entirely.

**§8 CORRECTION — the `scrollable-region-focusable` half is now FIXED, the `color-contrast` half
stays UNRESOLVED, and the two halves resolved differently.** Recorded 2026-08-20, after Task 2's
operator checkpoint, once the operator authorized landing fixes for defects the checkpoint's own
visual pass surfaced (per this plan's own instruction: "If Part A reports a flattened hierarchy or
a doubled `/forge` gap, that is a real defect: file it and fix it before close").

- **`scrollable-region-focusable` (LiveRun's mission-list `<div>`) — FIXED, `49426c16`.**
  `JobsPanel.tsx:88`'s `overflow-y-auto max-h-[280px]` container gained `tabIndex={0}`,
  `role="region"`, and `aria-labelledby` bound to the existing "Mission History" `<h2>`, making it
  keyboard-reachable whenever its live content actually overflows — the exact structural gap this
  section named above. **The e2e criterion gate could not verify this fix**: LiveRun × 4 themes ×
  5 repeats passed 20/20 with the fix applied AND 20/20 with the fix deliberately stripped, because
  the live `subagentJobs` table was short enough at capture time that the container never overflowed
  in either condition — a control that returns the same result in both directions carries zero
  information (2026-07-13 lesson), so it was discarded rather than cited as proof. The guard that
  actually proves the fix is a **unit test**, `JobsPanel.test.tsx`, mutation-proven: 15/15 passing
  with the fix in place; stripping `tabIndex`/`role`/`aria-labelledby` (re-run tsc-clean, confirming
  the tests genuinely executed against real markup) fails exactly the two keyboard-focusability
  assertions while the empty-state control test keeps passing. Re-confirmed this session:
  `npx vitest run --project unit src/components/JobsPanel.test.tsx` → 15/15.
- **`color-contrast` (the `[readable] LiveRun` 4.26:1 badge) — UNRESOLVED, reasons recorded, not
  fabricated.** Hunted by measuring every badge on `/live-run` across all four themes directly,
  rather than waiting for the flake to reproduce. The marginal candidates now measure 4.94:1
  (`readable`) and 5.09:1 (`aubergine`) — passing, with thin headroom, unchanged by this session's
  fixes. The reported element from run 1 (`#7c8595` on `#1d2230`, `data-slot="badge"
  data-variant="secondary"`) matches **neither** the current `secondary` nor `muted` token pairing
  in this codebase, so the producing state is not currently reachable and the specific element that
  flagged could not be located to fix. Per this plan's own `<action>` text ("If Part A reports a
  flattened hierarchy... that is a real defect: file it and fix it"), the operative test is whether
  a defect could be *found and fixed*, not whether a badge somewhere might someday flag again —
  fabricating a code change against an unreproducible pairing would be the "fixing a non-problem"
  finding this phase exists to prevent. **Both criterion-gate re-runs since (the committed run in
  §1, and this session's fresh 21/21 re-run below) are clean at LiveRun × readable, in all 4
  themes**, so there is no live instance of this violation to point a fix at today. Left open,
  named here rather than silently dropped.

**Re-confirmation this session, post-fix (Task 2/3 executor):**
```
PW_BASE_URL=http://localhost:5181 node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --reporter=list
```
→ **21 passed (16.5s), exit 0.** All 4 `LiveRun` cells (cyan, emerald, readable, aubergine) clean —
including the two themes (`emerald`, `readable`) that had shown `scrollable-region-focusable`
failures in runs 1/2/4 above. This is a fifth clean run of the identical command against the same
reused `dev:noauth:5181` server, now with `49426c16` applied.

---

## 9. D-10 — all four themes at the same AA bar

| Theme | Pre-123 node count (of 209, all 5 pages) | Final (20 criterion cells, this session) |
|---|---|---|
| cyan | — (pre-123 baseline not broken out per-theme in this document; see `122-CONTRAST-BASELINE.md`) | **0** |
| emerald | — | **0** |
| readable | **78 of 209** (`122-CONTRAST-BASELINE.md`, branded "Readable Dark (WCAG-AA)") | **0** |
| aubergine | — | **0** |

No separate threshold, no separate pass/fail: `readable` runs through the identical
`expect(results.violations).toEqual([])` assertion, on the identical flat 4.5:1 axe rule set
(`wcag2a`/`wcag2aa` tags), as the other three themes — it is not special-cased anywhere in
`e2e/theme-contrast.spec.ts`. `readable` went from carrying more than a third of the whole app's
pre-123 flagged nodes (78/209 = 37.3%) to 0 of 0 in the criterion set, the same destination every
other theme reached.

---

## 10. Delta — final vs. pre-123 control, and vs. the post-123-08 ledger

| Population | Objects | Nodes | Source |
|---|---|---|---|
| Pre-123 control (all 5 criterion pages, all 4 themes) | 24 | 209 | `123-VALIDATION.md` interfaces block; 20 color-contrast/205, 4 aria-prohibited-attr/4 |
| **This session's gate run (20 criterion cells)** | **0** | **0** | §1, this document |
| **Delta** | **-24** | **-209** | 100% reduction on the criterion set |
| Full 188-cell, pre-sweep (123-08 addendum) | 96 | 966 | `123-CONTRAST-RESULT-ADDENDUM.md` |
| Full 188-cell, post-bucket-B (123-11) color-contrast only | 14 | 35 | `123-11-SUMMARY.md` |
| Full 188-cell, post-bucket-A (123-12) color-contrast only | 14 | 36 | `123-12-SUMMARY.md` (+1 node, traced to the pre-existing `McpInventory.tsx:184` classification gap, not a regression) |

The 20-criterion-cell result (this document, §1) is a strict subset of the 188-cell population
above and is not separately re-summed here beyond what §1 already states — the criterion cells
have always measured 0/0 since 123-04–123-06 landed, confirmed independently in this session's own
run rather than carried forward from the ledger.

---

## 11. Residual gaps, named and quantified

Per the plan's own instruction, quantified rather than gestured at:

1. **Not-reached, guarded only by D-02's isolation table (outside the 20-criterion set).**
   `123-CONTRAST-RESULT.md` § 3: 80 not-reached occurrences out of 161 real classifiable
   occurrences (161 = 74 measured-passing + 7 measured-failing + 80 not-reached), adjudicated 77
   REMEDIATE / 3 LEAVE-ALONE against the isolation table. Of the 84-occurrence remediation list (7
   measured-failing + 77 not-reached-REMEDIATE), buckets A and B (123-11, 123-12) have since
   applied changes to (64 + 18 =) 82 sites; the remaining sites' disposition is recorded in each
   plan's own ledger (`123-SWEEP-A-LEDGER.md`, `123-SWEEP-B-LEDGER.md`), not re-derived here.
2. **53 ledger rows justified "only reachable via unmeasured route(s)."** Per the orchestrator's
   known-figures: 25 of those 53 sit on routes that now measure **zero** color-contrast in the
   188-cell addendum (Chat 10, Tasks 5, Reminders 4, InsightsChat 3, Settings 2, DocComments 1) —
   guarded by the isolation table's class-level ratio, not by an observed rendered failure. This
   does not retroactively make the REMEDIATE adjudication wrong (an occurrence can fail in
   isolation without ever rendering in the scanned DOM state), but the distinction between
   "measured clean" and "adjudicated by class inference" is now knowable for those 25 rows.
3. **`Infrastructure` — 16 rendered `color-contrast` nodes, 0 occurrences of this sweep's tracked
   pattern.** A hardcoded raw `#6b7280` at 3.64–3.87:1, per the orchestrator's known-figures — a
   defect class neither this phase's `text-*/NN` sweep nor its isolation table can reach (no
   Tailwind opacity-modifier class string exists to grep for). Non-criterion route; belongs to the
   42-route backlog item, named explicitly here rather than folded into that item's aggregate.
   **CORRECTION 2026-08-20 — FIXED, `d1326f13`, no longer a residual.** Task 2's operator
   checkpoint measured this raw `#6b7280` was used not only as a ring dot but as the ring-summary
   tile's TEXT colour (`OrbitalStatusRings.tsx:327`, e.g. "3/4"), reached only when a ring's
   `worstStatus()` is `unknown` — the same live-data-gated class as LiveRun and Ideation, which is
   why earlier captures (taken while services reported healthy/down) never flagged it. Measured
   `#6b7280`: 3.64:1 (aubergine) / 3.87:1 (cyan) / 3.85:1 (emerald), reproducing axe's own three
   figures exactly before trusting the replacement formula. Raised to `#9ca3af`: 6.94 / 7.37 /
   7.34:1 — all clear of the 4.5:1 floor with real headroom. `/infrastructure` is outside the 20
   criterion cells, so this fix does not move any criterion-gate figure in §1, but the 16-node
   population named here is retired.
4. **`/chat`** — out of milestone scope (named explicitly in 123-08-PLAN.md), and now measures **0
   objects / 0 nodes** in all four themes (`123-CONTRAST-RESULT-ADDENDUM.md`). Remains
   unremediated by this phase regardless of that clean reading, per its scope exclusion.
5. **D-08's shadow-`rgba` boundary.** 21 non-black colour-identity occurrences across 12 files
   (`123-SWEEP-BOUNDARY.md` § 2) — `box-shadow`/`drop-shadow` arbitrary values carrying a raw
   `rgba(r,g,b,a)` with no `bg-`/`text-`/`border-` prefix, invisible to every ratchet bucket and to
   axe's `color-contrast` rule (shadows are not text). Counted, not adjudicated as deliberate vs.
   oversight — a future phase's triage item.
6. **`bg-gray-950/50` residual.** `123-SWEEP-BOUNDARY.md` § 1: this class string still compiles
   into the production stylesheet because it is quoted verbatim, in a comment, at
   `src/tokenSweep.ratchet.test.ts:36` — the ratchet's own docstring illustrating this exact defect
   as a worked example. Not fixable within this phase's constraints (that file is reserved for a
   different plan and this plan's own acceptance criteria forbid editing it); the exclusion
   mechanism itself is proven sound against the other 57 of 58 migration-tool class-name keys.
7. **LiveRun's live-data-coupled `scrollable-region-focusable` flakiness — new finding, this
   session.** See §6 in full. Not previously named in this ledger; first observed to reach the
   criterion set rather than a backlog route. `JobsPanel.tsx:88`'s scrollable container has no
   keyboard-focusability fallback for when its live content overflows. Named here, not fixed (out
   of this task's scope — measurement only, no `src/` edits authorized).
8. **`marker: null` routes: 0.** Every one of the 47 table entries in `e2e/a11y-routes.ts` uses a
   real heading locator (`123-CONTRAST-RESULT.md` § 1) — nothing to name here beyond confirming the
   count is genuinely zero, not merely un-checked.
9. **`123-06-SUMMARY.md`'s `aria-selected` claim is FALSIFIED — corrected 2026-08-20.** That
   summary states (`key-decisions`, and again in its measurement record): *"aria-selected on
   `ForgeJobList.tsx:227` never fires — confirmed by a full post-fix e2e axe capture against
   `/forge` (0 violations of any rule id), left unmodified."* It does fire. Task 2's operator
   checkpoint found `/forge`'s job-list badges hard to read; fixing the actual cause (a Radix
   `ScrollArea` sizing its viewport to `display: table` content width, clipping every row at
   ~2897px inside a 280px panel — `ead1b3ed`) unmasked a second, independent, pre-existing defect:
   `aria-selected` on a plain `<button>` (`ForgeJobList.tsx`), axe rule `aria-allowed-attr`,
   **28 nodes**. The claim was never wrong about what the capture *showed* — it was wrong about
   *why*: `aria-selected` is gated on live Convex job data (no jobs → no rendered buttons → nothing
   to flag), so every capture taken before that query resolved recorded a clean page, and 123-06's
   own capture ran into exactly that timing gap. **Control run performed to isolate the two
   defects**: with the ScrollArea clipping fix (`ead1b3ed`'s part (a)) applied, the Forge cells
   still failed on `aria-allowed-attr` — reverting the clipping fix alone reproduced the identical
   28 nodes, proving the ARIA defect does not depend on the clipping fix and is independent and
   pre-existing, not introduced by this session's work. Fixed by replacing `aria-selected` with
   `aria-current` (`ForgeJobList.tsx:265`) — a `<button>` has no permitting `role="option"`/`"tab"`,
   unlike the four sibling `aria-selected` sites swept for comparison
   (`AmbientAudioPlayer.tsx:133`, `RunAstridrPopover.tsx:70`, `SkillBulkBar.tsx:81`,
   `Reminders.tsx:67`), all of which carry a permitting role and were confirmed NOT to need the same
   fix. Verified: all 4 Forge criterion cells (cyan/emerald/readable/aubergine) measure 0 objects /
   0 nodes of any rule id with the job list populated (28 rows) — this session's committed §1 run
   and the fresh 21/21 re-run in §8's correction both confirm this live. Do not cite 123-06's
   original claim as current; this correction supersedes it.
10. **Non-deterministic vitest suite — filed, not this phase's to fix.** A concurrent session
    (astridr-repo Phase 192) filed
    `.planning/todos/pending/vitest-suite-nondeterministic-one-random-failure-per-run.md`:
    codepulse's vitest suite fails ~1 random test per full run, a different one each time. Same
    live-data/ordering-fragility class this phase kept surfacing (LiveRun's `scrollable-region-
    focusable` flake, item 7 above; Ideation/Capabilities/McpInventory theme instability named in
    123-11/123-12). Referenced here for continuity, out of this phase's scope.

---

## 12. Operator verification (Task 2 — D-18 visual checkpoint, D-12 live gated-server evidence)

**Date:** 2026-08-20. Run personally by the operator (Larry), against a live `npm run dev` session
at `http://localhost:5173` for Part A and a live Clerk-gated `npm run dev` session (not signed in)
for Part B. Recorded verbatim below, not paraphrased into a verdict, per this task's own
instruction.

### Part A — visual (D-18)

**Question (a): nav active/inactive/disabled states and group headers, all four themes.**

> "Chat reads as active in all four." / "I think they all look the same except the colors." Group
> headers read as headers.

**Orchestrator finding on this answer, recorded rather than silently accepted:** the three-state
question was **partly unanswerable as posed**. Active-vs-inactive styling does exist
(`DashboardLayout.tsx`: `is-active text-primary bg-primary/10` vs `text-muted-foreground`), and the
operator confirmed the active item reads as legible in all four themes. But there were **zero**
disabled/"soon" items to compare against — every `placeholder: true` capability in
`navRegistry.ts` was a **comment describing the concept**, not a data row on any nav item (control
run: the same search shape matched 44 real nav items, so the search itself worked; it found no
`placeholder` items because none exist). Only two of the intended three states existed to compare,
so the question could only be answered for those two. **Resolved by removing the dead capability
entirely** (`8f844f6e`) rather than leaving an unreachable code path that documents a state the app
has never had.

**Question (b): `/forge` header-to-content gap vs. `/live-run` and `/analytics`.**

> "Forge still looks like shit" and "can't really read the badges", with screenshots.

The specific D-18 gap question — did `PageHeader`'s baked-in `mb-4` get correctly cancelled by the
caller's `mb-0` — **passes**: measured from the operator's screenshots, `/forge`'s title-to-content
gap is ~39px against `/live-run`'s ~57px (both using `PageHeader`), so the cancellation held; the
gap did not double as D-09's rider worried it might. The operator's broader complaint ("looks like
shit", badges unreadable) named a **different, real defect** — traced to the Radix `ScrollArea`
clipping issue and the independent `aria-selected` bug documented in §8's correction and §11 item 9
— fixed in `ead1b3ed`.

**Question (3): are Forge job-list severity badges hard to read against their fill, per theme?**

Answered together with (b) above via the "can't really read the badges" report. **Not a contrast
problem** — measured 18.91:1 (cyan), 19.20:1 (emerald), 14.86:1 (aubergine), 14.19:1 (readable)
against a 4.5:1 floor, rasterised via `e2e/lib/contrast.ts`. The badges were unreadable because
they were **clipped and truncated at 12px** by the ScrollArea sizing defect, not because of an
insufficient colour ratio — which is also why axe had honestly reported `/forge` at 0
`color-contrast` violations the whole time: clipped text at a legal ratio is still a legal ratio.

**Operator follow-up after the clipping fix landed:** "there is a lot of real estate there, i think
we can make that column a bit wider to read better." Actioned in `d1326f13`: measured at real
breakpoints — md(900px)=320px, lg(1100px)=400px, xl(1400px)=460px, xl(1920px)=460px — title line
width 231px → 411px, no overflow at any measured size.

**Disposition per this task's own instruction** ("If Part A reports a flattened hierarchy or a
doubled `/forge` gap, that is a real defect: file it and fix it before close"): the operator's Part
A report surfaced two real, code-level defects (`/forge` clipping + independent `aria-selected`
misuse; the dead placeholder-nav capability) — both fixed and named above, not recorded as accepted
cosmetic notes. The header-spacing question itself, the thing D-18 specifically asked about, passed
on measurement.

### Part B — live gated-server evidence (D-12)

The operator ran the ordinary gated `npm run dev` server on `:5173` with `VITE_CLERK_PUBLISHABLE_KEY`
set, did **not** sign in, and ran the criterion suite against it from a second terminal. The
orchestrator re-ran the identical command against the same gated server afterward to capture the
exit code the operator's own paste did not include (the operator reported the skip/pass/fail shape
verbatim; the numeric exit code was confirmed by direct re-run, not assumed).

| Figure | Value |
|---|---|
| Exit code | **1** |
| Cells reported `skipped` | **20** (each keeping its own `result.status: "skipped"`) |
| Cells reported `failed` | **0** |
| Cells reported `passed` | **1** (the C5 population test — not gated by Clerk, asserts the static route table) |
| `globalTeardown` | Threw, naming all 20 skipped cells |

This matches D-11's expected shape exactly: exit code non-zero (the **suite** fails), each gated
cell still reads `skipped` (preserving the "never rendered" vs. "rendered clean" vs. "violating"
three-way distinction in the per-test report), and no cell reads `failed`. **Before this phase, the
identical run against a gated server exited 0** — a vacuous green. This is D-12's live half: proof,
on the real Clerk gate rather than the durable self-test's simulated one, that the guard shipped in
`fee96b5d` and hardened by 123-01's `globalTeardown`/`fs` side-channel mechanism actually holds.

---

## Self-Check

```
test -f .planning/phases/123-accessibility-remediation/123-final-report.json && echo FOUND
```
→ FOUND.

```
node -e "const r=require('./.planning/phases/123-accessibility-remediation/123-final-report.json');console.log(JSON.stringify(r.stats))"
```
→ `{"startTime":"2026-08-20T20:01:22.948Z","duration":10462.766,"expected":21,"skipped":0,"unexpected":0,"flaky":0}`

Task 1's own `<verify><automated>` block, reproduced above verbatim: **PASSED.**

---

**TASK 2 COMPLETE — see §12 above.** The operator ran both parts of the checkpoint live; the answers
are recorded verbatim, both defects Part A surfaced were fixed and verified, and Part B's live
gated-server figures matched D-11's expected shape. **TASK 3 COMPLETE** — A11Y-02 and A11Y-03 are
marked by hand in `.planning/REQUIREMENTS.md`, evidence trail in each mark. Phase 123 is closed.
