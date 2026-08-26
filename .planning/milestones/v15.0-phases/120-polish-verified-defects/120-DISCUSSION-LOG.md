# Phase 120: Polish & Verified Defects - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 120-Polish & Verified Defects
**Areas discussed:** Kill-list blast radius, Fabricated Integrations row, Pulse-dot rule, Status vocabulary & badge law, Destructive confirms (POLISH-03)

---

## Area selection

All four proposed gray areas were selected for discussion. A fifth (POLISH-03 scope) was added at the
end-of-discussion checkpoint after a premise correction surfaced.

---

## Kill-list blast radius

### Q1 — How wide does Phase 120 cut?

| Option | Description | Selected |
|--------|-------------|----------|
| Enumerated tokens only | Remove exactly the 8 named kill-list items; glow chrome survives to Phase 122. Mechanical, reviewable, one clean before/after axis. | ✓ |
| Tokens + co-located glow chrome | Also strip `glow-card` / `shadow-[var(--glow-*)]` / `hover:border-primary/50` in the same pass. Quiet surface a phase earlier, but cards land flat with no `--surface-*` tokens yet, and 122 re-touches the same 38 files. | |
| Tokens + centralize into GlassPanel | Collapse the repeated card class-string into the existing primitive so 122 edits one file. Highest leverage but a refactor, and ~half the sites are raw `div`s. | |

**User's choice:** Enumerated tokens only
**Notes:** Accepted consequence stated up front — the app still reads glowy after 120; the "wow" lands in 122.

### Q2 — Violet search pill

| Option | Description | Selected |
|--------|-------------|----------|
| Fix at the pill only | Swap the pill's `bg-accent/50` for a neutral treatment; leave `--accent` for TOKEN-02 across all 5 themes. | ✓ |
| Redefine `--accent` now | Kills the pill and every other accent surface, but is TOKEN-02 done without the three-hue law or contrast data. | |
| Audit every `bg-accent` site first | Report the consumer list before choosing. | |

**User's choice:** Fix at the pill only
**Notes:** Evidence gathered before the question — `DashboardLayout.tsx:600` uses `bg-accent/50`, `index.css:151` sets `--accent: #8b5cf6; /* Violet */` in the default cyan theme. Confirms the kill-list item is real, not a phantom.

### Q3 — The CodePulse wordmark

| Option | Description | Selected |
|--------|-------------|----------|
| Drop glitch + the glow | Remove `glitch-text` and the `drop-shadow`; keep `font-mono tracking-wider`. The glow is the same species of decoration on the same element. | ✓ |
| Drop glitch only | Strictly the enumerated item, consistent with Q1's rule. Glow waits for Phase 124's header rebuild. | |
| Drop glitch, glow, and mono | Full quiet wordmark now — pulls the Geist type law forward from 122/124. | |

**User's choice:** Drop glitch + the glow
**Notes:** Recorded in CONTEXT as a deliberate, named exception to D-01 so a reviewer doesn't read it as a violation.

### Q4 — Dead CSS definitions

| Option | Description | Selected |
|--------|-------------|----------|
| Delete the definitions too | ~60 lines of `index.css` including the Phase-89 suppression rules that exist only to neutralize them. Makes the "zero live hits" grep unambiguous. | ✓ |
| Leave definitions, remove usages only | Smaller diff; `index.css` is about to be rewritten by TOKEN-01 anyway. Risk: classes stay autocomplete-reachable. | |

**User's choice:** Delete the definitions too

---

## Fabricated Integrations row

### Q1 — What happens to the row?

| Option | Description | Selected |
|--------|-------------|----------|
| Delete the row | The honest version already ships on `/infrastructure`; rewiring duplicates a page. Dashboard hero is also Phase 125's ECG space. | ✓ |
| Rewire to `useIntegrationHealth` | Keep the row, drop LINEAR/VERCEL (no source), add SUPABASE/DOCKER/TELEGRAM/EMAIL. Honest but duplicative, and the dots then need real status colors, brushing POLISH-05. | |
| Delete now, note as a Phase 125 hero candidate | Pure removal in 120, intent preserved as a deferred idea. | |

**User's choice:** Delete the row
**Notes:** Verified before asking that `convex/integrations.ts:40 healthStatus` is genuinely derived from real tables (`gitCommits`, `events`, `supabaseHealth`) with per-type staleness thresholds — i.e. the "rewire" option was a real option, not a straw man. The deferred-idea substance from option 3 was recorded in CONTEXT anyway.

### Q2 — Does 120 sweep for other fabrications?

| Option | Description | Selected |
|--------|-------------|----------|
| Sweep and report, fix only the clear ones | Grep render paths for hardcoded arrays / `Math.random` / simulation comments; list every hit `file:line`; fix the unambiguous; record the judgment calls. | ✓ |
| Fix only HeroStatsBar | Strictly the one verified defect; others surface in 122's tile work. | |
| Sweep and fix everything found | Unbounded until the grep runs; risks blowing the "cheapest phase" framing. | |

**User's choice:** Sweep and report, fix only the clear ones
**Notes:** Honours the standing "fix the CLASS, not the instance" rule without letting the phase sprawl.

---

## Pulse-dot rule

Evidence presented before questions: 129 `animate-pulse` hits across 60 non-test files, in three
distinct populations (unconditional header dots / state-gated indicators / skeletons).

### Q1 — The decorative-vs-legitimate rule

| Option | Description | Selected |
|--------|-------------|----------|
| Unconditional pulse = decorative | Not gated on a state value → decoration, kill it. Renders only when something is happening → stays. Mechanically checkable; kills the header-dot cluster without touching meaningful dots. | ✓ |
| Kill every `animate-pulse` dot | Maximally quiet, zero judgment calls. Cost: "is this live now" gets harder to read, and Phase 125's Signal Horizon is what restores it — a 120→125 gap. | |
| Kill unconditional dots AND retire the header-dot pattern | Same rule plus no static dot left behind. Cleanest for Phase 124, but removes a "this panel is subscribed" affordance. | |

**User's choice:** Unconditional pulse = decorative
**Notes:** The kill is de-animate, not necessarily remove — option 3's wholesale retirement was explicitly not chosen, so a static dot may remain.

### Q2 — Skeletons

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope for 120 | Loading-state contract, not decoration; belongs to TOKEN-04 in Phase 122. Keeps the phases off the same files. | ✓ |
| Add `prefers-reduced-motion` gating now | Leave shapes, fix motion, since every hit is being audited anyway. | |
| In scope — reshape them now | Pulls TOKEN-04 forward; needs the six-state contract, which doesn't exist yet. | |

**User's choice:** Out of scope for 120

### Q3 — Reduced-motion gating on surviving pulses

| Option | Description | Selected |
|--------|-------------|----------|
| Gate them now, following `ReadinessPill` | Every surviving pulse gets the `ReadinessPill.tsx:100` treatment. Near-zero marginal cost; 122's TOKEN-03 audit then finds them compliant. | ✓ |
| Wait for TOKEN-03 | 120 stays pure deletion with a trivially reviewable diff. | |

**User's choice:** Gate them now
**Notes:** Q2's skeleton carve-out still applies — skeletons remain untouched.

---

## Status vocabulary & badge law

Evidence presented before questions: `ForgeStatusBadge.tsx` carries a load-bearing header comment —
*"SC#4 preserved: auth_failed (amber) MUST be visually distinct from failed (red)"* — and its
vocabulary (`queued/running/completed/failed/stopped/auth_failed/pending/stopping_pending`) is a
domain vocabulary, not display labels. Separately, every status currently renders **filled**.

### Q1 — Vocabulary vs. unmappable domain states

| Option | Description | Selected |
|--------|-------------|----------|
| 4 words are the spine; domain states keep their own label | Clean mappings applied; `auth_failed`/`queued`/`*_pending` keep distinct labels as documented exceptions. Satisfies "unified" without destroying SC#4. | ✓ |
| Strict 4 words, everything maps | `auth_failed→Failed` kills SC#4; `queued→Running` and `stopping_pending→Cancelled` are false. Badge would assert untrue states — the same defect POLISH-04 removes. | |
| Defer vocabulary, ship the fill law only | Smallest 120, but leaves POLISH-05 half-delivered against its own text. | |

**User's choice:** 4 words are the spine; domain states keep their own label

### Q2 — Shared primitive or in place?

| Option | Description | Selected |
|--------|-------------|----------|
| In place, per site | Consistent with the no-refactor rule locked in area 1; a `StatusBadge` belongs to TOKEN-05 in Phase 122. Cost: ~20 sites, 122 revisits. | ✓ |
| Build a shared `StatusBadge` now | Highest leverage, rule lives in one place. But it's a refactor with regression surface across ~20 sites. | |
| Extend `ui/badge.tsx` with a status variant | Uses the existing primitive, no new file. But `badge.tsx` is shadcn-generated; local edits complicate updates. | |

**User's choice:** In place, per site

### Q3 — How far does the badge sweep reach?

| Option | Description | Selected |
|--------|-------------|----------|
| Executions + Forge first, inventory the rest | Delivers the milestone's named acceptance criterion 5, bounds the phase, hands 122 a work-list instead of a discovery task. | ✓ |
| All ~20 sites in 120 | Closes POLISH-05 completely, but is the largest chunk of work in the cheapest phase, across heterogeneous status models. | |
| Executions only | Strictly the named surface; POLISH-05's text would need rewording to match. | |

**User's choice:** Executions + Forge first, inventory the rest

---

## Destructive confirms (POLISH-03)

Added after the end-of-discussion checkpoint, prompted by a premise correction: ROADMAP success
criterion 3 describes `Tasks.tsx:144-145` as a task-**delete** confirm; the code there is a
move-to-action-column WS dispatch confirm. Sweep results presented before the questions.

### Q1 — Does POLISH-03 also take `WarRoom.tsx:86`'s `window.confirm`?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — both sites | `window.confirm` is an unthemeable browser modal that fails the "confirmed in a dialog" law from the other direction, and it gates the more destructive action (deletes a room and its transcript). Sweep found only these two, so scope stays bounded. | ✓ |
| `Tasks.tsx` only | Strictly the named site; `window.confirm` at least can't be missed or auto-dismissed. | |
| Both, plus sanction the GlobalSwapModal undo | Convert both and explicitly record the toast-undo as legitimate. | |

**User's choice:** Yes — both sites
**Notes:** Option 3's substance was recorded in CONTEXT regardless (D-13) — `GlobalSwapModal.tsx:501` is an undo affordance firing *after* completion, not a pre-action gate, and must not be "fixed" by a future sweep.

### Q2 — What happens to the 5s timeout?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop the timeout entirely | `AlertDialog` with plain Confirm/Cancel. A confirm that expires is the exact failure mode the requirement targets. Matches `ForgeStopConfirmDialog` / `DeleteSkillDialog`. | ✓ |
| Keep a visible countdown | Preserves today's timing in a form that can't be missed, but reintroduces a self-dismissing decision and no other dialog does this. | |
| Drop the timeout and drop the pre-confirm | Dispatch immediately with a toast-undo. Better UX for a reversible move, but changes a prior phase's D-04 behavior contract — a design change, not a defect fix. | |

**User's choice:** Drop the timeout entirely

---

## Claude's Discretion

- **POLISH-02 — E-Stop fixed geometry.** Not discussed; method is open. Requirement is that the
  control never wraps or reflows at any viewport width, mobile through ultrawide.
- **POLISH-06 — sidebar / Settings collision at 900px.** Not discussed; mechanical CSS. Noted that no
  literal `900` breakpoint exists in either file today, so the collision must be reproduced before
  it's fixed.
- **POLISH-03 premise correction handling** — the corrected description of `Tasks.tsx:144-160` was
  written into CONTEXT without asking, per the standing Stale Docs rule (code wins, say so
  explicitly).
- **CRT-by-default verification** — recorded as already-satisfied (`DashboardLayout.tsx:392` defaults
  to `false`), with the toggle itself required to survive because SHELL-01 places it in the Phase 124
  header overflow menu.

## Deferred Ideas

- A real, emitter-backed integration strip on the Dashboard → Phase 125, alongside the Pulse ECG hero.
- Centralizing the repeated card class-string into `GlassPanel` → Phase 122 / TOKEN-01 (38 file edits
  become one).
- A shared `StatusBadge` primitive → Phase 122 / TOKEN-05; D-17's inventory is its input.
- Skeleton shapes and the six-state contract → Phase 122 / TOKEN-04.
- `--accent: #8b5cf6` as an app-wide token → Phase 122 / TOKEN-02, where violet becomes
  Ástríðr-exclusive across all 5 themes.

## Reviewed Todos (not folded)

- `.planning/todos/pending/llm-analytics-rollup-migration-cr01.md` — matched at 0.4 on weak keywords.
  Already scoped as DEBT-08 / Phase 121 per `REQUIREMENTS.md:74` and the traceability table. Not
  Phase 120 work.
