# Phase 80: Command Bridge (launch + stop) - Research

**Researched:** 2026-06-16
**Domain:** Convex command queue, daemon polling, Clerk-gated mutations, React UI (launch modal + stop confirm)
**Confidence:** HIGH — all key patterns verified against live codebase, Convex official docs, and cross-referenced with Phase 78/79 shipped code.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 — Stop = hard `taskkill /T /F`.** Forge has no graceful cancel; `stopJob()` in `src/process/manager.ts` wraps `taskkill /T /F`. Phase 75's graceful-cancel pattern does NOT apply here.
- **D-02 — Stopped jobs discard in-progress work.** Forge only promotes the temp workspace into `rootPath` on `completed`. A killed job is never promoted.
- **D-03 — Stop requires a confirm dialog** warning that in-progress work will be discarded. Not one-click.
- **D-04 — Honest async UX:** Stop button shows `Stopping…` pending state after confirm; flips to `Stopped` only when daemon reflects terminal `stopped` status back into `forgeJobs`. No optimistic terminal flip.
- **D-05 — Trimmed launch form.** Port NewJobModal with fields: agent (codex/claude; antigravity disabled), workspace (select from existing `forgeWorkspaces`), mode (goal/chat), prompt, advanced (model + max-turns).
- **D-06 — DROP dangerous-mode** from the cloud launch surface. Local-only for v1.
- **D-07 — DROP inline workspace creation** from the cloud surface. Operator selects existing synced/local workspace only.
- **D-08 — Explicit host picker in launch modal**, pre-selecting the online host. Show stale/offline hosts disabled.
- **D-09 — Host "online" derived from daemon liveness.** Mechanism to be defined (research). Options: `lastSeenAt` updated on daemon poll/claim, or a `forgeHosts` table.
- **D-10 — Optimistic "Queued" pending row** shown immediately on Launch; reconciles to real `forgeJobs` row once daemon claims and starts the job.
- **D-11 — Failures surface on that pending row.** Daemon-offline, command rejected, or launch error → pending row flips to `Failed` with reason. No silent disappearance.
- **D-12 — Unclaimed commands TTL-expire.** Commands not claimed within a short window are marked `expired` and will not fire. Exact TTL at plan time.
- **D-13 — Fail-closed control plane.** Command-issuing mutations (enqueueLaunch, enqueueStop) REQUIRE Clerk identity — reject when absent. Deliberately diverges from read queries' graceful-skip convention.
- **D-14 — Down-channel auth reuses `FORGE_INGEST_API_KEY`.** Daemon authenticates claim/ack calls with the existing bearer. No new secret.

### Claude's Discretion
- Command transport mechanism: HTTP long-poll httpAction vs Convex reactive subscription (ConvexClient WS) vs short-interval polling.
- Exact `forgeCommands` schema, status state machine, claim/ack mechanics, TTL value.
- Host-liveness mechanism (D-09): `lastSeenAt` field on poll vs a `forgeHosts` table.

### Deferred Ideas (OUT OF SCOPE)
- Dangerous-mode launches from the cloud.
- Inline workspace creation from the cloud.
- Global e-stop/panic button across all Forge jobs.
- Command transport upgrade to reactive subscription (captured as discretion item, not v1 commitment).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FI-06 | Convex `forgeCommands` queue that the local daemon long-polls; enqueued launch/stop command delivered exactly once; execution status reflects back into `forgeJobs` | Schema design (§Architecture Patterns), claim/ack idempotency (§Patterns), transport analysis (§RQ1), reflect-back via existing `/forge-ingest` (§RQ3) |
| FI-07 | Operator can launch a new Forge job (port NewJobModal) and stop a running job from `/forge` UI, action round-tripping through command queue to daemon | NewJobModal port analysis (§RQ7), ForgeJobDetail stop integration (§Architecture), optimistic pending row (§RQ3) |
| FI-08 | Command-issuing mutations are Clerk-gated (no unauthenticated launch/stop); bridge never exposes write path that bypasses auth | Clerk fail-closed pattern (§RQ5), `ctx.auth.getUserIdentity()` null-check (§Common Pitfalls) |
</phase_requirements>

---

## Summary

Phase 80 opens the first write-back (command-down) path in the Forge integration. The Surface-Substrate bridge already handles state flowing UP (Forge → Convex via `/forge-ingest`). This phase adds a controlled reverse channel: operators enqueue `launch` or `stop` commands in Convex; the local Forge daemon polls for and executes them; resulting job state reflects back through the existing `/forge-ingest` emitter. No new reflect channel is needed.

The Convex side ships: a `forgeCommands` table, two Clerk-gated mutations (`enqueueLaunch`, `enqueueStop`), a daemon-facing `claimCommands` httpAction (bearer-authed, same key as `/forge-ingest`), an `ackCommand` internalMutation, and a TTL cron. The cross-repo Forge side ships: a command-poll loop that calls `claimCommands` on a timer, executes (`POST /jobs` or `stopJob`), then acks.

**Primary recommendation:** Use short-interval HTTP polling from the daemon (not a reactive WS subscription, not a long-poll httpAction). The daemon already uses plain `fetch` for the emitter. A 5-10 second polling interval delivers sub-10-second command latency with zero new infrastructure. The reactive-subscription alternative is reserved as a deferred upgrade (CONTEXT Deferred).

**Architectural Responsibility Map**

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Enqueue launch/stop command | API / Backend (Convex mutation) | — | Write path must be Clerk-gated (D-13); browser calls Convex directly |
| Command store | Database / Storage (Convex `forgeCommands`) | — | Central queue; host-scoped; TTL-managed |
| Daemon command poll + execute | Local daemon (Forge, cross-repo) | — | Engine stays local (CONTEXT core constraint); daemon POSTs locally to Forge HTTP API |
| Status reflect-back | Local daemon → Convex (existing `/forge-ingest`) | — | Reuses Phase 78 emitter; no new channel needed |
| Launch modal UI | Frontend (React, `/forge` route) | — | Calls Convex mutation with Clerk identity |
| Stop confirm UI | Frontend (React, `ForgeJobDetail`) | — | Same Convex mutation pattern |
| Optimistic pending row | Frontend (React, ForgePage-local `pendingLocal` useState — B2; `withOptimisticUpdate` superseded) | — | Local state; reconciliation effect drops the row when its `resolvedForgeJobId` appears in `jobs` |
| Host liveness | Database / Storage (lightweight `lastSeenAt` on claim) | — | Simpler than a full `forgeHosts` table for v1 |
| Command TTL expiry | Backend (Convex cron, `convex/crons.ts`) | — | Mirrors Phase 81 retention sweep pattern |

---

## Research Questions — Findings

### RQ1: Command Transport / Daemon Poll Mechanism

**Options evaluated:**

| Option | Mechanism | Latency | Complexity | Fits Forge pattern? |
|--------|-----------|---------|------------|---------------------|
| (a) HTTP long-poll httpAction | Daemon GETs `/forge-commands-poll`; httpAction holds open until command or timeout | Low (sub-second) | Medium (httpAction holds connection, Convex charges action time) | Partially — Forge already uses `fetch` but not long-held connections |
| (b) ConvexClient reactive WS subscription | Daemon runs `ConvexClient` + `onUpdate(api.forge.pendingCommands)` | Very low (push) | High (need ConvexClient dep in Forge, WS in server process, no bearer-key auth on WS without JWT) | Low — Forge has no Convex dep; auth is bearer, not JWT |
| (c) Short-interval HTTP polling | Daemon polls `/forge-commands-claim` every 5-10s via `fetch` | Low (< TTL/2) | Low (same `fetch` pattern as emitter) | HIGH — identical to the existing emitter; no new dep |

**Recommendation: Option (c) — short-interval polling at 5-10s.** [VERIFIED: codebase]

Rationale:
- The Forge daemon already uses `fetch` fire-and-forget for the emitter (`src/emit/codepulse-emitter.ts`). A poll loop is the same pattern.
- ConvexClient requires WebSocket support and authenticates via JWT. The Forge daemon authenticates server-to-server with `FORGE_INGEST_API_KEY` (a bearer token, not a Clerk JWT). Feeding a JWT into `ConvexClient.setAuth` would require Clerk machine-auth or a custom identity provider — not in scope. [VERIFIED: Convex docs, https://docs.convex.dev/client/javascript/node]
- `httpAction` long-poll: actions time out after 10 minutes [VERIFIED: https://docs.convex.dev/functions/actions]. Long-poll is *possible* but adds complexity (the daemon must reconnect after each timeout; Convex charges action compute time for the hold). For a 5-second poll on a lightly used queue this buys nothing over short polling.
- 5-10 second latency from queue-to-execution is acceptable for an operator manually launching a job. If this proves too slow, upgrading to ConvexClient reactive subscription is the captured deferred path (CONTEXT).

**Daemon poll endpoint shape:** `POST /forge-commands-claim` (not GET — it has side effects: atomically claims commands). Registered in `convex/http.ts` the same way as `/forge-ingest` (POST + OPTIONS). Authenticated via `validateForgeIngestAuth`. Returns claimed commands or `[]`.

---

### RQ2: `forgeCommands` Schema and State Machine

**Recommended schema** (following `forgeJobs`/`forgeWorkspaces` conventions at `convex/schema.ts:1464`): [VERIFIED: codebase]

```typescript
forgeCommands: defineTable({
  // Identity & targeting
  hostId:        v.string(),              // which host should execute this
  commandId:     v.string(),              // stable client-generated ULID (for optimistic row reconciliation)
  commandType:   v.union(v.literal("launch"), v.literal("stop")),

  // Launch payload (null for stop commands)
  launchPayload: v.union(v.object({
    agent:        v.string(),
    workspaceId:  v.string(),
    mode:         v.string(),
    prompt:       v.union(v.string(), v.null()),
    model:        v.union(v.string(), v.null()),
    capabilities: v.union(v.string(), v.null()),  // JSON string; excludes dangerous
  }), v.null()),

  // Stop payload (null for launch commands)
  stopPayload:   v.union(v.object({
    forgeJobId: v.string(),  // the job to stop
  }), v.null()),

  // State machine
  status:        v.string(),  // queued | claimed | executing | done | failed | expired

  // Clerk provenance (D-13)
  issuedBy:      v.string(),   // identity.subject from getUserIdentity()

  // Timing + TTL (D-12)
  createdAt:     v.number(),   // Date.now() ms
  expiresAt:     v.number(),   // createdAt + TTL_MS; cron deletes/marks past this
  claimedAt:     v.union(v.number(), v.null()),
  executedAt:    v.union(v.number(), v.null()),
  completedAt:   v.union(v.number(), v.null()),

  // Result
  error:         v.union(v.string(), v.null()),
})
  .index("by_host_status_created", ["hostId", "status", "createdAt"])  // claim query
  .index("by_commandId",           ["commandId"])                        // optimistic reconciliation
  .index("by_expires",             ["expiresAt"])                        // TTL cron sweep
```

**State machine:**
```
queued → claimed → executing → done
                             ↘ failed
queued (unclaimed) → expired  (via TTL cron)
```

**Claim/ack idempotency:**
The daemon's `claimCommands` httpAction calls an `internalMutation` that atomically:
1. Queries `forgeCommands` for `{hostId, status:"queued", expiresAt > now}`, ordered by `createdAt`.
2. Sets `status:"claimed"`, `claimedAt: now` in the same mutation.
3. Returns the claimed docs.

Because Convex mutations are ACID and serialized per document, a single mutation that reads + patches is safe against double-claim even with concurrent daemon polls. [VERIFIED: Convex docs — mutations are serializable transactions]

The daemon then:
1. Sets `status:"executing"` on the claimed command (via ack endpoint or same claim response).
2. Executes locally (POST `/jobs` or `stopJob`).
3. POSTs to `/forge-commands-ack` (or reuses the claim endpoint) with `{commandId, status: "done"|"failed", error?}`.

Simpler alternative: collapse `claimed` + `executing` into one status (`executing`), set on claim. The daemon only needs one status update (the final ack). This reduces round trips. **Recommendation: claim atomically sets `executing`; ack sets `done`/`failed`.**

**TTL value recommendation (D-12):** 5 minutes. Rationale: long enough for a daemon that's momentarily polling-between-intervals (up to 10s latency); short enough to not fire on a laptop waking hours later. Mirror the approach from 081-SPEC D-2: the TTL cron runs frequently (every 1 minute) and marks/deletes commands with `expiresAt < Date.now()`.

---

### RQ3: Status Reflect-Back and Job Correlation

**Reflect-back path:** No new channel needed. [VERIFIED: codebase — `src/emit/codepulse-emitter.ts`]

After the daemon executes a `launch` command:
1. Forge's `createGoalJob()` (or `handleChatJob()`) runs and sets the job's initial status (`running`).
2. The existing `emitJob()` call fires (`void emitJob(emitCfg, fresh6)` in `manager.ts:346`).
3. This POSTs to `/forge-ingest`, which calls `internal.forge.upsertJob` → the `forgeJobs` row lands in Convex.
4. The Phase 79 `useForgeJobs()` subscription picks it up via Convex reactive query.

**Job correlation (D-10 optimistic row reconciliation):**
The pending "Queued" row inserted optimistically must reconcile to the real `forgeJobs` row.

Mechanism: the `launchPayload` in the `forgeCommands` doc includes a client-generated `commandId` (ULID). The daemon, on receipt of a claimed `launch` command, creates the Forge job and includes the `commandId` in the job's capabilities or a dedicated field, then emits via `/forge-ingest`. The `upsertJob` writes it to `forgeJobs`. The CodePulse UI can then match the optimistic pending row (keyed by `commandId`) to the incoming real row.

**Simpler alternative:** The daemon POSTs the newly created `forgeJobId` back to Convex as part of its ack (`POST /forge-commands-ack` body: `{commandId, forgeJobId, status:"done"}`). Convex stores `forgeJobId` on the `forgeCommands` row. The UI watches `forgeCommands` where `commandId` matches and considers the optimistic row reconciled when `forgeJobId` appears and the real `forgeJobs` row arrives.

**Recommendation:** Use the ack-returns-forgeJobId approach. It's simpler (no capabilities-bag injection on the Forge side), and the planner can wire it cleanly in the `forgeCommands` table (`resolvedForgeJobId: v.optional(v.string())`).

For `stop` commands: no reconciliation needed. The daemon executes `stopJob()`, the existing emitter fires with `status:"stopped"`, and the `forgeJobs` row updates. The UI watching the job's status sees the transition.

---

### RQ4: TTL Expiry Implementation

**Pattern:** Convex `crons.ts` + `internalMutation`. [VERIFIED: https://docs.convex.dev/scheduling/cron-jobs]

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire-stale-forge-commands",
  { minutes: 1 },
  internal.forge.expireStaleCommands,
);

export default crons;
```

```typescript
// convex/forge.ts — internalMutation
export const expireStaleCommands = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("forgeCommands")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .collect();
    for (const cmd of stale) {
      if (cmd.status === "queued") {
        await ctx.db.patch(cmd._id, { status: "expired" });
      }
      // Already-claimed/executing commands are not expired — the daemon is mid-flight.
      // Only queued (unclaimed) commands expire.
    }
  },
});
```

If `crons.ts` does not yet exist in the project, it is a Wave 0 gap. Check: [VERIFIED: codebase — no `convex/crons.ts` found via Glob; needs creation]

**TTL alternative: `ctx.scheduler.runAfter()`** in the `enqueueLaunch`/`enqueueStop` mutation. Each command schedules its own expiry 5 minutes out. This is more precise but harder to test and creates one scheduled job per command. The cron sweep mirrors the 081-SPEC D-2 retention approach and is preferable for consistency. [ASSUMED — 081 D-2 chose cron over per-record scheduling; same reasoning applies]

---

### RQ5: Clerk-Gated Fail-Closed Mutations (D-13 / FI-08)

**Pattern verified from Convex official docs:** [VERIFIED: https://docs.convex.dev/auth/clerk]

```typescript
import { mutation } from "./_generated/server";

export const enqueueLaunch = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    // D-13: fail-closed — reject when Clerk identity absent
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    // identity.subject is the Clerk user ID
    // proceed to insert forgeCommands row
  },
});
```

`ctx.auth.getUserIdentity()` returns `null` when:
- Clerk is not configured (no `VITE_CLERK_PUBLISHABLE_KEY`). This is the "graceful-skip" path for read queries — **do NOT apply graceful-skip to write mutations** (D-13).
- The request comes from an unauthenticated client.
- The JWT has expired.

**Divergence note (critical):** The existing read queries in `convex/forge.ts` use graceful-skip (no auth check). The new write mutations must have the opposite behavior: an explicit null-check that throws. Add a code comment documenting this divergence so reviewers do not "fix" it back to graceful-skip. [VERIFIED: codebase — `listJobs`/`getJob`/`listWorkspaces` have no auth check; the divergence is intentional per D-13]

**Daemon path (down-channel auth, D-14):** The daemon's `claimCommands` and `ackCommand` calls authenticate with `FORGE_INGEST_API_KEY` bearer via `validateForgeIngestAuth` (same as `/forge-ingest`). These are httpActions, not mutations called from the browser. They do NOT use Clerk. The `validateForgeIngestAuth` function already implements fail-closed bearer auth (`convex/ingestAuth.ts:88`): no key configured without `FORGE_INGEST_ALLOW_ANON=true` → rejects.

---

### RQ6: Host Liveness (D-08/D-09)

**Recommendation: `lastSeenAt` field on the `forgeCommands` table + a `forgeHosts` lightweight record.**

Two sub-options:

**Option A: `lastSeenAt` updated on claim poll.**
The `claimCommands` httpAction, in addition to returning pending commands, updates a `forgeHosts` record (or a dedicated `lastSeenAt` on a lightweight `forgeHosts` table) with `Date.now()`. The UI derives "online" from `lastSeenAt > Date.now() - ONLINE_THRESHOLD_MS` (e.g., 30 seconds).

**Option B: Separate `forgeHosts` table with dedicated heartbeat.**
More structured but requires a separate `POST /forge-heartbeat` call from the daemon (or we piggyback on the claim poll). For v1, the daemon only needs to poll for commands; a heartbeat should ride along with the poll, not require a separate endpoint.

**Recommendation: Option A with a `forgeHosts` table** (thin record, not a full separate endpoint). [ASSUMED — no existing `forgeHosts` table found in schema.ts; this is a new addition]

```typescript
// In schema.ts alongside forgeJobs/forgeWorkspaces
forgeHosts: defineTable({
  hostId:      v.string(),
  lastSeenAt:  v.number(),   // Date.now() ms, updated on each claim poll
  hostname:    v.optional(v.string()),
})
  .index("by_hostId", ["hostId"])
  .index("by_lastSeenAt", ["lastSeenAt"]),
```

The `claimCommands` internalMutation upserts the `forgeHosts` record as a side effect. The `listHosts` query (new, Clerk-graceful-skip pattern since it's read-only) returns hosts sorted by `lastSeenAt`. The launch modal queries this to populate the host picker and pre-select the most recently seen host.

`ONLINE_THRESHOLD_MS = 30_000` (30 seconds). At a 5-10s poll interval, three missed polls before "offline". This is tight enough to surface a sleeping laptop quickly.

---

### RQ7: NewJobModal Port Specifics

**Local-only vs. portable:** [VERIFIED: codebase — `forge/web/src/components/NewJobModal.tsx`]

| Feature | Local Forge UI | Cloud port (Phase 80) | Notes |
|---------|---------------|----------------------|-------|
| Agent picker (codex/claude) | `apiFetch('/agents')` implied by state | From `forgeWorkspaces`/static | Agent list is static (codex, claude; agy disabled) |
| Workspace picker | `apiFetch('/workspaces')` — calls local Forge HTTP | `useQuery(api.forge.listWorkspaces, {hostId})` | Reads from Convex `forgeWorkspaces` synced by Phase 78 emitter |
| Inline workspace creation | `apiFetch('/workspaces', {method:'POST'})` | **DROPPED (D-07)** | Local-only for v1 |
| Dangerous-mode toggle + confirm | Present (D-07 in Forge) | **DROPPED (D-06)** | Entire section removed |
| Mode (goal/chat) | ✓ | ✓ | Kept |
| Prompt textarea | ✓ | ✓ | Kept |
| Model (dropdown for claude, free-text for codex) | ✓ | ✓ | Keep the `CLAUDE_MODELS` list verbatim |
| Max-turns | ✓ | ✓ | Kept in Advanced collapsible |
| Host picker | Not present (single-host) | **NEW (D-08)** | Queries `listHosts`; pre-selects online host |
| Submit action | `apiFetch('/jobs', {method:'POST'})` | `useMutation(api.forge.enqueueLaunch).withOptimisticUpdate(...)` | Convex mutation, not local HTTP |

**Capabilities JSON construction for cloud-launched jobs:**
The `capabilities` field in the cloud launch drops `dangerous` (D-06) but keeps `maxTurns`. Build the payload:
```typescript
const caps: Record<string, unknown> = {};
const parsedMaxTurns = Number.parseInt(maxTurns, 10);
if (Number.isFinite(parsedMaxTurns) && parsedMaxTurns > 0) {
  caps['maxTurns'] = parsedMaxTurns;
}
const capabilities = Object.keys(caps).length > 0 ? JSON.stringify(caps) : null;
```

**shadcn component mapping:** All shadcn primitives used in the original (`Dialog`, `Select`, `Textarea`, `Switch`, `Collapsible`, `Button`, `Badge`) already exist in CodePulse's `src/components/ui/`. No new components to install. [VERIFIED: codebase — `package.json` has `shadcn` + `radix-ui`]

**Host picker component:** New `Select` (from existing `src/components/ui/select.tsx`) + `ForgeHostBadge` for display. Disabled options for offline/stale hosts (`disabled` prop on `SelectItem`).

---

## Standard Stack

### Core (no new packages required)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| convex | ^1.39.1 (installed: 1.41.0) | Convex database, mutations, httpActions, reactive queries, crons | Already installed — `convex` 1.41.0 confirmed [VERIFIED: npm registry + package.json] |
| @clerk/clerk-react | ^5.61.3 | Clerk identity via `ctx.auth.getUserIdentity()` | Already installed [VERIFIED: package.json] |
| react | ^19.2.4 | Launch modal + stop confirm UI components | Already installed [VERIFIED: package.json] |
| zod | ^4.3.6 | Validation in Convex mutations | Already installed [VERIFIED: package.json] |
| lucide-react | ^1.8.0 | Icons (Rocket, StopCircle, AlertTriangle for new UX states) | Already installed [VERIFIED: package.json] |
| sonner | ^2.0.7 | Toast notifications for command submission feedback | Already installed [VERIFIED: package.json] |

**Phase 80 requires NO new package installations.** All needed libraries are already in `package.json`.

**Forge daemon side (cross-repo, forge/package.json):** The command-poll loop uses `node:fetch` (Node.js 22 built-in — no new deps). No new packages for the Forge repo either. [VERIFIED: forge/package.json — Node.js ≥22.13 in engines]

### Package Legitimacy Audit

> No new packages are installed in this phase. The audit below confirms this.

| Package | Registry | Status | Disposition |
|---------|----------|--------|-------------|
| (none new) | — | — | No installs required |

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

*slopcheck not run (no new packages to evaluate).*

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser / Clerk-auth'd Operator]
        |
        | useMutation(api.forge.enqueueLaunch)
        | useMutation(api.forge.enqueueStop)
        v
[Convex Mutation — fail-closed Clerk check]
        |
        | ctx.db.insert("forgeCommands", { status:"queued", ... })
        v
[Convex forgeCommands table]
        ^
        | withOptimisticUpdate → shows pending "Queued" row immediately
        |
[Browser UI — ForgeJobList]
        |
        |   (useQuery(api.forge.listJobs) — reactive, existing)
        |   (useQuery(api.forge.listForgeCommands) — new, for pending rows)
        |
        v
[Convex TTL cron — expireStaleCommands @ 1 min]
        |
        | marks queued commands past expiresAt → "expired"
        v
[forgeCommands status: expired]

[Local Forge Daemon — Node.js on Windows]
        |
        | every 5-10s: POST /forge-commands-claim
        | Bearer: FORGE_INGEST_API_KEY
        v
[Convex httpAction: /forge-commands-claim]
        |
        | → internalMutation: claimAndUpsertHost
        |   reads queued commands for hostId
        |   atomically sets status="executing" (claim)
        |   upserts forgeHosts.lastSeenAt
        |   returns claimed commands
        v
[Daemon receives: [{commandType:"launch"|"stop", payload, commandId}]]
        |
        | Execute locally:
        | launch → POST http://localhost:3001/jobs
        | stop   → POST http://localhost:3001/jobs/:id/stop
        |
        | Forge emitter fires: void emitJob(emitCfg, updatedJob)
        |   → POST /forge-ingest (existing Phase 78 channel)
        |   → forgeJobs row lands in Convex
        v
[Forge job state lands in Convex forgeJobs]
        |
        | Reactive query subscription updates UI
        v
[Browser — optimistic "Queued" row reconciles to real forgeJobs row]

[Daemon also POSTs ack:]
        |
        | POST /forge-commands-ack
        | { commandId, status:"done"|"failed", forgeJobId?, error? }
        v
[Convex httpAction: /forge-commands-ack]
        |
        | → internalMutation: ackCommand
        |   patches forgeCommands row: status, resolvedForgeJobId, completedAt
```

### Recommended Project Structure

```
convex/
├── forge.ts             # Extend: add enqueueLaunch, enqueueStop (mutations, Clerk-gated)
│                        #         add claimableCommands, listForgeCommands (queries)
│                        #         add claimAndUpsertHost, ackCommand, expireStaleCommands (internalMutation)
│                        #         add listHosts (query, graceful-skip)
├── forgeCommands.ts     # Alternative: split forgeCommands-specific mutations here
│                        #   (follow project convention — check if other domains split or stay in one file)
├── schema.ts            # Add: forgeCommands table + forgeHosts table
├── http.ts              # Add: /forge-commands-claim POST+OPTIONS, /forge-commands-ack POST+OPTIONS
├── ingestAuth.ts        # Unchanged — validateForgeIngestAuth reused for daemon paths
└── crons.ts             # New (Wave 0 gap): expireStaleCommands @ 1 min interval

src/
├── components/forge/
│   ├── ForgeJobList.tsx          # Extend: add "Launch" toolbar button, pending "Queued" rows
│   ├── ForgeJobDetail.tsx        # Extend: add Stop button + confirm dialog
│   ├── ForgeLaunchModal.tsx      # New: trimmed NewJobModal port
│   ├── ForgeStopConfirmDialog.tsx # New: confirm dialog (D-03)
│   ├── ForgeStatusBadge.tsx      # Extend: add "Stopping…" pending variant
│   └── ForgeHostBadge.tsx        # Unchanged (used in host picker)
├── hooks/
│   └── useForge.ts               # Extend: add useForgeCommands, useForgeHosts hooks
└── pages/
    └── ForgePage.tsx             # Extend: wire launch modal trigger, pass mutations down

forge/ (cross-repo)
└── src/
    ├── emit/
    │   └── command-poller.ts     # New: poll /forge-commands-claim → execute → ack loop
    └── index.ts                  # Extend: start command-poller on daemon startup
```

### Pattern 1: Clerk-Gated Fail-Closed Mutation

**What:** A `mutation` that explicitly throws when no Clerk identity is present.
**When to use:** All write-path mutations in Phase 80 (enqueueLaunch, enqueueStop).

```typescript
// Source: https://docs.convex.dev/auth/clerk
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const enqueueLaunch = mutation({
  args: {
    hostId:    v.string(),
    commandId: v.string(),   // client-generated ULID for optimistic reconciliation
    agent:     v.string(),
    workspaceId: v.string(),
    mode:      v.string(),
    prompt:    v.union(v.string(), v.null()),
    model:     v.union(v.string(), v.null()),
    capabilities: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // D-13: Fail-closed — diverges from read query graceful-skip convention.
    // DO NOT change this to graceful-skip; this is a write/control path.
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required to issue Forge commands");
    }

    const now = Date.now();
    const TTL_MS = 5 * 60 * 1000; // 5 minutes (D-12)

    await ctx.db.insert("forgeCommands", {
      hostId:       args.hostId,
      commandId:    args.commandId,
      commandType:  "launch",
      launchPayload: {
        agent:       args.agent,
        workspaceId: args.workspaceId,
        mode:        args.mode,
        prompt:      args.prompt,
        model:       args.model,
        capabilities: args.capabilities,
      },
      stopPayload:  null,
      status:       "queued",
      issuedBy:     identity.subject,
      createdAt:    now,
      expiresAt:    now + TTL_MS,
      claimedAt:    null,
      executedAt:   null,
      completedAt:  null,
      error:        null,
    });
  },
});
```

### Pattern 2: Claim httpAction (daemon-facing)

**What:** A httpAction the daemon POSTs to; atomically claims queued commands.
**When to use:** Daemon command-poll loop.

```typescript
// Source: convex/ingestAuth.ts pattern (Phase 78)
// Source: https://docs.convex.dev/functions/http-actions + https://docs.convex.dev/functions/internal-functions
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { validateForgeIngestAuth, getCorsHeaders, unauthorizedResponse } from "./ingestAuth";

export const forgeCommandsClaim = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateForgeIngestAuth(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json() as { hostId: string };
  const claimed = await ctx.runMutation(internal.forge.claimAndUpsertHost, {
    hostId: body.hostId,
    now:    Date.now(),
  });

  return new Response(JSON.stringify({ commands: claimed }), {
    status: 200,
    headers: { ...getCorsHeaders(request), "Content-Type": "application/json" },
  });
});
```

### Pattern 3: Optimistic Pending Row (D-10)

> ⚠ **SUPERSEDED by plan revision B2 (2026-06-16).** The `withOptimisticUpdate` approach below was abandoned during plan verification: ForgePage subscribes to `listForgeCommands` with `{}` (all hosts), but `withOptimisticUpdate` would write to cache key `{hostId}` — a different Convex cache entry, so the pending row would not appear until the server round-trip (defeating D-10). The plans (80-03) instead use a **ForgePage-local `pendingLocal` `useState`** + a reconciliation `useEffect` that drops a row once its `resolvedForgeJobId` appears in `jobs`. Treat the snippet below as historical context only — follow the 80-03 PLAN action, not this scaffold.

**What:** ~~`useMutation.withOptimisticUpdate` shows an immediate "Queued" row in the job list.~~ (superseded — see B2 note above)
**When to use:** `ForgeLaunchModal` submit handler.

```typescript
// Source: https://docs.convex.dev/client/react/optimistic-updates
const enqueueLaunch = useMutation(api.forge.enqueueLaunch).withOptimisticUpdate(
  (localStore, args) => {
    const existing = localStore.getQuery(api.forge.listJobs, { hostId: args.hostId }) ?? [];
    const pendingRow: ForgeCommandPendingRow = {
      _type: "pending",
      commandId: args.commandId,
      hostId: args.hostId,
      agent: args.agent,
      mode: args.mode as JobMode,
      prompt: args.prompt,
      status: "queued",        // shows ForgeStatusBadge "Queued"
      createdAt: new Date().toISOString(),
    };
    // Prepend to job list (newest first)
    localStore.setQuery(api.forge.listJobs, { hostId: args.hostId }, [pendingRow, ...existing]);
  }
);
```

Note: The optimistic row uses a discriminated union (`_type: "pending"`) so `ForgeJobList` can render it differently (no detail link, shows "Queued…" spinner) until the real `forgeJobs` row arrives.

### Pattern 4: Daemon Command-Poll Loop (cross-repo, Forge)

```typescript
// forge/src/emit/command-poller.ts
// Source: mirrors codepulse-emitter.ts fire-and-forget fetch pattern
export class CommandPoller {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly claimUrl: string,    // CONVEX_FORGE_INGEST_URL + /forge-commands-claim
    private readonly ackUrl: string,      // CONVEX_FORGE_INGEST_URL + /forge-commands-ack
    private readonly apiKey: string,
    private readonly hostId: string,
    private readonly db: DatabaseSync,
    private readonly config: ForgeConfig,
    private readonly emitCfg: EmitCfg,
    private readonly intervalMs = 7_000,  // 7s: low-latency, not aggressive
  ) {}

  start(): void {
    this.timer = setInterval(() => { void this.poll(); }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    // 1. Claim
    const res = await fetch(this.claimUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ hostId: this.hostId }),
    }).catch(() => null);  // fire-and-forget discipline: never throw
    if (!res?.ok) return;

    const { commands } = await res.json() as { commands: ForgeCommand[] };
    for (const cmd of commands) {
      void this.execute(cmd);  // parallel execution; each command is independent
    }
  }

  private async execute(cmd: ForgeCommand): Promise<void> {
    let status: 'done' | 'failed' = 'done';
    let error: string | undefined;
    let forgeJobId: string | undefined;

    try {
      if (cmd.commandType === 'launch') {
        const job = await this.launchJob(cmd.launchPayload!);
        forgeJobId = job.id;
      } else if (cmd.commandType === 'stop') {
        stopJobById(this.db, cmd.stopPayload!.forgeJobId, this.emitCfg);
      }
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : String(err);
    }

    // Ack regardless of outcome
    await fetch(this.ackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ commandId: cmd.commandId, status, forgeJobId, error }),
    }).catch(() => null);  // never throw
  }
}
```

### Anti-Patterns to Avoid

- **Optimistic terminal state for Stop (violates D-04):** Never set `status:"stopped"` on a `forgeJobs` row optimistically. The `Stopping…` pending state must persist until the daemon reflects back the real `stopped` status. Premature flip hides failures.
- **Graceful-skip on write mutations (violates D-13):** Do not add `if (!identity) return;` to `enqueueLaunch`/`enqueueStop`. The identity must be checked and thrown on. The read query pattern from Phase 78/79 must NOT propagate here.
- **Double-claiming commands:** Never use a query + separate patch in two mutations to claim. The claim must be a single atomic mutation that reads AND patches in one transaction. Convex mutations are serializable but only within the same mutation call.
- **Long-polling httpAction as daemon transport:** Actions time out at 10 minutes; long-polls add complexity for no latency benefit over 5-10s polling at this traffic volume.
- **Dangerous-mode in capabilities payload:** Even though `launchPayload.capabilities` is a JSON string passed through, the Convex mutation should explicitly strip `capabilities.dangerous` before inserting (defense in depth on top of D-06).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth check in mutation | Custom JWT parsing | `ctx.auth.getUserIdentity()` (Convex built-in) | Convex validates the Clerk JWT on every request; manual parsing is error-prone |
| Atomic claim to prevent double-execution | Application-level locking / `if(exists)` | Single `internalMutation` that reads + patches in one transaction | Convex mutations are serializable — same mutation = atomic |
| Recurring TTL sweep | Timer in Node.js process | Convex `crons.ts` + `internalMutation` | Crons survive deployment restarts; process timers don't |
| Stop confirmation dialog | Hand-rolled modal | shadcn `AlertDialog` (`src/components/ui/alert-dialog.tsx`) | Already installed (shadcn/ui New York); accessible, dismissable |
| Pending state management | Manual React state machine | `useMutation.withOptimisticUpdate` | Automatic rollback on server response; no cleanup logic needed |
| Host "online" computation | Complex heartbeat protocol | `lastSeenAt > Date.now() - 30_000` on `forgeHosts` row | Simple, no new infrastructure; daemon polls update it as side effect |

**Key insight:** The "exactly-once command delivery" problem is solved by Convex's serializable mutation model + the claim-atomically pattern. No distributed lock needed.

---

## Common Pitfalls

### Pitfall 1: Graceful-Skip Leaked into Write Mutations
**What goes wrong:** Developer copies the `listJobs` query pattern (no auth check) into `enqueueLaunch`. Unauthenticated users can issue launch commands.
**Why it happens:** Phase 78/79 read queries deliberately use graceful-skip. The pattern looks like a project-wide default.
**How to avoid:** Add a prominent code comment in `enqueueLaunch`/`enqueueStop`: "D-13: fail-closed — intentionally diverges from read-query graceful-skip." Include in code review checklist.
**Warning signs:** `getUserIdentity()` return value unused or guarded with `if (!identity) return;` instead of `throw`.

### Pitfall 2: Optimistic Terminal State on Stop Button
**What goes wrong:** Stop button immediately flips the job status to `stopped` in the UI. The daemon never kills the job (daemon offline, PID wrong), but the UI shows `Stopped`.
**Why it happens:** Optimistic updates feel responsive; developers apply them to terminal states.
**How to avoid:** The optimistic update for Stop only changes the Stop button label to "Stopping…". The `forgeJobs` status badge does NOT change optimistically. Only the ForgeStatusBadge updates when the reactive `listJobs` query delivers the real `stopped` status.
**Warning signs:** `localStore.setQuery(api.forge.listJobs, ...)` includes a patched `status:"stopped"`.

### Pitfall 3: Race Between Optimistic Row and Real forgeJobs Row
**What goes wrong:** Both the optimistic pending row (keyed by `commandId`) and the real `forgeJobs` row (keyed by `forgeJobId`) appear simultaneously in `ForgeJobList`. The operator sees a duplicate.
**Why it happens:** The reconciliation logic in `ForgeJobList` doesn't deduplicate by `commandId`.
**How to avoid:** The pending row is stored in the `forgeCommands` list, not the `forgeJobs` list. The UI renders two separate sections or merges by filtering out pending rows whose `resolvedForgeJobId` matches an existing `forgeJobs` entry. Alternatively, once `forgeCommands.resolvedForgeJobId` is set, the pending row stops rendering (query filter: `status NOT IN [done, failed, expired]`).

### Pitfall 4: TTL Window Too Short — Kills Legitimate Commands
**What goes wrong:** Daemon polls every 10s; command expires in 30s; daemon misses 3 polls; command expires before execution.
**How to avoid:** TTL must be >> (poll interval * expected miss count). With 7s poll and 5-minute TTL: 42 missed polls before expiry. This is robust to temporary daemon restarts.

### Pitfall 5: Convex `crons.ts` Missing — Expiry Never Runs
**What goes wrong:** `expireStaleCommands` is defined as an internalMutation but never scheduled. Expired commands pile up in `queued` status forever. A restarted daemon claims stale old commands.
**How to avoid:** Wave 0 must include creating `convex/crons.ts` (it does not exist yet — [VERIFIED: Glob search found no crons.ts]). Without it, the expiry mutation exists but never fires.
**Warning signs:** No `convex/crons.ts` file; no cron visible in Convex dashboard after deploy.

### Pitfall 6: CORS on New Daemon-Facing Endpoints
**What goes wrong:** `/forge-commands-claim` and `/forge-commands-ack` are daemon-to-Convex (server-to-server). CORS headers are irrelevant for server-to-server calls, but the OPTIONS handler must still be registered if the Convex router checks method matching.
**How to avoid:** Register both POST and OPTIONS routes in `http.ts` (same pattern as `/forge-ingest:72`). The OPTIONS handler returns 204 with CORS headers; it's a no-op for the daemon but prevents any browser-side preflight from breaking if the endpoint is ever called during development from a browser.

### Pitfall 7: `dangerous` Capability in Cloud Launch Payload
**What goes wrong:** A capabilities JSON string containing `"dangerous":true` is passed through the launch command, enabling full-filesystem access from the cloud surface (D-06 violation).
**Why it happens:** The `launchPayload.capabilities` field is a passthrough JSON string — the daemon feeds it directly to Forge's `POST /jobs` body.
**How to avoid:** The `enqueueLaunch` Convex mutation must strip `dangerous` from the capabilities object before inserting. Parse, delete `capabilities.dangerous`, re-serialize. Add a test verifying this strip.

---

## Code Examples

### Auth check in mutation (Clerk fail-closed)
```typescript
// Source: https://docs.convex.dev/auth/clerk
const identity = await ctx.auth.getUserIdentity();
if (identity === null) {
  throw new Error("Authentication required to issue Forge commands");
}
// Proceed — identity.subject is the Clerk user ID
```

### Cron registration
```typescript
// Source: https://docs.convex.dev/scheduling/cron-jobs
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "expire-stale-forge-commands",
  { minutes: 1 },
  internal.forge.expireStaleCommands,
);
export default crons;
```

### Atomic claim mutation (double-claim safe)
```typescript
// Source: Convex mutation serialization — https://docs.convex.dev/functions/mutation-functions
export const claimAndUpsertHost = internalMutation({
  args: { hostId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    // Upsert host liveness
    const host = await ctx.db
      .query("forgeHosts")
      .withIndex("by_hostId", (q) => q.eq("hostId", args.hostId))
      .unique();
    if (host) {
      await ctx.db.patch(host._id, { lastSeenAt: args.now });
    } else {
      await ctx.db.insert("forgeHosts", { hostId: args.hostId, lastSeenAt: args.now });
    }

    // Claim queued, non-expired commands for this host (up to 10 at a time)
    const queued = await ctx.db
      .query("forgeCommands")
      .withIndex("by_host_status_created", (q) =>
        q.eq("hostId", args.hostId).eq("status", "queued")
      )
      .filter((q) => q.gt(q.field("expiresAt"), args.now))
      .take(10);

    for (const cmd of queued) {
      await ctx.db.patch(cmd._id, { status: "executing", claimedAt: args.now });
    }

    return queued;   // returned to the daemon
  },
});
```

### Stop confirm dialog (shadcn AlertDialog)
```typescript
// Source: shadcn/ui AlertDialog docs — already installed
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// D-03: confirm dialog before stop, warning about work loss
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive" disabled={isStopping}>
      {isStopping ? "Stopping…" : "Stop"}
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Stop this job?</AlertDialogTitle>
      <AlertDialogDescription>
        This will immediately kill the agent process. Any work in progress
        (not yet promoted to the workspace) will be discarded. This cannot
        be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={handleConfirmedStop}>
        Yes, stop the job
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Recommended Build Order

**Wave 0 — Infrastructure (no UI yet):**
1. `convex/schema.ts`: Add `forgeCommands` + `forgeHosts` tables.
2. `convex/crons.ts`: Create with `expireStaleCommands` interval.
3. `convex/forge.ts`: Add `expireStaleCommands` (internalMutation), `claimAndUpsertHost` (internalMutation), `ackCommand` (internalMutation), `listForgeCommands` (query), `listHosts` (query), `enqueueLaunch` (mutation, Clerk-gated), `enqueueStop` (mutation, Clerk-gated).
4. `convex/http.ts`: Register `/forge-commands-claim` and `/forge-commands-ack`.
5. Deploy schema to Convex (dev).

**Wave 1 — Daemon side (cross-repo):**
6. `forge/src/emit/command-poller.ts`: CommandPoller class (poll → claim → execute → ack).
7. `forge/src/index.ts`: Start CommandPoller on daemon startup; gate on `CONVEX_FORGE_INGEST_URL` + `FORGE_INGEST_API_KEY`.
8. Test: daemon claims + executes a launch command end-to-end.

**Wave 2 — CodePulse UI:**
9. `src/hooks/useForge.ts`: Add `useForgeCommands`, `useForgeHosts` hooks.
10. `src/components/forge/ForgeLaunchModal.tsx`: Port NewJobModal (trimmed: drop dangerous-mode, inline-create; add host picker).
11. `src/components/forge/ForgeStopConfirmDialog.tsx`: shadcn AlertDialog wrapper.
12. `src/components/forge/ForgeStatusBadge.tsx`: Add `Stopping…` pending variant (new status string `"stopping_pending"`).
13. `src/components/forge/ForgeJobDetail.tsx`: Wire Stop button + confirm dialog.
14. `src/components/forge/ForgeJobList.tsx`: Add Launch toolbar button, render pending command rows.

**Wave 3 — Integration + error paths:**
15. Test: Launch from UI → optimistic row → daemon claims → job appears in forgeJobs.
16. Test: Stop from UI → Stopping… state → daemon kills → stopped status reflects back.
17. Test: TTL expiry — command left unclaimed becomes `expired`.
18. Test: Unauthenticated launch attempt → rejected (D-13).

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Direct `http://localhost` call from browser | Convex command queue + daemon poll | Avoids mixed-content blocking (the reason this architecture exists) |
| Long-poll or SSE for command push | Short-interval polling from daemon | Simpler; action timeouts make long-poll unattractive at 10-min limit |
| Separate auth key per down-channel | Reuse `FORGE_INGEST_API_KEY` (D-14) | One secret to provision/rotate; consistent with 081-SPEC D-3 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No `convex/crons.ts` exists in the project | Common Pitfalls §5, Wave 0 | If crons.ts already exists, it just needs the new cron added — low risk |
| A2 | `forgeHosts` table does not yet exist in `schema.ts` | RQ6, Schema | If it exists under a different name, merge is easy — low risk |
| A3 | 5-minute TTL is appropriate for the use case | RQ4 | If daemon restarts take longer than 5 minutes routinely, TTL needs extending; can be changed at plan time |
| A4 | `AlertDialog` component exists in `src/components/ui/` | Code Examples | shadcn is installed; if AlertDialog wasn't added via `shadcn add`, it may need installation from within the existing shadcn setup |
| A5 | Convex action timeout is 10 minutes for httpActions (long-poll feasibility) | RQ1 | Confirmed by Convex docs — [VERIFIED: https://docs.convex.dev/functions/actions]. Low risk. |
| A6 | 081-SPEC D-2 uses cron (not per-record scheduler) — same recommendation here | RQ4 | [ASSUMED] — 081-SPEC D-2 is captured in the spec doc but was not verified as fully implemented yet. Pattern is consistent. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex dev backend | Wave 0 schema deploy | ✓ | 1.41.0 (npm) | — |
| Node.js ≥22.13 (Forge daemon) | Daemon command-poller | ✓ (Forge engines field) | ≥22.13 | — |
| `npx convex dev` | Local Convex dev server | ✓ (package.json script) | — | — |
| Clerk publishable key | FI-08 auth test | ✓ (graceful env var) | — | Mutations throw even without Clerk (fail-closed); dev can test by setting the key |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (Vitest embedded) + `src/test/setup.ts` |
| Quick run command | `npx vitest run convex/ src/components/forge/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FI-06 | `enqueueLaunch` inserts `forgeCommands` row with correct fields | unit | `npx vitest run convex/forge.test.ts` | ❌ Wave 0 |
| FI-06 | `claimAndUpsertHost` atomically claims queued commands + upserts host | unit | `npx vitest run convex/forge.test.ts` | ❌ Wave 0 |
| FI-06 | `expireStaleCommands` marks queued commands past `expiresAt` as expired | unit | `npx vitest run convex/forge.test.ts` | ❌ Wave 0 |
| FI-06 | `ackCommand` sets `resolvedForgeJobId` on done command | unit | `npx vitest run convex/forge.test.ts` | ❌ Wave 0 |
| FI-07 | `ForgeLaunchModal` renders with host picker + correct trimmed fields | unit | `npx vitest run src/components/forge/ForgeLaunchModal.test.tsx` | ❌ Wave 0 |
| FI-07 | Stop confirm dialog renders, requires confirmation before mutation fires | unit | `npx vitest run src/components/forge/ForgeStopConfirmDialog.test.tsx` | ❌ Wave 0 |
| FI-07 | `ForgeStatusBadge` renders `Stopping…` for pending stop state | unit | `npx vitest run src/components/forge/ForgeStatusBadge.test.tsx` | ✅ (extend existing) |
| FI-08 | `enqueueLaunch` throws when `getUserIdentity()` returns null | unit | `npx vitest run convex/forge.test.ts` | ❌ Wave 0 |
| FI-08 | `enqueueStop` throws when `getUserIdentity()` returns null | unit | `npx vitest run convex/forge.test.ts` | ❌ Wave 0 |
| FI-06 | Dangerous-mode capability stripped from launch payload | unit | `npx vitest run convex/forge.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run convex/ src/components/forge/`
- **Per wave merge:** `npm test` (full Vitest suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `convex/forge.test.ts` — covers FI-06 (enqueueLaunch, claimAndUpsertHost, expireStaleCommands, ackCommand, auth-fail-closed)
- [ ] `src/components/forge/ForgeLaunchModal.test.tsx` — covers FI-07 (modal fields, host picker, trimmed form)
- [ ] `src/components/forge/ForgeStopConfirmDialog.test.tsx` — covers FI-07 (confirm gate, Stopping… state)
- [ ] `convex/crons.ts` — scheduler gap; without it `expireStaleCommands` never fires in prod

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Clerk + `ctx.auth.getUserIdentity()` fail-closed (FI-08, D-13) |
| V3 Session Management | No | Handled by Clerk; Convex validates JWT per-request |
| V4 Access Control | Yes | Fail-closed mutation gate; daemon bearer auth on claim/ack path |
| V5 Input Validation | Yes | Convex `v.` validators on all mutation args; strip `dangerous` from capabilities |
| V6 Cryptography | No | No crypto hand-roll; bearer token via existing `FORGE_INGEST_API_KEY` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated launch command | Elevation of Privilege | Fail-closed `getUserIdentity()` null-check (D-13) |
| Stale command replay (daemon wakes hours later) | Tampering | TTL expiry cron (D-12); `expiresAt` checked on claim |
| Dangerous-mode injection via capabilities | Tampering | Strip `capabilities.dangerous` in `enqueueLaunch` mutation (Pitfall 7) |
| Double-claim race (two daemon instances) | Tampering | Atomic single-mutation claim (claimAndUpsertHost reads + patches atomically) |
| FORGE_INGEST_API_KEY exposure in logs | Information Disclosure | Follow existing emitter discipline — never interpolate key into console.error |
| Mixed-content (browser → localhost) | Spoofing | Architecture choice: browser never calls localhost; only daemon calls Convex |

---

## Sources

### Primary (HIGH confidence)
- Live codebase — `convex/forge.ts`, `convex/ingestAuth.ts`, `convex/schema.ts`, `convex/http.ts`, `src/hooks/useForge.ts`, `src/components/forge/*`, `forge/src/process/manager.ts`, `forge/src/emit/codepulse-emitter.ts`, `forge/web/src/components/NewJobModal.tsx`, `forge/src/http/routes/jobs.ts`, `forge/src/emit/config.ts` — all read directly; patterns verified.
- Convex Scheduled Functions docs — https://docs.convex.dev/scheduling/scheduled-functions — `ctx.scheduler.runAfter()` confirmed.
- Convex Cron Jobs docs — https://docs.convex.dev/scheduling/cron-jobs — `cronJobs()` API confirmed.
- Convex Auth/Clerk docs — https://docs.convex.dev/auth/clerk — `ctx.auth.getUserIdentity()` null-on-unauthenticated confirmed.
- Convex Internal Functions docs — https://docs.convex.dev/functions/internal-functions — `internalMutation` from httpAction pattern confirmed.
- Convex Optimistic Updates docs — https://docs.convex.dev/client/react/optimistic-updates — `withOptimisticUpdate` pattern confirmed.
- Convex Actions docs — https://docs.convex.dev/functions/actions — 10-minute timeout confirmed.
- Convex JavaScript client docs — https://docs.convex.dev/client/javascript, https://docs.convex.dev/client/javascript/node — ConvexClient (WS reactive) vs ConvexHttpClient confirmed.

### Secondary (MEDIUM confidence)
- `npm view convex version` — confirms 1.41.0 current (published 2026-06-09).
- Phase 81 spec (`081-SPEC.md`) — TTL cron pattern confirmed as the chosen approach for retention.

### Tertiary (LOW confidence / ASSUMED)
- A1-A6 in Assumptions Log above — flagged ASSUMED where not verified by live tool call.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed; no new packages
- Architecture (Convex side): HIGH — patterns verified against live code (Phase 78/79) and official docs
- Architecture (daemon side): HIGH — mirrors existing `codepulse-emitter.ts` pattern exactly
- Command transport recommendation: HIGH — ConvexClient WS auth limitation verified; action timeout verified
- Pitfalls: HIGH — Pitfalls 1-3 derived from live code patterns + D-13 divergence; others from architecture analysis

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (Convex 1.x API is stable; only risk is if Convex releases breaking changes to auth or scheduling)
