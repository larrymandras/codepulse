---
phase: 80-command-bridge-launch-stop
plan: "04"
subsystem: forge-command-bridge
tags: [forge, command-bridge, ui, stop, alert-dialog, confirm-gate, honest-async, clerk-gating]
dependency_graph:
  requires: [80-01-enqueueStop, 80-03-ForgeStatusBadge-stopping_pending, 80-03-useForge-JobStatus, phase-79-ForgeJobDetail]
  provides:
    - ForgeStopConfirmDialog
    - ForgeJobDetail-stop-wiring
    - local-isStopping-no-optimistic-terminal-flip
    - pending-command-detail-pane
  affects:
    - src/components/forge/ForgeStopConfirmDialog.tsx
    - src/components/forge/ForgeJobDetail.tsx
tech_stack:
  added: []
  patterns:
    - shadcn-alertdialog-confirm-gate (D-03 two-step destructive confirm)
    - honest-async-local-button-state (D-04 — no optimistic forgeJobs flip)
    - terminal-status-effect-clear (useEffect on job.status)
    - clerk-fail-closed-mutation (server-side, enqueueStop)
key_files:
  created:
    - src/components/forge/ForgeStopConfirmDialog.tsx
    - src/components/forge/ForgeStopConfirmDialog.test.tsx
  modified:
    - src/components/forge/ForgeJobDetail.tsx
decisions:
  - "D-01/D-02/D-03: AlertDialog confirm copy surfaces taskkill /T /F hard-kill + work-discard + irreversibility verbatim from UI-SPEC; two-step (trigger → AlertDialog → action), no one-click stop"
  - "D-04 (Pitfall 2): isStoppingLocal lives on the BUTTON only via useState; forgeJobs status badge never flips optimistically — there is NO setQuery terminal patch in the file"
  - "isStoppingLocal stays true on mutation success (does NOT reset) — cleared only by the useEffect when reactive query delivers a non-running status; reset on mutation error + sonner toast"
  - "Stop button rendered ONLY when job.status === 'running' — hidden on every terminal state"
  - "commandId via crypto.randomUUID() (matches 80-03 ForgeLaunchModal client-id convention)"
  - "Pending/expired/failed command-row detail pane added (D-10/D-11) — a pending row has no real job to stop, so no Stop button there"
  - "Relative Convex API import from src/components/forge/ is ../../../convex/_generated/api (three levels) — same fix carried from 80-03"
metrics:
  duration_seconds: 540
  completed_date: "2026-06-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
  tests_added: 12
  tests_passing: 54
  tsc_errors: 0
  build: passing
---

# Phase 80 Plan 04: Stop UI Path Summary

**One-liner:** Operator-facing Forge stop path — a `ForgeStopConfirmDialog` (shadcn AlertDialog, D-03) wired into `ForgeJobDetail` for running jobs only, calling the Clerk-gated `enqueueStop` (80-01) with an honest-async local `Stopping…` button state and no optimistic terminal flip (D-04, Pitfall 2). Completes FI-07 (launch 80-03 + stop 80-04) and the FI-08 UI gating.

## What Was Built

The destructive half of "stop a running Forge job from the cloud." A confirm-gated Stop affordance that round-trips through the 80-01 `enqueueStop` mutation while honoring the mandatory work-discard warning (D-01/D-02/D-03) and the no-optimistic-terminal-flip discipline (D-04).

### Task 1: ForgeStopConfirmDialog (`2f86dc3`)

- New `src/components/forge/ForgeStopConfirmDialog.tsx` — a shadcn `AlertDialog` wrapper (all primitives already installed in `ui/alert-dialog.tsx`, no new packages).
- Props `{ jobId, hostId, isStopping, onConfirmedStop }`, named export `ForgeStopConfirmDialog` (matches the ForgeJobDetail component style — no default export).
- `<AlertDialogTrigger asChild>` wraps a destructive `<Button size="sm" disabled={isStopping} aria-label="Stop job" aria-disabled={isStopping}>` showing `Stopping…` + spinning `Loader2` when `isStopping`, else `Stop`.
- Title "Stop this job?"; description uses the exact UI-SPEC copy: "This will immediately kill the agent process (taskkill /T /F). Any work in progress — not yet promoted to the workspace — will be discarded. This cannot be undone."
- Footer: `AlertDialogCancel` "Cancel" + `AlertDialogAction onClick={onConfirmedStop}` "Yes, stop the job" (two-step confirm — `onConfirmedStop` never fires without the explicit click, D-03).
- New `ForgeStopConfirmDialog.test.tsx` (12 tests): trigger present; no callback on initial render; dialog opens on trigger; confirm fires once; Cancel does NOT fire; warning copy mentions `taskkill`/`discarded`/`cannot be undone`; `Stopping…` shown + disabled when `isStopping=true`; active `Stop`/enabled when false.

### Task 2: Wire Stop into ForgeJobDetail (`f0b7636`)

- Extended `src/components/forge/ForgeJobDetail.tsx`:
  - `const [isStoppingLocal, setIsStoppingLocal] = useState(false)` and `const enqueueStop = useMutation(api.forge.enqueueStop)`.
  - `handleConfirmedStop`: sets `isStoppingLocal` true (button only — NO optimistic forgeJobs patch), `await enqueueStop({ hostId, forgeJobId: job.id, commandId: crypto.randomUUID() })`; on error resets `isStoppingLocal` and surfaces a `sonner` toast; on success does NOT reset (stays `Stopping…` until terminal).
  - `useEffect` keyed on `job?.status` clears `isStoppingLocal` whenever status is not `"running"`.
  - Header renders `<ForgeStopConfirmDialog … isStopping={isStoppingLocal} onConfirmedStop={handleConfirmedStop} />` ONLY when `job.status === "running"`.
  - Added a pending/expired/failed command-row detail pane (D-10/D-11): "Queued — waiting for Forge daemon on {hostId}…", "Command expired — daemon was offline.", or "Command failed: {…}". No Stop button on pending rows (no real job to kill).
  - Import path `../../../convex/_generated/api` (three levels) per the 80-03 fix.

## Verification

- `npx vitest run src/components/forge/` — 54 tests pass (4 files: badge 28, launch modal 9, job list 5, stop dialog 12)
- `npx tsc --noEmit` — 0 errors
- `npm run build` — succeeds (built in 15.76s)
- Acceptance greps (all pass):
  - `ForgeStopConfirmDialog.tsx`: `taskkill` ≥1 (2), `discarded` ≥1 (2), `AlertDialogAction` ≥1 (3), `Stopping…` ≥1 (2), `aria-label="Stop job"` = 1
  - `ForgeJobDetail.tsx`: `ForgeStopConfirmDialog` ≥1 (4), `enqueueStop` ≥1 (3), `isStoppingLocal|setIsStoppingLocal` ≥2 (9), `job.status === "running"` ≥1 (2)
  - NO optimistic terminal flip: the only `setQuery` mentions in the file are documentation comments asserting its absence — there is no actual `setQuery(api.forge.listJobs … status:"stopped")` call (Pitfall 2)
- Manual (VALIDATION §Manual-Only, needs a live daemon): launch a long job, Stop+confirm, observe `Stopping…` (button) → real `stopped` reflected back via /forge-ingest, temp workspace not promoted. Out of scope for automated verification.

## Threat Model Coverage

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-80-15 (unauthenticated stop) | mitigate | `enqueueStop` is Clerk fail-closed server-side (80-01 T-80-01); the Stop button only renders inside the authenticated `/forge` surface |
| T-80-16 (accidental destructive stop / work loss) | mitigate | Two-step AlertDialog confirm (D-03); copy states hard-kill + work-discard + irreversibility (D-01/D-02); no one-click stop |
| T-80-17 (UI claims "Stopped" before the daemon kills) | mitigate | No optimistic terminal flip (D-04/Pitfall 2): only the button shows local `Stopping…`; the status badge updates solely from the reactive query's real terminal status |
| T-80-SC (npm installs) | mitigate | No new packages — `AlertDialog` already installed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Added a pending/expired/failed command-row detail pane**
- **Found during:** Task 2 (the plan/PATTERNS note the pending-detail branch but the ForgeJobRow contract has no `_type` discriminant)
- **Issue:** PATTERNS §ForgeJobDetail referenced `job._type === "pending"`, but `ForgeJobRow` (the actual prop type) has no `_type` field — the 80-03 pending rows surface as command-sourced rows. A bare `_type` check would not compile and the pending detail pane would never render.
- **Fix:** Branch on a status sentinel (`pending`/`expired`/`failed`) plus a "no real metadata" guard (`!startedAt && !exitCode && artifactCount === 0 && !pid`) so a real terminal `failed` job still shows its metadata panel while an optimistic command row shows the honest "Queued — waiting…" / "Command expired…" / "Command failed…" copy (D-10/D-11). Keeps prop compatibility with `ForgeJobRow` (no type change to the shared interface).
- **Files modified:** `src/components/forge/ForgeJobDetail.tsx`
- **Commit:** `f0b7636`

**2. [Rule 3 - Blocking] Relative Convex API import path**
- **Found during:** Task 2 (matches the documented 80-03 deviation)
- **Issue:** From `src/components/forge/`, `../../convex/_generated/api` resolves to the non-existent `src/convex/...`.
- **Fix:** Used `../../../convex/_generated/api` (three levels up), consistent with 80-03's `ForgeLaunchModal`.
- **Files modified:** `src/components/forge/ForgeJobDetail.tsx`
- **Commit:** `f0b7636`

## TDD Gate Compliance

Task 1 was `tdd="true"`. The behavior contract (trigger present, no spurious callback, warning copy, two-step confirm fires once, `Stopping…` disabled state) is committed as `ForgeStopConfirmDialog.test.tsx` alongside the implementation in a single atomic `feat(80-04)` commit (`2f86dc3`) — test + impl together per the repo's component-task convention (mirrors 80-03). All 12 tests green. Task 2 is a wiring task (`type="auto"`, no `tdd` flag); its behavior is exercised by the existing forge component suite (54 tests green) plus the type-clean build.

## Known Stubs

None. The Stop button calls the real `api.forge.enqueueStop` mutation; the badge reflects the real reactive `listJobs` status. No hardcoded empty data feeds the UI. Note: the end-to-end `Stopping…` → real `stopped` round-trip requires a live Forge daemon (VALIDATION §Manual-Only) — out of scope for this plan's automated verification.

## Threat Flags

None — no security-relevant surface beyond the plan's threat model. The single write path (`enqueueStop`) is Clerk fail-closed server-side (80-01); the Stop button is gated to running jobs inside the authenticated `/forge` surface.

## Self-Check: PASSED

- Files created exist: `ForgeStopConfirmDialog.tsx`, `ForgeStopConfirmDialog.test.tsx` — confirmed.
- File modified exists: `ForgeJobDetail.tsx` — confirmed.
- Commits exist: `2f86dc3` (Task 1), `f0b7636` (Task 2) — confirmed in git log.
