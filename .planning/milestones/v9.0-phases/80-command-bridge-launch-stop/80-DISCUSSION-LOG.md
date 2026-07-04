# Phase 80: Command Bridge (launch + stop) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 80-command-bridge
**Areas discussed:** Stop semantics & UX, Launch form scope & risky controls, Multi-host targeting, Pending feedback & failures, Auth gating

---

## Stop semantics & UX

| Option | Description | Selected |
|--------|-------------|----------|
| Hard kill + confirm + 'Stopping…' | Stop fires Forge's taskkill behind a confirm dialog warning in-progress work is discarded; button shows 'Stopping…' until daemon reflects 'stopped' back | ✓ |
| Hard kill, one-click, no confirm | Faster but easy to fire accidentally and lose work | |
| Optimistic stop | Flip row to Stopped immediately without waiting for daemon confirmation | |

**User's choice:** Hard kill + confirm + 'Stopping…'
**Notes:** Grounded in `forge` repo `src/process/manager.ts` — Forge's only stop is `taskkill /T /F`; a stopped job's temp workspace is not promoted (work discarded). Phase 75's "graceful cancel, NOT pid-kill" does not transfer to Forge. → D-01..D-04.

---

## Launch form scope & risky controls

| Option | Description | Selected |
|--------|-------------|----------|
| Trim risky paths for v1 | Port agent/workspace-select/mode/prompt/model/max-turns; drop dangerous-mode + inline workspace-create from the cloud surface | ✓ |
| Full 1:1 port | Parity with local Forge UI incl. dangerous-mode + inline create | |
| Trim dangerous-mode only | Keep inline create, drop full-FS dangerous toggle | |

**User's choice:** Trim risky paths for v1
**Notes:** NewJobModal (`forge/web/src/components/NewJobModal.tsx`) carries dangerous-mode (T-5-DANGER, full-FS) + inline `POST /workspaces`. Both stay local-only for the Clerk-gated cloud control plane. → D-05/D-06/D-07.

---

## Multi-host targeting

| Option | Description | Selected |
|--------|-------------|----------|
| Picker, default to online host | Explicit host selector; pre-select most-recently-seen/online host; offline hosts disabled | ✓ |
| Auto-target, no picker if one host | Skip picker for single host; default to most-recently-active otherwise | |
| Always require explicit pick | No defaulting | |

**User's choice:** Picker, default to online host
**Notes:** forgeJobs/workspaces are host-scoped (Desktop vs laptop). Requires a daemon-liveness signal (no heartbeat field today) → D-08/D-09; mechanism deferred to planner.

---

## Pending feedback & failures

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic 'Queued' row + TTL | Show pending Queued row immediately; reconcile to real forgeJobs row on claim; failures → Failed state; unclaimed commands TTL-expire | ✓ |
| Wait for real row | Job appears only once daemon creates the forgeJobs row | |
| Optimistic, no TTL | Show Queued immediately but commands persist indefinitely | |

**User's choice:** Optimistic 'Queued' row + TTL
**Notes:** Convex is an async queue the daemon polls. TTL prevents a waking laptop from firing stale launches. → D-10/D-11/D-12.

---

## Auth gating (FI-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed control plane | Command mutations require a Clerk identity (reject when unset/unauthenticated), diverging from read-query graceful-skip; daemon down-channel reuses FORGE_INGEST_API_KEY | ✓ |
| Match read-query convention | Mutations also graceful-skip when Clerk unset | |

**User's choice:** Fail-closed control plane
**Notes:** Write/control path deserves stronger gating than read queries. Mirrors `validateForgeIngestAuth` fail-closed posture. → D-13/D-14.

---

## Claude's Discretion

- Command transport mechanism (HTTP long-poll httpAction vs Convex reactive subscription vs short-poll) — implementation approach, not a product decision.
- Exact `forgeCommands` schema, status state-machine, claim/ack mechanics, and TTL value.
- Host-liveness mechanism (`lastSeenAt` on poll vs a `forgeHosts` table).

## Deferred Ideas

- Dangerous-mode launches from the cloud (local-only for v1).
- Inline workspace creation from the cloud (local-only for v1).
- Global e-stop / panic button across all Forge jobs on a host.
- Command transport upgrade to a reactive subscription if polling latency proves noticeable.
