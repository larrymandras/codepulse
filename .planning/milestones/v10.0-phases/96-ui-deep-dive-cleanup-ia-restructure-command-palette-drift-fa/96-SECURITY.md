---
phase: 96
slug: ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-13
---

# Phase 96 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all 13 PLAN.md files carry `<threat_model>` blocks); mitigations verified against live code 2026-07-13 by gsd-security-auditor.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| CodePulse UI ↔ Ástríðr WS commands | Dashboard sends `approval.respond` / `ping` over authed WS | HITL approval decisions (request_id_target, decision) |
| CodePulse UI ↔ Convex | Typed `api.*` queries/mutations | Tasks, roster, telemetry, facts |
| UI ↔ operator trust | Rendered readouts/badges must reflect real data | Trust signals (SYS/LAT, audit badges, cron states) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (verified evidence) | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-96-02-01 | Repudiation (false telemetry) | Header SYS/LAT readouts | mitigate | `DashboardLayout.tsx:401-402,446,580-593` — null-per-field guards; fields hidden when data absent | closed |
| T-96-03-01 | Repudiation (false confirmation) | Chat approval sender | mitigate | `ApprovalActions.tsx:65-80` — success only on `ack.status === "ok"`; error toast + `false` otherwise | closed |
| T-96-03-02 | Elevation of Privilege | HITL approval gate | mitigate | `ApprovalActions.tsx:31-36` matches `astridr/api/ws_commands.py:95-100 ApprovalRespondCommand` field-for-field; server validation untouched | closed |
| T-96-03-03 | Tampering | Shared approval type | mitigate | `ApprovalRespondPayload` TS interface + `satisfies` at `ApprovalActions.tsx:64,88` — shape drift fails at compile | closed |
| T-96-04-01 | Tampering | anyApi.tasks.* | mitigate | `Tasks.tsx:108-110` typed `api.tasks.*`; no `anyApi` in file | closed |
| T-96-05-01 | Tampering | Dual nav lists | mitigate | `src/lib/navRegistry.ts` single source; imported by DashboardLayout + CommandPalette | closed |
| T-96-06-01 | Repudiation (false trust signal) | Security badge / Automation counts | mitigate | No "Valid" badge in `Security.tsx`; `Automation.tsx:95` computed `CRON_SCHEDULES.length`; `CronJobList.tsx:95` guards `job.enabled !== undefined` | closed |
| T-96-07-01 | Tampering | Duplicated facts markup | mitigate | Shared `FactsTable.tsx`; consumed by `Memory.tsx:33,699` + `Dreaming.tsx:19,157` | closed |
| T-96-08-01 | Repudiation (stale UI) | Hardcoded agent names | mitigate | `MeetingBot.tsx:37,86` — `useRosterAgents()` drives the Select | closed |
| T-96-09-01 | DoS (usability) | Fixed-width panes | mitigate | `ForgePage.tsx:175-176` + `WarRoom.tsx:296-297` responsive collapse | closed |
| T-96-10-01 | Repudiation (misleading UI) | Zeroed TokenSavingsIndicator | mitigate | Removed — 0 matches in `Analytics.tsx` | closed |
| T-96-10-02 | Information Disclosure | Hardcoded author "larry" | mitigate | `DocComments.tsx:50` `author: profileId`; no literal remains | closed |
| T-96-10-03 | Tampering | BuildProgress `as any` casts | mitigate | 0 matches for `as any` / `: any` in `BuildProgress.tsx` | closed |
| T-96-11-01 | Tampering | Divergent header styling (batch A) | mitigate | `<PageHeader>` verified in hr/Roster, Dashboard, Alerts, SelfHealing (sampled) | closed |
| T-96-12-01 | Tampering | Divergent header styling (batch B) | mitigate | `<PageHeader>` verified in Executions, Ideation, ConfigPage, SessionDetail (sampled) | closed |
| T-96-13-01 | Repudiation (false confirmation) | InboxCard approve/reject | mitigate | `InboxCard.tsx:157-174` — gates on awaited ack boolean, stays pending on throw | closed |
| T-96-13-02 | Tampering (malformed event) | Chat run.blocks handler | mitigate | `Chat.tsx:201-207` — `event.data ?? event` + empty-array guard | closed |
| T-96-01-01 | Tampering | PageHeader React children | accept | No `dangerouslySetInnerHTML`; React escapes text children | closed |
| T-96-02-02 | Information Disclosure | ping command | accept | `DashboardLayout.tsx:424` — `{type:"ping"}` only; matches ConnectionPopover precedent | closed |
| T-96-04-02 | Denial of Service | listTasksByAgent `.collect()` | accept | `convex/missionControl.ts:4-9` pre-existing, reused unchanged | closed |
| T-96-06-02 | Information Disclosure | Network Access Log (kept) | accept | Live Convex-backed panel, untouched by phase edits | closed |
| T-96-08-02 | Spoofing | Roster values | accept | `useRosterAgents.ts:39,49-52` — same trusted Convex queries WarRoom already uses | closed |
| T-96-01..13-SC (13) | Tampering (supply chain) | package installs | accept | `git diff` across all phase-96 commits: zero package.json/lock changes | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-96-01 | T-96-01-01 | React escapes text children by default; no HTML injection surface introduced | plan-time register (Larry-approved plans) | 2026-07-13 |
| AR-96-02 | T-96-02-02 | `ping` carries no payload/PII; RTT is local timing | plan-time register | 2026-07-13 |
| AR-96-03 | T-96-04-02 | Pre-existing bounded task volume; no new unbounded scan | plan-time register | 2026-07-13 |
| AR-96-04 | T-96-06-02 | Pre-existing live panel out of change scope | plan-time register | 2026-07-13 |
| AR-96-05 | T-96-08-02 | Roster from same trusted Convex source as WarRoom | plan-time register | 2026-07-13 |
| AR-96-06 | T-96-{01..13}-SC | No packages installed anywhere in phase 96 (verified via git) | plan-time register | 2026-07-13 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-13 | 35 | 35 | 0 | gsd-security-auditor (sonnet), orchestrated via /gsd-secure-phase 96 |

**Informational note (not a gap):** `src/pages/Ideation.tsx:35` still calls `anyApi.tasks.create` (untyped) — pre-existing pattern outside T-96-04-01's declared scope (`Tasks.tsx`/`missionControl` only), not touched or regressed by Phase 96. Candidate for a future typed-api sweep.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-13
