---
phase: 115-workspace-scanner
plan: 06
subsystem: convex-http-ingest
tags: [workspace-scanner, http-ingest, auth, security]
requires:
  - 115-04 (convex/workspace.ts — upsertWorkspaceSnapshot internalMutation, getWorkspaceMap query)
  - convex/ingestAuth.ts — validateIngestAuth / unauthorizedResponse (pre-existing, unmodified)
provides:
  - "POST /workspace-ingest HTTP route"
  - "convex/workspaceHttp.ts — workspaceIngestPostHandler (testable) + workspaceIngestPost (httpAction)"
affects:
  - convex/http.ts (route registration)
  - convex/workspace.ts (return-value fix, see Deviations)
tech-stack:
  added: []
  patterns:
    - "Plain exported handler + httpAction wrapper split, so vitest can invoke it directly (mirrors convex/loomHttp.ts and convex/galdrHttp.ts)"
    - "Fail-closed auth as the first executable statement, before any ctx.* access"
    - "Whole-request refusal on the first bad element, carrying its index — never a silent per-row drop"
key-files:
  created:
    - convex/workspaceHttp.ts
    - convex/workspaceHttp.test.ts
  modified:
    - convex/http.ts
    - convex/workspace.ts
decisions:
  - "convex/workspace.ts's upsertWorkspaceSnapshot was edited to return {version, prunedVersion, pruneIncomplete} on all three exit paths — it previously returned undefined on every path, and the plan explicitly sanctioned either reading its existing shape or adding the return (115-06-PLAN.md task 1, step 5). Added the return."
  - "No CORS headers, no OPTIONS partner — deliberately diverges from 115-PATTERNS.md's scan.ts-shaped recommendation, following the /loom/event and /galdr precedent instead. The only client is a host-side Node script; Phase 114 reads through useQuery, not this route."
metrics:
  duration: "~55 minutes"
  completed: 2026-08-12
---

# Phase 115 Plan 06: Workspace Ingest HTTP Route Summary

POST /workspace-ingest added: fail-closed auth first, full field validation (unit-checked
`generatedAt`, boolean-strict flags, bounded `dirs` array, whole-request refusal on the first bad
directory row), dispatching exclusively to `convex/workspace.ts`'s `internalMutation`, with zero
CORS surface by design.

## What Was Built

- **`convex/workspaceHttp.ts`** (new) — `workspaceIngestPostHandler` (plain exported async
  function, testable without the Convex runtime) and `workspaceIngestPost` (the `httpAction`-
  wrapped export `convex/http.ts` routes to). Auth check (`validateIngestAuth`) is the first
  executable statement at **line 103**; the first `ctx.*` access is the `ctx.runMutation` call at
  **line 191** — 103 < 191, confirmed by direct read of the file, not inferred.
- **`convex/http.ts`** — one new import (`workspaceIngestPost` from `./workspaceHttp`) and one new
  route block (`POST /workspace-ingest`), placed after the `/loom/event` block, with a comment
  recording the deliberate CORS/OPTIONS absence. `git diff convex/http.ts` shows exactly that: one
  import line, one comment+route block, zero deletions.
- **`convex/workspace.ts`** (modified — see Deviations) — `upsertWorkspaceSnapshot` now returns
  `{version, prunedVersion, pruneIncomplete}` on all three of its exit paths instead of `undefined`
  everywhere, so the route's 200 response can report the real version number.
- **`convex/workspaceHttp.test.ts`** (new) — 16 vitest tests across the 13 required cases (some
  cases split into sub-tests for booleans and the two hash-shape variants). `npx vitest run
  convex/workspaceHttp.test.ts` → 16/16 pass. `npm test` → 4243 passed, 197 todo (pre-existing,
  unrelated), 0 failed. `npx tsc --noEmit` → clean.

## Auth-check vs. first ctx.* access

- Auth check: `convex/workspaceHttp.ts:103` — `if (!validateIngestAuth(request)) return
  unauthorizedResponse();`, the first executable statement of the handler.
- First `ctx.*` access: `convex/workspaceHttp.ts:191` — `ctx.runMutation(...)`.
- 103 < 191 confirmed.

## validateIngestAuth's two branches — drivable in-process

Both are drivable in-process via `vi.stubEnv("ASTRIDR_INGEST_API_KEY", ...)`, the same technique
`convex/forgeIngest.test.ts` already uses for its sibling `validateForgeIngestAuth`. No `it.todo`
deferral to plan 115-09 was needed. Case 1 (the 200 control) and case 2 (401 refusal, zero
`runMutation` calls) both exist and pass.

**Plan-authoring correction on this point:** the plan's acceptance criteria stated `grep -c
"validateIngestAuth" convex/workspaceHttp.ts` should return `1`. Verified against the plan's own
cited structural template, `convex/loomHttp.ts`: `grep -c "validateLoomAuth" convex/loomHttp.ts`
returns **2** (the import line + the call line) — `1` is not achievable without dropping either
the import or the call. `convex/workspaceHttp.ts` matches the template exactly at **2** lines
(import + call). Corrected the plan's stated expectation rather than the code; `git diff --stat
convex/ingestAuth.ts` is empty (no new auth surface, D-04 intact).

## Namespace-swap mutation proof — the key finding of this plan

Ran per the plan's required procedure: backed up `convex/workspaceHttp.ts` to the scratchpad, swapped
the dispatch call from `internal.workspace.upsertWorkspaceSnapshot` to
`api.workspace.upsertWorkspaceSnapshot`, re-ran the suite, then restored from the backup and
confirmed `git diff --stat convex/workspaceHttp.ts` was empty (byte-identical restore).

**Result differs from what the plan assumed, and both halves matter:**

1. **`npx tsc --noEmit` DOES catch it** — `error TS2339: Property 'upsertWorkspaceSnapshot' does
   not exist on type '{ getWorkspaceMap: FunctionReference<"query","public",...> }'`. This is
   `convex/_generated/api.d.ts`'s `FilterApi<..., FunctionReference<any, "public">>` type on the
   generated `api` export, which structurally excludes internal-visibility functions from the
   public `api.*` namespace at compile time. This is real and it works.
2. **Case 12 (the vitest identity assertion) does NOT fail at runtime.** All 16 tests, including
   case 12, still passed with the swap in place (using an `as any` cast to bypass the TS error and
   force the runtime call). Root cause, read directly from
   `convex/_generated/api.js`: `export const api = anyApi; export const internal = anyApi;` — in
   this project's generated file, `api` and `internal` are literally the same runtime object. A
   `getFunctionName()`-based (or any client-side) identity comparison between a captured `fnRef`
   and `internal.workspace.upsertWorkspaceSnapshot` cannot discriminate api-sourced references
   from internal-sourced ones, because both resolve through the identical proxy.

**What actually enforces T-115-06-01's boundary, restated accurately:** (a) TypeScript's
`FilterApi` type at `tsc` time, which is a genuine compile-time guard against ever writing
`api.workspace.upsertWorkspaceSnapshot` in source, and (b) the Convex backend's own enforcement
that a function declared `internalMutation` (as `upsertWorkspaceSnapshot` is, unmodified from
115-04) cannot be invoked by an external client over the public HTTP API — this is a server-side
property of the target function's declared visibility, not of which import symbol the calling
`httpAction` happened to use. `ctx.runMutation` itself, being an in-process call from a Convex
function, is not restricted to internal-only targets — it can invoke public or internal functions
identically once resolved, which is *why* the client-side identity check can't observe the
difference. Case 12 is retained as a **structural regression guard** (a future edit that changes
the import without also touching the call site is still caught by `tsc`), and its comment in
`convex/workspaceHttp.test.ts` now states this precisely rather than implying the vitest assertion
itself enforces the security boundary — it was overstated in the plan text and is corrected here.

This does not weaken the actual protection: `upsertWorkspaceSnapshot` was already `internalMutation`
from 115-04 and this plan changed neither its declaration nor the live call site (which remains
`internal.workspace.upsertWorkspaceSnapshot`, restored byte-identical). It changes what the test
suite can honestly claim to prove.

## Divergence from 115-PATTERNS.md (as instructed)

`115-PATTERNS.md` recommended following `convex/scan.ts`'s CORS + OPTIONS-partner shape.
`workspaceHttp.ts` deliberately does NOT: no `getCorsHeaders` import, no `Access-Control-*` headers,
no OPTIONS route. Rationale, per the plan and confirmed unchanged during execution: the only
client is `hooks/workspaceScan.mjs` (a host-side Node script sending no `Origin` header and issuing
no preflight), and Phase 114 reads this data through `useQuery` (the Convex client transport), never
through this HTTP route — so CORS/OPTIONS would be pure added surface for zero consumer. This
follows the `/loom/event` and `/galdr/*` precedent already in `convex/http.ts`.

## Deviations from Plan

### Auto-fixed / plan-sanctioned

**1. [Plan-sanctioned, not a Rule 1-4 deviation] `convex/workspace.ts` return-value fix**
- **Found during:** Task 1
- **Issue:** `upsertWorkspaceSnapshot`'s handler returned `undefined` on all three exit paths
  (early no-op prune skip, cap-hit prune-incomplete path, and the fully-deleted path all fell
  through with a bare `return;` or no return statement at all).
- **Fix:** Added an explicit return of `{version, prunedVersion, pruneIncomplete}` at each of the
  three exit points, sourced from values already computed in that scope (no extra reads).
- **Files modified:** `convex/workspace.ts` (not in the plan's `files_modified` frontmatter list,
  but explicitly authorized by the plan's own action text: "If plan 115-04's mutation does not
  return those fields, either read its return shape and match it, or add the return there — say
  which you did in the SUMMARY.")
- **Commit:** `30b5dc2f`

**2. [Rule 1 — plan-authoring defect, corrected against the plan's own cited precedent]
`validateIngestAuth` grep-count acceptance criterion**
- **Found during:** Task 1 verification
- **Issue:** Plan stated the criterion should return `1`; the plan's own structural template
  (`convex/loomHttp.ts`) returns `2` for the analogous `validateLoomAuth` (import line + call
  line), making `1` unachievable without breaking the handler shape.
- **Fix:** Verified `convex/workspaceHttp.ts` matches the template exactly (`2`); removed a
  redundant mention of the function name from the header docstring so the only two occurrences are
  the real import and the real call, matching `loomHttp.ts` precisely.
- **Files modified:** `convex/workspaceHttp.ts`

### Threat-model coverage

All ten `mitigate`-disposition threats (T-115-06-01 through T-115-06-08) are addressed as specified,
with T-115-06-01's proof corrected above to accurately describe the TWO real enforcement mechanisms
rather than a single client-side identity check. T-115-06-09 and T-115-06-10 are `accept`-disposition
and untouched, as specified.

## Not Live Yet

The route exists in source and passes all local verification, but **is not deployed**. Per plan
115-06's scope and `./CLAUDE.md`'s Self-Hosted Convex Operational Rules, no `npx convex deploy`, no
`npx convex env list`, and no `--push` were run at any point during this plan. Deployment and the
live end-to-end proof (a real POST reaching the mutation, a real row landing, the version number in
the response matching a live query) are plan 115-09's `autonomous: false` job.

## Self-Check: PASSED

Re-verified directly (not re-stated from memory):

- `convex/workspaceHttp.ts` — FOUND
- `convex/workspaceHttp.test.ts` — FOUND
- `convex/http.ts` — FOUND (modified)
- `convex/workspace.ts` — FOUND (modified)
- `.planning/phases/115-workspace-scanner/115-06-SUMMARY.md` — FOUND (this file)
- Commit `30b5dc2f` (Task 1: workspaceHttp.ts + http.ts + workspace.ts) — FOUND at `git log --oneline -5` (HEAD~1)
- Commit `cf793683` (Task 2: workspaceHttp.test.ts) — FOUND at `git log --oneline -5` (HEAD)
