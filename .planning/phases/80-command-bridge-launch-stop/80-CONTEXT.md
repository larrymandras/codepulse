# Phase 80: Command Bridge (launch + stop) - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning
**Milestone:** v7.0 Forge Integration · Phase 3 of 5 (after 78/79 shipped)

<domain>
## Phase Boundary

Add the **first write-back (command-down) path** to the Forge integration: a Convex `forgeCommands` queue that the local Forge daemon polls, so an operator can **launch** and **stop** Forge jobs from the `/forge` UI. Flow: UI mutation (Clerk-gated) → `forgeCommands` row → daemon claims it → daemon executes against the local Forge engine (`POST /jobs` launch / `taskkill` stop) → resulting job state reflects back into `forgeJobs` via the existing `/forge-ingest` emitter. Ports Forge's `NewJobModal` (trimmed). Reqs **FI-06** (command queue + daemon poll), **FI-07** (launch/stop UI), **FI-08** (auth gating).

**This is a turning point:** Phase 78 locked the system as **read-only / one-way** (Forge → Convex). Phase 80 opens a controlled write channel in the reverse direction. The daemon remains the executor; Convex never touches localhost.

### In scope
- Convex `forgeCommands` table + enqueue mutations (launch, stop) + a daemon-facing claim/ack path
- Daemon-side poll-and-execute loop (cross-repo, `forge` repo — pairs with this phase like the Phase 78 emitter did)
- Launch UI: a trimmed `NewJobModal` port (agent / workspace-select / mode / prompt / model / max-turns)
- Stop UI: per-job Stop wired through a `stop` command
- Host targeting (picker, defaulting to the online host)
- Optimistic "Queued" pending row + command TTL expiry
- Clerk-gated (fail-closed) command mutations

### Out of scope (deferred / other phases)
- Live log streaming (Phase 81 — design locked in `081-SPEC.md`)
- File/artifact preview + artifact reachability (Phase 82)
- **Dangerous-mode** (full-filesystem-access) launches from the cloud surface — stays local-only (deferred)
- **Inline workspace creation** (`POST /workspaces`) from the cloud surface — stays local-only (deferred)
- A global "panic" e-stop across all jobs (Phase 75 has that concept for the Ástríðr gateway; not in this Forge phase's v1)

</domain>

<decisions>
## Implementation Decisions

### Stop semantics & UX
- **D-01 — Stop = Forge's hard `taskkill /T /F`.** Forge has **no** graceful cancellation flag (confirmed in `forge` repo `src/process/manager.ts` `stopJob` → `stopFn` wraps `taskkill /T /F`). This is the opposite of Phase 75's "cancellation flag, NOT pid-kill" — that decision does **not** transfer; Forge only kills the process tree.
- **D-02 — A stopped job's work is discarded.** Forge promotes the per-job temp workspace into `rootPath` **only on `completed`** (`promoteWorkspace`, D-06 in Forge). A killed job is never promoted → in-progress work is lost. The Stop UI **must** surface this.
- **D-03 — Stop is guarded by a confirm dialog** warning that in-progress work in the temp workspace will be discarded. Not one-click.
- **D-04 — Honest async UX:** the Stop button shows a **`Stopping…` pending state** after confirm, and only flips to `Stopped` when the daemon reflects the terminal `stopped` status back into `forgeJobs` (mirrors Phase 75 D-09). No optimistic flip.

### Launch form scope
- **D-05 — Trim risky write-paths from the cloud surface for v1.** Port `NewJobModal` with fields: **agent** (codex default / claude; antigravity stays disabled), **workspace** (select from existing `forgeWorkspaces` only), **mode** (goal/chat), **prompt**, and advanced **model** (claude = dropdown of current models, codex = free-text) + **max-turns**.
- **D-06 — DROP dangerous-mode** (the `capabilities.dangerous` full-filesystem toggle / T-5-DANGER) from the cloud launch surface. It remains available on local Forge only. Rationale: a Clerk-gated remote control plane should not be able to grant no-approval full-FS access.
- **D-07 — DROP inline workspace creation** (`POST /workspaces`) from the cloud surface for v1 — operator selects an existing synced/local workspace. Workspace creation stays local. (Reduces the bridge to exactly launch + stop.)

### Multi-host targeting
- **D-08 — Explicit host picker in the launch modal, pre-selecting the online host.** `forgeJobs`/`forgeWorkspaces` are host-scoped (`hostId`, Desktop vs laptop). The launch modal shows a host selector; pre-select the host whose daemon was most-recently-seen; show stale/offline hosts disabled.
- **D-09 — Host "online" is derived from daemon liveness.** There is no heartbeat field today — define one (e.g. the daemon's poll/claim updates a `lastSeenAt`, or a dedicated `forgeHosts` liveness record). *(Mechanism → planner/researcher; see research flags.)*

### Pending feedback, failures & stale-command safety
- **D-10 — Optimistic "Queued" pending row.** On Launch, show a pending job row immediately (status `Queued`/`pending`), then reconcile to the real `forgeJobs` row once the daemon claims the command and starts the job.
- **D-11 — Failures surface on that row.** Daemon-offline, command rejected, or launch error → the pending row flips to a `Failed` state with the reason; never a silent disappearance.
- **D-12 — Unclaimed commands TTL-expire.** A command not claimed within a short window (e.g. a few minutes — exact value at plan time, analogous to 081's retention cap) is marked expired and will **not** fire. Prevents a laptop waking hours later from launching a stale job.

### Auth & safety (FI-08)
- **D-13 — Fail-closed control plane.** Command-issuing mutations (enqueue launch/stop) **require a Clerk identity** — reject when Clerk is unset or unauthenticated. This deliberately **diverges** from the read queries' "graceful-skip when Clerk unset" convention (`convex/forge.ts` `listJobs`/`getJob`), because this is a write/control path. Mirrors the fail-closed posture of `validateForgeIngestAuth` (`convex/ingestAuth.ts:88`).
- **D-14 — Down-channel auth reuses `FORGE_INGEST_API_KEY`.** The daemon authenticates its command-claim/ack calls with the existing shared bearer (same key as `/forge-ingest`, server-to-server, never in the browser). No new secret to provision — consistent with 081-SPEC D-3.

### Claude's Discretion
- Command transport mechanism — **HTTP long-poll httpAction vs a Convex reactive subscription in the daemon vs short-interval poll.** Left to research/planning (implementation approach, not a product decision). Lean: an httpAction the daemon claims against, consistent with the existing one-way `fetch` pattern Forge already uses; a reactive subscription is the "free live" alternative (cf. 081 logs).
- Exact `forgeCommands` schema, status state-machine (`queued → claimed → executing → done/failed/expired`), claim/ack mechanics (avoid double-execution across hosts), and the TTL value (D-12) — planner's call within these decisions.
- Host-liveness mechanism (D-09) — `lastSeenAt` on poll vs a `forgeHosts` table.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 80: Command Bridge (launch + stop)" — goal, success criteria, FI-06/07/08, strict 80→81→82 sequencing
- `.planning/REQUIREMENTS.md` §"Command Bridge (FI) — Phase 80" — FI-06/07/08 definitions + traceability
- `.planning/PROJECT.md` §"Current Milestone: v7.0 Forge Integration" — the Surface-Substrate bridge framing + core constraint (engine stays local)

### Phase 78 foundation (the read-only contract this phase extends)
- `.planning/phases/078-forge-emitter-convex-schema/078-CONTEXT.md` — locked D-01..D-08: daemon = Forge's engine, `/forge-ingest` transport, `FORGE_INGEST_API_KEY` auth, `(hostId, forgeJobId)` idempotent upsert, host-scoping, **read-only/one-way (D-08 — now being extended)**
- `convex/forge.ts` — existing `upsertJob`/`upsertWorkspaces` (internalMutation) + `listJobs`/`getJob`/`listWorkspaces` (public queries, graceful-skip Clerk). The reflect-back target + the read-query convention D-13 diverges from
- `convex/schema.ts:1464` — `forgeJobs` + `forgeWorkspaces` table defs + indexes (model `forgeCommands` schema/indexes on these conventions)
- `convex/ingestAuth.ts:88` — `validateForgeIngestAuth` (fail-closed bearer) + `getCorsHeaders` allowlist — the down-channel auth pattern (D-14) and the fail-closed model (D-13)
- `convex/http.ts:72` — how `/forge-ingest` is registered (POST + OPTIONS); the command-claim httpAction (if chosen) registers the same way

### Sibling command-driving phase (decision analogs — read for contrast)
- `.planning/phases/75-agent-console/75-CONTEXT.md` — Phase 75 (Ástríðr gateway drive) decisions on launch modal, per-run Stop, `Stopping…` pending UX (D-08/D-09), terminal-state persistence. **NOTE the divergence:** Phase 75 stop = graceful cancel flag; Forge stop = hard kill (D-01). Reuse the *UX patterns*, not the *kill mechanism*.

### Cross-repo — Forge daemon side (pairs with this phase)
- `C:\Users\mandr\forge\web\src\components\NewJobModal.tsx` — the launch modal to port (trim per D-05/D-06/D-07). Real field set: agent / workspace(+inline-create) / mode / prompt / advanced(model, max-turns) / dangerous-mode. POSTs `/jobs`.
- `C:\Users\mandr\forge\src\process\manager.ts` — `stopJob` (idempotent, `taskkill /T /F`, no-op on terminal) — the stop semantics behind D-01/D-02; terminal statuses `completed|failed|stopped|auth_failed`
- `C:\Users\mandr\forge\src\http\routes\jobs.ts` — Forge's local `POST /jobs` launch contract the daemon invokes; `POST /workspaces` (the inline-create path dropped per D-07)
- `C:\Users\mandr\forge` — the Forge repo root; the command-poll daemon loop lands here (analog of the Phase 78 emitter half)

### Design system (Phase 71)
- `.planning/phases/071-unified-design-system/UI-SPEC.md` — Matrix Emerald dark theme tokens + primitives the launch modal / stop confirm must render against; the CONSOLE/Forge IA cluster

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `convex/forge.ts` — extend with `forgeCommands` enqueue mutations + daemon claim/ack; the existing `upsertJob` is the reflect-back sink (no change needed — the daemon re-emits via `/forge-ingest`).
- `src/components/forge/*` (Phase 79) — `ForgeJobList`, `ForgeJobDetail`, `ForgeStatusBadge`, `ForgeHostBadge`, `useForge` hook. The launch modal + Stop button slot into this existing read-only surface; `ForgeStatusBadge` needs a `Queued`/`Stopping…`/`Failed` state (D-04/D-10/D-11).
- `C:\Users\mandr\forge\web\src\components\NewJobModal.tsx` — port source (trimmed). shadcn `Dialog`/`Select`/`Textarea`/`Switch`/`Collapsible` map 1:1 to CodePulse's shadcn set.
- `convex/ingestAuth.ts` — `validateForgeIngestAuth` (down-channel, D-14) + `getCorsHeaders`.

### Established Patterns
- **Idempotent, host-scoped, last-writer-wins** (Phase 78) — `forgeCommands` claim/ack should follow the same idempotency discipline so re-polls/retries are safe.
- **Clerk graceful-skip on read queries** — the convention D-13 deliberately breaks for write mutations. Document the divergence in code so it isn't "fixed" back to graceful-skip.
- **httpAction + bearer + CORS allowlist** — the `/forge-ingest` shape to mirror if the command-claim path is an httpAction.

### Integration Points
- **New Convex table** `forgeCommands` (host-scoped; status state-machine; TTL field for D-12).
- **New mutations** (Clerk-gated, fail-closed): `enqueueLaunch`, `enqueueStop` (+ daemon-facing `claimCommands`/`ackCommand`).
- **New daemon loop** (cross-repo, `forge` repo): poll/claim → execute (`POST /jobs` or `stopJob`) → ack → job state flows back via the existing emitter.
- **UI** (`src/components/forge/` + `src/pages` Forge route): launch modal trigger, host picker, Stop+confirm, optimistic Queued row.

</code_context>

<specifics>
## Specific Ideas

- "One application for all coding-agent work" — launching/stopping a Forge job from the cloud dashboard should feel as immediate as the local Forge UI, despite the async queue (hence the optimistic Queued row, D-10).
- Honest stop UX — never claim `Stopped` before the daemon actually kills the process and reflects it back (D-04); and never let the operator hard-kill without knowing work is discarded (D-03).
- Keep the remote control plane minimal & safe — launch + stop only; dangerous-mode and workspace creation stay on the local machine (D-06/D-07).

</specifics>

<deferred>
## Deferred Ideas

- **Dangerous-mode launches from the cloud** (full-filesystem `capabilities.dangerous`) — intentionally local-only for v1; revisit only with a stronger remote-auth story.
- **Inline workspace creation from the cloud** (`POST /workspaces`) — local-only for v1; could be a later "Forge admin" capability.
- **Global e-stop / panic button** across all Forge jobs on a host — Phase 75 has the concept for the gateway; a Forge analog is a possible later add.
- **Command transport upgrade to a reactive subscription** if HTTP polling latency proves noticeable — captured as a discretion item, not a v1 commitment.

</deferred>

---

*Phase: 80-command-bridge*
*Context gathered: 2026-06-16*
