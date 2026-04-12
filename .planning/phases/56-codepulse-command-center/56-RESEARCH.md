# Phase 56: CodePulse Command Center - Research

**Researched:** 2026-04-10
**Domain:** React + Convex frontend command center, bidirectional WebSocket, HITL approval UI, live run visualization
**Confidence:** HIGH (all claims verified against codebase)

## Summary

Phase 56 transforms CodePulse from a read-only monitoring dashboard into a bidirectional command center. The backend (astridr-repo) already has all required infrastructure: `ws_commands.py` defines 10 typed command types dispatched through `CommandDispatcher`, `ws_telemetry.py` has a `live-runs` topic with `run.blocks` events, `hitl_gate.py` manages pending HITL approvals, `tool_scanner.py` exports `ScanVerdict`/`RiskLevel` enums, and `agent/response.py` defines `AgentResponse` with typed blocks. The Convex schema already has `commandExecutions`, `run_blocks`, `notifications`, `alerts`, and `ideationFindings` tables. The frontend has none of the new UI surfaces yet — no chat panel, no approval queue, no live run widget, no config editor.

The core engineering challenge is the WebSocket bridge: CodePulse must both receive events (already works via `/ws/telemetry`) AND send commands back over the same connection. The existing `ws_telemetry.py` already dispatches inbound `type`-keyed messages to `CommandDispatcher`, so the protocol is live — CodePulse just needs a client-side hook that writes to the WebSocket and tracks ack responses.

**Primary recommendation:** Build a `useAstridrWS` hook as the single WebSocket owner for the entire app. It manages the connection, fan-out to topic subscribers, and outbound command dispatch with request_id tracking. All new UI surfaces (chat, approvals, live runs, config) consume this hook.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 56 — the phase directory was just created. Constraints below are derived from REQUIREMENTS.md, STATE.md, and the project's accumulated decisions.

### Locked Decisions (from STATE.md accumulated context)
- Design system: oklch monochromatic palette, shadcn/ui New York style, `--radius: 0` globally (Phase 1 baseline)
- Navigation: 240px sidebar, grouped nav sections, live count badges
- Charts: custom CSS flex bar charts (no Recharts for primary displays)
- Component patterns: MetricCard, EntityRow, SectionHeader universally applied
- Icons: Lucide React, 4x4 sizing
- No CRT overlay, no Cinzel font

### Claude's Discretion
- Layout of Command Center page (split-pane vs tabbed vs unified)
- Chat message threading approach
- Live run block rendering strategy
- Config editor field types and validation UX

### Deferred Ideas (OUT OF SCOPE)
- Multi-tenant access
- Mobile native app
- React Three Fiber / 3D visualizations
- OpenTelemetry collector backend
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CPCC-01 | Chat panel — send tasks to Ástríðr, receive typed response blocks rendered as UI | `agent.send_task` command in ws_commands.py; `run.blocks` events in live-runs topic; AgentResponse blocks defined in response.py |
| CPCC-02 | Approval queue — view pending HITL requests, approve/reject from dashboard | `approval.respond` command in ws_commands.py; `ApprovalRequest` dataclass in hitl_gate.py; pending requests recoverable via `hitl_gate.recover_pending()` |
| CPCC-03 | Live run widget — watch active agent runs in real time, see blocks as they arrive | `live-runs` topic in ws_telemetry.py: run.started/thinking/tool_call/text/completed/error events; `run_blocks` table in schema |
| CPCC-04 | Task management — view, create, cancel tasks from dashboard | `agent.send_task`, `agent.stop`, `agent.pause`, `agent.resume` commands; `commandExecutions` table already tracked |
| CPCC-05 | Config editor — read and edit Ástríðr config sections from UI | `config.update` command with `dry_run` support; `MUTABLE_SECTIONS` allowlist in config/validators.py; `agentConfigs` + `configChanges` tables in schema |
| CPCC-06 | Security scan results — display tool scanner findings with RiskLevel badges | `ideationFindings` table already in schema with dismiss support; `ScanVerdict` / `RiskLevel` enum (SAFE/MEDIUM/HIGH) in tool_scanner.py |
| CPCC-07 | E-stop control — activate/deactivate global emergency stop from dashboard | `estop.activate` / `estop.deactivate` commands in ws_commands.py |
| SCAN-05 | Security scan findings surface — CodePulse displays scanner verdicts with filter/dismiss | `ideationFindings` Convex table with by_scan_type, by_severity, by_dismissed indexes; dismiss already modeled |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | ^1.17.0 | Reactive backend, all data persistence | Already in use — all tables defined |
| react | ^19.2.4 | UI framework | Project baseline |
| react-router-dom | ^7.13.1 | Page routing | Already in use |
| tailwindcss | ^4.2.1 | Styling | Project baseline |
| sonner | ^2.0.7 | Toast notifications | Already in use |
| @dnd-kit/core + sortable | ^6.3.1 / ^10.0.0 | Drag-and-drop for task kanban | Already installed |

[VERIFIED: package.json]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui (New York) | latest | Component primitives (Dialog, Sheet, Tabs, Badge) | Phase 1 baseline — install components as needed |
| lucide-react | bundled with shadcn | Icons | All new icons |

### No New Dependencies Required
All functionality (WebSocket, forms, state management) is achievable with existing stack. The WebSocket connection uses native browser `WebSocket` API in a custom hook.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/
│   ├── useAstridrWS.ts          # Single WS owner — connection, topics, command dispatch
│   ├── useLiveRun.ts            # Subscribes to live-runs topic events for one session
│   ├── useApprovals.ts          # Queries pending HITL approvals via Convex
│   └── useCommandDispatch.ts   # Wraps useAstridrWS.sendCommand with ack tracking
├── components/
│   ├── CommandCenter/
│   │   ├── ChatPanel.tsx        # CPCC-01: send tasks, render response blocks
│   │   ├── ApprovalQueue.tsx    # CPCC-02: pending HITL requests
│   │   ├── LiveRunWidget.tsx    # CPCC-03: real-time run block stream
│   │   ├── TaskBoard.tsx        # CPCC-04: task management kanban
│   │   ├── ConfigEditor.tsx     # CPCC-05: section-based config form
│   │   └── EStopButton.tsx      # CPCC-07: emergency stop control
│   └── SecurityScan/
│       └── ScanResultsPanel.tsx # CPCC-06 + SCAN-05: ideationFindings display
└── pages/
    └── CommandCenter.tsx        # New page aggregating all panels
```

### Pattern 1: Single WebSocket Owner Hook
**What:** One `useAstridrWS` hook owns the WebSocket lifecycle. React Context provides it app-wide.
**When to use:** Any component that needs to send commands or subscribe to real-time events.

```typescript
// Source: astridr-repo/astridr/engine/ws_telemetry.py (protocol reference)
// useAstridrWS.ts pattern
const useAstridrWS = () => {
  // connect to /ws/telemetry?api_key=...
  // send { action: "subscribe", topics: ["live-runs", "agents"] }
  // track pending commands: Map<request_id, { resolve, reject, timeout }>
  // incoming type === "ack" → resolve/reject pending promise
  // incoming event_type → fan-out to topic listeners
  return { sendCommand, subscribe, connectionState }
}
```

**Command format** (from ws_commands.py):
```typescript
// All commands use this shape:
{ type: "agent.send_task", request_id: crypto.randomUUID(), agent_id: "...", task: "..." }
{ type: "approval.respond", request_id: "...", request_id_target: "...", decision: "approve" | "reject" }
{ type: "config.update", request_id: "...", section: "...", changes: {}, dry_run: false }
{ type: "estop.activate", request_id: "..." }
```

**Ack response format:**
```typescript
// Server always responds with:
{ type: "ack", request_id: "...", status: "ok" | "error", error?: "..." }
```

### Pattern 2: Live Run Block Rendering
**What:** Render typed blocks from `run.blocks` events as structured UI elements.
**Block types** (from astridr/agent/response.py):
```typescript
// TextBlock   → prose paragraph
// ToolUseBlock → expandable tool call card (name + arguments JSON)
// ToolResultBlock → tool result card (collapsed by default)
// ErrorBlock  → error banner with error_type + message
```

### Pattern 3: HITL Approval Flow
**What:** Pending approvals live in Supabase (agent_approvals table) but CodePulse uses the WebSocket to respond.
**Key insight:** `approval.respond` command takes `request_id_target` (the UUID of the HITL request), not the WebSocket request_id. These are two different IDs.

```typescript
// Source: astridr/api/ws_commands.py ApprovalRespondCommand
await sendCommand({
  type: "approval.respond",
  request_id: crypto.randomUUID(),     // WS ack correlation
  request_id_target: approval.request_id, // the HITL request UUID
  decision: "approve" | "reject",
  comment: optionalString,
})
```

**Where do pending approvals come from?** There is NO Convex table for HITL approvals from `hitl_gate.py`. They live in Supabase `agent_approvals`. CodePulse will need either:
- A Convex ingest path (Ástríðr pushes approval events via telemetry when new requests arrive), OR
- A REST endpoint on Ástríðr to list pending approvals (not yet built)

**DECISION REQUIRED:** How does CodePulse learn about pending HITL approvals? The current architecture has no bridge. Options: (A) Ástríðr emits a `hitl_request` event via the `agents` WS topic when a new approval is needed; (B) a Convex `hitlApprovals` table is added and Ástríðr pushes to it via ConvexHandler. Option A is less invasive.

### Pattern 4: Config Editor
**What:** YAML config sections exposed as form fields.
**Critical constraint:** Only sections in `MUTABLE_SECTIONS` allowlist can be written. Use `dry_run: true` first to validate before committing.

```typescript
// Two-phase update:
// 1. sendCommand({ type: "config.update", ..., dry_run: true }) → validate
// 2. If ok: sendCommand({ type: "config.update", ..., dry_run: false }) → write
```

**Source:** astridr/api/ws_commands.py `_handle_config_update` — MUTABLE_SECTIONS from astridr/config/validators.py (not yet inspected — Wave 0 task: read this file to enumerate allowed sections).

### Anti-Patterns to Avoid
- **Multiple WebSocket connections:** Each component opening its own `/ws/telemetry` connection will exhaust the server's per-key limit and cause auth failures. Single hook with fan-out is mandatory.
- **Polling Convex for live run state:** `run.blocks` events arrive via WebSocket. Do NOT poll Convex `run_blocks` table for live updates — use the WS event stream and only fall back to Convex for historical replay.
- **Sending commands without request_id tracking:** Fire-and-forget commands give no error feedback. Always await the ack.
- **Config writes without dry_run validation:** The server validates against per-section Pydantic models. Always dry_run first to surface errors before committing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnect logic | Custom exponential backoff | Standard pattern with `useEffect` cleanup + `setTimeout` | Race conditions between unmount and reconnect are subtle |
| Request-response over WS | Custom ack registry | `Map<request_id, {resolve, reject}>` with timeout cleanup | Already the right pattern — keep it simple |
| Config form schema | Dynamic form builder library | Simple `key: value` field list from section JSON | Config sections are flat YAML — no need for JSONSchema form libs |
| Approval persistence | Custom Supabase queries from frontend | Telemetry event + Convex table (see Pattern 3) | Frontend must not hold Supabase service key |
| Drag-and-drop task board | Custom drag implementation | `@dnd-kit` (already installed) | Already in package.json |

## Common Pitfalls

### Pitfall 1: Two Different "request_id" Fields in Approval Commands
**What goes wrong:** Sending the WS correlation `request_id` as `request_id_target` — the server looks up the HITL request by UUID and finds nothing.
**Why it happens:** The command has two ID fields that look similar.
**How to avoid:** `request_id` = fresh UUID for this WS call; `request_id_target` = the UUID from the `ApprovalRequest.request_id` field.

### Pitfall 2: WebSocket Send Race on Unmount
**What goes wrong:** Component unmounts while an ack is pending → promise never resolves → memory leak.
**Why it happens:** `useEffect` cleanup fires but pending Map still holds references.
**How to avoid:** On cleanup, reject all pending commands with `{ error: "connection closed" }` and clear the Map.

### Pitfall 3: `live-runs` Topic Not Subscribed
**What goes wrong:** Live run events never arrive even though connection is open.
**Why it happens:** `ws_telemetry.py` requires explicit subscription: `{ action: "subscribe", topics: ["live-runs"] }`. Default is empty = all topics only if subscribed_topics is empty at first.
**How to avoid:** Subscribe immediately after connection accept. Verify `subscribed_topics` in server logs.

### Pitfall 4: E-Stop Button Accidental Activation
**What goes wrong:** User accidentally activates global e-stop, halting all agents.
**Why it happens:** No confirmation gate.
**How to avoid:** EStopButton requires two-step confirmation (click → confirm dialog → send command). Never send `estop.activate` on first click.

### Pitfall 5: Config Section Not in MUTABLE_SECTIONS
**What goes wrong:** `config.update` returns error `"Section X is not in the mutable sections allowlist"`.
**Why it happens:** MUTABLE_SECTIONS is an allowlist in `astridr/config/validators.py` — unknown sections are rejected.
**How to avoid:** Fetch allowed sections from the backend (or hardcode after reading validators.py) and only show UI controls for allowed sections.

### Pitfall 6: No Convex Table for HITL Approvals
**What goes wrong:** Approval Queue page has nothing to display — pending approvals exist only in Supabase.
**Why it happens:** `hitl_gate.py` and `approval_gate.py` both persist to Supabase, not Convex.
**How to avoid:** See Pattern 3 — must establish an ingest path. This is a Wave 0 architecture task.

## Code Examples

### WebSocket Command Dispatch with Ack
```typescript
// Source: astridr-repo/astridr/api/ws_commands.py (protocol reference)
async function sendCommand(ws: WebSocket, cmd: object): Promise<AckResponse> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      pendingAcks.delete(requestId);
      reject(new Error("Command timeout"));
    }, 10_000);
    pendingAcks.set(requestId, { resolve, reject, timeout });
    ws.send(JSON.stringify({ ...cmd, request_id: requestId }));
  });
}

// On message handler:
if (msg.type === "ack") {
  const pending = pendingAcks.get(msg.request_id);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingAcks.delete(msg.request_id);
    if (msg.status === "ok") pending.resolve(msg);
    else pending.reject(new Error(msg.error));
  }
}
```

### Live Run Block Renderer
```typescript
// Source: astridr-repo/astridr/agent/response.py (block type definitions)
function renderBlock(block: Block) {
  switch (block.type) {
    case "text":       return <p>{block.text}</p>;
    case "tool_use":   return <ToolCallCard name={block.name} args={block.arguments} />;
    case "tool_result": return <ToolResultCard id={block.tool_call_id} result={block.result} />;
    case "error":      return <ErrorBanner type={block.error_type} msg={block.message} />;
  }
}
```

### Subscribing to live-runs topic
```typescript
// Source: astridr-repo/astridr/engine/ws_telemetry.py
ws.send(JSON.stringify({ action: "subscribe", topics: ["live-runs"] }));
// Events arrive with event_type in:
// "run.started" | "run.thinking" | "run.tool_call" | "run.text" 
// "run.completed" | "run.error" | "run.cancelled" | "run.blocks"
```

### RiskLevel Badge Mapping
```typescript
// Source: astridr-repo/astridr/security/tool_scanner.py RiskLevel enum
const riskColors = {
  safe:   "text-green-400",
  medium: "text-yellow-400",
  high:   "text-red-400",
} as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling Convex tables for live data | WebSocket events via /ws/telemetry | Phase 40 (OBS-01) | All live UI must use WS, not query polling |
| Untyped agent responses (string) | AgentResponse with typed blocks discriminated union | Phase 55 | Live run widget must render typed blocks, not raw text |
| No command channel | CommandDispatcher with 10 typed commands | Phase 47 (WS-01) | Full bidirectional WS already live in Ástríðr |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MUTABLE_SECTIONS allowlist in config/validators.py contains the sections the UI should expose | Standard Stack / Patterns | Config editor shows wrong/missing fields — must read validators.py in Wave 0 |
| A2 | No existing `/ws/telemetry` client hook in CodePulse frontend | Architecture | If one exists, adapt rather than create |
| A3 | `hitl_gate.py` pending approvals are NOT mirrored to Convex today | Pitfall 6 / Pattern 3 | If already mirrored, approval queue is simpler than thought |

## Open Questions

1. **How does CodePulse surface pending HITL approvals?**
   - What we know: `hitl_gate.py` stores to Supabase `agent_approvals`; no Convex table exists
   - What's unclear: Is there already a ConvexHandler event emitted when a HITL request is created?
   - Recommendation: Read `astridr/security/hitl_gate.py` lines 80+ and `engine/bootstrap.py` to confirm — then decide: emit telemetry event OR add `hitlApprovals` Convex table

2. **What sections are in MUTABLE_SECTIONS?**
   - What we know: `config.update` validates against MUTABLE_SECTIONS from `astridr/config/validators.py`
   - What's unclear: Which sections are exposed and what their schema is
   - Recommendation: Wave 0 task — read `astridr/config/validators.py` to enumerate, then build config editor form fields accordingly

3. **Does the Ástríðr WS endpoint support the `admin_key` path for CodePulse?**
   - What we know: `ws_telemetry.py` accepts both `api_key` and `admin_key` (line 104)
   - What's unclear: Which key CodePulse should use in production
   - Recommendation: Use `admin_key` for full command dispatch access; confirm in `engine/bootstrap.py`

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ástríðr /ws/telemetry | All command center features | ✓ (in Docker) | Phase 47+ | Dev: mock WS server for local UI dev |
| Convex backend | Data persistence, queries | ✓ | ^1.17.0 | — |
| @dnd-kit | Task board drag-and-drop | ✓ | ^6.3.1 | — |
| shadcn/ui | Component primitives | ✓ (Phase 1 install) | latest | — |

[VERIFIED: package.json, ws_telemetry.py]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | vite.config.ts (inferred) |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CPCC-01 | useAstridrWS sends agent.send_task and resolves ack | unit | `npx vitest run src/hooks/__tests__/useAstridrWS.test.ts` | ❌ Wave 0 |
| CPCC-02 | approval.respond sends correct request_id_target | unit | `npx vitest run src/hooks/__tests__/useAstridrWS.test.ts` | ❌ Wave 0 |
| CPCC-03 | LiveRunWidget renders TextBlock, ToolUseBlock, ErrorBlock | unit | `npx vitest run src/components/__tests__/LiveRunWidget.test.tsx` | ❌ Wave 0 |
| CPCC-05 | ConfigEditor dry_run validates before write | unit | `npx vitest run src/components/__tests__/ConfigEditor.test.tsx` | ❌ Wave 0 |
| CPCC-07 | EStopButton requires confirmation before sending | unit | `npx vitest run src/components/__tests__/EStopButton.test.tsx` | ❌ Wave 0 |
| SCAN-05 | ScanResultsPanel renders RiskLevel badges, dismiss works | unit | `npx vitest run src/components/__tests__/ScanResultsPanel.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/__tests__/useAstridrWS.test.ts` — mock WS, test subscribe/command/ack flow
- [ ] `src/components/__tests__/LiveRunWidget.test.tsx` — block rendering for all 4 block types
- [ ] `src/components/__tests__/ConfigEditor.test.tsx` — dry_run gate, section validation
- [ ] `src/components/__tests__/EStopButton.test.tsx` — two-step confirmation guard
- [ ] `src/components/__tests__/ScanResultsPanel.test.tsx` — RiskLevel badge, dismiss mutation

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | WS connection requires API key (`api_key` query param); no unauthenticated commands |
| V3 Session Management | yes | Single WS session per CodePulse tab; key never in localStorage — use env var or Convex secret |
| V4 Access Control | yes | CommandAuth two-tier key enforcement on server (admin vs service key); UI should not expose e-stop to non-admin views |
| V5 Input Validation | yes | All command payloads validated by Pydantic on server; client-side validation is UX only |
| V6 Cryptography | no | No crypto operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in client bundle | Information Disclosure | Use Convex secrets or runtime env injection — never hardcode in source |
| E-stop accidental activation | Denial of Service | Two-step confirm dialog before sending estop.activate |
| Config injection via UI | Tampering | Server validates against MUTABLE_SECTIONS + per-section Pydantic schema; dry_run first |
| Approval replay attack | Elevation of Privilege | Server guards: stale callbacks rejected (status != "pending" check in hitl_gate.py) |

[VERIFIED: ws_telemetry.py line 104, ws_commands.py _handle_estop_activate, hitl_gate.py]

## Sources

### Primary (HIGH confidence)
- `astridr-repo/astridr/engine/ws_telemetry.py` — WS protocol, topic map, auth flow, command dispatch routing
- `astridr-repo/astridr/api/ws_commands.py` — All 10 command types, CommandDispatcher, ack format
- `astridr-repo/astridr/security/hitl_gate.py` — HITL approval lifecycle, ApprovalRequest dataclass
- `astridr-repo/astridr/automation/agent_factory/approval_gate.py` — Agent creation approval (separate from HITL)
- `astridr-repo/astridr/security/tool_scanner.py` — RiskLevel enum (SAFE/MEDIUM/HIGH), ScanVerdict dataclass
- `astridr-repo/astridr/agent/response.py` — AgentResponse, TextBlock, ToolUseBlock, ToolResultBlock, ErrorBlock
- `codepulse/convex/schema.ts` — All Convex tables: run_blocks, commandExecutions, notifications, alerts, ideationFindings
- `codepulse/convex/commandExecutions.ts` — upsertLifecycle, listExecutions, summaryStats queries
- `codepulse/convex/runBlocks.ts` — record mutation for run_blocks
- `codepulse/package.json` — Confirmed @dnd-kit, sonner, react-router-dom, convex versions

### Secondary (MEDIUM confidence)
- `codepulse/src/pages/` directory listing — 17 existing pages, none named CommandCenter
- `codepulse/src/components/` directory listing — 93 existing components, none for chat/approval/live-run

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against package.json
- Architecture (WS protocol): HIGH — verified against ws_telemetry.py and ws_commands.py source
- HITL approval ingest path: LOW — gap identified, no current Convex bridge confirmed
- Config section allowlist: LOW — validators.py not yet read
- Pitfalls: HIGH — derived directly from server source code

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable backend — astridr-repo changes slowly)
