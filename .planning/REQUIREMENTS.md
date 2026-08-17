# Requirements

**No active milestone.** v14.0 shipped 2026-08-17; the next milestone's requirements will be written here by `/gsd-new-milestone`.

Prior milestones (requirements archived in full, extract-don't-delete):

- **v14.0 — Per-Agent Engine Visibility, Convex Durability & Mission Board** shipped 2026-08-17 → [milestones/v14.0-REQUIREMENTS.md](milestones/v14.0-REQUIREMENTS.md). Phases 108–119, 86 plans, **15/17 satisfied**. Two exceptions, both deliberate: **MISSION-01 ⚠ PARTIAL** (duration + orphan recovery deferred to SEED-007) and **MISSION-02 ↗ REASSIGNED** to SEED-007 (blocked on astridr — no job↔tool join key exists). Phases 114–119 were design-doc-driven and carry `D-NN` decisions rather than REQ-IDs.
- **v13.0 — Brain-Swap Control, Cost Intelligence & Consolidation** shipped 2026-08-06 → [milestones/v13.0-REQUIREMENTS.md](milestones/v13.0-REQUIREMENTS.md). Phases 103–107, 53 plans, **14/15 satisfied**. Its one exception, **BSC-01 ⚠ PARTIAL** (per-agent axis deferred), was picked up and closed by v14.0's ENGINE category.
- **v11.0 — Skills Command Center** shipped 2026-07-25 → [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22).
- **v12.0 — Reminders & Calendar** shipped 2026-07-23 → [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md) (9/9).

---

## Carried forward from v14.0 (non-blocking, not yet scoped)

Retained at the v14.0 close so nothing is silently dropped. None of these blocked the milestone;
each is recorded with why it is open rather than merely listed. Full evidence in
[milestones/v14.0-MILESTONE-AUDIT.md](milestones/v14.0-MILESTONE-AUDIT.md).

1. **MISSION-01 — duration + orphan recovery** → SEED-007. Deferred by decision D-04 and blocked on **data shape, not effort**: `submittedAt` is a synthetic copy of `finishedAt` in 7 of 7 rows so no duration is derivable, and `runtimeIngest.ts:594-596` routes terminal-state events only, so no `running` row can arrive and the orphan clause is vacuous rather than unbuilt. **Do not tick MISSION-01's checkbox** — it has been auto-re-ticked by tooling twice and reverted twice; the traceability row is authoritative.
2. **MISSION-02 — humanized tool activity per mission** → SEED-007. Blocked on astridr (D-03): `toolExecutions` carries no `jobId`, `subagentJobs` carries no `sessionId`/`traceId`, 0 of 7 rows carry either, and `toolExecutions` is on 14-day retention so a retroactive key could not recover history. Needs an astridr-side emitter change before it is buildable at all.
3. **`message_routed` routed but unsurfaced.** `convex/telemetryDispositions.ts:111-117` — disposition is `routed` to `messageRoutes`, deliberately without a UI surface pending its own design pass (D-13). Disclosed in the disposition record itself, not a silent gap.
4. **`links` has no recorded retention decision.** `convex/bifrost.ts:53` does an unbounded `ctx.db.query("links").collect()` on the public `list` query, and `retention.ts` — which documents explicit exemptions for `prompts`/`promptVersions` (116 D-13) and `media`/`mediaStyles`/`mediaModels` (118 D-03) — names `links` nowhere. Low practical risk (operator-curated, so growth is bounded by human curation rate rather than telemetry volume). Note `galdr.ts` also contains 5 `.collect()` calls, so this is a missing *decision*, not a unique unbounded read.
5. **`llm-analytics-rollup` CR-01** — move the Analytics LLM queries onto the `aggregates` rollups. Parked in `todos/pending/`, reviewed 2026-08-17; neither of its own triggers has fired. One-phase-sized, so roadmap material rather than a todo.
6. **`detectCredentialValue` rule C** still treats a colon or hyphen as breaking a run, so a `<uuid>:<32-hex>` key measures 36 unbroken chars against its bound of 40. Rule A now catches that shape **by name**, so the realistic paste is covered; relaxing C has its own false-positive surface and was deliberately not done.
7. **Nyquist coverage is partial.** Compliant: 108, 110, 111, 115, 116, 118. Partial (`nyquist_compliant: false`): 109, 112, 113, 114. No VALIDATION.md: 117, 119 — both shipped with a phase-level summary and no per-plan PLAN files, consistent with their 0/0 plan counts.
8. **DEBT-06 remains latent.** The intermittent `Chat.test.tsx` brain-pill failure was **closed guarded**, not root-caused — 80 clean full-suite soak iterations produced no reproduction, so no captured failure ever existed to diagnose. Instrumentation was shipped so the next occurrence self-diagnoses.
9. **Phase 115's D-05 is partial by design**, and its VERIFICATION is `passed-with-concerns` (15/17 decisions, 1 partial, 1 failed-then-remediated) — recorded rather than rounded away.

### Still open from the v13.0 close

10. **Astridr event-kind coverage** — partly absorbed by TELE-01..03. Any kind TELE-03 disposed as "generic-table-by-design" is closed rather than carried.
11. **Cross-repo, astridr:** `feature/brain-swap` → `main` divergence (a release decision, not a bug); `web.py` on `feature/brain-swap` still carries the decommissioned-host CORS default that was removed on `main`. Production runs `feature/brain-swap`, so this stays a live consideration for any ENGINE-adjacent work.
