# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

CodePulse is the real-time telemetry dashboard for the Ástríðr AI agent framework. It's a React SPA with a Convex backend that ingests events from Ástríðr agents and displays them as live-updating dashboards.

## Commands

```bash
npm run dev              # Vite dev server (port 5173)
npm run dev:backend      # Convex dev backend (npx convex dev)
npm run build            # Production build
npm test                 # Vitest unit tests
npm run test:ui          # Vitest with browser UI
npm run test:e2e         # Playwright E2E tests
npx convex deploy --yes  # Deploy Convex backend to prod
npm run deploy           # Deploy Convex + build frontend
```

Run a single test file: `npx vitest run src/App.test.tsx`

Type check: `npx tsc --noEmit`

## Tech Stack

React 19, Vite 7, TypeScript 5.9, Convex (database + backend), Tailwind CSS 4 (via `@tailwindcss/vite` plugin), React Router v7, Recharts, React Flow, React Three Fiber, Tone.js (ambient audio). Optional Clerk auth (gracefully skipped if `VITE_CLERK_PUBLISHABLE_KEY` not set).

## Architecture

### Data Flow

Ástríðr agents → HTTP POST (`/ingest`, `/runtime-ingest`) → Convex httpAction handlers → domain mutations → Convex tables → `useQuery()` subscriptions → React UI auto-updates.

### Frontend (`src/`)

- **`main.tsx`** — Provider stack: `ConvexProvider` → `PrivacyProvider` → `AmbientProvider` (+ optional `ClerkProvider`)
- **`App.tsx`** — React Router routes, all inside `DashboardLayout`. Heavy pages (Agents, Analytics) are lazy-loaded.
- **`pages/`** — One file per route. Each page composes domain-specific components.
- **`hooks/`** — Thin wrappers around `useQuery(api.domain.function)` and `useMutation()`. One hook per Convex domain.
- **`contexts/`** — `PrivacyContext` (PII masking) and `AmbientContext` (Tone.js audio engine + health-reactive soundscapes).
- **`components/`** — Reusable UI. `SectionErrorBoundary` wraps widget groups. `InfoTooltip` for help text.
- **`lib/`** — Utilities: `privacy.ts` (regex masking), `audioEngine.ts` (Tone.js synth), `formatters.ts`.

### Backend (`convex/`)

- **`schema.ts`** — 40+ tables. Key groups: build-time (sessions, events, agents, fileOps), runtime (dockerContainers, llmMetrics, systemResources), capabilities (mcpServers, discoveredTools), profiles (profileConfigs, agentProfiles, profileSwitches).
- **`http.ts`** — HTTP router with CORS. Routes: `/ingest`, `/runtime-ingest`, `/scan`, `/health`, `/v1/metrics`, `/v1/logs`.
- **`ingest.ts`** — Build-time event handler. Dispatches by `eventType` to domain tables.
- **`runtimeIngest.ts`** — Runtime event handler. Dispatches `llm_call`, `docker_status`, `profile_config`, etc.
- Domain modules (`sessions.ts`, `agents.ts`, `alerts.ts`, `profiles.ts`, etc.) export queries and mutations.

### Key Tables

- `profileConfigs` — Per-profile settings (channels, budget, modelPreferences, emailAddress). Indexed by `profileId`.
- `agentConfigs` — Generic key-value config store with source tracking.
- `configChanges` — Audit trail for all config modifications.

## Patterns

**Adding a new page:** Create `src/pages/NewPage.tsx` → import in `App.tsx` → add `<Route>` → add nav entry in `src/layouts/DashboardLayout.tsx` (`navItems` array + `iconMap`).

**Adding a Convex function:** Create/edit `convex/domain.ts` → export `query()` or `mutation()` with `v.` validators → consume via `useQuery(api.domain.fn)` or `useMutation(api.domain.fn)` in React.

**Custom hooks:** `src/hooks/useFoo.ts` wraps `useQuery(api.foo.list) ?? []` to handle undefined during loading.

**Error boundaries:** Wrap dashboard sections with `<SectionErrorBoundary name="Label">` so one failing widget doesn't take down the page.

## Styling

Tailwind CSS 4 only — no component library. Dark theme throughout: `bg-gray-800/50` cards, `border-gray-700/50` borders, `text-gray-300` body text, `indigo-600` accents, green/amber/red for status indicators. Fonts: Cinzel (headings), Geist (body), JetBrains Mono (code).

## Environment Variables

- `VITE_CONVEX_URL` — Required. Convex deployment URL.
- `VITE_CLERK_PUBLISHABLE_KEY` — Optional. Clerk auth key.
- `CONVEX_DEPLOY_KEY` — Optional. For CI/CD Convex deploys.

## Testing

Vitest with jsdom. Setup file at `src/test/setup.ts` mocks heavy externals (Clerk, Recharts, Three.js, Globe, React Flow, Tone.js). Tests live alongside source: `src/**/*.test.tsx`, `convex/**/*.test.ts`.

Path alias `@/` resolves to `./src/` in both Vite and tsconfig.
