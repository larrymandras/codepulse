# Phase 98: Skill Lifecycle Mutations (Archive / Restore / Move / Delete) - Research

**Researched:** 2026-07-21
**Domain:** Cross-repo command-bridge mutation execution (Convex ↔ Forge daemon, native TS filesystem moves) — extending Phase 97's already-shipped `forgeCommands`/`CommandPoller`/rescan machinery with a new class of command types
**Confidence:** HIGH — every claim below is `[VERIFIED: live code]`, read directly from both repos' current `master` this session. No training-data guesses on library APIs were needed.

## Summary

Phase 97 (merged to both repos' `master`, forge commit `8a144c1`, codepulse per `495946f`) already built every piece of cross-repo machinery Phase 98 needs to extend: the `forgeCommands` claim/ack queue with Clerk-gated `enqueue*` mutations, `resolveClaimTypes`/`supportedTypes` capability negotiation, `CommandPoller`'s dispatch-by-`commandType` loop, and — critically — `skill-rescan.ts`'s `buildSkillSnapshot`/`rescanAndSync`, which already walks all three skill roots (global `~/.claude/skills/`, cold `~/.claude/skills-available/`, and every synced workspace's `<rootPath>/.claude/skills/`) and POSTs to `registry.syncInventory`. **Phase 98 needs zero new rescan infrastructure** — every lifecycle mutation just needs to fire the existing `rescanAndSync` after a successful fs op, exactly like `executeIntake` already does for intake writes.

The genuinely new work is: (1) extend `forgeCommands`' schema with new `commandType` literals and a lifecycle payload shape; (2) new Convex `enqueue*` mutations with pre-flight checks (cold-collision, shadow-block) mirroring `enqueueIntake`'s validation discipline; (3) a new daemon-side native-TS executor (no CLI shell-out, per locked D-01) that performs the four fs mutations and fires `rescanAndSync`; (4) a **directly reusable cross-volume move solution already living in this same daemon repo** — `forge/src/workspace/promote.ts`'s `copyTreeReadWrite`/`CROSS_VOLUME_CODES` pattern, built to solve exactly this problem for a different feature (workspace promotion across the C:↔G:\ Drive boundary); (5) UI wiring (⋯ menu, two dialogs, badge overlay) per the already-approved UI-SPEC.

**One finding changes how the planner should scope the ⋯ menu**: the Skills page's `skills` table is grouped **by name across ALL origins** (`convex/skillCategories.ts`'s `getSkillsWithOverrides` → `groupSkillRowsByName`), so a single `SkillRow` can represent a skill simultaneously active in multiple scopes (e.g., two different projects, or global + a project) — not just the single active-vs-dormant case `isShadowing` checks. CONTEXT.md and the UI-SPEC's menu-item gating logic ("Active row: Archive, Move to {other scope}…") implicitly assume one current scope per row. This ambiguity must be resolved at plan time (see Pitfall 1) — it is not a hypothetical edge case; Larry's real skill set already includes at least one skill active in 5 different projects (`skills.test.ts` fixtures reference exactly this shape).

**Primary recommendation:** Extend `forgeCommands.commandType` with four new literals (or one `"lifecycle"` type carrying an `action` field — planner's call, follow the Open Design Decision below), reuse `rescanAndSync` verbatim as the post-mutation hook, and reuse `forge/src/workspace/promote.ts`'s `copyTreeReadWrite` + `CROSS_VOLUME_CODES` detection (adapted to copy-then-delete instead of promote.ts's refuse-on-EXDEV) as the move primitive — do not write a new cross-volume copy routine from scratch.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ⋯ menu, scope-gated action list, disabled-Restore tooltip | Browser/Client (`SkillRow`/`ColdStorageView`) | — | Pure UI, already scoped by UI-SPEC |
| Lifecycle command row state (pending/executing/failed badge) | Browser/Client (new hook, modeled on `useIntake.ts`) | API/Backend (new Convex query) | Client polls/subscribes; server just stores state |
| Pre-flight validation (shadow-block, cold-collision, move-collision) | API/Backend (Convex `enqueue*` mutation) | Local Daemon (re-verify at execution time, D-04) | Convex gives instant feedback; daemon is host-truth backstop |
| Command queue, auth, TTL, idempotency | API/Backend (`forgeCommands`) | — | Already built (Phase 80/97); extend schema only |
| Native filesystem move/archive/restore/delete | Local Daemon (new TS module) | — | D-01 locked: no Python shell-out for lifecycle, unlike intake |
| Cross-volume (C:↔G:\ Drive) directory move | Local Daemon (reuse `promote.ts` pattern) | — | Already solved in this repo for a different feature; do not re-invent |
| Host skill inventory rescan + registry sync | Local Daemon (`rescanAndSync`, already built) → Convex `registry.syncInventory` | — | Zero new code — literally the same function Phase 97 built |
| Registry storage, per-origin prune, UI reactivity | API/Backend (`skills` table + `syncInventory`) | Browser/Client (`useQuery` auto-refresh) | Already built; daemon just re-triggers it |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **D-01 (Executor Engine):** Daemon performs lifecycle mutations **natively in TS** (directory renames/moves) — never shells out to Python tooling. `skill-rescan.ts` already walks all three roots; `skill-intake` is install-only; `manage-skills` is a SKILL.md procedure, not a binary.
- **D-02 (Cold collision):** Archive fails clean if a dormant same-name copy already exists in `.claude/skills-available/` — actionable error, nothing moves. Same rule for move-target collisions (same-name skill already active at destination scope).
- **D-03 (Shadow hard block):** Restoring a dormant skill whose name is already active at the target scope is refused with a clear error. No compound "swap," no allow-with-warning.
- **D-04 (Two-layer shadow check):** Convex `enqueue` pre-checks against the registry (instant feedback) AND the daemon re-verifies against the live filesystem at execution time (host truth wins over stale registry).
- **D-05 (Delete semantics):** True/permanent deletion is allowed **only from cold storage**. Active skills can only be archived.
- **D-06 (Delete confirm):** GitHub-style type-the-exact-name confirmation (shadcn `AlertDialog` + `Input`); `.claude/` is gitignored, no git safety net.
- **D-07 (UI surface):** Simple shadcn `DropdownMenu` (⋯) on `SkillRow`/`ColdStorageView` now, showing only scope-valid actions. Phase 100 upgrades in place — no throwaway buttons.
- **D-08 (Command row states):** Row stays in its current lane with a pending/executing badge (reuse `useIntake`'s status mapping) until rescan lands; offline daemon shows honest queued-will-expire state. No optimistic lane-move (Phase 100).
- **D-09 (Shadow-blocked UI):** Disabled Restore menu item + tooltip, computed client-side via existing `isShadowing` helper (`src/lib/skills.ts:26`); daemon re-check (D-04) is a backstop.

### Claude's Discretion

- Archive is reversible — light or no confirmation dialog.
- "Move → project" destination picker — reuse intake's workspace-picker pattern (synced Forge workspaces only); exact form is Claude's call.
- Lifecycle `commandType`/payload shape and how `supportedTypes`/`resolveClaimTypes` advertise the new types — follow launch/stop/intake precedent.
- Atomic move mechanics (same-volume rename vs copy-verify-delete for cross-volume workspace targets) — planner/executor decides; "no partial state on disk" guarantee stands. **Research finding: this is not a rare edge case — see Pitfall 3.**
- Whether to fix forge `index.ts`'s workspace-startup-snapshot follow-up inside this phase — recommended, since move-to-project depends on fresh workspace paths.

### Deferred Ideas (OUT OF SCOPE)

- Optimistic lane-move + reconcile, drag across scope lanes — Phase 100 (UX-02/03).
- One-click "swap" (archive active + restore dormant as one atomic command) — rejected in D-03.
- Persistent "shadowed" badge on dormant rows beyond disabled-restore-with-reason — Phase 100.
- Bulk multi-select lifecycle actions — already deferred in REQUIREMENTS.
- OS Recycle-Bin backstop for permanent delete — considered, not chosen.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Archive active skill → cold storage, tracked dormant, no longer counted toward active load | Same-volume rename when both roots are on C: (the common case: global `~/.claude/skills/<name>` ↔ cold `~/.claude/skills-available/<name>`); cross-volume copy+delete when archiving FROM a Drive-synced project workspace. `rescanAndSync` (already built) makes the Skills page reflect dormancy with no manual refresh. |
| LIFE-02 | Restore dormant/cold skill back to active (global or project) | Mirror of archive, reverse direction; MUST run the shadow check (D-03/D-04) before moving. |
| LIFE-03 | Move skill between global and project scope | Same fs-move primitive, different source/dest roots; workspaceId resolved via existing `getWorkspace(db, workspaceId)` (already used by `intake-runner.ts`), never a free-text path. |
| LIFE-04 | Delete defaults to archive; true deletion is a separate, cold-only, confirmed action | True delete = `fs.rmSync(coldPath, {recursive:true})` + rescan; archive = the LIFE-01 mutation. Confirmation UI is pure client-side (D-06), no server change beyond the delete mutation itself. |
| LIFE-05 | `isShadowing`-aware restore/activate guard | `isShadowing` already implemented and tested (`src/lib/skills.ts:26`) — client pre-check (D-09) + Convex pre-check (D-04 layer 1) + daemon live-fs re-check (D-04 layer 2, new code — no existing daemon-side shadow-detection function exists yet). |
| LIFE-06 | Daemon-offline lifecycle actions degrade gracefully (queue + visible expiry, no false success) | `forgeCommands`' existing TTL/expiry (`FORGE_COMMAND_TTL_MS`, `expireStaleCommands`, `shouldExpireCommand`) and `RowStatusBadge`'s `expired`/`queued` states are already built and directly reusable — zero new expiry logic needed, only a new row-status hook consuming the same states. |
| DAEMON-02 | Daemon executes lifecycle commands atomically, archive-first for delete | New `CommandPoller` branch (parallel dispatch like launch/stop, NOT the serial intake queue — no CLI process to stampede) + new native-fs executor module + `rescanAndSync` trigger, mirroring `executeIntake`'s structure exactly. |

</phase_requirements>

## Standard Stack

**No new libraries are required.** Every piece of infrastructure needed is already installed and in use in both repos.

### Core (existing, reused)
| Component | Repo | Purpose | Status |
|-----------|------|---------|--------|
| `forgeCommands` queue + `CommandPoller` | codepulse (Convex) + forge | Command transport, claim/ack, TTL, capability negotiation | Shipped (Phase 80/97) |
| `rescanAndSync`/`buildSkillSnapshot` (`forge/src/emit/skill-rescan.ts`) | forge | Post-mutation full inventory rescan → `registry.syncInventory` | Shipped Phase 97 — reused **verbatim**, zero changes needed |
| `registry.syncInventory` (`convex/registry.ts`) | codepulse (Convex) | Upsert-by-(name,origin) + per-origin prune | Shipped, already the sink for the existing rescan |
| `isShadowing`/`isDormant`/`DORMANT_ORIGIN` (`src/lib/skills.ts`) | codepulse | Shadow/dormancy detection helpers | Shipped, unit-tested, currently unused in UI until this phase |
| `getWorkspace`/`listWorkspaces` (`forge/src/store/workspaces.ts`) | forge (SQLite) | Resolve `workspaceId` → `rootPath` | Shipped, already used by `intake-runner.ts` |
| `copyTreeReadWrite`/`CROSS_VOLUME_CODES`/`defaultReparseScanner` (`forge/src/workspace/promote.ts`) | forge | Cross-volume directory copy (Drive-safe), reparse-point (symlink/junction) detection | Shipped for workspace promotion — **directly adaptable** to lifecycle move (see Pitfall 3) |
| `useIntake.ts`'s `IntakeRowStatus`/`RowStatusBadge` pattern | codepulse | Command-row status model (`pending\|queued\|executing\|done\|failed\|expired`) | Shipped Phase 97 — the exact state machine D-08 asks to reuse |
| `radix-ui` npm package (unified meta-package, not per-primitive `@radix-ui/react-*`) | codepulse | Backs every shadcn `src/components/ui/*` primitive | Already a dependency (`"radix-ui": "^1.4.3"`) — adding `dropdown-menu` via `npx shadcn add dropdown-menu` needs **no new npm install**, only a new generated file |

**No `npm install` / `pip install` needed for this phase.** The only new artifact is the shadcn `dropdown-menu` component file itself (generated by the shadcn CLI, not a package).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native TS fs move (D-01, locked) | Shell out to a Python helper (mirroring `skill-intake`) | Rejected by CONTEXT.md — lifecycle ops are plain moves needing no validation pipeline; the daemon already owns this fs surface via `skill-rescan.ts`. Not reconsidered. |
| Reusing `promote.ts`'s exact `promoteWorkspace`/`defaultPromoteFn` function | Writing a brand-new cross-volume copy routine | `defaultPromoteFn` throws `ForgePromotionError` on EXDEV by design (D-06 there: workspace promotion assumes same-volume and refuses cross-volume as an error state). Lifecycle move needs the OPPOSITE behavior — cross-volume moves are the NORMAL case (global on C:, project workspaces on G:\Drive) and must succeed via copy+delete, not refuse. **Do not call `promoteWorkspace` directly** — extract/adapt its internal `copyTreeReadWrite` + `CROSS_VOLUME_CODES` set into a new lifecycle-move helper that copies-then-deletes on cross-volume instead of throwing. |

## Package Legitimacy Audit

**No external packages are installed by this phase.** The one new UI primitive (`dropdown-menu`) is generated by the shadcn CLI from the already-installed, already-vetted `radix-ui` meta-package (v1.4.3, confirmed live in `package.json`, matching every other primitive's import convention: `import { X as XPrimitive } from "radix-ui"`). `npm view @radix-ui/react-dropdown-menu version` confirms `2.1.21` exists upstream (informational only — this project does not install per-primitive Radix packages). Skip the legitimacy gate — nothing new to audit.

## Architecture Patterns

### System Architecture Diagram

```
Browser (CodePulse SkillRow / ColdStorageView)
  │  1. Operator opens the ⋯ menu on a skill row (always-visible trigger, D-07)
  │  2. Menu items are scope-gated client-side:
  │       Active row  → Archive, Move to {other scope}…
  │       Dormant row → Restore (disabled+tooltip if isShadowing), Delete Permanently
  │  3. Archive / Move-to-Global / Restore(unblocked) / Delete: no dialog, or a small
  │     Dialog (Move-to-Project workspace picker) / AlertDialog (Delete, type-to-confirm)
  │  4. On confirm: one enqueue<Action>() Convex mutation call
  ▼
Convex (enqueueArchive / enqueueRestore / enqueueMove / enqueueDelete — or one
        enqueueLifecycle parameterized by `action`, planner's call)
  │  - Clerk fail-closed auth (mirrors enqueueIntake's D-13 divergence from
  │    read-query graceful-skip)
  │  - idempotent-by-commandId no-op (mirrors enqueueIntake's WR-04 fix — apply
  │    this from day one; do NOT repeat launch/stop's known-deferred bug)
  │  - PRE-FLIGHT CHECKS (D-04 layer 1, against the `skills` registry table —
  │    may be stale vs. host, hence layer 2 below):
  │      · restore/activate: isShadowing-equivalent check against `skills` rows
  │        for this name → refuse if a non-dormant origin already exists (D-03)
  │      · archive: does a `skills` row already exist at (name, DORMANT_ORIGIN)?
  │        → refuse (D-02)
  │      · move: does a `skills` row already exist at (name, destination-origin)?
  │        → refuse (D-02)
  │  - inserts forgeCommands row: commandType=<lifecycle type>, status="queued"
  ▼
Convex (forgeCommandsClaim httpAction, bearer-authed) — UNCHANGED from Phase 97
  │  - daemon POSTs {hostId, supportedTypes} every 7s
  │  - supportedTypes MUST include the new lifecycle types unconditionally
  │    (no capability probe needed — unlike intake's probeIntakeCli, native fs
  │    ops have no missing-CLI failure mode to gate on)
  ▼
Forge daemon (CommandPoller, host lmofficenew) — NEW branch alongside launch/stop/intake
  │  - lifecycle commands dispatch PARALLEL (like launch/stop), NOT the serial
  │    intake queue — there is no CLI process to stampede; each fs move is
  │    fast and independent. (Discretion: verify no shared-lock concern if two
  │    lifecycle ops touch the same skill name simultaneously — see Pitfall 4.)
  │  - NEW module (e.g. forge/src/process/lifecycle-exec.ts):
  │      · resolve source/dest absolute paths from origin/destination + workspaceId
  │        (global: ~/.claude/skills/<name>; cold: ~/.claude/skills-available/<name>;
  │        project: getWorkspace(db, workspaceId).rootPath + /.claude/skills/<name>)
  │      · DAEMON-SIDE re-check (D-04 layer 2): does dest already exist on disk?
  │        does a shadowing active copy exist? → refuse with a structured error
  │        string (reuse Phase 97's `write-refused:<kind>:<raw>` PREFIX CONVENTION,
  │        e.g. `lifecycle-refused:collision:<raw>` / `lifecycle-refused:shadow:<raw>`)
  │      · perform the move: fs.renameSync first; on EXDEV/EIO/EPERM/EACCES/
  │        ENOTSUP (promote.ts's CROSS_VOLUME_CODES set), fall back to
  │        copyTreeReadWrite(src,dest) + fs.rmSync(src,{recursive:true}) —
  │        ADAPTED from promote.ts (copy-then-delete, never throw-and-refuse,
  │        since cross-volume IS the expected case here, unlike promote.ts's)
  │      · delete: fs.rmSync(coldPath, {recursive:true}) directly (D-05: cold-only)
  │  - on success: void rescanAndSync(rescanCfg) — REUSE VERBATIM, zero changes
  │    (fire-and-forget, never awaited, mirrors executeIntake's existing call)
  │  - ack POST {commandId, status, error?} — same ackUrl, same auth, same
  │    fire-and-forget discipline as execute()/executeIntake()
  ▼
Convex ackCommand (internalMutation) — extend the write-refusal adapter
  │  (synthesizeWriteRefusalReport, convex/forge.ts) to ALSO recognize
  │  `lifecycle-refused:<kind>:` prefixes and compose the exact house copy
  │  UI-SPEC's Copywriting Contract specifies (cold-collision / shadow-block /
  │  move-collision strings) — same pattern, new kind values, OR a new sibling
  │  adapter function if the copy composition differs enough to warrant one
  │  (planner's call — see Open Design Decision below)
  ▼
CodePulse: new lifecycle-command hook (e.g. useLifecycleCommands.ts, modeled
1:1 on useIntake.ts's adaptIntakeCommand/mapIntakeStatus/IntakeRowStatus) feeds
a per-(skillName, action) lookup so SkillRow can render a RowStatusBadge
overlay in place (D-08) — reuses RowStatusBadge/IntakeStatusBadge components
VERBATIM, no new badge component
  ▼
registry.syncInventory (already built, unchanged) → skills table updated
  → useQuery reactivity → SkillRow's origins array updates → row flips lanes
```

### Pattern 1: Parallel command dispatch for fast, independent, non-CLI operations
**What:** `CommandPoller.poll()` already branches `commandType === 'intake'` into a serial queue but dispatches everything else (`launch`, `stop`) via `void this.execute(cmd)` — parallel, fire-and-forget per command.
**When to use:** Lifecycle commands belong in the parallel branch, not the serial intake queue — there is no external process to stampede, and archive/restore/move/delete on different skill names are fully independent.
**Example:**
```typescript
// Source: forge/src/emit/command-poller.ts, lines 216-222 (live) — extend this dispatch
for (const cmd of commands) {
  if (cmd.commandType === 'intake') {
    this.enqueueIntake(cmd);  // serial queue — NOT the model for lifecycle
  } else {
    void this.execute(cmd);   // parallel — lifecycle commands join THIS branch
  }
}
```
Note: `execute()` itself only knows `launch`/`stop` today (`if (cmd.commandType === 'launch') {...} else if (cmd.commandType === 'stop') {...}` — an unmatched type silently acks `done` doing nothing, line 252's comment "Unknown commandType: ack as done (defensive)"). A new `else if` branch (or branches) must be added for the lifecycle types, following `executeIntake`'s shape (mutable `status`/`error` locals, try/catch, fire-and-forget ack) rather than `execute()`'s bare shape, since lifecycle also needs the post-success `rescanAndSync` trigger `executeIntake` already demonstrates.

### Pattern 2: Fire-and-forget rescan after successful mutation (already built — reuse verbatim)
**What:** After a successful write, call `rescanAndSync(rescanCfg)` without awaiting it.
**Example:**
```typescript
// Source: forge/src/emit/command-poller.ts, lines 339-341 (live)
if (status === 'done' && this.rescanCfg) {
  void rescanAndSync(this.rescanCfg);
}
```
Apply identically after every successful lifecycle mutation — no new rescan logic needed, `buildSkillSnapshot` already walks all three roots correctly.

### Pattern 3: Cross-volume-safe directory move (adapt, don't reinvent)
**What:** `fs.renameSync` first; on a specific set of error codes indicating a cross-volume or virtual-filesystem boundary, fall back to a manual recursive read/write copy, then remove the source.
**When to use:** Any lifecycle move whose source and destination may be on different Windows volumes — true for EVERY move touching a Drive-synced project workspace (`G:\My Drive\forge-workspaces\...`), since global/cold storage live on `C:\Users\mandr\.claude\...`.
**Example (adapt, do not call verbatim — see Alternatives Considered):**
```typescript
// Source: forge/src/workspace/promote.ts, lines 59-109 (live) — ADAPT this shape;
// promote.ts's own promoteWorkspace() THROWS on cross-volume (D-06 there) — lifecycle
// move must instead treat these codes as "fall back to copy", never as a refusal.
const CROSS_VOLUME_CODES: ReadonlySet<string> = new Set([
  'EXDEV', 'EIO', 'EPERM', 'EACCES', 'ENOTSUP',
]);
function copyTreeReadWrite(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const sp = path.join(src, entry.name);
    const dp = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTreeReadWrite(sp, dp);
    else fs.writeFileSync(dp, fs.readFileSync(sp));
  }
}
// Lifecycle version: try rename, on CROSS_VOLUME_CODES copy+verify+rmSync(src),
// never throw-and-refuse (unlike promote.ts's own use of this same code set).
```
**Why `fs.cpSync`/`fs.copyFileSync` are NOT viable here either:** `promote.ts`'s own comment (verified live) explains Windows' `CopyFileEx`-backed APIs get rejected by Google Drive for Desktop's virtual filesystem with EIO/EPERM even for short paths — plain `readFileSync`/`writeFileSync` is what actually works against the Drive mount. This is a live, verified, Windows-specific finding from the same host — reuse it rather than assuming `fs.cpSync({recursive:true})` (Node 22+, otherwise idiomatic) will work.

### Pattern 4: Command-row status hook modeled on useIntake.ts (new file, same shape)
**What:** A Convex query filtered to the new lifecycle `commandType`(s) via a compound index (mirrors `by_commandType_createdAt`), adapted into a typed row shape, consumed by a `use*` hook.
**When to use:** D-08 says reuse `useIntake.ts`'s STATUS MODEL (`IntakeRowStatus`, `RowStatusBadge`) — it does not mean literally calling `useIntakeCommands()`, since that hook's Convex query is hardcoded to `commandType: "intake"` (`listIntakeCommands`, `convex/forge.ts` line ~1041) and its `IntakeCommandRow` shape has intake-specific fields (`destination`, `storageId`, `githubUrl`). A **new sibling hook and a new sibling query** are needed, reusing the `IntakeRowStatus` type/`mapIntakeStatus`-equivalent function/`RowStatusBadge` component verbatim, keyed additionally by **skill name** (not just `commandId`) so `SkillRow` can look up "is there an in-flight lifecycle command for me" — `IntakeCommandRow` has no skill-name field today because intake rows don't yet exist on disk to be identified by name; lifecycle rows act on an EXISTING named skill, so the payload must carry `skillName` explicitly.
**Example (schema shape to add, not existing code):**
```typescript
// New payload shape needed on forgeCommands (schema.ts) — modeled on intakePayload's
// v.optional(v.union(v.object({...}), v.null())) shape:
lifecyclePayload: v.optional(v.union(
  v.object({
    action: v.union(v.literal("archive"), v.literal("restore"), v.literal("move"), v.literal("delete")),
    skillName: v.string(),
    sourceOrigin: v.string(),           // exact origin string being acted on — resolves Pitfall 1
    destination: v.union(v.literal("global"), v.literal("project"), v.literal("cold")),
    workspaceId: v.union(v.string(), v.null()),  // required when destination === "project"
  }),
  v.null(),
)),
```

### Recommended Project Structure (new files)
```
forge/src/process/
├── lifecycle-exec.ts          # NEW — path resolution, collision/shadow re-check, fs move dispatch
└── lifecycle-exec.test.ts     # NEW

codepulse/convex/
└── forge.ts                   # MODIFY — add enqueue<Action> mutation(s), extend ackCommand adapter, new listLifecycleCommands query

codepulse/src/hooks/
└── useLifecycle.ts            # NEW — modeled on useIntake.ts, keyed by skillName+action

codepulse/src/components/skills/
├── SkillRow.tsx                # MODIFY — add ⋯ DropdownMenu trigger
├── ColdStorageView.tsx         # MODIFY — pass through new menu action handlers
├── SkillLifecycleMenu.tsx      # NEW — the ⋯ menu content, scope-gated per D-07/UI-SPEC §1
├── MoveToProjectDialog.tsx     # NEW — workspace-picker Dialog per UI-SPEC §4
└── DeleteSkillDialog.tsx       # NEW — type-to-confirm AlertDialog per UI-SPEC §5

codepulse/src/components/ui/
└── dropdown-menu.tsx           # NEW — via `npx shadcn add dropdown-menu`
```

### Anti-Patterns to Avoid
- **Calling `promoteWorkspace()`/`defaultPromoteFn` directly for a lifecycle move:** it is designed to THROW `ForgePromotionError` on cross-volume (D-06 in that module) — the opposite of what lifecycle move needs (cross-volume must succeed via copy+delete). Extract/adapt the internal helpers, don't call the exported function.
- **Assuming a skill row has exactly one "current scope":** the `skills` table is grouped by name across all origins (see Pitfall 1) — a row's `origins` array can have length > 1 among non-dormant entries. Any menu-item gating logic that reads `skill.origins[0]` or assumes singularity will silently act on the wrong instance.
- **Reusing `useIntakeCommands()`'s Convex query for lifecycle rows:** it is hardcoded to `commandType: "intake"` via a compound index scoped to that literal — a new query is required, not a filter added to the existing one (which would also let non-intake volume crowd out the `INTAKE_LIST_LIMIT`-bounded intake panel, regressing Phase 97's review fix #6).
- **Treating `fs.renameSync` as always-atomic across this host's actual directory layout:** global skills and cold storage share the C: volume (same-volume rename, fast/atomic) but ANY project-workspace path is on `G:\My Drive\forge-workspaces\...` (confirmed live in `forge/src/config/loader.ts`) — cross-volume for every move touching a project scope. This is the *common* case for move-to/from-project, not a rare fallback path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Post-mutation registry rescan | A new "walk skill dirs" function | `rescanAndSync`/`buildSkillSnapshot` (`forge/src/emit/skill-rescan.ts`) | Already built in Phase 97, already walks all three roots correctly, already has the fire-and-forget POST discipline. Zero changes needed — just call it. |
| Cross-volume directory copy on Windows/Google-Drive-for-Desktop | `fs.cpSync`, a naive recursive `fs.copyFileSync` loop, or a third-party package (`fs-extra`, `graceful-fs`) | `promote.ts`'s `copyTreeReadWrite` (plain `readFileSync`/`writeFileSync`, no `CopyFileEx`) | Already verified live on this exact host/Drive setup that `CopyFileEx`-backed APIs get rejected (EIO/EPERM) by Google Drive for Desktop's virtual filesystem — this is a solved, host-specific gotcha, not a hypothetical. |
| Command queue/TTL/expiry/idempotency | A new queue mechanism for lifecycle commands | `forgeCommands` table + existing `expireStaleCommands`/`shouldExpireCommand`/`FORGE_COMMAND_TTL_MS` | Already built and generic across `commandType` — the schema change is additive (new literals + new payload field), the state machine is unchanged. |
| Shadow/dormancy detection | A new client-side predicate | `isShadowing`/`isDormant` (`src/lib/skills.ts`) | Already implemented, already unit-tested, already exactly matches the `origins` array shape the registry produces. |
| Command-row status badge chips | New badge components for lifecycle states | `RowStatusBadge`/`SeverityBadge` (`IntakeStatusBadge.tsx`) | D-08 explicitly requires reuse; the component already handles `pending/queued/executing/failed/expired` with the exact visual treatment UI-SPEC references ("reuses `RowStatusBadge`'s existing `failed`/`executing` config verbatim"). |
| Workspace path resolution for "project" destination | A new `workspaceId → rootPath` lookup, or reversing `repoKey()`'s hash | `getWorkspace(db, workspaceId)` (`forge/src/store/workspaces.ts`), already used by `intake-runner.ts` | Already built, already the precedent Phase 97 established for exactly this resolution (D-04 there: "project destination target path resolved from synced Forge workspaces only ... no free-text host paths"). `repoKey()` is one-directional (path→hash) and was never meant to be reversed — always resolve via `workspaceId`, never by reverse-hashing an origin string. |

**Key insight:** Nearly all of Phase 98's infrastructure need is already built by Phase 97, one feature removed (workspace promotion) already solved the hardest sub-problem (cross-volume moves on this exact host), and the client-side shadow/dormancy logic has been sitting unused since it was written. The actual new engineering is thin: a new fs-move executor module, a schema/mutation extension following an established shape, and UI wiring already fully specified by the approved UI-SPEC.

## Runtime State Inventory

Not applicable — this phase is net-new mutation capability, not a rename/refactor/migration. No existing on-disk state, secrets, or OS registrations need updating for Phase 98 itself to ship. (The workspace-startup-snapshot issue noted in Claude's Discretion is a pre-existing Phase-97-era gap, not something Phase 98 renames or migrates — see Pitfall 5.)

## Common Pitfalls

### Pitfall 1: A skill row can be active in MULTIPLE scopes simultaneously — "current scope" is not always singular
**What goes wrong:** The ⋯ menu's gating logic (per UI-SPEC §1: "Active row: Archive, Move to {other scope}…") implicitly assumes exactly one non-dormant origin per row. But `convex/skillCategories.ts`'s `getSkillsWithOverrides` groups the `skills` table **by name across ALL origins** (`groupSkillRowsByName`) — a skill can be active globally AND in 2 different projects at once, all rendered as ONE `SkillRow` with `origins: ["claude-code", "claude-code:project:aaa", "claude-code:project:bbb"]`. `isShadowing` only detects the dormant+active co-existence case, not the active+active-in-multiple-scopes case.
**Why it happens:** Skills are a real filesystem concept per-directory-per-root; the registry deliberately aggregates them by name for display (so the user sees "this skill" once, not N times). Cold-storage rows are unambiguous (dormant origin is unique per name — confirmed via `isDormant`'s "every origin === DORMANT_ORIGIN" check, and a name can only have one dormant-origin row per the `by_name_origin` unique-per-pair index), but **active rows are not**.
**How to avoid:** Plan-phase must decide explicitly: (a) simplest/recommended — only enable Archive/Move when the row has exactly ONE non-dormant origin; when it has 2+, disable those menu items with an inline reason ("active in multiple scopes — use a future release to pick which one" or similar honest copy), deferring true multi-scope action-targeting to Phase 100's menu-polish pass; (b) harder — extend the menu to let the operator pick which origin instance to act on (adds real UI surface Phase 98's scope explicitly excludes per D-07's "simple menu now"). Recommend (a) — it's consistent with "don't pull Phase 100 work forward" and the House Honesty rule (an accurate "can't disambiguate yet" beats a silent wrong-instance mutation).
**Warning signs:** A skill active in two projects gets moved/archived and the operator can't predict (or control) which instance was touched; `enqueueMove`/`enqueueArchive`'s payload needs an explicit `sourceOrigin` field (not just a destination) to remove this ambiguity server-side regardless of which UI path is chosen.

### Pitfall 2: "Synced Forge workspaces" (D-04/CONTEXT.md discretion) means "synced to Convex," not workspace storage `class`
**What goes wrong:** Forge's SQLite `Workspace` type has a `class: 'synced' | 'local-only'` field (workspaces stored under `G:\My Drive\forge-workspaces` vs. a local-only C: root) — it is easy to misread CONTEXT.md's "synced Forge workspaces only" as "filter to `class === 'synced'`."
**Why it happens:** The term "synced" is overloaded. The actual precedent (Phase 97 D-04, and the live `listWorkspaces` Convex query used by `IntakeModal`'s workspace picker) filters to workspaces the daemon has **pushed up to the `forgeWorkspaces` Convex table** (`emitWorkspaces`, on a 60s interval + startup) — it does NOT filter by the SQLite `class` field at all; both `synced` and `local-only` workspaces appear identically in `api.forge.listWorkspaces`.
**How to avoid:** Reuse `api.forge.listWorkspaces` exactly as `IntakeModal` does — no new filter, no `class` check. The move-to-project destination picker should behave identically to intake's existing workspace `Select`.
**Warning signs:** A `local-only` workspace mysteriously missing from the move-destination picker if a `class`-based filter is (incorrectly) added.

### Pitfall 3: Cross-volume moves are the COMMON case for this phase, not a rare fallback
**What goes wrong:** Treating `fs.renameSync`'s cross-volume failure (EXDEV and friends) as an edge case that "might" need a fallback, sized/tested as an afterthought.
**Why it happens:** Global skills (`~/.claude/skills/`) and cold storage (`~/.claude/skills-available/`) both live under `C:\Users\mandr\.claude\` — same volume, atomic rename works. But EVERY project workspace lives at `G:\My Drive\forge-workspaces\<name>\.claude\skills\` (confirmed live, `forge/src/config/loader.ts`'s hardcoded `WORKSPACES_ROOT`). Any "Move to Project" or "Move to Global"/"Archive from a project skill" therefore crosses the C:↔G:\ boundary on THIS host's actual configuration — the fallback path is not an edge case, it is the expected path for any project-scope-involving lifecycle mutation.
**How to avoid:** Design and test the cross-volume copy+delete path as a first-class path, not an exception handler nobody exercises. Reuse `promote.ts`'s verified-live `copyTreeReadWrite` (plain read/write, not `cpSync` — Google Drive for Desktop's virtual FS rejects `CopyFileEx`-backed copies even for short paths, per that module's own comment and 2026-06-16 live verification) and its `CROSS_VOLUME_CODES` set (`EXDEV`, `EIO`, `EPERM`, `EACCES`, `ENOTSUP`).
**Warning signs:** A move-to/from-project test that only exercises same-volume rename would give false confidence — write at least one test (or a manual UAT step) that actually crosses the C:↔G:\ boundary, or injects a fake `renameFn` that throws one of the `CROSS_VOLUME_CODES` to exercise the fallback deterministically.

### Pitfall 4: Concurrent lifecycle commands on the SAME skill name have no daemon-side lock
**What goes wrong:** `CommandPoller`'s parallel dispatch (`void this.execute(cmd)`) means two lifecycle commands claimed in the same poll cycle for the same skill name (e.g., a rapid double-click, or a stale retry after a lost ack) could race — e.g., an Archive and a Delete-Permanently both resolving the same cold-storage path concurrently.
**Why it happens:** `launch`/`stop` are safe to run in parallel because they act on independent `forgeJobId`s; lifecycle commands act on a shared, named filesystem resource that intake's serial-queue precedent doesn't cover either (intake's serial queue exists to avoid a CLI *process* stampede, a different concern).
**How to avoid:** At minimum, the daemon-side D-04 layer-2 re-check (does dest already exist? does source still exist?) will catch most races as a collision refusal rather than data loss — `fs.renameSync`/`fs.rmSync` on a since-vanished path throws ENOENT, which should map to a clear "already moved/deleted" error rather than crashing the executor. Consider a lightweight in-memory per-skill-name mutex in the new lifecycle branch (a `Set<string>` of in-flight names, checked before dispatch, mirroring `intakeDraining`'s spirit but keyed by name instead of being fully serial) if the planner wants stronger protection — this is a genuinely open design question, not a solved precedent like intake's serial queue.
**Warning signs:** Two lifecycle commands acking `done` for the same skill name within the same poll cycle; a rescan afterward showing an unexpected origin state (neither the pre- nor post- state either mutation intended).

### Pitfall 5: Workspace list is a daemon-startup snapshot — stale for both intake AND lifecycle move-to-project
**What goes wrong:** `forge/src/index.ts`'s `rescanCfg.workspaces` is captured ONCE via `listWorkspaces(db)` at daemon start (confirmed live, `index.ts` lines ~150-159) — a workspace synced *after* the daemon starts won't appear in `rescanAndSync`'s project-scope walk until the next daemon restart. This was flagged as an open Phase-97 follow-up explicitly earmarked for Phase 98.
**Why it happens:** `rescanCfg` is constructed once at module-load time in `index.ts`, not re-read per rescan call.
**How to avoid:** This is Claude's Discretion in CONTEXT.md ("recommended, since move-to-project depends on fresh workspace paths"). Given LIFE-03 directly depends on correct, current workspace paths (a stale workspace list means a move-to-project that resolves to nothing, or a rescan that misses the destination), **recommend fixing this in Phase 98**: change `rescanCfg.workspaces` (and any lifecycle-executor path resolution) to call `listWorkspaces(db)` fresh at rescan/execution time rather than capturing the array once at startup. This is a small, contained change (the `RescanAndSyncDeps`/`BuildSkillSnapshotDeps` interfaces already accept a plain array — the fix is calling `listWorkspaces(db)` at the call site instead of passing a captured array reference).
**Warning signs:** A workspace synced mid-session doesn't appear as a move destination, or a rescan silently omits skills in that workspace, until the daemon is restarted.

### Pitfall 6: Reusing the `write-refused:<kind>:` error-string convention needs a NEW prefix, not the same one
**What goes wrong:** Phase 97's `synthesizeWriteRefusalReport` (`convex/forge.ts`) parses errors strictly matching `^(write-refused|post-placement-warning):([^:]+):([\s\S]*)$` and is invoked only for `cmd.commandType === "intake"`. Reusing the literal string `write-refused:` for a lifecycle collision/shadow error would either (a) not be picked up at all (the adapter gates on `commandType === "intake"`) or (b) require loosening that gate in a way that risks intake-specific copy composition (`composeWriteRefusalHouseCopy`'s destination-aware collision phrasing) firing incorrectly for a lifecycle payload shape it wasn't written for.
**How to avoid:** Mint a distinct prefix (e.g. `lifecycle-refused:<kind>:<raw>`) and either extend `ackCommand`'s adapter dispatch to route by `commandType` to a new sibling composer function (recommended — keeps intake's composer untouched and testable in isolation) or write a wholly separate adapter reusing the same parse-prefix/extract-kind structural pattern. Either way, the exact house copy strings are already fully specified in 98-UI-SPEC.md's Copywriting Contract (cold-collision, move-target-collision, shadow-block messages) — compose those verbatim, don't improvise new phrasing.
**Warning signs:** A lifecycle refusal shows a raw daemon error string (or intake-flavored copy) instead of the UI-SPEC's specified house copy.

## Code Examples

### Existing dispatch-by-commandType shape to extend (forge)
```typescript
// Source: forge/src/emit/command-poller.ts, lines 239-256 (live) — execute()'s current shape;
// lifecycle needs executeIntake()'s richer shape instead (rescan trigger), not this bare one.
private async execute(cmd: ForgeCommand): Promise<void> {
  let status: 'done' | 'failed' = 'done';
  let error: string | undefined;
  try {
    if (cmd.commandType === 'launch') { /* ... */ }
    else if (cmd.commandType === 'stop') { /* ... */ }
    // Unknown commandType: ack as done (defensive) — lifecycle types must NOT
    // fall into this silent no-op branch once added.
  } catch (err) { status = 'failed'; error = err instanceof Error ? err.message : String(err); }
  // ack fires unconditionally...
}
```

### Existing idempotent-enqueue + pre-flight-validation shape to mirror (Convex)
```typescript
// Source: codepulse/convex/forge.ts, enqueueIntake, lines 700-771 (live) — the exact
// shape (Clerk fail-closed, commandId idempotency, pre-insert validation, buildXRow
// helper) new enqueue<Action> mutations should copy.
export const enqueueIntake = mutation({
  args: { hostId: v.string(), commandId: v.string(), /* ... */ },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Authentication required to issue Forge commands");
    const existing = await ctx.db.query("forgeCommands")
      .withIndex("by_commandId", (q) => q.eq("commandId", args.commandId)).unique();
    if (existing) return; // idempotent retry no-op
    // ... XOR/shape validation before insert ...
    await ctx.db.insert("forgeCommands", row);
  },
});
```

### Existing forgeCommands schema extension pattern (backward-compat via v.optional)
```typescript
// Source: codepulse/convex/schema.ts, lines 1680-1690 (live) — intakePayload's
// v.optional(v.union(v.object({...}), v.null())) wrapper is the precedent for adding
// lifecyclePayload alongside it: existing rows (launch/stop/intake, all supplying
// their own payload explicitly as null) remain schema-valid with zero migration.
intakePayload: v.optional(v.union(
  v.object({ destination: v.union(v.literal("global"), v.literal("project"), v.literal("cold")), /* ... */ }),
  v.null()
)),
// lifecyclePayload should follow this EXACT wrapper shape.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| CONTEXT.md's framing (written before this research pass): "the daemon must build a shadow-aware, dormant-tracking mutation surface from scratch" | Nearly the entire non-UI substrate (queue, TTL, rescan, dormancy/shadow helpers) already exists from Phase 97 — Phase 98's real delta is a native-fs executor module + schema/mutation extension + UI wiring | Phase 97 merged 2026-07-18/19 (forge `8a144c1`), days before this research | Phase 98's actual engineering surface is narrower than CONTEXT.md's framing suggests, similar in spirit to how 97-RESEARCH.md found Phase 97 narrower than its own ROADMAP framing |
| Workspace promotion's `promoteWorkspace` assumed same-volume, refuses cross-volume as an error (D-06 in that module) | Lifecycle move needs the opposite policy — cross-volume is the expected, must-succeed case | N/A — this is Phase 98's own new design decision, informed by promote.ts's existing (differently-scoped) precedent | Do not reuse `promoteWorkspace` as-is; adapt its internals only |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fs.renameSync` on the SAME NTFS volume (e.g., archive between `~/.claude/skills/` and `~/.claude/skills-available/`, both on C:) is atomic and requires no fallback — standard Node/Windows behavior, not specific to this host. | Architecture Patterns / Pitfall 3 | Low risk — this is standard OS/filesystem behavior, not a host-specific assumption; if wrong, the cross-volume fallback path (Pattern 3) still produces a correct (if slightly slower) result since copy+delete works on same-volume moves too. |
| A2 | No daemon-side capability probe (unlike `probeIntakeCli`) is needed for lifecycle types — native fs operations have no "tool not installed" failure mode to gate `supportedTypes` on. | Architecture Patterns, Summary | Low risk. If some environment genuinely lacks fs write access (e.g., a permissions issue), the D-04 layer-2 daemon-side check / the fs call itself will surface a clear error on first attempted execution rather than being silently unadvertised — an acceptable degradation, not a data-loss risk. |
| A3 | A lightweight in-memory per-skill-name lock for concurrent lifecycle commands (Pitfall 4) is NOT required for Phase 98 to ship safely, given the daemon-side existence re-check will catch most races as a clean collision refusal rather than silent corruption. | Pitfall 4 | Medium risk if wrong — a genuine race (e.g., archive + delete-permanently on the same cold-storage row within one poll cycle) could theoretically interleave two fs operations mid-flight. Recommend the planner explicitly decide whether to add the mutex or accept the race window, rather than this going unaddressed by omission. |

**Risk profile:** A1/A2 are low risk (standard OS behavior / conservative design choice). A3 is a genuine open design question the planner should resolve explicitly rather than silently inherit.

## Open Questions

1. **One `commandType` per action, or one `"lifecycle"` type with an `action` field?**
   - What we know: the existing `commandType` union (`v.union(v.literal("launch"), v.literal("stop"), v.literal("intake"))`) adds a literal per distinct command shape today. Four new literals (`archive`/`restore`/`move`/`delete`) vs. one `"lifecycle"` literal with an internal `action` discriminator inside `lifecyclePayload` are both structurally valid Convex schema patterns.
   - What's unclear: which reads better against `resolveClaimTypes`'s `supportedTypes` capability-negotiation array (four new entries vs. one) and against `CommandPoller`'s dispatch `if/else if` chain (four branches vs. one branch with an inner switch).
   - Recommendation: plan-phase should decide explicitly. A single `"lifecycle"` type with an `action` field keeps `supportedTypes` and the capability-negotiation surface smaller (one flag = "this daemon can do lifecycle mutations at all") and mirrors how `intakePayload` already carries a `destination` discriminator inside one payload shape rather than three separate `commandType`s for global/project/cold — this precedent slightly favors the single-type approach, but four explicit literals give clearer TTL/audit-log semantics per action. Not a blocking decision either way.

2. **Where does the daemon-side D-04 layer-2 shadow/collision re-check live, and does it need its own reusable helper?**
   - What we know: no existing daemon-side function performs "does an active copy of this skill name exist at another origin" — `isShadowing` is a browser-only helper (`src/lib/skills.ts`) operating on the Convex-shaped `origins` array, not on live filesystem state.
   - What's unclear: whether the daemon re-check should be a fresh, small `fs.existsSync` check against the three known root paths (simplest, mirrors `readSkillsDir`'s directness) or should share logic with `buildSkillSnapshot`'s walk (more DRY, more coupling).
   - Recommendation: a small, standalone `fs.existsSync(path.join(root, skillName))` check per relevant root is almost certainly sufficient and simpler to unit-test than coupling to the full snapshot walker — recommend the standalone approach, but this is a genuinely open implementation-detail decision for the planner/executor.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `fs` (`renameSync`, `readFileSync`/`writeFileSync`, `rmSync`, `mkdirSync`) | All four lifecycle mutations | ✓ `[VERIFIED: live]` — Node 22.22.3, forge `package.json` requires `>=22.13` | 22.22.3 | — (built-in, no fallback needed) |
| `G:\My Drive\forge-workspaces` (Google Drive for Desktop mount) | Move-to/from-project, archive-from-project | Not re-verified this session (assumed live per Phase 97/promote.ts's prior verification) — confirm mount is live before executing move UAT | — | If unmounted, a project-scope move would fail with a clear fs error (ENOENT on the workspace root) surfaced through the same error path as any other collision — no silent failure mode |
| `radix-ui` npm package (already installed) | New `dropdown-menu` shadcn primitive | ✓ `[VERIFIED: live]` — `package.json` `"radix-ui": "^1.4.3"` | 1.4.3 | — |
| shadcn CLI (`npx shadcn add dropdown-menu`) | Generating the new UI primitive file | Assumed available (already used to init this project — `components.json` present, confirmed live) | — | Manually author `src/components/ui/dropdown-menu.tsx` following the existing `dialog.tsx`/`select.tsx` `radix-ui` import convention if the CLI is unavailable at execution time |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** Drive-mount unavailability (fails loud, not silently) and shadcn CLI unavailability (manual file authoring, following an established in-repo pattern) both have clear, low-risk fallbacks.

## Validation Architecture

### Test Frameworks (two repos)
| Repo | Framework | Config | Quick run | Full suite |
|------|-----------|--------|-----------|------------|
| codepulse | Vitest | `vite.config.ts` | `npx vitest run convex/forge.test.ts src/lib/skills.test.ts src/components/skills/SkillRow.test.tsx` | `npm test` |
| forge | Vitest | `vitest.config.ts` | `npx vitest run src/process/lifecycle-exec.test.ts src/emit/command-poller.test.ts` | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-01 | Archive: active skill moves to cold storage, same-volume rename path | unit | new `lifecycle-exec.test.ts` (forge) | ❌ Wave 0 — module doesn't exist yet |
| LIFE-01/03 | Cross-volume move fallback (copy+verify+delete) actually exercised, not just same-volume | unit (injected fake renameFn throwing EXDEV) + manual UAT (real C:↔G:\ move) | new `lifecycle-exec.test.ts` (forge) + operator checkpoint | ❌ Wave 0 |
| LIFE-02/LIFE-05 | Shadow-blocked restore refused both client-side (disabled menu item) and server-side (Convex + daemon re-check) | unit ×3 layers | `npx vitest run src/lib/skills.test.ts` (already covers `isShadowing`) + new Convex mutation test + new daemon re-check test | ⚠ client helper covered; Convex/daemon layers are Wave 0 |
| LIFE-04 | Permanent delete only reachable from cold-storage rows, type-to-confirm gates the destructive button | unit (component) + manual | new `DeleteSkillDialog.test.tsx` | ❌ Wave 0 |
| LIFE-06 | Offline-daemon lifecycle command shows queued/expiring, never false success | unit (reuses existing `shouldExpireCommand`/`RowStatusBadge` test coverage — behavior is inherited, not new) | `npx vitest run convex/forge.test.ts src/components/skills/IntakeStatusBadge.test.tsx` | ✅ underlying mechanism already tested; new lifecycle-specific row-mapping test still needed |
| DAEMON-02 | New `commandType`(s) dispatch correctly, ack fires, rescan triggers on success only | unit | `npx vitest run src/emit/command-poller.test.ts` (forge, extend) | ✅ file exists, needs new cases — Wave 0 |

### Sampling Rate
- **Per task commit:** run the relevant repo's quick-run command.
- **Per wave merge:** full suite in whichever repo(s) touched that wave; cross-repo waves need both `forge`'s and `codepulse`'s full suites green.
- **Phase gate:** full suite green in both `forge` and `codepulse` before `/gsd:verify-work`; at least one manual UAT step exercising a real cross-volume move (Pitfall 3) before sign-off, since this is the one behavior that cannot be meaningfully proven by a same-host unit test alone (the fallback branch can be unit-tested via an injected fake, but the real Drive-mount interaction needs a live check, mirroring 97-RESEARCH's precedent for live-daemon-required checks).

### Wave 0 Gaps
- [ ] `forge/src/process/lifecycle-exec.ts` + `.test.ts` — module does not exist yet (path resolution, collision/shadow re-check, fs move dispatch, cross-volume fallback)
- [ ] `codepulse/convex/forge.test.ts` — new test cases for `enqueue<Action>` mutations' pre-flight checks (shadow-block, cold-collision, move-collision) and idempotency
- [ ] `codepulse/src/hooks/useLifecycle.test.ts` (or equivalent) — new hook, modeled on `useIntake.ts`'s existing test coverage
- [ ] `codepulse/src/components/skills/ColdStorageView.test.tsx` — **does not exist today** (confirmed via directory listing) — worth adding given this phase adds real mutation actions to that view for the first time
- [ ] `codepulse/src/components/skills/SkillLifecycleMenu.test.tsx`, `MoveToProjectDialog.test.tsx`, `DeleteSkillDialog.test.tsx` — new components, no tests yet
- [ ] Decide the Open Question 1 (`commandType` shape) and Open Question 2 (daemon re-check helper location) before writing their tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | yes | Clerk fail-closed auth on all new `enqueue*` mutations (mirror `enqueueIntake`'s D-13 pattern exactly — do not use the read-query graceful-skip convention for any write path); bearer-authed claim/ack httpActions unchanged from Phase 80/97 |
| V5 Input Validation | yes | `skillName`/`sourceOrigin`/`workspaceId` must be validated server-side before insert (exact-match against the live `skills` registry rows for pre-flight collision/shadow checks — never trust client-supplied origin strings blindly, since a compromised/buggy client could otherwise request a move of a name that doesn't actually exist at the claimed origin) |
| V6 Cryptography | no | Not applicable |
| V12 File/Resource Handling | yes | Path construction for all four roots (global/cold/project) MUST be built from fixed root constants + a validated skill-name segment — never accept a client-supplied absolute path or a path containing `..`/drive-letter prefixes (mirror `isSafeSubpath`'s existing traversal-rejection discipline from Phase 97, applied here to `skillName` instead of a GitHub subpath) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Path traversal via a crafted `skillName` (e.g. `../../Users/mandr/AppData`) reaching a real fs op | Tampering | Validate `skillName` is a bare directory-name segment (no path separators, no `..`, no drive-letter/absolute-path shape) before joining it onto any root path — analogous to Phase 97's `isSafeSubpath`, but stricter since this phase performs REAL writes/deletes, not just a validated CLI invocation |
| A client requesting `delete` on a skill it claims is "cold" when it's actually still active elsewhere (bypassing D-05's cold-only rule via a stale/forged origin claim) | Elevation of Privilege / Tampering | Daemon-side re-check (D-04 layer 2) must verify the skill genuinely exists ONLY at the cold-storage root before permitting `fs.rmSync` — never trust the client's/Convex's cached `origin` claim for the actually-destructive delete path |
| Race between two lifecycle commands on the same skill name (Pitfall 4) causing an unintended interleaved fs state | Tampering (data-integrity, not malicious) | See Pitfall 4 — daemon-side existence re-check at minimum; consider a per-name in-flight lock for stronger guarantees |
| Symlink/junction inside a skill directory being moved (an attacker- or accident-planted reparse point escaping the intended tree) | Tampering / Information Disclosure | `promote.ts`'s `defaultReparseScanner` (lstatSync-based junction/symlink detection, already built and tested) is a directly reusable pre-move safety check — worth applying to lifecycle moves too, even though CONTEXT.md doesn't explicitly mandate it, since the underlying threat (a skill directory containing an unexpected reparse point) applies equally here |

## Sources

### Primary (HIGH confidence — live code read this session)
- `C:\Users\mandr\forge\src\emit\command-poller.ts`, `skill-rescan.ts`, `intake-types.ts` — daemon command dispatch, rescan module, payload contracts (full files read)
- `C:\Users\mandr\forge\src\workspace\promote.ts` — cross-volume move precedent, `copyTreeReadWrite`, `CROSS_VOLUME_CODES`, reparse-point scanner (full file read)
- `C:\Users\mandr\forge\src\store\workspaces.ts`, `src\types\index.ts`, `src\config\loader.ts` — Workspace shape, `class` field, live confirmation of `G:\My Drive\forge-workspaces` root
- `C:\Users\mandr\forge\src\process\intake-exec.ts` — current real-write exit-code contract, `buildAdmitArgs` (confirms `--write` is already live, Phase 97 fully shipped)
- `C:\Users\mandr\codepulse\convex\forge.ts` (full `enqueueIntake`/`ackCommand`/`synthesizeWriteRefusalReport`/`resolveClaimTypes`/`claimAndUpsertHost` read), `schema.ts` (targeted, `forgeCommands` table definition), `registry.ts` (full `syncInventory` read)
- `C:\Users\mandr\codepulse\src\lib\skills.ts` (full file — `isShadowing`/`isDormant`), `src\hooks\useIntake.ts` (full file), `src\components\skills\IntakeStatusBadge.tsx` (full file), `SkillRow.tsx`, `ColdStorageView.tsx`, `AllSkillsOverview.tsx`, `SkillsInCategory.tsx` (full files) — confirmed the multi-origin grouping finding (Pitfall 1) via `convex/skillCategories.ts`'s `getSkillsWithOverrides`
- `C:\Users\mandr\codepulse\src\components\skills\IntakeModal.tsx` (targeted, workspace-picker section) — confirmed `api.forge.listWorkspaces` has no `class`-based filter (Pitfall 2)
- `.planning/phases/97-skill-lifecycle-management/97-RESEARCH.md`, `97-PATTERNS.md`, `deferred-items.md` — prior-phase research, confirmed still accurate against live code this session (git log cross-checked: forge `master` at `8a144c1`, one commit past 97-06)
- Live host checks this session: `npm view @radix-ui/react-dropdown-menu version` (2.1.21, informational), `grep radix-ui package.json` (confirms unified `radix-ui` meta-package v1.4.3 already installed), `node --version` (22.22.3), directory listings confirming `dropdown-menu.tsx` absent from `src/components/ui/` and `ColdStorageView.test.tsx` absent from `src/components/skills/`

### Secondary / Tertiary
None — every claim in this document was verified directly against live repository code this session; no WebSearch or training-data-only claims were needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every reused component verified live in both repos
- Architecture: HIGH — full command-dispatch, rescan, and cross-volume-move paths read end-to-end across both repos, including the exact multi-origin data-grouping finding (Pitfall 1) traced to its source query
- Pitfalls: HIGH — each pitfall is a direct code-read finding (multi-origin grouping in `skillCategories.ts`, live `G:\My Drive` workspace root in `loader.ts`, `promoteWorkspace`'s refuse-on-EXDEV design), not inferred from training data

**Research date:** 2026-07-21
**Valid until:** 14 days (fast-moving — forge's `master` is under active iteration on unrelated phases; re-verify `forge`'s `master` HEAD and re-confirm the Drive-mount/workspace-root configuration haven't changed before planning executes)
