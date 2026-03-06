# CodePulse — Ástríðr Runtime Telemetry Dashboard

Real-time telemetry dashboard for the Ástríðr AI agent framework. Monitors build-time events, runtime infrastructure, agent coordination, and security posture across sessions.

**Tech stack:** React 19 · Vite 7 · Convex · Tailwind CSS 4 · Recharts · React Flow

## Quick Start

```bash
git clone https://github.com/larrymandras/codepulse.git
cd codepulse
npm install
cp .env.example .env.local
# Edit .env.local with your Convex URL
npx convex dev      # start Convex backend
npm run dev          # start Vite dev server
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run dev:backend` | Start Convex dev backend |
| `npm run build` | Production build |
| `npm run deploy` | Deploy Convex + build frontend |
| `npm test` | Run Vitest tests |
| `npm run test:ui` | Run Vitest with UI |
| `npm run test:e2e` | Run Playwright E2E tests |

## Architecture

The frontend is a React SPA served by Vite and deployed to Vercel. The backend runs entirely on Convex, providing real-time subscriptions, mutations, and HTTP endpoints for telemetry ingestion. Data flows from Ástríðr agents through HTTP POST endpoints into Convex tables, and the dashboard subscribes to live query updates.

## API Endpoints

All endpoints are served by the Convex HTTP router:

- **POST `/ingest`** — Build-time telemetry event ingestion
- **POST `/runtime-ingest`** — Runtime telemetry event ingestion
- **POST `/scan`** — Environment capability scan
- **GET `/health`** — Health check (returns DB connectivity status)

## Deployment

- **Frontend:** Vercel (auto-deploys from `master`)
- **Backend:** Convex (`npx convex deploy`)

See [Ástríðr](https://github.com/larrymandras/astridr) for the agent framework.
