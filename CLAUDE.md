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

**Adding a new page:** Create `src/pages/NewPage.tsx` → lazy-import in `App.tsx` → add `<Route>` → add nav entry in `src/lib/navRegistry.ts` (`iconComponents` map + the relevant `navGroups` group's `items` array — NOT `DashboardLayout.tsx`, which only *consumes* the registry; the registry was extracted out at Phase 96's WR-02 so both `DashboardLayout` and `CommandPalette` can read it without importing each other).

**Adding a Convex function:** Create/edit `convex/domain.ts` → export `query()` or `mutation()` with `v.` validators → consume via `useQuery(api.domain.fn)` or `useMutation(api.domain.fn)` in React.

**Custom hooks:** `src/hooks/useFoo.ts` wraps `useQuery(api.foo.list) ?? []` to handle undefined during loading.

**Error boundaries:** Wrap dashboard sections with `<SectionErrorBoundary name="Label">` so one failing widget doesn't take down the page.

## Styling

Tailwind CSS 4 + **shadcn/ui (New York)** — 30 primitives in `src/components/ui/` (Radix-backed); compose these, don't hand-roll. The UI is **token-driven with a runtime theme switcher** (`ThemeSwitcher.tsx`, resolved via `useThemeColors()`; v9.0 Phase 89). Theme is a `<html data-theme="...">` attribute persisted in `localStorage["codepulse-theme"]` and applied by a no-flash pre-paint script in `index.html`. Dark themes (defined as `[data-theme="…"]` blocks in `src/index.css`): **`cyan` — Electric Cyan `#06b6d4` (the default)**, `emerald` — Matrix Emerald `#10b981`, `readable` — Readable Dark (WCAG-AA, glow/CRT/matrix effects suppressed), `aubergine` — Midnight Aubergine (editorial). (`amber` `#f59e0b` is defined in CSS but not exposed in the switcher.) The light `:root` is a true-monochrome oklch "Paperclip" palette. All accents/status/glow read from CSS vars — never hardcode hex: use `--primary`/`--status-*`/`--info`/`--glow-xs…lg`/`--chart-*`. Neutrals are zinc (`#09090b/#141416/#27272a`); effective radius is `0.5rem`. Fonts: **Geist (body + headings), JetBrains Mono (code)** — Cinzel is retired. Icons: **Lucide only**.

## Design Findings (v15.0 overhaul)

- **Sketch findings for codepulse** (validated "Borealis Console" design decisions, CSS patterns, visual direction for the v15.0 premium UI overhaul) → `Skill("sketch-findings-codepulse")`. Load before any UI build work on the overhaul. Sequencing: the entire overhaul incl. quick-wins is held for milestone v15.0 — do not pull pieces into v14.0 phases.

## Ástríðr API Integration

All `fetch()` calls to the Ástríðr backend (`ASTRIDR_API_BASE`) MUST include the `Authorization: Bearer` header using `VITE_ASTRIDR_API_KEY`. The Ástríðr web channel rejects unauthenticated `/api/*` requests with 401.

- For JSON requests: use `authHeaders()` from `src/lib/astridrApi.ts`
- For FormData/multipart: add `Authorization` header manually (do NOT set Content-Type — browser handles it)
- Applies to any new file making Ástríðr API calls, not just `astridrApi.ts`

## Self-Hosted Convex — Operational Rules (2026-07-22 incident)

The production backend is SELF-HOSTED (single node, SQLite) at `C:\Users\mandr\convex-selfhost\`. Its MVCC tombstone GC cannot absorb mass deletes while serving load. Hard rules:

- **NEVER run `npx convex import --replace-all` against the live instance.** It deletes every existing row first — millions of tombstones that poisoned every index, ballooned memory 4x, and took the dashboard down for days (2026-07-21/22). To restore or trim: import into a FRESH EMPTY instance (new volume, same INSTANCE_SECRET) and swap volumes.
- **Never bulk-delete or bulk-patch a large table on the live instance** (mass archival sweeps included). Retention-style deletes must stay batch-capped like `convex/retention.ts`.
- A dashboard-wide "no data / all zeros / reconnect loop" is index rot or memory starvation until proven otherwise — check `docker stats convex-backend`, then the soak-watch canary log (`convex-selfhost\soak-watch.log`), before touching frontend code.
- `docker inspect` showing `OOMKilled:false, ExitCode:0` does NOT rule out OOM — the kernel reaps the child server process and PID 1 exits cleanly. Check `wsl -e dmesg | grep -i oom`.
- **`ConvexNightlyRestart` is deliberate, not an unexplained workaround.** The self-hosted binary's working-set climbs at roughly ~0.17 GiB/h baseline (observed up to ~1.04 GiB/h on some inter-restart windows); no memory-bounding knob was found among the candidates probed (Phase 110 DUR-03) — the strongest identified candidate is upstream `get-convex/convex-backend#495`, whose fix (`PR #522`) is open but unmerged. The restart is health-gated: `restart-convex.ps1` asserts `:3210/version` returns 200 within 150s and logs `INVESTIGATE` rather than claiming success otherwise. Full evidence, control-paired probes, and upstream status: `.planning/phases/110-convex-durability/110-MEMORY-EVIDENCE.md`.
- **The `/galdr` and `/loom` bearer keys are NOT a boundary on the write itself.** They gate the documented CLI path only. Every **public** Convex function is callable with no credential by anything that can route to the host — measured 2026-08-11: an unauthenticated `POST /api/mutation` for `galdr:recordUsage` reaches argument validation, i.e. the function runs (control: a bogus function name returns `Could not find public function`, so the probe discriminates). Only 13 of ~137 `convex/*.ts` modules reference `ctx.auth`. Do not add a bearer-gated HTTP route and assume the underlying mutation is protected; if a write must be gated, the mutation itself has to be `internalMutation` (as `activeEngine.ts:79`, `controlVerbSwaps.ts:46` and — since 2026-08-11 — `loom.ts`'s `upsertPipeline`/`recordStepEvent` are), and that only works when nothing in the UI calls it.
- **DECIDED 2026-08-11 (SEED-008, resolved): the TAILNET is the auth boundary. Clerk gates the UI, not the data.** Measured at decision time: **215** public mutations, only **8** files referencing `ctx.auth`, **85** with none. Making Clerk fail-closed app-wide was explicitly REJECTED as disproportionate — it is optional by design and the whole Playwright suite depends on `dev:noauth`. Gating only the ~18 destructive mutations was also rejected (breaks the same paths, leaves 197 ungated, reads as an unfinished migration). **Do not "harden" one module's mutations in isolation** — that is the shape that was rejected. Enforcement is the LAN firewall block, which is MACHINE state, not repo state: `convex-selfhost/preflight.ps1` carries `firewall:Block-Convex-*-LAN` as named checks so a rebuilt machine reports them missing instead of silently losing them. **Reopen the decision if** the backend becomes reachable beyond the tailnet, or the tailnet gains a device that is not Larry's — Tailscale's default ACL lets every enrolled device reach everything, and those ACLs have never been inspected. The container publishes `0.0.0.0:3210-3211` (all interfaces). **The LAN could reach it** — measured 2026-08-11 from a laptop on the same subnet with Tailscale off: `http://10.0.0.44:3210/version` returned **200** (control: `:5173` also 200, proving the path was live). Closed the same day by `convex-selfhost\restrict-convex-lan.ps1`, a Windows Firewall **Block** rule on TCP 3210-3211 + 6791 scoped to `RemoteAddress=LocalSubnet`; the same laptop probe then returned **000** while browsing over Tailscale kept working. Block beats Allow in WFP, so it overrides the Docker Desktop allowance without touching it; tailnet peers (`100.64.0.0/10`) are not LocalSubnet, and loopback is unaffected. Rerun that script with `-Remove` to revert. **A firewall-rule reading is not a reachability result** — the Public-vs-Private profile analysis predicted the LAN was already blocked and was flatly wrong, and no probe from this host can settle it (loopback, Docker-bridge NAT and WSL are each special-cased). Only a device that is neither this machine nor a container on it can.
- Full incident history: Claude memory file `convex-selfhosted-setup`.

## Environment Variables

- `VITE_CONVEX_URL` — Required. Convex deployment URL.
- `VITE_CLERK_PUBLISHABLE_KEY` — Optional. Clerk auth key.
- `VITE_ASTRIDR_API_URL` — Ástríðr backend URL (default: `http://localhost:8181`).
- `VITE_ASTRIDR_API_KEY` — Ástríðr API bearer token. Required for all `/api/*` calls.
- `CONVEX_DEPLOY_KEY` — Optional. For CI/CD Convex deploys.
- `CLI_GATEWAY_URL` — Convex-side env var (not `VITE_`-prefixed). Base URL of the CLI-gateway sidecar (its own host:port, separate from `ASTRIDR_API_URL`). Required for `convex/gatewayQuota.ts`'s `pollAndStore` cron to fill `gatewayQuotaSnapshots` (Phase 104 D-20) — no fallback to `ASTRIDR_API_URL`, which has no `/quota` route.
- `CLI_GATEWAY_API_KEY` — Optional. Bearer token for the CLI-gateway sidecar's `/quota` route. Falls back to `ASTRIDR_API_KEY` when unset.

## Testing

Vitest with jsdom. Setup file at `src/test/setup.ts` mocks heavy externals (Clerk, Recharts, Three.js, Globe, React Flow, Tone.js). Tests live alongside source: `src/**/*.test.tsx`, `convex/**/*.test.ts`.

Path alias `@/` resolves to `./src/` in both Vite and tsconfig.

## graphify

This project has a knowledge graph at graphify-out/.

Rules:
- If graphify-out/wiki/index.md exists, start there — read community and god node articles for cheap navigable context before grepping raw files.
- For architecture and codebase questions, use `graphify query "<question>" --budget 2000` — this traverses the graph and caps output at ~2000 tokens. Do NOT read GRAPH_REPORT.md directly (it can be 300KB+).
- For cross-module relationships, prefer `graphify path "<A>" "<B>"` or `graphify explain "<concept>"` over grep — these traverse EXTRACTED + INFERRED edges.
- Only read GRAPH_REPORT.md if you specifically need the full community overview and the user asks for it.
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost).
