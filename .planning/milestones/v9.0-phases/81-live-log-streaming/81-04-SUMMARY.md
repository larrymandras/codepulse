---
phase: 81-live-log-streaming
plan: 04
subsystem: integration
tags: [forge, cross-repo, log-forwarding, round-trip, fetch, seq, t6-keyleak, human-verify]

# Dependency graph
requires:
  - phase: 81-live-log-streaming
    plan: 01
    provides: /forge-log-ingest endpoint + envelope contract + forgeLogChunks + listJobLogs
  - phase: 81-live-log-streaming
    plan: 02
    provides: retention sweep cron (deployed alongside the endpoint)
  - phase: 81-live-log-streaming
    plan: 03
    provides: ForgeLogPane live tail UI that renders the round-trip
provides:
  - Finalized Forge makeLogSink (real best-effort fetch + monotonic per-job seq, D-1)
  - Verified live Forge -> CodePulse log round-trip (tidy-whale-981 deployment)
  - Closed Forge 08-HUMAN-UAT.md (the externally-gated item)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-repo handoff: Forge sender finalized to match the CodePulse-locked envelope; seq counter captured in the makeLogSink closure"
    - "Best-effort/no-retry/lossy delivery: fetch wrapped in try/catch, non-2xx + errors swallowed, never throws to caller"
    - "T-6-KEYLEAK: bearer only in the Authorization header; error logs cite status + line count only"

key-files:
  created:
    - .planning/phases/81-live-log-streaming/81-04-SUMMARY.md
  modified:
    # Cross-repo — committed in C:/Users/mandr/forge, NOT CodePulse
    - "C:/Users/mandr/forge/src/emit/log-forwarder.ts (Forge commit 9428f49)"
    - "C:/Users/mandr/forge/src/emit/log-forwarder.test.ts (Forge commit 9428f49)"
    - "C:/Users/mandr/forge/.planning/phases/08-log-forwarding/08-HUMAN-UAT.md (Forge commit b13fe17)"

key-decisions:
  - "makeLogSink seq counter captured in the returned-closure scope (let seq = 0; seq++ per flush) — monotonic per (host,job), enables CodePulse D-1 dedup/ordering"
  - "Renamed TODO_P81_PATH -> LOG_INGEST_PATH and dropped [ASSUMED]/TODO(P81) markers now the contract is locked"
  - "Empty-batch guard: skip the POST when split lines are empty (avoids inserting empty chunks; does not consume a seq)"
  - "Forge no-op stub tests (6,7) rewritten to mock fetch and assert the real envelope + monotonic seq + error-path key-leak guard"

patterns-established:
  - "Cross-repo phase completion: code change + tests committed in the foreign repo; SUMMARY + tracking stay in the owning repo"

requirements-completed: [FI-09, FI-10, FI-11]

# Metrics
duration: cross-repo (Task 1 ~code edit; Task 2 operator round-trip)
completed: 2026-06-17
---

# Phase 81 Plan 04: Cross-Repo Forge makeLogSink Finalization + Live Round-Trip Summary

**Forge `makeLogSink` finalized (real fetch + per-job `seq`, T-6-KEYLEAK preserved) and the live Forge → CodePulse log round-trip verified end-to-end — closes Forge `08-HUMAN-UAT.md` (SC#4)**

## Accomplishments

- **Task 1 (Forge repo):** Replaced `makeLogSink`'s `TODO(P81)` no-op with a real best-effort `fetch` to `${cfg.ingestUrl}/forge-log-ingest` carrying the locked envelope `{type, hostId, forgeJobId, lines, seq, sentAt}`. Added a monotonic per-job `seq` counter (D-1). Errors/non-2xx swallowed (no retry, lossy-under-pressure — never throws). T-6-KEYLEAK preserved: bearer only in the Authorization header, never logged. Committed in the Forge repo as `9428f49`; `npx tsc --noEmit` clean, `log-forwarder.test.ts` green (19/19, including rewritten envelope + seq + error-path key-leak assertions).
- **Task 2 (live round-trip — operator-verified):** Deployed the CodePulse Convex backend (`tidy-whale-981`), set the shared `FORGE_INGEST_API_KEY` on the deployment + Forge daemon, set `FORGE_LOG_INGEST_URL` to flip the gate on. A running `codex` job's scrubbed log lines streamed **live** into the CodePulse `/forge` Logs pane (auto-following tail) — bearer accepted (no 401). Closed Forge `08-HUMAN-UAT.md` (`b13fe17`).

## Cross-Repo Note

This plan's code change lives in a **separate repository** (`C:/Users/mandr/forge`), not CodePulse. The `log-forwarder.ts`/`.test.ts` edits and the UAT closure are committed in the Forge repo (`9428f49`, `b13fe17`). Only this SUMMARY and the CodePulse phase tracking live in this repo.

## Verification Evidence

- Forge daemon booted clean with `log forwarding: https://tidy-whale-981.convex.site` and **no** `CodePulse ingest auth rejected (401)` line.
- `/forge` Logs tab rendered a live `codex` job ("weather forecast for Cumming, Georgia") streaming real agent output (`web_search`, `command_execution`, `agent_message` chunks) in real time — confirming the full path: `makeLogSink` fetch → `/forge-log-ingest` httpAction → `appendLogChunk` → `forgeLogChunks` → reactive `listJobLogs` → `ForgeLogPane`.

## Deviations from Plan

- The CodePulse-side Convex deploy was a prerequisite for Task 2 and was run by the operator (prod deploy — not auto-approved in-session). The fresh `tidy-whale-981` deployment had no `FORGE_INGEST_API_KEY` initially (→ 401); set on both sides to match (D-3 shared key), which cleared it.
- During execution a placeholder-paste + missing-quotes issue with the daemon's `FORGE_INGEST_API_KEY` env var caused a transient 401; resolved by setting the real key (quoted) and restarting the daemon.

## Threat Surface Scan

- T-6-KEYLEAK: bearer only in the Authorization header; error logging cites status code + batch line count only. Verified by the rewritten key-leak test (fetch-rejects path) — confirmed.
- T-81-13 (Spoofing): `Authorization: Bearer ${FORGE_INGEST_API_KEY}` (D-3 shared key); receiver rejects bad/no bearer with 401 (observed live before the key was fixed).
- T-81-14 (Self-DoS): best-effort/no-retry/lossy delivery; receiver-side retention cap (plan 02) bounds storage.
- T-81-15 (Ordering/dup): monotonic per-job `seq` added; CodePulse dedups on `(hostId,forgeJobId,seq)` and orders by `seq`.

## Self-Check

- Forge `makeLogSink` performs a real `fetch` with `seq` (Forge commit 9428f49): confirmed
- Forge typecheck + log-forwarder tests green: confirmed (19/19)
- Live round-trip: codex job logs streamed into `/forge` Logs pane: confirmed (operator screenshot)
- Forge `08-HUMAN-UAT.md` status: passed (Forge commit b13fe17): confirmed
- No 401 on the authed path after the shared key matched: confirmed

## Self-Check: PASSED

---
*Phase: 81-live-log-streaming*
*Completed: 2026-06-17*
