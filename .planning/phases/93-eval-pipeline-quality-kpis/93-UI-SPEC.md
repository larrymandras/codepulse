---
phase: 93
slug: eval-pipeline-quality-kpis
status: draft
shadcn_initialized: true
preset: existing (New York) — components.json already present, not re-initialized this phase
created: 2026-07-05
---

# Phase 93 — UI Design Contract

> Visual and interaction contract for the Eval Pipeline & Quality KPIs phase (EVAL-01..03).
> **This phase extends the locked design system from `.planning/phases/071-unified-design-system/UI-SPEC.md` — it does not re-decide tokens, fonts, icon library, or radius.** Everything in this file is either (a) a direct inheritance citation, or (b) a phase-93-specific application of an existing pattern. No new design-system fork is opened here.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (New York) — already initialized (`components.json` present at repo root) |
| Preset | existing — not re-run; reuse installed primitives only (`select`, `badge`, `card`, `separator`, `tooltip` all already present) |
| Component library | Radix (via shadcn) |
| Icon library | Lucide (`lucide-react`), exclusively — per `071-UI-SPEC.md` §4 |
| Font | Geist (body/headings) + JetBrains Mono (labels/mono chrome) — per `071-UI-SPEC.md` §2.7. Cinzel retired, do not reintroduce. |
| Default skin | Dark "Matrix Emerald" (`.dark`), `--primary: #10b981` — all four shipped skins (cyan/emerald/readable/aubergine) must render correctly since color is 100% token-driven |

**No shadcn gate needed** — `components.json` already exists (confirmed via `ls`) and all shadcn primitives this phase needs (`Select`, `Badge`, `Card`/`GlassPanel`, `Separator`, `Tooltip`) are already installed in `src/components/ui/`. No new registry, no new install.

---

## Spacing Scale

Inherited verbatim from `071-UI-SPEC.md` §2.8 (8-point scale, no phase-93 exception):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, badge inline padding |
| sm | 8px | Compact spacing (KPI card internal gaps) |
| md | 16px | Default element spacing, card padding (`p-4`) |
| lg | 24px | Section padding, KPI card padding (`p-5`/`p-6` per `MetricCard`/`OperatorScoreCard` precedent) |
| xl | 32px | Layout gaps between page sections |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none. KPI card grid uses `grid grid-cols-1 md:grid-cols-3 gap-4` (matches `Profiles.tsx` ProfileCard grid, the closest existing per-entity card grid).

---

## Typography

Inherited from `071-UI-SPEC.md` §2.7 de-facto scale — not re-opened. Phase-93 surfaces map onto it as follows:

| Role | Size | Weight | Line Height | Phase-93 usage |
|------|------|--------|-------------|----------------|
| Display | 30px (`text-3xl`) | 500 (medium) | 1.2 | Overall/per-dimension score numbers on KPI cards (matches `MetricCard`/`OperatorScoreCard` value styling) |
| Heading | 24px (`text-2xl`) | 700 (bold) | 1.2 | Page H1 "Quality" |
| Label | 12px (`text-xs`) | 400 mono, uppercase, `tracking-widest` | 1.5 | Card labels, dimension names ("TASK COMPLETION (25%)") — mirrors `SubScoreBar` label convention in `OperatorScoreCard.tsx:59` |
| Body | 16px (`text-base`) / 14px (`text-sm` secondary) | 400 (regular) / 500 (medium, section headers) | 1.5 | Judged-session rows, rationale text, empty/error copy |

Note: the locked system uses 4 effective weights (400/500/600/700) across these roles, not the generic 2-weight guideline — this is inherited from the already-approved Phase 71 contract, not a new decision. Do not introduce a 5th weight.

---

## Color

Inherited verbatim from `071-UI-SPEC.md` §2.2–2.3 — no new tokens needed.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--background)` (`#09090b` dark) | Page background |
| Secondary (30%) | `var(--card)` (`#141416`) / `var(--secondary)` (`#27272a`) | KPI cards, detail panels, sidebar |
| Accent (10%) | `var(--primary)` (`#10b981` Matrix Emerald, theme-driven) | Reserved for: active nav item, persona-card hover border/glow, "improving" trend arrow, primary score digit when score is in the "ok" band |
| Destructive | `var(--destructive)` | Reserved for: regression badge/alert only — never used for a merely-low (but not regressed) score |

**Score color mapping (phase-93-specific application, not a new palette):** reuse `thresholdColor()` from `src/components/MetricCard.tsx` verbatim — do not hand-roll new color logic.

```
thresholdColor(score, { ok: 0.8, warn: 0.5, invertDirection: true })
// score >= 0.8 -> var(--metric-ok)   (green)
// score >= 0.5 -> var(--metric-warn) (amber)
// score <  0.5 -> var(--metric-error) (red)
```

Scores are stored 0–1 (per D-09) but **displayed as 0–100** (`Math.round(score * 100)`), matching the existing `OperatorScoreCard` "`/100`" convention operators already recognize — do not display raw 0–1 decimals in the KPI surface.

Regression badge: `bg-(--status-error) text-white` via `StatusBadge` (add `"regression": { semantic: "error", label: "REGRESSION" }` to its `legacyMap`) — do not invent a new badge component.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | **None** — this is a read-only observability surface (no create/submit action exists in EVAL-01..03). The primary *interaction* is drill-in navigation: persona KPI card is clickable → persona detail (`onClick` cursor + hover glow, same affordance as `MetricCard`/`ProfileCard`). Judged-session rows use a trailing link labeled **"View session →"** (navigates to the existing `SessionDetail.tsx` route). |
| Range control label | Preset `Select` with options **"Last 7 days" / "Last 30 days" / "Last 90 days"**, default **"Last 30 days"** (per D-17). Use `Select` (already installed), not a full date-range `Calendar` — no need to pull in `react-day-picker` for a 3-preset control, and `react-day-picker` is mid-migration in Phase 95 (HARD-04). |
| Empty state — page level (no `evalScores` rows exist anywhere yet) | Heading: **"No quality data yet"**. Body: **"Scores appear here once Ástríðr starts emitting task_quality scores and the nightly judge completes its first run. Check back after the next scheduled run."** |
| Empty state — persona card (persona active, zero judged sessions in selected range) | **"No judged sessions in this range. Try a longer range, or check back after tonight's judge run."** (matches the "No X yet" + next-step convention used across `Briefings.tsx`, `Memory.tsx`, `WarRoom.tsx`) |
| Empty state — judged-sessions list (persona detail) | **"No judged sessions yet for {persona name}."** |
| Error state | Reuse `SectionErrorBoundary` as-is, wrapping each independent widget group (KPI grid, persona detail, judged-session list) with `name="Quality KPIs"` / `name="Persona Detail"` / `name="Judged Sessions"` — inherits the existing "{name} failed to load" + error message + Retry button; no new error copy invented. |
| Destructive confirmation | **None new.** Regression alerts flow through the existing alert engine (`AlertLifecycleActions` — Acknowledge / Mute / Resolve), which already has its own copy contract; this phase does not add a delete/destroy affordance. |
| Regression alert message (new copy, fed into the existing alert engine per D-13) | **"{persona} quality dropped {N} pts after {change type} on {date} ({before} → {after})"** — e.g. "Loki quality dropped 18 pts after a model change on Jul 3 (82 → 64)." `{change type}` is either "a model change" or "an instruction change" depending on which `configChanges`/`profileSwitches` field triggered the window. |
| Regression badge tooltip (on KPI card) | **"Quality regression detected — flagged {date}. See Alerts for details."** (uses existing `InfoTooltip` component) |

---

## Layout Contract (phase-93-specific — new surface, so specified explicitly)

### Page: Quality (`/quality`)

- Nav entry: add to the **OBSERVE** cluster in `src/layouts/DashboardLayout.tsx` `navGroups`, positioned after Alerts: `{ to: "/quality", label: "Quality", icon: "gauge", group: "OBSERVE" }`. Add `gauge: Gauge` (Lucide `Gauge` icon) to the `iconComponents` map — `Gauge` is not yet used elsewhere in the map, avoiding collision with `chart`/`insights`.
- Route: register `<Route path="/quality" element={<Quality />} />` and `<Route path="/quality/:profileId" element={<QualityDetail />} />` in `App.tsx`, lazy-loaded per the existing heavy-page convention (Analytics/Agents pattern).
- Page header: H1 "Quality" (`text-2xl font-bold`) + subtitle (`text-base text-muted-foreground mt-1`): **"Per-persona LLM output quality — judged nightly, tracked over time."**
- Top row: 4 `MetricCard`s (`grid grid-cols-2 md:grid-cols-4 gap-4`, matching `Profiles.tsx` pattern) — Personas Judged, Sessions Judged (range), Active Regressions (severity="critical" if >0), Avg Overall Score (formatted `/100`, `threshold` wired to the mapping above).
- `SectionHeader` "Per-Persona Quality" with the range-preset `Select` as its `action` slot (right-aligned, matches `SectionHeader`'s existing `{title, action}` contract).
- KPI card grid (`grid grid-cols-1 md:grid-cols-3 gap-4`): one card per active persona, following the `OperatorScoreCard` visual pattern precisely —
  - Score digit (`text-3xl font-bold tabular-nums`, colored via `thresholdColor`) + `/100` suffix (`text-lg text-muted-foreground font-normal opacity-50`)
  - Inline `Sparkline` (last N days of overall score, color = current threshold color)
  - Delta badge vs. previous period (`▲`/`▼`/`→` glyph + signed point delta, green/red/muted text per direction — mirror `OperatorScoreCard`'s `DAY_ARROWS`/`WEEK_ARROWS` pattern, adapted to "vs previous {range}")
  - Regression badge (`StatusBadge status="regression"`) shown only when an active flag exists for that persona
  - Card is a `glow-card` (`GlassPanel`-equivalent), `onClick` → `/quality/:profileId`, hover border/glow per existing `MetricCard`/`OperatorScoreCard` hover treatment
  - Empty-state variant (per-card): if zero judged sessions in range, render the "No judged sessions in this range" copy in place of the score, no sparkline

### Page: Persona Quality Detail (`/quality/:profileId`)

- Header: persona name (H1) + "back to Quality" breadcrumb link (reuse whatever back-nav convention `SessionDetail.tsx` already uses).
- Full trend chart: Recharts `LineChart` via the existing `ChartContainer`/`ChartConfig` wrapper (`src/components/ui/chart.tsx`), following the `CompletionRateChart.tsx` pattern exactly — one line per dimension + one for overall, colored via `--chart-1..5` tokens, `strokeWidth={2}`, `dot={false}`. X-axis = date, Y-axis domain `[0, 100]`. Change-event markers (profile switches / config changes) render as `ReferenceLine` verticals with a small label — do not invent a new chart primitive for this.
- Per-dimension breakdown: reuse `SubScoreBar` styling from `OperatorScoreCard.tsx` (label + weight-or-count + horizontal bar), one row per rubric dimension.
- Judged-sessions list: `EntityRow` per judged session — `primary` = session summary/date, `secondary` = judge rationale (truncated), `trailing` = "View session →" link. Empty state per Copywriting Contract above.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `select`, `badge`, `card`, `separator`, `tooltip` (all already installed, no new install this phase) | not required — pre-existing, no new fetch |
| third-party | none declared | not applicable |

No third-party registry blocks are used in this phase. No registry vetting gate required.

---

## Assumptions Made (no interactive user session available — resolved from CONTEXT.md + existing codebase conventions)

1. **Score display scale**: stored 0–1, displayed 0–100 (`/100`), matching `OperatorScoreCard` convention. If Larry prefers raw 0–1 or a different scale on review, this is a one-line format-function change, not a layout change.
2. **Score color thresholds** (ok ≥0.8, warn ≥0.5, error <0.5, invertDirection): chosen conservatively per Larry's standing zero-false-positive/precision bias; independent of the regression-detection thresholds in CONTEXT.md D-12/D-14, which remain Claude's discretion for the planner to set as code constants.
3. **Range control = 3-preset Select, not a Calendar/date-range picker** — avoids pulling `react-day-picker` into this phase while HARD-04 (v9→v10 migration) is still pending in Phase 95.
4. **Nav icon** = Lucide `Gauge`, added fresh to `iconComponents` (not previously used in the map).
5. **Drill-in = separate route** (`/quality/:profileId`), not an inline expand — matches the existing `SessionDetail.tsx` separate-page precedent for entity drill-ins elsewhere in the app.
6. **"Active persona"** for the KPI grid = personas with a `profileConfigs` row (mirrors `Profiles.tsx`'s existing profile-list derivation), not all-time historical personas.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
