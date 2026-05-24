# Phase 70: External Integrations & Call Graph - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/emailDigest.ts` | service | request-response | `convex/webhookDelivery.ts` | exact (same internalAction + log pattern) |
| `convex/pagerdutyDelivery.ts` | service | request-response | `convex/webhookDelivery.ts` | exact (same internalAction + fetch + log pattern) |
| `convex/crons.ts` | config | event-driven | `convex/crons.ts` (self — add entry) | exact |
| `convex/alerts.ts` | service | event-driven | `convex/alerts.ts` (self — modify evaluateInternal) | exact |
| `src/components/CallGraphPanel.tsx` | component | request-response | `src/components/GithubActionsPanel.tsx` + `src/components/ProviderHealthPanel.tsx` | role-match |
| `src/components/EmailDigestSettings.tsx` | component | CRUD | `src/components/NotificationChannels.tsx` | exact |
| `src/components/DeliveryHistoryTab.tsx` | component | CRUD | `src/components/NotificationChannels.tsx` (list display half) | role-match |
| `src/components/AlertRuleForm.tsx` | component | CRUD | `src/components/AlertRuleForm.tsx` (self — add collapsible section) | exact |
| `src/email/DigestEmailTemplate.tsx` | utility | transform | no codebase analog — React Email is new | none |
| `src/pages/Infrastructure.tsx` | component | request-response | `src/pages/Infrastructure.tsx` (self — add section) | exact |
| `src/pages/Settings.tsx` | component | CRUD | `src/pages/Settings.tsx` (self — add section/tab) | exact |

---

## Pattern Assignments

### `convex/emailDigest.ts` (service, request-response)

**Analog:** `convex/webhookDelivery.ts`

**Imports pattern** (lines 1-4):
```typescript
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
```

**Config read pattern via agentConfigs** (lines 17-28 of webhookDelivery.ts — `getChannels`):
```typescript
export const getEmailDigestConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    const enabledRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "email-digest-enabled"))
      .first();
    const scheduleRow = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "email-digest-schedule"))
      .first();
    // recipient from profileConfigs.emailAddress — separate query
    return {
      enabled: (enabledRow?.value as boolean) ?? false,
      schedule: (scheduleRow?.value as string) ?? "daily",
    };
  },
});
```

**Core internalAction pattern** (lines 406-545 of webhookDelivery.ts — `sendAlertWebhook`):
```typescript
export const sendEmailDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Guard: env var present
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.deliveryLogs.insertEmailLog, {
        ruleId: "digest",
        attempt: 1,
        status: "failed",
        errorMessage: "RESEND_API_KEY not configured",
        sentAt: Date.now() / 1000,
      });
      return;
    }
    // 2. Load config via ctx.runQuery(internal.emailDigest.getEmailDigestConfig, {})
    // 3. Load digest data via ctx.runQuery(internal.briefings.getDailyDigestDataInternal, {...})
    // 4. Render template: const html = await render(<DigestEmailTemplate {...data} />)
    // 5. Send: const { data: sendData, error } = await resend.emails.send({...})
    // 6. Log: await ctx.runMutation(internal.deliveryLogs.insertEmailLog, {...})
  },
});
```

**Upsert agentConfigs pattern** (lines 37-65 of webhookDelivery.ts — `setChannel`):
```typescript
// Pattern for saving email-digest-enabled / email-digest-schedule
const existing = await ctx.db
  .query("agentConfigs")
  .withIndex("by_key", (q) => q.eq("configKey", configKey))
  .first();
if (existing) {
  await ctx.db.patch(existing._id, { value: args.value, updatedAt: Date.now() / 1000 });
} else {
  await ctx.db.insert("agentConfigs", {
    configKey,
    value: args.value,
    updatedAt: Date.now() / 1000,
  });
}
```

**Error handling pattern** (lines 508-543 of webhookDelivery.ts):
```typescript
try {
  // external call
  success = true;
} catch (e: any) {
  deliveryError = e.message ?? String(e);
}
// After try/catch: log status, do NOT rethrow — cron must not die
await ctx.runMutation(internal.deliveryLogs.insertEmailLog, {
  ruleId: "digest",
  attempt: 1,
  status: deliveryError ? "failed" : "success",
  errorMessage: deliveryError,
  sentAt: Date.now() / 1000,
});
```

**Schema constraint note:** `deliveryLogs.ts` line 10 shows `alertId: v.id("alerts")` is required. Wave 0 must patch schema to `v.optional(v.id("alerts"))` and update `insertEmailLog` mutation before this action can run. See RESEARCH.md Pitfall 1.

---

### `convex/pagerdutyDelivery.ts` (service, request-response)

**Analog:** `convex/webhookDelivery.ts`

**Imports pattern** (lines 1-4 of webhookDelivery.ts):
```typescript
import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
```

**Core internalAction pattern — trigger** (modeled on `sendAlertWebhook` lines 406-545):
```typescript
export const sendPagerdutyAlert = internalAction({
  args: {
    alertId: v.id("alerts"),
    ruleId: v.string(),
    attempt: v.float64(),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.runQuery(internal.alerts.getById, { id: args.alertId });
    if (!alert) return;
    // Load rule to get pagerdutyConfig
    const rule = await ctx.runQuery(internal.alertRuleCustom.getById, { id: args.ruleId });
    if (!rule?.pagerdutyConfig?.enabled) return;  // skip if not configured
    if (!rule.pagerdutyConfig.routingKey) return;  // skip if routing key missing

    const ENDPOINT = "https://events.pagerduty.com/v2/enqueue";  // hardcoded per security section
    const sentAt = Date.now() / 1000;

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_key: rule.pagerdutyConfig.routingKey,
          event_action: "trigger",
          dedup_key: `codepulse-${args.ruleId}`,  // D-05
          payload: {
            summary: alert.message.slice(0, 1024),
            source: "CodePulse",
            severity: rule.pagerdutyConfig.severity ?? alert.severity,  // D-06
            timestamp: new Date(alert.createdAt * 1000).toISOString(),
            component: rule.name,
            group: "codepulse-alerts",
          },
        }),
      });
      const status = res.ok ? "success" : "failed";
      const errorMessage = res.ok ? undefined : `HTTP ${res.status}`;
      await ctx.runMutation(internal.deliveryLogs.insertPagerdutyLog, {
        alertId: args.alertId,
        ruleId: args.ruleId,
        attempt: args.attempt,
        status,
        errorMessage,
        dedupKey: `codepulse-${args.ruleId}`,
        action: "trigger",
        sentAt,
      });
    } catch (e: any) {
      await ctx.runMutation(internal.deliveryLogs.insertPagerdutyLog, {
        alertId: args.alertId,
        ruleId: args.ruleId,
        attempt: args.attempt,
        status: "failed",
        errorMessage: e.message ?? String(e),
        dedupKey: `codepulse-${args.ruleId}`,
        action: "trigger",
        sentAt,
      });
    }
  },
});
```

**insertPagerdutyLog mutation signature** (lines 33-58 of deliveryLogs.ts):
```typescript
// All these args are required when calling insertPagerdutyLog:
{
  alertId: v.id("alerts"),        // required
  ruleId: v.string(),             // required
  attempt: v.float64(),           // required
  status: v.string(),             // "success" | "failed" | "resolved"
  errorMessage: v.optional(v.string()),
  dedupKey: v.optional(v.string()),
  incidentKey: v.optional(v.string()),
  action: v.optional(v.string()), // "trigger" | "resolve"
  sentAt: v.float64(),            // required
}
```

**pagerdutyConfigValidator shape** (lines 17-21 of alertRuleCustom.ts):
```typescript
const pagerdutyConfigValidator = v.object({
  enabled: v.boolean(),
  routingKey: v.string(),
  severity: v.optional(v.string()),
});
```

---

### `convex/crons.ts` (config, event-driven — modify existing)

**Analog:** `convex/crons.ts` (self — add entries)

**Cron entry pattern** (lines 55-60, daily cron):
```typescript
// Phase 7: Daily digest generation at 06:00 UTC
crons.daily(
  "generate-daily-digest",
  { hourUTC: 6, minuteUTC: 0 },
  internal.briefings.triggerDailyDigest
);
```

**Add after the generate-daily-digest entry:**
```typescript
// Phase 70: Email digest delivery (after daily digest generation, 06:05 UTC)
crons.daily(
  "send-email-digest",
  { hourUTC: 6, minuteUTC: 5 },
  internal.emailDigest.sendEmailDigest
);
```

---

### `convex/alerts.ts` (service, event-driven — modify evaluateInternal)

**Analog:** `convex/alerts.ts` (self — add PagerDuty scheduler call alongside existing `sendAlertWebhook`)

**Existing webhook scheduling pattern** (lines 725-729 and 923-927 of alerts.ts):
```typescript
// Existing — schedule webhook delivery (Discord/Slack)
await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
  alertId: newAlertId,
  attempt: 1,
});
// ADD after the above, when rule has pagerdutyConfig:
if (rule.pagerdutyConfig?.enabled) {
  await ctx.scheduler.runAfter(0, internal.pagerdutyDelivery.sendPagerdutyAlert, {
    alertId: newAlertId,
    ruleId: rule._id,
    attempt: 1,
  });
}
```

---

### `src/components/CallGraphPanel.tsx` (component, request-response)

**Analogs:** `src/components/GithubActionsPanel.tsx` (panel wrapper + hook pattern) and `src/components/ProviderHealthPanel.tsx` (card grid with status coloring)

**Imports pattern** (lines 1-7 of GithubActionsPanel.tsx + Infrastructure.tsx useQuery pattern):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SectionHeader } from "./SectionHeader";
import { GlassPanel } from "./GlassPanel";
import dagre from "dagre";
import { useMemo } from "react";
```

**useQuery pattern** (standard CodePulse hook — from Infrastructure.tsx lines 46-49):
```typescript
const edges = useQuery(api.callGraphEdges.listEdges) ?? [];
```

**Panel wrapper pattern** (Infrastructure.tsx lines 93-96 — GithubActionsPanel usage):
```typescript
// In Infrastructure.tsx — caller wraps with SectionErrorBoundary:
<SectionErrorBoundary name="Call Graph">
  <CallGraphPanel />
</SectionErrorBoundary>
```

**Inner panel structure** (lines 66-70 of GithubActionsPanel.tsx):
```typescript
export default function CallGraphPanel() {
  // ...
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Agent Call Graph
      </h2>
      {/* SVG goes here */}
    </div>
  );
}
```

**Status color pattern** (lines 8-12 of ProviderHealthPanel.tsx — dot colors for state):
```typescript
// Adapt for call graph node colors (D-12):
const nodeColors = {
  healthy: "#6366f1",   // indigo-500 (CodePulse accent)
  errored: "#f87171",   // red-400
  pending: "#6b7280",   // gray-500
};
// SVG elements use inline styles (not Tailwind — SVG attribute context)
```

**dagre layout — create new instance per render** (RESEARCH.md Pitfall 4):
```typescript
// MUST be inside useMemo or the layout function — never at module scope
const layout = useMemo(() => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80, marginx: 20, marginy: 20 });
  // ... set nodes, set edges, dagre.layout(g)
  return g;
}, [edges]);
```

---

### `src/components/EmailDigestSettings.tsx` (component, CRUD)

**Analog:** `src/components/NotificationChannels.tsx`

**Imports pattern** (lines 1-8 of NotificationChannels.tsx):
```typescript
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2 } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
```

**Query + mutation wiring pattern** (lines 259-263 of NotificationChannels.tsx):
```typescript
export function EmailDigestSettings() {
  const config = useQuery(api.emailDigest.getEmailDigestConfig);
  const setConfig = useMutation(api.emailDigest.setEmailDigestConfig);
  // ...
}
```

**Save with loading state** (Settings.tsx lines 139-150 — IntelligenceSettings.handleSave):
```typescript
const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

const handleSave = async () => {
  setSaveState("saving");
  try {
    await setConfig({ enabled, schedule, recipient });
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  } catch {
    setSaveState("idle");
    toast.error("Failed to save email digest settings. Please try again.");
  }
};
```

**Toggle component** (Settings.tsx lines 24-54 — reuse local Toggle):
```typescript
// Settings.tsx already has a local Toggle component — import or duplicate pattern:
<Toggle
  enabled={enabled}
  onToggle={() => setEnabled(!enabled)}
  label="Enable email digest"
/>
```

**Section header pattern** (NotificationChannels.tsx lines 277-279):
```typescript
<SectionHeader title="EMAIL DIGEST" />
<div className="space-y-6">
  {/* recipient, schedule select, enabled toggle */}
</div>
```

---

### `src/components/DeliveryHistoryTab.tsx` (component, CRUD)

**Analog:** `src/pages/Settings.tsx` (list display sections) + `convex/deliveryLogs.ts` (query signatures)

**Query pattern** (deliveryLogs.ts lines 91-108 — listEmailLogs):
```typescript
// Both queries support optional ruleId filter:
const emailLogs = useQuery(api.deliveryLogs.listEmailLogs, {});
const pagerdutyLogs = useQuery(api.deliveryLogs.listPagerdutyLogs, {});
```

**Log row display pattern** (Infrastructure.tsx lines 161-181 — Table pattern):
```typescript
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "./ui/table";

// Each log row:
<TableRow key={log._id}>
  <TableCell className="font-mono text-xs">{log.ruleId}</TableCell>
  <TableCell>{log.status}</TableCell>
  <TableCell className="tabular-nums text-xs text-muted-foreground">
    {new Date(log.sentAt * 1000).toLocaleString()}
  </TableCell>
  <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
    {log.errorMessage ?? "—"}
  </TableCell>
</TableRow>
```

**Empty state pattern** (Infrastructure.tsx lines 175-179):
```typescript
<TableRow>
  <TableCell colSpan={4} className="text-sm text-muted-foreground text-center py-8">
    No delivery history yet.
  </TableCell>
</TableRow>
```

**Tab switching pattern** (Settings.tsx uses `useState` for active tab):
```typescript
const [activeTab, setActiveTab] = useState<"email" | "pagerduty">("email");
// Tab buttons: className={activeTab === "email" ? "border-b-2 border-indigo-500 text-white" : "text-gray-400"}
```

---

### `src/components/AlertRuleForm.tsx` (component, CRUD — modify existing)

**Analog:** `src/components/AlertRuleForm.tsx` (self — append to the custom mode form body)

**Collapsible section pattern** (Settings.tsx IntelligenceSettings — collapsible subsections use state toggle):
```typescript
const [pagerdutyOpen, setPagerdutyOpen] = useState(false);

// In JSX after existing custom-mode fields:
<div className="border border-gray-700/50 rounded-lg p-3">
  <button
    type="button"
    onClick={() => setPagerdutyOpen(!pagerdutyOpen)}
    className="flex items-center justify-between w-full text-sm font-medium"
  >
    PagerDuty
    <span className="text-muted-foreground">{pagerdutyOpen ? "▲" : "▼"}</span>
  </button>
  {pagerdutyOpen && (
    <div className="mt-3 space-y-3">
      {/* enabled toggle, routing key input, severity select */}
    </div>
  )}
</div>
```

**Field change + dirty pattern** (AlertRuleForm.tsx lines 103-117 — markDirty):
```typescript
// pagerdutyConfig state — parallel to existing fields:
const [pdEnabled, setPdEnabled] = useState(false);
const [pdRoutingKey, setPdRoutingKey] = useState("");
const [pdSeverity, setPdSeverity] = useState<string | undefined>(undefined);

// In handleSave, include in createCustomRule/updateCustomRule args:
pagerdutyConfig: pdEnabled ? {
  enabled: true,
  routingKey: pdRoutingKey,
  severity: pdSeverity,
} : undefined,
```

**Existing mutation args** (AlertRuleForm.tsx lines 183-190 — createCustomRule call):
```typescript
// Already passes through optional fields — just add pagerdutyConfig:
await createCustomRule({
  name: ruleName.trim(),
  severity,
  conditions,
  conditionLogic,
  conditionGroups: conditionGroups.length > 0 ? conditionGroups : undefined,
  messageTemplate: messageTemplate.trim() || undefined,
  pagerdutyConfig: pdEnabled ? { enabled: true, routingKey: pdRoutingKey, severity: pdSeverity } : undefined,
});
```

---

### `src/email/DigestEmailTemplate.tsx` (utility, transform)

**No codebase analog.** This is the first React Email component in the project. Use RESEARCH.md Pattern 4 and the `@react-email/components` docs directly.

**Key constraint:** The file must be in a location importable from `convex/emailDigest.ts`. Wave 0 task: check `convex/tsconfig.json` for JSX support. If not present, place under `convex/emailTemplates/DigestEmailTemplate.tsx` with `"jsx": "react-jsx"` in convex tsconfig. See RESEARCH.md Pitfall 3.

**Style guide:** Dark theme matching CodePulse palette — `backgroundColor: "#111827"` (gray-900), accent `#6366f1` (indigo-500), error red `#f87171`. Fonts: Cinzel headings, Geist body (as inline styles — email clients don't load Google Fonts, use fallbacks).

---

### `src/pages/Infrastructure.tsx` (component — modify existing)

**Analog:** `src/pages/Infrastructure.tsx` (self — append section)

**Add new section pattern** (lines 93-98 of Infrastructure.tsx — GithubActionsPanel section):
```typescript
<SectionErrorBoundary name="Call Graph">
  <CallGraphPanel />
</SectionErrorBoundary>
```

Place after the `<SectionErrorBoundary name="GitHub Actions">` block. Import `CallGraphPanel` from `"../components/CallGraphPanel"`.

---

### `src/pages/Settings.tsx` (component — modify existing)

**Analog:** `src/pages/Settings.tsx` (self — add EmailDigestSettings and DeliveryHistoryTab)

**Notification Channels section pattern** (Settings.tsx — `NotificationChannels` import and usage):
```typescript
// Existing section:
import { NotificationChannels } from "../components/NotificationChannels";
// Add alongside:
import { EmailDigestSettings } from "../components/EmailDigestSettings";
import { DeliveryHistoryTab } from "../components/DeliveryHistoryTab";
```

**Settings section wrapper pattern** (Settings.tsx lines 153-155 — IntelligenceSettings):
```typescript
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mt-12">
  <div className="space-y-4">
    {/* section content */}
  </div>
</div>
```

---

## Shared Patterns

### Convex internalAction (fire-and-forget with log)
**Source:** `convex/webhookDelivery.ts` lines 406-545 (`sendAlertWebhook`)
**Apply to:** `convex/emailDigest.ts`, `convex/pagerdutyDelivery.ts`
```typescript
// Structure:
export const myDeliveryAction = internalAction({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // 1. Load data via ctx.runQuery(internal.domain.fn, {...})
    // 2. Guard: return early if not configured
    // 3. External HTTP call (fetch or SDK)
    // 4. await ctx.runMutation(internal.deliveryLogs.insertXLog, { status, sentAt, ... })
    // Do NOT rethrow — cron must not die on delivery failure
  },
});
```

### agentConfigs key-value store (read/write)
**Source:** `convex/webhookDelivery.ts` lines 17-65 (`getChannels`, `setChannel`)
**Apply to:** `convex/emailDigest.ts` config queries/mutations
```typescript
// Read pattern:
const row = await ctx.db
  .query("agentConfigs")
  .withIndex("by_key", (q) => q.eq("configKey", "email-digest-enabled"))
  .first();
return (row?.value as boolean) ?? false;

// Write pattern (upsert):
const existing = await ctx.db.query("agentConfigs")
  .withIndex("by_key", (q) => q.eq("configKey", configKey)).first();
if (existing) {
  await ctx.db.patch(existing._id, { value, updatedAt: Date.now() / 1000 });
} else {
  await ctx.db.insert("agentConfigs", { configKey, value, updatedAt: Date.now() / 1000 });
}
```

### Convex environment variable access
**Source:** `convex/webhookDelivery.ts` (process.env pattern, per RESEARCH.md Pattern 5)
**Apply to:** `convex/emailDigest.ts`
```typescript
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  // log failure, return — do not throw
  return;
}
```

### Dark theme panel (Infrastructure page sections)
**Source:** `src/components/GithubActionsPanel.tsx` line 66, `src/pages/Infrastructure.tsx`
**Apply to:** `src/components/CallGraphPanel.tsx`
```typescript
<div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
  <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3">
    Agent Call Graph
  </h2>
  {/* content */}
</div>
```

### SectionErrorBoundary wrapping
**Source:** `src/pages/Infrastructure.tsx` lines 77-98
**Apply to:** All new Infrastructure.tsx and Settings.tsx sections
```typescript
<SectionErrorBoundary name="Call Graph">
  <ComponentName />
</SectionErrorBoundary>
```

### Toast feedback on save
**Source:** `src/components/AlertRuleForm.tsx` lines 155-156, 165-166
**Apply to:** `src/components/EmailDigestSettings.tsx`, `src/components/AlertRuleForm.tsx` (new PagerDuty section)
```typescript
toast.success("Settings saved.");
toast.error("Failed to save. Check your inputs and try again.");
```

### Convex cron entry
**Source:** `convex/crons.ts` lines 55-60
**Apply to:** `convex/crons.ts` (add email digest cron)
```typescript
crons.daily(
  "send-email-digest",
  { hourUTC: 6, minuteUTC: 5 },
  internal.emailDigest.sendEmailDigest
);
```

---

## Test Patterns

### Unit test structure
**Source:** `convex/deliveryLogs.test.ts` and `convex/alertRuleCustom.test.ts`
```typescript
// convex/pagerdutyDelivery.test.ts and convex/emailDigest.test.ts follow this structure:
import { describe, it, expect, vi } from "vitest";

describe("pagerdutyDelivery", () => {
  describe("payload shape", () => {
    it("builds correct dedup_key from ruleId", () => {
      const ruleId = "abc123";
      const dedupKey = `codepulse-${ruleId}`;
      expect(dedupKey).toBe("codepulse-abc123");
    });
    it.todo("trigger action sends POST to PagerDuty endpoint (fetch mock)");
    it.todo("resolve action sends same dedup_key as trigger");
    it.todo("skips when pagerdutyConfig.enabled is false");
  });
});
```

### Component test structure (layout computation)
**Source:** `convex/alertRuleCustom.test.ts` (pure function testing pattern)
```typescript
// src/components/CallGraphPanel.test.tsx — test computeLayout separately:
import { describe, it, expect } from "vitest";
import { computeLayout } from "../components/CallGraphPanel";

describe("computeLayout", () => {
  it("returns correct node count from edges", () => {
    const edges = [{ agentId: "a1", toolName: "t1", status: "healthy", callCount: 1, errorCount: 0 }];
    const { nodes } = computeLayout(edges);
    expect(nodes).toHaveLength(2); // 1 agent + 1 tool
  });
  it("marks agent node errored when any edge is errored", () => { /* ... */ });
  it("empty edges renders without crash", () => {
    const { nodes, edges } = computeLayout([]);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/email/DigestEmailTemplate.tsx` | utility | transform | First React Email component in project; no existing email template to copy from |

---

## Critical Wave 0 Notes for Planner

1. **Schema patch required first:** `emailDeliveryLog.alertId` must become `v.optional(v.id("alerts"))` in `convex/schema.ts` and the `insertEmailLog` mutation in `convex/deliveryLogs.ts` updated to match. Block all email digest work on this.

2. **npm installs before any email code:** `npm install resend @react-email/components @react-email/render` must run before Wave 1 email tasks compile.

3. **convex/tsconfig.json JSX check:** Verify `"jsx": "react-jsx"` before importing `DigestEmailTemplate` from a Convex action. If missing, place the template under `convex/emailTemplates/` instead of `src/email/`.

4. **PagerDuty endpoint hardcoded:** `https://events.pagerduty.com/v2/enqueue` — never accept as user input. No SDK, plain fetch POST.

5. **dagre graph instance:** Create `new dagre.graphlib.Graph()` inside `useMemo` or a layout function — never at module scope. Module-scope instances accumulate stale nodes across renders.

---

## Metadata

**Analog search scope:** `convex/`, `src/components/`, `src/pages/`
**Files scanned:** 11
**Pattern extraction date:** 2026-05-24
