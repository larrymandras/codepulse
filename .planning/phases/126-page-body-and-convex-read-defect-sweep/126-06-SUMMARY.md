---
phase: 126-page-body-and-convex-read-defect-sweep
plan: 06
subsystem: frontend
tags: [inbox, convex, bounded-read, dos-mitigation, vitest, accessibility]

# Dependency graph
requires: ["126-01"]
provides:
  - "InboxCountBadge (src/layouts/DashboardLayout.tsx) reading api.inbox.countHeldUnacked {count, truncated} instead of the unbounded listHeldUnacked"
  - "Inbox.tsx / InboxFilterBar.tsx: totals/truncated props so the Held tab renders a precise 'N of M' and other capped tabs declare a generic floor marker"
  - "src/pages/__tests__/Inbox.test.tsx: 5 new tests covering every <behavior> item, generated from a programmatic 200-row fixture"
  - "InboxCountBadge zero-guard correctness fix (commit ee09115b): a TRUNCATED zero no longer hides the badge -- see Post-Review Fix below"
affects: [126-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared-subscription reconciliation: page and shell badge both call useQuery(api.inbox.countHeldUnacked) with no args -- Convex's client-side subscription dedup makes the page's read free and structurally prevents the two numbers from disagreeing"
    - "Page-owned list-window constant (INBOX_LIST_LIMIT) passed explicitly to a bounded query's optional `limit` arg, compared against the returned length locally -- never importing a server-side constant into client code"
    - "Additive truncation marker: `count > 0 &&` stays the base case; totals/truncated are optional props layered on top, so every existing untruncated caller renders identically to before"

key-files:
  created: []
  modified:
    - src/layouts/DashboardLayout.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx
    - src/pages/Inbox.tsx
    - src/components/InboxFilterBar.tsx
    - src/pages/__tests__/Inbox.test.tsx

key-decisions:
  - "Fixed a test file NOT in the plan's files_modified list (src/layouts/__tests__/DashboardLayout.test.tsx) as a Rule 1 auto-fix -- Task 1's query swap broke its existing badge mocks, which asserted against the old row-array shape."
  - "Deferred the badge+tab single-render co-assertion (the second half of criterion 2) to plan 126-09's live spec -- see Deviations."
  - "Post-review: fixed a HIGH correctness defect in the InboxCountBadge zero-guard -- {count:0, truncated:true} was hiding the badge on a non-authoritative zero. Zero now suppresses only when truncated is false; a truncated zero renders 0+/\"at least 0\". The SOUND remedy (a composite ackedAt-scoped index) is a convex/schema.ts change and is out of scope -- schema.ts is held uncommitted by a concurrent session. Recorded as a Known Limitation, not silently left."

requirements-completed: [SWEEP-01, SWEEP-03]

# Metrics
duration: ~35min
completed: 2026-08-24
---

# Phase 126 Plan 06: Inbox Badge/Tab Read Defect Sweep Summary

**Sidebar `InboxCountBadge` and the `/inbox` Held tab now read the identical bounded `countHeldUnacked` subscription -- Convex's client-side dedup makes them structurally incapable of disagreeing -- so the Held tab renders a precise `9 of 46` while every other capped tab declares itself with a generic `N+` floor marker instead of pretending to be a total.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-24T20:26:00-04:00 (commits `8cda8650`, `47256c34`, `930fa94b`, `ee09115b`)
- **Tasks:** 2/2 + 1 post-review correctness fix
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- **Task 1** — `InboxCountBadge` (`src/layouts/DashboardLayout.tsx`) swapped `useQuery(api.inbox.listHeldUnacked)` for `useQuery(api.inbox.countHeldUnacked)`, so the every-route shell subscription ships two numbers (`{count, truncated}`) instead of up to 2,001 full inbox row objects (title/body/profileId) the badge only ever called `.length` on. Both D-12 state guards survive unchanged: `result == null -> null` (unresolved) and `count === 0 -> null` (never a visible zero). When `truncated` is true the badge now renders `{count}+` with an `aria-label` of `"at least N unread in Inbox"` rather than a complete-looking integer — matching `AlertsCountBadge`'s existing truncated-count idiom exactly.
- **Rule 1 fix (not in the plan's file list):** `src/layouts/__tests__/DashboardLayout.test.tsx` mocked the old `listHeldUnacked` row-array shape and broke immediately on the query swap (`npm test` went 1 file / 1 test red). Updated the mock's reference string (`inbox:listHeldUnacked` → `inbox:countHeldUnacked`), the three existing badge tests to seed `{count, truncated}` instead of arrays, and added a fourth test asserting the new truncated-Inbox-badge branch (`2000+` / `"at least 2000 unread in Inbox"`) as the control proving that branch is real.
- **Task 2** — `src/pages/Inbox.tsx` declares its own `INBOX_LIST_LIMIT = 200` module constant (a page-owned request, explicitly NOT a mirror of `convex/inbox.ts`'s `DEFAULT_LIST_ALL_LIMIT`), passes it to `listAll`, and subscribes to `api.inbox.countHeldUnacked` — the SAME query the shell badge reads, so the read costs nothing extra (Convex dedups identical subscriptions). Derives:
  - `totals.held = heldTotal.count` only when `heldTotal` has resolved AND `heldTotal.truncated === false` (D-04: a capped badge must never propagate its cap into the page's denominator).
  - `truncated.held` when `heldTotal.truncated === true`, OR when the `listAll` window came back exactly full and no precise total exists.
  - `truncated.{all,cards,notifications}` when `listAll` returned exactly `INBOX_LIST_LIMIT` rows.
  - `approvals`/`alerts` are left unmarked — they come from separate, unbounded-by-this-page queries (WS accumulation, `alerts.listActive`), so `listAll`'s cap says nothing about their true totals.
- `src/components/InboxFilterBar.tsx` gained optional `totals`/`truncated` props (per `<interfaces>`). The existing `count > 0 &&` badge span stays the base case (`InboxFilterBar.tsx:80`); a precise "N of M" wins over a generic floor marker whenever `total > count`; each marker carries an `aria-label` stating either the precise total or that the figure is a floor.
- `src/pages/__tests__/Inbox.test.tsx` grew a new `describe` block (5 tests, 13 total in the file, was 8) covering every item in `<behavior>`, built from a programmatically generated 200-row fixture (`makeInboxWindow(total, unackedHeld)`) so the asserted numbers are derived, not hand-typed.
- `npx tsc --noEmit` exits 0 after both tasks. `npm test` — 365 files passed | 17 skipped, 5102 tests passed | 4 skipped | 195 todo, 0 failed (final run, after Task 2).
- `git diff -- convex/` shows only the other active session's concurrent `bifrost.ts`/`schema.ts` work — confirmed zero Convex changes of my own (I consume plan 126-01's `countHeldUnacked`, I do not modify it).

## Verbatim Rendered Text (per <planner_corrections> item 4 / acceptance criteria)

Three seeded states, quoted from the passing tests in `src/pages/__tests__/Inbox.test.tsx`:

1. **Precise:** `listAll` window with 9 unacked held rows (of 200), `countHeldUnacked: {count: 46, truncated: false}` → Held tab renders the literal text **`9 of 46`** (`screen.getByText("9 of 46")`).
2. **Truncated total (the CONTROL for #1):** same window, `countHeldUnacked: {count: 46, truncated: true}` → `9 of 46` is NOT rendered (`screen.queryByText("9 of 46")` is `null`); the Held tab renders **`9+`** instead.
3. **Unresolved:** `countHeldUnacked: undefined`, window under the limit (12 rows, 5 unacked held) → Held tab renders the plain **`5`** with neither `" of "` nor a trailing `+` present anywhere in the tab.

Additional control pair (the under-limit case, item 3 in `<behavior>`'s list): `listAll` returning exactly `INBOX_LIST_LIMIT` (200) rows renders `200+` on the Cards tab specifically (scoped via `within(cardsButton)`, since the `All` tab is also truncated in that fixture and would otherwise ambiguously match); `listAll` returning fewer rows than the limit (12) renders no `N+` marker and no `" of "` text anywhere on the page — the explicit control proving the marker logic isn't unconditional.

## Task Commits

1. **Task 1: Point the sidebar badge at the bounded count query** — `8cda8650` (feat)
2. **Task 2: Make the tabs declare their caps** — `47256c34` (feat)
3. **SUMMARY.md** — `930fa94b` (docs)
4. **Post-review: fix the InboxCountBadge zero-guard (HIGH correctness defect)** — `ee09115b` (fix, applied directly by the orchestrator, verified/mutation-tested by me — see "Post-Review Fix" below)

`git show --stat 8cda8650`:
```
 src/layouts/DashboardLayout.tsx                | 34 +++++++++++++++++++-------
 src/layouts/__tests__/DashboardLayout.test.tsx | 18 +++++++++++---
 2 files changed, 39 insertions(+), 13 deletions(-)
```

`git show --stat 47256c34`:
```
 src/components/InboxFilterBar.tsx  |  33 +++++++++-
 src/pages/Inbox.tsx                |  47 +++++++++++++-
 src/pages/__tests__/Inbox.test.tsx | 122 ++++++++++++++++++++++++++++++++++++-
 3 files changed, 196 insertions(+), 6 deletions(-)
```

## Verbatim Test Output

**Task 1 — `src/layouts/__tests__/DashboardLayout.test.tsx` after the fix:**
```
 RUN  v4.1.11 C:/Users/mandr/codepulse

 Test Files  1 passed (1)
      Tests  38 passed | 4 todo (42)
   Start at  20:09:45
   Duration  9.16s
```
(Was 37 passed | 4 todo before the fix, +1 for the new truncated-Inbox-badge test.)

**Task 2 — `src/pages/__tests__/Inbox.test.tsx` before the new describe block (baseline):**
```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

**Task 2 — after the new describe block, green:**
```
 RUN  v4.1.11 C:/Users/mandr/codepulse

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  20:16:29
   Duration  2.03s
```

**Mutation proof 1 — dropped `&& heldTotal.truncated === false` from `heldTotalPrecise` in `Inbox.tsx`:**
```
 ❯ |unit| src/pages/__tests__/Inbox.test.tsx (13 tests | 1 failed) 848ms
     × CONTROL for the above: a truncated countHeldUnacked does NOT render '9 of 46' -- falls back to the generic floor marker (D-04) 157ms

AssertionError: expected <span …(2)></span> to be null
+ Received:
<span aria-label="9 of 46 total" ...>9 of 46</span>

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
```
Reverted; re-ran green (13/13).

**Mutation proof 2 — dropped `&& truncated?.[tab.id] === true` from `isFloor` in `InboxFilterBar.tsx`:**
```
     × CONTROL for the above: no tab renders a truncation marker when listAll returns fewer rows than the page's limit 18ms
     × Held tab renders its plain count with no 'of M' and no marker while countHeldUnacked is unresolved (undefined) 14ms

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)
```
Both tests failing is the stronger result than the plan's single named target: the mutation makes `isFloor` fire for EVERY tab lacking a precise total (not just genuinely-truncated ones), so it correctly breaks both the under-limit control AND the unresolved-Held test — the two cases that most directly depend on `truncated` gating the marker. Reverted; re-ran green (13/13).

**Final `npm test` (full suite, after both tasks):**
```
 Test Files  365 passed | 17 skipped (382)
      Tests  5102 passed | 4 skipped | 195 todo (5301)
```

## Files Created/Modified

- `src/layouts/DashboardLayout.tsx` — `InboxCountBadge` swapped to `countHeldUnacked`; `truncated` branch changes both visible text and `aria-label`. `git diff` confined to `InboxCountBadge`'s body and its comment block (hunks at `:131-166`); plan 126-04's nav separator and `data-testid` lines are untouched.
- `src/layouts/__tests__/DashboardLayout.test.tsx` — Rule 1 fix: mock reference string and seeded shapes updated to `{count, truncated}`; added the truncated-Inbox-badge test.
- `src/pages/Inbox.tsx` — `INBOX_LIST_LIMIT` constant, `heldTotal` query, `listTruncated`/`heldTotalPrecise` derivations, `totals`/`truncated` maps passed to `InboxFilterBar`.
- `src/components/InboxFilterBar.tsx` — `totals`/`truncated` optional props; render branch adds precise "N of M" / generic "N+" on top of the untouched `count > 0` base case (97 lines total, `>= 80` required).
- `src/pages/__tests__/Inbox.test.tsx` — new `describe("Inbox — tab cap declarations (126-06, D-01/D-02/D-04)")` block, 5 tests.

## Decisions Made

- **Fixed `src/layouts/__tests__/DashboardLayout.test.tsx` even though it is not in the plan's `files_modified` list.** Task 1's query swap is an intentional, correct behavior change — the test's mock was asserting the OLD contract. This is a Rule 1 auto-fix (the test itself is broken by a change this plan requires), not scope creep: `npm test` was red immediately after Task 1's edit and stayed red until this file was updated. See the full-suite run recorded above.
- **Precise total wins over a floor marker whenever `total > count`,** not merely `total !== undefined` — this prevents an untruncated tab whose count happens to equal its own total from rendering the redundant `"9 of 9"`.
- **`aria-label` (not visually-hidden text) carries the accessible description** on the tab marker span, mirroring `AlertsCountBadge`'s existing pattern in `DashboardLayout.tsx` rather than introducing a second idiom in the same codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `src/layouts/__tests__/DashboardLayout.test.tsx` broke on Task 1's intentional query swap**
- **Found during:** Task 1, first `npm test` run after editing `DashboardLayout.tsx`
- **Issue:** The pre-existing badge tests mocked `api.inbox.listHeldUnacked` returning a row array and asserted `getAllByLabelText("3 unread in Inbox")` against `held.length`. After the swap to `countHeldUnacked`, the component's `useQuery` call no longer matched the mock's dispatch key, so the badge never rendered.
- **Fix:** Updated the mock reference string, seeded `{count, truncated}` objects instead of arrays in the three existing tests, and added a fourth test for the new truncated branch.
- **Files modified:** `src/layouts/__tests__/DashboardLayout.test.tsx`
- **Verification:** `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` — 38 passed | 4 todo (was 37 passed | 4 todo before this plan).
- **Committed in:** `8cda8650`

### Deferred (recorded per plan instruction, not a defect)

**The badge-and-tab single-render co-assertion (criterion 2's second half) is deferred to plan 126-09's live spec.** The plan's action text explicitly permits this: "If the layout's provider stack ... makes that disproportionate for this task, do NOT extract the component to make it testable — record ... and say exactly what blocked it." What blocked it: rendering `DashboardLayout` in the same test file as `Inbox` would require importing `DashboardLayout` and replicating roughly 15 additional `vi.mock()` calls that `src/layouts/__tests__/DashboardLayout.test.tsx` already carries for exactly this purpose (`AlertBanner`, `ErrorBoundary`, `OnboardingGuide`, `UserMenu`, `PrivacyShield`, `ThemeSwitcher`, `AmbientAudioPlayer`, `useAudioEvents`, `NotificationBell`, `useNotificationToasts`, `EStopButton`, `CommandPalette`, `AvatarUploader`, `sonner`), plus a `ResizeObserver` shim for Radix `Collapsible` and a `TOPIC_EVENT_MAP` re-export for `SignalHorizon`'s packet-subscription effect, plus a `MemoryRouter` wrapper — none of which `Inbox.test.tsx` currently needs. Duplicating that mock surface into this file to prove one additional property (that two components sharing a query render matching numbers, which is already structurally guaranteed by both consuming the identical `useQuery(api.inbox.countHeldUnacked)` call with no args) is disproportionate for this task. What WAS established at unit level: both components independently render `count`/`truncated` correctly from the SAME query shape (Task 1's tests for the badge, Task 2's tests for the tab), and the shared-subscription mechanism (Convex dedups identical `useQuery` calls client-side) is what makes them structurally incapable of disagreeing — not a coincidence two separately-tested branches happen to agree. The LIVE version of this assertion (one Playwright spec, one real page load, both numbers read from the actual rendered DOM against the real deployed `countHeldUnacked`) belongs to plan 126-09, after the deploy that plan owns, per the plan's own `<planner_corrections>` item 3.

**Total deviations:** 1 auto-fixed (Rule 1, test breakage from an intentional query-contract change) + 1 disclosed deferral (badge/tab co-render, explicitly authorized by the plan's own escape hatch) + 1 post-review HIGH correctness fix (below).
**Impact on plan:** None on scope or correctness of what this plan owns. The numeric half of criterion 2 (does the Held tab actually read the shared bounded query and render the reconciled number) is fully established at unit level with mutation-proven controls.

## Post-Review Fix — InboxCountBadge zero-guard was unsound (HIGH, fixed)

**Found:** after Task 1/2 landed, three independent adversarial reviews (relayed by the orchestrator) converged on a defect in `InboxCountBadge`'s own zero-guard — the same guard this plan wrote in Task 1, not pre-existing code.

**The defect.** `if (count === 0) return null;` hid the badge on any zero WITHOUT consulting `truncated`. `countHeldUnackedHandler` (`convex/inbox.ts`) reads `by_itemType` `eq(itemType, "held")` `.order("desc").take(HELD_COUNT_SCAN_CAP + 1)` — i.e. the NEWEST `HELD_COUNT_SCAN_CAP` held rows — and only THEN counts `ackedAt === undefined` **within that window**. So `{count: 0, truncated: true}` does not mean "nothing unread"; it means "nothing unread among the newest 2000". Once held history exceeds the cap and the newest 2000 happen to be fully acknowledged, older unacknowledged rows can still exist and the badge would silently vanish — a false-empty operator signal, exactly the "works today, breaks at scale with no signal" shape D-01 rejected when it refused a merely-larger silent cap for the tab counts. This plan would have closed SWEEP-01's unbounded-read defect and shipped a new silent-failure mode in its place.

**Fix applied (`src/layouts/DashboardLayout.tsx:174`, committed `ee09115b`, applied directly by the orchestrator and verified/tested by me):**
```
if (count === 0 && !truncated) return null;
```
Zero suppresses the badge ONLY when `truncated` is false (D-12 state 3 preserved exactly — `{count:0, truncated:false}` still hides). When `truncated` is true, execution falls through to the existing `truncated ? \`${count}+\` : \`${count}\`` branch, so a truncated zero renders `0+` with `aria-label="at least 0 unread in Inbox"` — reusing the SAME `N+`/"at least N" idiom already established for nonzero truncated counts, not a new display branch.

**Tests (both required by the fix, both present in `src/layouts/__tests__/DashboardLayout.test.tsx`):**
- Control (pre-existing, unchanged): `{count: 0, truncated: false}` → `screen.queryByLabelText(/unread in Inbox/)` is not in the document.
- New regression: `{count: 0, truncated: true}` → `screen.getAllByLabelText(/at least 0 unread in Inbox/)` returns 2 badges (desktop + mobile), each with text content `"0+"`.

**Mutation proof (I ran this personally, reverting the fix to the original defective guard):**
```
if (count === 0) return null; // MUTATION PROOF — reverted to the old unconditional guard
```
```
 ❯ getAllByLabelText ... src/layouts/__tests__/DashboardLayout.test.tsx:416:27
 Test Files  1 failed (1)
      Tests  1 failed | 38 passed | 4 todo (43)
```
Exactly the new regression test failed. Reverted to the fix; re-ran:
```
 Test Files  1 passed (1)
      Tests  39 passed | 4 todo (43)
```
`npx tsc --noEmit` exits 0. `npm test` (full suite, after the fix): **365 files passed | 17 skipped, 5103 tests passed | 4 skipped | 195 todo, 0 failed.**

### Known Limitation (carried forward, not fixed here — do not lose this)

**This guard makes the SYMPTOM safe. It does NOT make the count exact beyond the cap.** `{count: 0, truncated: true}` still means "zero unacked among the newest `HELD_COUNT_SCAN_CAP` (2000) held rows" — the badge now correctly refuses to assert a definite zero in that state and renders `0+` instead, but it still cannot report the TRUE unacked count once held history exceeds the cap.

**The sound remedy:** the bounded window needs to contain only unacknowledged rows, which requires a composite index on `inbox` — e.g. `["itemType", "ackedAt", "createdAt"]` — so the scan can find true unacked rows directly instead of scanning by recency and filtering afterward. Verified live: `inbox` currently has only `by_itemType: ["itemType", "createdAt"]` (`convex/schema.ts`). Adding that index is a `convex/schema.ts` change, and `convex/schema.ts` is held uncommitted by another active session in this shared checkout — explicitly off-limits to this plan per the orchestrator's instruction. **Not attempted; not silently dropped either** — this paragraph is the record so a future plan (or 126-09, or a dedicated follow-up) can pick it up with the exact index shape already scoped.

## Issues Encountered

- **Shared checkout:** `src/layouts/DashboardLayout.tsx` was confirmed clean (`git status --porcelain`) immediately before editing, per the orchestrator's warning. A `test(126-07)` commit (`930c9bc3`, another parallel session) landed on `master` between my two task commits — confirmed via `git show --stat` on both of my commits that neither swept in any file outside its own task's scope. No files from the orchestrator's disclosed dirty set (`convex/schema.ts`, `convex/bifrost.ts`, `convex/__tests__/bifrost.test.ts`, `src/components/CommandPalette.tsx`, `src/components/__tests__/CommandPalette.test.tsx`, `src/hooks/useCommandPaletteSearch.ts`, `src/pages/Bifrost.tsx`, `src/lib/bifrostPaletteRank.*`) were read, edited, or staged.
- No other issues. Both `npm test` full-suite runs after each task were clean on the first or second try; an earlier transient, unrelated `EmailDigestConfig.test.tsx` failure during Task 1's verification passed in isolation and on a clean full-suite rerun, confirming it was not caused by this plan's changes.

## User Setup Required

None — no external service configuration required. No deploy was performed (per the plan's hard constraint: plan 126-09 owns the single operator deploy for all of Phase 126's Convex work). This plan made zero Convex changes (`git diff -- convex/` confirmed empty of my own edits).

## Next Phase Readiness

- Plan 126-09's live spec can now assert the sidebar badge and `/inbox` Held tab reconcile against the REAL deployed `countHeldUnacked`, completing the deferred badge/tab co-render this plan established at unit level only.
- No blockers for downstream plans in this wave.

---
*Phase: 126-page-body-and-convex-read-defect-sweep*
*Completed: 2026-08-24*

## Self-Check: PASSED

- `src/layouts/DashboardLayout.tsx`, `src/layouts/__tests__/DashboardLayout.test.tsx`, `src/pages/Inbox.tsx`, `src/components/InboxFilterBar.tsx`, `src/pages/__tests__/Inbox.test.tsx` all confirmed present on disk and matching committed content.
- Commits `8cda8650`, `47256c34`, `930fa94b`, `ee09115b` all confirmed present via `git log --oneline -6 -- src/layouts/DashboardLayout.tsx src/layouts/__tests__/DashboardLayout.test.tsx`, interleaved with unrelated concurrent-session commits (`930c9bc3`, `f41c865a`, etc.) in this shared checkout — judged by explicit SHA, not `HEAD`, per this repo's own concurrent-commit lesson.
- Final working tree confirmed clean of my own pending changes: `git diff ee09115b -- src/layouts/DashboardLayout.tsx src/layouts/__tests__/DashboardLayout.test.tsx` is empty.
- Final `npm test` after the post-review fix: 365 files passed | 17 skipped, 5103 tests passed | 4 skipped | 195 todo, 0 failed.
