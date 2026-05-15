---
phase: 04
slug: kpi-panel-redesign
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-15
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| None | Pure client-side SVG/CSS rendering. No authentication, user input, API calls, or new data queries. All data consumed is numeric arrays from existing trusted Convex hook. | No new data boundaries crossed |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | I (Information Disclosure) | BackgroundSparkline SVG | accept | SVG is aria-hidden, renders only numeric sparkline data already visible as text on the dashboard. No PII, no secrets. | closed |
| T-04-02 | D (Denial of Service) | catmullRomPath() | accept | Input is always 12-element numeric array from useHeroStats. No user-controlled input. Division-by-zero guarded with `\|\| 1`. | closed |
| T-04-03 | T (Tampering) | HeroStatsBar inline styles | accept | Inline styles use CSS custom properties from index.css, not user input. color-mix values computed from theme tokens. No XSS vector. | closed |
| T-04-04 | I (Information Disclosure) | sparklineData arrays | accept | Sparkline data comes from existing Convex queries already exposed on the dashboard as text. No new data exposure. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-01 | SVG renders only numeric data already visible as dashboard text; aria-hidden prevents screen reader leakage | gsd-secure-phase | 2026-05-15 |
| AR-04-02 | T-04-02 | Fixed-size input array from trusted hook; division-by-zero guarded | gsd-secure-phase | 2026-05-15 |
| AR-04-03 | T-04-03 | CSS custom properties from stylesheet, no user-controlled style injection | gsd-secure-phase | 2026-05-15 |
| AR-04-04 | T-04-04 | Data already exposed via existing Convex queries on dashboard | gsd-secure-phase | 2026-05-15 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-15 | 4 | 4 | 0 | gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-15
