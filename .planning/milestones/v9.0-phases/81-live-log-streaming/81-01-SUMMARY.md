---
phase: 81-live-log-streaming
plan: 01
subsystem: api
tags: [convex, httpaction, ingestauth, forge, log-ingest, schema, tdd]

# Dependency graph
requires:
  - phase: 78-forge-emitter-schema
    provides: forgeIngest httpAction pattern + ingestAuth utilities (reused verbatim)
  - phase: 80-command-bridge
    provides: forge.ts internalMutation/query patterns + JOB_LIST_LIMIT convention
provides:
  - forgeLogChunks table with by_host_job + by_host_job_seq indexes (D-1 idempotency)
  - appendLogChunk internalMutation (seq-idempotent, append-only)
  - listJobLogs reactive query (asc-ordered, LOG_CHUNK_LIMIT bounded)
  - /forge-log-ingest POST + OPTIONS httpAction with bearer auth + CORS + validation
  - Contract test suite mirroring forgeIngest.test.ts (22 passing tests + 5 integration todos)
affects: [81-02-retention, 81-03-log-viewer-ui, 81-04-forge-handoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only ingest: internalMutation with by_host_job_seq .unique() idempotency check (insert or return, no patch)"
    - "httpAction mirrors forgeIngest.ts exactly: OPTIONS → auth → JSON parse try/catch → field validate → dispatch → 200"
    - "sentAt coerced absent/null → undefined at call site to satisfy v.optional(v.string()) (never v.union)"
    - "LOG_CHUNK_LIMIT = 5000 const alongside JOB_LIST_LIMIT for bounded reactive queries"

key-files:
  created:
    - convex/forgeLogIngest.ts
    - convex/forgeLogIngest.test.ts
  modified:
    - convex/schema.ts
    - convex/forge.ts
    - convex/http.ts

key-decisions:
  - "appendLogChunk is internalMutation (not mutation) — httpActions have no Clerk identity (81-SPEC §3, D-13 rule)"
  - "sentAt uses v.optional(v.string()) in both schema and mutation args — matches SPEC verbatim, not v.union(v.string(), v.null())"
  - "D-1 idempotency: by_host_job_seq .unique() check before insert; existing (hostId,forgeJobId,seq) → no-op return, no patch"
  - "listJobLogs orders asc (oldest-first terminal display), unlike listJobs desc (newest-first job list)"
  - "D-3 shared bearer: validateForgeIngestAuth reused verbatim from ingestAuth.ts — same FORGE_INGEST_API_KEY, different URL gate"

patterns-established:
  - "Log chunk idempotency: by_host_job_seq unique index + .unique() lookup before insert"
  - "Append-only vs upsert: upsertJob has existing?patch:insert; appendLogChunk has existing?return:insert (no patch branch ever)"

requirements-completed: [FI-09]

# Metrics
duration: 25min
completed: 2026-06-16
---

# Phase 81 Plan 01: forgeLogChunks Schema + /forge-log-ingest httpAction Summary

**Bearer-authed /forge-log-ingest httpAction dispatching to seq-idempotent appendLogChunk internalMutation with reactive listJobLogs query — FI-09 contract foundation**

## Performance

- **Duration:** 25 min
- **Started:** 2026-06-16T18:00:00Z
- **Completed:** 2026-06-16T18:25:00Z
- **Tasks:** 2 (Task 1: schema; Task 2: TDD — test + implementation)
- **Files modified:** 5

## Accomplishments

- Added `forgeLogChunks` table to schema with exact SPEC fields and both required indexes (`by_host_job` for list/sweep, `by_host_job_seq` for D-1 idempotency)
- Implemented `appendLogChunk` internalMutation with seq-idempotent no-op skip (D-1) and `listJobLogs` reactive bounded query (asc, LOG_CHUNK_LIMIT=5000)
- Created `forgeLogIngest` httpAction mirroring `forgeIngest.ts` exactly: OPTIONS preflight → bearer auth (D-3 reuse) → JSON parse → field validation → dispatch → 200
- Registered `/forge-log-ingest` POST + OPTIONS routes in `http.ts` with Phase 81 comment
- TDD contract test suite: 22 passing tests covering all 6 auth-gate cases, body validation (type=log, seq=0 not falsy-coerced), envelope shape, and 5 DB round-trip todos

## Task Commits

Each task was committed atomically:

1. **Task 1: Add forgeLogChunks table to schema** - `f9972f8` (feat)
2. **Task 2 RED: Contract test suite** - `3546980` (test)
3. **Task 2 GREEN: appendLogChunk + listJobLogs + forgeLogIngest + http routes** - `7a81573` (feat)

## TDD Gate Compliance

- RED gate commit: `3546980` (test(81-01): add failing test for forgeLogIngest contract)
- GREEN gate commit: `7a81573` (feat(81-01): appendLogChunk + listJobLogs + forgeLogIngest httpAction + http routes)
- REFACTOR: not needed — implementation matched patterns directly

## Files Created/Modified

- `convex/schema.ts` — forgeLogChunks table (hostId, forgeJobId, lines, seq, sentAt) with by_host_job + by_host_job_seq indexes
- `convex/forge.ts` — LOG_CHUNK_LIMIT const + appendLogChunk internalMutation + listJobLogs query (Phase 81 section)
- `convex/forgeLogIngest.ts` (created) — httpAction: OPTIONS/auth/parse/validate/dispatch pattern mirroring forgeIngest.ts
- `convex/http.ts` — import forgeLogIngest + POST + OPTIONS route registration
- `convex/forgeLogIngest.test.ts` (created) — 22 tests: auth gate (6) + body validation (9) + envelope shape (5) + 5 integration todos

## Decisions Made

- `sentAt` uses `v.optional(v.string())` in both schema and mutation args (not `v.union(v.string(), v.null())`) — matches SPEC verbatim; coercion at call site: `body.sentAt ?? undefined`
- `appendLogChunk` is `internalMutation` (not `mutation`) per the httpAction-no-Clerk-identity rule (81-SPEC §Locked design 3)
- `listJobLogs` orders `.order("asc")` — oldest chunk first for terminal top-to-bottom display, opposite of `listJobs` desc
- `LOG_CHUNK_LIMIT = 5000` placed near `JOB_LIST_LIMIT = 1000` per file convention

## Deviations from Plan

None — plan executed exactly as written. All patterns matched the analogs precisely. No auto-fixes required.

## Issues Encountered

None. TypeScript passed clean on first attempt; test suite green on first run.

## Threat Surface Scan

All mitigations from the plan's threat model are implemented:
- T-81-01 (Spoofing): `validateForgeIngestAuth` gates every non-OPTIONS request
- T-81-02 (Tampering): `type==="log"` + all 4 field checks + JSON try/catch on parse
- T-81-03 (T-6-KEYLEAK): no `console.log`/logging of bearer anywhere in `forgeLogIngest.ts`
- T-81-04 (EoP): `appendLogChunk` is `internalMutation` — not client-callable
- T-81-05 (Replay): `by_host_job_seq` unique check; existing seq → no-op return
- T-81-06 (CORS): `getCorsHeaders` on all non-401 responses; `unauthorizedResponse()` omits CORS

No new threat surface beyond what the plan's threat model covers.

## Next Phase Readiness

- **Plan 02 (retention sweep):** `forgeLogChunks` table + `by_host_job` index ready for the `sweepForgeLogChunks` internalMutation + daily cron
- **Plan 03 (log viewer UI):** `listJobLogs` reactive query available for `useForgeJobLogs` hook + `ForgeJobDetail` log pane
- **Plan 04 (Forge handoff):** `/forge-log-ingest` endpoint live (pending deploy); envelope locked for `makeLogSink` finalization
- No blockers. FI-09 contract is complete and typechecked.

## Self-Check

- `convex/schema.ts` contains `forgeLogChunks` with both indexes: confirmed
- `convex/forge.ts` exports `appendLogChunk` (internalMutation) and `listJobLogs` (query): confirmed
- `convex/forgeLogIngest.ts` exists with no bearer logging: confirmed
- `convex/http.ts` has 2 occurrences of `forge-log-ingest` (POST + OPTIONS): confirmed
- `convex/forgeLogIngest.test.ts` has 22 passing tests + 5 todos: confirmed
- All 3 task commits exist (f9972f8, 3546980, 7a81573): confirmed

## Self-Check: PASSED

---
*Phase: 81-live-log-streaming*
*Completed: 2026-06-16*
