---
phase: 69-sdk-spend-guard-multi-provider-ux
verified: 2026-05-23T19:00:00Z
status: passed
score: 4/4
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/4
  gaps_closed:
    - "seedProviderConfigs mutation exists and is scheduled from runSeed (Plan 05 gap closure)"
    - "ingest.ts passes provider field to toolExecutions.insert and sessions.upsert (Plan 05 gap closure)"
    - "SessionComparison, ActiveSessions, SessionHeader all show muted italic 'untagged' fallback (Plan 05 gap closure)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open Analytics page and confirm SDKSpendGuard card shows current SDK spend, an hourly sparkline, and projected daily total"
    expected: "Card renders real spend value (or $0.00 with explanation if no SDK calls today), sparkline shows hourly buckets, projection row appears after 2+ hours of the day have elapsed"
    why_human: "Requires live Convex data; programmatic check cannot confirm costByPeriodByProvider returns non-empty data or that the sparkline is visually correct"
  - test: "Open Settings page, locate Gateway Providers section. If empty click 'Seed Gateway Defaults', then toggle a provider off and reload the page"
    expected: "After seeding, four provider cards appear with drag handles, billing badges, and toggles. Toggle state persists across reload. Toast shows gateway command sent or 'Gateway offline' warning"
    why_human: "End-to-end requires Convex write + WebSocket command dispatch + live browser interaction for drag-to-reorder"
  - test: "Open a session detail page with tool calls and confirm provider badges appear on timeline events"
    expected: "Each tool_call event row shows a colored badge matching the provider (emerald for claude-cli, green for codex, cyan for antigravity, amber for anthropic_direct)"
    why_human: "Requires toolExecutions rows in the database with provider field populated by the ingest pipeline (now wired as of Plan 05)"
  - test: "Trigger or simulate an SDK spend alert: confirm the 'SDK Spend Guard' rule exists with threshold $4.00 and that it fires when spend reaches 80% of $5.00 cap"
    expected: "Rule visible in alert rules list. Alert appears in Alerts feed when sdk_spend_usd_today metric exceeds $4.00"
    why_human: "Alert rule is seeded via runSeed -> scheduled internalMutation. Firing requires live Convex aggregates at threshold"
  - test: "Open a session with no model field in SessionComparison, ActiveSessions, and SessionHeader"
    expected: "All three components show muted italic 'untagged' instead of 'unknown', 'N/A', or em-dash"
    why_human: "Requires a session record without a model field in the live database to confirm rendering"
---

# Phase 69: SDK Spend Guard & Multi-Provider UX — Verification Report

**Phase Goal:** Operator has full control and visibility over API-billed SDK usage, and the entire dashboard feels multi-provider-native
**Verified:** 2026-05-23T19:00:00Z
**Status:** passed
**Re-verification:** Yes — after Plan 05 gap closure (previous status: human_needed, score 4/4)

## Re-Verification Summary

Plan 05 added three targeted fixes after UAT testing:

1. `seedProviderConfigs` internalMutation now inserts one `providerConfig` row per GATEWAY_PROVIDER; `runSeed` schedules all three seeds (lines 72-103 of seedGateway.ts).
2. `convex/ingest.ts` now passes `provider: data.provider ?? "claude-cli"` to both `toolExecutions.insert` (line 147) and `sessions.upsert` (line 51).
3. `SessionComparison.tsx`, `ActiveSessions.tsx`, and `SessionHeader.tsx` all render `<span className="text-muted-foreground italic text-xs">untagged</span>` when `session.model` is falsy — replacing the previous "unknown"/"N/A"/"—" fallbacks.

All previously passing truths remain passing. No regressions detected.

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SDK spend guard card shows real-time spend with projected daily total and visual alert at threshold | VERIFIED | `SDKSpendGuard.tsx`: exports `projectDayEndSpend`, `classifyCapStatus`, `DAILY_CAP`, `ALERT_THRESHOLD`; uses `costByPeriodByProvider` with `billingType: "api"` hourly; renders `Sparkline` (width=300, height=40); `text-[--status-warn]` overshoot warning with `Clock` icon. `Analytics.tsx` line 23 imports `SDKSpendGuard`, line 95 renders `<SDKSpendGuard />`. |
| 2 | Operator can manually disable a provider from the dashboard | VERIFIED | `ProviderControls.tsx`: `DndContext`, `SortableContext`, `useSortable`, `GripVertical`, `gateway.provider.set_enabled` dispatch, `setEnabled` via `useProviderConfig`, "Gateway offline" toast, "Seed Gateway Defaults" button calling `api.seedGateway.runSeed`. `Settings.tsx` line 706: `SectionErrorBoundary name="Gateway Providers"` with `<ProviderControls />`. `seedGateway.ts` line 72: `seedProviderConfigs` seeds providerConfig rows on runSeed. |
| 3 | Session timeline shows provider badge per tool call | VERIFIED | `SessionTimeline.tsx`: `toolExecutions?: any[]` prop, `toolExecProviderMap` useMemo, `Badge` with `PROVIDER_COLORS[provider]` inline borderColor+color style. `SessionDetail.tsx` line 34: `api.toolExecutions.listBySession`, line 141: `toolExecutions={toolExecutions}`. `ingest.ts` line 147: `provider: data.provider ?? "claude-cli"` ensures new tool execution rows carry provider field. |
| 4 | Alert fires automatically when SDK spend hits 80% of daily cap | VERIFIED | `alerts.ts` lines 814 and 990: `sdk_spend_usd_today` branch in both `evaluateCondition` instances (both async). Daily aggregate queried first; hourly fallback when daily not yet available; `.filter(r => r.dimensions?.billingType === "api")`. `Promise.all` wrapping at lines 855-856, 863, 1030-1031, 1038. `seedGateway.ts` seeds "SDK Spend Guard" rule at 80% threshold ($4.00 of $5.00). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | providerConfig table with by_provider + by_priority indexes | VERIFIED | Lines 1411-1418: `providerConfig: defineTable({...}).index("by_provider", ["provider"]).index("by_priority", ["priority"])` |
| `convex/providerConfig.ts` | CRUD: list, setEnabled, setPriority | VERIFIED | `list` uses `withIndex("by_priority")`; `setEnabled` uses `withIndex("by_provider")` upsert; `setPriority` bulk upserts |
| `convex/seedGateway.ts` | seedSDKSpendAlert, seedGatewayProfiles, seedProviderConfigs internalMutations + public runSeed | VERIFIED | All four exports present (lines 16, 46, 72, 98); `runSeed` schedules all three via `ctx.scheduler.runAfter(0, ...)` |
| `src/lib/providers.ts` | PROVIDER_COLORS exported | VERIFIED | Line 38: `export const PROVIDER_COLORS: Record<string, string>` — 7 providers present |
| `src/components/CostTrendChart.tsx` | Imports PROVIDER_COLORS from providers.ts (no local definition) | VERIFIED | Line 4: `import { PROVIDER_DISPLAY_NAMES, PROVIDER_COLORS } from "../lib/providers"` — no local const |
| `convex/toolExecutions.ts` | listBySession query | VERIFIED | Line 91: `export const listBySession = query({...})` using `withIndex("by_session")` |
| `src/components/SDKSpendGuard.tsx` | Full component: sparkline, projection, overshoot warning | VERIFIED | All exports present; `Sparkline`, `Clock`, `costByPeriodByProvider`, `text-[--status-warn]` all confirmed |
| `src/components/SDKSpendCapGauge.tsx` | Backward-compat re-export shim | VERIFIED | Re-exports `classifyCapStatus`, `DAILY_CAP`, `ALERT_THRESHOLD`, `default` from `./SDKSpendGuard` |
| `src/pages/Analytics.tsx` | Imports SDKSpendGuard, not SDKSpendCapGauge | VERIFIED | Line 23: `import SDKSpendGuard`, line 95: `<SDKSpendGuard />` |
| `convex/alerts.ts` | sdk_spend_usd_today in both evaluateCondition instances, async, Promise.all | VERIFIED | Lines 814 and 990: metric branch. Lines 855-856, 863, 1030-1031, 1038: `Promise.all` |
| `convex/alerts.test.ts` | 6 real tests (no todo stubs) | VERIFIED | `it.todo` count: 0; `it(` count: 6 — threshold at/above/below, zero, billingType api-only, subscription exclusion |
| `src/hooks/useProviderConfig.ts` | useProviderConfig hook | VERIFIED | Exports `useProviderConfig()`; `api.providerConfig.list`, `api.providerConfig.setEnabled`, `api.providerConfig.setPriority` |
| `src/components/ProviderControls.tsx` | DnD panel, toggles, gateway command, seed button | VERIFIED | `DndContext`, `useSortable`, `GripVertical`, `PROVIDER_COLORS`, `PROVIDER_BILLING`, `gateway.provider.set_enabled`, `api.seedGateway.runSeed`, "Seed Gateway Defaults" — all present |
| `src/pages/Settings.tsx` | Gateway Providers section with ProviderControls | VERIFIED | Line 18: import. Line 706: `SectionErrorBoundary name="Gateway Providers"` with `<ProviderControls />` |
| `src/components/SessionTimeline.tsx` | Provider badges per tool call event | VERIFIED | `toolExecutions?: any[]` prop, `toolExecProviderMap`, `Badge` import, `PROVIDER_COLORS` inline style |
| `src/pages/SessionDetail.tsx` | Queries toolExecutions.listBySession, passes to timeline | VERIFIED | Line 34: `api.toolExecutions.listBySession`. Line 141: `toolExecutions={toolExecutions}` |
| `src/components/ActiveSessions.tsx` | Primary provider badge + untagged model fallback | VERIFIED | `PROVIDER_COLORS`, `session.provider` guard, `Badge` inline style; line 57: muted italic "untagged" |
| `src/components/RoutingDecisionsTable.tsx` | Fallback filter, Score column, colSpan=6 | VERIFIED | `fallbackFilter` state, "Fallback only" pill, `filteredDecisions`, `<TableHead>Score</TableHead>`, `finalScore?.toFixed(3)`, `colSpan={6}` |
| `src/components/SessionTimeline.test.tsx` | 4 real provider badge tests (no todo stubs) | VERIFIED | `it.todo` count: 0; `it(` count: 4 — badge renders, empty toolExecutions, non-tool event, unknown provider fallback |
| `src/components/SessionComparison.tsx` | Muted italic "untagged" model fallback | VERIFIED | Line 56: conditional JSX with `text-muted-foreground italic text-xs` |
| `src/components/SessionHeader.tsx` | Muted italic "untagged" model fallback | VERIFIED | Line 37: conditional JSX with `text-muted-foreground italic text-xs` |
| `convex/ingest.ts` | provider field passed to toolExecutions.insert and sessions.upsert | VERIFIED | Line 51: `provider: data.provider ?? body.provider ?? "claude-cli"` (sessions); line 147: `provider: data.provider ?? "claude-cli"` (toolExecutions) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convex/providerConfig.ts` | `convex/schema.ts` | providerConfig table | VERIFIED | `withIndex("by_provider")` and `by_priority` confirmed in list and mutation handlers |
| `src/components/CostTrendChart.tsx` | `src/lib/providers.ts` | PROVIDER_COLORS import | VERIFIED | `import { PROVIDER_DISPLAY_NAMES, PROVIDER_COLORS } from "../lib/providers"` — no local definition |
| `convex/seedGateway.ts` | seedSDKSpendAlert, seedGatewayProfiles, seedProviderConfigs | runSeed via scheduler | VERIFIED | Lines 101-103: three `ctx.scheduler.runAfter(0, ...)` calls |
| `src/components/SDKSpendGuard.tsx` | `convex/aggregates.ts` | costByPeriodByProvider query | VERIFIED | `useQuery(api.aggregates.costByPeriodByProvider, { period: "hourly", lookbackHours: 24, billingType: "api" })` |
| `convex/alerts.ts` | aggregates table | sdk_spend_usd_today metric | VERIFIED | `ctx.db.query("aggregates").withIndex("by_type_period_bucket", ...)` in both evaluateCondition instances |
| `src/components/ProviderControls.tsx` | `src/hooks/useProviderConfig.ts` | useProviderConfig() | VERIFIED | Import + called at component body |
| `src/components/ProviderControls.tsx` | `convex/seedGateway.ts` | useMutation(api.seedGateway.runSeed) | VERIFIED | `const runSeed = useMutation(api.seedGateway.runSeed)` line 144 |
| `src/hooks/useProviderConfig.ts` | `convex/providerConfig.ts` | useQuery/useMutation | VERIFIED | `api.providerConfig.list`, `setEnabled`, `setPriority` all wired |
| `src/pages/SessionDetail.tsx` | `convex/toolExecutions.ts` | listBySession query | VERIFIED | `useQuery(api.toolExecutions.listBySession, ...)` line 34 |
| `src/components/SessionTimeline.tsx` | `src/lib/providers.ts` | PROVIDER_COLORS import | VERIFIED | `import { PROVIDER_COLORS, PROVIDER_DISPLAY_NAMES } from "../lib/providers"` line 6 |
| `convex/ingest.ts` | `convex/toolExecutions.ts` | provider field in PostToolUse | VERIFIED | `provider: data.provider ?? "claude-cli"` passed to `toolExecutions.insert` call |
| `convex/ingest.ts` | `convex/sessions.ts` | provider field in session upsert | VERIFIED | `provider: data.provider ?? body.provider ?? "claude-cli"` passed to `sessions.upsert` call |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SDKSpendGuard.tsx` | `rawBuckets` | `costByPeriodByProvider` Convex query (aggregates table) | Cannot confirm without live DB — code path is correct | HUMAN NEEDED |
| `SessionTimeline.tsx` | `toolExecProviderMap` | `toolExecutions` prop from `SessionDetail` via `listBySession`; ingest now populates `provider` field | Code path and ingest wiring confirmed; live data needs human check | HUMAN NEEDED |
| `ProviderControls.tsx` | `configs` | `useProviderConfig()` → `api.providerConfig.list`; `runSeed` now seeds providerConfig rows | Seed path confirmed; requires live button click to verify rows appear | HUMAN NEEDED |
| `alerts.ts` evaluateCondition | `value` | `ctx.db.query("aggregates")` with `billingType=api` filter, daily+hourly fallback | Real DB query path confirmed in both evaluateCondition instances | VERIFIED (code path) |

### Behavioral Spot-Checks

Step 7b: SKIPPED — Convex backend requires a live deployment; no runnable local entry point for backend queries.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GW-12 | 69-01, 69-02, 69-05 | SDK spend guard with auto-alert at 80% cap | SATISFIED | SDKSpendGuard card: sparkline + projectDayEndSpend + overshoot warning; evaluateCondition handles sdk_spend_usd_today; seed rule created at $4.00 threshold |
| GW-13 | 69-01, 69-03, 69-04, 69-05 | Operator can enable/disable and reorder providers | SATISFIED | ProviderControls: DnD reorder, toggle, Convex persistence, gateway.provider.set_enabled dispatch; seedProviderConfigs creates rows on runSeed |
| GW-14 | 69-01, 69-02, 69-04, 69-05 | Session timeline provider badges; real tests | SATISFIED | SessionTimeline PROVIDER_COLORS badges; SessionDetail wired to listBySession; ingest passes provider field; 4 real tests in SessionTimeline.test.tsx |

**Note on REQUIREMENTS.md:** GW-12, GW-13, GW-14 are defined in ROADMAP.md Phase 69 section and 69-RESEARCH.md but do NOT appear in `.planning/REQUIREMENTS.md`. The REQUIREMENTS.md file covers v4.0/v5.0 requirements (UI-*, RT-*, DP-*, ALR-*, INT-*, SCH-*). GW-* requirements belong to the gateway milestone and are defined inline in the ROADMAP only. This is a documentation gap — no implementation gap. The GW-* IDs should be added to the traceability table in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/SessionTimeline.tsx:63` | `return null` | Info | Legitimate guard: `if (!e.toolName) return null` — prevents badge lookup on non-tool events. Not a stub. |

No TODOs, FIXMEs, placeholders, empty implementations, or hardcoded empty data found in any delivered artifact.

### Human Verification Required

All four ROADMAP success criteria are VERIFIED at the code level. The following items need human confirmation that live data flows end-to-end (unchanged from initial verification, with Plan 05 gap closure noted where relevant):

#### 1. SDKSpendGuard card renders real spend data

**Test:** Open the Analytics page in the running CodePulse dashboard
**Expected:** SDKSpendGuard card shows a non-zero current spend value (or $0.00 if no SDK calls today), a populated sparkline showing hourly buckets, and a projection row after 2+ hours of the day have elapsed
**Why human:** `costByPeriodByProvider` requires live Convex aggregates rows with `billingType=api` — cannot verify programmatically

#### 2. Provider enable/disable persists and cards render after seeding

**Test:** Open Settings page, find Gateway Providers section. Click "Seed Gateway Defaults". Confirm four provider cards appear with drag handles, billing badges, and toggles. Toggle a provider off, reload the page, confirm it stays disabled.
**Expected:** Cards appear immediately after seeding (Plan 05 wired `seedProviderConfigs`). Toggle state persists across reload. Toast shows gateway command sent or "Gateway offline — setting saved, will apply on reconnect"
**Why human:** Requires live Convex mutation + WebSocket command dispatch + browser interaction to verify DnD drag handles

#### 3. Session timeline provider badges render with live data

**Test:** Open a session detail page for a session that has tool calls recorded after Plan 05 deployment
**Expected:** Provider badges visible with color-coded border (emerald for claude-cli, green for codex, cyan for antigravity, amber for anthropic_direct). Sessions ingested before Plan 05 will lack the provider field — use a new session.
**Why human:** Requires `toolExecutions` rows with `provider` field populated by the updated ingest pipeline

#### 4. SDK spend alert fires at 80% threshold

**Test:** Confirm the "SDK Spend Guard" alert rule exists in the alert rules list (Settings → Alerts). Verify threshold shows $4.00 (80% of $5.00 daily cap).
**Expected:** Rule visible with metric `sdk_spend_usd_today`, operator `gte`, threshold `4.0`, severity `warning`. Alert fires in Alerts feed when API spend reaches $4.00.
**Why human:** Alert rule seeded via `runSeed` → `seedSDKSpendAlert` scheduled mutation. Firing requires actual SDK spend data reaching threshold.

#### 5. Sessions without model show "untagged" in all three views

**Test:** Open a session with no model field in SessionComparison, ActiveSessions, and SessionHeader
**Expected:** All three components display muted italic "untagged" — not "unknown", "N/A", or "—"
**Why human:** Requires a session record without a model field present in the live database

### Gaps Summary

No implementation gaps. All code-level evidence confirms the phase goal is achieved and Plan 05 gap closure is fully wired:

- `SDKSpendGuard` card: sparkline, projection, overshoot warning, sourced from `costByPeriodByProvider` (Plan 02)
- `ProviderControls` panel: DnD reorder, Convex persistence, gateway command dispatch, seed button, `seedProviderConfigs` creates rows (Plans 03 + 05)
- Session timeline provider badges: `listBySession` → `SessionDetail` → `SessionTimeline` → `PROVIDER_COLORS` Badge; ingest now populates provider field (Plans 04 + 05)
- `evaluateCondition` handles `sdk_spend_usd_today` with billingType filtering in both cron handler instances (Plan 02)
- All test stubs replaced with real tests: `alerts.test.ts` (6), `SessionTimeline.test.tsx` (4), `SDKSpendGuard.test.tsx` (7), `ProviderControls.test.tsx` (3) — zero `it.todo` stubs remaining
- "untagged" model fallback harmonized across SessionComparison, ActiveSessions, SessionHeader (Plan 05)

**Documentation gap (non-blocking):** GW-12, GW-13, GW-14 should be added to `.planning/REQUIREMENTS.md` traceability table. Currently defined only in ROADMAP.md and 69-RESEARCH.md.

---

_Verified: 2026-05-23T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
