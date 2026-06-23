# Project Research Summary

**Project:** CodePulse v9.0 Readability & Experience
**Domain:** Real-time AI-ops telemetry dashboard — milestone continuation
**Researched:** 2026-06-23
**Confidence:** HIGH (grounded entirely in direct live-code inspection)

## Executive Summary

v9.0 completes/deepens four feature areas against a live React 19 + Vite 7 + Convex SPA. Two areas (Analytics Rollup, Theming) have substantial shipped work and need completion/hardening, not fresh builds. Agent Room is **70-75% structurally complete** but hard-gated on a cross-repo unknown. 3D Memory Galaxy is the only net-new feature with new dependencies.

**Recommended build order: Analytics Rollup → Theming → 3D Memory Galaxy → Agent Room.** Dependency chain: the Phase 71 token cleanup (77 hardcoded hex sites across 24 files) must complete before theming is correct for any skin, and correct tokens are a prerequisite for theme-aware 3D node colors. Agent Room is ordered for the cross-repo audit gate — shipping it without confirming Ástríðr's `/api/war-room` endpoint produces UI that silently fails at room creation. (If the audit clears fast, Agent Room's wiring payoff can land before 3D.)

## Key Findings

### Recommended Stack
Existing stack unchanged. v9.0 adds exactly three packages:
- **`react-force-graph-3d` (^1.29.1)** + **`three` (^0.184.0)** — 3D Memory Galaxy. Chosen over raw R3F / `r3f-forcegraph`: it's the direct 3D sibling of the installed `react-force-graph-2d` (near-identical prop API), React peer dep `"*"` (no React 19 risk), manages its own `WebGLRenderer` internally.
- **`@axe-core/playwright`** (devDep) — WCAG AA contrast testing on existing Playwright.

**Do NOT add:** `@react-three/fiber`, `@react-three/drei` (~300 KB, no benefit for a render-mode toggle), `next-themes`, real-time presence libs, `@fontsource/bricolage-grotesque` (hold for product decision).

**Stale-doc correction:** CLAUDE.md lists `@react-three/fiber` as installed — `package.json` confirms it is NOT. `package.json` is authoritative.

### Expected Features (must-have)
- **Analytics Rollup (88):** ingest-time rollup mutations replacing `.take()` caps; idempotency gate; historical backfill action; explicit removal of all `.take()` caps once rollups authoritative.
- **Theming (89):** no-flash pre-paint blocking script in `index.html`; unified localStorage key (consolidate `theme` + `codepulse-theme`); full token migration (77 hex sites → `var(--token)`; canvas sites → `useThemeColors()` hook); complete semantic token set per `[data-theme]` block; Midnight Aubergine skin; WCAG AA via axe-core/playwright.
- **Agent Room (90):** participant names (not raw `participantId`), agent avatars + colors, per-agent transcript colors, explicit "Join" contract. All are wiring issues in `WarRoom.tsx` — `useRosterAgents` has the data, it just isn't imported.
- **3D Galaxy (91):** 2D default unchanged; `react-force-graph-3d` lazy-loaded via `React.lazy()`; same `ProjectGraphData` shape (no Convex change); render-mode toggle persisted to `idb-keyval`.

**Defer to v10+:** real WebRTC Join, moderator/turn-taking, bloom post-processing, per-agent cost breakdown.

### Architecture Approach
Surgical edits to ~6 existing modules + 2 net-new files (`ForceGraphCanvas3D.tsx`, `convex/analyticsRollup.ts`). No new routes/pages. Most cross-cutting change is the mechanical token cleanup (24 files).
1. `index.html` — blocking inline `<script>` (sets `data-theme` + `dark` before paint)
2. `src/index.css` — `[data-theme="aubergine"]` full token set; fix hardcoded cyan rgba; extend `prefers-reduced-motion` to glow tokens + pseudo-element overlays
3. `src/components/graph/ForceGraphCanvas3D.tsx` (NEW) — wraps `react-force-graph-3d`, same prop surface, lazy-imported
4. `src/components/graph/CodeVaultGraph.tsx` — `renderMode` state + toggle + `React.lazy()`/`<Suspense>`
5. `src/pages/WarRoom.tsx` — import `useRosterAgents()`; resolve `pid` → `{name, avatar, tier}`; populate `agentColor`
6. `convex/analyticsRollup.ts` (NEW) — idempotency-gated increment mutations
7. `convex/analytics.ts` — replace `.take()`-capped reads with rollup queries
8. `convex/ingest.ts` + `convex/runtimeIngest.ts` — wire rollup calls after raw writes

### Critical Pitfalls (top 7)
1. **Cross-repo Agent Room gate** — `createWarRoom()` calls Ástríðr `POST /api/war-room`. If absent in `astridr-repo`, launch silently fails and `warRooms` stays empty. Confirm before any Agent Room code.
2. **FOUC + dual-key persistence** — `data-theme` set in `useEffect` (post-paint cyan flash); two localStorage keys. Fix no-flash script first; consolidate keys before new skins.
3. **77 hardcoded hex sites** — `#06b6d4`/`#10b981` in JSX, canvas paint, CSS across 24 files. CSS → `var(--token)`; canvas → `useThemeColors()` reading `getComputedStyle(...).getPropertyValue('--primary')`. Without this, Aubergine leaves graphs cyan.
4. **3D bundle regression** — `react-force-graph-3d` + `three` ≈ 600-800 KB. Any top-level import in the 2D path ships three.js to all users. Enforce `React.lazy()` + verify with `vite build` chunk manifest.
5. **FPS collapse at 4,038 nodes** — production graph size confirmed; naive 3D hits single-digit FPS. InstancedMesh / simplified physics / cluster-before-expand (v8.0 community data available). FPS ≥30 is a blocking acceptance criterion.
6. **Rollup double-count + archival gap** — at-least-once ingest retries double-count without an idempotency gate; `dataRetention.ts` archives events without decrementing rollups. Model after Phase 83 idempotent upsert.
7. **`.dark` class + `data-theme` coupling** — combined `.dark, [data-theme="cyan"]` selector ties all `dark:` utilities to `class="dark"`. Decide before writing token blocks: keep `class="dark"` permanent (recommended — all v9.0 themes are dark variants) vs make it part of the toggle. Affects 110+ components.

## Implications for Roadmap

| Phase | Area | Verdict | Research flag |
|-------|------|---------|---------------|
| 88 | Analytics Rollup | Verification + hardening (Convex-only, zero UI risk) — first | Standard; no research |
| 89 | Theming | Completion — token cleanup gates all downstream color correctness | Standard; no research |
| 90 | Agent Room | Finish existing (~70-75% done) — cross-repo gated | **Targeted cross-repo audit before plan** |
| 91 | 3D Galaxy | Net-new dep, highest perf risk — last; benefits from stable tokens | Standard; no research |

**Phase 89 strict sub-sequence:** (1) decide `.dark` permanence → (2) token cleanup (77 sites + `useThemeColors()`) → (3) no-flash script + key consolidation → (4) Aubergine token block → (5) WCAG AA axe audit.

**Phase 90 strict sub-sequence:** (1) cross-repo audit (confirm `POST /api/war-room` + `transcript.chunk` WS events) → (2) wire `useRosterAgents()` → (3) fix `listRooms` `.collect()` → (4) decide + implement Join contract → (5) per-room URL (optional).

**Phase 91 strict sub-sequence:** (1) install + mock → (2) `ForceGraphCanvas3D.tsx` → (3) toggle in `CodeVaultGraph` → (4) FPS validation at 4,038 nodes (blocking) → (5) WebGL leak test → (6) bundle chunk verification.

## Open Product Decisions (gate planning)
- **Default theme post-ship:** Electric Cyan (current) vs the new readable theme. (Lean: readable default.)
- **Midnight Aubergine typography:** Bricolage Grotesque vs Geist. (Lean: Geist unless UI-SPEC requires Bricolage; hold the font install.)
- **"Join" button semantics:** observer mode (rename to "Watch") vs real Ástríðr signal. (Safe default: observer mode.)
- **Multi-persona scope:** agents talking to each other vs operator chatting with named personas.

## Gaps to Address
- **Ástríðr `/api/war-room` endpoint** (CRITICAL, not resolvable CodePulse-side): read `astridr-repo` before Phase 90 planning. If absent → define observer mode; real rooms need a future astridr-repo phase.
- **`runtimeIngest.ts` war-room ingest path** (past line 100): confirm how `warRooms` docs are created from Ástríðr events — Phase 90 plan step 1.
- **3D FPS at exactly 4,038 nodes:** no controlled benchmark; validate against the live snapshot before shipping.

## Confidence Assessment
| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Library source, Context7, npm; React peer dep `"*"` confirmed |
| Features | HIGH | Direct live-code inspection, file:line attribution |
| Architecture | HIGH | Full component-tree reads; narrow, bounded change surface |
| Pitfalls | HIGH | Grep results + confirmed `.take()` caps + combined selector + missing inline script; no speculation |

**Overall: HIGH.** Source files: `WarRoom.tsx`, `ThemeSwitcher.tsx`, `index.css`, `DashboardLayout.tsx`, `CodeVaultGraph.tsx`, `ForceGraphCanvas.tsx`, `convex/analytics.ts`, `warRoom.ts`, `warRoomIngest.ts`, `schema.ts`, `aggregates.ts`, `astridrApi.ts`, `index.html`, `package.json`; Context7 `/vasturiano/react-force-graph`; `playwright.dev/docs/accessibility-testing`; `tailwindcss.com/docs/dark-mode`.
