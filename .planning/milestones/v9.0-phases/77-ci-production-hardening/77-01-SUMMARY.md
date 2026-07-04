---
phase: 77-ci-production-hardening
plan: "01"
subsystem: convex/cors
tags: [cors, security, convex, ingest, ops-01]
requirements: [OPS-01]

dependency_graph:
  requires: []
  provides: [getCorsHeaders-per-request-cors, parseAllowlist, fail-closed-cors]
  affects: [convex/ingestAuth.ts, all 9 ingest handler files]

tech_stack:
  added: []
  patterns:
    - "Per-request CORS origin matching via Set.has() against parsed allowlist"
    - "Exported pure helper (getCorsHeadersWithAllowlist) for testability without module-cache issues"

key_files:
  created: []
  modified:
    - convex/ingestAuth.ts
    - convex/__tests__/ingestAuth.test.ts
    - convex/ingest.ts
    - convex/runtimeIngest.ts
    - convex/hrIngest.ts
    - convex/configVersionIngest.ts
    - convex/otelLogs.ts
    - convex/otelMetrics.ts
    - convex/scan.ts
    - convex/v6Ingest.ts
    - convex/warRoomIngest.ts

decisions:
  - "getCorsHeadersWithAllowlist(request, allowlist) extracted as pure testable helper to sidestep vi.stubEnv/module-cache problem"
  - "unauthorizedResponse() uses minimal fixed headers only (no ACAO) — a 401 does not negotiate CORS"
  - "warRoomIngest.ts auto-migrated under Rule 2 (plan omitted it; leaving it would create a security gap)"

metrics:
  duration: "~10 minutes"
  completed: "2026-06-10"
  tasks_completed: 2
  files_modified: 11
---

# Phase 77 Plan 01: CORS Hardening — fail-closed per-request origin allowlist

**One-liner:** Replaced static `corsHeaders` export in `convex/ingestAuth.ts` with `parseAllowlist()` + `getCorsHeaders(request)` fail-closed allowlist; migrated all 9 ingest handler call sites; 18 tests green.

## What Was Built

Hardened production CORS for all CodePulse ingest endpoints (OPS-01):

1. **`convex/ingestAuth.ts` — core refactor:**
   - Removed `export const corsHeaders` (was fail-open: `CODEPULSE_ALLOWED_ORIGIN ?? "*"`)
   - Added `export function parseAllowlist(raw: string | undefined): Set<string> | null` — comma-splits, trims, drops empties, returns null for falsy/empty input (dev fallback signal)
   - Added `const _allowlist` computed once at module init from `CODEPULSE_ALLOWED_ORIGIN`
   - Added `export function getCorsHeadersWithAllowlist(request, allowlist)` — pure testable helper; echoes matched origin as ACAO, omits ACAO for unmatched/no-origin, returns `"*"` when allowlist is null (dev fallback)
   - Added `export function getCorsHeaders(request)` — thin wrapper calling `getCorsHeadersWithAllowlist(request, _allowlist)` for production use
   - Updated `unauthorizedResponse()` to use minimal fixed headers `{ "Content-Type": "application/json" }` only (no ACAO on 401)

2. **`convex/__tests__/ingestAuth.test.ts` — expanded test coverage:**
   - Updated import (dropped `corsHeaders`, added `parseAllowlist`, `getCorsHeaders`, `getCorsHeadersWithAllowlist`)
   - Updated 2 existing `corsHeaders` property tests to use `getCorsHeaders(req)` equivalents
   - Added `describe("parseAllowlist + getCorsHeaders — CORS allowlist (OPS-01)")` block with 11 new tests
   - Total: 18 tests passing (up from 7)

3. **9 handler files migrated** (`ingest.ts`, `runtimeIngest.ts`, `hrIngest.ts`, `configVersionIngest.ts`, `otelLogs.ts`, `otelMetrics.ts`, `scan.ts`, `v6Ingest.ts`, `warRoomIngest.ts`):
   - Import changed from `corsHeaders` to `getCorsHeaders`
   - Every `corsHeaders` reference (OPTIONS preflight, spread in 200/400/415 responses) replaced with `getCorsHeaders(request)`
   - Zero bare `corsHeaders` tokens remain in convex/ directory

## How It Was Verified

**Task 1 — RED phase (failing):**
```
npx vitest run convex/__tests__/ingestAuth.test.ts
Result: 13 failed | 5 passed — confirmed tests fail before implementation
```

**Task 1 — GREEN phase (after ingestAuth.ts rewrite):**
```
npx vitest run convex/__tests__/ingestAuth.test.ts
Result: 18 passed — all allowlist behaviors pass
```

**Task 2 — zero bare corsHeaders check:**
```
grep corsHeaders convex/*.ts
Result: 0 matches
```

**Task 2 — TypeScript type check:**
```
npx tsc --noEmit -p convex/tsconfig.json
Result: (no output — clean)
```

**Task 2 — full suite:**
```
npx vitest run
Result: 87 test files passed | 18 skipped | 722 tests passed | 154 todo
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Coverage] warRoomIngest.ts not in plan's 8-file list**
- **Found during:** Task 2 — grep of all convex/*.ts revealed a 9th handler file
- **Issue:** `convex/warRoomIngest.ts` uses `corsHeaders` and was absent from the plan's file list; leaving it would create a security gap (some endpoints hardened, one not)
- **Fix:** Applied identical import update and corsHeaders → getCorsHeaders(request) replacement
- **Files modified:** `convex/warRoomIngest.ts`
- **Commit:** `60c0dd6`

## Known Stubs

None — all CORS functionality is fully wired. No placeholder values remain.

## Threat Flags

No new threat surface introduced. This plan closes T-77-01 and T-77-02 from the plan's threat register:
- T-77-01 (CORS fail-open) — mitigated: fail-closed allowlist implemented
- T-77-02 (Origin header spoofing) — mitigated: Set.has() exact-match, never evaluated

## Self-Check

**Files created/modified:**
- `convex/ingestAuth.ts` — exists with `export function parseAllowlist`, `export function getCorsHeaders`, `export function getCorsHeadersWithAllowlist`
- `convex/__tests__/ingestAuth.test.ts` — exists with allowlist describe block
- All 9 handler files — zero `corsHeaders` tokens

**Commits:**
- `c43bf50` — Task 1 (ingestAuth.ts refactor + tests)
- `60c0dd6` — Task 2 (9 handler file migration)

## Self-Check: PASSED
