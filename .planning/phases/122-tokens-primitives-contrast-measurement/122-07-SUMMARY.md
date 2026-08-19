---
phase: 122-tokens-primitives-contrast-measurement
plan: 07
subsystem: ui
tags: [tailwind, tokens, design-system, react, motion, contrast, violet-adjudication, shadcn]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "src/index.css token layer (--surface-0/1/2/3, --hairline, --astridr, --status-*, --duration-*, --ease-house) from plans 122-01/122-02/122-03"
provides:
  - "30 files in src/components/ (T-Z plus graph/, hr/, skills/, ui/) fully converted to the token vocabulary: zero raw palette classes, zero surface hex literals, zero duration-NNN classes, zero raw violet utilities"
  - "sweep-ledgers/122-07-LEDGER.md: per-file before/after counts and per-site adjudication for slice D, including the phase's densest hr/ agent-tier-enum violet cluster and the shadcn alias-boundary proof for the four ui/ primitives"
affects: [122-09-ratchet, 122-10-badge-law]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A tier/role enum shared across multiple files (hr/'s command/domain/shared agent-tier badge, same map re-declared in 5 files) is adjudicated ONCE against the shared data model, not per file -- confirmed via useRosterAgents.ts/astridrApi.ts that no per-agent Astridr-identity flag exists, so the whole enum re-hues to --primary rather than any slot converting to --astridr"
    - "A solid bg-X + hardcoded text-white pairing cannot be swapped to a theme-variable background (bg-muted) without also decoupling the text color per key -- --muted is near-white in the light :root theme (oklch 0.97), so a blanket text-white sibling class would break contrast there; fixed the RosterOrgChart.tsx consumer by bundling text color into the per-key map value"
    - "A raised floating detail-overlay card positioned over a 3D/canvas view (bg-zinc-950/85, role=dialog) maps to bg-popover, same as any other raised/popover surface -- the 'floats over a canvas' framing doesn't change its role"
    - "A discrete draggable card whose hover behavior solidifies (not lightens) its own base tone -- bg-X/60 -> hover:bg-X full opacity -- maps to bg-card/60 -> hover:bg-card, preserving the opacity-based hover mechanic rather than substituting the usual surface-3 raise"
    - "Two duration-NNN classes on the same className string need only ONE ease-house appended (transition-timing-function is a single property; multiple transition-property declarations on one element share it)"
  patterns-established: []

key-files:
  created:
    - .planning/phases/122-tokens-primitives-contrast-measurement/sweep-ledgers/122-07-LEDGER.md
  modified:
    - src/components/TeamStatusCards.tsx
    - src/components/TokenSunburst.tsx
    - src/components/TokenWaterfall.tsx
    - src/components/ToolExecutionPanel.tsx
    - src/components/UserMenu.tsx
    - src/components/VersionHistory.tsx
    - src/components/WarRoomKanbanColumn.tsx
    - src/components/WarRoomTaskCard.tsx
    - src/components/graph/CodeVaultGraph.tsx
    - src/components/graph/ForceGraph3D.tsx
    - src/components/graph/ForceGraphCanvas.tsx
    - src/components/hr/AgentCard.tsx
    - src/components/hr/AgentDetailSheet.tsx
    - src/components/hr/CatalogCard.tsx
    - src/components/hr/RosterOrgChart.tsx
    - src/components/hr/RosterTable.tsx
    - src/components/hr/TeamCard.tsx
    - src/components/hr/TeamEditor.tsx
    - src/components/hr/detail/DetailActivityTab.tsx
    - src/components/hr/detail/DetailConfigTab.tsx
    - src/components/hr/detail/DetailVersionsTab.tsx
    - src/components/skills/RunAstridrPopover.tsx
    - src/components/skills/vault/ClusterDetailCard.tsx
    - src/components/skills/vault/SkillKanbanView.tsx
    - src/components/skills/vault/SkillVaultDetailCard.tsx
    - src/components/skills/vault/SkillVaultView.tsx
    - src/components/ui/accordion.tsx
    - src/components/ui/alert-dialog.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/sheet.tsx

key-decisions:
  - "The plan's own claim that the four ui/ primitives (accordion, alert-dialog, dialog, sheet) 'still carry a raw palette or hex class' is false against the live tree -- measured 0/0 for all four, individually and combined; Task 2 made zero conversions there, recorded as a plan-prose correction rather than silently no-op'd"
  - "hr/'s command/domain/shared agent-tier enum (shared identically across AgentCard, AgentDetailSheet, RosterOrgChart, RosterTable, TeamEditor) has NO per-agent Astridr-identity flag in its data model (useRosterAgents.ts/astridrApi.ts) -- every agent in the roster is already Astridr's, so tagging only the command slot --astridr would misleadingly single it out. All 5 sites re-hued to --primary; 0 converted to --astridr, directly contradicting the plan's own orientation text which predicted the opposite"
  - "hr/detail/'s two independent categorical-tag sites (DetailActivityTab's eventTypeColors.handoff, DetailVersionsTab's CHANGE_TYPE_COLORS.clone) are unrelated to the tier enum and to each other -- each is a file-local fixed-key category with no cross-file relationship -- both re-hued to indigo, matching slice C's OriginBadge precedent for a categorical tag needing a hue outside the reserved violet family"
  - "RosterOrgChart.tsx's TIER_COLOR/text-white pairing was restructured to bundle text color per tier-key rather than leave a blanket text-white wrapper, because pairing the new bg-muted (shared tier) with hardcoded white text would produce unreadable white-on-near-white in the light :root theme, which has no surface-ramp override; AgentDetailSheet/RosterTable/TeamEditor's solid command-tier fills got the correct --primary-foreground pairing token instead of a hardcoded color"
  - "CatalogCard.tsx and TeamCard.tsx (5 and 3 motion occurrences) were not in the plan's indicative Task 3 file list but held live duration-300/500 literals against the re-derived population -- converted per the plan's own 'the ledger is authoritative' instruction, without touching the Phase-120-sanctioned surviving hover:-translate-y-1 transforms on the same elements"
  - "bg-[#09090b] canvas-container chrome (CodeVaultGraph x4, ForceGraph3D, ForceGraphCanvas, SkillVaultView) converted to bg-background, following the identical precedent slice C's ObsidianGraph.tsx established for the same role; the node/edge/skill accent colors passed as JS hex strings via inline style props were confirmed out of the hex bucket's scope by construction (className-only regex), not merely left alone"
  - "border-white/N, bg-white/[N], and bg-black/50 sites (skills/vault glass-card family, the three ui/ dialog/sheet overlay scrims) left untouched throughout -- neither white nor black is in the neutral palette family D-02 measured, consistent with every prior slice's identical exemption"

requirements-completed: [TOKEN-01, TOKEN-02, TOKEN-03]

# Metrics
duration: ~65min
completed: 2026-08-19
---

# Phase 122 Plan 07: Sweep Slice D (src/components/ T-Z, graph/, hr/, skills/, ui/) Summary

**30 components swept clean of every hardcoded surface, motion literal and raw violet utility -- 98 palette + 7 hex + 25 motion + 10 violet occurrences all converted, with the phase's densest hr/ agent-tier-enum violet cluster (5 files sharing one command/domain/shared enum) adjudicated as 0 --astridr conversions against the live data model, directly correcting the plan's own prediction, and the four shadcn ui/ primitives confirmed to already hold zero raw literals against the live tree.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-08-19T09:58:00Z (approx, first population-derivation command)
- **Completed:** 2026-08-19T10:09:00Z (Task 3 commit) + summary/self-check
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 30 components + 1 ledger

## Accomplishments
- Re-derived slice D's four-bucket population directly from the corpus (`grep -oE` occurrence counts), with all four matchers proven against known-positive controls (`ForceGraph3D.tsx` hex, `RosterTable.tsx` violet, `TokenSunburst.tsx` palette, `AgentCard.tsx` motion) before trusting any zero -- population matched the plan's 30-file list exactly, no files added or removed.
- Found and recorded three plan-prose corrections during population re-derivation: the four `ui/` primitives hold zero raw literals against the live tree (not the "four still carry" the plan's `<interfaces>` text claimed); the `--astridr` convention lives in `MemorySourceBadge.tsx`, not `StatusBadge.tsx:22-27` as cited; and the `CatalogCard`/`TeamCard` transform-survivor citation is in `120-DESIGN-REVIEW-HANDOFF.md`, not `120-SANCTIONED-PATTERNS.md` as cited (the underlying claim held, only the file pointer was wrong).
- Converted all 98 palette + 7 hex occurrences via per-file, role-based adjudication -- never a batch substitution. The 7 hex sites were all the identical `bg-[#09090b]` canvas-container chrome literal across 4 graph/vault files, converted to `bg-background` following slice C's `ObsidianGraph.tsx` precedent; confirmed the `MODEL_COLORS`/`CONTAINER_ACCENT` JS hex strings (consumed via inline `style` props) were never in the hex bucket's scope by construction.
- Traced hr/'s shared `command`/`domain`/`shared` tier enum to its data model (`useRosterAgents.ts`, `astridrApi.ts`) before adjudicating -- confirmed no per-agent Astridr-identity flag exists, so all 5 `command`-tier violet sites (spanning `AgentCard`, `AgentDetailSheet`, `RosterOrgChart`, `RosterTable`, `TeamEditor`) re-hued to `--primary` as one coherent verdict, not 5 independent guesses. Fixed a latent contrast bug this exposed in `RosterOrgChart.tsx` (a blanket hardcoded `text-white` that would have paired badly with the new `bg-muted` shared-tier fill in the light theme) by decoupling text color per tier key.
- Adjudicated 2 further violet sites in `hr/detail/` as independent categorical tags (not part of the tier enum), re-hued to indigo matching slice C's `OriginBadge.tsx` precedent.
- Converted all 25 motion occurrences across 12 files (8 sites >= 400ms, audited and recorded per the rule), including `CatalogCard.tsx`/`TeamCard.tsx` which held live motion literals despite not being in the plan's indicative Task 3 list, and all four `ui/` primitives (every accordion, dialog, alert-dialog and sheet in the app now eases on the house curve).
- Zero regressions: `npx tsc --noEmit` and `npm run build` both exit 0; `npx vitest run src/components/graph` passed 48/48; full suite held at 4772 passed / 0 failed against the recorded pre-plan baseline.
- Positive proof for the motion conversion: the built stylesheet contains `.duration-fast{}`, `.duration-normal{}`, `.duration-slow{}`, `.ease-house{}` by fixed-string search, with a bogus `.duration-nonsense-9x7q2{}` control absent.
- D-01 shadcn alias boundary proven, not assumed: the four `ui/` files' `bg-popover`/`bg-card`/`border-border` count stayed at its 0 baseline through both tasks (nothing existed to preserve, since the plan's premise was false) -- explicitly checked rather than skipped.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-derive slice D's population and open the ledger** - `bdea7326` (docs)
2. **Task 2: Convert every palette class and hex literal in slice D** - `30d8b676` (feat)
3. **Task 3: Convert slice D's motion literals and adjudicate the hr violet cluster** - `f5802a76` (feat, includes the ledger AFTER-table and adjudication completion)

_No separate plan-metadata commit -- this SUMMARY commit (below) serves that role, per the
orchestrator's shared-artifact-ownership instruction that state/roadmap files are out of scope
for this executor._

## Files Created/Modified
- `sweep-ledgers/122-07-LEDGER.md` - BEFORE/AFTER four-bucket population table (30 rows), the D-01 alias-boundary baseline, matcher controls (re-verified against the final working tree), and full per-site adjudication for slice D.
- 30 `src/components/*.tsx` files (T-Z, `graph/`, `hr/`, `skills/`, `ui/`) - every raw palette class, surface hex literal, `duration-NNN` class and raw violet utility converted to the token vocabulary; see the ledger for the per-file role mapping and per-site violet reasoning.

## Decisions Made
- **hr/'s command/domain/shared tier enum re-hued to `--primary`, not `--astridr`, across all 5 sharing files.** Traced to the data model (`useRosterAgents.ts:112`, `astridrApi.ts:92`) before adjudicating rather than converting on the plan's expectation. This is the single most consequential finding of the slice: the plan's own orientation text predicted the opposite verdict for exactly this cluster.
- **RosterOrgChart.tsx's tier-badge text color decoupled from a blanket `text-white` into per-key pairing.** A genuine accessibility fix surfaced by the palette conversion, not scope creep -- `--muted` (the `shared` tier's new fill) is near-white in the light `:root` theme, which has no surface-ramp override, so the old unconditional white text would have been invisible there.
- **`hr/detail/`'s two categorical-tag violet sites adjudicated independently of the tier enum**, confirming the per-site discipline rather than pattern-matching by directory name: same `hr/` subtree, same violet hue family, different underlying data (file-local enums vs. app-wide shared roster state), different but individually correct verdicts (both indigo, for unrelated reasons than the tier sites' `--primary`).
- **The four `ui/` primitives left untouched in Task 2**, with the plan's contrary claim recorded as a correction rather than silently ignored -- their content panels already use the `bg-background` semantic alias (not a raw literal) and their border utilities carry no explicit color class.
- **`bg-[#09090b]` canvas chrome converted to `bg-background`** across all 4 graph/vault-canvas files as one consistent verdict (identical literal, identical role), following slice C's `ObsidianGraph.tsx` precedent rather than treating each file as a fresh judgment call.

## Deviations from Plan

None requiring Rule 1-4 classification for the sweep itself. One Rule 2-adjacent fix applied during
the violet adjudication: **RosterOrgChart.tsx's tier badge text color, previously a single hardcoded
`text-white` applied unconditionally to all three tiers, was decoupled into per-key pairing** to
prevent a latent light-theme contrast failure that the `shared` tier's `bg-gray-600` -> `bg-muted`
conversion would otherwise have introduced (white text on `oklch(0.97 0 0)`, near-invisible). This
is essential-functionality correctness (Rule 2: the badge must remain legible in every theme this
phase's token layer targets), applied inline rather than deferred, and documented in the ledger.
Three corrections to the plan's own prose are documented above and in the ledger (the four `ui/`
files' false "still carry a raw literal" premise; the `StatusBadge.tsx` vs. `MemorySourceBadge.tsx`
citation; the `120-SANCTIONED-PATTERNS.md` vs. `120-DESIGN-REVIEW-HANDOFF.md` citation; and the
hr/ tier-enum's predicted-vs-actual `--astridr` verdict) -- all are the plan's own "decide from the
code" instruction being followed, not defects in the plan's actual task instructions.

## Issues Encountered

None. No editing mistakes, no test failures introduced, no auth gates, no checkpoints.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Slice D (30 files, `src/components/` T-Z plus `graph/`, `hr/`, `skills/`, `ui/`) is fully
  token-clean across all four buckets (palette, hex, motion, violet), verified by both the specific
  matchers and out-of-slice controls (`KnowledgeGraph.tsx`, `ToolGalaxy.tsx`, `Capabilities.tsx`,
  `Memory.tsx`, `MetricCard.tsx`) proving each matcher discriminates, re-checked against the final
  working tree after all edits landed.
- `sweep-ledgers/122-07-LEDGER.md` is a complete, self-contained record (matchers, controls,
  before/after tables, D-01 alias-boundary proof, full adjudication) consistent with slices A/B/C's
  format, for plan 122-08's sibling slice and 122-09's ratchet to build against.
- No blockers. `src/index.css` (the token layer) was not touched, per the plan's explicit
  prohibition. No files outside the 30-file slice were touched. `.planning/STATE.md` and
  `.planning/ROADMAP.md` were not touched, per the orchestrator's shared-artifact-ownership
  instruction. Verified via `git show --stat HEAD` across all three commits in this plan -- no
  unexpected files from a concurrent session.
- `WarRoomTaskCard.tsx` is flagged by the orchestrator as also owned by plan 122-10 (badge law,
  wave 4, later). This plan's edits to it were strictly confined to its own two buckets (a single
  `duration-300` -> `duration-slow ease-house` motion conversion) -- no palette/hex/violet work
  landed there since it held none, leaving a clean base for 122-10.
- Control files outside this slice (`KnowledgeGraph.tsx`, `ToolGalaxy.tsx`, `Capabilities.tsx`,
  `Memory.tsx`, `MetricCard.tsx`) still hold unconverted classes in their respective buckets as
  expected -- confirms slice 122-08 has real, disjoint work remaining and this plan did not
  accidentally encroach on it.

---
*Phase: 122-tokens-primitives-contrast-measurement*
*Completed: 2026-08-19*

## Self-Check: PASSED

- Commit `bdea7326` (Task 1): FOUND in `git log --oneline --all`
- Commit `30d8b676` (Task 2): FOUND in `git log --oneline --all`
- Commit `f5802a76` (Task 3 + ledger completion): FOUND in `git log --oneline --all`
- `sweep-ledgers/122-07-LEDGER.md`: FOUND on disk
- All 30 files in `files_modified`: FOUND on disk
- Population re-check (fresh `git grep -c`, all four buckets, all 30 files): 0/0/0/0
