# Deferred Items — Phase 105 (out of scope, logged not fixed)

## From Plan 105-03 (2026-08-03)

Discovered while enumerating every event kind `docs/astridr-contract.md` documents
against `convex/runtimeIngest.ts`'s switch, per this plan's verification-discipline
requirement to "close the class" on the `tool_policy_event` silent-drop defect.

**Finding:** 11 contract-documented event kinds have no `case` in the switch and are
never routed to a domain-specific table:

- `message_routed` (§2.16)
- `instructions_loaded` (§2.20)
- `loop_lifecycle` (§2.21)
- `worktree_lifecycle` (§2.22) — note a *different*-named case, `"worktree_event"`,
  does exist; whether it's the same logical event under an old name or a genuine gap
  was not investigated (out of scope)
- `batch_execution` (§2.23)
- `auto_memory` (§2.24)
- `prompt_assembly` (§2.25) — the contract doc claims this routes to
  `api.promptAssembly.record`, but no `convex/promptAssembly.ts` module exists in this
  repo at all. This is doc/code drift predating this plan, not a regression it
  introduced.
- `structured_output_exhausted` (§2.30)
- `vision.capture` (§2.35)
- `control_verb_swap` (§2.38)
- `control_verb_focus` (§2.39)
- `governor_decision` (§2.40)

**Not data loss, unlike the pre-105-03 `tool_policy_event` case:** every one of these
still lands in the generic `runtime_events` table via the unconditional
`api.events.insertEvent` call that runs BEFORE the switch, for every event
regardless of switch coverage. `legacyEventData()` (`convex/ingestSummary.ts`)
passes all fields through unchanged for every `eventType` except `graph_snapshot`
(which it deliberately summarizes to dodge the ~1 MiB doc-size limit). So these 11
kinds are captured, queryable via the generic table, and bounded by the existing
14-day `runtime_events` retention — they just lack a structured domain table,
dedicated indexes, and UI surfacing, which is the same category of gap
`tool_policy_event` had (silent from a UI/domain-table perspective) but NOT the same
severity (no raw data loss).

**Scope boundary:** none of these 11 kinds are named in 105-03's `files_modified`,
objective, or `<threat_model>`. Building domain tables/UI for them is out of scope
for Phase 105 (D-01..D-16 cover `tool_executed`/`tool_policy_event` only). Logged
here per the Scope Boundary rule rather than fixed inline.

**Suggested next step:** a future phase/backlog item auditing all `docs/astridr-contract.md`
event kinds against `runtimeIngest.ts`'s switch coverage, and either building the
missing domain routes or updating the contract doc to mark them "generic-table only
by design."

### Scoping investigation 2026-08-06 — the list is ~half real, and 5 entries are doc drift

Investigated during the post-v13.0 debt sweep, ahead of any build work. The suggested
next step above ("audit all contract event kinds against the switch, then either build
the missing routes or mark them generic-table-by-design") was carried out for these
kinds specifically. **Result: the work is roughly half the size this item implies, and
the split is not where you would guess.**

Method — two independent checks, because neither alone is sufficient:
1. **Live arrival.** Sampled `runtime_events` and counted distinct `eventType`. Useful
   but WEAK on its own: 800 rows covered only **0.66 hours** (16:37→17:17Z), which
   cannot establish absence for a rare event. Recorded here so nobody repeats it as if
   it were conclusive.
2. **Emitter existence in astridr** (`feature/brain-swap`, the deployed branch). This is
   the decisive check: an event kind with no emitter cannot arrive in any window.

**Group A — NEVER EMITTED (0 occurrences anywhere under `astridr/`, not just 0 telemetry
calls — constants and f-strings included):**

```
instructions_loaded      loop_lifecycle      worktree_lifecycle
batch_execution          auto_memory
```

These five are described in `docs/astridr-contract.md` but **no code emits them**. The
contract is aspirational here, not a description of behaviour. Building CodePulse
ingest for them would be handling data that cannot arrive — a domain table that is
provably always empty. **The correct action for this group is to fix the contract doc,
not to build routes.** This is the same class of defect as §2.25's already-recorded
"contract doc claims a route that doesn't exist in this repo".

**Group B — REAL EMITTERS (`await ctx.telemetry.send(...)`), 7 kinds:**

```
message_routed               prompt_assembly           structured_output_exhausted
vision.capture               control_verb_swap         control_verb_focus
governor_decision
```

Verified by shape against a **positive control**: `governor_decision` emits via
`astridr/automation/governor.py:459` and was observed arriving live (6 rows in the
sampled window), proving that an emitter of this shape does reach CodePulse. The other
six use the identical `ctx.telemetry.send(<kind>, <payload>)` form — e.g.
`astridr/engine/control_verbs/swap_model.py:444,472` for `control_verb_swap`. None of
the other six appeared in the 0.66 h sample, which given that window says nothing about
whether they fire in practice.

**Correction to this item's own header:** it says "11 kinds". `governor_decision` was
listed in 105-03's summary as a twelfth and belongs here too — and it is the one kind in
the whole list confirmed live, so it is the strongest candidate if a domain route is
ever built.

**Recommended scoping if this becomes a phase:**
- Group A (5): documentation fix in astridr-repo. No CodePulse work.
- Group B (7): domain routes only where a consumer actually wants a dashboard. Nothing
  is being lost today — all of these are captured verbatim in `runtime_events` and
  bounded by its 14-day retention — so this is a queryability/UI improvement, not a data
  loss fix, and should be justified per-kind by a real UI need rather than built
  wholesale for switch-coverage symmetry.
