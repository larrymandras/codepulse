# Phase 111: Mission Board — Discussion Log

**Date:** 2026-08-10

## How this session ran

Prep was done read-only while Phases 110 and 116-08 were executing concurrently in the same
checkout. No `gsd-sdk state.*` verb was run and nothing was committed during the prep, deliberately:
`workflows/discuss-phase.md:460` calls `state.record-session` and `:464` commits
`.planning/STATE.md`, which would have rewritten STATE.md underneath Phase 110's uncommitted edits
and risked sweeping its staged files. Both sessions have since landed (`1e8ddccc docs(110-05)`).

## What the prep found

The discussion opened against a falsified premise rather than a blank slate. `ROADMAP.md:806-808`
described Phase 111 as a live mission board, frontend-only, "built entirely on data that streams
today." A live probe of `subagentJobs` on the self-hosted instance showed 7 rows ever, all terminal
states, newest 2026-07-07, `submittedAt === finishedAt` in every row, and no join key to tool
activity. Full evidence table is in `111-CONTEXT.md` `<constraints>`.

Consequences carried into the discussion: MISSION-01's *live*, *duration* and *orphan* clauses each
lack backing; MISSION-02 has no data path at all; MISSION-03 is the only fully satisfiable
requirement, and it is the one that rules out papering over the other two.

## Decisions taken

**Q: How should Phase 111 be scoped, given the premise is falsified?**
Options put: (a) rescope to a truthful history board, frontend-only, emitter revival to its own
cross-repo phase; (b) grow 111 into a cross-repo phase that repairs the emitter first; (c) park 111
and run Phase 113 instead.

**A: (a) — rescope to a truthful history board.** → D-01, D-02.
Keeps 111 small and shippable now; the live board is not abandoned, it moves to a phase that first
earns the data. A half-live board was explicitly ruled out as the one option MISSION-03 forbids.

**Q: What is MISSION-02's disposition, given no join key exists and `toolExecutions` is on 14-day
retention?**
Options put: defer to the emitter phase with evidence recorded; retire outright; or keep it in 111
and build the join key (only coherent under scope option (b)).

**A: Defer to the emitter phase.** → D-03.
Marked blocked-on-astridr in REQUIREMENTS.md rather than left `Pending` against a phase that
provably cannot deliver it.

## Discovered during the discussion, not before it

`ActiveAgentsPanel.tsx:35` filters `job.status === "running"` against a table that structurally
never receives a `running` row, so it renders **"No agents running." permanently and
unconditionally** — mounted at `Chat.tsx:1054`. This was not in the phase's original framing and is
a live defect on a daily-use page. Pulled into scope as D-07, and it is why D-06 states the fix must
be applied to every consumer of this data as a class rather than to `JobsPanel` alone.

## Deferred / out of scope

- Emitter revival: real `submittedAt`, non-terminal states, mission↔tool correlation key (D-02).
- MISSION-02 in full (D-03); MISSION-01's duration and orphan halves (D-04).
- Bounding `subagentJobs` in `RETENTION_DAYS` (D-11) and `listRecent`'s unbounded `.collect()`
  (D-12) — both move to the emitter phase, where they become load-bearing.

## Follow-ups for other phases

- `ROADMAP.md`'s Phase 111 entry carries the falsified "frontend-only / streams today" claims and is
  corrected in place per the Stale Docs rule.
- `astridr-repo/docs/astridr-contract.md` — named by **Phase 112's** success criterion 1 — lives in
  astridr-repo, not codepulse. Phase 112 is therefore cross-repo and its roadmap entry does not say so.
