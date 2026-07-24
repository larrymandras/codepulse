# Phase 100: Control-Surface UX (⋯ Menu, Drag Lanes, Optimistic Reconcile) - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the Skills page as an efficient control surface over the mutations that Phases 98 (lifecycle: archive/restore/move/delete) and 99 (Run/launch chooser) already ship. Add **drag-across-scope-lanes** as a second path to the lifecycle mutations, give in-flight mutations an **optimistic-with-honest-rollback** row state, and finish the **⋯-menu / Cold-Storage-restore completeness** started in 98/99.

**This is a codepulse-only, frontend-focused phase.** All host mutations already exist in the Forge daemon (Phase 98 `enqueueLifecycle` → daemon `lifecycle-exec` → rescan) and all launch paths exist (Phase 99). **No new daemon / cross-repo work and no new Convex mutation is expected** — the drag matrix reuses `enqueueLifecycle` exactly as the ⋯ menu already calls it.

**In scope:** UX-01, UX-02, UX-03, UX-04 — the UI control surface (scope-rail drop targets, optimistic reconcile, menu/restore completeness).
**Not in scope (later / other surfaces):** any new lifecycle mutation or daemon change; restore-to-project (deliberately left global-only — see D-02); compound "swap"/atomic multi-mutation; bulk multi-select; the cross-repo armory tiles + tool-receipts note (D-07, deferred); skill versioning/overwrite-update.

</domain>

<decisions>
## Implementation Decisions

### Scope-Lane Layout & Drag (UX-02)
- **D-01:** **Add a "Scope" section to the existing left rail**, below the Categories grid, exposing **Global / Project / Cold Storage** as drop targets. Dragging a skill row onto a scope entry fires the corresponding lifecycle mutation. The Categories grid **stays droppable for re-categorization** (`handleDropOnCategory` → `updateOverride`, cosmetic category, unchanged). The two drag behaviors coexist cleanly because they are **different DOM drop targets** — the same `dataTransfer` payload (`text/plain = skill.name`, already set in `SkillRow.tsx:83-85`) is disambiguated by *which* target receives the drop: category grid → `updateOverride` (category), scope rail → `enqueueLifecycle` (scope). The two are independent (a scope move never changes category, and vice-versa). Reuse `CategoryGrid`'s existing `onDragOver`/`onDrop` + `dropTargetCategory` highlight pattern for the scope rail. **Rejected:** kanban 3-column restructure (biggest relayout, demotes category from primary IA to a filter); transient drag-only overlay (drop targets hidden until drag-start = less discoverable).

- **D-02:** **The drag action matrix mirrors exactly what the ⋯ menu already permits — no new mutation, no drag-only capability.** Mapping:
  - active row (any scope) → **Cold** = archive
  - active-**global** row → **Project** = move-to-project (opens the picker, see D-03)
  - active-**project** row → **Global** = move-to-global
  - dormant/cold row → **Global** = restore (global-only)
  - dormant/cold row → **Project** = **rejected** — restore is global-only (Phase 98 Plan 04). The Project lane refuses a cold row with a not-allowed cursor + honest hint ("restore to Global first, then move"). Restore-then-move stays two deliberate steps.
  - drop onto the row's **own current scope** / any invalid target = no-op (honest, no fake success).
  - **Rejected:** extending restore to accept a project destination (adds a project-destination restore path + project-scope shadow pre-check that 98 deliberately left global-only); compound restore-then-move as one gesture (98 explicitly rejected non-atomic compound mutations).

- **D-03:** **"Project" is a single drop target; dropping a movable row on it opens the existing Phase 98 `MoveToProjectDialog` workspace picker** to choose which of the 5 synced repos (Project scope spans 5 repos — `Skills.tsx:53` "five repos must not all render as Project"). **Rejected:** per-workspace sub-lanes (visual clutter that grows with repo count; workspaces are dynamic); an "active-workspace default" (the Skills page has no clear ambient current-workspace to default to).

- **D-04:** **Drag never deletes.** Scope lanes are **Global / Project / Cold only** (move / archive / restore). There is **no trash / delete drop target**. Permanent deletion stays behind the ⋯ menu's type-the-exact-name confirm dialog (Phase 98 D-05/D-06). Rationale: `.claude/` has no git safety net; an accidental destructive drag is unacceptable. **Rejected:** a dedicated trash drop zone (even gated by the confirm dialog, dragging onto trash is an easy misfire).

### Optimistic Reconcile (UX-03)
- **D-05:** **Optimistic move WITH honest rollback.** On drop, the row **moves to the destination lane immediately** with a visible **"pending" shimmer/badge that explicitly does NOT claim success** (not "done"). Reconcile against the lifecycle **command-row status** (reuse the `useIntake` / lifecycle status mapping — queued → executing → done / failed / expired): on **done** (rescan-confirmed), the row settles in the destination and the shimmer clears; on **failed / expired**, the row **snaps back to its source lane with a toast** surfacing the daemon's honest refusal/expiry reason. The optimistic layer is **client-only ephemeral state and MUST reconcile to server truth — optimism is never persisted.** This satisfies UX-03's "optimistic" wording while honoring the "honest state, no false success" house rule because the pending state is always visibly unconfirmed. **Rejected:** stay-in-place pending badge (≈ Phase 98's existing behavior — barely "optimistic"); ghost-in-destination (two rows per skill reads busy/confusing).

### UX-01 / UX-04 Completeness (not net-new)
- **D-06:** **Treat UX-01 (⋯ menu) and UX-04 (cold restore) as completeness / consistency + live verification, not new construction** — both are largely shipped by 98/99.
  - **UX-01:** audit that the scope-gated ⋯ menu (Archive / Restore / Move / Delete / Run) is present and correct on **every row surface** — `SkillRow` under `AllSkillsOverview` and `SkillsInCategory`, `ColdStorageView`, and reconciled with `QuickDeck`. **Drag (D-01/D-02) is an *additional* path, never a replacement** for the menu — keep the menu as the source of truth for allowed actions.
  - **UX-04:** verify **in-app Cold Storage restore works end-to-end** against a live daemon. Already shipped: `ColdStorageView` delegates restore/delete to the row's ⋯ menu and the `/manage-skills`-in-a-terminal dead-end is gone (a test already asserts no `/manage-skills` text). Confirm it's genuinely functional; ensure no terminal instruction survives anywhere.

### Claude's Discretion
- **Drag library:** native HTML5 drag (`dataTransfer`) is already in use for drag-to-category — extend the native approach for the scope rail rather than introducing `dnd-kit`, unless the optimistic lane-move interaction genuinely needs it. Planner/executor's call.
- **No confirm on non-destructive drag:** archive / move / restore via drag need no confirmation (archive is reversible — Phase 98 precedent). Only permanent delete (menu-only) keeps its type-to-confirm.
- **Where the optimistic client state lives** — e.g. a small pending-moves map keyed by `skillName`, reconciled against the lifecycle command list — planner/executor.
- **Visual form** of the pending shimmer, the scope-rail drop highlight (mirror today's `dropTargetCategory` highlight), the not-allowed-cursor affordance for invalid targets, and the rollback toast copy — follow existing honest-state conventions (reuse `IntakeStatusBadge` / `useIntake` status → badge mapping). Must never render a fake success.
- Whether invalid/same-scope drops show a not-allowed cursor vs a silent no-op — planner's call; must stay honest.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap (this phase)
- `.planning/ROADMAP.md` §"### Phase 100: Control-Surface UX (⋯ Menu, Drag Lanes, Optimistic Reconcile)" — goal, 4 success criteria, and the cross-repo armory/tool-receipts note (deferred here, D-07)
- `.planning/REQUIREMENTS.md` — UX-01, UX-02, UX-03, UX-04 and the traceability table

### Prior phase context (decisions carried forward — the mutations this phase wires a UI over)
- `.planning/phases/98-skill-lifecycle-mutations-archive-restore-move-delete/98-CONTEXT.md` — D-07 (build the ⋯ menu simply, "Phase 100 upgrades in place — no throwaway buttons"); D-08 (98 kept rows honest badge-in-place, explicitly deferring optimistic lane-move + drag to Phase 100 UX-02/03); restore-is-global-only (Plan 04); `MoveToProjectDialog` / `DeleteSkillDialog` origins
- `.planning/phases/99-skill-launch-dispatch/99-CONTEXT.md` — D-02 (Run lives on `SkillLifecycleMenu` + QuickDeck); the ⋯ menu's current Run wiring that UX-01's completeness audit must preserve

### CodePulse surfaces to extend (don't rebuild)
- `src/pages/Skills.tsx` — the page shell: `handleDropOnCategory` (`:134`, category-drag precedent), the left-rail Categories + "Overview / All" + "Cold Storage" buttons (`:300-350`, where the new Scope drop section goes), `dormantCount` / `coldStorageSkills` (`:103-111`), `handleSelectColdStorage`
- `src/components/skills/CategoryGrid.tsx` — the `onDragOver` / `onDrop` / `dropTargetCategory`-highlight pattern (`:62-70`) to mirror for the scope-rail drop targets
- `src/components/skills/SkillRow.tsx` — already `draggable` with `onDragStart` setting `text/plain = skill.name` (`:82-85`); the `lane` prop; hosts the ⋯ menu
- `src/components/skills/SkillLifecycleMenu.tsx` — the scope-gated ⋯ menu (Archive/Restore/Move/Delete + Run); **source of truth for which actions are valid per scope** — the drag matrix (D-02) must stay consistent with it; it calls `enqueueLifecycle` directly for no-dialog actions and opens `MoveToProjectDialog`/`DeleteSkillDialog` for the rest
- `src/components/skills/MoveToProjectDialog.tsx` — the workspace picker reused for drop-on-Project (D-03)
- `src/components/skills/DeleteSkillDialog.tsx` — type-to-confirm permanent delete (stays menu-only, D-04)
- `src/components/skills/ColdStorageView.tsx` — cold view; already restore-via-menu, `/manage-skills` dead-end removed (UX-04 verification target)
- `src/components/skills/AllSkillsOverview.tsx`, `src/components/skills/SkillsInCategory.tsx`, `src/components/skills/QuickDeck.tsx` — the other row surfaces the UX-01 completeness audit must cover
- `src/hooks/useIntake.ts` (and the Phase 98 `useLifecycle` hook) — pending/executing/done/failed/expired **status mapping to reuse for the optimistic reconcile** (D-05); `src/components/skills/IntakeStatusBadge.tsx` for the badge visuals
- `convex/forge.ts` — `enqueueLifecycle` (the mutation the drag matrix fires; no new mutation needed) + the refusal/house-copy adapter (reconcile failure copy, D-05)
- `convex/forgeCommands.ts` — the command-row claim/ack/status the optimistic layer reconciles against
- `src/lib/skills.ts` (`:26`) — `isShadowing` / `isDormant` / `hasDormantCopy` helpers that determine per-row scope state (drives which drop targets are valid, D-02)

### Cross-repo
- **None expected.** The Forge daemon lifecycle executor (`C:\Users\mandr\forge` `lifecycle-exec.ts` / `command-poller.ts`) already performs archive/restore/move/delete (Phase 98). This phase adds no daemon behavior; it only drives the existing mutations from a richer UI.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`enqueueLifecycle` (convex/forge.ts) + `SkillLifecycleMenu`**: every drag action maps to an existing menu action → existing mutation. Drag is a new *trigger*, not a new *operation*.
- **Native drag plumbing (`SkillRow.onDragStart` + `CategoryGrid.onDragOver/onDrop`)**: the scope rail reuses the exact same `dataTransfer`/highlight pattern already proven for drag-to-category.
- **`MoveToProjectDialog` (Phase 98)**: the drop-on-Project workspace picker — no new dialog (D-03).
- **`useIntake` / `useLifecycle` status mapping + `IntakeStatusBadge`**: the queued→executing→done/failed/expired vocabulary the optimistic reconcile reuses (D-05).
- **`isShadowing` / `isDormant` / `hasDormantCopy` (src/lib/skills.ts)**: per-row scope state → which scope-lane drops are valid.

### Established Patterns
- **Surface-Substrate bridge**: the browser never mutates the filesystem — drag drops enqueue a Forge command; the daemon executes and a rescan reconciles. The optimistic layer is client-only and must yield to that rescan truth.
- **Honest state, no false success** (97/98 house rule): the pending shimmer is visibly unconfirmed; failure/expiry snaps back with the daemon's real reason (D-05).
- **Menu is source of truth; drag mirrors it** (D-02): no drag-only capability, so the two paths can never disagree about what's allowed.

### Integration Points
- Scope-rail drop → `enqueueLifecycle(action, skill, [workspace via MoveToProjectDialog]) ` → optimistic row moves to destination lane (pending) → command-row status + rescan reconcile → settle or roll back (D-05).
- Category-grid drop → `updateOverride({ skillName, categoryName })` (unchanged, independent of scope).
- ⋯ menu everywhere (UX-01 audit) → same `enqueueLifecycle` + `MoveToProjectDialog`/`DeleteSkillDialog`.

### Known Landmines
- **Payload disambiguation**: both drag paths use `text/plain = skill.name` — correctness relies on *drop target identity*, not payload contents. Don't let a scope-rail drop also fire a category update (and vice-versa).
- **Optimism must reconcile**: never persist the optimistic lane; a failed/expired command must visibly return the row (D-05). A row stuck optimistically in the wrong lane after a daemon-offline expiry is exactly the false-success the house rule forbids.
- **Restore-is-global-only** (Phase 98): the drag matrix must reject cold→Project rather than silently no-op or fake a restore (D-02).

</code_context>

<specifics>
## Specific Ideas

- Larry wants the scope lanes as **droppable rail entries beneath Categories**, keeping the current category IA intact rather than a kanban restructure (D-01).
- **Drag must never delete** — deletion stays behind the type-the-name confirm; no trash drop zone (D-04). `.claude/` has no git safety net.
- The optimistic state should feel **snappy but stay honest** — the row moves instantly, but the pending state is unmistakably "not yet confirmed," and a failure visibly rolls it back (D-05).
- **Restore stays two deliberate steps** for cold→project (restore to global, then move) — consistent with Phase 98 (D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Armory tiles + tool-receipts** (`tools_used` / `tool_errors` displayed under chat answers) — the ROADMAP Phase-100 cross-repo note (SEED-002 mission-control jobs board / astridr SEED-024). Different surface (chat answers / mission control), scope creep for a Skills control-surface phase (D-07). Route to backlog / its own phase.
- **Restore-to-project** as a single mutation (direct cold→project restore) — rejected here to keep restore global-only per Phase 98; revisit only if the two-step restore-then-move proves annoying in practice (D-02).
- **One-click "swap"** (compound archive-active + restore-dormant atomic command) — carried forward from 98's deferred list; still rejected (non-atomic).
- **Bulk multi-select lifecycle / launch** — already deferred in REQUIREMENTS.
- **Persistent "shadowed" badge on dormant rows** (beyond the disabled-restore-with-reason from 98) — visibility polish; not required for UX-01..04.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile*
*Context gathered: 2026-07-23*
