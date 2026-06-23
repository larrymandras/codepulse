# Pitfalls Research — CodePulse v9.0 Readability & Experience

**Domain:** Adding readable theme system, 3D force-graph mode, multi-persona Agent Room, and Convex ingest-time analytics rollups to a live React 19 + Vite 7 + Convex SPA
**Researched:** 2026-06-23
**Confidence:** HIGH (grounded in live code inspection, confirmed schema, confirmed CSS, confirmed analytics query patterns)

---

## Critical Pitfalls

### Pitfall 1: Theme Flash on First Paint (FOUC)

**What goes wrong:**
The current `ThemeSwitcher.tsx` reads localStorage and calls `document.documentElement.setAttribute("data-theme", saved)` inside a `useEffect`. That effect fires after hydration, meaning there is always at least one frame where the default dark/cyan skin renders before the saved theme is applied. On any theme other than the default the user sees a cyan flash on every hard refresh.

**Why it happens:**
React effects run post-paint. The `data-theme` attribute needs to be set synchronously before the browser paints. The existing `ThemeSwitcher` does this correctly for *subsequent* toggles but not for the initial load.

**How to avoid:**
Inject a blocking inline `<script>` in `index.html` (before any CSS loads) that reads localStorage and sets `data-theme` on `<html>` synchronously:

```html
<script>
  (function() {
    var t = localStorage.getItem('codepulse-theme') || 'cyan';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

The `ThemeSwitcher` useEffect then syncs React state to match what is already on the DOM rather than initiating the attribute change. This is the same pattern used by next-themes, Radix UI's ThemeProvider, and every major dark-mode implementation.

**Warning signs:**
- Visible cyan flash on hard refresh when a non-default theme is saved
- Visual testing in Playwright captures the wrong initial state on first render
- Vitest snapshot tests show the wrong `data-theme` attribute on mount

**Phase to address:** Phase 89 (Readable Themes & Editorial Skin Toggle) — plan 1 must include the pre-paint script before any token or switcher work.

---

### Pitfall 2: Incomplete Token Migration — 77 Hardcoded Color Sites Survive the Switcher

**What goes wrong:**
Grepping the `src/` tree for hardcoded accent and status hex values (`#06b6d4`, `#10b981`, `rgba(6, 182, 212, ...)`, `rgba(16, 185, 129, ...)`) returns 77 occurrences across 24 files (confirmed by live grep). These are in `ForceGraphCanvas.tsx`, `CodeVaultGraph.tsx`, `AgentAvatar.tsx`, `AgentTopology.tsx`, `ProviderComparisonChart.tsx`, `SDKSpendGuard.tsx`, `SwarmGraph.tsx`, `GanttTimeline.tsx`, `skills/` components, and `kg-graph.ts`. When a theme toggle changes `--primary` and `--status-ok`, all 77 sites stay visually wrong because they reference the hex directly rather than the token.

Additionally, 52 files use `var(--status-ok)` / `var(--status-error)` / `var(--status-warn)` / `var(--status-info)` / `var(--metric-*)` inline class names (confirmed). Those tokens exist in the `:root` and `.dark` blocks but are not overridden in `[data-theme="emerald"]` or `[data-theme="amber"]` — only `--status-ok` is partially overridden per theme. A new Midnight Aubergine theme block must define the full semantic token set or status colors will not change.

**Why it happens:**
These files predate the Phase 71 token audit, which was shipped "light" without completing the hardcoded-color pass. The canvas-based rendering (D3, react-force-graph-2d) cannot use CSS custom properties at all — canvas `fillStyle` requires a resolved color string — so those sites will always need a JS-level theme-aware color resolver, not a CSS variable.

**How to avoid:**
Phase 89 must begin with a full audit of all hardcoded hex sites, split into two buckets:

1. **CSS-reachable** (JSX className, inline style strings): replace with `var(--token)` — the full set of theme tokens must be declared in every `[data-theme]` block.
2. **Canvas-paint** (ForceGraphCanvas, CodeVaultGraph, KG Explorer paint callbacks): introduce a `useThemeColors()` hook that reads `getComputedStyle(document.documentElement).getPropertyValue('--primary')` and returns a memoized palette; pass the palette into `colorFn`/`paintNode` props rather than embedding hex.

The scrollbar CSS in `index.css` also hardcodes `rgba(6, 182, 212, ...)` at lines 350-360 — this must become `var(--primary)`.

**Warning signs:**
- Switching to Midnight Aubergine leaves graph nodes, gauges, and skill chips in cyan/emerald
- Status badge colors do not change between themes
- Any `grep` for `#06b6d4` or `#10b981` in `src/` returning hits after the token pass is a sign the migration is incomplete

**Phase to address:** Phase 89, plan 1 (token audit + full `[data-theme]` block definition) and plan 2 (canvas color resolver hook). Must complete before the Midnight Aubergine theme visually works.

---

### Pitfall 3: `prefers-reduced-motion` Doesn't Actually Disable Scanline/Glow Animations

**What goes wrong:**
`src/index.css` has a correct `@media (prefers-reduced-motion: reduce)` block at line 442 that zeros `animation-duration` and `transition-duration` on `*`. However, glow effects on `.glow-card` are implemented as `box-shadow` values (from the `--glow-*` tokens), not as animations. Scanline and matrix-grid overlays are CSS `background-image` patterns, not animations. These do not respond to `prefers-reduced-motion`. The `animated` scrollbar pulse on hover (`box-shadow: 0 0 8px rgba(...)`) is always-on.

The Phase 89 requirement TH-05 states "respects prefers-reduced-motion (disables scanline/tick animations)" — this is partially already handled for keyframe animations but not for static visual noise (glows, grids, pseudo-element overlays).

**How to avoid:**
Add a dedicated `@media (prefers-reduced-motion: reduce)` block that also zeros `--glow-xs/sm/md/lg` tokens (set to `none`), removes the `matrix-bg` pseudo-elements, and hides the `::before`/`::after` overlays that implement scanlines or paper-grain. The Midnight Aubergine theme's `body::before` (paper-grain) and `body::after` (ambient radials) described in the CONTEXT.md provenance should also respect this media query.

**Warning signs:**
- macOS/Windows "Reduce Motion" accessibility setting enabled, but glow effects remain visible
- Playwright/axe does not automatically catch this — needs a manual check or a forced `prefers-reduced-motion` media simulation in the E2E suite

**Phase to address:** Phase 89, plan 3 (reduced-motion + a11y pass). Include Playwright `page.emulateMedia({ reducedMotion: 'reduce' })` in the test that verifies animation disabling.

---

### Pitfall 4: Midnight Aubergine Theme Forks Markup Instead of Tokens

**What goes wrong:**
The provenance for the Midnight Aubergine theme (CONTEXT.md) references `body::before` (paper-grain) and `body::after` (ambient radials) as `globals.css` patterns. Implementing these as unconditional `body::before/after` rules in `index.css` means they apply to ALL themes, not just Midnight Aubergine. Scoping them with `:root:has([data-theme="aubergine"]) body::before` requires CSS nesting or a class that may not work with the current Tailwind 4 / shadcn setup.

**Why it happens:**
The pack pattern was written for a Next.js app with a single theme. CodePulse needs multi-theme co-existence. The `body::before`/`body::after` approach conflicts with the existing `.matrix-bg::after` grid overlay and the `glow-card::before` radial — adding more pseudo-elements without careful stacking causes z-index fights and visual artifacts.

**How to avoid:**
Scope all Midnight Aubergine visual effects to the `[data-theme="aubergine"]` selector block. Use CSS custom properties for the overlay opacity/content so the default value is `none` and the aubergine block sets them live. For effects that genuinely need pseudo-elements, move them to a wrapper `<div data-bg-effect>` rendered inside `DashboardLayout` that is conditionally rendered or class-toggled based on the active theme — this avoids competing `::before`/`::after` pseudo-elements on `body`.

**Warning signs:**
- Paper-grain texture appears on the Matrix Emerald or Electric Cyan skins
- Switching themes leaves visual residue from the previous theme's pseudo-element
- `z-index` fights between `.matrix-bg` and the aubergine background layer

**Phase to address:** Phase 89, during the Midnight Aubergine token definition plan.

---

### Pitfall 5: WCAG AA Regression on Status Colors Across All Themes

**What goes wrong:**
The current dark skin uses `--status-ok: #06b6d4` (cyan). Cyan text on the dark `#040405` background passes WCAG AA for large text but fails for small text (body paragraphs, badge labels) — the contrast ratio is approximately 5.0:1 against the current dark background, which passes AA at 4.5:1 but fails AAA. More critically, `--status-warn: #eab308` (yellow) on a warm Midnight Aubergine background (cream text on dark aubergine) has an unpredictable contrast ratio that will not be validated without testing.

**How to avoid:**
Use the Playwright/axe path that already exists in the E2E suite. Add a dedicated contrast-audit test that visits Dashboard, Live Run, Analytics, Forge, and Graphs pages with each theme active and runs `axe` at AA level. Do not skip this test in CI. The CONTEXT.md lists TH-06 as this exact requirement.

One specific risk: the Midnight Aubergine theme uses "cream text" (`--foreground`) against a "warm aubergine bg" (`--background`). The body contrast will be high (good), but status badges that overlay a dark aubergine card background with colored text need per-theme status token values, not just a single global `--status-warn`.

**Warning signs:**
- `axe` reports in Playwright failing after theme switch
- Badge components using `var(--status-warn)` appearing low-contrast on the new theme
- CI E2E pass while manual review on a calibrated monitor reveals contrast failures

**Phase to address:** Phase 89, plan 3 (a11y pass). Must run all themes through axe before marking the phase complete.

---

### Pitfall 6: Breaking the Existing Dark/Light Toggle When Adding the Skin Toggle

**What goes wrong:**
The existing CSS structure uses `.dark, [data-theme="cyan"]` as a combined selector on line 128 of `index.css`. The ThemeSwitcher already sets `data-theme` on `<html>`, but the original dark mode was class-based (`class="dark"`). If Phase 89 renames the `[data-theme="cyan"]` block, removes the `.dark` selector pairing, or introduces a new toggling mechanism that sets a different attribute, the existing dark mode behavior (nav active colors, chart colors, glass effects) can break silently on any component that uses `dark:` Tailwind variants.

**Why it happens:**
The `@custom-variant dark (&:is(.dark *))` rule in `index.css` (line 6) makes `dark:` Tailwind utilities work based on the `class="dark"` on `<html>`. The Phase 89 ThemeSwitcher only sets `data-theme`, it does not set `class="dark"`. So a non-dark theme (e.g. Midnight Aubergine if it is intended to be a light variant) would need to also remove `class="dark"` from `<html>` — otherwise all `dark:` Tailwind utilities stay active. This dual-attribute system is a latent inconsistency.

**How to avoid:**
Decide early in Phase 89 whether `class="dark"` stays as a permanent fixture (all existing themes are dark; the `.dark` class is always present) or becomes part of the theme toggle. If all themes are dark variants, keep `class="dark"` permanently set on `<html>` and only switch `data-theme`. If Midnight Aubergine is a light-leaning theme, the toggle must also manage `class="dark"`. Document this decision in the phase plan — it affects every `dark:` Tailwind utility across 110+ components.

**Warning signs:**
- Components with `dark:text-foreground` or `dark:bg-card` variants displaying incorrectly after theme switch
- Sidebar icon colors reverting to light-mode values
- The `data-theme="cyan"` block in `index.css` not being triggered because the selector relies on `.dark` also being present

**Phase to address:** Phase 89, plan 1 (token audit) — must resolve the `.dark` / `data-theme` relationship before writing any new token blocks.

---

### Pitfall 7: 3D Bundle Regresses the 2D Default Path

**What goes wrong:**
`@react-three/fiber` and `three` are large packages. Three.js alone is approximately 600 KB minified (before gzip). If the 3D mode import is at the top level of `CodeVaultGraph.tsx` or anywhere in its direct import chain, the 3D bundle ships to every user on every graph page load — even users who never toggle to 3D mode. The PROJECT.md Key Decisions note explicitly states "3D is opt-in only; 2D `ForceGraphCanvas` stays the default render path" — this must be enforced at the bundle level, not just the UI level.

**Why it happens:**
Developers add a render-mode toggle with a conditional branch (`mode === '3d' ? <ThreeGraph /> : <ForceGraphCanvas />`) and import `ThreeGraph` at the top of the file. Even though `<ThreeGraph>` is never mounted, the import is evaluated and bundled.

**How to avoid:**
Use dynamic `React.lazy` + `Suspense` for the 3D component, scoped to the toggle branch only:

```tsx
const GraphCanvas3D = React.lazy(() => import('./GraphCanvas3D'));

// In render:
{mode === '3d' && (
  <Suspense fallback={<SkeletonGraph />}>
    <GraphCanvas3D data={data} />
  </Suspense>
)}
```

Verify with `npm run build` and check the generated chunk manifest — `three` should only appear in a lazy chunk (e.g. `GraphCanvas3D.[hash].js`), not in the main bundle. Add a bundle-size CI check (Vite's `build.reportCompressedSize` or a `size-limit` check) so this regression is caught automatically.

**Warning signs:**
- `vite build` output showing `three` in the main bundle
- Significant increase in main chunk size (>50 KB gzip) after adding 3D import
- 2D graph load time increasing measurably

**Phase to address:** Phase 90+ (3D Memory Galaxy) — enforce lazy-loading as the first architectural decision, before writing any R3F code.

---

### Pitfall 8: FPS Collapse at ~4,000 Nodes in 3D Force-Graph Mode

**What goes wrong:**
The live `graphSnapshots` table stores the production Ástríðr graph at ~4,038 nodes (confirmed in PROJECT.md). `react-force-graph-2d` handles this at acceptable FPS because the canvas renderer is optimized for 2D and can skip off-screen nodes. A naive `react-force-graph-3d` implementation rendering 4,038 instanced meshes + the force simulation in 3D will drop to single-digit FPS on most developer machines, and worse on production hardware. The 3D force simulation is also significantly more computationally expensive than 2D because the Barnes-Hut approximation must work in three dimensions.

**Why it happens:**
3D force simulations scale at roughly O(N log N) per tick and Three.js draw calls per visible object scale linearly. 4,000 individual mesh objects (even InstancedMesh) with a running force simulation will saturate the JS thread and GPU for most integrated graphics setups.

**How to avoid:**
- Use `THREE.InstancedMesh` for all node geometry — one draw call for all nodes of the same size/material rather than 4,000 separate `Mesh` objects.
- Gate the 3D toggle to warn users with estimated node counts above a threshold (e.g. >2,000 nodes) that performance may degrade.
- Use a simplified physics simulation (lower alpha decay, fewer iterations per tick, or freeze after initial layout) rather than continuous simulation.
- Consider reducing the graph in 3D mode: cluster by community first, show community centroids as large spheres with node count labels, only expand a community on click (the clustering data is already available from v8.0 Phase 86).
- Cap instanced mesh updates: only push position updates to `InstancedMesh.setMatrixAt` for nodes that moved more than 1px per frame.

**Warning signs:**
- `requestAnimationFrame` callbacks taking >16ms
- React DevTools Profiler showing the 3D component re-rendering on every frame
- Chrome DevTools GPU tab showing continuous GPU memory pressure

**Phase to address:** Phase 90+ (3D Memory Galaxy) — performance testing against the live ~4k-node production snapshot must be a blocking acceptance criterion before shipping 3D mode.

---

### Pitfall 9: WebGL Context Loss on 3D Mode Toggle (Remount Memory Leak)

**What goes wrong:**
When the user toggles between 2D and 3D modes, the 3D component unmounts and remounts. Each `@react-three/fiber` `<Canvas>` creates a new WebGL context. Browsers limit WebGL contexts per page (typically 8-16). If the toggle is rapid (user clicking back and forth) or if R3F does not properly call `renderer.dispose()` and `gl.getExtension('WEBGL_lose_context').loseContext()` on unmount, contexts accumulate and the browser starts issuing "Too many active WebGL contexts" warnings and eventually drops to a software renderer.

Additionally, Three.js geometries, materials, and textures are not garbage collected by JavaScript GC — they hold GPU memory until explicitly `.dispose()`d. A remount without disposal creates permanent GPU memory leaks.

**How to avoid:**
- R3F's `<Canvas>` handles `renderer.dispose()` on unmount correctly since v8 — verify the installed version is >=8.
- Add a `useEffect` cleanup in the 3D component that explicitly disposes all geometries and materials created by the component.
- Keep the 3D `<Canvas>` in the DOM but hidden (`display: none` / `visibility: hidden`) rather than unmounting when switching to 2D — this avoids context creation overhead and the memory spike. The R3F canvas's `frameloop="demand"` setting can pause rendering while hidden.

**Warning signs:**
- Browser console: "Too many active WebGL contexts. Oldest context will be lost."
- Chrome `chrome://gpu` showing "Context Lost" counts incrementing
- Tab memory usage growing monotonically with each 2D↔3D toggle

**Phase to address:** Phase 90+ (3D Memory Galaxy), plan covering the toggle/remount lifecycle. Test with 10 rapid 2D↔3D toggles and verify context count stays at 1.

---

### Pitfall 10: Convex Rollup Double-Counting Under Ingest + Archival + Backfill

**What goes wrong:**
The Phase 88 rollup approach (maintaining pre-aggregated rollup tables updated at ingest time) has three correctness risks:

1. **Ingest-time double-increment**: If an event is ingested, the rollup is incremented. If the Convex mutation fails mid-way (partial write) and the client retries, the event may be inserted twice — once from the original attempt and once from the retry — depending on whether the event insert is idempotent. If `ingest.ts` does not gate on an event ID uniqueness check before calling the rollup increment mutation, every retry double-counts.

2. **Archival gap**: The existing `dataRetention.ts` archives (soft-deletes) old events by setting `archived: true`. The current analytics queries filter `neq("archived", true)`. A rollup table that counts events at ingest time does not decrement when events are archived — the rollup stays inflated past the retention window, and the raw-event queries return a lower count. This creates inconsistency between "what the rollup says" and "what the raw events show."

3. **Historical backfill**: If a rollup table is added after millions of events already exist, the rollups start from zero and historical data is invisible until manually backfilled. The Phase 88 ROADMAP note says "Rollups stay correct under ingest, archival, and backfill" without detailing how backfill is implemented. A missing backfill migration means the Analytics page shows zeroes for all data predating the rollup table creation.

**Why it happens:**
Ingest-time rollups are a standard pattern but require carefully designed idempotency. Convex mutations are ACID within a single execution, but retries from network failures (or Ástríðr re-emitting events) are at-least-once, not exactly-once.

**How to avoid:**
- **Idempotency gate**: The existing `ingest.ts` should check for a unique event ID (or a composite `(sessionId, eventType, timestamp)` key) before inserting and before calling the rollup increment. If the event already exists, skip both. Model this after the `graphSnapshots` idempotent upsert (Phase 83) which checks `snapshotId` before inserting.
- **Archival-aware rollups**: Rollup tables should store counts per time bucket and be decremented (or left as-is with a separate "archived events" counter) when archival runs. Alternatively, store rollups based on data that is never archived (e.g. `llmMetrics` rows, which the quick-unblock comment says are "slim") rather than the fat `events` table.
- **Backfill mutation**: Include a backfill Convex action (callable via `npx convex run`) that scans existing events in batches and populates rollup rows. This must be idempotent (upsert, not insert) so it can be re-run safely. Write the backfill action before deploying the rollup table in production.

**Warning signs:**
- Analytics heatmap showing duplicate-weighted spikes after any Ástríðr restart that re-emits recent events
- Total event count in rollup diverging from total count in the raw `events` table
- Rollup table showing zeros for dates before the rollup feature was deployed

**Phase to address:** Phase 88 (Analytics Rollup Table) — idempotency gate and backfill action must be explicit acceptance criteria, not deferred to a follow-on phase.

---

### Pitfall 11: The `.take()` Quick-Unblock Masking the Real Fix

**What goes wrong:**
The current analytics queries have seven `.take()` caps (heatmap: 1000, sankey: 1000, errorRateTrend: 300×3, llmMetrics: 30000×2) that were deployed as a quick-unblock (`edb614c`). The ROADMAP acceptance criteria state that once rollups are authoritative, these caps should be removed. The risk is that Phase 88 ships rollup tables but leaves the `.take()` caps in place as a "safety net" — resulting in analytics that read from both the old capped path and the new rollup path simultaneously. The rollup path will then never be validated against the real data, and if rollups have bugs (double-counting, archival gaps), they will not be detected because the capped raw-event path is still providing numbers.

**How to avoid:**
Phase 88 must include an explicit plan step that removes the `.take()` caps from `analytics.ts` once rollups are live, and adds an integration test that verifies the analytics queries return the same bucket distributions as the rollup tables at a known test data volume. The test must run against the actual Convex dev backend (not mocked) to catch read-limit failures.

**Warning signs:**
- Phase 88 plan completing without a step that removes the `.take()` caps
- Analytics queries reading from both `events` (capped) and rollup tables simultaneously
- A `npx convex run` showing zero byte WARN absence even though `.take()` is still in place (the absence of the warning is not proof the rollup is working — it is proof the cap is still preventing the issue)

**Phase to address:** Phase 88, final plan step. Make removal of `.take()` caps a blocking acceptance criterion.

---

### Pitfall 12: Agent Room Scaffolding Built for a Different Ástríðr API

**What goes wrong:**
The existing War Room scaffolding (`WarRoom.tsx`, `warRoom.ts`, `warRoomIngest.ts`, `v6Mutations.ts`) was built for a `/war-room-ingest` HTTP endpoint and WebSocket events like `transcript.chunk` and `room.participant_speaking`. The CONTEXT.md notes the scope is "finalized after the research/audit pass" — meaning no one has confirmed whether Ástríðr's side of this contract (the endpoint that pushes these events, the room lifecycle API) is implemented in the `astridr-repo`. 

`WarRoomLaunchDialog.tsx` calls `createWarRoom()` from `src/lib/astridrApi.ts`. If that function calls an Ástríðr API endpoint that does not exist in the current `astridr-repo`, launching a room silently fails (or returns a 404 that the dialog does not surface). The Convex `warRooms` table may remain empty indefinitely, making the UI appear broken even when the CodePulse side is complete.

**Why it happens:**
The v6.0 War Room feature was shipped "light" (Phase 72 shipped) without completing the cross-repo Ástríðr counterpart. Unlike Phases 81/82 (Forge log streaming, which had explicit cross-repo handoff tasks), the War Room has no documented Ástríðr counterpart in ROADMAP.md.

**How to avoid:**
The Agent Room phase must begin with an audit that answers three questions before any coding:
1. Does `POST /api/war-room/create` (or equivalent) exist in `astridr-repo`? If not, the Agent Room cannot have live multi-agent conversation until it does — plan accordingly with a mock/stub path.
2. Does Ástríðr emit `transcript.chunk` events over the WebSocket? The existing `subscribeEvent("transcript.chunk", ...)` in `WarRoom.tsx` is a live subscription — if Ástríðr never emits this, the transcript panel stays empty.
3. What does "multi-persona group chat" mean in operational terms — is it Ástríðr agents talking to each other (requires Ástríðr multi-agent support), or the operator chatting with named agent personas backed by the existing LLM chat infrastructure?

Ship a degraded but useful mode that works without the Ástríðr counterpart (e.g. operator-only chat with AI persona selection, stored in Convex, no live multi-agent emissions). Gate the real multi-agent mode on the Ástríðr API existing.

**Warning signs:**
- `createWarRoom()` returning errors or the `warRooms` table remaining empty after launch
- `subscribeEvent("transcript.chunk", ...)` callback never firing
- Phase plan completing without a cross-repo dependency check

**Phase to address:** Phase 90+ (Agent Room) — audit task must be plan step 1, before writing any new code.

---

### Pitfall 13: Turn-Taking Race Conditions in Multi-Agent Group Chat

**What goes wrong:**
If the Agent Room is implemented as multiple concurrent Ástríðr agent instances sending `transcript.chunk` events, and CodePulse renders them in the order they arrive via `subscribeEvent`, the transcript will have out-of-order entries whenever two agents emit chunks simultaneously. The current `liveChunks` state in `WarRoom.tsx` uses `setLiveChunks((prev) => [...prev, newChunk])` with no ordering guarantee — chunks are appended in subscription callback order, which is network arrival order, not logical turn order.

**Why it happens:**
WebSocket events are delivered in arrival order per connection, but different agents may use different connections (or Ástríðr may batch and emit events out of logical sequence under load). Without a monotonic sequence number on each `transcript.chunk`, display order is undefined.

**How to avoid:**
Require `transcript.chunk` events to carry a `seq` field (the same pattern used for Forge log streaming in Phase 81, confirmed successful). Sort `liveChunks` by `seq` before rendering, not by arrival order. The Convex `warRoomEvents` table should also index on `seq` per room, not just timestamp.

**Warning signs:**
- Agent responses appearing out of order in the transcript panel during load testing
- A single agent's multi-chunk response being interleaved with another agent's response

**Phase to address:** Phase 90+ (Agent Room), plan 2 (transcript sequencing) — model after the Phase 81 Forge log streaming seq design.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping `.take()` caps after rollup ships | Zero risk of breaking change | Analytics fidelity stays capped; rollup correctness never validated | Never — blocking removal is a Phase 88 acceptance criterion |
| Token migration partial pass (CSS only, skip canvas) | Faster Phase 89 ship | Canvas-rendered graphs stay in wrong colors on non-default themes | Never for shipped themes; acceptable in an internal alpha |
| Hardcoding `class="dark"` permanently on `<html>` | Avoids managing two toggle axes | Cannot ship a genuinely light theme in the future; `dark:` Tailwind classes always active | Acceptable if all v9.0 themes are dark variants |
| Top-level import of `@react-three/fiber` instead of lazy | Simpler code | +600 KB in main bundle, slows 2D graph page for all users | Never |
| Skipping the backfill migration for rollup tables | Saves 1 plan step | Historical data invisible in analytics until manual fix | Never in production |
| Rendering 3D nodes as individual Mesh instead of InstancedMesh | Simpler initial implementation | 4k draw calls per frame → single-digit FPS | Acceptable at <200 nodes only |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tailwind 4 + CSS custom properties for themes | Defining `--token` in `@layer base` instead of directly on `:root` / `[data-theme]` | Define theme tokens directly on `:root` and `[data-theme="*"]` selectors outside any `@layer` — Tailwind 4's `@theme inline` block bridges them to utility classes |
| shadcn/ui Radix components + theme switching | Adding `data-theme` only to `<html>` but shadcn portals (`Dialog`, `Popover`, `Toast`) render inside `<body>` | Portals inherit CSS custom properties from `:root` or `html` correctly — no special handling needed as long as tokens are on `html` or `:root`, not on a mid-tree element |
| react-force-graph-2d canvas + theme tokens | Trying to use `var(--primary)` directly in canvas `fillStyle` | Read resolved CSS variable via `getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()` in a `useThemeColors()` hook; memoize with `useMemo` keyed on active theme |
| Convex rollup mutations + event retries | Calling rollup increment without checking event idempotency first | Check for event existence by unique key before insert; wrap the insert + rollup increment in a single Convex mutation for atomicity |
| @react-three/fiber `<Canvas>` unmount | Assuming R3F handles all GPU cleanup automatically | Explicitly dispose geometries/materials in `useEffect` cleanup; prefer hidden-not-unmounted for toggle to avoid repeated WebGL context creation |
| Ástríðr WebSocket events in Agent Room | Assuming `subscribeEvent` callbacks fire in logical sequence order | Always use a `seq` field and sort on display; do not rely on callback arrival order for multi-agent transcripts |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 4k nodes in `react-force-graph-3d` without InstancedMesh | <5 FPS on toggle to 3D, CPU pegged at 100% on JS thread | Use InstancedMesh, cluster-before-expand, limit force simulation iterations | Immediately at ~200+ individual Mesh objects |
| Reading rollup from `events` table with only the `.take()` cap removed | 16 MiB/exec hit returns on first production query | Replace with rollup table read before removing caps | Grows predictably with event volume; was hitting at ~1000 events × ~9 KB/event |
| `getComputedStyle` call on every render for canvas theme colors | Canvas re-paint on every React render cycle including unrelated state updates | Memoize `useThemeColors()` output; subscribe to `data-theme` attribute changes via MutationObserver instead of running `getComputedStyle` on every render | At render frequency >30fps (live graph pages) |
| `warRooms.collect()` (current `listRooms` query) without a limit | Full table scan as rooms accumulate over months | Add `.take(100)` or pagination; War Room is not currently bounded | Once rooms table exceeds ~500 rows |

---

## "Looks Done But Isn't" Checklist

- [ ] **Theme toggle:** Apply pre-paint blocking script in `index.html` — verify no FOUC on hard refresh with a non-default theme saved in localStorage
- [ ] **Token migration:** All 77 hardcoded hex hits in `src/` resolved — verify with `grep -r '#06b6d4\|#10b981' src/` returning zero results (canvas files get the `useThemeColors()` hook instead)
- [ ] **Midnight Aubergine:** Every `[data-theme]` block defines the full semantic token set (`--status-ok/error/warn/info`, `--metric-*`, `--speaking-ring`, `--glass-*`, `--glow-*`) — switching to aubergine with a status badge visible confirms the badge color changes
- [ ] **3D bundle:** `npm run build` output contains `three` only in a lazy chunk — `grep 'three' dist/assets/index-*.js` returns no matches
- [ ] **WebGL cleanup:** 10 rapid 2D↔3D toggles leave context count at 1 — verify via `chrome://gpu` "WebGL Context Lost" counter
- [ ] **Rollup idempotency:** Re-ingesting the same event twice produces no change in rollup counts — verify with a Convex integration test
- [ ] **Rollup backfill:** Historical analytics data (pre-rollup) is visible after running the backfill action — verify counts match raw event counts
- [ ] **Agent Room cross-repo audit:** `createWarRoom()` returns a 200 from Ástríðr before any UI work begins — or a stub mode is explicitly defined for when the endpoint is absent
- [ ] **Agent Room sequencing:** Out-of-order transcript chunks (simulated by sending seq=5 before seq=3) display in correct logical order
- [ ] **Reduced motion:** `prefers-reduced-motion: reduce` disables glow tokens and pseudo-element overlays — verify by emulating in Playwright with `page.emulateMedia({ reducedMotion: 'reduce' })`
- [ ] **WCAG AA:** All five high-traffic pages pass axe at AA level for all three shipped themes — CI E2E must include the axe step

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Theme flash on first paint (FOUC) | Phase 89, plan 1 | Playwright screenshot on hard refresh with saved non-default theme — no cyan frame visible |
| Incomplete token migration (77 hardcoded sites) | Phase 89, plan 1-2 | `grep '#06b6d4\|#10b981' src/` returns zero; canvas color test passes under theme switch |
| `prefers-reduced-motion` not disabling glows/overlays | Phase 89, plan 3 | Playwright `emulateMedia` test; glow token values read as `none` when motion reduced |
| Midnight Aubergine forking markup instead of tokens | Phase 89, during theme definition | Switch between all three themes — no layout shift, no residue, no z-index stack corruption |
| WCAG AA regression across themes | Phase 89, plan 3 | axe at AA level passes for all themes across 5 high-traffic pages in CI |
| Breaking dark/light toggle when adding skin toggle | Phase 89, plan 1 | `dark:` Tailwind utility audit; determine once whether `.dark` class stays permanent |
| 3D bundle regressing 2D default | Phase 90+, plan 1 | `vite build` chunk manifest; `three` appears only in lazy chunk |
| FPS collapse at ~4k nodes in 3D | Phase 90+, performance plan | Profiler run against live production graph snapshot at 4,038 nodes; FPS stays >=30 |
| WebGL context loss on 2D↔3D toggle | Phase 90+, lifecycle plan | 10 rapid toggles; `chrome://gpu` context loss count stays at 0 |
| Rollup double-counting on retry | Phase 88, plan 1 | Convex integration test: re-ingest same event payload twice; rollup counts unchanged |
| Archival gap in rollup accuracy | Phase 88, plan 2 | Archival sweep runs; rollup counts match filtered raw event counts |
| Missing historical backfill | Phase 88, plan 3 | `npx convex run analytics.backfillRollups` completes; Analytics shows pre-rollup data |
| `.take()` caps surviving rollup | Phase 88, plan final | `analytics.ts` contains no `.take()` calls after rollup is live |
| Agent Room built for non-existent Ástríðr API | Phase 90+ (Agent Room), audit task | Ástríðr counterpart confirmed present or stub mode documented before plan step 2 |
| Turn-taking race conditions in transcript | Phase 90+ (Agent Room), sequencing plan | Simulated out-of-order chunk test passes; transcript displays in seq order |

---

## Sources

- Live code inspection: `src/components/ThemeSwitcher.tsx`, `src/index.css` (lines 6, 128, 442, 344-360), `src/components/graph/ForceGraphCanvas.tsx`, `src/components/graph/CodeVaultGraph.tsx`, `convex/analytics.ts`, `convex/warRoom.ts`, `convex/warRoomIngest.ts`, `src/pages/WarRoom.tsx`
- Confirmed hardcoded hex sites: `grep` on `src/` for `#06b6d4|#10b981|rgba(6, 182, 212|rgba(16, 185, 129` → 77 matches across 24 files
- Confirmed token usage sites: `grep` on `src/` for `status-ok|status-error|status-warn|status-info|metric-ok|metric-warn|metric-error` → 52 files
- `package.json`: `react-force-graph-2d` at ^1.29.1 (no `react-force-graph-3d` present — must be added); `@react-three/fiber` not yet in dependencies (CLAUDE.md mentions it, `package.json` does not — must be added in Phase 90)
- PROJECT.md Key Decisions: "3D is opt-in only; 2D `ForceGraphCanvas` stays the default render path"
- ROADMAP.md Phase 88 acceptance: "Rollups stay correct under ingest, archival, and backfill"
- Phase 89 CONTEXT.md: TH-01 through TH-06 requirements, open questions, provenance note on `body::before`/`body::after`
- Phase 81 (Forge log streaming): established `seq` idempotency pattern used as model for Agent Room transcript sequencing
- Phase 83 (Graph snapshot receiver): established `snapshotId` idempotent upsert pattern used as model for rollup idempotency gate

---
*Pitfalls research for: CodePulse v9.0 Readability & Experience*
*Researched: 2026-06-23*
