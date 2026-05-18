# Technology Stack — CodePulse v5.0 Additions

**Project:** CodePulse v5.0 Advanced Visualization & Integrations
**Researched:** 2026-05-16
**Scope:** NEW additions only. Existing stack (React 19, Vite 7, TypeScript 5.9, Tailwind 4, Convex, shadcn/ui, React Flow, motion, dnd-kit, Sonner) is validated and unchanged.

---

## Critical Pre-Research Finding

`recharts` **is already installed at ^3.8.0** and used in `src/components/hr/`. Recharts v3 ships a native `SunburstChart` component. This eliminates the need for D3.js entirely for the token sunburst feature. Do not add D3 — recharts already covers this.

---

## Core Additions

### 1. Visualization — Token Sunburst (VIZ-03)

**Use: `recharts` (already installed, ^3.8.0)**

Recharts v3 added `SunburstChart` natively. It accepts hierarchical `{ name, value, children }` data matching exactly how token consumption is structured (agent → tool → call). No new package required — just use the component that's already bundled.

Why not D3 directly: D3 requires manual SVG management and React reconciliation workarounds. Recharts wraps D3 internally and integrates with React's render cycle. The project already paid the bundle cost for recharts — use it.

Why not visx: visx is lower-level than recharts (requires composing D3 primitives manually) and would be a third charting abstraction on top of the existing custom flex charts + recharts. Not worth it.

**Data shape for SunburstChart:**
```ts
type SunburstNode = {
  name: string;
  value?: number;       // leaf token count
  children?: SunburstNode[];
};
// Root: { name: "Total", children: [{ name: "agent-A", children: [{ name: "tool-X", value: 420 }] }] }
```

**Version:** Already at ^3.8.0 — no install needed.

---

### 2. Visualization — Call Graph (VIZ-01)

**Use: `@xyflow/react` (already installed, ^12.10.1)**

React Flow is already installed for the RunTimeline DAG. The call graph (integration dependencies + error propagation) is the same problem domain — directed graph with nodes and edges. Use React Flow's existing `useNodesState`/`useEdgesState` hooks and add a dedicated `CallGraphView` component.

Why not D3 force simulation: D3 force layouts require manual DOM management and fight React. React Flow handles node positioning, pan/zoom, edge routing, and interaction out of the box. The project already uses it — leverage it.

Why not a new graph library (Cytoscape.js, Sigma.js): Adding a second graph library when React Flow already solves the problem is unjustifiable bundle bloat.

For call graph layout specifically, use `dagre` (already installed at ^0.8.5) for hierarchical left-to-right layout — the same layout algorithm already used in RunTimeline.

**No new packages needed for VIZ-01.**

---

### 3. Visualization — Context Window Growth Animation (VIZ-02)

**Use: `recharts` `AreaChart` + `motion` (both already installed)**

Real-time context window growth is a time-series line/area chart where new data points arrive via WebSocket and animate in. This is exactly what recharts `AreaChart` + `LineChart` do, already used in `hr/` components. Use `isAnimationActive` prop on recharts series for smooth updates.

For the "growth/shrink" emphasis (context filling up, then compressing on summarization), use `motion` (Framer Motion, already at ^12.38.0) to animate a fill-bar overlay on top of the recharts chart — a thin progress-bar-style indicator showing % of context window used, animating between values.

**No new packages needed for VIZ-02.**

---

### 4. Email Digest Delivery (EXT-01)

**Add: `resend` npm package**

Resend is the correct choice for Convex-based email delivery. Resend has an official Convex integration page (`resend.com/convex`) documenting exactly this pattern. Convex actions use the Fetch API natively (no Node.js `nodemailer` compatibility layer needed), and Resend's SDK uses fetch internally, making it compatible with Convex's runtime without any shims.

Why not Nodemailer: Nodemailer requires Node.js net/tls modules unavailable in Convex's V8 isolate runtime. It would require a Node.js action (slower cold starts) and SMTP credential management. Resend is fetch-based and works in Convex's default runtime.

Why not SendGrid: Resend has better DX (React Email templates), simpler API, and an explicit Convex integration guide. SendGrid works but requires more boilerplate.

Why not Postmark: Same fetch compatibility, but less React-ecosystem alignment and no Convex-specific docs.

**Implementation pattern:**
```ts
// convex/actions/emailDigest.ts (Convex action)
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendDigest = action({
  handler: async (ctx, args) => {
    await resend.emails.send({
      from: "codepulse@yourdomain.com",
      to: args.recipientEmail,
      subject: "Ástríðr Daily Digest",
      html: args.htmlBody,  // rendered server-side from digest data
    });
  },
});
```

Schedule via Convex cron (`convex/crons.ts`) — no new scheduler needed, the project already has cron management infrastructure.

**Install:** `npm install resend`
**Version:** ^4.x (current stable as of 2026)

---

### 5. PagerDuty Integration (EXT-02)

**Use: native `fetch` in Convex action — no SDK**

PagerDuty's Events API v2 is a simple REST endpoint (`https://events.pagerduty.com/v2/enqueue`). It accepts a JSON POST with `routing_key`, `event_action`, `payload`, and optional `dedup_key`. No SDK is justified for a two-field POST — adding `@pagerduty/pdjs` (~800KB) for what is a 15-line fetch call is not warranted.

Why not the official PagerDuty JS SDK (`@pagerduty/pdjs`): It's large, designed for full REST API management (services, escalation policies, users), and brings in unnecessary dependencies for what CodePulse needs — just triggering/resolving incidents via Events API v2.

**Implementation pattern:**
```ts
// convex/actions/pagerduty.ts
export const triggerIncident = action({
  handler: async (ctx, { routingKey, summary, severity, dedupKey }) => {
    const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: "trigger",
        dedup_key: dedupKey,
        payload: {
          summary,
          severity, // "critical" | "error" | "warning" | "info"
          source: "codepulse",
        },
      }),
    });
    if (!res.ok) throw new Error(`PagerDuty error: ${res.status}`);
  },
});
```

Store `routing_key` in Convex config table (already exists) or environment variable. Auto-resolve incidents by calling with `event_action: "resolve"` and matching `dedup_key`.

**No new packages needed for EXT-02.**

---

### 6. GitHub Actions Trigger (EXT-03)

**Use: native `fetch` in Convex action — no SDK**

GitHub's REST API `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches` triggers a workflow via `workflow_dispatch` event. This requires a GitHub PAT with `repo` scope (or fine-grained token with Actions write). Like PagerDuty, this is a single authenticated POST — no SDK justified.

Why not `@octokit/rest` or `@octokit/core`: Octokit is designed for broad GitHub API coverage. Adding it for one endpoint is ~150KB of unnecessary bundle in the Convex action bundle. The fetch call is 10 lines.

**Implementation pattern:**
```ts
// convex/actions/githubActions.ts
export const triggerWorkflow = action({
  handler: async (ctx, { owner, repo, workflowId, ref, inputs }) => {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PAT}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref, inputs }),
      }
    );
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  },
});
```

Store PAT, owner, repo, and workflow IDs in Convex config table or environment variables. Surface these as configurable fields in the existing Config Editor (already built in v4.0 Phase 4).

**No new packages needed for EXT-03.**

---

## Summary: What to Install

| Package | Version | Feature | Reason |
|---------|---------|---------|--------|
| `resend` | ^4.x | EXT-01 email digest | Only addition needed — fetch-based, official Convex integration |

That's it. One package.

---

## Supporting Library Notes

### Convex Action Retrier (optional, not required at start)

If email or PagerDuty delivery reliability becomes an issue, `@convex-dev/action-retrier` provides automatic exponential backoff for failed actions. Available as `npm install @convex-dev/action-retrier`. Do not add upfront — add when a specific reliability requirement surfaces.

### react-email (defer)

Resend pairs well with `react-email` for building HTML email templates as React components. This is a nice-to-have for richer digest formatting but not required for v5.0 — raw HTML string templates are sufficient to ship. Add in a follow-on phase if email formatting becomes a priority.

---

## Don't Add

| Library | Why Not |
|---------|---------|
| `d3` / `d3-force` | recharts already installed, covers sunburst; React Flow covers call graph |
| `@visx/hierarchy` | Third charting abstraction on top of existing recharts — not justified |
| `cytoscape` / `sigma.js` | Second graph library when React Flow already handles call graphs |
| `nodemailer` | Incompatible with Convex V8 isolate runtime (requires Node.js net/tls) |
| `@pagerduty/pdjs` | ~800KB SDK for a 15-line Events API v2 POST |
| `@octokit/rest` | ~150KB for one `workflow_dispatch` endpoint — raw fetch is sufficient |
| `apache-echarts` / `echarts-for-react` | Heavy (~1MB), recharts already covers every needed chart type |
| `react-email` | Nice-to-have for digest templates, defer past v5.0 |

---

## Integration Points with Existing Stack

- **Recharts SunburstChart + AreaChart** integrate directly into React components — same import pattern as existing `hr/` charts. Use `useQuery` from Convex to feed data, same as current analytics pages.
- **React Flow call graph** reuses the existing `dagre` layout helper pattern from RunTimeline. Create a new `CallGraphView` page/component following the same node/edge schema.
- **Convex actions for email/PD/GH** trigger from the existing alert rule engine (v4.0 Phase 6). The alert delivery system already has a webhook dispatch pattern — add action dispatch alongside it.
- **Resend API key** stored as Convex environment variable (`RESEND_API_KEY`), same pattern as existing LLM API keys.
- **GitHub PAT + PagerDuty routing key** stored in Convex environment variables. Optionally surface in existing Config Editor UI for operator self-service.
- **Email digest scheduling** uses Convex crons (`convex/crons.ts`) — infrastructure already exists from v4.0 briefings cron.
- **Context window animation** feeds from WebSocket telemetry already flowing through `AstridrWSContext`. Subscribe to context-window-growth events, pipe into recharts `AreaChart` with live data appended to state.

---

## Sources

- Recharts SunburstChart API: https://recharts.github.io/en-US/api/SunburstChart
- Resend + Convex official integration: https://resend.com/convex
- Convex Actions (fetch-based HTTP calls): https://docs.convex.dev/functions/actions
- PagerDuty Events API v2: https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgx-send-an-alert-event
- GitHub Actions workflow dispatch: https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
- Convex Action Retrier component: https://www.npmjs.com/package/@convex-dev/action-retrier (MEDIUM confidence — verified on npm, not tested in this project)
