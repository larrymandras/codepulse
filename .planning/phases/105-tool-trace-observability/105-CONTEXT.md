# Phase 105: Tool & Trace Observability - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

CodePulse makes Ástríðr's **tool behavior** legible: which tools it calls and how often they
succeed or fail over time (OBS-01), the tool-filter/leak signals astridr already emits but
CodePulse currently discards (OBS-02), and a trace waterfall deep enough to show tool executions
nested under the LLM call that triggered them, with per-tool timings and per-turn cache visibility
(OBS-03).

**This phase observes and reports. It never enforces.** Nothing here disables a tool, changes
astridr's tool-access policy, or blocks an execution. `toolGovernance` (Phase 73) already holds a
`disabled` flag whose enforcement is a documented follow-up — this phase does not pick that up.

**No new alert channels.** The one alerting decision (D-06) reuses Phase 104's existing path —
`alerts` insert + `internal.webhookDelivery.sendAlertWebhook`, evaluated at the tail of
`computeHourly` — and adds no `convex/crons.ts` entry.

**Cross-repo scope is real but bounded:** exactly one astridr-repo commit (D-03, D-08, D-10),
following the 104-02 precedent (`claude_cli.py` token emit). It is additive telemetry only — no
change to astridr's tool-filter behavior, policy semantics, or agent loop control flow.

</domain>

<decisions>
## Implementation Decisions

### Tool data unification (OBS-01)

- **D-01:** **Ástríðr's tool calls land as per-call rows in `toolExecutions`.** Extend the existing
  `case "tool_executed"` in `convex/runtimeIngest.ts:841` so it ALSO inserts a `toolExecutions` row
  instead of only upserting the `callGraphEdges` counter.
  **Live-verified problem this closes:** `callGraphEdges` holds Ástríðr's real tools as *cumulative
  counters* — `web_search` 125 calls, `telegram_tool` 58 (3 err), `cli_gateway` 103 (43 err),
  `memory_search`, `obsidian`, `apify`, `generate_image`, `send_dm`, across agents `hildr`/`urdhr`
  — with only `lastCallAt`/`lastErrorAt`, so OBS-01's "over time" is **impossible** from that table.
  Meanwhile `toolExecutions` (queried live) contains **zero Ástríðr agent tools**: only Claude Code
  CLI hook rows (`Bash` 594/16 err, `Edit`, `Read`, `Write`, `Grep`, `Glob`, `Skill`, `Agent`,
  `AskUserQuestion`, `SendMessage`, `PowerShell`, `ToolSearch`, `mcp__github__*`) and gateway
  pseudo-tools (`gateway:claude-cli`, `gateway:codex`, `gateway:antigravity`, `gateway:claude-sdk`,
  `gateway:claude-cli-consulting`). Keep the `callGraphEdges` upsert — Tool Galaxy reads it.

- **D-02:** **Source is tagged, never silently summed.** Reuse the existing optional `provider`
  field on `toolExecutions` (`convex/schema.ts:571`, already `"claude-cli"` for hook rows via
  `convex/ingest.ts:153`); Ástríðr rows get their own distinct value. One table, one panel, a source
  filter — and **the default view shows Ástríðr only**, because CodePulse is Ástríðr's dashboard.
  Rationale: a chart ranking `Bash` (594) above `web_search` (125) conflates the operator's own
  Claude Code session with Ástríðr's autonomy. Nothing is hidden; nothing is summed across sources
  without the operator asking for it.

- **D-03:** **One astridr-repo change adds `durationMs` and `traceId` to the `tool_executed`
  payload** (`astridr/agent/loop.py:2051`). Both are cheap: `_duration_ms` is already computed on
  the line above (used for the `agent_metric` emit) and then discarded; `traceId` reads the existing
  per-turn ContextVar (`astridr/engine/telemetry.py:87`, `get_trace_context()` at :625) that the
  three providers already attach to `llm_call` payloads. Serves OBS-01's timings and OBS-03's
  nesting in a single merge + container rebuild.

- **D-04:** **"Over time" is served by hourly aggregate buckets, with raw rows as the drill-down.**
  `computeHourly`'s tail writes tool call / failure / duration buckets keyed by tool + provider,
  the same pattern Phase 104 used for `tokens_prompt`/`tokens_completion` (104-03). Charts read
  aggregates and survive the prune; raw `toolExecutions` rows stay the 14-day detail view.
  **Constraint this respects:** `convex/retention.ts:34` prunes `toolExecutions` at 14 days, and
  D-01 is about to add Ástríðr's tool volume to that table on the self-hosted instance whose
  tombstone GC caused the 2026-07-21/22 outage. Retention is **not** raised.

### Tool-policy / leak signals (OBS-02)

- **D-05:** **A new dedicated `toolPolicyEvents` table**, keyed by event kind + tool name +
  timestamp and indexed so the view is index-bounded rather than filtering a hot general table.
  **Live-verified gap this closes:** astridr emits `tool_policy_event` in four flavors, and
  `convex/runtimeIngest.ts` has **no `case` for it and no `default`** — every one of them is
  silently dropped at the ingest boundary today. The four kinds and their emit sites:
  | Kind | Site | Meaning |
  |---|---|---|
  | `tool_call_leaked_as_text` | `astridr/agent/loop.py:1471` | model emitted a tool call as literal text (the silent-filter trap) |
  | `execution_denied` | `astridr/agent/loop.py:2100` | an off-turn tool call was blocked by the tool filter |
  | `malformed_policy_boot` | `astridr/engine/bootstrap/core.py:129` | tool-access policy was malformed at boot and **degraded to fully permissive** |
  | `malformed_policy_reload_rejected` | `astridr/engine/bootstrap/core.py:230` | a malformed policy reload was rejected; last-known-good retained |
  Rejected: `securityEvents` (imposes severity semantics that don't fit and mixes policy telemetry
  into a security feed) and the generic `events` table (highest-volume table on the instance; its
  index tombstones are what forced the `by_timestamp2` rename).

- **D-06:** **Alert on the fail-open kinds only.** `malformed_policy_boot` and
  `malformed_policy_reload_rejected` raise an alert; `tool_call_leaked_as_text` and
  `execution_denied` are view-only.
  Rationale: astridr **deliberately fails open** on a malformed policy — `load_config()` degrades
  `tool_clusters` to a blank-slate permissive policy so a config typo can never fail boot
  (`astridr/engine/config.py:1152-1166`, D-03/T-182-17 accepted there). That silent widening of
  tool access is invisible beyond a local log line and is worth waking someone for. A denial, by
  contrast, is the policy *working*: astridr returns a self-correcting string and deliberately does
  NOT count it against the failure-rate circuit breaker (`loop.py:2106-2109`), so alerting on it
  would generate recurring alerts for correct behavior.
  **Delivery reuses Phase 104's path exactly** — insert into `alerts` + schedule
  `internal.webhookDelivery.sendAlertWebhook`, never the public `alerts.create`; evaluated at the
  tail of `computeHourly` inside a try/catch. **No new `convex/crons.ts` entry** (D-14 of Phase 104
  is a standing hard constraint since the 2026-07-14 retry-storm incident that disabled
  `evaluateInternal`).

- **D-07:** **The ingest path is proven by inducing real events, not by shipping and hoping.**
  During execution, deliberately trigger a malformed tool-access-policy reload and an off-turn
  denied call against the running stack, confirm the rows land, and record it in VALIDATION.md —
  the 104-11 pattern. Additionally, the panel states when ingest last received *any* policy event,
  so later silence is distinguishable from a dead pipe.
  Rationale: these events have **never been stored**, so there is no backfill and the view starts
  genuinely empty. An empty result that reads as "healthy" is this project's recurring failure mode
  (the Phase-90 War Room lesson; `gatewayQuotaSnapshots` returning `[]` in 104-11).

- **D-08:** **The same astridr commit widens the leak payload** with `tool_was_offered`,
  `tools_offered_count`, `round` and `agentId`.
  **Verified drift this closes:** astridr's log line at `loop.py:1460-1469` already carries all four
  as local variables, but the `telemetry.send` three lines below (`:1471-1476`) forwards only
  `tool`, `taskCategory` and `sessionId`. `tool_was_offered` is the actual diagnosis — it separates
  "the model tried to call a tool it was never given" (the silent-filter trap this detector exists
  for) from "it leaked one it had". Without it the view can say *that* a tool leaked but never *why*.

### Trace depth (OBS-03)

- **D-09:** **Tool executions nest under the LLM call that triggered them** — two levels of the
  existing `Collapsible` in `src/components/TraceWaterfall.tsx`: trace group → LLM call → tool
  executions, reusing the current time axis and bar geometry. This mirrors how a turn actually runs
  (model responds → tools run → model responds) and makes per-tool timing readable as a share of
  the turn. Rejected: a flat interleaved lane (loses causality) and a parallel tool lane (never
  visually connects, leaving "which call triggered this tool" a manual inference).

- **D-10:** **Nesting attribution is reported, not inferred — via a new per-round ContextVar in
  astridr.** Set in the agent loop where `round_num` already exists, read by the three provider
  `llm_call` emits and the `tool_executed` emit (one line each), exactly mirroring the existing
  `traceId` ContextVar pattern.
  **Why this is needed:** one `traceId` spans a whole *turn*, which contains several LLM calls and
  several tool executions across rounds — so `traceId` alone does not identify a parent. And
  `llm_call` is emitted from **inside each provider** (`astridr/providers/anthropic_provider.py:596`,
  `ollama.py:229`, `openrouter.py:358`), which has no access to the loop's `round_num`; a ContextVar
  is the only mechanism that reaches both sites. Rejected: nesting a tool row under the most recent
  preceding LLM call by timestamp — correct in the common case, but a wrong parent renders exactly
  as confidently as a right one with nothing on screen to signal doubt.

- **D-11:** **Per-turn cache visibility is a cache ratio on the trace-group header**, beside the
  aggregate cost already shown there. It uses the **identical denominator** already used by
  `computeSummary` in `TraceWaterfall.tsx` and `shapeCacheAcc` in `convex/llm.ts` —
  `read / (read + creation + prompt)` — so one formula lives in one shared place rather than
  drifting across three. Existing cache honesty is preserved unchanged: `cacheBadge` stays a
  three-state `HIT`/`MISS`/`NO_DATA` that never conflates an absent field with a zero.

- **D-12:** **Both feeder reads are capped, and truncation is stated on screen.** `llm.sessionCalls`
  (`convex/llm.ts:129-134`) and `toolExecutions.listBySession`
  (`convex/toolExecutions.ts:91-99`) are both unbounded `.collect()` today; nesting tool rows makes
  a long session read both in full. Cap both, and when a trace is truncated say so rather than
  rendering a partial waterfall that looks complete. Confirm `TraceWaterfall` sits inside a
  `SectionErrorBoundary` so a timeout can never blank SessionDetail.
  Rationale: this is the same shape as the query that blanked all of Analytics on 2026-08-02
  (`3b31c9f4` — one timing-out query, one missing boundary, whole page gone).

### Information architecture

- **D-13:** **A new dedicated Tools page**, owning OBS-01's per-tool frequency + success/failure
  over time and OBS-02's policy/leak feed. It gives the phase a coherent home and somewhere for
  D-02's source filter to live — awkward to bolt onto a Dashboard card.

- **D-14:** **It sits in the `OBSERVE` nav group** (`src/lib/navRegistry.ts:150-163`), beside
  Analytics, Alerts, Quality and Security — it is time-series observability, which is what that
  group is. Tool Galaxy (3D viz over `callGraphEdges`) and MCP Inventory (governance) stay in
  `GRAPHS` as genuinely different concerns.

- **D-15:** **The three already-mounted tool panels stay where they are and gain links into the new
  page** — `ToolBreakdown` (Dashboard), `ToolExecutionPanel` (Dashboard),
  `PermissionDecisionsChart` (Analytics). Zero regression surface on four working panels, which
  matters given this milestone has already produced defects in exactly that class.
  **Verified during discussion:** `ToolBreakdown` reads `useRecentEvents(100)` → the build-time
  `events` table (`src/pages/Dashboard.tsx:25,137`), **not** `toolExecutions` — so D-01/D-02's
  source mixing does not reach it and it needs no source filter.

- **D-16:** **The Tools page is stacked sections on one scroll**, not tabs: usage analytics first,
  policy feed beneath, each in its own `SectionErrorBoundary`. A rare-but-important signal stays
  visible rather than hidden behind a tab nobody opens, and an empty policy feed costs one honest
  line rather than a whole view. Also avoids a live constraint found in 104-09: Settings' tab state
  is local component state, **not URL-addressable**, so a D-06 alert could not deep-link to a tab
  without new work.

### Claude's Discretion

The user selected a concrete option on every question — there are no open "you decide" items.
Left to research and planning: exact table/field names and indexes, the aggregate metric-type
naming for D-04, the specific row caps for D-12, chart primitives, plan/wave decomposition, and
whether existing `toolExecutions` rows need any backfill (raised but not discussed — see Deferred).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` §"Phase 105: Tool & Trace Observability" (line 744) — goal, dependencies,
  and the explicit note that success criteria are derived here.
- `.planning/REQUIREMENTS.md` §"Phase 105" (lines 25-29) — OBS-01, OBS-02, OBS-03 verbatim, plus
  the v13.0 "Out of scope" list (no new alert delivery channels; no mass mutation of the live
  self-hosted Convex).

### CodePulse — the surfaces and pipes this phase touches
- `convex/runtimeIngest.ts` — `case "tool_executed"` at :841 (D-01's insertion point); the switch
  that has **no** `tool_policy_event` case and no `default` (D-05).
- `convex/toolExecutions.ts` — `insert`, `successRate`, `avgDuration`, and the unbounded
  `listBySession` at :91-99 (D-12).
- `convex/schema.ts` — `toolExecutions` :561, `callGraphEdges` :1045, `toolGovernance` :1073,
  `llmMetrics` (with `traceId`, `cacheReadInputTokens`, `cacheCreationInputTokens`) :306.
- `convex/retention.ts:34` — the 14-day `toolExecutions` window that motivates D-04.
- `convex/llm.ts` — `sessionCalls` :126-136 (unbounded, D-12) and `shapeCacheAcc` (the cache
  denominator D-11 must reuse).
- `convex/aggregates.ts` — `computeHourly` (D-04's rollup host **and** D-06's evaluator tail).
- `convex/ingest.ts:135-180` — the Claude Code `PostToolUse` / `PostToolUseFailure` path that is the
  *only* current writer of hook-sourced `toolExecutions` rows.
- `src/components/TraceWaterfall.tsx` — `groupByTrace`, `cacheBadge`, `computeSummary`,
  `groupCostLabel` (D-09/D-11/D-12).
- `src/lib/navRegistry.ts:150-163` — the `OBSERVE` group D-14 adds to.
- `src/pages/Dashboard.tsx:25,137,159` and `src/pages/Analytics.tsx:19,459` — the three existing
  panels D-15 leaves in place.

### Ástríðr (cross-repo, `C:/Users/mandr/astridr-repo`) — the single commit D-03/D-08/D-10 make
- `astridr/agent/loop.py:2051` — `tool_executed` emit (D-03 adds `durationMs`, `traceId`).
- `astridr/agent/loop.py:1454-1476` — leak detection, the rich log line, and the narrower telemetry
  payload D-08 widens.
- `astridr/agent/loop.py:2088-2109` — the off-turn `execution_denied` emit, and the comment
  explaining why an off-turn block is deliberately **not** a tool failure.
- `astridr/engine/telemetry.py:87,604-625` — the `traceId` ContextVar plumbing D-03/D-10 mirror.
- `astridr/engine/bootstrap/core.py:105-135, 218-235` — the two malformed-policy emits D-06 alerts on.
- `astridr/engine/config.py:1151-1180` — the deliberate fail-open degrade that makes D-06's alert
  worth having.
- `astridr/providers/anthropic_provider.py:595-615` (plus `ollama.py:229`, `openrouter.py:358`) —
  the three `llm_call` emit sites D-10's round ContextVar must reach.
- `.planning/phases/182-tool-access-policy-hardening/` (astridr-repo) — the phase that shipped these
  signals; `182-VALIDATION.md` and `182-RESEARCH.md` document the boot-vs-reload distinction that
  D-06 must not collapse.

### Prior-phase precedent this phase follows
- `.planning/phases/104-cost-intelligence/104-CONTEXT.md` — D-14 (no new cron / computeHourly tail),
  D-15 (dedup), D-16 (alert-only, no enforcement wording), D-17 (fire via internal path).
- `.planning/phases/104-cost-intelligence/104-02-SUMMARY.md` — the cross-repo astridr emit-change
  precedent D-03/D-08/D-10 follow.
- `.planning/phases/104-cost-intelligence/104-03-SUMMARY.md` — the resumable, batch-capped,
  insert-only rollup/backfill pattern D-04 follows.
- `.planning/phases/104-cost-intelligence/104-VALIDATION.md` — the live-verification discipline D-07
  adopts, and the 7-defects-no-green-suite-could-see scorecard.
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — the hard rules D-01/D-04 are bounded by.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`convex/runtimeIngest.ts`'s switch** — `tool_executed` already parses agentId/toolName/
  sessionId/success/timestamp with snake_case fallbacks. D-01 is an added `runMutation`, not a new
  case. D-05's `tool_policy_event` case follows the identical shape as its ~60 siblings.
- **`api.toolExecutions.insert`** — already accepts `durationMs`, `success`, `errorMessage` and
  `provider` optionally; D-01 and D-02 need no new mutation and no arg-shape change.
- **`TraceWaterfall.tsx`'s pure helpers** — `groupByTrace`, `barMetrics`, `cacheBadge`, `costLabel`,
  `computeSummary`, `groupCostLabel` are all exported and unit-tested (`TraceWaterfall.test.tsx`).
  D-09/D-11 extend this tested contract rather than rewriting the component.
- **`convex/aggregates.ts`'s `computeHourly`** — already hosts per-bucket idempotency guards and,
  since 104-06, an evaluator at its tail inside a mandatory try/catch. D-04 and D-06 both attach here.
- **Phase 104's alert path** — `alerts` insert + `internal.webhookDelivery.sendAlertWebhook`, with
  `alerts.by_source` dedup. D-06 reuses it wholesale; no new delivery code.
- **`SectionErrorBoundary`** — the standard panel wrapper; 10 panels were retrofitted in `3b31c9f4`.
- **`useQuery(...) ?? DEFAULT` hook wrappers** — `src/hooks/useCostDerived.ts`, `useCostBudgets.ts`
  are the current-convention templates for this phase's hooks.

### Established Patterns
- **Honesty over completeness** — `NO_DATA` never collapses into `0` (`cacheBadge`); an unpriced
  model is named, never valued at a default (104 D-03); a missing cost renders `"n/a"`, never an
  estimate (`costLabel`). D-07 and D-12 are this rule applied to emptiness and truncation.
- **No new cron.** Anything periodic rides `computeHourly`'s tail (Phase 104 D-14, hard constraint).
- **No mass mutation of the live self-hosted Convex.** Any backfill is resumable and batch-capped
  (104-03); `--replace-all` is forbidden outright.
- **Index-bounded reads, no unbounded `.collect()` on a growing table** — the direct lesson of the
  2026-07-21/22 outage and the 2026-08-02 Analytics blackout.
- **Zero hardcoded hex**; all colour from `--primary` / `--status-*` / `--chart-*` tokens; shadcn
  (New York) primitives; Lucide icons only.
- **A green unit suite is not live verification** — this project's standing convention; requirement
  markers are only flipped after an operator-attended live pass.

### Integration Points
- `convex/runtimeIngest.ts` — one modified case (`tool_executed`) + one new case
  (`tool_policy_event`).
- `convex/schema.ts` — one new table (`toolPolicyEvents`); `toolExecutions` unchanged in shape.
- `convex/aggregates.ts` `computeHourly` — new tool buckets (D-04) + policy-alert evaluation (D-06).
- `src/components/TraceWaterfall.tsx` + a second session-scoped tool query — the OBS-03 surface.
- `src/lib/navRegistry.ts` + `src/App.tsx` — one route, one `OBSERVE` nav entry.
- **astridr-repo, one commit:** `agent/loop.py` (two emits widened), `engine/telemetry.py` (round
  ContextVar), three provider files (one-line reads). Requires merge + `docker compose --profile
  prod up -d --build`; note `feature/brain-swap` was the live branch as of 104-11.

</code_context>

<specifics>
## Specific Ideas

- The policy view must name **the offending tool**, per OBS-02's own wording — and, thanks to D-08,
  whether that tool was even offered on the turn it leaked.
- The four policy kinds must stay distinguishable in the view; D-06 treats two of them as
  alert-worthy and two as informational, and the boot-degrade vs reload-rejected distinction is
  load-bearing (astridr Phase 182 explicitly warns never to collapse the two — boot degrades to
  permissive, reload retains last-known-good).
- Per-tool timing should read as a **share of the turn**, which is what motivated the nested layout
  in D-09 over a flat or parallel lane.
- The default Tools view is **Ástríðr's** tools. The operator can widen to Claude Code / gateway
  sources deliberately, but never lands on a mixed ranking by accident.

</specifics>

<deferred>
## Deferred Ideas

- **Backfill of existing `toolExecutions` rows** — raised at the close of discussion, not discussed.
  Existing rows have no `traceId` and mostly no Ástríðr provenance; whether D-04's aggregates get a
  historical backfill (104-03 pattern) or start from now is left to planning. Note there is
  *nothing* to backfill for `toolPolicyEvents` — those events were never stored.
- **Enforcement of `toolGovernance.disabled`** — the table exists (`convex/schema.ts:1073`) with a
  documented "enforcement is a follow-up" note. Observing tool behavior makes acting on it tempting;
  it is a new capability and belongs in its own phase.
- **A definition of tool "failure" beyond the boolean** — astridr's off-turn block is deliberately
  excluded from its own failure-rate circuit breaker (`loop.py:2106-2109`), and the leak detector is
  logging-only by design. Whether CodePulse's failure rate should mirror astridr's definition
  exactly was raised but not resolved; planning should keep them aligned rather than inventing a
  second definition.
- **Retiring the duplicate Dashboard/Analytics tool panels** — D-15 keeps them deliberately. A
  consolidation pass is Phase 96-style IA work, not OBS-01..03.
- **The 40+ static alert rules that only fire while the Alerts page is open** — carried forward from
  104's deferred list, untouched here. Mechanism verified: `src/components/AlertRulesEngine.tsx`
  invokes `api.alerts.evaluate` as a client-side mutation from a mounted component, so nothing
  evaluates them when the page is closed. (104-CONTEXT.md cites a specific line for this; that line
  number no longer points at the loop — verify against the live file, not the citation.)

</deferred>

---

*Phase: 105-Tool & Trace Observability*
*Context gathered: 2026-08-03*
