---
phase: 124-shell-information-architecture
plan: 08
subsystem: ui
tags: [react, convex, tailwind, status-badge, header]

requires:
  - phase: 124-shell-information-architecture
    provides: "124-03's alerts.countBySeverity (bounded, truncated flag), 124-06's AlertsCountBadge/InboxCountBadge SectionErrorBoundary pattern, 124-07's header right-zone layout"
provides:
  - "Header system chip (Nominal/Attention/Critical/Offline) composed client-side from data the shell already subscribes to"
affects: [124-09, 124-10]

tech-stack:
  added: []
  patterns:
    - "Client-derived health chip: no new backend, StatusBadge composition, undefined-preserving source, own SectionErrorBoundary with a quiet fallback"

key-files:
  created: []
  modified:
    - src/layouts/DashboardLayout.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx

key-decisions:
  - "convex/health.ts confirmed (live, with a control against convex/alerts.ts) to export zero public queries — D-11's no-new-backend premise holds"
  - "Shipped the plan's default label \"Offline\" for the disconnected case, not the alternate \"Reconnecting\""
  - "Read alerts.countBySeverity directly via useQuery (no useAlertCounts() hook exists in this repo — plan's 'either is fine' reference to it was aspirational, not live)"
  - "Reused the existing BadgeUnavailableDot fallback component for the chip's error boundary rather than inventing a new one"

patterns-established:
  - "Chip resolution order: connection-flag check first (wins over everything), then undefined-preserving data check (render nothing), then severity checks, then default — matches the D-12 loading-honesty pattern applied one layer above the sidebar badges"

requirements-completed: [SHELL-01]

duration: 12min
completed: 2026-08-21
---

# Phase 124 Plan 08: Header System Chip Summary

**Client-derived Nominal/Attention/Critical/Offline chip in the header, composed from `StatusBadge` and the same `alerts.countBySeverity` subscription the Alerts sidebar badge already reads — no new Convex query, own error boundary, renders nothing rather than a fabricated "Nominal" while data is unresolved.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments
- Added `SystemChip()`, a local component in `DashboardLayout.tsx`, mounted in the header right zone between the brain badge and the notification bell (per D-07's enumeration), wrapped in its own `SectionErrorBoundary name="System status"` with a `BadgeUnavailableDot` fallback.
- Eight new test cases assert all five chip outcomes (Offline, unresolved/nothing, Nominal, Attention, Critical x2 for both `||` sides) plus an Offline-beats-Critical precedence case and a chip/sidebar-badge consistency case — each positive case asserts the *absence* of the other three state words, not just presence.
- Mutation-tested the fabricated-confidence guard: temporarily made the unresolved branch return "Nominal", confirmed the render-nothing test failed, restored, confirmed a clean (empty) diff and a green rerun.

## Task Commits

1. **Task 1: Compose the system chip and wire it into the right zone** - `e4b6571e` (feat)
2. **Task 2: Assert all five chip outcomes, including the render-nothing case** - `83c5dd2d` (test)

**Plan metadata:** this commit (docs: plan summary)

## Files Created/Modified
- `src/layouts/DashboardLayout.tsx` — added `SystemChip()` (client-derived, no backend) and mounted it in the header right zone with its own error boundary.
- `src/layouts/__tests__/DashboardLayout.test.tsx` — new `describe("DashboardLayout system chip (D-11/D-12/D-13, Phase 124 Plan 08)")` block, 8 cases.

## Verification Evidence

### `convex/health.ts` export probe (Task 1 action, before writing any code)

```
$ grep -n "export const" convex/alerts.ts
22:export const create = mutation({
42:export const acknowledge = mutation({
56:export const listActive = query({
71:export const listAll = query({
84:export const listAllPaginated = query({
94:export const listBySource = query({
124:export const countBySeverity = query({
147:export const dismissAll = mutation({
166:export const autoAcknowledgeStaleInternal = internalMutation({
191:export const listActiveGrouped = query({
220:export const evaluate = mutation({
693:export const evaluateInternal = internalMutation({
940:export const getLastCriticalEvalTimestamp = internalQuery({
952:export const evaluateCriticalInternal = internalMutation({
1149:export const getById = internalQuery({
1158:export const updateWebhookStatus = internalMutation({

$ grep -n "export const" convex/health.ts
5:export const detectStaleSessions = internalMutation({
25:export const detectStaleAgents = internalMutation({
48:export const healthCheck = httpAction(async (ctx, _request) => {
```

Control discriminates: `alerts.ts` shows 8 public `query`s (line pattern `= query(`), `health.ts` shows zero — only `internalMutation`/`httpAction`. D-11's premise holds; no public query exists to read instead.

### Chip component body — no `--primary`, no `text-primary`

The `SystemChip()` function (quoted in full, `src/layouts/DashboardLayout.tsx`):

```tsx
function SystemChip() {
  const { isWebSocketConnected } = useConvexConnectionState();
  const counts = useQuery(api.alerts.countBySeverity);

  if (!isWebSocketConnected) {
    return <StatusBadge status="idle" tier="quietest" label="Offline" />;
  }
  if (counts == null) return null;

  if (counts.critical > 0 || counts.error > 0) {
    return <StatusBadge status="error" tier="strong" label="Critical" />;
  }
  if (counts.warning > 0) {
    return <StatusBadge status="warn" tier="quiet" label="Attention" />;
  }
  return <StatusBadge status="ok" tier="quiet" label="Nominal" />;
}
```

No `className` is passed at any of the four `StatusBadge` call sites and no literal class string appears in this function — every colour resolves through `StatusBadge`'s own `styleFor()` token lookup (`--status-ok`/`--status-warn`/`--status-error`/`muted-foreground`, never `--primary`).

### Acceptance-criteria greps (Task 1, run against the committed file)

```
grep -c "Nominal" src/layouts/DashboardLayout.tsx    -> 5
grep -c "Attention" src/layouts/DashboardLayout.tsx  -> 2
grep -c "Critical" src/layouts/DashboardLayout.tsx   -> 2
grep -c "Offline" src/layouts/DashboardLayout.tsx    -> 3
grep -c "SectionErrorBoundary" src/layouts/DashboardLayout.tsx -> 11 (>= 4 required)
grep -c "aria-live" src/layouts/DashboardLayout.tsx  -> 0
git diff --exit-code -- convex/health.ts             -> exit 0 (no backend touched)
```

### Scope-fence checks (both tasks combined, run after each commit)

```
git diff --name-only -- convex/ | wc -l                                       -> 0
git diff -- src/layouts/DashboardLayout.tsx | grep -c '^[-+].*min-h-14'       -> 0
git diff -- src/lib/__tests__/navRegistry.routes.test.ts | wc -l              -> 0
```

`⋯` menu untouched — still exactly the four items (theme, privacy, CRT, ambient audio), no Help entry (verified: this plan's diff touches only the code above and below the `DropdownMenu` block, never inside it).

### Hardcoded hex check (both tasks' combined diff against the pre-plan commit)

```
git diff HEAD~1 -- src/layouts/DashboardLayout.tsx src/layouts/__tests__/DashboardLayout.test.tsx \
  | grep -oE '#[0-9a-fA-F]{3,8}' | wc -l
-> 0
```

### Test run (Task 2, before mutation)

```
$ npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx
 Test Files  1 passed (1)
      Tests  30 passed | 4 todo (34)
```

8 new chip cases, all 22 pre-existing tests green.

### Mutation-test proof (the fabricated-confidence guard)

Changed `if (counts == null) return null;` to
`if (counts == null) return <StatusBadge status="ok" tier="quiet" label="Nominal" />; // MUTATION-TEST-ONLY`
and reran the render-nothing case in isolation:

```
$ npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx -t "counts unresolved"
 FAIL  ... WS connected, counts unresolved (undefined) -> no chip text at all renders
 expected document not to contain element, found <span ...>Nominal</span> instead
 Tests  1 failed | 33 skipped (34)
```

Restored the original line, confirmed `git diff -- src/layouts/DashboardLayout.tsx` was **empty** (byte-identical to the Task 1 commit) before staging Task 2, then reran the full file green (30 passed, above).

### One quoted test case (acceptance criterion: "each positive case asserts absence of the other three")

```tsx
it("WS disconnected -> Offline, and none of Nominal/Attention/Critical renders", () => {
  mockChip({ connected: false, counts: { info: 0, warning: 0, error: 0, critical: 0, truncated: false } });
  renderLayout();
  assertOnly("Offline");
});
```

Where `assertOnly(present)` asserts `present` renders (`getAllByText`) AND every other word in `["Nominal", "Attention", "Critical", "Offline"]` is `queryByText(...).not.toBeInTheDocument()`. All eight new cases use this helper.

### Full `npm test` at plan end

```
Test Files  1 failed | 348 passed | 17 skipped (366)
     Tests  1 failed | 4924 passed | 195 todo (5120)
```

The one failure is in `src/pages/KnowledgeGraph.test.tsx` (`GLXY-02/D-06 aggregate: every effect branch logs its own distinct message tag` — a `seenTags` Set missing `"ego-lens-fallback"`), a 3D knowledge-graph answer-sync test wholly unrelated to this plan's files. Confirmed pre-existing and out of scope: `git log --oneline -3 -- src/pages/KnowledgeGraph.test.tsx` shows its last change is `db9dced6` (Phase 190 plan 08), an ancestor of this plan's first commit (`e4b6571e`), and neither of this plan's two commits touches that file or anything it imports. Per the deviation rules' scope boundary, left unfixed and not re-litigated — flagging here rather than in a separate deferred-items.md since it is the plan's only such finding.

### `npx tsc --noEmit`

Exits 0, both after Task 1 and after Task 2.

## Decisions Made

- **`convex/health.ts` premise re-verified live, not inherited** — confirmed zero public queries, control against `convex/alerts.ts`'s 8 public queries. No backend added.
- **Shipped "Offline"**, the plan's stated default, not the "Reconnecting" alternate — matches `DashboardLayout.tsx`'s existing `"Convex: reconnecting"` string closely enough in spirit but the plan's locked default word is what shipped.
- **`useAlertCounts()` does not exist in this repo.** The plan's interfaces block offered it as an alternative to a raw `useQuery` call ("either is fine"), citing "the D-12-corrected `useAlertCounts()` from plan 124-02." A repo-wide glob (`**/useAlertCounts*`) found no such file. Read `alerts.countBySeverity` directly via `useQuery`, exactly matching `AlertsCountBadge`'s own existing call in the same file — this preserves `undefined` correctly and needed no new hook.
- **Reused `BadgeUnavailableDot`** for the chip's error-boundary fallback rather than building a new header-specific fallback. It is a generic `<span aria-label>` + dimmed dot, already used by the two sidebar badges, and fits the header slot without layout changes.
- **Corrected the plan's D-13 count**: the plan's Task 1 action and `<interfaces>` text call this "the third shell-level subscription to receive one," but Active Brain (pre-existing) plus Inbox and Alerts (both added in 124-06) already account for three — this chip is the **fourth**. Recorded as a code comment at the `SystemChip` definition and here; does not change the acceptance criterion (`SectionErrorBoundary` count >= 4), which was written correctly even though the surrounding prose undercounted.

## Deviations from Plan

None requiring a Rule 1-4 classification — the two corrections above (missing `useAlertCounts()` hook, off-by-one "third" vs "fourth" boundary count) are plan-text corrections per the "plan is a draft" instruction, not code deviations. No architectural changes, no new dependencies, no backend touched.

## Issues Encountered

One pre-existing, unrelated test failure in `src/pages/KnowledgeGraph.test.tsx` found during the full `npm test` run — documented above under "Full `npm test` at plan end" with the evidence establishing it predates and is untouched by this plan. Left as-is per the scope boundary in the deviation rules.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 124-09 (SYS/LAT relocation) can proceed: this plan did not touch SYS/LAT, and the `⋯` menu's four items remain unchanged and un-relocated.
- 124-10 (header geometry) has an additional item to measure: the scope fence held (`min-h-14` diff = 0), so the min-content-width re-measurement 124-10 owns still needs to happen with the chip present.
- The one pre-existing `KnowledgeGraph.test.tsx` failure remains open for whichever phase owns that surface (unrelated to 124's shell/IA scope).

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
