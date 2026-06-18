---
phase: 80-command-bridge-launch-stop
plan: "01"
subsystem: forge-command-bridge
tags: [convex, forge, command-bridge, schema, mutations, httpactions, cron, tdd]
dependency_graph:
  requires: [phase-78-forge-ingest, convex/ingestAuth.ts]
  provides: [forgeCommands-table, forgeHosts-table, enqueueLaunch, enqueueStop, claimAndUpsertHost, ackCommand, expireStaleCommands, forge-commands-claim-route, forge-commands-ack-route]
  affects: [convex/schema.ts, convex/forge.ts, convex/forgeCommands.ts, convex/http.ts, convex/crons.ts, convex/forge.test.ts]
tech_stack:
  added: []
  patterns: [clerk-fail-closed-mutation, bearer-authed-httpaction, atomic-claim-internalMutation, tdd-pure-logic-extraction, ttl-cron-sweep]
key_files:
  created: [convex/forgeCommands.ts]
  modified: [convex/schema.ts, convex/forge.ts, convex/http.ts, convex/crons.ts, convex/forge.test.ts]
decisions:
  - "D-13 fail-closed: enqueueLaunch/enqueueStop throw on null Clerk identity (diverges from read-query graceful-skip; documented in code comment)"
  - "D-14 bearer reuse: forgeCommandsClaim/Ack gate on FORGE_INGEST_API_KEY via validateForgeIngestAuth"
  - "D-12 TTL = 5min: FORGE_COMMAND_TTL_MS = 5*60*1000; expire-stale-forge-commands cron at 1-minute interval"
  - "Claim atomicity: claimAndUpsertHost reads+patches in a single internalMutation (serializable, double-claim safe)"
  - "W1 snapshot caveat: returned docs from claimAndUpsertHost show pre-patch status; documented in code comment for daemon implementors"
  - "Pure helpers exported: stripDangerousCapability, shouldExpireCommand, buildLaunchRow — unit-testable without live Convex"
metrics:
  duration_seconds: 290
  completed_date: "2026-06-16"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 5
  tests_added: 19
  tests_passing: 43
  tsc_errors: 0
---

# Phase 80 Plan 01: Forge Command Bridge — Convex Backend Summary

**One-liner:** Full Convex backend for the Forge command bridge — `forgeCommands`/`forgeHosts` schema, Clerk fail-closed enqueue mutations, bearer-authed claim/ack httpActions, TTL-expiry cron, and pure-logic test suite (FI-06 + FI-08).

## What Was Built

The complete Convex backend for the Phase 80 command bridge. This is the foundation Wave 2 (UI, plan 80-03) and the cross-repo daemon (plan 80-02) build against. It opens the first controlled write-back path in the Forge integration while keeping the execution engine local — Convex never touches localhost.

### Task 1: Schema + cron entry (`convex/schema.ts`, `convex/crons.ts`)

- **`forgeCommands` table** — host-scoped command queue with commandType (launch|stop), typed launch/stop payloads, status state machine (queued→executing→done|failed|expired), Clerk provenance (issuedBy), TTL timestamps (createdAt/expiresAt), ack fields (resolvedForgeJobId, error). Three indexes: `by_host_status_created` (atomic claim query), `by_commandId` (optimistic reconciliation), `by_expires` (TTL cron sweep).
- **`forgeHosts` table** — lightweight liveness record upserted on every daemon claim poll. Fields: hostId, lastSeenAt, optional hostname. Two indexes: `by_hostId`, `by_lastSeenAt`.
- **`expire-stale-forge-commands` cron** — 1-minute interval targeting `internal.forge.expireStaleCommands` (D-12).

### Task 2: forge.ts mutations, queries, helpers + tests (`convex/forge.ts`, `convex/forge.test.ts`)

Exported pure helpers (unit-testable, no Convex runtime needed):
- `stripDangerousCapability(capabilities)` — parses JSON, deletes `.dangerous`, re-serializes; returns null on empty/unparseable (D-06, Pitfall 7 mitigation).
- `shouldExpireCommand(status, expiresAt, now)` — true only when `status === "queued" && expiresAt < now`; never touches executing/done/failed.
- `buildLaunchRow(args, subject, now, ttlMs)` — constructs the forgeCommands insert object for launch commands.
- `FORGE_COMMAND_TTL_MS = 5 * 60 * 1000` — 5-minute TTL constant (D-12).

New mutations and queries:
- `enqueueLaunch` (public mutation) — D-13 fail-closed Clerk guard + throws `"Authentication required to issue Forge commands"` on null identity; strips dangerous from capabilities (D-06); inserts via `buildLaunchRow`.
- `enqueueStop` (public mutation) — same fail-closed guard; inserts stop command with `stopPayload: { forgeJobId }`.
- `claimAndUpsertHost` (internalMutation) — atomically upserts `forgeHosts.lastSeenAt` AND claims up to 10 queued non-expired commands (queued→executing) in a single serializable transaction; returns pre-patch docs (W1 caveat documented).
- `ackCommand` (internalMutation) — patches status/resolvedForgeJobId/error/completedAt; idempotent (no-op if already acked/expired).
- `expireStaleCommands` (internalMutation) — sweeps `by_expires` index, applies `shouldExpireCommand` guard, marks queued-past-TTL as expired.
- `listForgeCommands` (query, no auth — graceful-skip, read-only) — optional hostId filter.
- `listHosts` (query, no auth — graceful-skip, read-only) — newest-first by `lastSeenAt`.

Test additions in `convex/forge.test.ts`: 19 new tests covering stripDangerousCapability (6 cases), shouldExpireCommand (6 cases), buildLaunchRow (7 cases), auth fail-closed guard (2 cases); 9 DB round-trip `.todo` stubs per the repo convention.

### Task 3: httpActions + route registration (`convex/forgeCommands.ts`, `convex/http.ts`)

- New file `convex/forgeCommands.ts` — exports `forgeCommandsClaim` and `forgeCommandsAck` httpActions. Both follow the `forgeIngest.ts` skeleton exactly: OPTIONS→CORS 200, `validateForgeIngestAuth`→401 (D-14), JSON parse→400, required-field validation→400, `ctx.runMutation(internal.forge.*)`, success 200 with CORS headers.
- `http.ts` — 4 new routes: `/forge-commands-claim` POST+OPTIONS → `forgeCommandsClaim`; `/forge-commands-ack` POST+OPTIONS → `forgeCommandsAck`.

## Verification

- `npx vitest run convex/forge.test.ts` — 43 tests pass, 15 todo, 0 failures
- `npx tsc --noEmit` — 0 errors across convex/
- `grep -c "forgeCommands: defineTable" convex/schema.ts` → 1
- `grep -c "forgeHosts: defineTable" convex/schema.ts` → 1
- `grep -c "expire-stale-forge-commands" convex/crons.ts` → 1
- `grep -c "forge-commands-claim" convex/http.ts` → 2 (POST + OPTIONS)
- `grep -c "forge-commands-ack" convex/http.ts` → 2 (POST + OPTIONS)

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | `08524a1` | feat(80-01): add forgeCommands + forgeHosts schema tables and expire-stale cron entry |
| Task 2 | `1a540bb` | feat(80-01): add command bridge mutations, queries, helpers + pure-logic tests |
| Task 3 | `edf1fdc` | feat(80-01): add forgeCommandsClaim + forgeCommandsAck httpActions and register routes |

## Deviations from Plan

None — plan executed exactly as written.

- Task 1 RESEARCH.md assumption A1 (`convex/crons.ts` does not exist) was already corrected in PATTERNS.md before execution; the existing file simply needed a new entry.
- The `listForgeCommands` "all hosts" fallback uses `by_expires` index (rather than a non-existent by_createdAt index) to satisfy Convex's index-required query pattern while maintaining descending order. This is a minor implementation detail, not a deviation from the plan's intent.

## Known Stubs

None — no placeholder data, hardcoded empty values, or UI stubs in this plan. This is a pure Convex backend plan; no frontend rendering paths are involved.

## Threat Flags

No new security-relevant surface beyond what the plan's threat model covers. All T-80-01 through T-80-05 mitigations are implemented:
- T-80-01: D-13 fail-closed getUserIdentity() null-check (both enqueue mutations) ✓
- T-80-02: stripDangerousCapability strips `dangerous` before insert, unit-tested ✓
- T-80-03: Single atomic claimAndUpsertHost mutation (read+patch, serializable) ✓
- T-80-04: expiresAt = createdAt + 5min; claim filters expiresAt > now; 1-min cron ✓
- T-80-05: validateForgeIngestAuth bearer on both httpActions ✓

## Self-Check: PASSED

All files verified present. All three task commits found in git log (`08524a1`, `1a540bb`, `edf1fdc`).
