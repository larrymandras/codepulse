# Phase 98: Skill Lifecycle Mutations (Archive / Restore / Move / Delete) - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the read-only skill rows into live lifecycle controls: **archive** (active → `.claude/skills-available/` cold storage), **restore** (dormant/cold → active global or project), **move** (global ↔ project), and **delete** (archive-first; true deletion cold-only behind an explicit confirm). Every mutation is executed atomically on the host by the Forge daemon via new `forgeCommands` lifecycle command types, followed by a registry rescan (`rescanAndSync` → `registry.syncInventory`) so CodePulse reflects host truth. Guards: `isShadowing`-aware restore, fail-clean collisions, and honest offline behavior (queue + visible expiry, never false success).

**In scope:** LIFE-01..06, DAEMON-02. Cross-repo: codepulse (UI actions + Convex enqueue/pre-checks/status) + `C:\Users\mandr\forge` (daemon lifecycle executor + rescan).
**Not in scope (later phases):** launch/dispatch (Phase 99); polished control-surface UX — drag lanes, optimistic lane-move reconcile, full ⋯ menu polish, in-app Cold Storage restore UX completion (Phase 100); bulk multi-select; skill versioning/overwrite-update.

</domain>

<decisions>
## Implementation Decisions

### Executor Engine
- **D-01:** The daemon performs lifecycle mutations **natively in TS** (directory renames/moves in the forge daemon) — it does NOT shell out to Python tooling. Rationale: lifecycle ops are plain fs moves needing no validation pipeline (unlike install); the daemon already owns this fs surface (`skill-rescan.ts` walks all three roots); `skill-intake` is install-only and `manage-skills` is a SKILL.md procedure, not a binary. **Rejected:** extending the skill-intake CLI with lifecycle verbs (cross-repo work + Python round-trip for a rename).
- **D-02:** **Cold-storage name collision on archive fails clean** — if a dormant same-name copy already exists in `.claude/skills-available/`, the archive fails with an actionable error ("a dormant copy of X already exists") and nothing moves. Operator resolves manually (true-delete or rename the old cold copy first). Consistent with Phase 97's D-07 (never silent overwrite). Same fail-clean rule applies to move-target collisions (same-name skill already active at the destination scope).

### isShadowing Guard (LIFE-05)
- **D-03:** Shadow conflict on restore is a **hard block** — restoring a dormant skill whose name is already active at the target scope is refused with a clear error ("skill-x is active in global — archive it first"). Two deliberate steps; **rejected:** a compound one-click "swap" (would require an atomic two-mutation command) and allow-with-warning (Claude Code resolves skills by directory name, so a duplicate active name is a real conflict).
- **D-04:** The shadow check is enforced at **both layers**: Convex `enqueue` pre-checks against the registry (instant feedback, no doomed queued command) AND the daemon re-verifies against the live filesystem at execution time — host truth wins over a possibly-stale registry.

### Delete Semantics (LIFE-04)
- **D-05:** **True (permanent) deletion is allowed only from cold storage.** Active skills can only be archived; the permanent-delete action exists solely on cold-storage rows, forcing every deletion through the reversible archive state first (strongest reading of the archive-don't-rm house rule).
- **D-06:** Permanent deletion requires a **type-the-skill-name confirmation** (GitHub-style): the confirm dialog's destructive button stays disabled until the user types the skill's exact name. `.claude/` is gitignored — there is no git safety net. shadcn AlertDialog + Input.

### Phase-98 UI Surface
- **D-07:** Ship a **simple shadcn DropdownMenu (⋯) on SkillRow / ColdStorageView now**, showing only the scope-valid actions (Archive / Restore / Move / Delete). Phase 100 upgrades this menu in place (drag lanes, polish) rather than relocating actions — no throwaway buttons.
- **D-08:** While a lifecycle command is queued/executing, the **row stays in its current lane with a pending/executing badge** (reuse the intake status mapping from `useIntake`); it flips lanes only when the rescan lands. If the daemon is offline, the row shows the honest queued-will-expire state (LIFE-06, mirrors intake's expired path). Optimistic lane-move + reconcile is explicitly Phase 100 (UX-03) — do not pull it forward.
- **D-09:** A shadow-blocked restore is surfaced as a **disabled Restore item with a tooltip/inline reason** ("shadowed by active global skill-x — archive it first"), computed client-side with the existing `isShadowing` helper (`src/lib/skills.ts:26`, coded-but-unused until now). The daemon re-check (D-04) backstops registry staleness.

### Claude's Discretion
- Archive (the default "delete" on an active row) is reversible — light or no confirmation dialog.
- "Move → project" destination picker: reuse the intake workspace-picker pattern (Phase 97 D-04, synced Forge workspaces only) as a small dialog off the menu; exact form is Claude's call.
- Lifecycle `commandType`/payload shape and how `supportedTypes`/`resolveClaimTypes` advertise the new types (DAEMON-02/04) — follow the launch/stop/intake precedent.
- Atomic move mechanics (same-volume rename vs copy-verify-delete for cross-volume workspace targets) — planner/executor decides; the "no partial state on disk" guarantee stands.
- Whether to fix the forge `index.ts` workspace-startup-snapshot follow-up (workspaces resolved once at daemon start; see 97 deferred-items) inside this phase — recommended, since move-to-project depends on fresh workspace paths.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/ROADMAP.md` §"### Phase 98: Skill Lifecycle Mutations (Archive / Restore / Move / Delete)" — goal, 5 success criteria, carried-forward design cautions (line ~511)
- `.planning/REQUIREMENTS.md` — LIFE-01..06, DAEMON-02 (+ DAEMON-03/04 context from Phase 97) and traceability table

### Prior phase context (decisions carried forward)
- `.planning/phases/97-skill-lifecycle-management/97-CONTEXT.md` — D-01 (one daemon/one poller), D-03 (full rescan + `syncInventory` after every write), D-04 (project scope = synced workspaces only), D-07 (fail-clean collisions); known landmine: `~/.claude/skills/` write ACLs (codex-sandbox; `icacls` grant fix)
- `.planning/phases/97-skill-lifecycle-management/deferred-items.md` — OPEN: forge `index.ts` workspaces are a startup snapshot, flagged "pick up in Phase 98 or a quick-fix"; also `verifyDriveMount` test timeouts (pre-existing) and `skill-rescan.ts` tsc strict-null status (fixed in `cde56dc`)
- `.planning/phases/97-skill-lifecycle-management/97-0*-SUMMARY.md` — what Phase 97 actually shipped (intake-exec structured error prefixes, skill-rescan snapshot/emitter, command-poller rescanCfg seam, Convex `synthesizeWriteRefusalReport` adapter, install-language UI copy)

### CodePulse surfaces to extend (don't rebuild)
- `convex/forge.ts` — `enqueueIntake` (enqueue precedent + Clerk fail-closed auth), `resolveClaimTypes`, `capAckReport`, `synthesizeWriteRefusalReport` (house-copy adapter precedent for lifecycle refusals)
- `convex/forgeCommands.ts` — claim/ack httpActions, `supportedTypes` validation
- `convex/registry.ts` — `syncInventory` (rescan sink)
- `src/lib/skills.ts` (line ~26) — `isShadowing` / `isDormant` helpers, coded-but-unused; this phase wires `isShadowing`
- `src/components/skills/SkillRow.tsx`, `src/components/skills/ColdStorageView.tsx` — rows that gain the ⋯ menu (ColdStorageView's "run `/manage-skills` in a terminal" dead-end is what restore/delete replace)
- `src/hooks/useIntake.ts` — optimistic-row/status-mapping conventions to reuse for lifecycle command rows
- `src/components/skills/IntakeModal.tsx` — workspace-picker pattern for "Move → project"

### Cross-repo (daemon side)
- `C:\Users\mandr\forge` — `src/process/command-poller.ts` (claim → execute → ack loop + rescanCfg seam; lifecycle branch lands here), `src/emit/skill-rescan.ts` (buildSkillSnapshot/rescanAndSync — fire after every successful mutation), `src/process/intake-exec.ts` (structured `write-refused:<kind>:` error-string pattern to mirror for lifecycle refusals), `index.ts` (rescanCfg/workspace wiring)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`forgeCommands` transport**: claim/ack, TTL/expiry, Clerk fail-closed auth — lifecycle commands are new `commandType`s on the exact same queue; no new transport.
- **`rescanAndSync` (forge)**: the full-rescan-and-post module Phase 97 built is the DAEMON-03 half of every lifecycle mutation — call it after each successful move/delete.
- **`resolveClaimTypes` / `supportedTypes`**: capability negotiation already prevents old daemons claiming unknown types — extend the advertised list with the lifecycle types.
- **`synthesizeWriteRefusalReport` (convex/forge.ts)**: the structured-error → house-copy adapter pattern; lifecycle refusals (shadow block, collision) should emit the same `<kind>:<message>` style and map through an equivalent adapter.
- **`isShadowing` (src/lib/skills.ts)**: client-side helper already computes the shadow state — D-09 wires it into menu-item disabling.
- **`useIntake` status mapping + optimistic rows**: pending/executing/done/failed/expired lifecycle row states reuse this wholesale (D-08).

### Established Patterns
- **Surface-Substrate bridge**: browser/Convex never touches the filesystem; all host mutations flow through `forgeCommands` and the daemon executes locally.
- **Fail-clean, never silent overwrite** (97 D-07): extended here to cold-collision (D-02) and shadow conflicts (D-03).
- **Honest-state house rule**: no false success; expired-command path is the offline UX (LIFE-06).

### Integration Points
- Daemon `CommandPoller` lifecycle branch → native fs move → `rescanAndSync` → `registry.syncInventory` → Skills page auto-updates via Convex reactivity.
- Convex enqueue mutations (one per lifecycle action, or one parameterized) with registry pre-checks (D-04) before insert.
- ⋯ menu on `SkillRow`/`ColdStorageView` → enqueue → command row → badge states on the row.

### Known Landmines
- **`~/.claude/skills/` ACLs**: Phase 82/97 hit codex-sandbox ACL blocks; writes may need the `icacls <dest> /grant <USERNAME>:(OI)(CI)F /T` best-effort grant so the daemon and rescan can read back what they wrote (memory: `forge-codex-sandbox-acl-blocks-reads`).
- **Workspace list is a startup snapshot** in forge `index.ts` — move-to-project must not rely on a workspace synced after daemon start unless this is fixed (see Claude's Discretion).

</code_context>

<specifics>
## Specific Ideas

- GitHub-style type-the-name confirm for permanent deletion — Larry explicitly wants the strongest misclick protection because `.claude/` has no git safety net.
- Build the ⋯ menu once, simply, and let Phase 100 upgrade it in place — Larry rejected throwaway inline buttons.
- Keep rows honest, not optimistic: badge-in-place until the rescan proves the move (optimistic reconcile is Phase 100's job).

</specifics>

<deferred>
## Deferred Ideas

- **Optimistic lane-move + reconcile** and **drag across scope lanes** — Phase 100 (UX-02/03).
- **One-click "swap"** (archive active + restore dormant as a compound atomic command) — rejected for this phase in D-03; could be revisited as a Phase 100+ convenience once single mutations are proven.
- **Persistent "shadowed" badge on dormant rows** (beyond disabled-restore-with-reason) — Phase 100 visibility polish.
- **Bulk multi-select lifecycle actions** — already deferred in REQUIREMENTS.
- **OS Recycle-Bin backstop for permanent delete** — considered, not chosen; could soften true-delete later if ever needed.

</deferred>

---

*Phase: 98-skill-lifecycle-mutations-archive-restore-move-delete*
*Context gathered: 2026-07-21*
