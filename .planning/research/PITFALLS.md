# Domain Pitfalls — CodePulse v5.0 Advanced Visualization & Integrations

**Domain:** Adding D3.js visualizations + external integrations (PagerDuty, GitHub Actions, email) to a running Convex + React 19 + WebSocket dashboard
**Researched:** 2026-05-16
**Stack context:** React 19, Convex (serverless), existing WebSocket, shadcn/ui, single-operator

---

## Critical Pitfalls

### Pitfall 1: D3 and React Both Trying to Own the Same DOM Nodes

**What goes wrong:** React's reconciler and D3's enter/update/exit pattern mutate the same SVG DOM nodes. React "corrects" D3's mutations on re-render, causing flickering, lost elements, and torn state. With React 19 concurrent rendering, this is worse: renders can pause and resume, so D3's synchronous DOM writes happen against a partially-rendered tree.

**Why it happens in this stack:** React 19 concurrent mode (enabled by default) can interrupt renders mid-flight. D3 assumes synchronous DOM ownership. Any `useEffect` that calls `d3.select(ref.current)` and then mutates the DOM will race with React's reconciler if a state update interrupts the render. This will manifest on the call graph and sunburst charts which are updated by live WebSocket data.

**How to prevent it:** Establish a hard boundary — React owns the `<svg>` element itself and nothing inside it; D3 owns all content within. Pattern:
```tsx
const svgRef = useRef<SVGSVGElement>(null);

useEffect(() => {
  const svg = d3.select(svgRef.current);
  svg.selectAll("*").remove(); // always clear before redraw
  // ... D3 rendering logic
  return () => svg.selectAll("*").remove(); // cleanup on unmount
}, [data, dimensions]);

return <svg ref={svgRef} width={width} height={height} />;
```
Never let React render JSX children inside the same `<svg>` that D3 controls. Never use `useSyncExternalStore` with D3-managed nodes — it will trigger tearing detection incorrectly.

**Which phase:** VIZ-01 (call graph), VIZ-02 (context window), VIZ-03 (sunburst) — enforce this pattern from the first visualization phase; retrofitting is painful.

---

### Pitfall 2: Convex useQuery Re-renders Flooding D3 Update Loops

**What goes wrong:** `useQuery` subscriptions trigger a React re-render on every data change pushed over the WebSocket. If the call graph or context window viz is subscribed to a fast-changing query (e.g., real-time token counts), D3's `useEffect` runs on every message. At >10 messages/second this causes continuous DOM teardown and rebuild, making animations jank or freeze entirely.

**Why it happens in this stack:** Convex pushes diffs over its own WebSocket to `useQuery` hooks. Each diff causes a React state update, which re-renders the component, which fires the `useEffect` dependency on `data`, which re-runs D3's full layout computation. The existing bidirectional WebSocket for telemetry compounds this — two update sources can collide.

**How to prevent it:** Decouple the data subscription from the animation frame rate. Buffer incoming data in a `useRef`, flush to D3 via `requestAnimationFrame`:
```tsx
const bufferRef = useRef<DataPoint[]>([]);
const rafRef = useRef<number>(0);

// Store latest data without triggering effect
const liveData = useQuery(api.sessions.activeTokenCounts);
useEffect(() => {
  if (liveData) bufferRef.current = liveData;
}, [liveData]);

// Flush on animation frames independent of React renders
useEffect(() => {
  const tick = () => {
    if (bufferRef.current.length > 0) {
      renderD3Chart(svgRef.current, bufferRef.current);
    }
    rafRef.current = requestAnimationFrame(tick);
  };
  rafRef.current = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafRef.current);
}, []); // empty deps — runs once, reads from ref
```
For context window growth animation (VIZ-02), target 10fps not 60fps — operational data doesn't need 60fps, and it reduces CPU cost by 6x.

**Which phase:** VIZ-02 (context window animation) is highest risk; VIZ-01 and VIZ-03 are lower frequency. Address in whichever visualization phase comes first.

---

### Pitfall 3: Convex Actions Are Not Retried Automatically — External Side Effects Can Be Lost

**What goes wrong:** A Convex action that calls PagerDuty or GitHub's API throws mid-execution (network blip, API rate limit, transient 500). Convex does NOT auto-retry failed actions (unlike mutations which are transactional). The alert is never escalated, the workflow is never triggered, and there is no record of the attempt.

**Why it happens in this stack:** Convex's design: mutations are ACID transactions (auto-retried on conflict), actions are not (they have side effects). The current codebase's webhook delivery (`webhookDelivery.ts`) already uses the correct pattern for Discord/Slack, but the new PagerDuty and GitHub Actions integrations are new code paths where this mistake is easy to make fresh.

**How to prevent it:** Always use the mutation-first scheduling pattern for external calls:
```typescript
// BAD: action called directly from client or cron
export const triggerPagerDuty = action({ handler: async (ctx, args) => {
  await fetch("https://events.pagerduty.com/v2/enqueue", { ... });
}});

// GOOD: mutation records intent + schedules action
export const escalateAlert = mutation({ handler: async (ctx, args) => {
  const jobId = await ctx.db.insert("escalationJobs", {
    alertId: args.alertId, status: "pending", attempts: 0, createdAt: Date.now()
  });
  await ctx.scheduler.runAfter(0, internal.pagerduty.sendEvent, { jobId });
}});

// Action updates job status on success/failure
export const sendEvent = internalAction({ handler: async (ctx, { jobId }) => {
  const job = await ctx.runQuery(internal.escalationJobs.get, { jobId });
  try {
    await fetch("https://events.pagerduty.com/v2/enqueue", { ... });
    await ctx.runMutation(internal.escalationJobs.markDone, { jobId });
  } catch (err) {
    await ctx.runMutation(internal.escalationJobs.markFailed, { jobId, error: String(err) });
    if (job.attempts < 3) {
      await ctx.runMutation(internal.escalationJobs.scheduleRetry, { jobId });
    }
  }
}});
```

**Which phase:** EXT-02 (PagerDuty) and EXT-03 (GitHub Actions) — design the job table and retry loop before writing the first fetch() call.

---

### Pitfall 4: PagerDuty Alert Storms Without dedup_key — Every Anomaly Creates a New Incident

**What goes wrong:** Every triggered alert rule evaluates every 2 minutes (existing cron). Without a stable `dedup_key`, PagerDuty creates a new incident for each evaluation cycle while a condition persists. A sustained high-cost anomaly generates 30 incidents per hour, burning on-call responder attention and potentially hitting PagerDuty's alert volume limits.

**Why it happens in this stack:** The existing alert rule engine generates new alert records on each evaluation where the condition is met. Naively mapping each CodePulse `alertId` to a PagerDuty event without deduplication sends a new trigger on every 2-minute cron tick for a persisting condition.

**How to prevent it:** Use the alert's stable identifier as `dedup_key`. The Events API v2 deduplication groups subsequent events with the same key into the existing open incident. Also implement resolve events when the alert clears:
```typescript
const dedupKey = `codepulse-alert-${alert._id}`; // stable per alert

// Trigger (or re-group into existing incident)
body: JSON.stringify({
  routing_key: process.env.PAGERDUTY_ROUTING_KEY,
  event_action: "trigger",
  dedup_key: dedupKey,
  payload: { summary: alert.message, severity: mapSeverity(alert.severity) }
})

// Resolve when alert.status === "resolved"
body: JSON.stringify({
  routing_key: process.env.PAGERDUTY_ROUTING_KEY,
  event_action: "resolve",
  dedup_key: dedupKey,
})
```
Track the `dedupKey` in the `escalationJobs` table to enable resolve events on alert lifecycle transitions.

**Which phase:** EXT-02 (PagerDuty) — design dedup before writing any Events API calls.

---

### Pitfall 5: GitHub workflow_dispatch Requires the Workflow File to Already Exist on the Target Branch

**What goes wrong:** Triggering a GitHub Actions workflow via `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches` returns HTTP 422 if: (a) the workflow file doesn't have `workflow_dispatch` in its `on:` trigger, or (b) the `ref` parameter points to a branch/tag where the workflow file doesn't exist. Alert-triggered automation fails silently with a confusing 422 that looks like a permissions error.

**Why it happens in this stack:** The GitHub Actions trigger is outbound from a Convex action — there's no test environment where you can verify the workflow exists without actually hitting the API. The Ástríðr repo's workflow files are separately maintained from CodePulse, creating a cross-repo coordination dependency that's easy to overlook during development.

**How to prevent it:** Before shipping EXT-03, verify these prerequisites in the Ástríðr repo:
1. Target workflow file contains `workflow_dispatch:` in the `on:` block
2. The workflow file exists on `main` (or whatever branch CodePulse targets in its config)
3. The PAT/GitHub App token has `Actions: write` scope on the Ástríðr repo

In the Convex action, check the API response status explicitly and store it in the job record:
```typescript
const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
  body: JSON.stringify({ ref: "main", inputs: { alert_id: args.alertId } })
});
if (res.status === 422) {
  // workflow_dispatch not configured or branch missing — surface as config error, not transient
  await ctx.runMutation(internal.githubTriggerJobs.markConfigError, { jobId, status: res.status });
  return; // do NOT retry config errors
}
```

**Which phase:** EXT-03 (GitHub Actions) — cross-repo prerequisite check belongs in the discussion/spec phase before implementation.

---

## Moderate Pitfalls

### Pitfall 6: Email Digest Cron Skipped When Previous Run Takes Too Long

**What goes wrong:** Convex guarantees at most one concurrent run per cron job. If the daily email digest action (`briefings.triggerDailyDigest`) takes longer than expected — e.g., LLM call for briefing generation stalls, or email API is slow — Convex will skip the next scheduled run rather than queue it. The operator misses their digest without any visible error.

**Why it happens in this stack:** The existing `generate-daily-digest` cron at 06:00 UTC calls `internal.briefings.triggerDailyDigest`. For v5.0, this will need to also aggregate data for email formatting and call an email API (Resend/SendGrid). Each added step increases the risk of exceeding the cron's effective budget before the next scheduled run.

**How to prevent it:** Split the cron into two stages: (1) a fast mutation that writes a "digest job" record to a table, and (2) a separate action scheduled from that mutation that does the slow work. The cron itself becomes near-instant (just a DB write), so it never conflicts with itself. Also: set a timeout budget in the action and log skips explicitly.

**Which phase:** EXT-01 (email digest).

---

### Pitfall 7: D3 Sunburst with Live Token Data — SVG Node Count Explodes

**What goes wrong:** Token sunburst shows per-agent/per-tool breakdown. If there are many agents and tools, the sunburst can have hundreds of SVG `<path>` nodes. D3's full re-layout on every data update (which occurs every time `useQuery` fires) causes layout thrash. At 50+ arcs, interaction (hover, click-to-zoom) becomes laggy on lower-end hardware.

**Why it happens in this stack:** D3's partition layout recomputes all arc angles on every call to `d3.hierarchy(data).sum(...).sort(...)`. With Convex pushing real-time token updates, this triggers frequently. The shadcn oklch palette also means hover effects use CSS transitions that compound the repaint cost.

**How to prevent it:** Apply two optimizations:
1. Filter arcs below a minimum angle threshold (`minAngle = 0.01` radians — anything smaller is invisible anyway). This can reduce node count by 50%+ for long-tail tool usage.
2. Throttle data updates to the sunburst to at most once per 5 seconds — token counts don't need sub-second freshness on a breakdown chart.

```tsx
const SUNBURST_UPDATE_INTERVAL = 5000;
const lastUpdateRef = useRef(0);
useEffect(() => {
  const now = Date.now();
  if (now - lastUpdateRef.current < SUNBURST_UPDATE_INTERVAL) return;
  lastUpdateRef.current = now;
  renderSunburst(svgRef.current, data);
}, [data]);
```

**Which phase:** VIZ-03 (token sunburst).

---

### Pitfall 8: React 19 StrictMode Double-Invokes useEffect — D3 Renders Twice in Dev

**What goes wrong:** In development with StrictMode (which React 19 keeps), `useEffect` runs twice on mount — once to set up, once to simulate unmount/remount. D3 initialization that appends nodes without cleaning up first creates duplicate SVG elements (double axes, double paths). This only appears in dev, making it a confusing "works in prod, broken in dev" situation.

**Why it happens in this stack:** React 19 with StrictMode double-invokes effects to help detect missing cleanup. D3's `append()` operations are not idempotent — each call adds new elements regardless of what's already there.

**How to prevent it:** Always start D3 initialization with a full clear of the container, and always return a cleanup function from `useEffect`:
```tsx
useEffect(() => {
  const svg = d3.select(svgRef.current);
  svg.selectAll("*").remove(); // idempotent reset
  // ... build chart
  return () => { svg.selectAll("*").remove(); };
}, [data]);
```
This also covers the React 19 known issue where useEffect cleanup is not called on unmount inside StrictMode with concurrent features in some edge cases (tracked in React issue #36284).

**Which phase:** All VIZ phases — enforce in the first visualization component as a template for subsequent ones.

---

### Pitfall 9: Convex Action 10-Minute Timeout Is Generous but Not Infinite — LLM + Email in One Action Will Hit It

**What goes wrong:** An email digest action that (a) queries Convex for aggregated data, (b) calls an LLM to generate a summary (briefing), and (c) calls an email API to send the message — all sequentially — can easily exceed 10 minutes if the LLM call queues behind other requests. The action dies mid-flight with no email sent.

**Why it happens in this stack:** The existing briefing LLM call (`insightsChat.ts` / `llm.ts`) can take 30-90 seconds under load. Chaining it inside a new email action with additional API calls multiplies the timeout risk. Convex's 10-minute wall clock is the ceiling, not a budget.

**How to prevent it:** Chain via scheduled actions rather than one monolithic action:
- Step 1: Cron fires → mutation creates `emailDigestJob { status: "pending" }`
- Step 2: Mutation schedules `action: generateDigestContent` → calls LLM, writes result back via mutation to job record
- Step 3: On job status change to "content_ready", schedule `action: sendDigestEmail` → calls Resend/SendGrid

Each action does one external call and exits. Total wall time per action stays under 2 minutes even under load.

**Which phase:** EXT-01 (email digest).

---

## Minor Pitfalls

### Pitfall 10: GitHub API Rate Limits Are Per-Token, Not Per-Action

**What goes wrong:** GitHub's REST API allows 5,000 req/hour for PAT tokens and 1,000 req/hour for `GITHUB_TOKEN`. Alert-triggered workflow dispatches consume from this budget. If CodePulse starts alert-storm-triggering GitHub Actions (e.g., many alert rules fire simultaneously), the token hits secondary rate limits (80 content-generating requests/minute) and subsequent dispatches return HTTP 429.

**Prevention:** Store the PAT token in Convex environment variables (not hardcoded). In the dispatch action, check for 429 and store the `Retry-After` header value in the job record — schedule the retry at `Retry-After` seconds, not immediately. Alert rules triggering GitHub Actions should have a per-workflow cooldown enforced at the mutation layer.

**Which phase:** EXT-03 (GitHub Actions).

---

### Pitfall 11: oklch Colors in D3 Require Explicit Color Parsing — d3-color Won't Parse oklch Strings

**What goes wrong:** The existing design system uses `oklch(...)` CSS color values. If D3 color utilities (`d3.color()`, `d3.scaleSequential()` with interpolators) are used to compute arc fills or link colors, they will return `null` for oklch strings because D3's color parser doesn't understand the oklch color space. Affected nodes render as black or transparent.

**Why it happens in this stack:** D3's color module (`d3-color` v3.x) supports sRGB, HSL, Lab, HCL, Cubehelix — not oklch. The shadcn/ui New York theme with `--radius: 0` relies heavily on oklch CSS variables (`--background`, `--primary`, etc.), so pulling theme colors into D3 requires conversion.

**Prevention:** Read oklch values from `getComputedStyle` and pass them as resolved RGB strings to D3, or convert to hex before passing:
```tsx
const primary = getComputedStyle(document.documentElement)
  .getPropertyValue("--primary").trim();
// Use as CSS fill directly on SVG elements via `style` attribute, not via d3.color()
```
Alternatively, maintain a small static color map (`{ node: "#e5e5e5", error: "#ef4444" }`) derived from the oklch palette for use in D3 exclusively.

**Which phase:** All VIZ phases — establish the color resolution pattern in the first chart.

---

### Pitfall 12: Convex crons.ts Is Statically Deployed — New Crons Require a Full Redeploy

**What goes wrong:** Adding a new cron for email digest delivery requires editing `crons.ts` and redeploying the Convex backend. This is a deployment event, not a runtime configuration change. If the operator is testing in production (single-operator setup), there's no staging environment to validate the cron schedule before it fires.

**Prevention:** Use `ctx.scheduler.runAt()` from a mutation for one-off test runs during development — this fires the action immediately without needing a cron entry. Only add to `crons.ts` when the action is validated. The existing pattern in the codebase (crons only schedule `internal.*` actions) is correct — keep it that way.

**Which phase:** EXT-01 (email digest).

---

## Phase-Specific Warning Summary

| Phase | Feature | Highest-Risk Pitfall | Mitigation |
|-------|---------|---------------------|------------|
| VIZ-01 | Call graph | D3/React DOM ownership conflict | Hard SVG boundary; D3 owns all children |
| VIZ-02 | Context window animation | useQuery flood into D3 update loop | RAF buffer pattern; 10fps cap |
| VIZ-03 | Token sunburst | SVG node count explosion | Minimum arc angle filter; 5s throttle |
| All VIZ | All charts | StrictMode double-render | Always return cleanup from useEffect |
| All VIZ | All charts | oklch color parsing | getComputedStyle bridge or static color map |
| EXT-01 | Email digest | Cron skipped / action timeout | Two-stage job pattern; LLM + email in separate actions |
| EXT-02 | PagerDuty | Alert storms without dedup | Stable dedup_key per alert; resolve events on clear |
| EXT-03 | GitHub Actions | 422 on dispatch / rate limits | Pre-verify workflow_dispatch exists; Retry-After handling |
| All EXT | All integrations | Lost external calls (no retry) | Mutation-first scheduling for all external side effects |

## Sources

- [React issue #36284: useEffect cleanup in StrictMode + concurrent](https://github.com/facebook/react/issues/36284)
- [LogRocket: Why third-party integrations break in React 19](https://blog.logrocket.com/why-third-party-integrations-break-react-19-how-future-proof/)
- [Sitepoint: Controlling re-render chaos with high-frequency WebSocket data](https://www.sitepoint.com/streaming-backends-react-controlling-re-render-chaos/)
- [Convex Actions docs](https://docs.convex.dev/functions/actions)
- [Convex Cron Jobs docs](https://docs.convex.dev/scheduling/cron-jobs)
- [PagerDuty Events API v2 dedup_key](https://developer.pagerduty.com/docs/events-api-v2/trigger-events/)
- [GitHub Actions REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub workflow_dispatch docs](https://docs.github.com/en/rest/actions/workflows)
- [Reintech: Optimizing D3 Chart Performance for Large Data Sets](https://reintech.io/blog/optimizing-d3-chart-performance-large-data)
- [Convex: Best-practice for mutation+action](https://discord-questions.convex.dev/m/1211672880119554078)
