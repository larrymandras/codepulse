---
phase: 124-shell-information-architecture
plan: 10
subsystem: ui
tags: [playwright, e2e, tailwind, axe-core, flexbox, geometry]

requires:
  - phase: 124-shell-information-architecture (plans 05-09)
    provides: consolidated 3-zone header, 232px sidebar, active nav rail, breadcrumb
provides:
  - "D-06 settled by measurement: header keeps min-h-14 flex-wrap gap-y-1 (wrap branch), not h-12"
  - "D-17 settled by measurement: 232px sidebar re-verified at the 900px Settings collision check"
  - "Rendered proof of the 2px active nav rail (::before) against an inactive-link control"
  - "E-Stop min-width raised to 96px (min-w-24) to meet the sketch's Section 7 floor"
  - "Accessibility criterion matrix re-verified at 0 violations across all 20 cells, no regression"
affects: [125-signal-horizon]

tech-stack:
  added: []
  patterns:
    - "In-place min-content measurement: flex:none + width:min-content on a live DOM node, one zone at a time, restored synchronously in the same page.evaluate call, instead of a detached clone"

key-files:
  created: []
  modified:
    - e2e/polish-geometry.spec.ts
    - src/layouts/DashboardLayout.tsx
    - src/components/EStopButton.tsx

key-decisions:
  - "D-06: header stays min-h-14 flex-wrap gap-y-1 -- zone min-content sum exceeds available width at both 375px (351.5 vs 327) and 900px (706.2 vs 620), decisively, not marginally"
  - "D-17: 232px sidebar re-measured (not inferred) at the 900px Settings collision check -- exact 232px, zero culprits"
  - "E-Stop gets min-w-24 (96px) -- measured 81.34px constant before the change, below the sketch's floor at every viewport"

requirements-completed: [SHELL-01, SHELL-02]

duration: ~30min
completed: 2026-08-21
---

# Phase 124 Plan 10: Geometry Settlement Summary

**Re-measured D-06's header-height gate and D-17's 232px sidebar live against the consolidated
3-zone header; both come back the SAME as before consolidation (wrap stays, 232px holds), added a
rendered active-rail proof and an inactive-link control, raised E-Stop to the sketch's 96px floor
with a one-line diff, and re-verified the 20-cell accessibility criterion matrix at zero
violations.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-21T17:04:04Z
- **Tasks:** 3 (all `type="auto"`, no checkpoints in this plan)
- **Files modified:** 3 (`e2e/polish-geometry.spec.ts`, `src/layouts/DashboardLayout.tsx`,
  `src/components/EStopButton.tsx`)

## Dev server (per plan's dev_server_protocol)

Started from **Git Bash** (not PowerShell — PS 5.1 deletes an empty-string env var assignment,
per `package.json`'s `test:e2e:noauth:help`):

```
VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth
```

Confirmed clean start on `127.0.0.1:5181` (`vite --port 5181 --strictPort --host 127.0.0.1`, per
the `dev:noauth` script — never a bare `vite --port 5181`). Port 5181 was free before starting
(orchestrator's `Get-NetTCPConnection` check, re-confirmed with `netstat -ano | grep :5181` before
first use — no output).

**Every measurement in this plan is a genuine render, not a skipped Clerk gate.** All Playwright
runs below ran against the keyless `dev:noauth` server; `gateOrSkip`'s `test.skip` branch never
fired in any run — confirmed by reading each run's console output for a `Sign in to access the
telemetry dashboard` skip message (none appeared) and by the pass counts matching the full
declared test count with zero skipped, every time.

**Server stopped** after all measurements completed: `netstat -ano | grep :5181` after stopping
returned no output (port free).

## Task 1 — D-06: header three-zone min-content measurement

**Mechanism** (stated per the plan's own requirement): each header zone's true CSS min-content was
measured **in place**, one zone at a time — `el.style.flex = 'none'; el.style.width =
'min-content'`, read `getBoundingClientRect().width`, then restore both properties before moving
to the next zone. This is NOT a detached-clone technique (a clone re-parented outside the flex row
loses the flex-item context that determines whether `width: min-content` even applies).

**Methodology correction found live, before this was finalized:** the first pass set only
`flex-basis: 'min-content'`, leaving `flex-grow` at 1 (from the command-bar zone's `flex-1` Tailwind
class) — the zone still grew to fill leftover row space up to its `max-w-[420px]` cap regardless of
basis, producing a false 420px "min-content" reading at 900px. `flex: 'none'` (grow:0, shrink:0,
basis:auto) fully decouples the item from the row's flex distribution before `width: min-content` is
applied, which is what a true reading requires. Corrected value: **170.77px**, not 420px.

**A second correction, also found live:** comparing the summed zone width against the header's raw
`clientWidth` silently gave the zones 48px of room they don't actually have (the header's own
`px-6` padding is inside `clientWidth` but outside the content box the zone children sit in).
Fixed by subtracting `paddingLeft`/`paddingRight` to get `headerAvailableWidth`.

**HEADER-ZONES-EVIDENCE, both required viewports, verbatim:**

```
HEADER-ZONES-EVIDENCE {"requestedWidth":375,"innerWidth":375,"headerClientWidth":375,"headerPaddingLeft":24,"headerPaddingRight":24,"headerAvailableWidth":327,"headerHeight":83,"headerClientRectsLength":1,"zones":[{"className":"flex items-center gap-4","display":"flex","hidden":false,"laidOutWidth":24,"minContentWidth":24},{"className":"flex-1 max-w-[420px] mx-4 hidden md:flex","display":"none","hidden":true,"laidOutWidth":0,"minContentWidth":0},{"className":"flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10","display":"flex","hidden":false,"laidOutWidth":327.546875,"minContentWidth":327.546875}],"sumMinContentWidth":351.546875,"culprits":[]}
HEADER-ZONES-EVIDENCE {"requestedWidth":900,"innerWidth":900,"headerClientWidth":668,"headerPaddingLeft":24,"headerPaddingRight":24,"headerAvailableWidth":620,"headerHeight":85,"headerClientRectsLength":1,"zones":[{"className":"flex items-center gap-4","display":"flex","hidden":false,"laidOutWidth":146.0625,"minContentWidth":146.0625},{"className":"flex-1 max-w-[420px] mx-4 hidden md:flex","display":"flex","hidden":false,"laidOutWidth":420,"minContentWidth":170.765625},{"className":"flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10","display":"flex","hidden":false,"laidOutWidth":450.0625,"minContentWidth":389.328125}],"sumMinContentWidth":706.15625,"culprits":[]}
```

(Above is the run taken immediately before deciding the branch, i.e. before the E-Stop 96px change
in Task 3. A later full-suite run after Task 3 shows the icon-cluster zone's min-content growing
from 389.33px to 473.03px at 900px, sum 789.86, still with `culprits:[]` — quoted in Task 3 below.)

**Measurement, then decision, in that order:**

| Viewport | Sum of zone min-content | Header available width | Result |
|---|---|---|---|
| 375px | 351.55px | 327px | **exceeds by 24.5px** |
| 900px | 706.16px | 620px | **exceeds by 86.16px** |

**D-06 branch taken: DOES NOT CLEAR.** At both required viewports, the sum of the three zones'
absolute CSS-minimum widths exceeds the header's own available width — not a close call decided
against the wrap, a decisive one. `min-h-14 flex-wrap gap-y-1` stays exactly as 120-07 shipped it;
`h-12` was NOT adopted. `grep -cF "min-h-14" src/layouts/DashboardLayout.tsx` → 1 (unchanged);
`flex-wrap` and `gap-y-1` remain on the header's className line (unchanged).

**No cell skipped.** Both viewports rendered genuinely (confirmed per the dev-server section
above); the branch decision is not resting on a skip.

**Permanent regression guard added** (branch-appropriate, per the plan's own instruction that the
wrap branch's guard differs from the clearing branch's): a header-scoped culprit walk — every
header descendant's box must not extend past `window.innerWidth` (`rightOverflow > 1`, `sr-only`
excluded — same criterion as the existing 900px `/settings` walk) — asserted at both 375px and
900px. Currently 0 culprits at both. This is what would fail if a future change broke `flex-wrap`
again; the "sum stays under available width" assertion the plan describes for the *clearing*
branch would be structurally unpassable here (wrapping is required), so it was not used as the
hard gate — the sum/zone data is still fully recorded in evidence for diagnosis.

**Updated the POLISH-06 comment** above `<header>` in `DashboardLayout.tsx` with the date
(2026-08-21), the new measured numbers at both viewports, and which branch won. The original
`981px`-vs-`660px` control record is kept, not replaced (`grep -c '981' src/layouts/DashboardLayout.tsx`
→ 1, inside the original prose). Updated comment, quoted:

> RE-MEASURED 2026-08-21, Phase 124 Plan 10, Task 1 (D-06) — now that the 3-zone consolidation
> (124-07..09) is built. `e2e/polish-geometry.spec.ts`'s "Header three-zone min-content
> measurement" block forces each visible zone's width down to its true CSS min-content
> (flex:none + width:min-content, one zone at a time, in place) and sums it against the header's
> available width (clientWidth minus its own px-6 padding). Result, both required viewports: the
> sum EXCEEDS available width even at that absolute floor — 706.16px vs 620px available at 900px
> (86px over), and 351.55px vs 327px available at 375px (24.5px over). This is not a close call
> decided against the wrap; the header's three zones cannot fit on one row at either viewport no
> matter how much each is compressed. D-06's "clears with margin" branch was therefore NOT taken
> — `min-h-14 flex-wrap gap-y-1` stays exactly as originally shipped by 120-07, unchanged by this
> plan. The consolidation reduced the OVERFLOW (981px combined min-content at 900px in 120-07's
> original measurement, above, down to 706px here) but not enough to close it.

Commit: `a6a0c5db`.

## Task 2 — D-17: 232px sidebar re-measurement + rendered active-rail proof

The sidebar was already at `w-[232px]` live (shipped by 124-05/124-09 — `DashboardLayout.tsx`'s
desktop `<aside>`), and `DashboardLayout.test.tsx:266` already asserts the className carries
`w-[232px]`. What D-17 still required was **re-running POLISH-06's 900px geometry check at the new
width**, not inferring safety from 240px having survived — the existing block already captured
`asideRect` but never asserted on it. Added the assertion to the EXISTING block (no duplicate
block, per the plan's own instruction).

**SETTINGS-900-EVIDENCE, verbatim (this task's run):**

```
SETTINGS-900-EVIDENCE {"innerWidth":900,"scrollWidth":900,"bodyScrollWidth":900,"asideRect":{"x":0,"y":0,"width":232,"height":900},"mainRect":{"x":232,"y":85,"width":668,"height":815},"culprits":[]}
```

`asideRect.width === 232` exactly (no sub-pixel drift observed in this run; the assertion carries a
±0.5px tolerance per the plan's instruction regardless). `culprits: []`, unchanged.

**Active nav rail — rendered measurement.** Navigated to `/alerts`, located `[aria-current="page"]`,
read `getComputedStyle(el, '::before')`. Paired with a mandatory control: the same read on an
**inactive** sidebar link (same component, no `isActive` styling, no `before:*` utility classes at
all).

**NAV-RAIL-EVIDENCE, verbatim:**

```
NAV-RAIL-EVIDENCE {"innerWidth":900,"activeBeforeWidth":"2px","activeBeforeBackgroundColor":"rgb(6, 182, 212)","activeOwnBackgroundColor":"oklab(0.714825 -0.102688 -0.0725026 / 0.06)","inactiveBeforeWidth":"auto","inactiveBeforeBackgroundColor":"rgba(0, 0, 0, 0)"}
```

- Active `::before` width: **2px**, asserted exactly.
- Active `::before` backgroundColor: `rgb(6, 182, 212)` — the Electric Cyan `--primary`. Per the
  plan's explicit instruction, **no exact-colour string is asserted** (this project has already
  produced a confidently wrong contrast verdict once by regex-scraping computed colour and reading
  a hue angle as a channel — see the `tailwind-v4-oklch-defeats-css-color-scraping` memory). The
  assertion only checks the value is not `rgba(0, 0, 0, 0)` / `transparent`; the raw string is
  recorded above for an operator to judge.
- Inactive control: `::before` width reads `"auto"` — i.e. no box is generated at all (no
  `content` property set on that pseudo-element, since the inactive branch carries no `before:*`
  classes). This is the discriminating result: without this control, a rule that applied the rail
  to every nav item, active or not, would have passed the active-side assertion just as easily.
  `activeOwnBackgroundColor` (`oklab(...)`) is the 6%-tint background on the link itself, separate
  from the rail — recorded for completeness, not asserted on (also `oklab()`, same reason).

No skips in either sub-check of this task.

Commit: `e2c28ff2`.

## Task 3 — E-Stop's 96px floor, then the accessibility matrix re-run

**Measured BEFORE the decision** (from Task 1's baseline `ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE`, all
five `ESTOP_WIDTHS` tiers: 360/640/900/1440/2560px): `buttonWidth` was a **constant 81.34375px** at
every width — below the sketch's 96px floor everywhere, not just at the narrow end.
`shrink-0`/`whitespace-nowrap` already held it at its content width; that content width was simply
never 96px.

**Decision: add `min-w-24`.** One utility, on the existing className string, nothing else touched.
`git diff --stat -- src/components/EStopButton.tsx` → `1 file changed, 1 insertion(+), 1
deletion(-)` — exactly one changed line, per the acceptance criteria. No markup, dialog, copy, or
`aria-label` change (`grep -c 'aria-label="Emergency Stop"'` unaffected — file diff shows only the
`className` line).

**Post-change ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE, verbatim:**

```
ESTOP-GEOMETRY-CROSSWIDTH-EVIDENCE [{"requestedWidth":360,"innerWidth":360,"buttonWidth":96,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":1,"labelOffsetHeight":20},{"requestedWidth":640,"innerWidth":640,"buttonWidth":96,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":1,"labelOffsetHeight":20},{"requestedWidth":900,"innerWidth":900,"buttonWidth":96,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":1,"labelOffsetHeight":20},{"requestedWidth":1440,"innerWidth":1440,"buttonWidth":96,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":1,"labelOffsetHeight":20},{"requestedWidth":2560,"innerWidth":2560,"buttonWidth":96,"buttonHeight":28,"buttonClientRectsLength":1,"labelClientRectsLength":1,"labelComputedDisplay":"block","labelTextNodeRectsLength":1,"labelOffsetHeight":20}]
```

`buttonWidth` is now a **constant 96px** at every one of the five widths (was 81.34375px). Height
unchanged (28px), label unwrapped (`labelTextNodeRectsLength: 1`) at every width. The cross-width
identity assertion (POLISH-02's guard) still passes — identical width AND height across all five
tiers, just at the new floor.

**Header re-run with the wider E-Stop, full-suite pass, `HEADER-ZONES-EVIDENCE` at 900px:**

```
HEADER-ZONES-EVIDENCE {"requestedWidth":900,"innerWidth":900,"headerClientWidth":668,"headerPaddingLeft":24,"headerPaddingRight":24,"headerAvailableWidth":620,"headerHeight":85,"headerClientRectsLength":1,"zones":[{"className":"flex items-center gap-4","display":"flex","hidden":false,"laidOutWidth":146.0625,"minContentWidth":146.0625},{"className":"flex-1 max-w-[420px] mx-4 hidden md:flex","display":"flex","hidden":false,"laidOutWidth":420,"minContentWidth":170.765625},{"className":"flex items-center gap-1.5 sm:gap-2 bg-primary/5 px-2 py-1.5 rounded-md border border-primary/10","display":"flex","hidden":false,"laidOutWidth":531,"minContentWidth":473.03125}],"sumMinContentWidth":789.859375,"culprits":[]}
```

Icon-cluster zone's min-content grew from 389.33px to 473.03px (the extra ~14.66px E-Stop floor),
sum grew to 789.86px — still `culprits: []` at both viewports (confirmed on the same full-suite run
at 375px too: 366.20px sum, `culprits: []`). The header absorbs the wider control cleanly by
wrapping; nothing clips.

**Accessibility matrix re-run, Clerk-free, same recipe:**

```
21 passed (19.5s)
```

All 20 criterion cells (Analytics/Dashboard/Forge/Graphs/LiveRun × cyan/emerald/readable/aubergine)
pass `expect(results.violations).toEqual([])` — **0 violations at every cell**, plus the
population-guard test (`route table: population is 47 (not 62), criterion set is 5, ...`). No cell
regressed vs. `123-CLOSEOUT.md`'s recorded baseline (also 0/0 across the same 20 cells).

**Coverage disclosure (required by the plan): which of the five new chrome a11y surfaces the
matrix actually reaches.** Verified live with a throwaway (never committed — created in `e2e/`,
run, then deleted before this task's commit; confirmed `git status --short` showed nothing after
deletion) probe navigating to `/` and reading the DOM directly:

| New chrome surface | Reached by the 20-cell matrix? | Evidence |
|---|---|---|
| `⋯` overflow **trigger button** (icon-only, `aria-label="More options"`) | **Yes** | `moreOptionsBtnPresent: true` — the trigger itself is always in the DOM and gets scanned by axe on every criterion route. |
| `⋯` menu's **contents** (theme/privacy/CRT/audio, SYS/LAT) | **No** | `dropdownContentInDomBeforeClick: false` — Radix's `DropdownMenuContent` is not mounted until the trigger is clicked, and the matrix (`theme-contrast.spec.ts`) never clicks anything; it only navigates and scans. This surface's accessibility is untested by this matrix. |
| Four `CollapsibleTrigger` domain headers (`aria-expanded`) | **Yes** | Sidebar renders on every route (all four domains open by default per D-15); `aria-expanded` attributes present in the DOM. |
| Breadcrumb `<nav aria-label="Breadcrumb">` with `aria-current="page"` | **Yes**, for routes with a mapped trail | `breadcrumbNavPresent: true`, `breadcrumbText: "Observe/Dashboard"` at `/`. All five criterion routes (Analytics, Dashboard, Forge, Graphs, LiveRun) are in `navRegistry.ts`, so each gets a real trail. |
| Two count badges' `aria-label`s (Inbox, Alerts) | **Partially — data-dependent, not route-dependent** | `inboxBadgePresent: true, inboxBadgeText: "46"` (live held-unacked count) — the sidebar renders on every route regardless of which page axe is scanning, so the badge's DOM presence does not depend on the criterion route set. `alertsBadgePresent: false` at probe time (0 unacknowledged alerts live — D-12's "never a visible zero" means no badge element exists to scan when the count is 0, not that the code path is unreached). |
| System chip's text (Nominal/Attention/Critical/Offline) | **Yes** | `systemChipPresent: true, systemChipText: "Nominal"` — renders in the header on every route once `alerts.countBySeverity` resolves. |

**Honest summary:** 4 of 5 new surfaces are structurally reached by the existing 20-cell matrix
(the domain collapsibles, the breadcrumb, the badges' render slot, the system chip). The one
genuine gap is the **`⋯` menu's own contents** — a11y properties of the theme switcher, privacy
shield, CRT toggle, ambient audio control, and the SYS/LAT `DropdownMenuLabel` inside that menu are
NOT exercised by this matrix, because it never opens the menu. This is a real, disclosed coverage
gap, not a claim of full coverage.

Commit: `af688549`.

## Task Commits

1. **Task 1: Header three-zone min-content measurement, D-06 decided (wrap stays)** — `a6a0c5db` (test)
2. **Task 2: 232px sidebar assertion + rendered active-rail proof (D-17)** — `e2c28ff2` (test)
3. **Task 3: E-Stop min-w-24 (96px) + accessibility matrix re-run** — `af688549` (fix)

## Files Created/Modified

- `e2e/polish-geometry.spec.ts` — two new `test.describe` blocks (header three-zone min-content at
  375/900px; active nav rail at `/alerts`) plus one new assertion on the existing 900px `/settings`
  block's `asideRect.width`.
- `src/layouts/DashboardLayout.tsx` — POLISH-06 comment above `<header>` updated with the
  2026-08-21 re-measurement; header `className` itself unchanged (wrap branch taken).
- `src/components/EStopButton.tsx` — `min-w-24` added to the trigger button's `className`; one
  changed line.

## Decisions Made

- **D-06: wrap stays, `h-12` not adopted.** Zone min-content sum exceeds available width at both
  required viewports even at the absolute compression floor (24.5px over at 375px, 86.16px over at
  900px) — decisively, not a close call. `min-h-14 flex-wrap gap-y-1` is unchanged from 120-07.
- **D-17: 232px sidebar confirmed by measurement, not inference.** `asideRect.width === 232` exact
  at the 900px Settings collision check, zero culprits.
- **The permanent D-06 regression guard is branch-appropriate**, not the plan's literal
  "sum stays under available width" phrasing — that assertion is unpassable while wrapping is
  structurally required (asserting it would assert a known-false fact). Used instead: a
  header-scoped no-clip-past-viewport walk, matching the plan's own alternate spec for the wrap
  branch ("the header still renders every right-zone control within the viewport").
- **E-Stop's `min-w-24`** is the only source change to shipped UI in this plan; everything else is
  test/measurement/comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Min-content measurement technique corrected twice, live, before being trusted**
- **Found during:** Task 1
- **Issue:** First pass used `flex-basis: 'min-content'` alone, leaving `flex-grow: 1` active on
  the command-bar zone (`flex-1` class) — it still grew to fill leftover space up to its
  `max-w-[420px]` cap, producing a false 420px "min-content" reading at 900px (should have been
  ~171px). Second issue: comparing the zone sum against the header's raw `clientWidth` silently
  gave the zones 48px of padding-room they don't actually have.
- **Fix:** Added `flex: 'none'` before setting `width: 'min-content'` (fully decouples grow/shrink
  before intrinsic sizing is read); computed `headerAvailableWidth = clientWidth - paddingLeft -
  paddingRight` and compared against that instead.
- **Files modified:** `e2e/polish-geometry.spec.ts` (both corrections landed before the Task 1
  commit; the committed code already reflects the corrected mechanism).
- **Verification:** Re-ran both viewports after each correction; the corrected 900px zone-2
  reading (170.77px) is far more plausible for a search-icon + placeholder + `⌘K` kbd hint than
  the pre-correction 420px (which was suspiciously identical to the container's own `max-w`).
- **Committed in:** `a6a0c5db` (Task 1 commit — the corrected mechanism, not a separate follow-up).

**2. [Rule 3 - Blocking] Permanent guard assertion redesigned for the actual branch taken**
- **Found during:** Task 1, immediately after measuring
- **Issue:** The plan's literal guard spec for the clearing branch ("sum stays under available
  width") cannot be used as the wrap branch's guard — it is provably false in the wrap branch by
  construction (that is WHY the wrap branch was taken), so asserting it would make the test always
  fail regardless of any future header change, which defeats its purpose as a regression guard.
- **Fix:** Implemented the plan's OWN alternate guard spec for this exact case (quoted directly
  from the plan's Task 1 action text): "if the wrap branch was taken — that the header still
  renders every right-zone control within the viewport." Added a header-scoped culprit walk
  (no descendant clips past `window.innerWidth`) as the hard assertion instead.
- **Files modified:** `e2e/polish-geometry.spec.ts`.
- **Verification:** 0 culprits at both viewports, both before and after Task 3's E-Stop width
  change.
- **Committed in:** `a6a0c5db`.

**3. [Rule 1 - Bug] EStopButton.tsx diff trimmed to satisfy the plan's own "exactly one changed
line" acceptance criterion**
- **Found during:** Task 3
- **Issue:** First edit added both the `min-w-24` utility AND an explanatory comment block (7
  inserted lines total), which would have failed the plan's explicit acceptance criterion:
  "`git diff --stat -- src/components/EStopButton.tsx` shows exactly one changed line."
- **Fix:** Reverted the comment addition; kept only the `className` line edit.
- **Files modified:** `src/components/EStopButton.tsx`.
- **Verification:** `git diff --stat` confirmed `1 file changed, 1 insertion(+), 1 deletion(-)`
  before committing.
- **Committed in:** `af688549`.

---

**Total deviations:** 3 auto-fixed (2 measurement-mechanism bugs, 1 blocking acceptance-criteria
mismatch). None changed the plan's scope or intent — all three are corrections to how this plan's
own new test code measures reality, not to what was measured or decided.
**Impact on plan:** No scope creep. The corrected mechanism is what the D-06/E-Stop decisions above
actually rest on.

## Issues Encountered

- The throwaway chrome-coverage probe (Task 3's coverage disclosure) could not click the `⋯`
  trigger on `/` because `OnboardingGuide`'s full-screen overlay (gated on a `localStorage` flag
  the probe did not set) intercepted the click. This did not block the required finding — the
  question was "is the menu's content in the DOM before any click", which was already answered
  (`false`) by the pre-click read. The probe file was never staged or committed; confirmed via
  `git status --short` after deleting it.

## Next Phase Readiness

- D-06 and D-17 are now closed with live measurement rather than left as open questions for a
  future phase — Phase 125 (Signal Horizon) can build directly under the current header without
  re-litigating its height.
- The one disclosed a11y gap (the `⋯` menu's own contents are never scanned by the 20-cell
  criterion matrix) is a candidate for a future accessibility pass — not blocking this phase's
  close, since `124-CONTEXT.md`'s scope for this phase is the criterion routes staying at 0
  violations, which they do.

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
