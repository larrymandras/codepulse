---
phase: 111-mission-board
reviewed: 2026-08-11T14:13:33Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/components/JobsPanel.tsx
  - src/components/JobsPanel.test.tsx
  - src/pages/LiveRun.tsx
  - src/pages/Chat.tsx
  - src/pages/Chat.test.tsx
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: resolved
resolved: 2026-08-11T14:22:00Z
resolved_by: orchestrator (execute-phase 111 code_review_gate)
---

# Phase 111: Code Review Report

**Reviewed:** 2026-08-11T14:13:33Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** resolved — both warnings fixed and mutation-proven (see Resolution below)

## Summary

Reviewed the mission-board subtraction (111-01: `JobsPanel` rewrite; 111-02: `ActiveAgentsPanel`
deletion) against `111-CONTEXT.md` and both plan files. The production code is sound: `formatElapsed`'s
s/m/h/d tier ladder was traced by hand against the actual boundary arithmetic (`floor(floor(floor(s/60)/60)/24)
= floor(s/86400)` holds for positive integers, so the nested-floor tier computation introduces no
precision-loss bug), the seconds-epoch guard (`ref < 1e12 ? ref * 1000 : ref`) is preserved verbatim,
the `stateIcon` map has exactly the three prescribed keys with no `unknown`/`queued`/`running` additions,
`Zap` was correctly dropped from the import block, and every "removed" string (`live-query-driven`,
`no ms conversion needed`, `BACKGROUND JOBS`, `polling`) is confirmed absent by direct grep. The
`ActiveAgentsPanel` deletion (111-02) is complete and clean: `git ls-files` confirms both files are
staged as deletions (not merely untracked-absent), a whole-tree grep for `ActiveAgentsPanel` /
`Active Agent` / `agent-tile` returns zero hits anywhere in `src/`, the `cc-left-rail` comment was
correctly generalized rather than left dangling, and `Chat.test.tsx`'s label constant/titles were
renamed and repaired consistently (verified: `tsc --noEmit` exits 0, both target test files pass
51/51). The `stateIcon[job.status] ?? <Clock ...>` prototype-chain risk is the already-accepted,
already-seeded T-111-02 and is correctly left untouched per UI-SPEC — not re-reported here.

The two findings below are both in `JobsPanel.test.tsx`: real coverage gaps against the surface's
own stated must-haves, not production-code defects. Both are provable by inspection (grep/analysis)
without needing to mutate the tracked source file.

## Warnings

### WR-01: The "hours" tier of `formatElapsed` has zero test coverage, and the day-tier test cannot detect an hour-threshold regression

**File:** `src/components/JobsPanel.test.tsx` (whole file — no test constructs an hour-range fixture)
**Issue:** `formatElapsed` (`JobsPanel.tsx:44-57`) has four branches: sub-minute, minute, **hour**,
and day. The test file exercises only three: `finished moments ago` (10s), `finished 5m ago` (300s),
and `finished 34d ago` (34×86400s). No fixture falls in the `h < 24` branch's active range
(3600s–86399s), so the string `finished {h}h ago` is never asserted anywhere in the suite.

This is not merely an untested branch — the specific boundary (`h < 24`, `JobsPanel.tsx:55`) can
regress silently because the day-tier test's fixture (34 days → `h = 816`) is far outside the range
where a broken threshold would matter. If the `24` in `if (h < 24)` were mistyped as e.g. `240`, every
row from 1 to 9 days old would incorrectly render as `"finished {h}h ago"` (e.g. `"finished 120h ago"`
for a 5-day-old row) instead of transitioning to the day tier — a real, user-visible regression of
exactly the kind D-09 exists to prevent (a three-digit-hour value reaching the UI). But the existing
day-tier test would still pass unchanged: `h = 816` is `< 240` is false either way, so the 34-day
fixture routes to the day branch regardless of what the hour threshold is, and the test's own negative
assertion (`not.toMatch(/finished \d{3,}h ago/)`) also stays satisfied since the day branch was still
taken. The suite would go fully green on a broken `h`-tier boundary.
**Confidence:** High — verified by tracing the exact fixture value (`h=816`) against the mutated
threshold (`h < 240`) and confirming both the positive (`finished 34d ago`) and negative
(`not /\d{3,}h ago/`) assertions are unaffected either way.
**Fix:** Add a fixture in the hour range, e.g. `makeRow("j-hour", "completed", 3 * 3600)` asserting
`finished 3h ago`, mirroring the existing minute-tier test:
```tsx
it("renders 'finished 3h ago' for a row finished 3 hours ago", () => {
  mockUseSubagentJobs.mockReturnValue([makeRow("j-hour", "completed", 3 * 3600)]);
  render(<JobsPanel />);
  expect(screen.getByText("finished 3h ago")).toBeInTheDocument();
});
```

### WR-02: The unmapped-status tests never assert on the Clock fallback icon itself — only on the badge and two narrow negative selectors

**File:** `src/components/JobsPanel.test.tsx:110-143`
**Issue:** The 111-01-PLAN.md must-have states: "An unmapped status ... renders as **the muted Clock
icon** and an UNKNOWN badge in the idle style." The `"unknown"` test (lines 110-127) only asserts on
the `StatusBadge` (`UNKNOWN` text + `bg-muted` class) — it never checks the icon at all. The word
`Clock` appears exactly once in the whole test file, and only inside a comment (line 131), never as
an assertion target; the fallback icon's actual class, `text-muted-foreground/50` (`JobsPanel.tsx:96`),
is asserted nowhere in the test file (confirmed by direct grep).

The `"running"` removed-affordance test (lines 129-143) is the one that most needs this: its two
assertions — `.animate-pulse` absent and `.text-\(--status-ok\)` absent — are decorative against the
actual regression this test's own comment names ("it must fall through to the same muted Clock
default ... with no colored/live-looking substitute"). Neither assertion would fire if a future edit
reintroduced a `running:` key in `stateIcon` with any icon that isn't literally styled with the
`--status-ok` CSS variable and doesn't use `animate-pulse` — e.g. `running: <Zap className="h-3.5
w-3.5 text-primary" />` or `text-yellow-400` would satisfy both existing assertions while directly
violating D-08 (a colored, plausible-looking icon reappearing for a state the emitter never sends).
**Confidence:** High — confirmed by grep that `text-muted-foreground/50` and `Clock` never appear as
assertion targets in the test file, and by inspection that `--status-ok` is not used by any icon in
`JobsPanel.tsx` today (not even for `completed`), so the negative selector is unrelated to what a
realistic regression would look like.
**Fix:** Assert on the actual fallback icon's class (or a `data-testid` if one is added to the icon
wrapper) rather than an unrelated CSS variable:
```tsx
// after rendering the "unknown"/"running" row:
const icon = container.querySelector('svg.text-muted-foreground\\/50');
expect(icon).toBeInTheDocument();
```
This directly constrains "falls through to the muted Clock default" instead of the current proxy
checks, which a colored-icon regression can pass straight through.

---

## What I dropped, and why

- **`stateIcon` typed `Record<string, React.ReactNode>` with no `React` import** — flagged and
  dropped: `EntityRow.tsx` and `BlackboardPanel.tsx` use the identical pattern under this repo's
  `"jsx": "react-jsx"` tsconfig, and `npx tsc --noEmit` exits 0. Established convention, not a defect.
- **`StatusBadge`'s `legacyMap.running` still resolving to a colored `warn`/`RUNNING` badge** —
  considered, dropped: `StatusBadge.tsx` is explicitly locked read-only for this phase per both plans'
  `<interfaces>` sections, and per the phase's own evidence (`runtimeIngest.ts:594-596`) a `running`
  row structurally cannot reach this table in production, so the badge-color gap has no live impact
  and is not a defect introduced by 111-01/111-02.
- **`stateIcon[job.status] ?? <Clock ...>` prototype-chain lookup (`toString`/`constructor` bypass)** —
  explicitly in scope-of-review per the task's own instructions as an already-accepted, already-seeded
  risk (T-111-02, carried into SEED-007 item 5); not re-reported as a new finding, per instruction.
- **`Chat.test.tsx:762` comment line-wrap** (`IntelligenceFeedPanel/` now alone on its own line after
  `ActiveAgentsPanel/` was removed) — cosmetic only, reads correctly as a continued list; a style
  preference, not a defect, per the review's own scope rules.

---

_Reviewed: 2026-08-11T14:13:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Resolution — both warnings fixed 2026-08-11

Fixed in the same session that ran the review, rather than deferred to a follow-up. Both
findings were independently re-verified against the live file before being acted on (a
reviewer's finding is a claim, not evidence):

- **WR-01 confirmed real.** The only hours-related line in `JobsPanel.test.tsx` was the
  *negative* `expect(container.textContent).not.toMatch(/finished \d{3,}h ago/)`. No test
  asserted a positive hours-tier value anywhere in the file.
- **WR-02 confirmed real.** `Clock` and `text-muted-foreground/50` appeared nowhere in the
  test file except inside a comment.

### What was added (`src/components/JobsPanel.test.tsx`, 8 → 12 tests)

WR-01 — three tests over the hours tier and the day boundary:
- `finished 3h ago` for a 3-hour-old row (positive coverage for the `h < 24` branch)
- `finished 23h ago` at the top of the hours tier
- **`finished 1d ago` at 25 hours** — the boundary case, and the one that actually kills the
  mutant. A 3-hour or 23-hour fixture renders identically whether the threshold is `h < 24`
  or `h < 240`; only a value in the 24–240h window discriminates.

WR-02 — icon-level assertions plus a discriminating control:
- the `unknown`-status test now asserts exactly one `[class*="text-muted-foreground/50"]`
  element (the muted `Clock` fallback), not just the `StatusBadge`
- the `running`-status test asserts the same positive — it must *render the fallback*, not
  merely fail to render a live-looking icon
- a new control test asserts a **mapped** status (`completed` → `CheckCircle`,
  `text-primary/80`) matches that selector **zero** times. Without this control a selector
  that matched everything, or nothing, would satisfy both assertions above and prove
  neither.

### Mutation controls — both run, both observed RED, source restored

| Mutation | Expected | Observed |
|---|---|---|
| `if (h < 24)` → `if (h < 240)` in `formatElapsed` | day-boundary test fails | **RED — 1 failed \| 11 passed.** The single failure was the new 25-hour test; the pre-existing 34-day test (h=816) stayed GREEN, which is exactly WR-01's point — 816 is outside the corrupted window, so the old test could never have caught this. |
| re-add `unknown: <Ban className="… text-yellow-400" />` to `stateIcon` (a direct D-08 violation) | unmapped-status test fails | **RED — 1 failed \| 11 passed.** |

After both mutations `src/components/JobsPanel.tsx` was restored and proven byte-identical to
HEAD via `git diff --quiet src/components/JobsPanel.tsx` (exit 0). No production code changed
as part of this resolution — the fix is test coverage only.

`npx vitest run src/components/JobsPanel.test.tsx` → 12 passed. `npx tsc --noEmit` → exit 0.
