# Feature Landscape — CodePulse v9.0 Readability & Experience

**Domain:** Single-operator AI-ops telemetry + control dashboard (subsequent milestone)
**Researched:** 2026-06-23
**Milestone scope:** Four feature areas — Readable Theme System, Agent Room, 3D Memory Galaxy, Analytics Rollup

---

## Feature Area 1: Readable Theme System + Editorial Skin Toggle

### What Already Exists (Evidence)

`src/components/ThemeSwitcher.tsx` — shipped in Phase 89. Reads `localStorage("codepulse-theme")`, sets `document.documentElement.setAttribute("data-theme", value)`, exposes three options: `cyan` / `emerald` / `amber`. Applied via `useEffect` (not a blocking script), so there IS a flash on first paint when localStorage differs from the default `cyan` in the component state.

`src/index.css` — Three `[data-theme]` blocks exist (cyan, emerald, amber), each overriding Tailwind tokens. Reduced-motion global rule at line 441 disables all animations under `prefers-reduced-motion: reduce`. No `--speaking-ring`, `--status-*`, or `--metric-*` semantic tokens confirmed in these blocks.

`index.html` — No inline blocking script to apply theme before React hydrates. `class="dark"` is hardcoded on `<html>`. The ThemeSwitcher `useEffect` runs after mount, producing a flash if the stored theme differs from `cyan`.

`src/layouts/DashboardLayout.tsx` — Maintains a separate `dark`/`light` toggle in `localStorage("theme")` independent of the ThemeSwitcher's `localStorage("codepulse-theme")`. Two persistence keys, two separate mechanisms.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| No-flash theme application | Flash on page load is amateur; breaks trust | Low | Requires inline blocking `<script>` in `index.html` before React loads |
| Token-driven theming | Themes must not require component markup changes | Medium | Finish Phase 71 token audit; ensure `--status-*`, `--metric-*`, `--info` are declared per-theme |
| WCAG AA contrast on all three themes | Accessibility baseline | Medium | Current cyan/emerald have low-contrast glow text regions |
| prefers-reduced-motion honored per theme | System accessibility contract | Low | Global CSS rule exists; confirm scanline/matrix-grid effects respect it |
| Theme persisted across sessions | Users set-and-forget | Low | Already works via localStorage; fix the flash delivery path |
| Unified persistence key | One key, not two (`theme` vs `codepulse-theme`) | Low | Consolidate before adding more themes |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Midnight Aubergine editorial skin | Warm, legible alternative for long-session readability | Medium | Warm aubergine bg, cream text, gold/emerald/plum accents, paper-grain `body::before`, ambient radial gradient `body::after` — TH-03 provenance from pack `globals.css` |
| Per-theme animation opt-in | Effects as intentional choice, not forced aesthetic | Low | Each theme declares its own animation tokens; reduced-motion toggles globally |
| WCAG AA a11y pass on high-traffic surfaces | Verifiable accessibility claim | Low-Medium | Playwright/axe path already exists |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Forking component markup per theme | Creates maintenance debt on 110+ components | Token-only theming; themes live in CSS custom properties |
| Removing Matrix-Emerald | Operator preference; some users want cyberpunk | Keep as an option behind the toggle (TH-04) |
| OS `prefers-color-scheme` auto-switching | Unpredictable for an ops dashboard; operator sets their own state | Honor reduced-motion only; ignore color-scheme media query |
| Loading new font families per theme | Adds 200-400ms network cost per theme switch | Approximate with existing Geist stack; Bricolage/Manrope/Caveat are cosmetic |

### Dependencies on Existing Features

- Phase 71 design-token audit (partially done) — semantic tokens must be present before themes can swap them
- `DashboardLayout.tsx` — ThemeSwitcher already wired here; consolidate the dark/light toggle into the same switcher

### Complexity: LOW-MEDIUM

No new components required. Primary work is CSS token authoring + one blocking inline script. The a11y pass is the riskiest unknown (finding and fixing contrast failures across 15 pages).

---

## Feature Area 2: Agent Room (War Room) — AUDIT

This section is evidence-backed. All claims trace to specific files and line numbers.

### Route Wiring

`src/App.tsx:118` — `/war-room` route exists, lazy-loads `src/pages/WarRoom.tsx`. **Route: WIRED.**

No `/room` or `/agent-room` route exists. There is no per-room deep-link (e.g., `/war-room/:roomId`).

### Frontend Component Inventory

| Component | File | State | Notes |
|-----------|------|-------|-------|
| `WarRoom` page | `src/pages/WarRoom.tsx` | SCAFFOLDED — functionally integrated | Reads `api.warRoom.listRooms`, renders room list + room detail, subscribes to `transcript.chunk` and `room.participant_speaking` via WS |
| `RoomListItem` | `src/components/RoomListItem.tsx` | COMPLETE | Sidebar row: name, status badge, participant count, active ping. Uses `--speaking-ring` CSS var. |
| `AgentVoiceCard` | `src/components/AgentVoiceCard.tsx` | COMPLETE | GlassPanel card: AgentAvatar, role badge, current task, join duration, speaking ring overlay with reduced-motion branch. All props typed. |
| `VoiceControlBar` | `src/components/VoiceControlBar.tsx` | COMPLETE | Pre-join/joined states, mute toggle, 3-second confirm-leave. motion/react animation, reduced-motion aware. |
| `TranscriptBubble` | `src/components/TranscriptBubble.tsx` | COMPLETE | User right-aligned, agent left-aligned, `agentColor` border accent, timestamp. |
| `TranscriptPanel` | `src/components/TranscriptPanel.tsx` | COMPLETE | ScrollArea, auto-scroll with user-scroll pause, JumpToLatestPill, live flash via `useLiveFlash`. |
| `CallStatsBar` | `src/components/CallStatsBar.tsx` | COMPLETE | 4-cell grid: duration, participants, words, cost. |
| `WarRoomLaunchDialog` | `src/components/hr/WarRoomLaunchDialog.tsx` | COMPLETE | Full dialog: participant picker (with search), topic, agenda, save-as-team-preset. Calls `createWarRoom()` in `src/lib/astridrApi.ts`. |
| `MeetingBot` page | `src/pages/MeetingBot.tsx` | SCAFFOLDED | Active calls, recent calls table, transcript replay (live calls not wired to WS). |
| `MissionControl` page | `src/pages/MissionControl.tsx` | EXISTS (not audited in depth) | Separate page; task-oriented companion. |

### Backend / Convex Inventory

| Layer | State | Notes |
|-------|-------|-------|
| `convex/schema.ts` — `warRooms` table | COMPLETE | Fields: `roomId`, `name`, `status`, `participantIds[]`, `createdAt`, `updatedAt`. Indexed by roomId and status. |
| `convex/schema.ts` — `warRoomEvents` table | COMPLETE | Fields: `roomId`, `eventType`, `speakerId`, `speakerName`, `text`, `payload`, `timestamp`. |
| `convex/schema.ts` — `voiceCalls`, `callTranscripts`, `meetingBotSessions` | COMPLETE | Full Meeting Bot persistence layer. |
| `convex/schema.ts` — `teamPresets` | COMPLETE | `agentIds[]`, `warRoomCount`, `lastUsedAt`. |
| `convex/warRoom.ts` — `listRooms`, `getRoomEvents` | COMPLETE | Read queries only; no write mutations here (writes go through v6Mutations). |
| `convex/warRoomIngest.ts` — `warRoomIngest` | COMPLETE | Handles `room.created`, `room.updated`, `participant.joined`, `participant.left`. |
| `convex/warRoomIngest.ts` — `transcriptIngest` | COMPLETE | `transcript.chunk` to `warRoomEvents` and/or `callTranscripts` (dual-target). |
| `convex/warRoomIngest.ts` — `meetingBotIngest` | COMPLETE | `call.started`, `call.ended`, `bot.status`. |
| `convex/http.ts` — HTTP routes | COMPLETE | `/war-room-ingest`, `/meeting-bot-ingest`, `/transcript-ingest`, `/mission-control-ingest` all registered. |
| `src/lib/astridrApi.ts` — `createWarRoom()` | COMPLETE | POSTs to Ástríðr `/api/war-room` with `participants[]`, `topic`, `teamPresetId`. |
| `useTeamPresets` hook | COMPLETE | CRUD + `incrementUsage`; wired to `api.teamPresets.*`. |
| `useRosterAgents` hook | COMPLETE | Merges Ástríðr API + Convex fallback + pending approvals + avatarData (color included). |

### What Is Missing / Wired But Incomplete

| Gap | Severity | Evidence |
|-----|----------|----------|
| **Persona resolution in WarRoom.tsx** | HIGH | Line 194: `name={pid}` — agent cards display the raw `participantId` string, not the agent's name. `useRosterAgents` is NOT imported in `WarRoom.tsx`. The hook exists and has name/avatar data; it's just not hooked up. |
| **`agentColor` always `undefined`** | MEDIUM | Line 63: `agentColor: undefined` hardcoded for live transcript chunks. The `TranscriptBubble` accepts a color prop for per-agent visual identity but it is never populated. Need to resolve profileId to avatar color from the roster. |
| **`avatar` always `null` for AgentVoiceCard** | HIGH | Line 196: `avatar={null}` — all agent cards render with the default placeholder avatar. Roster hook has `avatarData` with emoji/color; just not connected. |
| **`roleBadge` always `"Agent"`** | LOW | Line 197: `roleBadge="Agent"` hardcoded. Should reflect the agent's tier (command/domain/shared) or a custom role label. |
| **`currentTask` never populated** | LOW | No `currentTask` prop passed to `AgentVoiceCard` from `WarRoom.tsx`. Could come from active session data. |
| **No per-room deep-link / URL state** | MEDIUM | Room selection is local React state only. Refreshing the page loses room selection. No `/war-room/:roomId` route. |
| **VoiceControlBar "Join" is UI-only** | HIGH | `isJoined` is local state that tracks nothing real. No WebRTC/WebSocket "join" command is sent when the user clicks Join. The button changes state cosmetically only. |
| **Speaking state expires after 2s fixed timeout** | LOW | `setTimeout(..., 2000)` in `WarRoom.tsx` line 82 — not correlated to actual speaking duration. Fine for now. |
| **`agentColor` in persisted event replay** | MEDIUM | Lines 93-105: persisted event path also always omits `agentColor`. Same root cause as live chunks. |
| **No mutation to close/archive a room** | LOW | No "close room" button or mutation exists. Status updates come from Ástríðr ingest only. |
| **Ástríðr `/api/war-room` endpoint** | CROSS-REPO DEPENDENCY | `createWarRoom()` calls this endpoint. If Ástríðr has not implemented it, the launch dialog always fails. Not a CodePulse gap but a hard dependency. |

### Summary Verdict: "Finish Existing" not "Build Net-New"

The War Room is approximately 70-75% complete. The structural scaffolding is solid and production-quality (schema, ingest, HTTP routes, all 6 display components, launch dialog). The remaining gaps are wiring issues, not architectural ones:

- Connect `useRosterAgents()` in `WarRoom.tsx` to resolve `pid` to `{name, avatar, tier}`
- Populate `agentColor` from avatar.color for both live and persisted transcript chunks
- Add per-room URL routing (recommended)
- Decide on the "Join" button's real behavior (WebRTC vs. explicit observer mode — this is a product decision that must be stated explicitly before building)

### Table Stakes for a Complete Agent Room

| Feature | Why Expected | Currently | Complexity to Finish |
|---------|--------------|-----------|---------------------|
| Participant names shown (not raw IDs) | Basic legibility | Missing | Low — wire useRosterAgents |
| Agent avatars/colors in voice cards | Visual identity in group chat | Missing | Low — avatarData already in hook |
| Per-agent color in transcript | Distinguish speakers visually | Missing | Low — same hook |
| Per-room URL / deep-link | Browser back/refresh survival | Missing | Low — add route param |
| Clear "Join" behavior contract | Operator knows what the button does | Cosmetic only | Medium — product decision first |

### Differentiators for Agent Room

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Moderator / facilitator mode | One agent drives agenda; others respond in turn | High | Requires Ástríðr-side orchestration; CodePulse surfaces it |
| Persistent room history / searchable transcript | Ops audit trail | Low | Schema already exists; needs search/filter UI |
| Room summary auto-generation | Post-session briefing | Medium | Reuse existing briefings pattern + `summaryText` on meetingBotSessions |
| Turn-taking indicator | Visual "thinking" state before an agent speaks | Medium | Requires Ástríðr to emit a "thinking" event type |

### Anti-Features for Agent Room

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time audio synthesis per agent | Latency, compute cost, complexity; text-first ops dashboard | Keep text transcript + visual "speaking" indicator |
| Multi-room simultaneous view | Complexity and distraction for single operator | One room at a time; sidebar is the navigation |
| Agent-to-agent private channels within a room | Hidden state in group context | All communication visible in shared transcript |

---

## Feature Area 3: 3D Memory Galaxy

### What Already Exists

`src/components/graph/CodeVaultGraph.tsx` — 2D force graph using `ForceGraphCanvas` (react-force-graph-2d). Has fullscreen toggle, source filter (code/vault/both), node click detail panel, community coloring.

`src/components/graph/ForceGraphCanvas.tsx` — The 2D canvas renderer. Uses `react-force-graph-2d` and `d3-force-3d` (type declarations exist in `src/types/d3-force-3d.d.ts`) for cluster forces. Already imports 3D-capable force functions.

`react-three-fiber` / `@react-three` / `drei` — NOT in package.json. Zero R3F dependencies installed. This is a new dependency set.

`d3-force-3d` — Already in use (indirectly) for 2D force simulation; the type declarations confirm it is installed. It can supply 3D forces for a 3D renderer at no additional package cost.

### Table Stakes for Opt-In 3D Mode

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 2D default stays unchanged | Don't regress existing users | Low | Toggle approach; 2D path stays as is |
| Render-mode toggle (2D/3D) | The opt-in mechanism | Low | Button on CodeVaultGraph; preserves state in localStorage |
| Same data, different renderer | No new data model | Low | 3D renderer consumes same `nodes[]`/`links[]` from `useProjectGraph` |
| Orbit controls (mouse rotate/zoom/pan) | 3D navigation baseline | Low | `drei`'s `<OrbitControls />` |
| Node click to detail panel | Feature parity with 2D | Low | Re-use existing detail panel component |
| Color coding preserved | Code=emerald, vault=violet | Low | Same `colorFn` passed to both renderers |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Community cluster bubbles in 3D | Spatial separation of graph communities | Medium | d3-force-3d forceCluster or Z-axis grouping per community |
| Node size proportional to degree | High-degree nodes larger; topology at a glance | Low | Reuse existing degree data |
| Fly-to on node focus | Deep-link `/graphs?focus=X` centers camera | Medium | Three.js camera position lerp |
| Bloom/glow on emerald nodes | "Memory galaxy" aesthetic payoff | Low | `@react-three/postprocessing` Bloom pass |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 3D as the default or only mode | Disorienting; accessibility issues with 3D navigation | Opt-in toggle; 2D stays default |
| Full-page immersive 3D experience | Breaks dashboard context | Toggle ON the existing CodeVaultGraph component, not a new route |
| Custom physics engine | react-force-graph-3d wraps three.js + d3-force-3d cleanly; no need to reinvent | Use the library |
| VR/AR mode | Zero operator value for an ops dashboard | Skip entirely |

### Dependencies

- New packages: `@react-three/fiber`, `@react-three/drei`, `three`, `react-force-graph-3d`
- `CodeVaultGraph.tsx` needs a render-mode state toggle and conditional branch
- `ForceGraphCanvas.tsx` stays untouched (2D path)
- New `ForceGraph3DCanvas.tsx` companion component wrapping `react-force-graph-3d`
- Dynamic import to avoid adding ~600KB three.js to the initial bundle

### Complexity: MEDIUM

R3F is new to the codebase. `react-force-graph-3d` abstracts most three.js setup. Main risk is bundle size and test-environment mocking (three.js is already mocked in `src/test/setup.ts` — confirm the mock covers the 3D import path too).

---

## Feature Area 4: Analytics Rollup (Backend Hardening)

### What Already Exists

`convex/aggregates.ts` — `computeHourly` internalMutation writes to `aggregates` table with goal-scoped 4-segment keys. Idempotency guard exists. Cron-driven.

Phase 88 quick-unblock already deployed (`edb614c`). The ingest-time rollup approach (incrementing aggregates at ingest rather than `.take()`-scanning the full table) addresses the 16 MiB/exec Convex read limit.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Analytics page loads without timeout | Existing `.take()` count caps caused silent data loss at scale | Already fixed in Phase 88 | Verify no regression on live data |
| Correct totals on Analytics page | Operators make cost decisions from these numbers | Low | Cross-check rollup vs raw row counts on a sample window |

### Differentiators (Not Worth Pursuing in v9.0)

Deeper analytics surfaces (goal-level cost breakdown, per-agent session comparison) exist in Phase 74 HR analytics. This feature area is backend hardening only; the minimal user-facing surface is "Analytics page works reliably."

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Backfill UI for historical gaps | High complexity, low operator value | Accept that pre-Phase-88 data is incomplete; new data is correct going forward |
| Real-time streaming aggregates | Overkill for hourly cost intelligence | Hourly cron is sufficient |

### Complexity: LOW (already shipped)

Phase 88 deployed. The remaining work is regression testing and confirming the Analytics page reads from pre-aggregated data, not raw table scans.

---

## Feature Dependencies

```
TH-01 (token-driven theming) → TH-02 (readable theme) → TH-03 (aubergine theme)
TH-05 no-flash → requires index.html blocking script (independent of theme tokens)
Agent Room persona wiring → useRosterAgents hook (already complete, just not imported)
Agent Room "Join" contract → product decision → Ástríðr /api/war-room endpoint (cross-repo)
3D Memory Galaxy → install react-three-fiber stack (new dependency)
Analytics Rollup → no dependencies (Phase 88 already shipped)
```

## MVP Recommendation for v9.0

**Prioritize (in order):**

1. **Theme no-flash + token audit** — highest operator-visible impact, lowest risk. Fix the flash (one `<script>` in index.html), consolidate the two localStorage keys, audit tokens.
2. **Midnight Aubergine theme** — high creative value, low code surface. Pure CSS.
3. **Agent Room persona wiring** — three targeted changes in `WarRoom.tsx` that make the existing scaffolding actually usable (names, avatars, agentColor). Explicitly decide "Join" semantics before touching VoiceControlBar.
4. **Analytics rollup verification** — confirm Phase 88 is working correctly on live data.
5. **3D Memory Galaxy** — new dependency, new renderer; last to avoid blocking other areas.

**Defer:**
- Real WebRTC "Join" behavior — requires Ástríðr-side work; ship as explicit "observer mode" for now
- WCAG a11y pass — schedule after themes are stable; run axe in CI
- Room deep-link URLs — useful but not blocking usability
- Moderator/turn-taking mode — requires Ástríðr orchestration changes

## Sources

- Direct code audit: `src/pages/WarRoom.tsx`, `src/components/RoomListItem.tsx`, `src/components/AgentVoiceCard.tsx`, `src/components/TranscriptBubble.tsx`, `src/components/TranscriptPanel.tsx`, `src/components/VoiceControlBar.tsx`, `src/components/CallStatsBar.tsx`, `src/components/hr/WarRoomLaunchDialog.tsx`
- `convex/warRoom.ts`, `convex/warRoomIngest.ts`, `convex/schema.ts` (lines 1277-1367)
- `src/components/ThemeSwitcher.tsx`, `src/index.css` (lines 128-219, 441-444), `index.html`
- `src/components/graph/CodeVaultGraph.tsx`, `src/types/d3-force-3d.d.ts`, `package.json`
- `convex/aggregates.ts`, `.planning/PROJECT.md`, `.planning/phases/89-readable-themes-editorial-skin-toggle/89-CONTEXT.md`
- Confidence: HIGH — all claims from direct file reads; no inference from training data
