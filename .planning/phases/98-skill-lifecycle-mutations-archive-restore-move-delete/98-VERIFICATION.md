---
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
verified: 2026-07-22T09:00:00Z
status: human_needed
score: 16/16 must-haves verified (code-level; 11 from initial verification + 5 from 98-05 gap closure)
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 11/11 (code-level)
  gaps_closed:
    - "After a move, the Skills page reflects host truth for BOTH the destination and the source lane (emptied source origin never pruned) — closed by 98-05's scannedOrigins manifest + computeSkillPrunes prune"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Real cross-volume move (C: global/cold ↔ G:\\ project workspace) — UAT test 1, already passed for the base move mechanics"
    expected: "Skill directory relocates on disk and the Skills page shows the new lane after rescan"
    why_human: "Live Google Drive virtual-FS interaction; already exercised once in 98-HUMAN-UAT test 1 (pass, modulo the now-fixed stale-origin gap)"
  - test: "98-05 MANUAL: live re-repro of the stale-origin fix — delete the residual uat-ws-placeholder skill from G:\\My Drive\\forge-workspaces\\drive-sync-test\\.claude\\skills\\, trigger one rescan, confirm the stale claude-code:project:<key> row disappears from the Skills page and the previously-moved skill no longer renders multi-scope"
    expected: "Stale project-origin row is pruned; Archive/Move re-enabled in the ⋯ menu for that skill"
    why_human: "Requires a live Forge daemon + a live Google Drive mount + a live rescan; the fix is unit-tested (readdir-injected fixtures) but the exact host repro that originally surfaced the bug needs one live confirmation pass"
  - test: "98-05 MANUAL NEGATIVE: pause/disconnect the live G:\\ Google Drive mount mid-scan and confirm the workspace's claude-code:project:<key> origin is NOT declared in scannedOrigins and its registry row is NOT pruned"
    expected: "A transient unmount must never be read as 'workspace emptied' — the origin is absent from scannedOrigins and the row survives"
    why_human: "The unit tests only simulate an unreachable root via a nonexistent path (ENOENT-class); a real Google Drive pause can behave differently (may keep the drive letter mounted while I/O degrades) and the plan's own verification section explicitly says not to trust the mitigation until observed on the real mount"
  - test: "Archive / restore / permanent-delete round-trip against a live Forge daemon"
    expected: "Archiving moves a skill to ~/.claude/skills-available/ and shows dormant after rescan; restoring reverses it; permanently deleting a cold row removes the directory and the row"
    why_human: "Already passed in 98-HUMAN-UAT test 2 against a live daemon; carried forward as a completed item, not a new gap"
  - test: "Offline-daemon expiry (LIFE-06)"
    expected: "Archiving with the daemon stopped shows 'queued' then visibly 'expired' at TTL — never false success"
    why_human: "Already passed in 98-HUMAN-UAT test 3 against a live daemon/cron; carried forward as a completed item"
  - test: "Menu scope-gating and shadow/multi-scope tooltips live in the browser"
    expected: "Active single-scope row shows Archive + one Move item; dormant row shows Restore + Delete Permanently; shadowed dormant row shows Restore disabled with tooltip and does not crash the page; multi-scope row shows Archive/Move disabled with the honest reason"
    why_human: "Blocked in 98-HUMAN-UAT test 4 — CodePulse gates the app behind Clerk sign-in and no signed-in browser session was available (credential entry prohibited, claude-in-chrome not connected). Data-side staging for every menu state was verified server-side; the live visual render is still unconfirmed."
  - test: "LAYER-1 refusal toast surfaces correctly in the browser (CR-03 fix)"
    expected: "Clicking Archive on a skill with an existing dormant cold copy shows a toast with the house-copy refusal reason"
    why_human: "Blocked in 98-HUMAN-UAT test 5 — same Clerk sign-in blocker as above. Server half (enqueueLifecycle throws before inserting any row) is verified; the visual toast render is not."
---

# Phase 98: Skill Lifecycle Mutations (Archive / Restore / Move / Delete) Verification Report

**Phase Goal:** An operator can archive, restore, move, and delete skills from the UI, with every mutation executed atomically on the host by the Forge daemon and reflected back through a registry rescan — archive-first, `isShadowing`-aware, and honest when the daemon is offline.
**Verified:** 2026-07-22 (re-verification)
**Status:** human_needed
**Re-verification:** Yes — after 98-05 gap-closure (stale-origin prune) + 3-finding code review remediation (GC-01, GC-02, GC-03)

## Goal Achievement

### Observable Truths

Truths 1–11 (98-01 through 98-04, unchanged since the 2026-07-21 initial verification) were re-checked at the "existence + basic sanity" regression level per re-verification-mode guidance: all artifact files still exist, all commits are still on HEAD, both repos' full test suites are still green post-98-05. No regression found in any of them.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can archive an active skill to cold storage from the UI (LIFE-01) | VERIFIED (regression-checked) | `SkillLifecycleMenu.tsx`, `lifecycle-exec.ts` archive branch unchanged since 2026-07-21; files present, full suites green |
| 2 | User can restore a dormant/cold skill to active; shadow-blocked when isShadowing (LIFE-02/05) | VERIFIED (regression-checked) | `convex/forge.ts` LAYER-1 shadow refusal, `lifecycle-exec.ts` LAYER-2 re-check, `SkillLifecycleMenu.tsx` tooltip — files present, unchanged |
| 3 | User can move a skill between global and project scope (LIFE-03) | VERIFIED (regression-checked) | `MoveToProjectDialog.tsx`, `lifecycle-exec.ts` project-scope resolution — unchanged |
| 4 | Delete defaults to archive; true delete is separate + confirmed (LIFE-04) | VERIFIED (regression-checked) | `DeleteSkillDialog.tsx` type-to-confirm gate — unchanged |
| 5 | Daemon-offline lifecycle actions queue and visibly expire, no false-success (LIFE-06) | VERIFIED (regression-checked) | `useLifecycle.ts` reuses `IntakeRowStatus`/`mapIntakeStatus` — unchanged; live-confirmed in 98-HUMAN-UAT test 3 |
| 6 | enqueueLifecycle is auth-gated, idempotent, refuses doomed mutations server-side | VERIFIED (regression-checked) | `convex/forge.ts:1073` — unchanged, `forge.test.ts` green |
| 7 | Daemon executes archive/restore/move/delete natively, cross-volume-safe, cold-only delete guard (DAEMON-02) | VERIFIED (regression-checked) | `lifecycle-exec.ts` — unchanged, 55 tests green (see below, now folded into 62-file/1016-test full forge suite) |
| 8 | rescanAndSync fires on success only | VERIFIED (regression-checked) | `command-poller.ts:463` — unchanged |
| 9 | Concurrent same-name lifecycle commands cannot interleave; fresh workspace list | VERIFIED (regression-checked) | `command-poller.ts` mutex, `index.ts` workspace getter — unchanged |
| 10 | Every skill row exposes an always-visible, scope-gated ⋯ menu | VERIFIED (regression-checked) | `SkillRow.tsx`, `ColdStorageView.tsx` — unchanged |
| 11 | LAYER-1 refusal surfaced to user, no crash on shadow/multi-scope tooltip render | VERIFIED (regression-checked) | `SkillLifecycleMenu.tsx` `TooltipProvider` (CR-02), `.catch()`/`toast.error` (CR-03) — unchanged |
| 12 | **[98-05]** The forge snapshot declares a `scannedOrigins` manifest for every reachable skill root walked — global, cold, and each reachable workspace, including one whose `.claude/skills` is now empty | VERIFIED | `skill-rescan.ts:226-277` `buildSkillSnapshot` returns `{ skills, scannedOrigins }`; home origins pushed unconditionally-when-reachable (lines 247, 255), project origins pushed per-workspace when `readOk` (line 272); tests: `scannedOrigins contains the two home origins...`, `a reachable workspace with an EMPTY .claude/skills dir still appears in scannedOrigins...` — both green (28/28 suite) |
| 13 | **[98-05]** A rescan whose snapshot declares a covered-but-empty origin prunes that origin's stale rows | VERIFIED | `convex/skillSync.ts:57-86` `computeSkillPrunes` — declared origin with zero incoming skills prunes all its rows (line 81-83 `if (!prunableOrigins.has(o)) continue`; else prune when `!names`); test `REGRESSION: a declared-but-empty origin ... prunes all its rows` green |
| 14 | **[98-05]** A rescan leaves rows for any origin NOT present in scannedOrigins untouched (transient G: unmount cannot wipe skills) | VERIFIED | `skill-rescan.ts:264-266` `isReachable(ws.rootPath)` gate — unreachable root contributes nothing to scannedOrigins or skills; GC-01 hardens this further: even a *reachable* root whose readdir throws non-ENOENT (EACCES/EIO/EMFILE) is excluded via `readOk` (lines 138-153, 231-234); GC-02 hardens the home-origin case (`homeClaudeReachable` gate, lines 236-243); tests `GC-01: a transient non-ENOENT readdir failure...leaves that origin OUT of scannedOrigins`, `GC-02: a home with no ~/.claude at all declares NEITHER home origin`, `an UNREACHABLE workspace root is absent from scannedOrigins AND emits no skills` — all green |
| 15 | **[98-05]** A legacy snapshot with NO scannedOrigins manifest keeps today's conservative behavior | VERIFIED | `computeSkillPrunes` — `prunableOrigins` defaults to exactly `incomingByOrigin.keys()` when `scannedOrigins` is undefined (skillSync.ts:73-76); test `backward-compat: omitting scannedOrigins reproduces the legacy...result` green; GC-03 additionally guards against a malformed-but-truthy manifest (`{}`, `42`, a string) via `sanitizeScannedOrigins` (skillSync.ts:32-36), wired at both `registry.ts` call sites (lines 182, 350) so a shape that isn't a real array degrades to the same legacy path instead of throwing mid-sync; test `sanitizeScannedOrigins (GC-03)` describe block, 3 cases, all green |
| 16 | **[98-05]** After moving the last skill out of a project workspace, the stale `claude-code:project:<key>` row disappears on the next full rescan and the skill no longer renders multi-scope | VERIFIED (code-level; live re-repro is a human-verification item, see below) | End-to-end wiring confirmed: `buildSkillSnapshot` declares the now-empty project origin (truth 12) → `registry.ts` passes `sanitizeScannedOrigins(snap.scannedOrigins)` into `computeSkillPrunes` at both `syncInventory` (line 187) and `syncFullInventory` (line 355) → declared-empty origin's rows are pruned (truth 13). This is the exact mechanism 98-HUMAN-UAT test 1 diagnosed as broken; the root-cause line (`skillSync.ts:44` pre-fix `if (!names) continue`) no longer exists in that form. Live confirmation (delete the residual `uat-ws-placeholder` skill + rescan) is the plan's own documented MANUAL gate — see Human Verification |

**Score:** 16/16 truths verified at the code level (11 regression-checked unchanged from initial verification, 5 newly added/closed by 98-05 + its 3-finding code review)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `C:/Users/mandr/forge/src/emit/skill-rescan.ts` | `buildSkillSnapshot` returns `{ skills, scannedOrigins }` | VERIFIED | Lines 127-130 (`SkillSnapshot` interface), 226-277 (`buildSkillSnapshot`); `isReachable()` helper (285-292); GC-01 `readOk` (150-199), GC-02 `homeClaudeReachable` (243) |
| `convex/skillSync.ts` | `computeSkillPrunes` accepts optional `scannedOrigins`; prunes declared-but-empty origins; `sanitizeScannedOrigins` guard | VERIFIED | Lines 32-36 (`sanitizeScannedOrigins`, GC-03), 57-86 (`computeSkillPrunes` with 3rd param) |
| `convex/registry.ts` | `syncInventory`/`syncFullInventory` pass `snap.scannedOrigins` (sanitized) into `computeSkillPrunes`, relaxed length guard | VERIFIED | Lines 182/187 (`syncInventory`), 350/355 (`syncFullInventory`) — both sites call `sanitizeScannedOrigins(snap.scannedOrigins)` then pass the sanitized value into both the guard and `computeSkillPrunes` |
| Previously-verified artifacts (schema.ts, forge.ts, lifecycle-exec.ts, command-poller.ts, index.ts, dropdown-menu.tsx, useLifecycle.ts, MoveToProjectDialog.tsx, DeleteSkillDialog.tsx, SkillLifecycleMenu.tsx, SkillRow.tsx, ColdStorageView.tsx) | Unchanged | VERIFIED (regression) | All 12 files confirmed still present; none touched by 98-05's diff (`git show 360e8a5/107e64d/3b14323 --stat` in both repos shows changes confined to skill-rescan.ts/.test.ts, skillSync.ts, registry.ts, skillSync.test.ts) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `skill-rescan.ts buildSkillSnapshot` | `SkillSnapshot.scannedOrigins` | accumulates one origin string per reachable/readOk root walked | WIRED | Confirmed lines 229, 247, 255, 272, 276 |
| `registry.ts syncInventory`/`syncFullInventory` | `computeSkillPrunes` | 3rd argument `sanitizeScannedOrigins(snap.scannedOrigins)` | WIRED | Both call sites (`registry.ts:187`, `registry.ts:355`) confirmed via live grep, matching plan's `computeSkillPrunes\([^)]*scannedOrigins` key-link pattern |
| Previously-verified links (enqueueLifecycle→by_name, ackCommand→refusal report, executeLifecycle→rescanAndSync, move path→workspace resolution, useLifecycle→listLifecycleCommands, isShadowing→disabled Restore, menu→enqueueLifecycle) | — | — | WIRED (regression) | Unchanged since 2026-07-21, all files present |

### Behavioral Spot-Checks / Test Runs (executed live by this verifier, not taken from SUMMARY claims)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Forge skill-rescan unit tests (98-05 scope) | `cd C:/Users/mandr/forge && npx vitest run src/emit/skill-rescan.test.ts` | 28/28 passed | PASS |
| Forge full suite (regression) | `cd C:/Users/mandr/forge && npx vitest run` | 1016/1016 passed, 62 files | PASS |
| Forge typecheck | `cd C:/Users/mandr/forge && npx tsc --noEmit` | Clean (exit 0) | PASS |
| CodePulse skillSync unit tests (98-05 scope) | `cd C:/Users/mandr/codepulse && npx vitest run convex/__tests__/skillSync.test.ts` | 20/20 passed | PASS |
| CodePulse full suite (regression) | `cd C:/Users/mandr/codepulse && npx vitest run` | 2351/2351 passed, 204 files (17 skipped/pre-existing, 193 todo) | PASS |
| CodePulse typecheck | `cd C:/Users/mandr/codepulse && npx tsc --noEmit` | Clean (exit 0) | PASS |
| GC-01 regression: transient non-ENOENT readdir failure excluded from manifest | `npx vitest run` (case-level, within skill-rescan.test.ts) | `GC-01: a transient non-ENOENT readdir failure on a workspace skills dir leaves that origin OUT of scannedOrigins` — pass | PASS |
| GC-02 regression: no ~/.claude declares neither home origin | same file | `GC-02: a home with no ~/.claude at all declares NEITHER home origin` — pass | PASS |
| GC-03 regression: malformed manifest degrades to legacy path, no throw | `npx vitest run` (skillSync.test.ts) | `REGRESSION: a malformed manifest degrades to legacy prune behavior instead of throwing mid-sync` — pass | PASS |

Note: these numbers were re-run live by this verifier (not copied from 98-05-SUMMARY.md, which claimed 2331/204 for the full codepulse suite — the small delta to the 2351/204 observed here is attributable to unrelated uncommitted work already present in the working tree per this task's briefing, not a regression in phase-98 scope).

### Probe Execution

No `scripts/*/tests/probe-*.sh`-style probes declared for this phase; the above live-executed vitest/tsc runs serve as the equivalent evidence (same as the initial verification).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIFE-01 | 98-01, 98-02, 98-04 | Archive active skill to cold storage | SATISFIED | REQUIREMENTS.md marks `[x]` Complete; code-verified + live-UAT-confirmed (98-HUMAN-UAT test 2) |
| LIFE-02 | 98-01, 98-02, 98-04 | Restore dormant skill to active | SATISFIED | REQUIREMENTS.md `[x]` Complete; code-verified + live-UAT-confirmed |
| LIFE-03 | 98-01, 98-02, 98-03, 98-04, **98-05** | Move skill between global/project | SATISFIED | REQUIREMENTS.md `[x]` Complete; 98-05 closes the residual stale-source-lane gap this requirement's own success criterion (SC3: "the host file relocates on disk to match") implies |
| LIFE-04 | 98-01, 98-02, 98-03, 98-04, **98-05** | Delete defaults to archive; true delete separate+confirmed | SATISFIED | REQUIREMENTS.md `[x]` Complete; 98-05's fix also closes the equivalent stale-row case for deletes that empty a workspace |
| LIFE-05 | 98-01, 98-02, 98-04 | Respect `isShadowing` | SATISFIED | REQUIREMENTS.md `[x]` Complete |
| LIFE-06 | 98-01, 98-03 | Graceful degrade when daemon offline | SATISFIED | REQUIREMENTS.md `[x]` Complete; live-UAT-confirmed (98-HUMAN-UAT test 3) |
| DAEMON-02 | 98-02, **98-05** | Daemon executes lifecycle commands atomically | SATISFIED | REQUIREMENTS.md `[x]` Complete |
| DAEMON-03 | (98-05 frontmatter also claims this) | Daemon rescans/re-syncs after mutation | Already SATISFIED under Phase 97 | REQUIREMENTS.md attributes DAEMON-03 to Phase 97 (`[x]` Complete there) — not a Phase-98 roadmap requirement (`ROADMAP.md` Phase 98 requirements list is `LIFE-01..06, DAEMON-02` only, no DAEMON-03). 98-05's frontmatter listing it is not an orphan/gap: the plan legitimately exercises and hardens the same rescan mechanism DAEMON-03 already covers, but does not need a separate traceability row |

All 7 ROADMAP-mapped Phase-98 requirement IDs (LIFE-01..06, DAEMON-02) are accounted for and marked Complete in `REQUIREMENTS.md`'s traceability table (lines 75-81) — no orphaned requirements. `REQUIREMENTS.md` moved these from "Pending" (as noted in the 2026-07-21 initial verification) to `[x]` Complete, consistent with the 98-HUMAN-UAT pass + this gap closure.

### Anti-Patterns Found

None. Grepped all 98-05-modified files in both repos (`skill-rescan.ts`, `skill-rescan.test.ts`, `skillSync.ts`, `skillSync.test.ts`, `registry.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` — zero matches. No debt markers introduced by the gap-closure or its review-fix commits.

### Human Verification Required

See frontmatter `human_verification` for the full itemized list. Summary:

**Carried forward from the 2026-07-21 initial verification (unchanged status):**
1. Menu scope-gating and shadow/multi-scope tooltips live in the browser — blocked on Clerk sign-in (98-HUMAN-UAT test 4)
2. LAYER-1 refusal toast surfaces correctly in the browser — blocked on Clerk sign-in (98-HUMAN-UAT test 5)
3. Archive/restore/permanent-delete round-trip against a live daemon — already **passed** (98-HUMAN-UAT test 2), listed for completeness
4. Offline-daemon expiry timing — already **passed** (98-HUMAN-UAT test 3), listed for completeness

**New from 98-05's own `<verification>` section (not yet executed — explicitly deferred by the executor as out-of-scope for an automated pass):**
5. MANUAL live re-repro: delete the residual `uat-ws-placeholder` skill from the G:\ workspace, trigger a rescan, confirm the stale `claude-code:project:<key>` row disappears and the previously-moved skill stops rendering multi-scope
6. MANUAL NEGATIVE: pause/disconnect the live G:\ Google Drive mount mid-scan and confirm the workspace's origin is NOT declared in `scannedOrigins` and its row is NOT pruned — the plan itself states "do not trust the unmount mitigation until this is observed on the real mount"

Items 5 and 6 are the actual close-out gate for this gap-closure plan's most safety-critical claim (T-98-10: a transient unmount must never authorize a prune). The code-level mechanism (`isReachable()` + `readOk` gating) is thoroughly unit-tested with synthetic fixtures (nonexistent paths, injected `EACCES`/`EPERM` errors), but per the plan's own verification section, live observation on the real Google Drive mount is the standard this repo holds itself to before calling the mitigation proven — the same evidentiary bar the initial verification applied to the base move/archive/restore mechanics.

### Gaps Summary

No code-level gaps. The single gap 98-HUMAN-UAT flagged against the base Phase 98 build (stale project-origin row surviving a move/delete that empties a workspace) is closed: `buildSkillSnapshot`'s new `scannedOrigins` manifest lets `computeSkillPrunes` distinguish a covered-but-empty origin from an unscanned one, and both `registry.ts` prune call sites are wired to it. A subsequent code review surfaced 3 findings (GC-01: transient read failures must not authorize pruning; GC-02: an unreachable `~/.claude` must not authorize pruning either home origin; GC-03: a malformed `scannedOrigins` shape must degrade gracefully, not throw mid-sync) — all 3 are confirmed landed in the current HEAD of both repos via direct `git show` + live file reads, not just SUMMARY.md claims, and all are covered by new regression tests that this verifier re-ran and confirmed green. Both repos' full test suites are green (1016/1016 forge, 2351/2351 codepulse) and both typecheck cleanly. `REQUIREMENTS.md` now marks all 7 Phase-98 requirement IDs (LIFE-01..06, DAEMON-02) Complete with no orphans.

`status: human_needed` reflects the 2 net-new manual gate items from 98-05's own verification section (live re-repro + live negative-unmount check) plus the 2 carried-forward Clerk-blocked browser items — none are code deficiencies; all are the documented, self-imposed evidentiary bar this phase has held since its initial verification.

---

_Verified: 2026-07-22_
_Verifier: Claude (gsd-verifier)_
