# Phase 69: SDK Spend Guard & Multi-Provider UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 69-sdk-spend-guard-multi-provider-ux
**Areas discussed:** Spend Guard UX, Provider Controls, Session Badges, Auto-alert + Seed Data

---

## Spend Guard UX

### Replace vs Separate

| Option | Description | Selected |
|--------|-------------|----------|
| Replace it | Upgrade SDKSpendCapGauge into full SDKSpendGuard card in place. One component, richer. | ✓ |
| Separate card | Keep simple gauge, add trend/projection as second card nearby. |  |

**User's choice:** Replace it
**Notes:** None

### Trend Line Content

| Option | Description | Selected |
|--------|-------------|----------|
| Both | Small sparkline of hourly spend rate + projected EOD total with cap indicator | ✓ |
| Projected EOD only | Single projected number with over/under indicator |  |
| Hourly sparkline only | Visual burn rate trend, operators interpret shape |  |

**User's choice:** Both
**Notes:** None

### Overshoot Warning Aggressiveness

| Option | Description | Selected |
|--------|-------------|----------|
| Inline warning | Red text + destructive badge on card itself |  |
| Inline + toast | Red card warning plus toast notification at threshold |  |
| You decide | Claude picks based on existing patterns | ✓ |

**User's choice:** You decide
**Notes:** None

### Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Existing aggregates | Reuse costByPeriod with billingType='api' and hourly granularity | ✓ |
| Dedicated query | New query optimized for guard card with server-side projection |  |

**User's choice:** Existing aggregates
**Notes:** None

---

## Provider Controls

### Disable Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Gateway command | Dashboard sends disable command to gateway. Real operational control. | ✓ |
| UI-only filter | Provider hidden from views but gateway still routes to it. |  |

**User's choice:** Gateway command
**Notes:** None

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page | Under "Gateway Providers" section. Persistent config. | ✓ |
| Analytics page | Near ProviderHealthPanel for quick access. |  |
| Both | Controls on Settings, quick toggle on Analytics. |  |

**User's choice:** Settings page
**Notes:** None

### Control Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Enable/disable + priority | Toggle per provider + drag-to-reorder priority list. No force-route. | ✓ |
| Full control | Toggle + priority + force-route dropdown. |  |
| Toggle only | Just enable/disable switches. |  |

**User's choice:** Enable/disable + priority
**Notes:** None

### Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Convex-persisted | Store config in Convex table. Survives restarts. | ✓ |
| Session-only | WebSocket commands, lasts until restart. |  |

**User's choice:** Convex-persisted
**Notes:** None

---

## Session Badges

### Badge Style

| Option | Description | Selected |
|--------|-------------|----------|
| Colored pill | Small pill badge with provider family color and short label | ✓ |
| Icon only | Small provider logo/icon without text |  |

**User's choice:** Colored pill
**Notes:** None

### Badge Density

| Option | Description | Selected |
|--------|-------------|----------|
| Always show | Every tool call event gets a provider badge | ✓ |
| Mixed-provider only | Show badges only when session uses multiple providers |  |

**User's choice:** Always show
**Notes:** None

### Badge Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Timeline + session list | Badge on session detail timeline AND session list rows | ✓ |
| Timeline only | Badges only on detail page |  |

**User's choice:** Timeline + session list
**Notes:** None

---

## Auto-alert + Seed Data

### Alert Type

| Option | Description | Selected |
|--------|-------------|----------|
| System alert rule | Create real alertRuleCustom row. Visible, editable, integrates with delivery. | ✓ |
| Hardcoded check | Component fires visual warning internally. No alert integration. |  |

**User's choice:** System alert rule
**Notes:** None

### Seed Data Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 gateway providers | Seed profiles for claude-cli, codex, antigravity, claude-sdk | ✓ |
| API-billed only | Only claude-sdk profile |  |

**User's choice:** All 4 gateway providers
**Notes:** None

### Routing Audit Table

| Option | Description | Selected |
|--------|-------------|----------|
| Upgrade existing | Enhance RoutingDecisionsTable with richer breakdown, filtering, audit columns | ✓ |
| Separate audit view | New table on different page with deeper audit focus |  |

**User's choice:** Upgrade existing
**Notes:** None

---

## Claude's Discretion

- Overshoot warning aggressiveness (inline vs toast) — pick based on existing patterns
- Sparkline rendering approach (inline SVG, Recharts, CSS)
- RoutingDecisionsTable specific upgrade details
- Hook system documentation format and content
- Test structure and Wave 0 stub design

## Deferred Ideas

None — discussion stayed within phase scope.
