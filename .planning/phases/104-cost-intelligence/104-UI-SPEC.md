---
phase: 104
slug: cost-intelligence
status: draft
shadcn_initialized: true
preset: "new-york / baseColor:neutral / cssVariables:true / iconLibrary:lucide (components.json, pre-existing)"
created: 2026-07-30
---

# Phase 104 — UI Design Contract

> Visual and interaction contract for Cost Intelligence (COST-01/02/03). CodePulse already has a
> mature, token-driven design system (v9.0 Phase 89 theming, v10.0 Phase 96 consistency sweep) —
> this phase **extends existing surfaces**, it does not invent a new visual language. Every
> decision below either (a) points at the existing pattern to reuse verbatim, or (b) resolves a
> genuine gap left open by `104-CONTEXT.md`'s "Claude's Discretion" list.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (already initialized — `components.json` present, 30 primitives in `src/components/ui/`) |
| Preset | `new-york` style, `baseColor: neutral`, `cssVariables: true`, `prefix: ""`, no `registries` configured |
| Component library | Radix primitives via shadcn (Table, Badge, Sheet, Tabs, Tooltip, Select, Input, Switch, Progress, Dialog, Command, Popover already present — reuse, do not hand-roll) |
| Icon library | Lucide only (`lucide-react`) — no other icon set may be introduced |
| Font | Geist Variable (body + headings, `--font-geist`), JetBrains Mono (`--font-mono`, code/mono labels) |
| Charting | `FlexBarChart` (`src/components/FlexBarChart.tsx`) — hand-rolled stacked/single div bar chart, NOT Recharts. This phase's cost-over-time chart reuses `FlexBarChart`'s `StackedSegment[]` shape per D-08; do not introduce Recharts for this phase's new surfaces (`chart.tsx` shadcn wrapper exists in `ui/` but is unused by the cost cluster today — stay consistent with the surface being extended) |
| Theming | Token-driven, `<html data-theme="...">`, 6 palettes (`cyan` default, `emerald`, `amber`, `readable`, `aubergine`, light `:root`). **Every new component in this phase must render correctly, unchanged, across all 6** — no theme-specific branches |

**shadcn gate:** already satisfied — `components.json` exists, no re-init needed, no preset questions to ask.

---

## Spacing Scale

Declared values (Tailwind's 4px-based scale, already the codebase norm — confirmed via `GlassPanel` `p-4`, grid `gap-6`, `space-y-2`/`space-y-4` throughout `SDKSpendGuard.tsx`/`CostForecastPanel.tsx`):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps (`gap-1`), dense table cell padding (`px-1 py-1` — existing `CostBreakdown.tsx` pattern, keep for the new breakdown table) |
| sm | 8px | Compact stacks (`space-y-2`), badge internal padding, gauge-bar-to-label gap |
| md | 16px | Default panel padding (`GlassPanel p-4`), form field stacks (`space-y-4`), grid gaps between cost-cluster panels (`gap-4`) |
| lg | 24px | Section-to-section grid gap (`gap-6`, the Analytics page's top-level grid) |
| xl | 32px | Not used within this phase's new surfaces (reserved for page-level layout, unchanged) |
| 2xl | 48px | Not used within this phase's new surfaces |
| 3xl | 64px | Not used within this phase's new surfaces |

Exceptions: **44px minimum touch target** on every interactive row action in `ModelPricingAdmin`/`CostBudgetsAdmin` (delete/edit icon buttons) even though the row itself is dense (`py-1`) — use `Button` `size="icon"` (shadcn default 36px hit box) wrapped so the clickable area meets 44px via padding, matching the existing `AlertRuleForm.tsx` row-action pattern. No other exceptions.

---

## Typography

Declared from the actual scale already in use across the cost cluster (`SDKSpendGuard.tsx`, `CostForecastPanel.tsx`, `CostBreakdown.tsx`) — this phase pins these down as the canonical set for every **new** component so the two competing conventions already visible in the codebase (mono-uppercase eyebrow vs. plain-uppercase-muted eyebrow) don't gain a third variant.

**Weight collapsed to exactly 2**, matching shipped precedent in the exact files this phase extends — not invented. Evidence: `CostForecastPanel.tsx:11,22,57` (`font-normal` on every eyebrow/label) and `:65,69,73` (`font-semibold` on every metric value, e.g. `text-2xl font-semibold tabular-nums`); `CostBreakdown.tsx:140` (`text-xs font-mono uppercase tracking-widest text-muted-foreground` — no weight class, implicit regular 400) and `:144` (`text-xl font-semibold tabular-nums` on the total-cost value); `CostTrendChart.tsx` (no `font-*` weight utility anywhere in the file — implicit regular 400 throughout, both eyebrow and body). Two isolated `font-medium` (500) instances exist elsewhere (`MetricCard.tsx:141`'s `text-3xl font-medium` value, `CostBreakdown.tsx:129`'s empty-state body text) but are one-offs outside the dominant pattern in the files this phase directly extends/mirrors, and are not carried into any new component this phase adds. Uppercase + `tracking-widest`/`tracking-wide` already carries the eyebrow/label's visual distinction from body text — a third weight isn't needed to do that job.

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label (eyebrow) | 12px (`text-xs`) | 400 regular, uppercase, `tracking-widest` | 1.2 |
| Body | 14px (`text-sm`) | 400 regular | 1.5 |
| Metric value | 20px (`text-xl`) | 600 semibold, `tabular-nums` | 1.2 |
| Heading (panel title) | 14px (`text-sm`) | 400 regular, uppercase, `tracking-wide`, `text-muted-foreground` | 1.2 |

**Rule for this phase:** every new panel (`ModelPricingAdmin`, `CostBudgetsAdmin`, `UnpricedModelsNudge`, `CostBreakdownTable`) uses the **Heading (panel title)** style — `CostForecastPanel.tsx`'s plain `text-sm font-normal uppercase tracking-wide text-muted-foreground` convention — not the mono `text-xs font-mono tracking-widest text-primary` eyebrow used by `CostTrendChart.tsx`/`SDKSpendGuard.tsx`/`CostBreakdown.tsx`. Reason: the plain-muted convention is the more recent, WCAG-AA-friendlier pattern (matches `readable` theme's suppressed-glow intent) and is what `CostForecastPanel` — the panel this phase's `CostBudgetsAdmin` most directly extends via D-19 — already uses. Existing panels being edited in place (`SDKSpendGuard`, `CostTrendChart`, `CostBreakdown`) keep their current heading style; do not restyle headings on components this phase only touches for data-source rewiring (D-12/D-19), to keep the diff scoped to the actual behavior change.

Dollar figures always render with `tabular-nums` (already the convention in every existing money display) and `formatCost()` from `src/lib/formatters.ts` (`$X.XXXX`, 4 decimal places) — no new money formatter.

---

## Color

Token-driven per CLAUDE.md — **no hardcoded hex in anything new this phase adds.** Roles map to existing CSS custom properties, resolved below against the `cyan` (default) dark theme for reference; every new component must read the token, not the resolved value, so it repaints correctly across all 6 themes.

| Role | Token | Cyan-theme value (reference only) | Usage |
|------|-------|-----------------------------------|-------|
| Dominant (60%) | `--background` / `bg-background` | `#040405` | Page background |
| Secondary (30%) | `--card` / `bg-card`, `--secondary` | `#0a0a0c` / `#1e1e24` | Panel surfaces (`GlassPanel`), table zebra/hover, Sheet/dialog backgrounds |
| Accent (10%) | `--primary` / `text-primary`, `bg-primary` | `#06b6d4` | **Reserved for:** the active state of the Billed/Billed+Covered toggle (D-08), the "Add pricing rate"/"Add budget" primary CTA buttons, focus rings, and the budget progress-bar fill when status is `ok`. Never used as decorative background tint on data rows. |
| Destructive | `--destructive` | `oklch(0.704 0.191 22.216)` (red) | Delete-row confirmation buttons only (`ModelPricingAdmin`/`CostBudgetsAdmin` row delete), never for the "breach" budget-status color (see status tokens below — breach uses `--status-error`, a distinct token from `--destructive`, matching the existing `AnomalyBadge`/`MetricCard` convention of keeping "destructive action" and "bad metric" as separate token families even though they resolve to similar reds today) |

### Status tokens (budget/pricing states — D-03, D-11)

| State | Token | Usage |
|-------|-------|-------|
| OK / on track | `--status-ok` (`var(--status-ok)`) | Budget under warn fraction; a priced model row |
| Warning | `--status-warn` (`var(--status-warn)`) | Budget ≥ `warnFraction × limit` (D-11); the "N models need rates" nudge (D-03) |
| Breach | `--status-error` (`var(--status-error)`) | Budget ≥ `limit` (D-11) |
| Info | `--info` (`var(--info)`) | The "covered by subscription" shadow segment (D-05) — deliberately NOT a status color, since it is not a warning, it's an explanatory figure |

**Mandatory remediation (per `CLAUDE.md` §Styling and `104-CONTEXT.md` canonical_refs — these two files are touched this phase and currently violate the no-hex rule):**
- `CostTrendChart.tsx`'s wrapper `bg-gray-800/50 border-gray-700/50` → `bg-card border-border` (matches `GlassPanel`'s own surface tokens; this component is already wrapped in a `GlassPanel` by `Analytics.tsx`, so the double surface styling is also redundant, not just non-token)
- `CostBreakdown.tsx`'s `#10b981`/`#ef4444`/`bg-amber-500/10`/`text-amber-300`/`#eab308` → `var(--status-ok)`/`var(--status-error)`/`var(--status-warn)` via the `color-mix` pattern already established in `MetricCard.tsx`'s `severityConfig` (e.g. `bg-[color-mix(in_oklab,var(--status-warn)_10%,transparent)]`), not `AlertRulesEngine.tsx`'s older hardcoded `red-400`/`orange-400`/`yellow-400`/`blue-400` Tailwind-color-scale pattern. **Do not propagate the `AlertRulesEngine.tsx` pattern into any new component this phase adds** — it is legacy, not the standard to copy.
- `SDKSpendGuard.tsx`'s sparkline hex constants (`#ef4444`/`#eab308`/`#10b981`) → same `--status-*` tokens, resolved via `getComputedStyle`/`window.getComputedStyle(document.documentElement).getPropertyValue(...)` or a small existing color-resolution helper if one exists in `src/lib` — check before hand-rolling (per RESEARCH.md's Package Legitimacy note)

**Provider colors are exempt from the no-hex rule** — `PROVIDER_COLORS` (`src/lib/providers.ts`) is a pre-existing, intentional per-provider identity palette (distinguishing `claude-cli` from `codex` from `anthropic_direct` in the stacked chart legend), not a theme-chrome color. It stays hardcoded hex, unchanged. The D-08 "covered" segment renders in the **same** `PROVIDER_COLORS[provider]` hex at reduced opacity (`opacity-35`, via inline `style` alpha channel — e.g. append `59` hex alpha or use `color-mix(in srgb, ${color} 35%, transparent)`) with a 1px dashed top border in the same color — this communicates "same spend, different accounting" without inventing a second color scale.

Accent reserved for (explicit, never "all interactive elements"): the Billed/Billed+Covered toggle's active pill, the "Add pricing rate" / "Add budget threshold" primary buttons, input focus rings, links, and the budget-OK progress fill. Everything else (table rows, badges, panel chrome) uses neutral/status tokens.

---

## Visual Focal Point

- **Analytics cost cluster:** unchanged from the existing layout — `CostForecastPanel`'s monthly progress bar/gauge (the `md:col-span-8` panel, `Analytics.tsx:87-90`) is the primary anchor. It already holds the largest text (`text-2xl font-semibold` stat boxes) and the widest column in the top row versus `SDKSpendGuard`'s `md:col-span-4`. This phase does not change that weighting — `UnpricedModelsNudge` and the Billed/Billed+Covered toggle are secondary, subordinate elements that sit above/within the cluster but do not compete with the forecast panel's progress bar for primary attention.
- **Settings "Cost & Budgets" tab:** `CostBudgetsAdmin`'s budget row list is the primary anchor. Each row renders the same colored progress-bar treatment established by `SDKSpendGuard` (status-token fill: ok/warn/breach), giving it more visual weight than `ModelPricingAdmin`'s plain neutral rate table above it — appropriate, since the budget list is the actionable "what will alert me" surface operators come to this tab to check, while the pricing table is closer to reference/setup-once data.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (pricing admin) | "Add pricing rate" |
| Primary CTA (budget admin) | "Add budget threshold" |
| Toggle labels (D-08) | "Billed" / "Billed + Covered" |
| Empty state — no cost data | "No cost data yet." (existing `CostTrendChart.tsx` copy, unchanged) |
| Empty state heading — no budgets configured | "No budget thresholds set" |
| Empty state body — no budgets configured | "Set a daily, weekly, or monthly limit and CodePulse will alert you before spend gets away from you. [Add budget threshold]" |
| Empty state — no pricing rates seeded | Should not occur (D-02 seeds from `src/lib/modelPricing.ts` on first deploy) — if it does, treat as an error state, not empty state: "No pricing rates configured. Cost totals cannot be computed until at least one rate is entered." |
| Unpriced-models nudge (D-03) | "**{N} models** need pricing rates — their cost isn't in the total above. [Add rates]" (N is the live count of distinct unpriced model ids seen in `llmMetrics`, never a stale/cached number) |
| Unpriced row (in breakdown table, in place of a dollar figure) | Badge: "Unpriced" (status-warn token) + the row's real token counts, never a `$0.00` or blank cell |
| Covered-segment tooltip (D-05) | "Not billed — priced at the {model} API rate to show what this would have cost without your subscription plan." |
| Quota threshold — no live data (D-20, Pitfall 2 fallback state) | "No quota data yet. The subscription usage poller hasn't reported in — check back after the next 5-minute cycle." (never render a 0%/empty progress bar as if it were a real zero) |
| Error state — budget/pricing query fails | "Couldn't load {budgets / pricing rates}. [Retry]" (matches `SectionErrorBoundary`'s existing tone; every new panel is wrapped in `<SectionErrorBoundary name="...">` per the established convention, so a throwing query doesn't blank the page) |
| Alert message template (COST-03, D-16 honesty) | "{scope label} budget at {pct}% (${spend} of ${limit}) — projected to hit ${limit} by ~{time}." Never implies enforcement (no "will be throttled", "will swap engine", etc.) — alert-only per D-16 |
| Destructive confirmation — delete pricing rate | "Remove pricing rate for {model}?" / body: "Past cost figures using this rate stay as last computed. New calls for this model become Unpriced until a new rate is entered." |
| Destructive confirmation — delete budget threshold | "Delete this budget threshold?" / body: "Alerts tied to this threshold stop firing immediately. This can't be undone." |
| Destructive confirmation button label | "Remove" (pricing) / "Delete" (budget) — matches the distinction already implicit in `AlertRuleForm.tsx`'s delete-confirm pattern (Sheet + `deleteOpen` confirm state); acceptable as single-word labels since the dialog heading above each button already names the object being removed |

---

## Component Inventory (new + edited)

Not part of the template's required sections but load-bearing for the planner/executor — the discretionary decomposition call from `104-CONTEXT.md`.

| Component | Status | Notes |
|-----------|--------|-------|
| `src/components/CostBreakdownTable.tsx` | NEW | Per-(provider, model) table + Unpriced rows, COST-01. Reuses shadcn `Table` primitives (not the raw `<table>` HTML `CostBreakdown.tsx` currently hand-rolls with `ui/table`) — same shadcn table this codebase already imports elsewhere |
| `src/components/UnpricedModelsNudge.tsx` | NEW | Persistent (not permanently-dismissible while gap exists) nudge, D-03. Lives at the top of the Analytics cost cluster, above the `CostForecastPanel`/`SDKSpendGuard` row, so it's visible without scroll |
| `src/components/ModelPricingAdmin.tsx` | NEW | Sheet-based list + CRUD form, mirrors `AlertRuleForm.tsx`'s dirty-tracking / delete-confirm / `toast.success`\`toast.error\` pattern verbatim. Lives in **Settings**, new "Cost & Budgets" tab, below `CostBudgetsAdmin`. **Icon-only row actions (edit/delete) require an explicit `aria-label`** on the button element itself — e.g. `aria-label="Edit pricing rate for {model}"` / `aria-label="Remove pricing rate for {model}"` — mirroring the shipped pattern in `AlertRulesEngine.tsx:158,231,242` (`aria-label="Mute rule"` / `aria-label="Unmute rule"` on its icon-only mute-toggle buttons). Do not ship an icon button with no accessible name. |
| `src/components/CostBudgetsAdmin.tsx` | NEW | Same Sheet-based CRUD pattern, same `aria-label` requirement on icon-only row actions (`aria-label="Edit budget threshold"` / `aria-label="Delete budget threshold"`, same precedent as above). Scope selector (`Select` primitive): Global / Model / Provider / Quota — 4 options per the folded-in D-07 quota threshold (Claude's Discretion resolved: one admin surface, one table, `scope: "quota"` as the 4th value, not a second table + second UI). Same "Cost & Budgets" Settings tab, above `ModelPricingAdmin` — see Visual Focal Point |
| `src/components/CostTrendChart.tsx` | EDIT | Add Billed/Billed+Covered toggle (D-08) to the existing header row, next to the `InfoTooltip`. Fix hardcoded hex (see Color section) |
| `src/components/CostBreakdown.tsx` | EDIT | Fix hardcoded hex only — scope decision from RESEARCH.md Pitfall 3 (whether `costByGoalPeriod` gets D-01's recompute-at-read-time treatment) is a backend/planning call, not a UI-SPEC concern, but if in scope, this component's dollar figures must read the same recomputed values `CostBreakdownTable` does — no second "true" total |
| `src/components/SDKSpendGuard.tsx` | EDIT | D-12 rewires onto the `costBudgets` global-daily row — same visual output, new data source. Sparkline hex → tokens (see Color section) |
| `src/components/CostForecastPanel.tsx` | EDIT | D-19 rewires onto the `costBudgets` global-monthly row — same visual output, new data source |
| Settings "Cost & Budgets" tab | NEW (nav) | New `TabsTrigger`/`TabsContent` in `Settings.tsx`'s existing `Tabs` shell — do not mint a new route; Settings already hosts config-like surfaces (Data Retention, LLM Provider Config, Notification settings) via this exact pattern |

**Placement rationale (resolves "Claude's Discretion" from CONTEXT.md):** cost/spend *display* stays on Analytics (where operators already look for it); cost/budget *configuration* goes on Settings (where every other admin/config surface — retention, notification channels, LLM provider — already lives), keeping both new config forms (pricing + budgets) together in one tab per the CONTEXT.md instruction.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `Table`, `Badge`, `Sheet`, `Tabs`, `Select`, `Input`, `Switch`, `Progress`, `Tooltip`, `Button` — all already installed in `src/components/ui/`, no new installs required | not required |

`components.json` declares `"registries": {}` — no third-party registries configured. No new external packages are introduced by this phase (per `104-RESEARCH.md` "Package Legitimacy Audit" — the gate is explicitly not applicable). If a color-resolution helper is needed for the sparkline-hex fix above, check `src/lib` for an existing `getComputedStyle`-based utility before adding one.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
