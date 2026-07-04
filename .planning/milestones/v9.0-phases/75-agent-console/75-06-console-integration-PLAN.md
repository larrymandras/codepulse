---
phase: 75-agent-console
plan: 06
type: execute
wave: 3
depends_on: [75-02, 75-03, 75-04, 75-05]
files_modified:
  - src/pages/LiveRun.tsx
  - src/pages/AgentConsole.test.tsx
autonomous: true
requirements: [CON-01, CON-02, CON-03, CON-04]

must_haves:
  truths:
    - "The console holds a Map<taskId, RunState> via useReducer(runMapReducer) and adds a run on task submit"
    - "Each active run mounts exactly one useTaskStream feeding the reducer"
    - "New Run modal + GlobalEStopButton are wired into the header; RunList drives run selection; the selected run renders RunTimeline/RunSummary"
    - "When a run reaches a terminal state, saveRunSummary persists it to Convex exactly once"
    - "Existing Ástríðr telemetry subscriptions and history selector still work"
    - "D-05: LiveRun.tsx is evolved in place into the Agent Console rather than a separate page"
    - "D-11: the run summary persists to Convex on terminal states only (completed/errored/stopped)"
    - "D-12: the persisted summary is a full reproducible record; filesTouched/token/cost render as empty-state when absent in v1"
  artifacts:
    - path: "src/pages/LiveRun.tsx"
      provides: "Agent Console — multi-run controller wiring launch, stream, stop, and persistence"
      min_lines: 120
    - path: "src/pages/AgentConsole.test.tsx"
      provides: "Terminal-state persistence + run-add integration coverage"
  key_links:
    - from: "src/pages/LiveRun.tsx"
      to: "src/lib/runReducer.ts runMapReducer"
      via: "useReducer(runMapReducer, new Map())"
      pattern: "useReducer\\(runMapReducer"
    - from: "src/pages/LiveRun.tsx"
      to: "src/hooks/useTaskStream.ts"
      via: "one useTaskStream per active task id"
      pattern: "useTaskStream"
    - from: "src/pages/LiveRun.tsx"
      to: "convex/agentRuns.ts saveRunSummary"
      via: "terminal-state useEffect → useMutation"
      pattern: "saveRunSummary"
---

<objective>
Evolve src/pages/LiveRun.tsx into the multi-run Agent Console, wiring together every piece built in Waves 1–2: the run-reducer Map, per-run gateway WS streams, the New Run modal, per-run Stop + global e-stop, the run list/selection, and terminal-state persistence to Convex. This is the integration that delivers all four requirements end-to-end (CON-01..CON-04).

Purpose: D-05 — evolve LiveRun in place (the route already exists) rather than a new page. The single-run `liveSessionId`/`RunMeta` becomes `Map<taskId, RunState>` (D-07). The launch modal seeds runs (D-06), useTaskStream demuxes streams per run (CON-02), Stop/e-stop cancel (CON-03), and terminal states persist (CON-04, D-11). Existing telemetry subscriptions and history stay intact.

Output: rewired src/pages/LiveRun.tsx + src/pages/AgentConsole.test.tsx (terminal-persistence + run-add integration).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/75-agent-console/75-RESEARCH.md
@.planning/phases/75-agent-console/75-PATTERNS.md
@.planning/phases/75-agent-console/75-UI-SPEC.md
@.planning/phases/75-agent-console/75-VALIDATION.md
@.planning/phases/75-agent-console/75-02-SUMMARY.md
@.planning/phases/75-agent-console/75-03-SUMMARY.md
@.planning/phases/75-agent-console/75-04-SUMMARY.md
@.planning/phases/75-agent-console/75-05-SUMMARY.md

<interfaces>
<!-- Plan 75-02 -->
runMapReducer(state: Map<string, RunState>, action: RunMapAction): Map<string, RunState>
RunState, GatewayRunStatus, RunMapAction (ADD_RUN, EVENT, SET_STOPPING, CLOSED, ERROR, SET_AUTOSCROLL)
<!-- Plan 75-03 -->
submitTask, cancelTask, gatewayWsBase  (astridrApi.ts)
api.agentRuns.saveRunSummary (mutation), api.agentRuns.listRecent (query)
<!-- Plan 75-04 -->
useTaskStream(taskId, dispatch)   (src/hooks/useTaskStream.ts)
NewRunModal { open, onOpenChange, onTaskSubmitted(taskId) }
<!-- Plan 75-05 -->
RunList { runs, selectedRunId, onSelect, dispatch }
GlobalEStopButton { activeTaskIds, dispatch }
RunSummary (extended: filesTouched?, prompt?, engine?, model?, workdir?, agentPersona?)

<!-- LiveRun.tsx evolve points (75-PATTERNS §LiveRun.tsx → AgentConsole) -->
- replace useState(liveBlocks/liveSessionId/runMeta) → useReducer(runMapReducer, new Map()) + selectedRunId state
- KEEP useAstridrWS() telemetry subscriptions (run.started/run.blocks) — those are :8181, unchanged
- header: add "New Run" CTA (opens NewRunModal) + GlobalEStopButton + keep RunHistorySelector + WSStatusIndicator
- two-column layout: RunList (w-72) | run detail (RunTimeline/RunSummary tabs) — UI-SPEC §Page Layout
- history query: useQuery(api.agentRuns.listRecent) ?? []
- terminal-state effect: on a run entering completed/error/stopped → useMutation(api.agentRuns.saveRunSummary)
- per-run auto-scroll + "↓ Latest" pill preserved for the selected run
- wrap console sections in <SectionErrorBoundary name="AgentConsole">
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor LiveRun to the run-reducer Map + wire streams, launch, stop</name>
  <files>src/pages/LiveRun.tsx</files>
  <read_first>
    - src/pages/LiveRun.tsx (the full file — current single-run state, telemetry subscriptions, scroll/Latest-pill, history query, header layout)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ LiveRun.tsx → AgentConsole: useState→useReducer migration, auto-scroll, ↓Latest pill, header layout, useAstridrWS-stays note; § Error Boundary Wrapping)
    - .planning/phases/75-agent-console/75-UI-SPEC.md (§ Page Layout, § Copywriting Contract, § Color/accent reservations)
    - src/lib/runReducer.ts, src/hooks/useTaskStream.ts, src/components/console/{NewRunModal,RunList,GlobalEStopButton} (the wired pieces)
  </read_first>
  <action>
    Refactor src/pages/LiveRun.tsx into the Agent Console controller. Replace the `liveBlocks`/`liveSessionId`/`runMeta` useState with `const [runMap, dispatch] = useReducer(runMapReducer, new Map<string, RunState>())` plus `selectedRunId` state (75-PATTERNS migration). Mount one `useTaskStream(taskId, dispatch)` per active run — render a small child component per active task id (e.g., a `RunStreamMount` that calls the hook and returns null) so each active task gets EXACTLY ONE WS (75-RESEARCH Pitfall 7); never call useTaskStream conditionally in a loop in the parent. Add NewRunModal to the header behind a "New Run" CTA; its `onTaskSubmitted(taskId)` dispatches `{ type: "ADD_RUN", taskId, request }` (carry the submitted TaskRequest through so RunState captures prompt/provider/workdir/model/persona) and sets it selected. Add `GlobalEStopButton` with `activeTaskIds` derived from runMap entries whose status is running/queued/stopping, passing `dispatch`. Render `RunList` (selected = selectedRunId, onSelect sets selectedRunId, dispatch passed for per-run Stop) in the left `w-72` column and the selected run's `RunTimeline`/`RunSummary` (feed RunSummary the extended props from the selected RunState) in the right column per UI-SPEC §Page Layout. KEEP all existing `useAstridrWS()` telemetry `subscribeEvent` hooks AS-IS — they are the :8181 telemetry WS, separate from the gateway streams; do NOT remove or reroute them (75-PATTERNS, anti-pattern 1). Preserve the per-run auto-scroll + "↓ Latest" pill for the selected run (75-PATTERNS auto-scroll pattern). Swap the old `handleStop` (`sendCommand({type:"run.stop"})`) usage out of the per-run path — per-run Stop now lives in RunCard via cancelTask. Replace the history query with `useQuery(api.agentRuns.listRecent) ?? []` feeding RunHistorySelector (keep RunHistorySelector as-is, D-13). Wrap the new console sections in `<SectionErrorBoundary name="AgentConsole">`. Use Lucide icons (Play/OctagonX/Square) and Tailwind `bg-(--token)` syntax; reserve emerald `--primary` only for the New Run CTA / active-run accent per UI-SPEC §Color.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - LiveRun uses useReducer(runMapReducer, new Map()) and a selectedRunId (grep both)
    - Exactly one useTaskStream per active task id (mounted via a per-run child, not a parent loop)
    - NewRunModal onTaskSubmitted dispatches ADD_RUN; GlobalEStopButton receives the active task ids; RunList drives selection
    - Existing useAstridrWS subscribeEvent telemetry hooks remain (grep: subscribeEvent still present)
    - history feeds from api.agentRuns.listRecent; console wrapped in SectionErrorBoundary
    - `npx tsc --noEmit` clean and the existing LiveRun test (if present) still passes
  </acceptance_criteria>
  <done>LiveRun is the multi-run Agent Console: reducer Map, per-run streams, launch, stop, e-stop, list/selection wired; telemetry intact.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire terminal-state Convex persistence + integration test</name>
  <files>src/pages/LiveRun.tsx, src/pages/AgentConsole.test.tsx</files>
  <read_first>
    - src/pages/LiveRun.tsx (the refactored controller from Task 1)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ Convex Mutation Call Pattern — terminal-state useEffect calling saveRunSummary)
    - .planning/phases/75-agent-console/75-RESEARCH.md (D-11 terminal-only persistence; D-12 reproducible record fields; filesTouched undefined in v1)
    - convex/agentRuns.ts (saveRunSummary args — Plan 75-03)
  </read_first>
  <behavior>
    - Test 1: when a run in runMap transitions to "completed", saveRunSummary is called once with the run's reproducible record (taskId, provider, status, prompt, workdir, model, agentPersona, rounds, startedAt, completedAt, durationMs)
    - Test 2: a run transitioning to "error" or "stopped" also triggers saveRunSummary
    - Test 3: saveRunSummary is NOT called for non-terminal states (queued/running/stopping)
    - Test 4: the same terminal run does not trigger saveRunSummary more than once across re-renders (client-side guard; idempotency also enforced in Convex by Plan 75-03)
    - Test 5: onTaskSubmitted(taskId) adds a run to the visible list (ADD_RUN integration)
  </behavior>
  <action>
    Add a terminal-state persistence effect to src/pages/LiveRun.tsx per 75-PATTERNS §Convex Mutation Call Pattern: `const saveRunSummary = useMutation(api.agentRuns.saveRunSummary)`, and a useEffect over runMap that, for each run whose status is `completed`/`error`/`stopped`, calls `saveRunSummary` once with the full reproducible record from RunState — taskId, provider, status, prompt, workdir, model, agentPersona, rounds, inputTokens, outputTokens, costUsd (from cost), filesTouched, startedAt, completedAt, durationMs (completedAt-startedAt), errorMessage (D-11/D-12). Map RunState.cost→costUsd. Leave inputTokens/outputTokens/costUsd/filesTouched undefined when absent (v1 — gateway emits none; the persisted record still captures the reproducible config + timing, satisfying CON-04). Add a client-side guard (e.g., a `useRef<Set<string>>` of persisted taskIds) so each terminal run persists exactly once even across re-renders — Convex's by-taskId upsert (Plan 75-03) is the backstop, but avoid redundant mutation calls. Create src/pages/AgentConsole.test.tsx covering behaviors 1-5 (render LiveRun with mocked Convex useMutation/useQuery and a controllable runMap path — e.g., drive ADD_RUN then a terminal EVENT/CLOSED via the modal callback + a stubbed useTaskStream). Trace: 75-VALIDATION.md rows "Terminal state triggers saveRunSummary call" and "saveRunSummary mutation upserts by taskId".
  </action>
  <verify>
    <automated>npx vitest run src/pages/AgentConsole.test.tsx -t "persists on terminal"</automated>
  </verify>
  <acceptance_criteria>
    - Terminal states (completed/error/stopped) call saveRunSummary with the reproducible record; non-terminal states do not
    - Each terminal run persists exactly once (client-side Set guard) — proven by a re-render test
    - durationMs = completedAt - startedAt; cost mapped to costUsd; absent token/file fields left undefined
    - `npx vitest run src/pages/AgentConsole.test.tsx` passes; `npm test` green for the suite; `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>Terminal runs persist to Convex exactly once with the full v1 reproducible record; integration test green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → gateway (:8200) | Launch/stream/stop all cross from the console to the gateway |
| client → Convex cloud | Terminal run summaries cross to the cloud DB |
| gateway WS frames → reducer → DOM | Untrusted stream content folds into state and renders |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-75-15 | Tampering | duplicate persistence on re-render | mitigate | Client-side persisted-taskId Set guards single-write; Convex saveRunSummary upserts idempotently by taskId as backstop (Plan 75-03) |
| T-75-16 | Information Disclosure | telemetry + gateway streams conflated | mitigate | Gateway streams flow only through useTaskStream; useAstridrWS telemetry subscriptions are untouched — no cross-routing (75-PATTERNS anti-pattern 1) |
| T-75-17 | Denial of Service | many concurrent WS connections | mitigate | Exactly one useTaskStream per active task id (Pitfall 7); per-run block buffer capped at 500 (Plan 75-02) bounds memory |
| T-75-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs in this plan; wires existing tested pieces. No legitimacy gate needed |
</threat_model>

<verification>
- `npm test` green (full suite); `npx tsc --noEmit` clean
- LiveRun renders the two-column console, launches a run (ADD_RUN), streams via useTaskStream, stops via cancelTask, and persists terminal runs once
- Existing telemetry subscriptions and RunHistorySelector still function
</verification>

<success_criteria>
- End-to-end console wiring delivers CON-01 (launch), CON-02 (per-run stream into reducer), CON-03 (per-run + global cancel), CON-04 (terminal persistence)
- Single page (D-05), Map-keyed concurrency (D-07), honest async-stop UX (D-09), terminal-only persistence (D-11)
- Manual integration pass (75-VALIDATION §Manual-Only) remains the live-gateway verification of success criteria 1-3
</success_criteria>

<output>
Create `.planning/phases/75-agent-console/75-06-SUMMARY.md` when done
</output>
