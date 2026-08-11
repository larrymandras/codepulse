# Phase 119 — Loom Curated Pipelines: Context

**Source of truth:** `docs/proposals/2026-08-07-seidr-suite-design.md` §4.4 (Seiðr Suite,
approved 2026-08-08). No REQ-IDs; the decisions below are the acceptance-bearing units.

**Dependencies:** none. Design doc §5 lists Loom as depending on "nothing (Ástríðr cron lens
improves after v29 A3)" — an improvement, not a gate.

---

## Pre-flight — every design-doc claim checked before planning

The same doc's Phase 117 section contained a false premise (a host:port join with no data
behind it), so its claims are treated as claims.

| Claim | Status |
|---|---|
| "React Flow (SwarmGraph's stack — do NOT hand-roll canvas)" | ✓ **holds.** `@xyflow/react ^12.11.1` installed. `SwarmGraph.tsx`, `SwarmTaskNode.tsx`, `SwarmEdgeParticle.tsx`, `useSwarmGraph.ts` and `swarmLayout.ts` all exist with tests. `AgentTopology.tsx:18,247-262` shows the `nodeTypes` + `<ReactFlow>` idiom. |
| "a tiny emit helper, same shape as existing `hooks/*.mjs` ingest" | ✓ **holds.** `hooks/codepulse-hook.mjs` is the donor: AbortController + timeout, env-var-first URL/key resolution. |
| "`/loom-author` scans `~/.claude/workflows/` (6 saved)" | ✓ **holds.** Exactly 6 present. |
| "UI in the GRAPHS nav group" | ✓ **holds.** 6 existing GRAPHS entries in `navRegistry.ts`. |
| "Mission Board = live jobs; Loom = curated pipelines" | ⚠ **the boundary has shifted — see D-07.** |

---

## Decisions (locked 2026-08-11)

- **D-01: Two tables, `pipelines` and `pipelineRuns`, per the design doc's field list.**
  Per-step docs live IN the row (`steps[].docMd`) rather than being served from disk, so the
  UI never reads the filesystem.

- **D-02: Live mode is HTTP emit, not a WebSocket layer.** A `loom-emit.mjs` helper POSTs step
  events to a Convex HTTP route; the row updates; the UI animates via its existing
  subscription. Anything that can run `node loom-emit.mjs step:complete 2` can drive the view
  — workflow scripts, skills, Ástríðr crons, GSD executors. No new realtime transport.

- **D-03: The emit route is bearer-gated and fail-closed**, matching Phase 116's
  `validateGaldrAuth` precedent. An unauthenticated emit must 401 before touching the db.

- **D-04: Agent/CLI only — no CORS, no OPTIONS partner**, same as the `/galdr` routes. The
  browser never calls the emit route; it reads through Convex subscriptions.

- **D-05: `pipelineRuns.stepEvents` is append-only and BOUNDED.** Phase 116's `promptVersions`
  cap (`PROMPT_VERSION_CAP = 20`, pruned inline on write) is the precedent. An unbounded event
  array on a long-running pipeline is the same growth hazard, and `aggregates` growth is
  exactly what Phase 110 is currently fighting. Cap chosen and pruned inline on write.

- **D-06: An unknown `pipelineSlug` on emit is a REFUSAL (404), never an implicit create.**
  Auto-creating a pipeline from a typo'd emit would fill the board with junk that looks
  curated. Pipelines are authored deliberately.

- **D-07: Loom is the only LIVE-progress surface in CodePulse, and that is a change from the
  design doc.** §4.4 drew the boundary as "Mission Board = live jobs (what is running,
  telemetry-derived); Loom = curated pipelines … optionally lit by live runs." Phase 111, in
  flight in a concurrent session as this was written, is doing the opposite of what that
  sentence assumes: `111-01-PLAN.md`'s own objective is to turn `JobsPanel` "from a
  live-looking background-jobs board into a truthful post-hoc mission history surface",
  stripping the pulsing dot and live chrome because the emitter never sends those states.

  So the two surfaces do NOT overlap, but not for the reason the doc gives: Mission Board is
  becoming *history*, which makes Loom's live mode more load-bearing, not less. Cross-link,
  still do not merge.

- **D-08: Deferred, so the absence reads as a decision** — the Ástríðr cron lens (the design
  doc itself defers it to v29 A3's `/api/inventory`) and manual in-UI pipeline authoring.
  `/loom-author` covers `~/.claude/workflows/` and GSD phase structures this phase.

---

## Gate (from the design doc)

One real pipeline (e.g. the `review-verify` saved workflow) authored via the skill renders with
per-step docs; a live run driven by real emits animates start→complete on every step; an error
event renders distinctly — **control: a clean run shows no error styling.**
