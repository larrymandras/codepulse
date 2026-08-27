---
phase: 128-planning-reconciliation
plan: 01
subsystem: planning-infra
tags: [todo-lifecycle, requirements-drift, convex-bounded-reads, evidence-based-closure]

# Dependency graph
requires: []
provides:
  - "128-TODO-CLOSURES.md adjudication ledger re-deriving RECON-01's five folded todo claims against live code"
  - "3 of 5 todos moved to todos/completed/ with file:line-cited Resolution sections"
  - "2 of 5 todos kept in todos/pending/ with re-derivation evidence and (for one) a corrected resolves_phase"
  - "checks/closed-todos.mjs structural guard on closure frontmatter + citation resolvability"
  - "RECON-01 vs FIX-01 contradiction resolved in writing, in FIX-01's favor, with evidence"
affects: [128-02, 128-03, 128-04, 128-05, 129-fix-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Todo closure convention: status:closed + closed:<date> + closed_by:<plan-id> frontmatter, plus a `## Resolution (...)` section with file:line evidence — extract-don't-delete, original body kept below"
    - "Structural checker scoped to the closed_by:-bearing population rather than the whole completed/ directory, to stay honest about a corpus that predates this plan's convention"

key-files:
  created:
    - .planning/phases/128-planning-reconciliation/128-TODO-CLOSURES.md
    - .planning/phases/128-planning-reconciliation/checks/closed-todos.mjs
    - .planning/phases/128-planning-reconciliation/deferred-items.md
  modified:
    - .planning/todos/completed/tool-galaxy-getprojectgraph-timeout.md
    - .planning/todos/completed/inbox-listheldunacked-unbounded-every-route.md
    - .planning/todos/completed/forge-loading-div-aria-prohibited-attr.md
    - .planning/todos/pending/automation-page-placeholder-cards-and-invalid-expression.md
    - .planning/todos/pending/unbounded-analytics-scans-timeout.md

key-decisions:
  - "3 of RECON-01's 5 folded todo claims CONFIRMED FIXED and closed with file:line evidence: tool-galaxy chunked-blob read (convex/graphSnapshots.ts:693-699), inbox held-count badge split (convex/inbox.ts:269-298 + DashboardLayout.tsx:146), Forge loading-div role=status (ForgeJobList.tsx:171-176)"
  - "automation-page-placeholder-cards todo PARTIALLY FIXED, not closed: cronSummary's index bound is real (automation.ts:148), but the todo's own 9-10s cold-subscription delay symptom is unrelated and still unconfirmed. resolves_phase corrected 128 -> 129 since Phase 128 cannot fix defects."
  - "unbounded-analytics-scans-timeout todo PARTIALLY FIXED, not closed: 3 of 4 named queries are bounded via aggregates rollups (Phase 121 work), but convex/metrics.ts:19's dashboardSummary is still a fully unbounded events .collect() -- matches FIX-01 exactly."
  - "RECON-01 vs FIX-01 contradiction resolved: the code supports FIX-01 (metrics.ts:19 is a live defect, Phase 129), not RECON-01's blanket already-fixed framing for 'unbounded analytics scans'."
  - "closed-todos.mjs scopes its strict frontmatter check to todos carrying closed_by: at all, not literally every file in completed/ -- the plan's literal spec is unsatisfiable against 7 pre-existing legacy-convention todos without out-of-scope edits (deviation Rule 1)."

requirements-completed: [RECON-01]

# Metrics
duration: ~55min
completed: 2026-08-27
---

# Phase 128 Plan 01: Todo Closure Adjudication Summary

**Re-derived RECON-01's five folded todo claims against live code: 3 confirmed fixed and closed, 2 partially fixed and kept open with narrowed scope, and the REQUIREMENTS.md RECON-01/FIX-01 contradiction resolved in writing in FIX-01's favor.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 8 (1 created ledger, 1 created checker, 1 created deferred-items log, 3 todos moved+edited, 2 todos edited in place)

## Accomplishments

- Re-derived all five of RECON-01's folded todo claims directly from live code (`convex/graphSnapshots.ts`, `convex/automation.ts`, `convex/inbox.ts`, `convex/analytics.ts`, `convex/metrics.ts`, `src/components/forge/ForgeJobList.tsx`) rather than trusting the scoping sweep's tags, per D-04.
- Closed 3 todos with `file:line` proof the fix is live AND wired to its consumer, not just present in the file (`useProjectGraph.ts:25` for tool-galaxy, `DashboardLayout.tsx:146` for the inbox badge).
- Kept 2 todos open with narrowed, evidence-backed scope, per D-05/D-06 — including catching that the automation todo's own `resolves_phase: 128` was itself wrong once it stayed open (Phase 128 cannot fix defects), corrected to 129 with the correction recorded as a finding.
- Settled the RECON-01/FIX-01 contradiction: `convex/metrics.ts:19`'s `events` table read is genuinely unbounded (no `.withIndex()` range, no `.take()`), matching FIX-01 verbatim; RECON-01's blanket "already fixed" framing for "unbounded analytics scans" is wrong as written (3 of 4 named queries are fixed, the 4th is not).
- Built `checks/closed-todos.mjs`, mutation-proven in both directions (a bad citation reddens the check naming the exact file; restoring the text turns it green again).

## Task Commits

1. **Task 1: Re-derive all five claims against live code and write the adjudication ledger** - `99b603f0` (docs)
2. **Task 2: Apply the verdicts to the five todo files** - `0123ad54` (docs)

_Note: `128-TODO-CLOSURES.md` was further edited within Task 2's commit (Finding 3 added after discovering the `resolves_phase` correction needed) — both commits are docs-only, no source changes._

## Files Created/Modified

- `.planning/phases/128-planning-reconciliation/128-TODO-CLOSURES.md` - The adjudication ledger: Method, Verdicts table (5 rows), Findings (D-05, 4 items), Not done here
- `.planning/phases/128-planning-reconciliation/checks/closed-todos.mjs` - Structural guard: frontmatter completeness for closed_by:-bearing todos + Resolution-section citation resolvability for closed_by:128-01 todos
- `.planning/phases/128-planning-reconciliation/deferred-items.md` - Logs 2 pre-existing `status: pending`-in-`completed/` anomalies and 7 legacy-convention todos found while building the checker, none fixed (out of scope)
- `.planning/todos/completed/tool-galaxy-getprojectgraph-timeout.md` - Moved from pending/, status:closed, Resolution section citing `convex/graphSnapshots.ts:693-699` + `src/hooks/useProjectGraph.ts:25`
- `.planning/todos/completed/inbox-listheldunacked-unbounded-every-route.md` - Moved from pending/, status:closed, Resolution section citing `convex/inbox.ts:269-298,278,247` + `src/layouts/DashboardLayout.tsx:146` + `convex/inboxIngest.ts:174`
- `.planning/todos/completed/forge-loading-div-aria-prohibited-attr.md` - Moved from pending/, status:closed, Resolution section citing `src/components/forge/ForgeJobList.tsx:171-176`
- `.planning/todos/pending/automation-page-placeholder-cards-and-invalid-expression.md` - Stays pending, Re-derivation section added, `resolves_phase` corrected 128->129
- `.planning/todos/pending/unbounded-analytics-scans-timeout.md` - Stays pending, Re-derivation section added, scope narrowed to `convex/metrics.ts:19,24` only

## Decisions Made

- **CONFIRMED FIXED — close:** tool-galaxy timeout, inbox.listHeldUnacked badge, Forge loading-div ARIA. Each verified against both the fix's presence AND its consumer (not just file content) — the todos themselves specifically warned that "a bounded query that nothing calls fixes nothing," so consumer verification was load-bearing, not optional.
- **PARTIALLY FIXED — keep, scope narrowed:** automation stat cards (index-bound confirmed, but the 9-10s cold-subscription-delay symptom is unrelated and unresolved) and unbounded analytics scans (3 of 4 named queries fixed by Phase 121's aggregates-rollup work, the 4th — `metrics.ts:19` — is a live defect matching FIX-01).
- **Findings (D-05), 4 recorded:** (1) RECON-01 vs FIX-01 — code supports FIX-01; (2) the automation todo's own 2026-08-24 re-derivation already showed it wasn't fully fixed, contradicting the sweep's framing; (3) `resolves_phase` corrected on the automation todo, 128→129; (4) two `file:line` citation drifts in `128-CONTEXT.md` (a constant name paraphrase, an off-by-one line number) neither of which changed a verdict.
- **Checker scope (deviation Rule 1):** `checks/closed-todos.mjs`'s strict frontmatter check applies only to todos carrying `closed_by:` at all, not literally every file in `completed/` — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Checker spec was unsatisfiable against the live corpus as literally written**
- **Found during:** Task 2 (building `checks/closed-todos.mjs`)
- **Issue:** The plan's action text says the checker must "fail if any [completed file] lacks `status: closed`, `closed:` or `closed_by:`." A first-pass implementation of that literal rule failed against 7 of 12 pre-existing completed todos, which predate this convention and use `status: resolved`, `status: closed-fixed`, `status: closed-accepted-by-design`, or a bare `resolved:` field — 2 of those 7 are even more anomalous, literally reading `status: pending` while sitting in `completed/`. A checker that can never pass against files this plan does not touch would violate the plan's own acceptance criterion ("exits 0 against the tree") and would force either editing 7 out-of-scope files or leaving the checker permanently red.
- **Fix:** Scoped the strict triple check to todos carrying `closed_by:` at all (8 of 15 files: 5 pre-existing that already comply plus this plan's 3 new closures). Legacy entries with no `closed_by:` are left alone except for a non-failing WARN when their `status` is literally `pending` (surfaces the 2 real anomalies without breaking the run). Logged both classes of pre-existing issue to `deferred-items.md` per CLAUDE.md's scope boundary rather than fixing them.
- **Files modified:** `.planning/phases/128-planning-reconciliation/checks/closed-todos.mjs`, `.planning/phases/128-planning-reconciliation/deferred-items.md`
- **Verification:** `node .planning/phases/128-planning-reconciliation/checks/closed-todos.mjs` exits 0, prints 6 (non-zero) citations checked, and mutation-proven in both directions (see below).
- **Committed in:** `0123ad54` (Task 2 commit)

**2. [Rule 1 - Bug] `extractResolutionSection`'s regex silently matched empty string on CRLF files**
- **Found during:** Task 2 (first checker run reported 0 citations checked, which is itself a fail condition)
- **Issue:** `$` under the `/m` flag matches end-of-LINE, not end-of-string. Combined with a lazy `[\s\S]*?` quantifier, the lookahead `(?=\r?\n## |\r?\n# |$)` was satisfied at the very first line boundary (the blank line immediately after the `## Resolution (...)` heading), so the capture group was always `""` on this repo's CRLF-terminated todo files — a defect class this project's own CLAUDE.md already names ("CRLF breaks frontmatter parsers").
- **Fix:** Replaced the `$` alternative with `(?![\s\S])`, which means "no characters remain" regardless of the `/m` flag — true end-of-string.
- **Files modified:** `.planning/phases/128-planning-reconciliation/checks/closed-todos.mjs`
- **Verification:** Re-ran the checker; citation count went from 0 to 6, matching the manual count across the 3 newly-closed todos' Resolution sections.
- **Committed in:** `0123ad54` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in the checker as first specified/implemented)
**Impact on plan:** Both fixes were necessary for the checker to be a real, passing guard rather than either permanently red or silently vacuous. No scope creep — no product code (`convex/`, `src/`) was touched, confirmed by `git status --porcelain -- convex src` returning empty after both commits.

## Mutation Proof (Task 2 acceptance criterion)

Performed against `tool-galaxy-getprojectgraph-timeout.md`'s Resolution-section citation
`convex/graphSnapshots.ts:676-794`:

1. **RED:** Changed the citation to `convex/graphSnapshotsNOPE.ts:676-794` (a path that does not
   exist). Re-ran the checker:
   ```
   FAIL: 1 unresolvable citation(s):
     - tool-galaxy-getprojectgraph-timeout.md: cites "convex/graphSnapshotsNOPE.ts", which does not exist on disk
   ```
   Exit code 1.
2. **Restore:** Re-edited the exact string back to `convex/graphSnapshots.ts:676-794` (no `git
   checkout`, per the plan's instruction — other sessions may have uncommitted work in this
   shared checkout).
3. **GREEN:** Re-ran the checker:
   ```
   [closed-todos] examined 15 completed todo(s); 8 carry closed_by:; 3 closed_by 128-01; 6 citation(s) checked
   [closed-todos] OK
   ```
   Exit code 0.

## Issues Encountered

None beyond the two deviations documented above, both resolved within Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `128-TODO-CLOSURES.md` is available for 128-02..128-05 (seed status reconciliation, carried-forward list dissolution, RECON-04's freshness stamp) to build on, and for any future phase that touches the todo corpus.
- Phase 129 (CodePulse defect sweep, FIX-01..09) inherits two concrete, evidence-backed items: `convex/metrics.ts:19,24`'s unbounded reads (FIX-01, unchanged) and the `/automation` cold-subscription delay investigation (newly assigned here via the `resolves_phase` correction — not previously tracked as a FIX-NN requirement, so a future planner should decide whether it needs its own requirement ID or folds into an existing one).
- No blockers for 128-02 through 128-05 — this plan touched only the five todos named in its `files_modified` plus the two new artifacts, and made no changes to `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, seed files, or any product code.

---
*Phase: 128-planning-reconciliation*
*Completed: 2026-08-27*

## Self-Check: PASSED

All 9 claimed files verified present on disk (`128-TODO-CLOSURES.md`, `checks/closed-todos.mjs`,
`deferred-items.md`, this SUMMARY, and the 5 todo files at their re-derived locations). All 3
task commit hashes (`99b603f0`, `0123ad54`, `92eff790`) verified present in `git log --all`.
