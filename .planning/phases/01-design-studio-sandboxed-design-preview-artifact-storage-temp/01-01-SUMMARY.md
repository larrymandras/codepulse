---
phase: 01-design-studio-sandboxed-design-preview-artifact-storage-temp
plan: 01
subsystem: api
tags: [convex, typescript, open-design, docker, sse, rest-api, react-hooks]

requires: []
provides:
  - TypeScript interfaces for all Open Design daemon API types
  - openDesignApi.ts REST client with SSE streaming and FormData upload
  - Convex designProjects and designTemplates tables with upsert/remove/list/listIds/syncFromDaemon
  - useDesignProjects and useDesignTemplates React hooks
  - docker-compose.yml with open-design sidecar on port 17456
  - 6 concrete unit tests for API client functions

affects:
  - All subsequent Phase 01 plans (02-06) depend on these types, API functions, and data layer

tech-stack:
  added: []
  patterns:
    - "odRequest<T> wrapper for Open Design daemon REST calls (no auth, local-only)"
    - "SSE stream consumption via fetch + ReadableStream (not EventSource)"
    - "Convex upsert pattern: query by index then patch or insert"
    - "syncFromDaemon Convex action with Convex cloud limitation documented"
    - "React hook wrapping useQuery with ?? [] guard"

key-files:
  created:
    - src/lib/openDesignTypes.ts
    - src/lib/openDesignApi.ts
    - convex/designProjects.ts
    - convex/designTemplates.ts
    - src/hooks/useDesignProjects.ts
    - src/hooks/useDesignTemplates.ts
    - docker-compose.yml
  modified:
    - src/lib/openDesignApi.test.ts
    - convex/schema.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "Updated convex/_generated/api.d.ts manually to include designProjects and designTemplates — required for tsc clean compile before next convex dev run"
  - "syncFromDaemon action documented with Convex cloud limitation (A7): cloud Convex cannot reach localhost:17456; browser-triggered sync is primary path for production"
  - "exportProject endpoint path documented as ASSUMED per RESEARCH.md A2 — inline comment directs runtime verification via curl"
  - "SSE streaming uses fetch + ReadableStream not EventSource — matches RESEARCH.md recommendation for reconnect control"

patterns-established:
  - "odRequest<T>: no-auth fetch wrapper for Open Design daemon (mirrors astridrApi.ts authHeaders pattern but without auth)"
  - "streamRunEvents: fetch-based SSE consumer with onToken/onError/onDone callbacks and AbortController cleanup"
  - "Convex sync action: diff existing vs incoming IDs, upsert all incoming, remove all missing"

requirements-completed: [D-01, D-06, D-07, D-08, D-09]

duration: 12min
completed: 2026-05-07
---

# Phase 01 Plan 01: Open Design Foundation Layer Summary

**TypeScript type contracts, REST API client with SSE streaming, Convex mirror tables with sync, React hooks, and Docker Compose sidecar for the Open Design daemon integration**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-07T20:37:00Z
- **Completed:** 2026-05-07T20:43:15Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created complete TypeScript type layer (`openDesignTypes.ts`) with 10 exported interfaces covering all daemon API surfaces
- Created `openDesignApi.ts` with 12 exported functions including SSE streaming via `streamRunEvents` and FormData upload via `importClaudeDesign`
- Created Convex domain modules (`designProjects.ts`, `designTemplates.ts`) with upsert/remove/list/listIds/syncFromDaemon and Convex cloud limitation fully documented
- Created `useDesignProjects` and `useDesignTemplates` hooks following the `?? []` guard pattern
- Created `docker-compose.yml` with CORS workaround and Convex cloud env var documented in comments
- Converted 6 `it.todo()` test stubs to concrete passing unit tests

## Task Commits

1. **Task 1: Open Design types, API client, and concrete tests** - `cc2aea8` (feat)
2. **Task 2: Convex schema tables, domain modules, hooks, Docker Compose** - `f512d7c` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/lib/openDesignTypes.ts` - 10 TypeScript interfaces for daemon API (Skill, DesignSystem, OdAgent, OdProject, OdTemplate, RunRequest, RunStatus, RunEvent, HealthResponse, ExportFormat)
- `src/lib/openDesignApi.ts` - REST client with 12 exported functions including SSE streamRunEvents and importClaudeDesign FormData upload
- `src/lib/openDesignApi.test.ts` - 6 concrete passing unit tests (fetch mocked globally)
- `convex/schema.ts` - Added designProjects and designTemplates table definitions with indexes
- `convex/designProjects.ts` - upsert, remove, list, listIds, syncFromDaemon with Convex cloud limitation comment
- `convex/designTemplates.ts` - Same exports for template mirror
- `src/hooks/useDesignProjects.ts` - useQuery(api.designProjects.list) ?? [] hook
- `src/hooks/useDesignTemplates.ts` - useQuery(api.designTemplates.list) ?? [] hook
- `docker-compose.yml` - open-design sidecar on port 17456 with CORS and Convex env var notes
- `convex/_generated/api.d.ts` - Added designProjects/designTemplates imports for tsc clean compile

## Decisions Made

- Manually updated `convex/_generated/api.d.ts` with the new module entries rather than running `npx convex dev` (which requires a live Convex connection). The `api.js` runtime uses `anyApi` so this is safe — types regenerate on next `convex dev`.
- `syncFromDaemon` retained in both modules but documented as secondary path. Plan 05 will implement browser-triggered sync as the primary production approach (Convex cloud limitation A7).
- Export endpoint path (`/api/export/:projectId?format=...`) documented as ASSUMED with inline verification instructions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed esbuild operator precedence error in test file**
- **Found during:** Task 1 (test execution)
- **Issue:** `options.ok ?? status >= 200 && status < 300` was rejected by esbuild as ambiguous operator precedence with `??` and `&&`
- **Fix:** Added parentheses: `options.ok ?? (status >= 200 && status < 300)`
- **Files modified:** src/lib/openDesignApi.test.ts
- **Verification:** `npx vitest run src/lib/openDesignApi.test.ts` passed (6/6)
- **Committed in:** cc2aea8 (Task 1 commit)

**2. [Rule 1 - Bug] Updated stale convex/_generated/api.d.ts for tsc clean compile**
- **Found during:** Task 2 verification (tsc --noEmit)
- **Issue:** Generated API type declarations didn't include designProjects/designTemplates modules — causes 7 TypeScript errors in new domain modules and hooks
- **Fix:** Added `import type * as designProjects` and `import type * as designTemplates` entries to api.d.ts with corresponding module type entries
- **Files modified:** convex/_generated/api.d.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** f512d7c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes were necessary for task completion. No scope creep.

## Issues Encountered

None beyond the two auto-fixed bugs above.

## Known Stubs

None — all API functions wire to real daemon endpoints. `syncFromDaemon` returns `{ synced: 0, removed: 0 }` when `OPEN_DESIGN_URL` env var is absent (correct behavior, not a stub).

## Threat Flags

None. All network surfaces were in the plan's threat model:
- openDesignApi.ts: T-01-01 (local-only, no auth) — accepted
- convex/designProjects.ts upsert: T-01-02 (v.string() validators) — mitigated
- docker-compose.yml port 17456: T-01-03 (localhost only) — accepted
- checkHealth: T-01-04 (AbortSignal.timeout(3000)) — mitigated

## Next Phase Readiness

- All downstream plans (02-06) can import from `openDesignApi.ts`, `openDesignTypes.ts`, `useDesignProjects`, and `useDesignTemplates` without modification
- Convex schema deployed on next `npx convex dev` run
- Docker sidecar ready for `docker compose up --build -d` after cloning nexu-io/open-design

---
*Phase: 01-design-studio-sandboxed-design-preview-artifact-storage-temp*
*Completed: 2026-05-07*
