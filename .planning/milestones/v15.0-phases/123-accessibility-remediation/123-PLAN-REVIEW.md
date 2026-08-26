## ISSUES FOUND

**Phase:** 123 - Accessibility Remediation
**Plans checked:** 13 (123-01 through 123-13)
**Issues:** 0 blocker(s), 3 warning(s), 1 info

This is a re-verification. No blockers were found. All three warnings are narrative/cross-reference
defects or an unaddressed shared-resource race - none of them prevent the phase goal from being
achieved if the plans execute as written, so execution may proceed. Recommend fixing WARN-1 and
WARN-2 (cheap, one-line citation corrections) before dispatch since they will otherwise mislead an
executor who tries to follow the pointer; WARN-3 is worth a one-line mitigation note in whichever of
123-11/123-12 executes second.

---

### Scope covered this pass

Full re-read of all 13 PLAN.md files, 123-CONTEXT.md, 123-VALIDATION.md, 123-RESEARCH.md
(Pattern 2, Architectural Responsibility Map, Package Legitimacy Audit), the corrected ROADMAP.md
Phase 123 section (lines 799-810), and REQUIREMENTS.md A11Y-01/02/03. All budget priorities 1-5 were
exercised. Nothing was skipped.

---

### 1. Vacuous-pass audit (highest priority) - no new defects found

This plan set was authored specifically to close vacuous-pass paths, and it shows: every
"is it fixed" assertion in every plan I read is paired with a must-differ control, and every one of
those controls is a different observable from the property under test, not a restatement of it.
Representative examples verified line-by-line, not merely skimmed:

- 123-01 (D-11 mechanism): the acceptance criteria require the C1 unguarded-run control (exit 0)
  and the C2 afterAll-corruption control (status flips to "failed" while retaining type:"skip")
  to be measured from actual child Playwright runs, not asserted from documentation. The mutation
  proof (comment out the throw, confirm assertion 1 fails while C1 still passes) is a real
  falsifiability test, not a flag check.
- 123-02/123-08/123-10 (C3, C6): the sub-AA fixture assertion requires BOTH a must-fail reading
  and a must-pass reading in the same test body (e2e/contrast-isolation.spec.ts Task 2, item 1),
  so a harness that flags nothing and a harness that flags everything both fail. The sentinel
  discipline (sampleColor returns null on unparseable input, never the previous fillStyle) is
  asserted directly, not inferred.
- 123-03 (C5): ALL_ROUTES.length === 47 is asserted both as an in-file test() and externally
  via --list count (21 vs 189), and is explicitly checked to differ from the 62-file trap.
- 123-12 (JobsPanel mutation proof): this plan correctly implements the per-assertion mutation
  evidence the team lead flagged as a required correction - it explicitly distinguishes
  :172/:193 (.toBe(1), self-protecting under an unmatchable-selector mutation) from :210
  (.toBe(0), which the SAME mutation cannot falsify) and requires a different control for :210
  (point its selector at a class string known present in the same render, confirm it then fails).
  Verified this reads correctly against the "already_verified" note - confirmed correct.
- 123-04/05/06/10/11/12: every "N violations gone" claim is paired with a must-differ control
  (a selector/rule-id that must still report non-zero, or a file known to still carry occurrences),
  specifically to rule out a probe that returns 0 for everything regardless of state.

No plan I read asserts a flag/counter/log line in place of the real observable outcome, and no zero
result anywhere lacked a control that could have shown the thing present. I did not find a new
instance of the failure class this phase exists to remove.

### 2. Goal-backward - both ROADMAP criteria are reachable if all 13 plans execute as written

Criterion 1 (every wcag2a/wcag2aa violation, not just contrast): confirmed covered.
aria-prohibited-attr (4 objects on /forge) is 123-06's Task 1, driven by the captured axe
message field rather than spec-guessing. color-contrast is split across 123-04 (shell, 184/209
nodes), 123-05 (2 non-shell sites measured via a two-condition control), 123-10 (status-fill class,
8 sites, worst ratio in the app), and 123-11/123-12 (the ratio-gated sweep over the remaining
corpus). 123-08's remediation list (section 3) is derived from the 188-cell widened scan, which
means the actual code fixes cover the full corpus regardless of what 123-09's operator later decides
for the pass/fail CRITERION - a correct decoupling of "what gets fixed" from "what gates the phase".

Criterion 2 (fail-on-skip guard): 123-01 ships the globalTeardown mechanism and its durable
self-test (D-12's durable half); 123-03 closes the marker-gate and measure-only vacuous-pass paths
(D-13/D-14) and widens the scan (D-16); 123-13 runs the real gate, re-asserts C1/C2/C7 against the
live report, and obtains the one thing an agent cannot produce (live gated-server evidence, D-12's
non-durable half) via a blocking operator checkpoint. All four A11Y-03 mechanisms these decisions
require are present with an owning task.

Requirement-field cross-check (re-derived independently, matches the team lead's pre-verified
figures): A11Y-02 appears in the requirements: frontmatter of 12 plans (02,03,04,05,06,07,08,09,
10,11,12,13); A11Y-03 in 3 (01,03,13).

### 3. Controls C1-C7 - each has an owning task that can actually differ

Re-checked against 123-VALIDATION.md's table:

- C1 (123-01 Task 2): unguarded fixture run must exit 0 vs. guarded run's non-zero.
- C2 (123-01 Task 2): afterAll fixture must show stats.skipped:0 plus a "failed"-while-skip-
  annotated cell.
- C3 (123-02 Task 2): sub-AA fixture must read below 4.5, known-passing element above, in one
  test body.
- C4 (123-08/11/12, re-derivation + discrimination control per bucket): 0 for a cleaned file,
  non-zero for an uncleaned one.
- C5 (123-03 Task 2, 123-08 Task 1): route count asserted 47, explicitly not 62, cross-checked
  against capture filenames not the config table.
- C6 (123-02 Task 2): pre-123 colours pulled from a hard-coded SHA via git, rasterised the same
  way, anchored on an explicit SHA (not HEAD~1).
- C7 (123-01 Task 2, 123-13 Task 1): predicate asserted 0 on the real report AND non-zero on the
  paired C2 fixture, so the predicate is shown to fire in both directions.

All seven have real, differing observations behind them. No control here returns the same result
whether the property holds or not.

### 4. Wave safety

File-collision check (from files_modified frontmatter, not prose) found no same-wave file
overlap in any wave, including the two 42-file/22-file sweep buckets in wave 4 (123-11, 123-12),
whose file lists are disjoint by construction (nested-subdir/src/pages/ vs. top-level
src/components/*.tsx). Cross-wave shared files (e2e/theme-contrast.spec.ts,
e2e/contrast-isolation.spec.ts, src/tokenSweep.ratchet.test.ts) are all correctly
dependency-ordered via depends_on. See WARN-3 below for a non-file resource conflict in wave 4.

### 5. Executability spot-check

Spot-checked line citations against the actual files where feasible from context: AuthGuard.tsx
locator text, PageHeader.tsx's cn()/twMerge behavior, JobsPanel.tsx/JobsPanel.test.tsx line
numbers and assertion shapes, DashboardLayout.tsx's nine occurrences and their font sizes. All
matched. No fenced code found inside any action block (interfaces sections use plain indented
excerpts, not code fences, per the pattern established across this repo's other phase plans).

---

### Warnings

WARN-1 - stale cross-reference: 123-03 attributes ForgePage's PageHeader adoption to the wrong plan.
123-03-PLAN.md:74 (interfaces section): "Four render <h1> via PageHeader; Forge hand-rolls its
own <h1>Forge</h1> today and gets one from PageHeader after plan 123-05 -- the same locator works
before and after, so there is no cross-plan dependency." PageHeader adoption for /forge is
123-06's Task 2 (D-09), not 123-05 (which is the CodeVaultGraph.tsx/RunTimeline.tsx
loading-state fix, D-01/D-04 -- confirmed by both 123-05-PLAN.md's own objective and the ROADMAP.md
plan-list line for 123-06-PLAN.md: "PageHeader adoption... (D-06, D-09)").
Impact: none on correctness -- the marker locator ({kind:"heading", level:1, name:"Forge"})
matches the same rendered text regardless of which component renders it, so the "no cross-plan
dependency" claim itself is still true. This is a wrong plan-number citation only.
Confidence: high (direct textual comparison against both plans and the ROADMAP plan list).
Fix: change "after plan 123-05" to "after plan 123-06" in 123-03-PLAN.md:74.

WARN-2 - stale cross-reference: 123-06 sends the D-18 spacing check to the wrong plan.
123-06-PLAN.md:230 (Task 2 acceptance criteria): "D-09's rider assigns the /forge header
spacing check to D-18's operator checkpoint in plan 123-12 by name." D-18's blocking operator
visual checkpoint is 123-13's Task 2, not 123-12. Confirmed three ways: (a) ROADMAP.md's plan
list names D-18 only against 123-13-PLAN.md; (b) 123-12-PLAN.md is autonomous: true with no
checkpoint task and no mention of D-18 anywhere in the file; (c) 123-13-PLAN.md's Task 2
what-built/how-to-verify explicitly walks the operator through the /forge header-spacing
comparison this rider describes. 123-11-PLAN.md and 123-12-PLAN.md both correctly cite "plan
123-13" for the same D-18 checkpoint elsewhere in their own STRIDE tables, so 123-06 is the sole
plan carrying the wrong number.
Impact: none on correctness -- 123-13's Task 2 independently and correctly includes the
/forge spacing question (step 2b) regardless of what 123-06 says. An executor who tries to jump
to "plan 123-12" looking for this checkpoint will not find it there, which is the only real cost.
Confidence: high.
Fix: change "plan 123-12" to "plan 123-13" in 123-06-PLAN.md:230.

WARN-3 - wave-4 shared dev-server port not coordinated between 123-11 and 123-12.
123-11-PLAN.md Task 3 and 123-12-PLAN.md Task 3 both instruct: "Start dev:noauth on 5181 from
Git Bash... Re-run the widened scan into [own capture dir]." Both plans are wave 4 (parallel,
depends_on: ["123-08","123-09"] for both) and both hard-code PW_BASE_URL=http://localhost:5181.
If both plans' Task 3 execute concurrently (the point of assigning them the same wave), two
independent npm run dev:noauth invocations will attempt to bind the same port; depending on how
Vite/the executor handles the second bind, this either errors outright or silently serves the second
plan's Playwright run against the first plan's server instance (which is actually the outcome the
plans anticipate -- 123-12 Task 3 explicitly says "If plan 123-11 (bucket B) has already landed in
this wave, this run measures both sweeps together -- state that plainly"). So the plans anticipate
non-isolation of the measurement, but neither names or handles the more basic port-bind failure
mode if both Task 3s literally race to start their own server.
Impact: at worst, one of the two Task 3 re-measurement runs fails to start its dev server and
has to be retried sequentially -- a wasted round-trip, not a wrong result (the measured content
either sees combined or sequential state, both of which the plans already know how to report).
Nothing about A11Y-02/A11Y-03's correctness is at risk.
Confidence: medium -- this depends on whether the actual execution harness runs same-wave plans
as concurrent processes or as a sequence of subagent turns; if the latter, this never manifests.
Fix (optional, cheap): add one line to each Task 3's action noting "if the sibling bucket's
Task 3 is running concurrently, wait for its dev server to bind first" or have one plan reuse the
other's already-running server instead of starting its own.

### Info (non-blocking)

INFO-1 - 123-VALIDATION.md's own sign-off is stale relative to what the plans now deliver.
The frontmatter still reads nyquist_compliant: false, wave_0_complete: false, and the "Validation
Sign-Off" checklist at the bottom is entirely unchecked with **Approval:** pending, even though
every row in its own "Discriminating Controls" table now has an owning task (confirmed in section 3
above) and the Wave 0 requirements list is fully covered by 123-01/123-02/123-03. This is pure
self-attestation hygiene inside a document that itself does not gate plan correctness -- Dimension 8
only requires VALIDATION.md to exist, which it does -- but a future reader skimming only the
frontmatter/sign-off section would wrongly conclude this phase's validation was never completed.
Not scored as a warning because it has no bearing on whether the phase goal is achieved.

---

### What I dropped and why

- A candidate finding that wcagThresholdFor's D-03 unit-test cases (123-02 Task 1's acceptance
  criteria) might be circular (testing the function against the same rule it implements) was
  dropped: the five stated cases are concrete numeric fixtures ({24,400} to 3, {12,700} to 4.5,
  etc.), not a restatement of the implementation, and the calibration case (14px/12px-bold owing
  4.5) is tied to real measured shell elements -- this is a genuine spec test, not tautological.
- A candidate finding that 123-03's internal themes.length * routes.length test-count assertion is
  tautological (checking a generated loop's count against the same values that generated it) was
  considered and dropped to a non-finding: it is redundant with the external --list count check in
  the same plan's acceptance criteria, but redundancy is not vacuousness, and it does catch a real
  bug class (duplicate route/theme names silently deduping Playwright test titles) that the --list
  check also independently catches. Not worth reporting given the precision bar.
- Dimension 7c (Architectural Responsibility Map) and Dimension 10 (CLAUDE.md compliance): checked,
  no mismatches -- everything in this phase is Frontend/Browser tier or Node-side test tooling per
  123-RESEARCH.md's own map, consistent with every plan's actual file list; no backend/convex/
  surface touched anywhere.
- Dimension 9 (cross-plan data contracts) on e2e/contrast-isolation.spec.ts, shared by 123-02,
  123-08, and 123-10: checked for conflicting transforms. All three only add rows/matrices
  (CLASS_MATRIX, STATUS_FILL_MATRIX) and are dependency-ordered so edits are sequential, not
  concurrent; no plan strips or reformats another's rows. Not a finding.
