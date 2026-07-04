---
status: resolved
phase: 80-command-bridge-launch-stop
reviewer: gsd-code-reviewer (sonnet)
reviewed: 2026-06-16
files_reviewed: 13
findings_total: 4
findings_resolved: 4
---

# Phase 80: Code Review Report

Cloud↔daemon command bridge (launch/stop → Convex queue → daemon poll/claim/ack → reflect-back). Security-critical paths (Clerk fail-closed gate, `dangerous` capability stripping, bearer auth on daemon endpoints) were verified correct. Four real findings were raised and **all four have been fixed** in this branch (precision-filtered review — 4 speculative items dropped, see end).

## Findings & Resolution

### CR-01 (HIGH) — `ackCommand` overwrote terminal-state commands → idempotency broken
`convex/forge.ts` — `ackCommand` patched any matched row without checking its current status. A late/duplicate ack (at-least-once delivery) arriving after a command reached `done`/`failed`/`expired` would corrupt the terminal state + audit trail.
**Fix:** added `isTerminalCommandStatus()` helper; `ackCommand` now returns early when the row is already terminal. Unit-tested (`forge.test.ts`).

### CR-02 (HIGH) — `listForgeCommands` all-hosts path sorted by `expiresAt`, not `createdAt`
`convex/forge.ts` + `convex/schema.ts` — the no-`hostId` path (used by ForgePage's merged list) used the `by_expires` index, reordering commands by TTL instead of insertion time.
**Fix:** added a `by_createdAt` index to `forgeCommands` and switched the all-hosts query to it (newest-first). Bindings regenerated.

### WR-01 — `hostsLoading` conflated "loading" with "no hosts ever seen" → eternal skeleton
`src/components/forge/ForgeLaunchModal.tsx` + `src/hooks/useForge.ts` — `hostsLoading = hosts.length === 0` showed a skeleton forever on a fresh deployment with zero hosts.
**Fix:** added `useForgeHostsRaw()` (returns `undefined` while loading, memoized for referential stability); modal now distinguishes loading (skeleton) from empty (explicit "No hosts online — start the Forge daemon" message).

### WR-02 (MEDIUM) — stale `submitError` on modal re-open race
`src/components/forge/ForgeLaunchModal.tsx` — the modal closes on submit, then awaits the mutation; an error set `submitError` after close, leaving stale state that could flash on the next open. The inline error block never rendered in this flow (failures already surface on the optimistic "failed" row per D-11).
**Fix:** removed the dead `submitError` state + render block; launch failures continue to surface via `onLaunchFailed` → the optimistic row.

## Also fixed during the post-merge gate (pre-review)
- **ForgePage render loop** — `useForgeCommands` returned a fresh `raw.map()` array and `jobs` was `raw ?? []`, both new identities each render, churning the reconcile effect into "Maximum update depth exceeded" on mount. Memoized both arrays at the source. (Caught by the full-suite gate; individual plan tests only ran `src/components/forge/`.)

## What the reviewer dropped and why (precision over volume)
- **W1 claim-snapshot comment** in `claimAndUpsertHost` — documented Convex runtime contract, handled by the daemon protocol; not a defect.
- **`enqueueLaunch/enqueueStop` missing commandId dedup** — `commandId` is a client `crypto.randomUUID()`; collision is not a real risk; no index-enforced uniqueness needed.
- **`expireStaleCommands` unbounded `.collect()`** — bounded by the 1-min cron cadence + short TTL; steady-state result set is small.
- **`hostsLoading` skeleton when a host just went offline** — expected; the disabled offline `SelectItem` handles it. Only the eternal-skeleton-on-zero-hosts case (WR-01) was real.

## Verification after fixes
- `npx tsc --noEmit` — 0 errors
- full `vitest run` — 846 passed / 0 failed (incl. 3 new `isTerminalCommandStatus` tests)
- `npm run build` — succeeds
