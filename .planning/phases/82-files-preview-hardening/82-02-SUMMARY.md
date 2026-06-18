---
phase: 82
plan: "02"
subsystem: Convex backend (Forge retention sweep + OPS-01 deploy checklist)
tags: [convex, crons, retention, ops, deploy]
requires:
  - "convex/forge.ts sweepForgeFileRecords (built in 82-01)"
  - "convex/forgeFileIngest.test.ts retention + D-05 tests (built in 82-01)"
provides:
  - "sweep-forge-file-records daily cron at 04:00 UTC (offset from 03:30 log sweep)"
  - "docs/forge-deploy-checklist.md (OPS-01 env-var deploy checklist)"
affects:
  - "82-03 (UI hooks — no retention dependency)"
  - "82-04 (daemon emitter — FORGE_FILE_INGEST_URL documented in checklist)"
tech-stack:
  added: []
  patterns:
    - "crons.daily offset scheduling (avoid scheduler contention by hour separation)"
    - "Gate-independent Forge ingest channel documentation"
key-files:
  created:
    - "docs/forge-deploy-checklist.md"
  modified:
    - "convex/crons.ts"
decisions:
  - "sweep-forge-file-records registered at 04:00 UTC, offset from sweep-forge-log-chunks at 03:30 (same precedent as log sweep offset from 03:00 evaluate-memory-quality)"
  - "sweepForgeFileRecords + all retention tests pre-shipped in 82-01; 82-02 is cron wire-up + checklist only"
metrics:
  duration: "~10 min"
  completed: "2026-06-17"
  tasks: 2
  files: 2
---

# Phase 82 Plan 02: Forge Retention Sweep Wire-Up + OPS-01 Deploy Checklist Summary

Daily cron `sweep-forge-file-records` wired to `sweepForgeFileRecords` at 04:00 UTC (offset from 03:30 log sweep), plus the OPS-01 `docs/forge-deploy-checklist.md` documenting every Forge ingest env var including `CODEPULSE_ALLOWED_ORIGIN`.

## What Was Built

**Task 1: sweepForgeFileRecords + retention tests — pre-built in 82-01**

82-01 shipped the full `sweepForgeFileRecords` internalMutation (two-pass TTL + per-job cap, blob-before-row D-05) and the complete retention test suite in `forgeFileIngest.test.ts` (40 tests, 5 todo). The 82-01 SUMMARY explicitly deferred only the cron registration to 82-02. Task 1 of this plan verified the existing implementation and tests pass — no new code was needed.

- `sweepForgeFileRecords`: TTL pass deletes forgeArtifacts + forgeFiles older than 7 days (storage.delete before db.delete for image artifacts). Cap pass groups surviving artifacts by job and drops oldest-first for any job exceeding ARTIFACT_BYTE_CAP_PER_JOB (10 MB).
- Retention tests: `selectFileTtlDeletes` (8-day-old deleted, 6-day and boundary survive), `selectFileCapDeletes` (over-cap drops oldest, newest survives), D-05 blob ordering (storage.delete called before db.delete for image; not called for text artifacts).
- **Result:** 40 passed, 5 todo (integration round-trips deferred, same pattern as Phase 81).

**Task 2 [`c49a246`]: sweep-forge-file-records cron + OPS-01 deploy checklist**

- `convex/crons.ts`: Added `crons.daily("sweep-forge-file-records", { hourUTC: 4, minuteUTC: 0 }, internal.forge.sweepForgeFileRecords)` after the Phase 81 log sweep block. Hour 4:00 UTC is offset from 3:30 (log sweep) → 3:00 (memory quality) per the established contention-avoidance convention.
- `docs/forge-deploy-checklist.md`: OPS-01 checklist with a 6-row variable table (Variable / Required / Where set / Purpose) covering: `CODEPULSE_ALLOWED_ORIGIN`, `FORGE_INGEST_API_KEY`, `FORGE_INGEST_ALLOW_ANON`, `CONVEX_FORGE_INGEST_URL`, `FORGE_LOG_INGEST_URL`, `FORGE_FILE_INGEST_URL`. Includes gate-independence section noting that each channel (job-state / log / file) can be disabled independently by leaving its URL unset. Quick-setup code block included.

## Must-Haves Verification

- File/artifact records past the 7-day TTL are deleted while in-window records survive — `selectFileTtlDeletes` tests confirm. ✓
- When the per-job artifact byte cap is exceeded, oldest artifacts are deleted first — `selectFileCapDeletes` tests confirm. ✓
- Image blobs removed from Convex File Storage when doc rows pruned (no blob leak) — D-05 ordering tests confirm; sweep source code guards every `ctx.db.delete` with `if (artifact.storageId) await ctx.storage.delete(artifact.storageId)` first. ✓
- Deploy checklist documents `CODEPULSE_ALLOWED_ORIGIN` + every Forge ingest env var — `docs/forge-deploy-checklist.md` created. ✓
- `sweep-forge-file-records` daily cron at 04:00 UTC, offset from 03:30 log sweep — `convex/crons.ts` updated. ✓

## Deviations from Plan

### Pre-built deliverable (not a bug — scope boundary clarification)

**[Rule 3 - Scope] Task 1 deliverables (sweepForgeFileRecords + retention tests) were pre-shipped in 82-01**
- **Found during:** Plan start — reading 82-01 SUMMARY and forge.ts live source.
- **Situation:** 82-01 Task 2 (GREEN) implemented the full `sweepForgeFileRecords` body including both passes and D-05 blob ordering. 82-01 Task 3 included all retention and D-05 ordering tests in `forgeFileIngest.test.ts`. The 82-01 SUMMARY noted only "Cron registration deferred to 82-02."
- **Action:** Verified implementation and tests pass (40/40). Task 1 committed as pre-verified; no duplicate implementation needed.
- **Impact:** Positive — 82-02 work is cron wire-up + checklist only; scope tighter than planned.

## Threat Model Coverage

- T-82-05 (blob leak on prune): `sweepForgeFileRecords` calls `ctx.storage.delete(storageId)` BEFORE `ctx.db.delete(_id)` for every artifact with a storageId. ✓
- T-82-07 (unbounded growth): 7-day TTL + 10 MB per-job cap enforced daily by cron. ✓
- T-82-08 (production CORS wildcard): `docs/forge-deploy-checklist.md` mandates `CODEPULSE_ALLOWED_ORIGIN` set in prod with exact semantics documented. ✓
- T-82-09 (bearer key in doc): Checklist documents the NAME and purpose only — no value ever written. ✓
- T-82-SC: Zero new packages installed. ✓

## Verification

- `npx vitest run convex/forgeFileIngest.test.ts` — 40 passed, 5 todo. ✓
- `npx tsc --noEmit` — clean (no errors in forge.ts or crons.ts). ✓
- `grep -c "sweep-forge-file-records" convex/crons.ts` — 1. ✓
- No other cron at `{ hourUTC: 4, minuteUTC: 0 }`. ✓
- `docs/forge-deploy-checklist.md` references `CODEPULSE_ALLOWED_ORIGIN`, `FORGE_INGEST_API_KEY`, `FORGE_LOG_INGEST_URL`, `FORGE_FILE_INGEST_URL`. ✓

## Self-Check: PASSED

- Files: convex/crons.ts (modified) — FOUND.
- Files: docs/forge-deploy-checklist.md (created) — FOUND.
- Commits: c49a246 (Task 2: cron + checklist) — FOUND.
- sweepForgeFileRecords in forge.ts — pre-committed in 82-01 (1fc99bd). FOUND.
- Retention + D-05 tests in forgeFileIngest.test.ts — pre-committed in 82-01 (e140491, 1fc99bd). FOUND.
