---
phase: 109-per-agent-engine-ui
plan: 08
subsystem: ui
tags: [react, convex, swap-history, brain-swap, collapsible, radix]

# Dependency graph
requires:
  - phase: 109-02
    provides: "listGlobal bounded Convex query, mergeSwapHistory pure helper (convex/controlVerbSwapsFilters.ts)"
  - phase: 109-04
    provides: "useProfileBrainOverrides() (src/hooks/useResolvedBrain.ts) — the D-12 pinned note's only legitimate source"
  - phase: 109-06
    provides: "AgentProfileRows' resolveActiveBrain-based engine label, mounted in the same per-profile row this plan's disclosure nests beneath"
provides:
  - "useCombinedSwapHistory(profileId) (src/hooks/useControlVerbSwaps.ts) — merges listByScope + listGlobal, brain-swap-filtered, capped, with a true pre-truncation totalCount"
  - "SwapHistoryList (src/components/brains/SwapHistoryList.tsx) — the one row-rendering implementation shared by GlobalSwapModal and Settings"
  - "Settings' per-profile collapsible swap-history disclosure (D-10), giving TELE-02's built-but-inert readout a real host"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A hook that returns a combined, re-capped, honest-total read from two independently-bounded Convex queries (each .take()-bounded server-side, merged and re-capped client-side)"
    - "A per-row disclosure extracted into its own component (not inlined in a .map() callback) specifically so its local open state and its own useQuery-backed count read are legal per-row hook calls"
    - "First real consumer of src/components/ui/collapsible.tsx in this codebase's brains surfaces, following ReminderList.tsx's established Collapsible/CollapsibleTrigger/CollapsibleContent composition"

key-files:
  created:
    - src/components/brains/SwapHistoryList.tsx
    - src/components/brains/SwapHistoryList.test.tsx
  modified:
    - src/hooks/useControlVerbSwaps.ts
    - src/hooks/useControlVerbSwaps.test.ts
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/brains/GlobalSwapModal.test.tsx
    - src/pages/Settings.tsx
    - src/pages/Settings.test.tsx

key-decisions:
  - "Filtering (filterBrainSwaps) is applied to each of listByScope's/listGlobal's results BEFORE mergeSwapHistory, not after — so totalCount reports the count of brain swaps an operator could actually see, never a raw row count that silently includes voice rows the list won't render."
  - "SwapHistoryList drops the old SwapHistorySection's standalone 'Recent swaps' <p> label. UI-SPEC section H's row anatomy and copywriting-contract table both omit it, and the new outer Collapsible trigger already reads 'Swap history (N)' directly above the expanded content — keeping the old label would be redundant/stale copy inside the same disclosure."
  - "The per-profile collapsible's count badge (ProfileSwapHistorySection) and SwapHistoryList's own row read (mounted inside CollapsibleContent) each call useCombinedSwapHistory independently, rather than one being threaded down as a prop. This lets the badge show the true count while the section is collapsed and SwapHistoryList is unmounted; Convex dedupes identical useQuery calls at the client-cache layer, so the double subscription is not a real cost."
  - "GLOBAL badge text is literal 'Global' (not 'GLOBAL') styled with an `uppercase` CSS class, mirroring BrainHeaderBadge.tsx's existing chip DOM exactly ('same treatment as the header badge's existing Global chip' — UI-SPEC section H), rather than hardcoding the already-uppercase string."

requirements-completed: [TELE-02]

# Metrics
duration: 10min
completed: 2026-08-09
---

# Phase 109 Plan 08: Settings Swap-History Host Summary

**`useCombinedSwapHistory` merges per-profile + global swap rows into one capped, honestly-counted read; a new shared `SwapHistoryList` (GLOBAL badge + live-derived pinned note) replaces `GlobalSwapModal`'s inline row body; Settings' per-profile rows each get a collapsed-by-default disclosure showing it.**

## Performance

- **Duration:** 10 min (11:58:27 → 12:08:31, task commits only)
- **Started:** 2026-08-09T11:58:27-04:00 (approx, first task commit)
- **Completed:** 2026-08-09T12:08:31-04:00
- **Tasks:** 3/3 completed
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- `useCombinedSwapHistory(profileId)` — new hook in `useControlVerbSwaps.ts` issuing two bounded `useQuery` reads (`listByScope`/`listGlobal`, each skipped via `"skip"` when `profileId` is undefined), filtering both to brain swaps before merging via 109-02's `mergeSwapHistory`, returning `{ rows, totalCount, atCap }` — never `undefined`.
- `SwapHistoryList` — the one row-rendering implementation, lifted from `GlobalSwapModal`'s `SwapHistorySection` body and extended with a `GLOBAL` badge (rows sourced from the global query), a D-12 live-derived pinned note (`useProfileBrainOverrides()[profileId]`, never reconstructed from history rows), and the new D-10/D-11 empty-state/truncation copy. `SwapHistorySection` now delegates to it, preserving its `profileId === undefined` render-nothing gate and its existing `GlobalSwapModal` mount.
- Every Settings per-profile row now carries a collapsed-by-default `Collapsible` disclosure (`ProfileSwapHistorySection`) reading `[Chevron] [History icon] "Swap history (N)"`, where N is the TRUE pre-truncation combined count; expanding renders `SwapHistoryList` for that row's `profileId`. No new route, no nav entry.

## Task Commits

Each task was committed atomically:

1. **Task 1: Combined bounded read in useControlVerbSwaps** - `7c1e917e` (feat)
2. **Task 2: Extract one shared SwapHistoryList with the GLOBAL badge and the live pinned note** - `fadd8ac9` (feat)
3. **Task 3: Mount the collapsible history section under each Settings per-profile row** - `f88951f3` (feat)

**Plan metadata:** pending (this commit, after STATE.md/ROADMAP.md updates)

## Files Created/Modified

- `src/hooks/useControlVerbSwaps.ts` — added `useCombinedSwapHistory`, `CombinedSwapHistory`/`CombinedSwapHistoryRow` types; extended the module docstring with D-11's combined-read rationale and cap arithmetic.
- `src/hooks/useControlVerbSwaps.test.ts` — added 6 hook-level tests for `useCombinedSwapHistory` (mocking `convex/react`'s `useQuery`, following `useActiveEngine.test.ts`'s idiom): skip-both-queries, call-shape (`{profileId}`/`{}`), 20+20→20/40/true paired with a 3+2→5/5/false control, voice-filter-before-merge, origin discriminant.
- `src/components/brains/SwapHistoryList.tsx` (new) — `SwapHistoryList({ profileId })`, sourcing data from `useCombinedSwapHistory` and pin state from `useProfileBrainOverrides`.
- `src/components/brains/SwapHistoryList.test.tsx` (new) — 10 tests: render-nothing gate (+ hook still called), GLOBAL badge on a global row paired with a no-badge scoped-row control, pinned note live-vs-reconstructed paired control, empty state, at-cap/singular/plural captions, outcome rendering (refusal + success).
- `src/components/brains/GlobalSwapModal.tsx` — `SwapHistorySection` now delegates to `SwapHistoryList`; removed the now-dead `formatSwapTime` function and the `describeSwapOutcome`/`filterBrainSwaps`/`SWAP_HISTORY_CAP`/`useControlVerbSwaps` imports (no longer used in this file); added `SwapHistoryList` import; updated the mount-site comment to reflect the real host now existing.
- `src/components/brains/GlobalSwapModal.test.tsx` — added `useProfileBrainOverrides` to the `useResolvedBrain` mock (SwapHistoryList reads it); added a `useCombinedSwapHistory` mock alongside the existing `useControlVerbSwaps` mock; rewrote the "swap-history section" describe block against the new hook shape and D-11/D-12 copy; the voice-filter-guard test moved to `useControlVerbSwaps.test.ts` (now covers the real hook directly).
- `src/pages/Settings.tsx` — added `ProfileSwapHistorySection` (a separate per-row component holding its own `open` state and its own `useCombinedSwapHistory` count read); mounted it beneath each per-profile row inside `AgentProfileRows`' `.map()`, wrapped in a new outer `<div>` per row.
- `src/pages/Settings.test.tsx` — added a `useCombinedSwapHistory` mock keyed by profile id (real `SwapHistoryList` renders inside the expanded disclosure, not mocked); 4 new tests: collapsed-until-activated, badge/caption honest numeric disagreement at the display cap, two profiles' disclosures opening independently, no nav wiring.

## Decisions Made

See frontmatter `key-decisions`. In summary: filter-then-merge order for `totalCount` honesty; dropped the redundant "Recent swaps" label per UI-SPEC's copywriting contract (which doesn't list it) now that the outer trigger carries the section heading; two independent `useCombinedSwapHistory` subscriptions (badge + list) rather than prop-threading, relying on Convex's client-side query dedup; `Global` (not `GLOBAL`) badge text with an `uppercase` CSS class, matching the header badge's existing chip DOM exactly.

## Deviations from Plan

None — plan executed as written. The plan's own `<plan_text_is_a_draft>`-style corrections were all already resolved by upstream plans (109-02/109-04/109-06/109-07), which this plan consumed as documented rather than rebuilding.

## Test-Count Delta vs. Baseline

Baseline (measured before this plan started, on this exact tree): **283 test files passed | 17 skipped, 3717 tests passed | 193 todo.**

After this plan: **284 test files passed | 17 skipped (+1 new file), 3736 tests passed | 193 todo (+19 net)** — zero failures, zero regressions.

| File | Delta | What changed |
|---|---|---|
| `src/hooks/useControlVerbSwaps.test.ts` | +6 | `useCombinedSwapHistory` hook-level coverage |
| `src/components/brains/SwapHistoryList.test.tsx` (new) | +10 | All new |
| `src/components/brains/GlobalSwapModal.test.tsx` | -1 | Swap-history describe block rewritten against the new hook (10 tests, was 11 — voice-filter-guard test moved to `useControlVerbSwaps.test.ts`, already counted there via the real hook's own coverage) |
| `src/pages/Settings.test.tsx` | +4 | Collapsible disclosure coverage |

`npx tsc --noEmit` exits 0. `npx vitest run` (full suite): 284 test files passed | 17 skipped, 3736 tests passed | 193 todo, zero failures.

## Issues Encountered

None. Radix's `CollapsibleContent` unmounts its children when closed (confirmed empirically via the "collapsed on first render — no history rows in the document until activated" test, not assumed from documentation), which is exactly the behavior D-10's acceptance criteria require.

## Known Stubs

None — this plan wires only real Convex-backed reads (`listByScope`/`listGlobal`, both already live per 109-02) and a real live-state source (`useProfileBrainOverrides`, live per 109-01/109-04). No stub, fixture, or build-time flag was introduced.

## Threat Flags

None. This plan adds only reads (`useCombinedSwapHistory` issues two `useQuery` calls, no `useMutation`; `record` in `convex/controlVerbSwaps.ts` stays `internalMutation`, unchanged), both bounded server-side at `SWAP_HISTORY_CAP` and re-capped client-side with the true count stated on screen (T-108-12 mitigation). `mergeSwapHistory`/`isBrainSwap`/`SWAP_HISTORY_CAP` are imported only from `convex/controlVerbSwapsFilters.ts` (WR-02 boundary held — `grep -rn "from \"../../convex/controlVerbSwaps\"" src/` returns zero). The D-12 pinned note is derived from live override state only (T-109-21 mitigation), guarded by a paired live-vs-reconstructed test. No new network endpoint, auth path, or schema change was introduced. No package was installed (`collapsible`/`badge` were already present in `src/components/ui/`).

## User Setup Required

None — no external service configuration required. This plan is CodePulse-only, consuming Convex/backend surfaces (`listGlobal`, `profile_overrides` on `swap.state`) that earlier plans in this phase already delivered and, per those plans' own summaries, require the astridr-agent container rebuild already flagged for this phase's live-verification gate.

## Next Phase Readiness

- TELE-02's swap-history readout is no longer wired-but-inert: `SwapHistorySection`/`SwapHistoryList` now has a real, populated host (Settings' per-profile rows) in addition to its always-render-nothing `GlobalSwapModal` mount.
- `useCombinedSwapHistory` and `SwapHistoryList` are stable, tested, single implementations — any future per-profile audit surface should consume them rather than re-deriving a merge/render.
- This was the last autonomous plan in Phase 109's execution sequence per the dispatch context (`<baseline_established>`/`<what_already_landed_this_phase>`); no further plans in this phase are pending from this executor's scope.

---
*Phase: 109-per-agent-engine-ui*
*Completed: 2026-08-09*
