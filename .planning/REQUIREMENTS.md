# Requirements

**Active milestone: v15.0 — "Borealis Console" Premium UI Overhaul** (Phases 120+, started 2026-08-17 via `/gsd-new-milestone`, consuming the `MILESTONE-CONTEXT.md` prepared 2026-08-07).

Prior milestones (requirements archived in full, extract-don't-delete):

- **v14.0 — Per-Agent Engine Visibility, Convex Durability & Mission Board** shipped 2026-08-17 → [milestones/v14.0-REQUIREMENTS.md](milestones/v14.0-REQUIREMENTS.md). Phases 108–119, 86 plans, **15/17 satisfied** (MISSION-01 PARTIAL, MISSION-02 reassigned to SEED-007).
- **v13.0 — Brain-Swap Control, Cost Intelligence & Consolidation** shipped 2026-08-06 → [milestones/v13.0-REQUIREMENTS.md](milestones/v13.0-REQUIREMENTS.md) (14/15).
- **v11.0 — Skills Command Center** shipped 2026-07-25 → [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22).
- **v12.0 — Reminders & Calendar** shipped 2026-07-23 → [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md) (9/9).

---

## v15.0 requirements — ARCHIVED

v15.0 shipped 2026-08-26 (Phases 120–127, 87 plans, 30/30 Complete). Its full
requirements section — POLISH / TOKEN / SHELL / SIGNAL / A11Y / DEBT / SWEEP /
JANITOR, plus design inputs, milestone acceptance, out-of-scope and traceability —
moved verbatim to [milestones/v15.0-REQUIREMENTS.md](milestones/v15.0-REQUIREMENTS.md).

---

## Carried forward from v14.0 — AUDITED 2026-08-26

Every item below was re-checked against the CODE on 2026-08-26, not carried on trust.
**Four of the nine were already resolved or were accepted decisions**, and one has a
premise that may no longer hold. That is the same drift that left 8 v15.0 requirements
sitting at `Pending` on Complete phases — a carried-forward list decays exactly like a
requirement table, and needs the same treatment.

### Resolved / accepted — no action

4. ✅ **`links` retention + unbounded read — COMPLETE.** Both halves are closed.
   `convex/bifrost.ts:85` reads `.take(LINK_LIST_SCAN_CAP + 1)`, and its own comment at
   `:66` records that it *was* an unbounded `.collect()`. The missing retention decision
   has been recorded too: `links` sits in `COVERAGE_KEEP_FOREVER`
   (`convex/retentionCoverage.ts:120`, "curated links").
5. ✅ **`llm-analytics-rollup` CR-01** → absorbed as DEBT-08.
6. ✅ **`detectCredentialValue` rule C — ACCEPTED, not open work.** The item's own text
   says rule A covers the realistic shape by name and the gap "is deliberate". Recorded
   as a decision so it stops reading as a to-do.
8. ✅ **DEBT-06 — CLOSED GUARDED, and 113-05's note about it is stale.**
   `113-05-SUMMARY.md` says DEBT-06 stays Pending because "113-06 has not run".
   113-06 DID run: `113-06-SUMMARY.md` records a tiered soak of **80 clean full-suite
   iterations, zero reproductions**, closed GUARDED and confirmed by Larry at the Task 3
   checkpoint, with the honest "NOT root-caused" sentence placed in
   `113-FLAKE-EVIDENCE.md`. The cause was never identified and that is the recorded
   disposition, not an open task.

### Premise needs re-checking

1. ⚠️ **MISSION-01 duration + orphan recovery.** The blocker was stated as "no `running`
   row can arrive". astridr now *has* a running state — `astridr/automation/jobs.py:71`
   (`_VALID_STATUSES`), `:168` (stamps `started_at` on `running`), and
   `astridr/automation/mission_pipeline.py:571` (sets a mission to `running`). What is
   NOT verified is whether that state is EMITTED to CodePulse's mission ingest, which is
   the claim that actually matters. Internal status is not telemetry. **Still do not tick
   MISSION-01's checkbox** (auto-re-ticked by tooling twice, reverted twice) until the
   emission path is measured.

### Genuinely open

2. 🔴 **MISSION-02 humanized tool activity.** No job↔tool join key in telemetry.
   `astridr/tools/cancel_job.py` takes a `job_id` argument, but that is a tool parameter,
   not a join key between job records and tool-execution records. Unchanged.
3. 🔴 **`message_routed` routed but unsurfaced.** The backend exists and is tested
   (`convex/messageRoutes.ts`, resolver coverage in `convex/runtimeIngest.test.ts:1443`),
   and `messageRoutes.ts:19` states plainly that it "has no UI this phase". Needs its own
   UI design pass (D-13).
7. 🔴 **Nyquist coverage partial.** Confirmed on disk: `117-bifrost-link-hub` and
   `119-loom-curated-pipelines` exist with **no VALIDATION.md**. 109, 112, 113 and 114 do
   each carry one (their coverage is partial, not absent).
9. 🔴 **Cross-repo, astridr — a RETIRED host is an unconditional CORS origin on the
   DEPLOYED branch.** Measured 2026-08-26:

   - `feature/brain-swap` (deployed, 953 commits ahead of `main`):
     `prod_origin = os.environ.get("CODEPULSE_ORIGIN", "https://tidy-whale-981.convex.site")`
     then `allowed_origins = [prod_origin, ...]` — added **unconditionally**.
   - `main`: `os.environ.get("CODEPULSE_ORIGIN", "").strip()` with
     `if prod_origin and prod_origin != "*": allowed_origins.insert(0, prod_origin)` —
     empty default, conditional.

   `tidy-whale-981` is the retired cloud Convex deployment, frozen 2026-07-15. A
   decommissioned Convex subdomain can be re-allocated, which would hand a third party a
   valid CORS origin against the agent backend. The fix is to port `main`'s form to the
   deployed branch; it is small, but it changes a running service's CORS policy in another
   repo and belongs to an astridr session, not a CodePulse one.
