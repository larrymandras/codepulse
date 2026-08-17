---
phase: 111
slug: mission-board
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-11
---

# Phase 111 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 111 is a **subtraction-only frontend phase**. It rewrote one panel to stop asserting states
the data cannot back, deleted a second panel outright, and corrected planning-artifact statuses.
It ships no new route, no auth surface, no persistence, no dependency, and no new user-supplied
data path. Its implementation surface is exactly seven files:

```
src/components/JobsPanel.tsx                       (rewritten)
src/components/JobsPanel.test.tsx                  (new)
src/pages/LiveRun.tsx                              (comment only)
src/pages/Chat.tsx                                 (panel + boundary removed)
src/pages/Chat.test.tsx                            (test repair)
src/components/control-center/ActiveAgentsPanel.tsx       (deleted)
src/components/control-center/ActiveAgentsPanel.test.tsx  (deleted)
```

plus Markdown under `.planning/`. The register below is short because the surface is; padding it
would be the same fabrication this phase exists to remove from the UI.

**Scoping note:** a concurrent Phase 119 (Loom) session shares this checkout and interleaves commits
in the same range. Files under `convex/loom*`, `convex/llm*`, `convex/http.ts`, `convex/ingestAuth.ts`,
`convex/schema.ts`, `src/pages/Loom.tsx`, `src/lib/loomStepState*`, `src/hooks/useLoom.ts`,
`src/components/loom/*`, `src/lib/navRegistry.ts`, `src/App.tsx` and `src/pages/Analytics.tsx` belong
to Phase 119 and are **not** attributed to Phase 111 anywhere in this document.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| astridr emitter → `POST /runtime-ingest` | Untrusted-by-default input crosses here. Gated by `validateIngestAuth` at `convex/runtimeIngest.ts:438` (early return `unauthorizedResponse()` at :439), inside the `httpAction` opened at :432. The `subagent_job` case at :593 is downstream in that same function and inherits the gate — no bypass path. | Emitter-controlled job records (`status`, `agentTypeId`, `taskSnippet`, `error`) |
| `subagentJobs` row → `JobsPanel` DOM | Emitter-controlled strings rendered as React text children via `EntityRow`. No raw-HTML sink on either component. | Operator-runtime strings, incl. error text |
| React render tree → `SectionErrorBoundary` | Removing a boundary could widen a crash blast radius. Chat.tsx went 8 → 7 boundaries at `87dafe30`; the one removed wrapped only the deleted panel. | Component crash containment |
| Planning artifact → future session | `REQUIREMENTS.md` and the seeds are read as ground truth by later sessions; a false status propagates as a wrong premise. | Requirement status claims |
| Shared git checkout → this phase's commits | A concurrent session (Phase 119) can stage or commit into the same branch mid-edit. | Tracked file contents |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-111-01 | Tampering (XSS) | `JobsPanel` rendering `job.taskSnippet` / `job.agentTypeId` / `job.error` as React text children | accept | React escapes text children. `grep -c dangerouslySetInnerHTML src/components/JobsPanel.tsx` → **0**, and the same on the downstream renderer `src/components/EntityRow.tsx` → **0**. Control: the pattern hits 5× elsewhere in `src/` (`BlockRenderer.tsx:6`, `forge/ArtifactPreview.test.tsx:6,7,317,333`), so the zero is a genuine absence, not a broken probe. Exposure unchanged from pre-phase. | closed |
| T-111-02 | Tampering (prototype chain) | `stateIcon[job.status]` at `src/components/JobsPanel.tsx:96` — an emitter-supplied status of `toString` / `constructor` resolves to an inherited `Object.prototype` member, so the `??` fallback does not fire and React receives a non-element child | accept | Impact bounded to a missing icon plus a React child warning: no script execution, no disclosure, no persistence. The ingest path is Bearer-gated (see trust boundary 1, verified at `runtimeIngest.ts:438-439` preceding `:593`). UI-SPEC locks this exact expression as preserve-as-is, so `Object.hasOwn` hardening is out of scope here. Deferral has a **real owner**: `.planning/seeds/SEED-007-mission-emitter-revival.md:66-68` describes this exact lookup verbatim. | closed |
| T-111-03 | Information disclosure | `job.error` rendered into the row `secondary` line | accept | Pre-existing behavior, unchanged by this phase. The field is a straight pass-through at `convex/runtimeIngest.ts:618` (`error: d.error ?? undefined`), and `runtimeIngest.ts` appears in **no** Phase 111 commit's file list. Error text originates from the operator's own agent runtime; the dashboard is not publicly exposed. | closed |
| T-111-04 | Denial of service (availability) | Removal of `<SectionErrorBoundary name="Active Agents">` from `Chat.tsx` | accept | The removed boundary wrapped only the removed component. Boundary count across `87dafe30`: **8 before → 7 after**, a delta of exactly one. Survivors intact in shipped `Chat.tsx`: Voice Status (:872), Vitals (:913), Intelligence Feed (:1049), LLM Status (:1069), System Monitor (:1072), Mission Timeline (:1119), Quick Commands (:1124). No surviving panel lost coverage. | closed |
| T-111-05 | Information disclosure | Deletion of a component that read `api.subagentJobs.listRecent` | accept | `git show 87dafe30^:src/components/control-center/ActiveAgentsPanel.tsx` — the whole deleted file's sole logic was `jobs.filter(job => job.status === "running")` over `useSubagentJobs()`, the same query `JobsPanel` still issues unchanged. No auth check, gate, redaction or filter was removed with it. Query surface and permissions identical before and after. | closed |
| T-111-06 | Repudiation | A partial deletion leaving a stale reference that compiles but lies (e.g. a label array still asserting a panel that no longer mounts) | **mitigate** | Whole-tree `grep -rn "ActiveAgentsPanel" src/` → **empty**, with control: the same string hits in `.planning/` (110-06-SUMMARY, 111-01-SUMMARY, 111-02-PLAN), proving the search string is correct. `grep -in "seven" src/pages/Chat.test.tsx` → **empty**, control `COMMAND_CENTER_PANEL_LABELS` → **4** hits (1 declaration + 3 usage sites), so the label array is genuinely asserted rather than decorative. Corroborated by 111-02-SUMMARY's captured RED mutation-control run. | closed |
| T-111-07 | Repudiation | `.planning/REQUIREMENTS.md` recording a requirement status that does not match shipped code | **mitigate** | Verified in the live file: MISSION-01 carries its `Partial (D-04)` disposition in **both** the checklist bullet (`REQUIREMENTS.md:48`, unticked) and the traceability row (`:93`), with inline `runtimeIngest.ts:594-596` evidence. MISSION-02 (`:49`, `:94`) is reassigned to SEED-007 and explicitly *not* claimed by Phase 111. MISSION-03 (`:50`, `:95`) is `Complete` and names both consumers it cleaned. No MISSION row is falsely `Complete`. | closed |
| T-111-08 | Tampering (concurrent clobber) | A concurrent session clobbering `.planning/REQUIREMENTS.md` between read and write in this shared checkout | **mitigate** | `git show --stat ca4850c7 -- .planning/REQUIREMENTS.md` → `6 insertions(+), 6 deletions(-)`, confined to the MISSION preamble/bullets and the three MISSION traceability rows; no DUR / TELE / ENGINE / DEBT line touched, matching 111-03-SUMMARY's per-deletion accounting. `STATE.md` was deliberately excluded from `files_modified` as a known clobber surface. | closed |
| T-111-09 | Information disclosure | Evidence quoted inline from the live self-hosted Convex probe | accept | Grepped every Phase 111 artifact for `admin[_-]?key`, `sk-…`, `eyJ…` (JWT), `INSTANCE_SECRET`, `CONVEX_SELF_HOSTED`, `Bearer <value>`: the **only** hit is the prose phrase "Bearer token" in `111-01-PLAN.md:427` describing the gate — not a credential. Control: `127.0.0.1:3210` fires in `111-03-PLAN.md:86` and `111-CONTEXT.md:99`, proving the grep reaches these files. The recorded probe (`npx convex run subagentJobs:listRecent --url http://127.0.0.1:3210`) carries a localhost URL and **no** `--admin-key`. Quoted facts are row counts, status distributions and timestamps only. | closed |
| T-111-SC | Tampering (supply chain) | npm/pip/cargo installs — declared in all three plans | accept — not applicable | No package added or removed. `git show --name-only` across all ten Phase 111 commits (476155f0, 14658112, 39ef99ea, 87dafe30, b574e14f, d1e71114, ca4850c7, dc618ee8, a9eac7bc, e5ae5315) touches `package.json` / `package-lock.json` **zero** times. The Package Legitimacy Gate is not triggered. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-111-01 | T-111-01 | React escapes text children and no raw-HTML sink exists on `JobsPanel` or `EntityRow`; exposure is unchanged from before the phase. Re-audit only if a `dangerouslySetInnerHTML` or markdown renderer is introduced into this path. | Larry Mandras (operator) | 2026-08-11 |
| AR-111-02 | T-111-02 | Unguarded prototype-chain lookup on an emitter-supplied `status`. Worst case is a missing icon and a React child warning — no execution, disclosure or persistence — and the ingest route is Bearer-gated. Hardening is owned by SEED-007:66-68, which reopens this file; UI-SPEC locks the expression as preserve-as-is for Phase 111. | Larry Mandras (operator) | 2026-08-11 |
| AR-111-03 | T-111-03 | Operator-runtime error text surfaced on a non-public dashboard, pre-existing and untouched by this phase. | Larry Mandras (operator) | 2026-08-11 |
| AR-111-04 | T-111-04 | One error boundary removed alongside the only component it wrapped (8 → 7); every surviving panel retains its own. | Larry Mandras (operator) | 2026-08-11 |
| AR-111-05 | T-111-05 | The deleted panel held no auth, redaction or filter logic; the query it consumed is still issued unchanged by `JobsPanel`. | Larry Mandras (operator) | 2026-08-11 |
| AR-111-09 | T-111-09 | Probe evidence quoted in planning artifacts contains row counts, statuses and timestamps only — no credential, connection string, token or user content; probe URL is localhost with no key. | Larry Mandras (operator) | 2026-08-11 |
| AR-111-SC | T-111-SC | No dependency was added or removed by any Phase 111 commit, so the supply-chain threat is not applicable to this phase. | Larry Mandras (operator) | 2026-08-11 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-11 | 10 | 10 | 0 | gsd-security-auditor (sonnet), claims independently re-derived by the orchestrator |

**Verification method.** The register was authored at plan time (`register_authored_at_plan_time: true`),
so the auditor verified mitigations rather than scanning for new threats. Every auditor claim that a
disposition rests on was then re-run by the orchestrator with a **paired control** — a probe that would
have shown the thing present had it been present — because a grep returning zero is a claim about the
search string, not about the repo. All controls fired. Nothing was closed on the plan's word alone.

**Not re-reported here:** the two code-review warnings in `111-REVIEW.md` (WR-01, WR-02) are
test-coverage gaps, not threats in this register. Both were closed with mutation-proven coverage in
commit `d1e71114`.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-11
