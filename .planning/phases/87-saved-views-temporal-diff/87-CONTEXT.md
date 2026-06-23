# Phase 87: Saved Views + Temporal Diff - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Extends the existing KG Explorer (`src/pages/KnowledgeGraph.tsx`) and its control bar
(`src/components/kg/KGControls.tsx`) with two composable features. No new page or route.

- **KG-10 — Saved Views:** Operator saves the current graph state (lens + filters + focus + hops)
  as a named view, retrieves it by name in a later session, and shares it via a link.
- **KG-11 — Temporal Diff + Animation:** Operator compares the KG between two as-of points
  (added/removed/changed visual encoding) and animates its evolution forward through time
  (or steps manually), building on the existing single-point "temporal" lens — without
  replacing or regressing it.

**Out of scope (own future phase if raised):** new graph surfaces, server-side diff endpoints,
KG write/edit, multi-user collaboration on views.

</domain>

<decisions>
## Implementation Decisions

### KG-10 — View Persistence & Sharing
- **D-01:** Storage is a **new Convex `savedKgViews` table**. Required to satisfy SC#2 (a shared
  link must resolve a view another session/person can read). idb-only was rejected — it cannot share.
- **D-02:** **Global-to-deployment scope** — no owner/user field. Any operator on this CodePulse
  instance sees all saved views. Matches CodePulse's single-operator/team reality where Clerk auth
  is optional and often off. Do NOT add per-user scoping.
- **D-03:** Share links use a **short opaque random `shareToken`** stored alongside the view; URL
  shape is `?view=<token>`. Not guessable, independently revocable, decoupled from the internal
  Convex doc `_id`. (Raw doc-ID-as-param was rejected — exposes internals, not revocable.)
- **D-04:** Share-URL param `?view=<shareToken>` composes with the existing
  `?focus`/`?lens`/`?hops`/`?from` params. On page load, `KnowledgeGraph.tsx` reads `?view`,
  resolves the view from Convex by `shareToken`, and applies it one-shot using the **same
  hydration-guard pattern as the existing `?focus` param** (appliedFocusRef). Token absent/expired →
  silent fallback to default state (no error banner — SC#3 parity).

### KG-10 — What a "view" captures
- **D-05:** A saved view restores the **full SC#1 set: lens + filters + focus + hops.**
  ⚠️ **CORRECTION to 87-UI-SPEC.md:** the UI-SPEC's `useSavedViews` shape (`{lens, filters}`)
  dropped `focus` and `hops`. The `savedKgViews` schema and the save/load round-trip MUST include
  the focused entity + hop depth (the Phase 85 `?focus`/`hops` system already models these).
  Without this, the feature misses half of SC#1.
- **D-06:** **Exclude the transient `searchQuery`** from saved views. A saved Search-lens view
  restores the Search lens empty, ready for a fresh query. Search terms are ephemeral, not view
  config (matches UI-SPEC).

### KG-11 — Animation data source & scope
- **D-07:** Animation frames are **client-synthesized over a user-picked range + interval** — the
  operator picks start→end + an interval; the hook generates evenly-spaced as-of dates and fetches
  each via the existing `fetchOverview({ asOf })`. **ZERO cross-repo dependency.**
  ⚠️ **DEVIATION from 87-UI-SPEC.md:** the UI-SPEC assumed a net-new `fetchSnapshotDates()` calling
  a new Ástríðr `/api/kg/snapshots` endpoint. That is NOT used. Consequences for the planner:
  - `useKgAnimation` derives `frames` from `{rangeStart, rangeEnd, interval}`, NOT from
    `fetchSnapshotDates()`.
  - `KGAnimateControls` needs a **start/end range picker + interval selector** feeding the scrubber,
    not a scrubber bound to Ástríðr-provided dates.
  - The "No snapshot history available." empty state is largely moot — replaced by per-frame degrade.
  - **No SEED / no new Ástríðr endpoint required for KG-11.** Animation ships fully this phase.
- **D-08:** **Graceful-degrade, no hard block** (same posture as Phase 86 / KG-08). If an as-of
  fetch for a given frame or diff date fails (404/network), show the already-specced inline
  empty/error copy ("Could not load snapshot for {date}") and keep Point + Diff working. The phase
  is NOT blocked on Ástríðr KG-history depth.
- **D-09:** Frame cache + prefetch per UI-SPEC: cache fetched graphs by `asOf` key, prefetch ~2
  frames ahead, LRU-cap the cache (UI-SPEC says 20 entries) to bound memory across long ranges.

### KG-11 — Diff semantics
- **D-10:** A **node is "changed" (amber)** if its attributes/fact values differ **OR** its set of
  incident current edges differs between snapshot A and B. Catches both fact edits and
  relationship gain/loss (matches UI-SPEC's definition; resolves it as the chosen behavior).
- **D-11:** **Edges are diffed independently** — each edge gets its own added/removed/changed state.
  A new relationship between two otherwise-unchanged nodes shows as an ADDED edge (green). Resolves
  the UI-SPEC's internal tension (one line said "edge diffing follows from node-set membership";
  another said edges classify by their own current/superseded state — **independent classification
  wins**, because in a KG the relationship changes are often the most meaningful evolution).
- **D-12:** Diff is **client-side, node-id-based**, computed over the two `fetchOverview({ asOf })`
  snapshots. No new backend/Ástríðr endpoint (matches UI-SPEC).

### Claude's Discretion
- **Animation frame interval/granularity UX:** the exact interval options (e.g. day / week / month,
  or auto-fit ~12–30 frames across the chosen range) are planner/implementer discretion, within
  D-07. Sensible default: offer a small granularity select and cap total frames to keep playback and
  the LRU cache sane. The UI-SPEC's `Speed: 0.5×/1×/2×` is *playback speed* and is separate from the
  *frame interval* — both exist.
- All visual/token/copy/layout decisions are already locked by `87-UI-SPEC.md` — defer to it except
  where D-05 and D-07 above correct it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 87 design + requirements
- `.planning/phases/87-saved-views-temporal-diff/87-UI-SPEC.md` — **PRIMARY.** Full visual,
  component, copy, layout, and interaction contract (approved 6/6 dims). Read in full.
  ⚠️ Honor D-05 (add focus+hops to the saved-view shape) and D-07 (animation is client-synthesized,
  no `fetchSnapshotDates()`/Ástríðr endpoint) as corrections to this spec.
- `.planning/ROADMAP.md` — Phase 87 goal + 4 Success Criteria (SC#1–SC#4).
- `.planning/REQUIREMENTS.md` — KG-10 (lines ~25) and KG-11 (line ~26) requirement text.

### Reused systems (Phase 85 + design system)
- `src/lib/focus-url.ts` — `buildFocusUrl`, normalized-EXACT `focusKeysMatch`, same-origin
  `decodeFromParam` guard. The `?view` param + share-URL building compose with this system.
- `src/hooks/useFocusParam.ts` — one-shot focus hydration hook; mirror its guard pattern for `?view`.
- `.planning/phases/071-unified-design-system/UI-SPEC.md` — locked Matrix-Emerald tokens (inherited).

### Cross-repo degrade pattern (precedent for D-08)
- `.planning/phases/86-kg-full-text-search-clustering-layout/86-03-PLAN.md` — KG-08 graceful-degrade
  gate (404/network) for the Ástríðr search endpoint; same posture applies to per-frame/per-diff
  as-of fetch failures here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/kgApi.ts` — `fetchOverview({ asOf })` (kgApi.ts:198) already supports point-in-time
  re-querying. Both diff (2 calls) and animation (N synthesized calls) build directly on it.
  `KgOverviewParams.asOf` / `EntityParams.asOf` types already exist (kgApi.ts:151,158).
- `src/lib/kg-graph.ts` — `meta.asOf` already threaded through graph data (kg-graph.ts:34,196,218).
- `src/components/kg/KGControls.tsx` — existing Temporal lens single-point as-of Input + "Now"
  button (cited UI-SPEC:125-156); existing Slider (cited :98-108); lens-tab active style (:57-60).
- `src/pages/KnowledgeGraph.tsx` — `paintNode` (cited :212-256) to branch into `paintNodeDiff`;
  floating legend overlay (cited :379-429) to append the diff legend; `?focus`/idb hydration guard
  (cited :98-124); loading-pulse + error-banner patterns (cited :321-330, :431-435).
- shadcn primitives already installed (Phase 71): `popover`, `input`, `button`, `slider`, `select`,
  `sonner`/toast. **No `npx shadcn add` required.**

### Established Patterns
- Convex domain module + `useQuery`/`useMutation` hook wrapper (one hook per domain) →
  `savedKgViews` table + `useSavedViews` hook follow this.
- Graceful-degrade gate for cross-repo Ástríðr calls (KG-08, Phase 86) → applies to as-of fetch
  failures (D-08).
- `SectionErrorBoundary` wrapping KG sections (KnowledgeGraph.tsx:302-310).

### Integration Points
- **New:** `convex/savedKgViews.ts` (queries/mutations) + `savedKgViews` table in `convex/schema.ts`
  (shape: `{name, lens, filters, focus, hops, shareToken, createdAt}` per D-05).
- **New hooks:** `useSavedViews`, `useKgDiff`, `useKgAnimation` (all CodePulse-side).
- **New paint fn:** `paintNodeDiff` + a diff link-color fn, swapped in when diff sub-mode active.
- **Modified:** `KGControls.tsx` (Views/Save buttons, Temporal Point|Diff|Animate sub-mode toggle),
  `KnowledgeGraph.tsx` (wire callbacks, `?view` hydration, diff paint/legend swap).

</code_context>

<specifics>
## Specific Ideas

- Save-name entry is an **inline expand of the "Save view" button** (Input + checkmark), not a modal
  (UI-SPEC principled decision). Delete is a single trash-icon click, no confirmation (views are
  reconstructable preferences, not data).
- Diff encoding reuses `--status-*` tokens: green=added, red=removed (dashed), amber=changed,
  zinc-400 @ 0.35 alpha = unchanged (UI-SPEC Color section).
- Temporal sub-modes (`Point | Diff | Animate`) are a secondary control row under the Temporal lens,
  NOT new lens tabs — the lens value stays `"temporal"` (UI-SPEC Layout Contract).

</specifics>

<deferred>
## Deferred Ideas

- **Real Ástríðr-provided KG snapshot dates** (a `/api/kg/snapshots` endpoint feeding animation
  frames) — explicitly NOT this phase (D-07 uses client-synthesized intervals). If desired later as
  an upgrade, it's a swappable internal seam in `useKgAnimation` + a cross-repo SEED, with no UI
  change. Capture as a future enhancement, not a blocker.
- **Per-user view ownership / sharing permissions** — deferred (D-02 is global-scope). Revisit only
  if CodePulse becomes genuinely multi-tenant.

</deferred>

---

*Phase: 87-saved-views-temporal-diff*
*Context gathered: 2026-06-23*
