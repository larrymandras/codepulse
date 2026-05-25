---
phase: 66-gateway-compatibility
plan: "04"
subsystem: telemetry
tags: [telemetry, cli-gateway, codepulse, observability]
dependency_graph:
  requires: [66-02]
  provides: [gateway-telemetry-emission]
  affects: [convex/runtimeIngest.ts, astridr/tools/cli_gateway.py]
tech_stack:
  added: []
  patterns: [fire-and-forget telemetry, local import to avoid circular deps, context var session propagation]
key_files:
  created: []
  modified:
    - astridr-repo/astridr/tools/cli_gateway.py
    - hooks/README.md
decisions:
  - "Local import pattern (inside branch) used for telemetry to avoid circular dependency, matching schedule_wakeup.py analog"
  - "try/except Exception: pass guard wraps all telemetry emission — telemetry failure must never break task execution"
  - "session_id sourced from get_session_context() context var, falls back to task_id when not set"
  - "duration_ms computed from duration_seconds * 1000 — gateway returns seconds, CodePulse stores ms"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 66 Plan 04: CLIGatewayTool Telemetry Emission Summary

**One-liner:** CLIGatewayTool now emits `gateway.task_completed` and `gateway.task_failed` telemetry via Astridr's existing `get_telemetry()` + `t.send()` pattern, bridging the gateway sidecar to CodePulse observability.

## Tasks Completed

| Task | Name | Commit | Repo | Files |
|------|------|--------|------|-------|
| 1 | Add telemetry emission to CLIGatewayTool._poll_until_complete | 16d34f1b | astridr-repo | astridr/tools/cli_gateway.py |
| 2 | Document hook system boundary in hooks/README.md | 335aab6 | codepulse | hooks/README.md |

## What Was Built

### Task 1 — Telemetry emission in cli_gateway.py

Added two fire-and-forget telemetry blocks to `_poll_until_complete`:

- **Completion branch** (`status == "completed"`): emits `gateway.task_completed` with `provider`, `task_id`, `session_id`, and `duration_ms` (converted from gateway's `duration_seconds`).
- **Failure branch** (`status in ("failed", "cancelled", "timed_out")`): emits `gateway.task_failed` with `provider`, `task_id`, `session_id`, and `error`.

Both blocks use the local import pattern (`from astridr.engine.telemetry import get_telemetry, get_session_context` inside the branch) to avoid circular dependencies, matching the established pattern in `schedule_wakeup.py`. Both are wrapped in `try/except Exception: pass` so telemetry failures cannot interrupt task execution.

Session ID is sourced from `get_session_context()` (the Astridr context var carrying the parent session), with `task_id` as fallback when no session is active.

### Task 2 — hooks/README.md documentation

Added a **Gateway Events** section at the end of `hooks/README.md` explaining:
- `codepulse-hook.mjs` only captures Claude Code CLI events
- Gateway provider tasks (Codex, Antigravity, Claude SDK) do not fire hooks — by design
- The two ingest paths: hooks → `/ingest` vs CLIGatewayTool → `/runtime-ingest`
- Both paths converge in the same CodePulse domain tables

## Decisions Made

1. **Local import inside branch** — Matches `schedule_wakeup.py` analog; avoids circular import risk at module load time.
2. **`try/except Exception: pass`** — Telemetry is observability infrastructure, not business logic. It must never block task results (T-66-08 mitigated).
3. **`session_id` fallback to `task_id`** — When CLIGatewayTool runs outside an active Astridr session (e.g., standalone testing), events still arrive in CodePulse under a meaningful identifier rather than `null`.
4. **`duration_ms` unit conversion** — Gateway API returns `duration_seconds` (float); CodePulse ingest expects milliseconds. `* 1000` applied at emission point.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

| Threat | Mitigation Applied |
|--------|--------------------|
| T-66-07 Spoofing — provider field | Provider comes from gateway's TaskResponse (trusted internal process); external injection blocked by `validateIngestAuth()` Bearer token |
| T-66-08 DoS — telemetry failure | `try/except Exception: pass` ensures telemetry failure never blocks task completion |
| T-66-09 Info disclosure — session_id | Accepted: session ID is internal identifier, transmitted over internal network |

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Telemetry emission uses the existing `/runtime-ingest` path already established in Plan 02.

## Self-Check: PASSED

- `astridr-repo/astridr/tools/cli_gateway.py` — modified, syntax valid, all acceptance criteria met
- `hooks/README.md` — modified, contains Gateway Events section
- astridr-repo commit `16d34f1b` — verified via `git rev-parse --short HEAD`
- codepulse commit `335aab6` — verified via `git rev-parse --short HEAD`
