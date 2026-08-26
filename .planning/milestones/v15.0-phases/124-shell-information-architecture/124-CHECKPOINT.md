---
phase: 124-shell-information-architecture
plan: 11
title: Evidence pack and operator checkpoint for the assembled Borealis shell
status: Task 1 complete (evidence pack assembled, gates re-run green). Task 2 (operator checkpoint) NOT YET RUN.
---

# 124 Checkpoint — Evidence Pack and Operator Visual Verdict

This document is written by an automated executor (Task 1). It reports measured evidence only —
every number below is cited to the plan that measured it and was **re-run live** during this task,
not copied from a SUMMARY without verification. Where a citation says "re-confirmed live," the
number matches the cited SUMMARY's own figure exactly; no drift was found.

## Dev server

**Started:** `VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`, issued from **Git Bash** (PS 5.1
deletes an empty-string env var assignment, per `package.json`'s `test:e2e:noauth:help` recipe —
never issue this from PowerShell). This runs `vite --port 5181 --strictPort --host 127.0.0.1`
(Clerk auth gate disabled).

**Probed both loopback names, both 200, quoted:**

```
$ curl -s -o /dev/null -w "localhost:%{http_code}\n" http://localhost:5181/
localhost:200
$ curl -s -o /dev/null -w "127.0.0.1:%{http_code}\n" http://127.0.0.1:5181/
127.0.0.1:200
```

**Operator: use `http://localhost:5181` (or `http://127.0.0.1:5181`).** This server was left
running for your pass — do not stop it, and it will be stopped after your checkpoint closes, per
T-124-11-01. Ctrl+K, badges, and every other query in this checkpoint are live against the real
self-hosted Convex backend (no mocked data).

**Disclosure — a second, pre-existing server was already running on `:5173` before this task
started** (confirmed via `netstat`, PID 18552, several established connections — not started by
this executor). It answers `200` at `http://localhost:5173/` and appears to be an ordinary
`npm run dev` session. Its Clerk-configuration status was **not checked** — this executor does not
read `.env`/`.env.local` files under any circumstance. If that session belongs to you and is
Clerk-configured, the plan's own threat model prefers it ("Prefer the normal `npm run dev` for the
operator's pass if the Clerk key is available") — use whichever you already have open. The `:5181`
server above is the one this checkpoint's own gate runs (below) were verified against, so it is
guaranteed current.

## What shipped for D-06 (header height)

**The wrap branch stayed. `h-12` was NOT adopted.** `min-h-14 flex-wrap gap-y-1` is exactly what
120-07 originally shipped, unchanged by this phase. Re-measured live in this task (not copied):

```
$ PW_BASE_URL=http://localhost:5181 node_modules/.bin/playwright test e2e/polish-geometry.spec.ts --reporter=list
HEADER-ZONES-EVIDENCE 375px: sumMinContentWidth=366.203125, headerAvailableWidth=327, culprits:[]
HEADER-ZONES-EVIDENCE 900px: sumMinContentWidth=789.859375, headerAvailableWidth=620, culprits:[]
10 passed (4.9s)
```

Both figures match `124-10-SUMMARY.md`'s final post-E-Stop-change numbers exactly (789.859375 at
900px, and 366.20 at 375px from that plan's Task 3 full-suite re-run) — no drift since 124-10
landed. The sum exceeds available width at both required viewports (169.86px over at 900px, 39.2px
over at 375px) — decisively, not marginally. The permanent regression guard is a header-scoped
"no descendant clips past `window.innerWidth`" walk (`culprits: []` above), because the plan's
literal "sum stays under available width" guard is structurally unpassable while wrapping is
required — asserting it would assert a known-false fact. (`124-10-SUMMARY.md`, Task 1 and Task 3.)

## The `⋯` menu's exact contents

**Four items: theme, privacy, CRT, ambient audio. No Help.** Re-confirmed live in this task:

```
$ grep -c "<DropdownMenuItem" src/layouts/DashboardLayout.tsx
4
$ grep -niE "help" src/layouts/DashboardLayout.tsx | grep -v "helpers\|helper"
0 matches
```

The Help entry was **deliberately deferred**, not omitted by oversight — see "What was
deliberately left out" below.

**The nested `ThemeSwitcher` `Select` worked inside a `DropdownMenuItem` — verified live via a
throwaway Playwright spec, not assumed.** From `124-07-SUMMARY.md`, Task 2: clicking "More
options" → the nested "Select theme" trigger → picking "Matrix Emerald" changed
`document.documentElement.dataset.theme` from `cyan` to `emerald`:
```
THEME_BEFORE: cyan
THEME_AFTER: emerald
✓ overflow menu: theme select nested in DropdownMenu actually applies a theme change (1.9s)
```
No plain-`<div>` fallback was needed; the `DropdownMenuItem`-wrapped shape works as shipped.

## The D-05 cmdk verdict

**Defect reproduced and fixed.** Raw `data-value` pair, measured before the rename (from
`124-04-SUMMARY.md`, Task 1, against the then-live registry): `['Analytics', 'Analytics']` — both
`/analytics` and `/hr/analytics` resolved to the identical cmdk selection key. Fixed two ways:
the label rename (`/hr/analytics` → "Agent Analytics", D-05) and, since the collision was measured
real rather than assumed, an explicit `value={`${item.label} ${to}`}` prop added to the Pages
`CommandItem` (`src/components/CommandPalette.tsx:75`) as defense-in-depth against any *future*
duplicate label. Post-rename, `getAllByText("Analytics")` returns 1, not 2.

## SYS/LAT's shipped location

**Relocated into the `⋯` overflow menu, not deleted, not moved to the Dashboard.** They render via
a `DropdownMenuLabel` (Radix's non-interactive text-slot primitive — no `role="menuitem"`, not
focusable), directly below a `DropdownMenuSeparator`, so the menu's control count stayed at 4 —
SYS/LAT are figures, not a fifth/sixth control. Their real-or-hidden gating (Phase 96 F3/D-04:
`showSys`/`showLat`) survived the move — proven by a mutation test, not just re-reading the code:
forcing the gate to stay `true` incorrectly made a hidden-case test fail as required
(`AssertionError: expected element to not be in the document ... <span>SYS: <span>0%</span></span>
instead`), reverting made it pass again, and `git diff` against a pre-mutation backup was
byte-identical. (`124-09-SUMMARY.md`, Task 3.) The Dashboard-instrument-cluster alternative named
in `124-CONTEXT.md`'s `<deferred>` section was **not** taken — the `⋯` menu was chosen instead.

## The rendered rail measurement and the 232px `asideRect` figure

Re-measured live in this task (not copied):

```
NAV-RAIL-EVIDENCE {"innerWidth":900,"activeBeforeWidth":"2px","activeBeforeBackgroundColor":"rgb(6, 182, 212)","activeOwnBackgroundColor":"oklab(0.714825 -0.102688 -0.0725026 / 0.06)","inactiveBeforeWidth":"auto","inactiveBeforeBackgroundColor":"rgba(0, 0, 0, 0)"}
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideRect":{"x":0,"y":0,"width":232,"height":900},"mainRect":{"x":232,"y":85,"width":668,"height":815},"culprits":[]}
```

Active item's `::before` rail: exactly **2px**, `rgb(6, 182, 212)` (Electric Cyan `--primary`). The
mandatory control — an **inactive** sidebar link, same component, no `isActive` styling — reads
`inactiveBeforeWidth: "auto"` (no box generated at all), which is what proves the rail is
conditional on active state rather than applied to every item. No exact-colour string is asserted
by the underlying test (Tailwind v4 emits `oklab()`/`oklch()`, which a regex-scrape of computed
colour has already produced one confidently-wrong contrast verdict on in this repo — see the
`tailwind-v4-oklch-defeats-css-color-scraping` finding); the raw string is recorded for an operator
to judge. `asideRect.width === 232` exactly, `culprits: []`, at the 900px Settings collision check.
(`124-10-SUMMARY.md`, Task 2.)

## What was deliberately left out

- **The Help control (D-07).** Deferred, not omitted by oversight. No Help control exists anywhere
  in the app today (`grep -niE "help" src/layouts/DashboardLayout.tsx` → 0, confirmed live above).
  Building one is net-net-new UI outside a presentation-only regroup, and what it would open (a
  shortcuts sheet, docs, a tour) is unanswered. `REQUIREMENTS.md`'s SHELL-01 row was amended at
  `286c2d51` (confirmed present in `git log`) to strike it from scope.
- **No bundle-size CI gate exists in this repo, so DEBT-03's entry-chunk budget is protected by
  nothing automatic.** Confirmed live in this task, not just cited from a SUMMARY:
  ```
  $ grep -ciE "size-limit|bundlesize|bundle-size" package.json .github/workflows/ci.yml
  package.json:0
  .github/workflows/ci.yml:0
  ```
  This gap **outlives the phase**. `124-07`'s own before/after `npm run build` measurement showed
  `ThemeSwitcher`'s emitted chunk byte-identical (1.71 kB / 0.89 kB gzip) before and after its move
  into the `⋯` menu — so the lazy boundary held **this time**, checked by hand, with nothing that
  would catch a future regression automatically.
- **The `⋯` menu's own contents are never scanned by the 20-cell accessibility criterion matrix.**
  `124-10-SUMMARY.md`, Task 3's coverage disclosure: `dropdownContentInDomBeforeClick: false` —
  Radix's `DropdownMenuContent` isn't mounted until the trigger is clicked, and
  `e2e/theme-contrast.spec.ts` never clicks anything; it only navigates and scans. Theme switcher,
  privacy shield, CRT toggle, ambient audio control, and the SYS/LAT `DropdownMenuLabel` inside
  that menu have **no automated a11y coverage** from this phase's gate. Real, disclosed gap, not a
  claim of full coverage. The other four new chrome surfaces (the `⋯` trigger button itself, the
  four `CollapsibleTrigger` domain headers, the breadcrumb, the two count badges' render slots, and
  the system chip's text) ARE structurally reached by the matrix — see that SUMMARY's own table for
  the full breakdown.
- **The Signal Horizon** (2px aurora line under the header) — explicitly SIGNAL-01, Phase 125. 124
  built the header it attaches to and left the slot clean; nothing in this phase touches it.
- **The `a11y-02` 42-route accessibility backlog** (96 objects / 966 nodes across 42 non-criterion
  routes, 7 of 8 rule categories un-triaged) — out of scope, per `124-CONTEXT.md`'s "Reviewed
  todos (not folded)" section. This phase's own criterion routes stay at 0 violations (confirmed
  below), which was the actual scope commitment.
- **SYS/LAT-on-Dashboard** — the alternative placement D-08 left open was not chosen; see above.
- **Four `DashboardLayout.test.tsx` `test.todo` stubs remain untouched** (icons, count badges,
  collapsed tooltips, collapsed aria-label) — confirmed live, `grep -c "test\.todo(" ...` → 4,
  matching `124-05-SUMMARY.md`'s count exactly. These were explicitly left for other plans'/phases'
  scope, not silently dropped.
- **LiveRun's `scrollable-region-focusable`/`color-contrast` flake and the vitest
  non-deterministic-one-random-failure item** are Phase 123 findings, disclosed there
  (`123-CLOSEOUT.md` §8, §11.10), unrelated to and unmodified by this phase. Not re-verified here;
  this checkpoint's own full-suite run (below) shows 0 failures, so neither is presently live.

Nothing above was found NOT VERIFIED or SKIPPED during this task's gate re-run — every gate below
ran to completion with 0 skips.

## Gate results (re-run live in this task, quoted verbatim)

**1. `npx tsc --noEmit`**
```
(exit 0, no output)
```

**2. `npm test`** (full Vitest suite)
```
Test Files  350 passed | 17 skipped (367)
     Tests  4938 passed | 195 todo (5133)
```
0 failures. Matches `124-09-SUMMARY.md`'s and `124-10-SUMMARY.md`'s final recorded figures exactly
(350/367 files, 4938/5133 tests) — no regression across the whole phase to this point. The 17
skipped files and 195 todo tests are the same pre-existing, unrelated set named throughout this
phase's SUMMARYs (canvas/WebGL jsdom limitations, abandoned `test.todo` placeholders in scope
elsewhere) — none are in `navRegistry`, `CommandPalette`, `DashboardLayout`, `breadcrumbs`, or
`EStopButton` test files.

**3. `npx playwright test e2e/polish-geometry.spec.ts`** (against `dev:noauth:5181`)
```
10 passed (4.9s)
```
0 skipped. Includes the E-Stop cross-width identity check (5 viewports), the D-06 header
min-content measurement (375px/900px), the D-17 232px Settings-collision re-check, and the D-17
active-rail rendered proof — all quoted above under their own headings.

**4. The accessibility matrix — `npx playwright test e2e/theme-contrast.spec.ts`** (against
`dev:noauth:5181`)
```
21 passed (21.2s)
```
0 skipped, 0 failures. All 20 criterion cells (Analytics/Dashboard/Forge/Graphs/LiveRun ×
cyan/emerald/readable/aubergine) pass `expect(results.violations).toEqual([])` — **0 violations at
every cell** — plus the population-guard test (`route table: population is 47 (not 62), criterion
set is 5, generated cell count matches themes x routes`). Matches `123-CLOSEOUT.md`'s and
`124-10-SUMMARY.md`'s recorded baseline exactly (also 0/0 across the same 20 cells) — no
regression introduced by this phase's shell/sidebar rewrite.

---

## Task 2 — Operator verdict

The operator reviewed the running shell at `http://localhost:5181` and supplied four screenshots
at 1080p-class widths: `/inbox` (sidebar Inbox badge 46), `/alerts` (Alert Rules Engine rows
overlapping), `/automation` (three placeholder stat cards, twelve "Invalid expression" rows), and
`/tool-galaxy` (a Convex error card).

### Verbatim responses

On checklist items 2-5:

> "2-5 ok"

On the /alerts page (screenshot supplied, Alert Rules Engine table circled):

> "page still bunches up the text"

On checklist item 7 (narrow-width resize pass):

> "resize is fine"

On the /automation and /tool-galaxy screenshots:

> "don't understand why thing look broken"

Overall impression:

> "i think it looks better"

### Checklist outcomes

- **Item 2** (Sidebar: four domains, collapse persists across reload, survives rail collapse) —
  **PASS.** Operator: "2-5 ok".
- **Item 3** (Active item: rail + tint only, weight uniform; is it too subtle?) — **PASS.**
  Operator: "2-5 ok". He did not call it too subtle.
- **Item 4** (Badges: Inbox/Alerts only) — **PASS.** Operator: "2-5 ok". See D-4 below, found by
  the orchestrator, not the operator.
- **Item 5** (Header: breadcrumb, four-control menu, theme applies from inside it, no Help) —
  **PASS.** Operator: "2-5 ok".
- **Item 6** (System chip agrees with Alerts badge) — **PASS.** The `/alerts` screenshot shows
  CRITICAL 0 / ERROR 0 / WARNING 0 / INFO 0, "No active alerts", the sidebar Alerts row carrying no
  badge, and the header chip reading "Nominal". Consistent.
- **Item 7** (900px and 375px, nothing clipped, Ctrl+K at both) — **PASS.** Operator: "resize is
  fine".
- **Item 8** (five moved routes load at their old addresses) — **PARTIAL.** The operator visited
  **Automation** and **Tool Galaxy**; both loaded at `/automation` and `/tool-galaxy` with correct
  breadcrumbs (`System / Automation`, `System / Tool Galaxy`). **Briefings, Config, and Workspace
  Map were NOT visited by the operator — recorded as NOT VERIFIED BY THE OPERATOR.** Separately,
  all 44 route addresses are guarded automatically by 124-01's golden fixture (green) — that guard
  covers the ADDRESS only, not the rendered page.
- **Item 9** (anything else wrong) — three defects raised, below, plus one orchestrator-found
  defect and one unruled non-defect.

### Defect dispositions

The operator's ruling on all three page-body defects (D-1, D-2, D-3) was: **close Phase 124,
handle them in a follow-up phase.** None are fixed inside this phase.

**D-1 — Alert Rules Engine rows overlap and bunch text.**
Operator: "page still bunches up the text". Evidence: `/alerts` screenshot — rule names ("High
Error Rate", "Long Session Duration", "Many Tool Failures", "Event Backlog", "Stale Sessions",
"Agent Crash Loop") collide with their condition lines and adjacent rows; one badge renders
truncated as `std-hi` where `STANDARD` is expected.
Owner: `src/components/AlertRulesEngine.tsx`. **Not caused by Phase 124** —
`git log --oneline --grep="(124" -- src/components/AlertRulesEngine.tsx` returns 0 commits; last
touched by `206a26ff` (122-04), `8c82e76e` (89-03), and an earlier UI polish pass.
Status: **NOT ROOT-CAUSED.** Rows are `flex items-center gap-4 px-5 py-4` with `truncate` on both
text lines (`:75`, `:108-109`, `:205`, `:218-219`) inside a `max-h-[500px] overflow-y-auto` column
(`:388`). Diagnosing it needs live DOM measurement, not source reading. Recorded as unexplained —
no guessed mechanism is asserted as fact.
Disposition: **DEFERRED to a follow-up phase.**

**D-2 — Automation page: three of four stat cards never resolve, all twelve schedules read
"Invalid expression".**
Operator: "don't understand why thing look broken". Evidence: `/automation` screenshot —
"CONFIGURED SCHEDULES 12" renders correctly while the other three tiles show purple skeleton
placeholders; every cron row ("stale sessions", "alert evaluation", "metric rollup", "docker
poll", "supabase poll", "llm cost rollup", "stale agents", "profile summary", "memory prune",
"purge old telemetry events", and two more) shows its interval followed by "Invalid expression".
Owner: `src/pages/Automation.tsx`. **Not caused by Phase 124** — 0 commits from this phase touch
it.
Status: **NOT INVESTIGATED.** Two symptoms, plausibly one cause; not established.
Disposition: **DEFERRED to a follow-up phase.**

**D-3 — Tool Galaxy fails to load with a Convex system-operations timeout.**
Evidence: `/tool-galaxy` screenshot — "Tool Galaxy failed to load. [CONVEX
Q(graphSnapshots:getProjectGraph)] [Request ID: ca4679bc1fc77d14] Server Error Your request timed
out performing too many system operations."
Owner: `convex/graphSnapshots.ts`. **Not caused by Phase 124** — 0 commits from this phase touch
it, and this phase made no Convex deploy.
Status: **HYPOTHESIS ONLY, explicitly unverified.** The symptom matches CodePulse's documented
Convex read-limit class (a ~4,096-READ ceiling, not the 16,000-write ceiling the vendor docs and
this repo's own comments point at), the same shape as the `heroStats` timeout resolved by
range-bounding a descending index scan. This is recorded as a hypothesis, not a diagnosis.
Disposition: **DEFERRED to a follow-up phase.**

**D-4 — `/inbox` under-counts held items (orchestrator-found, not operator-found).**
The sidebar badge reads 46 while the Inbox page's own Held tab reads 9, both on screen
simultaneously. The badge is the correct figure: `inbox.listHeldUnacked` is index-scoped on
`by_itemType`, uncapped, filtered on `ackedAt === undefined` (`convex/inbox.ts:206-214`). The page
builds its Held tab from `inbox.listAll`, which is `.take(DEFAULT_LIST_ALL_LIMIT)` = 200
(`convex/inbox.ts:173,187`), so only 9 held rows fall inside that window. Both sides define unread
identically (`src/pages/Inbox.tsx:130` maps `read: row.ackedAt != null`), so the 200-row cap is
the sole cause.
This is a **pre-existing under-count in `/inbox`**, made visible — not caused — by this phase's
badge. The badge behaved exactly as D-10 intended.
Disposition: **DEFERRED to a follow-up phase.**

**Non-defect, recorded to prevent a future misreading:** the `?` glyph at the far right of the
header is NOT the deferred D-07 Help control. It is `UserMenu`'s signed-out placeholder —
`src/components/UserMenu.tsx:7-12` returns a literal `?` in a muted circle when
`VITE_CLERK_PUBLISHABLE_KEY` is unset, which is the case under `dev:noauth`. With a Clerk key it
renders Clerk's `UserButton`. D-07's "no Help entry" holds
(`grep -icE '\bhelp\b' src/layouts/DashboardLayout.tsx` = 0). The operator was asked whether to
restyle it and has not ruled; recorded as **OPEN, unruled**.

### Verdict

The operator approved the shell overall ("i think it looks better") with all sidebar/header/badge/
resize checklist items passing. Three page-body defects (D-1, D-2, D-3) and one orchestrator-found
defect (D-4) are deferred to a follow-up phase, not fixed in this phase. Item 8 is partial —
Briefings, Config, and Workspace Map were never visited and are NOT VERIFIED BY THE OPERATOR. The
`?` glyph question is open and unruled.

---
*Phase: 124-shell-information-architecture*
*Task 1 completed: 2026-08-21*
*Task 2 (operator checkpoint) completed: 2026-08-21*
