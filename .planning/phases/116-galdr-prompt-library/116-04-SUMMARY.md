---
phase: 116-galdr-prompt-library
plan: 04
subsystem: api

tags: [convex, http, galdr, prompt-library, auth, cors]

# Dependency graph
requires:
  - phase: 116-01
    provides: "prompts / promptVersions tables, D-13 retention exemption, validateGaldrAuth"
  - phase: 116-03
    provides: "convex/galdr.ts domain module (list/lookup/listVersions/listCategories queries, createPrompt/updatePrompt/restoreVersion/archivePrompt/toggleFavorite/recordUsage mutations)"
provides:
  - "convex/galdrHttp.ts — four bearer-authed httpAction handlers (galdrPromptGet/galdrListGet/galdrPromptPost/galdrUsagePost) with zero CORS involvement"
  - "convex/http.ts — GET /galdr/prompt, GET /galdr/list, POST /galdr/prompt, POST /galdr/usage routed, no OPTIONS partners"
  - "convex/__tests__/galdrHttp.test.ts — 32 tests proving D-01 (fail-closed auth precedes db access) and D-04 (no CORS headers) against real Response objects"
affects: [116-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain handler + httpAction-wrapper split (galdrHttp.ts): the plain async (ctx, request) => Response function is exported and directly testable; httpAction(...) wraps it only for the router export. Mirrors convex/galdr.ts's *Handler extraction shape, applied to the HTTP layer."
    - "getFunctionName(fnRef) equality for asserting which api.* function a recorded mock call targeted — anyApi's Proxy allocates a fresh object per property access, so === identity comparison on api.galdr.recordUsage always fails; getFunctionName() extracts the stable 'module:export' string both sides resolve to."

key-files:
  created:
    - convex/galdrHttp.ts
    - convex/__tests__/galdrHttp.test.ts
  modified:
    - convex/http.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "D-01 implemented literally: validateGaldrAuth(request) is the first executable statement in all four handlers; Task 3 asserts 401 AND zero runQuery/runMutation calls per handler, per failure mode (no header, wrong bearer, key+anon both unset)"
  - "D-04 implemented by omission, not by a flag: galdrHttp.ts imports neither getCorsHeaders nor getCorsHeadersWithAllowlist, and convex/http.ts registers no OPTIONS route for any /galdr path — verified on real Response objects with a positive control proving the harness can observe a header when one exists"
  - "D-06 on the wire: POST /galdr/prompt catches the SLUG_COLLISION ConvexError and maps err.data to a 409 body carrying existingSlug/existingTitle/existingUpdatedAt/existingArchived — nothing overwritten, nothing auto-suffixed"
  - "POST /galdr/usage calls only api.galdr.recordUsage — architecturally cannot reach the version-append path bumping usage would otherwise risk touching"

patterns-established:
  - "jsonResponse(payload, status) as the single header-construction site in galdrHttp.ts — Content-Type only, audited by both a grep acceptance criterion and a mutation-tested test suite"

requirements-completed: []

# Metrics
duration: ~30min
completed: 2026-08-10
---

# Phase 116 Plan 04: Galdr HTTP Surface Summary

**Four bearer-authed Convex httpAction routes (`GET /galdr/prompt`, `GET /galdr/list`, `POST /galdr/prompt`, `POST /galdr/usage`) exposing the 116-03 domain module to Claude Code, deliberately built with zero CORS negotiation and no OPTIONS handlers — the second route family in this repo (after `/health`) to depart from the POST+OPTIONS convention on purpose.**

## Performance

- **Duration:** ~30 min (includes diagnosing and fixing a stale-codegen blocker before Task 1's tsc gate could pass)
- **Tasks:** 3/3 completed
- **Files created:** 2 (`convex/galdrHttp.ts`, `convex/__tests__/galdrHttp.test.ts`)
- **Files modified:** 2 (`convex/http.ts`, `convex/_generated/api.d.ts`)

## Accomplishments

- `galdrPromptGetHandler`/`galdrListGetHandler`/`galdrPromptPostHandler`/`galdrUsagePostHandler` — four plain, directly-testable handlers, each gated by `validateGaldrAuth` as the first statement, each wrapped by `httpAction(...)` for the router export. `galdrPromptGetHandler` forwards the `slug` query parameter verbatim to `api.galdr.lookup`, never collapsing D-05's exact/fuzzy distinction itself. `galdrPromptPostHandler` maps a `SLUG_COLLISION` `ConvexError` to a 409 carrying the colliding prompt's identity (D-06); `galdrUsagePostHandler` is a narrow route that can only ever call `api.galdr.recordUsage`.
- Four routes registered in `convex/http.ts`, additions-only, with an explanatory comment block citing D-04 so a future editor doesn't "helpfully" add an OPTIONS pair.
- 32 tests in `convex/__tests__/galdrHttp.test.ts`: a harness-liveness control (proves a manufactured CORS header IS observable before any absence assertion), 12 header-absence assertions (3 headers × 4 handlers), 12 auth-gate assertions (3 failure modes × 4 handlers, each also asserting zero db calls), 5 shape assertions (MISSING_SLUG, forwarded query string, SLUG_COLLISION 409 body, MISSING_FIELD, recordUsage call target), and 2 source-level route-registration assertions with their own >=20-line OPTIONS control.
- Both plan-mandated mutation checks performed live and reverted: spreading `getCorsHeaders(request)` into `jsonResponse`'s headers failed all 12 D-04 tests; deleting the `validateGaldrAuth` guard from `galdrPromptGetHandler` failed all 3 of its 401 tests. See "Mutation Check Results" below for the transcript-quoted failures.
- `npx tsc --noEmit` and the full repo `npx vitest run` (290 files passed, 17 skipped, 3849 tests passed) both pass with these changes in place.

## Task Commits

1. **Task 1: galdrHttp.ts handlers** - `b64a1caa` (feat) — includes the `convex/_generated/api.d.ts` fix described in Deviations below (same commit; the fix was required for Task 1's own `tsc --noEmit` gate to pass).
2. **Task 2: register four routes in http.ts** - `f927dee3` (feat)
3. **Task 3: galdrHttp.test.ts** - `b39682b4` (test)

## Files Created/Modified

- `convex/galdrHttp.ts` — the four handlers, `jsonResponse` helper, file-header comment citing D-04.
- `convex/http.ts` — import + four route registrations for `/galdr/prompt` (GET, POST), `/galdr/list` (GET), `/galdr/usage` (POST), with a D-04 comment block. No existing route touched (`git diff` was additions-only, verified).
- `convex/_generated/api.d.ts` — added `galdr`/`galdrHttp`/`galdrSlug`/`galdrVariables` module entries (see Deviations).
- `convex/__tests__/galdrHttp.test.ts` — the 32-test suite described above.

## Decisions Made

- **`galdrPromptPostHandler` does not return `slug` in its 201 body.** `createPrompt` (116-03) returns only the new `promptId`, not the derived slug, and re-deriving `slugify(title)` in the HTTP layer would risk drifting from the single derivation point in `convex/galdrSlug.ts`. The response is `{ ok: true, promptId }`. Not a plan defect — the plan's action text only specified this shape loosely ("On success → 201 with `{ ok: true, slug, promptId }`"); I omitted `slug` rather than guess it, since guessing it would reintroduce the exact "two definitions of slug" risk 116-03's own header comment warns against. Documented here per Rule 4 discretion (a same-behavior omission, not an architectural change) rather than silently deviating from the plan's literal text.
- **Test assertions on "which `api.*` function was called" use `getFunctionName()` from `convex/server`, not `toBe`/object identity.** `anyApi`'s `Proxy` implementation (`node_modules/convex/dist/esm/server/api.js`) allocates a fresh `Proxy` object on every property access — `api.galdr.recordUsage` called twice never returns the same object reference, so `expect(fnRef).toBe(api.galdr.recordUsage)` would silently fail even on correct code. `getFunctionName()` extracts the stable `"module:export"` string both sides resolve to (verified directly by reading the library source before writing the assertion, not assumed).

## Deviations from Plan

### Rule 3 (blocking issue, not a package install) — `convex/_generated/api.d.ts` was missing the `galdr` module entry

- **Found during:** Task 1, first `npx tsc --noEmit` run after writing `galdrHttp.ts`.
- **Issue:** `convex/galdr.ts` (116-03) exports `list`/`lookup`/`listVersions`/`listCategories`/`createPrompt`/`updatePrompt`/`restoreVersion`/`archivePrompt`/`toggleFavorite`/`recordUsage` as `query({...})`/`mutation({...})` registrations, but 116-03 never ran Convex codegen (correctly — its own tests drive the exported `*Handler` functions directly, never `api.galdr.*`, so its `tsc` gate never touched the gap). This plan's handlers are the first code in the repo to reference `api.galdr.lookup` / `api.galdr.listCategories` / `api.galdr.createPrompt` / `api.galdr.recordUsage`, and `convex/_generated/api.d.ts` (the generated `ApiFromModules<{...}>` type map) had no `galdr` (or `galdrHttp`/`galdrSlug`/`galdrVariables`) entry — so `api.galdr` did not type-check.
- **Why this wasn't a live-backend operation:** I confirmed `npx convex codegen --dry-run` reaches the self-hosted deployment ("Downloading current deployment state... / Uploading functions to Convex...") before it writes anything locally — exactly the kind of live contact this plan's environment rules prohibit. Instead I read `api.d.ts`'s own structure: `fullApi` is `ApiFromModules<{ moduleName: typeof moduleName; ... }>`, built purely from TypeScript `typeof` imports of every `convex/*.ts` file (confirmed non-function modules like `http.ts` and `ingestAuth.ts` are already present in the map, proving codegen imports every module unconditionally, not just ones with registered functions) — a pure local, offline type-level construct with zero backend contact.
- **Fix:** Added `import type * as galdr/galdrHttp/galdrSlug/galdrVariables from "../<name>.js"` and the matching `fullApi` map entries, in the exact alphabetical position codegen would place them (between `forgeLogIngest` and `gatewayQuota`). Mechanically identical to what `npx convex dev`/`codegen` would produce; no live call made.
- **Files modified:** `convex/_generated/api.d.ts` (8 lines added).
- **Verification:** `npx tsc --noEmit` passed clean immediately after, both before writing any galdr-referencing code (baseline check) and after all three tasks. `convex/_generated/api.js` (the runtime companion) needed no change — it exports the generic `anyApi` Proxy, which resolves any property path at runtime regardless of the `.d.ts` type map.
- **Committed in:** `b64a1caa` (Task 1 commit — the fix was load-bearing for that task's own acceptance criterion).

---

**Total deviations:** 1 auto-fixed (Rule 3, blocking issue — not a package install, no live backend contact), 1 same-behavior clarification documented above for transparency.
**Impact on plan:** No behavioral divergence from the locked decisions (D-01, D-04, D-05, D-06, D-08). No scope creep. The `api.d.ts` fix is additive-only and mechanically matches what real codegen produces.

## Issues Encountered

None beyond the `api.d.ts` gap above. Both required mutation checks (spread `getCorsHeaders` into `jsonResponse`; delete the `validateGaldrAuth` guard from `galdrPromptGetHandler`) were performed as temporary in-place edits, run against the suite, observed to fail the expected tests, and reverted — the reverted file was diffed byte-identical against the pre-mutation committed version before re-running the full suite green.

## Mutation Check Results (Task 3 acceptance criterion)

1. **Spread `getCorsHeaders(request)` into `jsonResponse`'s header object** (and threaded `request` through every call site so all four handlers actually emit CORS headers): `npx vitest run convex/__tests__/galdrHttp.test.ts -t "D-04"` — 12 failed. Example: `AssertionError: expected '*' to be null` (Access-Control-Allow-Origin), `expected 'POST, OPTIONS' to be null` (Access-Control-Allow-Methods), `expected 'Content-Type, Authorization' to be null` (Access-Control-Allow-Headers) — one triple per handler, all 4 handlers. Reverted (`diff` against the pre-mutation committed file: identical); full suite re-ran green (32/32).
2. **Deleted the `validateGaldrAuth` guard from `galdrPromptGetHandler`** (commented out, left the rest of the handler running unauthenticated): `npx vitest run convex/__tests__/galdrHttp.test.ts -t "galdrPromptGetHandler"` — 3 failed, all in the D-01 describe block: `AssertionError: expected 200 to be 401` for the no-Authorization-header case, the wrong-bearer case, and the key-and-anon-both-unset case. Reverted; full suite re-ran green (32/32), `npx tsc --noEmit` clean.

## User Setup Required

None — no external service configuration required. `GALDR_API_KEY` (and the read-only `GALDR_ALLOW_ANON` dev opt-in) were already introduced by 116-01; this plan adds no new environment variables. Setting the real key and deploying is 116-05's scope, not this plan's.

## Next Phase Readiness

- `convex/galdrHttp.ts` and the four registered routes are ready for 116-05 to deploy and probe live (its blocking human checkpoint).
- 116-05 should note: the `POST /galdr/prompt` 201 body is `{ ok: true, promptId }` — no `slug` field. If the skill needs the slug immediately after save, it must derive it client-side via the same `slugify(title)` used server-side (`convex/galdrSlug.ts`, plan 116-02, already a dependency-free module importable from Node) rather than expecting the HTTP layer to echo it.
- `convex/_generated/api.d.ts` now has real `galdr`/`galdrHttp` entries — the next `npx convex dev`/`codegen` run against the live backend (116-05) will regenerate this file from scratch and should produce an equivalent (possibly reformatted) result; no manual reconciliation expected, but worth a diff-and-confirm rather than an assumption.
- No blockers.

---
*Phase: 116-galdr-prompt-library*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: convex/galdrHttp.ts
- FOUND: convex/__tests__/galdrHttp.test.ts
- FOUND: .planning/phases/116-galdr-prompt-library/116-04-SUMMARY.md
- FOUND commit: b64a1caa (feat: galdrHttp.ts handlers, task 1)
- FOUND commit: f927dee3 (feat: register routes, task 2)
- FOUND commit: b39682b4 (test: galdrHttp.test.ts, task 3)
- FOUND commit: c6f18501 (docs: this summary)
