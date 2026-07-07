---
phase: 93
slug: eval-pipeline-quality-kpis
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-06
---

# Phase 93 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Ástríðr → /runtime-ingest | Untrusted HTTP POST crosses into Convex; Bearer-gated | task_quality scores, session ids |
| dashboard client → profiles.upsertConfig | Clerk-gated persona config edit | persona config values |
| Convex internalAction → Anthropic/OpenAI | Outbound judge call carries the eval apiKey | eval apiKey, session digest |
| session content → judge prompt | Session tool-output/error text truncated into the judge user prompt | operator session text (truncated ~250 chars) |
| Ástríðr process → CodePulse ingest | Outbound POST carries the shared ingest Bearer key | Bearer key, quality scores |
| detectRegressions → alert engine | Internal producer into the shared alert/webhook delivery path | regression alert payloads |
| Convex queries → React client | Judge rationale text rendered in the browser | judge rationale, session summaries |
| operator → prod Convex env | Setting the eval apiKey + deploying to tidy-whale-981 | eval apiKey (prod secret) |

---

## Threat Register

All `mitigate` findings verified by direct Read/Grep of the cited implementation files (audit 2026-07-06, gsd-security-auditor). SUMMARY claims were treated as hypotheses, not evidence.

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-93-01 | Tampering (replay) | replayed/duplicated task_quality ingest | mitigate | `convex/evalScores.ts:91-99` — `ingestTaskQuality` same-mutation `by_idempotencyKey` query-then-insert, `if (existing) return;` before insert. `storeEvalScoreHandler` (`convex/evalScores.ts:539-546`) applies the identical pattern for judge rows (`judge:${sessionId}`). | closed |
| T-93-02 | Spoofing | unauthenticated ingest POST | mitigate | `convex/http.ts:31` routes `/runtime-ingest` → httpAction; `convex/runtimeIngest.ts:22` gates the entire handler on `validateIngestAuth(request)`. The `task_quality` case (`runtimeIngest.ts:78-97`) calls `internal.evalScores.ingestTaskQuality` (`evalScores.ts:70`, an `internalMutation` per WR-06) — unreachable from the client bundle. Verified at both ends of the boundary. | closed |
| T-93-03 | Tampering (invalid data) | out-of-range / NaN score persisted | mitigate | `convex/evalScores.ts:79-86` — `if (!Number.isFinite(args.overall) \|\| args.overall < 0 \|\| args.overall > 1) return;` before insert; args validator `overall: v.float64()`. | closed |
| T-93-04 | Tampering (indirect) | prompt injection via judge digest | accept | Accepted risk — see Accepted Risks Log. Only control: `DIGEST_TRUNCATE_CHARS = 250` in `buildJudgeDigest` (`convex/evalScores.ts:192,207-260`). | closed |
| T-93-05 | Information Disclosure | eval apiKey leaked in logs | mitigate | No `console.*` in `convex/evalScores.ts` references `apiKey` (only err/validation text, e.g. `:483-491`). `getEvalLLMConfigInternal` (`:122-141`) is an `internalQuery`. Public `getLLMConfig` (`convex/briefings.ts:205-221`) explicitly omits `apiKey` (T-07-05). | closed |
| T-93-06 | Denial of Service | nightly judge cost runaway | mitigate | `convex/evalScores.ts:636` `MAX_SESSIONS_PER_PERSONA = 3` enforced in `sampleSessionsForPersonas` (`:647-674`); `max_tokens: 1024` in both `callAnthropicJudge` (`:383`) and `callOpenAIJudge` (`:417`). | closed |
| T-93-07 | Tampering | partial/zeroed row poisons dedup key | mitigate | `convex/evalScores.ts:494-496` — `callJudgeLLM` throws after 3 exhausted attempts; `judgeOneSession` (`:740-763`) only calls `storeEvalScore` after resolve, so no partial row is ever written — session stays re-sampleable. | closed |
| T-93-08 | Information Disclosure | ingest Bearer key in logs/errors (astridr) | mitigate | `astridr-repo/astridr/integrations/langfuse_eval.py:25-26` — key read only from `os.environ.get("ASTRIDR_INGEST_API_KEY", "")`; `:54-58` logs only `status_code`/`resp.text[:200]`; exception handler (`:59-60`) logs only `str(exc)`. Key never logged. | closed |
| T-93-09 | Denial of Service | mirror failure blocks/raises into score path (astridr) | mitigate | `langfuse_eval.py:35-60` — early return when env unset (`:42-43`); POST wrapped in `try/except Exception` that only logs. Call site (`:123-142`) uses `asyncio.create_task`, independently gated from the Langfuse write (D-03). | closed |
| T-93-10 | Repudiation / operational trust | false-positive regression alert | mitigate | `convex/evalScores.ts:1110-1127` — `evaluateRegression` requires ≥`MIN_SESSIONS_PER_SIDE = 5` (`:839`) per side AND `drop >= REGRESSION_DROP_THRESHOLD = 0.15` (`:840`). Boundary tests at `convex/evalScores.test.ts:764-793` assert no fire at 2-vs-2, 4-vs-6, sub-threshold, single-outlier (D-14). | closed |
| T-93-11 | DoS (signal loss) | alert created but never delivered | mitigate | `convex/evalScores.ts:1235-1249` sets `webhookStatus: "pending"`; `:1346-1349` schedules `internal.webhookDelivery.sendAlertWebhook` immediately after insert. Static-source test (`convex/evalScores.test.ts:1084`) confirms `alerts.create(` never called in the module. | closed |
| T-93-12 | Information Disclosure | apiKey exposed via KPI query / reaching client | mitigate | `listPersonaKpis`/`getPersonaDetail`/`listJudgedSessions` (`convex/evalScores.ts:942-1092`) read only `profileConfigs`, `evalScores`, `alerts`, `profileSwitches`, `configChanges` — no `agentConfigs`/`apiKey` reference. `src/hooks/useEvalScores.ts` has zero `apiKey` occurrences. | closed |
| T-93-13 | Tampering (XSS) | judge rationale / session summary rendered in UI | mitigate | Zero `dangerouslySetInnerHTML` occurrences in `src/pages/Quality.tsx`, `src/pages/QualityDetail.tsx`, `src/components/QualityTrendChart.tsx` — all rationale/session text rendered as React text nodes. | closed |
| T-93-14 | Information Disclosure | eval apiKey stored/handled in prod | mitigate | `convex/briefings.ts:244` — `setLLMConfig` slot validator accepts `"eval"`, storing into the redacted `agentConfigs` slot; public `getLLMConfig` (`:205-221`) omits `apiKey`. No API-key-shaped string (`sk-ant`/`sk-proj`/PEM) in any phase-93 planning doc (grep-verified). | closed |
| T-93-15 | Repudiation / operational trust | Quality trends trusted before calibration | mitigate | `93-CALIBRATION.md` records the E3 ≥0.7 gate (lines 8-18) with explicit verdict: trends NOT trusted until the labeling table is filled and agreement/rank-correlation clears 0.7. Un-fudgeable NOT-TRUSTED state satisfies the mitigation's intent. | closed |
| T-93-SC (plans 01-05) | Tampering (supply chain) | npm/python installs | accept | `git log` on dependency manifests across the phase-93 commit window (2026-07-05 → 2026-07-06) shows zero dependency commits from phase-93 work — confirms "no new packages" as declared. | closed |
| T-93-SC (plan 06) | Tampering | prod deploy / config | mitigate | `93-06-PLAN.md` Task 1 (`checkpoint:human-action`, blocking) and Task 2 (`checkpoint:human-verify`, blocking) require explicit operator resume-signals — no auto-advance past prod deploy/secret steps. | closed |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-93-01 | T-93-04 | Prompt injection via judge digest: single-operator system, no external/untrusted multi-tenant input reaching the judge (RESEARCH Security Domain). Digest built from the operator's own Ástríðr session data. ~250-char truncation (`DIGEST_TRUNCATE_CHARS`, `convex/evalScores.ts:192`) is the only control warranted at this trust level. | Phase 93 plan (93-02-PLAN.md), ratified at audit | 2026-07-06 |
| AR-93-02 | T-93-SC (01-05) | Supply-chain risk from new installs: no new packages introduced by plans 01-05 (`zod` already present; verified via `git log` on dependency manifests during the phase-93 window). | Phase 93 plans 01-05, ratified at audit | 2026-07-06 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags (from 93-06-SUMMARY.md `## Threat Flags`)

Surfaced during Plan 06's live-E2E work in **astridr-repo** (`channels/web.py`) — a user-directed scope addition, not in any Phase 93 plan's authored threat model. Informational, not blocking this phase's disposition.

| Flag | File | Closure Evidence (spot-checked) |
|------|------|--------------------------------|
| `auth-bypass-closed` | `astridr-repo/astridr/channels/web.py` | Profile-scoped `/{p}/api/*` previously bypassed `auth_check`. `web.py:907-914` — middleware now accepts bearer OR valid session cookie for all `/api/*` routes; no bypass branch found. |
| `new-auth-endpoint` | `astridr-repo/astridr/channels/web.py` | `web.py:956-993` — `POST /auth/login` exchanges the operator key for a random (`secrets.token_urlsafe`) session token, stored server-side as sha256 digest (`:531-544`), delivered via `HttpOnly`/`SameSite=Strict` cookie; shares the chat rate bucket (`:856-860`). |

**Recommendation:** a future phase touching `astridr-repo/channels/web.py` should formally register these two items in its threat model rather than leaving them as orphaned SUMMARY flags.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-06 | 17 | 17 | 0 | gsd-security-auditor (sonnet) |

*17 = 15 distinct T-93-NN threats + 2 consolidated T-93-SC line items.*

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-06
