---
phase: 58
slug: infrastructure-layer
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-13
---

# Phase 58 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| WebSocket -> React state | Command catalog payload from Astridhr crosses into client state | CommandEntry[] — internal operational data (command names, params, sources) |
| WebSocket catalog -> Capabilities page | Live data from Astridhr rendered on page | Array lengths, command metadata |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-58-01 | Tampering | useCommandCatalog hook | mitigate | `Array.isArray(data.tools)` validation at line 52, plus `Array.isArray` checks on `data.pipes` and `data.commands`. Malformed payloads ignored. | closed |
| T-58-02 | Denial of Service | CommandCatalogPanel | accept | Internal tool with ~50-100 commands max. No mitigation needed. | closed |
| T-58-03 | Information Disclosure | CommandEntry.source | accept | Source manifest paths are internal operational data shown only to operator on private dashboard. No PII, no external users. | closed |
| T-58-04 | Spoofing | Capabilities page | accept | WebSocket authenticates via API key in AstridrWSContext. No additional auth needed at page level. | closed |
| T-58-05 | Tampering | MetricCard count | accept | Count derived from array length of validated CommandEntry[]. Malformed data handled by T-58-01 mitigation in useCommandCatalog hook. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-58-01 | T-58-02 | Internal tool, ~50-100 commands max, single operator | Larry | 2026-04-13 |
| AR-58-02 | T-58-03 | Private dashboard, no PII in source paths | Larry | 2026-04-13 |
| AR-58-03 | T-58-04 | WebSocket already authenticated at connection level | Larry | 2026-04-13 |
| AR-58-04 | T-58-05 | Upstream validation in useCommandCatalog hook handles malformed data | Larry | 2026-04-13 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-13 | 5 | 5 | 0 | Claude (gsd-secure-phase) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-13
