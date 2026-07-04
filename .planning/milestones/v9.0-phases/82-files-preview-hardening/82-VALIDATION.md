---
phase: 82
slug: files-preview-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 82-RESEARCH.md § Validation Architecture. The Per-Task map below is a
> requirement-level skeleton; the planner expands it to concrete task IDs (82-PP-TT).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (configured, existing — jsdom) |
| **Config file** | `vite.config.ts` (existing Vitest config) |
| **Quick run command** | `npx vitest run convex/forgeFileIngest.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~quick: <5s targeted file · full: existing suite |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/forgeFileIngest.test.ts` (or the file touched by the task)
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** `npm test` fully green
- **Max feedback latency:** < 30 seconds (targeted file run)

---

## Per-Task Verification Map

> Requirement-level skeleton (from 82-RESEARCH.md). Planner replaces `{N}-PP-TT` with real task IDs
> and binds each to the plan/wave that delivers it. Threat refs map to 82-RESEARCH.md § Security Domain.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 82-PP-TT | — | — | REQ-1 (FI-12) — `listJobFiles` returns correct rows | — | path/kind/sizeBytes returned verbatim | unit (pure helper) | `npx vitest run convex/forgeFileIngest.test.ts` | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-1 — ingest idempotent per (hostId, forgeJobId, path) | — | re-POST creates no duplicate rows | unit (simulateDispatch) | same | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-8 (FI-14) — 401 bad bearer / 400 bad body / CORS preflight | T-path-auth | reject unauthenticated write | unit (validateForgeIngestAuth) | same | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-2 (FI-13) — ≤1 MB text artifact retrievable | — | content roundtrips under doc-value limit | unit (simulateDispatch) | same | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-2 — >1 MB / non-previewable ships metadata only | T-oversized-doc | no oversized-document write | unit | same | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-3 (FI-14) — retention TTL deletes doc **and** blob | T-blob-leak | `ctx.storage.delete` before `ctx.db.delete` | unit (pure helpers) | same | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-3 — per-job cap deletes oldest-first | T-storage-dos | newest survive by construction | unit (pure helpers) | same | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-9 (FI-14) — daemon enumeration rejects path-traversal/symlink-escape | T-path-traversal / T-symlink | `guardPath` + `realpathSync.native` containment | unit (guard) | `npx vitest run` (forge repo enumeration test) | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-9 — no `allow-same-origin`, no `dangerouslySetInnerHTML` | T-xss-html | sandboxed inert render; escaped source | code review + grep | `grep -rE "allow-same-origin|dangerouslySetInnerHTML" src/` | n/a | ⬜ pending |
| 82-PP-TT | — | — | REQ-8 — no browser-side `FORGE_INGEST_API_KEY` | T-bearer-exposure | key absent from `src/` | grep/audit | `grep -r FORGE_INGEST_API_KEY src/` | n/a | ⬜ pending |
| 82-PP-TT | — | — | REQ-6 (FI-12) — Files tab renders; Details + Logs unchanged | — | third tab; default `details` preserved | smoke + visual | `npx vitest run src/App.test.tsx` + manual | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-7 (FI-12) — running → empty state; terminal → listing | — | terminal-state gate | unit/smoke | `npx vitest run` | ❌ W0 | ⬜ pending |
| 82-PP-TT | — | — | REQ-12 (FI-13) — live round-trip (env gate set/unset) | — | files appear in cloud; gate unset = no-op | e2e (manual) | manual | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/forgeFileIngest.test.ts` — auth (REQ-8), body validation, `simulateForgeFileIngestDispatch`, retention pure helpers, idempotency, ≤1 MB cap
- [ ] `convex/forge.ts` — export pure helpers (`artifactByteSize`, `selectFileCapDeletes`, `selectFileTtlDeletes`) so retention logic is testable without a Convex runtime (mirrors Phase 81 `chunkByteSize` / `selectTtlDeletes`)
- [ ] `forge` repo — extend `src/emit/codepulse-emitter.test.ts` (or a new enumeration test) with a path-traversal / symlink-escape rejection case

*Existing Vitest infrastructure (jsdom, `src/test/setup.ts`) covers the React component tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live cross-repo round-trip | REQ-12 (FI-13) | Requires a real `forge` daemon completing a job with the env gate set, then the env gate unset | Set `FORGE_FILE_INGEST_URL` + `FORGE_INGEST_API_KEY`, complete a job, confirm files + capped artifacts appear in `/forge` Files tab; unset the gate, complete a job, confirm daemon no-op (no crash, no calls) |
| Sandboxed HTML preview renders inert | REQ-9 (FI-14) | Visual confirmation that `<script>`/markup is escaped in Source and sandboxed in Preview | Store an artifact containing `<script>`; confirm Source shows escaped text, Preview iframe does not execute |
| Production CORS resolves for non-local origin | REQ-10 (OPS-01) | Requires the deployed Convex environment with `CODEPULSE_ALLOWED_ORIGIN` set | Confirm a non-local origin gets a non-wildcard CORS header on the Forge ingest endpoints |
| Files tab token styling + Lucide-only | REQ-11 (FI-14) | Visual review against Matrix Emerald tokens | Inspect empty/loading/error states render token-consistent, Lucide icons only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
