---
phase: 124-shell-information-architecture
verified: 2026-08-21T14:15:00Z
status: passed
resolved: 2026-08-21T18:40:00Z
resolution: |
  Both human_verification items were closed by the operator on 2026-08-21,
  with evidence, after this report was filed. Status moved human_needed ->
  passed by the orchestrator; the human_verification block below is retained
  verbatim as the historical record of what was outstanding, not as an open
  item.

  Item 1 (three unvisited moved routes) -- CLOSED, PASS. The operator supplied
  three screenshots against http://localhost:5181. All three loaded at their
  pre-regroup addresses with breadcrumbs matching D-16's registry lookup
  exactly: /briefings -> "Agents / Briefings" (session list + daily digest
  rendered), /config -> "System / Config" (Core Security Layers rendered),
  /workspace-map -> "Observe / Workspace Map" (radial graph, "53/53 roots
  covered"). Combined with Automation and Tool Galaxy from the original
  checkpoint, all five moved routes are now operator-confirmed. Checklist item
  8 moves PARTIAL -> PASS. A side observation from the same screenshots: the
  per-domain collapse state persisted across navigation (COMMAND closed,
  OBSERVE open on all three), independently corroborating 124-05's
  persistence work.

  Item 2 (Criterion 1 letter vs intent) -- CLOSED, RULED "AMEND". The operator
  ruled explicitly to amend rather than to record a permanent miss. ROADMAP.md
  criterion 1 and REQUIREMENTS.md SHELL-01 were both amended to strike the
  "48px" figure, record the measured 56px, and carry the measurement and the
  plan that authorised it -- the same amendment pattern SHELL-01 already
  carried for D-07's struck Help control at 286c2d51. The deviation is
  recorded as ruled, never rounded up to a pass.

  ONE NEW DEFECT was found while closing these items and is DEFERRED, not
  fixed: a 4px horizontal overflow in the sidebar. Measured live via
  Playwright at 1512x900 after a 3s settle -- <aside> is exactly 232px (D-17
  holds), but its <nav> reports clientWidth 231 / scrollWidth 235 with a
  computed overflow-x of "auto", which is what renders the visible horizontal
  scrollbar. Cause is <Separator className="my-2 mx-3" /> at
  DashboardLayout.tsx:463: the primitive carries data-[orientation=horizontal]
  :w-full, so mx-3 puts its right edge at 235px, 3px past the aside. The
  scrollbar appears because CSS computes overflow-x: visible -> auto once
  overflow-y-auto is set on the same box. NOT caused by this phase --
  `git log -S '<Separator className="my-2 mx-3" />'` attributes it to
  269458ac (Phase 71's nav clustering), with no Phase 124 commit in the
  result set. Frontend-only, no deploy needed, a one-class fix.
score: 3/3 success criteria intent achieved (1 not met AS WRITTEN, deviation ruled); 17/17 D-decisions verified in code
overrides_applied: 0
overrides: []
human_verification:
  - test: "Visit /briefings, /config, and /workspace-map at the same viewport as the rest of the 124-11 checkpoint and confirm each loads at its pre-regroup address with a correct breadcrumb (System / Config expected for /config, per D-16's registry lookup)."
    expected: "All three resolve at their existing URLs with no console error and a breadcrumb matching their new domain (Agents for Briefings, System for Config, Observe for Workspace Map)."
    why_human: "124-CHECKPOINT.md records Success Criterion 3 / checklist item 8 as PARTIAL — the operator visited only Automation and Tool Galaxy of the five moved routes. Briefings, Config, and Workspace Map are explicitly recorded 'NOT VERIFIED BY THE OPERATOR.' The automated golden-fixture test (124-01) proves the route ADDRESS didn't move for all 44 items, but not that the page renders correctly at that address — that gap is exactly what the human checkpoint exists to close, and it wasn't closed for these three."
  - test: "Judge whether the retained min-h-14/flex-wrap header (56px, wrapping to 2 lines under pressure) still reads as 'one calm 3-zone header' given Criterion 1 literally asked for a fixed 48px."
    expected: "A subjective call on whether the deviation (documented below) is acceptable, or whether it should be tracked as an explicit ROADMAP amendment."
    why_human: "This is a value judgment on intent-vs-letter that the orchestrator/human should make explicitly, not something a grep can resolve. See 'Criterion 1' section below for the full evidence."
gaps: []
deferred:
  - truth: "Alert Rules Engine text bunching (D-1), Automation page stat-card/cron 'Invalid expression' failures (D-2), Tool Galaxy Convex timeout (D-3), /inbox 200-row under-count vs. the new sidebar badge (D-4)"
    addressed_in: "A follow-up phase (unscheduled at verification time)"
    evidence: "124-CHECKPOINT.md 'Defect dispositions' section: operator ruling 'close Phase 124, handle them in a follow-up phase' for D-1/D-2/D-3; D-4 (orchestrator-found) given the same disposition. None of the four has commits from this phase touching their owning files (confirmed by `git log --grep=\"(124\" -- <file>` returning 0 for each in 124-CHECKPOINT.md)."
---

# Phase 124: Shell & Information Architecture Verification Report

**Phase Goal:** Every route shares one calm 3-zone header and a 4-domain sidebar — presentation-only, with no route in the app changing address.
**Verified:** 2026-08-21T14:15:00Z
**Status:** passed (was human_needed; both human items closed by the operator 2026-08-21 -- see `resolution` in the frontmatter and `124-HUMAN-UAT.md`)
**Re-verification:** No — initial verification

## Method note

All claims below were re-derived live in this verification pass against the working tree at
commit `1a206cc6` (scoped via `git log --oneline --grep="(124-"`, 43 commits, confirmed not to
include the concurrent Phase 193 `AvatarAura.tsx` work) — not copied from SUMMARY.md prose. Where
a figure below matches a SUMMARY/CHECKPOINT number exactly, that match was itself checked, not
assumed.

## Goal Achievement

### Criterion 1 (mandatory conflict — read this section, not just the table below)

> "A 48px 3-zone header (breadcrumb / command bar / system-chip + E-Stop + overflow menu) renders
> on every route, replacing today's header everywhere."

**NOT MET AS WRITTEN.** The header is **56px** (`min-h-14`), not 48px, and wraps to two lines
under pressure (`flex-wrap gap-y-1`) rather than holding a hard single-row 48px.

Live evidence, `src/layouts/DashboardLayout.tsx:840`:
```
<header className="min-h-14 flex-shrink-0 flex-wrap gap-y-1 ...">
```

This is a **ruled, measured deviation**, not an oversight. D-06 (`124-CONTEXT.md:69-83`) gated the
48px adoption on a live re-measurement of the three zones' combined min-content width against
available width at 375px and 900px, "adopt `h-12` only if it clears with margin." Plan 124-10
performed that re-measurement and it did not clear. I independently re-ran the same measurement in
this verification pass (steady-state, after Convex subscriptions settle — see the flakiness note
below) and reproduced figures in the same range the plan recorded:

```
375px:  sumMinContentWidth=366.203125  vs headerAvailableWidth=327   (39px over)
900px:  sumMinContentWidth=720.8125    vs headerAvailableWidth=620   (101px over)
```

(124-10-SUMMARY's own cited figures were 351.55/706.16 — same order of magnitude, small variance
explained below; both independently confirm "exceeds decisively, not marginally.") A **negative
control** matters here: I also ran the shipped Playwright spec (`e2e/polish-geometry.spec.ts`)
immediately after `page.goto('/')` with no settle time, and it measured a *smaller* sum
(268 at 375px — actually *under* budget; 623.28 at 900px — barely over). This is a **timing race**
in the measurement, not a fact about the shipped header: `SystemChip` and `BrainHeaderBadge`
render `null` until their Convex subscriptions resolve, so a cold measurement undercounts zone 3.
With a 3-second settle (`probe-temp.cjs`, run in this verification and discarded), the figures
converge to the range above and match the checkpoint's cited numbers almost exactly at 375px
(366.203125 both times). **The regression guard the test actually asserts on is
`culprits.length === 0` (no descendant clips past the viewport), not the sum** — so this race does
not affect the test's pass/fail, only how large a margin gets logged on a given run. Recorded as
an INFO-level methodology note, not a gap.

**Intent achieved separately from the letter:** every route shares one shell-owned header with the
three zones the criterion names (breadcrumb, command bar, system-chip+E-Stop+overflow) — confirmed
below (Criterion 1 intent row) and via `DashboardLayout` being the sole layout wrapping all 54
routes in `App.tsx:124`. The number in the criterion (48px) was not met; the outcome the criterion
was chasing (one calm header, not the old ten-control unbounded row) was.

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Criterion 1 (letter): header is a hard 48px | ✗ FAILED (ruled deviation) | `DashboardLayout.tsx:840` — `min-h-14 flex-wrap gap-y-1`, 56px, not 48px. See conflict section above. |
| 2 | Criterion 1 (intent): one shared, calm 3-zone header on every route | ✓ VERIFIED | Single `<Route element={<DashboardLayout />}>` wraps all 54 child routes (`App.tsx:124`); header has breadcrumb (zone 1), command bar (zone 2), system-chip+E-Stop+overflow+brain+bell+usermenu (zone 3) at `DashboardLayout.tsx:855-985`. Right zone reduced from 10 elements to 6 visible + 4-item `⋯` (D-07), live-confirmed: `grep -c "<DropdownMenuItem" DashboardLayout.tsx` = 4. |
| 3 | Criterion 2: 232px sidebar, 4 collapsible domains, count badges, 2px active rail | ✓ VERIFIED | `navGroups` in `src/lib/navRegistry.ts:144-219` has exactly 4 groups (Command 11, Observe 13, Agents 11, System 9 = 44), matching D-01's locked map row-for-row. `w-[232px]` class at `DashboardLayout.tsx:756`. Live Playwright re-run: `asideRect.width === 232` at 900px. Active rail: `activeBeforeWidth: "2px"`, `rgb(6,182,212)` (`--primary`), inactive control shows `"auto"` (no box) — re-confirmed live, not copied. |
| 4 | Criterion 3: route-list diff before/after is identical, no URL moved | ✓ VERIFIED | `src/lib/__tests__/navRegistry.routes.test.ts` asserts `navItems`/`navGroups`-flattened sorted `to` values against a 44-entry `GOLDEN_ROUTE_SET` literal captured pre-regroup; live-run (`npx vitest run`) passes with the negative-control mutation tests (add/remove/rename-`to` all fail; label-only rename does not). Manually diffed `GOLDEN_ROUTE_SET` against the D-01 table's Route column — identical set. **However:** the human half of this criterion (a person walking the app to confirm each moved route renders, not just resolves) is only PARTIAL — see Human Verification below. |
| 5 | D-05: Analytics/Agent Analytics cmdk collision measured and fixed | ✓ VERIFIED | `src/components/CommandPalette.tsx:75` carries explicit `value={\`${item.label} ${to}\`}`; checkpoint's before/after `data-value` repro (`['Analytics','Analytics']` → distinct) is consistent with the shipped code. Live vitest run of `CommandPalette.test.tsx` passes. |
| 6 | D-12: badge/hook honesty (no fabricated zero while loading) | ✓ VERIFIED | `src/hooks/useAlerts.ts:26` — `useAlertCounts()` returns raw `useQuery(...)` result (no `?? {...}` fallback). Both real callers (`AlertBanner.tsx:11`, `Alerts.tsx`) guard on falsy/undefined before arithmetic. |
| 7 | D-13: unbounded `.collect()` on `countBySeverity` bounded; every shell subscription boxed | ⚠ PARTIALLY VERIFIED | `convex/alerts.ts:124-145` — `.take(2000)` + honest `truncated` flag, confirmed live. BUT: `convex/inbox.ts:206-214` (`listHeldUnackedHandler`, consumed at `DashboardLayout.tsx:137`) is a second every-route shell subscription with an **unbounded** `.collect()` — same risk class D-13 exists to close, left open. This is `124-REVIEW.md`'s WR-01, confirmed still live in this verification's own grep (not fixed since review). Contained by its own `SectionErrorBoundary` (the boundary half of D-13 IS applied), so it degrades to a dimmed dot rather than blanking the app — not a Critical, but an open Warning. |
| 8 | D-11: system chip client-side composed, no new backend | ✓ VERIFIED | `SystemChip()` in `DashboardLayout.tsx` reads `useConvexConnectionState()` + `useQuery(api.alerts.countBySeverity)` only; `convex/health.ts` exports no public query (checked live: `grep -n "export const" convex/health.ts` shows only `internalMutation`/`httpAction`). |
| 9 | D-16: breadcrumb derived from registry + 6-route override table | ✓ VERIFIED | `src/lib/breadcrumbs.ts:50-57` — `DETAIL_ROUTE_PARENTS` has exactly the 6 param routes named in D-16 plus `/settings`; exact-match path built from `navGroups`. |
| 10 | D-08: telemetry pill deleted, SYS/LAT relocated not deleted | ✓ VERIFIED | Pill markup absent from current header (only breadcrumb in zone 1); SYS/LAT render inside the `⋯` menu as a non-interactive `DropdownMenuLabel` (`DashboardLayout.tsx:963-984`), gated on the same `showSys`/`showLat` real-or-hidden booleans as before. |

**Score:** 8/10 truths fully VERIFIED, 1 explicitly-ruled deviation (Criterion 1 letter), 1 partial
(D-13/WR-01 open on the sibling query). No truth is a silent FAIL.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `src/lib/navRegistry.ts` | navGroups regrouped, 44 items, 4 domains | ✓ VERIFIED | Matches D-01 table exactly; `tsc --noEmit` clean. |
| `src/lib/__tests__/navRegistry.routes.test.ts` | Golden route-set guard, ≥60 lines, 3-mutation proof | ✓ VERIFIED | 44-entry literal, 4 tests incl. negative controls, all pass live. |
| `src/hooks/useAlerts.ts` | Honest `useAlertCounts()` | ✓ VERIFIED | Raw `useQuery` passthrough. |
| `convex/alerts.ts` | Bounded `countBySeverity` | ✓ VERIFIED | `.take(2000)`, `truncated` flag. |
| `convex/alertsCountBounded.test.ts` | Recording-db proof of the bound | ✓ VERIFIED | Present, exercised in the `npm test` full run (350/367 files pass). |
| `src/layouts/DashboardLayout.tsx` | 4 domains, 232px, badges, boundaries, overflow menu, chip, breadcrumb | ✓ VERIFIED | All sub-features individually confirmed above. |
| `src/layouts/__tests__/DashboardLayout.test.tsx` | 232px, 4-domain, aria-current, persistence assertions | ✓ VERIFIED | All four assertion classes present at the cited line numbers; 4 unrelated `test.todo` stubs remain (icons, count-query-generic badge, collapsed tooltip, collapsed aria-label) — pre-existing scope exclusions, not silent gaps. |
| `e2e/polish-geometry.spec.ts` | Header min-content, 232px, rail, E-Stop measurements | ✓ VERIFIED | 10/10 pass live in this verification; see Criterion 1 section for the sum-figure timing caveat (does not affect pass/fail). |
| `.../124-CHECKPOINT.md` | Operator verdict recorded | ✓ VERIFIED (partial content) | Present; item 8 explicitly PARTIAL per the operator's own limited route coverage. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `navRegistry.routes.test.ts` | `navRegistry.ts` | `import { navGroups, navItems }` | ✓ WIRED | Confirmed by live test run. |
| `DashboardLayout.tsx` | `navRegistry.ts` | `navGroups.map` into `NavGroup` | ✓ WIRED | Sidebar renders 4 `NavGroup` instances from `navGroups`. |
| `DashboardLayout.tsx` | `convex/inbox.ts` | `useQuery(api.inbox.listHeldUnacked)` | ✓ WIRED (but unbounded upstream — see truth 7) | Single consumer, confirmed by grep. |
| `DashboardLayout.tsx` | `convex/alerts.ts` | `useQuery(api.alerts.countBySeverity)` | ✓ WIRED | Shared subscription across `AlertsCountBadge` and `SystemChip` (Convex dedupes client-side). |
| `AlertBanner.tsx` / `Alerts.tsx` | `useAlerts.ts` | `useAlertCounts()` | ✓ WIRED | Both guard on the raw undefined/null before arithmetic. |
| `DashboardLayout.tsx` | `breadcrumbs.ts` | `getBreadcrumbTrail(pathname)` | ✓ WIRED | Zone 1 renders the returned trail; empty trail renders nothing. |
| `CommandPalette.tsx` | `navRegistry.ts` | `navItems.map` | ✓ WIRED | Palette route set is the same flat, deduped list the golden fixture guards. |

### Behavioral Spot-Checks (live re-runs performed in this verification, not copied)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Type check clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| Full unit/component suite | `npm test -- --run` | 350 passed \| 17 skipped (367) files; 4938 passed \| 195 todo (5133) tests | ✓ PASS (matches CHECKPOINT exactly) |
| Geometry gates | `playwright test e2e/polish-geometry.spec.ts` | 10 passed | ✓ PASS |
| Accessibility matrix (20 criterion cells) | `playwright test e2e/theme-contrast.spec.ts` | 21 passed, 0 violations at every cell | ✓ PASS (re-run live, matches CHECKPOINT) |
| Targeted phase-touched suites | `vitest run` on DashboardLayout/breadcrumbs/navRegistry/CommandPalette/AlertBanner/alertsCountBounded tests | 6 files, 74 passed \| 4 todo (78) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| SHELL-01 | 124-02, 03, 07, 08, 09, 10, 11 | 3-zone header | ✓ SATISFIED (intent) / letter deviation ruled | See Criterion 1 discussion. `REQUIREMENTS.md:51` already carries the 2026-08-21 amendment striking Help from scope, matching the shipped code. |
| SHELL-02 | 124-01, 02, 03, 04, 05, 06, 10, 11 | 4-domain sidebar regroup, no route change | ✓ SATISFIED | Golden fixture + live code match; D-13's second half (WR-01) is the one open loose end, tracked as a Warning not a blocker of this requirement's own text (which is about the sidebar regroup, not query bounding). |

No orphaned requirements: `.planning/REQUIREMENTS.md:123-124` maps only SHELL-01/SHELL-02 to Phase 124, and both appear in plan frontmatter (`requirements:` fields, cross-checked against all 11 `*-PLAN.md` files). Both rows currently read "Pending" in REQUIREMENTS.md — that is the orchestrator's field to update, not touched here.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `convex/inbox.ts` | 206-214 | Unbounded `.collect()` on an every-route client subscription | ⚠️ Warning (carried from `124-REVIEW.md` WR-01, independently re-confirmed live here) | Same DoS/timeout shape as the `graphSnapshots:getProjectGraph` failure this checkpoint's own D-3 finding shows already happening in this codebase (4,096-read Convex ceiling). Contained by a `SectionErrorBoundary` fallback, so failure mode is a dimmed dot, not a blanked app. |
| — | — | No debt markers (`TBD`/`FIXME`/`XXX`) found in phase-touched files | — | `grep -rn "TBD\|FIXME\|XXX" <phase-touched files>` returns 0. |

### Human Verification Required

### 1. Confirm the three unvisited moved routes actually render

**Test:** Visit `/briefings`, `/config`, and `/workspace-map` (same viewport class as the rest of the 124-11 checkpoint) and confirm each loads at its existing address with a correct breadcrumb.
**Expected:** All three resolve with no console error; breadcrumbs read "Agents / Briefings", "System / Config", "Observe / Workspace Map" respectively.
**Why human:** `124-CHECKPOINT.md` records item 8 as PARTIAL — only Automation and Tool Galaxy were operator-visited. The automated golden-fixture test proves the URL didn't move for these three, not that the page renders. This is exactly the gap the human checkpoint exists to close, and per the phase's own record it wasn't closed for these three.

### 2. Rule on the Criterion 1 letter-vs-intent deviation

**Test:** Review the D-06 measurement evidence (reproduced independently in this verification) and decide whether the shipped 56px wrapping header satisfies Phase 124's intent well enough to close the phase as-is, or whether ROADMAP.md's Criterion 1 text should be formally amended (the way SHELL-01's REQUIREMENTS.md row was already amended for the Help-control strike).
**Expected:** An explicit decision, recorded in ROADMAP.md or a phase note, rather than the criterion silently reading "done" while the shipped number contradicts it.
**Why human:** This is the orchestrator's call, not a grep — the underlying facts (48px asked for, 56px shipped, wrap-branch load-bearing per two independent measurements) are settled and are not in dispute.

### Gaps Summary

No BLOCKER-level gaps. One ruled, evidence-backed deviation (Criterion 1's 48px vs. shipped 56px)
and one open Warning inherited from code review (D-13's second half, `listHeldUnacked` still
unbounded) are the only defects that survive to this report; both are disclosed with file:line
evidence above rather than silently absorbed. Item 8 of the operator checkpoint (three of five
moved routes never visited) is the reason this report cannot resolve to `passed` — it is a real,
disclosed coverage gap in the phase's OWN verification process, not a code defect. Four page-body
defects (Alert Rules Engine bunching, Automation stat cards/cron parsing, Tool Galaxy timeout,
Inbox 200-row undercount) were found, are NOT caused by this phase (0 commits from `(124-` touch
their owning files, confirmed in `124-CHECKPOINT.md`), and were explicitly deferred by operator
ruling — carried forward here as `deferred`, not `gaps`.

---

*Verified: 2026-08-21T14:15:00Z*
*Verifier: Claude (gsd-verifier)*
