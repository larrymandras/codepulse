# Phase 91: 3D Memory Galaxy - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an **opt-in 3D render mode** to the existing `CodeVaultGraph` surface (the `/graphs` hub hero). A header toggle switches the render surface between the current 2D `ForceGraphCanvas` and a new `react-force-graph-3d` view that renders the full ~4,038-node production graph at ≥30 FPS. `three.js` is **lazy-loaded** so users who stay in 2D never download it. The toggle state persists across reloads via `idb-keyval`. 3D node colors are theme-aware via the Phase 89 `useThemeColors()` resolver.

**This phase is NOT:** a new page/route, an R3F (`@react-three/fiber`) rewrite, post-processing/bloom, community-cluster bubbles, or node-size-by-degree encoding. The 2D render path stays the default and must be unchanged (no regression).

</domain>

<decisions>
## Implementation Decisions

### 3D ↔ 2D parity (how much of the 2D surface carries into 3D)
- **D-01:** **Full parity.** 3D mode swaps **only the render surface** inside the existing `GraphContent` shell. All surrounding chrome and interaction stays mounted and functional in both modes: the node-click **detail panel**, the **Code / Vault / Both source filter**, the **fullscreen** toggle, **`?focus=` deep-link** centering, **KG cross-graph links**, and **neighbor navigation**. Switching modes does not unmount or reset the detail panel / filter / fullscreen state.
- **D-01a (implication, for researcher/planner — not a user choice):** "Full parity" applies to the *interaction shell*, not the *paint primitives*. The 2D `paintNode` (custom canvas selection ring + community halo via `communityColorFn`) is canvas-2D-only and does **not** translate to `react-force-graph-3d`. In 3D the equivalent encoding is library-native: `nodeColor` (theme color), `nodeVal`/`nodeRelSize` (size), and selection emphasis via color/size — not a canvas ring. Research must map each 2D affordance to its 3D-native equivalent.
- **D-01b (implication):** Centering/zoom helpers differ. `fgRef.zoomToFit()` / `centerNodeWhenReady()` are 2D-handle methods; `react-force-graph-3d` exposes `cameraPosition()` / `zoomToFit()` with a different signature. The focus-param centering path needs a 3D branch. The shared ref/handle abstraction (or a mode-conditional ref) is a planning concern.

### 3D visual treatment (primary FPS lever at ~4,038 nodes)
- **D-02:** **Spheres + hover-only labels.** Nodes render as default 3D spheres colored by the active theme (code = `--primary`, vault = `--vault-node-color`, via `useThemeColors()`). Labels appear **on hover only** (`nodeLabel` tooltip) — NO always-on text sprites (always-on sprites for 4k nodes are the documented #1 FPS killer and would jeopardize the ≥30 FPS gate). Links drawn thin/subtle, theme-colored consistently with the 2D `linkColorFn` intent.
- **D-02a:** Keep the dark-space backdrop consistent with the 2D surface (`#09090b` / current backdrop) so the two modes feel like one surface.

### Performance posture
- **D-03:** **Ship opt-in, no runtime fallback.** Because 3D is opt-in, weaker GPUs are allowed to run slower. Build **no** runtime degradation path (no auto-hide-links, no FPS-triggered downgrade, no "this device may struggle" warning). Instead, the ≥30 FPS target (SC#3) is verified **once, manually, against the live ~4,038-node snapshot** from the Convex `graphSnapshots` table on the operator's machine before shipping. The benchmark is a **gate/checkpoint in the plan**, not shipped UI.
- **D-03a:** WebGL context disposal on every 2D↔3D toggle is still **mandatory** (SC#4 — no memory leak on repeated toggle), independent of the "no fallback" decision. This is correctness, not perf-degradation.

### Toggle UI
- **D-04:** **Segmented `2D | 3D` control** in the header's right cluster, adjacent to the fullscreen button, styled to match the existing **Code / Vault / Both** source-filter chips (`chipClass` pattern, `aria-pressed`, `role="group"`). Explicit current-mode state; discoverable; reuses an established pattern rather than a new affordance.

### Claude's Discretion
- Exact `react-force-graph-3d` prop tuning (`cooldownTicks`, `warmupTicks`, `nodeResolution`, `linkOpacity`, sphere radius) to hit ≥30 FPS — researcher/planner to determine empirically against the live snapshot.
- How the render-surface swap is structured internally (e.g. lift a `renderMode` state into `GraphContent` and render either `<ForceGraphCanvas>` or `<lazy Forge3DGraph>` in the same slot) — planner's call, constrained by D-01/D-01a/D-01b.
- Where exactly the `idb-keyval` read/write of toggle state is wired (hook vs inline effect).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & success criteria
- `.planning/REQUIREMENTS.md` §"3D Memory Galaxy (G3D)" — **G3D-01** (opt-in lazy-loaded 3D toggle on `CodeVaultGraph`, reuses `ProjectGraphData`/`useProjectGraph`, persists to `idb-keyval`) and **G3D-02** (~4,038-node ≥30 FPS, clean WebGL disposal, theme-aware via `useThemeColors()`, 2D unchanged). Also the "Deferred / out of scope" bullets (R3F, bloom, cluster bubbles, node-size-by-degree, new route).
- `.planning/ROADMAP.md` §"Phase 91: 3D Memory Galaxy" — the 5 explicit Success Criteria (toggle visibility + 2D restore; three.js isolated to its own lazy chunk per `vite build` manifest; ≥30 FPS at live snapshot; clean WebGL disposal + idb persistence; theme-aware node colors).

### Surface being extended (the code this phase touches)
- `src/components/graph/CodeVaultGraph.tsx` — the host surface. `GraphContent` owns all the interaction chrome that "full parity" (D-01) must preserve: source filter, detail panel, fullscreen, `useFocusParam`, KG cross-links, neighbor nav, `paintNode`, `colorFn`/`linkColorFn`.
- `src/components/graph/ForceGraphCanvas.tsx` — the 2D render path that must stay **unchanged** (SC#1). Its `ForceGraphHandle` interface (`centerAt`/`zoom`/`zoomToFit`/`d3Force`) is the contract the 3D path's focus-centering must mirror (D-01b).

### Hard dependency (Phase 89)
- `src/hooks/useThemeColors.ts` — the TH-01 resolver. Returns `{ primary, primaryAlpha18, primaryAlpha55, vaultNode, vaultNodeAlpha18, ... }` resolved from CSS custom props and re-resolved on `data-theme` switch. 3D node/link colors (D-02) MUST read from this, not hardcoded hex (SC#5).

### Reused data (no Convex change this phase)
- `src/hooks/useProjectGraph.ts` — `useProjectGraph()` / `ProjectGraphData`. The 3D mode consumes the **same** snapshot data the 2D mode already renders (G3D-01: "no Convex change"). Snapshot originates from the `graphSnapshots` Convex table (the ≥30 FPS benchmark uses the live snapshot from here).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`GraphContent` (CodeVaultGraph.tsx)**: the entire interaction shell is reusable — under "full parity" the 3D view drops into the same component, reusing `sourceFilter`, `selectedNodeId`, `fullscreen`, `useFocusParam`, KG hooks, and the detail panel JSX verbatim. Only the central `<ForceGraphCanvas>` element is conditionally swapped.
- **`useThemeColors()`**: already wired into `GraphContent` (`colors.primary`, `colors.vaultNode`, alpha variants) and re-resolves on theme switch — directly reusable for 3D `nodeColor`/`linkColor`.
- **`useProjectGraph()` + `filteredData` memo**: the source-filtered `{nodes, links}` already computed for 2D feeds 3D unchanged.
- **`chipClass` + source-filter chip group**: the exact pattern to clone for the segmented `2D|3D` toggle (D-04).
- **`idb-keyval` (`^6.2.4`) and `react-force-graph-2d` (`^1.29.1`)** are already in `package.json`. `react-force-graph-3d` + `three` are **NOT yet installed** — adding them is a plan task; they must land behind `React.lazy` so they're isolated to their own chunk (SC#2).

### Established Patterns
- **Lazy-loading**: App.tsx already lazy-loads heavy pages (Agents, Analytics) — same `React.lazy`/`Suspense` pattern applies to the 3D component so `three` stays out of the 2D/default chunk (SC#2).
- **Theme-aware canvas color**: the `useCallback([colors])` re-creation pattern (colorFn/linkColorFn) is how color must re-resolve on theme switch — mirror it for 3D.
- **Test setup** (`src/test/setup.ts`) already mocks Three.js / React Flow / heavy externals — the 3D component's unit test can lean on existing mocks.

### Integration Points
- Render-surface swap lives inside `GraphContent`'s graph region (`CodeVaultGraph.tsx` ~L454-494), where `<ForceGraphCanvas>` currently mounts.
- Toggle control mounts in the header's right cluster (~L380-430), beside the fullscreen `Button`.
- 3D node click must call the same `setSelectedNodeId(node.id)` so the shared detail panel updates (parity).

</code_context>

<specifics>
## Specific Ideas

- Treat 2D and 3D as **one surface, two render modes** — not two views. The header chrome, detail panel, and filters should visually persist across the toggle so it reads as flipping a render switch, not navigating away.
- The ≥30 FPS validation is explicitly **against the live ~4,038-node snapshot**, not a synthetic graph — the plan must include pulling/using the real `graphSnapshots` payload for the benchmark checkpoint.

</specifics>

<deferred>
## Deferred Ideas

- **R3F (`@react-three/fiber` + `@react-three/drei`) render path** — out of scope for v9.0 (REQUIREMENTS deferred list). `react-force-graph-3d` covers opt-in 3D without the ~300 KB and a `<Canvas>`/`useFrame` rewrite.
- **3D post-processing (bloom/glow)** — needs R3F; deferred with the above.
- **3D community-cluster bubbles + node-size-by-degree** — deferred (would reuse v8.0 community data); not in this phase.
- **A dedicated immersive 3D page/route** — explicitly rejected; 3D is an opt-in *mode* on `CodeVaultGraph`, not a new surface.
- **Runtime performance auto-degradation / low-FPS warning** — considered and declined (D-03); revisit only if real-world device complaints surface.

None of these block Phase 91.

</deferred>

---

*Phase: 91-3d-memory-galaxy*
*Context gathered: 2026-06-29*
