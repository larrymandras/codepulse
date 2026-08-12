# Phase 112: Telemetry Coverage Closure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 112-telemetry-coverage-closure
**Areas discussed:** Disposition bar for TELE-03, Build scope, Group A correction, Drift guard

---

## Pre-discussion measurement

Before any question was asked, the phase's central premise was re-measured because it was
stale. `105-tool-trace-observability/deferred-items.md:91-97` states `governor_decision` is
"the one kind in the whole list confirmed live", from a **0.66 h** sample taken ~2026-08-06,
with the document itself conceding that window "says nothing about whether they fire in
practice" for the other six.

Re-measured 2026-08-12 against the live self-hosted instance over the full 14-day retention
window, using bounded indexed reads (`events:listByType`), with both controls in the same run:

- Known-present control `llm_call` → rows returned.
- Known-absent control `definitely_not_a_real_kind_9x7q2` → none.
- Therefore the zeros discriminate.

Result: **`message_routed` also arrives live** — the stale premise was wrong by one kind, and
that changed the framing of the build-scope question before it was asked. Full per-kind table
is in CONTEXT.md D-03.

---

## Disposition bar for TELE-03

| Option | Description | Selected |
|--------|-------------|----------|
| Live arrival in the window | Bar = arrived in the last 14 days, proven by control-paired probe. Passes `governor_decision` + `message_routed`; other 4 disposed generic-by-design with a re-measurable reason. | ✓ |
| Arrival AND a named operator question | Stricter — must also name the question an operator would open a dashboard to answer. Likely passes `governor_decision` alone. | |
| Retention horizon drives it | Route anything worth keeping past 14 days regardless of current volume. Inverts the other two. | |

**User's choice:** Live arrival in the window.
**Notes:** A fourth option — "emitter exists in code" — was deliberately not offered, because
it would pass all 6 kinds, which is precisely the switch-coverage symmetry that
`REQUIREMENTS.md:57` forbids. Context supplied during the question: `convex/retention.ts:43`
caps `runtime_events` at 14 days while routed domain tables sit at 30–90, so
"generic-table-by-design" is not a neutral disposition — it is a 14-day history horizon.

---

## Build scope

| Option | Description | Selected |
|--------|-------------|----------|
| `governor_decision` now, `message_routed` gated | Route + surface `governor_decision`; record `message_routed`'s bar-pass but gate its build on a measured rows/day figure first. | ✓ |
| Build both | Route + surface both. Cleanest read of the bar, but accepts the unmeasured volume risk. | |
| Disposition-only, build nothing | Record dispositions and fix the contract doc; ship no table or UI. | |

**User's choice:** `governor_decision` now, `message_routed` gated.
**Notes:** The gate exists because no volume figure exists for `message_routed`, and standing
up a dedicated domain table for an unmeasured high-frequency kind on this single-node
self-hosted instance is the documented tombstone/OOM hazard. `governor_decision` carries no
such question — it fired ~12 minutes before the measurement and is low-volume policy signal.

---

## Group A correction (astridr-repo)

| Option | Description | Selected |
|--------|-------------|----------|
| Annotate in place + kill the alert rows | Keep §2.20–2.24, add a dated "NOT EMITTED — aspirational" banner to each, remove the 3 critical-events rows at 1785–1787. § numbering preserved. | ✓ |
| Move to an "Aspirational" appendix | Relocate all five to a fenced appendix. Strongest visual separation, but renumbers §2.25–§2.40. | |
| Delete outright | Remove the five sections and the 3 alert rows; the PRD remains as the record of intent. Leanest, but renumbers and loses the trace. | |

**User's choice:** Annotate in place + kill the alert rows.
**Notes:** The recommendation was grounded in the doc's own changelog (line 1884), which
records a prior renumbering ("Sections renumbered §3→§5 through §12→§14") as a disruption.
Relocating or deleting would renumber §2.25–§2.40, including §2.40 `governor_decision` — the
section this phase builds against.

---

## Drift guard and disposition record

| Option | Description | Selected |
|--------|-------------|----------|
| CodePulse const + test | Dispositions as a machine-readable const with a test asserting every kind is routed or explicitly generic. Mirrors `RETENTION_DAYS` + `retention.test.ts`. | ✓ |
| Two-sided: also an astridr-repo emitter probe | The above plus a probe in astridr-repo failing when the contract documents a kind nothing emits. Better coverage, second repo, beyond the requirement's letter. | |
| Prose only, dated | Record dispositions in phase artifacts and a dated contract-doc section, no executable guard. | |

**User's choice:** CodePulse const + test.
**Notes:** The rejected two-sided option was preserved as a Deferred Idea (CONTEXT.md D-12)
rather than dropped — it is the guard that would have caught the Group A defect class at
source rather than months later.

---

## Claude's Discretion

- Table/column naming, index choice, and the retention window for the `governor_decision`
  domain table, within the "bound it before it grows" constraint (D-06).
- The file and shape of the disposition const and its test, provided it fails on an
  undisposed kind.
- Exact banner wording, provided it preserves intent per D-09.

## Deferred Ideas

- astridr-repo emitter probe (the rejected two-sided drift guard) — D-12.
- `message_routed` domain route, if D-05's volume measurement disqualifies it here.
- Actually emitting the 5 Group A kinds — an astridr feature, excluded by `REQUIREMENTS.md:74`.

## Reviewed todos (not folded)

Both pending todos matched at score 0.4 on the literal keyword "phase":
`111-devtools-issues-panel-entry-unexamined.md` (a Phase-111 devtools console badge) and
`llm-analytics-rollup-migration-cr01.md` (the Phase-110/104 Analytics rollup migration).
Neither is telemetry-contract work; recorded as reviewed-not-folded without spending a
question turn on them.
