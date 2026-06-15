# Phase 78 — Forge Emitter + Convex Schema (PLAN)

**Milestone:** v7.0 Forge Integration · **Phase:** 78 · **Plans:** this file (single plan, 6 tasks)
**Reads:** 078-CONTEXT.md (locked decisions D-01..D-08, SC#1..SC#5)
**Spans two repos:** `codepulse` (schema/ingest/query) + `forge` (emitter). Execute the codepulse tasks first so the endpoint exists before the emitter targets it.

## Objective

Deliver the read-only Surface-Substrate data path for Forge: Forge's engine POSTs job/workspace state to a Convex `/forge-ingest` httpAction, which idempotently upserts into `forgeJobs` / `forgeWorkspaces`, exposed via read queries. No UI, commands, or logs.

## Threat / risk notes

- Ingest is server-to-server; gate with `FORGE_INGEST_API_KEY`. **httpActions have no Clerk identity** — the handler must call **`internalMutation`** upserts (never `requireAuth`), per the repo's known httpAction pattern.
- `forgeJobs` mirrors untrusted-ish local data; validate the payload with `v.` validators before upsert. No secrets in the payload (Forge already scrubs logs; this phase emits no logs).

---

## Task 1 — Convex schema: `forgeJobs` + `forgeWorkspaces` (codepulse)
**Files:** `convex/schema.ts`
**Steps:**
- Add `forgeJobs = defineTable({ forgeJobId: v.string(), hostId: v.string(), agent: v.string(), mode: v.string(), prompt: v.union(v.string(), v.null()), workspaceId: v.string(), status: v.string(), pid: v.union(v.number(), v.null()), exitCode: v.union(v.number(), v.null()), startedAt: v.union(v.string(), v.null()), finishedAt: v.union(v.string(), v.null()), artifactCount: v.number(), model: v.union(v.string(), v.null()), capabilities: v.string(), createdAt: v.string(), updatedAt: v.string() }).index("by_forgeJobId", ["hostId", "forgeJobId"]).index("by_host_status", ["hostId", "status", "updatedAt"]).index("by_updatedAt", ["updatedAt"])`.
- Add `forgeWorkspaces = defineTable({ hostId: v.string(), workspaceId: v.string(), class: v.string(), name: v.string(), rootPath: v.string(), updatedAt: v.string() }).index("by_host_workspaceId", ["hostId", "workspaceId"])`.
**Verify:** `npx convex dev` (or `npx tsc --noEmit`) compiles the schema; tables appear in the Convex dashboard. (D-04, D-06)

## Task 2 — Idempotent upsert mutations (codepulse)
**Files:** `convex/forge.ts` (new)
**Steps:**
- `export const upsertJob = internalMutation({ args: { ...job fields }, handler })` — look up by `by_forgeJobId` (hostId, forgeJobId); patch if exists (only when incoming `updatedAt >= existing.updatedAt`, last-writer-wins), else insert. (D-05)
- `export const upsertWorkspaces = internalMutation({ args: { hostId, workspaces: v.array(...) }, handler })` — replace-by-host: upsert each by `by_host_workspaceId`. (D-06)
**Test:** `convex/forge.test.ts` — insert then re-upsert same (hostId, forgeJobId) → one row, `updatedAt` advanced; stale `updatedAt` ignored. (SC#2)

## Task 3 — `/forge-ingest` httpAction + key auth (codepulse)
**Files:** `convex/forgeIngest.ts` (new), `convex/http.ts`
**Steps:**
- `forgeIngest = httpAction(async (ctx, req) => {...})`: check `Authorization: Bearer ${process.env.FORGE_INGEST_API_KEY}` → 401 on mismatch/missing; parse+validate body (`type: "job" | "workspaces"`); dispatch to `ctx.runMutation(internal.forge.upsertJob|upsertWorkspaces, ...)`; 400 on malformed; 200 `{ok:true}`. **Use internalMutation refs — httpActions have no Clerk identity.**
- `convex/http.ts`: `http.route({ path: "/forge-ingest", method: "POST", handler: forgeIngest })` (+ OPTIONS for CORS parity with the other ingest routes).
**Test:** `convex/forgeIngest.test.ts` — valid key + job payload → 200 + row upserted; bad key → 401; malformed → 400. (SC#1)

## Task 4 — Read query API (codepulse)
**Files:** `convex/forge.ts`
**Steps:**
- `export const listJobs = query({ args: { hostId: v.optional(v.string()) }, handler })` — newest-first by `by_updatedAt` (filter by host when given).
- `export const getJob = query({ args: { hostId: v.string(), forgeJobId: v.string() } })`.
- `export const listWorkspaces = query({ args: { hostId: v.optional(v.string()) } })`.
- Follow the repo's Clerk-gating convention for queries (graceful skip when unset).
**Verify:** queries return upserted data in the shape P79 components consume (Job/Workspace mirror). (SC#5, D-07)

## Task 5 — Forge-side emitter (forge repo)
**Files (forge repo):** `src/emit/codepulse-emitter.ts` (new), wire into the job lifecycle (`src/process/manager.ts` state transitions), `src/config/loader.ts` (hostId + env)
**Steps:**
- Resolve a stable `hostId` (persisted uuid in `.forge/config.json` — Q1 lean).
- On each job lifecycle transition (queued→running→terminal, pid/exitCode changes): POST `{type:"job", hostId, job}` to `${CONVEX_FORGE_INGEST_URL}/forge-ingest` with `Authorization: Bearer ${FORGE_INGEST_API_KEY}`. Fire-and-forget with a bounded retry; **never block or fail the job on emit failure** (Forge stays usable offline).
- Periodic (e.g. 60s) workspace sync: POST `{type:"workspaces", hostId, workspaces}`.
- New env: `CONVEX_FORGE_INGEST_URL`, `FORGE_INGEST_API_KEY` (both optional — emitter is a no-op when unset, so local-only Forge is unaffected).
**Test (forge):** emitter unit test (mock fetch) asserts payload shape + auth header + no-throw on network error; manager test asserts emit fires on transition.
**Note:** This is Forge roadmap **Phase 6**; land it there, paired with this milestone.

## Task 6 — E2E verification (behavioral, real path)
**Steps:**
- Set `CONVEX_FORGE_INGEST_URL` + `FORGE_INGEST_API_KEY` on a real Forge instance; run a real job.
- Confirm via `listJobs` / Convex dashboard the job appears and transitions queued→running→terminal; workspaces populate. (SC#3, SC#4)
- Confirm an unauthenticated `/forge-ingest` POST is rejected (SC#1) and re-emits don't duplicate (SC#2).
**Done = the real job observed in Convex**, not "mutation returned ok" (per global verification rule).

---

## Build sequence
1 → 2 → 3 → 4 (codepulse, endpoint + storage + read) → 5 (forge emitter targets the live endpoint) → 6 (E2E).

## Out of scope (explicit)
No `/forge` page/route/components, no `forgeCommands` queue, no launch/stop, no log tables/streaming, no artifact preview. Those are Phases 79–82.

## Open questions carried from CONTEXT
Q1 hostId source (lean: persisted uuid), Q2 emit granularity (lean: per-transition), Q3 retention (lean: defer).
