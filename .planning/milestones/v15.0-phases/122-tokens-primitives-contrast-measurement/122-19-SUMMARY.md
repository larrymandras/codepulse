---
phase: 122-tokens-primitives-contrast-measurement
plan: 19
subsystem: testing
tags: [axe, playwright, a11y, contrast, wcag]

requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "122-01's before-matrix (a11y-before/*.json, the frozen control) and 122-18's rasterised D-27 rendered-result figures"
provides:
  - "20 after-matrix axe JSON captures in a11y-after/, one per theme x page cell"
  - "Completed 122-CONTRAST-BASELINE.md: AFTER table, per-cell and per-rule Delta, named-pair ratios pulled in from 122-18/122-BADGE-LAW.md, re-derived sampling limit"
affects: [123-contrast-remediation]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/*.json (20 files)
  modified:
    - .planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md

key-decisions:
  - "Delta computed as before-minus-after per the plan's own convention, with the sign explicitly labelled (positive=improvement, negative=regression) rather than left implicit"
  - "A node-count-only regression inside an unchanged violation-object count ([aubergine] Analytics) was named separately from the object-level regression set, per the plan's own 'a total can hide one cell worsening' discipline"

patterns-established: []

requirements-completed: []

duration: this session
completed: 2026-08-19
---

# Phase 122 Plan 19: A11Y-01 After-Matrix and Delta (Tasks 1-2 of 4 — PAUSED at checkpoint)

**Tasks 1 and 2 executed and committed. Task 3 is a blocking human-verify checkpoint and was NOT
performed. Task 4 was NOT performed — A11Y-01 and the TOKEN-01..05 requirements remain unmarked
in REQUIREMENTS.md pending the operator's reply.**

## Performance

- **Tasks:** 2 of 4 completed (Tasks 3-4 pending operator sign-off)
- **Files modified:** 21 (20 new JSON captures, 1 baseline doc)
- **Commits:** 2

## What Was Done

**Task 1 — after-matrix capture.** Started `dev:noauth` fresh from Git Bash
(`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`), probed both `localhost:5181` and
`127.0.0.1:5181` (200/200) before running, then captured the full 20-cell matrix into a NEW
directory (`a11y-after/`) so `a11y-before/` was never touched. 20/20 measured, 0 skipped, filenames
identical to `a11y-before/` by name-level diff (`diff` exit 0). The grand total is non-zero (passes
the plan's "suspect if zero" control). The `fee96b5d` gate guard was re-proven by running the same
`[cyan] Dashboard` cell against the gated `:5173` server: Playwright reported `skipped` with the
exact `"Clerk auth gate present..."` annotation text, byte-identical to plan 122-01's control —
the guard still refuses a vacuous pass after the full token rewrite. Wall-clock 12.3s vs. the
before-run's 14.3s. A `grep -rF 'C:\Users\mandr'` disclosure scan on the capture directory returned
0 hits, paired with a known-present control (`grep -rF 'http://localhost:5181'` → 20/20 hits) so
the zero is believable, before committing. `dev:noauth` was stopped after the run and confirmed
down by a post-kill probe (`000`) plus an empty `Get-NetTCPConnection`-equivalent listener check.

**Task 2 — delta and baseline artifact.** All three `PENDING` stubs in `122-CONTRAST-BASELINE.md`
were replaced (`grep -c PENDING` → 0). The AFTER table, its rule breakdown, and the per-cell and
per-rule Delta section were all re-derived directly from the 20 committed `a11y-after/` JSON files
(never transcribed from a log), with the grand total cross-checked two independent ways in both the
AFTER and Delta sections. Object-level and node-level deltas are reported as separate tables, per
the plan's explicit instruction that a grand total can hide a per-cell regression. Every cell whose
violation-object count changed had its causing axe rule(s) named and traced to a specific source
file and commit, rather than left as a bare number. A node-count regression that does NOT show up
at the violation-object level was also found and named separately, per the same discipline. The
Named-pair section pulled in plan 122-18's rasterised D-05/D-06 figures (cross-checked against
122-BADGE-LAW.md §8) and states plainly that these are pixel measurements, not axe results, and
that no computed colour string was parsed. The sampling-limit denominator was re-derived live at
this measurement, not reused from 122-01's number, and came out unchanged (5 of 47 route files;
unit named). The 234 figure is addressed for the AFTER measurement in addition to BEFORE's existing
treatment. A `grep -cF 'C:\Users\mandr'` scan on the completed document returned 0, paired with a
known-present control (`localhost:5181` → 5 hits).

## Task Commits

1. **Task 1: after-matrix capture** — `2095a389` (test) — 20 files, 11428 insertions
2. **Task 2: delta and baseline artifact** — `1e0b5060` (docs) — 1 file, 181 insertions / 10 deletions

Both commits verified with `git show --stat HEAD` immediately after committing: only the files each
task intended, nothing swept in from the concurrent phase-190 session. `.planning/STATE.md` and
`.planning/ROADMAP.md` diffed empty before both commits. `src/index.css` was not touched by either
commit.

## Deviations from Plan

None. Both tasks' acceptance criteria were independently re-derived and verified rather than
assumed, and all held as written.

## What Task 1-2 measured, without characterising it

The completed `122-CONTRAST-BASELINE.md` Delta section reports which cells' violation-object counts
changed between the BEFORE and AFTER captures, which axe rule(s) are responsible for each, and a
node-level finding not visible at the object level. The full numbers, the per-cell breakdown, and
the traced cause for every change are in that document — this summary does not restate a verdict on
them; that judgement is the operator's, at Task 3 step 1.

## Task 3 — NOT PERFORMED (blocking human-verify checkpoint)

Per the dispatch's checkpoint-stop contract, Task 3 was not executed, not self-approved, and no
verdict was recorded for it. The plan's Task 3 (`gate="blocking"`) requires the operator to:

1. Read `122-CONTRAST-BASELINE.md`'s Delta section and confirm the direction is one they are
   willing to hand to Phase 123.
2. Start `npm run dev` (`http://localhost:5173`) and cycle all four themes, confirming the layered
   surfaces read as the Borealis direction on a real page.
3. Open `/analytics` and confirm the three known-timeout tiles say something honest rather than a
   dash or a confident figure, and that succeeding panels render normally.
4. Open `/forge` and confirm the `Failed` badge is filled and legible, and that `STRICT` execution
   mode no longer looks like a failure.
5. Switch to `readable` and move the mouse over things — hover a nav item, a card, a button; watch
   a panel load — and answer specifically about MOTION (not legibility).
6. Confirm `ThemeSwitcher` still lists exactly four themes (`amber` stays unexposed by D-04).
7. Switch to `emerald`, open `/channels/whatsapp`, and — only if the channel is CONNECTED —
   look at the co-visible `StatusBadge status="ok"` and the primary-action buttons above/below it
   (`WhatsApp.tsx:460/494/506`) and judge whether the OK badge reads as a second brand colour or as
   a status signal. If not connected, say so rather than guessing.
8. Say whether this reads as the Borealis Console direction landing, or whether something reads
   wrong, naming the theme and surface if so.

**Resume signal:** Type "approved" to close Phase 122 and release Phase 123, or describe what looks
wrong and where.

## Task 4 — NOT PERFORMED

`.planning/REQUIREMENTS.md` was not touched. A11Y-01 and TOKEN-01..05 remain in their pre-plan
state. `gsd-sdk phase.complete` was not run and must not be run to close this phase, per the
project's own standing note that it marks PARTIAL requirements Complete.

## Self-Check

- `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/` — FOUND, 20 files
- `.planning/phases/122-tokens-primitives-contrast-measurement/122-CONTRAST-BASELINE.md` — FOUND, `PENDING` count 0
- Commit `2095a389` — FOUND in `git log --oneline`
- Commit `1e0b5060` — FOUND in `git log --oneline`
- `.planning/REQUIREMENTS.md` — untouched (Task 4 not run)
- `.planning/STATE.md` / `.planning/ROADMAP.md` — untouched
- `src/index.css` — untouched
- `dev:noauth` — confirmed stopped (post-kill probe `000`, no listener on 5181)

## Self-Check: PASSED

## Operator Checkpoint Response (Task 3) -- 2026-08-19

Recorded VERBATIM per this plan's `<action>` clause. Operator reply, unedited:

> #3 4 items in the theme switcher
> #4 one flat tone for the most part
> #5 they look fine
> #6 only the nav bar items highlight a color
> #7 it says Bridge offline
> #8 see screenshot
> #9 see screenshots
> #10 see screenshot, page looks like shit
> #11 see screenshot, page looks like shit
> #12 Hard for me to tell
> #13 The pages needs some work

**VERDICT: NOT APPROVED. The gate's blocking condition is tripped by #4.** Task 4 was NOT run and
no requirement has been marked complete. Phase 122 stays open.

### #4 -- THE BLOCKING FINDING: the surface ramp is perceptually flat

The operator is correct and the automated spec is wrong. Measured from the authored hex in
`src/index.css`, adjacent-surface step contrast:

| theme | surface-0 -> 1 | 1 -> 2 | 2 -> 3 |
|---|---|---|---|
| cyan | 1.042:1 | 1.064:1 | 1.083:1 |
| **emerald** | **1.032:1** | **1.034:1** | **1.048:1** |
| amber | 1.057:1 | 1.066:1 | 1.092:1 |
| readable | 1.089:1 | 1.067:1 | 1.109:1 |
| aubergine | 1.060:1 | 1.042:1 | 1.069:1 |

In byte terms cyan steps `rgb(5,6,10)` -> `rgb(11,13,18)`, about 6/255 in near-black. Emerald is
flattest at `rgb(2,6,23)` -> `rgb(3,10,37)`. For reference, measured from their own published hex,
shadcn's zinc ramp steps at 1.123 / 1.189 / 1.426 and GitHub dark at 1.094 / 1.137 / 1.247 -- so
this ramp is roughly a third of the industry norm, and emerald is far below even that.

**Why 122-18's rendered-result spec passed anyway.** `e2e/theme-rendered-result.spec.ts:269-270`:

```js
const keys = new Set(triples.map((t) => t!.join(",")));
expect(keys.size, `${theme}: expected 4 distinct surface colours, got ${keys.size}`).toBe(4);
```

That asserts the four sampled colours are not BYTE-IDENTICAL. A one-point difference passes it.
D-01 and this checkpoint's own step 2 require "three or four DISTINGUISHABLE depths" -- a
perceptual property the test never measured. The same file already defines a `channelDistance`
helper whose docstring promises a "threshold rationale stated at each call site"; the surface test
does not use it. This is the phase's own recurring failure shape one level up: a probe that
discriminates a property nobody cares about, reported as a pass.

Routed back to **122-02** (which authored the ramp) and **122-18** (which authored the vacuous
assertion), per this task's instruction to route rather than absorb into a later phase.

### #7 -- D-05's human half is structurally unanswerable; closing on the automated measurement

The WhatsApp bridge is offline, so `/channels/whatsapp` renders "Bridge Offline" and no
`Connected` badge. This is the THIRD attempt at D-05's human judgement (122-03 step 4 named no
location; 122-19 step 7 named one; the location is state-gated). Measured cause:
`StatusBadge status="ok"` is rendered in exactly ONE non-test file app-wide,
`src/pages/WhatsApp.tsx` (`:252` and `:494`), and both sites are gated on a live bridge -- a
scarcity created partly by 122-10 flattening `succeeded`/`completed` to the quietest tier.
Control: the same probe finds other statuses across `BlackboardPanel`, `ExecutionTable`,
`IdeationRow`, `JobsPanel`, `RoomListItem`, so the single hit is real scarcity, not a broken
matcher. **Operator decision 2026-08-19: close D-05 on 122-18's rasterised measurement and record
the human half as structurally unanswerable.**

### #6 -- D-11 partially answered

"Only the nav bar items highlight a color" describes a COLOUR CHANGE, not motion. D-11 asks about
pulse/spin/ease/fade/transition. Pending a check of whether that highlight carries a transition
duration under `readable`, this is provisionally a pass -- but it is NOT recorded as a clean one.

### #9 -- PASS, and better than asked

The `/analytics` screenshots show the three genuinely-timing-out queries rendering honest
`SectionErrorBoundary` fallbacks that name the failing Convex function and request ID with a Retry
button, while `Token Distribution` on the same page renders real data ($70.1226, 81,582,023
tokens) as the live control. No dash, no fabricated figure. This is exactly what D-19/D-20 asked
for, verified against real server-side failures rather than injected ones.

### #10, #11, #13 -- investigated, NOT phase-122 regressions

"Page looks like shit" on `/forge` and `/analytics` was traced rather than accepted or dismissed:

- The Forge selected-row solid green block is `bg-accent border-l-2 border-primary` at
  `ForgeJobList.tsx:225`, byte-identical to the pre-phase blob at `001c1e73:221`, and `--accent`
  under emerald is `#059669` in BOTH trees. Markup unchanged, token value unchanged.
- `LlmProviderPanel.tsx`'s only phase-122 change is its panel wrapper,
  `bg-gray-800/50` -> `bg-card/50` -- the opacity modifier is preserved, so no fill was
  strengthened.
- The clipped 280px Forge job column is the pre-existing defect already filed at
  `.planning/todos/pending/forge-job-list-column-clips-card-rows.md`.

These are real UI complaints and worth their own work, but they are not caused by this phase and
must not be silently folded into it.

### #12 -- delta not independently assessable by the operator

"Hard for me to tell" is recorded as-is. The Delta section is complete and committed; no operator
judgement on the direction was obtained, so none is claimed.
