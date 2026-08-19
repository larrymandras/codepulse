# 122-14 State Honesty Ledger

## Population re-derivation (Task 1)

Scoped to this plan's `files_modified` list (24 files), re-measured against the corpus rather
than quoted from 122-13-SUMMARY.md:

```
git grep -lE '<MetricCard' -- 'src/*.tsx' | grep -v '\.test\.'   -> 24 FILES
git grep -oE '<MetricCard' -- 'src/**/*.tsx' | grep -v '\.test\.' | wc -l -> 84 OCCURRENCES
```

Per-file occurrence counts (`git grep -oE '<MetricCard' -- <file> | wc -l`), summed = 84, matching
the corpus-wide occurrence count above (control: population re-derivation is internally
consistent):

| File | Occurrences |
|---|---|
| src/components/CallStatsBar.tsx | 4 |
| src/components/HeroStatsBar.tsx | 2 |
| src/components/ToolUsagePanel.tsx | 4 |
| src/components/TraceWaterfall.tsx | 4 |
| src/components/analytics/ApiSpendCard.tsx | 1 |
| src/components/analytics/CacheHitRateCard.tsx | 1 |
| src/components/analytics/LlmVolumeCards.tsx | 2 |
| src/components/analytics/TotalEventsCard.tsx | 1 |
| src/components/blocks/MetricBlock.tsx | 1 |
| src/components/hr/analytics/TeamSummaryCards.tsx | 4 |
| src/components/kg/KGSummaryCards.tsx | 5 |
| src/pages/Alerts.tsx | 4 |
| src/pages/Automation.tsx | 4 |
| src/pages/BuildProgress.tsx | 3 |
| src/pages/Capabilities.tsx | 8 |
| src/pages/Dreaming.tsx | 3 |
| src/pages/GraphsHub.tsx | 6 |
| src/pages/Ideation.tsx | 1 |
| src/pages/McpInventory.tsx | 6 |
| src/pages/Memory.tsx | 2 |
| src/pages/Quality.tsx | 4 |
| src/pages/SelfHealing.tsx | 4 |
| src/pages/SessionDetail.tsx | 4 |
| src/pages/ToolGalaxy.tsx | 6 |
| **Total** | **84** |

Note: `src/pages/Ideation.tsx` shows 1 JSX literal occurrence (`<MetricCard` appears once inside a
`.map()` over 4 severity keys) — the occurrence count is a count of source-code JSX literals, not
runtime instances, consistent with 122-13-SUMMARY.md's own unit and with this plan's counting
discipline. The `state` prop on that one literal covers all 4 rendered instances at runtime.

**D-13's "36 files" reconciled:** matches none of the populations measured here (24 render-files /
84 occurrences), consistent with 122-13-SUMMARY.md's finding that 36 matches none of five
populations it measured either (32 mention / 24 render / 84 occurrences / 40 mention-incl-test / 26
or 28 import-only). Not re-litigated here; 122-14's own `files_modified` list (24 files) already
matches the render population exactly, so nothing downstream depends on reconciling "36".

**Control (plan's specified check):** `git grep -cE '<MetricCard' -- src/components/analytics/ApiSpendCard.tsx` = 1 (non-zero, known-positive) — confirms the matcher works before any zero elsewhere in this ledger is trusted.

---

## Per-site ledger

Columns: **File / Label** — the render site. **Value source** — the query or prop feeding the
card. **staleAfter?** — whether a real `updatedAt` exists to measure staleness against (rare in
this corpus; most sources have no per-row update timestamp). **State (target)** — the state this
site will declare and why. **AFTER** — filled by Tasks 2/3 once migrated.

### src/components/CallStatsBar.tsx (4 sites)

Props-only component; no Convex query of its own. All four cards are rendered from `MeetingBot.tsx`
only after `selectedCall` is truthy — `selectedCall` is derived by `.find()` over
`[...activeCalls, ...recentCalls]`, both of which are `useQuery(...) ?? []` results already
resolved by the time a row can be found and selected. A row cannot be "selected" before the
underlying query has data, so by construction every render of `CallStatsBar` reflects a real,
already-loaded row.

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Duration | `durationMs` prop (from `selectedCall.durationMs`) | no timestamp on the row | `ready` — caller (`MeetingBot.tsx`) only renders this component once its backing row is resolved | ready |
| Participants | `participantCount` prop | no | `ready` — same justification | ready |
| Words | `wordCount` prop (derived client-side from transcript chunks) | no | `ready` — same justification | ready |
| Cost | `costUsd` prop | no | `ready` — same justification | ready |

### src/components/HeroStatsBar.tsx (2 JSX sites / 8 rendered kpis)

Two `.map()` literals over an 8-item `kpis` array; each kpi needs its own state since the array
blends four different data sources.

| Kpi | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Sessions | `useHeroStats()` (wraps `api.heroStats.summary`, defaults to zeros while loading) | no | `loading`/`ready` — `useHeroStats()`'s own default collapses loading into a zeroed shape, so a raw duplicate `useQuery(api.heroStats.summary, {})` is read directly (same function+args, same Convex subscription) purely to recover the loading signal; state = `loading` while that raw value is `undefined`, else `ready` (the resolved object always has non-zero keys) | migrated |
| Error Rate | same raw `heroStats` query | no | same as Sessions | migrated |
| Alerts | same raw `heroStats` query | no | same as Sessions | migrated |
| Security | same raw `heroStats` query | no | same as Sessions | migrated |
| Memory Hit Rate | `useQuery(api.memoryPreflight.stats)` (`preflightStats`, already raw/undefined-while-loading) | no | `loading`/`ready` via `useMetricState(preflightStats, ...)` — `convex/memoryPreflight.ts:stats` always returns `{hitRate, avgLatencyMs, totalRecords}` with `hitRate: 0` (not undefined) when zero records exist, so the object is never "empty" by `isEmptyValue`; the em-dash fallback in the pre-migration code only ever fired during genuine loading | migrated |
| Durable Facts | `useQuery(api.dreaming.recentFacts, {limit:100})` (`durableFacts`, raw array) | no | `loading`/`empty`/`ready` via `useMetricState(durableFacts, ...)` — an empty array is real "no durable facts recorded", matching D-20's empty semantics | migrated |
| Advisor Savings | `useQuery(api.advisorEvents.savingsSummary)` (`advisorSavings`, raw) | no | `loading`/`ready` via `useMetricState(advisorSavings, ...)` — `convex/advisorEvents.ts:savingsSummary` always returns `totalSavings: 0` (not undefined) with zero events, same reasoning as Memory Hit Rate | migrated |
| Startup Time | hardcoded `"—"`, `numericValue: undefined` | no | `unavailable` — **justification:** no query anywhere in this file (or anywhere in the codebase, per `graphify query "startup time"` / grep for a startup-latency table) computes this metric; the em-dash and `undefined` were the pre-migration fabrication this plan exists to remove | migrated |

`HeroStatsBar.tsx`'s synthetic "System Load" `AnimatedNumber` (~line 141) is explicitly out of
scope (SIGNAL-02, Phase 125) and is not a `MetricCard` occurrence — not listed here.

### src/components/ToolUsagePanel.tsx (4 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Tool Calls | `useToolUsageByTool(source, windowHours)` (`byTool.totals.calls`; hook defaults to an honest-empty zero shape while loading, per its own docstring) | no | `loading`/`ready` via a raw duplicate `useQuery(api.toolAnalytics.usageByTool, {source, windowHours})` for the loading signal; once resolved the whole result object is non-empty (has `rows`/`totals`/`sources` keys) so it is always `ready`, even at zero calls (a real, informative zero) | migrated |
| Failures | same raw `byTool` query | no | same as Tool Calls | migrated |
| Success Rate | same raw `byTool` query | no | same as Tool Calls (the `null` → "n/a" text inside `formatSuccessRate` is preserved — a real "not applicable" value, not a fabricated number) | migrated |
| Distinct Tools | same raw `byTool` query | no | same as Tool Calls | migrated |

### src/components/TraceWaterfall.tsx (4 sites)

All four sit after two early returns: `if (rows === undefined) return null;` (loading) and
`if (rows.length === 0) return <...No LLM calls yet.../>` (empty). By the time any `MetricCard`
in the summary strip renders, `rows` is guaranteed defined and non-empty.

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Total Cost | `summary.totalCost` (derived from `rows`) | no | `ready` — gated by the two early returns above | ready |
| Call Count | `rows.length` | no | `ready` — same gate | ready |
| Total Tokens | `summary.totalTokens` | no | `ready` — same gate | ready |
| Cache Read Ratio | `summary.cacheRatio` | no | `ready` — same gate | ready |

### src/components/analytics/ApiSpendCard.tsx (1 site)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| API Spend | `useQuery(api.costDerived.billedOverTime, {...})` (`apiSpendDerived`, raw) | no | `loading`/`ready` via `useMetricState(apiSpendDerived, ...)`; the existing `"--"` fallback (two hyphens, not the design-law em dash, but the same ad-hoc-placeholder class D-15 targets) is removed since the tile's own `loading` skeleton replaces it | migrated |

### src/components/analytics/CacheHitRateCard.tsx (1 site)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Cache Hit Rate (24h) | `useQuery(api.llm.cacheStats, {})` (`cacheStats`, raw) | no | `loading`/`ready` via `useMetricState(cacheStats, ...)`; same `"--"` removal as ApiSpendCard | migrated |

### src/components/analytics/LlmVolumeCards.tsx (2 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| LLM Calls | `useLlmMetrics()` (`usePaginatedQuery` wrapper exposing a real `status: "LoadingFirstPage"\|"CanLoadMore"\|"LoadingMore"\|"Exhausted"`) | no | `loading` while `status === "LoadingFirstPage"`, `empty` when resolved with 0 calls, else `ready` — `status` is a genuine, undefaulted signal, no duplicate query needed | migrated |
| Total Tokens | same `useLlmMetrics()` status + `llmCalls` | no | same as LLM Calls | migrated |

### src/components/analytics/TotalEventsCard.tsx (1 site)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Total Events | `useRecentEvents(100)` (exposes `status`) blended with `useQuery(api.aggregates.eventCountsByPeriod, {period:"daily"})` (`eventCounts`, currently defaulted `?? {}`) | no | **Corrected during implementation** (the Analytics.test.tsx fault-injection suite caught the original design): the rendered value is `totalAggregateEvents \|\| events.length` -- aggregates is the PRIMARY source, `events` is only a fallback consulted when the aggregate resolves to a falsy total. So `events`'s own loading state must not gate the card once the aggregate has already resolved a real (nonzero) total, or a resolved-nonzero aggregate would still show a skeleton while an unrelated fallback query was loading. `loading` = aggregates still `undefined`, OR (aggregate resolved to 0 AND `events` status is `"LoadingFirstPage"`); `empty` = both resolved sources are genuinely zero; else `ready` | migrated |

### src/components/blocks/MetricBlock.tsx (1 site)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| (generic — label from `block.label`) | `MetricBlockData` (LLM-generated generative-UI block, pushed once fully formed over the Ástríðr WebSocket; not a Convex query) | no | forwarded, not derived — `MetricBlockData` gains an optional `state?: MetricState` field the emitting agent MAY set; `MetricBlock` forwards it to `MetricCard` unchanged (D-14's "at every layer" rule: this wrapper never infers). When the field is absent, `MetricCard`'s own `state?: MetricState = "ready"` default applies — justified because a generative block that has arrived at all necessarily already carries a real, complete `value` (the WS message is the loading boundary, not this component) | migrated |

### src/components/hr/analytics/TeamSummaryCards.tsx (4 sites)

`rows: ScoredRow[]` prop; component returns `null` when `rows.length === 0` (`if (!stats) return
null;`), so all four cards render only once the caller has passed real, non-empty scored rows.

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Total Tasks | `stats.totalTasks` (derived from `rows` prop) | no | `ready` — gated by the `if (!stats) return null` guard above | ready |
| Avg Response Time | `stats.avgResponse` | no | `ready` — same gate (the `"-"` plain-hyphen fallback for `avgResponse === null` is a real "not applicable" value when no row in this range reports a response time, preserved as text, not fed as a state) | ready |
| Completion Rate | `stats.avgCompletion` | no | `ready` — same gate | ready |
| Total Cost | `stats.totalCost` | no | `ready` — same gate | ready |

### src/components/kg/KGSummaryCards.tsx (5 sites)

Gated by two early returns: `if (loading) return <...skeleton grid.../>` and
`if (!summary) return <...No KG summary telemetry yet.../>`. All five cards render only once
`summary` is a real, resolved object.

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Entities | `summary.totalEntities` | no | `ready` — gated above | ready |
| Current Triples | `summary.currentTripleCount` | no | `ready` — gated above | ready |
| Historical Triples | `summary.historicalTripleCount` | no | `ready` — gated above | ready |
| Contradictions | `summary.contradictionCount` | no | `ready` — gated above | ready |
| Last Extraction | `summary.lastExtractionAt` | no | `ready` — gated above | ready |

### src/pages/Alerts.tsx (4 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Critical | `useAlertCounts()` (`counts.critical`; defaults to `{info:0,warning:0,error:0,critical:0}` while loading) | no | `loading`/`ready` via a raw duplicate `useQuery(api.alerts.countBySeverity)` for the loading signal, shared across all 4 cards; resolved object always has 4 keys so it is never `empty` | migrated |
| Error | same raw `countsRaw` query | no | same as Critical | migrated |
| Warning | same raw `countsRaw` query | no | same as Critical | migrated |
| Info | same raw `countsRaw` query | no | same as Critical | migrated |

### src/pages/Automation.tsx (4 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Configured Schedules | `CRON_SCHEDULES.length` (static imported module constant, `lib/cronSchedules.ts`) | no | `ready` — **justification:** not a query at all; a static array resolved synchronously at import time, never loading, never empty in the Convex sense | migrated |
| Runs (1h) | `useAutomationSummary()` (`summary`, already raw/undefined-while-loading) | no | `loading`/`ready` via `useMetricState(summary, ...)` | migrated |
| Failed (1h) | same `summary` | no | same as Runs (1h) | migrated |
| Avg Duration | same `summary` | no | same as Runs (1h); existing em-dash `"—"` fallback removed (Task 3 requires zero em-dash hits in this file) | migrated |

### src/pages/BuildProgress.tsx (3 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Total Components | `useQuery(api.build.phaseProgress)` (`components`, currently `?? []`) | no | `loading`/`empty`/`ready` via a raw duplicate `useQuery(api.build.phaseProgress)`; empty array = genuinely zero tracked components (D-20 empty semantics) | migrated |
| Completed | same raw `components` query | no | same as Total Components (percentage derived from the same source) | migrated |
| Active Pipelines | `useQuery(api.pipelines.listActive)` (`activePipelines`, currently `?? []`) | no | `loading`/`empty`/`ready` via its own raw duplicate query | migrated |

### src/pages/Capabilities.tsx (8 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| MCP Servers | `useCapabilitySummary()` (`summary`, raw `api.registry.summary`) | no | `loading`/`ready` via `useMetricState(summary, ...)`, shared across the 5 `summary?.X ?? 0` cards | migrated |
| Plugins | same `summary` | no | same as MCP Servers | migrated |
| Skills | same `summary` | no | same as MCP Servers | migrated |
| Tools | same `summary` | no | same as MCP Servers | migrated |
| Hooks | same `summary` | no | same as MCP Servers | migrated |
| CLI Tools | `useCliTools()` (`?? []`) | no | `loading`/`empty`/`ready` via a raw duplicate `useQuery(api.registry.listCliTools)` | migrated |
| Slash Cmds | `useSlashCommands()` (`?? []`) | no | `loading`/`empty`/`ready` via a raw duplicate `useQuery(api.registry.listSlashCommands)` | migrated |
| Commands | `useCommandCatalog()` (`catalogStatus`: own `"loading"\|"ready"\|"error"` local state machine, WebSocket-fed) | no | `loading` while `catalogStatus === "loading"`, `error` while `catalogStatus === "error"`, else `empty`/`ready` on `catalogCommands.length` | migrated |

### src/pages/Dreaming.tsx (3 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Total Cost (USD) | `useQuery(api.dreaming.costSummary)` (`costData`, raw) | no | `loading`/`ready` via `useMetricState(costData, ...)`, shared across the 3 Cost-tab cards | migrated |
| Cycles Tracked | same `costData` | no | same as Total Cost (USD) | migrated |
| Cycles with Cost | same `costData` | no | same as Total Cost (USD) | migrated |

Non-`MetricCard` em-dash also converted per Task 3's explicit instruction: the per-cycle "Cost
(USD)" table cell (`cycle.costUsd != null ? ... : "—"`) becomes `"n/a"`, matching the house pattern
already used for the identical situation in `TraceWaterfall.tsx`'s `costLabel()`.

### src/pages/GraphsHub.tsx (6 sites, one per tile sub-component)

| Tile | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| TOOL GALAXY | `useToolGalaxySources()` (exposes `loading: boolean` directly) | no | `loading`/`ready` from the hook's own `loading` field | migrated |
| MCP INVENTORY | `useMcpHealthSources()` (exposes `loading: boolean` directly) | no | `loading`/`ready` from the hook's own `loading` field | migrated |
| KG EXPLORER | `useKgSummary()` (exposes `loading: boolean` and `summary: T \| null`) | no | `loading` while hook's `loading`; `empty` when resolved `summary === null` (matches `KGSummaryCards.tsx`'s identical "No KG summary telemetry yet" semantics off the same underlying query); else `ready` | migrated |
| CAPABILITIES | `useCapabilitySummary()` (`summary`, raw) | no | `loading`/`ready` via `useMetricState(summary, ...)` | migrated |
| 3D MEMORY GALAXY | `useQuery(api.memory.overview)` (`overview`, raw) | no | `loading`/`ready` via `useMetricState(overview, ...)` | migrated |
| HIVE / SWARM | `useGoalList()` (`?? []`) | no | `loading`/`empty`/`ready` via a raw duplicate `useQuery(api.swarmTasks.listGoals)` | migrated |

Each tile sits inside its own `SectionErrorBoundary` at the page level (D-12), so an `error` state
is never reachable from inside these tile components themselves — a thrown query is caught one
layer up, replacing the whole tile.

### src/pages/Ideation.tsx (1 JSX site / 4 rendered severities)

| Severity | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Critical/High/Medium/Low (one `.map()` literal) | `useQuery(api.ideation.findingStats)` (`stats`, raw) | no | `loading`/`ready` via `useMetricState(stats, ...)`, one state shared across all 4 rendered instances of the single JSX literal | migrated |

### src/pages/McpInventory.tsx (6 sites)

All six sit inside `McpInventoryBody()`, gated by `if (loading) return <...Loading MCP
inventory.../>` (from `useMcpHealthSources()`'s own `loading` field) before the summary grid.

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| MCP Servers | `stats.serverCount` | no | `ready` — gated above | ready |
| Connected | `stats.connectedServers` | no | `ready` — gated above | ready |
| Errored | `stats.erroredServers` | no | `ready` — gated above | ready |
| MCP Tools | `stats.mcpToolCount` | no | `ready` — gated above | ready |
| Unused Tools | `stats.unusedTools` | no | `ready` — gated above | ready |
| Pruned | `stats.disabledTools` | no | `ready` — gated above | ready |

### src/pages/Memory.tsx (2 sites)

Both sit inside the Preflight tab's ternary: `!preflightStats || (preflightStats.totalRecords ===
0 && (!preflightData || preflightData.length === 0)) ? <...No preflight data yet.../> : <>...cards
...</>`. By the time either card renders, real preflight data exists.

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Hit Rate | `preflightStats.hitRate` | no | `ready` — gated above | ready |
| Avg Latency (ms) | `preflightStats.avgLatencyMs` | no | `ready` — gated above | ready |

### src/pages/Quality.tsx (4 sites)

Gated by `!hasAnyData ? <...No quality data yet.../> : <>...4 cards...</>`, where `hasAnyData =
kpis.some(k => k.sparkline.length > 0)`.

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Personas Judged | `personasWithDataInRange` (derived from `useQualityKpis(rangeDays)`) | no | `ready` — gated above | ready |
| Sessions Judged (range) | `sessionsJudgedInRange` | no | `ready` — gated above | ready |
| Active Regressions | `activeRegressions` | no | `ready` — gated above | ready |
| Avg Overall Score | `avgOverall` | no | `ready` — gated above | ready |

### src/pages/SelfHealing.tsx (4 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Total Events | `useUptimeStats()` (`stats`, raw `api.selfHealing.uptimeStats`) blended with a local WS overlay count | no | `loading`/`ready` via `useMetricState(stats, ...)` (the WS overlay only adds to an already-resolved Convex count, never substitutes for it) | migrated |
| Resolved | same `stats` | no | same as Total Events | migrated |
| Failed | same `stats` | no | same as Total Events | migrated |
| Pending | same `stats` | no | same as Total Events | migrated |

### src/pages/SessionDetail.tsx (4 sites)

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Events | `useQuery(api.sessions.getById, ...)` (`session`, raw — `undefined` while loading, `null` if the id doesn't resolve to a row, per `.first()`) | no | `loading`/`empty`/`ready` via `useMetricState(session, ...)` — a `null` session (bad/stale id) is a genuine `empty` per the hook's own `isEmptyValue(null) === true` | migrated |
| Tools Used | `useQuery(api.events.listBySession, ...)` (`events`, currently `?? []`) | no | `loading`/`empty`/`ready` via a raw duplicate of the same query, shared across the 3 events-derived cards | migrated |
| Errors | same raw `events` query | no | same as Tools Used | migrated |
| Files Touched | same raw `events` query | no | same as Tools Used | migrated |

### src/pages/ToolGalaxy.tsx (6 sites)

All six sit inside `GalaxyCanvas()`, gated by `if (loading) return <...Assembling capability
galaxy.../>` (from `useToolGalaxySources()`'s own `loading` field) before the summary grid.

| Label | Value source | staleAfter? | State (target) | AFTER |
|---|---|---|---|---|
| Tools | `graph.stats.toolCount` | no | `ready` — gated above | ready |
| Agents | `graph.stats.agentCount` | no | `ready` — gated above | ready |
| MCP in Graph | `graph.stats.serverCount` | no | `ready` — gated above | ready |
| Kits | `graph.stats.kitCount` | no | `ready` — gated above | ready |
| Edges | `graph.stats.edgeCount` | no | `ready` — gated above | ready |
| Orphans | `graph.stats.orphanCount` | no | `ready` — gated above | ready |

---

## Sites where the answer is "no emitter at all" (D-14's important case)

Only one site in this population has no backing emitter whatsoever:

- **`HeroStatsBar.tsx` — "Startup Time"**: no query anywhere computes startup latency. `state =
  "unavailable"`, justified in the per-site row above.

Every other site either has a real Convex query behind it (even if currently defaulted to a
zero-shape that masks loading) or is gated by an early return that guarantees real data by the time
it renders. None of the other 83 sites are marked `unavailable` — none of them are a guess wearing
a state's clothes.
