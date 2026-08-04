# Phase 106: Consolidation & Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 106-Consolidation & Hardening
**Areas discussed:** Cloud Convex retirement safety, Typed-api sweep scope, UAT bug-fix policy, Chunk-splitting target & laptop Tailscale

---

## Cloud Convex retirement safety

### Q1: How do we confirm prod's actual VITE_CONVEX_URL before planning to cancel the cloud instance?

| Option | Description | Selected |
|--------|-------------|----------|
| Check Vercel dashboard now | You check codepulse's Vercel project env vars right now and tell me what VITE_CONVEX_URL is set to | |
| Install Vercel CLI during execution | Executor installs `vercel` CLI and runs `vercel env ls` / `vercel env pull` as part of DEBT-02 | |
| Already know it's self-hosted | Confident prod was repointed and AVATAR-HANDOFF.md is just stale — skip verification | ✓ |

**User's choice:** Already know it's self-hosted.
**Notes:** AVATAR-HANDOFF.md (2026-07-08) is stale; memory confirms self-hosted-only topology as of 2026-07-22.

### Q2: Where should the ~56 GB DEBT-02 export land?

| Option | Description | Selected |
|--------|-------------|----------|
| Local disk on this office PC | Export to a scratch path, verify, then delete once confirmed | ✓ |
| G:\ Google Drive (cold storage pattern) | Matches the existing archive-repo skill's cold-storage convention | |
| Just confirm it exports cleanly, don't retain it | Verify it succeeds, then discard | |

**User's choice:** Local disk on this office PC.

### Q3: What counts as due diligence for "confirm nothing reads it"?

| Option | Description | Selected |
|--------|-------------|----------|
| Grep both repos + check Forge/astridr configs | Search codepulse AND astridr-repo for any cloud Convex URL reference | ✓ |
| Vercel env check is sufficient | Prod is the only other consumer that matters | |
| Also watch cloud dashboard traffic for a few days | Monitor before cancelling | |

**User's choice:** Grep both repos + check Forge/astridr configs.

### Q4: Who cancels the cloud Convex subscription once export + verification are done?

| Option | Description | Selected |
|--------|-------------|----------|
| You cancel it manually | Claude prepares export + verification report; you click cancel | ✓ |
| Claude cancels via CLI/dashboard automation | Executor runs a non-interactive cancel | |

**User's choice:** You cancel it manually.

---

## Typed-api sweep scope

### Q1: What's DEBT-01's actual scope given a clean grep for real anyApi usages?

| Option | Description | Selected |
|--------|-------------|----------|
| Verify-and-close | Already done by prior work — re-confirm with a clean grep + tsc pass | ✓ |
| Broader type-safety sweep | Also look for other 'any'-typed escape hatches | |
| Something specific in mind | Particular file/pattern a plain grep wouldn't catch | |

**User's choice:** Verify-and-close.

### Q2: Should astridr-repo be checked too, or is DEBT-01 codepulse-only?

| Option | Description | Selected |
|--------|-------------|----------|
| codepulse only | Astridr-repo doesn't call CodePulse's Convex API the same way | ✓ |
| Check astridr-repo too | Astridr's ingest posts might have their own loosely-typed call sites | |

**User's choice:** codepulse only.

---

## UAT bug-fix policy

### Q1: When DEBT-04's UAT reproduces the known stale-registry-row bug or finds a new one, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix real bugs inline | Per CLAUDE.md's Error Triage rule — root-cause and fix, with a regression test | ✓ |
| Log for backlog, don't fix | DEBT-04 is scoped to running UAT, not fixing findings | |
| Fix only if small; backlog if large | Triage each finding | |

**User's choice:** Fix real bugs inline.

### Q2: How do you want to run the three live UAT sequences?

| Option | Description | Selected |
|--------|-------------|----------|
| Live with you, Claude-guided | Same pattern as Phase-98 UAT — Claude drives via signed-in Clerk session | ✓ |
| You run them solo, report back | Larry executes and reports pass/fail/notes | |

**User's choice:** Live with you, Claude-guided.

---

## Chunk-splitting target & laptop Tailscale

### Q1: What's the actual target for DEBT-03's chunk cleanup?

| Option | Description | Selected |
|--------|-------------|----------|
| Run a real build, split whatever's still >500kB | Don't assume from the requirement's file list — verify against a live build | ✓ |
| Specifically lazy-load useSpeechRecognition's dependency chain | Target the one gap the requirement's file list correctly identifies | |

**User's choice:** Run a real build, split whatever's still >500kB.

### Q2: What does "laptop Tailscale set-up" concretely mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Add laptop to the tailnet, verify Convex/Ástríðr reachability | Join lmofficenew tailnet, confirm reachability | ✓ |
| Something more specific | A particular laptop-side task or blocker | |

**User's choice:** Add laptop to the tailnet, verify Convex/Ástríðr reachability.

### Q3: Fold SectionErrorBoundary's hardcoded-hex debt (flagged in Phase 105 for Phase 106) into this phase, or leave it out?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it out | Not in the locked DEBT requirements — scope creep despite the Phase-105 flag | ✓ |
| Fold it in | Small, mechanical, already flagged as intended for this phase | |

**User's choice:** Leave it out — noted as a Deferred Idea instead.

---

## Claude's Discretion

- Exact export tooling/command for DEBT-02 (Convex export CLI usage, scratch path naming).
- Which specific `tsc`/grep commands constitute "clean" for DEBT-01 verify-and-close.

## Deferred Ideas

- `SectionErrorBoundary` hardcoded-hex debt — flagged during Phase 105 for "Phase 106" but not in the locked DEBT-01..04 requirements. Left out of this phase's scope; noted for a future tech-debt phase.
