---
phase: 109-per-agent-engine-ui
plan: 07
subsystem: ui
tags: [react, cost-confirm, billing-registry, cmdk, keyboard-accessibility, brain-swap]

# Dependency graph
requires:
  - phase: 109-03
    provides: "the retired D-16 stub seam; normalizeCatalogueEntry as the one live-catalogue adapter this plan rewrites"
  - phase: 109-05
    provides: "modelIdsMatch (unrelated to this plan's D-13 mapping, but confirms the picker's isCurrent/toast sites this plan does not touch)"
  - phase: 109-06
    provides: "useProfileSwap's swapTo dispatch, consumed unchanged by handleSelect's profile branch"
provides:
  - "mapCatalogueVendorToBilling(vendor) — src/lib/catalogueBilling.ts — the D-13 vendor-to-billing translation (anthropic -> anthropic_direct; every other non-empty vendor -> OpenRouter catch-all; empty/missing vendor -> unclassified/unknown, never silently defaulted)"
  - "A fourth, honest 'Unclassified' picker group (GROUP_ORDER, BrainPicker.tsx) rendered last, with a deliberately irregular dashed --status-warn UNCLASSIFIED chip (BrainPickerRow.tsx)"
  - "shouldConfirmCost(entry) — one hoisted, scope-aware confirm gate in BrainPicker.tsx, consumed identically by the row-render loop and handleActivate, so mouse and keyboard activation can never disagree about whether a swap needs confirmation"
  - "needsConfirm as a required BrainPickerRowProps field — the row no longer computes its own scope-blind gating"
affects: [109-08, any-future-brain-billing-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vendor-axis-to-billing-channel translation as a small pure module (catalogueBilling.ts) rather than a lookup table, because the two axes (model manufacturer vs. execution/billing channel) do not line up 1:1"
    - "Hoisted single-formula gate consumed by both an event-loop closure and a JSX prop, replacing a component-local recomputation that could drift between two input paths"

key-files:
  created:
    - src/lib/catalogueBilling.ts
    - src/lib/catalogueBilling.test.ts
  modified:
    - src/lib/brainsApi.ts
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
    - src/components/brains/BrainPickerRow.tsx
    - src/components/brains/BrainPickerRow.test.tsx

key-decisions:
  - "D-13 implemented exactly as corrected in 109-CONTEXT.md/109-RESEARCH.md: 'anthropic' maps to the anthropic_direct registry entry; every other non-empty vendor is the OpenRouter catch-all; only an empty/missing vendor reaches 'unclassified'. A literal vendor-in-PROVIDER_BILLING lookup was explicitly rejected (would classify the live catalogue's 'anthropic' entries as unclassified too, plus ~300 OpenRouter entries)."
  - "Detection of the unclassified case is by emptiness of the vendor string, never by calling getBillingType() — its '?? \"api\"' fallback would make unclassified undetectable. Verified by a grep gate (getBillingType count 0 in catalogueBilling.ts)."
  - "shouldConfirmCost = scope !== \"global\" && needsCostConfirm(entry) is the ONE formula; needsCostConfirm itself stays exported and unchanged as the pure, scope-independent predicate for direct unit testing (BrainPickerRow.test.tsx still tests it directly)."
  - "CatalogueEntry[\"group\"] widened in src/lib/brainsApi.ts to include \"unclassified\" — not in the plan's declared files_modified list, but required for mapCatalogueVendorToBilling's return type to type-check against normalizeCatalogueEntry's spread. Documented as a deviation below."
  - "The mouse/keyboard parity test needed a costTier \"expensive\" fixture, which mapCatalogueVendorToBilling can never produce from a live-catalogue-shaped vendor (D-13's rule only ever yields \"normal\" or \"unknown\"). Resolved with a test-file-local vi.mock of @/lib/catalogueBilling that special-cases one synthetic vendor string to \"expensive\" and passes every other vendor through to the real implementation — the real module and its own dedicated unit tests are untouched."

patterns-established:
  - "A picker group/billing/cost-tier classification must derive from a real registry, with an explicit, honestly-empty-when-warranted 'Unclassified'/'unknown' branch — never a hardcoded flattening that silently suppresses a downstream safety gate (needsCostConfirm)."
  - "Any condition consumed by more than one input path (mouse, keyboard) must be a single hoisted value/callback passed to both consumers as a prop/argument, never recomputed locally by the lower-level component."

requirements-completed: [ENGINE-03]

# Metrics
duration: ~12min
completed: 2026-08-09
---

# Phase 109 Plan 07: D-13 Vendor Billing Mapping, Unclassified Group, Hoisted Confirm Gate Summary

**Real grouping/billing/cost-tier metadata from CodePulse's own `PROVIDER_BILLING` registry via a new `mapCatalogueVendorToBilling` D-13 translator, a fourth honest "Unclassified" picker group with a deliberately irregular chip, and a single hoisted `shouldConfirmCost` gate proven identical for mouse and keyboard across all six (scope, costTier) combinations.**

## Performance

- **Duration:** ~12 min (commit span 11:34–11:45 UTC-4)
- **Started:** 2026-08-09T11:33:00-04:00
- **Completed:** 2026-08-09T11:45:20-04:00
- **Tasks:** 3/3 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `mapCatalogueVendorToBilling` (`src/lib/catalogueBilling.ts`) implements D-13's rule exactly: `"anthropic"` maps to the `anthropic_direct` registry entry; every other non-empty vendor (the OpenRouter routing-slug family — `"google"`, `"x-ai"`, `"meta-llama"`, etc.) is billed as the OpenRouter catch-all; only an empty/missing vendor reaches `group:"unclassified"`/`costTier:"unknown"`. Detection is by emptiness, never by calling the registry's own unmapped-provider fallback (whose conservative default would make "unclassified" undetectable).
- `normalizeCatalogueEntry` (`BrainPicker.tsx`) no longer hardcodes `group:"api", billing:"api", costTier:"normal"` for every row — it spreads `mapCatalogueVendorToBilling(entry.vendor)`.
- `GROUP_ORDER` gained a fourth, LAST entry (`unclassified`/"Unclassified"); `CatalogueEntry["group"]` widened in `src/lib/brainsApi.ts` to match. `BrainPickerRow` renders a deliberately irregular full-word "UNCLASSIFIED" chip (`Badge variant="outline"`, dashed `--status-warn` border) instead of the ordinary 3-char API/SUB chip when `entry.group === "unclassified"` — same sizing as every other chip, only color and text differ.
- `shouldConfirmCost(entry) = scope !== "global" && needsCostConfirm(entry)` is now the ONE formula in `BrainPicker.tsx`, consumed at both the row-rendering loop (`needsConfirm={shouldConfirmCost(entry)}`) and `handleActivate`'s confirm branch. `BrainPickerRow`'s `needsConfirm` is now a required prop; the row's own local, scope-blind `needsCostConfirm(entry)` computation is gone. `needsCostConfirm` itself stays exported and unchanged, still directly unit-tested.
- This closes the friction-stacking defect UI-SPEC §F revision 3 describes: at "All profiles" scope the inline expand-to-confirm can no longer appear on either input path, so it never stacks with `GlobalSwapModal`'s own `needsCostWarning` line.
- A new table-driven parity test (`BrainPicker.test.tsx`) covers all six (scope, costTier) combinations, driving the SAME row via a real mouse click and a real cmdk keyboard activation (search input + ArrowDown + Enter, no mocked event) and comparing the two paths' observable outcomes (inline confirm shown, global modal opened, dispatched) to EACH OTHER — a test of either path alone could not have caught the original stacking defect, which is exactly the property this test asserts.
- Rule 1/2 fix folded into Task 2: `BrainPickerRow`'s vendor-dot color fallback was a hardcoded hex literal (`#6b7280`); replaced with `var(--muted-foreground)`, matching `BrainHeaderBadge.tsx:88`'s existing fallback for the identical `PROVIDER_COLORS` lookup. `grep -rn "#[0-9a-fA-F]\{6\}" src/components/brains/` now returns zero hits.
- Fixed a mid-Task-1 grep gate: the module docstring's own prose mentioned `getBillingType()` by name twice, which made `grep -c "getBillingType" src/lib/catalogueBilling.ts` return 2 instead of the required 0 — reworded to describe the helper without repeating its literal identifier.

## Task Commits

1. **Task 1: mapCatalogueVendorToBilling — the D-13 translation** - `6a8419bf` (feat)
2. **Task 2: Fourth picker group, UNCLASSIFIED chip, real costTier** - `ddcf445f` (feat)
3. **Task 3: Hoist the scope-aware confirm gate; prove mouse/keyboard parity** - `89a9401f` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `src/lib/catalogueBilling.ts` — new: `mapCatalogueVendorToBilling`, `CatalogueBilling` type.
- `src/lib/catalogueBilling.test.ts` — new: 6 behavioral tests (anthropic mapping, OpenRouter catch-all across 6 vendors, empty/undefined vendor paired with a mapped control, the anthropic-vs-literal-lookup regression guard, a `PROVIDER_BILLING`-key-colliding vendor resolving through the same catch-all rule).
- `src/lib/brainsApi.ts` — `CatalogueEntry["group"]` widened to include `"unclassified"` (not in the plan's declared file list — see Deviations).
- `src/components/brains/BrainPicker.tsx` — `normalizeCatalogueEntry` rewritten to derive group/billing/costTier from the mapper; `GROUP_ORDER` gains the fourth Unclassified entry; `shouldConfirmCost` added and consumed at both sites; `handleActivate`'s docstring updated to describe the hoisted gate.
- `src/components/brains/BrainPicker.test.tsx` — docstring corrected (D-09/D-13 reality, superseding the pre-Plan-07 flattening description); new "Unclassified group" describe block (2 tests); new mouse/keyboard parity describe block (6 combo tests + 2 dedicated stacking/friction tests); a test-file-local `vi.mock("@/lib/catalogueBilling", ...)` special-casing one synthetic vendor to `costTier:"expensive"` for the parity test's third tier, passing every other vendor through to the real implementation.
- `src/components/brains/BrainPickerRow.tsx` — `needsConfirm` added as a required prop, local computation deleted; UNCLASSIFIED chip branch added; docstrings reworded so no line other than the function definition itself contains the literal string `needsCostConfirm` (satisfies the plan's own grep gate); vendor-dot hex fallback replaced with a CSS var.
- `src/components/brains/BrainPickerRow.test.tsx` — `renderRow`'s default props now include `needsConfirm: needsCostConfirm(entry)` (reproducing prior behavior for every test that doesn't override it); two direct `render()` call sites given explicit `needsConfirm`; new Unclassified-entry fixture and two chip-rendering tests (positive + control).

## Decisions Made

See frontmatter `key-decisions`. In summary: D-13's rule implemented verbatim per 109-CONTEXT.md/109-RESEARCH.md's corrected premise; unclassified detection by emptiness only; `shouldConfirmCost` as the single hoisted gate with `needsCostConfirm` left as the pure predicate; `CatalogueEntry["group"]` widened in `brainsApi.ts` (outside the plan's declared file list, documented below); the parity test's `costTier:"expensive"` fixture built via a local test-only mock rather than skipping that tier.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `catalogueBilling.ts`'s own docstring defeated its acceptance-criteria grep gate**
- **Found during:** Task 1
- **Issue:** The module docstring explained why `getBillingType()` is never called for detection, but mentioned the literal identifier `getBillingType()` twice in prose — the plan's own acceptance criterion (`grep -c "getBillingType" ... returns 0`) failed at 2.
- **Fix:** Reworded the two prose mentions to describe the helper ("the registry's own unmapped-provider fallback helper") without repeating its literal name.
- **Files modified:** `src/lib/catalogueBilling.ts`
- **Verification:** `grep -c "getBillingType" src/lib/catalogueBilling.ts` returns 0; `grep -c "PROVIDER_BILLING"` returns 8 (still ≥1).
- **Committed in:** `6a8419bf` (Task 1 commit)

**2. [Rule 1 — Bug] `BrainPickerRow.tsx`'s pre-existing hardcoded hex vendor-dot fallback**
- **Found during:** Task 2
- **Issue:** `dotColor = PROVIDER_COLORS[entry.vendor] ?? "#6b7280"` is a hardcoded hex literal, violating CLAUDE.md's Styling section ("never hardcode hex") and this plan's own explicit acceptance criterion (`grep -rn "#[0-9a-fA-F]{6}" src/components/brains/BrainPickerRow.tsx` must return zero). Pre-existing, not introduced by this plan, but the gate is unconditional and the file was already being edited.
- **Fix:** Replaced with `var(--muted-foreground)`, matching `BrainHeaderBadge.tsx:88`'s existing fallback for the identical `PROVIDER_COLORS` lookup — an established in-repo pattern, not a new one invented for this fix.
- **Files modified:** `src/components/brains/BrainPickerRow.tsx`
- **Verification:** `grep -rn "#[0-9a-fA-F]{6}" src/components/brains/` returns zero hits repo-wide (not just this file); no test asserted on the specific hex value.
- **Committed in:** `ddcf445f` (Task 2 commit)

**3. [Rule 3 — Blocking] `src/lib/brainsApi.ts`'s `CatalogueEntry["group"]` type needed widening**
- **Found during:** Task 2
- **Issue:** `mapCatalogueVendorToBilling`'s return type includes `group: "unclassified"`, but `CatalogueEntry["group"]` (defined in `src/lib/brainsApi.ts`, NOT in this plan's declared `files_modified` list) was `"subscription" | "api" | "local"` — spreading the mapper's result into `normalizeCatalogueEntry`'s return would not type-check without widening it. The plan's own Task 2 action text explicitly instructs "widen `CatalogueEntry["group"]`'s type to include it," naming a file the plan's frontmatter omitted.
- **Fix:** Added `"unclassified"` to the union, with a one-line comment pointing at `catalogueBilling.ts` as the source of the new value.
- **Files modified:** `src/lib/brainsApi.ts`
- **Verification:** `npx tsc --noEmit` exits 0; not a files-belonging-to-109-08 conflict (109-08's scope boundary lists `useControlVerbSwaps.ts`/`SwapHistoryList.tsx`/`GlobalSwapModal.tsx`/`Settings.tsx` only).
- **Committed in:** `ddcf445f` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 — grep-gate/pre-existing-hex bugs directly required by this plan's own acceptance criteria; 1 Rule 3 — a blocking type-widen the plan's own task text named but its frontmatter omitted from `files_modified`)
**Impact on plan:** No scope creep. All three fixes were required either by this plan's own explicit acceptance criteria (deviations 1–2) or by the plan's own action text (deviation 3, a file-list omission). No file belonging to plan 109-08's declared scope was touched.

## Test-Count Delta vs. Baseline

Baseline (measured before this plan started, on this exact tree, per 109-06-SUMMARY.md): **282 test files passed | 17 skipped, 3699 tests passed | 193 todo.**

After this plan: **283 test files passed | 17 skipped (+1 new file), 3717 tests passed | 193 todo (+18 net)** — zero failures, zero regressions.

| File | New tests | What was added |
|---|---|---|
| `src/lib/catalogueBilling.test.ts` (new) | 6 | Full D-13 rule coverage: anthropic mapping, OpenRouter catch-all (6 vendors), empty/undefined-vendor pairing, the anthropic-vs-literal-lookup guard, a `PROVIDER_BILLING`-key-colliding vendor |
| `src/components/brains/BrainPickerRow.test.tsx` | +2 | UNCLASSIFIED chip rendering (positive) + ordinary API chip control |
| `src/components/brains/BrainPicker.test.tsx` | +10 | Unclassified group heading + chip + expand-to-confirm (2) + six-combination mouse/keyboard parity table (6) + two dedicated stacking/friction tests (2) |

`npx tsc --noEmit` exits 0. `npm test` (full suite): 283 test files passed | 17 skipped, 3717 tests passed | 193 todo, zero failures.

## Issues Encountered

None beyond the deviations documented above — no test required debugging beyond the two grep-gate/type-widen fixes, and every test passed on first full run after the fixes.

## Known Stubs

None — this plan wires real registry-derived data (`PROVIDER_BILLING`) and a real hoisted gate; no stub, fixture, or build-time flag was introduced or reintroduced. The one test-file-local mock (`BrainPicker.test.tsx`'s `vi.mock("@/lib/catalogueBilling", ...)`) exists solely to reach a `costTier:"expensive"` fixture for the parity test — it passes every real vendor through to the unmocked implementation and does not affect production code or any other test file.

## Threat Flags

None. This plan implements T-109-18's mitigation (unclassified detection by emptiness, never `getBillingType()`'s fallback — asserted by the `getBillingType` grep gate), T-109-19's mitigation (Subscription/Local groups remain empty via the unchanged `.filter((g) => g.entries.length > 0)`, no fabricated entry), and T-109-20's mitigation (the hoisted `shouldConfirmCost` gate, proven by the six-combination parity test). No new network endpoint, auth path, or schema change was introduced.

## User Setup Required

None — no external service configuration required. This plan is CodePulse-only, entirely frontend classification/UI logic against data already delivered by earlier plans in this phase.

## Next Phase Readiness

- `mapCatalogueVendorToBilling`, the Unclassified group, and `shouldConfirmCost` are stable, tested, and the single implementation of each concern — any future picker/billing surface should consume these rather than re-deriving them.
- Plan 109-08's declared files (`src/hooks/useControlVerbSwaps.ts`, `src/components/brains/SwapHistoryList.tsx`, `src/components/brains/GlobalSwapModal.tsx`, `src/pages/Settings.tsx`) were not touched by this plan.
- No blockers for whatever plan comes next in this phase's wave sequence.

---
*Phase: 109-per-agent-engine-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: `src/lib/catalogueBilling.ts`, `src/lib/catalogueBilling.test.ts`
- FOUND: `src/lib/brainsApi.ts`
- FOUND: `src/components/brains/BrainPicker.tsx`, `src/components/brains/BrainPicker.test.tsx`
- FOUND: `src/components/brains/BrainPickerRow.tsx`, `src/components/brains/BrainPickerRow.test.tsx`
- FOUND commits: `6a8419bf`, `ddcf445f`, `89a9401f`
