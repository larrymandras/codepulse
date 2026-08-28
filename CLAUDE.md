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
```

**Deploying the Convex backend.** The production backend is SELF-HOSTED (see the operational-rules
section below), so the deploy MUST name it explicitly:

```bash
npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

`--env-file` is not optional. A bare `npx convex deploy`, `npx convex deploy --yes`, or
`npm run deploy` can target the retired cloud deployment `tidy-whale-981` (frozen 2026-07-15)
instead of the live self-hosted instance. If the CLI prompts for confirmation, add `-y`
*alongside* `--env-file`, never instead of it. Established by Phase 112
(`.planning/phases/112-telemetry-coverage-closure/112-07-PLAN.md:62-65`).

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

Vitest with jsdom. Setup file at `src/test/setup.ts` (138 lines) installs jsdom polyfills for
`SpeechRecognition`/`Audio`/`Worker`/`AudioWorkletNode` plus one `vi.mock` for `livekit-client` —
it does **not** globally mock Clerk, Recharts, Three.js, Globe, React Flow, or Tone.js (a prior
version of this line claimed it did; verified false by a full read of the file, Phase 114
plan 09). **Heavy render libraries are mocked per test file, not globally** — see
`src/components/graph/ForceGraphCanvas.test.tsx` and
`src/components/workspace/WorkspaceMapCanvas.test.tsx` for the live `vi.hoisted` +
`vi.mock("react-force-graph-2d", ...)` props-capture pattern. Tests live alongside source:
`src/**/*.test.tsx`, `convex/**/*.test.ts`.

Path alias `@/` resolves to `./src/` in both Vite and tsconfig.


## Convex & Frontend Lessons
Moved here 2026-08-21 from global CLAUDE.md, where they were dead weight in every
non-CodePulse session. Full war stories: memory [[lessons-archive-2026-08-21]].
(Self-hosted operational rules are the section above; these are development-time traps.)

- **`convex deploy` ships the WORKING TREE, not HEAD**, and in a whole-directory deploy system
  deploying an earlier commit is a **rollback**, never a subset — "deploy only my change" is
  unreachable that way if anything newer is live. Run `git status --porcelain` before every
  deploy in this shared checkout and say what is dirty. The only announcement of a schema
  rollback is a `Deleted table indexes:` line in the deploy output; a "surgical" older-tree
  deploy silently deleted 3 live indexes on another session's active phase.
- **`npx convex function-spec` lists PUBLIC functions only**, so a zero hit for an
  `internal.*` function is guaranteed regardless of deploy state and is not evidence of
  anything. A control that returns a non-zero public count proves only that the probe sees
  public functions — the one thing never in doubt. Read schema/index state or query the table.
- **The read budget is 4,096 READS, not the 16,000 documents-written figure in the docs.**
  `ctx.db.delete()` counts as a read, and a query issued after N inserts *in the same mutation*
  must merge that transaction's pending write set at ~N reads. When caps of 4000/2000/1000/500
  all fail identically, the cap is not the cause — build a control that holds the suspect fixed
  and varies one other input.
- **Convex REDACTS plain `Error` messages to "Server Error" client-side.** Use
  `throw new ConvexError(...)` whenever the client must see the reason (its `.data` survives
  redaction), and read `err.data` before `err.message`. In an auth-disabled harness a generic
  error is usually the AUTH GATE throwing before the feature code ever runs — confirm the code
  path is reached before attributing a UI symptom to the feature under test.
- **A Convex query that throws is unhandled at the `useQuery` boundary**: it unmounts the React
  tree and blanks EVERY page using that hook, so it presents as "the whole app is broken", not
  "one widget is empty". On a timeout, probe each read in isolation — the cost was a bounded
  `.take(500)` descending index scan, not the unbounded `.collect()`s that looked guilty.
- **An index cannot speed an UNFILTERED count** (`.collect()` purely for `.length`): with no
  filter every row is read regardless, so a new index adds write cost and fixes nothing. Say so
  when asked to add one; bound the read instead.
- **Telemetry timestamps are epoch SECONDS.** Dividing by 1000 yields 1970 dates, and a
  `fmt(max) < '<date>'` cutoff then passes VACUOUSLY. Any threshold check must print a sanity
  line comparing the formatted value against today's date.
- **Never regex-scrape `getComputedStyle` for colour.** Tailwind v4 emits `oklch()`/`oklab()`,
  so a number-scrape reads the HUE ANGLE as a channel and every derived contrast ratio is
  plausible garbage (the tell was an impossible `rgb(0,0,262)`). Rasterise instead
  (`canvas.fillRect` + `getImageData`); `fillStyle` silently keeps its prior value on
  unparseable input, so use a sentinel and return `null` rather than a guess. Pair every colour
  claim with a before/after control measuring the pre-change class strings from git — on Phase
  120 that control INVERTED the conclusion. → [[tailwind-v4-oklch-defeats-css-color-scraping]]
- **`fs.Stats.ino` is a JS double and Windows NTFS FileIds exceed `MAX_SAFE_INTEGER`** (measured
  99.9% of sampled directories), so identity keys built from a plain `statSync` collapse and a
  visited-set cycle guard prunes real subtrees — it surfaced only as a test failing ~0.4% of the
  time under load. Use `statSync(p, {bigint: true})` for IDENTITY (leave `size`/`mtime`
  numeric), and make any injected or wrapped `statSync` forward its options argument.
- **A hook wired at both user and project scope runs TWICE per event**, which for a telemetry
  producer is silent double-ingest — 27% duplicate rows in `events` and 41% in `toolExecutions`
  for 8 weeks, with the singly-wired PreToolUse at 0% as the control that isolated it. A
  consumer-side dedup field that no producer populates is dead code, and any key derived from
  pid/hrtime/`Date.now()` differs between the two processes and defeats dedup while looking
  correct. → [[codepulse-duplicate-hook-wiring-double-ingest]]
- **Long-uptime Vite drifts to ~124% of a core**; an hourly recycle is the mitigation. Any
  process-kill guard here needs more than one loose regex — `codepulse.*vite` matches the
  watcher script's own filename. → [[codepulse-vite-long-uptime-cpu-drift]]

- **A `grep -c` acceptance criterion over a whole TS file counts COMMENTS, and the GSD planner's
  own hygiene rule does not save you**: `grep -v '^#'` strips `#` comments and is a SILENT NO-OP on
  TypeScript (measured on `convex/inbox.ts`: raw `ackedAt` 25 hits, after the filter 25 hits, 671
  lines in / 671 out). Use `grep -vE '^\s*(//|/\*|\*)'` for C-family files. Better, don't count
  strings at all — an exact/zero-count criterion is satisfiable by REWORDING A COMMENT, and in
  Phase 127 three separate executors each did exactly that to turn a criterion green without the
  code changing. Assert on the construct: the write form (`fieldName:` in an object literal), the
  call site, or a test that fails when the behaviour is removed. Any count needs a paired CONTROL
  count that must be NON-zero, so a filter matching nothing is caught. (The upstream fix lives in
  `~/.claude/agents/gsd-planner.md`, but `gsd update` reinstalls that from npm — this copy is the
  durable one.)

- **Convex `.filter()` runs AFTER the read — it does NOT bound an index scan.**
  `withIndex("by_x")` with no range callback plus `.filter(q => q.gte(...))` reads the WHOLE
  table and discards rows in JS. Found live in `automation.cronSummary` 2026-08-26: 20 rows
  were actually needed in the window while an unbounded probe over the same table died with
  `SystemTimeoutError: too many system operations`. That was `/automation`'s ~9s cold resolve,
  which Phase 126 had recorded as "mechanism explicitly NOT established". Push the bound INTO
  the index: `withIndex("by_x", q => q.gte("x", cutoff))`. Same shape still open at
  `convex/briefings.ts:181-190` (harmless at 40 rows, no plain `detectedAt` index).
- **A bounded-read guard must assert on the RECORDED QUERY, never on the returned rows.** A
  surviving `.collect()` returns identical results on a small fixture, so results cannot
  discriminate — only the recorded limit can. See `alertsCountBounded.test.ts`,
  `bifrostListBounded.test.ts`, `automationCronSummaryBounded.test.ts`. Mutation-proof it: the
  right shape is SOME tests going red while the behavioural ones stay green.
- **`npm test` must run the `unit` and `browser` vitest projects SEQUENTIALLY.** Running them
  concurrently destabilises the jsdom workers: measured at one commit in one worktree,
  `--project unit` passed 10/10 while both-together failed on iteration 1. It surfaces as two
  unrelated-looking symptoms — an `App.test.tsx` lazy-route stall on the main tree, and an
  `AvatarAura.browser` "Failed to fetch dynamically imported module" inside worktrees — and
  neither occurs without the browser project. CI's second step must be `--project unit`, not a
  bare `vitest run` (which re-runs browser a second time AND concurrently).
- **A milestone close moves `.planning/phases/<slug>` to `.planning/milestones/vX.Y-phases/`,
  which breaks any test hardcoding the old path.** `tokenSweep.ratchet.test.ts` went red for a
  reason unrelated to tokens, and it escaped because the close was tagged and pushed from a
  green run taken BEFORE the close commit. Re-run the suite AFTER a close, and resolve phase
  dirs across both the active and archived locations rather than repointing the literal.
- **`--chart-bar` is the base-series NEUTRAL, not an accent.** In the cyan theme it resolves to
  `#1e1e24` — byte-identical to `--muted` — so painting a bar fill or sparkline stroke with it
  renders the mark invisible against its own track. That shipped once, with 21 green unit tests,
  because **jsdom does not resolve CSS custom properties**, so no unit test here can ever catch a
  token-choice error. Use `--chart-bar-accent` for visible marks (`TokenUsageChart.tsx:123-129`
  uses the two correctly as a base/accent pair) and verify colour by rasterising the real page.

- **`PrivacyContext.enabled` and `.level` are INDEPENDENT.** `setLevel` (`PrivacyContext.tsx:59-66`)
  writes only `level` and never touches `enabled`, so a user who picks Demo or Screenshot from the
  default off state still has `enabled === false`. Gate masking on `enabled || level !== "off"` —
  `usePrivacyMask` exposes that as `masking`. Gating on `enabled` alone made screenshot mode redact
  NOTHING app-wide. The CSS half is separate and equally easy to miss: `.privacy-demo`/
  `.privacy-screenshot` (`index.css:649-661`) only reach elements carrying `data-sensitive`, and
  `dataSensitiveCoverage.ratchet.test.ts` keeps that count from silently dropping.

- **A new `convex/` module breaks `tsc` until `_generated/api.d.ts` is regenerated.** `crons.ts`
  referencing `internal.myModule.fn` fails with "Property 'myModule' does not exist" until
  `npx convex codegen` runs — it is local-only ("does not modify the code running on the
  deployment") and takes NO `--env-file`, unlike `run`/`deploy`. Also: `convex run --inline-query`
  is sandboxed READ-ONLY, so a live probe cannot write a fixture row — proving a write path in
  production means deploying throwaway code, which is usually not worth it. Say so rather than
  implying end-to-end proof.

- **Requirement status decays and nobody re-derives it.** At v15.0's close, 8 requirements read
  `Pending` on phases already marked Complete, 3 of 4 `Partial` cells were stale notes
  describing work that had landed, and 6 of 9 carried-forward v14.0 items were wrong (4 already
  done, 2 describing blockers since solved). Every one was resolved by reading the CODE, so the
  information was always available. **Close requirements at PHASE close, against the code** —
  and treat any carried-forward list as suspect until re-derived.
## Dead Surface

Do not add a Convex export in one commit and its caller in a later one. An
export with no call site is not "ready for the UI" -- it is code that ships,
type-checks, deploys, and is never run. A 2026-08-28 audit found **86 of 543
public exports had no caller anywhere**, including four ways to slice
`credentialAudit` with no screen to show any of them, and three quarters of a
CRUD set on `wizardDrafts` where only `save` was ever used.

The rule is one line: **a new query/mutation lands in the same commit as the
code that calls it, or it does not land.**

Enforced, not just written down:

```
npm run check:dead-surface          # ratchet; fails on any NEW uncalled export
npm run check:dead-surface:list     # show every uncalled export
npm run check:dead-surface:update   # record a deliberate keep
npm run hooks:install               # (re)install the pre-commit hook
```

The pre-commit hook runs it whenever a commit touches `convex/`.
`scripts/dead-surface-baseline.json` holds the exports we know are uncalled --
that file is the outstanding-debt list, not a permission slip. It currently
carries 40 entries: 22 mutations and 18 `internal*` functions, several of which
are genuine hand-run admin one-shots (`seedTeams:seed`,
`registry:repairSkillsFromOverrides`, `skillCategories:migrateDisplayNames`).
Adding a name to it is a decision you should be able to defend.

The ratchet recognises four invocation forms, each of which was observed in this
repo: `api.mod.fn`, `internal.mod.fn`, `convex run mod:fn` in docs and scripts,
and `import * as mod from "../mod"` followed by `mod.fn` in tests. A grep for
only the first form under-counts callers and will delete live code -- that
mistake was made during the audit and `tsc` caught it.

## graphify

This project has a knowledge graph at graphify-out/.

Rules:
- If graphify-out/wiki/index.md exists, start there — read community and god node articles for cheap navigable context before grepping raw files.
- For architecture and codebase questions, use `graphify query "<question>" --budget 2000` — this traverses the graph and caps output at ~2000 tokens. Do NOT read GRAPH_REPORT.md directly (it can be 300KB+).
- For cross-module relationships, prefer `graphify path "<A>" "<B>"` or `graphify explain "<concept>"` over grep — these traverse EXTRACTED + INFERRED edges.
- Only read GRAPH_REPORT.md if you specifically need the full community overview and the user asks for it.
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost).
