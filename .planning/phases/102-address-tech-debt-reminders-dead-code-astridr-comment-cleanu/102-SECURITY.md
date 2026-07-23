---
phase: 102
slug: address-tech-debt-reminders-dead-code-astridr-comment-cleanu
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-23
---

# Phase 102 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| planner/executor → live schema | 102-01 schema edits regenerated types offline only; live deploy isolated to operator-gated 102-03 | Convex schema definitions |
| calendar cron → Convex ingest | Post-deletion, the LIVE cron pushes calendar events via shared `ConvexHandler` (bearer `ASTRIDR_INGEST_API_KEY`) instead of bespoke `CodePulsePoster` | Calendar event payloads + bearer token |
| grep sweep → source tree | Repo-wide comment sweep could over-delete live code if scoped too broadly | Source code |
| operator/deploy → live self-hosted backend | 102-03 schema deploy touched the production single-node SQLite backend serving the live dashboard | Schema/index DDL |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-102-01 | Tampering | over-deletion in `convex/reminders.ts` | mitigate | `convex/reminders.ts:385` — `export const listByProfile` intact; commit `a9f62dd` pure deletion (86 removed / 4 added); tests green | closed |
| T-102-02 | Tampering | `by_status` vs `by_dueAt` index in `convex/schema.ts` | mitigate | `convex/schema.ts:1873` — `.index("by_status", ["status","dueAt"])` present; no `by_dueAt` remains | closed |
| T-102-10 | Tampering | live snooze mutation vs. stale comment in `convex/remindersIngest.ts` | mitigate | `convex/remindersIngest.ts:93` — `ctx.runMutation(api.reminders.snooze, ...)` unchanged; only comment text rewritten | closed |
| T-102-04 | Tampering | over-deletion of live Convex constants in astridr tools | mitigate | `astridr/automation/calendar_cache.py` — 0 live matches for `CodePulsePoster`/`_CP_URL`/`_INGEST_KEY` (one comment mention of the env var name only); `astridr/tools/reminders.py:47-49` — live `_CP_URL`/`_CONVEX_URL` constants defined and used | closed |
| T-102-05 | Info disclosure / Spoofing | calendar cron auth after switch to shared `ConvexHandler` | mitigate | `astridr/engine/bootstrap/cron_dispatcher.py:790-792` passes `telemetry=self._telemetry`; live tick (102-03-SUMMARY.md): `pushed=['personal','business','consulting'] failed=[]`; `/reminders` rendered; no secrets printed | closed |
| T-102-06 | Tampering | grep sweep touching unrelated 404/CORS handling | mitigate | `astridr/channels/web.py:839` — `CODEPULSE_ORIGIN` tidy-whale-981 default unchanged (grep-confirmed) | closed |
| T-102-07 | Denial of Service | live schema deploy — wrong deploy verb would mass-delete/wedge backend | mitigate | 102-03-SUMMARY.md deploy output: `Deleted table indexes: [-] reminders.by_dueAt`, "No large indexes are deleted by this push"; no `--replace-all`/import used | closed |
| T-102-08 | Info disclosure | secrets leaking into logs/checkpoint output during live verification | mitigate | Grep of all phase-102 planning artifacts for key/bearer/JWT patterns — only variable names and narrative found, no secret values | closed |
| T-102-09 | Spoofing / Repudiation | switched cron silently pushing to wrong host / missing bearer | mitigate | Same live-tick evidence as T-102-05; corroborated in 102-VERIFICATION.md via running-container greps (`astridr-agent`, `astridr-war-room-freya`) showing 0 `CodePulsePoster` | closed |
| T-102-03 | Denial of Service | accidental live deploy from codepulse during 102-01 | accept | 102-01-SUMMARY.md — no `npx convex deploy` run; commit `6943f7d` touched only `schema.ts`; deploy deferred to operator-gated 102-03 | closed |
| T-102-SC | Tampering | supply chain (npm/pip installs) | n/a | No package manifest/lockfile touched in either repo's phase-102 commits (verified via commit diffs) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Unregistered Flags (informational, not phase-102 regressions)

- **WR-02** — `ConvexHandler.send_to` (`astridr/engine/telemetry.py`) swallowed push-side failures (unset URL/client, HTTP ≥400, and exceptions were logged-and-returned internally), so the calendar cron's `failed` list could never reflect a push-side auth/HTTP error — only fetch-side errors were observable. Pre-existing behavior, flagged out-of-scope in 102-VERIFICATION.md / 102-REVIEW.md. **RESOLVED 2026-07-23** — astridr-repo commit `988d5770` (branch `feature/brain-swap`): `send_to` now returns `bool` (False on skip / HTTP ≥400 / transport error) and `calendar_cache.refresh` marks a profile `failed` on a literal `False`. TDD-covered: 5 new tests (4 in `tests/unit/foundation/test_telemetry.py`, 1 in `tests/automation/test_calendar_cache.py`); full suite 7834 passed. Not yet deployed to the running containers — deploy rides with the `feature/brain-swap` branch.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-102-01 | T-102-03 | Live index-drop deploy intentionally isolated to operator-gated plan 102-03 rather than mitigated within 102-01; confirmed no deploy command ran in 102-01's commits | Larry (plan-time disposition) | 2026-07-23 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-23 | 11 | 11 | 0 | gsd-security-auditor (spot-checked by orchestrator) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-23
