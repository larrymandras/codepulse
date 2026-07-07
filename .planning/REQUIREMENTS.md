# Requirements: CodePulse v10.0 — Eval & Trace Observability + Hardening

**Defined:** 2026-07-04 via `/gsd-new-milestone` (research skipped — scope pre-researched by the 2026-06-30 cross-repo capability audit; seeded in `.planning/todos/pending/eval-and-trace-observability-v10.md`).

## v10.0 Requirements

### Eval Pipeline (EVAL)

- [x] **EVAL-01**: Ástríðr's emitted `task_quality` scores are received via a bearer-authed ingest endpoint and stored in an `evalScores` Convex table (idempotent on at-least-once retry) — scores are no longer dropped on the floor. Producer already exists: `astridr/.../langfuse_eval.py`.
- [x] **EVAL-02**: A nightly Convex `internalAction` LLM-judges sampled sessions against a rubric and writes scores to `evalScores`.
- [x] **EVAL-03**: Operator can see a per-persona quality KPI/trend, and a quality regression following a persona model/instruction change is detectable — flagged or alerted, joined against `profileSwitches`/`configChanges`.

### Trace Waterfall (TRACE)

- [x] **TRACE-01**: `llmMetrics` rows carry a `traceId` grouping field (schema + ingest pass-through), backward compatible with existing rows that lack it.
- [x] **TRACE-02**: Operator can open a session's LLM call chain as an in-app trace waterfall — timing bars, cost-per-call, cache annotations — replacing the dead-link `LangfuseTraceLink.tsx`.

### Hardening (HARD)

- [x] **HARD-01**: `/cso` code-security audit run against the settled tree (`src/`+`convex/`+build/config, D-04) — `95-SECURITY-AUDIT.md`. Verdict SHIP; `npm audit` 0 vulns; gitleaks CI + repo grep = 0 committed secrets. Four LOW findings, all `file:line`-evidenced, all operator-approved and **remediated in one pass**: (CSO-95-01) `validateIngestAuth` made fail-closed symmetric with the Forge path; (CSO-95-02) `insightsChat.ask` gated on `getUserIdentity()` before the billed LLM call; (CSO-95-03) `.gitignore` broadened to `.env`/`.env.*` with `!.env.example`; (CSO-95-04) CI actions SHA-pinned. Every finding resolved. Green bar green after remediation (tsc 0 / vitest 164 files / build 0). Dropped 4 candidates for precision (see doc's "What I dropped and why").
- [x] **HARD-02**: Forge ingest key verified real on both sides — closed as verification + documentation, **NO new rotation** (D-01: the 2026-07-05 secret verification stands; the `<new-strong-secret>` placeholder is retired). Prod Convex `tidy-whale-981` holds real secrets — `FORGE_INGEST_API_KEY` (48 chars) + `ASTRIDR_INGEST_API_KEY` (43 chars), `FORGE_INGEST_ALLOW_ANON` unset (fail-closed). The previously-unverified Forge-daemon side is now confirmed by a **live authenticated round trip**: the daemon (`C:\Users\mandr\forge`, host `lmofficenew`) POSTed a completed `codex`/`goal` job that landed as a fresh `forgeJobs` row in prod (`forgeJobId 01KWYJ2GVQ09WRQTRN96VP926Y`, `2026-07-07T15:10:18Z`, filtered by post-test timestamp + emitter identity — not stale rows); the Ástríðr side was corroborated by a live `events` row at 13:40:44Z. Two blockers found & fixed en route: (a) `docs/forge-deploy-checklist.md` used `.convex.cloud` for the three ingest URLs (HTTP actions are on `.convex.site`) — corrected `0ca0824`; (b) the forge daemon crashed on startup (`FOREIGN KEY constraint failed`, migration v4 rebuild) — fixed in the forge repo (`fix/db-migration-fk-rebuild`), DB migrated v3→v6 data-intact. No secret values recorded (char-counts + behavior only). See memory `forge-deployment-tidy-whale-981`.
- [x] **HARD-03**: TypeScript 5.9→6.0.3 migration lands green — `tsc --noEmit`, full Vitest suite, and `vite build` all pass. Resolved via a single tsconfig-level fix (`compilerOptions.types: ["node"]`) after TS 6.0 stopped auto-including `@types/node`'s ambient globals; all 22 PR #50 CI errors were one root cause (Node globals not found), zero API/strictness breakage, zero prod-file edits. Redundant `@types/diff@7` and `@types/js-yaml@4` DefinitelyTyped stubs removed (both major-mismatched with and superseded by the runtime packages' own bundled types). **Folded-scope note:** four other pending dependabot majors — `diff@8`, `js-yaml@5`, `jsdom@29`, `react-easy-crop@6` — had already merged to master 2026-07-04 (commits `142cc7c`, `ec42253`, `c0c7bac`, `ab2eab4`) and are verified green under this TS 6.0.3 bar.
- [x] **HARD-04**: react-day-picker resolved by deletion, not a 9→10 migration — `src/components/ui/calendar.tsx` was the sole `react-day-picker` importer with zero real consumers of its exported `Calendar`/`CalendarDayButton`. Deleted the dead primitive and dropped `react-day-picker` from package.json/lockfile, resolving CI-red dependabot PR #49 (closed 2026-07-04) at the root. Re-add via `npx shadcn add calendar` if a date-picker surface is ever needed.

## Future Requirements

- Per-session cache rollup surface (capability-audit #5 follow-on; the adjacent `runtimeIngest` agent_metric field-drop bug was already fixed in `aa145cd`).
- Eval rubric editing UI (v1 rubric is code-defined; revisit if rubric iteration becomes frequent).

## Out of Scope

- **Self-hosted Langfuse / Arize Phoenix** — the per-call data is already in Convex (`llmMetrics`); an external trace store adds ops burden without new signal.
- **New Ástríðr transport** — both EVAL and TRACE ride existing ingest paths (`/runtime-ingest` family); no new emitter protocol.
- **Winning-ad intelligence / analytics feedback loops** — Ástríðr-repo (UGC engine) concern, not a CodePulse surface.
- **Mobile app / multi-tenant / OTel collector** — standing exclusions carried from prior milestones (see PROJECT.md).

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EVAL-01 | Phase 93 | Complete |
| EVAL-02 | Phase 93 | Complete |
| EVAL-03 | Phase 93 | Complete |
| TRACE-01 | Phase 94 | Complete |
| TRACE-02 | Phase 94 | Complete |
| HARD-01 | Phase 95 | Complete |
| HARD-02 | Phase 95 | Complete |
| HARD-03 | Phase 95 | Complete |
| HARD-04 | Phase 95 | Complete |

**Coverage:** 9/9 v10.0 requirements mapped. No orphans.
