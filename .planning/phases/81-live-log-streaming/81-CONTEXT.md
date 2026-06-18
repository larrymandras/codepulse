# Phase 81: Live Log Streaming - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the CodePulse **log-ingest receiver** that lights up Forge's dormant `LogForwarder`: a `POST /forge-log-ingest` httpAction → append-only `forgeLogChunks` table → reactive `forge.listJobLogs` query, rendered as a live tail in the Phase 79 Forge job-detail UI. Plus retention (TTL + per-job cap) and the cross-repo Forge `makeLogSink` finalization. Closes the FI-09/10/11 requirements and the externally-gated Forge `08-HUMAN-UAT`.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**3 requirements are locked (FI-09 ingest+table+seq, FI-10 live LogViewer, FI-11 retention).** See `81-SPEC.md` for the full contract, locked design (5 points), resolved decisions (D-1 seq, D-2 retention, D-3 shared key), and 4 success criteria.

Downstream agents MUST read `81-SPEC.md` before planning or implementing. Requirements/contract are not duplicated here.

**In scope (from SPEC.md):** `/forge-log-ingest` httpAction (mirror `forgeIngest.ts`); append-only `forgeLogChunks` table + indexes; `appendLogChunk` internalMutation (seq-idempotent) + `listJobLogs` query; retention sweep (TTL + per-job cap) with a test; live log pane in the Phase 79 Forge UI tab; Forge-side `makeLogSink` finalization + live round-trip.
**Out of scope (from SPEC.md):** any change to the job-state `/forge-ingest` path; new auth/secret (reuse `FORGE_INGEST_API_KEY`, D-3); websockets/polling transport (Convex reactivity IS the tail); log scrubbing (Forge stays authoritative — lines arrive pre-scrubbed); retry/guaranteed delivery (best-effort, lossy-under-pressure by design).

</spec_lock>

<decisions>
## Implementation Decisions

### Retention (D-2 threshold — left open by SPEC)
- **D-01:** Per-job cap **~1 MB** (drop-oldest chunks beyond the cap) **+ 7-day TTL**; a scheduled sweep enforces both. Bounds total storage and any single runaway job. Exact byte accounting + sweep cadence set at plan time (suggest a daily cron; mirror the `expire-stale-forge-commands` cron pattern in `convex/crons.ts`). Cron/cleanup **test required** (SC#3).

### Log viewer UX
- **D-02:** **Auto-follow tail, pause on scroll-up.** The pane sticks to the newest chunk as it lands (terminal-style); scrolling up pauses auto-follow and shows a "jump to latest" affordance that resumes it. Lives in the Phase 79 `ForgeJobDetail` view as a per-job log pane.

### listJobLogs load bound
- **D-03:** **Single bounded reactive query returning all retained chunks** for the job (retention already bounds the set to ~1 MB), ordered by `seq` (fallback `_creationTime`). Mirror `listJobs`' bounded-`take` pattern — no pagination / "load older" path. Convex reactivity gives the live tail for free.

### Forge-side handoff scope
- **D-04:** **Include the cross-repo Forge finalization in this phase** — replace `makeLogSink`'s no-op with the real `fetch` to `/forge-log-ingest` (matching the locked envelope), add the `seq` counter (D-1), set `FORGE_LOG_INGEST_URL`, run the live round-trip. Closes Forge `08-HUMAN-UAT`. Keep T-6-KEYLEAK (never log the bearer).

### Claude's Discretion
- Exact byte-accounting method for the per-job cap, sweep cron cadence, and `listJobLogs` take-limit constant — pick sensible values at plan/implementation time consistent with D-01/D-03.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked scope
- `.planning/phases/81-live-log-streaming/81-SPEC.md` — Locked requirements, contract-to-mirror table, locked design (5 pts), resolved decisions D-1/D-2/D-3, success criteria. **MUST read before planning.**

### CodePulse patterns to mirror (Phase 78 job-state contract)
- `convex/forgeIngest.ts` — httpAction handler shape to mirror for `forgeLogIngest`
- `convex/forge.ts` — `upsertJob` (internalMutation rule) + `listJobs` (bounded reactive query) patterns; add `appendLogChunk` + `listJobLogs` here
- `convex/schema.ts` (~L1464, `forgeJobs`) — table/index conventions to mirror for `forgeLogChunks` (schema given verbatim in SPEC §Locked design 2)
- `convex/http.ts` (~L72) — route registration pattern (POST + OPTIONS)
- `convex/ingestAuth.ts` (`validateForgeIngestAuth` ~L86, `getCorsHeaders`) — **reuse verbatim** (D-3 shared key)
- `convex/forgeIngest.test.ts` — test to mirror for `forgeLogIngest.test.ts`
- `convex/crons.ts` (`expire-stale-forge-commands`) — cron pattern to mirror for the retention sweep

### Phase 79 UI integration
- `src/components/forge/ForgeJobDetail.tsx` — host for the new live log pane
- `src/hooks/useForge.ts` — add a `useForgeJobLogs` hook (mirror existing `useForge*` query hooks; memoize per the Phase 80 referential-stability fix)

### Forge repo (cross-repo, D-04)
- `C:\Users\mandr\forge\src\emit\log-forwarder.ts` — `makeLogSink` (`TODO_P81` / `TODO_P81_PATH`), `resolveLogForwardCfg`; finalize the real fetch + `seq`
- Forge `08-HUMAN-UAT.md` — the externally-gated item this phase closes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validateForgeIngestAuth` + `getCorsHeaders` (`convex/ingestAuth.ts`) — reuse verbatim; same bearer (D-3).
- `forgeIngest` httpAction shape — copy for `forgeLogIngest` (auth → OPTIONS/CORS → parse → validate → dispatch to internalMutation → JSON response).
- `listJobs` bounded reactive query — template for `listJobLogs` (single `.take(N)` + reactivity = live tail).
- Phase 79 `ForgeJobDetail` + `useForge` hooks — extend with the log pane + a `useForgeJobLogs` hook.
- Forge `LogForwarder` (Forge Phase 8, dormant) — already batches scrubbed lines, fire-and-forget, gated on `FORGE_LOG_INGEST_URL`; only `makeLogSink` needs finalizing.

### Established Patterns
- Append-only insert (logs) vs upsert/last-writer-wins (job-state) — `appendLogChunk` inserts one doc per batch; idempotent skip on existing `(hostId, forgeJobId, seq)` (D-1).
- httpAction-invoked writes are `internalMutation` (no Clerk identity) — same rule as `upsertJob`.
- Convex reactive query = live stream (no transport to build).
- Retention via scheduled mutation — mirror the 1-min `expire-stale-forge-commands` cron.
- Hook referential stability (Phase 80 lesson): memoize `raw.map(...)` outputs so the live-tail reactive query doesn't churn React render loops.

### Integration Points
- New `/forge-log-ingest` POST+OPTIONS routes in `convex/http.ts`.
- New `forgeLogChunks` table near `forgeJobs` in `convex/schema.ts`.
- Log pane mounted in the Phase 79 `ForgeJobDetail` view.
- Forge daemon sends to `${FORGE_LOG_INGEST_URL}/forge-log-ingest` once the gate flips on.

</code_context>

<specifics>
## Specific Ideas

- Live tail UX target: behave like `tail -f` in a terminal — auto-stick to bottom, pause when the operator scrolls up to read history, "jump to latest" to re-attach.
- Retention default anchor: ~1 MB/job + 7-day TTL (SPEC's suggested cap, confirmed).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (Phase 81's SPEC is tightly locked; remaining decisions were HOW-only).

</deferred>

---

*Phase: 81-live-log-streaming*
*Context gathered: 2026-06-16*
