---
phase: 103-brain-swap-control-surface
plan: 11
subsystem: ui
tags: [react, cmdk, accessibility, brain-swap, testing, playwright]

# Dependency graph
requires:
  - phase: 103-brain-swap-control-surface
    provides: BrainPicker.tsx / BrainPickerRow.tsx (103-05/103-03), GlobalSwapModal (103-04), the cmdk Command primitive and CommandPalette.tsx onSelect precedent
provides:
  - Keyboard-operable brain picker — search -> arrow -> Enter now genuinely dispatches a swap (CR-02 closed)
  - Shared needsCostConfirm predicate as the single source of truth for the expand-to-confirm branch, consumed identically by the mouse and keyboard paths
  - BrainPickerRow with exactly one focusable element per row (WR-03 closed) and a health word that survives via the row button's accessible name
  - Generation-guarded catalogue fetch immune to rapid-scope-toggle staleness (WR-01 closed)
  - Keyboard-driven E2E leg in brain-swap.spec.ts alongside the existing mouse leg
affects: [103-12, 103-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single activation entry point (handleActivate) shared by cmdk CommandItem.onSelect (keyboard) and a row's own button (mouse), with mouse-side event.stopPropagation() on every internal button click to prevent the click from ALSO bubbling into cmdk's own click-select handler and double-firing the shared function"
    - "Exported pure predicate (needsCostConfirm) as the single source of truth for a UI branch decision consumed from two different components"
    - "Real-timer flush (setTimeout, not bare microtask ticks) required to honestly assert a stale-response guard held, since a couple of `await Promise.resolve()` calls is not enough ticks to reach an async continuation reliably"

key-files:
  created: []
  modified:
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
    - src/components/brains/BrainPickerRow.tsx
    - src/components/brains/BrainPickerRow.test.tsx
    - e2e/brain-swap.spec.ts

key-decisions:
  - "handleActivate lives in BrainPicker.tsx (the parent) and is the ONLY caller of handleSelect — BrainPickerRow's own local branch logic (needsConfirm -> expand vs. dispatch) was left byte-identical; only what the row's onSelect PROP is bound to changed (handleSelect -> handleActivate), so the row's own click handlers automatically route through the shared activation function with zero row-side logic changes"
  - "event.stopPropagation() added to all three of BrainPickerRow's button handlers (header button, Cancel, Confirm swap) — required for correctness, not style: cmdk's CommandItem div has its own native onClick that calls the same onSelect prop, so an unguarded mouse click would bubble into it and double-fire handleActivate, and an unguarded Cancel click would bubble into a false confirmation (parent still sees expandedId===entry.id and treats the bubbled call as confirming)"
  - "Second Enter / second activation on the SAME row (not specifically the Confirm button) now confirms an expanded row — a deliberate simplification versus the pre-103-11 row-local code (which only confirmed on the explicit Confirm button click): both mouse and keyboard now route through one function, so a second activation on the same entry is unconditionally treated as confirmation once expandedId===entry.id, matching the plan's explicit 'keyboard parity: two deliberate actions, never one' framing"
  - "Global-scope entries never trigger the cost-confirm branch (normalizeGlobalCatalogueEntry tags every live entry costTier: normal, pre-existing design) — so a global-scope keyboard Enter reaches GlobalSwapModal in exactly one activation, matching the mouse path and UI-SPEC §3's no-double-friction rule"
  - "Health dot's Tooltip now wraps the row's whole button (one trigger, one focusable element) instead of a separately-focusable nested span; the health word is folded into the button's own aria-label alongside engine name, billing label, and quota state so non-color redundancy survives"
  - "WR-01's generation guard resets on the SUCCESS/response side only (checked before every setEntries/setFetchError call) — the synchronous 'reset to loading' calls at the top of fetchCatalogue are left unguarded since they always correspond to the newest generation by construction (no interleaving is possible before the first await)"
  - "The rapid-scope-toggle unit test needed a real setTimeout flush (50ms), not a couple of `await Promise.resolve()` ticks, to honestly prove the guard holds — verified this empirically: the same negative assertion passed vacuously with only microtask ticks even when the guard was mutated away, because the stale response's continuation hadn't actually run yet by assertion time"
  - "3 commits were reconstructed via clean intermediate file states (not raw incremental edits) so each task lands as a genuinely atomic, individually-buildable/testable commit despite BrainPicker.tsx and BrainPickerRow.tsx each carrying content from two of the three tasks"

patterns-established:
  - "Shared-predicate-across-components pattern for keyboard/mouse parity: export the pure boolean decision function from the child component, import it into the parent's activation handler — never duplicate the literal condition"
  - "cmdk CommandItem wrapping a component with its own internal button(s): every internal button MUST stopPropagation to avoid double-firing through cmdk's own bubbled click-select handler once CommandItem.onSelect is wired"

requirements-completed: [BSC-02, BSC-03]

# Metrics
duration: ~65min
completed: 2026-07-29
---

# Phase 103 Plan 11: Keyboard-Operable Brain Picker (CR-02, WR-01, WR-03) Summary

**Wired cmdk `CommandItem.onSelect` through a shared `handleActivate` branch so search → arrow → Enter genuinely swaps a brain without bypassing the cost-confirm or D-15 global-confirm gates, removed a dead/invalid nested focusable health-dot tab stop, and generation-guarded the scope-driven catalogue fetch against rapid-toggle staleness.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 3/3 completed
- **Files modified:** 5 (`BrainPicker.tsx`, `BrainPicker.test.tsx`, `BrainPickerRow.tsx`, `BrainPickerRow.test.tsx`, `e2e/brain-swap.spec.ts`)

## Accomplishments

- **CR-02 closed:** `BrainPicker.tsx`'s `CommandItem`s never wired `onSelect`, so the picker's own designed primary interaction (autoFocus search input → arrow-navigate → Enter) was completely non-functional — only a direct mouse click on a row's nested button ever dispatched a swap. `handleActivate` is now the single activation entry point both the keyboard path (`CommandItem.onSelect`, driven by cmdk's own custom-event dispatch on Enter — never a bubbled click) and the mouse path (`BrainPickerRow`'s own button, which stops propagation on every internal click) call. The expand-to-confirm branch and the D-15 global confirm gate exist in exactly one place each, so mouse and keyboard can never decide differently.
- **WR-03 closed:** The health-dot `Tooltip` trigger was a `<span tabIndex={0}>` nested inside the row's own `<button>` — an invalid HTML content model and a dead keyboard tab stop directly at odds with the keyboard fix above. The dot is now purely presentational (`aria-hidden`, no `tabIndex`); the `Tooltip` wraps the button itself; the health word survives via the button's own `aria-label` alongside the engine name, billing label, and quota state. Each row now exposes exactly one focusable element.
- **WR-01 closed:** `fetchCatalogue` had no request sequencing — a rapid "This profile" ↔ "All profiles" toggle could let a slower, superseded response win and leave the rendered catalogue on one axis while `scope` (and the dispatch branch keyed on it) pointed at the other. A generation-ref guard now discards any response whose captured generation is no longer current, checked on both branches (`global`/`profile`) and both paths (success/error).
- **Keyboard E2E leg added:** `e2e/brain-swap.spec.ts` now drives a second, full round trip via `ArrowDown` + `Enter` (never `.click()`) alongside the existing mouse-driven leg — the mouse-only spec is exactly why CR-02 shipped undetected.
- **Both required mutation checks performed live** (not just described): removing `CommandItem`'s `onSelect` makes exactly the 3 new keyboard tests fail while every pre-existing mouse test still passes; removing the WR-01 generation guard makes the rapid-toggle test fail with the stale data actually landing in the DOM. Both restored and re-verified green afterward.

## Task Commits

Each task was committed atomically, with clean intermediate file states reconstructed so each commit is independently buildable and testable despite `BrainPicker.tsx`/`BrainPickerRow.tsx` each carrying content spanning two tasks:

1. **Task 1: Wire CommandItem.onSelect through the shared activation branch (CR-02)** — `51282862` (fix)
2. **Task 2: Remove the nested focusable element from the catalogue row (WR-03)** — `18af9afa` (fix)
3. **Task 3: Staleness-guard the scope-driven catalogue fetch + keyboard E2E leg (WR-01)** — `2b8f0c28` (fix)

## Files Created/Modified

- `src/components/brains/BrainPicker.tsx` — `handleActivate` single activation entry point; `CommandItem.onSelect` wiring; `fetchGenRef` generation guard on `fetchCatalogue`
- `src/components/brains/BrainPicker.test.tsx` — 3 real-cmdk keyboard tests (profile/normal, profile/expensive two-Enter confirm, global/zero-`swap.set`) + 1 rapid-scope-toggle staleness test; `scrollIntoView` jsdom stub
- `src/components/brains/BrainPickerRow.tsx` — exported `needsCostConfirm` predicate; `stopPropagation` on all internal button handlers; health dot made presentational; `Tooltip` moved to wrap the row button; composed `aria-label`
- `src/components/brains/BrainPickerRow.test.tsx` — health-dot tests rewritten to assert the button's accessible name + a single-focusable-element test + a direct `needsCostConfirm` unit test
- `e2e/brain-swap.spec.ts` — keyboard-driven selection leg (search → ArrowDown → Enter)

## Decisions Made

See frontmatter `key-decisions` above for the full list. Highlights:
- `handleActivate` is the ONLY caller of `handleSelect`; `BrainPickerRow`'s own local branch logic was left byte-identical — only the `onSelect` prop binding changed, so the row automatically routes through the shared function with zero row-side logic edits.
- `stopPropagation()` on every `BrainPickerRow` button click is load-bearing, not cosmetic: without it, a mouse click on the header button would double-fire `handleActivate` (once via the row's own handler, once via cmdk's own bubbled click-select now that `CommandItem.onSelect` is wired), and a Cancel click would bubble into a false confirmation.
- The rapid-scope-toggle unit test required a real `setTimeout` flush, not a couple of `await Promise.resolve()` ticks — verified empirically that a bare microtask flush produces a vacuous pass even with the guard mutated away.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing doc-comment literal collided with this plan's own grep-gate acceptance criterion**
- **Found during:** Task 1
- **Issue:** `BrainPicker.tsx`'s `normalizeGlobalCatalogueEntry` doc comment quoted the literal `entry.costTier === "expensive" || "unknown"` string in prose, which collided with the plan's own acceptance-criteria grep (`grep -c 'costTier === "expensive"' src/components/brains/BrainPicker.tsx` must return 0). Same failure class as prior plans in this phase (103-01/103-03/103-07/103-09).
- **Fix:** Reworded the comment to reference the shared `needsCostConfirm` predicate by name instead of quoting the literal condition.
- **Files modified:** `src/components/brains/BrainPicker.tsx`
- **Verification:** `grep -c 'costTier === "expensive"' src/components/brains/BrainPicker.tsx` returns 0; full suite still green.
- **Committed in:** `51282862` (Task 1 commit)

**2. [Rule 3 - Blocking] jsdom lacks `scrollIntoView`, breaking cmdk's own ArrowDown selection-change handler**
- **Found during:** Task 1 (writing the first keyboard test)
- **Issue:** cmdk calls `element.scrollIntoView()` internally whenever the arrow-key-driven selection changes; jsdom doesn't implement it, throwing `TypeError: e.scrollIntoView is not a function` inside a React layout effect.
- **Fix:** Added a guarded `Element.prototype.scrollIntoView = () => {}` stub in `BrainPicker.test.tsx`'s existing `beforeAll` block, matching the file's own `ResizeObserver` stub pattern.
- **Files modified:** `src/components/brains/BrainPicker.test.tsx`
- **Verification:** Keyboard tests run without the TypeError.
- **Committed in:** `51282862` (Task 1 commit)

**3. [Rule 1 - Bug] Ambiguous search term let cmdk's fuzzy filter re-select the wrong duplicate-name row**
- **Found during:** Task 1 (expensive-tier keyboard test)
- **Issue:** Searching the display text `"Opus"` also fuzzy-matched (as a loose subsequence) the unrelated duplicate-name fixture id `openrouter-sonnet-5-dup`; cmdk re-selects the top-scoring visible item on every search change, so ArrowDown+Enter activated the wrong row.
- **Fix:** Search by a substring unique to the target entry's `id` (`"opus-4-8"`) instead of the ambiguous display name.
- **Files modified:** `src/components/brains/BrainPicker.test.tsx`
- **Verification:** Test passes deterministically; added an explicit assertion that the duplicate-name entry is absent from the filtered results.
- **Committed in:** `51282862` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 doc-comment/grep-gate collision — same recurring class as prior plans, 1 Rule 3 test-infra blocker, 1 Rule 1 test-authoring bug). No scope creep; all necessary for the plan's own acceptance criteria to hold honestly.

## Issues Encountered

None beyond the deviations above. The commit-splitting exercise (reconstructing clean intermediate file states so each of the 3 tasks lands as an atomic, independently-buildable commit despite `BrainPicker.tsx`/`BrainPickerRow.tsx` each carrying content spanning two tasks) required careful manual reconstruction but is not itself a deviation — it directly serves the "commit each task atomically" requirement.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CR-02, WR-01, and WR-03 (the three defects this gap-closure plan targeted) are closed and regression-guarded by both unit tests (with live mutation checks) and a new E2E leg.
- Wave 1 of the gap-closure cycle (103-09, 103-10, 103-11) is now complete.
- Ready for wave 2 (`103-12`, `GlobalSwapModal` axis/lifecycle fix, BSC-04) and wave 3 (`103-13`, operator-attended live re-verification, BSC-05).
- `BSC-02`/`BSC-03` are NOT re-marked complete in `REQUIREMENTS.md` this plan — per the established gap-closure-cycle pattern (matching 103-09/103-10), the overall requirement re-mark happens after the full cycle and `103-13`'s live re-verification, not per-plan.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

All 5 modified files exist on disk; all 3 task commits (`51282862`, `18af9afa`, `2b8f0c28`) exist in `git log --oneline --all`.
