---
phase: 80-command-bridge-launch-stop
plan: "02"
subsystem: forge-daemon
tags: [command-bridge, daemon, polling, forge, cross-repo]
dependency_graph:
  requires: [80-01]
  provides: [forge-command-poll-loop, FI-06-daemon-half]
  affects: [forge/src/index.ts, forge/src/emit/command-poller.ts]
tech_stack:
  added: []
  patterns: [fire-and-forget-fetch, injectable-seams, tdd-red-green]
key_files:
  created:
    - repo: forge
      path: src/emit/command-poller.ts
    - repo: forge
      path: src/emit/command-poller.test.ts
  modified:
    - repo: forge
      path: src/index.ts
decisions:
  - "launchFn wraps fetch to local POST /jobs (127.0.0.1:{apiPort}); stopFn wraps stopJobById(db, id, emitCfg) in-process — no HTTP hop for stop"
  - "commandPoller.stop() called first in drainWithTimeout beforeClose hook — no new dispatches during shutdown window"
  - "Dispatch on commandType ONLY (W1 invariant) — server returns pre-patch doc snapshot; status field never used as dispatch gate"
  - "flushMicrotasks() helper (Promise.resolve() x20) instead of setImmediate — setImmediate hangs under vi.useFakeTimers default mode"
metrics:
  duration_minutes: 25
  completed_date: "2026-06-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 80 Plan 02: CommandPoller Daemon — Summary

**One-liner:** Fire-and-forget CommandPoller with injectable launchFn/stopFn, 7s polling, Bearer auth, and W1 status-agnostic dispatch wired into the Forge daemon startup.

> **Cross-repo note:** All code in this plan lives in the **Forge repo** at
> `C:\Users\mandr\forge` on branch `feat/command-bridge-daemon`.
> Commits: `45cba7c` (RED), `523b5c0` (GREEN/impl), `95accaa` (Task 2 wiring).
> The SUMMARY.md is committed here in the CodePulse planning tree per plan spec.

---

## What Was Built

### Task 1: CommandPoller class + tests (TDD RED → GREEN)

**`forge/src/emit/command-poller.ts`** — new file

`CommandPoller` class with full `PollCfg` interface (all dependencies injectable):

- `poll()`: POST to `claimUrl` with `Bearer` header + `{ hostId }` body; non-ok or thrown network error returns silently (`.catch(() => null)`)
- `execute(cmd)`: dispatches on `commandType` **only** (W1 invariant; never on `cmd.status`); `launch` → `launchFn(launchPayload)`; `stop` → `stopFn(stopPayload.forgeJobId)`; always acks to `ackUrl` fire-and-forget regardless of outcome; never throws
- `start()` / `stop()`: `setInterval` at `intervalMs` (default 7000ms); idempotent
- Exported types: `ForgeCommand`, `LaunchPayload`, `StopPayload`, `PollCfg`
- Security: `apiKey` never interpolated into any log output (T-80-07)

**`forge/src/emit/command-poller.test.ts`** — new file, 12 tests

Mirrors `codepulse-emitter.test.ts` style (injectable mocks, no real network):

| # | Assertion |
|---|-----------|
| 1 | No-op when `claimUrl` empty — fetch never called |
| 2 | `poll()` sends `Bearer` header + `{ hostId }` body to claimUrl |
| 3 | `poll()` returns silently on non-ok claim response |
| 4 | `poll()` swallows network error (fetch throws) |
| 5 | `launch` dispatch: `launchFn` called with `launchPayload`; ack carries `forgeJobId` |
| 6 | `stop` dispatch: `stopFn` called with `stopPayload.forgeJobId` |
| 7 | Stop ack: `status="done"`, no `forgeJobId` field |
| 8 | Execute error: ack `status="failed"` + error message |
| 9 | Ack POST uses `Bearer` header + `ackUrl`; apiKey absent from body |
| 10 | `execute()` never throws even when ack fetch also throws |
| 11 | W1: dispatch fires even when `cmd.status` is `"queued"` (server snapshot race) |
| 12 | `start()` / `stop()` timer lifecycle |

### Task 2: Wire into daemon startup (`forge/src/index.ts`)

- Added imports: `CommandPoller` from `./emit/command-poller.js`, `stopJobById` from `./process/manager.js`
- After step 3c (emitter setup), constructs `CommandPoller` **gated on** `emitCfg.ingestUrl && emitCfg.apiKey` (same env vars, no new secrets)
- `claimUrl` = `${emitCfg.ingestUrl}/forge-commands-claim`
- `ackUrl` = `${emitCfg.ingestUrl}/forge-commands-ack`
- `launchFn`: `fetch('http://127.0.0.1:{apiPort}/jobs', { method:'POST', ... })`; throws on non-ok (triggers ack `status="failed"`)
- `stopFn`: `stopJobById(db, forgeJobId, emitCfg)` — in-process call; reflect-back uses existing emitter (no new channel)
- Skip log when gate vars absent; single startup log when active (never logs apiKey)
- `commandPoller?.stop()` called **first** in `drainWithTimeout` beforeClose hook — prevents new dispatches during shutdown window

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `setImmediate` hangs under `vi.useFakeTimers`**
- **Found during:** Task 1 GREEN verification (7 tests timing out at 5s)
- **Issue:** Tests used `await new Promise<void>((r) => setImmediate(r))` to flush detached `void this.execute(cmd)` promises. `vi.useFakeTimers()` in default mode does not control `setImmediate`, causing indefinite hangs.
- **Fix:** Added `flushMicrotasks(rounds=20)` helper using `await Promise.resolve()` loop — works correctly under fake timers and flushes all chained microtask awaits in `execute()`.
- **Files modified:** `forge/src/emit/command-poller.test.ts`
- **Commit:** `523b5c0` (fix bundled with GREEN implementation commit)

None — plan executed as designed; one test-harness fix required before GREEN gate.

---

## Deferred Manual Verification

**Live cross-repo round-trip** (requires 80-01 deployed to Convex):

The automated verification covers the daemon-side logic (unit tests) and type correctness. The live end-to-end round-trip — where the daemon polls a real Convex deployment, claims a command, launches a Forge job, and the status reflects back through `/forge-ingest` — requires 80-01 (Convex schema, httpActions, mutations) to be deployed.

Manual verification steps (from VALIDATION.md §Manual-Only):
1. Deploy 80-01 to Convex dev (`npx convex deploy --yes` in CodePulse)
2. Start Forge daemon with `CONVEX_FORGE_INGEST_URL=<deployment-url>` and `FORGE_INGEST_API_KEY=<key>`
3. From `/forge` UI, click Launch → observe: `[forge] command bridge: polling ...` in daemon logs; command row transitions `queued → executing → done`; new `forgeJobs` row appears in CodePulse
4. Click Stop on a running job → observe: `taskkill /T /F` fires; job reflects `stopped` status back to Convex

---

## Known Stubs

None. `CommandPoller` is fully implemented with real `launchFn`/`stopFn` wired in `index.ts`. No placeholder values or TODO paths.

---

## Threat Flags

No new network endpoints or auth paths introduced beyond what the plan's threat model covers (T-80-07 through T-80-SC). The `launchFn` fetch is loopback-only (`127.0.0.1`) and inherits the existing API server's bearer guard.

---

## Self-Check: PASSED

**Files exist:**
- `C:\Users\mandr\forge\src\emit\command-poller.ts` — FOUND (created this session)
- `C:\Users\mandr\forge\src\emit\command-poller.test.ts` — FOUND (created this session)
- `C:\Users\mandr\forge\src\index.ts` — FOUND (modified this session)

**Commits exist (forge repo, branch feat/command-bridge-daemon):**
- `45cba7c` — test(80-02): RED gate — FOUND
- `523b5c0` — feat(80-02): CommandPoller implementation — FOUND
- `95accaa` — feat(80-02): daemon wiring — FOUND

**Test suite:** 550/550 passing  
**Type-check:** `npx tsc --noEmit` — clean (no output)
