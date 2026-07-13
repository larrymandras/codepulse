# Phase 96: UI deep-dive cleanup — IA restructure, command palette drift, fake telemetry, and consistency fixes - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix everything the 2026-07-12 full-surface UI audit found (F1–F10 in `FINDINGS.md`): restructure the nav IA (dissolve CONSOLE), fix CommandPalette drift, remove/wire fake telemetry and hardcoded trust signals, delete orphaned pages, unify the divergent approval flows, standardize page headers, fix mobile master-detail breakage, and clean up duplication/dead UI and token/a11y minors.

**FINDINGS.md is the input contract** — each numbered finding must map to plan tasks; none may be silently dropped. Its "Explicitly out of scope / dropped" section is binding (canvas-context hex stays, EXCEPT the DOM `bg-[#09090b]` backgrounds which may ride along with F10).

No new capabilities: this is a cleanup/consistency phase over existing surfaces.

</domain>

<decisions>
## Implementation Decisions

### F1 — Mission Control vs Tasks
- **D-01:** Merge Mission Control and Tasks into ONE board: `/tasks` survives with a view toggle (by-status Kanban = default view; Mission Control's per-agent axis = the second view).
- **D-02:** `/mission-control` becomes a redirect to `/tasks?view=agent` so existing links keep working; the MissionControl page component is removed after the merge.
- **D-03:** Rest of F1 exactly per FINDINGS target state: Forge → COMMAND, Live Run keeps the COMMAND entry (CONSOLE duplicate deleted), Executions → OBSERVE, Build → OBSERVE, CONSOLE cluster removed from `navGroups`.

### F3 + F4 — Fake telemetry & hardcoded trust signals
- **D-04:** Header `SYS:`/`LAT:` literals are wired to REAL data (`systemResources` via Convex). When no recent data exists, hide the readout — never show a stale or fabricated number.
- **D-05:** Security page: REMOVE the hardcoded "Valid" Audit Chain integrity badge (no fake trust signal). Keep the entry count but label it honestly as loaded events, not a chain-integrity metric. Real integrity verification is deferred (see Deferred Ideas).
- **D-06:** Automation page: keep the static `CRON_SCHEDULES` catalog but present it as "configured schedules" — drop all fake `enabled: true` live indicators and the hardcoded `totalJobs ?? 12` fallback. Live cron state is deferred (needs Ástríðr-side emission).
- **D-07:** Remove BOTH empty Network Policy / Provider Allowlist placeholders (`Infrastructure.tsx` and `Security.tsx`). A real allowlist feature is deferred.

### F5 + F9 — Orphans, duplication, dead UI
- **D-08:** Delete `Profiles.tsx` and `Agents.tsx` outright (plus their imports in `App.tsx`); no tab salvage — git history preserves the code if ever wanted.
- **D-09:** Extract a shared FactsTable component consumed by BOTH Memory ("Durable Facts") and Dreaming ("Facts") — both surfaces stay, duplicated code dies.
- **D-10:** Dead-UI policy: remove dead/zero-value UI (`TokenSavingsIndicator` with hardcoded zeros, `void errorTrend`, unused imports/vars, permanently-disabled "Import Conversations" and "Start Backfill" stubs — the stubs are removed, not kept as hints). Wire the two cheap live fixes: MeetingBot reads the live roster via `useRosterAgents` instead of 6 hardcoded names; Skills create-modal `onDelete` no-op gets a real handler or the affordance is dropped.

### F6 — Approval flow unification
- **D-11:** Full closure this phase: verify the approval payload contract against the Ástríðr WS handler (repo at `C:\Users\mandr\astridr-repo`), fix whichever sender (Chat `{requestId, approved}` vs Inbox `{request_id_target, decision}`) is wrong, THEN extract one shared approval component used by both Chat and Inbox. Cross-repo verification is a prerequisite task before any unification code.

### Claude's Discretion
- **F2** — CommandPalette fix approach per FINDINGS: import `navItems` from `DashboardLayout` instead of the hardcoded `NAV_PAGES`; update stale entity-group deep links (`/agents`, `/profiles` in CommandPalette + HeroStatsBar).
- **F7** — `<PageHeader>` component API/shape and migration order across all 35 pages; nominal standard is `text-2xl font-bold text-foreground`. Removing the anomalous `max-h-[500px]` caps on Chat/LiveRun/Inbox/Tasks.
- **F8** — Mobile collapse pattern for ForgePage/WarRoom fixed-width panes (stacked vs toggleable master) — pick what fits each page.
- **F10** — Token/a11y minors as listed; whether the DOM `bg-[#09090b]` canvas backgrounds ride along (FINDINGS permits it).
- Ordering/wave structure of the work.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase input contract
- `.planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/FINDINGS.md` — the full audit (F1–F10) with file:line evidence at commit f0d9d5a; every finding maps to plan tasks; its out-of-scope section is binding.

### Design system & project rules
- `CLAUDE.md` (repo root) — token-driven theming rules (never hardcode hex; `--primary`/`--status-*`/`--glow-*`/`--chart-*`), shadcn/ui New York primitives in `src/components/ui/`, Lucide-only icons, page/nav/Convex patterns.
- `src/index.css` — theme token definitions (`[data-theme]` blocks) all new/updated UI must read from.

### Cross-repo contract (F6)
- Ástríðr WS approval handler — in `C:\Users\mandr\astridr-repo` (locate the `approval.respond` handler; verify expected payload shape before unifying Chat/Inbox senders).

</canonical_refs>

<code_context>
## Existing Code Insights

(FINDINGS.md is itself a fresh full-surface code audit; key assets below.)

### Reusable Assets
- `DashboardLayout.tsx:795` exports `navItems` specifically for CommandPalette consumption (F2 fix is an import swap).
- `useRosterAgents` hook — live agent roster for the MeetingBot fix (D-10).
- `systemResources` Convex table (runtime ingest) — data source for the real header telemetry (D-04).
- `useThemeColors()` / CSS vars — required for any color work (F10).
- shadcn/ui primitives in `src/components/ui/` — compose, don't hand-roll (PageHeader, FactsTable, shared approval component).

### Established Patterns
- Token-driven theming, zinc neutrals, Geist + JetBrains Mono, `text-2xl font-bold text-foreground` page-header standard (only 4/35 pages currently comply).
- `SectionErrorBoundary` wraps widget groups; MetricCard-grid archetype on observe pages.
- Redirect pattern already exists in `App.tsx` (`/profiles`, `/agents` → `/hr/roster`) — reuse for `/mission-control` → `/tasks?view=agent`.

### Integration Points
- `src/layouts/DashboardLayout.tsx` — navGroups (F1), header telemetry (F3), navItems export (F2).
- `src/components/CommandPalette.tsx` + `src/components/HeroStatsBar.tsx` — stale links (F2).
- `src/App.tsx` — routes/redirects, orphan imports (F5), Suspense fallback token (F10).
- `src/pages/Tasks.tsx` + `src/pages/MissionControl.tsx` — merge target (D-01/D-02).
- `src/pages/Chat.tsx` + `src/pages/Inbox.tsx` — approval senders (F6).
- Untyped Convex access (`anyApi`/`as any`) in Tasks, BuildProgress, MissionControl — F10 cleanup touches the merge surface; type it while merging.

</code_context>

<specifics>
## Specific Ideas

- Honesty-first telemetry rule from discussion: **never render a fabricated number styled as live data** — wire it or remove it; hide readouts when data is stale/absent (applies to D-04/D-05/D-06 and generalizes to any similar case found during execution).
- The merged Tasks board keeps both mental models: Kanban-by-status (default) and Mission Control's per-agent view as a toggle, deep-linkable via `?view=agent`.

</specifics>

<deferred>
## Deferred Ideas

- **Live cron state telemetry** — Ástríðr-side cron-status emission → Convex → Automation page shows real enabled/last-run state (D-06 replaces fake indicators with an honest static label until then).
- **Real Provider Allowlist / Network Policy feature** — both empty placeholders removed (D-07); build it if/when a real allowlist exists.
- **Real audit-chain integrity verification** — Convex-side verification job rendering a genuine Valid/Invalid state (D-05 removes the fake badge until then).

</deferred>

---

*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Context gathered: 2026-07-13*
