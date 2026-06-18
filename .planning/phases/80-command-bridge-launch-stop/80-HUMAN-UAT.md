---
status: passed
phase: 80-command-bridge-launch-stop
source: [80-VERIFICATION.md]
started: 2026-06-16
updated: 2026-06-16
method: bridge-level live round-trip (command injected directly into Convex, bypassing the Clerk-gated UI which is not configured locally)
---

## Current Test

[complete — bridge round-trip verified live against deployment tidy-whale-981]

## Tests

### 1. Live Launch Round-Trip
expected: A queued launch command is claimed by the daemon within ~7s, executed via local POST /jobs, acked done with a resolved forgeJobId, and the job reflects back into Convex `forgeJobs` via the existing /forge-ingest emitter.
result: PASS — daemon (host `lmofficenew`) claimed the injected launch, POST /jobs returned job `01KV8Q60AX3W4S4VQQRQ8MZPE3`, command went `queued→executing→done` with `resolvedForgeJobId` set, and the job appeared in `forgeJobs` (reflect-back confirmed). The agent's own execution then failed (claude CLI runtime, unrelated to the bridge) — the lifecycle still reflected correctly.
notes: First attempt surfaced a real bug — the daemon's loopback POST /jobs lacked the bearer token (401). Fixed in Forge `feat/command-bridge-daemon` commit 737845e (Authorization: Bearer forgeToken); re-test passed.

### 2. Live Stop Round-Trip
expected: A queued stop command is claimed, the daemon calls stopJobById (taskkill /T /F), the job reflects `stopped` back to Convex, and the stop command acks done.
result: PASS — launched a longer codex job `01KV8Q8BJVR91TPVQ6F3HJYT5Q` (status `running`), injected a stop command → daemon claimed it → `taskkill` → job reflected `stopped` in `forgeJobs`, stop command `done`.

## Not exercised (Clerk prerequisite)
- The Clerk-gated UI path (clicking Launch/Stop in `/forge`, optimistic Queued row, "Stopping…" button, badge no-flip) was NOT exercised: Clerk is not configured locally (no `VITE_CLERK_PUBLISHABLE_KEY`, no `convex/auth.config`, no Convex CLERK env), so the fail-closed `enqueueLaunch`/`enqueueStop` mutations reject and the UI Launch button stays disabled by design (FI-08). The command bridge itself (FI-06: claim→execute→ack→reflect, both directions) is fully proven above. The UI auth gate (FI-08) is verified by unit tests + code; its live click-through remains for when Clerk is configured.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
- Clerk-gated UI click-through deferred until Clerk auth is configured in this environment (tracked; not a code defect).
