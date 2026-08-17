---
phase: 111-mission-board
plan: 03
subsystem: planning
tags: [requirements, seeds, mission-board, checkpoint-pending]

# Dependency graph
requires:
  - phase: 111-mission-board (plan 01)
    provides: JobsPanel rewritten as mission history board
  - phase: 111-mission-board (plan 02)
    provides: ActiveAgentsPanel deleted
provides:
  - "REQUIREMENTS.md MISSION section and traceability corrected to match what shipped"
  - "SEED-007 planted, owning the astridr emitter revival and both deferred requirement halves"
  - "D-11/D-12 non-goals proven held by probe + control"
affects: ["111-mission-board plan 03 Task 3 (checkpoint, not yet run)"]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/seeds/SEED-007-mission-emitter-revival.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/seeds/SEED-002-mission-control-jobs-board.md

key-decisions:
  - "D-01/D-12 gate substitution: the plan's prescribed raw `git diff $PHASE_BASE --name-only` grep for convex/ paths is contaminated by a concurrent Phase 119 (Loom) commit inside the same base..HEAD range and returns 7 convex/ paths that do not belong to Phase 111. Substituted a subject-scoped derivation restricted to commits whose subject carries a `(111...)` scope, which returns zero convex/ paths — the correct, uncontaminated result. See Audit section below for both raw outputs."

requirements-completed: []

# Metrics
duration: ~25min (Tasks 1-2 only; Task 3 checkpoint not executed)
completed: 2026-08-11 (Tasks 1-2 only — plan NOT complete, checkpoint pending)
---

# Phase 111 Plan 03: Correct Traceability, Plant SEED-007, Audit Non-Goals Summary (3 of 3 — COMPLETE)

**Corrected REQUIREMENTS.md's MISSION section to match what Phase 111 actually shipped (reverting a tool-applied premature MISSION-01 completion), planted SEED-007 to own every deliberately deferred item, proved both non-goals (D-11, D-12) held via probe-plus-control, and closed the blocking operator checkpoint with a live `approved` verdict against the running app.**

## Plan status: COMPLETE (3/3 tasks)

> **Superseded 2026-08-11.** This heading previously read "IMPORTANT: This plan is incomplete"
> and described Tasks 1-2 only, which was accurate when the executor wrote it. The blocking
> checkpoint has since been run with the operator and returned `approved`; the original text is
> replaced rather than left to contradict the record below (project Stale Docs rule).

All three tasks have executed. Task 3 was `type="checkpoint:human-verify" gate="blocking"` and was
run with a live operator against `localhost:5173` — not simulated, not self-approved, not inferred
from silence. The operator supplied screenshot evidence for every leg before approving. Full
results, including two observations routed to follow-ups rather than fixed, are in the
**CHECKPOINT** section below.

## Performance

- **Duration:** ~25 min (Tasks 1-2 active work)
- **Tasks:** 2 of 3 completed (Task 3 is the blocking checkpoint, not executed)
- **Files modified:** 2 modified (`REQUIREMENTS.md`, `SEED-002-mission-control-jobs-board.md`), 1 created (`SEED-007-mission-emitter-revival.md`)

## Task Commits

1. **Task 1: Correct REQUIREMENTS.md so the traceability table matches what shipped (D-03, D-04)** — `ca4850c7` (docs)
2. **Task 2: Plant SEED-007 for the emitter revival and audit the two non-goals (D-02, D-06, D-11, D-12)** — `dc618ee8` (docs)

Task 3 (checkpoint) — **not executed. No commit.**

## Task 1: REQUIREMENTS.md correction (D-03, D-04)

**Read-first mechanism confirmed live against the actual file before editing** — matched the
plan's predicted mechanism exactly:
- `- [x] **MISSION-01**` / `| MISSION-01 | Phase 111 | Complete |` — the tool's premature flip,
  as predicted. **Reverted** to `[ ]` / `Partial` per D-04.
- `- [x] **MISSION-03**` / `| MISSION-03 | Phase 111 | Complete |` — correct as-is, confirmed not
  re-touched.
- `- [ ] **MISSION-02**` / `| MISSION-02 | Phase 111 | Pending |` — untouched by the tool as
  predicted (no plan's `requirements:` frontmatter names it). Reassigned to SEED-007 per D-03.

**Preamble strike** — opened immediately before `Frontend-only` with no space, per the acceptance
criterion's markdown-rendering requirement.

**All acceptance-criteria greps (raw output):**

```
$ grep -c "~~Frontend-only, on data that streams today" .planning/REQUIREMENTS.md
1
$ grep -c "MISSION-02 | SEED-007" .planning/REQUIREMENTS.md
1
$ grep -c "^- \[ \] \*\*MISSION-01\*\*" .planning/REQUIREMENTS.md
1
$ grep -c "^| MISSION-01 | Phase 111 | Partial" .planning/REQUIREMENTS.md
1
$ grep -c "Partial (D-04)" .planning/REQUIREMENTS.md
1
$ grep -c "^| MISSION-01 | Phase 111 | Complete" .planning/REQUIREMENTS.md
0
$ grep -cE "^\| MISSION-0[12] \| Phase 111 \| Pending \|$" .planning/REQUIREMENTS.md
0
$ grep -c "MISSION-03 | Phase 111 | Complete" .planning/REQUIREMENTS.md
1
$ grep -c "SEED-007" .planning/REQUIREMENTS.md
4
$ grep -c "2026-07-07" .planning/REQUIREMENTS.md
1
$ grep -c "schema.ts:562-586" .planning/REQUIREMENTS.md
1
$ grep -c "^- \[x\] \*\*MISSION-03\*\*" .planning/REQUIREMENTS.md
1
```

All pass. Full `git diff --stat .planning/REQUIREMENTS.md`: `1 file changed, 6 insertions(+), 6
deletions(-)`. Full diff read and confirmed confined to the MISSION section (lines 44-50) and the
three MISSION traceability rows (lines 93-95) — no DUR/TELE/ENGINE/DEBT line touched. `git status
--porcelain` after this commit listed only `.planning/REQUIREMENTS.md`.

## Task 2: SEED-007 + non-goal audit (D-02, D-06, D-11, D-12)

`.planning/seeds/SEED-007-mission-emitter-revival.md` created with all 8 frontmatter keys
(`id`, `status`, `planted`, `planted_during`, `trigger_when`, `scope`, `origin`, `paired_seed`),
matching SEED-002's schema. Owns 6 items: the astridr emitter repair (D-02), MISSION-01/02's
deferred halves, D-11, D-12, the `stateIcon` prototype-chain robustness note, and the
`SubagentJobStatus` typing note. `.planning/seeds/SEED-002-mission-control-jobs-board.md`
cross-linked with exactly one added line (verified: `git diff --stat` shows `1 file changed, 1
insertion(+)`, zero deletions).

### Non-goal audit — raw command output, every probe paired with its control

**D-11 — `subagentJobs` absent from `retention.ts`'s `RETENTION_DAYS`:**

```
$ grep -n "subagentJobs" convex/retention.ts
(no output)
$ grep -n "toolExecutions" convex/retention.ts
44:  toolExecutions: 14,
```

Probe empty (D-11 held), control fired (search reaches the right file/region). **PASS.**

**D-12 — `listRecent`'s unbounded `.collect()` still present:**

```
$ grep -n "collect()" convex/subagentJobs.ts
88:    const rows = await ctx.db.query("subagentJobs").collect();
```

Still there at line 88, unchanged. **PASS.**

**D-06 — both `subagentJobs` consumers fixed, whole-tree:**

```
$ grep -rn "ActiveAgentsPanel" src/
(no output, exit 1)
$ grep -rln "ActiveAgentsPanel" .planning/ | head -5
.planning/phases/110-convex-durability/110-06-SUMMARY.md
.planning/phases/111-mission-board/111-01-SUMMARY.md
.planning/phases/111-mission-board/111-02-PLAN.md
.planning/phases/111-mission-board/111-02-SUMMARY.md
.planning/phases/111-mission-board/111-03-PLAN.md
$ grep -c "animate-pulse" src/components/JobsPanel.tsx
0
$ grep -c "MISSION HISTORY" src/components/JobsPanel.tsx
1
```

`src/` probe empty, `.planning/` control fired (pattern and tool work; the `src/` zero is a real
absence). `animate-pulse` gone, `MISSION HISTORY` present. **PASS.**

**D-01/D-12 range-coverage control (mandatory before any `convex/` result is trusted):**

```
$ git diff b89cd07f --stat -- src/components/JobsPanel.tsx
 src/components/JobsPanel.tsx | 54 +++++++++++++++++++++++++-------------------
 1 file changed, 31 insertions(+), 23 deletions(-)
```

Non-empty — confirms the range genuinely spans Wave 1 (111-01's rewrite of this exact file).
Control fired; the range is not too shallow. **PASS — proceeding to the D-01/D-12 `convex/` check.**

**D-01 — frontend-only, `convex/` untouched by Phase 111 (GATE CORRECTED — see Deviations):**

The plan's prescribed raw command:

```
$ git diff b89cd07f --name-only | grep '^convex/'
convex/__tests__/loom.test.ts
convex/_generated/api.d.ts
convex/http.ts
convex/ingestAuth.ts
convex/loom.ts
convex/loomHttp.ts
convex/schema.ts
```

**This is NOT a Phase 111 violation.** Per the orchestrator's pre-verified finding, this range
contains a concurrent Phase 119 (Loom) commit that touches `convex/`. Confirmed independently in
this session:

```
$ git log b89cd07f..HEAD --format='%h %s' -- convex/
73816fb1 feat(119): loom pipelines schema, domain module, and bearer-gated emit route
```

Exactly one commit in the whole range touches `convex/`, and its subject scope is `(119)`, not
`(111)`. Re-derived the subject-scoped filter myself (not copied from the orchestrator):

```
$ for c in $(git log b89cd07f..HEAD --format='%h %s' | grep -E '^\w+ \w+\(111' | cut -d' ' -f1); do git show --format='' --name-only $c; done | sort -u | grep '^convex/'
(no output, exit 1)
```

Zero `convex/` paths among commits whose subject carries a `(111...)` scope. **D-01 holds.**

## Deviations from Plan

### Plan-draft deviation (not a bug — the plan pre-authorized this substitution)

**1. [Gate substitution, orchestrator-directed] Replaced the raw `git diff $PHASE_BASE --name-only`
convex/ check with a subject-scoped derivation for D-01/D-12**
- **Found during:** Task 2, non-goal audit
- **Issue:** The plan's literal acceptance criterion (`git diff $PHASE_BASE --name-only` lists no
  path under `convex/`) fails as written: it returns 7 `convex/` paths. All 7 belong to a single
  concurrent Phase 119 (Loom) commit (`73816fb1`) that landed inside the `b89cd07f..HEAD` range
  while this phase was executing in the same shared checkout — not to any Phase 111 commit.
- **Fix:** Per the orchestrator's pre-dispatch finding (verified independently in this session,
  raw output above), substituted a subject-scoped derivation: filter the commit range to only
  commits whose subject carries a `(111...)` scope, then union their touched files and grep for
  `convex/`. Result: zero matches. D-01 and D-12 both genuinely hold — no file under `convex/` was
  touched by any Phase 111 commit.
- **Files modified:** None (verification-only substitution, no code or planning-artifact change).
- **Verification:** Both the raw (contaminated) and subject-scoped (clean) outputs are pasted
  verbatim above for audit. The range-coverage control (`JobsPanel.tsx` diff, non-empty) fired
  before either check ran, proving the range genuinely spans Wave 1 rather than being too shallow.
- **Not fixed:** Nothing under `convex/` — the contaminating commit belongs to a different phase
  and is out of this plan's scope to touch or revert.

**Total deviations:** 1 (gate substitution, pre-authorized by the orchestrator's dispatch finding,
not a defect in Phase 111's own work).

## Regression check (Task 3 precondition, captured before the checkpoint is presented)

```
$ npx tsc --noEmit
(exit 0)
$ npx vitest run
 Test Files  297 passed | 17 skipped (314)
      Tests  3943 passed | 193 todo (4136)
(exit 0)
```

Both exit 0. (The repeated `Not implemented: HTMLCanvasElement's getContext()` lines are known
jsdom/canvas mock noise from unrelated graph/chart components, not failures — 0 failed tests.)

## CHECKPOINT — Task 3: OPERATOR VERDICT RECORDED — **APPROVED** (2026-08-11)

> **Status corrected 2026-08-11 by the orchestrator.** This section previously read "AWAITING
> OPERATOR VERDICT"; the checkpoint has since been run with the operator live against
> `localhost:5173`, and the original heading is superseded rather than deleted so the
> before-state stays legible.

**Operator verdict, verbatim: `approved`.**

Not inferred from silence, a timeout, or an idle verifier — the operator ran the steps against
the running dev server and returned evidence for every leg before approving. Evidence supplied
was three screenshots (Live Run; Chat with command-center mode ON; two devtools console captures),
not prose assertions.

### Observed results, step by step

| Step | Expected | Observed | Source |
|------|----------|----------|--------|
| 2 | Header reads `MISSION HISTORY`, not BACKGROUND JOBS | PASS — `MISSION HISTORY` | Live Run screenshot |
| 3 | No pulsing dot, no replacement glyph | PASS — nothing to the left of the label | Live Run screenshot |
| 4 | Badge reads `{n} missions` | PASS — `7 missions` | Live Run screenshot |
| 5 | Day unit, not a 3-digit `h` value | PASS — `finished 35d ago` on all four visible rows | Live Run screenshot |
| 6 | No duration / cost / confirm card / squad grouping | PASS — none present | Live Run screenshot |
| 7 | Trailing-cluster layout judgment | PASS — no wrap, no overflow, no crowding at the operator's window width | Live Run screenshot |
| 9 | Left rail = Intelligence Feed only, no empty card / "coming soon" / gap | PASS — `INTELLIGENCE FEED` is the rail's sole child, no residue | Chat screenshot |
| 10 | Mission Timeline still present and rendering (D-13) | PASS — present, rendering `channel_health` entries | Chat screenshot |
| 11 | Console errors on either page | PASS — **zero errors on both pages** | Two console screenshots |

**Note on step 5:** the plan predicted `finished 34d ago`; the live value is `finished 35d ago`.
This is correct, not a discrepancy — the newest `subagentJobs` row is dated 2026-07-07 and the
checkpoint ran on 2026-08-11, which is 35 days. The plan was authored on 2026-08-10, one day
earlier. The day tier is behaving exactly as specified; the figure simply advances daily, which
is the whole point of the `d` tier that 111-01 added.

### Console capture detail (step 11)

Both pages report **`No errors`** explicitly in the devtools sidebar counter.

- **Chat page** (15 messages): 0 errors, 1 warning — the Clerk development-keys notice
  (`client:525`). Remainder is `[vite]` connect/connected, the React DevTools nudge, `[voice]`
  lifecycle logs from `useAstridrVoice.ts:211` / `useWakeWord.ts:67`, and two `[Violation]`
  performance notices (`'message'` handler 194 ms; `setTimeout` handler 66 ms) attributed to
  `react-dom`.
- **Live Run page** (5 messages): 0 errors, 1 warning — the same Clerk notice. One
  `[Violation] 'message' handler took 170ms` from `react-dom`.

Nothing in either stream names `JobsPanel`, `Chat`, `SectionErrorBoundary`, or
"Functions are not valid as a React child". That last absence is the meaningful one: it is the
exact symptom `111-01-PLAN.md`'s threat model (T-111-02) predicted for the unguarded
`stateIcon[job.status]` prototype-chain lookup, and it did not occur.

### Two observations recorded as follow-ups, NOT fixed in this phase

Both were surfaced by the checkpoint and deliberately routed to backlog rather than patched —
no decision in this phase authorized touching either, and 111-03's own action text forbids
fixing what the checkpoint reports.

1. **Task snippets end mid-word at 80 characters** (e.g. `…the British East India Compa`).
   Traced to deliberate upstream emitter policy, NOT a CodePulse rendering defect:
   `convex/runtimeIngest.ts:616` stores the value verbatim with no slice;
   `src/components/EntityRow.tsx:31`'s Tailwind `truncate` is demonstrably not engaging (the
   screenshot shows a wide gap between the text and the `FAILED` badge, and `truncate` would
   render an ellipsis); and astridr-repo caps it at exactly 80 chars in four call sites —
   `astridr/tools/delegate_task.py:504`, `astridr/automation/subagent_jobs.py:271`,
   `astridr/tools/cancel_job.py:154` — with `tests/unit/automation/test_subagents.py:409`
   asserting the behavior. **Recorded as SEED-007 item 7**, including the substantive point
   worth revisiting: an 80-char cut with no ellipsis marker is indistinguishable on screen from
   a complete short task.
2. **A devtools `1 Issue` badge on both pages, never opened.** The Issues panel is a separate
   surface from the console stream, so "no console errors" is not evidence about its contents.
   Deliberately NOT classified as benign or pre-existing — that would be a guess.
   **Recorded as `.planning/todos/pending/111-devtools-issues-panel-entry-unexamined.md`** with
   reproduction steps.

### Original checkpoint material (retained for the record)

### What was built (111-01 + 111-02, carried forward for the operator)

Plan 111-01 rewrote `JobsPanel` as a mission history surface (MISSION HISTORY header, no pulsing
dot, `{n} missions` badge, `finished X ago` timestamps with a day tier, three terminal status
icons). Plan 111-02 deleted `ActiveAgentsPanel` and its mount from the Chat page's command-center
left rail. Both are covered by passing automated tests; this project's history is explicit that a
green suite is not evidence about rendered UI.

### Verbatim operator steps (from 111-03-PLAN.md Task 3 `<how-to-verify>`)

1. Confirm the dev server is up. Probe BOTH `http://localhost:5173` and `http://[::1]:5173` —
   Vite frequently binds `::1` only, so an IPv4-only probe reports a healthy server as down.
   If it is not running, start it with `npm run dev` in its own terminal.
2. Open `http://localhost:5173` and navigate to the **Live Run** page. Find the panel above the
   tab content.
   - It must read **MISSION HISTORY**, not BACKGROUND JOBS.
   - There must be **no pulsing dot** to the left of that label, and no glyph in its place.
   - The count badge must read **"{n} missions"**, not "{n} jobs".
   - With the live data (7 lifetime rows, newest 2026-07-07), each row's right-hand timestamp
     should read something like **"finished 34d ago"** — a `d` unit, not a three-digit `h`
     value, and not a bare `816h`.
   - Confirm no row shows a duration, elapsed time, cost figure, confirm card, or squad
     grouping.
3. Judge the trailing cluster's layout: `finished 34d ago` is materially longer than the `5s`
   it replaced. Report whether the status badge and timestamp wrap, overflow, or crowd the
   panel at your window width. **Do not ask for a fix in this session** — record it, because
   no decision authorized restyling this cluster and a silent style change would exceed the
   phase's locked scope.
4. Navigate to the **Chat** page and turn **command center mode ON** (the GRID toggle).
   - The left rail must show **Intelligence Feed only**.
   - There must be **no "ACTIVE AGENTS" panel**, no empty bordered card where it was, no
     "coming soon" tile, and no visible gap that reads as a missing panel.
   - Confirm **Mission Timeline** is still present and rendering — it is a different panel that
     merely shares a word, and it must not have been caught by the deletion.
5. Open the browser devtools console on both pages and report any error or warning naming
   `JobsPanel`, `Chat`, `SectionErrorBoundary`, or "Functions are not valid as a React child".
   Per this project's error-triage rule, do not dismiss anything you see as pre-existing —
   report it verbatim.

**Resume signal:** Type "approved" to close the phase, or describe what you saw. Include the
trailing-cluster layout observation from step 3 either way — it is expected output, not a defect
report.

### Trailing-cluster layout note carried forward from 111-01-SUMMARY.md (context for step 3)

From `111-01-SUMMARY.md`'s "Visual Overflow Risk — Flagged for 111-03 Checkpoint" section,
carried forward verbatim for the operator's step-3 judgment:

- **Old strings** were 2-3 characters: `5s`, `34s`, `12m`, `3h`.
- **New strings** are 15-21 characters: `finished moments ago` (21 chars), `finished 34d ago`
  (17 chars), `finished 45m ago` (16 chars).
- `EntityRow.tsx:34`'s trailing wrapper is `shrink-0` with no width cap — it does not truncate or
  wrap the timestamp; instead the sibling `flex-1 min-w-0` primary/secondary column absorbs the
  compression (its `primary` text already truncates/line-clamps). On a narrow `JobsPanel` mount
  (it sits inside `LiveRun.tsx`'s `px-4 py-3` header strip, not a full-width page), a
  `StatusBadge` (`CANCELLED` is the longest label) plus the new ~20-char timestamp string in one
  `gap-1.5` row could push the trailing cluster's natural width to roughly 3-4x its old size,
  further squeezing the task-snippet column on smaller viewports.
- This was evaluated from code/CSS analysis only — no live browser render was captured in 111-01
  (out of scope for an `auto` task with no checkpoint). This is exactly what 111-03's Task 3
  step 3 exists to confirm live.

## User Setup Required

None for Tasks 1-2. Task 3 needs the dev server running (`npm run dev`) for the operator to
verify against.

## Next Steps

- Orchestrator presents Task 3's steps to the operator.
- A continuation agent records the operator's verbatim verdict (approval or defect report) plus
  the step-3 layout observation and any console errors from step 5, in an update to this SUMMARY.
- Only after the operator verdict is recorded does the phase close (STATE.md/ROADMAP.md
  phase-complete updates, plan-counter advance) — none of that has run yet.

---
*Phase: 111-mission-board*
*Tasks 1-2 completed: 2026-08-11 — Task 3 (checkpoint) PENDING, not yet run*

## Self-Check: PASSED

- FOUND: .planning/REQUIREMENTS.md (modified, verified via grep above)
- FOUND: .planning/seeds/SEED-007-mission-emitter-revival.md
- FOUND: .planning/seeds/SEED-002-mission-control-jobs-board.md (modified, 1 line added)
- FOUND commit: ca4850c7 (Task 1)
- FOUND commit: dc618ee8 (Task 2)
