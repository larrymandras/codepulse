# Phase 106: Consolidation & Hardening - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Close out accumulated tech debt from the v13.0 milestone (and earlier): kill remaining `anyApi` usages, retire the cloud Convex deployment `tidy-whale-981` (export then cancel), code-split the >500 kB build chunks, set up Tailscale on Larry's laptop, and finish deferred manual UAT from Phases 98/99/100. Requirements: DEBT-01, DEBT-02, DEBT-03, DEBT-04. Independent and low-risk — can run at any point in the milestone. No mass mutation of the live self-hosted Convex; DEBT-02 touches only the retired *cloud* instance.

</domain>

<decisions>
## Implementation Decisions

### DEBT-02: Cloud Convex retirement (tidy-whale-981)
- **D-01:** Prod verification is **not required** before planning export+cancel — Larry is confident Vercel prod (`codepulse-jade-omega.vercel.app`) is already repointed to the self-hosted backend. `.planning/AVATAR-HANDOFF.md` (dated 2026-07-08, claims prod reads cloud `tidy-whale-981`) is **stale** and should be corrected/flagged during execution, not trusted.
- **D-02:** Export the ~56 GB pre-2026-07-15 cloud history to **local disk on this office PC** (scratch path), verify the archive is complete/readable, then it can be deleted once confirmed — no requirement to retain it long-term or move it to G:\ cold storage.
- **D-03:** "Confirm nothing reads it" due diligence = grep **both** codepulse and astridr-repo for any `tidy-whale-981` / cloud Convex URL reference (env files, docs, CI config, Forge daemon config). An initial code grep in codepulse already came back clean (no real references outside `.planning/AVATAR-HANDOFF.md`). Vercel env check alone is not sufficient — check the configs too.
- **D-04:** **Larry cancels the cloud Convex subscription manually** (billing/account-level action). The plan's job is to get to "export done + verification report in hand," then hand Larry the exact dashboard step. Do not attempt to automate the cancel itself.

### DEBT-01: Typed-api sweep
- **D-05:** Treat as **verify-and-close**, not a code-change task. A grep of `src/` + `convex/` already found zero real `anyApi` usages — `Ideation.tsx` (the example named in REQUIREMENTS.md) is already clean; the only hits are the generated `convex/_generated/api.js` and two test-file *comments* (not imports) in `costBudgetEval.test.ts`/`evalScores.test.ts` explaining why identity comparison on the Proxy doesn't work. The plan should re-confirm with a clean grep + `tsc --noEmit` pass and mark DEBT-01 complete — expect no source changes.
- **D-06:** Scope is **codepulse only** — astridr-repo doesn't call CodePulse's Convex API the same way (it POSTs to ingest endpoints), so it's out of scope for DEBT-01.

### DEBT-04: UAT bug-fix policy
- **D-07:** When the remaining UAT sub-cases reproduce the known open bug or surface a new one, **fix it inline** with a regression test — per this repo's Error Triage rule (never dismiss a confirmed bug as pre-existing/out of scope; fix it when discovered during a phase, defer only with explicit user approval). The known bug: moving the **last** skill out of a project workspace leaves a stale project-origin registry row (rescan can't prune an origin with zero remaining skills), which also wrongly disables Archive/Move for that skill in the ⋯ menu (found live during Phase 98 UAT, `.planning/milestones/v11.0-phases/98-.../98-HUMAN-UAT.md` Test 1, severity: major).
  - **STALE (corrected 2026-08-04 per Phase 106 pattern-mapping pass, Stale Docs rule):** This was NOT still open. `98-HUMAN-UAT.md`'s own Gaps section shows `status: resolved` (gap-closure plan 98-05, 2026-07-22), and Test 6 (2026-07-23) is a live post-deploy re-repro that PASSED. Current `convex/skillSync.ts` already contains the fix (`sanitizeScannedOrigins` + per-origin `computeSkillPrunes` with a `scannedOrigins` manifest). DEBT-04's job for this bug is **re-verify via live UAT re-repro**, not write a code fix — only touch `convex/skillSync.ts`/`SkillLifecycleMenu.tsx` if the live re-repro surfaces a NEW failure.
- **D-08:** All three deferred UAT sequences run **live with Larry, Claude-guided** — same pattern as the Phase 98 UAT session (Claude drives via a signed-in Clerk session, Larry follows along and confirms results). `claude-in-chrome` could not pair with an authed session last time, so expect the same manual-driving pattern, not automated browser tooling.
  - Phase-98 Test-4 remaining menu sub-cases: active-single-scope, dormant-non-shadowed, multi-scope
  - Full voice sequence: "Hey Ástríðr" wake → "stop" barge-in → "goodbye" re-arm
  - Phase-100: live-Forge-daemon drag round-trip (archive/move/restore + honest rollback)

### DEBT-03: Chunk-splitting target & laptop Tailscale
- **D-09:** Don't assume the requirement's named chunks are still accurate — `react-force-graph-3d` and `WarRoom` are **already** route/lazy-split (verified: `ForceGraph3DLib` is the sole `react-force-graph-3d` import site behind a `React.lazy` boundary; `WarRoom` is `lazy(() => import("./pages/WarRoom"))` in `App.tsx`). `useSpeechRecognition` is **not** lazy — it's pulled in via `ChatInput.tsx`, which isn't itself lazy-loaded. Research/planning should **run a real `npm run build`**, read the actual chunk-size warning output, and code-split/lazy-load whichever chunks are genuinely over the 500 kB threshold today — treat the REQUIREMENTS.md file list as a starting hypothesis, not ground truth.
  - **CONFIRMED (2026-08-04, real `npm run build` run during Phase 106 pattern-mapping):** `index-*.js` (main entry) **2.05 MB** — NOT named in REQUIREMENTS.md at all, loads on every page view, and is now the single biggest chunk in the build; `react-force-graph-3d` 1.29 MB — already correctly lazy (loads only in 3D mode), the size warning is cosmetic, no action needed beyond optionally raising `build.chunkSizeWarningLimit`; `useSpeechRecognition` 638 kB — genuinely not yet isolated (pulled in via `ChatInput.tsx` → `useAstridrVoice.ts` → `useWakeWord`/`useDuplexEars`), this is the real actionable target; `WarRoom` **485 kB — under the 500 kB threshold, not actually flagged by the build** — REQUIREMENTS.md naming it is outdated, don't spend a plan on it. The unnamed 2.05 MB `index` entry chunk is likely higher-value to investigate than anything REQUIREMENTS.md originally named.
- **D-10:** "Laptop Tailscale set-up" = add Larry's laptop to the existing tailnet (the same one the office PC uses, `lmofficenew.tail5bb6b3.ts.net`) and verify it can reach the self-hosted Convex (`https://lmofficenew.tail5bb6b3.ts.net` / `:8443`) and Ástríðr the same way the office PC does. This is a Larry-side/manual operational task, not something the plan can execute unattended — plan for a verification step (e.g., a checklist Larry runs through), not code.

### Claude's Discretion
- Exact export tooling/command for DEBT-02 (Convex export CLI usage, scratch path naming) — plan and execute as makes sense given "local disk, verify, deletable after."
- Which specific `tsc`/grep commands constitute "clean" for DEBT-01 verify-and-close.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DEBT-02 — Cloud Convex retirement
- `.planning/AVATAR-HANDOFF.md` — **stale** (2026-07-08): claims Vercel prod reads cloud `tidy-whale-981`. Do not trust as current; correct or flag during execution per this repo's Stale Docs rule.
- Claude memory `convex-topology-all-local.md` (session-scoped reference, not a repo file): documents cloud `tidy-whale-981` as retired/frozen since 2026-07-15 (telemetry stopped, newest `events` row frozen at 2026-07-15T00:04Z), self-hosted-only topology, and the "container can silently break host access" gotcha.
- `CLAUDE.md` § "Self-Hosted Convex — Operational Rules" — the mass-mutation/tombstone-GC hazards apply to the *self-hosted* instance, not the cloud export/cancel target; DEBT-02 must not be confused with those hazards.

### DEBT-04 — UAT bug-fix policy
- `.planning/milestones/v11.0-phases/98-skill-lifecycle-mutations-archive-restore-move-delete/98-HUMAN-UAT.md` — Test 1 (open major bug: stale project-origin registry row) and Test 4 (remaining browser-pending sub-cases: active-single-scope, dormant-non-shadowed, multi-scope).
- `.planning/milestones/v11.0-phases/100-control-surface-ux-menu-drag-lanes-optimistic-reconcile/100-HUMAN-UAT.md` — outstanding live-Forge-daemon drag round-trip verification.
- `CLAUDE.md` § "Error Triage" — governs D-07 (fix confirmed bugs inline, don't dismiss as pre-existing).

### DEBT-03 — Chunk-splitting & Tailscale
- `.planning/REQUIREMENTS.md` DEBT-03 — names `react-force-graph-3d`, `WarRoom`, `useSpeechRecognition` as the >500 kB chunks; per D-09, re-verify against a live build rather than trusting this list as current.
- `vite.config.ts` — current build config (no `manualChunks`/`build.rollupOptions` splitting configured yet).

No external specs beyond the above — requirements otherwise fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `React.lazy()` + route-level code-splitting pattern already established in `src/App.tsx` (27 lazy-loaded pages including `WarRoom`, `ForgePage`, `HivePage`) — the pattern to extend for any newly-identified >500 kB chunk under DEBT-03.
- `ForceGraph3D.tsx` lazy-boundary pattern (sole `react-force-graph-3d` import site) — precedent for isolating a heavy dependency (e.g. `useSpeechRecognition`'s voice stack) behind a lazy chunk if the real build shows it's still needed.

### Established Patterns
- Convex export/cancel is an *account-level* operation on the cloud deployment, distinct from — and must not be conflated with — the self-hosted instance's mass-mutation hazards documented in `CLAUDE.md`.
- This repo's UAT convention: live, Claude-guided, Clerk-signed-in-session browser walkthroughs with Larry (established in Phase 98), not automated `claude-in-chrome` (couldn't pair with an authed session).

### Integration Points
- `vite.config.ts` — where any new `manualChunks`/lazy-boundary config for DEBT-03 lands.
- `ChatInput.tsx` — current non-lazy consumer of `useSpeechRecognition`; the integration point if that hook's dependency chain needs isolating.

</code_context>

<specifics>
## Specific Ideas

No specific implementation-style requirements beyond the decisions above — this phase is verification/close-out-oriented rather than new-feature design.

</specifics>

<deferred>
## Deferred Ideas

- **`SectionErrorBoundary` hardcoded-hex debt** — flagged during Phase 105 execution ("`SectionErrorBoundary`'s pre-existing hardcoded-hex debt flagged for Phase 106, used verbatim, not modified, per the UI-SPEC's own instruction," `.planning/STATE.md`) as intended for this phase, but it is **not** in REQUIREMENTS.md's locked DEBT-01..04 text. Explicitly left out of Phase 106 scope per discussion — noted here for a future tech-debt phase rather than folded in as scope creep.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 106.

</deferred>

---

*Phase: 106-Consolidation & Hardening*
*Context gathered: 2026-08-04*
