# 122 — A11Y-01 Contrast Baseline

Raw per-cell axe violation JSON committed alongside this file at `a11y-before/*.json` (20 files,
one per theme x page cell). This document is derived from those files; every number below was
re-computed from the committed JSON, not transcribed from a test log or from an earlier
measurement.

## BEFORE (control, measured 2026-08-18, git `7b74a7fe` -- pre-token-layer)

Measured against `dev:noauth` (`:5181`, Clerk gate disabled) via
`A11Y_CAPTURE_DIR=... A11Y_MEASURE_ONLY=1 PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts`,
issued from Git Bash. 20/20 cells measured, zero skipped.

**Unit: these are axe VIOLATION OBJECTS (one per distinct rule that fired on a page), not
violating ELEMENTS.** A single violation object commonly covers several DOM nodes -- e.g.
`[cyan] Dashboard`'s one `color-contrast` object covers 4 sidebar/header elements. Where an
element count is useful it is given separately below, labelled `nodes`, derived as the sum of
`violations[].nodes.length` per cell -- never added to the violation-object count.

### Violation objects per cell

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs | row total |
|---|---|---|---|---|---|---|
| cyan | 1 | 1 | 1 | 2 | 1 | **6** |
| emerald | 1 | 1 | 1 | 2 | 1 | **6** |
| readable | 1 | 1 | 1 | 2 | 1 | **6** |
| aubergine | 1 | 1 | 1 | 2 | 1 | **6** |
| **column total** | **4** | **4** | **4** | **8** | **4** | **grand total: 24** |

Grand total re-derived independently two ways -- summing `violationCount` across the 20 committed
JSON files (`24`), and summing the two rule buckets in the breakdown below (`20 + 4 = 24`) -- both
agree.

### Affected elements (nodes), same cells, different unit

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs | row total |
|---|---|---|---|---|---|---|
| cyan | 4 | ~ | ~ | ~ | ~ | see per-file JSON |
| all 20 cells, summed | | | | | | **218 nodes** |

`[cyan] Dashboard` alone: **4 nodes** across its 1 violation object. This is the same cell the
2026-08-10 sample in `SEED-006-wcag-contrast-remediation.md` reported at **234** -- same rule
(`color-contrast`), same `fgColor`/`bgColor` pair (`#067082` on `#060608`), same affected
component (the sidebar nav). The 234 figure was a NODE count taken before Phase 120's quiet-badge
and contrast work landed; this run's 4-node figure is the same measurement point, after. Addressed
explicitly per D-24's own instruction not to let this look like a coincidence: it is not a
coincidence, it is the same violation shrinking by two orders of magnitude, consistent with
`120-DESIGN-REVIEW-HANDOFF.md`'s independently-measured finding that "the quiet-badge law improved
contrast on every badge it touched." The grand total this run measures (24 violation objects / 218
nodes) is **not** "234" and should not be read as confirming or contradicting that figure --
they are different units from different points in time on different (though overlapping) surfaces.

## Rule breakdown (before)

Grouped by axe rule `id` across all 20 cells:

| rule id | impact | violation objects | affected nodes | what it is |
|---|---|---|---|---|
| `color-contrast` | serious | 20 | 214 | Foreground/background contrast below the WCAG AA threshold. Fires once per theme x page in all 20 cells; the sample element (sidebar nav labels, header pills) repeats across pages because it is shared app-shell chrome, not per-page content. |
| `aria-prohibited-attr` | serious | 4 | 4 | `[Forge]` only, all 4 themes. A loading-state `<div aria-busy="true" aria-label="Loading jobs">` -- `aria-label` is not a permitted attribute on a plain `div` with no ARIA role. Unrelated to the token/colour work; a markup fix (add a role or move the label), not a palette fix. |

Both rules are `impact: serious`; zero `critical`/`moderate`/`minor` violations were reported in
this run.

## Sampling limit (D-24)

A11Y-01's locked matrix measures **5 of 47** source page files in `src/pages/` (**5/47 ≈ 10.6%**).

Denominators re-derived live, same method as `122-CONTEXT.md`'s D-24 correction:
- `ls src/pages/*.tsx | grep -v '\.test\.' | wc -l` → **42** (top-level pages)
- `ls src/pages/*/*.tsx | grep -v '\.test\.' | wc -l` → **5** (`src/pages/hr/`; `src/pages/__tests__/`
  correctly excluded, it is a test directory)
- **42 + 5 = 47**, the unit is FILES.
- Control: the same top-level glob *including* test files returns **62** -- the figure D-18's own
  note warns against propagating. Not used here.

### The 5 measured routes (mapped from `e2e/theme-contrast.spec.ts` PAGES to their component file
via `src/App.tsx`'s route table)

| spec name | route | component file |
|---|---|---|
| Dashboard | `/` | `src/pages/Dashboard.tsx` |
| LiveRun | `/live-run` | `src/pages/LiveRun.tsx` |
| Analytics | `/analytics` | `src/pages/Analytics.tsx` |
| Forge | `/forge` | `src/pages/ForgePage.tsx` |
| Graphs | `/graphs` | `src/pages/GraphsHub.tsx` |

### The 42 unmeasured page files (named individually per D-24 -- no "and others")

Top-level (`src/pages/`, 37 of the 42 top-level files not already in the table above):

- src/pages/Alerts.tsx
- src/pages/Automation.tsx
- src/pages/Bifrost.tsx
- src/pages/Briefings.tsx
- src/pages/BuildProgress.tsx
- src/pages/Capabilities.tsx
- src/pages/Chat.tsx
- src/pages/ConfigPage.tsx
- src/pages/DocComments.tsx
- src/pages/Dreaming.tsx
- src/pages/Executions.tsx
- src/pages/Galdr.tsx
- src/pages/HivePage.tsx
- src/pages/Ideation.tsx
- src/pages/Inbox.tsx
- src/pages/Infrastructure.tsx
- src/pages/InsightsChat.tsx
- src/pages/KnowledgeGraph.tsx
- src/pages/Loom.tsx
- src/pages/McpInventory.tsx
- src/pages/MeetingBot.tsx
- src/pages/Memory.tsx
- src/pages/Quality.tsx
- src/pages/QualityDetail.tsx
- src/pages/Reminders.tsx
- src/pages/Security.tsx
- src/pages/SelfHealing.tsx
- src/pages/SessionDetail.tsx
- src/pages/Settings.tsx
- src/pages/Skills.tsx
- src/pages/Studio.tsx
- src/pages/Tasks.tsx
- src/pages/ToolGalaxy.tsx
- src/pages/Tools.tsx
- src/pages/WarRoom.tsx
- src/pages/WhatsApp.tsx
- src/pages/WorkspaceMap.tsx

Subdirectory (`src/pages/hr/`, all 5):

- src/pages/hr/AgentAnalytics.tsx
- src/pages/hr/Catalog.tsx
- src/pages/hr/Onboarding.tsx
- src/pages/hr/Roster.tsx
- src/pages/hr/Teams.tsx

37 + 5 = 42 unmeasured, + the 5 measured = 47 total. Any one of these 42 can hold a WCAG-AA
violation invisible to Phase 123's "zero violations across every cell A11Y-01 measured" success
criterion -- that criterion is honest about the 5 cells it covers and silent about the other 42.

`amber` (the 5th defined theme) is out of the matrix by D-04: it has no entry in `ThemeSwitcher`
and is unreachable from any rendered page, so it cannot be measured against one. This is a
themes-axis exclusion, orthogonal to the pages-axis sampling limit above -- even if all 47 pages
were measured, `amber` would still be absent because it is not a selectable theme, not because a
page was skipped.

## AFTER -- PENDING

Filled by plan **122-19**, after the token layer and the mechanical sweeps land.

## Delta -- PENDING

Filled by plan **122-19**. Read against this BEFORE table as the control.

## Named-pair ratios -- PENDING

Filled by plan **122-18**: the D-22 rasterised `canvas`/`getImageData` probe for Forge `failed`
(currently `bg-red-900/60 text-[var(--status-error)]`, measured at 3.92:1 against the page
background per `120-DESIGN-REVIEW-HANDOFF.md`, re-measured against `--card` per D-06) and the
`--status-ok`/`--primary` decouple (D-05), both measured against `--card` per D-06's instruction.

## Method

axe-core (`@axe-core/playwright` `4.12.1`, `wcag2a`/`wcag2aa` tags) resolves colour itself from the
live rendered DOM/CSSOM -- it never parses a `getComputedStyle` colour string, so it is immune to
the `oklch()`/`oklab()` hue-angle-read-as-blue-channel trap that produced Phase 120's withdrawn
numbers (`[[tailwind-v4-oklch-defeats-css-color-scraping]]`). No computed colour string was parsed
anywhere in producing this document; every figure above comes from `results.violations` as returned
by `AxeBuilder#analyze()`.

Invocation (from Git Bash, per `CLAUDE.md`'s PowerShell empty-env-var warning):

```
VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth
# separate terminal, once the above answers on :5181
A11Y_CAPTURE_DIR=.planning/phases/122-tokens-primitives-contrast-measurement/a11y-before \
A11Y_MEASURE_ONLY=1 \
PW_BASE_URL=http://localhost:5181 \
npx playwright test e2e/theme-contrast.spec.ts
```

`dev:noauth` = `vite --port 5181 --strictPort --host 127.0.0.1` (never drop `--host 127.0.0.1`
-- `vite.config.ts`'s `server.host:true` would otherwise bind this auth-disabled server to the
LAN/tailnet). Server probed on both `localhost:5181` and `127.0.0.1:5181` (200/200) before the
matrix ran, and stopped after. Wall-clock for the 20-cell matrix: **14.3s** (Playwright's own
reported run time).

Control proving the `fee96b5d` gate guard still fires: one cell (`[cyan] Dashboard`) re-run against
the gated `:5173` server reported Playwright status `skipped` with annotation
`"Clerk auth gate present — Dashboard never rendered..."` -- not passed, not failed. This proves
the 20 captures above came from a genuinely keyless server rather than from a guard that stopped
working.
