# CodePulse Dashboard Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subscription batching, pipeline health metrics, three-tier notifications, and a conversation timeline to CodePulse.

**Architecture:** Four patterns implemented in dependency order. Pattern 5 (throttling) is a pure frontend performance optimization applied first. Pattern 2 (health metrics) adds new Convex tables and React panels. Pattern 8 (notifications) builds on Pattern 2's health events to create toast/bell/alert tiers. Pattern 7 (timeline) is a standalone visualization using existing event data.

**Tech Stack:** Convex 1.17.0 (backend), React 19 (frontend), Recharts 3.7 (charts), TailwindCSS 4 (styling), Vitest + Testing Library (tests), sonner (toasts, new dependency).

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/hooks/useThrottledQuery.ts` | Generic throttle wrapper for Convex `useQuery` |
| `src/hooks/useThrottledQuery.test.ts` | Tests for throttle hook |
| `convex/channelHealth.ts` | Channel health queries + ingest mutation |
| `convex/providerHealth.ts` | Provider health queries + ingest mutation |
| `convex/notifications.ts` | Notification queries, mutations, classification |
| `convex/conversationTimeline.ts` | Timeline bucket + detail queries |
| `convex/__tests__/notifications.test.ts` | Notification classification unit tests |
| `src/hooks/useChannelHealth.ts` | Throttled hook for channel health data |
| `src/hooks/useProviderHealth.ts` | Throttled hook for provider health data |
| `src/hooks/useNotifications.ts` | Bell count, latest, mark-read hooks |
| `src/hooks/useNotificationToasts.ts` | Fires sonner toasts from Convex subscription |
| `src/hooks/useConversationTimeline.ts` | Timeline data + zoom state management |
| `src/components/Sparkline.tsx` | Reusable mini sparkline chart (React.memo) |
| `src/components/ChannelHealthPanel.tsx` | Per-channel health card grid |
| `src/components/ProviderHealthPanel.tsx` | Provider circuit-breaker card grid |
| `src/components/NotificationBell.tsx` | Header dropdown with unread notifications |
| `src/components/ConversationTimeline.tsx` | Multi-channel message timeline |

### Modified Files

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `channelHealth`, `providerHealth`, `notifications` tables |
| `convex/ingest.ts` | Route `channel_health`, `provider_health` events; classify notifications |
| `convex/alerts.ts` | Add auto-acknowledge mutation, alert grouping query |
| `src/hooks/useHeroStats.ts` | Wrap with 1000ms throttle |
| `src/hooks/useRecentEvents.ts` | Wrap with 500ms throttle |
| `src/components/MetricCard.tsx` | Wrap export with React.memo |
| `src/pages/Infrastructure.tsx` | Add ChannelHealthPanel + ProviderHealthPanel |
| `src/pages/Dashboard.tsx` | Add timeline tab alongside PulseChart |
| `src/pages/Alerts.tsx` | Add grouping display, auto-acknowledge indicator |
| `src/layouts/DashboardLayout.tsx` | Add NotificationBell to header, Toaster to root |
| `package.json` | Add `sonner` dependency |

---

## Phase 1: Subscription Batching (Pattern 5)

### Task 1: Create useThrottledQuery Hook

**Files:**
- Create: `src/hooks/useThrottledQuery.ts`
- Test: `src/hooks/useThrottledQuery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useThrottledQuery.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: { heroStats: { summary: "heroStats:summary" } },
}));

import { useQuery } from "convex/react";
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

const mockUseQuery = vi.mocked(useQuery);

describe("useThrottledQuery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseQuery.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns undefined initially when query has no data", () => {
    const { result } = renderHook(() =>
      useThrottledQuery(api.heroStats.summary, {}, 500)
    );
    expect(result.current).toBeUndefined();
  });

  it("passes through first value immediately", () => {
    mockUseQuery.mockReturnValue({ count: 1 });
    const { result } = renderHook(() =>
      useThrottledQuery(api.heroStats.summary, {}, 500)
    );
    expect(result.current).toEqual({ count: 1 });
  });

  it("throttles rapid updates", () => {
    mockUseQuery.mockReturnValue({ count: 1 });
    const { result, rerender } = renderHook(() =>
      useThrottledQuery(api.heroStats.summary, {}, 500)
    );
    expect(result.current).toEqual({ count: 1 });

    // Rapid update at 100ms — should be delayed
    act(() => {
      vi.advanceTimersByTime(100);
    });
    mockUseQuery.mockReturnValue({ count: 2 });
    rerender();
    // Still shows old value (throttled)
    expect(result.current).toEqual({ count: 1 });

    // After remaining 400ms, should update
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toEqual({ count: 2 });
  });

  it("allows update after interval has passed", () => {
    mockUseQuery.mockReturnValue({ count: 1 });
    const { result, rerender } = renderHook(() =>
      useThrottledQuery(api.heroStats.summary, {}, 500)
    );

    // Wait full interval
    act(() => {
      vi.advanceTimersByTime(500);
    });

    mockUseQuery.mockReturnValue({ count: 5 });
    rerender();
    expect(result.current).toEqual({ count: 5 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\mandr\codepulse && npx vitest run src/hooks/useThrottledQuery.test.ts`
Expected: FAIL — module `./useThrottledQuery` not found

- [ ] **Step 3: Write the implementation**

Create `src/hooks/useThrottledQuery.ts`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Users\mandr\codepulse && npx vitest run src/hooks/useThrottledQuery.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/hooks/useThrottledQuery.ts src/hooks/useThrottledQuery.test.ts
git commit -m "feat: add useThrottledQuery hook for subscription batching"
```

---

### Task 2: Apply Throttling to Existing Hooks

**Files:**
- Modify: `src/hooks/useHeroStats.ts`
- Modify: `src/hooks/useRecentEvents.ts`
- Modify: `src/hooks/useHeroStats.test.ts`

- [ ] **Step 1: Update useHeroStats to use throttled query**

Replace the contents of `src/hooks/useHeroStats.ts`:

```typescript
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useHeroStats() {
  return useThrottledQuery(api.heroStats.summary, {}, 1000) ?? {
    activeSessions: 0,
    runningAgents: 0,
    errorRate: 0,
    errorsThisHour: 0,
    eventsThisHour: 0,
    eventSparkline: [],
    activeAlerts: 0,
    criticalAlerts: 0,
    errorAlerts: 0,
    hourlyCost: 0,
    hourlyTokens: 0,
    costSparkline: [],
    knownTools: 0,
    securityEvents: 0,
    health: "green" as const,
  };
}
```

- [ ] **Step 2: Update useHeroStats test mock**

In `src/hooks/useHeroStats.test.ts`, update the mock to also mock `useThrottledQuery`. Replace the existing mock block at the top:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: { heroStats: { summary: "heroStats:summary" } },
}));

// Mock useThrottledQuery to pass through to useQuery
vi.mock("./useThrottledQuery", () => ({
  useThrottledQuery: vi.fn(),
}));

import { useThrottledQuery } from "./useThrottledQuery";
import { useHeroStats } from "./useHeroStats";

const mockUseThrottledQuery = vi.mocked(useThrottledQuery);
```

Then update each test to use `mockUseThrottledQuery` instead of `mockUseQuery`:

```typescript
describe("useHeroStats", () => {
  it("returns sensible defaults when query returns undefined", () => {
    mockUseThrottledQuery.mockReturnValue(undefined);
    const stats = useHeroStats();

    expect(stats.activeSessions).toBe(0);
    expect(stats.runningAgents).toBe(0);
    expect(stats.errorRate).toBe(0);
    expect(stats.errorsThisHour).toBe(0);
    expect(stats.eventsThisHour).toBe(0);
    expect(stats.eventSparkline).toEqual([]);
    expect(stats.activeAlerts).toBe(0);
    expect(stats.criticalAlerts).toBe(0);
    expect(stats.errorAlerts).toBe(0);
    expect(stats.hourlyCost).toBe(0);
    expect(stats.hourlyTokens).toBe(0);
    expect(stats.costSparkline).toEqual([]);
    expect(stats.knownTools).toBe(0);
    expect(stats.securityEvents).toBe(0);
    expect(stats.health).toBe("green");
  });

  it("returns query data when available", () => {
    const mockData = {
      activeSessions: 5,
      runningAgents: 3,
      errorRate: 12.5,
      errorsThisHour: 8,
      eventsThisHour: 150,
      eventSparkline: [10, 20, 30],
      activeAlerts: 2,
      criticalAlerts: 1,
      errorAlerts: 1,
      hourlyCost: 0.0523,
      hourlyTokens: 45000,
      costSparkline: [0.01, 0.02, 0.05],
      knownTools: 12,
      securityEvents: 0,
      health: "yellow" as const,
    };
    mockUseThrottledQuery.mockReturnValue(mockData);
    const stats = useHeroStats();

    expect(stats.activeSessions).toBe(5);
    expect(stats.runningAgents).toBe(3);
    expect(stats.errorRate).toBe(12.5);
    expect(stats.health).toBe("yellow");
    expect(stats.eventSparkline).toEqual([10, 20, 30]);
  });
});
```

- [ ] **Step 3: Update useRecentEvents to use throttled query**

Replace the contents of `src/hooks/useRecentEvents.ts`:

```typescript
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useRecentEvents(limit = 50) {
  const events = useThrottledQuery(api.events.listRecent, { limit }, 500);
  return events ?? [];
}
```

- [ ] **Step 4: Run all affected tests**

Run: `cd C:\Users\mandr\codepulse && npx vitest run src/hooks/`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/hooks/useHeroStats.ts src/hooks/useHeroStats.test.ts src/hooks/useRecentEvents.ts
git commit -m "feat: apply subscription throttling to useHeroStats (1s) and useRecentEvents (500ms)"
```

---

### Task 3: Wrap MetricCard with React.memo

**Files:**
- Modify: `src/components/MetricCard.tsx`

- [ ] **Step 1: Add React.memo wrapper**

Replace the contents of `src/components/MetricCard.tsx`:

```typescript
import { memo } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
}

function MetricCardInner({ label, value, trend }: MetricCardProps) {
  const trendArrow =
    trend === "up" ? "^" : trend === "down" ? "v" : null;
  const trendColor =
    trend === "up"
      ? "text-green-400"
      : trend === "down"
        ? "text-red-400"
        : "text-gray-500";

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-gray-100">{value}</span>
        {trendArrow && (
          <span className={`text-sm font-mono ${trendColor}`}>{trendArrow}</span>
        )}
      </div>
    </div>
  );
}

const MetricCard = memo(MetricCardInner);
export default MetricCard;
```

- [ ] **Step 2: Verify app still compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/components/MetricCard.tsx
git commit -m "perf: wrap MetricCard with React.memo"
```

---

## Phase 2: Pipeline Health Metrics (Pattern 2)

### Task 4: Add Health Tables to Convex Schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add channelHealth and providerHealth tables**

Add the following two table definitions to `convex/schema.ts`, at the end of the schema object (before the closing `});`). Find the last table definition and add after it:

```typescript
  // ============================================================
  // CHANNEL & PROVIDER HEALTH (Pattern 2)
  // ============================================================

  channelHealth: defineTable({
    channelId: v.string(),
    status: v.string(),
    messagesLastHour: v.float64(),
    avgResponseMs: v.float64(),
    errorCount: v.float64(),
    lastMessageAt: v.float64(),
    details: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_channel", ["channelId"])
    .index("by_timestamp", ["timestamp"]),

  providerHealth: defineTable({
    providerName: v.string(),
    state: v.string(),
    latencyEmaMs: v.float64(),
    successRate: v.float64(),
    consecutiveFailures: v.float64(),
    lastSuccessAt: v.float64(),
    timestamp: v.float64(),
  })
    .index("by_provider", ["providerName"])
    .index("by_timestamp", ["timestamp"]),
```

- [ ] **Step 2: Verify schema compiles**

Run: `cd C:\Users\mandr\codepulse && npx convex dev --once`
Expected: Schema pushes successfully (or run `npx tsc --noEmit` in convex/ context)

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/schema.ts
git commit -m "feat: add channelHealth and providerHealth tables to schema"
```

---

### Task 5: Create Channel Health Backend

**Files:**
- Create: `convex/channelHealth.ts`

- [ ] **Step 1: Write channel health queries and mutation**

Create `convex/channelHealth.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    channelId: v.string(),
    status: v.string(),
    messagesLastHour: v.float64(),
    avgResponseMs: v.float64(),
    errorCount: v.float64(),
    lastMessageAt: v.float64(),
    details: v.optional(v.any()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("channelHealth")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        messagesLastHour: args.messagesLastHour,
        avgResponseMs: args.avgResponseMs,
        errorCount: args.errorCount,
        lastMessageAt: args.lastMessageAt,
        details: args.details,
        timestamp: args.timestamp,
      });
    } else {
      await ctx.db.insert("channelHealth", args);
    }
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const channels = ["telegram", "slack", "web", "email", "voice"];
    const results: Record<string, any> = {};

    for (const ch of channels) {
      const record = await ctx.db
        .query("channelHealth")
        .withIndex("by_channel", (q) => q.eq("channelId", ch))
        .order("desc")
        .first();
      if (record) {
        results[ch] = record;
      }
    }

    return results;
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/channelHealth.ts
git commit -m "feat: add channelHealth Convex queries and upsert mutation"
```

---

### Task 6: Create Provider Health Backend

**Files:**
- Create: `convex/providerHealth.ts`

- [ ] **Step 1: Write provider health queries and mutations**

Create `convex/providerHealth.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    providerName: v.string(),
    state: v.string(),
    latencyEmaMs: v.float64(),
    successRate: v.float64(),
    consecutiveFailures: v.float64(),
    lastSuccessAt: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerHealth")
      .withIndex("by_provider", (q) => q.eq("providerName", args.providerName))
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        state: args.state,
        latencyEmaMs: args.latencyEmaMs,
        successRate: args.successRate,
        consecutiveFailures: args.consecutiveFailures,
        lastSuccessAt: args.lastSuccessAt,
        timestamp: args.timestamp,
      });
    } else {
      await ctx.db.insert("providerHealth", args);
    }
  },
});

export const recordStateChange = mutation({
  args: {
    providerName: v.string(),
    state: v.string(),
    latencyEmaMs: v.float64(),
    successRate: v.float64(),
    consecutiveFailures: v.float64(),
    lastSuccessAt: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    // Always insert for historical sparkline data
    await ctx.db.insert("providerHealth", args);
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const providers = ["anthropic_direct", "openrouter", "ollama"];
    const results: Record<string, any> = {};

    for (const p of providers) {
      const record = await ctx.db
        .query("providerHealth")
        .withIndex("by_provider", (q) => q.eq("providerName", p))
        .order("desc")
        .first();
      if (record) {
        results[p] = record;
      }
    }

    return results;
  },
});

export const recentByProvider = query({
  args: {
    providerName: v.string(),
    minutes: v.float64(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() / 1000 - args.minutes * 60;
    const records = await ctx.db
      .query("providerHealth")
      .withIndex("by_provider", (q) => q.eq("providerName", args.providerName))
      .order("desc")
      .take(100);
    return records.filter((r) => r.timestamp >= cutoff);
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/providerHealth.ts
git commit -m "feat: add providerHealth Convex queries and mutations"
```

---

### Task 7: Route Health Events in Ingest

**Files:**
- Modify: `convex/ingest.ts`

- [ ] **Step 1: Add channel_health and provider_health routing**

In `convex/ingest.ts`, add the following block after the `claude_code.api_error` handler (after line 258, before the `return new Response(...)` line):

```typescript
    // ============================================================
    // 10. Ástríðr runtime health events
    // ============================================================

    // channel_health — upsert latest per channel
    if (eventType === "channel_health") {
      await ctx.runMutation(api.channelHealth.upsert, {
        channelId: data.channelId ?? "unknown",
        status: data.status ?? "unknown",
        messagesLastHour: data.messagesLastHour ?? 0,
        avgResponseMs: data.avgResponseMs ?? 0,
        errorCount: data.errorCount ?? 0,
        lastMessageAt: data.lastMessageAt ?? 0,
        details: data.details,
        timestamp,
      });
    }

    // provider_health — upsert latest per provider
    if (eventType === "provider_health") {
      await ctx.runMutation(api.providerHealth.upsert, {
        providerName: data.providerName ?? "unknown",
        state: data.state ?? "unknown",
        latencyEmaMs: data.latencyEmaMs ?? 0,
        successRate: data.successRate ?? 0,
        consecutiveFailures: data.consecutiveFailures ?? 0,
        lastSuccessAt: data.lastSuccessAt ?? 0,
        timestamp,
      });
    }

    // provider.state_change — insert historical record for sparklines
    if (eventType === "provider.state_change") {
      await ctx.runMutation(api.providerHealth.recordStateChange, {
        providerName: data.providerName ?? "unknown",
        state: data.state ?? "unknown",
        latencyEmaMs: data.latencyEmaMs ?? 0,
        successRate: data.successRate ?? 0,
        consecutiveFailures: data.consecutiveFailures ?? 0,
        lastSuccessAt: data.lastSuccessAt ?? 0,
        timestamp,
      });
    }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/ingest.ts
git commit -m "feat: route channel_health and provider_health events in ingest"
```

---

### Task 8: Create Sparkline Component

**Files:**
- Create: `src/components/Sparkline.tsx`

- [ ] **Step 1: Create Sparkline component**

Create `src/components/Sparkline.tsx`:

```tsx
import { memo } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

function SparklineInner({ data, width = 80, height = 24, color = "#6366f1" }: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="inline-block">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeOpacity={0.3} strokeWidth={1} />
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  const drawHeight = height - padding * 2;
  const step = width / (data.length - 1);

  const points = data
    .map((val, i) => {
      const x = i * step;
      const y = padding + drawHeight - ((val - min) / range) * drawHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const Sparkline = memo(SparklineInner);
export default Sparkline;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/components/Sparkline.tsx
git commit -m "feat: add reusable Sparkline component with React.memo"
```

---

### Task 9: Create Health Hooks

**Files:**
- Create: `src/hooks/useChannelHealth.ts`
- Create: `src/hooks/useProviderHealth.ts`

- [ ] **Step 1: Create useChannelHealth hook**

Create `src/hooks/useChannelHealth.ts`:

```typescript
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useChannelHealth() {
  return useThrottledQuery(api.channelHealth.latest, {}, 5000) ?? {};
}
```

- [ ] **Step 2: Create useProviderHealth hook**

Create `src/hooks/useProviderHealth.ts`:

```typescript
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

export function useProviderHealth() {
  return useThrottledQuery(api.providerHealth.latest, {}, 5000) ?? {};
}
```

- [ ] **Step 3: Verify both compile**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/hooks/useChannelHealth.ts src/hooks/useProviderHealth.ts
git commit -m "feat: add useChannelHealth and useProviderHealth hooks (5s throttle)"
```

---

### Task 10: Create ChannelHealthPanel Component

**Files:**
- Create: `src/components/ChannelHealthPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ChannelHealthPanel.tsx`:

```tsx
import { memo } from "react";
import { useChannelHealth } from "../hooks/useChannelHealth";

const channelLabels: Record<string, string> = {
  telegram: "Telegram",
  slack: "Slack",
  web: "Web",
  email: "Email",
  voice: "Voice",
};

const statusConfig: Record<string, { dot: string; label: string }> = {
  healthy: { dot: "bg-green-500", label: "healthy" },
  degraded: { dot: "bg-yellow-500", label: "degraded" },
  down: { dot: "bg-red-500", label: "down" },
};

function formatRelativeTime(epochSec: number): string {
  if (!epochSec) return "—";
  const diff = Math.max(0, Date.now() / 1000 - epochSec);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ChannelHealthPanelInner() {
  const healthData = useChannelHealth();
  const channels = ["telegram", "slack", "web", "email", "voice"];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Channel Health</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {channels.map((ch) => {
          const data = healthData[ch];
          const status = data ? statusConfig[data.status] ?? statusConfig.down : null;

          return (
            <div
              key={ch}
              className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-2 h-2 rounded-full ${status?.dot ?? "bg-gray-600"}`}
                />
                <span className="text-sm font-medium text-gray-200">
                  {channelLabels[ch]}
                </span>
              </div>
              {data ? (
                <div className="space-y-1 text-xs text-gray-400">
                  <div>{Math.round(data.messagesLastHour)} msg/hr</div>
                  <div>{(data.avgResponseMs / 1000).toFixed(1)}s avg</div>
                  <div>last: {formatRelativeTime(data.lastMessageAt)}</div>
                </div>
              ) : (
                <p className="text-xs text-gray-600">No data</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChannelHealthPanel = memo(ChannelHealthPanelInner);
export default ChannelHealthPanel;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/components/ChannelHealthPanel.tsx
git commit -m "feat: add ChannelHealthPanel component with per-channel status cards"
```

---

### Task 11: Create ProviderHealthPanel Component

**Files:**
- Create: `src/components/ProviderHealthPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ProviderHealthPanel.tsx`:

```tsx
import { memo } from "react";
import { useProviderHealth } from "../hooks/useProviderHealth";
import Sparkline from "./Sparkline";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const stateConfig: Record<string, { dot: string; label: string }> = {
  closed: { dot: "bg-green-500", label: "closed (ok)" },
  half_open: { dot: "bg-yellow-500", label: "half_open" },
  open: { dot: "bg-red-500", label: "open (tripped)" },
};

function ProviderCard({ name, data }: { name: string; data: any }) {
  const history = useQuery(api.providerHealth.recentByProvider, {
    providerName: name,
    minutes: 30,
  });

  const latencyData = (history ?? [])
    .sort((a: any, b: any) => a.timestamp - b.timestamp)
    .map((r: any) => r.latencyEmaMs);

  const state = data ? stateConfig[data.state] ?? stateConfig.closed : null;

  return (
    <div className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-2 h-2 rounded-full ${state?.dot ?? "bg-gray-600"}`}
        />
        <span className="text-sm font-medium text-gray-200">{name}</span>
      </div>
      {data ? (
        <div className="space-y-1.5">
          <div className="text-xs text-gray-400">{state?.label}</div>
          <div className="text-xs text-gray-400">
            {Math.round(data.successRate)}% success
          </div>
          <div className="text-xs text-gray-400">
            {(data.latencyEmaMs / 1000).toFixed(1)}s latency
          </div>
          {latencyData.length >= 2 && (
            <Sparkline data={latencyData} width={100} height={20} />
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600">No data</p>
      )}
    </div>
  );
}

function ProviderHealthPanelInner() {
  const healthData = useProviderHealth();
  const providers = ["anthropic_direct", "openrouter", "ollama"];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Provider Health
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {providers.map((p) => (
          <ProviderCard key={p} name={p} data={healthData[p]} />
        ))}
      </div>
    </div>
  );
}

const ProviderHealthPanel = memo(ProviderHealthPanelInner);
export default ProviderHealthPanel;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/components/ProviderHealthPanel.tsx
git commit -m "feat: add ProviderHealthPanel with circuit breaker state and sparklines"
```

---

### Task 12: Add Health Panels to Infrastructure Page

**Files:**
- Modify: `src/pages/Infrastructure.tsx`

- [ ] **Step 1: Add health panels above existing content**

Replace the contents of `src/pages/Infrastructure.tsx`:

```tsx
import OrbitalStatusRings from "../components/OrbitalStatusRings";
import DockerPanel from "../components/DockerPanel";
import SupabasePanel from "../components/SupabasePanel";
import SystemResources from "../components/SystemResources";
import IntegrationHealth from "../components/IntegrationHealth";
import GithubActionsPanel from "../components/GithubActionsPanel";
import CompactionTimeline from "../components/CompactionTimeline";
import ChannelHealthPanel from "../components/ChannelHealthPanel";
import ProviderHealthPanel from "../components/ProviderHealthPanel";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { useSystemResources } from "../hooks/useSystemResources";

export default function Infrastructure() {
  const resourceData = useSystemResources();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Infrastructure</h1>
      <OrbitalStatusRings />
      <SectionErrorBoundary name="Channel Health">
        <ChannelHealthPanel />
      </SectionErrorBoundary>
      <SectionErrorBoundary name="Provider Health">
        <ProviderHealthPanel />
      </SectionErrorBoundary>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DockerPanel />
        <SupabasePanel />
      </div>
      <SystemResources data={resourceData} />
      <IntegrationHealth />
      <SectionErrorBoundary name="GitHub Actions">
        <GithubActionsPanel />
      </SectionErrorBoundary>
      <SectionErrorBoundary name="Compaction Timeline">
        <CompactionTimeline />
      </SectionErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/pages/Infrastructure.tsx
git commit -m "feat: add channel and provider health panels to Infrastructure page"
```

---

## Phase 3: Three-Tier Notification System (Pattern 8)

### Task 13: Add Notifications Table to Schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add notifications table**

Add the following table definition to `convex/schema.ts`, after the `providerHealth` table added in Task 4:

```typescript
  // ============================================================
  // NOTIFICATIONS (Pattern 8)
  // ============================================================

  notifications: defineTable({
    type: v.string(),
    category: v.string(),
    title: v.string(),
    message: v.string(),
    severity: v.string(),
    read: v.boolean(),
    createdAt: v.float64(),
    expiresAt: v.optional(v.float64()),
  })
    .index("by_type_read", ["type", "read"])
    .index("by_created", ["createdAt"]),
```

- [ ] **Step 2: Verify schema pushes**

Run: `cd C:\Users\mandr\codepulse && npx convex dev --once`
Expected: Schema deploys successfully

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/schema.ts
git commit -m "feat: add notifications table to schema"
```

---

### Task 14: Create Notifications Backend

**Files:**
- Create: `convex/notifications.ts`
- Test: `convex/__tests__/notifications.test.ts`

- [ ] **Step 1: Write classification unit test**

Create `convex/__tests__/notifications.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyNotification } from "../notifications";

describe("classifyNotification", () => {
  it("routes critical severity to alert type", () => {
    const result = classifyNotification({
      severity: "critical",
      category: "security",
      title: "Critical event",
      message: "Something critical happened",
    });
    expect(result.type).toBe("alert");
  });

  it("routes error severity to alert type", () => {
    const result = classifyNotification({
      severity: "error",
      category: "provider",
      title: "Provider down",
      message: "Provider failed",
    });
    expect(result.type).toBe("alert");
  });

  it("routes warning severity to bell type", () => {
    const result = classifyNotification({
      severity: "warning",
      category: "channel",
      title: "Channel degraded",
      message: "Slack response time high",
    });
    expect(result.type).toBe("bell");
  });

  it("routes info severity to toast type with 1-hour expiry", () => {
    const result = classifyNotification({
      severity: "info",
      category: "pipe",
      title: "Pipe completed",
      message: "morning-briefing completed",
    });
    expect(result.type).toBe("toast");
    expect(result.expiresAt).toBeDefined();
    // expiresAt should be roughly 1 hour from now
    const now = Date.now() / 1000;
    expect(result.expiresAt!).toBeGreaterThan(now + 3500);
    expect(result.expiresAt!).toBeLessThan(now + 3700);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Users\mandr\codepulse && npx vitest run convex/__tests__/notifications.test.ts`
Expected: FAIL — module `../notifications` has no export `classifyNotification`

- [ ] **Step 3: Write the notifications module**

Create `convex/notifications.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

interface NotificationInput {
  severity: string;
  category: string;
  title: string;
  message: string;
}

interface ClassifiedNotification {
  type: "toast" | "bell" | "alert";
  category: string;
  title: string;
  message: string;
  severity: string;
  expiresAt?: number;
}

export function classifyNotification(input: NotificationInput): ClassifiedNotification {
  const now = Date.now() / 1000;

  if (input.severity === "critical" || input.severity === "error") {
    return {
      type: "alert",
      category: input.category,
      title: input.title,
      message: input.message,
      severity: input.severity,
    };
  }

  if (input.severity === "warning") {
    return {
      type: "bell",
      category: input.category,
      title: input.title,
      message: input.message,
      severity: input.severity,
      expiresAt: now + 7 * 86400, // 7 days
    };
  }

  return {
    type: "toast",
    category: input.category,
    title: input.title,
    message: input.message,
    severity: input.severity,
    expiresAt: now + 3600, // 1 hour
  };
}

export const create = mutation({
  args: {
    type: v.string(),
    category: v.string(),
    title: v.string(),
    message: v.string(),
    severity: v.string(),
    expiresAt: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      type: args.type,
      category: args.category,
      title: args.title,
      message: args.message,
      severity: args.severity,
      read: false,
      createdAt: Date.now() / 1000,
      expiresAt: args.expiresAt,
    });
  },
});

export const bellUnread = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_type_read", (q) => q.eq("type", "bell").eq("read", false))
      .order("desc")
      .take(20);
  },
});

export const bellAll = query({
  args: {},
  handler: async (ctx) => {
    const results = await ctx.db
      .query("notifications")
      .withIndex("by_created")
      .order("desc")
      .take(100);
    return results.filter((n) => n.type === "bell" || n.type === "toast");
  },
});

export const latestUnread = query({
  args: { type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notifications")
      .withIndex("by_type_read", (q) => q.eq("type", args.type).eq("read", false))
      .order("desc")
      .take(10);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_type_read", (q) => q.eq("type", "bell").eq("read", false))
      .collect();
    return unread.length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_type_read", (q) => q.eq("type", "bell").eq("read", false))
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    return { marked: unread.length };
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_created")
      .order("desc")
      .take(200);
    const bellAndToast = all.filter((n) => n.type === "bell" || n.type === "toast");
    for (const n of bellAndToast) {
      await ctx.db.delete(n._id);
    }
    return { deleted: bellAndToast.length };
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Users\mandr\codepulse && npx vitest run convex/__tests__/notifications.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/notifications.ts convex/__tests__/notifications.test.ts
git commit -m "feat: add notifications module with classification logic and CRUD"
```

---

### Task 15: Install Sonner and Create Toast Infrastructure

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/hooks/useNotifications.ts`
- Create: `src/hooks/useNotificationToasts.ts`

- [ ] **Step 1: Install sonner**

Run: `cd C:\Users\mandr\codepulse && npm install sonner`

- [ ] **Step 2: Create useNotifications hook**

Create `src/hooks/useNotifications.ts`:

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useBellNotifications() {
  return useQuery(api.notifications.bellUnread) ?? [];
}

export function useAllNotifications() {
  return useQuery(api.notifications.bellAll) ?? [];
}

export function useUnreadCount() {
  return useQuery(api.notifications.unreadCount) ?? 0;
}

export function useNotificationActions() {
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const clearAll = useMutation(api.notifications.clearAll);
  return { markRead, markAllRead, clearAll };
}
```

- [ ] **Step 3: Create useNotificationToasts hook**

Create `src/hooks/useNotificationToasts.ts`:

```typescript
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

export function useNotificationToasts() {
  const latest = useQuery(api.notifications.latestUnread, { type: "toast" });
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!latest) return;
    for (const n of latest) {
      if (!seen.current.has(n._id)) {
        seen.current.add(n._id);
        const toastFn =
          n.severity === "error"
            ? toast.error
            : n.severity === "warning"
              ? toast.warning
              : toast.success;
        toastFn(n.title, { description: n.message });
      }
    }
  }, [latest]);
}
```

- [ ] **Step 4: Verify everything compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/hooks/useNotifications.ts src/hooks/useNotificationToasts.ts package.json package-lock.json
git commit -m "feat: add notification hooks and sonner toast infrastructure"
```

---

### Task 16: Create NotificationBell Component

**Files:**
- Create: `src/components/NotificationBell.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/NotificationBell.tsx`:

```tsx
import { useState, useRef, useEffect } from "react";
import {
  useBellNotifications,
  useUnreadCount,
  useNotificationActions,
} from "../hooks/useNotifications";

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const severityDot: Record<string, string> = {
  critical: "bg-red-500",
  error: "bg-orange-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = useUnreadCount();
  const notifications = useBellNotifications();
  const { markRead, markAllRead, clearAll } = useNotificationActions();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No notifications</p>
            ) : (
              notifications.map((n: any) => (
                <button
                  key={n._id}
                  onClick={() => {
                    markRead({ id: n._id });
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDot[n.severity] ?? "bg-gray-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{n.title}</p>
                      <p className="text-xs text-gray-400 truncate">{n.message}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{relativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 bg-gray-900">
              <button
                onClick={() => markAllRead({})}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Mark all read
              </button>
              <button
                onClick={() => clearAll({})}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/components/NotificationBell.tsx
git commit -m "feat: add NotificationBell dropdown component"
```

---

### Task 17: Integrate Notifications into Layout

**Files:**
- Modify: `src/layouts/DashboardLayout.tsx`

- [ ] **Step 1: Add NotificationBell and Toaster to layout**

In `src/layouts/DashboardLayout.tsx`, add these imports at the top (after existing imports):

```typescript
import { Toaster } from "sonner";
import NotificationBell from "../components/NotificationBell";
import { useNotificationToasts } from "../hooks/useNotificationToasts";
```

In the `DashboardLayout` function body, add the toast hook call right after the existing `useAudioEvents()` call:

```typescript
  useNotificationToasts();
```

In the header's `<div className="flex items-center gap-2">` section, add `<NotificationBell />` before `<PrivacyShield />`:

```tsx
            <NotificationBell />
            <PrivacyShield />
```

At the very end of the returned JSX (before the closing `</div>` of the root), add the Toaster component after the CRT overlay:

```tsx
      {/* Toast Notifications */}
      <Toaster position="bottom-right" richColors visibleToasts={3} />
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/layouts/DashboardLayout.tsx
git commit -m "feat: integrate NotificationBell and Toaster into DashboardLayout"
```

---

### Task 18: Route Notifications Through Ingest

**Files:**
- Modify: `convex/ingest.ts`

- [ ] **Step 1: Add notification classification to health event handlers**

In `convex/ingest.ts`, add this import at the top (after existing imports):

```typescript
import { classifyNotification } from "./notifications";
```

Then, after each health event handler added in Task 7, add notification creation. After the `channel_health` handler block, add:

```typescript
    // Classify channel health changes as notifications
    if (eventType === "channel_health" && (data.status === "degraded" || data.status === "down")) {
      const notification = classifyNotification({
        severity: data.status === "down" ? "error" : "warning",
        category: "channel",
        title: `${data.channelId} channel ${data.status}`,
        message: `Channel ${data.channelId} is ${data.status}. Error count: ${data.errorCount ?? 0}`,
      });
      await ctx.runMutation(api.notifications.create, {
        type: notification.type,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        expiresAt: notification.expiresAt,
      });
    }
```

After the `provider.state_change` handler block, add:

```typescript
    // Classify provider state changes as notifications
    if (eventType === "provider.state_change") {
      const isRecovery = data.state === "closed";
      const notification = classifyNotification({
        severity: data.state === "open" ? "error" : isRecovery ? "info" : "warning",
        category: "provider",
        title: `Provider '${data.providerName}' ${isRecovery ? "recovered" : data.state}`,
        message: `Circuit breaker ${data.state}. Success rate: ${Math.round(data.successRate ?? 0)}%`,
      });
      await ctx.runMutation(api.notifications.create, {
        type: notification.type,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        expiresAt: notification.expiresAt,
      });
    }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/ingest.ts
git commit -m "feat: classify health events into notification tiers via ingest"
```

---

### Task 19: Add Alert Auto-Acknowledge and Grouping

**Files:**
- Modify: `convex/alerts.ts`
- Modify: `src/pages/Alerts.tsx`

- [ ] **Step 1: Add auto-acknowledge mutation to alerts.ts**

In `convex/alerts.ts`, add this mutation after the `dismissAll` mutation:

```typescript
export const autoAcknowledgeStale = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const twentyFourHoursAgo = now - 86400;
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .collect();

    let count = 0;
    for (const a of active) {
      // Auto-acknowledge non-critical alerts older than 24 hours
      if (a.severity !== "critical" && a.createdAt < twentyFourHoursAgo) {
        await ctx.db.patch(a._id, {
          acknowledged: true,
          acknowledgedBy: "auto-acknowledge",
          acknowledgedAt: now,
        });
        count++;
      }
    }
    return { acknowledged: count };
  },
});

export const listActiveGrouped = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .order("desc")
      .take(100);

    // Group alerts by source within 5-minute windows
    const groups: Map<string, { alert: any; count: number }> = new Map();
    for (const a of active) {
      const windowKey = `${a.source}-${Math.floor(a.createdAt / 300)}`;
      const existing = groups.get(windowKey);
      if (existing) {
        existing.count++;
      } else {
        groups.set(windowKey, { alert: a, count: 1 });
      }
    }

    return Array.from(groups.values()).map(({ alert, count }) => ({
      ...alert,
      groupCount: count,
    }));
  },
});
```

- [ ] **Step 2: Update Alerts page to show grouping**

In `src/pages/Alerts.tsx`, add an import for the new grouped query. Add to the existing import from `useAlerts`:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
```

Then inside the `Alerts` component, add:

```typescript
  const groupedAlerts = useQuery(api.alerts.listActiveGrouped) ?? [];
```

In the alert rendering section, where each alert item is rendered (the `filtered.map` block), update the message display to show the group count. Find the line that renders `{a.message}` and replace it with:

```tsx
                    <p className={`text-sm text-gray-200 ${isAcked ? "line-through text-gray-500" : ""}`}>
                      {a.message}
                      {a.groupCount > 1 && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                          x{a.groupCount}
                        </span>
                      )}
                    </p>
```

Also, where the `acknowledgedBy` is "auto-acknowledge", show an indicator. After the "Acknowledged" span, add:

```tsx
                  {isAcked && a.acknowledgedBy === "auto-acknowledge" && (
                    <span className="text-xs text-gray-600 shrink-0">Auto-acknowledged</span>
                  )}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/alerts.ts src/pages/Alerts.tsx
git commit -m "feat: add alert auto-acknowledge (24h) and grouping by source"
```

---

## Phase 4: Conversation Timeline (Pattern 7)

### Task 20: Create Timeline Backend

**Files:**
- Create: `convex/conversationTimeline.ts`

- [ ] **Step 1: Create the timeline query module**

Create `convex/conversationTimeline.ts`:

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

export const buckets = query({
  args: {
    startTime: v.float64(),
    endTime: v.float64(),
    bucketMinutes: v.float64(),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(2000);

    const filtered = events.filter(
      (e) =>
        e.timestamp >= args.startTime &&
        e.timestamp <= args.endTime &&
        (e.eventType === "message_received" || e.eventType === "message_sent")
    );

    const bucketSec = args.bucketMinutes * 60;
    const bucketMap = new Map<string, { timestamp: number; channel: string; inbound: number; outbound: number }>();

    for (const e of filtered) {
      const channel = (e.payload as any)?.channel ?? "unknown";
      const bucketStart = Math.floor(e.timestamp / bucketSec) * bucketSec;
      const key = `${channel}-${bucketStart}`;
      const existing = bucketMap.get(key);

      if (existing) {
        if (e.eventType === "message_received") existing.inbound++;
        else existing.outbound++;
      } else {
        bucketMap.set(key, {
          timestamp: bucketStart,
          channel,
          inbound: e.eventType === "message_received" ? 1 : 0,
          outbound: e.eventType === "message_sent" ? 1 : 0,
        });
      }
    }

    return Array.from(bucketMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  },
});

export const messageDetail = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", event.sessionId))
      .first();

    return {
      ...event,
      sessionStatus: session?.status,
      sessionCwd: session?.cwd,
    };
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add convex/conversationTimeline.ts
git commit -m "feat: add conversationTimeline bucket and detail queries"
```

---

### Task 21: Create Timeline Hook

**Files:**
- Create: `src/hooks/useConversationTimeline.ts`

- [ ] **Step 1: Create the hook with zoom state**

Create `src/hooks/useConversationTimeline.ts`:

```typescript
import { useState, useMemo } from "react";
import { useThrottledQuery } from "./useThrottledQuery";
import { api } from "../../convex/_generated/api";

type ZoomLevel = "1h" | "6h" | "24h" | "7d";

const zoomConfig: Record<ZoomLevel, { hours: number; bucketMinutes: number }> = {
  "1h": { hours: 1, bucketMinutes: 1 },
  "6h": { hours: 6, bucketMinutes: 5 },
  "24h": { hours: 24, bucketMinutes: 15 },
  "7d": { hours: 168, bucketMinutes: 60 },
};

export function useConversationTimeline() {
  const [zoom, setZoom] = useState<ZoomLevel>("6h");

  const { hours, bucketMinutes } = zoomConfig[zoom];
  const now = Date.now() / 1000;
  const startTime = now - hours * 3600;

  const data = useThrottledQuery(
    api.conversationTimeline.buckets,
    { startTime, endTime: now, bucketMinutes },
    2000
  );

  const buckets = useMemo(() => data ?? [], [data]);

  return { buckets, zoom, setZoom };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/hooks/useConversationTimeline.ts
git commit -m "feat: add useConversationTimeline hook with zoom state"
```

---

### Task 22: Create ConversationTimeline Component

**Files:**
- Create: `src/components/ConversationTimeline.tsx`

- [ ] **Step 1: Create the timeline visualization**

Create `src/components/ConversationTimeline.tsx`:

```tsx
import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useConversationTimeline } from "../hooks/useConversationTimeline";

const channelColors: Record<string, string> = {
  telegram: "#2AABEE",
  slack: "#4A154B",
  web: "#10B981",
  email: "#F59E0B",
  voice: "#8B5CF6",
};

const channelOrder = ["telegram", "slack", "web", "email", "voice"];

function formatTime(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type ZoomLevel = "1h" | "6h" | "24h" | "7d";

export default function ConversationTimeline() {
  const { buckets, zoom, setZoom } = useConversationTimeline();

  const chartData = useMemo(() => {
    return buckets.map((b: any) => ({
      x: b.timestamp,
      y: channelOrder.indexOf(b.channel),
      channel: b.channel,
      total: b.inbound + b.outbound,
      inbound: b.inbound,
      outbound: b.outbound,
    }));
  }, [buckets]);

  const zoomLevels: ZoomLevel[] = ["1h", "6h", "24h", "7d"];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">
          Conversation Timeline
        </h2>
        <div className="flex items-center gap-1 bg-gray-900/50 rounded-lg p-0.5">
          {zoomLevels.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                zoom === z
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          No message activity in this time range
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 60 }}>
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[-0.5, 4.5]}
              ticks={[0, 1, 2, 3, 4]}
              tickFormatter={(val: number) => channelOrder[val] ?? ""}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs">
                    <p className="text-gray-200 font-medium">{d.channel}</p>
                    <p className="text-gray-400">{formatTime(d.x)}</p>
                    <p className="text-gray-400">
                      In: {d.inbound} / Out: {d.outbound}
                    </p>
                  </div>
                );
              }}
            />
            <Scatter data={chartData}>
              {chartData.map((entry: any, i: number) => (
                <Cell
                  key={i}
                  fill={channelColors[entry.channel] ?? "#6b7280"}
                  r={Math.min(8, 3 + entry.total)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Channel legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        {channelOrder.map((ch) => (
          <div key={ch} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: channelColors[ch] }}
            />
            <span className="text-xs text-gray-400">{ch}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/components/ConversationTimeline.tsx
git commit -m "feat: add ConversationTimeline scatter chart with zoom controls"
```

---

### Task 23: Add Timeline to Dashboard Page

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Add tab toggle between PulseChart and ConversationTimeline**

Replace the contents of `src/pages/Dashboard.tsx`:

```tsx
import { useState } from "react";
import { useRecentEvents } from "../hooks/useRecentEvents";
import EventFeed from "../components/EventFeed";
import ActiveSessions from "../components/ActiveSessions";
import PulseChart from "../components/PulseChart";
import ConversationTimeline from "../components/ConversationTimeline";
import AgentTopology from "../components/AgentTopology";
import ToolBreakdown from "../components/ToolBreakdown";
import DockerPanel from "../components/DockerPanel";
import LlmProviderPanel from "../components/LlmProviderPanel";
import HeroStatsBar from "../components/HeroStatsBar";
import DriftTimeline from "../components/DriftTimeline";
import ToolExecutionPanel from "../components/ToolExecutionPanel";
import GitActivityWidget from "../components/GitActivityWidget";
import SectionErrorBoundary from "../components/SectionErrorBoundary";

type ChartTab = "pulse" | "timeline";

export default function Dashboard() {
  const events = useRecentEvents(100);
  const [chartTab, setChartTab] = useState<ChartTab>("pulse");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Hero Stats Bar — replaces 3 rows of MetricCards */}
      <SectionErrorBoundary name="Hero Stats">
        <HeroStatsBar />
      </SectionErrorBoundary>

      {/* Activity Charts with Tab Toggle */}
      <SectionErrorBoundary name="Activity Charts">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
          <div className="flex items-center gap-1 p-2 pb-0">
            <button
              onClick={() => setChartTab("pulse")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                chartTab === "pulse"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Activity Pulse
            </button>
            <button
              onClick={() => setChartTab("timeline")}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                chartTab === "timeline"
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              Conversation Timeline
            </button>
          </div>
          <div className="p-0">
            {chartTab === "pulse" ? (
              <PulseChart events={events} />
            ) : (
              <ConversationTimeline />
            )}
          </div>
        </div>
      </SectionErrorBoundary>

      {/* Agent Topology */}
      <SectionErrorBoundary name="Agent Topology">
        <AgentTopology />
      </SectionErrorBoundary>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <SectionErrorBoundary name="Active Sessions">
            <ActiveSessions />
          </SectionErrorBoundary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionErrorBoundary name="Docker">
              <DockerPanel />
            </SectionErrorBoundary>
            <SectionErrorBoundary name="Tool Breakdown">
              <ToolBreakdown events={events} />
            </SectionErrorBoundary>
          </div>
          <SectionErrorBoundary name="Drift Timeline">
            <DriftTimeline />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Tool Executions">
            <ToolExecutionPanel />
          </SectionErrorBoundary>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6">
          <SectionErrorBoundary name="Event Feed">
            <EventFeed />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="LLM Providers">
            <LlmProviderPanel />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Git Activity">
            <GitActivityWidget />
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Run all tests**

Run: `cd C:\Users\mandr\codepulse && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
cd C:\Users\mandr\codepulse
git add src/pages/Dashboard.tsx
git commit -m "feat: add Conversation Timeline tab to Dashboard alongside Activity Pulse"
```

---

## Final Verification

### Task 24: Full Build and Test

- [ ] **Step 1: Run full test suite**

Run: `cd C:\Users\mandr\codepulse && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Run dev build**

Run: `cd C:\Users\mandr\codepulse && npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Verify Convex schema deploys**

Run: `cd C:\Users\mandr\codepulse && npx convex dev --once`
Expected: Schema and functions deploy successfully

- [ ] **Step 5: Final commit if any fixes needed**

Only if previous steps required fixes:

```bash
cd C:\Users\mandr\codepulse
git add -A
git commit -m "fix: address build/test issues from dashboard enhancements"
```
