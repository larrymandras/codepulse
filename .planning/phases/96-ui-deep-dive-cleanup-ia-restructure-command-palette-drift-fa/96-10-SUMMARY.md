---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 10
subsystem: ui-consistency
tags: [tokens, a11y, page-header, typed-convex, dead-code]
dependency-graph:
  requires: [96-01]
  provides: [F7-KG-migration, F7-ToolGalaxy-migration, F10-DocComments-tokens, F10-ThemeSwitcher-a11y, F10-BuildProgress-typed, F9-Analytics-dead-ui]
  affects: [src/pages/DocComments.tsx, src/components/ThemeSwitcher.tsx, src/pages/KnowledgeGraph.tsx, src/pages/ToolGalaxy.tsx, src/pages/BuildProgress.tsx, src/pages/Analytics.tsx]
tech-stack:
  added: []
  patterns: ["PageHeader icon+title(ReactNode)+InfoTooltip fold-in", "token classes over raw zinc-*/emerald-* palette", "typed Convex Doc<table> flowing through props without as-any"]
key-files:
  created: []
  modified:
    - src/pages/DocComments.tsx
    - src/components/ThemeSwitcher.tsx
    - src/pages/KnowledgeGraph.tsx
    - src/pages/ToolGalaxy.tsx
    - src/pages/BuildProgress.tsx
    - src/pages/Analytics.tsx
decisions:
  - "DocComments author field: hardcoded \"larry\" replaced with the already-in-scope profileId (from useProfileConfigs()[0]), removing the hardcoded personal literal (T-96-10-02)"
  - "DocComments doc_type left as literal \"gsd_spec\" — DocRef.doc_type in docCommentsApi.ts is typed as the literal \"gsd_spec\" (not a variable), so there is no loaded-doc source to swap in; noted per plan instruction"
  - "KG/ToolGalaxy bg-[#09090b] -> bg-background per plan's explicit instruction (closest semantic token; exact hex differs slightly from --background under the default cyan theme (#040405) but this removes the raw-hex violation in favor of the token system, matching CLAUDE.md's never-hardcode-hex rule)"
  - "Analytics errorTrend query removed entirely rather than wired into ErrorRateTrend — ErrorRateTrend.tsx takes no props and fetches its own data; accepting a prop would require modifying that component, which is outside this plan's files_modified scope"
  - "Analytics duplicate LlmProviderPanel: only one render was found in the current file (grep confirmed count=1) — no change needed, verification criterion already satisfied"
metrics:
  duration: "~35 min"
  completed: 2026-07-13
---

# Phase 96 Plan 10: UI Deep-Dive Cleanup — Token/A11y Minors, KG/ToolGalaxy Header Migration, BuildProgress Typing, Analytics Dead UI Summary

DocComments moved off raw zinc-*/emerald-* palette classes onto CSS-variable tokens and gained a `<PageHeader>`; ThemeSwitcher's SelectTrigger gained an accessible name; KnowledgeGraph and ToolGalaxy both migrated their bespoke `<h1>` to the shared `<PageHeader icon title>` component (icon + InfoTooltip preserved) and swapped their raw `bg-[#09090b]` for `bg-background`; BuildProgress dropped all three `as any` prop casts plus the `c: any` filter callback in favor of typed Convex `Doc<>` results flowing straight into child components; Analytics lost its always-zero `TokenSavingsIndicator` and its fetched-but-discarded `errorTrend` query.

## Tasks Completed

### Task 1: DocComments tokens + header; ThemeSwitcher aria-label; KG/ToolGalaxy bg token + PageHeader migration
Commit: `62a587f`

- `src/pages/DocComments.tsx`: `border-zinc-800` → `border-border`; `bg-emerald-500/15 text-emerald-300` → `bg-primary/15 text-primary`; `text-zinc-300 hover:bg-zinc-900` → `text-muted-foreground hover:bg-card`; `text-zinc-500` → `text-muted-foreground`; added `<PageHeader title="Doc Review" />` above the 3-column layout; replaced hardcoded `author: "larry"` with the already-resolved `profileId`.
- `src/components/ThemeSwitcher.tsx`: added `aria-label="Select theme"` to the `SelectTrigger` (Radix passes ARIA props straight through).
- `src/pages/KnowledgeGraph.tsx`: bespoke `<h1 className="text-2xl font-bold flex items-center gap-2">` migrated to `<PageHeader icon={Share2} title={<>KG Explorer <InfoTooltip .../></>} />`; `bg-[#09090b]` on the empty-state panel replaced with `bg-background`.
- `src/pages/ToolGalaxy.tsx`: same migration with `icon={Boxes}` / title "Tool Galaxy"; `bg-[#09090b]` on the canvas container replaced with `bg-background` (the decorative gradient's `via-[#09090b]` stop was left untouched — it's a gradient stop, not a `bg-` background utility, and out of the plan's grep-verified scope).

### Task 2: Remove Analytics dead UI
Commit: `465b1e4`

- Removed `TokenSavingsIndicator` import and its always-zero `savedTokens={0} totalTokens={0}` render.
- Removed the `errorTrend` aggregate query (`api.aggregates.errorTrendByPeriod`) and its `void errorTrend;` suppression line — `ErrorRateTrend` fetches its own data and accepts no props, so there was no in-scope way to "wire it in" without touching a file outside this plan's `files_modified` list.
- Confirmed via grep that only one `<LlmProviderPanel />` render exists in the current file — the "duplicate" flagged in FINDINGS.md was already resolved by an earlier commit; no further change needed.

### Task 3: Type BuildProgress Convex access (drop the `as any` casts)
Commit: `d6fbb1a`

- Removed `c: any` from the `completedCount` filter callback — TypeScript now infers the array element type from the typed `useQuery` result.
- Removed all three `as any` casts: `TeamStatusCards components={components} pipelines={pipelines}`, `BuildActivityFeed entries={activity}`, `ComponentTable components={components}`.
- Verified structurally: `api.build.phaseProgress`/`api.build.recentActivity` return `buildProgress` table docs (`{ _id, component, phase, status, progress?, message?, updatedAt, ... }`) which satisfy both `TeamStatusCardsProps.components`, `ActivityEntry[]`, and `ComponentRow[]`; `api.pipelines.listAll` returns `pipelineExecutions` docs which satisfy `{ name: string; status: string }`. No child interface changes were needed — the Convex return types already structurally match.

## Deviations from Plan

None — plan executed as written. Two items called out in the plan's interface notes as "confirm/decide" were resolved as documented in the frontmatter `decisions` above (bg-background token choice, errorTrend removal vs. wiring, doc_type left as-is, duplicate LlmProviderPanel already absent).

## Known Stubs

None introduced by this plan.

## Threat Flags

None — the only trust-boundary-relevant change (BuildProgress typed Convex access) was already covered by the plan's `<threat_model>` (T-96-10-03) and closes that gap rather than opening new surface.

## Self-Check: PASSED

- FOUND: src/pages/DocComments.tsx (PageHeader import + render present, no zinc-*/emerald-* remaining)
- FOUND: src/components/ThemeSwitcher.tsx (aria-label="Select theme" present)
- FOUND: src/pages/KnowledgeGraph.tsx (PageHeader present, bg-[#09090b] removed)
- FOUND: src/pages/ToolGalaxy.tsx (PageHeader present, bg-[#09090b] removed)
- FOUND: src/pages/BuildProgress.tsx (no `as any` / `: any` remaining)
- FOUND: src/pages/Analytics.tsx (no TokenSavingsIndicator, no void errorTrend, exactly 1 LlmProviderPanel render)
- FOUND commit 62a587f in `git log --oneline`
- FOUND commit 465b1e4 in `git log --oneline`
- FOUND commit d6fbb1a in `git log --oneline`
- `npx tsc --noEmit` exits clean after all three tasks
