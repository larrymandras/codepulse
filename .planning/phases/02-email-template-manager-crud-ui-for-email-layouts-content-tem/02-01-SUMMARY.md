---
phase: 02-email-template-manager
plan: 01
subsystem: api
tags: [typescript, react-hooks, crud, email-templates, rest-api, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-00
    provides: "GET /api/email-assets endpoint in astridr-repo, test stub files"
provides:
  - "EmailLayout, EmailTemplate, AgentEmailDefaults, PreviewResponse, EmailAssetItem types"
  - "16 CRUD/preview/upload API functions in astridrApi.ts"
  - "variableSchemaToRows, rowsToVariableSchema, buildSampleVariables utilities"
  - "useEmailLayouts, useEmailTemplates, useAgentDefaults, useEmailAssets hooks"
affects: [02-02, 02-03, 02-04, 02-05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CRUD hook with loading/error/reload state", "Client-side is_active belt-and-suspenders filter", "404-safe agent defaults resolution"]

key-files:
  created:
    - src/lib/emailTemplateUtils.ts
    - src/hooks/useEmailLayouts.ts
    - src/hooks/useEmailTemplates.ts
    - src/hooks/useAgentDefaults.ts
    - src/hooks/useEmailAssets.ts
  modified:
    - src/lib/astridrApi.ts
    - src/lib/emailTemplateUtils.test.ts

key-decisions:
  - "[02-01] uploadEmailAsset uses raw fetch + FormData, NOT authHeaders() — follows importAgentYaml multipart pattern exactly (T-02-01)"
  - "[02-01] Client-side is_active filter as belt-and-suspenders guard on layouts/templates hooks"
  - "[02-01] useAgentDefaults catches AstridrApiError 404 per-agent, returning null for unconfigured agents"

patterns-established:
  - "Email CRUD hook: useState<T[]> + useCallback load + useEffect auto-fetch + reload return"
  - "404-safe parallel fetch: Promise.all with per-item try/catch for missing resources"
  - "Variable schema converters: JSONB Record <-> VariableRow[] for table UI binding"

requirements-completed: [D-01, D-10, D-11, D-13]

# Metrics
duration: 4min
completed: 2026-05-09
---

# Phase 02 Plan 01: Foundation Summary

**Email template data layer with 5 types, 16 API functions, 3 utility helpers (7 tests), and 4 CRUD hooks for layouts/templates/agent-defaults/assets**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-09T16:14:12Z
- **Completed:** 2026-05-09T16:18:46Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- All email template TypeScript types defined and exported (EmailLayout, EmailTemplate, AgentEmailDefaults, PreviewResponse, EmailAssetItem, LayoutCreate, TemplateCreate)
- 16 CRUD API functions exported: layouts (5), templates (6), agent defaults (2), assets (3) -- uploadEmailAsset follows raw FormData pattern, NOT authHeaders()
- Variable schema utilities (variableSchemaToRows, rowsToVariableSchema, buildSampleVariables) with 7 passing tests via TDD
- 4 React hooks (useEmailLayouts, useEmailTemplates, useAgentDefaults, useEmailAssets) with loading/error/reload state

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, API functions, and utility library with tests** - `8ce2692` (feat) -- TDD: RED (import fails) -> GREEN (7 tests pass)
2. **Task 2: CRUD hooks for all 4 data domains** - `b9fcd69` (feat)

## Files Created/Modified
- `src/lib/astridrApi.ts` - Added 5 interfaces + 16 CRUD/preview/upload API functions (164 lines appended)
- `src/lib/emailTemplateUtils.ts` - Variable schema converters and sample variable builder (created)
- `src/lib/emailTemplateUtils.test.ts` - 7 unit tests for utility functions (converted from .todo() stubs)
- `src/hooks/useEmailLayouts.ts` - Layouts CRUD hook with is_active client filter (created)
- `src/hooks/useEmailTemplates.ts` - Templates CRUD hook with is_active client filter (created)
- `src/hooks/useAgentDefaults.ts` - Agent defaults hook with 404-safe parallel fetch (created)
- `src/hooks/useEmailAssets.ts` - Assets hook with folder filter state (created)

## Decisions Made
- uploadEmailAsset uses raw fetch + FormData, NOT authHeaders() -- follows the existing importAgentYaml multipart pattern exactly to avoid Content-Type header collision (threat T-02-01)
- Client-side is_active filter added as belt-and-suspenders guard on layout/template hooks -- API already filters with ?is_active=eq.true but client protects against server not supporting that syntax
- useAgentDefaults catches AstridrApiError with status 404 per-agent rather than failing the entire load -- agents without configured email defaults get emailDefaults: null

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None -- no external service configuration required.

## TDD Gate Compliance
- RED gate: Import of `./emailTemplateUtils` failed (module not found) -- tests could not run
- GREEN gate: `8ce2692` -- emailTemplateUtils.ts created, all 7 tests pass
- REFACTOR gate: Not needed -- utility functions are clean as written

## Next Phase Readiness
- All data layer foundations ready for Plan 02-02 (page shell with 4 tabs, route/nav registration)
- All hooks ready for Plan 02-03+ components to import and use
- No blockers or concerns

---
*Phase: 02-email-template-manager*
*Completed: 2026-05-09*
