# CodePulse — Requirements

**Active milestone:** **v9.0 Readability & Experience** (started 2026-06-23) — TH / AR / ROOM / G3D below.
**Prior milestones (archived):** v4.0 (`milestones/v4.0-REQUIREMENTS.md`), v5.0 (`milestones/v5.0-REQUIREMENTS.md`), v6.0 (retained in `milestones/v8.0-REQUIREMENTS.md`), v7.0 (`milestones/v7.0-REQUIREMENTS.md`), v8.0 (`milestones/v8.0-REQUIREMENTS.md`).
**Research:** `.planning/research/SUMMARY.md` (+ STACK / FEATURES / ARCHITECTURE / PITFALLS) — HIGH confidence, grounded in live-code audit.

> ✅ **Archive-name collision — RESOLVED/MOOT (verified 2026-06-29):** The feared stale `milestones/v9.0-*.md`/`v10.0-*.md`/`v11.0-*.md` adversarial-track archives are **not present in this repo** — `milestones/` holds only v4.0/v5.0/v7.0/v8.0, and git history shows `milestones/v9.0-*` was never tracked here (those Astridhr "Adversarial-Review" archives live elsewhere, e.g. `astridr-repo`, which CodePulse's `/gsd-complete-milestone` does not touch). The only v9.0 file is `.planning/v9.0-MILESTONE-AUDIT.md`, which is CodePulse's own (stale) audit. No rename needed; `/gsd-complete-milestone` v9.0 is safe to run with no clobber risk.

---

## v9.0 Readability & Experience Requirements — 🟦 ACTIVE (started 2026-06-23)

> Make CodePulse readable and richer to operate: a readability-first, fully token-driven theme system + editorial skin (Phase 89), a durable Convex analytics rollup (Phase 88), the War Room finished into a real multi-persona surface with a true operator Join (Phase 90), and an opt-in 3D mode for the code/vault/KG graph (Phase 91). Two areas already have shipped scaffolding (Phase 88 quick-unblock, Phase 89 `ThemeSwitcher`); the War Room is ~70-75% built. Build order: **AR → TH → ROOM/G3D** (TH-01 token cleanup gates theme-aware 3D colors).

### Theming (TH) — Phase 89

- [x] **TH-01**: Token-driven theming — every color/contrast/glow value resolves from CSS custom properties (one theme = one token set). Finish the Phase 71 cleanup: migrate the ~77 hardcoded hex/rgba sites across ~24 files (`#06b6d4` cyan, `#10b981` emerald, glow `rgba(...)`) to `var(--token)`; canvas-rendered graphs (`ForceGraphCanvas`, `CodeVaultGraph`, KG Explorer) read tokens via a new `useThemeColors()` JS resolver. No hardcoded severity/status colors remain in components.
- [x] **TH-02**: A readability-first theme meeting **WCAG-AA** contrast for body + secondary text; CRT-scanline + matrix-grid + heavy glow disabled/reduced over text regions; a readable (non-mono) body font with mono reserved for code/metrics.
- [x] **TH-03**: **Midnight Aubergine** editorial theme as a `[data-theme="aubergine"]` token block (warm aubergine bg, cream text, gold/emerald/plum accents, paper-grain overlay, ambient radial gradients, editorial primitives) — re-implemented from the pack pattern and **approximated with the existing Geist stack (no new font dependency)**.
- [x] **TH-04**: **Matrix-Emerald** and **Electric Cyan** are retained as theme options; all skins coexist behind the switcher (nothing removed).
- [x] **TH-05**: A **no-flash persisted switcher** in `DashboardLayout` — a blocking inline pre-paint `<script>` in `index.html` applies the saved skin before first paint (no FOUC); the two localStorage keys (`theme`, `codepulse-theme`) are consolidated; `class="dark"` stays permanent (all skins are dark variants); `prefers-reduced-motion` disables scanline/tick/glow animation. **Default skin remains Electric Cyan** (the readable theme is opt-in).
- [x] **TH-06**: **A11y pass** — every theme verified for WCAG-AA contrast on the highest-traffic surfaces (Dashboard, Live Run, Analytics, Forge, Graphs) via `@axe-core/playwright` in the existing Playwright path.

### Analytics Rollup (AR) — Phase 88

- [x] **AR-01**: Ingest-time **rollup tables** (reusing the existing `aggregates` table where its `{metric_type, period, bucket_start, value, dimensions}` shape fits) are maintained from `ingest.ts` / `runtimeIngest.ts`, so `analytics.ts` queries read O(buckets) instead of O(events).
- [x] **AR-02**: Rollups are **correct under real ingest** — idempotent on at-least-once retries (no double-count), archival-consistent (retention/archival never inflates counts), with a one-time **historical backfill** action for pre-rollup data.
- [x] **AR-03**: All `.take()` count caps are **removed** from `analytics.ts` once rollups are authoritative; heatmap/sankey/error-trend fidelity is no longer bounded by caps, and every analytics query reads well under Convex's **16 MiB/exec** limit regardless of total event volume.

### Agent Room / War Room (ROOM) — Phase 90

> Finish-existing (War Room is ~70-75% built: 6 components, Convex schema, ingest endpoints, launch dialog). Cross-repo backend confirmed present: `astridr-repo` ships `POST /api/war-room` (`war_room_routes.py`).

- [x] **ROOM-01**: The War Room renders **real participant identity** — agent names, avatars, colors, and role badges from `useRosterAgents` (the four hardcoded props in `WarRoom.tsx` — name/avatar/agentColor/roleBadge — wired to live roster data).
- [x] **ROOM-02**: Room listing is **bounded** (replace `warRoom.ts listRooms` unbounded `.collect()`), and the `warRooms` Ástríðr→Convex ingest path is confirmed to populate rooms.
- [x] **ROOM-03**: The operator can **really Join** a live war room as a participant — a genuine join/voice signal to Ástríðr (beyond the cosmetic button). *Cross-repo:* confirm/extend the Ástríðr participant-join + voice surface alongside the existing `/api/war-room` create endpoint.
- [x] **ROOM-04**: **Transcript robustness** — a per-room deep-link (`/war-room/:roomId`) and deterministic transcript ordering (a `seq` field on transcript-chunk events prevents out-of-order rendering).

### 3D Memory Galaxy (G3D) — Phase 91

- [x] **G3D-01**: An **opt-in 3D render mode** toggle on `CodeVaultGraph`, backed by `react-force-graph-3d` + `three`, **lazy-loaded** (`React.lazy`/`Suspense`) so the 2D default path never bundles three.js. Reuses the existing `ProjectGraphData` / `useProjectGraph` data (no Convex change); the toggle state persists to `idb-keyval`.
- [x] **G3D-02**: The 3D mode renders the **~4,038-node production graph** at an acceptable frame rate (≥30 FPS target), **disposes the WebGL context cleanly** on 2D↔3D toggling (no leak), and colors nodes via the TH-01 `useThemeColors()` resolver so 3D is **theme-aware**. The 2D render path is unchanged (no regression).

### Voice Command Palette / Jarvis Mode (VOX) — Phase 92

> Added to v9.0 after the milestone was originally scoped (88–91); back-filled into traceability 2026-06-26. All four shipped + verified 2026-06-25.

- [x] **VOX-01**: **Local in-browser wake-word detection** — openWakeWord ONNX (`onnxruntime-web`, Apache-2.0; no Picovoice/account/key) runs in a Web Worker fed by an AudioWorklet mic-capture pipeline; saying the wake phrase opens the CommandPalette in voice mode. Custom `hey_astrid.onnx` classifier (self-contained, committed) is the production model; bundled "hey jarvis" is the dev stand-in.
- [x] **VOX-02**: **Spoken-command transcription** — Web Speech STT extracted to the shared `useSpeechRecognition` hook (reused by ChatInput); live transcript renders and the final text is sent verbatim via the existing `chat.send` WebSocket path (no new transport).
- [x] **VOX-03**: **Streamed reply + persona TTS** — `run.text` renders in the palette and `run.tts` auto-plays once in Ástríðr's voice via the shared `useTtsPlayback` hook (no duplicated audio logic); recognition is paused during playback (feedback guard) so the agent's own voice is not self-transcribed.
- [x] **VOX-04**: **Safe-by-default toggle** — voice mode is OFF by default with a persistent toggle and a visible listening indicator; an ONNX/model load failure degrades to a disabled state with a reason tooltip — no crash, no silent hot mic.

---

## Future Requirements (deferred)

- Make the readability-first theme the **post-ship default** (revisit after the operator lives with it; default stays Electric Cyan for v9.0).
- **Real WebRTC voice join** for the operator (if ROOM-03 ships as a signal-only join first).
- Multi-persona **moderator / turn-taking** mode in the War Room.
- **Bricolage Grotesque** editorial display font for Midnight Aubergine (held — approximated with Geist in v9.0).
- 3D **community-cluster bubbles** + node-size-by-degree (reusing v8.0 community data).

---

## Out of Scope

- **Raw R3F (`@react-three/fiber` + `@react-three/drei`)** for v9.0 — `react-force-graph-3d` covers the opt-in mode without the ~300 KB and without a `<Canvas>`/`useFrame` rewrite.
- **3D post-processing (bloom/glow)** — needs R3F; deferred with the above.
- A **new immersive 3D page/route** — 3D is an opt-in *mode* on the existing `CodeVaultGraph`, not a new surface (2D `ForceGraphCanvas` stays the default render path).
- Mobile app; multi-tenant (unchanged project-level scope).

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TH-01 | Phase 89 | Complete |
| TH-02 | Phase 89 | Complete |
| TH-03 | Phase 89 | Complete |
| TH-04 | Phase 89 | Complete |
| TH-05 | Phase 89 | Complete |
| TH-06 | Phase 89 | Complete |
| AR-01 | Phase 88 | Complete |
| AR-02 | Phase 88 | Complete |
| AR-03 | Phase 88 | Complete |
| ROOM-01 | Phase 90 | Complete |
| ROOM-02 | Phase 90 | Complete |
| ROOM-03 | Phase 90 | Complete |
| ROOM-04 | Phase 90 | Complete |
| G3D-01 | Phase 91 | Complete |
| G3D-02 | Phase 91 | Complete |
| VOX-01 | Phase 92 | Complete |
| VOX-02 | Phase 92 | Complete |
| VOX-03 | Phase 92 | Complete |
| VOX-04 | Phase 92 | Complete |
