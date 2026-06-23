# Technology Stack — CodePulse v9.0 Additions

**Project:** CodePulse v9.0 Readability & Experience
**Researched:** 2026-06-23
**Scope:** NEW additions only. The existing stack (React 19, Vite 7, TypeScript 5.9, Tailwind 4, Convex, shadcn/ui New York, Lucide, React Flow/xyflow, D3.js/d3-force-3d, dagre, react-force-graph-2d, Recharts, Resend, React Email, Tone.js, motion, dnd-kit, Sonner, idb-keyval, Clerk) is validated and unchanged. Do not re-research these.

---

## Summary: What to Install

| Package | Version | Feature area | Install as |
|---------|---------|-------------|------------|
| `react-force-graph-3d` | ^1.29.1 | 3D Memory Galaxy | `dependency` |
| `three` | ^0.184.0 | 3D Memory Galaxy (R3F peer + transitive) | `dependency` |
| `@react-three/fiber` | ^9.6.1 | 3D Memory Galaxy (R3F renderer, React 19) | `dependency` |
| `@react-three/drei` | ^10.7.7 | 3D Memory Galaxy (OrbitControls, camera helpers) | `dependency` |
| `@axe-core/playwright` | latest | TH-06 a11y contrast audit in Playwright | `devDependency` |

**Three packages for 3D, one devDep for a11y. Everything else (theming, Agent Room, Analytics Rollup) needs zero new deps.**

---

## Feature Area 1: 3D Memory Galaxy

### The Decision: `react-force-graph-3d` over `r3f-forcegraph`

Two paths exist from vasturiano's ecosystem:

**Option A — `react-force-graph-3d` (standalone, self-contained WebGL):**
The direct 3D sibling of the already-installed `react-force-graph-2d`. Ships its own Three.js scene internally. Install `three` + `react-force-graph-3d`; done.

**Option B — `r3f-forcegraph` (R3F-native scene object):**
Vasturiano's own R3F binding for `three-forcegraph`. Renders as a scene object inside a `<Canvas>`. Requires `@react-three/fiber` + `@react-three/drei` + `three`. Requires the consumer to drive the simulation clock via `useFrame(() => ref.current.tickFrame())`.

**Recommendation: Option A** (`react-force-graph-3d`), for these reasons:

1. **Props are nearly identical to react-force-graph-2d.** `graphData`, `nodeId`, `nodeLabel`, `nodeColor`, `nodeVal`, `linkColor`, `linkWidth`, `onNodeClick`, `onNodeHover`, `onBackgroundClick`, `cooldownTicks`, `d3VelocityDecay`, `nodeRelSize` — all present in both 2D and 3D. The existing `ForceGraphCanvas` wrapper can be extended for 3D with a render-mode prop without rewriting its interface.
2. **React peer dependency is `"*"` (any version)** — confirmed from vasturiano/react-force-graph package.json. No React 19 compat risk.
3. **No new scene-management surface area.** `react-force-graph-3d` owns its own Three.js `WebGLRenderer`, camera, and scene. No `<Canvas>` wrapper, no `useFrame` clock, no OrbitControls wiring required in consuming code.
4. **~4,000 nodes is within operating range.** The library's demo suite includes a large-graph example; community reports show degradation appearing at 10,000+ nodes, not at 4,000. The existing 2D path already runs ~4,038 nodes. The 3D path will be opt-in with a toggle — not the default — so performance concerns are gated behind user intent.

**When Option B (`r3f-forcegraph`) would be better:** If v9.0 needed a fully immersive 3D scene with bloom/post-processing, custom shaders, or mixed 3D UI — but the scope is an opt-in render-mode toggle on one existing graph, not a new 3D environment.

**Confidence: HIGH** — verified from library source, Context7, and npm.

### Required Packages

**`react-force-graph-3d` ^1.29.1**
- Confirmed latest (npm, published ~Feb 2026). Same mono-repo as installed `react-force-graph-2d@^1.29.1` — versions are in sync.
- Install: `npm install react-force-graph-3d`
- Three.js is a transitive peer (`three` is a dep of `3d-force-graph` which is a dep of `react-force-graph-3d`). It must also be explicitly installed to avoid resolution drift.

**`three` ^0.184.0**
- Latest confirmed: 0.184.0 (published ~Apr 2026).
- Required explicitly even though it's a transitive dep — React Three Fiber (if also added) specifies `three >=0.156` as a peer dep, and react-force-graph-3d's underlying `3d-force-graph` pulls it in. Pinning explicitly prevents two copies in the bundle.
- Install: `npm install three`

**`@react-three/fiber` ^9.6.1 and `@react-three/drei` ^10.7.7**
- These are NOT required for `react-force-graph-3d` (Option A). They ARE required if the team later chooses Option B or wants to add custom post-processing (bloom, glow layers) over the 3D graph. Add them only if that is explicitly scoped.
- If added: R3F v9 pairs with React 19 (confirmed from official R3F docs and v9 migration guide). `@react-three/drei@10` added React 19 support (peer dep issue #2260 closed). Install: `npm install @react-three/fiber @react-three/drei`
- For v9.0 3D Memory Galaxy as specced (opt-in render-mode toggle, same data), **do not add R3F unless custom post-processing is explicitly added to scope.** Adding R3F + drei brings ~300KB (gzipped) of three.js renderer boilerplate for no benefit when react-force-graph-3d already manages its own Three.js scene.

### Integration with Existing 2D Path

The existing `ForceGraphCanvas` (at `src/components/graph/ForceGraphCanvas.tsx`) wraps `react-force-graph-2d` with a thin callback interface. The 3D mode should NOT replace or modify this component — instead, add a `ForceGraph3DCanvas` sibling that mirrors the same prop interface:

- Accept same `data`, `colorFn`, `labelFn`, `onNodeClick`, `onBackgroundClick`, `onEngineStop` props
- Map `colorFn` to `nodeColor`, `labelFn` to `nodeLabel`
- Replace canvas `paintNode` (2D Canvas API) with `nodeThreeObject` (Three.js mesh) for custom node rendering if needed; fall back to `nodeAutoColorBy` for simple color encoding
- The existing `useProjectGraph()` hook and snapshot data shape are identical for both modes — no Convex schema changes required
- Render-mode toggle state: add `renderMode: '2d' | '3d'` to `CodeVaultGraph` state, persisted to `idb-keyval` (already installed)

**3D-specific props to expose from ForceGraph3D:**
- `enableNodeDrag` — allow orbit + drag (set false initially for stability)
- `nodeThreeObject` — optional custom mesh (for community-color halos, use `nodeColor` first, upgrade later)
- `cooldownTicks`, `d3VelocityDecay` — same physics tuning as 2D

**Performance guardrail:** Disable `linkDirectionalParticles` and particle effects in 3D at 4k nodes — they multiply GPU draw calls. Default to `linkWidth=0.3` (thinner than 2D's 0.6) for readability in 3D space.

### Install Command

```bash
npm install react-force-graph-3d three
```

---

## Feature Area 2: Readable Theme System + Editorial Skin Toggle (TH-01..06)

**Zero new dependencies.** All six TH requirements are achievable with the existing stack:

| Requirement | Existing tool |
|-------------|---------------|
| TH-01 Token-driven theming (CSS custom properties) | Already used in `src/index.css`; Tailwind 4 is CSS-first with `@custom-variant` |
| TH-02 WCAG-AA readable theme | Pure CSS token set; no library needed |
| TH-03 Midnight Aubergine editorial theme | Pure CSS token set + `body::before`/`body::after` (paper-grain, ambient gradients) |
| TH-04 Keep Matrix-Emerald | Already the current theme; no change |
| TH-05 Theme switcher + no-flash persistence | `idb-keyval` already installed for graph state; for no-flash, an inline `<script>` in `index.html` reading `localStorage` before React hydrates is the standard pattern — no external lib |
| TH-06 A11y pass | `@axe-core/playwright` as devDependency (see below) |

**Tailwind 4 multi-theme pattern:** Use `data-theme` attribute on `<html>` instead of class toggling. Define token sets as:
```css
:root { /* default / readable theme */ }
[data-theme="matrix-emerald"] { /* cyberpunk */ }
[data-theme="midnight-aubergine"] { /* editorial */ }
```
Tailwind 4's `@custom-variant` handles dark-mode variants scoped per theme without any new library.

**No-flash pattern:** A 5-line inline `<script>` in `public/index.html` (before the React bundle loads) reads `localStorage.getItem('codepulse-theme')` and sets `document.documentElement.dataset.theme`. This is the same pattern every production theme implementation uses (Next.js `next-themes`, etc.) and requires no package.

**prefers-reduced-motion:** Existing Tailwind `motion-reduce:` variant and the `reducedMotion` check already in `ForceGraphCanvas.tsx` (line 151) cover animation suppression. Extend this pattern to CSS `@media (prefers-reduced-motion: reduce)` blocks for scanline/tick animations in the theme token CSS.

### A11y Tooling: `@axe-core/playwright`

**Add as devDependency.** The project already has Playwright installed (`@playwright/test@^1.58.2`). Axe-core's Playwright adapter is the canonical integration point:

```ts
// in e2e tests
import { checkA11y } from '@axe-core/playwright';
await checkA11y(page, undefined, { runOnly: { type: 'tag', values: ['wcag2aa'] } });
```

This directly satisfies TH-06 — automated WCAG AA contrast verification across high-traffic pages without a separate CI tool.

**Version:** Follow axe-core's versioning scheme (major.minor mirrors axe-core version, e.g., 4.10.x). Use `latest` on install; it will resolve to 4.10.x or higher.

```bash
npm install -D @axe-core/playwright
```

**Confidence: HIGH** — Official Playwright accessibility testing docs recommend this exact package. The Playwright + axe-core integration is well-documented and the pattern is standard in 2025/2026 projects.

**What NOT to add:**
- `next-themes`: Next.js specific, does not apply to a Vite SPA
- `color2k` / `chroma-js`: No programmatic color manipulation needed — theme tokens are static CSS
- `@radix-ui/react-themes`: Radix's theme system conflicts with Tailwind 4's own token approach; the project already uses shadcn/ui which layers on top of CSS variables directly

---

## Feature Area 3: Agent Room

**Zero new dependencies.** Audit the existing `hr/` scaffolding (voice/room/war-room components) first; the surface area is Convex realtime + existing UI primitives.

Convex's built-in reactivity (`useQuery`, mutations) already handles multi-user state. WebSocket telemetry already flows. Room/multi-persona state = Convex tables + subscriptions. No new real-time layer needed.

If the Agent Room requires markdown rendering with streaming tokens, `react-markdown` is already installed at `^10.1.0`. If it requires rich text input, `@uiw/react-codemirror` is already installed. If it needs message timestamp formatting, `date-fns` is already installed.

The only dependency that might emerge here is a **lightweight audio notification** for new messages — `tone` is already installed for the ambient audio engine (`^15.1.22`). A simple note trigger from the existing `audioEngine.ts` pattern covers it.

Flag: if Agent Room adds a "typing indicator" or presence system, Convex's `useQuery` on a `presenceState` table handles it natively. No third-party presence lib (e.g., `@liveblocks/*`, Pusher) is needed given Convex is the backend.

---

## Feature Area 4: Analytics Rollup

**Zero new dependencies.** This is a pure Convex backend refactor — ingest-time rollup tables replacing `.take()` count caps to stay under the 16 MiB/exec read limit.

Pattern: Convex mutations writing to `analyticsRollup_{hour,day}` tables at event-ingest time, with cron-based backfill for any gaps. All within Convex's scheduler (`convex/crons.ts`) and mutation patterns already in the project.

No new npm packages. No external rollup pipeline. No third-party analytics SDK.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| 3D graph | `react-force-graph-3d` | `r3f-forcegraph` | r3f-forcegraph requires full R3F scene setup + useFrame clock; react-force-graph-3d is a drop-in with nearly identical props to the already-installed 2D version |
| 3D graph | `react-force-graph-3d` | `@react-three/fiber` + custom nodes | R3F alone provides no force layout; would require reimplementing d3-force-3d physics from scratch |
| 3D graph | `react-force-graph-3d` | `reagraph` | reagraph is WebGL + React but uses its own layout engine (not d3-force); incompatible data shape; harder to share data with the 2D path |
| A11y | `@axe-core/playwright` | `@axe-core/react` (React component) | Runtime component injection is noisier and less CI-friendly; Playwright integration runs post-render across real pages, which is what TH-06 needs |
| Theme no-flash | Inline `<script>` in index.html | `next-themes` | next-themes is Next.js specific. The inline script pattern is framework-agnostic and has zero bundle cost |
| Convex rollup | Native Convex mutations | Kafka / event stream | Massively over-engineered for a single-operator dashboard; Convex's scheduler covers the pattern |

---

## Explicit Do-Not-Add List

| Library | Why |
|---------|-----|
| `@react-three/fiber` | Not needed for react-force-graph-3d Option A. Add only if post-processing (bloom) is scoped — it is not in v9.0. |
| `@react-three/drei` | Same as above — no scene management needed. |
| `three-spritetext` | Optional text-as-sprite for 3D labels. Skip for v9.0; the 3D graph's built-in `nodeLabel` tooltip (HTML overlay) is sufficient. |
| `reagraph` | Different layout engine, different data shape, incompatible with the 2D path's `{ nodes, links }` schema. |
| `next-themes` | Next.js only. |
| `color2k` / `chroma-js` | No runtime color math needed; themes are static CSS token sets. |
| `@liveblocks/*` / Pusher | Agent Room's presence/realtime is Convex-native. |
| `@radix-ui/react-themes` | Conflicts with shadcn/ui + Tailwind 4 CSS variable approach. |
| `visx` / `nivo` | No new chart types in v9.0; existing Recharts + D3 cover analytics. |
| `react-spring` | `motion` (Framer Motion) already installed for animation. |
| `@fontsource/bricolage-grotesque` | Midnight Aubergine editorial font from the pack. Only add if the UI-SPEC explicitly requires it post-discussion; Geist approximates the editorial feel at zero font-loading cost. Decide in discuss-phase. |

---

## Installation

```bash
# Required for 3D Memory Galaxy
npm install react-force-graph-3d three

# Required for TH-06 a11y pass (devDependency)
npm install -D @axe-core/playwright
```

Total: 2 new production deps, 1 new devDep. Everything else is existing stack.

---

## Sources

- react-force-graph-3d props API: Context7 `/vasturiano/react-force-graph` (HIGH confidence)
- react-force-graph package.json peer deps (`"react": "*"`): https://github.com/vasturiano/react-force-graph/blob/master/package.json (HIGH confidence)
- r3f-forcegraph integration pattern: Context7 `/vasturiano/r3f-forcegraph`, package.json (`three >=0.154`): https://github.com/vasturiano/r3f-forcegraph/blob/master/package.json (HIGH confidence)
- R3F v9 pairs with React 19: Context7 `/pmndrs/react-three-fiber`, official docs https://r3f.docs.pmnd.rs/getting-started/installation (HIGH confidence)
- @react-three/drei React 19 support resolved: https://github.com/pmndrs/drei/issues/2260 (MEDIUM confidence — issue closed, exact version not pinned)
- @react-three/fiber latest (9.6.1): https://app.unpkg.com/@react-three/fiber@9.0.1 (MEDIUM confidence)
- @react-three/drei latest (10.7.7): npm search results (MEDIUM confidence)
- three.js latest (0.184.0): npm search results June 2026 (MEDIUM confidence)
- react-force-graph-3d latest (1.29.1): npm search results, same as react-force-graph-2d already installed (HIGH confidence)
- @axe-core/playwright: https://playwright.dev/docs/accessibility-testing (HIGH confidence)
- Tailwind 4 multi-theme with data-theme attribute: https://tailwindcss.com/docs/dark-mode (HIGH confidence — CSS-first config, @custom-variant)
- react-force-graph-3d performance at large node counts: https://github.com/vasturiano/react-force-graph/issues/202, https://github.com/vasturiano/react-force-graph/issues/223 — degradation reported at 10k+, not 4k (MEDIUM confidence — no controlled benchmark for exactly 4,038 nodes)
