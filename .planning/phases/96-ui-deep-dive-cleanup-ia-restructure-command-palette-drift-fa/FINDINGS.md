# Phase 96 — UI Deep-Dive Findings (audit 2026-07-12)

Source: full-surface UI audit (all 35 pages, nav architecture, cross-cutting consistency).
Every finding carries file:line evidence verified against the live tree at commit f0d9d5a.
This file is the input contract for discuss/plan — each numbered finding should map to
plan tasks; none should be silently dropped.

---

## F1 — IA restructure: dissolve the CONSOLE cluster (HIGH)

The COMMAND/CONSOLE boundary does not hold against what the pages actually do.
Forge is the most action-heavy page in the app (launch + stop remote jobs) yet sits in
CONSOLE; Live Run is listed in BOTH clusters (`src/layouts/DashboardLayout.tsx:145` and `:156`
— same `/live-run` route, two nav entries).

Target state:

- **Forge → COMMAND** (it's a command surface: ForgeLaunchModal, stop, Clerk-gated launch).
- **Live Run** — keep the COMMAND entry, delete the CONSOLE duplicate.
- **Executions → OBSERVE** — fully read-only (filter + load-more only; `src/pages/Executions.tsx`).
- **Build → OBSERVE** — zero action affordances; same MetricCard-grid archetype as Analytics/Infrastructure (`src/pages/BuildProgress.tsx`).
- **CONSOLE cluster removed** from `navGroups` (`src/layouts/DashboardLayout.tsx:153-161`).
- **Mission Control** sits in OBSERVE (`:195`) but is a mutation-heavy drag-drop board
  overlapping Tasks (same task data; per-agent vs per-status axis). Decide: move next to
  Tasks in COMMAND, or merge Tasks + Mission Control into one board with a view toggle.

## F2 — CommandPalette nav drift: ~15 pages unreachable via ⌘K (HIGH)

`src/components/CommandPalette.tsx:52-80` hardcodes its own `NAV_PAGES` array
("kept in sync manually") instead of importing the `navItems` export that
`DashboardLayout.tsx:795` exposes for exactly this purpose. Drifted omissions:
`/forge`, `/hive`, `/skills`, `/quality`, `/doc-comments`, `/channels/whatsapp`,
`/graphs`, `/tool-galaxy`, `/mcp-inventory`, `/knowledge-graph`, and all five `/hr/*` pages.
Also stale deep links to redirected routes: `CommandPalette.tsx:59-60,140` (`/agents`,
`/profiles`) and `src/components/HeroStatsBar.tsx:54` (`/profiles`).
Fix: replace `NAV_PAGES` with the imported `navItems`; update stale entity-group links.

## F3 — Fake telemetry in the layout header (HIGH)

`src/layouts/DashboardLayout.tsx:712,716` render static literals `SYS: 14%` and
`LAT: 12ms` styled as live data (`text-primary font-bold`) under the
"Astridr Runtime Telemetry" banner (`:705`). Wire to real data (`systemResources` /
Convex) or remove. These are the only fake live-metrics in the layout shell.

## F4 — Hardcoded trust signals on Security & Automation (HIGH)

- `src/pages/Security.tsx:223` — Audit Chain integrity hardcoded to "Valid";
  `:227` uses `mergedEvents.length` as "Entry count" (misleading proxy).
- `src/pages/Automation.tsx:34-40` — cron job list built from static `CRON_SCHEDULES`
  via `schedulesToCronJobs()`, all `enabled: true` hardcoded; `:89` summary falls back
  to hardcoded `totalJobs ?? 12`. Page does not reflect live cron state.
- Network Policy placeholder duplicated: `src/pages/Infrastructure.tsx:259-263` and
  `src/pages/Security.tsx:425-444` (empty Provider Allowlist table).

## F5 — Orphaned pages: Profiles.tsx + Agents.tsx (~900 lines dead) (MEDIUM)

`src/App.tsx:11,24` still import them, but routes `/profiles` and `/agents`
(`App.tsx:99-100`) redirect to `/hr/roster`; neither component ever renders.
Delete both (and their imports), or explicitly salvage wanted tabs (Agents.tsx has
DnD registry/runtime/topology/security tabs) into HR pages first.

## F6 — Two divergent approval flows: Chat vs Inbox (MEDIUM, needs cross-repo verify)

Chat inline approvals send `approval.respond` with `{requestId, approved}`
(`src/pages/Chat.tsx`); Inbox sends `{request_id_target, decision}`
(`src/pages/Inbox.tsx`). One shape is likely silently wrong — verify against the
Ástríðr WS handler contract before unifying; then share one approval component.

## F7 — Page header standardization + panel-height caps (MEDIUM)

Only 4/35 pages match the nominal `text-2xl font-bold text-foreground` standard
(`BuildProgress.tsx:24`, `Analytics.tsx:86`, `ForgePage.tsx:145`, `Agents.tsx:314` — dead).
In the wild: `text-2xl` w/o color (16 pages), `font-semibold` (Executions:108, Ideation:119),
`text-xl` (Dreaming:76, MeetingBot:132, MissionControl:161, WhatsApp:290, WarRoom:252,
LiveRun:206, Inbox:363, hr/* uppercase-mono variants), `text-lg` (ConfigPage:259, Tasks:101),
`text-base` (Chat:330, InsightsChat:76), terminal-style micro-headers (HivePage:49,
GraphsHub:150, Skills:167), and **no h1 at all** (DocComments.tsx).
Fix: shared `<PageHeader>` component; migrate all pages.
Related: Chat/LiveRun/Inbox/Tasks share an anomalous `max-h-[500px]` wrapper capping them
at panel height inside a full page (promoted widgets) — remove the caps.

## F8 — Mobile: fixed-width master-detail panes break (MEDIUM)

- `src/pages/ForgePage.tsx:150` — `w-[280px] shrink-0` list pane, no responsive collapse.
- `src/pages/WarRoom.tsx:270` — `w-64 flex-shrink-0` sidebar, no `sm:`/`md:` handling.
On a 320px viewport the detail pane gets ~40px. Add breakpoint collapse (stacked or
toggleable master).

## F9 — Duplication & dead UI (MEDIUM)

- Memory "Durable Facts" tab duplicates Dreaming "Facts" tab (same
  `api.dreaming.recentFacts`, near-identical table/filter code) — extract shared component
  or keep one surface.
- `LlmProviderPanel` rendered on 4 surfaces, twice on Analytics alone
  (`src/pages/Analytics.tsx:384` + earlier ref).
- Dead UI: `Analytics.tsx:88` `TokenSavingsIndicator savedTokens={0} totalTokens={0}`;
  `Analytics.tsx:81` `void errorTrend` (fetched then discarded);
  `Memory.tsx:796` "Import Conversations" permanently disabled;
  `Dreaming.tsx:345-352` "Start Backfill" disabled stub; `Dreaming.tsx:20` unused
  `AnimatedNumber` import; `Infrastructure.tsx:53-54` unused `_lastDockerStatus`/`_lastMcpStatus`.
- `src/pages/MeetingBot.tsx:157-162` hardcodes 6 agent names instead of reading the live
  roster (`useRosterAgents`).
- `src/pages/Skills.tsx` `onDelete={() => {}}` no-op on create modal.

## F10 — Token & a11y minors (LOW)

- `src/App.tsx:93` — Analytics Suspense fallback uses `text-gray-500`; every other
  fallback uses `text-muted-foreground`.
- `src/pages/DocComments.tsx:73-74` — raw `zinc-*`/`emerald-*` colors off the token system;
  also hardcodes `author: "larry"` and `doc_type: "gsd_spec"`.
- `src/components/ThemeSwitcher.tsx:43` — SelectTrigger missing `aria-label`
  (only header control without an accessible name).
- Untyped Convex access (`anyApi` / `as any`) in Tasks, BuildProgress, MissionControl.

## Explicitly out of scope / dropped

- Canvas-context hex colors in KnowledgeGraph/ToolGalaxy (`ctx.fillStyle` can't read
  Tailwind classes; could read CSS vars via `getComputedStyle` but low value) — EXCEPT the
  DOM `bg-[#09090b]` backgrounds (`KnowledgeGraph.tsx:915`, `ToolGalaxy.tsx:321`) which
  have no such excuse and may ride along with F10.
- Single-file style nits with no behavior impact.
