# Phase 112: Telemetry Coverage Closure - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the Ástríðr telemetry contract tell the truth, in two halves that live in
two different repos:

- **TELE-01 (astridr-repo, docs only, no CodePulse build)** — `docs/astridr-contract.md` stops
  documenting the 5 Group A event kinds as live behaviour.
- **TELE-03 (CodePulse)** — every remaining Group B kind receives a recorded, justified
  disposition: routed to a domain table and surfaced, or explicitly kept
  generic-table-by-design. None left ambiguous, and none built purely for switch-coverage
  symmetry.

`control_verb_swap` is already disposed (routed + surfaced by Phases 108/109, TELE-02) and is
NOT re-litigated here — it is the precedent, at `convex/runtimeIngest.ts:1022`.

**Not in this phase:** any new Group A ingest route (provably always empty — that is why
TELE-01 is a doc fix), and any rework of the `control_verb_swap` route.

</domain>

<decisions>
## Implementation Decisions

### Disposition bar (TELE-03)

- **D-01:** The bar a Group B kind must clear to earn "route + surface" is **live arrival
  inside the 14-day `runtime_events` retention window**, established by a control-paired
  probe rather than by the presence of an emitter in astridr source. A kind that fails the
  bar is disposed `generic-table-by-design` with the recorded reason "emitter exists in
  astridr, no row in the 14-day window as of the measurement date". Rejected alternatives:
  "emitter exists in code" (would pass all 6 — this is exactly the switch-coverage symmetry
  `REQUIREMENTS.md:57` forbids), "arrival AND a named operator question" (stricter than
  needed), and "retention horizon drives it" (inverts the measurement into a judgement call).

- **D-02:** The disposition of each kind is a claim about **live data**, so it must be
  re-measurable. Any plan asserting a kind is absent MUST pair the probe with a
  known-present control and a known-absent control in the same run — an absence measured by
  a probe that cannot show presence is not evidence. The measurement in D-03 already
  satisfies this and is the template.

- **D-03:** The measurement of record, taken 2026-08-12 against the live self-hosted
  instance via `events:listByType` (indexed, bounded `.take()` — NOT `events:countByType`,
  which `.collect()`s the whole firehose and is the unbounded-read pattern that has taken
  this instance down):

  | Group B kind | Newest row | Disposition under D-01 |
  |---|---|---|
  | `governor_decision` | ~12 min before measurement | **PASSES** → route + surface |
  | `control_verb_swap` | ~1.9 days | already routed (TELE-02, Phase 108/109) |
  | `message_routed` | ~5.1 days | **PASSES** → route, but gated (see D-05) |
  | `prompt_assembly` | none in 14 d | generic-table-by-design |
  | `structured_output_exhausted` | none in 14 d | generic-table-by-design |
  | `vision.capture` | none in 14 d | generic-table-by-design |
  | `control_verb_focus` | none in 14 d | generic-table-by-design |

  Controls in the same run: `llm_call` (known-present) returned rows; a bogus kind
  `definitely_not_a_real_kind_9x7q2` returned none — so the zeros discriminate. Timestamp
  unit confirmed as **epoch seconds** by comparing the newest `governor_decision` row
  against wall-clock at measurement time (a coherent ~12 min, not a 1970 date).

  **Scope caveat that must survive into the plan:** "none in 14 d" means *not in the
  retention window*, NOT *never emitted*. All four silent kinds have real emitters per the
  Phase 105 grep. The recorded reason must say this; it must not be written as "never fires".

### Build scope

- **D-04:** `governor_decision` is **routed to a domain table and surfaced** in this phase.
  It is the strongest candidate on the evidence — actively flowing, low-volume policy signal,
  and already named in `REQUIREMENTS.md:57` as the strongest routing candidate. This satisfies
  the roadmap's success criterion 3 by construction rather than by argument.

- **D-05:** `message_routed` clears D-01's bar, and that pass is recorded — but its build is
  **gated on a measured rows/day figure obtained first**. Rationale: no volume figure exists
  for it, and standing up a dedicated domain table for an unmeasured high-frequency kind on
  this single-node self-hosted instance is the documented tombstone/OOM hazard (see the
  Self-Hosted Convex operational rules in `CLAUDE.md`, and `convex/retention.ts:38-45`). If
  the measurement shows it is low-volume, it may be routed in this phase; if it is a
  firehose, the disposition becomes "bar-passing but deliberately generic, volume-justified"
  — which is a legitimate D-01 outcome, not an exception to it, and the reason is recorded
  either way. **Neither outcome may be left ambiguous** (`REQUIREMENTS.md:57`).

- **D-06:** Any new domain table introduced here is **bounded in `RETENTION_DAYS` before it
  can ever grow**, following the established pre-emptive pattern documented in-line at
  `convex/retention.ts` for `gatewayQuotaSnapshots` (D-20), `toolPolicyEvents` (Phase 105
  D-05) and `activeEngineSnapshots` (Phase 108 D-10). The window itself is the planner's
  call within that pattern; the requirement to bound it up front is not.

### TELE-01 — Group A correction in astridr-repo

- **D-07:** The 5 Group A kinds are corrected **in place**: §2.20–§2.24 of
  `astridr-repo/docs/astridr-contract.md` stay where they are and each gains a dated
  "NOT EMITTED — aspirational" banner. Sections are NOT deleted and NOT relocated.
  Rationale: the doc's own changelog (line 1884) records a prior renumbering as a
  disruption, and relocating these five would renumber §2.25–§2.40 — including §2.40
  `governor_decision`, the section this very phase builds against.

- **D-08:** The **3 critical-events rows at `docs/astridr-contract.md:1785-1787`** are
  removed. They define operator alerting on `worktree_lifecycle`, `batch_execution` and
  `loop_lifecycle` — all Group A, all with zero emitters — so the doc currently asserts
  alerts that can never fire. Marking the sections aspirational while leaving live-looking
  alert rows in the operations table would leave the defect half-fixed.

- **D-09:** The banner text must state **why** these kinds exist in the contract, not merely
  that they are unimplemented: per the changelog at line 1884 they were added in v1.6.0
  (2026-03-09) as a "Claude Code Feb/Mar 2026 release alignment" sourced from the
  `docs/new_claude_capabilities.md` PRD — i.e. documented ahead of implementation, by intent.
  A bare "not implemented" note loses the reason and invites someone to re-add them.

### Drift guard and the disposition record

- **D-10:** The TELE-03 dispositions become a **machine-readable const checked into
  CodePulse**, not prose. A test asserts every Group B kind is either routed or explicitly
  marked generic-by-design, so an unrouted/undisposed kind fails the suite rather than
  drifting silently. This deliberately mirrors the existing `RETENTION_DAYS` +
  `retention.test.ts` pattern, which exists for the same reason — its own in-line comment at
  `convex/retention.ts:35-37` notes a typo'd table name is "a permanent SILENT no-op".

- **D-11:** Each entry in that const carries its **reason and its measurement date**, so a
  future reader can tell a deliberate disposition from a stale one. Recording the date is
  what makes D-01's bar re-checkable rather than a one-time verdict.

- **D-12:** An astridr-repo-side emitter probe (failing when the contract documents a kind
  no code emits — the guard that would have caught the Group A defect class at source) was
  **considered and NOT taken into this phase**. It is a new guard in a second repo and goes
  beyond the letter of TELE-01/TELE-03. Recorded in Deferred Ideas rather than dropped.

### Claude's Discretion

- Table/column naming, index choice, and the specific retention window for the
  `governor_decision` domain table — within D-06's "bound it before it grows" constraint.
- The exact file and shape of the D-10 const and its test, provided it fails on an
  undisposed kind (this must be mutation-proven, not asserted).
- The precise wording of the D-07 banner, provided it satisfies D-09.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The contract being corrected (DIFFERENT REPO)

- `C:\Users\mandr\astridr-repo\docs\astridr-contract.md` — the contract itself, 1,889 lines.
  **This file is in astridr-repo, not CodePulse.** §2.20–§2.24 are the 5 Group A kinds;
  §2.40 is `governor_decision`; lines 1785–1787 are the critical-events rows to remove;
  line 1884 is the v1.6.0 changelog entry explaining why Group A exists.
- `C:\Users\mandr\astridr-repo\docs\new_claude_capabilities.md` — the PRD the Group A kinds
  were written from. Referenced by D-09. **Confirmed present 2026-08-12** (16 KB, mtime
  Mar 9, matching the v1.6.0 changelog date) — safe to cite in the banner.

### Scoping evidence (read before re-deriving anything)

- `.planning/milestones/v13.0-phases/105-tool-trace-observability/deferred-items.md:68-110`
  — the origin of the Group A / Group B split, with the per-kind emitter grep and the
  positive-control reasoning. **Note its stale premise:** it says `governor_decision` is the
  only kind confirmed live, measured in a 0.66 h window. D-03's 14-day measurement
  supersedes that — `message_routed` also arrives.
- `.planning/REQUIREMENTS.md:54-57` — TELE-01/02/03 as written, including the explicit
  prohibition on building "purely for switch-coverage symmetry".
- `.planning/ROADMAP.md` §"Phase 112: Telemetry Coverage Closure" — the 3 success criteria.

### CodePulse code this phase touches or imitates

- `convex/runtimeIngest.ts:1022` — the `control_verb_swap` case, the TELE-02 routing
  precedent to follow.
- `convex/retention.ts:35-45` — `RETENTION_DAYS`, the pre-emptive-bounding pattern (D-06)
  and the guard-test rationale (D-10).
- `convex/events.ts:267-281` — `events:listByType`, the bounded indexed probe used for D-03.
  `events:countByType` (line 310) is the unbounded `.collect()` alternative — **do not use it
  against the live instance.**
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — the mass-delete / bulk-read
  prohibitions that make D-05's gating necessary.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `convex/runtimeIngest.ts` dispatch switch (~60 routed cases): adding `governor_decision`
  is a same-shape addition, not a new mechanism.
- `events:listByType` + the `by_type` index: the read-safe way to probe any kind on the live
  instance, and the harness D-02 mandates for re-measurement.
- `RETENTION_DAYS` + `retention.test.ts`: an existing, working example of exactly the
  const+test drift guard D-10 asks for — including a test that asserts every key is a real
  schema table.

### Established Patterns

- New domain tables are added to `RETENTION_DAYS` in the same change that creates them, with
  an in-line comment recording why the window was chosen (three prior instances cited in D-06).
- Domain routing does not replace the generic row: `runtimeIngest.ts:513` always inserts into
  `runtime_events` as well, so routing `governor_decision` is additive and cannot lose data.
- Retention is 14 days for `runtime_events` vs 30–90 for domain tables — so routing changes a
  kind's effective history horizon. This is a consequence of D-04, not a separate decision.

### Integration Points

- Ingest: a new `case "governor_decision"` in `convex/runtimeIngest.ts`.
- Schema: a new domain table + index in `convex/schema.ts`, plus its `RETENTION_DAYS` entry.
- UI: a surface for the routed data (see the UI-SPEC note in Deferred/next-steps — this
  phase acquired UI work it did not have when the roadmap was written).
- astridr-repo: doc-only edits, no code, no rebuild.

</code_context>

<specifics>
## Specific Ideas

- The disposition record should read like `RETENTION_DAYS` reads today — a const a human can
  scan in one screen, with the reasoning in-line beside each entry rather than in a separate
  document. That file is the model to imitate, explicitly.
- The Group A banner should preserve *intent*, not just flag absence (D-09) — the failure
  mode to avoid is a future contributor re-adding the sections because nothing recorded why
  they were aspirational.

</specifics>

<deferred>
## Deferred Ideas

- **astridr-repo emitter probe (from D-12)** — a guard in astridr-repo that fails when
  `docs/astridr-contract.md` documents an event kind that no code emits. This is the guard
  that would have caught the entire Group A defect class at source rather than ~5 months
  later. Deliberately out of scope: new guard, second repo, beyond TELE-01/03's letter.
  Strong candidate for a future astridr-repo phase.
- **`message_routed` domain route** — if D-05's volume measurement disqualifies it in this
  phase, the route itself carries forward as a candidate once volume is known or once the
  instance's read-growth posture changes.
- **Group A implementation** — actually emitting the 5 aspirational kinds is an astridr-side
  feature, not a contract fix. Out of scope by REQUIREMENTS.md:74.

### Reviewed Todos (not folded)

- `111-devtools-issues-panel-entry-unexamined.md` — matched at 0.4 on the literal keyword
  "phase". It is a Phase-111 devtools console badge observation, unrelated to telemetry
  contract coverage. Not folded.
- `llm-analytics-rollup-migration-cr01.md` — matched at 0.4 on "phase"/"surfaced". It is the
  Phase-110/104 CR-01 Analytics rollup migration, a different subsystem. Not folded.

</deferred>

---

*Phase: 112-telemetry-coverage-closure*
*Context gathered: 2026-08-12*
