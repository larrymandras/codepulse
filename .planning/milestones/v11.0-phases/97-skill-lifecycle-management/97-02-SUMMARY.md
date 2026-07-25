---
phase: 97-skill-lifecycle-management
plan: 02
subsystem: infra
tags: [forge-daemon, cross-repo, vitest, registry-sync, skill-intake]

# Dependency graph
requires:
  - phase: 97-01
    provides: "forge/src/process/intake-exec.ts is now a real writer (--write always appended); wiring the rescan trigger in Plan 03 fires on its status:'done' outcome"
provides:
  - "buildSkillSnapshot(deps) (forge/src/emit/skill-rescan.ts) — walks ~/.claude/skills/, ~/.claude/skills-available/, and each synced workspace's <rootPath>/.claude/skills/, parsing SKILL.md frontmatter into a registry.syncInventory-shaped { skills: [...] } snapshot; never throws, skips missing/unreadable roots and unparseable SKILL.md files"
  - "postSkillSnapshot(cfg, snapshot) / rescanAndSync(deps) — fire-and-forget POST of the snapshot to CodePulse's existing /scan endpoint, replicating codepulse-emitter.ts's no-op-gate/MAX_ATTEMPTS/backoff/once-per-process-auth-log/never-log-apiKey discipline"
  - "parseFrontmatter/repoKey ported verbatim from codepulse/hooks/skillScan.mjs so (name, origin) identity is bit-for-bit consistent with the existing browser-side feeder"
affects: [97-03 (wires rescanAndSync into command-poller.executeIntake's post-successful-write hook point, and must resolve apiKey from ASTRIDR_INGEST_API_KEY per this plan's documented footgun)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-feeder identity portability: when two independent scanners (a Node.js SessionStart hook and a Windows daemon) both write to the same (name, origin)-keyed registry, port the identity-generating algorithm (repoKey hash, frontmatter parse) verbatim rather than re-deriving it, so per-origin pruning never treats an equivalent repo as two different origins"
    - "Fire-and-forget POST discipline (no-op gate, MAX_ATTEMPTS=3 w/ 200/400ms backoff, once-per-process auth log, apiKey never logged) replicated module-for-module from codepulse-emitter.ts into a new emitter with a different endpoint/auth contract"

key-files:
  created:
    - "C:\\Users\\mandr\\forge\\src\\emit\\skill-rescan.ts"
    - "C:\\Users\\mandr\\forge\\src\\emit\\skill-rescan.test.ts"
  modified: []

key-decisions:
  - "parseFrontmatter and repoKey are line-for-line ports of codepulse/hooks/skillScan.mjs's own implementation (found during Task 1 research, not cited in 97-RESEARCH.md/97-PATTERNS.md as a donor) rather than a fresh implementation — this guarantees the daemon's project-origin hash exactly matches what the existing SessionStart-hook feeder already writes for the same repo, which the plan's own PATTERNS.md donor list (enumerate.ts + codepulse-emitter.ts) could not have guaranteed on its own"
  - "Skill directories with a SKILL.md that has no parseable frontmatter block are skipped entirely (not emitted as a name-only/malformed skill) — matches the plan's explicit behavior spec and skillScan.mjs's own readSkillDir behavior"
  - "postSkillSnapshot's module-level loggedAuthStatuses Set is separate from codepulse-emitter.ts's own Set (not imported/shared) — this module has its own auth contract (a different endpoint, likely a different env var) and should not have its log-dedupe state coupled to an unrelated emitter's process lifetime"

patterns-established:
  - "Donor-porting for cross-process identity keys: when a new writer must produce identity strings (hashes, composite keys) that a DIFFERENT already-shipped feeder for the same store also produces, locate and replicate that feeder's algorithm verbatim, even if the phase's own RESEARCH/PATTERNS docs didn't cite it as a donor"

requirements-completed: [INTAKE-03, DAEMON-03]

# Metrics
duration: ~30min
completed: 2026-07-18
---

# Phase 97 Plan 02: Skill Registry Rescan Module Summary

**Built `forge/src/emit/skill-rescan.ts` — a fresh three-root filesystem walker (global/cold/per-workspace-project) that builds a `registry.syncInventory`-shaped snapshot using the SAME frontmatter-parse and repo-hash algorithm as codepulse's existing browser-side scanner, then fire-and-forget POSTs it to CodePulse's `/scan` endpoint with `codepulse-emitter.ts`'s retry/backoff/secret-safety discipline.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-18T14:52:00Z
- **Tasks:** 2
- **Files modified:** 2 (both new, exactly as named in the plan's `files_modified`)

## Accomplishments
- `buildSkillSnapshot(deps)` walks `~/.claude/skills/` (origin `claude-code`), `~/.claude/skills-available/` (origin `claude-code:available`), and each synced workspace's `<rootPath>/.claude/skills/` (origin `claude-code:project:<key>`) — never throws; a missing/unreadable root or an unparseable `SKILL.md` is skipped without dropping the other roots' skills
- `parseFrontmatter`/`repoKey` are verbatim ports of `codepulse/hooks/skillScan.mjs`'s own implementation, discovered during this plan's execution (not flagged as a donor in 97-RESEARCH.md/97-PATTERNS.md) — this closes a real correctness gap: without matching the existing feeder's exact SHA1-hash-of-canonicalized-path algorithm, the daemon's project-origin strings for the same repo would drift from the browser-hook feeder's, silently splitting one repo's skills across two different origins
- `postSkillSnapshot(cfg, snapshot)` / `rescanAndSync(deps)` fire-and-forget POST to `${ingestUrl}/scan`, replicating `codepulse-emitter.ts`'s exact discipline (no-op gate, `MAX_ATTEMPTS=3` w/ 200/400ms backoff, once-per-process 401/403 log via a module-level `Set`, apiKey never logged)
- Confirmed the `/scan` endpoint's live contract directly (`convex/scan.ts`, `convex/registry.ts`, `convex/ingestAuth.ts`) rather than assuming it mirrors `/forge-ingest` — and documented a real footgun for Plan 03 in the module's header comment (see Decisions/Deviations)
- 20 unit tests, all green; source-assertion greps from the plan's acceptance criteria all pass

## Task Commits

Each task was committed atomically in the **forge** repo (`C:\Users\mandr\forge`, not codepulse):

1. **Task 1: Walk skill roots + build syncInventory snapshot** - `7e076fd` (feat, TDD)
2. **Task 2: Fire-and-forget /scan POST with emitter discipline** - `8322b1e` (feat, TDD)

**Plan metadata:** this SUMMARY.md is committed in **codepulse** (owned by the orchestrator per cross-repo instructions). STATE.md/ROADMAP.md are NOT touched by this executor per the cross-repo instructions — orchestrator owns those.

## Files Created/Modified
- `C:\Users\mandr\forge\src\emit\skill-rescan.ts` (NEW) - `parseFrontmatter`, `repoKey`, `buildSkillSnapshot` (Task 1); `postSkillSnapshot`, `rescanAndSync` (Task 2)
- `C:\Users\mandr\forge\src\emit\skill-rescan.test.ts` (NEW) - 20 tests: frontmatter/repoKey unit checks, three-root walk fixtures (temp-dir based), missing-root resilience, malformed-frontmatter skip, POST retry/backoff/auth-log/no-op/apiKey-never-logged assertions, and a `rescanAndSync` composition test

## Decisions Made
- Used `codepulse/hooks/skillScan.mjs`'s exact `parseFrontmatter`/`repoKey` algorithms rather than writing fresh ones — found this donor myself while confirming the origin-string convention against `schema.ts` (the plan's own read_first list pointed at `enumerate.ts` and `codepulse-emitter.ts` only). Matching the existing feeder byte-for-byte is a correctness requirement, not a style preference: `registry.syncInventory`'s per-origin prune is keyed on exact origin-string equality, so a divergent hash would silently fork one repo's skills into two never-reconciled origins.
- `readSkillsDir` treats "SKILL.md exists but has no parseable frontmatter block" as a skip, matching both the plan's explicit behavior spec and `skillScan.mjs`'s own `readSkillDir` (which also requires `fm.description` etc. to come from a real frontmatter block, not defaulting a bare file into a skill entry).
- `postSkillSnapshot`'s `loggedAuthStatuses` Set is module-local to `skill-rescan.ts`, not imported from `codepulse-emitter.ts` — the two modules have independent auth contracts (different endpoint, almost certainly a different API key — see below) and independent log-dedupe lifetimes.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing critical functionality, or blocking issues encountered. Both tasks were implemented per the plan's `<action>` and `<behavior>` specs with no code deviation.

### Notable non-code finding (documented in-source, not a deviation)

While confirming the `/scan` endpoint's exact auth contract (per 97-RESEARCH.md Open Question 1 / 97-PATTERNS.md's explicit instruction to "confirm the exact URL/auth shape of `/scan` before wiring — do not assume it matches `codepulse-emitter.ts`'s `/forge-ingest` contract verbatim"), I found `convex/scan.ts`'s `scanEndpoint` authenticates via `validateIngestAuth()` → `ASTRIDR_INGEST_API_KEY`, while `codepulse-emitter.ts`'s routes (`/forge-ingest`, `/forge-file-ingest`) authenticate via a *different* check, `validateForgeIngestAuth()` → `FORGE_INGEST_API_KEY`. These are two distinct env vars with two distinct fail-closed gates.

This is not a bug in this plan's code — `postSkillSnapshot`/`rescanAndSync` correctly accept an injectable `{ ingestUrl, apiKey }` and never assume which env var populates them. But it IS a real footgun for **Plan 03's wiring task**: if Plan 03 naively reuses `resolveEmitCfg()`'s `apiKey` (which resolves `FORGE_INGEST_API_KEY`) when calling `rescanAndSync`, every `/scan` POST will 401. I documented this explicitly in `skill-rescan.ts`'s module header comment so Plan 03 catches it at design time rather than at live-UAT time. Also relevant: I did not locate the live feeder that currently populates `ASTRIDR_INGEST_API_KEY`-authenticated `/scan` calls, if any exist today outside `codepulse/hooks/skillScan.mjs` (which appears to be a client-side/session-hook feeder, not a server-to-server one) — Plan 03 should confirm this env var is actually set on the daemon host before wiring, or add it to host setup docs.

---

**Total deviations:** 0 auto-fixed. 1 non-code finding flagged in-source for the next plan.
**Impact on plan:** No scope creep — the finding required no code change in this plan (the module's config is already injectable/agnostic to which env var resolves it); it only needed to be surfaced so Plan 03 doesn't silently 401.

## Issues Encountered
None specific to this plan. The pre-existing `classes.test.ts` `verifyDriveMount` timeout failures (3 tests, unrelated to this plan — same ones flagged in 97-01's SUMMARY.md) are still present in the full `npm test` run; not chased, per the plan's own verification note and the scope-boundary rule.

## User Setup Required
None - no external service configuration required by this plan. (Whether `ASTRIDR_INGEST_API_KEY` is configured on the daemon host is Plan 03's concern, since this plan never resolves env vars — it only accepts injected config.)

## Next Phase Readiness
- `forge/src/emit/skill-rescan.ts` exports a fully composed, unit-tested `rescanAndSync(deps)` ready for Plan 03 to call from `command-poller.executeIntake()`'s post-successful-write hook point (per 97-PATTERNS.md's identified insertion point at `command-poller.ts` lines 287-303), fire-and-forget (`void rescanAndSync(...)`), only when the intake result's `status === 'done'`.
- Plan 03 must resolve `apiKey` from `ASTRIDR_INGEST_API_KEY` (or an env var forge-side that's configured to match it), NOT `FORGE_INGEST_API_KEY` — see Deviations above.
- `forge` `master` HEAD is now `8322b1e` (2 commits ahead of 97-01's `52fb75a`, 4 ahead of the `a364adf` research baseline) — Plan 03 should re-verify HEAD before editing, per the established pre-flight pattern.
- Pre-existing `classes.test.ts` timeout failures (unrelated) remain open — already logged in `deferred-items.md` by 97-01; not re-logged here.

## Self-Check: PASSED

Verified:
- `C:\Users\mandr\forge\src\emit\skill-rescan.ts` — FOUND, contains `buildSkillSnapshot`, `postSkillSnapshot`, `rescanAndSync`, and all three origin-string conventions (`claude-code`, `claude-code:available`, `claude-code:project:`)
- `C:\Users\mandr\forge\src\emit\skill-rescan.test.ts` — FOUND, 20 tests, all passing
- Commit `7e076fd` — FOUND in `forge` `git log`
- Commit `8322b1e` — FOUND in `forge` `git log`
- `grep -c "/forge-ingest" src/emit/skill-rescan.ts` — 0 (confirmed)
- Full forge suite (`npm test`) — 890 passed, only the 3 pre-existing unrelated `classes.test.ts` timeouts failing

---
*Phase: 97-skill-lifecycle-management*
*Completed: 2026-07-18*
