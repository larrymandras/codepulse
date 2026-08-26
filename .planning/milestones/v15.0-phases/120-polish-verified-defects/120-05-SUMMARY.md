---
phase: 120-polish-verified-defects
plan: 05
subsystem: dashboard-hero, fabrication-sweep
tags: [honesty-defect, dashboard, hero-stats, sweep]
dependency-graph:
  requires: []
  provides:
    - "Fabricated Integrations row removed from src/components/HeroStatsBar.tsx"
    - ".planning/phases/120-polish-verified-defects/120-FABRICATION-INVENTORY.md — full D-08 sweep record"
  affects:
    - "src/components/HeroStatsBar.tsx (also carries this plan's exclusive D-01/D-09 residue cleanup)"
tech-stack:
  added: []
  patterns:
    - "D-07: delete-don't-rewire for a fabricated integration row that duplicates an existing honest surface"
    - "D-08: sweep-report-fix-only-unambiguous, with a mandatory dropped-with-reason account"
key-files:
  created:
    - .planning/phases/120-polish-verified-defects/120-FABRICATION-INVENTORY.md
  modified:
    - src/components/HeroStatsBar.tsx
decisions:
  - "D-07 executed as delete, not rewire — /infrastructure's IntegrationHealth already renders the honest version, and LINEAR/VERCEL have no emitter at all."
  - "D-08 sweep found one NEW judgment-call fabrication beyond the plan's two pre-identified ones: VitalsRail.tsx:253's hardcoded green Convex status dot. Recorded, not fixed — no live Convex-connectivity signal exists in this repo to bind it to."
metrics:
  duration: "~50 min"
  completed: 2026-08-17
---

# Phase 120 Plan 05: Delete Fabricated Integrations Row + Sweep the Fabrication Class Summary

Deleted `HeroStatsBar.tsx`'s hardcoded five-integration health strip (D-07) plus this file's
exclusively-owned `hover:scale-[1.01]` and unconditional `animate-pulse` residue (D-01/D-09), then
ran the D-08 fabrication-class sweep across `src/`, producing a `file:line` inventory of every hit
with a precision-first fixed/recorded/dropped account.

**POLISH-04 is NOT fully closed by this plan.** Three known fabrication-class residues remain,
deliberately unfixed and recorded with their owning phase — see below.

## What Was Built

**Task 1 — `src/components/HeroStatsBar.tsx`:**
- Deleted the `{/* Quick Action Badges (Integrations row simulation) */}` block through its closing
  `</div>` — the hardcoded `['GITHUB','LINEAR','SLACK','CONVEX','VERCEL']` strip with unconditional
  `bg-emerald-500/80` dots. Nothing was put in its place (D-07: the space is Phase 125's Pulse ECG).
- Removed `hover:scale-[1.01]` and its co-located `transition-transform duration-300` from the
  progress-bar card wrapper. `glow-card`, both `shadow-[var(--glow-*)]` tokens, and
  `hover:border-primary/50` were left untouched (D-01).
- Removed `animate-pulse` from the "System Load" label's status dot, keeping the static
  `w-1.5 h-1.5 rounded-full bg-primary` dot (D-09: de-animate, not delete).
- Changed nothing else in the file — `AnimatedNumber` (~141), the `hc.bg` runtime-interpolated
  status dot (~127), the progress bar, the Memory readout, and the KPI grid are all untouched, per
  the plan's explicit "change nothing else" instruction.

Net diff: `src/components/HeroStatsBar.tsx | 15 ++-------------` (1 file changed, 2 insertions(+),
13 deletions(-)).

**Task 2 — `.planning/phases/120-polish-verified-defects/120-FABRICATION-INVENTORY.md` (238 lines):**
Six sections (§1-§6) per the plan's spec. §1 re-ran every search live (not copied from the plan's
pre-measured figures) and recorded literal commands + output, including three zero-hit control
searches. §2 documents the one fixed defect with its three independent unambiguity tells. §3 records
three deferred fabrication-class findings, each with owning phase. §4 accounts for every dropped
family (~126 items across 7 named families) with representative `file:line` and reasoning, plus a
totals line. §5 is the one-sentence handoff. §6 closes out this plan's own `hover:scale-[1.01]` /
`animate-pulse` residue counts for phase verification.

## The D-08 Sweep — What Was Found

**Fixed (1):** The Integrations row (Task 1, above).

**Recorded, deferred (3):**
1. `HeroStatsBar.tsx` ~141 — the synthetic "System Load" percentage (`100 - errorRate*2` dressed as
   a load figure, reads 100% with zero traffic). **Owner: SIGNAL-02, Phase 125** — already assigned
   in `REQUIREMENTS.md:59`. Not touched, per the plan's explicit instruction not to re-decide an
   assigned requirement.
2. `HeroStatsBar.tsx` ~127 — `` text-${hc.bg.replace('bg-','')} `` — a runtime-interpolated Tailwind
   class Tailwind's static extractor cannot see, so it never ships. A dead style, not a fabrication.
   **Owner: Phase 122.**
3. **New finding, not pre-identified by the plan:** `src/components/chat/VitalsRail.tsx:253` — the
   "Convex" status dot is hardcoded `bg-green-500` unconditionally, three lines below its own sibling
   "Ástríðr" dot, which correctly reads `disconnected ? "bg-red-500" : "bg-green-500"`. Verified this
   is a genuine judgment call, not a mechanical fix: `convex/integrations.ts healthStatus` has no
   `convex` key (only github/supabase/docker/telegram/slack/email), and no component anywhere in the
   repo calls `useConvex().connectionState()`. Choosing the right live signal is a design decision.
   **Owner: Phase 122.**

**Dropped (~126, 7 named families, full detail in §4 of the inventory):** negative honesty
assertions ("no hardcoded hex", "never fabricated") — the majority of the 99 comment-keyword hits;
legitimate honest-placeholder UI/empty-state patterns; d3-force `simulation` API vocabulary (matches
`d3ReheatSimulation`, confirmed live with 5 hits); test-mock references in production-file comments;
historical/already-fixed-bug documentation; a regex substring-collision family (`demo` matching
inside `globalOverrideModel` and `demonstrably` — a sweep-methodology finding, not a code defect);
and 16 of 17 unconditional-looking status-dot hits that are legends, real-data-gated dots, or
already-conditional on inspection.

## Verification

**Task 1 acceptance criteria — literal output:**
```
grep -c 'LINEAR' src/components/HeroStatsBar.tsx                          -> 0
grep -c 'VERCEL' src/components/HeroStatsBar.tsx                          -> 0
grep -c 'Integrations row simulation' src/components/HeroStatsBar.tsx     -> 0
grep -c 'bg-emerald-500/80' src/components/HeroStatsBar.tsx               -> 0
git grep -cF 'hover:scale-[1.01]' -- src/components/HeroStatsBar.tsx      -> 0 (silent)
git grep -cF 'animate-pulse' -- src/components/HeroStatsBar.tsx           -> 0 (silent)
grep -c 'AnimatedNumber' src/components/HeroStatsBar.tsx                  -> 2 (control, unchanged)
grep -c 'MetricCard' src/components/HeroStatsBar.tsx                      -> 4 (control, unchanged)
grep -c 'glow-card' src/components/HeroStatsBar.tsx                       -> 1 (control, unchanged)
grep -c 'rounded-full bg-primary' src/components/HeroStatsBar.tsx         -> 1 (static dot survived)
git grep -c 'healthStatus' -- convex/integrations.ts                     -> 1 (D-07 premise re-verified)
git grep -c 'IntegrationHealth' -- src/pages/Infrastructure.tsx          -> 2 (D-07 premise re-verified)
git diff --stat                                                          -> only HeroStatsBar.tsx changed by me
                                                                              (.planning/STATE.md also
                                                                              shows modified — a
                                                                              concurrent session's
                                                                              change, not mine)
```

**Task 2 acceptance criteria:**
```
test -s .../120-FABRICATION-INVENTORY.md          -> non-empty, confirmed
grep -c 'SIGNAL-02' .../120-FABRICATION-INVENTORY.md -> 4
All six §1-§6 sections present, confirmed by heading grep.
```

**Build/test gate:**
```
npx tsc --noEmit    -> exits 0, no output
npx vitest run      -> Test Files  335 passed | 17 skipped (352)
                        Tests  4684 passed | 197 todo (4881)
```
Matches the required baseline exactly (335 files / 4684 tests passing, 0 failing).

**Attended check (with a Clerk-free `vite --port 5199` instance, per the in-repo screenshot recipe,
since `dev:noauth`'s hardcoded port 5181 was free but the established recipe targets 5199):**
Loaded the Dashboard. `bodyText.includes('LINEAR')` and `.includes('VERCEL')` and
`.includes('Integrations')` all `false`; `.includes('System Load')` `true` (confirming the page
rendered past the deleted block, not that it failed to load). Screenshot confirms the "System Load"
card flows directly into the KPI grid (Sessions / Error Rate / Alerts / Security) with clean
`gap-6` spacing — no orphaned divider, no double gap, no visible artifact from the deleted
`border-y` block. The temporary Vite instance and its throwaway screenshot script were both cleaned
up after the check (`taskkill` on the process, the script file removed) — `git status --short`
confirms no stray files remain.

## Deviations from Plan

**1. [Rule 1-class, scope-preserving] The comment-keyword sweep count came in far above the plan's
"~40" pre-measured figure.** An unfiltered pass (no test-file or `.test.` exclusion) returned 365
hits, because "placeholder" also matches every JSX `placeholder="..."` form-input attribute in the
codebase — a distinct, legitimate language construct the plan's own interfaces section didn't
anticipate needing separate filtering for. Restricting to non-test files and excluding
`placeholder=` attributes brought it to 210; restricting further to actual comment-syntax lines
(`//`, `/*`, `*` continuation) brought it to 99 — still above "~40" but the correct, defensible
scope for "comment keywords." All 99 were individually triaged; zero are live defects (§4 of the
inventory has the full family breakdown). This is a measurement correction, not a scope deviation —
the plan explicitly said its figures were "a 2026-08-17 reading... to be re-run and extended, not
trusted," and instructed re-running the sweep myself.

**2. [New finding within the plan's own D-08 mandate] `VitalsRail.tsx:253`'s hardcoded Convex status
dot** — found by the plan's own required "status/health indicator whose colour or state is a literal
rather than derived" search, which the plan explicitly asked to be run "beyond the above." This is a
genuine POLISH-04-class instance the plan's authors did not know about at planning time. Recorded in
§3 of the inventory with Phase 122 as owner, not fixed, because fixing it requires choosing a live
Convex-connectivity signal (none exists in this repo today) — a design decision, not a mechanical
deletion, per D-08's own judgment-call rule.

No other deviations. Every other line number and code fragment in the plan's `<interfaces>` section
matched the live code exactly.

## Known Stubs

None introduced by this plan. (The three §3-recorded items are pre-existing fabrications, not stubs
introduced here — this plan deliberately left them in place rather than removing the app's only
large hero number or inventing a new Convex-health signal outside its scope.)

## Threat Flags

None. This plan only deletes JSX and writes/reads markdown; no new network surface, auth path, or
schema change was introduced. (Matches the plan's own threat-model disposition: "none technical.")

## Self-Check: PASSED

```
FOUND: src/components/HeroStatsBar.tsx (edited, exists)
FOUND: .planning/phases/120-polish-verified-defects/120-FABRICATION-INVENTORY.md (created, 238 lines, non-empty)
```
No commits were made by this executor (per the plan's explicit no-commit instruction); there are no
commit hashes to verify. `git status --short` at completion shows exactly:
```
 M .planning/STATE.md                                                    <- concurrent session, not mine
 M src/components/HeroStatsBar.tsx                                       <- this plan, Task 1
?? .planning/phases/120-polish-verified-defects/120-FABRICATION-INVENTORY.md  <- this plan, Task 2
```
`.planning/STATE.md` and `.planning/ROADMAP.md` were not read as ground truth, not edited, and not
staged by this executor, per the plan's explicit instruction.
