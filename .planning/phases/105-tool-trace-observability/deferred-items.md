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
