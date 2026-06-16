---
phase: 80-command-bridge-launch-stop
plan: "03"
subsystem: forge-command-bridge
tags: [forge, command-bridge, ui, launch-modal, clerk-gating, optimistic-ui, tdd]
dependency_graph:
  requires: [80-01-enqueueLaunch, 80-01-listForgeCommands, 80-01-listHosts, 80-01-listWorkspaces, phase-79-forge-ui]
  provides:
    - useForgeCommands-hook
    - useForgeHosts-hook
    - JobStatus-pending-stopping_pending-expired
    - ForgeLaunchModal
    - ForgeJobList-launch-toolbar
    - ForgeJobList-pending-rows
    - ForgePage-optimistic-pendingLocal
  affects:
    - src/hooks/useForge.ts
    - src/components/forge/ForgeStatusBadge.tsx
    - src/components/forge/ForgeLaunchModal.tsx
    - src/components/forge/ForgeJobList.tsx
    - src/pages/ForgePage.tsx
tech_stack:
  added: []
  patterns:
    - clerk-env-gated-probe (W2 — useUser only inside ClerkProvider)
    - local-optimistic-state (B2 — pendingLocal, NOT withOptimisticUpdate)
    - reconciliation-by-resolvedForgeJobId
    - shadcn-port-trim (drop dangerous-mode + inline-create)
key_files:
  created:
    - src/components/forge/ForgeLaunchModal.tsx
    - src/components/forge/ForgeLaunchModal.test.tsx
    - src/components/forge/ForgeJobList.test.tsx
  modified:
    - src/hooks/useForge.ts
    - src/components/forge/ForgeStatusBadge.tsx
    - src/components/forge/ForgeStatusBadge.test.tsx
    - src/components/forge/ForgeJobList.tsx
    - src/pages/ForgePage.tsx
decisions:
  - "B2: optimistic Queued row owned by ForgePage-local pendingLocal useState (NOT withOptimisticUpdate) — avoids Convex cache-key mismatch ({hostId} write vs {} subscription)"
  - "W2: useUser() throws outside <ClerkProvider/>; ForgePage only calls it inside ClerkAuthProbe, mounted ONLY when VITE_CLERK_PUBLISHABLE_KEY is set — isAuthenticated defaults false (fail-closed, never crashes)"
  - "D-06: ForgeLaunchModal never builds a dangerous capability (the only 'dangerous' mentions are D-06 comments)"
  - "D-07: inline workspace creation dropped from the cloud surface (no '+ New workspace' control)"
  - "Reconciliation: pending rows filtered out once resolvedForgeJobId matches a real forgeJobs row (T-80-13 — no duplicates)"
  - "Relative import fix: src/components/forge/ uses ../../../convex/_generated/api (three levels), not ../../"
metrics:
  duration_seconds: 900
  completed_date: "2026-06-16"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 5
  tests_added: 17
  tests_passing: 42
  tsc_errors: 0
  build: passing
---

# Phase 80 Plan 03: Launch UI Path Summary

**One-liner:** Operator-facing Forge launch path — trimmed `ForgeLaunchModal` (host picker, no dangerous-mode, no inline-create) round-tripping through `enqueueLaunch`, plus a Clerk-gated Launch button and honest optimistic "Queued" rows with Failed/Expired reconciliation wired into `ForgeJobList`/`ForgePage` (FI-07, FI-08 UI side, D-10/D-11).

## What Was Built

The Wave-2 UI for the Forge command bridge, consuming the real 80-01 Convex APIs (`enqueueLaunch`, `listForgeCommands`, `listHosts`, `listWorkspaces`). It is the operator half of "launch a Forge job from the cloud."

### Task 1: useForge hooks + ForgeStatusBadge variants (`4c95d7d`)

- Extended `JobStatus` with `pending`, `stopping_pending`, `expired`.
- Added `ForgeCommandRow` + `ForgeHostRow` types and an `adaptCommand` mapper (`mapCommandStatus`: backend `queued`/`executing`/`done` → UI `pending`; `failed` → `failed`; `expired` → `expired`).
- Added `useForgeCommands(hostId)` (returns `{ commands }`, `{}` for all hosts) and `useForgeHosts()` hooks, using the existing `"skip"`/optional-arg idiom.
- Added three `STATUS_MAP` entries exactly per UI-SPEC §Color: `pending` (Queued…, emerald `text-primary`, spinning), `stopping_pending` (Stopping…, amber, spinning), `expired` (Expired, zinc, Clock). Extended the animate-spin condition and added `data-color-scheme` cases (`emerald`/`amber`/`stone`).
- Extended `ForgeStatusBadge.test.tsx` with new-status label/color/animation assertions (28 badge tests pass).

### Task 2: ForgeLaunchModal (`bc216b9`)

- New `ForgeLaunchModal.tsx` (~415 lines) — port of forge `NewJobModal` trimmed per D-05/06/07: host picker → agent → workspace → mode → prompt → advanced(model + max-turns), `max-w-[520px]`.
- Host picker (D-08): online host pre-selected in a `useEffect` on open, offline hosts (`Date.now() - lastSeenAt >= 30000`) disabled with `(offline)` suffix and an emerald online dot; `Skeleton` while hosts load.
- `CLAUDE_MODELS` + `DEFAULT_CLAUDE_MODEL` copied verbatim; Codex free-text model input; max-turns 1–500 default 50.
- DROPPED: `apiFetch`, the entire dangerous-mode section (D-06), the inline workspace-create panel + its state (D-07).
- Submit (B2): plain `useMutation(api.forge.enqueueLaunch)` — NO `withOptimisticUpdate`. Builds a pending `ForgeCommandRow` (status `pending`), calls `onLaunched(row)` + closes the modal BEFORE awaiting the mutation so the row paints immediately (D-10); on error calls `onLaunchFailed(commandId, message)` (D-11). Capabilities never include `dangerous`; `maxTurns` included only when a positive integer; `commandId` via `crypto.randomUUID()`.
- New `ForgeLaunchModal.test.tsx` (9 tests): host picker present, no dangerous control, no inline-create, agent/workspace/mode/prompt present, empty-workspaces copy.

### Task 3: Launch button + pending rows wiring (`cbfb7fe`)

- `ForgeJobList.tsx`: new props `pendingCommands`, `onLaunchClick`, `isAuthenticated`. Clerk-gated `Launch Job` toolbar button (Rocket icon, `variant="default"`) rendered only when `isAuthenticated` (fail-closed, FI-08). Pending rows render above real jobs via a `PendingRow` component: `border-l-2 border-primary` (queued) or `border-destructive` (failed/expired), forwarding status to `ForgeStatusBadge`, prompt-or-"—", `ForgeHostBadge`, "Just now", and `text-xs text-destructive role="alert"` error text when failed. Container is `aria-live="polite"`. Reconciliation (`visiblePendingRows`) drops any pending row whose `resolvedForgeJobId` matches a real job (T-80-13). Empty-state preserved (shows only when no jobs AND no pending rows).
- `ForgePage.tsx`: B2 local `pendingLocal` `useState`; subscribes to `useForgeCommands(null)`; `handleLaunched`/`handleLaunchFailed`; merges `[...pendingLocal, ...serverCommands]` deduped by commandId; a reconciliation `useEffect` (keyed on jobs + serverCommands) drops local rows whose resolved job now exists. Clerk via `ClerkAuthProbe` (calls `useUser`) mounted ONLY when `VITE_CLERK_PUBLISHABLE_KEY` is set (W2 — bare `useUser()` throws without a provider); `isAuthenticated` defaults to `false`. `ForgeLaunchModal` rendered as an overlay after the `GlassPanel` — layout unchanged.
- New `ForgeJobList.test.tsx` (5 tests): (a) Launch button gated on `isAuthenticated`, (b) reconciled pending row not duplicated, (c) failed pending row shows destructive border + error text.

## Verification

- `npx vitest run src/components/forge/` — 42 tests pass (3 files: badge 28, launch modal 9, job list 5)
- `npx tsc --noEmit` — 0 errors
- `npm run build` — succeeds (Forge route + modal build cleanly)
- Acceptance greps (all pass):
  - `useForge.ts`: JobStatus three states present; `useForgeCommands`/`useForgeHosts` exported
  - `ForgeStatusBadge.tsx`: 3 new labels (Queued…/Stopping…/Expired)
  - `ForgeLaunchModal.tsx`: `enqueueLaunch` present; `withOptimisticUpdate` = 0; `onLaunched`/`onLaunchFailed` present; `dangerous` only in D-06 comments; `useForgeHosts` present; `CLAUDE_MODELS` present
  - `ForgeJobList.tsx`: `Launch Job`, `isAuthenticated`, `resolvedForgeJobId`, `aria-live` present
  - `ForgePage.tsx`: `ForgeLaunchModal`/`useForgeCommands`/`isAuthenticated` wired; `pendingLocal` present
  - `withOptimisticUpdate` across modal + page = 0 (B2)

## Threat Model Coverage

| Threat | Disposition | Implementation |
|--------|-------------|----------------|
| T-80-11 (Launch visible without auth) | mitigate | Launch button rendered only when `isAuthenticated`; Clerk-unset → button absent (fail-closed UI) |
| T-80-12 (dangerous injected from modal) | mitigate | Modal never builds a `dangerous` capability (D-06); 80-01 strips it server-side |
| T-80-13 (duplicate/ghost rows) | mitigate | `visiblePendingRows` filters pending rows reconciled by `resolvedForgeJobId` |
| T-80-14 (silent command disappearance) | mitigate | Failed pending row flips to destructive-bordered state with error copy (D-11) |
| T-80-SC (npm installs) | mitigate | No new packages — all shadcn primitives already installed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected relative import path in ForgeLaunchModal**
- **Found during:** Task 2 (first vitest run failed to resolve the Convex API import)
- **Issue:** Plan/PATTERNS scaffold used `../../convex/_generated/api`, which from `src/components/forge/` resolves to the non-existent `src/convex/...` (the path is correct only from `src/hooks/`).
- **Fix:** Changed to `../../../convex/_generated/api` (three levels up).
- **Files modified:** `src/components/forge/ForgeLaunchModal.tsx`
- **Commit:** `bc216b9`

**2. [Rule 2 - Correctness] Hardened the W2 Clerk guard beyond the plan's null-check**
- **Found during:** Task 3 (investigating `useUser` behavior)
- **Issue:** The plan said to call `useUser()` directly with a null-check. But `main.tsx` omits `<ClerkProvider/>` entirely when `VITE_CLERK_PUBLISHABLE_KEY` is unset, and Clerk's `useUser` asserts a provider and **throws** outside it — a bare call would crash the whole page when Clerk is unconfigured (the exact W2 fail-closed concern).
- **Fix:** Followed the established CodePulse pattern (`AuthGuard.tsx`): gate on `VITE_CLERK_PUBLISHABLE_KEY` at module level and call `useUser()` only inside `ClerkAuthProbe`, mounted exclusively when Clerk is configured. `isAuthenticated` defaults to `false` (fail-closed). This still satisfies the acceptance criterion (absent Launch button when `isAuthenticated={false}`, verified by the test) while preventing the crash.
- **Files modified:** `src/pages/ForgePage.tsx`
- **Commit:** `cbfb7fe`

## TDD Gate Compliance

Tasks 1 and 2 were `tdd="true"`. For each, the test was extended/written first (RED), then the implementation made it green (GREEN). Because these are component-extension tasks committed atomically per task (test + impl together), the RED/GREEN commits are not separated into distinct `test(...)`/`feat(...)` commits — each task is a single `feat(80-03)` commit containing both. The behavior contract (label rendering, host picker presence, no-dangerous, no-inline-create) is asserted by the committed tests, all green.

## Known Stubs

None. The modal calls the real `api.forge.enqueueLaunch`; list/host/workspace data flow from the real `listForgeCommands`/`listHosts`/`listWorkspaces` queries. No hardcoded empty data feeds the UI. Note: end-to-end Queued → running round-trip requires a live Forge daemon (VALIDATION §Manual-Only) — out of scope for this plan's automated verification.

## Threat Flags

None — no security-relevant surface beyond the plan's threat model. All UI write paths go through the Clerk-gated `enqueueLaunch` mutation (server-enforced, 80-01).

## Self-Check: PASSED

- Files created exist: `ForgeLaunchModal.tsx`, `ForgeLaunchModal.test.tsx`, `ForgeJobList.test.tsx` — confirmed.
- Commits exist: `4c95d7d`, `bc216b9`, `cbfb7fe` — confirmed in git log.
