# Requirements

**Active milestone: v14.0 — Per-Agent Engine Visibility, Convex Durability & Mission Board** (Phases 108+, formalized 2026-08-06 via `/gsd-new-milestone`).

Prior milestones (requirements archived in full, extract-don't-delete):

- **v13.0 — Brain-Swap Control, Cost Intelligence & Consolidation** shipped 2026-08-06 → [milestones/v13.0-REQUIREMENTS.md](milestones/v13.0-REQUIREMENTS.md). Phases 103–107, 53 plans, **14/15 satisfied**. Its one exception, **BSC-01 ⚠ PARTIAL** (per-agent axis deferred), is picked up by this milestone's ENGINE category.
- **v11.0 — Skills Command Center** shipped 2026-07-25 → [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22).
- **v12.0 — Reminders & Calendar** shipped 2026-07-23 → [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md) (9/9).

---

## Scoping evidence (gathered 2026-08-06, before any requirement was written)

Recorded here because three of this milestone's five areas were scoped from inherited claims that turned out to be wrong or stale. Each requirement below rests on a check that was actually run, not on a prior document's assertion.

| Claim inherited | What the check showed |
|---|---|
| "astridr Phase 184.1 owns the per-profile brain-swap backend" | **False.** `grep -rn "184\.1"` across astridr's `.planning/` (ROADMAP, STATE, milestones) returns nothing. The brain-swap backend shipped as astridr **Phases 185/186** (`astridr/api/ws_commands.py:417-420`). Nothing was ever scheduled to deliver the per-profile axis. |
| "The per-agent axis just needs CodePulse UI" | **False.** `SwapSetCommand` (`astridr/api/ws_commands.py:235-247`) carries only `target: Literal["brain","voice"]`, `value`, `restore` — **no** profile/scope field. `grep -rn "active_engine\|activeEngine"` across astridr-repo returns **zero hits** — no per-profile engine telemetry emitter exists. Config-only equivalent exists (`astridr/engine/bootstrap/core.py:1356-1359`), which BSC-01 explicitly forbids as the source. |
| "`aggregates` is never pruned" | **True.** Defined at `convex/schema.ts:953`; `grep -c "aggregates" convex/retention.ts` → **0**. `RETENTION_DAYS` covers 15 other tables. |
| "The retention cron self-defeats via tombstones and dies at table `[0]`" | **Stale — already fixed.** `convex/retention.ts:112-127` replaced the head-rescan with a cursor-seeked, cutoff-bounded range scan on 2026-07-30 (write-up in `convex/retentionCursor.ts`). No requirement was written to re-fix it; DUR-02 verifies the fix on the live instance instead. |
| "SEED-002 is a CodePulse frontend build" | **Half true.** Its astridr half SEED-023 is `status: dormant`, `scope: Large`, and none of its runtime exists — `grep -rln "stream-json\|stream_json" --include=*.py astridr/` returns nothing, and there is no missions module. What *does* exist is `src/components/JobsPanel.tsx` + `subagentJobs` (`convex/schema.ts:1028`), leftovers of astridr Phase 168, which SEED-023 says it "RESCOPES". MISSION-03 draws the boundary. |
| "11–12 contract event kinds need domain routes" | **Roughly half is unbuildable.** Per Phase 105's own `deferred-items.md` scoping investigation: **Group A (5 kinds)** — `instructions_loaded`, `loop_lifecycle`, `worktree_lifecycle`, `batch_execution`, `auto_memory` — have **zero emitters anywhere in astridr**, so a domain table for them would be provably always empty. **Group B (7 kinds)** have real emitters. |

---

## Per-Agent Engine Visibility (ENGINE)

Closes **BSC-01**, the one requirement v13.0 left PARTIAL. Cross-repo: the astridr half is the critical path and is owned from this roadmap, same pattern as v11.0's Forge-daemon phase.

- [ ] **ENGINE-01** — Ástríðr emits per-profile active-engine telemetry whenever a profile's reasoning engine is resolved or swapped, carrying a real `profileId` and model id. An unresolved value is refused at emit rather than written as an `unknown` sentinel. *(v13.0 pruned 93 rows that were **all** `{profileId:"unknown", model:"unknown"}` — the axis has never carried a single valid row.)* **Code-complete, pending ENGINE-05 (reverted from premature Complete on 2026-08-07 gap closure):** 108-01 delivered the astridr-side emit + profileId/model + refuse-to-emit; 108-03 closed the remaining ingest-side gap (research Item 6 — a `status:"failed"` resolution could still render as a profile's live engine before this plan's skip) plus an adversarial-audit-found batch-poisoning gap (a non-string profileId/model threw instead of skipping). This requirement's text is a present-tense behavioral claim, and nothing has been deployed/exercised end-to-end yet: the running `astridr-agent` container holds pre-phase code, the Convex functions are not deployed, and the two halves have never run together. ENGINE-05 is the explicit separate gate for exactly this ("verified working end-to-end on the running stack BEFORE the dependent UI is enabled") and remains deferred to plan 108-07. Do not mark this Complete until ENGINE-05 closes.
- [ ] **ENGINE-02** — `swap.set` accepts a profile scope, so an operator can swap one agent's engine without affecting the others. An unscoped call keeps today's global behaviour byte-identical. **Code-complete, not yet checked off (2026-08-07):** 108-05 wired `swap_model.py`'s `_execute` to branch on `args["profile_id"]` — a scoped set/restore now writes ONLY the per-profile override, an unscoped set/restore writes ONLY the global one, proven both by unit tests (13 new, each asserting the negative half too) and live in-process against a real `ModelRouter` instance (before/after override state pasted in `108-05-SUMMARY.md`). Left Pending rather than checked off, following 108-04's own precedent for this exact requirement: nothing is deployed yet (the running `astridr-agent` container still holds pre-phase code, Convex functions not deployed), and ENGINE-05's live-stack gate (108-07, deferred this session) is the bar this phase set for "verified working," not a green unit suite alone.
- [ ] **ENGINE-03** — Operator can see each profile's **current** engine in CodePulse — the picker's "This profile" scope, the header badge, and the pre-swap confirm modal's current-engine column — sourced from telemetry, never from a config read. *(The D-14 boundary v13.0 established stays intact: config may drive a "has a pinned default" signal, but never the current-engine column itself.)*
- [ ] **ENGINE-04** — A per-profile swap reports honest live status: in-flight → success/failure → the *resulting* active engine reconciled back from Ástríðr, server-confirmed rather than optimistic. Matches the global axis contract BSC-04 already holds to.
- [ ] **ENGINE-05** *(integration gate)* — The per-profile emit and the scoped `swap.set` are verified working end-to-end on the running stack **before** the dependent UI is enabled. Closed *during* execution, not claimed after. *(BSC-05 / Phase-90 lesson: "endpoint exists ≠ integration works.")*

## Convex Durability (DUR)

- [ ] **DUR-01** — `aggregates` is bounded by a retention policy and pruned in batch-capped increments, never a bulk delete. *(The 2026-07-21/22 incident was caused by mass deletes producing tombstone storms; any new prune must ride the existing batch-capped machinery.)*
- [ ] **DUR-02** — Operator can confirm the nightly prune completes a full pass across **every** table in `RETENTION_DAYS`, verified against the live instance rather than only in code. *(The cursor fix shipped 2026-07-30; a full successful pass over all tables has not been separately observed and recorded.)*
- [ ] **DUR-03** — The convex-backend memory-growth root cause is identified with evidence, and either fixed or recorded as understood — with `ConvexNightlyRestart` documented as a deliberate mitigation rather than an unexplained workaround. *(Already established: `db.sqlite3` stays byte-identical across a ~7.6 → 31 GiB climb, so it is accumulated runtime working set, **not** data volume — which rules out retention as the lever and excludes any row-count hypothesis.)*

## Mission Board (MISSION)

Frontend-only, on data that streams today. The parts of SEED-002 needing astridr SEED-023's runtime stay planted.

- [ ] **MISSION-01** — Operator can see background missions as live cards carrying status, duration, and honest orphan recovery: a job lost to a restart renders as failed, never silently as still-running.
- [ ] **MISSION-02** — Tool activity on a mission renders as humanized labels ("reading Gmail…", "Write index.html") rather than raw tool names.
- [ ] **MISSION-03** — The board asserts no figure that has no emitter. Per-mission cost, confirm cards and squad grouping are **out of scope** and must not appear as empty or zeroed affordances — absent, not fabricated. *(Same honesty rule that caught the `{profileId:"unknown"}` rendering in v13.0.)*

## Telemetry Coverage (TELE)

- [ ] **TELE-01** — `docs/astridr-contract.md` no longer documents the 5 Group A kinds as behaviour; each is corrected or explicitly marked aspirational. astridr-repo change, no CodePulse build. *(Same defect class as §2.25's already-recorded "contract claims a route that doesn't exist".)*
- [ ] **TELE-02** — `control_verb_swap` is routed to a domain table and surfaced as per-profile swap history. Sequenced first among Group B because ENGINE-01 rides the same channel. *(Emitters at `astridr/engine/control_verbs/swap_model.py:444,472`.)*
- [ ] **TELE-03** — Every remaining Group B kind receives a stated disposition — route + surface, or explicitly generic-table-by-design — with a reason recorded per kind. None is left ambiguous, and none is built purely for switch-coverage symmetry. *(`governor_decision` is the one kind confirmed arriving live, so it is the strongest candidate if a route is built.)*

## Debt Sweep (DEBT)

Numbering continues from v13.0's DEBT-01..04.

- [ ] **DEBT-05** — A transient scan that misses part of the skill catalog no longer prunes live skill rows. *(`computeSkillPrunes` deletes rows for any name absent from an incoming snapshot; observed dropping ~56 live plugin skills, 185 → 131 → 185. Nothing permanently lost, but the catalog is briefly wrong.)*
- [ ] **DEBT-06** — The intermittent `Chat.test.tsx` brain-pill failure (`D-106-04-01`) is deterministic, root-caused from a **captured failure** rather than masked with a `waitFor`. *(Three candidate causes already refuted and recorded; the outstanding lever is capturing the actual `textContent` on failure.)*
- [ ] **DEBT-07** — `convex-selfhost/`'s compose `logging:` block and restart scripts are under version control, not living only on disk.

---

## Out of Scope (this milestone)

- **astridr SEED-023's background-mission runtime** — sandboxed worker, `claude -p --output-format stream-json` parse, per-mission-class allowlists, cost streaming. `scope: Large` and entirely unbuilt; owning it would make it the milestone's centre of gravity. MISSION-* deliberately builds only on today's data.
- **Per-mission cost, confirm cards, squad grouping** — downstream of the above. Remain planted in SEED-002.
- **SEED-001 (anchored doc-comment HITL UI)** — trigger is "next doc/review surface work, OR on demand"; no doc/review surface work in this milestone.
- **Domain routes for Group A event kinds** — provably always empty; TELE-01 fixes the contract doc instead.
- **Rewriting the retention prune's batching** — the head-rescan self-defeat was already fixed 2026-07-30; DUR-02 verifies rather than rebuilds.

---

## Traceability

Filled by the roadmapper.

| REQ-ID | Phase | Status |
|--------|-------|--------|
| ENGINE-01 | Phase 108 | Pending |
| ENGINE-02 | Phase 108 | Pending |
| ENGINE-03 | Phase 109 | Pending |
| ENGINE-04 | Phase 109 | Pending |
| ENGINE-05 | Phase 108 | Pending |
| DUR-01 | Phase 110 | Pending |
| DUR-02 | Phase 110 | Pending |
| DUR-03 | Phase 110 | Pending |
| MISSION-01 | Phase 111 | Pending |
| MISSION-02 | Phase 111 | Pending |
| MISSION-03 | Phase 111 | Pending |
| TELE-01 | Phase 112 | Pending |
| TELE-02 | Phase 108 | Pending |
| TELE-03 | Phase 112 | Pending |
| DEBT-05 | Phase 113 | Pending |
| DEBT-06 | Phase 113 | Pending |
| DEBT-07 | Phase 113 | Pending |

---

## Carried forward from v13.0 (non-blocking, not scoped into v14.0)

Retained from the v13.0 close so nothing is silently dropped. Items 1, 2 and 3 are now **absorbed** into this milestone's DUR-03, ENGINE-*, and DEBT-05 respectively; the rest stay open.

1. ~~convex-backend memory growth — root cause OPEN~~ → **absorbed as DUR-03**.
2. ~~BSC-01 per-agent axis~~ → **absorbed as the ENGINE category**.
3. ~~Skill-registry prune churn~~ → **absorbed as DEBT-05**.
4. **Astridr event-kind coverage** → **partly absorbed as TELE-01..03**; any kind TELE-03 disposes as "generic-table-by-design" stays closed rather than carried.
5. ~~`D-106-04-01` intermittent `Chat.test.tsx` failure~~ → **absorbed as DEBT-06**.
6. ~~`convex-selfhost/` is not a git repo~~ → **absorbed as DEBT-07**.
7. **Cross-repo, astridr:** `feature/brain-swap` → `main` is 322 commits behind (a release decision, not a bug); `web.py` on `feature/brain-swap` still carries the decommissioned-host CORS default removed on `main`. **Still open, not scoped here** — but note ENGINE-* lands on `feature/brain-swap`, the deployed branch, so this divergence is a live consideration for that work.
