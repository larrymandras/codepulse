---
phase: 94
slug: trace-waterfall
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-06
---

# Phase 94 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (all five PLAN.md files carry `<threat_model>` blocks); this audit verifies each mitigation exists in the implementation.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Live astridr emitter → prod `/runtime-ingest` | Only new runtime data path exercised end-to-end this phase | `llm_call` payloads incl. `traceId` (opaque uuid4 grouping key, non-secret); Bearer-authenticated |
| URL query params → SessionDetail render | First `useSearchParams` deep-link (`?tab=`) | Untrusted user-controllable string |
| Convex rows → TraceWaterfall/Analytics DOM | Telemetry values (model, traceId, cost, timestamps) rendered in UI | Untrusted stored strings |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-94-01 | Spoofing/Tampering | `/runtime-ingest` forged `traceId` | mitigate | Route Bearer-gated by `validateIngestAuth` (`convex/runtimeIngest.ts:22`); `traceId` rides the authenticated `llm_call` payload (`:73`); no unauthenticated path added | closed |
| T-94-02 | Tampering | Non-string `traceId` reaching DB | mitigate | `v.optional(v.string())` at schema boundary (`convex/schema.ts:312`) and `recordCall` arg validator; opaque key, never interpolated into a query | closed |
| T-94-03 | Information Disclosure | traceId in logs/telemetry | accept | Opaque uuid4 grouping key, not a secret — same classification as existing `goalId` | closed |
| T-94-04 | Tampering | goalId/traceId aliasing collapsing groupings | mitigate | Distinct `_current_trace_id` ContextVar (astridr `telemetry.py`); coexistence asserted by `tests/unit/test_trace_context.py` (6/6 green); `router.py` untouched | closed |
| T-94-05 | Tampering | XSS via model/traceId/toolName in bar label/tooltip | mitigate | JSX text nodes only; zero `dangerouslySetInnerHTML` in `TraceWaterfall.tsx` (acceptance-checked by plan greps + code review) | closed |
| T-94-06 | Information Disclosure | Fabricated cost/cache signal for legacy rows | mitigate | `costLabel` → "n/a" on undefined cost; `cacheBadge` absent on undefined cache tokens; unit-tested (D-13/D-14); no estimation path | closed |
| T-94-07 | Tampering | Malicious/invalid `?tab=` driving unexpected state | mitigate | `isTab()` validates against fixed `Tab` union with `TAB_KEYS` set, silent fallback to "overview" (`src/pages/SessionDetail.tsx:29-41`) | closed |
| T-94-08 | Tampering | Injection via sessionId in View-Trace href | mitigate | `traceHref` null-guards and `encodeURIComponent`s sessionId; same-origin route, not raw HTML (`src/pages/Analytics.tsx`) | closed |
| T-94-09 | Tampering | Untested schema/emitter combo deployed to prod | mitigate | Deploy gated behind Plans 01-04 green (vitest+tsc+build) and operator-gated 94-05 checkpoints; live verification signed off 2026-07-06 (94-05-SUMMARY.md) | closed |
| T-94-10 | Tampering | XSS via untrusted values in Recent LLM Calls rows | mitigate | Plain JSX children (React auto-escapes); no `dangerouslySetInnerHTML`; href limited to encoded route path (`src/pages/Analytics.tsx:229-272`) | closed |
| T-94-SC | Tampering | Package installs (all plans + deploy) | accept | Zero new packages across all five plans; deploy used already-pinned dependencies | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-94-01 | T-94-03 | `traceId` is an opaque uuid4 grouping key — no PII, no credential; same exposure class as the long-standing `goalId` | Plan-time disposition (94-02-PLAN), confirmed at audit | 2026-07-06 |
| AR-94-02 | T-94-SC | No supply-chain surface: zero new npm/pip packages in any plan; deploy commands use pinned deps | Plan-time disposition (all plans), confirmed at audit | 2026-07-06 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-06 | 11 | 11 | 0 | Claude (secure-phase orchestrator; evidence from gsd-verifier 22/22 report, gsd-code-reviewer standard-depth review of all 15 changed files — no security findings — and direct file:line spot-checks) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-06
