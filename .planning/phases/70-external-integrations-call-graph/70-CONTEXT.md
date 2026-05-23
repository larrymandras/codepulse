# Phase 70: External Integrations & Call Graph - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete three partially-built features: (1) Email digest delivery via Resend, (2) PagerDuty incident trigger/resolve lifecycle via Events API v2, and (3) Agent/tool call graph visualization with dagre layout. Schema infrastructure (tables, validators, delivery logs) already exists from Phase 59. This phase builds the delivery actions, API integrations, visualization component, and Settings/alert editor UI wiring.

</domain>

<decisions>
## Implementation Decisions

### Email Digest
- **D-01:** Convex cron job only — daily and/or weekly schedule fires `generateDailyDigestAction`, then sends via Resend. No manual trigger button.
- **D-02:** Reuse existing daily digest content as-is — wrap `generateDailyDigestAction` output (sessions, cost, anomalies, briefing narrative, active alerts) in an HTML email template.
- **D-03:** Email config lives on the existing Settings page — new "Email Digest" section under Notification Channels alongside Discord/Slack. Fields: recipient email (use `profileConfigs.emailAddress` already in schema), schedule (daily/weekly/both), enabled toggle.
- **D-04:** Use React Email (`@react-email/components`) for type-safe, component-based HTML email templates.

### PagerDuty Lifecycle
- **D-05:** `dedup_key = 'codepulse-{alertRuleId}'` — one incident per rule. Re-trigger deduplicates via PagerDuty. Resolve uses same key to close.
- **D-06:** Auto-map severity from alert rule: critical->critical, warning->warning, info->info. Operator can override per-rule in `pagerdutyConfig.severity`.
- **D-07:** Auto-resolve on alert clear — when evaluation cron determines condition returned to normal, send 'resolve' event with same dedup_key. No manual resolve from CodePulse.
- **D-08:** Per-rule config only — routing key set in alert rule editor via existing `pagerdutyConfig` field on `alertRuleCustom`. No global PagerDuty Settings entry.

### Call Graph Visualization
- **D-09:** dagre + custom SVG rendering. Dagre for deterministic top-down layout (already installed). Custom SVG nodes/edges rendered by React. No React Flow or force-directed layout.
- **D-10:** Graph lives on the Infrastructure page as a new section alongside GithubActionsPanel and ProviderHealthPanel.
- **D-11:** Convex reactive query (`useQuery` on `callGraphEdges`) for real-time updates. Standard CodePulse pattern — no WebSocket or polling needed.
- **D-12:** Agent nodes (larger) + tool nodes (smaller) with edges = call dependencies. Errored nodes turn red. Edges on error propagation path highlighted red. Color-based status (healthy=default, errored=red, pending=muted).

### Alert Rule Editor & Settings Integration
- **D-13:** Add collapsible "PagerDuty" and "Email Digest" sections to the existing AlertRuleForm alongside Discord/Slack config. Toggle on/off per delivery channel, show config fields when enabled.
- **D-14:** Settings page groups Email Digest config under existing "Notification Channels" section. PagerDuty stays per-rule only. Delivery logs visible in a new "Delivery History" tab.

### Secrets & API Keys
- **D-15:** `RESEND_API_KEY` as Convex environment variable. Convex actions read from `process.env`. No secrets in code or Convex tables. PagerDuty routing key stored per-rule in `pagerdutyConfig.routingKey` field (not a secret — it's a service-specific routing identifier).

### Claude's Discretion
- React Email template structure and styling (match Paperclip aesthetic where possible)
- PagerDuty Events API v2 payload structure details (summary, source, component fields)
- Call graph SVG node sizing, spacing, and animation approach
- Test structure and Wave 0 stub design
- Delivery History tab layout and filtering

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` -- Phase 70 goal, success criteria, scope
- `.planning/REQUIREMENTS.md` -- EXT-01 (email), EXT-02 (PagerDuty), VIZ-01 (call graph)

### Prior Phase Context (Gateway Integration Chain)
- `.planning/phases/69-sdk-spend-guard-multi-provider-ux/69-CONTEXT.md` -- Provider colors, Settings page organization, alert patterns

### Schema & Delivery Infrastructure
- `convex/schema.ts` -- `emailDeliveryLog` (line ~965), `pagerdutyDeliveryLog` (line ~980), `callGraphEdges` (line ~950), `alertRuleCustom` with `pagerdutyConfig` validator, `profileConfigs` with `emailAddress`
- `convex/deliveryLogs.ts` -- `insertEmailLog`, `insertPagerdutyLog`, `listEmailLogs`, `listPagerdutyLogs`
- `convex/callGraphEdges.ts` -- `upsertEdge`, `listEdges`, `getBySession`

### Briefings & Digest Content
- `convex/briefings.ts` -- `generateDailyDigestAction` (content source for email), `getDailyDigestDataInternal`

### Alert & Webhook Patterns
- `convex/webhookDelivery.ts` -- Discord/Slack webhook pattern (reference for PagerDuty action)
- `convex/alertRuleCustom.ts` -- `pagerdutyConfigValidator` (line ~17), create/update mutations accepting pagerdutyConfig

### UI Integration Points
- `src/pages/Infrastructure.tsx` -- Target page for call graph section
- `src/pages/Settings.tsx` -- Target for Email Digest config section
- `src/components/ObsidianGraph.tsx` -- Existing graph component (pattern reference, NOT reused — different rendering approach)

### Out of Scope (from REQUIREMENTS.md)
- Force-directed graph layout -- explicitly rejected, use dagre
- Bidirectional PagerDuty sync -- deferred
- React Email fancy templates (EXT-01d) -- use React Email but keep templates simple

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `convex/deliveryLogs.ts`: Insert/list mutations for email and PagerDuty logs — ready to use
- `convex/callGraphEdges.ts`: Full CRUD for call graph edges — upsert on ingest, query for visualization
- `convex/briefings.ts`: `generateDailyDigestAction` provides complete digest content — wrap in email template
- `convex/webhookDelivery.ts`: Discord/Slack webhook delivery pattern — model PagerDuty action after this
- `dagre` (v0.8.5): Installed, used for layout. No new graph deps needed.
- `@dnd-kit`: Installed from Phase 4 — not needed here
- `GlassPanel`, `SectionErrorBoundary`, `SectionHeader`: Infrastructure page wrapper patterns

### Established Patterns
- Convex actions for external API calls: fire-and-forget with try/catch, log to delivery table on success/failure
- Alert evaluation cron: existing `evaluateAlertRules` cron triggers delivery. PagerDuty trigger hooks into same flow.
- Settings page sections: collapsible sections with header + content pattern. Email Digest follows same.
- `profileConfigs.emailAddress`: Already in schema — reuse for digest recipient

### Integration Points
- Alert evaluation pipeline: PagerDuty trigger/resolve hooks into `evaluateAlertRules` alongside Discord/Slack
- Briefings cron: Email digest cron fires after daily digest generation
- Infrastructure page: New CallGraph section added alongside existing panels
- Settings Notification Channels: Email Digest config section added to existing group

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 70-External Integrations & Call Graph*
*Context gathered: 2026-05-23*
