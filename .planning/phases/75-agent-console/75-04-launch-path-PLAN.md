---
phase: 75-agent-console
plan: 04
type: execute
wave: 2
depends_on: [75-03]
files_modified:
  - src/hooks/useTaskStream.ts
  - src/lib/astridrApi.ts
  - src/components/console/NewRunModal.tsx
  - src/components/console/NewRunModal.test.tsx
  - src/components/console/WorkdirPicker.tsx
autonomous: true
requirements: [CON-01, CON-02]

must_haves:
  truths:
    - "useTaskStream opens a single WS to gateway /tasks/{id}/stream, dispatches EVENT per frame, dispatches CLOSED on close, and never reconnects"
    - "NewRunModal collects engine/workdir/prompt/model/max-rounds/persona, calls submitTask, and reports the returned task_id to the parent"
    - "WorkdirPicker tries the M1.P3 browse picker and falls back to a free-text absolute-path Input when browse is unavailable"
  artifacts:
    - path: "src/hooks/useTaskStream.ts"
      provides: "useTaskStream(taskId, dispatch) — per-run gateway WS hook"
      exports: ["useTaskStream"]
    - path: "src/components/console/NewRunModal.tsx"
      provides: "Launch dialog mirroring WarRoomLaunchDialog"
      exports: ["NewRunModal"]
    - path: "src/components/console/WorkdirPicker.tsx"
      provides: "M1.P3 browse picker + free-text fallback"
      exports: ["WorkdirPicker"]
  key_links:
    - from: "src/hooks/useTaskStream.ts"
      to: "gateway ws /tasks/{id}/stream"
      via: "gatewayWsBase() WebSocket, no auth, 50ms StrictMode delay, terminal (no reconnect)"
      pattern: "gatewayWsBase"
    - from: "src/components/console/NewRunModal.tsx"
      to: "src/lib/astridrApi.ts submitTask + fetchAgents"
      via: "launch handler"
      pattern: "submitTask"
---

<objective>
Build the launch path of the Agent Console: the per-run gateway WebSocket hook (`useTaskStream`), the New Run launch modal, and the WorkdirPicker. These produce a task (POST), correlate it to its live stream (WS), and feed the run-reducer. Covers CON-01 (launch) and CON-02 (stream consumption).

Purpose: A launched task is correlated to its WS stream via the returned task_id (D-06). The gateway task stream is a SEPARATE WS from AstridrWSContext (:8181 telemetry) — it needs its own terminal, unauthenticated, per-task hook. The modal mirrors WarRoomLaunchDialog (D-02) with the locked v1 field set (D-04).

Output: src/hooks/useTaskStream.ts, src/components/console/NewRunModal.tsx (+test), src/components/console/WorkdirPicker.tsx, and browse helpers appended to astridrApi.ts.
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
@.planning/phases/75-agent-console/75-03-SUMMARY.md

<interfaces>
<!-- From Plan 75-03 (astridrApi.ts) -->
submitTask(req: TaskRequest): Promise<{ task_id: string }>
gatewayWsBase(): string   // ws://localhost:8200 (or VITE_GATEWAY_WS_URL)
TaskRequest = { prompt; provider: "claude-cli"|"codex"|"auto"; working_dir?; max_turns?; timeout_seconds?; system_prompt_append? }   // NO model field yet

<!-- From Plan 75-02 (runReducer.ts) -->
RunMapAction = { type: "EVENT"; taskId; event: TaskEvent } | { type: "CLOSED"; taskId } | { type: "ERROR"; taskId; error } | ...
TaskEvent = { task_id; timestamp; event_type; provider; data }

<!-- Existing astridrApi.ts (75-PATTERNS) -->
fetchAgents()   // already feeds the persona selector
apiRequest<T>() / authHeaders()  // :8181 — used for the scoped-token + browse fetch
class AstridrApiError(status, message)

<!-- useTaskStream lifecycle (75-PATTERNS §useTaskStream.ts; 75-RESEARCH §Pattern 2) -->
- WS to `${gatewayWsBase()}/tasks/${taskId}/stream` — NO auth headers (route is open, 75-RESEARCH Pitfall 5)
- onmessage: JSON.parse → dispatch EVENT (ignore malformed frames)
- onclose: dispatch CLOSED ; onerror: dispatch ERROR
- 50ms setTimeout before connect (StrictMode double-mount guard, AstridrWSContext:289-292)
- cleanup: clearTimeout, set ws.onclose=null (prevent post-unmount dispatch), ws.close()
- NO reconnect (task streams are terminal)
- mount EXACTLY ONCE per taskId (75-RESEARCH Pitfall 7)

<!-- NewRunModal field spec (75-UI-SPEC §New Run Modal) -->
Engine(Select: Claude Code→claude-cli / Codex→codex, default claude-cli) · WorkingDirectory(WorkdirPicker, required) ·
Prompt(Textarea rows=4, required) · Model(Select, optional — UI only, OMIT from POST body until paired Ástríðr change) ·
MaxRounds(Input number min1 max50 → max_turns, optional) · AgentPersona(Select via fetchAgents → system_prompt_append, optional)
Footer: Cancel(outline) | Launch Run(bg-primary, Play icon, "Launching…" while pending)

<!-- Browse routes (75-RESEARCH §Pattern 5) — scoped gateway:read token, falls back to free-text -->
GET /browse/repos → [{ name, path }]   (Authorization: Bearer <scoped gateway:read token from POST /api/access/token>)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build useTaskStream — per-run gateway WS hook</name>
  <files>src/hooks/useTaskStream.ts</files>
  <read_first>
    - src/contexts/AstridrWSContext.tsx (WS lifecycle: connect/onmessage/onclose/onerror, the 50ms StrictMode delay ~lines 289-292, the ws.onclose=null cleanup ~line 296)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ src/hooks/useTaskStream.ts — distilled lifecycle, imports)
    - .planning/phases/75-agent-console/75-RESEARCH.md (§ Pattern 2; Pitfall 5 no-auth; Pitfall 7 single-mount)
    - src/lib/runReducer.ts (RunMapAction type — created in Plan 75-02)
  </read_first>
  <behavior>
    - Test 1: given a taskId, the hook opens a WebSocket to `${gatewayWsBase()}/tasks/${taskId}/stream` (assert the URL) with no auth protocols
    - Test 2: an incoming JSON frame dispatches { type: "EVENT", taskId, event } with the parsed TaskEvent
    - Test 3: a malformed (non-JSON) frame is ignored (no dispatch)
    - Test 4: ws.onclose dispatches { type: "CLOSED", taskId }
    - Test 5: on unmount, the hook closes the socket and does NOT dispatch CLOSED afterward (onclose nulled)
    - Test 6: taskId null → no socket opened
  </behavior>
  <action>
    Create src/hooks/useTaskStream.ts exporting `useTaskStream(taskId: string | null, dispatch: (a: RunMapAction) => void)`. Build the WS URL from `gatewayWsBase()` (imported from @/lib/astridrApi) + `/tasks/${taskId}/stream`. In a useEffect keyed on [taskId, dispatch]: if taskId is null, no-op; otherwise schedule `new WebSocket(url)` behind a 50ms setTimeout (StrictMode guard, per AstridrWSContext). Wire onmessage → JSON.parse the frame and dispatch `{ type: "EVENT", taskId, event }`, swallowing parse errors; onclose → dispatch `{ type: "CLOSED", taskId }`; onerror → dispatch `{ type: "ERROR", taskId, error: "WS error" }`. Cleanup MUST clearTimeout, set `ws.onclose = null` before `ws.close()` to prevent a post-unmount CLOSED dispatch (75-PATTERNS), and there is NO reconnect logic. Do NOT attach Authorization headers or subprotocols — the WS route is unauthenticated (75-RESEARCH Pitfall 5). Do NOT route through AstridrWSContext/subscribeEvent (75-PATTERNS anti-pattern 1). Write the test using a mock WebSocket (jsdom — follow any existing WS-mocking pattern in src/test/setup.ts or stub globalThis.WebSocket).
  </action>
  <verify>
    <automated>npx vitest run src/hooks/useTaskStream.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - useTaskStream opens exactly one WS per non-null taskId to the gateway WS base (not :8181)
    - onmessage dispatches EVENT with parsed TaskEvent; malformed frames are ignored
    - onclose dispatches CLOSED; post-unmount no CLOSED is dispatched (onclose nulled before close)
    - No reconnect logic and no auth headers on the WebSocket (grep: no "Bearer"/"Authorization" in useTaskStream.ts)
    - `npx vitest run src/hooks/useTaskStream.test.ts` passes; `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>Terminal, unauthenticated, StrictMode-safe per-run WS hook dispatching into the run-reducer; tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Build NewRunModal + WorkdirPicker + browse helpers</name>
  <files>src/components/console/NewRunModal.tsx, src/components/console/NewRunModal.test.tsx, src/components/console/WorkdirPicker.tsx, src/lib/astridrApi.ts</files>
  <read_first>
    - src/components/hr/WarRoomLaunchDialog.tsx (exact structural analog: Dialog shell, state-reset-on-open, launch handler, footer buttons, field stacks)
    - .planning/phases/75-agent-console/75-PATTERNS.md (§ NewRunModal.tsx, § WorkdirPicker.tsx, § astridrApi.ts browse helpers)
    - .planning/phases/75-agent-console/75-UI-SPEC.md (§ New Run Modal field spec, § Copywriting Contract, modal width sm:max-w-[520px])
    - src/lib/astridrApi.ts (fetchAgents, apiRequest, authHeaders, AstridrApiError; the gateway section from Plan 75-03)
  </read_first>
  <behavior>
    - Test 1: NewRunModal renders the six fields (Engine, Working Directory, Prompt, Model, Max Rounds, Agent/Persona) with the UI-SPEC placeholders
    - Test 2: the Launch button is disabled until both prompt and workdir are non-empty
    - Test 3: clicking Launch calls submitTask with provider/working_dir/prompt/max_turns/system_prompt_append (and NOT a `model` key in the body)
    - Test 4: on submitTask success the modal calls onTaskSubmitted(task_id), shows a success toast, and closes (onOpenChange(false))
    - Test 5: on submitTask rejection the modal shows an error toast and stays open
    - Test 6: WorkdirPicker renders a free-text Input fallback when GET /browse/repos rejects
  </behavior>
  <action>
    Create src/components/console/WorkdirPicker.tsx as a two-mode control (D-03): on mount it attempts the M1.P3 browse path and, on any failure, renders a free-text `Input` (placeholder "Absolute path (e.g. /home/user/project)") that calls `onChange`. Append browse helpers to src/lib/astridrApi.ts: `RepoInfo { name; path }` and `fetchBrowseRepos()` which first obtains a `gateway:read` scoped token via `POST /api/access/token` on the Ástríðr main API (apiRequest/authHeaders, :8181) then `fetch ${GATEWAY_API_BASE}/browse/repos` with `Authorization: Bearer <scoped-token>` (NOTE: browse uses the scoped token, NOT GATEWAY_API_KEY — 75-RESEARCH Pattern 5); throw AstridrApiError on failure so the picker can fall back. When browse succeeds, render a Popover-wrapped repo/tree list (shadcn Popover) that sets the chosen path via onChange; when it fails, render the Input. Create src/components/console/NewRunModal.tsx mirroring WarRoomLaunchDialog.tsx VERBATIM in structure (Dialog shell at sm:max-w-[520px], state-reset-on-open useEffect, space-y-2 Label+control field stacks, footer Cancel(outline)/Launch Run(bg-primary text-primary-foreground, Play icon)). Props: `{ open, onOpenChange, onTaskSubmitted: (taskId: string) => void }`. Fields per 75-UI-SPEC: Engine Select (Claude Code→"claude-cli", Codex→"codex", default claude-cli), WorkingDirectory via WorkdirPicker (required), Prompt Textarea rows=4 (required), Model Select (optional, UI only — do NOT include `model` in the submitTask body per anti-pattern 7 until the paired Ástríðr change lands), MaxRounds Input type=number min1 max50 → max_turns, Agent/Persona Select populated from `fetchAgents()` → system_prompt_append. Launch handler mirrors WarRoomLaunchDialog: guard on prompt+workdir, setIsLaunching, call `submitTask({ prompt, provider, working_dir, max_turns, system_prompt_append })`, on success `onTaskSubmitted(result.task_id)` + `toast.success` + `onOpenChange(false)`, on error `toast.error`, finally clear isLaunching. Use Lucide `Play` only. Use Tailwind 4 `bg-(--token)` syntax. Write NewRunModal.test.tsx covering the six behaviors (mock submitTask + fetchAgents + sonner). Trace: 75-VALIDATION.md row "submitTask → POST /tasks payload".
  </action>
  <verify>
    <automated>npx vitest run src/components/console/NewRunModal.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - NewRunModal renders all six fields with UI-SPEC placeholders; Launch disabled until prompt+workdir filled
    - Launch calls submitTask WITHOUT a `model` key in the body (grep test asserts model absent from the submitted payload)
    - Success → onTaskSubmitted(task_id) + toast + close; failure → toast.error + stays open
    - WorkdirPicker falls back to free-text Input when browse rejects
    - Only Lucide icons; Tailwind `bg-(--token)` syntax (no `bg-[var(--token)]`)
    - `npx vitest run src/components/console/NewRunModal.test.tsx` passes; `npx tsc --noEmit` clean
  </acceptance_criteria>
  <done>New Run modal + workdir picker + browse helpers built per UI-SPEC/D-02/D-03/D-04; launch path tested.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → gateway WS (:8200) | Untrusted WS frames stream into the client |
| browser → gateway browse (:8200) | Read-only file/repo browse crosses with a scoped token |
| user input → task payload | Prompt/workdir/max_turns are user-controlled and POSTed to the gateway |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-75-08 | Tampering | path traversal via workdir | mitigate | working_dir is validated server-side by the gateway _validate_working_dir() allowlist; client requires a non-empty value before enabling Launch (V5 input validation) |
| T-75-09 | Tampering | XSS via streamed content | mitigate | Stream blocks render as React children (escaped), never dangerouslySetInnerHTML (V5) |
| T-75-10 | Information Disclosure | browse exposing arbitrary files | mitigate | Browse uses the gateway:read scoped HMAC token (not the raw key) and the gateway path-contains + .env-blocks the browse routes (M1.P3) |
| T-75-11 | Spoofing | unauthenticated WS frame injection | accept | The WS route is intentionally open on localhost-only; a malicious frame can only affect this client's view and cannot fake terminal state (CLOSED is browser-side). Accepted per single-user localhost model |
| T-75-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs; shadcn Dialog/Select/Input/Textarea/Label/Popover already present in src/components/ui/. No legitimacy gate needed |
</threat_model>

<verification>
- `npx vitest run src/hooks/useTaskStream.test.ts src/components/console/NewRunModal.test.tsx` green
- `npx tsc --noEmit` clean
- useTaskStream contains no reconnect and no auth on the WebSocket
</verification>

<success_criteria>
- A launched task returns a task_id and is correlated to its live WS stream (CON-01 + CON-02 launch/correlate path)
- The launch modal honors the locked D-04 field set and omits `model` from the POST until the paired change lands
- WorkdirPicker degrades gracefully to free-text (D-03)
</success_criteria>

<output>
Create `.planning/phases/75-agent-console/75-04-SUMMARY.md` when done
</output>
