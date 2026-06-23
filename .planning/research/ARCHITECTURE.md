# Architecture Patterns — v9.0 Readability & Experience Integration

**Domain:** CodePulse v9.0 — integration audit of four feature areas into the existing React 19 + Vite + Convex SPA
**Researched:** 2026-06-23
**Confidence:** HIGH — all claims traced to live files read in this session

---

## 1. Theming (TH-01..06)

### How themes work today

Two parallel mechanisms co-exist after Phase 89:

**1a. Dark/light class toggle (DashboardLayout.tsx)**
`DashboardLayout.tsx:219-238` — `DarkModeToggle` component reads/writes `document.documentElement.classList` and `localStorage.setItem("theme", ...)`. On mount (`DashboardLayout.tsx:563-571`) it reads `localStorage.getItem("theme")` to restore state. The HTML ships with `<html class="dark">` hardcoded (`index.html:2`).

**1b. Skin `data-theme` switcher (ThemeSwitcher.tsx)**
`src/components/ThemeSwitcher.tsx` — reads/writes `localStorage.getItem("codepulse-theme")` (default `"cyan"`) and calls `document.documentElement.setAttribute("data-theme", value)`. Rendered in the header toolbar (`DashboardLayout.tsx:707`).

**Token structure in src/index.css:**
- `:root` (lines 58-125) — monochrome oklch light palette + `--radius: 0.5rem` + `--glow-*` tokens + `--speaking-ring*` tokens
- `.dark, [data-theme="cyan"]` (lines 127-182) — Electric Cyan skin (current default; `--primary: #06b6d4`)
- `[data-theme="emerald"]` (lines 184-200) — Matrix Emerald overrides only (`--primary: #10b981`; inherits neutrals from `.dark`)
- `[data-theme="amber"]` (lines 202-218) — Warning Amber overrides only

The `.dark` class and `[data-theme="cyan"]` are combined in one rule block — this is the shipped default. Skin overrides (`[data-theme="emerald"]`, `[data-theme="amber"]`) only reset the ~8 accent/brand tokens; they inherit the dark neutrals from the `.dark` block. A new "Midnight Aubergine" skin would follow the same pattern.

**What Phase 71 already shipped:**
- `--radius: 0.5rem` set (`:root:101`)
- `--info` alias token added (`:root:113`)
- `--glow-xs/sm/md/lg` tokens added — but using cyan `rgba(6,182,212,…)` values now that Electric Cyan is the default, not emerald
- `--speaking-ring` / `--speaking-ring-glow` tokens per skin (`[data-theme="cyan"]`, `[data-theme="emerald"]`, `[data-theme="amber"]`)

**Hardcoded colors still in components (Phase 71 cleanup debt):**
The UI-SPEC at `.planning/phases/071-unified-design-system/UI-SPEC.md` (section 2.3, 2.4) identifies these drifts. Based on the live code, the key offenders are:
- `MetricCard.tsx` — severity dots use hardcoded rgba/Tailwind classes rather than `--status-*` tokens (UI-SPEC §2.3)
- `FlexBarChart.tsx:78` — hardcoded orange hover glow (`rgba(249,115,22,0.6)`) instead of `--glow-sm`/primary
- Nav active/hover states in `DashboardLayout.tsx:312-313` — hardcoded `rgba(16,185,129,…)` emerald values, not `var(--primary)`. These will render wrong when a non-emerald skin is active.
- `.glow-card::before` in `index.css:258` — hardcoded `rgba(6,182,212,0.15)` cyan, not `var(--primary)/0.15`
- Scrollbar in `index.css:350-360` — hardcoded cyan rgba, not `var(--primary)`
- `ForceGraphCanvas.tsx:258` — `box-shadow: var(--glow-lg)` already uses the token (good)
- `RoomListItem.tsx:35` — correctly uses `var(--speaking-ring)` token (good)
- `AgentVoiceCard.tsx:55` — correctly uses `var(--speaking-ring)` / `var(--speaking-ring-glow)` (good)

**No-flash pre-paint script:**
`index.html` has NO inline script today (lines 1-16). It sets `class="dark"` statically but does not persist or restore the `data-theme` skin value before first paint. This means a user who saved `codepulse-theme: emerald` sees Electric Cyan until `ThemeSwitcher`'s `useEffect` fires — a FOUC on the theme switcher's first render. A `<script>` block reading `localStorage` and calling `document.documentElement.setAttribute("data-theme", ...)` synchronously before the body parses would fix this. This script must also toggle the `dark` class from `localStorage.getItem("theme")`.

**WCAG-AA / readability-first theme:**
No dedicated "Readable" theme exists. The light `:root` is monochrome oklch with sufficient contrast ratios for text but the dark skins have not been audited for WCAG AA. The `prefers-reduced-motion` block at `index.css:442-447` is present and correct.

### Integration map — theming

| File | Change | New vs Modified |
|------|--------|-----------------|
| `src/index.css` | Add `[data-theme="aubergine"]` block; fix `.glow-card::before` and scrollbar to use `var(--primary)`; add `--speaking-ring`/`--speaking-ring-glow` to new skin | Modified |
| `index.html` | Add inline `<script>` before `</head>` to read `localStorage` and set `data-theme` + `dark` class synchronously (no-flash) | Modified |
| `src/components/ThemeSwitcher.tsx` | Add "Midnight Aubergine" `<SelectItem>` entry | Modified |
| `src/layouts/DashboardLayout.tsx:312-313` | Replace hardcoded `rgba(16,185,129,…)` nav active/hover glow values with `var(--primary)/…` | Modified |
| `src/components/MetricCard.tsx:66-72` | Replace hardcoded severity colors with `--status-*`/`--info` token CSS vars | Modified |
| `src/components/FlexBarChart.tsx:78` | Replace orange hover glow with `var(--primary)` or `--glow-sm` | Modified |

**New files:** None — theming is entirely CSS token additions + component token-cleanup.

**Dependency:** The Phase 71 token cleanup (MetricCard, FlexBarChart drift) gates full cross-skin correctness. These components will look wrong on any non-emerald/non-cyan skin until they use `var(--primary)` and `var(--status-*)`.

---

## 2. Agent Room

### What exists (wired and working)

**Route:** `/war-room` — registered in `App.tsx:118`, lazy-loaded `WarRoom` page, in the ACTIVITY nav cluster (`DashboardLayout.tsx:196`).

**Page:** `src/pages/WarRoom.tsx` — fully wired:
- Queries `api.warRoom.listRooms` (reads `warRooms` table) and `api.warRoom.getRoomEvents` (reads `warRoomEvents` table)
- Subscribes to `transcript.chunk` and `room.participant_speaking` WebSocket events via `useAstridrWS` context
- Renders `RoomListItem`, `AgentVoiceCard`, `TranscriptPanel` (which wraps `TranscriptBubble`), `VoiceControlBar`
- Renders `WarRoomLaunchDialog` (which calls `createWarRoom` → `POST /api/war-room` on Ástríðr)

**Convex tables backing War Room (schema.ts:1277-1313):**
- `warRooms` — `{ roomId, name, status, participantIds[], createdAt, updatedAt }` — indexed by `roomId` and `status`
- `warRoomEvents` — `{ roomId, eventType, speakerId, speakerName, text, payload, timestamp }` — indexed by `room` and `timestamp`
- `voiceCalls` — `{ callId, botSessionId, status, platform, agentProfileId, durationMs, participantCount, costUsd, startedAt, endedAt }` — exists in schema but `warRoom.ts` does not query it; used by MeetingBot page

**Convex module:** `convex/warRoom.ts` — only two queries: `listRooms` (.collect() on `warRooms`) and `getRoomEvents` (.take(500) on `warRoomEvents`). No mutations or HTTP actions — room creation goes through Ástríðr's `/api/war-room` REST endpoint, not Convex directly. Room records presumably arrive via `runtimeIngest.ts` (the `warRooms` and `warRoomEvents` tables have no ingest switch in the first 100 lines of `runtimeIngest.ts`, but the tables exist and the page reads them — the ingest path is past line 100 of `runtimeIngest.ts` or via a separate mechanism).

**Components (all in `src/components/`):**
- `RoomListItem.tsx` — uses `--speaking-ring` token correctly; fully implemented
- `AgentVoiceCard.tsx` — uses `--speaking-ring`/`--speaking-ring-glow` tokens; honors `prefers-reduced-motion` via `useReducedMotion()` from `motion/react`; fully implemented
- `TranscriptBubble.tsx` — imported by `TranscriptPanel.tsx`, used in WarRoom; implemented
- `CallStatsBar.tsx` — 4-cell metric grid; used only in `MeetingBot.tsx`, NOT in WarRoom
- `WarRoomLaunchDialog.tsx` (in `src/components/hr/`) — fully implemented; calls `createWarRoom` from `astridrApi.ts`

**HR scaffolding:** `src/components/hr/` contains 45 files — roster, catalog, onboarding, teams, analytics, wizard, team presets, detail sheets. None of these are the "Agent Room" per se. `WarRoomLaunchDialog.tsx` lives here because it exposes `teamPresets` integration.

**teamPresets table (schema.ts:1358-1367):** `{ name, description, agentIds[], createdAt, updatedAt, createdBy, lastUsedAt, warRoomCount }` — used by `WarRoomLaunchDialog` via `useTeamPresets()` hook.

### What is orphaned / incomplete

**warRoom.ts `listRooms` uses `.collect()`** — unbounded read. With many rooms this will eventually hit the 16 MiB limit.

**No multi-persona / multi-agent chat within a room** — the current `warRoomEvents` schema stores `transcript.chunk` rows but there is no mechanism for CodePulse to *send* messages into the room. `VoiceControlBar` handles join/leave/mute UI state locally but has no API call for actual voice bridging — the actual voice/audio transport is entirely Ástríðr-side.

**No direct ingest path visible for `warRooms` rows** — room creation is delegated to Ástríðr's `/api/war-room` POST; how that results in a `warRooms` Convex document is not in `warRoom.ts` (no mutations). The ingest path is presumably in `runtimeIngest.ts` past line 100 or via a Convex action called by Ástríðr's server. This gap needs to be confirmed.

**Cross-repo dependency:** Multi-persona chat (agents talking to each other in a room, not just transcripts of external calls) requires Ástríðr to emit `transcript.chunk` WebSocket events per agent turn and to expose a `/api/war-room` endpoint that accepts topics and orchestrates agents. This is an Ástríðr-side dependency; CodePulse-side is already wired to consume the events.

### Integration map — Agent Room

| File | Change | New vs Modified |
|------|--------|-----------------|
| `convex/warRoom.ts` | Add `listRooms` pagination (`.paginate()` or bounded `.take(N)`) to prevent unbounded collect; add mutations for room state if Ástríðr doesn't write directly | Modified |
| `src/pages/WarRoom.tsx` | Scope completion depends on Ástríðr API surface — CodePulse side is largely complete for transcript display and room management | Likely minor modification |
| `convex/schema.ts` | No new tables needed for Phase 90 unless multi-persona chat storage is added | Possibly modified |
| `src/components/hr/WarRoomLaunchDialog.tsx` | Currently functional for launching via Ástríðr API; extension if multi-agent config grows | Possibly modified |

**New files needed:** Potentially a `src/pages/AgentRoom.tsx` (distinct from WarRoom) if the "Agent Room" scope resolves to a dedicated multi-persona surface rather than extending the existing War Room page. The audit-first requirement is correct — the existing `/war-room` page and its component tree is substantially complete.

---

## 3. 3D Memory Galaxy

### Existing graph stack

**`src/components/graph/ForceGraphCanvas.tsx`** — generic `react-force-graph-2d` wrapper:
- Props: `data: {nodes, links}`, `colorFn`, `labelFn`, `paintNode`, `linkColorFn`, `linkWidthFn`, `linkLineDashFn`, `focusSet`, `onNodeClick`, `onEngineStop`, `clusterForce`, `communityColorFn`
- Exposes `ForceGraphHandle` ref with `centerAt`, `zoom`, `zoomToFit`, `d3Force`, `d3ReheatSimulation`
- Imports `ForceGraph2D` from `react-force-graph-2d` at the module level — **not lazy loaded**

**`src/components/graph/CodeVaultGraph.tsx`** — consumes `useProjectGraph()` hook which reads `graphSnapshots` Convex table. Wraps `ForceGraphCanvas` with source-filter chips, freshness badge, integrity warnings, node detail panel, cross-graph navigation, fullscreen toggle. All domain logic (colorFn, paintNode, linkColorFn) is defined here.

**`src/hooks/useProjectGraph.ts`** — Convex `useQuery` subscription to the latest graph snapshot (inferred from the component's three-state logic: `undefined` = loading, `null` = no snapshot, `ProjectGraphData` = live).

**Data shape (`ProjectGraphData` — inferred from CodeVaultGraph.tsx usage):**
```typescript
{
  nodes: Array<{ id: string; label: string; type: string; source: string; community?: number; val?: number; x?: number; y?: number }>
  links: Array<{ source: string; target: string }>
  nodeCount: number
  storedNodeCount: number
  linkCount: number
  storedLinkCount: number
  generatedAt: number  // Unix seconds
  sources: Array<{ source: string; nodeCount: number; emittedNodeCount: number; truncated: boolean }>
}
```

**3D slot-in architecture:**

The Key Decision in PROJECT.md is: "a render-mode toggle on the existing `CodeVaultGraph`, reusing its data — not a new immersive page." This maps to:

1. A `renderMode: "2d" | "3d"` state in `CodeVaultGraph` (or lifted to the parent page)
2. When `"3d"`: lazy-import `react-force-graph-3d` (which pulls in Three.js, ~600 KB gzipped) instead of rendering `ForceGraphCanvas`
3. When `"2d"`: current `ForceGraphCanvas` path unchanged

The critical constraint is that `react-force-graph-2d` is currently imported statically in `ForceGraphCanvas.tsx:9`. The 3D library must NOT be in the same module. The pattern:

```typescript
// src/components/graph/ForceGraphCanvas3D.tsx  [NEW]
// Lazy-imported from CodeVaultGraph only when 3D mode is selected
import ForceGraph3D from "react-force-graph-3d";
// ... same prop API as ForceGraphCanvas where possible
```

`CodeVaultGraph.tsx` would use `React.lazy()` or dynamic `import()` for the 3D canvas, only when mode is toggled. The 2D default (`ForceGraphCanvas`) remains statically imported as today — no regression on the default render path.

**`ForceGraphCanvas` API compatibility:** The 3D component needs to accept the same `data`, `colorFn`, `onNodeClick`, `onEngineStop` props. `paintNode` (Canvas 2D API) cannot be reused for 3D — Three.js materials replace it. `linkColorFn`, `linkWidthFn`, `linkLineDashFn` have equivalents in `react-force-graph-3d`. The `ForceGraphHandle` ref interface (`centerAt`, `zoomToFit`, etc.) has equivalents in the 3D library.

**Note on R3F vs react-force-graph-3d:** PROJECT.md's Key Decision says "React Three Fiber 3D render mode toggle." `react-force-graph-3d` uses Three.js directly (not R3F). If a full R3F integration is intended (for custom particle effects, `@react-three/fiber` scene), a separate `<Canvas>` from `@react-three/fiber` would be needed — heavier setup. `react-force-graph-3d` is simpler, reuses the same force simulation API as the 2D library, and matches the existing ForceGraph2D API surface more closely. Recommend `react-force-graph-3d` unless custom shader/particle effects are required.

### Integration map — 3D Memory Galaxy

| File | Change | New vs Modified |
|------|--------|-----------------|
| `src/components/graph/ForceGraphCanvas3D.tsx` | New component; lazy-imported; wraps `react-force-graph-3d` with same prop surface as `ForceGraphCanvas` | **New** |
| `src/components/graph/CodeVaultGraph.tsx` | Add `renderMode` state (`"2d"` default); toggle button in header row; `React.lazy()` / dynamic import for `ForceGraphCanvas3D`; `<Suspense>` fallback in 3D branch | Modified |
| `package.json` | Add `react-force-graph-3d` (and `three` if not already present) | Modified |
| `src/test/setup.ts` | Add Three.js / `react-force-graph-3d` mock alongside existing `react-force-graph-2d` mock | Modified |
| `convex/` | No changes — same data, same `useProjectGraph()` hook | Unchanged |
| `src/App.tsx` | No changes — `GraphsHub` and its `CodeVaultGraph` are already lazy-loaded | Unchanged |

**Three.js bundle impact:** `react-force-graph-3d` + `three` is ~600-800 KB gzipped. Lazy loading in a dynamic import inside `CodeVaultGraph` means it is only fetched when the user activates 3D mode for the first time. The 2D default has zero bundle regression.

---

## 4. Analytics Rollup

### Current read patterns (convex/analytics.ts)

All five queries read raw domain tables with `.take()` caps as a quick-unblock:

| Query | Table(s) | Cap | Comment in code |
|-------|----------|-----|-----------------|
| `activityHeatmap` | `events` | `.take(1000)` | "~56% of 16 MiB limit at current payload sizes" |
| `toolFlowSankey` | `events` | `.take(1000)` | Same note |
| `tokenSunburst` | `llmMetrics` | `.take(30000)` | "slim rows but unbounded .collect() is latent risk" |
| `errorRateTrend` | `events` x3 queries | `.take(300)` each | "3 fat-payload reads" |
| `tokenWaterfall` | `llmMetrics` | `.take(30000)` | "avoid unbounded .collect()" |
| `sessionDurations` | `sessions` | `.take(200)` | Sessions are slim; lower risk |

**The `events.payload` problem:** `events.payload` is `v.any()` (fat — arbitrary JSON from hook events). Even reading only `timestamp` from a row costs the full document deserialization in Convex's read budget. 1000 events x ~9 KB avg payload = ~9 MiB, leaving little headroom. The `.take(1000)` cap means heatmap and Sankey only reflect the most recent ~1000 events, silently under-counting older activity.

**Existing pre-computed aggregates table:** `aggregates` table exists in schema (`schema.ts:883-891`):
```
{ metric_type: "cost"|"events"|"errors", period: "hourly"|"daily", bucket_start: float64, value: float64, dimensions?: any }
```
This table was added in v4.0 Phase 5 for cost aggregation. It is not currently used by `analytics.ts` queries.

### Ingest write paths

**Build-time:** `convex/ingest.ts` (`buildIngest` httpAction) → `api.events.ingest` mutation (writes `events` table). No rollup writes here currently.

**Runtime:** `convex/runtimeIngest.ts` (`runtimeIngest` httpAction) → `api.llm.recordCall` mutation (writes `llmMetrics` table) for `llm_call` events.

**Where rollup writes go:** Ingest-time rollup means: after writing the raw row, immediately increment a pre-aggregated counter in a rollup table. Pattern (from v4.0 Phase 5 precedent using `aggregates`):

```
runtimeIngest → api.llm.recordCall [existing]
             → api.analytics.incrementHourlyBucket [new mutation]
ingest.ts    → api.events.ingest [existing]
             → api.analytics.incrementEventBucket [new mutation]
```

The read-path swap then changes `activityHeatmap` and `toolFlowSankey` to query the `analyticsRollup` or reuse `aggregates` by `metric_type` + `period:hourly` + time range — completely eliminating the fat-payload `events` read.

### Integration map — Analytics Rollup

| File | Change | New vs Modified |
|------|--------|-----------------|
| `convex/schema.ts` | Add rollup tables (or extend `aggregates`) for: event-counts by hour (heatmap), event-type-to-outcome flows (Sankey), error counts by hour — OR reuse the existing `aggregates` table with new `metric_type` values | Modified |
| `convex/analytics.ts` | Replace `.take()`-capped reads with rollup table queries for `activityHeatmap`, `toolFlowSankey`, `errorRateTrend`; `tokenSunburst` and `tokenWaterfall` can keep `llmMetrics` reads (rows are slim) but bounded by time window | Modified |
| `convex/ingest.ts` | After `api.events.ingest`, call new rollup mutation to increment event-count and event-type buckets | Modified |
| `convex/runtimeIngest.ts` | After `api.llm.recordCall` for `llm_call` events, increment cost/token rollup buckets | Modified |
| `convex/analyticsRollup.ts` (or extend `convex/aggregates.ts`) | Mutations: `incrementEventBucket`, `incrementErrorBucket`, `incrementFlowBucket` | **New** |

**Dependency:** The rollup tables must exist and be populated before the analytics read-path swap. The recommended sequence is: (1) add schema + rollup mutations, (2) deploy and let ingest populate rollups forward, (3) swap analytics queries to read from rollups. A backfill migration is optional but not required for correctness — pre-rollup history simply shows zero until real data accumulates.

---

## 5. Component Boundaries Summary

```
src/main.tsx
  ConvexProvider
    PrivacyProvider
      AmbientProvider
        ClerkProvider (optional)
          BrowserRouter
            AstridrWSProvider
              AuthGuard
                DashboardLayout (nav + header + CRT overlay)
                  [theme: index.html sets class="dark"; ThemeSwitcher sets data-theme]
                  Outlet
                    /graphs → GraphsHub → CodeVaultGraph → ForceGraphCanvas (2D, default)
                                                         → ForceGraphCanvas3D [NEW, lazy, 3D toggle]
                    /war-room → WarRoom → RoomListItem (--speaking-ring token)
                                       → AgentVoiceCard (--speaking-ring tokens, reduced-motion)
                                       → TranscriptPanel → TranscriptBubble
                                       → VoiceControlBar
                    /analytics → Analytics (lazy)
                    /meeting-bot → MeetingBot → CallStatsBar [not used in WarRoom]
```

```
convex/
  schema.ts            ← 50+ tables; warRooms + warRoomEvents + voiceCalls + teamPresets + aggregates
  analytics.ts         ← 5 queries; all use .take() caps against raw tables [to be replaced]
  analyticsRollup.ts   ← [NEW] ingest-time rollup mutations
  warRoom.ts           ← listRooms (.collect() — needs cap) + getRoomEvents
  ingest.ts            ← buildIngest httpAction; add rollup mutation calls
  runtimeIngest.ts     ← runtimeIngest httpAction; add rollup mutation calls
```

---

## 6. Suggested Build Order (with dependency rationale)

### Phase 88 — Analytics Rollup (independent, lowest risk)

1. **Schema + rollup mutations** — add tables/extend `aggregates`, write `analyticsRollup.ts` mutations. No UI change.
2. **Wire ingest** — call rollup mutations from `ingest.ts` and `runtimeIngest.ts`. Deploy. Rollup data begins accumulating.
3. **Read-path swap** — update `analytics.ts` queries to read from rollup tables. Remove `.take()` caps on the event queries.
4. *(Optional backfill)* — scan existing `events` rows and populate rollup tables. Not required for correctness.

**Rationale:** Entirely Convex-side, no UI changes, no component regressions. Should ship first or in parallel with Phase 89.

### Phase 89 — Theming (gates later phases on token-clean components)

**Sub-sequence:**
1. **Token cleanup first** — fix `DashboardLayout.tsx` nav glow values, `MetricCard.tsx` severity, `FlexBarChart.tsx` orange glow to use `var(--primary)` and `var(--status-*)`. Without this, any non-cyan skin renders incorrectly.
2. **No-flash script** — add inline `<script>` to `index.html` reading `localStorage` for both `theme` (dark/light class) and `codepulse-theme` (data-theme). Must happen before or alongside skin additions or users see FOUC.
3. **New skin(s)** — add `[data-theme="aubergine"]` block to `index.css`, add `SelectItem` to `ThemeSwitcher.tsx`. Safe to ship after #1 and #2.
4. **WCAG-AA audit** — check contrast ratios for all three current skins + new skin. Fix any failing token values. Depends on #1 (so tokens are canonical) but can run in parallel with #3.

**Rationale:** Token cleanup gates correctness for all skins. The 3D Galaxy's node colors will also benefit from token-clean components (`var(--primary)` is already used in `ForceGraphCanvas.tsx:258` via `--glow-lg`).

### Phase 90+ — Agent Room (gated on Ástríðr API audit)

1. **Confirm ingest path** — read `convex/runtimeIngest.ts` past line 100 to confirm how `warRooms` rows are created. Fill gap if missing.
2. **Fix `warRoom.ts` listRooms** — replace `.collect()` with `.take(N)` or `.paginate()`.
3. **Audit Ástríðr `/api/war-room` API** — the scope of multi-persona chat depends entirely on what Ástríðr can orchestrate. The CodePulse display layer is largely complete.
4. **Extend or add page** — if multi-persona chat is a different UX from the war-room voice surface, add `/agent-room` route and page. If it extends the existing surface, modify `WarRoom.tsx`.

**Rationale:** Agent Room depends on Ástríðr-side API completeness (cross-repo). The audit-first approach is correct. Do not build new CodePulse UI before knowing what events Ástríðr will emit.

### Phase 91+ — 3D Memory Galaxy (independent, requires Phase 89 for token-clean colors)

1. **Install `react-force-graph-3d`** — add to `package.json`; add `three` if not already present.
2. **Add test mock** — extend `src/test/setup.ts` with a `react-force-graph-3d` mock alongside the existing `react-force-graph-2d` mock.
3. **Create `ForceGraphCanvas3D.tsx`** — new component, NOT exported from `ForceGraphCanvas.tsx`. Same prop surface where possible.
4. **Wire toggle in `CodeVaultGraph.tsx`** — add `renderMode` state, toggle button, `React.lazy()` import of the 3D canvas.

**Rationale:** Independent of theming and analytics. Can ship any time after Phase 89 theming is stable so the 3D canvas inherits correct `var(--primary)` colors. No Convex changes needed.

---

## 7. Anti-Patterns to Avoid

### Anti-Pattern 1: Importing Three.js statically alongside react-force-graph-2d
**What:** Adding `import ForceGraph3D from "react-force-graph-3d"` at the top of `ForceGraphCanvas.tsx`
**Why bad:** Bundles Three.js (~600 KB) into the 2D default code path, regressing every page that renders a graph
**Instead:** New `ForceGraphCanvas3D.tsx` module, dynamic-imported from `CodeVaultGraph.tsx` only on 3D mode activation

### Anti-Pattern 2: Hardcoding accent colors in new components
**What:** Writing `rgba(6,182,212,…)` (cyan) or `#10b981` (emerald) directly in component styles
**Why bad:** The skin system is `data-theme` driven; hardcoded values break on any non-default skin
**Instead:** Use `var(--primary)`, `var(--glow-sm)`, `var(--status-*)` tokens in all new and modified components

### Anti-Pattern 3: Blocking analytics read-path swap before rollup data exists
**What:** Switching `analytics.ts` to read from rollup tables before the ingest mutations have populated them
**Why bad:** All analytics charts show zero — looks like data loss
**Instead:** Deploy rollup mutations + ingest wiring first; let data accumulate for one ingest cycle; then swap read path

### Anti-Pattern 4: Building new Agent Room UI before confirming Ástríðr API surface
**What:** Designing a multi-persona chat interface against an assumed WebSocket event schema
**Why bad:** If Ástríðr emits different event names/shapes, the CodePulse components need rewriting
**Instead:** Read `runtimeIngest.ts` in full; test with a real `transcript.chunk` event from a live room; then extend the UI

### Anti-Pattern 5: Theme no-flash script after the React bundle loads
**What:** Restoring the `data-theme` skin in a React `useEffect` (as `ThemeSwitcher` currently does)
**Why bad:** React hydration completes after the HTML is painted — user sees the wrong skin for ~200-400ms
**Instead:** Inline `<script>` in `<head>` of `index.html` synchronously sets both `class` and `data-theme` attributes before the browser paints

---

## Sources

All claims traced to live files read in this session:

- `src/index.css` — full file (448 lines)
- `src/layouts/DashboardLayout.tsx` — full file (741 lines)
- `src/App.tsx` — full file
- `src/components/ThemeSwitcher.tsx` — full file
- `src/components/graph/CodeVaultGraph.tsx` — full file (702 lines)
- `src/components/graph/ForceGraphCanvas.tsx` — full file (297 lines)
- `src/components/RoomListItem.tsx` — full file
- `src/components/AgentVoiceCard.tsx` — full file
- `src/components/hr/WarRoomLaunchDialog.tsx` — full file
- `src/pages/WarRoom.tsx` — full file
- `src/lib/astridrApi.ts` — lines 1-60, 245-256
- `convex/analytics.ts` — full file (250 lines)
- `convex/ingest.ts` — lines 1-100
- `convex/runtimeIngest.ts` — lines 1-100
- `convex/warRoom.ts` — full file
- `convex/schema.ts` — full file (1400+ lines; warRooms:1277, warRoomEvents:1288, voiceCalls:1300, teamPresets:1358, aggregates:883)
- `.planning/phases/071-unified-design-system/UI-SPEC.md` — full file
- `.planning/PROJECT.md` — full file
- `index.html` — full file
