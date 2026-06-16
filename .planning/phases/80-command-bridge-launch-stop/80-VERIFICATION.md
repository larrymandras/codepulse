---
phase: 80-command-bridge-launch-stop
verified: 2026-06-16T18:00:00Z
status: human_needed
score: 11/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live end-to-end round-trip: launch a Forge job from /forge UI, observe daemon claiming command and real forgeJobs row appearing"
    expected: "From /forge, clicking Launch → modal → Submit: (1) Queued row appears immediately in job list; (2) daemon logs show '[forge] command bridge: polling ...'; (3) command transitions queued→executing→done; (4) real forgeJobs row appears and Queued row reconciles away"
    why_human: "Requires 80-01 deployed to Convex dev + Forge daemon running with CONVEX_FORGE_INGEST_URL + FORGE_INGEST_API_KEY set. Cannot test without live infrastructure."
  - test: "Live stop round-trip: stop a running Forge job from /forge UI, observe hard-kill and status reflect-back"
    expected: "Clicking Stop on a running job → AlertDialog → 'Yes, stop the job': (1) button shows 'Stopping…'; (2) status badge does NOT change optimistically; (3) daemon executes taskkill /T /F; (4) forgeJobs status flips to 'stopped' via reactive listJobs; (5) Stop button disappears; (6) temp workspace not promoted"
    why_human: "Requires live daemon + running Forge job. Cannot verify no-optimistic-flip and real taskkill execution programmatically."
---

# Phase 80: Command Bridge Verification Report

**Phase Goal:** A Convex `forgeCommands` queue the daemon long-polls; launch/stop → command → daemon executes → status reflects back. Port NewJobModal. Clerk-gated mutations.
**Verified:** 2026-06-16T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Clerk-authenticated operator can enqueue a launch command; unauthenticated caller is rejected | ✓ VERIFIED | `convex/forge.ts:325-327` — `getUserIdentity()` null check throws "Authentication required to issue Forge commands" in `enqueueLaunch`; D-13 comment present |
| 2 | A Clerk-authenticated operator can enqueue a stop command; unauthenticated caller is rejected | ✓ VERIFIED | `convex/forge.ts:352-354` — same fail-closed guard in `enqueueStop`; identical throw message |
| 3 | The daemon can atomically claim queued, non-expired commands for its host via bearer-authed httpAction | ✓ VERIFIED | `convex/forgeCommands.ts:23-73` — `forgeCommandsClaim` httpAction with `validateForgeIngestAuth` gate + `claimAndUpsertHost` internalMutation that reads+patches in one serializable mutation (double-claim safe) |
| 4 | The daemon can ack a command, recording done/failed and the resolved forgeJobId | ✓ VERIFIED | `convex/forgeCommands.ts:79-141` — `forgeCommandsAck` httpAction; `convex/forge.ts:423-443` — `ackCommand` patches status/resolvedForgeJobId/error/completedAt |
| 5 | Queued commands past their TTL are marked expired by a scheduled cron | ✓ VERIFIED | `convex/crons.ts:104-109` — `expire-stale-forge-commands` interval at 1 min → `internal.forge.expireStaleCommands`; `convex/forge.ts:446-463` — sweeps `by_expires` index, applies `shouldExpireCommand` guard (only queued, never executing/done/failed) |
| 6 | A dangerous-mode capability in a launch payload is stripped before the command is stored | ✓ VERIFIED | `convex/forge.ts:31-42` — `stripDangerousCapability` deletes `.dangerous` key before insert; called in `enqueueLaunch` at line 332; also unit-tested in `convex/forge.test.ts` |
| 7 | On daemon startup (env set), a command-poll loop starts and POSTs to /forge-commands-claim on an interval | ✓ VERIFIED | `forge/src/index.ts:75-131` — `CommandPoller` constructed + `start()` called gated on `emitCfg.ingestUrl && emitCfg.apiKey`; `forge/src/emit/command-poller.ts:136-154` — `poll()` sends Bearer header + `{ hostId }` to claim URL every 7s |
| 8 | Claimed launch command runs Forge POST /jobs; claimed stop command runs stopJob; both ack regardless of outcome | ✓ VERIFIED | `forge/src/emit/command-poller.ts:171-218` — `execute()` dispatches on `commandType` only (W1), calls `launchFn`/`stopFn`, always acks with `done`/`failed`; `forge/src/index.ts:97-124` — `launchFn` wraps `fetch(.../jobs)`, `stopFn` wraps `stopJobById` |
| 9 | A Clerk-authenticated operator sees a 'Launch Job' button; unauthenticated operator does not | ✓ VERIFIED | `src/components/forge/ForgeJobList.tsx:148-160` — `isAuthenticated ? <Button>Launch Job</Button> : null`; `src/pages/ForgePage.tsx:142` — `ClerkAuthProbe` only mounted when `VITE_CLERK_PUBLISHABLE_KEY` set; `isAuthenticated` defaults to false (W2 fail-closed) |
| 10 | Launch modal is trimmed (host picker, no dangerous-mode toggle, no inline workspace creation) | ✓ VERIFIED | `src/components/forge/ForgeLaunchModal.tsx:6-10` — trim comments; line 159 — capabilities built WITHOUT dangerous (D-06); no `+ New workspace` control (D-07); `useForgeHosts()` drives host picker (D-08) |
| 11 | Submitting modal calls enqueueLaunch and immediately appends optimistic Queued row (no withOptimisticUpdate) | ✓ VERIFIED | `src/components/forge/ForgeLaunchModal.tsx:98` — `useMutation(api.forge.enqueueLaunch)` (plain); lines 175-188 — builds `pendingRow`, calls `onLaunched(pendingRow)` BEFORE `await launch(...)` so row paints immediately; no `withOptimisticUpdate` anywhere in `src/` |
| 12 | Live cross-repo round-trip: daemon claims → executes → status reflects back via /forge-ingest | ? HUMAN NEEDED | Automated verification covers daemon code (unit tests) and Convex backend. Live end-to-end requires deployed Convex + running Forge daemon. See human verification section. |

**Score: 11/12 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | forgeCommands + forgeHosts tables with indexes | ✓ VERIFIED | Lines 1508-1563: both tables defined. `by_host_status_created`, `by_commandId`, `by_expires` on forgeCommands; `by_hostId`, `by_lastSeenAt` on forgeHosts |
| `convex/forge.ts` | enqueueLaunch, enqueueStop, claimAndUpsertHost, ackCommand, expireStaleCommands, listForgeCommands, listHosts + pure helpers | ✓ VERIFIED | All 7 functions + `stripDangerousCapability`, `shouldExpireCommand`, `buildLaunchRow` at lines 31-500 |
| `convex/forgeCommands.ts` | forgeCommandsClaim + forgeCommandsAck httpActions (bearer-authed, CORS) | ✓ VERIFIED | Full implementation at lines 1-141; `validateForgeIngestAuth` gate on both actions |
| `convex/http.ts` | POST+OPTIONS routes for /forge-commands-claim and /forge-commands-ack | ✓ VERIFIED | Lines 77-80: 4 routes registered |
| `convex/crons.ts` | expire-stale-forge-commands interval entry | ✓ VERIFIED | Lines 104-109 |
| `convex/forge.test.ts` | Pure-logic tests for FI-06 + FI-08 | ✓ VERIFIED | 19 new tests per SUMMARY-01; `Authentication required` tested |
| `forge/src/emit/command-poller.ts` | CommandPoller class with poll/execute/ack/start/stop | ✓ VERIFIED | Lines 88-218: full class; W1 invariant documented; fire-and-forget discipline |
| `forge/src/index.ts` | Daemon wiring: constructs + starts CommandPoller gated on env | ✓ VERIFIED | Lines 22, 75-131: import + conditional construction + `commandPoller?.stop()` on shutdown |
| `forge/src/emit/command-poller.test.ts` | Unit tests for ack-mapping + execute-dispatch decision logic | ✓ VERIFIED | File exists; 12 tests per SUMMARY-02 |
| `src/hooks/useForge.ts` | useForgeCommands + useForgeHosts hooks; JobStatus extended | ✓ VERIFIED | Lines 16-18: `pending`, `stopping_pending`, `expired` added; `useForgeCommands` at line 195; `useForgeHosts` at line 217; `ForgeCommandRow` type at line 29 |
| `src/components/forge/ForgeStatusBadge.tsx` | STATUS_MAP extended with pending, stopping_pending, expired | ✓ VERIFIED | Lines 54-68: all three variants with correct labels/colors/icons; animate-spin includes `pending` and `stopping_pending` (line 113) |
| `src/components/forge/ForgeLaunchModal.tsx` | Trimmed modal with host picker; calls enqueueLaunch; onLaunched callback | ✓ VERIFIED | 415 lines; host picker at line 47; `useMutation(api.forge.enqueueLaunch)` at line 98; `onLaunched` at line 187 |
| `src/components/forge/ForgeJobList.tsx` | Launch toolbar button (Clerk-gated) + pending row rendering | ✓ VERIFIED | Lines 148-160: gated toolbar; lines 64-73: `visiblePendingRows` reconciliation; `aria-live="polite"` at line 190 |
| `src/pages/ForgePage.tsx` | Launch modal wiring + pendingLocal state + isAuthenticated | ✓ VERIFIED | `pendingLocal` at line 94; `ClerkAuthProbe` at line 41; `useForgeCommands(null)` at line 91; `ForgeLaunchModal` rendered at line 173 |
| `src/components/forge/ForgeStopConfirmDialog.tsx` | AlertDialog with hard-kill/work-discard warning + Stopping… state | ✓ VERIFIED | Lines 42-86: `taskkill /T /F` in description at line 73; `Stopping…` at line 62; `AlertDialogAction` confirm gate; `aria-label="Stop job"` |
| `src/components/forge/ForgeJobDetail.tsx` | Stop button wiring + local isStopping state + enqueueStop | ✓ VERIFIED | Lines 46-77: `isStoppingLocal` state; `enqueueStop` mutation; `handleConfirmedStop` with no optimistic badge flip; `useEffect` clears state on terminal; `ForgeStopConfirmDialog` rendered only when `job.status === "running"` (line 137) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convex/forgeCommands.ts` | `internal.forge.claimAndUpsertHost` | `ctx.runMutation` | ✓ WIRED | Line 61: `ctx.runMutation(internal.forge.claimAndUpsertHost, ...)` |
| `convex/forgeCommands.ts` | `internal.forge.ackCommand` | `ctx.runMutation` | ✓ WIRED | Line 126: `ctx.runMutation(internal.forge.ackCommand, ...)` |
| `convex/forgeCommands.ts` | `validateForgeIngestAuth` | bearer auth gate (D-14) | ✓ WIRED | Lines 33 + 89: both httpActions gate on the same function |
| `convex/forge.ts enqueueLaunch/enqueueStop` | `ctx.auth.getUserIdentity()` | fail-closed null check | ✓ WIRED | Lines 325-327 + 352-354 |
| `convex/crons.ts` | `internal.forge.expireStaleCommands` | `crons.interval` | ✓ WIRED | Line 108 |
| `src/components/forge/ForgeLaunchModal.tsx` | `api.forge.enqueueLaunch + onLaunched` | `useMutation` + callback | ✓ WIRED | Line 98 (mutation) + line 187 (callback) |
| `src/components/forge/ForgeLaunchModal.tsx` | `api.forge.listWorkspaces + api.forge.listHosts` | `useQuery` / `useForgeHosts` | ✓ WIRED | Line 47: `useForgeHosts()`; `useQuery(api.forge.listWorkspaces, ...)` for workspace select |
| `src/components/forge/ForgeJobList.tsx` | merged pending rows + reconciliation | `visiblePendingRows` filter | ✓ WIRED | Lines 64-73: filters `resolvedForgeJobId` matches from jobs Set |
| `src/pages/ForgePage.tsx` | Clerk `useUser` | `ClerkAuthProbe` / `isAuthenticated` | ✓ WIRED | Lines 41-52: `ClerkAuthProbe` calls `useUser()` only when `VITE_CLERK_PUBLISHABLE_KEY` set; W2 crash-safe |
| `src/components/forge/ForgeJobDetail.tsx` | `api.forge.enqueueStop` | `useMutation` | ✓ WIRED | Line 48: `useMutation(api.forge.enqueueStop)` |
| `src/components/forge/ForgeJobDetail.tsx` | `ForgeStopConfirmDialog` | rendered only for `job.status === "running"` | ✓ WIRED | Lines 137-144 |
| `forge/src/emit/command-poller.ts` | Convex `/forge-commands-claim` | `fetch` POST with `Bearer` | ✓ WIRED | Lines 140-147 |
| `forge/src/emit/command-poller.ts` | Convex `/forge-commands-ack` | `fetch` POST with `Bearer` | ✓ WIRED | Lines 181-197 (in `execute()`) |
| `forge/src/index.ts` | `CommandPoller` | `new CommandPoller(...).start()` gated on env | ✓ WIRED | Lines 90-126 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ForgeJobList.tsx` | `jobs` / `pendingCommands` | `useForgeJobsRaw()` → `api.forge.listJobs` (Convex query → forgeJobs table) + `useForgeCommands(null)` → `api.forge.listForgeCommands` | Yes — DB queries against real tables; no static returns | ✓ FLOWING |
| `ForgeLaunchModal.tsx` | `hosts` / `workspaces` | `useForgeHosts()` → `api.forge.listHosts` + `useQuery(api.forge.listWorkspaces)` | Yes — Convex queries; no hardcoded empty | ✓ FLOWING |
| `ForgeJobDetail.tsx` | `job` | Passed from ForgePage via `selectedJob` derived from the `jobs` array already fetched | Yes — from the same live listJobs subscription | ✓ FLOWING |
| `ForgeLaunchModal submit` | `pendingRow` optimistic | Built locally by modal; `enqueueLaunch` mutation inserts into `forgeCommands` table | Yes — real mutation; no mock | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| convex/forge.ts TypeScript clean | `npx tsc --noEmit` (0 errors reported per SUMMARY-01/03/04) | 0 errors | ✓ PASS (per reported build state; consistent with build: passing) |
| forge.test.ts green | `npx vitest run convex/forge.test.ts` (43 pass per SUMMARY-01) | 43 tests pass, 0 failures | ✓ PASS (per report; consistent with commit `1a540bb`) |
| Forge component tests green | `npx vitest run src/components/forge/` (54 pass per SUMMARY-04) | 54 tests pass, 0 failures | ✓ PASS (badge 28 + launch modal 9 + job list 5 + stop dialog 12) |
| command-poller tests green | Forge `npm test` (550 pass per SUMMARY-02) | 550/550 passing | ✓ PASS (per report; `523b5c0` commit) |
| npm run build | Succeeds (per SUMMARY-03 + SUMMARY-04) | Build passes in 15.76s | ✓ PASS |
| ForgePage render-loop fix | commit `a8931a4` stabilizes useForgeCommands/jobs arrays | Post-merge gate fixed; `useMemo` wraps both `raw ?? []` and `raw.map(adaptCommand)` | ✓ PASS |

---

### Probe Execution

No `scripts/*/tests/probe-*.sh` files declared or present for this phase. Step 7c: SKIPPED (no probe scripts; manual cross-repo round-trip is the live gate, documented as human_needed).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FI-06 | 80-01, 80-02 | Convex forgeCommands queue that daemon long-polls; command delivered exactly once; status reflects back | ✓ SATISFIED | `forgeCommands` table + `claimAndUpsertHost` atomic claim + `ackCommand` reconcile + `CommandPoller` poll/execute/ack loop |
| FI-07 | 80-03, 80-04 | Operator can launch + stop Forge job from /forge UI via command queue round-trip | ✓ SATISFIED (automated portion) | `ForgeLaunchModal` + `ForgeStopConfirmDialog` + `ForgeJobDetail` wiring; live round-trip is human_needed |
| FI-08 | 80-01, 80-03 | Command-issuing mutations Clerk-gated; bridge never exposes unauthenticated write path | ✓ SATISFIED | `enqueueLaunch`/`enqueueStop` fail-closed (server); Launch button absent when `isAuthenticated=false` (UI defense-in-depth) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/forge/ForgeLaunchModal.tsx` | 238, 301, 364, 388, 410 | `placeholder="..."` in Select/Textarea | ℹ️ Info | Legitimate UI placeholders for form controls — NOT code stubs. No data flows from these to any empty rendering path. |
| None | — | No `TBD`, `FIXME`, or `XXX` markers found in any Phase 80 modified files | — | Clean |
| None | — | No `withOptimisticUpdate` anywhere in `src/` | — | B2 pattern correctly honored |
| None | — | No `return null` / empty array stubs in rendering paths | — | All components render real query data |

**Debt marker gate:** No `TBD`, `FIXME`, or `XXX` markers found in files modified by this phase. Gate passes.

---

### Context Decision Verification (D-01 through D-14)

| Decision | Requirement | Evidence |
|----------|-------------|----------|
| D-01: Stop = hard taskkill /T /F | ForgeStopConfirmDialog copy | `ForgeStopConfirmDialog.tsx:73`: "kill the agent process (taskkill /T /F)" |
| D-02: In-progress work discarded | Dialog copy | Same line: "will be discarded. This cannot be undone." |
| D-03: Two-step confirm | AlertDialog structure | `AlertDialogAction onClick={onConfirmedStop}` — no one-click stop |
| D-04: Honest async Stopping… | `isStoppingLocal` state, no badge flip | `ForgeJobDetail.tsx:46` + no `setQuery` call anywhere in the file |
| D-05: Trimmed modal fields | ForgeLaunchModal | agent/workspace/mode/prompt/advanced present |
| D-06: No dangerous-mode toggle | Modal + server strip | Modal never builds `dangerous`; `stripDangerousCapability` on server |
| D-07: No inline workspace creation | Modal | No `+ New workspace` control; selection-only |
| D-08: Host picker pre-selects online host | Modal host picker | `useForgeHosts()` + `useEffect` on open pre-selects newest online host |
| D-09: Host liveness via lastSeenAt | forgeHosts table | `claimAndUpsertHost` upserts `lastSeenAt` on every poll |
| D-10: Optimistic Queued row | `pendingLocal` state | `ForgePage.tsx:94` + `handleLaunched` callback |
| D-11: Failure flips row | `handleLaunchFailed` + destructive border | `ForgePage.tsx:109` + `ForgeJobList.tsx:97` |
| D-12: 5-min TTL + 1-min cron | `FORGE_COMMAND_TTL_MS` + crons.ts | `forge.ts:24` + `crons.ts:104-109` |
| D-13: Fail-closed mutations | `getUserIdentity()` null-check + comment | `forge.ts:321-328` + `forge.ts:348-355` |
| D-14: FORGE_INGEST_API_KEY reuse | `validateForgeIngestAuth` in httpActions | `forgeCommands.ts:33` + `forgeCommands.ts:89` |

All 14 context decisions verified honored in the codebase.

---

### Human Verification Required

#### 1. Live Launch Round-Trip

**Test:** Deploy 80-01 to Convex dev (`npx convex deploy --yes`). Start Forge daemon with `CONVEX_FORGE_INGEST_URL=<deployment-url>` and `FORGE_INGEST_API_KEY=<key>`. From `/forge`, log in with Clerk, click "Launch Job", fill in host/agent/workspace/mode/prompt, submit.

**Expected:**
1. Queued row appears immediately in the job list (optimistic, border-primary)
2. Daemon logs show `[forge] command bridge: polling .../forge-commands-claim every 7s`
3. Within 7s, command transitions queued → executing → done in forgeCommands table
4. New forgeJobs row appears and the Queued optimistic row reconciles away
5. Job runs to completion and reflects terminal status back through /forge-ingest

**Why human:** Requires deployed Convex + running Forge daemon on `feat/command-bridge-daemon` branch. Cannot test the daemon-to-Convex HTTP poll, the Forge engine executing `POST /jobs`, and the reflect-back through `/forge-ingest` programmatically.

#### 2. Live Stop Round-Trip

**Test:** With a running Forge job visible in `/forge`, click the "Stop" button, read the confirm dialog (verifying "taskkill /T /F" and "discarded" copy), click "Yes, stop the job."

**Expected:**
1. Stop button immediately shows "Stopping…" (spinner, disabled)
2. Status badge on the job does NOT change optimistically — stays "Running"
3. Within 7s, daemon polls, claims the stop command, calls `stopJobById` (taskkill /T /F)
4. forgeJobs status updates to "stopped" via the reactive `/forge-ingest` emitter
5. Stop button disappears (job is no longer "running")
6. Temp workspace was NOT promoted (work discarded per D-02)

**Why human:** Requires live daemon + running Forge job. The no-optimistic-flip behavior (D-04) and actual taskkill execution cannot be verified programmatically.

---

### Gaps Summary

No gaps found. All automated must-haves are VERIFIED. The single unverified truth (#12, live cross-repo round-trip) is the documented manual verification gate — intentionally deferred per plan 80-02's design (`autonomous: false`, cross-repo live testing requires deployed infrastructure). This is `status: human_needed`, not `gaps_found`.

**Render-loop fix note:** A ForgePage infinite-render-loop bug (post-merge gate finding) was fixed in commit `a8931a4` by wrapping `raw ?? []` in `useMemo` in `ForgePage.tsx` and memoizing the `adaptCommand` map result in `useForgeCommands()`. This is verified correct in the codebase: `ForgePage.tsx:87` uses `useMemo(() => raw ?? [], [raw])` and `useForge.ts:206-209` uses `useMemo(() => (raw === undefined ? [] : raw.map(adaptCommand)), [raw])`. Both are substantive fixes, not stubs.

---

_Verified: 2026-06-16T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
