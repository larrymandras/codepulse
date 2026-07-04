# Phase 78 — Forge Emitter + Convex Schema (SUMMARY)

**Branch:** `plan/v7.0-forge-integration`
**Date:** 2026-06-15
**Status:** Receiver (Tasks 1–4) COMPLETE; Task 5 done in `forge` repo; Task 6 (deploy + live E2E) pending operator.

## What shipped (codepulse Tasks 1–4)

| Task | Deliverable | Files |
|------|-------------|-------|
| 1 | `forgeJobs` (16 fields, indexes `by_forgeJobId` / `by_host_status` / `by_updatedAt`) + `forgeWorkspaces` (indexed `by_host_workspaceId`) | `convex/schema.ts` |
| 2 | Idempotent `upsertJob` / `upsertWorkspaces` (`internalMutation`), keyed `(hostId, forgeJobId)`, last-writer-wins on `updatedAt` (D-05) | `convex/forge.ts` |
| 3 | `forgeIngest` httpAction (OPTIONS/CORS, bearer auth, type dispatch, 200/400/401) + `validateForgeIngestAuth(FORGE_INGEST_API_KEY)`; routed `POST`+`OPTIONS /forge-ingest` | `convex/forgeIngest.ts`, `convex/ingestAuth.ts`, `convex/http.ts` |
| 4 | Read queries `listJobs({hostId?})` (newest-first), `getJob({hostId,forgeJobId})`, `listWorkspaces({hostId?})` | `convex/forge.ts` |

**Tests:** `convex/forge.test.ts` + `convex/forgeIngest.test.ts` — 39 active (LWW decision, field mapping, capabilities-as-JSON-string, auth gate incl. "does not share Astridr's key", body validation, 16-field envelope, query filters) + 10 `it.todo` DB round-trips.

**Verification:** `npx tsc --noEmit -p convex` clean; new tests 39/39 pass; full `convex/` suite 311/311, no regressions.

## Honest gaps / notes

- **DB round-trip tests are `it.todo`** — the repo has no `convex-test` in-memory harness (all 311 existing tests use extracted pure logic + mocked ctx; these follow that convention). SC#1/SC#2 behavioral proof = Task 6 (live run), per the plan's "Done = a real Forge job shows up in Convex" rule.
- **`convex/_generated/api.d.ts` was hand-extended** for the new `forge`/`forgeIngest` modules because `npx convex codegen` needs a live deployment. `npx convex dev` after deploy overwrites it with the authoritative file.

## Remaining (operator — Task 6)

1. Merge/checkout this branch where Convex deploys from; run `npx convex dev` (regenerates `_generated`, pushes schema + functions). **Forge changes: none — already built (Phase 6).**
2. Set `FORGE_INGEST_API_KEY` (shared bearer) in the Convex deployment env, and set `CONVEX_FORGE_INGEST_URL` (deployment base, no trailing `/forge-ingest`) + `FORGE_INGEST_API_KEY` (+ optional `FORGE_HOST_ID`) in Forge's env.
3. Run a real Forge job → confirm a `forgeJobs` row upserts and transitions via `listJobs` / dashboard (SC#3); confirm a bad-key POST → 401 (SC#1) and re-emits don't duplicate (SC#2). This closes Forge's `06-HUMAN-UAT` item too.
