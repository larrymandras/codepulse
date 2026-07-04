---
phase: 89
slug: readable-themes-editorial-skin-toggle
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-26
---

# Phase 89 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time across all 7 plans (`register_authored_at_plan_time: true`).
> This audit **verifies** the plan-time dispositions against the implementation — no retroactive STRIDE needed.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| localStorage (origin-shared) → `document.documentElement` attribute | A same-origin script can write `codepulse-theme`; the `index.html` pre-paint inline script consumes it before React loads | Theme slug string (low sensitivity) |
| `index.html` inline script → DOM | Synchronous blocking script sets `data-theme` before first paint | Validated theme slug |
| CSS custom properties → rendered surface / canvas `fillStyle` | Token values flow into paint and canvas APIs; no executable code | Own-origin CSSOM color strings |
| npm registry → dev/build toolchain | New dev dependency (`@axe-core/playwright`) pulled into the test toolchain | Third-party package code (dev-only) |
| Playwright test runner → local dev server | e2e tests drive the real app; assert contrast/attribute/visibility only | No untrusted input crosses to prod |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-89-SC | Tampering | `@axe-core/playwright` npm install | mitigate | Operator pre-approved package legitimacy (Deque/dequelabs org) at Task 1 checkpoint before install — recorded in 89-01-SUMMARY §121-122 | closed |
| T-89-01 | Tampering | `useThemeColors` reading getComputedStyle | accept | Reads only own-origin CSSOM custom properties; no external/attacker input | closed |
| T-89-02 | Information Disclosure | e2e specs | accept | Run against local dev; assert contrast/attribute state only, log no secrets | closed |
| T-89-03 | Tampering | inline SVG data URI in `body::before` | accept | Static author-controlled feTurbulence filter; no external fetch, no script, no user input | closed |
| T-89-04 | Denial of Service | full-viewport fixed pseudo-elements (aubergine) | mitigate | `pointer-events:none` + `z-index:-1` (index.css:606–621); suppressed under reduced-motion (index.css:638–641) | closed |
| T-89-05 | Tampering | className token swaps | accept | Purely presentational; no input handling, auth, or data flow | closed |
| T-89-06 | Denial of Service | Tailwind JIT on `var(--glow-*)` | mitigate | Readable glow tokens set to `0 0 0 transparent` (index.css:266–269); resolves to valid `box-shadow` | closed |
| T-89-07 | Tampering | className token swaps | accept | Purely presentational; no input handling or data flow | closed |
| T-89-08 | Denial of Service | Tailwind JIT on `var(--glow-*)` | mitigate | Same as T-89-06 — `0 0 0 transparent` tokens; build gate confirmed valid resolution | closed |
| T-89-09 | Tampering | localStorage `codepulse-theme` read by inline script | mitigate | 4-slug allowlist validated (`!t||!v.includes(t)` → fallback `'cyan'`) before `setAttribute` (index.html:9) | closed |
| T-89-10 | Injection (XSS) | inline pre-paint script | mitigate | Value passed only to `setAttribute('data-theme', t)` with a validated slug — no `innerHTML`/`eval`/string interpolation (index.html:9) | closed |
| T-89-11 | Tampering | inline script under future CSP | accept | No CSP today; HTML comment flags nonce/`unsafe-inline` requirement if CSP added later — out of scope | closed |
| T-89-12 | Tampering | getComputedStyle values into canvas `fillStyle` | accept | Values originate from author-controlled CSS token blocks; trimmed, dev-warns on oklch | closed |
| T-89-13 | Denial of Service | invalid color string to canvas | mitigate | `hexToRgba` returns input unchanged on non-hex match (src/lib/hexToRgba.ts) — defensive pass-through | closed |
| T-89-14 | Information Disclosure | e2e axe output | accept | Asserts violation arrays + attribute/visibility state; no secrets logged; local dev only | closed |
| T-89-15 | Repudiation | manual sign-off | mitigate | Operator approval recorded 2026-06-24 in 89-07-SUMMARY (human-verify checkpoint) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-89-01 | T-89-11 | No CSP exists in CodePulse today; the pre-paint inline `<script>` would require a nonce or `'unsafe-inline'` if a `script-src 'self'` CSP is later introduced. Tracked via HTML comment at index.html. Out of phase scope. | Larry Mandras | 2026-06-26 |

*Accepted-by-disposition presentational/own-origin threats (T-89-01/02/03/05/07/12/14) are inherent to a CSS-only theming phase with no untrusted input and require no separate risk entry.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-26 | 15 | 15 | 0 | Claude (gsd-secure-phase, direct verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-26
