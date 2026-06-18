---
phase: 82
plan: "01"
subsystem: Convex backend (Forge file/artifact bridge)
tags: [convex, file-storage, ingest, retention, tdd]
requires:
  - "convex/ingestAuth.ts (validateForgeIngestAuth, getCorsHeaders, unauthorizedResponse)"
  - "convex/forge.ts Phase 81 block (SEVEN_DAYS_MS, internalMutation/query conventions)"
provides:
  - "forgeFiles + forgeArtifacts tables (by_host_job + by_host_job_path indexes)"
  - "POST /forge-file-ingest bearer-authed httpAction with image blob storage"
  - "upsertFileEntries / upsertArtifacts internalMutations (path-idempotent)"
  - "listJobFiles / getJobArtifact public reactive queries"
  - "artifactByteSize / selectFileTtlDeletes / selectFileCapDeletes pure helpers"
  - "sweepForgeFileRecords retention internalMutation (D-05 blob delete)"
affects:
  - "82-02 (cron registration + deploy checklist consume sweepForgeFileRecords)"
  - "82-03 (UI hooks consume listJobFiles / getJobArtifact)"
  - "82-04 (Forge daemon emitFiles posts to /forge-file-ingest)"
tech-stack:
  added: []
  patterns:
    - "Convex File Storage: ctx.storage.store (ActionCtx) / getUrl (QueryCtx) / delete (MutationCtx)"
    - "Path-keyed idempotent upsert (last-writer-wins patch, not append-only)"
    - "Exported pure retention helpers for runtime-free unit testing"
key-files:
  created:
    - "convex/forgeFileIngest.ts"
    - "convex/forgeFileIngest.test.ts"
  modified:
    - "convex/schema.ts"
    - "convex/forge.ts"
    - "convex/http.ts"
decisions:
  - "artifactByteSize keys on textContent !== undefined (empty string = 0 bytes, not sizeBytes fallthrough)"
  - "new Blob([bytes.buffer as ArrayBuffer]) — tsc rejects Uint8Array as BlobPart in Convex types"
  - "imageBase64 stripped from dispatched artifact via destructure — never persisted (Pitfall 3)"
metrics:
  duration: "~25 min"
  completed: "2026-06-17"
  tasks: 3
  files: 5
---

# Phase 82 Plan 01: Forge File/Artifact Bridge Backend Summary

Convex-side receiver for the Forge file/artifact bridge — new `forgeFiles`/`forgeArtifacts` tables, a bearer-authed `/forge-file-ingest` httpAction with Convex File Storage image-blob handling, path-idempotent internal mutations, reactive read queries, retention pure helpers, and a 40-assertion TDD test scaffold. Verbatim clone of the Phase 81 log bridge adapted to files, plus the genuinely new File Storage path for image bytes (D-02).

## What Was Built

**Task 1 (RED) — schema tables + test scaffold** [`e140491`]
- `convex/schema.ts`: `forgeFiles` (hostId/forgeJobId/path/kind/sizeBytes/createdAt) and `forgeArtifacts` (adds `textContent` + `storageId: v.id("_storage")`), each with `by_host_job` + `by_host_job_path` indexes. No `seq` field — path is the idempotency key (Pitfall 6).
- `convex/forgeFileIngest.test.ts`: 7 auth cases, `simulateForgeFileIngestDispatch` body-validation group (type=`files`, no seq), retention pure-helper group, and a D-05 blob-delete-ordering group (storage.delete before db.delete). RED — helpers absent from forge.ts.

**Task 2 (GREEN) — forge.ts backend** [`1fc99bd`]
- Constants `FILE_LIST_LIMIT=1000`, `ARTIFACT_BYTE_CAP_PER_JOB=10_000_000`, `PER_FILE_BYTE_CAP=1_000_000`.
- Pure helpers `artifactByteSize`, `selectFileTtlDeletes` (ISO `createdAt`), `selectFileCapDeletes` (oldest-first by createdAt) — exported for runtime-free tests.
- `upsertFileEntries` (last-writer-wins patch), `upsertArtifacts` (blob delete before patch on image overwrite, D-05), `listJobFiles`, `getJobArtifact` (resolves imageUrl via `ctx.storage.getUrl`), `sweepForgeFileRecords` (TTL + per-job cap, blob delete before doc delete).

**Task 3 — ingest httpAction + routes** [`30d3f86`]
- `convex/forgeFileIngest.ts`: OPTIONS/CORS, bearer auth, JSON 400, field 400, base64→Blob→`ctx.storage.store` in ActionCtx, `imageBase64` stripped, dispatch to both internalMutations, 200 {ok:true}.
- `convex/http.ts`: import + `/forge-file-ingest` POST + OPTIONS routes.

## Must-Haves Verification

- POSTing a file listing inserts forgeFiles rows; re-POST patches (no dup rows) — `upsertFileEntries` by_host_job_path `.unique()` check. ✓
- ≤1 MB text artifact retrievable as string; ≤1 MB image resolves to File Storage URL — `getJobArtifact` returns textContent + imageUrl. ✓
- >1 MB / non-previewable file appears as listing row with no retrievable bytes — `forgeFiles` row without matching `forgeArtifacts`. ✓
- Endpoint returns 401 bad bearer, 400 malformed body, serves CORS preflight — httpAction auth/validation/OPTIONS branches + 7 auth tests. ✓
- `listJobFiles({hostId, forgeJobId})` returns path/kind/sizeBytes — query on `by_host_job`. ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] artifactByteSize empty-string handling**
- **Found during:** Task 2 (RED test `returns 0 for empty textContent` failed against truthiness check).
- **Issue:** `textContent ? textContent.length : sizeBytes` returned `sizeBytes` (100) for `textContent: ""` because empty string is falsy — should return 0.
- **Fix:** Changed to `textContent !== undefined ? textContent.length : sizeBytes`.
- **Files modified:** `convex/forge.ts`
- **Commit:** `1fc99bd`

**2. [Rule 3 - Blocking] Uint8Array not assignable to BlobPart**
- **Found during:** Task 3 (`tsc --noEmit` error TS2322 on `new Blob([bytes])`).
- **Issue:** Convex's DOM type surface rejects `Uint8Array<ArrayBufferLike>` as a `BlobPart`.
- **Fix:** `new Blob([bytes.buffer as ArrayBuffer])`.
- **Files modified:** `convex/forgeFileIngest.ts`
- **Commit:** `30d3f86`

## Threat Model Coverage

- T-82-01 (Spoofing): `validateForgeIngestAuth` fail-closed → `unauthorizedResponse()`. ✓
- T-82-02 (Tampering): field validation 400 + `v.` validators on internalMutation args. ✓
- T-82-05 (Blob leak): `upsertArtifacts` storage.delete before patch on overwrite; sweep storage.delete before db.delete. ✓
- T-82-06 (base64 in doc): `imageBase64` destructured out before dispatch, never persisted. ✓
- T-82-SC: zero new packages installed. ✓

## Deferred / Out of Scope (this plan)

- Cron registration of `sweepForgeFileRecords` → 82-02.
- 5 `it.todo` DB round-trip integration tests (no Convex runtime in unit tests) — same pattern as Phase 81; covered by live round-trip in 82-04.
- ActionCtx `ctx.storage.store` 1-minute `npx convex dev` smoke test (RESEARCH Q1) — recommended before live deploy; not blocking unit-test green.

## Verification

- `npx tsc --noEmit` — clean (no forge errors). ✓
- `npx vitest run convex/forgeFileIngest.test.ts` — 40 passed, 5 todo. ✓

## Self-Check: PASSED

- Files: schema.ts, forge.ts, forgeFileIngest.ts, http.ts, forgeFileIngest.test.ts — all FOUND.
- Commits: e140491 (RED), 1fc99bd (GREEN), 30d3f86 (Task 3) — all FOUND.
