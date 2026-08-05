---
status: in-progress
phase: 106-consolidation-hardening
source: [106-CONTEXT.md, 98-HUMAN-UAT.md, 100-HUMAN-UAT.md]
started: 2026-08-04T21:44:43Z
updated: 2026-08-05T17:05:00Z
---

## Current Test

[2026-08-05 (latest): **Plan 106-08 (UAT session C — drag round-trip + shadowed-row
no-op) Task 1 is complete; Task 2 is a BLOCKING checkpoint AWAITING LARRY.** The Forge
daemon is proven live by an ADVANCING heartbeat (not merely a listening socket), and
three fixture directories are staged on disk: `uat106-drag` (plain active global) and
the two halves of `uat106-shadow` (active + dormant, which a rescan must merge into the
project's first-ever shadowed-merged row — the live catalog holds **0** today, which is
the exact reason Phase 100 could not run its Test 2). Tests **8** and **9** are staged
below with code-derived expectations; both `result:` lines are deliberately EMPTY and
must be filled only from what Larry actually observes. Two deviations are recorded under
`### Session C deviations` — fixture registration is deferred to the session's first
authenticated action (the 106-06 precedent), and the plan's own round-trip leg ORDER was
corrected because it contradicts `resolveScopeDrop`. `status:` stays `in-progress`;
plan 106-08 Task 3 closes this file after the session.]

[2026-08-05 (later): **Plan 106-07 (UAT session B — voice) Task 2 is COMPLETE. Tests 5, 6
and 7 all PASS.** The wake → barge-in → re-arm sequence was run live in one continuous
session, 16:16:12 → 16:20:53 — the first time DEBT-04's full sequence has been exercised
end to end in a single pass. Barge-in is judged on the media element (`tts.audio.teardown
{cause:"stop:interrupt:barge-in", currentTime:4.47, duration:10.82}` — cut 41 % through),
not on the `barged` flag, with three un-interrupted replies in the same session ending at
`currentTime == duration` as a within-session control. Verbatim trace is in `## Voice
trace`, together with a capture-method finding (the raw console omits all `tts.audio.*`
events; COPY TRACE is authoritative) and one unexplained, non-reproducing anomaly from an
earlier 15:57 attempt. Zero source files modified — `git diff --quiet -- src/hooks
src/pages/Chat.tsx` passes. `status:` stays `in-progress`; plan 106-08 (session C) closes
this file. Task 3 (trace-based root-cause routing) is a no-op: nothing failed.]

[2026-08-05: Plan 106-07 Task 1 complete — both halves of the stack proven live (dev server
200 on `localhost`/`127.0.0.1`/`[::1]`; authenticated Ástríðr `GET /api/agents` → **200**
against an unauthenticated control of **401**; Convex reached over
`wss://lmofficenew.tail5bb6b3.ts.net/api/1.42.1/sync`), voice tracing proven actually
emitting, and tests 5-7 staged with code-derived expectations. No source file touched.]

[2026-08-04: Plan 106-06 execution complete for this session. Task 1 (staging), Task 2 (live session, 4/4 pass), and Task 3 (unconditional cleanup + documented no-op on the code-fix branch) are all done — zero `uat106-*` residue on disk or in the live registry, confirmed by direct query. `status:` remains `in-progress` per the plan's own instruction (plans 106-07 and 106-08 extend this same artifact); only the last of them closes it.]

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

### Session B environment (plan 106-07, 2026-08-05) — live voice stack

Recorded before any voice test, per plan 106-07 Task 1 §A/§B. Nothing below is
relayed: every line was measured this session.

- **Dev server:** `http://localhost:5173` — HTTP 200 on **all three** probes
  (`localhost` → 200, `127.0.0.1` → 200, `[::1]` → 200). Both stacks were
  checked per this project's LESSONS: Vite has previously bound `::1` only on
  this host and an IPv4-only probe produced a false "server is DOWN" report.
- **Browser origin for the session must be `http://localhost:5173`.** Measured:
  an `OPTIONS` preflight to `/api/agents` carrying `Origin: http://localhost:5173`
  returns `200` with `access-control-allow-origin: http://localhost:5173`. The
  same preflight from `http://lmofficenew.tail5bb6b3.ts.net:5173` is **rejected**
  (no `access-control-allow-origin`), so running the session from the tailnet
  origin would fail every `/api/*` call for CORS reasons that have nothing to do
  with the voice pipeline.
- **Ástríðr backend:** base `http://lmofficenew.tail5bb6b3.ts.net:8181`
  (the app's own `astridrApiBase()`, read from the running page — the
  `VITE_ASTRIDR_API_URL` value was never opened from disk).
  - Authenticated probe: `GET /api/agents` with the `Authorization` header the
    app's own `authHeaders()` (`src/lib/astridrApi.ts:117`) produces → **HTTP 200**.
  - Control, same route, header omitted → **HTTP 401**. The non-401 above is
    therefore the credential doing work, not an open route.
  - Only the status and the fact that a bearer header was sent are recorded;
    the header value was never printed to the transcript or written here
    (T-106-23).
  - **Finding worth carrying into the session (T-106-25):** Ástríðr's `401`
    responses carry **no** `access-control-allow-origin` header (verified: `/health`
    200 → header present; `/api/agents` 401 → header absent). A browser therefore
    surfaces an *auth* failure on `/api/*` as a *CORS* error. If anything in the
    live session reports "blocked by CORS policy" against `:8181`, read it as a
    401 first, not as a networking or voice-pipeline fault.
- **Convex target:** `wss://lmofficenew.tail5bb6b3.ts.net/api/1.42.1/sync` —
  captured from the page's own live websocket, i.e. the self-hosted
  `convex-backend` reached over the tailnet (the all-local topology). The local
  HTTP surface answers too: `http://127.0.0.1:3210/version` → HTTP 200.
- **Forge/telemetry socket seen alongside it:** `ws://127.0.0.1:8181/ws/telemetry`.

**Voice tracing: ON, and proven emitting — not merely "enabled".**

- Mechanism: `VOICE_DEBUG` is a module-level constant in
  `src/hooks/useAstridrVoice.ts:128` and is **already `true`** on the current
  source. No switch had to be flipped and **no file was edited** to enable it.
  It gates three things at once: this file's `trace()` (console + the
  `window.__astridrVoiceTrace` ring buffer, capped at 500 entries), the `debug`
  option handed down to `useWakeWord` (its `wake.*` lines) and to `useDuplexEars`.
  `useTtsPlayback`'s `tts.audio.*` playback events push into the **same** buffer
  unconditionally.
- Where it is readable: the browser console (every line is prefixed `[voice] `),
  and the **COPY TRACE** chip in the /chat header (`src/pages/Chat.tsx:909-922`,
  rendered because `VOICE_DEBUG_ENABLED` is true) which copies the whole ring
  buffer to the clipboard. Confirmed present in the DOM this session.
- Proof it actually emits — verbatim, captured from a real page load of `/chat`
  in a Chromium instance with a fake mic device, 2026-08-05 14:58:10Z. **First
  line:**

  ```
  [voice] 14:58:10.868 mic.on → wake engine start
  ```

  and the full ring buffer contents at that moment (8 entries), verbatim:

  ```
  14:58:10.868 mic.on → wake engine start
  14:58:10.869 wake.status {"to":"loading"}
  14:58:10.879 duplex.unmount
  14:58:10.879 wake.release-resources {"hadWorker":false,"hadAudioCtx":false,"hadMicStream":false}
  14:58:10.881 mic.on → wake engine start
  14:58:10.882 wake.start.reentry-blocked {"status":"idle"}
  14:58:11.724 wake.audioctx.statechange {"state":"running"}
  14:58:11.736 wake.status {"to":"ready"}
  ```

  This also proves the wake engine reaches `ready` (ONNX worker init + AudioWorklet
  + mic capture all succeeded), so a wake failure in the live session cannot be
  written off as "the engine never loaded" without the trace saying so.
- **How that capture was obtained, stated plainly so it is falsifiable:** `/chat`
  is behind `AuthGuard` (`src/components/AuthGuard.tsx:12-13`) whenever
  `VITE_CLERK_PUBLISHABLE_KEY` is set, so an unauthenticated headless browser
  only ever reaches the "Sign in to access the telemetry dashboard" screen and
  Chat never mounts — the first two probe attempts returned a **zero-length**
  trace buffer for exactly that reason, and that zero was diagnosed rather than
  reported as "tracing is off". The capture above came from a **throwaway second
  Vite instance on port 5199** started with `VITE_CLERK_PUBLISHABLE_KEY=` empty
  (AuthGuard then passes through), running the **same unmodified source**. That
  instance was shut down immediately afterwards; `http://localhost:5199` → no
  listener, and `http://localhost:5173` → still 200. The live session in Task 2
  runs in Larry's own Clerk-signed-in browser on `:5173`.
- No source file was modified to obtain any of the above:
  `git status --porcelain src convex` → empty.

### Session C environment (plan 106-08, 2026-08-05) — live Forge daemon + drag fixtures

Recorded before any drag, per plan 106-08 Task 1 §A/§B. Every line below was measured
this session; nothing is relayed from a previous plan.

- **Dev server:** `http://localhost:5173` — HTTP **200** on all three probes
  (`localhost` → 200, `127.0.0.1` → 200, `[::1]` → 200). Both stacks checked per this
  project's LESSONS (Vite has bound `::1` only on this host before, producing a false
  "server is DOWN" report).
- **Convex backend:** self-hosted, all-local. `http://127.0.0.1:3210/version` → **200**
  and `http://127.0.0.1:3211/version` → **200**. `VITE_CONVEX_URL`'s literal value was
  not read (it lives in `.env.local`, which this project's CLAUDE.md forbids reading).

**Forge daemon: proven live by an ADVANCING heartbeat, not by a listening socket.**

A socket that accepts a connection proves a process exists; it does not prove the daemon
is still doing work. Plan 106-08 Task 1 §A explicitly demands the stronger evidence,
because a dead-but-listening daemon would let the optimistic overlay paint and never
reconcile — which looks like a pass at a glance. What was measured:

- `http://127.0.0.1:57328/health` → `{"status":"ok"}`.
- Process identity resolved from the listening socket rather than assumed:
  - PID **33616** — `node.exe "C:\Users\mandr\forge\dist\index.js"` — the **daemon**,
    owns TCP 57328 (API) and 57329 (artifacts).
  - PID **33516** — `node.exe "C:\Users\mandr\forge\dist\tray\tray.js"` — the **tray
    supervisor**, matching `~/.forge/tray.lock` (which contains `33516`).
  - Note `~/.forge/tray.lock` and `forge.db-shm` both carry a **2026-07-29** mtime, so
    file timestamps would have suggested a week-stale daemon. They are not evidence
    either way and were not used as any.
- **The actual liveness proof — two samples of `forge:listHosts`, showing the heartbeat
  move forward while nothing else happened:**

  ```
  npx convex run forge:listHosts '{}'
  → hostId "lmofficenew", lastSeenAt 1785947919550   (2026-08-05T16:38:39.550Z, age 12.0 s)
  … 21 s later …
  → hostId "lmofficenew", lastSeenAt 1785947933753   (2026-08-05T16:38:53.753Z)
  ```

  `lastSeenAt` advanced by 14.2 s between samples, so the daemon is actively writing its
  heartbeat to Convex right now. A frozen row would have returned the same value twice.

- **No unauthenticated rescan trigger exists on the daemon.** Probed
  `GET`/`POST` against `/`, `/health`, `/status`, `/scan`, `/rescan`, `/skills`, `/api`,
  `/routes` on `:57328`. Every `GET` except `/health` returns the daemon's own SPA shell
  (identical HTML for `/rescan` and for a deliberately bogus `/nonexistent-xyz`, so these
  are a catch-all, not real routes), and every `POST` returns
  `{"error":"Unauthorized","detail":"Invalid or missing bearer token"}`. This is why
  fixture registration is deferred — see `### Session C deviations` below.

**Baseline registry census (before staging anything) — `npx convex run registry:listSkills '{}'`:**

- **695** rows / **488** distinct skill names. (The table stores one row per
  `name`+`origin` pair; the UI merges them into a single row carrying an `origins[]`
  array, which is what `isShadowing` reads.)
- Origin breakdown: `claude-code` **185**, `native` **204**, `bridge` **204**,
  `claude-code:available` **80**, plus **4** distinct `claude-code:project:*` origins
  (`…1fa1797dd9db` = `C:\Users\mandr\Mandras` ×19, `…5b1caabbdf8f` =
  `C:\Users\mandr\homeassistant`, `…a3dd52ddc6ab` = `C:\Users\mandr\claudeclaw-os`,
  `…789c222cb6b9` = `C:\Users\mandr\forge`).
- **Shadowed-merged rows: 0.** Names carrying `claude-code:available` *and* some other
  origin: **zero**. Dormant-only names: **80**. This independently re-confirms, on
  2026-08-05, the precise condition `100-HUMAN-UAT.md` Test 2 recorded on 2026-07-25 —
  "the live catalog contains 0 shadowed-merged skills (every cold skill is dormant-only)"
  — and is why `uat106-shadow` has to be fabricated for test 9 to exist at all.
- **`uat106-*` rows: 0.** Clean start; plan 106-06's cleanup left no residue.

**Staged fixtures (disk-backed, created this session, all confirmed present on disk):**

- `C:\Users\mandr\.claude\skills\uat106-drag\SKILL.md` (567 bytes) — plain active global
  skill, the subject of test 8's round-trip. Expected origin after rescan: `claude-code`.
- `C:\Users\mandr\.claude\skills\uat106-shadow\SKILL.md` (888 bytes) — the **active** half
  of the shadowed pair. Expected origin: `claude-code`. **This is the copy test 9 must
  prove survives.**
- `C:\Users\mandr\.claude\skills-available\uat106-shadow\SKILL.md` (859 bytes) — the
  **dormant** half. Expected origin: `claude-code:available` (`DORMANT_ORIGIN`,
  `src/lib/skills.ts:3`). Together with the active half this should satisfy
  `isShadowing()` (`src/lib/skills.ts:26-29`) and merge into ONE shadowed row.

**Project workspace for test 8's move leg (reused, not created):** `drive-sync-test` —
`workspaceId` `01KV34ZEQEYMJMXMPNZMAMR7P2`, `class: "synced"`, `rootPath`
`G:\My Drive\forge-workspaces\drive-sync-test`. Confirmed present on disk and confirmed
to hold **zero** registered skills right now (plan 106-06 emptied it), so the move leg
starts from a known-empty destination. It is offered in `MoveToProjectDialog`'s picker,
which applies no `class` filter (`MoveToProjectDialog.tsx:60-66`). Because this plan did
not create it, Task 3 must NOT delete it — only the `uat106-*` directories.

**Timing constants that govern test 8's failure leg, read from source rather than guessed:**
`FORGE_COMMAND_TTL_MS = 5 * 60 * 1000` (`convex/forge.ts:25`) and the
`"expire-stale-forge-commands"` cron runs `{ minutes: 1 }` (`convex/crons.ts:112-116`),
calling `expireStaleCommands`, which only ever touches rows still in `"queued"`
(`shouldExpireCommand`, `convex/forge.ts:355-357`). So a command issued with no daemon to
claim it expires **5-6 minutes** after the drag — not instantly.

**No source file was modified by this task:** `git diff --quiet -- src convex` → passes.

### Session C deviations

**Deviation 1 — fixtures are disk-staged but not yet registered (same shape as plan
106-06's, and resolved the same way).**

The plan's Task 1 §B asks that each fixture be confirmed registered with its intended
origin shape *before* the session, and §C's acceptance criteria ask specifically that
`uat106-shadow` be confirmed rendering as a shadowed-merged row beforehand. That could
not be done from this executor session, for reasons that are a feature and not an
obstacle:

1. The Forge daemon rescans **only after a real lifecycle/intake command completes**, and
   its own HTTP API rejects every unauthenticated `POST` (measured above). There is no
   timer-driven rescan.
2. Driving `forge:enqueueLifecycle` from the CLI requires `--identity` impersonation of a
   Clerk subject. In the 106-06 session that exact command was **denied by the Bash
   permission classifier**, and per this project's instructions the denial was not worked
   around. It is not attempted again here.
3. The tempting shortcut — calling `registry:syncInventory` with a hand-built snapshot —
   is **actively dangerous**, not merely blocked. `computeSkillPrunes`
   (`convex/skillSync.ts`) prunes any existing row whose origin appears in the incoming
   snapshot but whose name does not, so a snapshot containing only the three fixtures
   under `claude-code` / `claude-code:available` would delete essentially the entire live
   695-row catalog. Only the daemon's own full-filesystem-walk `buildSkillSnapshot()` is
   safe. Rejected, as in 106-06.
4. While probing the daemon's routes, its SPA shell was observed to embed a bearer token
   in `window.__FORGE_CONFIG__` — i.e. any local page load reveals it. That token was
   **not** used to force a rescan (doing so would be the same bypass as (2) by another
   route) and is **not** recorded anywhere in this artifact.

**Resolution:** registration is deferred to the FIRST action of Task 2's Clerk-signed-in
browser session — one ordinary archive→restore round-trip on an inert real skill through
the live UI, which triggers the same daemon rescan. This is the exact mechanism that
worked in plan 106-06 (see `### Deviation: fixtures are disk-staged but not yet
registered` above, and its `**Resolved 2026-08-04 (Task 2 start)**` note). **Test 9 is
gated on the outcome:** if the post-rescan registry does not show `uat106-shadow` as one
row carrying BOTH `claude-code` and `claude-code:available`, test 9 is recorded `blocked`
with that as the reason, and no dormant-only row is substituted for it.

**Deviation 2 (Rule 1 — the plan's own leg order contradicts the code it is testing).**

Plan 106-08's `<how-to-verify>` sequences the round-trip as: (1) drag onto Cold Storage
→ archive, then (2) "drag the now-dormant row onto a Project scope; pick the staged
workspace in the dialog. Expect the move to complete." **That second step cannot succeed,
and the code says so plainly.** After the archive, the row's only origin is
`claude-code:available`, so `resolveScopeDrop` takes its `dormant` branch
(`src/lib/skills.ts:111-123`); with `targetScope === "project"` it falls past the `cold`
and `global` cases and returns `{ kind: "reject", hint: "Restore to Global first, then
move." }` (`src/lib/skills.ts:122`). Larry would have seen a red rejection toast where the
plan told him to expect a workspace picker, and had no way to know which of the two was
wrong.

Corrected order, which exercises **all** of the plan's intended legs (archive, restore,
move-to-project) using transitions `resolveScopeDrop` actually permits: archive → restore
→ move to Project → move back to Global → induced failure. Written out step by step in
test 8 below. Nothing was dropped from the plan's coverage; only the sequence changed.

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

### 5. Wake word arms a turn ("Hey Ástríðr") — DEBT-04 leg 1 of 3
expected: With the mic toggle on and no conversation open, the wake engine is armed:
`useWakeWord`'s `status` is `ready` (`WakeWordStatus`, `src/hooks/useWakeWord.ts:26`),
the /chat header sub-line reads `WAKE-WORD ARMED` (`src/pages/Chat.tsx:900-904`) and the
state pill reads `Say “Hey Ástríðr”` (`stateLabel`, `src/pages/Chat.tsx:635`).
Saying "Hey Ástríðr" must then open a turn **with no click anywhere**: `onWake` fires,
`voiceState` goes `idle → listening` via `dispatch({type:"WAKE"})`
(`src/components/voice/voiceState.ts:8`), the header flips to `IN CONVERSATION`
(`src/pages/Chat.tsx:903`), the pill flips to `Listening…` (`src/pages/Chat.tsx:632`),
and `recognitionStart()` is called from inside `onWake` (`src/hooks/useAstridrVoice.ts:1496`)
so speech capture begins on its own.
Trace evidence to look for, in this order: `wake.worker.wake-detected {score}`
(`src/hooks/useWakeWord.ts:197`), then `wake → conversation open`
(`src/hooks/useAstridrVoice.ts:1483`), then `recognizer.start {"trigger":"wake"}` —
the last one is the browser's **real** `onstart` event, not merely that we called
`start()` (`src/hooks/useAstridrVoice.ts:593-598`), so it is the line that proves the
recognizer actually began rather than that we asked it to.
Known failure shape to watch for rather than infer: `wake.ignored {"state":"…"}`
(`src/hooks/useAstridrVoice.ts:1479`) means a wake WAS detected but dropped because
`voiceState` was not `idle` — a previous turn never closed. That is a different defect
from "the wake word was not heard at all", and only the trace distinguishes them.
result: **PASS** — live session 2026-08-05 16:17-16:20. Wake fired cleanly on three
separate occasions with no click: `wake.worker.wake-detected {score:0.564}` at 16:17:02.613,
`{score:0.639}` at 16:17:46.933, `{score:0.332}` at 16:20:02.774. Each was followed within
1 ms by `wake → conversation open` and `recognizer.start {trigger:"wake"}` — the latter being
the browser's real `onstart`, so the recognizer provably began rather than merely being asked
to. Larry confirmed the header flipped `WAKE-WORD ARMED` → `IN CONVERSATION`. The 16:17:46
wake went straight on to transcribe a full spoken question.
notes: No `wake.ignored` occurred at any point. Detection scores ranged 0.332-0.639, i.e. the
lowest successful detection was ~half the highest — worth watching, but every one of the three
crossed threshold and armed a turn. Chrome's ~8s recognizer lifetime cap fired repeatedly
(`recognizer.end {lifetimeMs:8036-8040}` → `recognizer.restart` → `recognizer.start
{trigger:"keepalive-restart"}`); this is the keepalive working as designed, not a fault.

### 6. Barge-in mid-reply ("stop") — DEBT-04 leg 2 of 3
expected: While `voiceState` is `speaking` and her TTS audio is actually playing, saying
"stop" must **stop the audio**. The assertion is on the media element itself, not on any
flag: `useTtsPlayback`'s `ttsTrace` records `currentTime` and `duration` off the live
`HTMLAudioElement` on every playback event (`src/hooks/useTtsPlayback.ts:53-83`), so a
genuine barge-in appears as `tts.audio.stop.called {"reason":"barge-in"}` followed by
`tts.audio.teardown {"cause":"stop:barge-in", …}` whose **`currentTime` is far below
`duration`** (event names are composed as `tts.audio.${ev}`,
`src/hooks/useTtsPlayback.ts:58`). A reply that ran to completion instead ends with
`tts.audio.ended` at `currentTime ≈ duration`. Both shapes are recorded; only the first
is a pass.
**A `barged` flag is explicitly NOT accepted as evidence here.** `tts.end
{"barged":…}` (`src/hooks/useAstridrVoice.ts:1411`) reports only whether OUR
`bargeInFiredRef` latch fired — `useTtsPlayback.ts:36-46` records that five of the six
`chat.interrupt()` call sites stop audio **without** setting that latch, and that
`teardownAudioEl()` nulls `onended` before `pause()`, making a stop indistinguishable
from a natural end downstream. Reading `barged:false` as "she finished" is the exact
misreading that cost four failed debugging rounds on 2026-07-30. `barged:true` with no
corresponding `currentTime`/`duration` gap is likewise unproven, not a pass.
Also expected on the way in: `interim.barge-in` or `final.barge-in`
(`src/hooks/useAstridrVoice.ts:926,1057`) → `barge-in.fired`
(`src/hooks/useAstridrVoice.ts:851`), `voiceState` `speaking → transcribing`
(`BARGE_IN`, `src/components/voice/voiceState.ts:13`), and the `— interrupted —` flash
in the live-transcript strip (`src/pages/Chat.tsx:793-796`).
And expected NOT to happen — the 2026-07-30 self-answering loop: the interrupted reply
must **not** be dispatched back as a new user message. Her own words must never appear
as a user bubble in the transcript, and she must not answer herself. The guards that
should show in the trace are `final.barge-swallowed`
(`src/hooks/useAstridrVoice.ts:1089`) or `final.ignored-while-speaking`
(`src/hooks/useAstridrVoice.ts:1061`); the observable to record is what appeared in the
transcript, with the trace as corroboration.
result: **PASS** — and passed on the media element, not on a flag. Saying "stop" 0.6 s into a
10.82 s reply produced, all within the same millisecond at 16:18:06.148:
`onresult {isFinal:false, text:" stop", state:"speaking"}` → `interim.barge-in` →
`barge-in.fired` → `tts.audio.stop.called {reason:"interrupt:barge-in", playbackId:1,
currentTime:4.47, duration:10.82, paused:false, ended:false}` →
`tts.audio.teardown {cause:"stop:interrupt:barge-in", currentTime:4.47, duration:10.82}`.
**Playback was cut at 4.47 s of 10.82 s — 41 % through** — which is precisely the assertion
`useTtsPlayback.ts:63-64` names as decisive ("currentTime far below duration on a teardown
means playback was CUT, whatever the cause claims"). Compare the un-interrupted replies in the
same session, which end `tts.audio.ended` at currentTime == duration (6.04/6.04, 2.18/2.18,
5.9/5.9). The self-answering loop did NOT occur: `final.barge-swallowed {text:"Sta."}` at
16:18:06.561 — the garbled final was swallowed, never dispatched as a user message.
notes: Two things worth recording. (1) The barge-in fired on the INTERIM (" stop"), not the
final — the final came back garbled as "Sta." 412 ms later, so a final-only implementation
would have missed this barge-in entirely. That is the 2026-07-20 fix demonstrably earning its
keep. (2) `tts.end {barged:true}` was also emitted, but is NOT what this result rests on, per
the 2026-07-30 lesson; the `currentTime`/`duration` pair is the evidence and the flag is
merely consistent with it.

### 7. Re-arm after "goodbye" — DEBT-04 leg 3 of 3
expected: "goodbye" is an end-phrase, not a barge-in (`END_PHRASES`,
`src/components/voice/voiceState.ts:86` — `"stop"` is deliberately excluded from that
list). It is **sent**, not silently swallowed, so she closes warmly: trace shows
`final.end-phrase → graceful close` (`src/hooks/useAstridrVoice.ts:1212`). When her
closing reply's TTS ends, `onTurnEnd` sees the pending close and re-arms rather than
opening a follow-up window: `close.graceful → re-arm after her goodbye`
(`src/hooks/useAstridrVoice.ts:759`) → `conversation.teardown {"mode":"stop"}`
(`src/hooks/useAstridrVoice.ts:687`) → `voiceState` back to `idle`.
On screen the header must return from `IN CONVERSATION` to `WAKE-WORD ARMED`
(`src/pages/Chat.tsx:900-904`) and the pill from `Ástríðr speaking` back to
`Say “Hey Ástríðr”` (`src/pages/Chat.tsx:625,635`), with `useWakeWord`'s `status`
still `ready` — teardown must not have released the wake engine.
Then the cycle must be **repeatable, not one-shot**: a SECOND "Hey Ástríðr" must produce
a second `wake → conversation open` plus a second `recognizer.start {"trigger":"wake"}`
and reopen a fresh turn. A second wake that logs `wake.ignored`
(`src/hooks/useAstridrVoice.ts:1479`) instead means the first turn never returned to
`idle` — that is the known intermittent-re-arm suspect and is a FAIL for this leg even
if the first turn looked perfect.
result: **PASS** — exercised with "Thank you.", which `END_PHRASES`
(`src/components/voice/voiceState.ts:86`) treats identically to "goodbye"; "stop" is
deliberately excluded from that list and correctly behaved as a barge-in in test 6 rather than
a close. At 16:19:40.740 `final.end-phrase → graceful close {text:"Thank you."}` +
`flushSend {closing:true}` — sent, not swallowed, so she closed warmly. Her closing reply ran
to completion (`tts.audio.ended {playbackId:3, currentTime:2.18, duration:2.18}`), then at
16:19:46.952 `close.graceful → re-arm after her goodbye` → `conversation.teardown {mode:"stop"}`
→ `duplex.session_end {seconds:33.928}`. **The cycle then proved repeatable:** a second
"Hey Ástríðr" at 16:20:02.774 produced `wake → conversation open` + `recognizer.start
{trigger:"wake"}`, and that fresh turn carried a complete new question ("Are there any events
on my calendar, personal calendar, today?") through transcription, `flushSend`, and a spoken
answer ending `tts.audio.ended {currentTime:5.9, duration:5.9}`. No `wake.ignored` at any point.
notes: Her own TTS echo was rejected twice on the way through, so she never answered herself:
`interim.ignored-while-speaking {" you're"/" you're welcome"}` during playback, then
`final.noise-rejected {" you're welcome", confidence:0.748}` at 16:19:47.053 once state had
returned to `idle`. One cosmetic deviation from the expected line: the 16:20:02 wake logged
`recognizer.start {trigger:"wake", state:"listening"}` rather than `state:"idle"` — the prior
turn had fully torn down 16 s earlier, the wake and the fresh turn both worked, and nothing
downstream misbehaved, so this is recorded as an observation, not a defect. A separate
`followup.expire → re-arm` at 16:20:53.833 closed the final turn cleanly.

### 8. Live Forge daemon drag round-trip (Phase-100 Test 1 re-verification, D-08)
expected: **A pass is the expected outcome here, and this is a re-verification, not a
first run.** `100-HUMAN-UAT.md` Test 1 already records this round-trip as
`PASSED (operator-verified live 2026-07-25)` with concrete detail (`agent-browser`
archived onto Cold Storage, the dormant row restored onto Global, and an honest daemon
refusal on `test-driven-development` reading "…no longer exists at its source location …
Nothing changed on disk" with no false success). D-08 asks for it again because the
whole phase-106 close-out rests on the drag path still working against a **real** daemon,
and it is cheap once the stack is up. STATE.md's note calling this "outstanding" is dated
2026-07-24, one day BEFORE that verification, and Task 3 corrects it.

Subject: `uat106-drag`, whose only origin after the rescan should be `claude-code`.
Every drop goes onto a **Scope rail** entry (`data-testid="scope-rail-entry"`,
`data-scope="global" | "project" | "cold"`, `ScopeRail.tsx:70-71`) and is dispatched by
`handleDropOnScope` (`src/pages/Skills.tsx:310-368`) through the shared
`resolveScopeDrop` matrix (`src/lib/skills.ts:97-145`). The five legs, in the order
`resolveScopeDrop` actually permits (see `### Session C deviations`, Deviation 2 — the
plan's own order would have hit a rejection on leg 2):

- **Leg A — archive (Global → Cold Storage).** Active-global + `targetScope "cold"` hits
  `src/lib/skills.ts:131` → `{kind:"enqueue", action:"archive", sourceOrigin:"claude-code",
  destination:"cold"}`. Expected: the pending paint appears **immediately and before any
  await** — `beginPending` runs at `Skills.tsx:349-353` ahead of the `enqueueLifecycle`
  call at 354, and renders as the pulsing left-edge bar
  (`data-testid="pending-indicator"`, `SkillRow.tsx:107-112`) plus `opacity-70` on the row
  (`SkillRow.tsx:105`). It then clears **silently** when the daemon acks `done`
  (`usePendingLifecycleMoves.ts:88-90` — success is deliberately quiet, so the absence of
  a toast here is correct, not a missing signal). On disk:
  `C:\Users\mandr\.claude\skills\uat106-drag\` must be GONE and the directory must have
  reappeared under `C:\Users\mandr\.claude\skills-available\uat106-drag\`.
- **Leg B — restore (Cold Storage → Global).** The row is now dormant-only and NOT
  shadowed, so `src/lib/skills.ts:119-121` gives
  `{kind:"enqueue", action:"restore", sourceOrigin:"claude-code:available",
  destination:"global"}`. Expected: pending paint, reconcile to `done`, and the directory
  back at `C:\Users\mandr\.claude\skills\uat106-drag\`, gone from `skills-available`.
- **Leg C — move to a project (Global → Project).** Active-global + `targetScope
  "project"` returns `{kind:"dialog"}` (`src/lib/skills.ts:130`) — deliberately **no**
  enqueue at drop time. Expected: `MoveToProjectDialog` opens titled
  `Move "uat106-drag" to Project` (`MoveToProjectDialog.tsx:113`) with a Workspace
  `Select`, a `Cancel Move` button and a `Move skill` button that stays disabled until a
  workspace is chosen (`confirmDisabled`, `MoveToProjectDialog.tsx:77`). Choosing
  `drive-sync-test` and confirming enqueues the move. On disk the directory must appear at
  `G:\My Drive\forge-workspaces\drive-sync-test\.claude\skills\uat106-drag\` and be gone
  from `C:\Users\mandr\.claude\skills\`.
- **Leg D — move back (Project → Global).** Active-project + `targetScope "global"` hits
  `src/lib/skills.ts:135-137` → `{kind:"enqueue", action:"move",
  sourceOrigin:"claude-code:project:<key>", destination:"global"}`. Expected: back at
  `C:\Users\mandr\.claude\skills\uat106-drag\`, gone from the workspace.
- **Leg E — the honest-failure leg, which is the point of the whole test.** With the
  daemon stopped, one more drag onto Cold Storage. The command is inserted `status:
  "queued"` with `expiresAt = now + FORGE_COMMAND_TTL_MS` (5 min, `convex/forge.ts:25`);
  the `"expire-stale-forge-commands"` cron runs every minute (`convex/crons.ts:112-116`)
  and `shouldExpireCommand` flips only still-`queued` rows (`convex/forge.ts:355-357`).
  So expected, after **5-6 minutes**: the pending overlay CLEARS and an error toast reads
  exactly `Expired — no daemon claimed this command.` — the `EXPIRED_COPY` constant at
  `src/hooks/usePendingLifecycleMoves.ts:49`, fired from the `expired` branch at
  `:95-99`. On disk, `C:\Users\mandr\.claude\skills\uat106-drag\` must still be there,
  untouched. What must NOT happen, and is the actual assertion: the row must not settle
  into a quiet, un-painted state that looks like success. A LAYER-1 refusal is the other
  acceptable honest shape — it throws before any row is inserted, is caught at
  `Skills.tsx:362-367`, clears the pending entry and toasts
  `lifecycleRefusalMessage(err)` (`src/hooks/useLifecycle.ts:85-100`) — instant rather
  than delayed. Either is a pass; a silent settle is a fail.

Known false-signal to watch for rather than infer: the Forge **tray** (PID 33516) is a
supervisor for the **daemon** (PID 33616). If only the daemon is killed and the tray
respawns it, the queued command gets claimed and leg E silently turns into a success,
which would be recorded as a pass for a test that never ran. Larry must quit Forge from
the tray, and `curl http://127.0.0.1:57328/health` must fail, before the leg-E drag.
result:
verdict:

### 9. CR-02 shadowed-row Cold Storage no-op (Phase-100 Test 2 — the item genuinely left open)
expected: **This is the one thing Phase 100 could not do.** Its Test 2 is recorded
`UNIT-VERIFIED + live no-op mechanism observed` and `Accepted`, with the reason stated
outright: "The shadowed-specific case was NOT reproduced live because the live catalog
contains 0 shadowed-merged skills (every cold skill is dormant-only) — fabricating one was
deferred by operator." Only the dormant-only case was exercised live (dragging dormant
`geo-schema` onto Cold Storage). That zero-shadowed condition was re-measured today and
still holds (see `### Session C environment` — 0 of 488 names carry both a dormant and a
non-dormant origin), so `uat106-shadow` is the first shadowed-merged row this project has
ever had. Plan 106-06 proved such a fixture can be staged reliably, which is why the
deferral no longer applies.

Precondition (gating): `uat106-shadow` must register as **one** row carrying **both**
`claude-code` and `claude-code:available`, satisfying `isShadowing`
(`src/lib/skills.ts:26-29`). It should then be visible in the Cold Storage view, because
that view filters on `hasDormantCopy` rather than `isDormant`
(`src/pages/Skills.tsx:193-196`, and `src/lib/skills.ts:37-39`) — precisely so a shadowed
skill's cold copy stays reachable (98-REVIEW WR-04). If it does not render as shadowed,
this test is `blocked` and no dormant-only row is substituted.

The gesture: enter Cold Storage via the left-nav button
(`data-testid="cold-storage-nav-toggle"`, `src/pages/Skills.tsx:532-550` — the one with
the dormant count badge, BELOW the Scope section), then drag the `uat106-shadow` row from
that list and drop it back onto the **Scope rail's** `Cold Storage` entry
(`data-scope="cold"`).

Expected: **no mutation of any kind.** `ColdStorageView` renders its rows with
`lane="cold"` (`ColdStorageView.tsx:59`), `SkillRow.onDragStart` carries that lane into
the context via `setDraggingSkill(skill, lane ?? "active")`
(`SkillRow.tsx:95-101`), and `handleDropOnScope` threads it into `resolveScopeDrop` as
`draggingLane` (`src/pages/Skills.tsx:321-325`). With `lane === "cold"`,
`resolveLifecycleActions` forces `dormant = true` (`src/lib/skills.ts:59`) even though an
active copy exists, so the drop lands on `src/lib/skills.ts:111-114` and returns
`{kind:"noop"}` — reached BEFORE the `shadowed` reject at `:117` and, critically, before
the active-global archive branch at `:128-131`. The observable is the neutral (not error)
toast at `src/pages/Skills.tsx:337-339`, whose template is
`` `"${skill.displayName}" is already in ${scopeLabel} — nothing to move.` `` with
`scopeLabel` resolving to `Cold Storage` (`src/pages/Skills.tsx:327-328`) — i.e. on screen
it should read **`"uat106-shadow" is already in Cold Storage — nothing to move.`** (or the
fixture's display name in place of `uat106-shadow`). No pending indicator should appear at
all, because `beginPending` is never reached on a `noop`.

**The part that actually matters, and the only reason this test exists:** the ACTIVE copy
must be untouched. Without the lane threading, `draggingLane` would default to `"active"`,
`dormant` would be false, and the drop would fall through to `src/lib/skills.ts:131` and
enqueue a real `archive` of `C:\Users\mandr\.claude\skills\uat106-shadow\` — silently
destroying a live skill from a gesture that means "put this back where it already is".
That is CR-02. So the assertion is on the filesystem as much as the screen:
`C:\Users\mandr\.claude\skills\uat106-shadow\SKILL.md` must still exist afterwards, and
the skill must still show as active in the UI.

Worth knowing so a second safety net is not mistaken for the thing under test: even if the
client-side no-op failed, `enqueueLifecycle`'s LAYER-1 preflight would refuse the archive
with `lifecycle-refused:collision:a dormant copy already exists in cold storage`
(`convex/forge.ts:653-657`), surfacing as `A dormant copy of "uat106-shadow" already
exists in Cold Storage. Rename or delete it first, then archive again.`
(`convex/forge.ts:264-266`). **If that collision toast appears, this test FAILS** — it
would mean the client-side CR-02 no-op did not hold and only the server guard saved the
skill. A pass looks like the quiet "already in Cold Storage — nothing to move." toast and
nothing else.
result:
verdict:

## Voice trace

Verbatim console lifecycle output captured during the Task 2 live session, pasted (not
summarised) via the **COPY TRACE** chip in the /chat header. Event ordering is the
evidence and must be left intact; any incidental personal content is redacted as
`<redacted>` in place (T-106-24).

Captured 2026-08-05, one continuous session 16:16:12 → 16:20:53. No personal content
appeared; nothing required redaction. Non-`[voice]` console lines (Vite HMR, wakeWordWorker
model-load banners) are omitted as they are not part of the lifecycle trace.

**Capture-method finding, recorded because it nearly cost a false verdict:** the raw browser
console does **not** show `tts.audio.*` events. `ttsTrace` (`src/hooks/useTtsPlayback.ts:53-82`)
pushes to the shared `window.__astridrVoiceTrace` ring buffer but deliberately never calls
`console.log`, unlike `trace()` (`src/hooks/useAstridrVoice.ts:138-146`) which does both. A
console-copied trace therefore omits exactly the media-element evidence test 6 depends on, and
an intermediate reading of one such paste wrongly concluded there was an instrumentation gap in
duplex mode. There is none. **COPY TRACE is authoritative; a console paste is not.** Future
sessions should use the chip.

```
16:17:02.613 wake.worker.wake-detected {"score":0.563963770866394}
16:17:02.613 wake → conversation open
16:17:02.614 recognizer.start {"trigger":"wake","state":"idle"}
16:17:03.148 duplex.ears_switch {"active":"duplex"}
16:17:32.614 silence.timeout → re-arm
16:17:32.614 conversation.teardown {"mode":"stop","state":"listening"}

16:17:46.933 wake.worker.wake-detected {"score":0.6390392184257507}
16:17:46.933 wake → conversation open
16:17:46.934 recognizer.start {"trigger":"wake","state":"idle"}
16:17:51.688 final {"text":"A two-sentence summary of what you can do.","state":"transcribing"}
16:17:51.688 final.accepted {"text":"A two-sentence summary of what you can do.","warm":false,"debounceMs":2000}
16:17:53.690 flushSend {"message":"A two-sentence summary of what you can do.","closing":false}
16:18:01.597 run.tts.received {"sessionMatches":true,"eventSession":"9ca4490e-…","activeSession":"9ca4490e-…","willPlay":true}
16:18:01.606 tts.audio.play.request {"playbackId":1,"mode":"analysed","currentTime":0,"duration":null}
16:18:01.639 tts.start {"state":"processing"}
16:18:05.580 duplex.speech_started {"state":"speaking"}
16:18:06.148 onresult {"isFinal":false,"text":" stop","state":"speaking"}
16:18:06.148 interim.barge-in {"text":" stop"}
16:18:06.148 barge-in.fired
16:18:06.148 tts.audio.stop.called {"reason":"interrupt:barge-in","playbackId":1,"currentTime":4.47,"duration":10.82,"paused":false,"ended":false}
16:18:06.148 tts.audio.teardown {"cause":"stop:interrupt:barge-in","playbackId":1,"currentTime":4.47,"duration":10.82,"paused":false,"ended":false}
16:18:06.183 tts.end {"state":"transcribing","barged":true}
16:18:06.560 final {"text":"Sta.","state":"transcribing"}
16:18:06.561 final.echo-tail-checked-no-match {"text":"Sta."}
16:18:06.561 final.barge-swallowed {"text":"Sta."}
16:18:36.641 silence.timeout → re-arm

16:19:12.453 wake.worker.wake-detected {"score":0.5162388682365417}
16:19:12.454 wake → conversation open
16:19:20.756 final {"text":"What's the weather in Cumming, Georgia?","state":"transcribing"}
16:19:30.323 tts.audio.play.request {"playbackId":2,"mode":"analysed"}
16:19:36.434 tts.audio.ended {"playbackId":2,"currentTime":6.04,"duration":6.04,"ended":true}
16:19:36.434 tts.audio.teardown {"cause":"ended","playbackId":2,"currentTime":6.04,"duration":6.04}
16:19:36.488 tts.end {"state":"speaking","barged":false}
16:19:36.488 followup.open {"ms":30000,"askedQuestion":false}
16:19:40.740 final {"text":"Thank you.","state":"transcribing"}
16:19:40.740 final.end-phrase → graceful close {"text":"Thank you."}
16:19:40.740 flushSend {"message":"Thank you.","closing":true}
16:19:44.651 tts.audio.play.request {"playbackId":3,"mode":"analysed"}
16:19:45.552 interim.ignored-while-speaking {"text":" you're"}
16:19:45.740 interim.ignored-while-speaking {"text":" you're welcome"}
16:19:46.914 tts.audio.ended {"playbackId":3,"currentTime":2.18,"duration":2.18,"ended":true}
16:19:46.952 tts.end {"state":"speaking","barged":false}
16:19:46.952 close.graceful → re-arm after her goodbye
16:19:46.953 conversation.teardown {"mode":"stop","state":"speaking"}
16:19:46.954 duplex.session_end {"seconds":33.928}
16:19:47.053 final.noise-rejected {"text":" you're welcome","warm":false,"followUpOpen":false}

16:20:02.774 wake.worker.wake-detected {"score":0.3316728174686432}
16:20:02.774 wake → conversation open
16:20:02.816 recognizer.start {"trigger":"wake","state":"listening"}
16:20:08.456 final {"text":"Are there any events on my calendar, personal calendar, today?","state":"transcribing"}
16:20:10.457 flushSend {"message":"Are there any events on my calendar, personal calendar, today?","closing":false}
16:20:17.794 tts.audio.play.request {"playbackId":4,"mode":"analysed"}
16:20:21.235 interim.ignored-while-speaking {"text":" Larry"}
16:20:23.794 tts.audio.ended {"playbackId":4,"currentTime":5.9,"duration":5.9,"ended":true}
16:20:23.833 tts.end {"state":"speaking","barged":false}
16:20:53.833 followup.expire → re-arm
16:20:53.835 duplex.session_end {"seconds":50.576}
```

### Unexplained earlier anomaly (recorded, not reproducing)

An earlier attempt at 15:57 produced a COPY TRACE with a 13-second hole: `wake.status
{"to":"ready"}` at 15:57:41.847 followed directly by `run.tts.received` at 15:57:54.779 with
`{"sessionMatches":false,"activeSession":null}` and `tts.start {"state":"idle"}`, containing
**zero** wake, conversation-open or recognizer events — yet Larry reported the header had
flipped to `IN CONVERSATION` and that he had asked by voice. The audio then ran to completion
(`currentTime 9.2 == duration 9.2`) and "stop" did nothing, consistent with no recognizer
running. A multi-tab explanation was hypothesised (a second tab holding no session receiving
the broadcast TTS — the `188-09-14` false-alarm shape) and **refuted**: Larry confirmed one tab
only. The 500-entry ring buffer was ruled out as a cause (14 entries used, no eviction possible).
It did not reproduce across the full 16:16-16:20 session, in which every wake traced correctly.
Recorded as an open anomaly rather than chased, since all three legs subsequently passed and
guessing at this subsystem has a documented cost here.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

Tests 1-4 (plan 106-06, session A) are closed. **Tests 5-7 (plan 106-07, session B —
wake / barge-in / re-arm) are now closed too: all three PASS**, run live 2026-08-05
16:16-16:20 in one continuous session, which is the first time DEBT-04's full sequence has
been exercised end to end in a single pass (the 2026-07-27 check covered only a basic
speech→tool→speech round trip).

Barge-in was judged on the media element itself — `tts.audio.teardown
{cause:"stop:interrupt:barge-in", currentTime:4.47, duration:10.82}`, i.e. playback cut 41 %
through — and **not** on the `barged` flag, per the 2026-07-30 lesson. Un-interrupted replies
in the same session terminate at `currentTime == duration` (6.04/6.04, 2.18/2.18, 5.9/5.9),
giving a within-session control for the interrupted case. The self-answering loop did not
occur: `final.barge-swallowed` caught the interrupted text, and her own TTS echo was rejected
twice more via `interim.ignored-while-speaking` / `final.noise-rejected`.

Zero source files were modified by plan 106-07 — `git diff --quiet -- src/hooks
src/pages/Chat.tsx` passes. One open anomaly from an earlier 15:57 attempt is recorded under
`## Voice trace`; it did not reproduce and is explicitly NOT counted as an issue above,
because every leg of the recorded session passed.

All four Phase-98-pending sub-cases are closed. Test 3 passed on behavior but carries a
documented wording discrepancy against this plan's own acceptance-criteria phrasing (see its
`notes:`) — pre-existing stub, not a regression, no code fix applied. Test 4 re-verifies the
98-05 stale-project-origin fix holds against a real live rescan; no new regression, so Task 3's
"fix a genuine regression" branch is a documented no-op.

## Cleanup

**A. Fixture removal (unconditional, per plan Task 3 §A).** All five staged directories were
removed from disk via `rm -rf`, targeting exactly the paths recorded in `## Environment` above
— no other path was touched:

```
rm -rf "C:\Users\mandr\.claude\skills\uat106-active-single"
rm -rf "C:\Users\mandr\.claude\skills\uat106-lastout"          # moved here by Test 4's live move
rm -rf "C:\Users\mandr\.claude\skills\uat106-multiscope"
rm -rf "C:\Users\mandr\.claude\skills-available\uat106-dormant-plain"
rm -rf "G:\My Drive\forge-workspaces\drive-sync-test\.claude\skills\uat106-multiscope"
```

Post-removal disk check (`ls` on each of the three parent directories, grep for `uat106`):
zero matches in `.claude/skills`, zero in `.claude/skills-available`, zero in
`drive-sync-test/.claude/skills`. No `uat106-*` directory remains anywhere on disk.

**B. Registry reconciliation.** Deleting the directories does not by itself prune the
registry — the daemon only re-syncs after a real lifecycle command (confirmed from its own
log line: `[forge] skill rescan: enabled — auto-sync inventory to
http://127.0.0.1:3211/scan after each install`). Immediately after the `rm -rf` step, a query
confirmed the expected transient state (10 stale `uat106-*` rows still present, pending
rescan) — recorded here as evidence the pre-cleanup baseline was captured, not skipped.
Larry then performed one more real archive→restore round-trip on `enhance-prompt` through the
Clerk-signed-in Skills page UI (the same safe, attributable mechanism used to stage the
fixtures in Task 1 — CLI `--identity` impersonation was deliberately not used here either, for
the same reason recorded in Task 1's Deviation note). This triggered the daemon rescan.

**C. Post-cleanup verification query:**

```
npx convex run registry:listSkills '{}' | grep -c "uat106"
=> 0
```

Confirmed independently by the executor (not just relayed) immediately before writing this
section: zero `uat106-*` rows remain in the live registry, and zero `uat106-*` directories
remain on disk. Matches Phase 98's own "zero residue" bar exactly.

**D. Branch on Test 4's verdict (plan Task 3 §B).** Test 4 PASSED — the expected outcome — so
per the plan, no change was made to `convex/skillSync.ts`, `convex/__tests__/skillSync.test.ts`,
or `src/components/skills/SkillLifecycleMenu.tsx`. D-07's code-fix branch is a documented
no-op: the 98-05 fix is present in the current source and held under this fresh live
re-repro (before/after origin state recorded in Test 4's `result:` above). Proof no source
was touched:

```
git status --porcelain convex src
=> (empty)
```

No bulk/mass delete or patch was issued against the live self-hosted Convex instance at any
point in this plan — every registry change was reconciled through the daemon's normal
per-command rescan, per `CLAUDE.md` § "Self-Hosted Convex — Operational Rules".
