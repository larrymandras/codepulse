---
phase: 75-agent-console
plan: 05
type: execute
wave: 2
depends_on: [75-02, 75-03]
files_modified:
  - src/components/console/RunCard.tsx
  - src/components/console/RunCard.test.tsx
  - src/components/console/RunList.tsx
  - src/components/console/GlobalEStopButton.tsx
  - src/components/console/GlobalEStopButton.test.tsx
  - src/components/RunSummary.tsx
autonomous: true
requirements: [CON-03, CON-04]

must_haves:
  truths:
    - "RunCard shows run id, engine badge, status pill, elapsed, and a Stop button enabled only while running"
    - "Clicking Stop dispatches SET_STOPPING and calls cancelTask; the label becomes 'Stopping…' and the button disables"
    - "GlobalEStopButton confirms via AlertDialog then iterates DELETE over all active task IDs"
    - "RunSummary renders a Run Config section and a Files Touched section with a graceful empty-state when data is absent"
    - "D-10: per-run Stop is one-click no-confirm; the global e-stop confirms via AlertDialog"
    - "D-13: RunHistorySelector and RunSummary are reused as-is, RunSummary extended for the files-touched field"
  artifacts:
    - path: "src/components/console/RunCard.tsx"
      provides: "Single concurrent-run entry with per-run Stop"
      exports: ["RunCard"]
    - path: "src/components/console/RunList.tsx"
      provides: "Scrollable list of RunCards with empty state"
      exports: ["RunList"]
    - path: "src/components/console/GlobalEStopButton.tsx"
      provides: "Header panic button with confirm-then-cancel-all"
      exports: ["GlobalEStopButton"]
    - path: "src/components/RunSummary.tsx"
      provides: "Run Config + Files Touched sections (empty-state aware)"
      contains: "Files Touched"
  key_links:
    - from: "src/components/console/RunCard.tsx"
      to: "src/lib/astridrApi.ts cancelTask"
      via: "Stop handler: dispatch SET_STOPPING then cancelTask"
      pattern: "cancelTask"
    - from: "src/components/console/GlobalEStopButton.tsx"
      to: "src/lib/astridrApi.ts cancelTask"
      via: "Promise.allSettled over active task IDs"
      pattern: "Promise.allSettled"
---

<objective>
Build the run-display + stop-controls surface: RunCard (per-run entry with Stop), RunList (concurrent run list), GlobalEStopButton (confirm-then-halt-all), and the RunSummary extension. Covers CON-03 (per-run + global cancellation via DELETE) and CON-04's render (richer summary).

Purpose: D-07 concurrent runs need a per-run card + list; D-08/D-09/D-10 stop semantics need the honest "Stopping…" pending state driven by the reducer, and the confirmed global e-stop. The summary extension (D-13) renders the richer reproducible record, with the v1 reality (no token/cost/files from the gateway stream, D-12) handled as a graceful empty-state.

Output: src/components/console/{RunCard,RunList,GlobalEStopButton}.tsx (+tests for RunCard/GlobalEStopButton), extended src/components/RunSummary.tsx.
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
@.planning/phases/75-agent-console/75-02-SUMMARY.md
@.planning/phases/75-agent-console/75-03-SUMMARY.md

<interfaces>
<!-- From Plan 75-02 (runReducer.ts) -->
GatewayRunStatus = "queued" | "running" | "stopping" | "completed" | "error" | "stopped"
RunState = { taskId, status, provider, prompt, workdir, model?, agentPersona?, blocks, rounds, startedAt, completedAt?, inputTokens?, outputTokens?, cost?, filesTouched?, autoScroll }
RunMapAction includes { type: "SET_STOPPING"; taskId }

<!-- From Plan 75-03 (astridrApi.ts) -->
cancelTask(taskId: string): Promise<void>   // DELETE /tasks/{id}

<!-- Existing components to reuse/extend -->
StatusBadge (src/components/StatusBadge.tsx)   // status pill — idle/warn/ok/error
GlassPanel (src/components/GlassPanel.tsx)      // run card container
Button (src/components/ui/button.tsx)           // destructive size="sm" for Stop
AlertDialog (src/components/ui/alert-dialog.tsx) // ALREADY PRESENT (git ground truth; RESEARCH's "install" note is stale)
RunSummary (src/components/RunSummary.tsx)       // StatCard pattern lines 33-43, tool-usage section ~111-125

<!-- RunCard stop interaction (75-UI-SPEC §Stop Controls) -->
running → click → button disabled + label "Stopping…" + animate-pulse ; remains until reducer flips to stopped (WS close)
Stop enabled ONLY when status === "running" ; hidden on terminal states
Run id display: {taskId.slice(0,8)}… ; engine badge full name "Claude Code"/"Codex"

<!-- GlobalEStopButton (75-UI-SPEC §Global E-Stop; 75-PATTERNS §GlobalEStopButton) -->
Button variant=destructive + OctagonX icon, label "E-Stop All", disabled when activeCount===0
AlertDialog confirm: title "Emergency Stop All Runs", body "This will cancel all {N} active run(s)…", confirm "Stop All Runs"
handleEStopAll: Promise.allSettled(activeTaskIds.map(cancelTask)) then dispatch SET_STOPPING per id

<!-- RunSummary extension (75-UI-SPEC §Extended; 75-PATTERNS §RunSummary.tsx; D-12/D-13) -->
New optional props: filesTouched?, prompt?, engine?, model?, workdir?, agentPersona?
New "Run Config" StatCard section + "Files Touched" list section
EMPTY-STATE: when filesTouched/tokens/cost are undefined (v1 — gateway emits none), render a graceful "not available" state, NOT a crash or blank
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build RunCard + RunList</name>
  <files>src/components/console/RunCard.tsx, src/components/console/RunCard.test.tsx, src/components/console/RunList.tsx</files>
  <read_first>
    - src/pages/LiveRun.tsx (Stop button ~226-231, session-id chip ~233-239, empty-state ~243-248 — pattern source)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ RunCard.tsx, § RunList.tsx)
    - .planning/phases/75-agent-console/75-UI-SPEC.md (§ Run State Machine visual states, § Stop Controls per-run, § Copywriting, § Color)
    - src/components/StatusBadge.tsx + src/components/GlassPanel.tsx (containers/pills to reuse)
    - src/lib/runReducer.ts (RunState, GatewayRunStatus, RunMapAction — Plan 75-02)
  </read_first>
  <behavior>
    - Test 1: RunCard renders the run id as {taskId.slice(0,8)}…, the engine badge ("Claude Code"/"Codex"), and a status pill mapped from RunState.status
    - Test 2: the Stop button is rendered+enabled only when status === "running"; hidden on queued/completed/error/stopped
    - Test 3: clicking Stop dispatches { type: "SET_STOPPING", taskId } AND calls cancelTask(taskId)
    - Test 4: when status === "stopping" the Stop control is disabled and shows "Stopping…"
    - Test 5: a cancelTask rejection surfaces a toast.error and does not throw
  </behavior>
  <action>
    Create src/components/console/RunCard.tsx taking `{ run: RunState; selected: boolean; onSelect: () => void; dispatch: (a: RunMapAction) => void }`. Render inside `GlassPanel`: the run id chip (`{run.taskId.slice(0,8)}…`, font-mono uppercase tracking-widest per UI-SPEC typography), the engine badge (map "claude-cli"→"Claude Code", "codex"→"Codex"), a `StatusBadge` mapped from run.status (queued→idle, running→warn, completed→ok, error→error, stopped→muted; stopping→warn+animate-pulse), an elapsed timer (Date.now()-startedAt, or completedAt-startedAt when terminal), and a per-run Stop as a shadcn `Button variant="destructive" size="sm"` with Lucide `Square`. The Stop handler: `dispatch({ type: "SET_STOPPING", taskId: run.taskId })` then `await cancelTask(run.taskId)` inside try/catch → `toast.error` on failure (do NOT optimistically set "stopped" — 75-PATTERNS anti-pattern 2; the reducer flips to stopped on WS CLOSED). Stop is enabled only when `run.status === "running"`; when `run.status === "stopping"` it is disabled with label "Stopping…". Apply the card border tints from UI-SPEC §Run State Machine (running→border-primary/40, etc.). Use Tailwind `bg-(--token)` syntax and Lucide icons only. Create src/components/console/RunList.tsx: `{ runs: RunState[]; selectedRunId; onSelect; dispatch }` rendering a `w-72 shrink-0 overflow-y-auto` column of RunCards (space-y-3 p-3) with the "No active runs…" empty-state from UI-SPEC copywriting when runs is empty. Write RunCard.test.tsx covering the five behaviors (mock cancelTask + sonner). Trace: 75-VALIDATION.md row "Stop button dispatches SET_STOPPING + calls cancelTask".
  </action>
  <verify>
    <automated>npx vitest run src/components/console/RunCard.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - RunCard shows id chip, engine badge, status pill, elapsed; Stop enabled only when running
    - Stop dispatches SET_STOPPING and calls cancelTask; never optimistically sets "stopped" (grep: no status="stopped" set in RunCard)
    - stopping state disables Stop and shows "Stopping…"
    - RunList renders the empty-state when runs is empty
    - `npx vitest run src/components/console/RunCard.test.tsx` passes; `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>Per-run card + concurrent list with honest async-stop UX, tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build GlobalEStopButton + extend RunSummary</name>
  <files>src/components/console/GlobalEStopButton.tsx, src/components/console/GlobalEStopButton.test.tsx, src/components/RunSummary.tsx</files>
  <read_first>
    - src/components/ui/alert-dialog.tsx (the already-present AlertDialog primitive)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ GlobalEStopButton.tsx confirm + iterate pattern, § RunSummary.tsx StatCard + tool-usage section extract)
    - .planning/phases/75-agent-console/75-UI-SPEC.md (§ Global E-Stop interaction contract, § Copywriting, § RunSummary extension)
    - src/components/RunSummary.tsx (existing StatCard ~33-43, tool-usage container ~111-125, RunSummaryProps ~6-15)
    - src/lib/astridrApi.ts (cancelTask — Plan 75-03)
  </read_first>
  <behavior>
    - Test 1: GlobalEStopButton is disabled when activeTaskIds is empty
    - Test 2: clicking it opens an AlertDialog whose body names the active count
    - Test 3: confirming calls cancelTask for every active task id (Promise.allSettled) and dispatches SET_STOPPING per id
    - Test 4: canceling the dialog calls nothing
    - Test 5: RunSummary renders a "Files Touched" empty-state ("not available") when filesTouched is undefined, and lists files when provided
    - Test 6: RunSummary renders a "Run Config" section showing prompt/engine/model/workdir when provided
  </behavior>
  <action>
    Create src/components/console/GlobalEStopButton.tsx taking `{ activeTaskIds: string[]; dispatch: (a: RunMapAction) => void }`. Render a shadcn `Button variant="destructive"` with Lucide `OctagonX`, label "E-Stop All", `disabled={activeTaskIds.length === 0}`, wrapped in an `AlertDialog` (already present in src/components/ui/) per 75-PATTERNS: title "Emergency Stop All Runs", body "This will cancel all {activeTaskIds.length} active run(s). Agents will stop at their next safe checkpoint.", actions Cancel(AlertDialogCancel) / "Stop All Runs"(AlertDialogAction destructive). On confirm run `handleEStopAll`: `await Promise.allSettled(activeTaskIds.map((id) => cancelTask(id)))` then `dispatch({ type: "SET_STOPPING", taskId: id })` for each id; surface a toast.error if any settle rejects (D-08 global e-stop, D-10 confirm-before). Then extend src/components/RunSummary.tsx: add optional props `filesTouched?: string[]; prompt?: string; engine?: string; model?: string; workdir?: string; agentPersona?: string` to RunSummaryProps. Add a "Run Config" section (reusing the StatCard / `bg-(--card) border border-(--border) rounded p-3` pattern) showing engine/model/workdir/persona/prompt, and a "Files Touched" section (mirroring the existing tool-usage container ~111-125). CRITICAL v1 empty-state (D-12 / resolved open question 2): when `filesTouched` is undefined/empty render a graceful "not available" message (NOT a crash or silent blank); likewise render token/cost stat values as a graceful "not available" when those are undefined — the gateway "completed" event carries only `{ returncode }` in v1. Do NOT parse claude stream-json for file ops (deferred). Keep all existing RunSummary behavior unchanged. Use Lucide icons + Tailwind `bg-(--token)` syntax. Write GlobalEStopButton.test.tsx covering behaviors 1-4 and add RunSummary assertions for 5-6 (in GlobalEStopButton.test.tsx or a co-located RunSummary test — choose per repo convention). Trace: 75-VALIDATION.md row "Global e-stop iterates DELETE over all active task IDs".
  </action>
  <verify>
    <automated>npx vitest run src/components/console/GlobalEStopButton.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - GlobalEStopButton disabled with zero active runs; confirm dialog names the active count
    - Confirm calls cancelTask for every active id (Promise.allSettled) and dispatches SET_STOPPING per id
    - RunSummary renders Run Config + Files Touched sections; undefined filesTouched/token/cost → graceful "not available" (no crash)
    - No claude stream-json parsing added for files (grep: no stream-json file-op parsing in RunSummary)
    - `npx vitest run src/components/console/GlobalEStopButton.test.tsx` passes; `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>Confirmed global e-stop + empty-state-aware richer RunSummary shipped and tested.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → gateway DELETE (:8200) | Per-run and bulk cancellation cross to the gateway |
| run summary data → DOM | Summary fields (prompt, files) render into the page |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-75-12 | Denial of Service | accidental mass cancellation | mitigate | Global e-stop requires an AlertDialog confirm (D-10) naming the active count before iterating DELETE; per-run Stop only targets its own task_id |
| T-75-13 | Tampering | XSS via prompt/files in summary | mitigate | RunSummary renders prompt/file strings as React children (escaped), never dangerouslySetInnerHTML (V5) |
| T-75-14 | Repudiation | cancel wires to hard pid-kill instead of flag | mitigate | Stop calls cancelTask → DELETE /tasks/{id} → task_manager.cancel() (asyncio CancelledError), NOT adapter pid-kill — satisfies CON-03 cancellation-flag requirement (75-RESEARCH anti-pattern) |
| T-75-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs; AlertDialog/Button already in src/components/ui/. No legitimacy gate needed |
</threat_model>

<verification>
- `npx vitest run src/components/console/RunCard.test.tsx src/components/console/GlobalEStopButton.test.tsx` green
- `npx tsc --noEmit` clean
- No optimistic "stopped" set; no pid-kill path; summary empty-states do not crash on undefined data
</verification>

<success_criteria>
- Per-run Stop + confirmed global e-stop wire to DELETE (cancellation flag, not pid-kill) — CON-03
- RunSummary renders the richer reproducible record with graceful v1 empty-states — CON-04 render path
</success_criteria>

<output>
Create `.planning/phases/75-agent-console/75-05-SUMMARY.md` when done
</output>
