---
phase: 75-agent-console
plan: 03
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/lib/astridrApi.ts
  - src/lib/astridrApi.test.ts
  - convex/schema.ts
  - convex/agentRuns.ts
  - convex/agentRuns.test.ts
autonomous: true
requirements: [CON-01, CON-04]

must_haves:
  truths:
    - "submitTask POSTs to the gateway /tasks with a Bearer gateway key and returns { task_id }"
    - "cancelTask DELETEs /tasks/{id} on the gateway with the Bearer gateway key"
    - "gateway calls use VITE_GATEWAY_URL/VITE_GATEWAY_API_KEY, never the Ástríðr main-API base/key"
    - "saveRunSummary upserts a run into the agentRuns table idempotently by taskId"
    - "listRecent returns recent agentRuns ordered by startedAt desc"
  artifacts:
    - path: "src/lib/astridrApi.ts"
      provides: "gatewayRequest, submitTask, cancelTask, gatewayWsBase, TaskRequest, TaskSubmitResponse"
      exports: ["submitTask", "cancelTask", "gatewayWsBase"]
    - path: "convex/schema.ts"
      provides: "agentRuns table definition with by_taskId / by_status / by_startedAt indexes"
      contains: "agentRuns: defineTable"
    - path: "convex/agentRuns.ts"
      provides: "saveRunSummary mutation (idempotent upsert) + listRecent query"
      exports: ["saveRunSummary", "listRecent"]
  key_links:
    - from: "src/lib/astridrApi.ts submitTask/cancelTask"
      to: "gateway :8200 /tasks"
      via: "gatewayRequest using VITE_GATEWAY_URL + Bearer VITE_GATEWAY_API_KEY"
      pattern: "VITE_GATEWAY_(URL|API_KEY)"
    - from: "convex/agentRuns.ts saveRunSummary"
      to: "agentRuns table"
      via: "withIndex by_taskId upsert then insert"
      pattern: "withIndex\\(['\"]by_taskId['\"]"
---

<objective>
Build the network + persistence layer for the Agent Console: gateway HTTP helpers (submitTask/cancelTask) that target the :8200 gateway with its own auth, and the Convex agentRuns table + saveRunSummary/listRecent for run history. Covers CON-01 (POST/DELETE transport) and CON-04 (Convex persistence).

Purpose: The gateway runs on :8200 with a separate Bearer key — using the existing apiRequest (which targets :8181) would hit the wrong service. This plan adds a parallel `gatewayRequest` path and the agentRuns store, both unit-tested with mocked fetch / a Convex test harness, decoupled from any UI.

Output: extended src/lib/astridrApi.ts (+test), new convex/agentRuns.ts (+test), extended convex/schema.ts.
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
<!-- Existing astridrApi.ts (75-PATTERNS §astridrApi.ts) — DO NOT reuse for gateway -->
ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL   // :8181 — Ástríðr main API
apiRequest<T>(path, init)        // uses ASTRIDR_API_BASE — WRONG port for gateway
authHeaders()                    // Bearer VITE_ASTRIDR_API_KEY
class AstridrApiError(status, message)   // reuse for gateway errors

<!-- NEW gateway section to append (75-PATTERNS §astridrApi.ts gateway block, verbatim shape) -->
GATEWAY_API_BASE = import.meta.env.VITE_GATEWAY_URL ?? "http://localhost:8200"
GATEWAY_API_KEY  = import.meta.env.VITE_GATEWAY_API_KEY ?? ""
gatewayAuthHeaders()  // Content-Type json + Bearer GATEWAY_API_KEY if set
gatewayRequest<T>(path, init)  // fetch GATEWAY_API_BASE+path, throws AstridrApiError on !ok
TaskRequest = { prompt; provider: "claude-cli"|"codex"|"auto"; working_dir?; max_turns?; timeout_seconds?; system_prompt_append? }
   // NOTE: NO `model` field yet — paired Ástríðr change (Plan 75-01). Omit model from POST body until it lands.
TaskSubmitResponse = { task_id: string }
submitTask(req): POST /tasks → { task_id }
cancelTask(taskId): DELETE /tasks/{taskId} → void
gatewayWsBase(): VITE_GATEWAY_WS_URL ?? GATEWAY_API_BASE.replace(/^http/, "ws")

<!-- Convex agentRuns table (75-PATTERNS §convex/schema.ts, verbatim) -->
agentRuns: defineTable({ taskId, provider, status, prompt, workdir?, model?, agentPersona?,
  rounds?, inputTokens?, outputTokens?, costUsd?, filesTouched?: v.array(v.string()),
  startedAt, completedAt?, durationMs?, errorMessage? })
  .index("by_taskId", ["taskId"]).index("by_status", ["status","startedAt"]).index("by_startedAt", ["startedAt"])

<!-- Convex agentRuns.ts analog: convex/runBlocks.ts -->
saveRunSummary(mutation): upsert by taskId — if existing row by_taskId, return existing._id; else insert
listRecent(query): withIndex by_startedAt .order("desc").take(50)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add gateway HTTP layer (submitTask, cancelTask) to astridrApi.ts</name>
  <files>src/lib/astridrApi.ts, src/lib/astridrApi.test.ts</files>
  <read_first>
    - src/lib/astridrApi.ts (existing base URL/auth pattern lines 1-2, authHeaders/apiRequest, AstridrApiError; the War Room / Meeting Bot sections as the append-style precedent)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ src/lib/astridrApi.ts — verbatim gateway section)
    - .planning/phases/75-agent-console/75-RESEARCH.md (§ Pitfall 1 "Two Base URLs"; § Pitfall 4 "No model field"; § Pattern 1)
  </read_first>
  <behavior>
    - Test 1: submitTask POSTs to `${VITE_GATEWAY_URL}/tasks` with method POST, JSON body, and Authorization: Bearer ${VITE_GATEWAY_API_KEY}; resolves to the parsed { task_id }
    - Test 2: submitTask does NOT include the Ástríðr main-API base/key (asserts the fetch URL starts with the gateway base, not VITE_ASTRIDR_API_URL)
    - Test 3: cancelTask issues DELETE to `${VITE_GATEWAY_URL}/tasks/{id}` with the gateway Bearer header
    - Test 4: a non-ok response throws AstridrApiError carrying the status
    - Test 5: gatewayWsBase() derives ws://… from the http gateway base when VITE_GATEWAY_WS_URL is unset
  </behavior>
  <action>
    Append a "Phase 75: Agent Console — Gateway Task API (:8200)" section to src/lib/astridrApi.ts following 75-PATTERNS.md verbatim: `GATEWAY_API_BASE` (VITE_GATEWAY_URL ?? "http://localhost:8200"), `GATEWAY_API_KEY` (VITE_GATEWAY_API_KEY ?? ""), `gatewayAuthHeaders()`, `gatewayRequest<T>()` (mirrors apiRequest but uses GATEWAY_API_BASE + gatewayAuthHeaders, reuses the existing AstridrApiError), the `TaskRequest` interface (WITHOUT a `model` field — omit per 75-PATTERNS anti-pattern 7 until the paired Ástríðr change in Plan 75-01 lands; Pydantic would silently drop it), `TaskSubmitResponse`, `submitTask(req)` (POST /tasks), `cancelTask(taskId)` (DELETE /tasks/{taskId}), and `gatewayWsBase()` (VITE_GATEWAY_WS_URL ?? GATEWAY_API_BASE.replace(/^http/, "ws")). Do NOT modify the existing `apiRequest`/`authHeaders`/`ASTRIDR_API_BASE` — keep the two transports fully separate (75-PATTERNS anti-pattern 4). Write src/lib/astridrApi.test.ts (or extend it) mocking global fetch to assert URL, method, headers, and error mapping. Trace: 75-VALIDATION.md rows "submitTask → POST /tasks" and "cancelTask → DELETE /tasks/{id}".
  </action>
  <verify>
    <automated>npx vitest run src/lib/astridrApi.test.ts -t "submitTask"</automated>
  </verify>
  <acceptance_criteria>
    - astridrApi.ts exports submitTask, cancelTask, gatewayWsBase
    - submitTask/cancelTask fetch URLs start with GATEWAY_API_BASE (:8200), not VITE_ASTRIDR_API_URL (proven by a test asserting the URL prefix)
    - TaskRequest has NO `model` field (grep: no `model` key in the TaskRequest interface)
    - `npx vitest run src/lib/astridrApi.test.ts -t "submitTask"` and `-t "cancelTask"` pass
    - `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>Gateway HTTP helpers added with their own base+auth, separate from the Ástríðr main API, tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add agentRuns table + saveRunSummary/listRecent to Convex</name>
  <files>convex/schema.ts, convex/agentRuns.ts, convex/agentRuns.test.ts</files>
  <read_first>
    - convex/schema.ts (existing gatewayTasks table ~lines 1402-1415 — the closest analog for the new table + index pattern)
    - convex/runBlocks.ts (mutation + query import/structure pattern; .order("desc").take(N))
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ convex/agentRuns.ts and § convex/schema.ts — verbatim table + functions)
    - .planning/phases/75-agent-console/75-RESEARCH.md (§ Pattern 4 — idempotent upsert by taskId)
  </read_first>
  <behavior>
    - Test 1: saveRunSummary inserts a new agentRuns row when no row exists for the taskId, returning its _id
    - Test 2: saveRunSummary called twice with the same taskId does NOT create a second row (returns the existing _id) — idempotent upsert
    - Test 3: listRecent returns rows ordered by startedAt descending, capped at 50
    - Test 4: a saved row round-trips the full reproducible record fields (provider, status, prompt, workdir, model, agentPersona, rounds, tokens, costUsd, filesTouched, startedAt, completedAt, durationMs, errorMessage)
  </behavior>
  <action>
    Extend convex/schema.ts by adding the `agentRuns` table verbatim per 75-PATTERNS.md (fields: taskId, provider, status, prompt, workdir?, model?, agentPersona?, rounds?, inputTokens?, outputTokens?, costUsd?, filesTouched? as v.array(v.string()), startedAt, completedAt?, durationMs?, errorMessage?) with indexes `by_taskId`, `by_status` (["status","startedAt"]), `by_startedAt`. Create convex/agentRuns.ts mirroring convex/runBlocks.ts: `saveRunSummary` mutation whose handler first queries `withIndex("by_taskId", q => q.eq("taskId", args.taskId)).first()` and returns the existing `_id` if present, else `ctx.db.insert("agentRuns", args)` — this idempotency is the v1 guard against duplicate history rows when a terminal-state effect fires more than once. `listRecent` query: `withIndex("by_startedAt").order("desc").take(50)`. Define the mutation args with `v.` validators matching the table (optional fields as `v.optional`). filesTouched will be undefined in v1 (gateway emits no file data — 75-RESEARCH D-12 finding); the schema still accepts it for forward-compat. Write convex/agentRuns.test.ts using the project's Convex test harness (follow any existing convex/*.test.ts pattern in the repo) covering insert, idempotent re-save, listRecent ordering, and full-field round-trip. Trace: 75-VALIDATION.md row "saveRunSummary mutation upserts by taskId (idempotent)".
  </action>
  <verify>
    <automated>npx vitest run convex/agentRuns.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - convex/schema.ts contains `agentRuns: defineTable` with the by_taskId/by_status/by_startedAt indexes
    - convex/agentRuns.ts exports saveRunSummary (mutation) and listRecent (query)
    - saveRunSummary is idempotent by taskId (a test proves a second call with the same taskId inserts no new row)
    - `npx vitest run convex/agentRuns.test.ts` passes
    - `npx tsc --noEmit` clean (Convex codegen types resolve)
  </acceptance_criteria>
  <done>agentRuns table + idempotent saveRunSummary + listRecent shipped and tested.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → gateway (:8200) | Mutating POST/DELETE /tasks cross from the browser to the gateway |
| client → Convex cloud | Run-summary writes cross from the browser to the cloud DB |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-75-05 | Spoofing | gateway POST/DELETE | mitigate | submitTask/cancelTask attach Bearer VITE_GATEWAY_API_KEY via gatewayAuthHeaders (V2); the gateway enforces require_gateway_key on these routes |
| T-75-06 | Tampering | duplicate/forged history rows | mitigate | saveRunSummary upserts idempotently by taskId — replays or double-fires cannot create duplicate or conflicting history rows |
| T-75-07 | Information Disclosure | VITE_GATEWAY_API_KEY in bundle | accept | Vite inlines VITE_* into the bundle; localhost-only deployment mitigates (75-RESEARCH § Security Domain). Documented accepted risk |
| T-75-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs in this plan; uses existing convex + fetch. No legitimacy gate needed |
</threat_model>

<verification>
- `npx vitest run src/lib/astridrApi.test.ts convex/agentRuns.test.ts` green
- `npx tsc --noEmit` clean
- Existing apiRequest/authHeaders/ASTRIDR_API_BASE unchanged (diff shows only additive gateway section)
</verification>

<success_criteria>
- submitTask/cancelTask transport CON-01 over the gateway with correct base+auth, isolated from the Ástríðr main API
- agentRuns table + idempotent saveRunSummary + listRecent deliver CON-04 persistence
</success_criteria>

<output>
Create `.planning/phases/75-agent-console/75-03-SUMMARY.md` when done
</output>
