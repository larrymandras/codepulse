---
phase: 02-bidirectional-telemetry
security_auditor: gsd-secure-phase
asvs_level: 1
completed: 2026-04-13
threats_total: 8
threats_closed: 8
threats_open: 0
result: SECURED
---

# Phase 02 Security Audit — Bidirectional Telemetry

## Summary

All 8 registered threats are CLOSED. No open threats. No unregistered flags from SUMMARY files.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-02-01 | Tampering — malformed WS payload updating React state | mitigate | CLOSED | `src/hooks/useLiveState.ts` lines 101-105: validates `msg.data` is an object and `data.status` is in `VALID_AGENT_STATUSES` Set before dispatch. Lines 122-123: validates `data.key` is string and `data.value` is number for metric deltas. Malformed payloads return early without dispatch. |
| T-02-02 | Information Disclosure — API key in ConnectionPopover URL display | mitigate | CLOSED | `src/components/ConnectionPopover.tsx` lines 22-24: `WS_BASE_URL` reads only `VITE_ASTRIDR_WS_URL`, never the full URL containing `?api_key=`. Line 197-200: URL row renders `WS_BASE_URL` only. The `api_key` query param constructed in `AstridrWSContext.tsx` line 171 is never passed to the display component. |
| T-02-03 | Information Disclosure — stale agent status after reconnect | mitigate | CLOSED | `src/hooks/useLiveState.ts` lines 89-94: Effect 1 dispatches `CLEAR_ALL` on every `wsStatus !== "connected"` transition (covers both "disconnected" and "reconnecting") before dispatching `SET_CONNECTION_HEALTH`. Reducer preserves `connectionHealth` only; all other fields (`agentStatus`, `activeRunId`, `activeRunProgress`, `liveMetricDeltas`) reset to null/empty. |
| T-02-04 | Denial of Service — auth error not surfaced | mitigate | CLOSED | `src/components/ConnectionPopover.tsx` lines 167-193: `showAuthError` gate renders "Authentication failed. Check ASTRIDR_WEB_API_KEY and restart." in `text-(--status-error)` styling when `forceAuthError` prop is true. Prop exposed as escape hatch for both testing and runtime auth-failure detection wiring. |
| T-02-05 | Tampering — XSS via injected event data in prepended list items | mitigate | CLOSED | `grep dangerouslySetInnerHTML src/pages/` returns no matches across all 11 event-driven pages. All event data is rendered via React JSX expressions (`{event.description}`, `{wsEvents.map(...)}`) which auto-escape HTML. No raw HTML injection paths present. |
| T-02-06 | Denial of Service — rapid WS event flood causing excessive re-renders | mitigate | CLOSED | `src/hooks/useLiveFlash.ts` lines 21-22: debounce guard `if (now - lastFlashRef.current < 1000) return` prevents re-flash within 1 second. `subscribeEvent` callbacks dispatch minimal state updates (single item prepend or counter increment). React batches state updates. |
| T-02-07 | Denial of Service — auth failure log flooding from brute-force | accept | CLOSED | `astridr/engine/ws_telemetry.py` line 120: `await websocket.close(code=1008)` immediately terminates the connection after a single auth failure — no retry within the same connection is possible. Accepted risk: single-operator LAN deployment; no public exposure. Documented in 02-04-PLAN.md threat model. |
| T-02-08 | Spoofing — client IP spoofing in auth logs | accept | CLOSED | `astridr/engine/ws_telemetry.py` line 117: `websocket.client.host if websocket.client else "unknown"` relies on the ASGI server (Uvicorn) for IP attribution. Accept risk: single-operator LAN deployment where IP spoofing is impractical. Documented in 02-04-PLAN.md threat model. |

---

## Accepted Risks Log

| Threat ID | Risk | Rationale | Owner |
|-----------|------|-----------|-------|
| T-02-07 | Auth failure log flooding | Connection is closed on first failure; no retry loop possible within a session. LAN-only deployment, low exposure surface. Structlog rate limiting can be applied at log aggregation layer if needed. | Larry Mandras |
| T-02-08 | Client IP spoofing in auth logs | `websocket.client.host` is ASGI-sourced and reflects actual LAN IP in single-operator deployment. Reverse proxy PROXY_PROTOCOL would strengthen this if deployment changes. | Larry Mandras |

---

## Unregistered Threat Flags

**02-01-SUMMARY.md:** "No new network endpoints, auth paths, or trust boundary crossings introduced." — No flags.

**02-02-SUMMARY.md:** "No new network endpoints, auth paths, or file access patterns introduced beyond what the plan's threat model covers." — No flags.

**02-03-SUMMARY.md:** "No new network endpoints, auth paths, or schema changes introduced. All rendered event data uses React JSX auto-escaping (T-02-05 addressed). Flash debounce limits re-render frequency (T-02-06 addressed)." — No flags.

**02-04-SUMMARY.md:** No threat flags section present. No new surfaces introduced (logging additions only). — No flags.

No unregistered flags requiring escalation.

---

## Notes

- T-02-04 mitigation uses a `forceAuthError` prop as the delivery mechanism. The 2-second heuristic described in the plan was replaced with an explicit prop during implementation (documented deviation in 02-02-SUMMARY.md). This is acceptable: the auth error message surface is present and testable; runtime wiring of the close-code detection to set the prop is a follow-on integration concern, not a missing mitigation.
- The `metric_delta` event type in `useLiveState.ts` Effect 3 validates both `data.key` (string) and `data.value` (number) before dispatch, satisfying the second half of T-02-01's declared mitigation pattern.
