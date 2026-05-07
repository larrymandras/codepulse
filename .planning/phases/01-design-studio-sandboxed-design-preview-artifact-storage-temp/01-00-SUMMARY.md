---
phase: 01-design-studio
plan: 00
subsystem: design-studio
tags: [docker, testing, wave-0, scaffold, nyquist]
dependency_graph:
  requires: []
  provides:
    - open-design/Dockerfile
    - src/pages/DesignStudio.test.tsx
    - src/lib/openDesignApi.test.ts
    - src/components/design-studio/StreamingPreview.test.tsx
    - src/components/design-studio/ExportPanel.test.tsx
    - convex/designProjects.test.ts
    - convex/designTemplates.test.ts
  affects:
    - Plans 01-05 (all can reference these test files in automated verify steps)
tech_stack:
  added: []
  patterns:
    - vitest it.todo() stubs for Nyquist compliance
    - node:24-alpine Dockerfile for better-sqlite3 ABI compatibility
key_files:
  created:
    - open-design/Dockerfile
    - open-design/README.md
    - src/pages/DesignStudio.test.tsx
    - src/lib/openDesignApi.test.ts
    - src/components/design-studio/StreamingPreview.test.tsx
    - src/components/design-studio/ExportPanel.test.tsx
    - convex/designProjects.test.ts
    - convex/designTemplates.test.ts
  modified: []
decisions:
  - open-design directory created with Dockerfile + README since nexu-io/open-design not yet cloned
  - CMD uses JSON array format ["pnpm", "tools-dev", "start", "web"] per Docker best practices
  - it.todo() pattern chosen for all stubs (not placeholder expect) so vitest reports them as todo not failed
metrics:
  duration: "3 minutes"
  completed: "2026-05-07"
  tasks_completed: 2
  files_created: 8
---

# Phase 01 Plan 00: Wave 0 Prerequisites — Dockerfile and Test Scaffolding

Wave 0 prerequisite scaffold: node:24-alpine Dockerfile for the Open Design daemon sidecar plus 6 Nyquist-compliant test stub files covering all design studio behaviors (D-04 through D-12).

## What Was Built

### Task 1: Open Design Dockerfile

Created `open-design/Dockerfile` using `node:24-alpine` as the base image — the critical choice per RESEARCH.md Pitfall 7 (better-sqlite3 ABI mismatch if wrong Node version). The Dockerfile:

- Installs curl (for the docker-compose healthcheck) and git via `apk add`
- Enables corepack for pnpm 10.33.x management
- Copies package files first for layer cache efficiency
- Runs `pnpm install --frozen-lockfile` for deterministic builds
- Sets `OD_DATA_DIR=/app/.od` for SQLite persistence
- Starts with `CMD ["pnpm", "tools-dev", "start", "web"]` (verified start command from QUICKSTART.md)

Also created `open-design/README.md` explaining that the user must clone `nexu-io/open-design` into this directory before building — the directory was created as a placeholder since the source repo has not yet been cloned.

### Task 2: 6 Nyquist Test Stub Files

Created all 6 test stub files matching the RESEARCH.md Validation Architecture test map. All 34 tests use `it.todo()` — vitest recognizes them as todo (not failed), enabling Plans 01-05 to reference these files in their automated verify steps without needing implementation to exist first.

| File | Requirement | Tests |
|------|-------------|-------|
| `src/pages/DesignStudio.test.tsx` | D-04 | 3 todo |
| `src/lib/openDesignApi.test.ts` | D-06 | 6 todo |
| `src/components/design-studio/StreamingPreview.test.tsx` | D-05 | 8 todo |
| `src/components/design-studio/ExportPanel.test.tsx` | D-11 | 7 todo |
| `convex/designProjects.test.ts` | D-08 | 6 todo |
| `convex/designTemplates.test.ts` | D-09 | 4 todo |

Vitest run result: 6 files recognized, 34 todo, 0 failures.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| Task 1: Dockerfile | 5e42a7f | open-design/Dockerfile, open-design/README.md |
| Task 2: Test stubs | 1b04a90 | 6 test files across src/ and convex/ |

## Deviations from Plan

### Auto-added: open-design/README.md

**Rule 2 - Missing critical functionality**
- **Found during:** Task 1
- **Issue:** The plan specified creating the Dockerfile when the open-design directory doesn't exist. Without a README, future operators have no guidance on the required clone step.
- **Fix:** Added README.md alongside the Dockerfile explaining the clone command and setup steps.
- **Files modified:** open-design/README.md
- **Commit:** 5e42a7f

No other deviations — plan executed as written.

## Known Stubs

All 34 test cases are intentional stubs via `it.todo()`. These are Wave 0 scaffolding — the explicit purpose of this plan. Subsequent plans (01-05) will convert each `it.todo()` to a concrete `it()` with assertions as the corresponding implementation is built.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The Dockerfile builds a local Docker image with no published registry exposure. No threat flags.

## Self-Check: PASSED

- open-design/Dockerfile: FOUND
- open-design/README.md: FOUND
- src/pages/DesignStudio.test.tsx: FOUND
- src/lib/openDesignApi.test.ts: FOUND
- src/components/design-studio/StreamingPreview.test.tsx: FOUND
- src/components/design-studio/ExportPanel.test.tsx: FOUND
- convex/designProjects.test.ts: FOUND
- convex/designTemplates.test.ts: FOUND
- Commit 5e42a7f: FOUND
- Commit 1b04a90: FOUND
