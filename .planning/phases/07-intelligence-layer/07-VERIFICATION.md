---
phase: 07-intelligence-layer
verified: 2026-04-14T15:00:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Browse Briefings page after a completed session and verify an LLM-generated briefing appears"
    expected: "A briefing card appears in the feed with the session ID, a coherent narrative summary, and expand/collapse works"
    why_human: "Requires a live Convex environment with LLM API key configured and a real session completing"
  - test: "Trigger the daily digest cron manually (or wait for 06:00 UTC) and verify digest appears in Briefings page"
    expected: "A DIGEST-type entry appears showing activity summary, spend, anomaly count, and ideation findings"
    why_human: "Requires live Convex environment; cron execution and LLM output quality cannot be verified statically"
  - test: "Open Analytics page and verify CostForecastPanel renders with projections when aggregates data exists"
    expected: "Three stat boxes (Projected Daily, Projected Weekly, Projected Monthly) show dollar values; budget bar shows correct color; sparkline renders"
    why_human: "Requires real daily aggregate data in Convex; visual layout must be confirmed"
  - test: "Open Settings page and verify the Intelligence section contains budget cap input and LLM Providers subsection"
    expected: "Monthly Budget Cap input persists when saved; LLM provider dropdowns (primary + backup) with API key fields appear; Remove Provider shows confirmation dialog"
    why_human: "Save state, persistence, and confirmation dialog behavior require live interaction"
  - test: "Open Memory page and verify Quality tab appears and renders with StatCards"
    expected: "Quality tab button is visible; clicking it shows Dedup Rate, Stale Memories, and Contradictions stat cards; accordion sections are present"
    why_human: "Visual tab rendering and accordion interaction must be confirmed in browser"
  - test: "With active anomalies in the anomalyEvents table, verify AnomalyBadge renders on MetricCards in Analytics"
    expected: "WARN or ANOMALY badge appears inline next to Total Cost or Total Events MetricCard; hovering shows tooltip with metric, value, expected, and z-score"
    why_human: "Requires anomaly data to exist; tooltip hover and visual badge rendering must be confirmed in browser"
---

# Phase 7: Intelligence Layer Verification Report

**Phase Goal:** The dashboard surfaces cost forecasts, session narratives, anomaly signals, activity changelogs, and memory quality metrics — operators understand not just what happened but what to expect
**Verified:** 2026-04-14T15:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The dashboard displays trend-based daily, weekly, and monthly spend predictions with a visual budget threshold indicator | VERIFIED | `convex/forecasts.ts` exports `costForecast` query reading real daily aggregates via `by_type_period_bucket` index; `CostForecastPanel.tsx` uses `useQuery(api.forecasts.costForecast)` and renders Projected Daily/Weekly/Monthly with budget bar (green/yellow/red via `--status-ok`/`--status-warn`/`--status-error`); integrated in `Analytics.tsx` |
| 2 | Any completed session has an LLM-generated briefing summarizing what happened, key decisions made, and anomalies detected | VERIFIED | `convex/briefings.ts` exports `onSessionCompleted` internalMutation with idempotency guard; `generateSessionBriefingAction` builds structured summary via `groupActivityEvents` and calls LLM; wired in `convex/ingest.ts` at both `session_end` and Stop hook events (lines 107, 179) |
| 3 | A daily digest is auto-generated and stored in Convex — operator can browse past digests from the Briefings page | VERIFIED | `triggerDailyDigest` cron target registered in `crons.ts`; `generateDailyDigestAction` gathers sessions, cost, anomalies, ideation findings; `Briefings.tsx` fully rewritten with `usePaginatedQuery(api.briefings.listBriefings)`, date filter, LoadMoreButton, empty state; AGENT_MAP and BRIEFING_TEMPLATES removed |
| 4 | Unusual patterns (cost spikes, error clusters, latency degradation) appear as visual anomaly indicators on dashboard widgets | VERIFIED | `computeZScore` and `classifySeverity` implemented and tested in `anomalyDetection.ts`; `evaluateInternal` cron evaluates cost/errors/latency daily aggregates; `AnomalyBadge.tsx` with WARN/ANOMALY labels and Radix tooltip; integrated in `Analytics.tsx` via `api.anomalyDetection.getActiveAnomalies` |
| 5 | Activity changelog auto-generates a rule-based summary of what Astridr accomplished (no LLM cost) | VERIFIED | `groupActivityEvents` exported pure function in `briefings.ts` groups events by toolName/eventType and returns sorted counts; called at line 317 in `generateSessionBriefingAction` and referenced in daily digest data gathering; confirmed by 5 passing unit tests |
| 6 | Ideation briefings weave proactive scan findings into daily digest | VERIFIED | `getDailyDigestDataInternal` internalQuery queries `ideationFindings` table for undismissed findings (line 191 in `briefings.ts`); included in daily digest LLM prompt context |
| 7 | Memory page shows quality metrics: deduplication rate, contradiction resolution, staleness indicators | VERIFIED | `memoryQuality.ts` exports `computeDeduplicationRate`, `identifyStaleMemories`, `evaluateInternal`, `detectContradictionsAction`, `getLatestQuality`; Memory.tsx expanded with `"quality"` TabId, 3 StatCards (Dedup Rate, Stale Memories, Contradictions), and `<MemoryQualityTab />` wrapped in SectionErrorBoundary |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `convex/schema.ts` | briefings, anomalyEvents, memoryQuality tables with indexes | VERIFIED | All 3 tables present at line 887+; indexes by_type_generated, by_session, by_date, by_metric_detected, by_severity, by_evaluated all confirmed |
| `convex/crons.ts` | Phase 7 cron registrations | VERIFIED | generate-daily-digest, detect-anomalies, evaluate-memory-quality all registered with correct internal references |
| `convex/forecasts.ts` | computeMovingAverage, projectSpend, classifyBudgetStatus, costForecast, setBudgetCap | VERIFIED | All 5 exports present; intelligence.budget_cap key used; cap validation present |
| `convex/forecasts.test.ts` | 8 passing tests, no test.todo stubs | VERIFIED | 8/8 tests pass, 0 remaining todos |
| `src/components/CostForecastPanel.tsx` | Projected Daily/Weekly/Monthly, budget bar, sparkline | VERIFIED | All required strings present; useQuery(api.forecasts.costForecast) wired |
| `src/pages/Analytics.tsx` | CostForecastPanel integrated with SectionErrorBoundary | VERIFIED | CostForecastPanel and SectionErrorBoundary name="Cost Forecast" present |
| `src/pages/Settings.tsx` | Intelligence section, budget cap, LLMProviderConfig | VERIFIED | IntelligenceSettings component, Save Budget Settings, LLMProviderConfig all present |
| `convex/briefings.ts` | groupActivityEvents, callLLMWithFallback, onSessionCompleted, generateSessionBriefingAction, triggerDailyDigest, generateDailyDigestAction, listBriefings, setLLMConfig | VERIFIED | All 8 required exports present; ideationFindings queried; anthropic-version header present |
| `convex/briefings.test.ts` | Non-todo tests for groupActivityEvents | VERIFIED | 5 non-todo tests for groupActivityEvents; 6 remaining todos for mutation-level (requires Convex runtime mocking — acceptable) |
| `convex/ingest.ts` | onSessionCompleted wired after markCompleted | VERIFIED | Lines 107 and 179 both call `internal.briefings.onSessionCompleted` |
| `src/pages/Briefings.tsx` | Dynamic feed, no static data | VERIFIED | AGENT_MAP and BRIEFING_TEMPLATES absent; usePaginatedQuery(api.briefings.listBriefings) present |
| `src/components/BriefingFeedItem.tsx` | DIGEST/SESSION pills, ChevronDown, session indent | VERIFIED | All confirmed |
| `src/components/LLMProviderConfig.tsx` | setLLMConfig, Save Provider Config, Remove Provider, intelligence.llm_primary key | VERIFIED | All confirmed; uses configKey template `intelligence.llm_${slot}` |
| `convex/anomalyDetection.ts` | computeZScore, classifySeverity, evaluateInternal, getActiveAnomalies, anomaly_detection source, webhookDelivery | VERIFIED | All present; webhook scheduling confirmed |
| `convex/anomalyDetection.test.ts` | 4+ tests for computeZScore, 2+ for classifySeverity | VERIFIED | 11 non-todo tests (computeZScore: 6, classifySeverity: 5); 2 remaining todos for mutation-level |
| `src/components/AnomalyBadge.tsx` | ANOMALY/WARN labels, status colors, TooltipProvider, no rounded class | VERIFIED | All present; no `rounded` class found |
| `src/pages/Analytics.tsx` | AnomalyBadge, getActiveAnomalies query | VERIFIED | Both confirmed |
| `convex/memoryQuality.ts` | computeDeduplicationRate, identifyStaleMemories, evaluateInternal, detectContradictionsAction, getLatestQuality, getLLMConfigInternal usage | VERIFIED | All exports present; intelligence.staleness_days key; memory_pruned event type; getLLMConfigInternal called via internal.briefings |
| `convex/memoryQuality.test.ts` | 3+ non-todo tests | VERIFIED | 7 non-todo tests passing |
| `src/components/MemoryQualityTab.tsx` | getLatestQuality query, stat cards, accordion sections, empty state | VERIFIED | All confirmed; text-2xl font-semibold tabular-nums pattern present |
| `src/pages/Memory.tsx` | "quality" TabId, MemoryQualityTab, quality StatCards, SectionErrorBoundary | VERIFIED | All confirmed; SectionErrorBoundary name="Memory Quality" present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convex/crons.ts` | `convex/briefings.ts` | internal.briefings.triggerDailyDigest | WIRED | Confirmed at crons.ts line 59 |
| `convex/crons.ts` | `convex/anomalyDetection.ts` | internal.anomalyDetection.evaluateInternal | WIRED | Confirmed at crons.ts line 66 |
| `convex/crons.ts` | `convex/memoryQuality.ts` | internal.memoryQuality.evaluateInternal | WIRED | Confirmed at crons.ts line 73 |
| `src/components/CostForecastPanel.tsx` | `convex/forecasts.ts` | useQuery(api.forecasts.costForecast) | WIRED | Line 6 of CostForecastPanel.tsx |
| `src/pages/Settings.tsx` | `convex/forecasts.ts` | useMutation(api.forecasts.setBudgetCap) | WIRED | Settings.tsx line 124 inside IntelligenceSettings |
| `src/pages/Briefings.tsx` | `convex/briefings.ts` | useQuery(api.briefings.listBriefings) | WIRED | Line 13 of Briefings.tsx via usePaginatedQuery |
| `src/components/LLMProviderConfig.tsx` | `convex/briefings.ts` | useMutation(api.briefings.setLLMConfig) | WIRED | Line 17 of LLMProviderConfig.tsx |
| `convex/anomalyDetection.ts` | alert creation + webhookDelivery | ctx.db.insert("alerts") + scheduler | WIRED | Lines 94-123 of anomalyDetection.ts |
| `src/components/AnomalyBadge.tsx` | `convex/anomalyDetection.ts` | useQuery(api.anomalyDetection.getActiveAnomalies) | WIRED | Analytics.tsx line 36; badge receives data as props |
| `src/components/MemoryQualityTab.tsx` | `convex/memoryQuality.ts` | useQuery(api.memoryQuality.getLatestQuality) | WIRED | MemoryQualityTab.tsx line 44 |
| `convex/memoryQuality.ts` | `convex/briefings.ts` | internal.briefings.getLLMConfigInternal | WIRED | memoryQuality.ts line 179 |
| `convex/ingest.ts` | `convex/briefings.ts` | internal.briefings.onSessionCompleted | WIRED | ingest.ts lines 107 and 179 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CostForecastPanel.tsx` | `data` (costForecast query) | `aggregates` table via `by_type_period_bucket` index in `forecasts.ts` | Yes — real DB query, last 30 days daily rows | FLOWING |
| `Briefings.tsx` | `results` (listBriefings paginated) | `briefings` table in Convex, ordered by generatedAt desc | Yes — real DB query with pagination | FLOWING |
| `AnomalyBadge.tsx` (via Analytics) | `anomalies` (getActiveAnomalies) | `anomalyEvents` table, last 24h filter | Yes — real DB query | FLOWING |
| `MemoryQualityTab.tsx` | `data` (getLatestQuality) | `memoryQuality` table, most recent row | Yes — real DB query | FLOWING |
| `Memory.tsx` quality stats | `quality` (getLatestQuality) | `memoryQuality` table | Yes — same query as MemoryQualityTab | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 7 test suite passes | `npx vitest run convex/forecasts.test.ts convex/briefings.test.ts convex/anomalyDetection.test.ts convex/memoryQuality.test.ts` | 31 passed, 8 todo (0 failures) | PASS |
| forecasts.ts exports exist | `grep -n "export function computeMovingAverage" convex/forecasts.ts` | Found at line 6 | PASS |
| briefings.ts wired in ingest.ts | `grep "onSessionCompleted" convex/ingest.ts` | Found at lines 107 and 179 | PASS |
| Briefings.tsx static data removed | `grep "AGENT_MAP\|BRIEFING_TEMPLATES" src/pages/Briefings.tsx` | No match — static data deleted | PASS |
| Memory Quality tab added | `grep '"quality"' src/pages/Memory.tsx` | Found in TabId type and tab navigation | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INT-01 | 07-01, 07-02 | Cost forecasting with daily/weekly/monthly predictions and budget threshold alerts | SATISFIED | CostForecastPanel on Analytics, setBudgetCap on Settings, costForecast query from aggregates |
| INT-02 | 07-01, 07-03 | Session briefings are LLM-generated narrative summaries | SATISFIED | generateSessionBriefingAction wired via ingest.ts session_end/Stop events |
| INT-03 | 07-01, 07-03 | Daily digest auto-generates and stores in Convex | SATISFIED | triggerDailyDigest cron, generateDailyDigestAction, Briefings page dynamic feed |
| INT-04 | 07-01, 07-04 | Anomaly detection with visual indicators on dashboard widgets | SATISFIED | evaluateInternal z-score cron, AnomalyBadge on Analytics MetricCards |
| INT-05 | 07-03 | Activity changelog auto-generates from events | SATISFIED | groupActivityEvents rule-based event grouping used in both session briefings and daily digest |
| INT-06 | 07-03 | Ideation briefings woven into daily digest | SATISFIED | getDailyDigestDataInternal queries ideationFindings table; findings included in LLM prompt context |
| INT-07 | 07-05 | Memory quality metrics: deduplication rate, contradiction resolution, staleness | SATISFIED | evaluateInternal computes dedup/staleness; detectContradictionsAction uses LLM; Memory page Quality tab with StatCards |

**Note on REQUIREMENTS.md:** INT-05, INT-06, and INT-07 appear in ROADMAP.md Phase 7 requirements and VALIDATION.md but are absent from REQUIREMENTS.md (which only defines INT-01 through INT-04). REQUIREMENTS.md was not updated when Phase 7 planning expanded the requirement set. The implementations are present and correct per ROADMAP.md. REQUIREMENTS.md traceability also incorrectly maps INT-01 through INT-04 to "Phase 5" when Phase 7 is the correct phase. This is a documentation maintenance issue, not an implementation gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/LLMProviderConfig.tsx` | 95, 105 | HTML `placeholder` attributes | Info | Input placeholder text — not a stub, correct UI affordance |
| `convex/briefings.test.ts` | 62-67 | 6 remaining `test.todo` stubs | Info | Mutation-level tests requiring Convex runtime mocking; pure function tests (5) all pass; acceptable per plan design |
| `convex/anomalyDetection.test.ts` | 59-60 | 2 remaining `test.todo` stubs | Info | Mutation-level tests; 11 pure function tests pass; acceptable per plan design |

No blocker anti-patterns found. No hardcoded empty returns or unconnected data paths identified.

### Human Verification Required

**1. LLM Session Briefing Generation**

**Test:** Complete a session in Astridr, then open the Briefings page in CodePulse.
**Expected:** A SESSION-type briefing card appears showing a coherent 2-3 paragraph narrative covering what was accomplished, key decisions, and any anomalies. Clicking the card expands to show the full narrative.
**Why human:** Requires a live Convex deployment with a configured LLM provider API key; LLM output quality and narrative coherence cannot be verified statically.

**2. Daily Digest Generation**

**Test:** Wait for 06:00 UTC cron or trigger manually; open Briefings page.
**Expected:** A DIGEST-type entry appears with activity summary, total spend, anomaly count, and a mention of ideation findings if any exist. Past digests are browsable with date filter.
**Why human:** Requires live Convex environment; cron scheduling and LLM call chain cannot be invoked statically.

**3. CostForecastPanel Visual Rendering**

**Test:** Open Analytics page with at least 3 days of cost aggregate data in Convex.
**Expected:** CostForecastPanel renders three stat boxes with dollar values, a budget progress bar in the correct color, and a 7-bar sparkline. If fewer than 3 days of data, "Insufficient data for forecast" message appears instead.
**Why human:** Requires real aggregate data to be present; visual layout and chart rendering must be confirmed in browser.

**4. Budget Cap and LLM Provider Settings**

**Test:** Open Settings page and use the Intelligence section to (a) set a monthly budget cap and save it, and (b) configure a primary LLM provider with API key and click Save Provider Config.
**Expected:** Budget cap persists on page refresh (read back from Convex). LLM provider shows "Saving..." then "Saved" for 2 seconds. Remove Provider shows confirmation dialog with correct copy.
**Why human:** Save state transitions, optimistic UI, and dialog behavior require live interaction and a running Convex backend.

**5. Memory Quality Tab Rendering**

**Test:** Open Memory page and click the Quality tab.
**Expected:** Three StatCards (Dedup Rate, Stale Memories, Contradictions) appear. Three accordion sections (Duplicate Flags, Stale Memories, Contradictions) are visible. Empty state "No quality issues detected" appears when no quality evaluation has run yet.
**Why human:** Visual tab rendering, accordion toggle behavior, and empty state display must be confirmed in browser.

**6. AnomalyBadge on MetricCards**

**Test:** With at least one anomalyEvents row in Convex (requires the evaluateInternal cron to have fired and detected an anomaly), open the Analytics page.
**Expected:** A WARN or ANOMALY badge appears inline next to the affected MetricCard (Total Cost or Total Events). Hovering the badge shows a tooltip with the metric name, current value, expected mean, and z-score.
**Why human:** Requires anomaly data to exist; visual badge rendering and tooltip hover must be confirmed in browser.

### Gaps Summary

No implementation gaps found. All 7 observable truths are verified by codebase evidence:
- All required Convex functions exist and are substantive (not stubs)
- All UI components are wired to live queries (not hardcoded data)
- All key links (cron→handler, component→query, component→mutation) are confirmed
- Data flows from real database tables in all cases
- Test suite passes (31 tests, 8 acceptable todos for mutation-level Convex tests)

The 6 human verification items listed above are required to confirm visual rendering, LLM output quality, and save/interaction flows that cannot be verified statically.

---

_Verified: 2026-04-14T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
