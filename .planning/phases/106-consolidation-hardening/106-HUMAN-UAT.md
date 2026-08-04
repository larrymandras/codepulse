---
status: in-progress
phase: 106-consolidation-hardening
source: [106-CONTEXT.md, 98-HUMAN-UAT.md, 100-HUMAN-UAT.md]
started: 2026-08-04T21:44:43Z
updated: 2026-08-04T22:30:00Z
---

## Current Test

[2026-08-04: Task 2 (live Clerk-signed-in session) complete. Larry performed the archive→restore round-trip on a real skill through the Skills page UI, which triggered the daemon rescan and registered all four `uat106-*` fixtures with their intended origin shapes (confirmed via `registry:listSkills`). All four numbered tests below were then exercised live and recorded. All four PASSED (Test 3 carries a documented discrepancy against the plan's acceptance-criteria wording — see its `notes:` — that is pre-existing stub behaviour, not a regression). Proceeding to Task 3 cleanup.]

## Environment

- **Dev server:** `http://localhost:5173` — confirmed live (HTTP 200 on both `localhost` and `[::1]`; per this project's LESSONS, IPv4-only probes on this host have falsely reported the server down before, so both were checked).
- **Convex backend:** self-hosted `convex-backend` (local, all-local topology per project memory) — confirmed live at `http://127.0.0.1:3210/version` (HTTP 200). The frontend's live connection was cross-checked indirectly: `npx convex run registry:listSkills '{}'` against the same deployment returned 695 real skill rows including the live `enhance-prompt` row at origin `claude-code`, consistent with production data (not an empty/dev-seeded instance). `VITE_CONVEX_URL`'s literal value was not read (lives in `.env.local`, which this project's CLAUDE.md forbids reading).
- **Forge daemon:** running. Job API responds `{"status":"ok"}` at `http://127.0.0.1:57328/health`; `npx convex run forge:listHosts '{}'` shows host `lmofficenew` with a recent `lastSeenAt`; `~/.forge/tray.lock` and `forge.db-shm` were both touched today (2026-08-04), consistent with a live tray-supervised daemon process (no separate `forge` process name shows in `tasklist` because it runs inside the tray's Electron/node host, matching this project's established pattern).
- **Staged fixtures (disk-backed, created this session, all confirmed present on disk before the live session):**
  - `C:\Users\mandr\.claude\skills\uat106-active-single\SKILL.md` — global active, single origin (test 1)
  - `C:\Users\mandr\.claude\skills-available\uat106-dormant-plain\SKILL.md` — cold storage, no same-named active copy (test 2)
  - `C:\Users\mandr\.claude\skills\uat106-multiscope\SKILL.md` — global copy (test 3, half 1 of 2)
  - `G:\My Drive\forge-workspaces\drive-sync-test\.claude\skills\uat106-multiscope\SKILL.md` — project-workspace copy, same name as the global copy above (test 3, half 2 of 2 — together these should merge into one multi-scope row)
  - `G:\My Drive\forge-workspaces\drive-sync-test\.claude\skills\uat106-lastout\SKILL.md` — the ONLY skill in the `drive-sync-test` project workspace (test 4)
- **Baseline registry check (before staging any lifecycle action):** `npx convex run registry:listSkills '{}'` returned 695 rows total and zero rows named `uat106-*` — confirms a clean starting state with no pre-existing residue from a prior session.

### Deviation: fixtures are disk-staged but not yet registered

The plan's Task 1 called for triggering a rescan and confirming all four fixtures appear in
the live registry with their intended origin shapes **before** the Task 2 session starts,
using the same CLI-identity-impersonated `enqueueLifecycle` mechanism the Phase-98 automated
UAT session used (`98-HUMAN-UAT.md` test 6/note: `npx convex run forge:enqueueLifecycle ... --identity ...`
archiving/restoring the real `enhance-prompt` skill to force a daemon rescan).

Attempting that exact command this session, this session's Bash permission classifier denied
it: `"Permission for this action was denied by the Claude Code auto mode classifier... you
should not attempt to work around this denial."` Per this project's own instructions, that
denial was not bypassed. Two reasons this is the correct outcome, not just a shrug:

1. `enqueueLifecycle` moves a REAL currently-in-use skill's files on disk (archive/restore) —
   a genuinely consequential live mutation, and CLI `--identity` impersonation bypasses the
   Clerk auth gate that exists specifically to make that mutation attributable and deliberate.
2. The tempting workaround — calling `registry:syncInventory` directly with a hand-built
   snapshot containing only the new fixtures — was evaluated and rejected as **actively
   dangerous**, not just blocked: `computeSkillPrunes` (`convex/skillSync.ts`) prunes any
   existing row whose origin appears in the incoming snapshot but whose name does not. A
   snapshot containing only the 5 new fixture entries under origins `claude-code` /
   `claude-code:available` / the project origin would have deleted essentially the entire
   real skill catalog (695 rows) on write. The only safe way to sync the registry is the
   daemon's own full-filesystem-walk `buildSkillSnapshot()`, which only runs from inside the
   real Forge daemon process after a real lifecycle/intake command.

**Resolution:** live registry registration and confirmation of the four `uat106-*` fixtures
is deferred to the FIRST live action of Task 2's Clerk-authenticated browser session — Larry
performs one ordinary, fully-authenticated archive+restore round-trip on `enhance-prompt`
(or any other inert real skill) through the actual UI, which is the safe, attributable path
this gate exists to enforce, and triggers the same daemon rescan that would have registered
the fixtures. Once that round-trip completes, all four fixtures should appear with their
intended origin shapes and the four numbered tests below can proceed. This does not weaken
the UAT — it is the same rescan mechanism previously verified in `98-HUMAN-UAT.md`, just
performed live instead of via CLI impersonation.

**Resolved 2026-08-04 (Task 2 start):** Larry performed an archive→restore round-trip on a
real skill through the live Skills page UI, in his own Clerk-signed-in browser session. This
triggered the daemon's post-command rescan. Confirmed via `npx convex run registry:listSkills`
immediately after: all five `uat106-*` fixture rows (uat106-lastout, uat106-multiscope x2
origins, uat106-dormant-plain, uat106-active-single) were present in the live registry with
their intended origin shapes, matching what Task 1 staged on disk. The four numbered tests
below were then exercised live.

## Tests

### 1. Active single-scope row ⋯ menu (Phase-98 Test 4, pending sub-case)
expected: The ⋯ menu on `uat106-active-single` (single origin `claude-code`, so `dormant` is false and `multiScope` is false in `resolveLifecycleActions`) renders exactly two enabled items below the Run submenu — `Archive` and `Move to Project…` (the label is "Move to Project…" rather than "Move to Global…" because `moveDestinationIsProject = activeOrigin === "claude-code"` is true) — with no disabled-reason tooltip on either item (`src/components/skills/SkillLifecycleMenu.tsx` lines ~300-318).
result: PASS. Larry's exact words: "i see run with another menu popout, archive and move to project all enabled". Menu shows Run (with its own submenu popout — the normal skill-invocation item, unrelated to this test), Archive (enabled), and exactly one Move item (enabled) — no disabled-reason tooltip on either. Matches expected.
verdict: pass

### 2. Dormant non-shadowed row ⋯ menu (Phase-98 Test 4, pending sub-case)
expected: The ⋯ menu on `uat106-dormant-plain`, opened from Cold Storage (`lane="cold"`, `dormant` true, and `shadowed` false because no same-named active copy exists anywhere), renders `Restore` ENABLED — the plain `<DropdownMenuItem onSelect={handleRestore}>` branch, not the disabled/tooltip branch used for the shadowed case — plus `Delete Permanently` (`src/components/skills/SkillLifecycleMenu.tsx` lines ~240-276). Phase 98 verified the SHADOWED sub-case only (2026-07-27); this is the still-pending non-shadowed sub-case. The Skills page must not blank (CR-02 regression guard — the menu's local `TooltipProvider` must hold even though this branch renders no `Tooltip` at all).
result: PASS. Larry's exact words: "restore enabled, delete permanently there, page looks fine". Restore rendered ENABLED (non-shadowed branch, no disabled tooltip), Delete Permanently present, and the Skills page did not blank or error. Matches expected — closes the still-pending non-shadowed sub-case Phase 98 left open.
verdict: pass

### 3. Multi-scope row ⋯ menu (Phase-98 Test 4, pending sub-case)
expected: The ⋯ menu on `uat106-multiscope` (present under both the global `claude-code` origin and the `drive-sync-test` project origin, so `nonDormantOrigins.length > 1` and `multiScope` is true) renders `Archive` and `Move…` both disabled, wrapped in one shared `Tooltip` reading exactly "Active in multiple scopes — disambiguation ships in a later release." (`src/components/skills/SkillLifecycleMenu.tsx` lines ~277-299).
result: PASS on behavior. Larry provided a screenshot: Archive and Move both disabled (greyed), tooltip text verbatim "Active in multiple scopes — disambiguation ships in a later release." — exact match to the string hardcoded at `src/components/skills/SkillLifecycleMenu.tsx:296-297`, returned by `resolveScopeDrop`'s multiScope branch in `src/lib/skills.ts:104-109`, and covered by the three drop-lane rejection assertions in `src/lib/skills.test.ts:324-342`. No crash, no fabricated per-scope claim — the message is a generic, honest placeholder (it does not name "Global + Project: uat106-multiscope" or similar).
notes: Discrepancy against this plan's own acceptance-criteria wording ("each with the honest reason showing which scopes it spans") — the shipped tooltip states only that the skill is active in multiple scopes, it does not name which specific scopes. This is pre-existing, deliberately-scoped behavior (a documented future-work stub referenced by its own code comment and covered by existing tests), not a regression introduced by this phase or plan. No code fix applied.
verdict: pass

### 4. Stale project-origin re-verification (D-07 as corrected — re-verify the 98-05 fix holds)
expected: This is a RE-VERIFICATION that the 98-05 fix (`sanitizeScannedOrigins` + `computeSkillPrunes`'s manifest-driven per-origin pruning in `convex/skillSync.ts`) still holds against a real live rescan — it is NOT re-testing the original bug, which is already closed (`98-HUMAN-UAT.md` Gaps: `status: resolved`, and Test 6 there is a live 2026-07-23 post-deploy re-repro that already PASSED). A PASS here is the expected outcome. After moving `uat106-lastout` out of the `drive-sync-test` project workspace (it is the workspace's only skill, so the workspace becomes empty-but-reachable), the daemon's next rescan declares that project origin in `scannedOrigins` with zero incoming skills for it; `computeSkillPrunes` should therefore prune every row still carrying that origin, so the now-empty `claude-code:project:<key>` row for `uat106-lastout` disappears from the registry entirely, and `uat106-lastout` (now living only at `claude-code` global) should NOT render multi-scope — its Archive/Move items should be enabled, not disabled. If this FAILS, that is a NEW regression (since 98-05 already shipped and already passed one live re-repro), not the original bug resurfacing, and Task 3 will root-cause and fix it per `CLAUDE.md`'s Error Triage rule.
result: PASS. Larry moved `uat106-lastout` out of the `drive-sync-test` project workspace to Global ("moved it to Global") through the UI. BEFORE state: `uat106-lastout` carried two origins — `claude-code` (Global) and the `drive-sync-test` project workspace (`claude-code:project:<key>`). Verified via `npx convex run registry:listSkills` immediately after the move, BEFORE asking Larry to check the UI: the row now shows ONLY `origin: "claude-code"` (Global), source `C:\Users\mandr\.claude\skills\uat106-lastout\SKILL.md` — the drive-sync-test project-origin entry is gone entirely (pruned), not merely marked empty. AFTER state confirmed independently in the UI by Larry: "yes they now appear" — Archive and Move both enabled, no longer showing multi-scope. Re-verifies the 98-05 fix holds against a real live daemon rescan; no new regression.
verdict: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

All four Phase-98-pending sub-cases are closed. Test 3 passed on behavior but carries a
documented wording discrepancy against this plan's own acceptance-criteria phrasing (see its
`notes:`) — pre-existing stub, not a regression, no code fix applied. Test 4 re-verifies the
98-05 stale-project-origin fix holds against a real live rescan; no new regression, so Task 3's
"fix a genuine regression" branch is a documented no-op.
