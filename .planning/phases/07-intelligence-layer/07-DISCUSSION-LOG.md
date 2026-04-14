# Phase 7: Intelligence Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 07-intelligence-layer
**Areas discussed:** Cost Forecasting, Session Briefings & Daily Digest, Anomaly Detection, Memory Quality Metrics

---

## Cost Forecasting

| Option | Description | Selected |
|--------|-------------|----------|
| Simple moving average | 7-day or 14-day moving average projected forward. Easy to compute in Convex cron from daily aggregates. | ✓ |
| Linear regression | Least-squares trend line over recent daily aggregates, extrapolated forward. | |
| You decide | Claude picks the best approach. | |

**User's choice:** Simple moving average
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Manual budget cap | Operator sets monthly budget on Settings page with progress bar visualization. | |
| Auto-calculated baseline | System calculates 'normal' spend baseline from historical data. | |
| Both | Manual budget cap for hard limits + auto-baseline for detecting unexpected changes. | ✓ |

**User's choice:** Both — manual budget cap + auto-calculated baseline
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Analytics page widget | New Cost Forecast panel on Analytics page. | ✓ |
| Dashboard hero card + Analytics detail | Summary on Dashboard + full detail on Analytics. | |
| You decide | Claude picks placement. | |

**User's choice:** Analytics page widget
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Daily + Weekly + Monthly | All three projections shown together. Matches INT-01. | ✓ |
| Monthly only | Just projected monthly spend and budget progress. | |
| You decide | Claude picks. | |

**User's choice:** Daily + Weekly + Monthly
**Notes:** None

---

## Session Briefings & Daily Digest

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI (gpt-4o) | Reuse existing InsightsChat pattern. | |
| Anthropic (Claude) | Different provider, strong at structured analysis. | |
| Configurable | Store LLM provider in Settings. | |
| You decide | Claude picks. | |

**User's choice:** Configurable with primary + backup provider (custom response)
**Notes:** User explicitly wants two provider slots — primary and backup with automatic failover.

| Option | Description | Selected |
|--------|-------------|----------|
| On session end | Convex action triggers when session closes. | ✓ |
| Batch in daily digest | Daily cron summarizes all sessions. | |
| Both | Per-session + daily synthesis. | |

**User's choice:** On session end
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Activity summary + cost + anomalies | Full synthesis: accomplishments, spend vs budget, anomalies, ideation findings. | ✓ |
| Minimal stats only | Just key numbers, no narrative. | |
| You decide | Claude determines detail level. | |

**User's choice:** Activity summary + cost + anomalies
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Timeline feed | Reverse-chronological list, expandable entries, date filter. | ✓ |
| Calendar view | Calendar grid, click day to see briefing. | |
| Split view | Latest digest pinned at top, historical timeline below. | |

**User's choice:** Timeline feed
**Notes:** None

---

## Anomaly Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Z-score / std deviation | Compare against rolling mean ± N std devs. Flag at 2σ (warning) and 3σ (critical). | ✓ |
| Percentage change threshold | Flag when metric changes by more than X% vs previous period. | |
| You decide | Claude picks. | |

**User's choice:** Z-score / standard deviation
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Cost + Errors + Latency | The three pillars from INT-04. All tracked in aggregates table. | ✓ |
| Cost only | Start with just cost anomalies. | |
| All available metrics | Monitor everything in aggregates table. | |

**User's choice:** Cost + Errors + Latency
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Inline badge on affected widget | Small colored badge on MetricCard/chart with tooltip detail. | ✓ |
| Dedicated anomaly panel | Separate panel listing all active anomalies. | |
| Both | Inline badges + summary section on Analytics page. | |

**User's choice:** Inline badge on affected widget
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — auto-create alerts | Anomalies create alerts using Phase 6 infrastructure. Severity from z-score. | ✓ |
| Dashboard only | Visual indicators only, no alerts or webhooks. | |
| You decide | Claude determines integration level. | |

**User's choice:** Yes — auto-create alerts
**Notes:** None

---

## Memory Quality Metrics

| Option | Description | Selected |
|--------|-------------|----------|
| Dedup + Staleness + Contradictions | All three from SC-7. | ✓ |
| Dedup + Staleness only | Skip contradiction detection (complex semantic comparison). | |
| You decide | Claude picks based on available data. | |

**User's choice:** Dedup + Staleness + Contradictions
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| LLM-based comparison | Periodic Convex action sends memory pairs to LLM. Uses same primary/backup config. | ✓ |
| Embedding similarity | Compare embeddings — high similarity + different content = contradiction. | |
| Manual flagging only | No auto-detection, operator flags manually. | |

**User's choice:** LLM-based comparison
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Top stats row + Quality tab | Quality stats in top cards + new Quality tab with detailed breakdowns. | ✓ |
| Inline on existing tabs | Weave indicators into timeline and tiers tabs. | |
| You decide | Claude picks based on layout. | |

**User's choice:** Top stats row + Quality tab
**Notes:** None

---

## Claude's Discretion

- Moving average window size (7-day vs 14-day)
- Z-score rolling window size for anomaly detection
- Session briefing prompt design and context window strategy
- Daily digest cron timing
- Memory contradiction comparison batch size and scheduling frequency
- Staleness threshold default
- Activity changelog event grouping and narrative structure

## Deferred Ideas

None — discussion stayed within phase scope.
