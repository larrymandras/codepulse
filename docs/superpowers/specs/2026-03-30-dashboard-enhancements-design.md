# CodePulse Dashboard Enhancements — Design Spec

**Date:** 2026-03-30
**Status:** Draft
**Scope:** Patterns 2, 5, 7, 8 from Screenpipe research
**Target:** `codepulse`

---

## Overview

Four UX/UI enhancements to CodePulse inspired by Screenpipe's dashboard patterns. Adds pipeline-specific health metrics, subscription batching for performance, a conversation timeline visualization, and a three-tier notification system.

---

## Pattern 2: Pipeline-Specific Health Metrics

### Problem

CodePulse shows aggregate KPIs (HeroStatsBar: sessions, events/hr, error rate) but lacks per-channel and per-provider operational visibility. When Slack goes down or a provider degrades, there's no dedicated view showing which component is affected.

### Design

**New Convex tables:**

`channelHealth`:
```typescript
defineTable({
  channelId: v.string(),        // "telegram" | "slack" | "web" | "email" | "voice"
  status: v.string(),           // "healthy" | "degraded" | "down"
  messagesLastHour: v.float64(),
  avgResponseMs: v.float64(),
  errorCount: v.float64(),
  lastMessageAt: v.float64(),
  details: v.optional(v.any()),
  timestamp: v.float64(),
}).index("by_channel", ["channelId"])
  .index("by_timestamp", ["timestamp"]),
```

`providerHealth`:
```typescript
defineTable({
  providerName: v.string(),     // "anthropic_direct" | "openrouter" | "ollama"
  state: v.string(),            // "closed" | "open" | "half_open"
  latencyEmaMs: v.float64(),
  successRate: v.float64(),
  consecutiveFailures: v.float64(),
  lastSuccessAt: v.float64(),
  timestamp: v.float64(),
}).index("by_provider", ["providerName"])
  .index("by_timestamp", ["timestamp"]),
```

**Ástríðr ingest changes:**

Self-healer already runs health checks every 30s. Add a 60-second periodic telemetry emit:

```python
# In self_healing.py monitoring loop
telemetry.emit("channel_health", {
    "channelId": component.channel_id,
    "status": "healthy" if healthy else "degraded",
    "messagesLastHour": channel.message_count_last_hour,
    "avgResponseMs": channel.avg_response_ms,
    "errorCount": channel.error_count,
    "lastMessageAt": channel.last_message_at,
})
```

Provider health emitted from `FailoverProvider.provider_health()` (enhanced by Pattern 3 circuit breaker).

**CodePulse ingest routing:**

Existing HTTP ingest at `/ingest` routes events to domain tables. Add handlers:
- `channel_health` → upsert `channelHealth` (latest per channel)
- `provider_health` → upsert `providerHealth` (latest per provider)
- `provider.state_change` → insert `providerHealth` (historical for sparklines)

**New component: `ChannelHealthPanel`**

Location: Infrastructure page, above Docker containers section.

```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│  Telegram   │    Slack    │     Web     │    Email    │    Voice    │
│  ● healthy  │  ● healthy  │  ● healthy  │  ● degraded │  ○ down     │
│  42 msg/hr  │  18 msg/hr  │   7 msg/hr  │   3 msg/hr  │  0 msg/hr   │
│  1.2s avg   │  0.8s avg   │  0.5s avg   │  4.1s avg   │  —          │
│  last: 2m   │  last: 5m   │  last: 12m  │  last: 1h   │  last: —    │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

- Status dot: green (healthy), yellow (degraded), red (down), gray (no data)
- Click card → expand to show error log + message volume sparkline
- Responsive: 5-col desktop → 3-col tablet → 1-col mobile

**Enhanced `ProviderHealthPanel`**

Location: Infrastructure page, below channel health.

```
┌──────────────────┬──────────────────┬──────────────────┐
│ anthropic_direct │   openrouter     │     ollama       │
│ ● closed (ok)   │ ◐ half_open      │ ● closed (ok)    │
│ 97% success     │ 82% success      │ 100% success     │
│ 1.2s latency    │ 3.4s latency     │ 0.3s latency     │
│ ▁▂▃▂▁▂▃▂▁▂     │ ▁▂▅█▅▂▁▁▂▃      │ ▁▁▁▁▁▁▁▁▁▁      │
└──────────────────┴──────────────────┴──────────────────┘
```

- Circuit breaker state as colored icon: closed=green, half_open=yellow, open=red
- Latency sparkline (last 30 minutes, 1-min buckets)
- Success rate percentage with trend arrow

**New hooks:**
- `useChannelHealth()` → `useQuery(api.channelHealth.latest)`
- `useProviderHealth()` → `useQuery(api.providerHealth.latest)`

### Files Changed

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `channelHealth`, `providerHealth` tables |
| `convex/channelHealth.ts` | New — queries + ingest mutation |
| `convex/providerHealth.ts` | New — queries + ingest mutation |
| `convex/ingest.ts` | Route `channel_health`, `provider_health` events |
| `src/hooks/useChannelHealth.ts` | New hook |
| `src/hooks/useProviderHealth.ts` | New hook |
| `src/components/ChannelHealthPanel.tsx` | New component |
| `src/components/ProviderHealthPanel.tsx` | Enhanced component |
| `src/pages/Infrastructure.tsx` | Add new panels |

---

## Pattern 5: Convex Subscription Batching

### Problem

Convex queries auto-re-execute when dependent data changes. High-frequency telemetry (events at 10+/sec during active sessions) causes excessive React re-renders. HeroStatsBar with 8 KPIs re-computes and re-renders on every event insert.

### Design

**New hook: `src/hooks/useThrottledQuery.ts`**

```typescript
import { useQuery } from "convex/react";
import { useState, useEffect, useRef } from "react";

export function useThrottledQuery<T>(
  queryFn: any,
  args: any,
  intervalMs: number = 500
): T | undefined {
  const raw = useQuery(queryFn, args);
  const [throttled, setThrottled] = useState(raw);
  const lastUpdate = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdate.current >= intervalMs) {
      setThrottled(raw);
      lastUpdate.current = now;
    } else {
      const remaining = intervalMs - (now - lastUpdate.current);
      const timer = setTimeout(() => {
        setThrottled(raw);
        lastUpdate.current = Date.now();
      }, remaining);
      return () => clearTimeout(timer);
    }
  }, [raw, intervalMs]);

  return throttled;
}
```

**Apply throttling:**

| Hook | Throttle | Reason |
|------|----------|--------|
| `useHeroStats()` | 1000ms | KPIs don't need sub-second updates |
| `useRecentEvents()` | 500ms | Event feed, moderate update frequency |
| `usePulseChart()` | 2000ms | Chart re-draw is expensive |
| `useChannelHealth()` | 5000ms | Health data updates every 60s from Ástríðr |
| `useProviderHealth()` | 5000ms | Same |
| `useAlertCounts()` | **unthrottled** | Urgency matters |
| `useAlerts()` | **unthrottled** | Alert list needs immediate updates |

**React.memo wrapping:**

Add `React.memo()` to pure display components that receive data via props:
- `MetricCard` — receives single metric, no internal state
- `Sparkline` — receives data array, pure render
- `ComponentHealthGrid` — receives health map, pure render
- `ChannelHealthCard` — new, pure display

**Expected impact:** Re-renders during active telemetry drop from ~20/sec to ~2-4/sec for throttled components.

### Files Changed

| File | Change |
|------|--------|
| `src/hooks/useThrottledQuery.ts` | New utility hook |
| `src/hooks/useHeroStats.ts` | Wrap with 1000ms throttle |
| `src/hooks/useRecentEvents.ts` | Wrap with 500ms throttle |
| `src/hooks/usePulseChart.ts` | Wrap with 2000ms throttle |
| `src/components/MetricCard.tsx` | Wrap with React.memo |
| `src/components/Sparkline.tsx` | Wrap with React.memo |
| `src/components/ComponentHealthGrid.tsx` | Wrap with React.memo |

---

## Pattern 7: Conversation Timeline Visualization

### Problem

CodePulse has `PulseChart` (generic event activity) but no way to visualize **message flow across channels over time**. When debugging "why did the user not get a response?", there's no timeline showing message in → processing → response out.

### Design

**New component: `ConversationTimeline`**

Placement: Dashboard page, new tab alongside PulseChart.

**Layout:**
```
[1h] [6h] [24h] [7d]                              ← zoom controls
─────────────────────────────────────────────────── ← time axis
Telegram  ▪▪▪  ▪▪    ▪▪▪▪▪▪  ▪▪    ▪              ← message dots
Slack     ▪    ▪▪▪          ▪▪▪▪
Web                   ▪  ▪      ▪▪▪▪▪▪▪▪
Email          ▪                          ▪
Voice                       ▪▪
───────────────────────────────────────────────────
          8am   9am   10am  11am  12pm   1pm        ← time labels
```

**Interactions:**
- Hover dot → tooltip: message preview (first 80 chars), profile, response time (ms)
- Click dot → expand inline: full message text, tool calls, token count
- Zoom buttons: 1h (1-min buckets), 6h (5-min), 24h (15-min), 7d (1-hr)
- Scroll: horizontal pan within selected time range

**Data model:**

New Convex query: `conversationTimeline.buckets`
```typescript
export const buckets = query({
  args: {
    startTime: v.float64(),
    endTime: v.float64(),
    bucketMinutes: v.float64(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db.query("events")
      .withIndex("by_timestamp")
      .filter(q => q.and(
        q.gte(q.field("timestamp"), args.startTime),
        q.lte(q.field("timestamp"), args.endTime),
        q.or(
          q.eq(q.field("eventType"), "message_received"),
          q.eq(q.field("eventType"), "message_sent")
        )
      ))
      .collect();

    // Bucket by channel + time interval
    // Return: { timestamp, channel, inbound, outbound }[]
  }
});
```

**Detail query** (on click): `conversationTimeline.messageDetail`
```typescript
export const messageDetail = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    // Return full event with payload, session info, response time
  }
});
```

**Color scheme per channel** (consistent with ChannelHealthPanel):
```typescript
const channelColors = {
  telegram: "#2AABEE",   // Telegram blue
  slack:    "#4A154B",   // Slack purple
  web:      "#10B981",   // Emerald
  email:    "#F59E0B",   // Amber
  voice:    "#8B5CF6",   // Violet
};
```

**Implementation:** Use Recharts `ScatterChart` with custom dot rendering. Each channel = a Y-axis category. X-axis = time. Dots sized by message count in bucket (1 dot = 1-3 messages, larger = more).

### Files Changed

| File | Change |
|------|--------|
| `convex/conversationTimeline.ts` | New — bucket + detail queries |
| `convex/schema.ts` | Add index on events if needed for time+type filter |
| `src/hooks/useConversationTimeline.ts` | New hook with zoom state |
| `src/components/ConversationTimeline.tsx` | New component |
| `src/pages/Dashboard.tsx` | Add timeline tab alongside PulseChart |

---

## Pattern 8: Three-Tier Notification System

### Problem

CodePulse has persistent alerts (DB records + AlertBanner + Alerts page) + Tone.js audio. Missing: ephemeral toasts for routine events and a notification bell with history for non-critical warnings.

### Design

**Tier 1 — Toast (ephemeral)**

Library: `sonner` (2.1KB gzipped, React 19 compatible, no Radix dependency)

```typescript
// Usage anywhere in the app:
import { toast } from "sonner";

toast.success("Pipe 'morning-briefing' completed");
toast.info("Provider 'openrouter' recovered");
toast.warning("High memory usage detected");
toast.error("Slack channel disconnected");
```

Placement: bottom-right, stack max 3, auto-dismiss 5s.

Events that produce toasts:
- Pipe completed/failed
- Provider state change (recovered or tripped)
- Config reload
- Sync completed
- Session started/ended (if dashboard is open)

**Tier 2 — Notification Bell (persistent, non-critical)**

New header icon next to existing status indicators.

```
┌──────────────────────────────────────────────┐
│  🔔 3                                         │  ← bell icon + unread count
├──────────────────────────────────────────────┤
│  Provider 'openrouter' degraded    2m ago    │
│  Pipe 'overnight-monitor' failed   15m ago   │
│  High error rate (12%)             1h ago    │
│  ─────────── Earlier ───────────             │
│  Provider 'openrouter' recovered   3h ago    │
│  Pipe 'morning-briefing' ok        6h ago    │
├──────────────────────────────────────────────┤
│  Mark all read          Clear all            │
└──────────────────────────────────────────────┘
```

**New Convex table: `notifications`**
```typescript
defineTable({
  type: v.string(),          // "toast" | "bell" | "alert"
  category: v.string(),      // "provider" | "channel" | "pipe" | "security" | "system"
  title: v.string(),
  message: v.string(),
  severity: v.string(),      // "info" | "warning" | "error" | "critical"
  read: v.boolean(),
  createdAt: v.float64(),
  expiresAt: v.optional(v.float64()),
}).index("by_type_read", ["type", "read"])
  .index("by_created", ["createdAt"]),
```

**Notification routing logic** (Convex mutation):

```typescript
function classifyNotification(event: IngestEvent): NotificationType {
  // Critical/error severity → Tier 3 (alert, existing system)
  if (event.severity === "critical" || event.severity === "error") {
    return { type: "alert", ... };
  }
  // Warning severity → Tier 2 (bell)
  if (event.severity === "warning") {
    return { type: "bell", ... };
  }
  // Info severity → Tier 1 (toast only, expires in 1 hour)
  return { type: "toast", expiresAt: now + 3600, ... };
}
```

All notifications also get persisted to the `notifications` table for history. Toasts have a 1-hour TTL. Bell notifications persist until read or 7 days (whichever first). Alerts persist until acknowledged (existing behavior).

**Tier 3 — Alert Banner + Page (enhanced)**

Existing system, two additions:
- **Auto-acknowledge**: Non-critical alerts auto-acknowledged after 24 hours.
- **Alert grouping**: Multiple instances of same `source` within 5 minutes collapsed into one with a count badge. E.g., "Error rate spike (×3)" instead of three separate alerts.

**New components:**
- `NotificationBell` — header dropdown, reads `notifications` where `type="bell"` and `read=false`
- `Toaster` — sonner `<Toaster />` in app root

**Frontend integration:**

```typescript
// In DashboardLayout.tsx or App.tsx
import { Toaster } from "sonner";
import { useNotifications } from "../hooks/useNotifications";

function App() {
  // Subscribe to new notifications and fire toasts
  useNotificationToasts();

  return (
    <>
      <DashboardLayout>
        <NotificationBell />  {/* in header */}
        ...
      </DashboardLayout>
      <Toaster position="bottom-right" richColors />
    </>
  );
}
```

**`useNotificationToasts` hook:**
```typescript
function useNotificationToasts() {
  const latest = useQuery(api.notifications.latestUnread, { type: "toast" });
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!latest) return;
    for (const n of latest) {
      if (!seen.current.has(n._id)) {
        seen.current.add(n._id);
        toast[n.severity === "error" ? "error" : n.severity === "warning" ? "warning" : "success"](n.title, {
          description: n.message,
        });
      }
    }
  }, [latest]);
}
```

### Files Changed

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `notifications` table |
| `convex/notifications.ts` | New — queries, mutations, classification logic |
| `convex/ingest.ts` | Route events through notification classifier |
| `convex/alerts.ts` | Add auto-acknowledge mutation, grouping logic |
| `src/hooks/useNotifications.ts` | New — bell count, latest, mark read |
| `src/hooks/useNotificationToasts.ts` | New — fires toasts from subscription |
| `src/components/NotificationBell.tsx` | New — header dropdown |
| `src/layouts/DashboardLayout.tsx` | Add NotificationBell to header, Toaster to root |
| `src/pages/Alerts.tsx` | Add grouping display, auto-acknowledge indicator |
| `package.json` | Add `sonner` dependency |

---

## Implementation Order

1. **Pattern 5** (subscription batching) — Quick win, improves performance for everything else. No new data model.
2. **Pattern 2** (pipeline health metrics) — New tables + panels. Requires Ástríðr-side telemetry emit (after Group 1 Pattern 3 circuit breaker).
3. **Pattern 8** (notification tiers) — Builds on Pattern 2's health events as notification sources.
4. **Pattern 7** (conversation timeline) — Largest component, uses existing data, independent of other patterns.

## Success Criteria

- Pattern 2: Infrastructure page shows per-channel status cards with live metrics. Provider cards show circuit breaker state.
- Pattern 5: Dashboard re-renders drop from ~20/sec to ~4/sec during active telemetry (measurable via React DevTools Profiler).
- Pattern 7: Dashboard timeline tab shows message dots across 5 channels, zoomable, clickable for detail.
- Pattern 8: Toasts appear for routine events. Bell shows unread count. Alert grouping collapses duplicates.
