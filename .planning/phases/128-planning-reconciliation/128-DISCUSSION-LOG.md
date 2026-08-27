# Phase 128 Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `128-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 128-planning-reconciliation
**Areas discussed:** RECON-04 stale-Partial detection, scope vs. already-performed reconciliation, todo evidence bar, seed status vocabulary

---

## RECON-04 — catching a stale `Partial` without forcing Partials green

Surfaced during codebase scout, not from the requirement text. `src/requirementsDrift.ratchet.test.ts:25-29`
explicitly refuses to police `Partial`, calling it "the `phase.complete` false-green failure mode
in a different costume." RECON-04 was authored without having read that comment, so the
requirement and the code it targets were in direct conflict.

| Option | Description | Selected |
|--------|-------------|----------|
| Freshness stamp on Partial cells | Stamp predating the phase's completion commit fails the ratchet; detects staleness without judging disposition | ✓ |
| Cited-evidence liveness check | Partial must cite file:line; fails if path/symbol is gone | |
| Honour the rationale — don't touch Partial | Repoint RECON-04 at the orphan hole at `:129` instead | |
| Both stamp and liveness | Belt and braces | |

**User's choice:** Freshness stamp.
**Notes:** Threads the existing objection rather than overruling it — the recorded argument is
against forcing a Partial toward Complete, and a freshness check never asks whether the cell
should be Complete. Consequence captured as D-02: the file's header comment must be updated in
the same change, or the stated rationale and the behaviour diverge.

---

## Scope — reconciliation already performed during v16.0 scoping

The orchestrator had already dissolved the carried-forward list (`89def342`) and tagged all 18
todos (`02e6557e`) while scoping the milestone, making part of RECON-02/03 arguably done.

| Option | Description | Selected |
|--------|-------------|----------|
| Re-verify independently | 128 re-derives the scoping claims against code | ✓ |
| Take it as done, plan only the remainder | Smaller phase; trusts filed status | |
| Re-verify only the 8 "already-fixed" claims | Middle path | |

**User's choice:** Re-verify independently.
**Notes:** Inheriting the orchestrator's sweep would reproduce the exact failure mode this phase
exists to fix. Captured as D-04/D-05, including that a disagreement with the scoping claim is a
FINDING to record, not an error to quietly correct.

---

## Evidence bar for the 14 todos staying open

| Option | Description | Selected |
|--------|-------------|----------|
| file:line showing the defect still present | Same bar to keep open as to close | ✓ |
| Re-affirm trigger condition only | Cheaper; paperwork check | |
| Split by verifiability | file:line for code-visible, explicit note for visual | |

**User's choice:** file:line.
**Notes:** The rejected middle option's substance was retained anyway as D-07 — visual and
timing defects genuinely cannot be settled statically, so those record an explicit
"requires live measurement, deferred to Phase NNN" rather than a fabricated static proxy. The
cheap option was rejected because it cannot catch a todo fixed incidentally, which is what
happened to eight of them.

---

## Seed status vocabulary

Every remaining "dormant" seed is now scoped into v16.0 requirements, so both `dormant` and
`shipped` are wrong for them.

| Option | Description | Selected |
|--------|-------------|----------|
| New `absorbed` status + requirement IDs | Distinct from shipped and dormant | ✓ |
| Mark shipped where shipped, absorbed where scoped | Two vocabulary additions | |
| Keep dormant, add a pointer line | No vocabulary change | |

**User's choice:** `absorbed` + `absorbed_by:`.
**Notes:** The stated purpose is that `/gsd-new-milestone`'s seed scan stops re-proposing work
already on a roadmap. SEED-007 needs both fields — its repair half shipped, its board half was
absorbed. Mapping recorded as D-09, explicitly flagged for re-verification under D-04 rather
than applied on trust.

---

## Claude's Discretion

- Plan decomposition and wave structure.
- Stamp format for D-01 (date vs commit SHA), provided it can be compared against the phase's
  completion commit.
- Whether the seed frontmatter change is its own plan or folds into the todo sweep.

## Deferred Ideas

- Fixing any defect a todo describes — Phases 129-148 own those; each todo carries
  `resolves_phase`.
- The orphan-requirement hole at `requirementsDrift.ratchet.test.ts:129` — real and already
  recorded in-file; deliberately left unless the D-01 work touches that code path.
- GATE-01 (`phase-state.json`'s empty `missing`) and GATE-02 (public-repo posture) — Phase 138.

## Process note

`gsd-sdk query todo.match-phase 128` scored all 18 todos at 0.6 on the keywords
"todo, status, pending, phase" — words present in every todo file by construction. For a phase
whose subject is todos, that matcher produces only false positives and its output was discarded
in favour of the scope-based mapping committed in `02e6557e`.
