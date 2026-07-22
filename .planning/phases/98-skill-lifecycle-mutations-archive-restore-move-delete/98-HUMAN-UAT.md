---
status: partial
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
source: [98-VERIFICATION.md]
started: 2026-07-21T18:20:00Z
updated: 2026-07-22T09:00:00Z
---

## Current Test

[testing paused — 4 items outstanding: tests 6 & 7 (live-mount checks for the 98-05 prune fix, need deployed convex + rebuilt daemon), plus browser-visual halves of tests 4 & 5, blocked on a signed-in browser session]

## Tests

### 1. Real cross-volume move (C: global/cold ↔ G:\ project workspace)
expected: The skill directory relocates on disk (copy+delete fallback works against the live Google Drive mount) and the Skills page shows the new lane after rescan
result: issue
reported: "Move executed correctly in BOTH directions (C:→G: and G:→C:; bytes verified on the live Google Drive mount, source removed, command acked done, registry lane flipped). BUT: moving the LAST skill out of a project workspace leaves a stale project-origin row in the registry forever — the rescan can't prune an origin that has zero remaining skills, so the row reads as multi-scope afterward, which also wrongly disables Archive/Move in the ⋯ menu for that skill."
severity: major
notes: Executed via CLI-impersonated enqueueLifecycle (same mutation the UI calls); workspace drive-sync-test (01KV34ZEQEYMJMXMPNZMAMR7P2)

### 2. Archive / restore / permanent-delete round-trip against a live Forge daemon
expected: Archiving a global skill moves it to ~/.claude/skills-available/ and the Skills page shows it dormant after rescan; restoring moves it back and clears the dormant lane; permanently deleting a cold row (type-to-confirm) removes the directory and the row disappears
result: pass
notes: |
  Full round-trip on throwaway skill uat-lifecycle-test against the live daemon (local Convex):
  - archive: dir moved to skills-available/, command done, registry origin → claude-code:available
  - restore: dir moved back, command done, registry origin → claude-code
  - permanent delete (WR-04 target-scoped D-05 path): deleted the COLD copy while an active same-name copy existed — cold dir removed, active copy untouched, registry pruned to claude-code only
  Type-to-confirm dialog itself is a browser interaction — not exercised (see test 4 blocker); the mutation+daemon+registry halves are fully verified.

### 3. Offline-daemon expiry (LIFE-06)
expected: With the daemon stopped, issuing an archive shows the command queued, then visibly expires (status badge 'expired') once the 5-minute TTL passes — never a false success state
result: pass
notes: |
  Daemon stopped; archive enqueued 19:31:41 → status 'queued' (honest, no false success);
  expire-stale-forge-commands cron flipped it to 'expired' at 19:37:13 (TTL 19:36:41 + ≤1min cron);
  daemon restarted → command STAYED 'expired' through 3+ poll cycles, skill directory untouched.
  The RowStatusBadge 'expired' visual render is part of the blocked browser pass (test 4) — the
  state machine it renders from is fully verified.

### 4. Menu scope-gating and shadow/multi-scope tooltips live in the browser
expected: Active single-scope row shows Archive + one Move item; dormant row shows Restore + Delete Permanently; shadowed dormant row shows Restore disabled with the shadow tooltip (and does NOT blank the Skills page — CR-02 regression); multi-scope row shows Archive/Move disabled with the honest reason
result: blocked
blocked_by: third-party
reason: "CodePulse gates the entire app behind Clerk sign-in; Claude cannot authenticate (credential entry prohibited) and the claude-in-chrome extension is not connected, so no signed-in browser session was available. Headless Playwright reached only the sign-in screen. Data-side staging for every menu state was verified in the registry (single-scope, dormant-only, shadowed active+cold, multi-scope rows all exist)."

### 5. LAYER-1 refusal toast surfaces correctly in the browser (CR-03 fix)
expected: Clicking Archive on a skill that already has a dormant cold copy shows a toast with the house-copy refusal reason instead of doing nothing
result: blocked
blocked_by: third-party
reason: "Server half PASSED: with active+cold copies staged, enqueueLifecycle threw 'lifecycle-refused:collision:a dormant copy already exists in cold storage' BEFORE inserting any row (verified no new command queued). The visual toast render requires a signed-in browser — same Clerk blocker as test 4."

### 6. Live re-repro of the stale-origin prune fix (98-05, phase gate — post-deploy)
expected: After deploying the 98-05 convex changes and rebuilding/restarting the Forge daemon, delete the residual `uat-ws-placeholder` skill from `G:\My Drive\forge-workspaces\drive-sync-test\.claude\skills\`, trigger one rescan, and confirm the `claude-code:project:559ce8ebf812` row disappears from the Skills page and the previously-moved skill no longer renders multi-scope (Archive/Move re-enabled)
result: pending
notes: "Prerequisites: `npx convex deploy` of the 98-05+GC changes to the local self-hosted backend, forge `npx tsc` rebuild, daemon restarted pointing at http://127.0.0.1:3211 (forge\\.env still needs the manual local-URL edit per Session Notes)."

### 7. Transient-unmount negative check (T-98-10, 98-05 safety valve)
expected: With a skill present in a G:\ workspace, PAUSE/disconnect the live Google Drive mount and trigger one rescan — the workspace's `claude-code:project:<key>` origin must NOT appear in scannedOrigins and its registry row must NOT be pruned (the unit test only covers a nonexistent path; a paused Drive mount can keep the G: letter mounted while reads misbehave — do not trust the unmount mitigation until observed on the real mount)
result: pending
notes: "GC-01 hardened this path (non-ENOENT read failures never declare an origin), but the plan's own verification section requires live observation."

## Summary

total: 7
passed: 2
issues: 1
pending: 2
skipped: 0
blocked: 2

## Session Notes (2026-07-21 evening, automated UAT run)

- Executed by Claude via CLI-impersonated `enqueueLifecycle` (identical mutation path to the UI) + disk/registry/daemon-log verification; browser-visual halves blocked by Clerk sign-in (no credential entry permitted, claude-in-chrome extension not connected).
- Environment repairs that were prerequisites for ANY of this to work (all were silently broken):
  1. convex-backend host port-publishing was dead again (the known silent-breakage mode) — fixed with `docker compose up -d --force-recreate backend` in convex-selfhost.
  2. The running Forge daemon was polling the RETIRED cloud deployment (tidy-whale-981) — `C:\Users\mandr\forge\.env` still points there. Relaunched with `CONVEX_FORGE_INGEST_URL=http://127.0.0.1:3211` (+log/file URLs) overriding via shell env. **`forge\.env` needs a manual edit to the local URLs** (Claude cannot edit .env files) or every autostart will boot a cloud-pointed daemon.
  3. `forge/dist` was stale (built 07-18, pre-Phase-98 — no lifecycle executor). Rebuilt with `npx tsc`.
  4. The ForgeDaemon scheduled task's 06:22 launch hung waiting for the G: mount and never started the daemon.
- Residue deliberately left: `uat-ws-placeholder` skill in G:\My Drive\forge-workspaces\drive-sync-test\.claude\skills\ — removing the last skill from a workspace re-triggers the stale-origin bug (see Gaps); delete it + rescan once the prune fix lands.

## Gaps

- truth: "After a move, the Skills page reflects host truth for BOTH the destination and the source lane"
  status: resolved
  resolution: "Gap-closure plan 98-05 executed 2026-07-22 (forge 360e8a5 + codepulse 107e64d, hardened by GC-01..03 fixes a95194f/3a2e9a0/3b14323): buildSkillSnapshot declares a scannedOrigins manifest for every reachable+readable root; computeSkillPrunes prunes declared-but-empty origins. Unit-verified both sides (forge 28/28, codepulse 20/20, full suites green); LIVE confirmation pending as tests 6 & 7 (post-deploy)."
  reason: "Moving (or deleting) the last skill of a project workspace leaves a stale project-origin skills row in Convex forever; the row then renders as multi-scope, which also disables Archive/Move in the lifecycle menu for that skill"
  severity: major
  test: 1
  root_cause: "computeSkillPrunes (convex/skillSync.ts:44) skips pruning for any origin absent from the incoming snapshot ('origin not in this snapshot → untouched'). The snapshot format only carries skills that exist, so an origin whose workspace became EMPTY is indistinguishable from an origin that wasn't scanned — its stale rows are never deleted. Live repro: after moving uat-lifecycle-test G:→C:, disk and the daemon-built snapshot both showed only 2 entries (global+cold), but the registry kept claude-code:project:559ce8ebf812 across two full rescans; seeding the workspace with any other skill made the next rescan prune it."
  artifacts:
    - path: "convex/skillSync.ts"
      issue: "computeSkillPrunes:44 — `if (!names) continue;` makes empty-origin reconciliation impossible"
    - path: "C:/Users/mandr/forge/src/emit/skill-rescan.ts"
      issue: "snapshot carries no 'origins covered by this scan' manifest, so the server cannot distinguish covered-but-empty from not-scanned"
  missing:
    - "Snapshot should declare the origins it covered (e.g. scannedOrigins: [...] built from home roots + walked workspaces) and computeSkillPrunes should prune rows for any declared origin, including empty ones"
    - "Regression test: rescan with a declared-but-empty project origin prunes that origin's rows"
  debug_session: ""
