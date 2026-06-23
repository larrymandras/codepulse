---
phase: 87-saved-views-temporal-diff
verified: 2026-06-23T20:00:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Save a named view, close the page, reopen it — confirm the view appears in the Views popover and loads correctly (lens + filters + focus + hops restored)"
    expected: "The named view persists across sessions and restores the exact saved state"
    why_human: "Convex persistence and idb-hydration sequencing cannot be verified without a running dev server"
  - test: "Copy the share URL for a saved view, open it in a new incognito tab — confirm the KG restores to the same lens/filter/focus/hops state"
    expected: "?view=<token> hydration applies the view one-shot; an invalid token silently loads default state"
    why_human: "Requires a live Convex deployment and browser navigation"
  - test: "Switch to Temporal > Diff, pick two different dates, click Compare — confirm added nodes render green, removed red, changed amber, unchanged dimmed; DIFF legend appends below the entity-type legend"
    expected: "Visual diff rendering matches the UI-SPEC color palette; DIFF legend auto-hides when diff mode is off"
    why_human: "Canvas painting (paintNodeDiff) cannot be asserted without a running browser + real KG data"
  - test: "Switch to Temporal > Animate, pick a 5-day range at Day interval, click Play — confirm the graph steps through all 5 frames, the scrubber advances, Play/Pause and StepBack/StepForward controls work, speed select changes cadence"
    expected: "Animation cycles through frames; scrubbing backward does not refetch (cached); reaching the last frame auto-pauses"
    why_human: "setInterval playback + canvas frame rendering + LRU cache behavior require a live browser"
  - test: "Load a saved view, then change any filter (e.g. move the hops slider) — confirm the active-view highlight clears in the Views popover"
    expected: "The border-l-2 border-primary active row accent disappears after any user-driven filter change (WR-01 fix)"
    why_human: "State-clearing logic via handleUserFilter wrappers requires visual inspection in the running app"
  - test: "Trigger a Compare with a date that has no snapshot (or with Ástríðr stopped) — confirm the red error banner appears without unmounting the Point sub-mode or clearing the Diff date pickers"
    expected: "D-08 graceful-degrade: error shown inline, Point mode still usable; no stale diff rendered beneath the error (WR-02 fix)"
    why_human: "Requires a real fetch failure scenario"
---

# Phase 87: Saved Views + Temporal Diff — Verification Report

**Phase Goal:** Operators can save and share named graph views, and can compare or animate the KG between two points in time
**Verified:** 2026-06-23T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator saves the current graph state (lens + filters + focus + hops) as a named view and retrieves it by name in a later session — beyond the existing last-state idb auto-persist | VERIFIED | `savedKgViews` Convex table persists named views. `useSavedViews.saveView` strips `searchQuery`, generates `crypto.randomUUID()` shareToken, calls `saveMutation`. `convex/savedKgViews.ts` `list` query returns newest-first via `by_createdAt` index. Hook's `views` array drives `KGViewsPopover` rendering. |
| 2 | A saved view can be shared via a URL or link that restores the same lens/filter/focus/hops configuration when opened | VERIFIED | `buildShareUrl` returns `${origin}/knowledge-graph?view=${encodeURIComponent(token)}`. `KnowledgeGraph.tsx` `?view` hydration effect guards on `!viewToken`, `appliedViewRef.current`, `!hydrated`, and `savedViews.isLoading` (the required four conditions per RESEARCH Pitfall 1). On match, applies all filter fields and sets `appliedFocusRef.current = true` to suppress `?focus` guard (Pitfall 5). Silent fallback on absent/expired token (D-04). |
| 3 | Operator selects two as-of dates and sees nodes/edges that were added, removed, or changed between those dates rendered with distinct visual treatment (added/removed/changed) | VERIFIED | `useKgDiff.computeDiff` produces `added/removed/changed` node Sets and independent edge Sets (D-10/D-11). `paintNodeDiff` in `KnowledgeGraph.tsx` uses `diff.added/removed/changed.has(n.id)` to paint green/red/amber/dimmed nodes. Diff edge functions `makeLinkColorDiffFn`/`makeLinkLineDashDiffFn` apply the UI-SPEC palette. `KGDiffControls` disables Compare when `dateA >= dateB`. DIFF legend appends when `temporalSubMode === "diff" && diff`. |
| 4 | Operator can animate the KG forward through time, observing how the graph evolves — or step through manually | VERIFIED | `useKgAnimation` synthesizes frames client-side (`synthesizeFrames`, D-07 — no `fetchSnapshotDates`). LRU cache (20-entry, insertion-order eviction, D-09). Playback timer via `setInterval(1000/fps)`. `KGAnimateControls` renders Slider scrubber + Play/Pause/StepBack/StepForward + speed Select. `KnowledgeGraph.tsx` renders `anim.currentGraph` for animate sub-mode with `SectionErrorBoundary name="KG Animation"`. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | `savedKgViews` table with `by_shareToken` + `by_createdAt` indexes | VERIFIED | Lines 1041-1051: `savedKgViews: defineTable({...}).index("by_shareToken", ["shareToken"]).index("by_createdAt", ["createdAt"])` |
| `convex/savedKgViews.ts` | `save`, `list`, `remove`, `getByShareToken` Convex functions | VERIFIED | All 4 exported. `save` persists `{ ...args, name: trimmed }` (WR-03 fix). `list` uses `.withIndex("by_createdAt").order("desc")`. `getByShareToken` uses `by_shareToken` index + `.first()`. |
| `src/hooks/useSavedViews.ts` | `useSavedViews` hook + `SavedKgView` type | VERIFIED | Exports both. `saveView` strips `searchQuery` (D-06). `buildShareUrl` uses `encodeURIComponent` (WR-04 fix). `isLoading = views === undefined`. |
| `src/hooks/useSavedViews.test.ts` | Wave 0 tests: searchQuery exclusion + buildShareUrl | VERIFIED | 3 tests covering: no `searchQuery` key in mutation args; truthy `shareToken`; `/knowledge-graph?view=abc` URL shape. All substantive behavior assertions. |
| `src/components/kg/KGViewsPopover.tsx` | Views popover: list, empty state, per-row copy-link + delete, inline save-name expand | VERIFIED | 221 lines. Renders save-name expand (BookmarkPlus → Input + Check). Popover with view list + hover-reveal actions (stopPropagation on trash + copy). Empty state with correct copy. Active row highlight. |
| `src/components/kg/KGViewsPopover.test.tsx` | Unit tests: save, load, delete, copy-link, empty state | VERIFIED | 5+ test cases. Asserts: onLoadView called on row click; onDeleteView called + onLoadView NOT called (stopPropagation); onCopyLink called with shareToken; empty state text; save with non-empty/empty name. |
| `src/components/kg/KGControls.tsx` | Views + Save view buttons in ml-auto group; temporal sub-mode toggle | VERIFIED | `KGViewsPopover` rendered inside `ml-auto flex items-center gap-1.5` before Refresh button (line 143-163). `Point|Diff|Animate` sub-mode toggle rendered when `lens === "temporal"` (lines 168-185). |
| `src/pages/KnowledgeGraph.tsx` | `appliedViewRef`, `?view` hydration, `paintNodeDiff`, `useKgAnimation`, `handleUserLens`/`handleUserFilter` wrappers | VERIFIED | All present. `appliedViewRef` at line 193. Four-condition `?view` effect at lines 233-259. `paintNodeDiff` at lines 455-522 with `0.35` alpha for unchanged. `useKgAnimation` at line 149. WR-01 fix: `handleUserLens`/`handleUserFilter` at lines 350-363 clear `activeViewId` on user-driven changes. |
| `src/hooks/useKgDiff.ts` | `useKgDiff` + `computeDiff` exports; correct D-10/D-11/D-08 semantics | VERIFIED | Both exported. `computeDiff` does node Set arithmetic + attribute serialization + incident-edge comparison (D-10). Independent edge classification by `edgeKey` with composite fallback (D-11). WR-02 fix: `compare()` calls `setGraphA(null); setGraphB(null)` before fetches. D-08: catch branch sets `error`, never throws. |
| `src/hooks/useKgDiff.test.ts` | computeDiff set-arithmetic tests + 404 graceful-degrade test | VERIFIED | Covers: added/removed/changed nodes; node with new current edge → changed (D-10); new edge between unchanged nodes → edges.added (D-11); composite key fallback (Pitfall 6); 404 degrade. |
| `src/components/kg/KGDiffControls.tsx` | From/To date pickers + Compare button | VERIFIED | 101 lines. Two `Input type="date"`. Compare disabled when `!dateA || !dateB || dateA >= dateB || loading`. Inline hint when dates equal/invalid. |
| `src/hooks/useKgAnimation.ts` | Frame synthesis, LRU cache, play/pause/step/setFrameIndex, fps, currentGraph | VERIFIED | `synthesizeFrames` exported. LRU `cacheSet` helper. Prefetch uses fire-and-forget (no shared token — CR-01 fix; comment documents the fix at lines 149-151). Cache-check-before-fetch. Playback timer via `setInterval`. |
| `src/hooks/useKgAnimation.test.ts` | Frame synthesis + LRU eviction tests | VERIFIED | Frame synthesis suite (8 tests) + LRU suite (5 tests) + CR-01 regression test. Regression test asserts `currentGraph` is populated on cache-miss frame with uncached lookahead frames. |
| `src/components/kg/KGAnimateControls.tsx` | Range picker + interval select + scrubber + play/pause/step + speed select | VERIFIED | 196 lines. Slider scrubber with `onValueChange` pausing before `onSetFrameIndex`. Play/Pause/StepBack/StepForward icon buttons with correct aria-labels. Speed Select (0.5×/1×/2×). Per-frame error inline. |
| `convex/_generated/api.d.ts` | `api.savedKgViews` present | VERIFIED | Line 114: `import type * as savedKgViews from "../savedKgViews.js"`. Line 252: `savedKgViews: typeof savedKgViews` in the API type. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/hooks/useSavedViews.ts` | `api.savedKgViews.list` | `useQuery` | WIRED | Line 28: `useQuery(api.savedKgViews.list)` |
| `src/hooks/useSavedViews.ts` | `api.savedKgViews.save` | `useMutation` | WIRED | Line 30: `useMutation(api.savedKgViews.save)` |
| `src/pages/KnowledgeGraph.tsx` | `useSavedViews` | hook call | WIRED | Line 101: `const savedViews = useSavedViews()` |
| `src/pages/KnowledgeGraph.tsx` | `?view` shareToken hydration | `appliedViewRef` one-shot guard | WIRED | Lines 233-259: four-condition guard, exact `shareToken` match, all filter fields applied |
| `src/hooks/useKgDiff.ts` | `fetchOverview({ asOf })` | two parallel point-in-time fetches | WIRED | Line 230-233: `Promise.all([fetchOverview({asOf:dateA}), fetchOverview({asOf:dateB})])` |
| `src/pages/KnowledgeGraph.tsx` | `paintNodeDiff` | canvas paint swap when `temporalSubMode === "diff"` | WIRED | Lines 545-549: `isDiffActive` gate; line 896: `paintNode={paintNodeDiff}` on diff canvas branch |
| `src/hooks/useKgAnimation.ts` | `fetchOverview({ asOf })` | lazy per-frame fetch with cache-check-before-fetch | WIRED | Lines 168-173: cache-hit branch. Lines 176-190: cache-miss fetch with monotonic token. Prefetch fire-and-forget (lines 152-165, no shared token — CR-01 fix). |
| `src/components/kg/KGAnimateControls.tsx` | `useKgAnimation` playback controls | Slider scrubber + Play/Pause/Step + speed Select | WIRED | Slider `onValueChange` calls `onSetFrameIndex`; Play/Pause button; StepBack/StepForward buttons; speed Select calls `onSetFps` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `KGViewsPopover.tsx` | `views` prop | `useSavedViews()` → `useQuery(api.savedKgViews.list)` → Convex `savedKgViews` table | Yes — Convex DB query with `by_createdAt` index | FLOWING |
| `KnowledgeGraph.tsx` (diff canvas) | `diffGraphB` | `useKgDiff.compare()` → `fetchOverview({asOf})` → `toGraphData(normalizeOverview(resp))` | Yes — real API fetch with `Promise.all`, result stored in state | FLOWING |
| `KnowledgeGraph.tsx` (animate canvas) | `anim.currentGraph` | `useKgAnimation` → cache-check → `fetchOverview({asOf:frames[currentFrameIndex]})` | Yes — lazy per-frame fetch; cache hit returns stored graph | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running Convex backend + Ástríðr API for meaningful verification. tsc and vitest checks serve as the automated gates; live behavior deferred to human UAT.

### Probe Execution

Step 7c: No probe scripts found in `scripts/*/tests/probe-*.sh`. Not applicable to this phase.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| KG-10 | 87-01, 87-02 | Operator saves named, reusable graph views (lens + filters + focus + hops) and shares them via a link — beyond the existing last-state idb auto-persist | SATISFIED | `savedKgViews` table + `useSavedViews` hook + `KGViewsPopover` + `KnowledgeGraph.tsx` `?view` hydration cover both save/retrieve and share-link restore |
| KG-11 | 87-03, 87-04 | Operator diffs the KG between two as-of points and/or animates its evolution over time | SATISFIED | `useKgDiff` + `KGDiffControls` + `paintNodeDiff` + DIFF legend cover SC#3; `useKgAnimation` + `KGAnimateControls` + animate canvas cover SC#4 |

Both KG-10 and KG-11 are marked `[x]` in REQUIREMENTS.md. No orphaned requirements found for Phase 87.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No `TBD`, `FIXME`, `XXX`, placeholder returns, or hardcoded empty data found in any phase 87 file | — | — |

**Debt marker gate:** CLEAN — no unreferenced debt markers in any modified file.

**Additional observations (non-blocking):**
- IN-01 (top-level `focus`/`hops` columns are write-only): Both load paths (`handleLoadView`, `?view` effect) read exclusively from `view.filters.entityName` / `view.filters.hops` and ignore the top-level `view.focus`/`view.hops` columns. The columns are dead storage. Not a blocker — data is correctly loaded from `filters` and the extra columns cause no functional regression — but cleanup is advisable to avoid schema confusion.
- IN-03 (`setFps` without bounds guard): `setFps` writes verbatim to state; the only consumer is the speed Select constrained to 0.5/1/2. Low risk as noted in the review.

### Review Fixes Verified

All 5 items from 87-REVIEW.md (commit bd58402) confirmed present in live code:

| Finding | Fix Required | Verified |
|---------|-------------|---------|
| CR-01: Prefetch bumped primary frame token | Prefetch uses fire-and-forget with no shared token | YES — `useKgAnimation.ts` lines 152-165: prefetch calls `fetchOverview` directly with no `frameReqRef` access; primary fetch at lines 176-190 keeps exclusive token |
| WR-01: `activeViewId` never cleared on user filter/lens change | Wrap `setLens`/`setFilter` calls to KGControls with handlers that clear `activeViewId` | YES — `handleUserLens` (line 350) and `handleUserFilter` (line 357) both call `setActiveViewId(null)` before the setter |
| WR-02: Failed re-compare leaves stale diff rendered | Clear `graphA`/`graphBState` at start of `compare()` | YES — `useKgDiff.ts` lines 226-227: `setGraphA(null); setGraphB(null)` before `Promise.all` |
| WR-03: `save` mutation persists un-trimmed name | Persist `{ ...args, name: trimmed }` | YES — `convex/savedKgViews.ts` line 39: `ctx.db.insert("savedKgViews", { ...args, name: trimmed })` |
| WR-04: `buildShareUrl` does not encode token | Use `encodeURIComponent(shareToken)` | YES — `useSavedViews.ts` line 90: `?view=${encodeURIComponent(shareToken)}` |

### Human Verification Required

**1. Named View Persistence Across Sessions**
**Test:** Save a named view (e.g. "My Entity View" with entity lens, entityName "Alice", hops 2), close the browser tab, reopen the KG page in a fresh tab. Open the Views popover.
**Expected:** "My Entity View" appears in the list. Clicking it applies entity lens + entityName=Alice + hops=2. The active-view highlight (left border accent) shows on that row.
**Why human:** Convex persistence + idb hydration sequencing requires a live backend.

**2. Share URL Restores Configuration**
**Test:** Click Copy link on a saved view. Open the copied URL in a new incognito tab.
**Expected:** The KG opens with the saved lens/filters/focus/hops applied. Trying an invalid ?view=badtoken loads the default KG state silently (no error banner).
**Why human:** Requires live Convex deployment + browser navigation.

**3. Diff Rendering Visual Correctness**
**Test:** Switch to Temporal > Diff. Pick two dates with known KG changes between them. Click Compare.
**Expected:** Added nodes render green (#22c55e), removed red (#ef4444), changed amber (#eab308), unchanged dimmed. Added edges solid green, removed red dashed [4,3], changed solid amber, unchanged zinc-dimmed. DIFF legend appends below entity-type legend and hides when leaving diff mode.
**Why human:** Canvas painting and legend rendering require live KG data + visual inspection.

**4. Animation Playback**
**Test:** Switch to Temporal > Animate. Set a 5-day range, Day interval. Click Play.
**Expected:** Graph steps through all 5 frames at 1fps. Scrubber advances. StepForward/StepBack move one frame and pause. Scrubbing backward does not trigger re-fetches (previously fetched frames served from cache). Reaching last frame auto-pauses. Speed select at 2× plays twice as fast.
**Why human:** setInterval playback + canvas frame rendering + LRU cache behavior require a live browser with timing control.

**5. Active-View Highlight Clears on User Filter Change (WR-01 Fix)**
**Test:** Load a saved view via the popover (the row gets a left-border accent). Then change any filter (e.g. move hops slider or change entity type dropdown).
**Expected:** The active-view accent immediately disappears from the previously-loaded row in the Views popover.
**Why human:** State-clearing via wrapper handlers requires visual inspection in the running app.

**6. Graceful Degrade on Diff Fetch Failure (WR-02 Fix)**
**Test:** With Ástríðr stopped (or with a date beyond the snapshot range), click Compare in Diff sub-mode.
**Expected:** Red error banner appears inline. No stale diff is rendered beneath it (canvas stays at its pre-compare state). Point sub-mode remains usable. Diff date pickers are still populated.
**Why human:** Requires a real fetch failure scenario.

### Gaps Summary

None. All must-haves from the phase roadmap success criteria and all four PLAN frontmatter must-have blocks are VERIFIED at the code level. Both KG-10 and KG-11 requirements are satisfied. All five review findings (CR-01 BLOCKER + four warnings) are confirmed fixed in the live code. The only outstanding items are human-UAT behaviors that cannot be verified without a running Convex backend and browser.

---

_Verified: 2026-06-23T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
