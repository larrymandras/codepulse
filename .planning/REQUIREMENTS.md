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

### Re-measured 2026-08-26 — MISSION-01 is HALF DONE, and its blocker note was wrong

1. **MISSION-01 duration + orphan recovery — orphan recovery SHIPPED, duration still open.**

   The v14.0 note said no `running` row can arrive, "which makes the orphan clause vacuous
   rather than merely unbuilt". That reasoning is now outdated: the orphan path never needed
   a `running` row.

   **Orphan recovery — DONE, in astridr, after the v14.0 assessment was written.**
   `astridr/automation/subagent_jobs.py:230` `_boot_sweep()` marks orphaned running+queued
   rows failed and calls `_notify_orphan()` for each; `_notify_orphan` (`:250`) mirrors the
   terminal `failed` state to Convex via `emit_subagent_job_terminal(..., status="failed",
   error="lost to restart — resubmit?")`. Its own docstring names the exact symptom the
   requirement describes: without it "CodePulse's JobsPanel showed the job stuck at
   'running' forever". Shipped as astridr 168-06 Bug 5. So "a job lost to a restart renders
   as failed, never silently as still-running" **is satisfied**.

   Also corrected: the gate is EMITTER-side, not ingest-side. `convex/runtimeIngest.ts`
   passes `status: d.status ?? "unknown"` straight through and the `subagentJobs` schema
   comment lists `"running"` as a valid value — CodePulse would store a `running` row if one
   were ever sent. Only `emit_subagent_job_terminal` (terminal-only by construction) stops it.

   **Duration — still genuinely blocked, and measured live 2026-08-26:**
   `subagentJobs` holds 7 rows; **7 of 7 have `submittedAt === finishedAt`** and **0 have a
   derivable duration**. Statuses present are `failed`, `cancelled`, `completed` — all
   terminal, consistent with terminal-only emission. Cause: `emit_subagent_job_terminal`
   (`astridr/automation/subagent_jobs.py:56`) has **no `submitted_at` parameter** at all and
   hardcodes `finishedAt: datetime.now(...)`; CodePulse's upsert then falls back to
   `finishedAt`/now, producing the synthetic copy.

   **What closing it would take** (NOT done — this is implementing the deferred SEED-007
   feature, not an audit fix): add a `submitted_at` parameter to the emitter, supply it at
   its three call sites (`subagent_jobs.py:266`, `tools/cancel_job.py:149`,
   `tools/delegate_task.py:574`), and update the §2.31 telemetry contract in
   `docs/astridr-contract.md`. CodePulse's ingest already reads
   `d.submitted_at ?? d.submittedAt`, so no CodePulse change is needed. It would fix
   durations going forward only — the 7 existing rows stay synthetic.

   **Still do not tick MISSION-01's checkbox** (auto-re-ticked by tooling twice, reverted
   twice). It is genuinely Partial: one half shipped, one half open.

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
