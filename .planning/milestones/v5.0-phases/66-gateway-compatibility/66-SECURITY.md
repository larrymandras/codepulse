---
phase: 66
slug: gateway-compatibility
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-23
---

# Phase 66 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| OTel Ingest (/v1/logs) | Ástríðr → Convex OTel endpoint | OTel log records with provider attribute |
| Runtime Ingest (/runtime-ingest) | CLIGatewayTool → Convex HTTP endpoint | gateway.* telemetry events with provider, session_id, duration |
| Frontend ↔ Convex | React dashboard ← Convex queries | Provider health data (availability, auth status, billing type, quota) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-66-01 | Spoofing | otelLogs.ts / runtimeIngest.ts — provider field | mitigate | `validateIngestAuth()` Bearer token on both endpoints; only authenticated Ástríðr process can submit | closed |
| T-66-02 | Tampering | runtimeIngest.ts — gateway event routing | mitigate | Strict `case` matching (4 explicit cases); unrecognized events fall to `events.ingest`; no wildcard | closed |
| T-66-03 | Info Disclosure | convex/lib/providers.ts — provider names | accept | Provider names are public CLI tool names, not secrets | closed |
| T-66-04 | Denial of Service | otelLogs.ts — console.warn on missing provider | accept | Warn only fires when provider genuinely missing; rate limited by event frequency; no amplification | closed |
| T-66-05 | Info Disclosure | ProviderHealthPanel — auth status display | accept | Operational data for single operator; no multi-tenant exposure | closed |
| T-66-06 | Spoofing | Provider display names | accept | Static frontend constants, not user-controllable; no injection vector | closed |
| T-66-07 | Spoofing | cli_gateway.py — provider field in telemetry | mitigate | Provider from gateway TaskResponse (trusted internal); `validateIngestAuth()` prevents external injection | closed |
| T-66-08 | Denial of Service | cli_gateway.py — telemetry emission failure | mitigate | `try/except Exception: pass` at lines 187, 210; telemetry failure never blocks task completion | closed |
| T-66-09 | Info Disclosure | cli_gateway.py — session_id in telemetry | accept | Internal identifier, not a secret; internal network only | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-66-01 | T-66-03 | Provider names correspond to publicly known CLI tools | gsd-security-audit | 2026-05-23 |
| AR-66-02 | T-66-04 | console.warn rate-limited by event frequency; no amplification vector | gsd-security-audit | 2026-05-23 |
| AR-66-03 | T-66-05 | Single-operator dashboard; auth status is operational, not sensitive | gsd-security-audit | 2026-05-23 |
| AR-66-04 | T-66-06 | Static constants; no user-controllable injection path | gsd-security-audit | 2026-05-23 |
| AR-66-05 | T-66-09 | Session ID is internal identifier on internal network | gsd-security-audit | 2026-05-23 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-23 | 9 | 9 | 0 | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-23
