---
phase: 124-shell-information-architecture
plan: 04
subsystem: ui
tags: [navRegistry, cmdk, command-palette, sidebar, information-architecture]

# Dependency graph
requires:
  - phase: 124-01
    provides: "GOLDEN_ROUTE_SET fixture and route-set guard (navRegistry.routes.test.ts) — the criterion-3 acceptance mechanism this plan's Task 2 must pass unmodified"
provides:
  - "navGroups rewritten from 5 UPPERCASE groups (COMMAND/GRAPHS/AGENTS/OBSERVE/ACTIVITY) into 4 sentence-case domains (Command/Observe/Agents/System), all 44 items, zero `to` changes"
  - "D-05's duplicate 'Analytics' label disambiguated (/hr/analytics -> 'Agent Analytics')"
  - "D-05's cmdk value-collision claim measured live, found real, and fixed with an explicit `value` prop on the Pages CommandItem"
affects: [124-05, 124-06, 124-07, 124-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cmdk CommandItem: always set an explicit `value` prop composed from stable, unique fields (label + route) rather than relying on cmdk's derive-from-rendered-text fallback, which collides silently on duplicate labels."
    - "Deriving expected test counts from the live registry/data source instead of hardcoding a literal, so a regression-guard test stays correct across the exact code change it is guarding."

key-files:
  created: []
  modified:
    - src/lib/navRegistry.ts
    - src/components/CommandPalette.tsx
    - src/components/__tests__/CommandPalette.test.tsx

key-decisions:
  - "D-05's palette rider was resolved on measured evidence: the collision was real (both /analytics and /hr/analytics rendered data-value=\"Analytics\" pre-rename), so the Pages CommandItem now sets an explicit value, not just the rename."
  - "Corrected a false premise in the plan's own Task 1 text: a hardcoded `expect(dupItems.length).toBe(2)` cannot 'go green' after the D-05 rename (RTL's getAllByText is an exact-text matcher), so the expected count is now derived live from navRegistry instead of hardcoded."

patterns-established:
  - "cmdk CommandItem value composition: `${item.label} ${item.to}` — mirrors the Links group's existing `${l.title} ${l.url}` defense."

requirements-completed: [SHELL-02]

# Metrics
duration: ~25min
completed: 2026-08-21
---

# Phase 124 Plan 04: Sidebar Regroup + cmdk Value-Collision Fix Summary

**Rewrote `navGroups` from 5 UPPERCASE groups into 4 locked sentence-case domains (Command/Observe/Agents/System, 44 items, zero route changes), disambiguated the registry's one duplicate label ("Analytics" -> "Agent Analytics"), and fixed a measured cmdk value collision on the Pages command-palette group.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 3 (`src/lib/navRegistry.ts`, `src/components/CommandPalette.tsx`, `src/components/__tests__/CommandPalette.test.tsx`)

## Accomplishments

- `navGroups` now holds exactly 4 domains — Command (11), Observe (13), Agents (11), System (9) = 44 — transcribed verbatim from `124-CONTEXT.md`'s locked `<the_44_row_map>`. No `to` value changed anywhere; the golden-fixture guard (`navRegistry.routes.test.ts`) passes with its fixture byte-identical to before this plan touched anything.
- D-05's duplicate `"Analytics"` label (shared by `/analytics` and `/hr/analytics`, the only duplicate in the registry) is disambiguated: `/hr/analytics` now reads `"Agent Analytics"`.
- D-05's Rider — the claim that cmdk's Pages `CommandItem` (no explicit `value` prop) would collide on the two identically-labelled "Analytics" entries — was **measured, not assumed**, both before and after the rename, and the palette was fixed on that measured evidence.

## Task Commits

Each task was committed atomically:

1. **Task 1: MEASURE the cmdk value collision BEFORE the rename** - `db328c70` (test)
2. **Task 2: Rewrite navGroups into the 4 locked domains** - `892683b6` (feat) — includes a necessary same-commit correction to the Task 1 test (see Deviations)
3. **Task 3: Close the palette half honestly** - `8b91b0b3` (fix)

_No separate plan-metadata commit was made for this SUMMARY — the orchestrator/team-lead owns STATE.md/ROADMAP.md updates per this plan's dispatch instructions; this SUMMARY.md is committed on its own (see below)._

## Files Created/Modified

- `src/lib/navRegistry.ts` - `navGroups` rewritten into 4 sentence-case domains (Command/Observe/Agents/System); `/hr/analytics` relabelled "Agent Analytics"; Loom's stale "design doc places it in GRAPHS" comment rewritten for its new Observe home; the already-stale "Phase 71 IA refactor — 6 clusters" header comment replaced with one recording this regroup. `iconComponents`, the Lucide imports, `NavItem`/`NavGroupConfig`, the dead-`placeholder` comment block, and the `navItems` dedup IIFE were all left untouched, as required.
- `src/components/CommandPalette.tsx` - Pages group's `CommandItem` now sets an explicit `value={`${item.label} ${to}`}`, matching the Links group's existing defense against the same defect class.
- `src/components/__tests__/CommandPalette.test.tsx` - New test measures the D-05 collision against the live registry (see below); imports `navItems` from the real (unmocked) `navRegistry`.

## D-05 Measurement (raw, verbatim, per the Rider)

**Task 1 — pre-rename, against the then-live registry:**
- `getAllByText("Analytics")` returned **2** elements (assertion (a) held — no registry drift).
- Both elements' nearest `[data-value]` ancestor read: **`data-value="Analytics"`** for *both* — i.e. the raw observed pair was `['Analytics', 'Analytics']`.
- Verdict: **defect reproduced.** Both `/analytics` and `/hr/analytics` resolved to the identical cmdk selection key.

**Test run output (Task 1, pre-fix):**
```
stdout | ... > D-05: two Pages entries sharing the label 'Analytics' — cmdk value collision measurement
D-05 measurement — Analytics data-value pair: [ 'Analytics', 'Analytics' ]

 FAIL  ... AssertionError: expected 1 to be 2   <- this is assertion (b): new Set(values).size (1) !== values.length (2)
```

**Task 2 — post-rename, after the label change landed:**
- `getAllByText("Analytics")` now returns **1** (only `/analytics` still literally reads "Analytics"; `/hr/analytics` reads "Agent Analytics").
- A single-element set trivially satisfies uniqueness — no collision remains for this pair.

**Branch taken in Task 3:** collision was reproduced pre-rename, so per the plan's explicit instruction the palette itself is fixed, not just the label. Added `value={`${item.label} ${to}`}` to the Pages `CommandItem` (`src/components/CommandPalette.tsx:75`) as defense-in-depth against any *future* duplicate label — this is the "underlying shape survives" branch, not a fix for something never observed failing.

## Decisions Made

- **D-05's palette half was resolved on measured evidence, per the Rider's explicit requirement.** The collision was real; Task 3 added the explicit `value` prop rather than declaring the rename sufficient.
- **Group string casing:** stored as sentence case (`"Command"` not `"COMMAND"`) per the plan's explicit instruction — the breadcrumb (a later plan) reads this string directly, and the sidebar's eyebrow header already applies CSS `uppercase` (confirmed live, see Verification below), so no visual regression occurs from this data-only change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a false premise in the plan's own Task 1 test instructions**
- **Found during:** Task 2, re-running `CommandPalette.test.tsx` per the task's own verify step
- **Issue:** The plan's Task 1 action instructs writing `expect(dupItems.length).toBe(2)` against `screen.getAllByText("Analytics")`, and states "it will go green in Task 2 once the labels differ." This is a false premise: React Testing Library's `getAllByText` uses an **exact** text matcher by default, so once `/hr/analytics` is renamed to `"Agent Analytics"`, `getAllByText("Analytics")` legitimately returns **1**, not 2 — the hardcoded `toBe(2)` fails-by-construction immediately after the very rename it was meant to validate as safe. Confirmed live: re-running the test post-rename produced `AssertionError: expected 1 to be 2`.
- **Fix:** Changed the expected count from a hardcoded literal to one derived from the live registry: `const expectedCount = navItems.filter((i) => i.label === "Analytics").length;`. This keeps the same test correct in both states — 2 pre-rename (measuring the real collision, already captured/committed in Task 1), 1 post-rename (trivially passing, since a single-element set has no possible collision). Added an `import { navItems } from "@/lib/navRegistry";` to the test file to support this.
- **Files modified:** `src/components/__tests__/CommandPalette.test.tsx`
- **Verification:** `npx vitest run src/components/__tests__/CommandPalette.test.tsx` — 15/15 green after the fix.
- **Committed in:** `892683b6` (Task 2 commit — the test correction was necessary for Task 2's own verify step to pass, so it rode in the same commit as the `navRegistry.ts` regroup, with the correction explicitly called out in the commit message).

**2. [Rule 1 - Bug] Two acceptance-criterion greps were self-defeated by my own explanatory comments**
- **Found during:** Task 2 and Task 3, running the plan's literal acceptance-criterion grep commands
- **Issue:** `grep -c "Agent Analytics" src/lib/navRegistry.ts` returned 2 instead of the required 1, because my own explanatory comment above the `/analytics` item also spelled out the literal string "Agent Analytics". Separately in Task 3, `grep -c "value=" src/components/CommandPalette.tsx` returned 3 instead of the required baseline+1=2, because my own comment contained the substring `data-value="Analytics"`, which matches `value=`.
- **Fix:** Reworded both comments to describe the same facts without embedding the literal grep-matched substrings (e.g. "the rename below" instead of spelling "Agent Analytics"; "resolved to the identical cmdk selection key" instead of "data-value=...").
- **Files modified:** `src/lib/navRegistry.ts`, `src/components/CommandPalette.tsx`
- **Verification:** Both greps re-run and confirmed at their required values (1 and 2 respectively) before committing.
- **Committed in:** `892683b6` (navRegistry.ts wording), `8b91b0b3` (CommandPalette.tsx wording) — folded into each task's single commit, not separate fix-up commits, since the corrected wording was never itself committed in a broken state.

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs found and fixed inline before their task's commit)
**Impact on plan:** Both were caught by literally running the plan's own acceptance criteria before committing, and fixed in the same commit as the task that introduced them. No scope creep; no change to the substantive design.

## Issues Encountered

None beyond the two deviations above.

## Consumer Enumeration (success criterion: every consumer of `navGroups`/`navItems`/`iconComponents` confirmed safe)

Grepped `src/` for all three identifiers. Full hit list:

| File:Line | Consumes | Status |
|---|---|---|
| `src/pages/Bifrost.tsx:39,99` | `iconComponents` only | Safe — icon keys unchanged, no route/group dependency |
| `src/layouts/DashboardLayout.tsx:52,55,99,228,230,233` | `navGroups`, `iconComponents` (via `NavGroup`/`SidebarContent`) | Safe, confirmed live: `NavGroup` (`:91`) renders `grp.group` inside a `<p className="... uppercase ...">` — CSS already forces uppercase display regardless of the underlying string's casing, so the sentence-case data change (`"COMMAND"` -> `"Command"`) produces **zero visual change**. The component maps over `navGroups` generically (`.map((grp, i) => ...)`), so 5 groups -> 4 groups is handled without code changes — one fewer `<div>`/`<Separator>` renders, which is the correct, expected consequence of this data change. **Out-of-scope observation, not fixed here:** `DashboardLayout.tsx:228`'s comment ("Phase 71 IA: 6 clusters from navGroups config") was already stale before this phase (5 groups, not 6) and is now further stale (4 domains) — `DashboardLayout.tsx` is not in this plan's `files_modified` list, so left alone for whichever later plan in this phase rewrites the sidebar's visual chrome. |
| `src/lib/navRegistry.ts:59,144,228,231` | Defines all three | This plan's own edit target |
| `src/components/CommandPalette.tsx:32,59-72` | `navItems`, `iconComponents` | Safe by design (F2 pattern) — confirmed via full test suite green, including the new D-05 test |
| `src/lib/__tests__/navRegistry.routes.test.ts:21,82-114` | `navGroups`, `navItems` | The golden-fixture guard itself — confirmed diff-empty and green throughout |
| `src/components/__tests__/CommandPalette.test.tsx:75,193` | `navItems` | Added this plan (Task 1/2), safe — described above |
| `src/components/loom/LoomStepNode.tsx:12,25` | `iconComponents` only | Safe — icon keys unchanged |

No other consumers found. `src/components/skills/__tests__/CategoryGrid.test.tsx`'s `navItems` is an unrelated local variable name (test-only DOM query result), not an import of this registry — confirmed by reading the grep hit, not assumed.

## Verification

**Golden-fixture guard, unedited:**
```
$ git diff -- src/lib/__tests__/navRegistry.routes.test.ts
<empty output — 0 lines>
```

**Golden-fixture guard, green:**
```
$ npx vitest run src/lib/__tests__/navRegistry.routes.test.ts src/components/__tests__/CommandPalette.test.tsx
 Test Files  2 passed (2)
      Tests  19 passed (19)
```

**Typecheck:**
```
$ npx tsc --noEmit
(exit 0, no output)
```

**Full suite (`npm test`), run at the end of the plan per the plan's own `<verification>` requirement:**
```
 Test Files  349 passed | 17 skipped (366)
      Tests  4901 passed | 197 todo (5098)
```
0 failures. The 17 skipped files and 197 todo tests are pre-existing and unrelated to this plan (confirmed: none are in `navRegistry`, `CommandPalette`, or `DashboardLayout` test files). Console noise about `HTMLCanvasElement.getContext` and `ResizeObserver loop` is pre-existing jsdom/canvas-mock chatter from unrelated graph/visualization test files, not a failure.

## Shared-Checkout Notes

Per `<shared_checkout_rules>`: ran `git diff --cached --name-only` before every commit and `git show --stat HEAD` after every commit. All three commits contained exactly their intended files — no sweep-in from the concurrent voice-avatar session (which landed `test(193-01)` and `feat(193-01)` commits interleaved before and, per `git log`, presumably after this plan's work). `src/components/voice/` was never touched.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `navGroups` is now the 4-domain shape the rest of Phase 124's plans (sidebar rendering, breadcrumb, header) can build against.
- `DashboardLayout.tsx`'s sidebar rendering is unmodified and still visually correct against the new data (uppercase CSS already normalizes the casing change) — whichever later plan rewrites the sidebar's visual chrome (per D-14/D-15/D-17's per-domain collapse work) starts from a working, tested 4-domain registry.
- No blockers identified for downstream plans.

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
