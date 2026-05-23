---
phase: 69-sdk-spend-guard-multi-provider-ux
verified: 2026-05-23T15:30:00Z
status: human_needed
score: 4/4
overrides_applied: 0
human_verification:
  - test: "Open Analytics page and confirm SDKSpendGuard card shows current SDK spend, an hourly sparkline, and projected daily total"
    expected: "Card renders real spend value (not $0.00 skeleton), sparkline shows hourly buckets, projection row appears after 2+ hours of the day have elapsed"
    why_human: "Requires live Convex data; programmatic check cannot confirm costByPeriodByProvider returns non-empty data or that the sparkline is visually correct"
  - test: "Open Settings page, locate Gateway Providers section, toggle a provider off then back on"
    expected: "Toggle persists (page reload retains disabled state), toast appears confirming gateway command sent (or 'Gateway offline' warning if gateway is not connected)"
    why_human: "End-to-end toggle requires Convex write + WebSocket command dispatch — cannot verify without live runtime"
  - test: "Open a session detail page with tool calls and confirm provider badges appear on timeline events"
    expected: "Each tool_call event row shows a colored badge matching the provider that handled it (e.g. emerald for claude-cli, green for codex)"
    why_human: "Requires toolExecutions rows in the database with provider field populated; cannot confirm data-flow without live data"
  - test: "Trigger or simulate an SDK spend alert: set threshold to a low value and confirm alert fires"
    expected: "Alert appears in the Alerts feed when sdk_spend_usd_today metric exceeds threshold; evaluateCondition picks up billingType=api rows only"
    why_human: "Alert cron evaluation requires live Convex aggregates table data and a scheduled cron run"
---

# Phase 69: SDK Spend Guard & Multi-Provider UX — Verification Report

**Phase Goal:** Operator has full control and visibility over API-billed SDK usage, and the entire dashboard feels multi-provider-native
**Verified:** 2026-05-23T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SDK spend guard card shows real-time spend with projected daily total and visual alert at threshold | VERIFIED | `SDKSpendGuard.tsx` exports `projectDayEndSpend`, uses `costByPeriodByProvider` with `billingType: "api"`, renders `Sparkline`, `text-[--status-warn]` overshoot warning with `Clock` icon. Analytics page imports `SDKSpendGuard` directly (not `SDKSpendCapGauge`). |
| 2 | Operator can manually disable a provider from the dashboard | VERIFIED | `ProviderControls.tsx` contains `DndContext`, `useSortable`, `gateway.provider.set_enabled` command dispatch, Convex `setEnabled` mutation via `useProviderConfig`. Settings page has `SectionErrorBoundary name="Gateway Providers"` wrapping `<ProviderControls />`. |
| 3 | Session timeline shows provider badge per tool call | VERIFIED | `SessionTimeline.tsx` imports `PROVIDER_COLORS`, `PROVIDER_DISPLAY_NAMES`, builds `toolExecProviderMap` via `useMemo`, renders `Badge` with `PROVIDER_COLORS[provider]` inline style. `SessionDetail.tsx` queries `api.toolExecutions.listBySession` and passes `toolExecutions={toolExecutions}` prop. |
| 4 | Alert fires automatically when SDK spend hits 80% of daily cap | VERIFIED | Both `evaluateCondition` instances in `alerts.ts` (lines 792 and 967) are `async`, handle `sdk_spend_usd_today` metric with daily-first + hourly-fallback query, filter `billingType === "api"`, wrapped in `Promise.all`. `seedGateway.ts` seeds the rule idempotently with 80% threshold ($4.00 of $5.00). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | providerConfig table with by_provider + by_priority indexes | VERIFIED | Lines 1411-1418: `providerConfig: defineTable({...}).index("by_provider", ["provider"]).index("by_priority", ["priority"])` |
| `convex/providerConfig.ts` | CRUD: list, setEnabled, setPriority | VERIFIED | All three exports present; `setEnabled` uses `withIndex("by_provider")` upsert; `setPriority` bulk upserts with index position |
| `convex/seedGateway.ts` | seedSDKSpendAlert, seedGatewayProfiles internalMutations + public runSeed | VERIFIED | All three exports present; idempotency guards confirmed; `runSeed` uses `ctx.scheduler.runAfter(0, ...)` |
| `src/lib/providers.ts` | PROVIDER_COLORS exported | VERIFIED | Line 38: `export const PROVIDER_COLORS: Record<string, string>` — all 7 providers present |
| `src/components/CostTrendChart.tsx` | Imports PROVIDER_COLORS from providers.ts (no local definition) | VERIFIED | Line 4: `import { PROVIDER_DISPLAY_NAMES, PROVIDER_COLORS } from "../lib/providers"` — no local `const PROVIDER_COLORS` |
| `convex/toolExecutions.ts` | listBySession query | VERIFIED | Line 97: `export const listBySession = query({...})` using `withIndex("by_session")` |
| `src/components/SDKSpendGuard.tsx` | Full component: sparkline, projection, overshoot warning | VERIFIED | `projectDayEndSpend`, `classifyCapStatus`, `DAILY_CAP`, `ALERT_THRESHOLD` all exported; `Sparkline`, `Clock`, `costByPeriodByProvider`, `text-[--status-warn]` all present |
| `src/components/SDKSpendCapGauge.tsx` | Backward-compat re-export shim | VERIFIED | 3-line file re-exporting `classifyCapStatus`, `DAILY_CAP`, `ALERT_THRESHOLD`, `default` from `./SDKSpendGuard` |
| `src/pages/Analytics.tsx` | Imports SDKSpendGuard, not SDKSpendCapGauge | VERIFIED | Line 23: `import SDKSpendGuard from "../components/SDKSpendGuard"`, line 95: `<SDKSpendGuard />` |
| `convex/alerts.ts` | sdk_spend_usd_today in both evaluateCondition instances, async | VERIFIED | Lines 792 and 967: `const evaluateCondition = async`. Lines 811 and 986: `sdk_spend_usd_today` branch. `Promise.all` wrapping at lines 852, 853, 860, 1026, 1027, 1034 |
| `convex/alerts.test.ts` | Real tests (not .todo stubs) | VERIFIED | 6 real `it(...)` tests covering threshold at/above/below, zero spend, billingType api-only sum, subscription exclusion |
| `src/hooks/useProviderConfig.ts` | useProviderConfig hook | VERIFIED | Exports `useProviderConfig()`; calls `api.providerConfig.list`, `api.providerConfig.setEnabled`, `api.providerConfig.setPriority` |
| `src/components/ProviderControls.tsx` | DnD panel, toggles, gateway command, seed button | VERIFIED | `DndContext`, `useSortable`, `GripVertical`, `PROVIDER_COLORS`, `PROVIDER_BILLING`, `gateway.provider.set_enabled`, `api.seedGateway.runSeed`, "Seed Gateway Defaults" text — all present |
| `src/pages/Settings.tsx` | Gateway Providers section with ProviderControls | VERIFIED | Line 17: import. Lines 703-706: `SectionErrorBoundary name="Gateway Providers"` with `<ProviderControls />` |
| `src/components/SessionTimeline.tsx` | Provider badges per tool call event | VERIFIED | `toolExecutions?: any[]` prop, `toolExecProviderMap`, `Badge` import, `PROVIDER_COLORS` inline style |
| `src/pages/SessionDetail.tsx` | Queries toolExecutions.listBySession, passes to timeline | VERIFIED | Line 34: `api.toolExecutions.listBySession`. Line 141: `toolExecutions={toolExecutions}` on SessionTimeline |
| `src/components/ActiveSessions.tsx` | Primary provider badge per session row | VERIFIED | `PROVIDER_COLORS`, `PROVIDER_DISPLAY_NAMES` imported; `session.provider` guard; `Badge` with inline color style |
| `src/components/RoutingDecisionsTable.tsx` | Fallback filter, Score column, colSpan=6 | VERIFIED | `fallbackFilter` state, "Fallback only" pill, `filteredDecisions`, `<TableHead>Score</TableHead>`, `finalScore?.toFixed(3)`, `colSpan={6}` |
| `src/components/SessionTimeline.test.tsx` | Real provider badge tests | VERIFIED | 4 real `it(...)` tests: badge renders, empty toolExecutions (no badge), non-tool event (no badge), unknown provider fallback |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convex/providerConfig.ts` | `convex/schema.ts` | providerConfig table | VERIFIED | `withIndex("by_provider")` and `by_priority` in both list and mutation handlers |
| `src/components/CostTrendChart.tsx` | `src/lib/providers.ts` | PROVIDER_COLORS import | VERIFIED | `import { PROVIDER_DISPLAY_NAMES, PROVIDER_COLORS } from "../lib/providers"` |
| `convex/seedGateway.ts` | internal seed mutations | runSeed via scheduler | VERIFIED | `ctx.scheduler.runAfter(0, internal.seedGateway.seedSDKSpendAlert, {})` and `seedGatewayProfiles` |
| `src/components/SDKSpendGuard.tsx` | `convex/aggregates.ts` | costByPeriodByProvider query | VERIFIED | `useQuery(api.aggregates.costByPeriodByProvider, { period: "hourly", lookbackHours: 24, billingType: "api" })` |
| `convex/alerts.ts` | aggregates table | sdk_spend_usd_today metric | VERIFIED | `ctx.db.query("aggregates").withIndex("by_type_period_bucket", ...)` in both evaluateCondition instances |
| `src/components/ProviderControls.tsx` | `src/hooks/useProviderConfig.ts` | useProviderConfig() | VERIFIED | `import { useProviderConfig }` + called at line 142 |
| `src/components/ProviderControls.tsx` | `convex/seedGateway.ts` | useMutation(api.seedGateway.runSeed) | VERIFIED | `const runSeed = useMutation(api.seedGateway.runSeed)` |
| `src/hooks/useProviderConfig.ts` | `convex/providerConfig.ts` | useQuery/useMutation | VERIFIED | `api.providerConfig.list`, `api.providerConfig.setEnabled`, `api.providerConfig.setPriority` |
| `src/pages/SessionDetail.tsx` | `convex/toolExecutions.ts` | listBySession query | VERIFIED | `useQuery(api.toolExecutions.listBySession, ...)` |
| `src/components/SessionTimeline.tsx` | `src/lib/providers.ts` | PROVIDER_COLORS import | VERIFIED | `import { PROVIDER_COLORS, PROVIDER_DISPLAY_NAMES } from "../lib/providers"` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SDKSpendGuard.tsx` | `rawBuckets` | `costByPeriodByProvider` Convex query (aggregates table) | Cannot confirm without live DB | HUMAN NEEDED |
| `SessionTimeline.tsx` | `toolExecProviderMap` | `toolExecutions` prop from `SessionDetail.tsx` via `listBySession` | Cannot confirm toolExecutions rows have provider field populated | HUMAN NEEDED |
| `ProviderControls.tsx` | `configs` | `useProviderConfig()` → `api.providerConfig.list` | Cannot confirm Convex has any rows (table may be empty until Seed button is clicked) | ACCEPTABLE — seed button handles empty state |
| `alerts.ts` evaluateCondition | `value` | `ctx.db.query("aggregates")` with billingType filter | Real DB query present; daily+hourly fallback correct | VERIFIED (code path) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GW-12 | 69-01, 69-02 | SDK spend guard with auto-alert at 80% cap | SATISFIED | SDKSpendGuard card renders spend+sparkline+projection; evaluateCondition handles sdk_spend_usd_today; seed rule created |
| GW-13 | 69-01, 69-03, 69-04 | Operator can enable/disable and reorder providers | SATISFIED | ProviderControls with DnD reorder, toggle, Convex persistence, gateway command dispatch on Settings page |
| GW-14 | 69-01, 69-02, 69-04 | Session timeline provider badges; real tests | SATISFIED | SessionTimeline with PROVIDER_COLORS badges; SessionDetail wired to listBySession; 4 real tests in SessionTimeline.test.tsx |

**Note on REQUIREMENTS.md:** GW-12, GW-13, GW-14 are defined in ROADMAP.md Phase 69 section but do NOT appear in `.planning/REQUIREMENTS.md`. The REQUIREMENTS.md file covers v4.0/v5.0 requirements (UI-*, RT-*, DP-*, ALR-*, INT-*, VIZ-*, EXT-*, SCH-*). GW-* requirements belong to the v5.1 gateway milestone and appear to have been defined inline in the ROADMAP only. This is an **orphaned requirements tracking gap** — the GW-* IDs are not formally registered in REQUIREMENTS.md. No implementation gap, but the traceability table in REQUIREMENTS.md should be updated.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | All implementation files contain real logic; no TODO/FIXME/placeholder comments in delivered artifacts |

The `convex/alerts.test.ts` tests validate threshold comparison logic in isolation (without `ctx`) because `evaluateCondition` is an inner async closure requiring database access. This is acceptable — the tests confirm the filtering and comparison math is correct; integration coverage comes from the alert cron infrastructure.

### Human Verification Required

All four success criteria are VERIFIED at the code level. The following items need human confirmation that live data flows end-to-end:

#### 1. SDKSpendGuard card renders real spend data

**Test:** Open the Analytics page in the running CodePulse dashboard
**Expected:** SDKSpendGuard card shows a non-zero current spend value (or $0.00 with explanation if no SDK calls today), a populated sparkline chart, and a projection row after 2+ hours of the day have elapsed
**Why human:** `costByPeriodByProvider` query requires live Convex aggregates rows with `billingType=api` — cannot verify programmatically that data exists

#### 2. Provider enable/disable persists and sends gateway command

**Test:** Open Settings page, find Gateway Providers section. If empty, click "Seed Gateway Defaults" first. Toggle a provider off, reload the page, confirm it stays disabled
**Expected:** Toggle state persists across reload (Convex write confirmed). A toast shows the gateway command was sent, or "Gateway offline — setting saved, will apply on reconnect" if gateway is not connected
**Why human:** End-to-end requires live Convex mutation + WebSocket command dispatch

#### 3. Session timeline provider badges render with live data

**Test:** Open a session detail page for a session that has tool calls. Confirm colored badges appear next to tool call events
**Expected:** Provider badges visible with color-coded border matching the provider (emerald for claude-cli, green for codex, cyan for antigravity, emerald for claude-sdk, amber for anthropic_direct)
**Why human:** Requires `toolExecutions` rows in the database with `provider` field populated by the ingest pipeline

#### 4. SDK spend alert fires at 80% threshold

**Test:** Confirm the "SDK Spend Guard" alert rule exists in the alert rules list (Settings → Alerts or wherever custom rules are shown). Verify it shows threshold of $4.00 (80% of $5.00 daily cap)
**Expected:** Rule visible with metric `sdk_spend_usd_today`, operator `gte`, threshold `4.0`, severity `warning`. Alert fires in Alerts feed when API spend reaches $4.00
**Why human:** Alert rule is seeded via `runSeed` → scheduled internalMutation — cannot confirm it fired without actual SDK spend data reaching threshold

### Gaps Summary

No implementation gaps found. All code-level evidence confirms the phase goal is achieved:

- `SDKSpendGuard` card is fully implemented with sparkline, projection, and overshoot warning (Plan 02)
- `ProviderControls` panel is wired into Settings with DnD reorder, Convex persistence, and gateway command dispatch (Plan 03)
- Session timeline provider badges are wired end-to-end: `listBySession` → `SessionDetail` → `SessionTimeline` → `PROVIDER_COLORS` Badge (Plan 04)
- `evaluateCondition` handles `sdk_spend_usd_today` metric with billingType filtering in both cron handler instances (Plan 02)
- All test stubs replaced with real tests: `alerts.test.ts` (6 tests), `SessionTimeline.test.tsx` (4 tests), `SDKSpendGuard.test.tsx` (7 tests), `ProviderControls.test.tsx` (3 tests)

**Orphaned requirements tracking:** GW-12, GW-13, GW-14 should be added to `.planning/REQUIREMENTS.md` traceability table. Currently they exist only in ROADMAP.md.

---

_Verified: 2026-05-23T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
