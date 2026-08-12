/**
 * telemetryDispositions.ts - the TELE-03 disposition record (Phase 112, D-10/D-11).
 *
 * Every remaining Group B event kind (control_verb_swap already disposed by
 * TELE-02, Phases 108/109 - not re-litigated here) gets exactly one entry
 * below: either routed to a domain table, or explicitly kept
 * generic-table-by-design. A kind missing from this record is a silent
 * drift - a kind this file used to dispose that quietly stops being
 * disposed, or a new Group B kind that never gets a verdict at all - the
 * same "typo'd table name is a permanent SILENT no-op" shape
 * convex/retention.ts's own header comment records for RETENTION_DAYS.
 * `telemetryDispositions.test.ts` is what turns that silent drift loud: it
 * asserts this record against the live `runtimeIngest.ts` dispatch switch
 * and `schema.ts` table set, not just against itself.
 *
 * D-01's bar (what a kind must clear to earn "routed" rather than
 * "generic-table-by-design"): live arrival inside the 14-day
 * `runtime_events` retention window, established by a control-paired probe
 * - never by the mere presence of an emitter in astridr source, which
 * would pass every kind and is exactly the switch-coverage symmetry
 * REQUIREMENTS.md:57 forbids.
 *
 * D-02's re-measurability rule: every disposition here is a claim about
 * LIVE data, so it must be re-checkable, not a one-time verdict. Re-measure
 * with `events:listByType` (indexed, bounded `.take()`) against the live
 * self-hosted instance via `--env-file` - NEVER `events:countByType`,
 * which `.collect()`s the whole firehose and is the unbounded-read pattern
 * that has taken this instance down (see CLAUDE.md's Self-Hosted Convex
 * Operational Rules). Pair the probe with a known-present control and a
 * known-absent control in the SAME run: the measurement of record
 * (2026-08-12) paired `llm_call` (known-present, returned 1,261 rows)
 * against `definitely_not_a_real_kind_9x7q2` (known-absent, returned 0
 * rows) - only that pairing lets a zero-row result for a silent kind
 * discriminate "genuinely absent" from "the probe itself is broken".
 *
 * D-03's scope caveat is binding on every "generic-table-by-design" reason
 * below: "no row in the 14-day window" means NOT IN THE RETENTION WINDOW,
 * it does NOT mean the kind was not emitted. All four silent kinds have
 * real emitters per the Phase 105 grep. No reason string here may claim a
 * silent kind lacks any emitter, was not emitted, or does not fire -
 * telemetryDispositions.test.ts enforces this with negative source-text
 * assertions against this file's own reason strings, so it is not a style
 * note an author could get away with relaxing.
 *
 * D-05's resolved gate: `message_routed` clears D-01's bar (10 rows in the
 * 14-day window, ~0.7-1.2 rows/day, bursty) - low-volume, not a firehose,
 * so it lands on D-05's "may be routed" branch rather than the
 * volume-justified-generic branch. Recorded here as "routed", not as an
 * exception to D-05.
 *
 * D-12: an astridr-repo-side emitter probe (a guard failing when
 * `docs/astridr-contract.md` documents a kind no astridr code emits - the
 * guard that would have caught the entire Group A defect class at source)
 * was CONSIDERED and deliberately NOT taken into this phase: it is a new
 * guard in a second repo and goes beyond TELE-01/TELE-03's letter. Recorded
 * in `112-CONTEXT.md`'s Deferred Ideas section, not dropped.
 *
 * D-13: `message_routed` is routed (its D-01 bar-passing verdict is
 * recorded below) but deliberately NOT given a UI surface this phase - its
 * routing metadata needs its own design pass, not a reskin of the
 * `governor_decision` surface built in this same phase. The surface is a
 * recorded follow-up, not an ambiguity.
 *
 * Timestamp unit note: every `runtime_events`/domain-table timestamp in this
 * codebase is epoch SECONDS, confirmed against wall clock at each
 * measurement below (e.g. the newest `governor_decision` row landing a
 * coherent ~8-12 minutes before the probe ran, not a 1970 date).
 */

/** A kind is either routed to its own domain table, or deliberately kept
 * generic - stored only in the shared `runtime_events` table, by design. */
export type Disposition = "routed" | "generic-table-by-design";

export interface DispositionEntry {
  /** "routed" or "generic-table-by-design" - see D-01's bar above. */
  disposition: Disposition;
  /** The domain table this kind is routed to. Present only when `disposition`
   * is "routed"; absent (never an empty string) for generic-table-by-design
   * entries, since there is no dedicated table to name. */
  table?: string;
  /** Why this kind received this disposition, citing the decision ID(s) it
   * traces to. D-03's scope caveat binds the wording of every
   * generic-table-by-design reason - see the file docstring above. */
  reason: string;
  /** ISO date (YYYY-MM-DD) the measurement behind this disposition was
   * taken, so a future reader can tell a deliberate disposition from a
   * stale one and knows when to re-run the D-02 recipe. */
  measured: string;
}

/**
 * One entry per remaining Group B event kind - keyed exactly as
 * `runtimeIngest.ts`'s dispatch switch and the live data spell it. Note the
 * dot in `vision.capture`: it is not an underscore.
 */
export const GROUP_B_DISPOSITIONS: Record<string, DispositionEntry> = {
  governor_decision: {
    disposition: "routed",
    table: "governorDecisions",
    reason:
      "Clears D-01's bar: measured 83.3 rows/day, 1,168 rows across the full 14.02-day window (uncapped read). Routed AND surfaced per D-04 - the Governor Decisions section on the Settings notifications tab.",
    measured: "2026-08-12",
  },
  control_verb_swap: {
    disposition: "routed",
    table: "controlVerbSwaps",
    reason:
      "Already disposed by TELE-02 in Phases 108/109 - routed to a domain table and surfaced as per-profile swap history. Not re-litigated by Phase 112; it is the precedent this phase follows.",
    measured: "2026-08-07",
  },
  message_routed: {
    disposition: "routed",
    table: "messageRoutes",
    reason:
      "Clears D-01's bar and D-05's volume gate resolved to the low-volume branch: 10 rows in the entire 14-day window, roughly 0.7-1.2 rows/day, bursty. Routed per D-13 but deliberately NOT surfaced this phase - its channel/sender/session routing metadata needs its own UI design pass, not a reskin of the governor_decision surface. The surface is a recorded follow-up, not an ambiguity.",
    measured: "2026-08-12",
  },
  prompt_assembly: {
    disposition: "generic-table-by-design",
    reason:
      "Emitter exists in astridr, no row in the 14-day window as of 2026-08-12. Fails D-01's bar, so a dedicated table would be built purely for switch-coverage symmetry, which REQUIREMENTS.md:57 forbids.",
    measured: "2026-08-12",
  },
  structured_output_exhausted: {
    disposition: "generic-table-by-design",
    reason:
      "Emitter exists in astridr, no row in the 14-day window as of 2026-08-12. Fails D-01's bar, so a dedicated table would be built purely for switch-coverage symmetry, which REQUIREMENTS.md:57 forbids.",
    measured: "2026-08-12",
  },
  "vision.capture": {
    disposition: "generic-table-by-design",
    reason:
      "Emitter exists in astridr, no row in the 14-day window as of 2026-08-12. Fails D-01's bar, so a dedicated table would be built purely for switch-coverage symmetry, which REQUIREMENTS.md:57 forbids.",
    measured: "2026-08-12",
  },
  control_verb_focus: {
    disposition: "generic-table-by-design",
    reason:
      "Emitter exists in astridr, no row in the 14-day window as of 2026-08-12. Fails D-01's bar, so a dedicated table would be built purely for switch-coverage symmetry, which REQUIREMENTS.md:57 forbids.",
    measured: "2026-08-12",
  },
};
