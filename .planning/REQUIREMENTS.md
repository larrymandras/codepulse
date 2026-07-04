# Requirements: CodePulse v10.0 — Eval & Trace Observability + Hardening

**Defined:** 2026-07-04 via `/gsd-new-milestone` (research skipped — scope pre-researched by the 2026-06-30 cross-repo capability audit; seeded in `.planning/todos/pending/eval-and-trace-observability-v10.md`).

## v10.0 Requirements

### Eval Pipeline (EVAL)

- [ ] **EVAL-01**: Ástríðr's emitted `task_quality` scores are received via a bearer-authed ingest endpoint and stored in an `evalScores` Convex table (idempotent on at-least-once retry) — scores are no longer dropped on the floor. Producer already exists: `astridr/.../langfuse_eval.py`.
- [ ] **EVAL-02**: A nightly Convex `internalAction` LLM-judges sampled sessions against a rubric and writes scores to `evalScores`.
- [ ] **EVAL-03**: Operator can see a per-persona quality KPI/trend, and a quality regression following a persona model/instruction change is detectable — flagged or alerted, joined against `profileSwitches`/`configChanges`.

### Trace Waterfall (TRACE)

- [ ] **TRACE-01**: `llmMetrics` rows carry a `traceId` grouping field (schema + ingest pass-through), backward compatible with existing rows that lack it.
- [ ] **TRACE-02**: Operator can open a session's LLM call chain as an in-app trace waterfall — timing bars, cost-per-call, cache annotations — replacing the dead-link `LangfuseTraceLink.tsx`.

### Hardening (HARD)

- [ ] **HARD-01**: `/cso` code-security audit run against the repo; confirmed findings remediated (zero-false-positive precision bar; findings require `file:line` evidence).
- [ ] **HARD-02**: Forge ingest key rotated — a real secret live in the Convex env and the Forge daemon; the placeholder `<new-strong-secret>` retired (see memory `forge-deployment-tidy-whale-981`).
- [ ] **HARD-03**: TypeScript 5.9→6.0 migration lands green — `tsc --noEmit`, full Vitest suite, and `vite build` all pass (was CI-red as dependabot PR #50, closed 2026-07-04).
- [ ] **HARD-04**: react-day-picker 9→10 migration lands green — calendar-consuming surfaces verified (was CI-red as dependabot PR #49, closed 2026-07-04).

## Future Requirements

- Per-session cache rollup surface (capability-audit #5 follow-on; the adjacent `runtimeIngest` agent_metric field-drop bug was already fixed in `aa145cd`).
- Eval rubric editing UI (v1 rubric is code-defined; revisit if rubric iteration becomes frequent).

## Out of Scope

- **Self-hosted Langfuse / Arize Phoenix** — the per-call data is already in Convex (`llmMetrics`); an external trace store adds ops burden without new signal.
- **New Ástríðr transport** — both EVAL and TRACE ride existing ingest paths (`/runtime-ingest` family); no new emitter protocol.
- **Winning-ad intelligence / analytics feedback loops** — Ástríðr-repo (UGC engine) concern, not a CodePulse surface.
- **Mobile app / multi-tenant / OTel collector** — standing exclusions carried from prior milestones (see PROJECT.md).

## Traceability

_Populated by the roadmap._

| Requirement | Phase |
|-------------|-------|
| EVAL-01 | — |
| EVAL-02 | — |
| EVAL-03 | — |
| TRACE-01 | — |
| TRACE-02 | — |
| HARD-01 | — |
| HARD-02 | — |
| HARD-03 | — |
| HARD-04 | — |
