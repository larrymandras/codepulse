# Phase 081 — Live Log Streaming (Forge → CodePulse log ingest)

> **Status:** DRAFT SPEC (scoping). Authored by mirroring the live Phase 78 job-state
> contract so the Forge side (`makeLogSink`) can be finalized. Hand to
> `/gsd-discuss-phase 081` → `/gsd-plan-phase 081` to formalize. Belongs to the next
> CodePulse milestone (with 080-command-bridge, 082-files-preview-hardening).

## Why this exists

Forge (the local agent runner) already ships a **complete, threat-secured, dormant**
log-forwarding pipeline (Forge Phase 8): a bounded, fire-and-forget `LogForwarder`
that batches scrubbed job-log lines and POSTs them best-effort. It is gated off until
`FORGE_LOG_INGEST_URL` is set, because **CodePulse defines no log-ingest endpoint yet**
— Phase 78 (`/forge-ingest`) handles job-state + workspaces only and explicitly emits
no logs. Forge's sink is a `TODO(P81)` no-op stub.

This phase ships the CodePulse receiver that lights it up, and renders the stream in the
read-only Forge UI tab built in Phase 79.

## The contract to mirror (live, Phase 78)

| Concern | Job-state (existing) | Logs (this phase) |
|---------|----------------------|-------------------|
| Route | `POST /forge-ingest` (`convex/http.ts:72`) | `POST /forge-log-ingest` *(Forge already assumes this path — `TODO_P81_PATH` in `src/emit/log-forwarder.ts`)* |
| Handler | `forgeIngest` httpAction (`convex/forgeIngest.ts`) | new `forgeLogIngest` httpAction (same shape) |
| Auth | `validateForgeIngestAuth` + `FORGE_INGEST_API_KEY` (`convex/ingestAuth.ts:86`) | **reuse verbatim** — Forge sends the same bearer (D-03: separate URL gate, shared key) |
| CORS | `getCorsHeaders` | reuse verbatim |
| Envelope | `{ type, hostId, job }` | `{ type:"log", hostId, forgeJobId, lines }` |
| Persistence | `internal.forge.upsertJob` (upsert, last-writer-wins) | new `internal.forge.appendLogChunk` (**append-only**) |
| Read | `forge.listJobs` / `getJob` (reactive query) | new `forge.listJobLogs` (reactive → live tail for free) |

## Locked design (dictated by the existing contract)

1. **Dedicated `/forge-log-ingest` route**, not a `type:"log"` branch on `/forge-ingest`.
   Forge already targets `${FORGE_LOG_INGEST_URL}/forge-log-ingest`; the separate
   `FORGE_LOG_INGEST_URL` gate (Forge D-03) exists precisely so logs and job-state are
   decoupled (different volume, independent retention). Same `ingestAuth` + CORS helpers.

2. **Append-only `forgeLogChunks` table** (logs are immutable chunks, unlike the upserted
   `forgeJobs`). Mirror the schema/index conventions at `convex/schema.ts:1464`:
   ```ts
   forgeLogChunks: defineTable({
     hostId:     v.string(),
     forgeJobId: v.string(),
     lines:      v.array(v.string()),   // already scrubbed by Forge (T-3-BYPASS upstream)
     seq:        v.optional(v.number()), // monotonic per (host,job) — ordering + dedup
     sentAt:     v.optional(v.string()), // client flush time (ISO)
   }).index("by_host_job", ["hostId", "forgeJobId"]),
   ```

3. **`appendLogChunk` is an `internalMutation`** (httpActions have no Clerk identity —
   same rule as `upsertJob`, `convex/forge.ts:16`). Insert one doc per POSTed batch.

4. **Live tail is free.** Convex queries are reactive; the Phase 79 UI tab subscribing to
   `listJobLogs({hostId, forgeJobId})` ordered by `_creationTime` (or `seq`) streams live
   as chunks land. No websockets/polling to build.

5. **Forge stays authoritative on scrubbing + loss.** Lines arrive already scrubbed;
   delivery is best-effort with NO retry and lossy-under-pressure (Forge drops, never
   blocks). CodePulse must treat gaps as normal, never assume completeness.

## Open decisions — resolve at `/gsd-discuss-phase 081` (do NOT silently pick)

- **D-1 Ordering/dedup field.** Recommend Forge stamp a monotonic per-job `seq` at flush
  (cheap counter on the forwarder) so ordering is deterministic even if best-effort
  batches land out of order, and `appendLogChunk` can skip an insert when
  `(hostId, forgeJobId, seq)` already exists (idempotency despite no client retry).
  Trade-off: a small Forge-side change vs. relying on server `_creationTime` ordering
  only. **Recommend: add `seq`.**
- **D-2 Retention.** The table grows unbounded. Pick one (or both): TTL cron (delete
  chunks older than N days) and/or per-job cap (keep last K chunks / M bytes). Forge
  already bounds client-side; this bounds storage. **Recommend: 7-day TTL cron + per-job
  byte cap.** Must be a phase deliverable, not deferred.
- **D-3 Auth key separation.** Reuse `FORGE_INGEST_API_KEY` (simplest, matches Forge's
  shared-key assumption) vs. a distinct `FORGE_LOG_INGEST_API_KEY`. **Recommend: reuse.**

## Success criteria (draft)

1. `POST /forge-log-ingest` with `{type:"log", hostId, forgeJobId, lines}` + valid bearer
   appends a `forgeLogChunks` doc; bad/missing fields → 400; bad/no bearer → 401; OPTIONS
   preflight → CORS. (Mirror `convex/forgeIngest.test.ts`.)
2. `forge.listJobLogs({hostId, forgeJobId})` returns the job's chunks in order; the Phase 79
   Forge UI tab renders them and **updates live** as new chunks arrive.
3. Retention (D-2) bounds `forgeLogChunks` growth — verified by a cron/cleanup test.
4. **Cross-repo handoff (Forge side, ~1 task):** replace `makeLogSink`'s no-op with the real
   `fetch` to `/forge-log-ingest` matching this envelope; set `FORGE_LOG_INGEST_URL`; run the
   live round-trip → closes Forge `08-HUMAN-UAT.md` (the one externally-gated item).

## Files (CodePulse)

- `convex/forgeLogIngest.ts` (new) — handler, mirror `forgeIngest.ts`
- `convex/forge.ts` — add `appendLogChunk` (internalMutation) + `listJobLogs` (query)
- `convex/schema.ts` — add `forgeLogChunks` table near `forgeJobs` (~L1464)
- `convex/http.ts` — register `/forge-log-ingest` POST + OPTIONS (~L72)
- `convex/forgeLogIngest.test.ts` (new) — mirror `forgeIngest.test.ts`
- Phase 79 Forge UI tab — add the per-job log pane subscribing to `listJobLogs`

## Forge side (separate repo — finalization task)

- `src/emit/log-forwarder.ts` `makeLogSink` — real `fetch` (envelope locked here); keep
  T-6-KEYLEAK (never log `apiKey`). Optionally add the `seq` counter (D-1).
- Set `FORGE_LOG_INGEST_URL=https://<deployment>.convex.site` → live, gate flips on.
