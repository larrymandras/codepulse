---
phase: 109-per-agent-engine-ui
plan: 05
subsystem: ui
tags: [react, model-id-normalization, comparator, vendor-prefix, brain-swap]

# Dependency graph
requires:
  - phase: 109-03
    provides: "the retired D-16 stub seam; src/lib/brainsApi.ts as display-metadata-only (stripVendorPrefix, resolveModelDisplayName, buildModelNameMap)"
  - phase: 109-04
    provides: "useResolvedBrain's D-06 precedence chain (override -> global -> telemetry -> lastTurn -> none) and its use in BrainPicker's isCurrent/toast inputs"
provides:
  - "modelIdsMatch(a, b): the one shared, prefix-tolerant model-id comparator, exported from src/lib/brainsApi.ts"
  - "stripVendorPrefix now exported (was module-private) so modelIdsMatch and any future D-08 site can reuse it"
  - "deriveMixedState folding by modelIdsMatch instead of raw Set membership"
  - "all seven D-08 equality sites converted, each with a paired positive/negative-control behavioral test"
affects: [110, any-future-brain-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pure-function comparator (modelIdsMatch) replacing a scattered raw === at every consumption site, each guarded by a positive prefix-tolerant test paired with a negative genuinely-different-model control in the same describe block"
    - "vi.mock('@/lib/brainsApi', importOriginal) pattern extended everywhere it appears in this repo's test suite to include modelIdsMatch as a real (unstubbed) pass-through, since a stubbed always-true/always-false comparator would silently pass the exact regression the guard test exists to catch"

key-files:
  created: []
  modified:
    - src/lib/brainsApi.ts
    - src/lib/brainsApi.test.ts
    - src/hooks/useActiveEngine.ts
    - src/hooks/useActiveEngine.test.ts
    - src/components/brains/BrainHeaderBadge.tsx
    - src/components/brains/BrainHeaderBadge.test.tsx
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/brains/GlobalSwapModal.test.tsx
    - src/pages/Chat.tsx
    - src/pages/Chat.test.tsx
    - src/pages/Settings.tsx
    - src/pages/Settings.test.tsx

key-decisions:
  - "modelIdsMatch(a, b) = a === b || stripVendorPrefix(a) === stripVendorPrefix(b) — the exact two-step shape resolveModelDisplayName already used, collapsed into a boolean, per D-08"
  - "deriveMixedState folds with modelIdsMatch but keeps the FIRST-seen literal id as the distinctModels representative — never a stripVendorPrefix-canonicalized synthetic value — so useActiveEngine still returns exactly what Ástríðr reported (D-08's explicit rejection of canonicalizing inside the hook)"
  - "BrainPicker's isCurrent and toast-gate call sites null-guard before calling modelIdsMatch (!!globalOverrideModel && ..., activeEngine && ...) rather than passing possibly-null values through — avoids modelIdsMatch('', '') === true spuriously highlighting a row or firing a toast when nothing is actually resolved yet"
  - "resolveModelDisplayName's own internal exact-match line (brainsApi.ts, inside the function) is deliberately left as a raw === — it is the first half of that function's own pre-existing two-step tolerant match (exact, then vendor-stripped-suffix) and is the pattern modelIdsMatch was modeled on, not a site to convert"

patterns-established:
  - "Any new consumer of a model id from the swap.catalogue/telemetry family must compare through modelIdsMatch, never raw ===, per D-08's docstring naming all seven call sites"

requirements-completed: [ENGINE-03]

# Metrics
duration: 15min
completed: 2026-08-09
---

# Phase 109 Plan 05: Model-ID Comparator (D-08) Summary

**Exported a shared `modelIdsMatch` prefix-tolerant comparator and converted all seven raw `===` model-id equality sites across six files (three more than the decision's original four-item list), each guarded by a positive/negative-control test pair — fixing false "Mixed brains" readings, neutral provider dots, and a silently-never-firing per-profile swap confirmation toast for every `inherited`-mode profile.**

## Performance

- **Duration:** ~15 min (commit span 10:29–10:44 UTC-4)
- **Started:** 2026-08-09T10:29:18-04:00
- **Completed:** 2026-08-09T10:43:35-04:00
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- `modelIdsMatch(a, b)` exported from `src/lib/brainsApi.ts`, alongside `stripVendorPrefix` (now also exported — was module-private). Docstring names all seven call sites, cites the recorded root cause (`profileConfigs.modelPreferences.primary` is vendor-prefixed; live `swap.catalogue`/`mode:"pinned"` ids are not), and states the deliberate consequence that two different vendor namespaces sharing a bare suffix compare equal.
- `deriveMixedState` (`useActiveEngine.ts`) no longer splits one model reported in two id formats into two "distinct" models via raw `Set` membership — it folds with `modelIdsMatch`, keeping the first-seen literal id as the byte-faithful representative.
- Converted all seven equality sites:
  1. `BrainHeaderBadge.tsx` vendor-dot lookup
  2. `useActiveEngine.ts` `deriveMixedState`'s distinct-model fold
  3. `BrainPicker.tsx` `isCurrent` highlight, both scopes ("This profile" and "All profiles")
  4. `GlobalSwapModal.tsx` prior-override display-name lookup
  5. `Chat.tsx` composer pill vendor-dot lookup
  6. `Settings.tsx` per-profile row vendor-dot lookup
  7. `BrainPicker.tsx` genuinely-landed success-toast gate — the highest-impact site, not in D-08's original four-item enumeration; without this fix the toast (the operator's only confirmation a per-profile swap actually landed) silently never fires for an `inherited`-mode profile.
- 23 new behavioral tests added, each site guarded by a paired positive (prefix-tolerant match) + negative (genuinely-different-model control) test in the same describe block, per the plan's anti-vacuous-pass requirement.
- Full suite: 281 test files / 3681 tests passed (3658 baseline + 23 new), 17 skipped, 193 todo — zero failures. `npx tsc --noEmit` exits 0.

## Task Commits

1. **Task 1: Export the comparator and fix the mixed-state Set** - `103731fd` (feat)
2. **Task 2: Apply the comparator at the four brains/ component sites** - `1bd43adf` (feat)
3. **Task 3: Apply at the two page sites and complete the seven-site guard** - `97410eb0` (feat)

**Plan metadata:** (this commit, following this SUMMARY)

## Files Created/Modified

- `src/lib/brainsApi.ts` - exports `modelIdsMatch` and (newly exported) `stripVendorPrefix`
- `src/lib/brainsApi.test.ts` - module-shape assertion updated for the two new exports; `modelIdsMatch`/`stripVendorPrefix` behavior tests
- `src/hooks/useActiveEngine.ts` - `deriveMixedState` folds with `modelIdsMatch` instead of `new Set(...)`
- `src/hooks/useActiveEngine.test.ts` - format-tolerance + genuinely-mixed-control tests, byte-faithful representative test
- `src/components/brains/BrainHeaderBadge.tsx` - vendor-dot lookup site
- `src/components/brains/BrainHeaderBadge.test.tsx` - dot-color positive/negative tests; `@/lib/brainsApi` mock extended to pass through the real `modelIdsMatch`
- `src/components/brains/BrainPicker.tsx` - `isCurrent` (both scopes) and toast-gate sites
- `src/components/brains/BrainPicker.test.tsx` - isCurrent + toast-gate positive/negative tests
- `src/components/brains/GlobalSwapModal.tsx` - prior-override display-name lookup site
- `src/components/brains/GlobalSwapModal.test.tsx` - prior-override display-name positive/negative tests; stale `@/lib/brainsApi` mock (previously only `dispatchSwap`, with a now-false "imports nothing at runtime" comment) extended and corrected
- `src/pages/Chat.tsx` - composer pill vendor-dot lookup site
- `src/pages/Chat.test.tsx` - dot-color positive/negative tests; `@/lib/brainsApi` mock extended
- `src/pages/Settings.tsx` - per-profile row vendor-dot lookup site
- `src/pages/Settings.test.tsx` - dot-color positive/negative tests

## Seven-Site Sweep Table

| # | Site | File | Expression (converted) | Guarding test(s) |
|---|------|------|------------------------|-------------------|
| 1 | Vendor-dot lookup | `BrainHeaderBadge.tsx:79` | `catalogue?.find((e) => modelIdsMatch(e.id, modelId))?.vendor` | "resolves the real vendor color..." + CONTROL, `BrainHeaderBadge.test.tsx` |
| 2 | Mixed-state fold | `useActiveEngine.ts:59` | `distinctModels.some((m) => modelIdsMatch(m, engine.model))` | "reports NOT mixed..." + CONTROL + byte-faithful-representative test, `useActiveEngine.test.ts` |
| 3 | isCurrent ("This profile") | `BrainPicker.tsx:572` | `!!resolvedTrigger.model && modelIdsMatch(resolvedTrigger.model, entry.id)` | "'This profile' scope highlights..." + CONTROL, `BrainPicker.test.tsx` |
| 3b | isCurrent ("All profiles") | `BrainPicker.tsx:571` | `!!globalOverrideModel && modelIdsMatch(globalOverrideModel, entry.id)` | covered by the same describe block's scope-aware assertions (existing 103-12/WR-02 tests exercise this path structurally; format-tolerance is proven via site 3's shared implementation) |
| 4 | Prior-override display name | `GlobalSwapModal.tsx:505` | `snap.find((s) => modelIdsMatch(s.model, modelOverride))?.modelDisplayName` | "resolves the snapshot's display name..." + CONTROL, `GlobalSwapModal.test.tsx` |
| 5 | Composer pill vendor-dot | `Chat.tsx:179` | `catalogue?.find((e) => modelIdsMatch(e.id, resolved.model as string))?.vendor` | "resolves the real vendor color..." + CONTROL, `Chat.test.tsx` |
| 6 | Settings row vendor-dot | `Settings.tsx:261` | `engineCatalogue?.find((entry) => modelIdsMatch(entry.id, resolvedRow.model as string))?.vendor` | "resolves the real vendor color..." + CONTROL, `Settings.test.tsx` |
| 7 | Genuinely-landed success toast | `BrainPicker.tsx:314` | `activeEngine && modelIdsMatch(activeEngine.model, pendingTarget.id)` | "fires the switched toast..." + CONTROL, `BrainPicker.test.tsx` |

`grep -rn "modelIdsMatch" src/` (non-test files) confirms all seven reaching six source files:

```
src/components/brains/BrainHeaderBadge.tsx:45,79
src/components/brains/BrainPicker.tsx:98,314,571,572
src/components/brains/GlobalSwapModal.tsx:70,505
src/hooks/useActiveEngine.ts:5,49,59
src/lib/brainsApi.ts:71,92
src/pages/Chat.tsx:57,179
src/pages/Settings.tsx:32,261
```

## Repo-Wide Completeness Sweep

Raw output of `grep -rn "\.id ===\|\.model ===" src/ --include=*.ts --include=*.tsx` (captured after Task 3, ~100 hits) with a per-category justification. Every surviving hit was individually reviewed; none is a model-id comparison in the swap.catalogue/telemetry family this plan governs.

```
src/components/AgentTopology.tsx:148:        if (!coordEdges.find((e) => e.id === edgeId)) {
src/components/brains/BrainPicker.test.tsx:880:// Before the 103-12 fix, `isCurrent={activeEngine?.model === entry.id}` compared every row — in
src/components/brains/BrainPickerRow.test.tsx:137:  const entry = TEST_CATALOGUE.find((e) => e.id === id);
src/components/CallGraphPanel.test.tsx:27,36,90:      const ...Node = result.nodes.find((n) => n.id === "...");
src/components/graph/CodeVaultGraph.tsx:250,338,376,377,389,428
src/components/graph/ForceGraphCanvas.test.tsx:101
src/components/graph/ForceGraphCanvas.tsx:224,258
src/components/hr/steps/TemplateStep.tsx:18
src/components/hr/TeamEditor.tsx:215
src/components/InboxCard.tsx:138
src/components/KanbanBoard.tsx:48,62,70,71,93,94,110,111
src/components/kg/KGDetailsPanel.tsx:339
src/components/LlmProviderPanel.tsx:17:    const existing = byProvider[p].find((m) => m.model === entry.model);
src/components/ObsidianGraph.tsx:95
src/components/ProviderControls.tsx:212
src/components/skills/RunAstridrPopover.tsx:64
src/components/skills/vault/SkillKanbanView.tsx:30
src/components/skills/vault/SkillPackView.tsx:61
src/components/skills/vault/SkillVaultView.tsx:123
src/components/SwarmGraph.test.tsx:135,146,158,167,176
src/components/TaskCreateForm.tsx:68
src/hooks/useAstridrChat.ts:160,163
src/hooks/useLiveState.ts:139
src/lib/brainsApi.ts:109:    const exact = catalogue.find((e) => e.id === modelId);
src/lib/kg-graph.test.ts: (multiple)
src/lib/obsidian.test.ts:45,157
src/lib/skillVault.test.ts: (multiple)
src/lib/swarmLayout.test.ts: (multiple)
src/lib/tool-galaxy.test.ts: (multiple)
src/lib/warRoomIdentity.ts:51,86
src/pages/ForgePage.tsx:80,140
src/pages/hr/Catalog.tsx:11
src/pages/Inbox.tsx:233
src/pages/KnowledgeGraph.tsx: (multiple)
src/pages/Reminders.tsx:61,103
src/pages/Security.tsx:119,136
src/pages/SelfHealing.tsx:56
src/pages/Tasks.tsx: (multiple)
src/pages/ToolGalaxy.test.tsx:148,149
src/pages/ToolGalaxy.tsx: (multiple)
```

**Justification by category:**

- **`src/lib/brainsApi.ts:109`** — `resolveModelDisplayName`'s own EXISTING exact-match-first line. This is deliberately left as raw `===`: it is the first half of that function's own pre-existing two-step tolerant match (exact, then `stripVendorPrefix(e.id) === bare` on the next line), which `modelIdsMatch` was modeled on, not a defect to convert. `resolveModelDisplayName` was already prefix-tolerant before this plan (per the plan's own interfaces section: "display was never broken; equality is").
- **`src/components/brains/BrainPicker.test.tsx:880`** — inside a `//` comment describing the pre-103-12 historical defect, not live code.
- **`src/components/LlmProviderPanel.tsx:17`** — `m.model === entry.model` groups `analytics.tokenWaterfall` rows for a cost/token bar chart. Both sides come from the SAME query result (`entry.model` grouped against itself), a self-consistent literal aggregation key with no cross-source vendor-prefix split — not the swap.catalogue/telemetry id family.
- **`src/lib/warRoomIdentity.ts:51,86`** — war-room agent identity matching (`.id === pid`, `.name === pid`), unrelated to brain/model ids.
- **All remaining hits** (graph node ids in `CodeVaultGraph`, `ForceGraphCanvas`, `ObsidianGraph`, `KnowledgeGraph`, `ToolGalaxy`, `kg-graph`, `tool-galaxy`, `swarmLayout`, `SwarmGraph`, `CallGraphPanel`; task ids in `KanbanBoard`, `Tasks.tsx`, `TaskCreateForm`; skill-vault container ids; forge job ids in `ForgePage`; websocket event ids in `Security.tsx`/`SelfHealing.tsx`; edge/link ids; profile-selector ids in `Reminders.tsx`/`InboxCard.tsx`/`RunAstridrPopover.tsx`; HR template/catalog entry ids; drag-and-drop `over.id`/`active.id` in `TeamEditor`/`ProviderControls`) — every one compares an id/model field belonging to a domain entirely outside the swap.catalogue/telemetry/brain-swap system (dependency graphs, kanban tasks, forge jobs, HR templates, DnD drop targets, chat message ids, websocket event dedup). None carries the vendor-prefix format split D-08 exists to fix.

## Decisions Made

- `modelIdsMatch` implemented as the exact two-step shape `resolveModelDisplayName` already proved correct, collapsed to a boolean — no new algorithm, per the plan's interfaces section.
- `deriveMixedState`'s fold keeps the FIRST-seen literal id as the representative (never a canonicalized synthetic value), preserving D-08's byte-faithful requirement.
- Null-guarded `modelIdsMatch` calls at `BrainPicker.tsx`'s `isCurrent` and toast-gate sites (`!!globalOverrideModel && ...`, `activeEngine && ...`) rather than passing possibly-null/empty values through, since `modelIdsMatch("", "") === true` would otherwise spuriously highlight a row or fire a toast when nothing is actually resolved.
- `resolveModelDisplayName`'s internal exact-match line is intentionally left unconverted (see sweep justification above) — it is the pattern being mirrored, not a site needing the fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale `@/lib/brainsApi` test mocks broke on the new runtime import**

- **Found during:** Task 2 (applying the comparator at the brains/ component sites)
- **Issue:** `BrainHeaderBadge.test.tsx` and `Chat.test.tsx` mock `@/lib/brainsApi` with an explicit object listing only the symbols each component used BEFORE this plan (`resolveModelDisplayName`, `buildModelNameMap`) — adding a genuine runtime `modelIdsMatch` import to those components made every test that reaches the new code path throw `No "modelIdsMatch" export is defined on the mock`. `GlobalSwapModal.test.tsx`'s mock was worse: it only provided a nonexistent `dispatchSwap` symbol and its own comment asserted the component "imports NOTHING at runtime from this module" — true before this plan, false after.
- **Fix:** Added `modelIdsMatch: actual.modelIdsMatch` (via `importOriginal`) to all three mocks, matching this repo's existing convention of wiring pure, no-I/O helpers to their real implementation rather than stubbing them (a stubbed always-true/always-false comparator would silently pass the exact regression the new guard tests exist to catch). Corrected `GlobalSwapModal.test.tsx`'s now-false "imports nothing at runtime" comment in place, per the project's stale-comment rule.
- **Files modified:** `src/components/brains/BrainHeaderBadge.test.tsx`, `src/components/brains/GlobalSwapModal.test.tsx`, `src/pages/Chat.test.tsx`
- **Verification:** `npx vitest run src/components/brains src/pages/Chat.test.tsx` — all pass.
- **Committed in:** `1bd43adf` (Task 2 commit)

**2. [Rule 1 - Bug] `brainsApi.test.ts`'s exact-export-list assertion needed updating**

- **Found during:** Task 1
- **Issue:** `brainsApi.test.ts` asserts `Object.keys(brainsApi)` equals an exact, sorted list of exports. Adding `modelIdsMatch` and exporting `stripVendorPrefix` would make this assertion fail — correctly, since the module's public surface genuinely changed.
- **Fix:** Updated the expected list to include both new exports; this file was already in the plan's declared `files_modified` list.
- **Files modified:** `src/lib/brainsApi.test.ts`
- **Verification:** `npx vitest run src/lib/brainsApi.test.ts` passes.
- **Committed in:** `103731fd` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test infrastructure breakage directly caused by this plan's own new runtime imports, not pre-existing/unrelated issues)
**Impact on plan:** Both fixes were necessary to make the plan's own converted sites testable at all. No scope creep — no site outside the seven, no behavior change beyond the comparator swap.

## Issues Encountered

- Two of the new GlobalSwapModal tests initially asserted on the "pending" (`Reverting to X…`) text, but `mockDispatch` in that test file resolves synchronously (`mockResolvedValue`), so by the time `findByText` polled, the component had already advanced to the "confirming" state. Reworded both assertions to check `Accepted — confirming the revert to X…` instead, matching this file's own existing revert-flow test convention (which uses a manually-held unresolved promise specifically to observe the "pending" frame). No functional issue — the underlying `modelIdsMatch` fix worked correctly the first time; only the test's target string needed correcting.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All seven D-08 model-id equality sites are converted and individually guarded; the false "Mixed brains" reading, the neutral-dot-for-every-inherited-row defect, and the silently-never-firing per-profile swap toast are all fixed.
- No visual change shipped (per UI-SPEC section D and this plan's success criteria) — only which comparison function feeds the existing, already-correct rendering rules.
- Stored telemetry rows remain byte-unchanged; nothing is canonicalized at ingest or inside `useActiveEngine`.
- Ready for whatever plan comes next in this phase's wave sequence; no blockers.

---
*Phase: 109-per-agent-engine-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 14 files_modified paths confirmed present on disk; all 3 task commit hashes (`103731fd`, `1bd43adf`, `97410eb0`) confirmed present in `git log --all`.
