# 120-06 Pulse Triage — Full `animate-pulse` Census

Measured 2026-08-17 during execution of `.planning/phases/120-polish-verified-defects/120-06-PLAN.md`.
Fixed-string greps throughout (`git grep -oF`/`-lF`); occurrences = matches, files = distinct files with
≥1 match. Locate every site by content, not by the line numbers quoted here — this is a shared checkout
and lines move.

## §1 — Measured totals

**Before this plan's edits (measured at execution start):**

```
$ git grep -oF 'animate-pulse' -- 'src/*' | wc -l          → 127   (all files, occurrences)
$ git grep -lF 'animate-pulse' -- 'src/*' | wc -l          → 68    (all files, files)
$ git grep -oF 'animate-pulse' -- 'src/*' | grep -v '\.test\.' | wc -l   → 98   (non-test, occurrences)
$ git grep -lF 'animate-pulse' -- 'src/*' | grep -v '\.test\.' | wc -l   → 59   (non-test, files)
```

Non-skeleton dot/text sites among the 98 non-test occurrences: **47**, matching the plan's own measured
figure exactly (`prior_wave_context` in the executor dispatch independently re-measured 98/59 immediately
before this plan ran and got the same numbers).

CONTEXT.md's own figure ("129 times across 60 non-test files") does not match either measurement taken at
execution time. It is not reconciled further here — both re-derivations (planning-time and execution-time)
independently landed on 98/59, so the discrepancy is CONTEXT.md's, not a live drift.

**After this plan's edits:**

```
$ git grep -oF 'animate-pulse' -- 'src/*' | wc -l          → 101   (all files, occurrences)
$ git grep -lF 'animate-pulse' -- 'src/*' | wc -l          → 50    (all files, files)
$ git grep -oF 'animate-pulse' -- 'src/*' | grep -v '\.test\.' | wc -l   → 72   (non-test, occurrences)
$ git grep -lF 'animate-pulse' -- 'src/*' | grep -v '\.test\.' | wc -l   → 41   (non-test, files)
```

The occurrence count does **not** drop by exactly "number of KILL sites" (31 literal removals in this
plan). Two mechanisms both hold the count up:

1. Every **KEEP+GATE** site still contains the literal string `animate-pulse` in source — it now lives
   inside a `` `${reducedMotion ? "" : "animate-pulse"}` `` ternary (or, for the two Record-consumption
   sites gated via `.replace(/\s*animate-pulse/, "")`, inside the regex pattern itself). Gating does not
   remove the token from source; it makes its render conditional. 18 files therefore still contain the
   string post-edit even though the pulse itself is gone-or-conditional in every one of them.
2. Doc comments explaining two disagreements (`CostBreakdown.tsx`, `AgentAvatar.tsx`) name the literal
   class `animate-pulse` in prose. This adds 2 occurrences with zero functional effect; noted in §3.

Net: 18 non-test files dropped from "contains `animate-pulse`" to "does not" (59 → 41). Per-file counts
for every edited file are in §2.

## §2 — Every site, classified

Legend: **KILL** = de-animated (token removed, element kept per D-09's "de-animate, not remove"). **KEEP+GATE**
= genuine activity signal, gated on `prefersReducedMotion()`. **SKELETON-UNTOUCHED** = D-10 carve-out, not
edited. **OUT-OF-SCOPE** = named exclusion (Chat.tsx, DashboardLayout.tsx, HeroStatsBar.tsx,
ReadinessPill.tsx) or a site this plan's rule doesn't reach (CSS `:hover` trigger). **ALREADY-GATED** =
satisfies D-11 via pre-existing code, not touched. **FOUND-NOT-IN-SCOPE** = a genuine sibling found by the
same shape, outside this plan's `files_modified`, recorded per D-09's "and siblings" mandate but not
edited (editing it would violate the plan's explicit file-scope boundary).

| file:line | gating expression | classification | reason |
|---|---|---|---|
| ActiveSessions.tsx:15 | none | KILL | unconditional panel-header dot |
| ActiveSessions.tsx:33 | `group-hover:` (CSS pseudo-class) | OUT-OF-SCOPE | a hover micro-interaction on the `>` prompt char, not a status dot; D-09 targets state-value-gated vs. unconditional RENDER, not CSS `:hover` triggers. Already covered by `src/index.css`'s global reduced-motion rule at the CSS layer. Left untouched — gating it would need converting a static Tailwind hover-modifier into stateful JS, exceeding this plan's scope. |
| ActiveSessions.tsx:64 | `session.lastEventAt &&` | KILL | Locked D-09 decision (CONTEXT.md) names this KILL despite the conditional — `lastEventAt` existing is "has ever had an event", not "something happening now"; it's a static historical fact display. |
| AgentAvatar.tsx:22 | `STATUS_RING["working"]` (Record) | KEEP+GATE | consumption-site gate (line ~69); Record value left untouched (still literally contains `animate-pulse` — matches the AgentAvatar/CostBreakdown pattern the plan specifies) |
| AgentAvatar.tsx:47 | `if (!url)` | SKELETON-UNTOUCHED | `bg-muted/50` neutral fill, block shape — D-10 |
| AgentTopology.tsx:192 | none (empty-state branch) | KILL | unconditional within the `allAgents.length === 0` branch |
| AgentTopology.tsx:206 | none (main branch) | KILL | unconditional panel-header dot |
| BlackboardPanel.tsx:28 (now :30) | `stateIcon.running` (Record) | KEEP+GATE | consumption-site gate via `cloneElement`, stripping the class only when reducedMotion; Record value left untouched |
| BlackboardPanel.tsx:70 | none | KILL | unconditional panel-header dot |
| ConnectionPopover.tsx:212 | `status === "reconnecting"` ternary | KEEP+GATE | genuine reconnect-in-progress signal |
| ConversationTimeline.tsx:32 | none | KILL | unconditional panel-header dot |
| CostBreakdown.tsx:69 | `tierFlagConfig["OPUS WORKER"].dotClass` (Record) | KEEP+GATE | consumption-site gate via `.replace()`; genuine runaway-tier alert |
| CostBreakdown.tsx:127 | none (present in BOTH branches of the `isRunaway` ternary) | KILL — **disagreement with plan's draft** | the plan's Population C proposal classified this KEEP+GATE ("gate inside the template"), but `animate-pulse` sits OUTSIDE the ternary and applies regardless of `isRunaway` — only the color changes. By the letter of D-09 this is unconditional, hence decorative. De-animated instead of gated. |
| DockerPanel.tsx:42 | none | KILL | unconditional panel-header dot |
| DockerPanel.tsx:52 | `refreshing` (transient `useState(false)` fetch flag) | KEEP+GATE | a genuine in-flight async operation, distinct from the two empty-state text sites below (see the DetailConfigTab/ToolExecutionPanel reasoning) |
| DriftTimeline.tsx:135 | none | KILL | unconditional panel-header dot |
| DriftTimeline.tsx:140 | `summary.isDrifting &&` | KEEP+GATE | genuine drift-detected signal |
| EventFeed.tsx:56 | none | KILL | unconditional panel-header dot |
| GitActivityWidget.tsx:38 | none | KILL | unconditional panel-header dot |
| OperatorScoreCard.tsx:89 | `if (latest === undefined)` | SKELETON-UNTOUCHED | `bg-muted` neutral fill, "Loading..." text alongside it — D-10 |
| OperatorScoreCard.tsx:154 | none (dynamic `style={{backgroundColor: color}}`, static pulse) | KILL | color is state-driven, the pulse itself is not — matches plan's proposal |
| PulseChart.tsx:25 | none | KILL | unconditional panel-header dot |
| RunTimeline.tsx:77 (now :83) | `showThinking` (`streaming && blocks.length === 0`) | KEEP+GATE — **added, not in plan's `<interfaces>`** | genuine "actively thinking, no blocks yet" signal; found via full re-derivation, not named in D-09 or Population C |
| RunTimeline.tsx:108 | `isActive && streaming` | KEEP+GATE | genuine active-round-in-progress signal; matches plan's proposal (test tripwire at `__tests__/RunTimeline.test.tsx:63-68` read first, unaffected by this change) |
| TeamStatusCards.tsx:91 | `team.status === "active" &&` | KEEP+GATE | plan's draft flagged this "VERIFY whether a conditional wraps it; if none, it is a kill" — verified: a conditional wraps it |
| ToolBreakdown.tsx:25 | none | KILL | unconditional panel-header dot |
| ToolExecutionPanel.tsx:137 | none (empty-state branch) | KILL | unconditional within `executions.length === 0`; `shadow-[var(--glow-xs)]` on the same element survives (D-01) |
| ToolExecutionPanel.tsx:144 | none (same empty-state branch) | KILL — **judgment call, not in plan's `<interfaces>`** | "Awaiting Telemetry" text pulses whenever `executions.length === 0` — a steady empty condition, not a transient in-flight operation (contrast with DockerPanel's `refreshing`, which IS a transient async flag). No loading/fetch state distinguishes "subscribing" from "permanently empty" here. Classified decorative. See §3. |
| ToolExecutionPanel.tsx:157 | none (main branch) | KILL | unconditional panel-header dot |
| ToolExecutionPanel.tsx:257 (×2, both ternary branches) | none (present in BOTH `exec.success` branches) | KILL — **judgment call, not in plan's `<interfaces>`** | `exec` is a completed historical row (only fields: `success`, `durationMs`, `decision`, `errorMessage`, `timestamp` — no live/in-progress field); `animate-pulse` applies regardless of `exec.success`, only color/shadow differ. Unconditional per D-09. Shadow glows survive (D-01). |
| VoiceControlBar.tsx:125 | `shouldReduce` (from `motion/react`'s `useReducedMotion()`) inside `case "reconnecting":` | ALREADY-GATED — **not edited, deviation from plan's file list; see §3** | genuinely state-gated (only in the `reconnecting` switch case) AND already satisfies D-11 via a pre-existing, different reduced-motion mechanism. Adding this plan's `prefersReducedMotion()` alongside it would double-gate and violate the plan's own "no `useReducedMotion` from `motion/react`... mixing the two would be a refactor" instruction. |
| WarRoomKanbanColumn.tsx:70 | none | KILL | "Online" label + dot render unconditionally per column, no `agent.status` check gates it |
| blocks/ThinkingBlock.tsx:32 | `streaming &&` | KEEP+GATE | genuine actively-streaming signal; matches plan's proposal |
| brains/BrainHeaderBadge.tsx:144 | `isConfirmedLive &&` | KEEP+GATE | matches plan's proposal; tripwire test (`BrainHeaderBadge.test.tsx`) passes unedited before AND after (31/31 both times) |
| brains/BrainHeaderBadge.tsx:150 | `pending?.kind === "inflight" &&` | KEEP+GATE | matches plan's proposal |
| brains/BrainPicker.tsx:449 | `pendingInfo?.kind === "inflight" &&` | KEEP+GATE | matches plan's proposal |
| brains/GlobalSwapModal.tsx:604 | `outcome.status === "pending" \|\| "confirming"` | KEEP+GATE | matches plan's proposal |
| hr/AgentCard.tsx:87 | none (`group-hover:opacity-100` gates *opacity*, not the pulse) | KILL | ambient avatar halo, unconditional pulse; `group-hover:opacity-100 transition-opacity` survives (D-01) |
| hr/AgentDetailSheet.tsx:202 | none | KILL | same ambient halo pattern |
| hr/TeamEditor.tsx:409 | none | KILL | unconditional panel-header dot |
| hr/WizardShell.tsx:46 | none | KILL | unconditional panel-header dot; `shadow-[var(--glow-xs)]` survives (D-01) |
| hr/detail/DetailConfigTab.tsx:39 (`SectionHeader`) | none | KILL | unconditional, reused across every section header; glow survives (D-01) |
| hr/detail/DetailConfigTab.tsx:62 | `if (!agentDetail)` | KILL — **judgment call, not in plan's `<interfaces>`** | "No configuration telemetry" text pulses whenever `agentDetail` is null — a steady empty condition, same reasoning as ToolExecutionPanel:144. Not a D-10 skeleton (no neutral-fill block shape, just muted text). |
| skills/NewSkillsBanner.tsx:22 | none | KILL | unconditional; glow survives (D-01) |
| skills/ScopeRail.tsx:52 | none | KILL | unconditional panel-header dot; glow survives (D-01) |
| skills/SkillCommandDeck.tsx:87 | none | KILL | unconditional panel-header dot; glow survives (D-01) |
| workspace/WorkspaceMapCanvas.tsx:270 | `if (payload === undefined)` | KEEP+GATE — **reclassified from plan's proposed KILL; see §3** | `role="status" aria-label="Loading workspace map"` — genuinely conditional on the loading state, not unconditional. The plan's draft called it "a dashed border-muted-foreground/30 ring — decorative", but by D-09's letter (renders "only when something is genuinely happening" — here, loading) it is state-gated, not decorative. |
| pages/HivePage.tsx:52 | none | KILL | unconditional page-header dot |
| pages/Settings.tsx:368 (`AgentProfileRows`) | `pending.kind === "inflight" &&` | KEEP+GATE | matches plan's proposal |
| pages/Skills.tsx:562 | none | KILL | unconditional; glow survives (D-01) |

### Skeletons (D-10, summarized by count per file — not individually enumerated)

All neutral-fill (`bg-muted`/`bg-gray-*`/`bg-zinc-*`/`bg-white/*`) or otherwise clearly loading-placeholder
block shapes. None of these files are in this plan's `files_modified` except `AgentAvatar.tsx` (present
above for its `:22` state-ring site only — its `:47` skeleton is untouched).

`AgentAvatar.tsx` (1, `:47`), `DeliveryHistory.tsx` (1), `EmailDigestConfig.tsx` (1),
`ExecutionTable.tsx` (1), `GovernorDecisionLog.tsx` (1), `MemoryIndexHealth.tsx` (1),
`SDKSpendGuard.tsx` (3), `SessionComparison.tsx` (1, "Loading..." text), `Skeleton.tsx` (8, the literal
skeleton primitive component), `ui/skeleton.tsx` (1, the shadcn primitive), `hr/CatalogBrowser.tsx` (1,
`SkeletonCard`), `kg/KGSummaryCards.tsx` (1), `IntegrationHealth.tsx` (1, "checking..." — arguably a
transient state text like DockerPanel's Refreshing, but not in scope regardless since not in
`files_modified`), `kg/KGSearchResults.tsx` (1, "Searching..." loading text), `graph/CodeVaultGraph.tsx`
(2, "Loading 3D render…" / "Loading graph snapshot…"), `pages/KnowledgeGraph.tsx` (5, all "Loading /
Diffing / Animating / Querying…" loading-overlay text), `pages/Memory.tsx` (1, "Parsing vault files...").

### Found, not in scope (D-09 "and siblings" — recorded but not edited)

These are genuine dot/text sites matching D-09's shape, discovered by the same exhaustive re-derivation
that found the sites above, but **not in this plan's `files_modified`**. Editing them would violate the
plan's explicit file-scope boundary (Task 2/3 acceptance criteria: "no file outside files_modified").
Recorded here so a future sweep (Phase 122 or a follow-up) does not have to re-discover them.

| file:line | shape | likely classification |
|---|---|---|
| `SwarmTaskNode.tsx:122` | `` `${state === "running" && !reducedMotion ? "animate-pulse" : ""}` `` | **KEEP+GATE — RECLASSIFIED AT PHASE CLOSE.** Originally recorded here as "state-gated, not D-11-gated for motion, not a defect". That was wrong: D-11 requires every SURVIVING pulse to be motion-gated, not merely state-gated, so recording it out of scope contradicted the phase's own claim that all survivors are gated. Found by external review; now gated. |
| `WSStatusIndicator.tsx:23` | `reconnecting: { dotClass: "bg-(--status-warn) animate-pulse", ... }` | **KEEP+GATE — RECLASSIFIED AT PHASE CLOSE.** Originally recorded as KEEP-shaped but left ungated. Same error as SwarmTaskNode above. Now gated at the consumption site (Record value left literal, matching BlackboardPanel/CostBreakdown). Found by external review. |
| `reminders/ReminderList.tsx:305,427` | `isOverdue && !reduceMotion ? "animate-pulse" : ""` / `loud && count > 0 && !reduceMotion ? "animate-pulse" : ""` | **Already gated** — via a SIXTH pre-existing reduced-motion predicate this plan's `<interfaces>` did not know about. See §5. |

## §3 — Judgment calls

Every site where this plan's execution differed from `<interfaces>`'s proposed classification, or where
the rule required a fresh read because the site was never proposed at all.

1. **CostBreakdown.tsx:127 — reclassified KEEP+GATE → KILL.** The plan's Population C draft proposed
   "gate inside the template". Reading the code: `animate-pulse` sits outside the `isRunaway` ternary and
   renders in both branches — unconditional per D-09's letter. De-animated instead, with a doc comment at
   the site citing this disagreement.

2. **workspace/WorkspaceMapCanvas.tsx:270 — reclassified proposed KILL → KEEP+GATE.** The plan's
   Population C draft called this "a dashed border-muted-foreground/30 ring — decorative". Reading the
   code: it is wrapped in `if (payload === undefined)` with `role="status" aria-label="Loading workspace
   map"` — a genuine loading-state indicator, not decorative. Gated instead of de-animated.

3. **VoiceControlBar.tsx:125 — not edited, despite being in the plan's `files_modified` and its Task 3
   file list.** The plan's draft proposed KEEP+GATE with the new `prefersReducedMotion()` helper. Reading
   the code: this site already reads `shouldReduce` from `motion/react`'s `useReducedMotion()` and is
   already correctly gated (`shouldReduce ? "...bg-(--status-warn)" : "...bg-(--status-warn) animate-pulse"`,
   inside `case "reconnecting":`). D-11's intent (gate every surviving pulse on the user's motion
   preference) is already satisfied. The plan's own Task 3 action text says: "no `useReducedMotion` hook
   from `motion/react` (four files use that already for other purposes; this is the matchMedia predicate,
   and mixing the two would be a refactor)" — this is the fifth file using `useReducedMotion`, and unlike
   the plan's assumption, it uses it for THIS exact pulse, not "other purposes". Adding the new helper
   alongside the existing one would double-gate a single already-compliant site and violate the plan's
   own "don't mix the two" instruction. Left untouched. Consequence: Task 3's acceptance criterion
   "`git grep -lF 'prefersReducedMotion'` lists all ten [files]" is genuinely unsatisfiable without
   violating a different, more specific instruction in the same task — 9 of 10 files contain the new
   helper; the tenth already satisfies D-11 by a different, equally legitimate mechanism.

4. **ToolExecutionPanel.tsx:144 and hr/detail/DetailConfigTab.tsx:62 — classified KILL, not proposed in
   `<interfaces>` at all.** Both are pulsing empty-state text ("Awaiting Telemetry" / "No configuration
   telemetry") gated on a steady "no data" condition (`executions.length === 0`, `!agentDetail`), not a
   transient operation. Contrasted directly against DockerPanel.tsx:52's "Refreshing..." text, which IS
   gated on a transient `useState` fetch flag and was classified KEEP+GATE. The distinguishing test
   applied throughout: does the condition represent an ACTIVE, time-bounded operation (something
   happening right now), or a STEADY state that could persist indefinitely with no operation implied?
   The former is KEEP+GATE; the latter is decorative "anticipation" styling and is KILL. This is a
   genuinely debatable line — a different, equally defensible reading could treat any "waiting for data"
   text as a legitimate ongoing signal — but neither site matches D-10's literal skeleton shape (no
   neutral fill, no block), so leaving them un-classified was not an option, and the transient-vs-steady
   distinction is the most rule-faithful resolution found.

5. **ToolExecutionPanel.tsx:257 (both ternary branches) — classified KILL, not proposed in
   `<interfaces>`.** `animate-pulse` applies regardless of `exec.success` (both branches carry it, only
   color/shadow differ), and `exec` is a completed historical execution record with no live/in-progress
   field. Unconditional per D-09.

6. **BlackboardPanel.tsx:28 (`stateIcon.running`), CostBreakdown.tsx:69 (`tierFlagConfig["OPUS
   WORKER"].dotClass`), DockerPanel.tsx:52 (`refreshing`), DriftTimeline.tsx:140 (`summary.isDrifting`),
   RunTimeline.tsx:77 (`showThinking`), TeamStatusCards.tsx:91 (`team.status === "active"`) — all
   classified KEEP+GATE, none proposed in `<interfaces>` at all.** These are the concrete instances of
   "the 28 sites CONTEXT.md did not classify" that were genuinely missed by the plan's own Population C
   list (which enumerated 28 different unclassified sites but not these). Found by re-deriving the full
   47-site non-skeleton population from a fresh unfiltered grep rather than trusting the plan's own count.
   All verified state-gated by reading the surrounding conditional before classifying.

7. **ActiveSessions.tsx:33 (`group-hover:animate-pulse`) — classified OUT-OF-SCOPE, not proposed in
   `<interfaces>` and not named in D-09.** A CSS `:hover` pseudo-class trigger on the `>` prompt
   character, not a status dot rendered from JS state. D-09's rule is framed entirely in terms of
   render-time state values ("renders regardless of any state value" / "renders only when something is
   genuinely happening"), which doesn't cleanly map onto a hover micro-interaction. Left unedited: D-01
   forbids "adjacent cleanup" beyond the named kill-list, and this was never named. `src/index.css`'s
   global reduced-motion rule already neutralizes it for users with the OS preference regardless.

## §4 — Out of scope, with citations

- **`pages/Chat.tsx:235, 801, 802, 803, 804`** (5 sites) — `REQUIREMENTS.md:98` places "Regressing
  `/chat`" on the milestone's Out of Scope list; `/chat` is the in-repo north star and its easing is the
  house easing. `Chat.tsx` was not opened or edited by this plan. It already calls its own local
  `prefersReducedMotion()` at `:73`/used around `:810` — a sixth-not-fifth correction, see §5.
- **`src/layouts/DashboardLayout.tsx:89, :246, :572`** (3 sites) — owned by plan `120-02` (already
  executed in Wave 1; not touched here).
- **`src/components/HeroStatsBar.tsx:133`** (1 site) — owned by plan `120-05` (already executed in Wave
  1; not touched here).
- **`src/components/control-center/ReadinessPill.tsx:100`** — already gated; this is the in-repo
  precedent every gate added by this plan mirrors. Not edited, not in `files_modified`.

## §5 — Handoff to TOKEN-03 / Phase 122

Every surviving pulse this plan touched is gated via one of two mechanisms:

1. **`src/lib/prefersReducedMotion.ts`** (new, this plan) — used by 9 of the 10 files originally listed
   in Task 3, plus 6 additional files found via the full re-derivation (BlackboardPanel.tsx,
   CostBreakdown.tsx, DockerPanel.tsx, DriftTimeline.tsx, TeamStatusCards.tsx,
   workspace/WorkspaceMapCanvas.tsx) — 15 files total.
2. **Pre-existing, equally legitimate mechanisms**, left untouched per D-02 (no refactor): `VoiceControlBar.tsx`
   (`motion/react`'s `useReducedMotion()`), `ReadinessPill.tsx:39-41` (the precedent).

**Known duplication for TOKEN-03 to consolidate — corrected count.** This plan's `<interfaces>` named
FOUR pre-existing hand-copies of an equivalent reduced-motion predicate. A fifth was found during
execution:

1. `src/components/control-center/ReadinessPill.tsx:39-41` — the precedent this plan's new helper mirrors.
2. `src/components/voice/AvatarAura.tsx:70`
3. `src/components/voice/ShareScreenToggle.tsx:36`
4. `src/pages/Chat.tsx:73`
5. **`src/components/reminders/ReminderList.tsx:136`** — **not named in the plan's `<interfaces>`.**
   Qualitatively different from the other four: it's a React hook (`usePrefersReducedMotion()`) with a
   lazy-init state PLUS a live `matchMedia` `"change"` event listener via `useEffect`, so it actually
   updates if the OS preference flips while the page is open — the other four (and this plan's new
   `prefersReducedMotion()`) re-evaluate only on next render, with no live listener. Consumed at
   `ReminderList.tsx:303-306` and `:425-427`, both already correctly gated.

Plus this plan's own new **sixth** implementation, `src/lib/prefersReducedMotion.ts`, added for new gates
only per D-02 — not consolidated with any of the five above.

TOKEN-03's consolidation should decide whether the live-listener behavior in `ReminderList.tsx`'s hook is
the one worth promoting to the shared module (it is strictly more capable), or whether the simpler
re-evaluate-per-render form (used by the other five, including this plan's new helper) is sufficient
everywhere else.

**Verification caveat.** `src/index.css` already carries a global
`@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0ms !important } }`
rule. This means **a visual "did the pulse stop" check cannot distinguish a gated site from an ungated
one** — the CSS backstop stops the animation either way, for every `animate-pulse` in the app, gated or
not. TOKEN-03's audit needs to assert on the rendered **className** (does it contain `animate-pulse`
conditionally, gated on a `prefersReducedMotion()`-shaped predicate) rather than on observed motion.

**Also for Phase 122 (D-10 boundary, not this plan's job):** `workspace/WorkspaceMapCanvas.tsx:270`'s
loading-ring indicator (§3 item 2) and `ToolExecutionPanel.tsx:144` / `hr/detail/DetailConfigTab.tsx:62`'s
empty-state pulsing text (§3 item 4) all serve a loading/empty-state PURPOSE without matching D-10's
literal skeleton shape (neutral fill + block). TOKEN-04's skeleton/six-state-tile work should decide
whether these belong in the same unified loading-state contract as the `bg-muted` skeletons, since they
were resolved here by a case-by-case reading of D-09 rather than by a skeleton carve-out.


## §6 — Correction issued at phase close (external review)

An independent review of Phase 120 found the one substantive gap in this census, and it was a
CONTRADICTION inside the phase's own record rather than a missed site: this document listed
`SwarmTaskNode.tsx:122` and `WSStatusIndicator.tsx:23` as FOUND-NOT-IN-SCOPE, while D-11 and the
plan's success criteria state that **every** pulse surviving this phase is gated on
prefers-reduced-motion. Both survive, both were gated only on STATE, neither was gated on MOTION.

Being state-gated is what D-09 asks for (the pulse is not decorative). It is not what D-11 asks
for. Conflating the two is what produced the wrong classification.

Both are now gated per-site and the rows above are corrected rather than left standing.

**User impact was nil throughout, and saying so is not a defence of the record being wrong.**
`src/index.css:508-513` carries a global `@media (prefers-reduced-motion: reduce)` rule forcing
`animation-duration: 0ms !important` on every element, so a user with the OS preference set never
saw either pulse animate. The defect was that the phase asserted a per-site contract it had not
met — and Phase 122's TOKEN-03 audit asserts on the className, so it would have inherited two
sites that failed an audit this phase promised they would pass.

Lesson for the closure record: a census that classifies a site as out-of-scope must be checked
against the decision text, not against the plan's prelisted file set. Both files were outside
120-06's `files_modified`, which is what made "not in scope" feel correct.
