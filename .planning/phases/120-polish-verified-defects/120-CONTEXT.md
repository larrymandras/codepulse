# Phase 120: Polish & Verified Defects - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 120 **removes** decoration and **fixes** verified honesty/layout defects. It does not
rebuild, retokenize, or refactor. It is the cheapest work in v15.0, sequenced first so that
Phase 122's A11Y-01 contrast measurement and the milestone's visual-regression baseline are
taken against a surface free of decoration that would otherwise confound them.

**In scope:** POLISH-01 through POLISH-06.

**Explicitly NOT in scope (belongs to later phases, do not pull forward):**
- Surface tokens `--surface-0/1/2/3`, `--hairline`, and the `glow-card` / `shadow-[var(--glow-*)]`
  chrome those replace → **TOKEN-01, Phase 122**
- Redefining `--accent`, `--status-ok`, `--primary`, or introducing `--astridr` → **TOKEN-02, Phase 122**
- Motion token system (`--dur-1/2/3`, `--ease-out`) → **TOKEN-03, Phase 122**
- Skeleton shape/state contract, six-state metric tiles → **TOKEN-04, Phase 122**
- A shared `StatusBadge` / `PageHeader` / `EmptyState` primitive → **TOKEN-05, Phase 122**
- Header and sidebar restructure → **SHELL-01/02, Phase 124**
- Signal Horizon, Pulse ECG hero → **SIGNAL-01/02, Phase 125**

</domain>

<premise_corrections>
## Premise Corrections — read before planning

Two statements in ROADMAP.md / REQUIREMENTS.md were checked against live code during this
discussion and are **wrong as written**. Plan against the corrected version, not the source text.

1. **POLISH-03 / ROADMAP success criterion 3** says *"Deleting a task (or any other destructive
   action) requires confirming in a dialog — the toast-based confirm at `Tasks.tsx:144-145`"*.
   There is no delete at that location. `src/pages/Tasks.tsx:144-160` is a **move-to-action-column**
   confirm that dispatches a WS command to Ástríðr, presented on a **5-second auto-dismissing
   toast**. It is genuinely the defect the requirement targets (a decision carried by something
   that can be missed or auto-dismissed) — but it is not a delete, and no planner should go
   looking for a task-delete toast.

2. **POLISH-01's "CRT-by-default" item appears to be already satisfied.** `DashboardLayout.tsx:392`
   reads `JSON.parse(localStorage.getItem("codepulse-crt") ?? "false")` — CRT already defaults
   **off**. The CRT toggle itself must **survive** this phase: SHELL-01 (Phase 124) explicitly
   places CRT in the new header's overflow menu. Verify-and-record, do not remove the feature.

---

## Corrections added during planning (2026-08-17)

The five items below were found by the planner and **independently re-verified against live code by the
orchestrator** before being written here. Where they contradict the decisions or code context above,
**these are correct and the text above is wrong.** Confirmed at plan time; re-check before relying on
any line number, since this is a shared checkout.

3. **D-04 over-reaches, and 120-02 deliberately departs from it. The departure is endorsed.** D-04 says
   to delete "the Phase-89 `readable`/`aubergine` suppression rules (~646-655)". That range spans **two
   different rules**: `index.css:647-650` suppresses `.matrix-bg`, and `index.css:652-655` suppresses
   `.crt-scanline-bar`. Only the first is dead after this phase. **`.crt-scanline-bar` has NO base CSS
   definition** — its only occurrences in `index.css` are those two suppression selectors, and it is
   styled inline at `DashboardLayout.tsx:514`. Since the CRT overlay survives 120 (the toggle must, for
   Phase 124), lines 652-655 are the ONLY thing keeping it out of the `readable` theme, whose
   no-effects guarantee is an explicit milestone requirement (`REQUIREMENTS.md:45`, TOKEN-03).
   Executing D-04 verbatim would regress the accessibility theme. **Delete the `.matrix-bg` half only
   (647-650); keep 652-655.** This is the phase's one knowing departure from a locked decision, and
   120-02 is required to state it in the open rather than silently.

4. **POLISH-02 is a ONE-component problem.** The "Claude's Discretion" note above claims E-Stop also
   renders via `CompactControlStrip.tsx`, `ControlCenterPanel.tsx`, `DashboardLayout.tsx` and
   `CommandPalette.tsx`. **Wrong.** `EStopButton` is imported at exactly one place
   (`DashboardLayout.tsx:23`) and rendered at exactly one place (`DashboardLayout.tsx:612`). The other
   three files contain no E-Stop reference at all — they match a naive "stop" grep only via unrelated
   symbols such as `onScreenShareStop`.

5. **The sidebar is `w-60` (240px), not 232px.** `DashboardLayout.tsx:518` (desktop) and `:539`
   (mobile drawer) both use `w-60`. **232px is SHELL-02's target width, not today's value** — Phase 120
   must not change the sidebar width at all. Reproduce the 900px collision against 240px.

6. **`animate-pulse` is 102 occurrences across 61 non-test files, not "129 across 60".** Measured:
   **131** occurrences across all of `src/` including tests; **102** in non-test files; **61** non-test
   files. The 129 figure was a count of matching *lines* (not occurrences) and included test files.
   More importantly, D-09 enumerates only **19** sites while the non-skeleton population is **47** — so
   **28 sites are unclassified** and are covered only by D-09's "and siblings found by the same shape".
   120-06 enumerates all 47 and classifies them by D-09's rule, labelling its own classification a
   draft to be corrected at execution.

7. **`HeroStatsBar`'s Integrations block ends at `:170`, not `:168`.**

**Also stale, and NOT this phase's work:** `ROADMAP.md`'s Phase 120 summary line lists "`--status-ok`
identical to `--primary`" as one of Phase 120's three verified defects. `REQUIREMENTS.md:44` (TOKEN-02)
assigns that decoupling to **Phase 122**, and Phase 120's own five success criteria never mention it.
Corrected in ROADMAP.md in the same commit as these plans.

</premise_corrections>

<decisions>
## Implementation Decisions

### Kill-List Removal (POLISH-01)

- **D-01: Enumerated tokens only — no adjacent cleanup.** Remove exactly the named kill-list
  items and nothing else. The `glow-card`, `shadow-[var(--glow-xs)]`, `hover:shadow-[var(--glow-sm)]`
  and `hover:border-primary/50` classes that sit in the *same* class strings **survive this phase**
  and are Phase 122's (TOKEN-01) to replace. Rationale: keeps 120 mechanical and reviewable, gives
  the visual-regression baseline one clean before/after axis, and avoids leaving cards visually
  flat during the interval when `--surface-*` tokens do not yet exist.
  *Accepted consequence: the app still reads glowy after 120. The quiet surface lands in 122.*

- **D-02: No refactors.** Do not collapse the repeated card class-string into `GlassPanel` or any
  other primitive. Centralization was explicitly considered and rejected for this phase — it is a
  refactor with real regression surface, and roughly half these sites are raw `div`s. Phase 122 may
  revisit.

- **D-03: The CodePulse wordmark loses `glitch-text` AND its `drop-shadow` glow.** `DashboardLayout.tsx:243`
  currently carries `glitch-text` + `drop-shadow-[0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.5)]` +
  `font-mono tracking-wider`. Drop the first two; **keep** `font-mono tracking-wider` (the Geist
  sentence-case type law is Phase 122/124). This is a deliberate, named exception to D-01 — the glow
  is on the same element and is the same species of decoration, and leaving it makes the wordmark the
  loudest thing in a quieted shell.

- **D-04: Delete the dead CSS definitions, not just the usages.** Once usages are stripped, remove
  from `src/index.css`: `.glitch-text` and its `::before`/`::after` and both `@keyframes glitch-anim-*`
  blocks (~515-560), `.matrix-bg` and its `::after` (~564-580), `.nav-active-shadow` (~604),
  `.nav-hover-shadow` (~610), **and** the Phase-89 `[data-theme="readable"] / [data-theme="aubergine"]`
  suppression rules (~646-655) that exist only to neutralize them. Rationale: makes success criterion
  1's "zero live hits" grep unambiguous, and removes classes that would otherwise stay
  autocomplete-reachable.

- **D-05: The violet search pill is fixed AT THE PILL, not at the token.** The pill
  (`DashboardLayout.tsx:600`) reads `bg-accent/50`; `src/index.css:151` defines
  `--accent: #8b5cf6; /* Violet */` for the default cyan theme. Replace the pill's own treatment with
  a neutral surface/border. **Do not touch `--accent`** — redefining it is TOKEN-02's job (violet =
  Ástríðr only) across all 5 themes, and doing it here would be re-decided in 122 anyway.

- **D-06: The cyan scrollbar glow is real and in scope.** `src/index.css:498-514` — the
  `::-webkit-scrollbar-thumb:hover` `box-shadow: 0 0 8px oklch(from var(--primary) ...)` is the named
  glow. The cyan-tinted track border and thumb fill on the same rules are part of the same
  "Cyberpunk Scrollbar" block and should go with it.

### Fabricated Data (POLISH-04)

- **D-07: Delete the Integrations row outright.** `src/components/HeroStatsBar.tsx:161-168` — the
  hardcoded `['GITHUB','LINEAR','SLACK','CONVEX','VERCEL']` strip with unconditional green dots and
  its literal "(Integrations row simulation)" comment. **Remove it; do not rewire it.** Rationale: the
  honest version already ships on `/infrastructure` (`IntegrationHealth.tsx`, `Infrastructure.tsx:86`,
  backed by the genuinely-derived `convex/integrations.ts:40 healthStatus` query), so rewiring the
  hero duplicates an existing page rather than adding signal — and `LINEAR`/`VERCEL` have no emitter
  at all. The Dashboard hero is also where Phase 125's Pulse ECG lands, so the space is reclaimed.

- **D-08: Sweep for the defect CLASS, report all, fix only the unambiguous.** POLISH-04's text is
  general ("no surface asserts a figure that has no emitter behind it"), so grep the render paths for
  hardcoded value arrays, `Math.random`, and `simulation` / `mock` / `demo` / `placeholder` comments.
  **Produce a `file:line` inventory of every hit.** Fix the ones that are unambiguously fabricated.
  Anything that requires a judgment call is **recorded in the phase artifacts, not silently fixed** —
  it becomes input for Phase 122's TOKEN-04 six-state tile work, where every metric must declare its
  state anyway.

### Pulse Dots (POLISH-01, "decorative pulse dots")

- **D-09: The rule is `unconditional pulse = decorative`.** If `animate-pulse` renders regardless of
  any state value, it is decoration — remove it. If it renders only when something is genuinely
  happening, it stays. This is mechanically checkable at review time.
  - **Kill (decorative, unconditional):** the panel-header live-dot cluster —
    `ActiveSessions.tsx:15`, `AgentTopology.tsx:192` and `:206`, `BlackboardPanel.tsx:70`,
    `ConversationTimeline.tsx:32`, `DockerPanel.tsx:42`, `DriftTimeline.tsx:135`,
    `EventFeed.tsx:56`, `GitActivityWidget.tsx:38`, `ActiveSessions.tsx:64`, and siblings found by
    the same shape (`w-2 h-2 rounded-full bg-primary animate-pulse`). These pulse whether or not
    anything is live.
  - **Keep (state-gated):** `ThinkingBlock.tsx:32` (`--status-warn`, actively thinking),
    `BrainHeaderBadge.tsx:144/150` and `BrainPicker.tsx:449` and `GlobalSwapModal.tsx:604`
    (`--status-info`, swap in flight), `AgentAvatar.tsx:22` (`working` state),
    `CostBreakdown.tsx:69/127` (`--status-error`, runaway), `ConnectionPopover.tsx:212`,
    `ReadinessPill.tsx:100`.
  - The kill decision is **de-animate**, not necessarily remove the element. Retiring the header-dot
    pattern wholesale was considered and **not** chosen — a static dot may remain.

- **D-10: Skeletons are OUT of scope.** `animate-pulse rounded-md bg-muted` loading placeholders
  (`DeliveryHistory.tsx:35`, `EmailDigestConfig.tsx:62`, `GovernorDecisionLog.tsx:56`,
  `ExecutionTable.tsx:60`, `AgentAvatar.tsx:47`, …) are a loading-state contract, not decoration.
  They belong to TOKEN-04 in Phase 122. **Phase 120 does not touch them at all** — not their shape,
  not their motion. This keeps 120 and 122 from editing the same files for different reasons.

- **D-11: Every pulse that SURVIVES 120 gets `prefers-reduced-motion` gating now.** Follow the
  existing in-repo precedent at `src/components/control-center/ReadinessPill.tsx:100`
  (`reducedMotion ? "" : "animate-pulse"`). Marginal cost is near-zero since each site is already
  being edited, and it means Phase 122's TOKEN-03 audit finds these already compliant instead of
  reopening ~60 files. *(Note the skeleton carve-out in D-10 still applies — skeletons are untouched.)*

### Destructive Confirms (POLISH-03)

- **D-12: Two sites in scope, not one.** The sweep found exactly three toast/`window.confirm`
  candidates; two are defects:
  - `src/pages/Tasks.tsx:144-160` — confirm gating a WS dispatch, on a 5s auto-dismissing toast.
    **The named defect.**
  - `src/pages/WarRoom.tsx:86` — `window.confirm` gating a genuinely destructive delete
    (*"removes it and its transcript"*). **Same class**: a browser-native modal that ignores the
    theme entirely and fails the "confirmed in a dialog" law from the other direction. It is the more
    destructive of the two.

- **D-13: `GlobalSwapModal.tsx:501` is NOT a defect — record it as sanctioned.** Its toast action is
  labelled *"Revert global swap"* and fires **after** the swap has already completed. That is an
  **undo affordance**, not a pre-action gate. Write this into the phase artifacts explicitly so a
  future sweep does not "fix" a legitimate pattern into a dialog.

- **D-14: Both replacements are `AlertDialog` with NO timeout.** Plain Confirm / Cancel. A confirm
  that expires is precisely the failure mode POLISH-03 exists to remove. A visible countdown variant
  was considered and rejected. Copy the existing in-repo AlertDialog confirms —
  `src/components/forge/ForgeStopConfirmDialog.tsx` and `src/components/skills/DeleteSkillDialog.tsx` —
  so all confirms in the app behave identically. `src/components/ui/alert-dialog.tsx` already exists;
  no new primitive is needed. **Do not** change Tasks' move-to-action-column from confirm-first to
  dispatch-then-undo — that would alter a prior phase's D-04 behavior contract and is a design
  change, not a defect fix.

### Status Badges (POLISH-05)

- **D-15: Four words are the SPINE; unmappable domain states keep distinct labels.** Map
  `running → Running`, `completed → Succeeded`, `failed → Failed`, `stopped → Cancelled`. States with
  no honest mapping — `auth_failed`, `queued`, `pending`, `stopping_pending` and any siblings — **keep
  their own distinct labels** and are documented in the phase artifacts as deliberate exceptions with
  the reason. Rationale: `src/components/forge/ForgeStatusBadge.tsx` carries a load-bearing constraint
  in its own header comment — *"SC#4 preserved: auth_failed (amber) MUST be visually distinct from
  failed (red)"* — and collapsing `queued → Running` or `stopping_pending → Cancelled` would make the
  badge assert a state that is not true, which is the same honesty defect POLISH-04 exists to remove.

- **D-16: Apply the quiet law IN PLACE, per site. Do not build a shared `StatusBadge`.** Only
  **Failed** renders filled; everything else becomes quiet (text/outline, no `bg-*-900/60` fill). Note
  this is the larger half of POLISH-05 — today *every* status in `ForgeStatusBadge`'s `STATUS_MAP`
  renders filled. A shared primitive and extending `ui/badge.tsx`'s cva were both considered and
  rejected here: a `StatusBadge` primitive is TOKEN-05's (Phase 122), and building it now contradicts
  D-02's no-refactor rule.

- **D-17: Reach is Executions + Forge in 120; inventory the rest for 122.** The milestone's own
  acceptance criterion 5 names Executions specifically (*"Executions uses the quiet-badge table
  pattern"*). Do that plus the Forge job badges, then produce a **`file:line` inventory of every
  remaining badge site** (`JobsPanel`, `CronJobList`, `RosterTable`, `RoomListItem`, `IdeationRow`,
  `FactsTable`, `hr/AgentCard`, `hr/detail/DetailRuntimeTab`, `BlackboardPanel`,
  `forge/ForgeJobList`, `forge/ForgeJobDetail`, `forge/ForgeMetadataPanel`, `IntegrationHealth`, …)
  and hand it to Phase 122 as a work-list rather than a discovery task.

### Claude's Discretion

The following were not discussed and are the implementer's call, guided by the phase goal and the
sketch findings:

- **POLISH-02 — E-Stop fixed geometry.** `src/components/EStopButton.tsx` (also rendered via
  `control-center/CompactControlStrip.tsx`, `control-center/ControlCenterPanel.tsx`,
  `layouts/DashboardLayout.tsx`, `components/CommandPalette.tsx`). Requirement is: holds fixed
  geometry, never wraps or reflows at any viewport width, mobile through ultrawide. Method is open.
- **POLISH-06 — sidebar / Settings collision at 900px.** Mechanical CSS. Note that no literal `900`
  breakpoint exists in `DashboardLayout.tsx` or `Settings.tsx` today — the collision arises from
  Tailwind's `md:`/`lg:` breakpoints against the 232px sidebar; reproduce it at 900px before fixing.

### Reviewed Todos (not folded)

- **`.planning/todos/pending/llm-analytics-rollup-migration-cr01.md`** — matched at score 0.4 on weak
  keywords ("status", "phase"). **Not folded.** `REQUIREMENTS.md:74` names this file as the full brief
  for **DEBT-08**, and the traceability table assigns DEBT-08 to **Phase 121**. It is already scoped;
  it is not Phase 120 work.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design law (the milestone's locked inputs — not open questions)
- `Skill("sketch-findings-codepulse")` — the validated design law: kill list, three-hue color law,
  quiet-badge rule, dialogs-not-toasts, motion tokens, 12 locked decisions. Auto-loads on UI work.
- `.claude/skills/sketch-findings-codepulse/references/shell-and-dashboard.md` — the Borealis Console
  shell and dashboard decisions in detail.
- `.planning/sketches/001-dashboard-quiet-control-room/index.html` — the working reference
  implementation of the whole direction. Open it in a browser; it answers more than prose can.
- `html-out/ui-premium-redesign-comparison.html` — the 3-model proposals plus the approved verdict
  tab. **The convergence map here is the source of the unanimous kill list this phase implements.**
- `html-out/redesign-before-after.html` — before/after visual reference.
- `.planning/sketches/MANIFEST.md` and `.planning/sketches/WRAP-UP-SUMMARY.md` — direction and wrap-up.

### Phase and milestone scope
- `.planning/REQUIREMENTS.md` — POLISH-01..06 (this phase), plus the milestone-level acceptance
  criteria and the Out of Scope list that bounds it.
- `.planning/ROADMAP.md` §"Phase 120: Polish & Verified Defects" (lines 701-716) — goal and the five
  success criteria. **See `<premise_corrections>` above: success criterion 3 misdescribes the
  Tasks.tsx defect.**

### Project rules that constrain this phase
- `CLAUDE.md` §Styling — the token-driven theme architecture, the 5 `data-theme` blocks, "never
  hardcode hex", shadcn/Radix/Tailwind-4/Lucide only.
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — deploys must name
  `--env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`. *(This phase is frontend-only and
  should need no Convex deploy; if one becomes necessary, this rule is not optional.)*
- `CLAUDE.md` §Testing — heavy render libraries are mocked **per test file**, not globally.

### No external ADRs
No ADR/spec documents outside the above were referenced during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/alert-dialog.tsx` — the AlertDialog primitive already exists. POLISH-03 needs no
  new primitive.
- `src/components/forge/ForgeStopConfirmDialog.tsx`, `src/components/skills/DeleteSkillDialog.tsx` —
  two working AlertDialog confirm implementations to copy for D-14.
- `src/components/control-center/ReadinessPill.tsx:100` — the in-repo `prefers-reduced-motion` gating
  precedent to follow for D-11.
- `convex/integrations.ts:40` (`healthStatus`) + `src/hooks/useIntegrationHealth.ts` +
  `src/components/IntegrationHealth.tsx` — the genuinely emitter-backed integration health that made
  D-07's "delete, don't rewire" the right call. Verified derived from real tables (`gitCommits`,
  `events`, `supabaseHealth`) with per-type staleness thresholds; already renders on
  `Infrastructure.tsx:86`.

### Established Patterns
- The kill-list decoration was **bulk-appended**: 110 `hover:scale-[1.01]` hits across 38 files, each
  paired with a duplicated `transition-transform duration-300`. Removal is largely mechanical, but the
  duplicate `transition-transform duration-300` fragment must go with it or it becomes orphaned noise.
- `animate-pulse` appears 129 times across 60 non-test files, in **three distinct populations** —
  unconditional header dots (kill), state-gated indicators (keep + gate), and skeletons (untouched).
  Do not treat the count as one homogeneous target.
- Status badges are rendered from per-module maps (`ForgeStatusBadge`'s `STATUS_MAP`) rather than a
  shared primitive; ~20 sites each carry their own vocabulary.
- `src/index.css` already has Phase-89 theme-suppression rules (`readable`, `aubergine`) for
  `matrix-bg` and `crt-scanline-bar` — deleting the base rules means deleting these too (D-04).

### Integration Points
- `src/layouts/DashboardLayout.tsx` is the highest-density target: wordmark glitch + glow (`:243`),
  nav glow classes at **both** nav renderings (`:146/147` desktop and `:278/279` mobile — fix both,
  the second is easy to miss), `matrix-bg` (`:511`), CRT scanline overlay (`:512-514`), the violet
  search pill (`:597-606`), and the CRT toggle that must survive (`:342-372`, `:390-410`).
- `src/index.css` is edited by this phase (dead-rule deletion, scrollbar) **and** rewritten wholesale
  by Phase 122's TOKEN-01. Keep 120's edits to deletions so the two do not conflict.
- Existing test files (`src/components/__tests__/EStopButton.test.tsx`,
  `src/components/forge/ForgeStatusBadge.test.tsx`, `src/components/forge/ForgeStopConfirmDialog.test.tsx`)
  will constrain POLISH-02, POLISH-05 and POLISH-03 respectively — read them before changing behavior.

</code_context>

<specifics>
## Specific Ideas

- **"Only Failed is filled"** is the whole badge law in one sentence. Today the opposite is true —
  every status in `ForgeStatusBadge`'s map renders with a `bg-*-900/60` fill. The wording change is
  the small half of POLISH-05; the fill change is the large half.
- The wordmark exception (D-03) is deliberate and should be called out in the plan so a reviewer does
  not read it as a D-01 violation.
- POLISH-04's sweep (D-08) should **report what it drops and why**, matching this project's standing
  precision rule — a fabrication inventory with judgment calls left visible is more useful to Phase
  122 than a silent partial fix.

</specifics>

<deferred>
## Deferred Ideas

- **A real, emitter-backed integration strip on the Dashboard** — deleted here (D-07) because it would
  duplicate `/infrastructure`. If the Dashboard hero wants it back, Phase 125 is where that decision
  belongs, alongside the Pulse ECG hero that occupies the same space.
- **Centralizing the repeated card class-string into `GlassPanel`** — considered and rejected for 120
  (D-02). Genuinely high-leverage for Phase 122's TOKEN-01: it would turn 38 file edits into one.
  Worth revisiting there.
- **A shared `StatusBadge` primitive** — rejected here (D-16), belongs to TOKEN-05 in Phase 122. D-17's
  inventory is the input for it.
- **Skeleton shapes and the six-state contract** — untouched here by design (D-10); TOKEN-04.
- **`--accent: #8b5cf6` (violet) as an app-wide token** — only the search pill is fixed here (D-05).
  The token itself is TOKEN-02's, where violet becomes Ástríðr-exclusive across all 5 themes.

### Reviewed Todos (not folded)
- `.planning/todos/pending/llm-analytics-rollup-migration-cr01.md` — already scoped as DEBT-08 /
  Phase 121 per `REQUIREMENTS.md:74` and the traceability table. Weak keyword match only.

</deferred>

---

*Phase: 120-Polish & Verified Defects*
*Context gathered: 2026-08-17*
