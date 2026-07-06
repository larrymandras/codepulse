---
phase: 94-trace-waterfall
plan: 05
subsystem: verification
tags: [deploy, convex, docker, e2e, live-verification, d-05]

# Dependency graph
requires:
  - phase: 94-trace-waterfall (plan 01)
    provides: "llmMetrics.traceId schema + recordCall arg + /runtime-ingest alias + sessionCalls query"
  - phase: 94-trace-waterfall (plan 02)
    provides: "Ástríðr per-turn traceId contextvar set in _process_inner, attached at all three provider llm_call emit sites"
  - phase: 94-trace-waterfall (plan 03)
    provides: "TraceWaterfall component grouping sessionCalls rows by traceId"
  - phase: 94-trace-waterfall (plan 04)
    provides: "SessionDetail Trace tab (?tab=trace deep-link) + Analytics Recent LLM Calls table with View Trace cross-link"
provides:
  - "Operator sign-off that a real Ástríðr-emitted traceId flows end-to-end to prod Convex and renders grouped in the waterfall (D-05 live gate met)"
  - "Prod Convex (tidy-whale-981) running the traceId schema/ingest/query; astridr-agent container rebuilt with the emitter"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live verification via local Vite dev server pointed at prod Convex (VITE_CONVEX_URL override) with Clerk disabled via empty VITE_CLERK_PUBLISHABLE_KEY (empty string is falsy in main.tsx's CLERK_KEY gate); Playwright headless suite with console-error capture"

key-files:
  created: []
  modified: []

key-decisions:
  - "Operator (Larry) approved agent-run deploys through permission prompts rather than typing commands manually — still operator-gated per the plan's intent"
  - "Legacy fallback verified against session 0ca9f7bd-d772-458d-b895-9a079154d130 (36 pre-deploy untraced rows) rather than waiting for a synthetic legacy fixture"

requirements-completed: [TRACE-01, TRACE-02]

# Metrics
duration: ~75min (deploy + live verification, including auth-gate and onboarding-modal automation detours)
completed: 2026-07-06

---

# Plan 05 Summary — Operator-Gated Deploy + Live E2E Verification (D-05)

## Task 1 — Deploy (checkpoint:human-action)

- **Prod Convex:** `npx convex deploy --yes` → `https://tidy-whale-981.convex.cloud`. Schema validation passed, "No indexes are deleted by this push", functions deployed cleanly.
- **Ástríðr:** `docker compose up --build -d astridr` from `C:\Users\mandr\astridr-repo` — image rebuilt (not restarted), `astridr-agent` reached `healthy`, `/health` returned 200.
- Operator chose agent-run deploys with per-command approval (recorded above).

## Task 2 — Live E2E verification (checkpoint:human-verify)

Verified against prod data via local frontend (prod `VITE_CONVEX_URL`, Clerk off) + Playwright:

1. **Grouped trace render:** Real chat turns triggered via the authenticated web channel (`/api/chat`).
   - Turn 1: session `c4f7d64b-aff1-4fb8-9f07-afa0c1ee439d`, traceId `bc069e1c-7c07-4cab-bcf9-659c5a385fbf`, model claude-sonnet-4-6, real cost — rendered grouped in the Trace tab with model label and summary strip.
   - Turn 2 (deep-link target): session `10e8e0e8-62e5-43b0-9c62-75a7a9a48667` — rendered as one collapsible "TURN 1" group (1 call, 3s, $0.0033, 2,359 tokens) with MetricCard strip.
2. **Legacy fallback (Pitfall 4):** Pre-deploy session `0ca9f7bd-d772-458d-b895-9a079154d130` rendered flat "UNTRACED CALLS · 36" group with summary strip ($0.1024, 36 calls, 213,174 tokens, 39% cache) — no crash.
3. **Cross-link (D-08):** Analytics "Recent LLM Calls" row's "View Trace" link navigated to `/sessions/{id}?tab=trace` and the target waterfall rendered.
4. **Console:** Zero console errors / page errors across all pages in every Playwright pass.

**Operator sign-off: VERIFIED (Larry, 2026-07-06).**

## Gaps / follow-ups found (not phase blockers)

- **War-room agents emit untraced calls:** `astridr-war-room-*` containers (up 7 days) run the pre-Phase-94 image without the emitter — their `llm_call` rows have no `traceId` and no `sessionId`, so they dominate Analytics "Recent LLM Calls" with "—" trace cells. Rebuild the war-room profile containers to trace them.
- **Deployed CodePulse UI not exercised:** verification used a local dev server against prod Convex (Clerk auth gate blocks headless automation of the deployed UI). Feature code is identical; the deployed frontend still needs its normal redeploy cycle to pick up Phase 94 UI code.
- **Verification scripts:** `verify_trace.py` / `verify_viewtrace.py` live in the session scratchpad (throwaway, not committed).

## Self-Check: PASSED

- Both sides deployed, operator-gated ✓
- Live grouped-trace render confirmed against prod ✓
- Legacy fallback confirmed with zero console errors ✓
- Operator sign-off recorded ✓
