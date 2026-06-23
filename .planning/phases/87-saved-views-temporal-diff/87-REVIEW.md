---
phase: 87-saved-views-temporal-diff
reviewed: 2026-06-23T18:41:45Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - convex/savedKgViews.ts
  - convex/schema.ts
  - src/hooks/useSavedViews.ts
  - src/hooks/useSavedViews.test.ts
  - src/components/kg/KGViewsPopover.tsx
  - src/components/kg/KGViewsPopover.test.tsx
  - src/components/kg/KGControls.tsx
  - src/pages/KnowledgeGraph.tsx
  - src/hooks/useKgDiff.ts
  - src/hooks/useKgDiff.test.ts
  - src/components/kg/KGDiffControls.tsx
  - src/hooks/useKgAnimation.ts
  - src/hooks/useKgAnimation.test.ts
  - src/components/kg/KGAnimateControls.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 87: Code Review Report

**Reviewed:** 2026-06-23T18:41:45Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the KG-10 Saved Views persistence/share-link flow and the KG-11 Temporal Diff + Animate sub-modes. The searchQuery-exclusion invariant (D-06) is correctly implemented in both `useSavedViews.saveView` and `useKnowledgeGraph` persistence. The diff set-arithmetic (`computeDiff`) is correct and well-tested, the edge composite-key fallback is sound, and the LRU eviction helper is correct. The one-shot `?view` hydration guard chain (hydrated + Convex-settled + token-match) is well-reasoned.

One BLOCKER was found in the animation fetch engine: the lookahead prefetch shares the same monotonic request token as the primary frame fetch and increments it synchronously, which causes the primary fetch's result to be discarded as "stale" on every cache miss when at least one un-cached lookahead frame exists. This defeats the displayed-frame fetch for the common case (first frame, stepping into uncached frames).

Additional warnings cover a stale-state UI claim (`activeViewId` never cleared as documented), stale diff data persisting after a failed re-compare, and the mutation persisting an un-trimmed name.

## Critical Issues

### CR-01: Lookahead prefetch invalidates the primary frame fetch token, dropping the displayed frame on every cache miss

**File:** `src/hooks/useKgAnimation.ts:170-200`
**Issue:** The primary cache-miss fetch captures a token, then the prefetch loop runs synchronously immediately afterward and bumps the same `frameReqRef` counter once per lookahead frame:

```ts
// Cache miss: fetch with monotonic token
const token = ++frameReqRef.current;          // e.g. token = N
fetchOverview({ asOf: key })
  .then((resp) => {
    if (token !== frameReqRef.current) return; // stale drop  ← N !== N+2, ALWAYS returns
    const g = toGraphData(normalizeOverview(resp));
    cacheSet(cacheRef.current, key, g);
    setCurrentGraph(g);                         // never runs
    ...
  })
  ...

// Prefetch ~2 frames ahead (fire-and-forget, cache-checked)
for (const offset of [1, 2]) {
  const ahead = frames[currentFrameIndex + offset];
  if (ahead && !cacheRef.current.has(ahead)) {
    const prefetchToken = ++frameReqRef.current; // bumps to N+1, then N+2
    ...
  }
}
```

When the current frame is a cache miss and one or two un-cached lookahead frames exist (the normal case for the first frame and for stepping/playing forward into new frames), `frameReqRef.current` is `N+1` or `N+2` by the time the primary `fetchOverview` resolves. The guard `token !== frameReqRef.current` is therefore true, so the primary `.then` returns early and **`setCurrentGraph(g)` is never called**. The frame's graph still gets cached, so a later revisit of the same index renders it — masking the bug — but the immediate display stays stuck on "Animating…" (when `currentGraph === null`) or on the previously displayed frame. The same token-collision exists in the cache-hit branch's prefetch loop (lines 152-165), but there `setCurrentGraph` is called synchronously before the prefetch, so only prefetch results race each other (benign).

**Fix:** Give prefetch its own monotonic counter (or do not gate prefetch on a shared token at all — prefetch only writes to the cache and is idempotent). Minimal change:

```ts
// add alongside frameReqRef:
const prefetchReqRef = useRef(0);

// primary fetch keeps frameReqRef:
const token = ++frameReqRef.current;
fetchOverview({ asOf: key }).then((resp) => {
  if (token !== frameReqRef.current) return;
  ...
});

// prefetch uses a separate counter that never touches frameReqRef:
for (const offset of [1, 2]) {
  const ahead = frames[currentFrameIndex + offset];
  if (ahead && !cacheRef.current.has(ahead)) {
    const pToken = ++prefetchReqRef.current;
    fetchOverview({ asOf: ahead }).then((resp) => {
      if (pToken !== prefetchReqRef.current) return;
      cacheSet(cacheRef.current, ahead, toGraphData(normalizeOverview(resp)));
    }).catch(() => {});
  }
}
```

Apply the same separation to both prefetch loops (cache-hit branch at lines 152-165 and cache-miss branch at lines 187-200).

## Warnings

### WR-01: `activeViewId` is never cleared on filter/lens change despite the documented contract

**File:** `src/pages/KnowledgeGraph.tsx:193-195`, `258`, `332`, `341`
**Issue:** The state declaration carries an explicit promise:

```ts
// Track the currently-loaded saved-view _id (cleared on any subsequent filter/lens change).
const [activeViewId, setActiveViewId] = useState<string | null>(null);
```

`setActiveViewId` is only ever called in three places: `?view` hydration (258), `handleLoadView` (332), and `handleDeleteView` (341, clears only if the deleted id matches). There is no effect or handler that clears it when the operator manually edits a filter, changes the lens, or moves the temporal sub-mode. After loading a view and then changing any control, the corresponding row in `KGViewsPopover` keeps the active highlight (`activeViewId === view._id` → `border-l-2 border-primary`, KGViewsPopover.tsx:177-180) even though the live graph no longer matches that saved view. The comment is therefore inaccurate and the UI shows a misleading "this view is active" state.

**Fix:** Either implement the documented behavior by clearing `activeViewId` whenever `lens`/`filters` change due to a non-load action (e.g., clear inside `setFilter`/`setLens` call sites that are user-driven, or compare current state against the loaded view), or correct the comment to state that the highlight persists until another view is loaded/deleted. If clearing, guard against the load handlers themselves re-triggering the clear (they set filters and the id in the same render).

### WR-02: Failed re-compare leaves stale diff rendered alongside the error banner

**File:** `src/hooks/useKgDiff.ts:218-262`
**Issue:** `compare()` sets `loading` and clears `error`, but does **not** reset `graphA`/`graphBState`:

```ts
const token = ++reqRef.current;
setLoading(true);
setError(null);
// graphA / graphBState are NOT cleared here
```

On a fetch failure the catch block sets `error` but leaves the previous successful `graphA`/`graphBState` intact, so the `diff` useMemo (264-267) keeps returning the old diff. In `KnowledgeGraph.tsx`, `isDiffActive` (526-530) stays true because `diff !== null && diffGraphB !== null`, so the canvas keeps rendering the previous comparison's colored graph while the red `diffError` banner (637-648) is shown above it. The operator sees a stale diff presented as if current, contradicting the "graceful-degrade" intent of D-08 (which should degrade to *no* result, not a misleading old one).

**Fix:** Clear the result graphs at the start of a fresh compare and/or on error:

```ts
const compare = useCallback(async () => {
  if (!dateA || !dateB) return;
  const token = ++reqRef.current;
  setLoading(true);
  setError(null);
  setGraphA(null);
  setGraphB(null);   // diff useMemo now returns null until a successful fetch
  ...
```

(Confirm the desired UX — if a "keep last good diff" behavior is intended, the error copy should say so explicitly.)

### WR-03: `save` mutation persists the un-trimmed name after validating the trimmed value

**File:** `convex/savedKgViews.ts:28-38`
**Issue:** Validation runs against `trimmed`, but the insert writes the original `args`:

```ts
const trimmed = args.name.trim();
if (trimmed.length < 1) { throw new Error("View name cannot be empty."); }
if (trimmed.length > 100) { throw new Error("View name cannot exceed 100 characters."); }
return await ctx.db.insert("savedKgViews", args);   // args.name is un-trimmed
```

A name like `"   My View   "` passes the length checks but is stored with surrounding whitespace. The client (`KGViewsPopover.handleConfirmSave`, line 65) trims before calling `onSaveView`, so the common path is unaffected — but the mutation is the security/validation boundary and should not depend on the client. Additionally, a name composed of >100 visible chars padded such that trim keeps it ≤100 is fine, but a 100-visible-char name with trailing spaces would store >100 chars, defeating the column-length intent.

**Fix:** Persist the trimmed value:

```ts
return await ctx.db.insert("savedKgViews", { ...args, name: trimmed });
```

### WR-04: `buildShareUrl` hardcodes the root path and ignores any deployment base path / existing query

**File:** `src/hooks/useSavedViews.ts:89-91`
**Issue:**

```ts
const buildShareUrl = (shareToken: string): string => {
  return `${window.location.origin}/knowledge-graph?view=${shareToken}`;
};
```

The URL is built from `origin` + a hardcoded `/knowledge-graph` path. If the SPA is ever served under a sub-path (e.g., a reverse-proxy mount or a non-root Vite `base`), the generated share link points at the wrong path and the recipient lands on a 404 / app root instead of the KG with the view applied. The router uses `react-router` with relative routes, so the base is not guaranteed to be the origin root. The share token is also not URL-encoded; it is a `crypto.randomUUID()` today (URL-safe), so this is latent rather than active.

**Fix:** Derive the path from the router base or `import.meta.env.BASE_URL`, and encode the token defensively:

```ts
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
return `${window.location.origin}${base}/knowledge-graph?view=${encodeURIComponent(shareToken)}`;
```

If a root mount is a hard project invariant, document it; otherwise this breaks silently on any sub-path deploy.

## Info

### IN-01: Persisted top-level `focus` and `hops` columns are dead — load paths read only `filters.*`

**File:** `convex/savedKgViews.ts:23-26`, `src/pages/KnowledgeGraph.tsx:251-257`, `322-331`
**Issue:** `save` stores both a top-level `focus`/`hops` (D-05) and the same values inside `filters` (since `KgFilters` already carries `entityName` and `hops`). Both load paths (`?view` hydration and `handleLoadView`) read exclusively from `view.filters.entityName` / `view.filters.hops` and never reference `view.focus` / `view.hops`. The top-level columns are write-only dead data. Either consume them on load (and treat them as the source of truth) or drop them from the schema/mutation to avoid divergence between the two stored copies.
**Fix:** Pick one storage location for focus/hops. If keeping the top-level fields per D-05, read them on load; otherwise remove them from `args`/schema.

### IN-02: Redundant edge-changed predicate — `current` is derived from `validTo`

**File:** `src/hooks/useKgDiff.ts:170-173`
**Issue:** `KgLink.current` is documented as "true when validTo === null" (kg-graph.ts:77-78). The edge-changed test `lA.current !== lB.current || lA.validTo !== lB.validTo` therefore tests a derived value alongside its source; the `current` half is fully implied by the `validTo` half. Harmless and correctly classifies, but the first clause is dead given the invariant.
**Fix:** Reduce to `lA.validTo !== lB.validTo` (or keep both and add a comment that `current` is intentionally re-checked for defensiveness against upstream drift).

### IN-03: `setFps` exposed without bounds; `1000 / fps` would divide by a zero/negative fps

**File:** `src/hooks/useKgAnimation.ts:248-250`, `204-218`
**Issue:** `setFps` writes the value verbatim into state, and the playback timer computes `setInterval(..., 1000 / fps)`. The only caller is the speed `<Select>` (KGAnimateControls.tsx:175-187) constrained to 0.5/1/2, so no invalid value reaches it today. As an exported hook control it is unguarded; a future caller passing 0 yields `Infinity` interval (no ticks) and a negative yields a negative delay (clamped to 0 → tight loop). Low risk while the only consumer is the bounded select.
**Fix:** Clamp on write: `const setFps = useCallback((n: number) => setFpsState(Math.max(0.1, n)), []);`

---

## What I dropped and why (precision note)

- **`KGViewsPopover` onBlur vs onMouseDown double-save** — the confirm button uses `onMouseDown` + `e.preventDefault()` which suppresses the input blur (KGViewsPopover.tsx:110-114), and the Enter path unmounts the input before blur. No double `onSaveView`. Not a defect.
- **`useKgDiff` non-404 AstridrApiError handling** — traced lines 241-255: a real `AstridrApiError` with status 500 fails the first `if` (status !== 404), correctly falls to the `else if (e.name === "AstridrApiError")` branch, and sets "Could not reach Ástríðr." Works as intended.
- **`computeDiff` "changed" node asymmetry** — only iterating `idsB` is correct: removed nodes are already captured in `removed`, and the incident-edge comparison uses `edgesA.size !== edgesB.size || some(...)`, which is a valid set-equality test given the size guard. No missed classification.
- **Animation reset effect ref comparison** (`prevFramesRef.current !== frames`) — `frames` is memoized on `[rangeStart, rangeEnd, interval]`, so reference identity is stable except on genuine input change. Correct.
- **ISO string `dateA >= dateB` comparison in KGDiffControls** — lexicographic comparison of full ISO timestamps is order-preserving. Correct.

---

_Reviewed: 2026-06-23T18:41:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
