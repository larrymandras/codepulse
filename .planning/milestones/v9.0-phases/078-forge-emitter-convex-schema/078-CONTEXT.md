# Phase 78 — Forge Emitter + Convex Schema (CONTEXT)

**Milestone:** v7.0 Forge Integration · **Phase:** 78 (Phase 1 of 5)
**Promoted from:** backlog 999.1 (2026-06-13)
**Status:** planned (not started)

## Goal

Stand up the **read-only foundation** of the Forge→CodePulse fold-in: a local Forge daemon emits job + workspace state UP to Convex via an `/ingest`-style endpoint, CodePulse persists it in new tables, and exposes query functions. **No UI, no command dispatch, no log streaming** — those are Phases 79–81. This phase proves the Surface-Substrate data path end-to-end for Forge with the lowest-risk slice.

## Scope

**In:**
- New Convex tables `forgeJobs` + `forgeWorkspaces`.
- New Convex httpAction `/forge-ingest` (POST) + dispatch → idempotent upsert mutations.
- Read query API in `convex/forge.ts` (`listJobs`, `getJob`, `listWorkspaces`).
- Forge-side **emitter** (in the `forge` repo) that POSTs job-state-change + periodic workspace sync to `/forge-ingest`.

**Out (later phases):** any `/forge` page or component (P79), launch/stop command queue (P80), live log tail (P81), file/artifact preview (P82).

## Cross-repo pairing

This phase has a **Forge-side counterpart**: forge's own roadmap **Phase 6 "Event Emitter — CodePulse integration"** is exactly the emitter half. The emitter work lands in the `forge` repo (extending its Fastify job engine with an outbound POST on job state-change); the schema + ingest + query half lands here in `codepulse`. Plan/execute them together; neither ships value alone.

## Locked decisions

- **D-01 — Daemon = Forge's existing engine, not a new process.** The emitter is an outbound hook inside Forge's already-running local job engine (it already owns job lifecycle events). No separate daemon binary in P78.
- **D-02 — Transport = HTTP POST to a Convex httpAction `/forge-ingest`**, mirroring the existing `/ingest` / `/runtime-ingest` / `/preflight-ingest` pattern (`convex/http.ts`). One-way (Forge → Convex) this phase.
- **D-03 — Ingest auth = a shared bearer key** `FORGE_INGEST_API_KEY` (analog of the existing `ASTRIDR_INGEST_API_KEY` contract). Reject unauthenticated POSTs. The key never lives in the browser (server-to-server only).
- **D-04 — `forgeJobs` mirrors the Forge Job model** (copied, not cross-imported): `forgeJobId` (Forge's ULID), `hostId` (machine identity — Desktop vs laptop, so multi-device works), `agent`, `mode`, `prompt`, `workspaceId`, `status`, `pid`, `exitCode`, `startedAt`, `finishedAt`, `artifactCount`, `model`, `capabilities`, `createdAt`, `updatedAt`. Indexed `by_forgeJobId`, `by_host_status`, `by_updatedAt`.
- **D-05 — Upserts are idempotent**, keyed by (`hostId`, `forgeJobId`). Re-emitting the same job updates the row; the emitter may resend freely (at-least-once delivery, last-writer-wins on `updatedAt`).
- **D-06 — `forgeWorkspaces`** holds `hostId`, `workspaceId`, `class` (synced/local-only), `name`, `rootPath`, `updatedAt`. Periodic full sync (not event-driven) — workspaces change rarely. Indexed `by_host_workspaceId`.
- **D-07 — Read queries are the consumer contract for P79**, not used by any UI yet. `listJobs({hostId?})` newest-first, `getJob({forgeJobId})`, `listWorkspaces({hostId?})`. Clerk gating follows the existing CodePulse query convention (gracefully skipped when Clerk unset, per repo pattern).
- **D-08 — Read-only, one-way.** Forge is the source of truth for job state; Convex is a replica. No write-back to Forge in this phase.

## Open questions (resolve during planning/execution)

- **Q1 — `hostId` source.** Stable per-machine id: hash of hostname, or a persisted uuid in Forge's `.forge/config.json`? (Lean: persisted uuid in config — survives rename.)
- **Q2 — Emit trigger granularity.** Every status transition, or debounced? (Lean: emit on every lifecycle transition — queued→running→terminal — plus pid/exitCode changes. Low volume.)
- **Q3 — Retention.** Do completed forgeJobs expire? (Lean: keep; add a retention sweep only if volume warrants — defer.)

## Success criteria

1. **SC#1** — `POST /forge-ingest` with a valid key and a Forge job payload upserts a `forgeJobs` row; an invalid/missing key → 401; malformed body → 400.
2. **SC#2** — Re-emitting the same `(hostId, forgeJobId)` updates the existing row (no duplicates) and advances `updatedAt`.
3. **SC#3** — A Forge job run in the `forge` repo (real engine, emitter on) appears in `forgeJobs` and transitions queued→running→terminal as it executes (verified via the Convex dashboard / `listJobs` query — NOT a UI).
4. **SC#4** — Workspace sync populates `forgeWorkspaces` with the host's workspaces.
5. **SC#5** — `listJobs` / `getJob` / `listWorkspaces` return the persisted data in the shape P79's components will consume.

## Verification note (per global rules)

"Done" = a real Forge job, run by the real engine on a real machine, shows up and updates in Convex — observed via the query/dashboard, not "the mutation returned ok." Behavioral verification of the real path.
