---
phase: 75-agent-console
plan: 02
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/lib/runUtils.ts
  - src/lib/runUtils.test.ts
  - src/lib/runReducer.ts
  - src/lib/runReducer.test.ts
  - src/pages/LiveRun.tsx
autonomous: true
requirements: [CON-02, CON-03]

must_haves:
  truths:
    - "appendBlocksWithDedup drops tool_use/tool_result blocks and caps the buffer at 500"
    - "runMapReducer folds gateway TaskEvents onto a Map<taskId, RunState> without mutating in place"
    - "A run in 'stopping' transitions to 'stopped' on WS close (CLOSED action), not on a cancel event"
    - "A run in 'running'/'queued' transitions to 'completed' on WS close"
    - "D-07: run state is keyed by runId in a Map<taskId, RunState> to support multiple concurrent runs"
    - "D-09: a stopping run stays in the 'Stopping…' pending state until the WS closes — never optimistically marked stopped"
  artifacts:
    - path: "src/lib/runUtils.ts"
      provides: "appendBlocksWithDedup, BLOCK_CAP, Block type — extracted from LiveRun.tsx"
      exports: ["appendBlocksWithDedup", "BLOCK_CAP"]
    - path: "src/lib/runReducer.ts"
      provides: "runMapReducer, RunState, GatewayRunStatus, RunMapAction, TaskEvent, foldEvent"
      exports: ["runMapReducer", "RunState", "GatewayRunStatus", "RunMapAction"]
    - path: "src/lib/runReducer.test.ts"
      provides: "Coverage for ADD_RUN, EVENT fold, SET_STOPPING, CLOSED, stopping→stopped"
  key_links:
    - from: "src/pages/LiveRun.tsx"
      to: "src/lib/runUtils.ts"
      via: "import after extraction (no longer defines appendBlocksWithDedup locally)"
      pattern: "from ['\"]@/lib/runUtils['\"]"
    - from: "src/lib/runReducer.ts"
      to: "src/lib/runUtils.ts"
      via: "appendBlocksWithDedup used inside foldEvent"
      pattern: "appendBlocksWithDedup"
---

<objective>
Build the pure-logic core of the multi-run Agent Console: extract the block utility into a shared module and create the Map-keyed run-reducer state machine. This is the testable heart of CON-02 (run-reducer visualization) and the stopping→stopped transition of CON-03.

Purpose: LiveRun.tsx is single-run (`liveSessionId` + `RunMeta`). Phase 75 needs concurrent runs keyed by gateway `task_id`. This plan delivers `runMapReducer` (a `Map<string, RunState>` reducer) and the extracted `runUtils`, both fully unit-tested, with NO UI or network coupling so they can be verified in isolation.

Output: src/lib/runUtils.ts (+test), src/lib/runReducer.ts (+test), and LiveRun.tsx updated to import the extracted util.
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
@.planning/phases/75-agent-console/75-VALIDATION.md

<interfaces>
<!-- VERBATIM extract from LiveRun.tsx:21-32 (move into runUtils.ts) -->
BLOCK_CAP = 500
type Block = { type: string; [key: string]: unknown }
appendBlocksWithDedup(prev: Block[], incoming: Block[]): Block[]
  // filters out b.type === "tool_use" | "tool_result", appends, slices to last BLOCK_CAP

<!-- Gateway TaskEvent shape (75-RESEARCH §"TaskEvent Shape", verified live) -->
TaskEvent = { task_id: string; timestamp: string; event_type: string; provider: string; data: Record<string, unknown> }

<!-- event_type taxonomy (75-RESEARCH §"Confirmed event_type Taxonomy") -->
"started"   → status running; data { command, working_dir }
"progress"  → append blocks (claude stream-json pass-through)
"output"    → append blocks; data { text }
"completed" → status completed; data { returncode } ONLY (no token/cost/files in v1)
"error"     → status error; data { error, returncode? }

<!-- RunState + GatewayRunStatus (75-PATTERNS §runReducer.ts) -->
GatewayRunStatus = "queued" | "running" | "stopping" | "completed" | "error" | "stopped"
RunState = { taskId, status, provider, prompt, workdir, model?, agentPersona?, blocks: Block[],
             rounds, startedAt, completedAt?, inputTokens?, outputTokens?, cost?, filesTouched?, autoScroll }
RunMapAction = ADD_RUN | EVENT | SET_STOPPING | CLOSED | ERROR | SET_AUTOSCROLL

<!-- CRITICAL: cancel-ack is WS close, NOT an event_type. CLOSED on "stopping" → "stopped". -->
<!-- CRITICAL: always `const next = new Map(state)` before set; return original `state` ref on no-op. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract appendBlocksWithDedup into src/lib/runUtils.ts</name>
  <files>src/lib/runUtils.ts, src/lib/runUtils.test.ts, src/pages/LiveRun.tsx</files>
  <read_first>
    - src/pages/LiveRun.tsx (lines 17-32 — Block type, BLOCK_CAP, appendBlocksWithDedup to move; and all current import sites of appendBlocksWithDedup)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ src/lib/runUtils.ts — verbatim extract + import pattern)
  </read_first>
  <behavior>
    - Test 1: appendBlocksWithDedup filters out blocks with type "tool_use" and "tool_result"
    - Test 2: appendBlocksWithDedup appends remaining incoming blocks to prev in order
    - Test 3: when combined length exceeds BLOCK_CAP (500), returns only the last 500 (drops oldest)
    - Test 4: BLOCK_CAP exported equals 500
  </behavior>
  <action>
    Create src/lib/runUtils.ts exporting `BLOCK_CAP = 500`, the `Block` type (`{ type: string; [key: string]: unknown }`), and `appendBlocksWithDedup(prev, incoming)` — moved VERBATIM from LiveRun.tsx:21-32 (per 75-PATTERNS.md). Then update src/pages/LiveRun.tsx to import `{ appendBlocksWithDedup, BLOCK_CAP, type Block }` from `@/lib/runUtils` and DELETE the now-duplicated local definitions (lines 17, 21, 23-32). Keep LiveRun's existing behavior identical — this is a pure extraction, no logic change. Write src/lib/runUtils.test.ts covering the four behaviors above. Trace: 75-VALIDATION.md row "appendBlocksWithDedup caps at 500 + dedupes".
  </action>
  <verify>
    <automated>npx vitest run src/lib/runUtils.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - src/lib/runUtils.ts exports appendBlocksWithDedup, BLOCK_CAP (=500), Block
    - LiveRun.tsx imports from @/lib/runUtils and no longer defines them locally (grep: no second `function appendBlocksWithDedup` in LiveRun.tsx)
    - `npx vitest run src/lib/runUtils.test.ts` passes (≥4 assertions: dedup, append-order, cap-at-500, BLOCK_CAP value)
    - `npx tsc --noEmit` clean for the touched files
  </acceptance_criteria>
  <done>appendBlocksWithDedup/BLOCK_CAP/Block live in runUtils.ts, LiveRun imports them, tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build the Map-keyed run-reducer in src/lib/runReducer.ts</name>
  <files>src/lib/runReducer.ts, src/lib/runReducer.test.ts</files>
  <read_first>
    - src/hooks/useLiveState.ts (discriminated-union action + useReducer pattern analog)
    - src/lib/runUtils.ts (appendBlocksWithDedup, Block — created in Task 1)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ src/lib/runReducer.ts — RunState/GatewayRunStatus types, immutability pattern, CLOSED transition)
    - .planning/phases/75-agent-console/75-RESEARCH.md (§ Pattern 3 foldEvent table; § "Cancel-ack finding"; Pitfall 6 Map mutation)
  </read_first>
  <behavior>
    - Test 1: ADD_RUN inserts a RunState keyed by taskId with status "queued", blocks [], startedAt set, autoScroll true, and provider/prompt/workdir/model/agentPersona copied from the request
    - Test 2: EVENT with event_type "started" sets status "running"
    - Test 3: EVENT with event_type "progress"/"output" appends blocks via appendBlocksWithDedup
    - Test 4: EVENT with event_type "completed" sets status "completed" and completedAt
    - Test 5: EVENT with event_type "error" sets status "error" and appends an error block
    - Test 6: SET_STOPPING sets status "stopping"
    - Test 7: CLOSED on a "stopping" run → status "stopped" + completedAt (cancel-ack = WS close, no cancel event)
    - Test 8: CLOSED on a "running"/"queued" run → status "completed" + completedAt
    - Test 9: EVENT/CLOSED for an unknown taskId returns the SAME state reference (no-op)
    - Test 10: every mutating action returns a NEW Map reference (referential inequality vs input)
  </behavior>
  <action>
    Create src/lib/runReducer.ts exporting `GatewayRunStatus`, `RunState`, `TaskEvent`, `RunMapAction`, and `runMapReducer(state: Map<string, RunState>, action: RunMapAction): Map<string, RunState>`. Types verbatim from 75-PATTERNS.md. Implement a private `foldEvent(run: RunState, event: TaskEvent): RunState` mapping event_type per the 75-RESEARCH foldEvent table ("started"→running; "progress"/"output"→appendBlocksWithDedup; "completed"→completed+completedAt; "error"→error+append error block). CRITICAL immutability: always `const next = new Map(state)` before `next.set(...)`; return the original `state` ref for unknown taskIds and unknown action types (no-op). CRITICAL cancel semantics: the CLOSED action drives terminal transitions — `stopping → stopped`, `running|queued → completed` — because the gateway emits NO "cancelled" event_type (the WS simply closes; per 75-RESEARCH "Cancel-ack finding"). Do NOT auto-populate inputTokens/outputTokens/cost/filesTouched from events — the gateway "completed" event carries only `{ returncode }` in v1; leave those undefined. Write src/lib/runReducer.test.ts covering all ten behaviors. Trace: 75-VALIDATION.md rows "runMapReducer folds EVENT/CLOSED/ERROR" and "stopping → stopped transition on WS close".
  </action>
  <verify>
    <automated>npx vitest run src/lib/runReducer.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - runReducer.ts exports runMapReducer, RunState, GatewayRunStatus, RunMapAction, TaskEvent
    - `npx vitest run src/lib/runReducer.test.ts -t "stopping to stopped"` passes (CLOSED-on-stopping → stopped)
    - Reducer never mutates input Map: a dedicated test asserts `runMapReducer(m, action) !== m` for mutating actions and `=== m` for no-ops
    - No event-path code reads a "cancelled" event_type (grep: no literal "cancelled" event branch)
    - `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>runMapReducer + RunState fully implemented and tested; CLOSED drives stopping→stopped; immutability enforced.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| gateway WS stream → reducer | Untrusted JSON frames from the gateway WS are folded into client state |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-75-03 | Denial of Service | unbounded block buffer | mitigate | appendBlocksWithDedup caps the per-run buffer at BLOCK_CAP=500, preventing unbounded DOM/memory growth from a chatty stream (V5) |
| T-75-04 | Tampering | spoofed "cancelled" event leaving a run stuck | mitigate | stopping→stopped is driven by ws.onclose (CLOSED action), not a stream event_type — a malicious frame cannot fake a terminal cancel nor leave the UI permanently "stopping" |
| T-75-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs in this plan; uses existing deps only. No legitimacy gate needed |
</threat_model>

<verification>
- `npx vitest run src/lib/runUtils.test.ts src/lib/runReducer.test.ts` green
- `npx tsc --noEmit` clean
- LiveRun.tsx imports appendBlocksWithDedup from @/lib/runUtils (no local redefinition)
</verification>

<success_criteria>
- Block utility extracted and reused (no duplication)
- runMapReducer correctly folds the full TaskEvent taxonomy onto Map<taskId, RunState> (CON-02)
- stopping→stopped on WS close verified in isolation (CON-03 logic)
- Map immutability discipline enforced by test
</success_criteria>

<output>
Create `.planning/phases/75-agent-console/75-02-SUMMARY.md` when done
</output>
