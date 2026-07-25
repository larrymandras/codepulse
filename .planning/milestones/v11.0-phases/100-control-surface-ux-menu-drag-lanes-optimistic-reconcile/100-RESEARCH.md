# Phase 100: Control-Surface UX (⋯ Menu, Drag Lanes, Optimistic Reconcile) - Research

**Researched:** 2026-07-24
**Domain:** React/Convex frontend UX — native HTML5 drag-and-drop, client-side optimistic state reconciliation, menu completeness audit
**Confidence:** HIGH (every claim below is grounded in the live source tree, read in this session; no external library research was needed — this phase adds no new dependencies)

## Summary

This phase is pure frontend wiring over infrastructure that already exists and already works: `enqueueLifecycle` (convex/forge.ts), the scope-gated `SkillLifecycleMenu`, `MoveToProjectDialog`, `DeleteSkillDialog`, and the `useLifecycle`/`useIntake` status-mapping vocabulary are all shipped and unit-tested from Phase 98. There is no new mutation, no new Convex table, no new npm package to install (confirmed: `@dnd-kit/*` is already a dependency, but is used exclusively for the Kanban board — the Skills page's own established drag idiom is native HTML5 `draggable`/`dataTransfer`, and this research confirms that's the right one to extend, not `dnd-kit`).

The single hardest design question this phase must answer — the optimistic-pending-row correlation key — already has a proven precedent in this exact codebase: `useIntakeFeed.ts`'s `pendingLocal` map, deduped and reconciled by **`commandId`** (the client-generated UUID passed into the mutation), not by skill name. `SkillLifecycleMenu.tsx`'s existing `enqueue()` helper already generates `commandId: crypto.randomUUID()` and reads back via `useLifecycleCommands()`; the only currently-missing piece is a commandId-keyed lookup (today's `latestLifecycleForSkill` matches by skill name + newest `createdAt`, which is a weaker correlation than commandId and is a real, previously-undocumented gap for phase 100 to close).

**Primary recommendation:** Reuse `useIntakeFeed.ts`'s dedupe-by-`commandId` reconciliation pattern verbatim for a new `usePendingLifecycleMoves` hook: a `Record<skillName, PendingMove>` where `PendingMove` carries the `commandId` the drop generated. Reconcile against `useLifecycleCommands()` by finding the row whose `commandId` matches (not `latestLifecycleForSkill`'s skillName-only match), and clear the pending entry only on a terminal status (`done` / `failed` / `expired`), firing the rollback toast via the already-exported `lifecycleRefusalMessage` on failure. Extract the per-row scope predicate (`activeOrigin` / `multiScope` / `dormant` / `shadowed` / `moveDestinationIsProject`) that currently lives inline inside `SkillLifecycleMenu` into a shared pure helper in `src/lib/skills.ts`, so the new scope-rail drop handler and the existing ⋯ menu can never disagree about what's allowed (this is exactly what D-02 requires and there is currently no shared implementation to guarantee it).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scope-rail drop target rendering + drag-over highlight | Browser / Client (React) | — | Pure presentational state (`dropTargetScope`), mirrors `CategoryGrid`'s existing client-only `dropTarget` state |
| Drag payload correlation (`skill.name` → target scope) | Browser / Client | — | `dataTransfer` is a browser-only mechanism; disambiguation is by DOM drop-target identity, not payload |
| Drag-matrix validity predicate (which drops are legal) | Browser / Client | API / Backend (LAYER-1 preflight) | Client predicate is UX-only (fast, no round-trip); `validateLifecyclePreflight` in `convex/forge.ts` is the actual authority and re-checks independently — client and server must not diverge, but server is the enforcement layer |
| `enqueueLifecycle` mutation | API / Backend (Convex) | — | Unchanged from Phase 98; this phase adds a new **trigger** (drag), never a new **operation** |
| Optimistic pending-row state | Browser / Client | — | Explicitly client-only ephemeral (D-05) — never written to Convex, never persisted |
| Command-row terminal status (done/failed/expired) | API / Backend (Convex `forgeCommands`) | Database / Storage | Written by the Forge daemon via `command-poller.ts` (cross-repo, unchanged); the client only reads it via `useLifecycleCommands()` |
| Registry rescan (row actually appears/disappears from a scope) | Database / Storage (Convex `skills` table) | API / Backend | `syncInventory` (Phase 97/98, unchanged) — the pending overlay's "done" case relies on this already having landed by the time status flips to `done` |
| Cold Storage restore UI completeness | Browser / Client | — | UX-01/04 are an audit of existing client components, not new backend work |

## Standard Stack

### Core

No new libraries. This phase's entire dependency footprint is already installed and in use on the Skills page.

| Library | Version (verified via `package.json`) | Purpose | Why Standard (for this codebase) |
|---------|--------|---------|--------------|
| React | 19.2.7 | UI | Existing app framework |
| Convex | 1.42.0 | Backend/DB, `useQuery`/`useMutation` reactivity | Existing app framework — `useLifecycleCommands()` already subscribes reactively; no polling needed for reconcile |
| sonner | 2.0.7 | Toast (rollback / refusal messages) | Already the toast library used by `SkillLifecycleMenu`, `MoveToProjectDialog`, `DeleteSkillDialog` |
| lucide-react | 1.23.0 | Icons (`Globe`, `FolderGit2`, `Archive` for the scope rail — UI-SPEC mandates matching `DestinationBadge`'s icon set exactly) | House icon library, CLAUDE.md rule |
| vitest | 4.1.9 | Unit tests | Existing test runner; jsdom already supports `fireEvent.dragStart/dragOver/drop` with a plain-object `dataTransfer` mock (proven in `SkillRow.test.tsx:100`) |

### Supporting

Nothing new needed. `@testing-library/react`'s `fireEvent.drop`/`dragOver`/`dragStart` (already used in `SkillRow.test.tsx`) is sufficient for every test this phase needs — no drag-simulation library required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTML5 `draggable`/`dataTransfer` | `@dnd-kit/core` | **`@dnd-kit/core` is ALREADY a dependency** (`^6.3.1`, used by `KanbanBoard.tsx`/`KanbanColumn.tsx`/`KanbanCard.tsx`/`TeamEditor.tsx`/`Tasks.tsx`/`WarRoomKanbanColumn.tsx`) — so "introducing" it costs zero new npm weight. The reason to still avoid it here is **consistency within the Skills page itself**: the Categories grid already uses native `draggable`/`onDragOver`/`onDrop`, and mixing a dnd-kit `DndContext` into the same page as native drag handlers is two coexisting drag systems on one page, which is exactly the kind of "second drag paradigm" CONTEXT.md's discretion note is trying to avoid. Native drag remains correct — just note for the planner that the "no new dependency" framing in CONTEXT.md's discretion note is slightly imprecise (dnd-kit is already installed); the real argument for native drag is intra-page consistency, not dependency cost. |

**Installation:** None required.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new packages.** Every library referenced above is already present in `package.json` and already exercised by existing, passing tests. No `slopcheck`/registry verification is needed.

## Architecture Patterns

### System Architecture Diagram

```
 User drags a SkillRow (SkillRow.tsx onDragStart → e.dataTransfer.setData("text/plain", skill.name))
        │
        ├──► drops on CategoryGrid entry (unchanged, Phase <100)
        │        └─ Skills.tsx:handleDropOnCategory → updateOverride({skillName, categoryName}) [cosmetic, no scope change]
        │
        └──► drops on NEW Scope-rail entry (Global / Project / Cold)
                 │
                 ▼
         Skills.tsx: resolve skill by name from enrichedSkills
                 │
                 ▼
         shared predicate (NEW, src/lib/skills.ts):
           resolveLifecycleActions(skill) → { activeOrigin, multiScope, dormant, shadowed }
                 │
                 ├─ invalid target (own-scope / multiScope / cold→Project) ──► no-op, no mutation (D-02, honest)
                 │
                 └─ valid target
                       │
                       ├─ Project target ──► opens MoveToProjectDialog (existing, D-03)
                       │                        └─ user confirms workspace ──► enqueueLifecycle(move, …, commandId)
                       │
                       └─ Global / Cold target ──► enqueueLifecycle(archive|restore|move, …, commandId) directly (no dialog)
                                 │
                                 ▼
                  usePendingLifecycleMoves (NEW): setPending(skillName, {commandId, action, destination})
                  — applied BEFORE awaiting the mutation promise (IntakeModal's B2 "paint-before-await" precedent)
                                 │
                                 ▼
                  convex/forge.ts enqueueLifecycle
                     ├─ LAYER-1 preflight (validateLifecyclePreflight) throws synchronously ──► catch → clear pending → toast(lifecycleRefusalMessage)
                     └─ inserts forgeCommands row (status: "queued")
                                 │
                                 ▼ (cross-repo, unchanged — Forge daemon)
                  command-poller.ts claims → lifecycle-exec.ts runs fs op → patches row {status: done|failed} → syncInventory rescans `skills` table
                                 │
                                 ▼
                  useLifecycleCommands() (reactive Convex subscription, client)
                                 │
                                 ▼
                  reconcile effect: find row where row.commandId === pending.commandId
                     ├─ status done            ──► clear pending; row's new scope already reflects via enrichedSkills query
                     ├─ status failed          ──► clear pending; toast(lifecycleRefusalMessage-style row.error)
                     └─ status expired         ──► clear pending; toast("Expired — no daemon claimed this command.")
```

### Recommended Project Structure

No new top-level directories. Additions fit the existing `src/components/skills/` + `src/hooks/` + `src/lib/` layout:

```
src/
├── lib/
│   └── skills.ts                  # ADD: resolveLifecycleActions() shared predicate (extracted from SkillLifecycleMenu)
├── hooks/
│   └── usePendingLifecycleMoves.ts  # NEW: pending-moves map + commandId reconcile (mirrors useIntakeFeed.ts pattern)
├── components/skills/
│   ├── ScopeRail.tsx               # NEW: Global/Project/Cold drop targets, mirrors CategoryGrid.tsx's row markup/pattern
│   ├── SkillRow.tsx                # MODIFY: apply pending-state opacity/shimmer overlay when usePendingLifecycleMoves has an entry for this skill
│   ├── SkillLifecycleMenu.tsx      # MODIFY (small): consume resolveLifecycleActions instead of its own inline activeOrigin/multiScope calc (keeps menu and drag matrix identical by construction)
│   └── ColdStorageView.tsx         # AUDIT ONLY (UX-04) — no code change expected unless the audit finds a real gap
└── pages/
    └── Skills.tsx                  # MODIFY: render <ScopeRail> below Categories; own dropTargetScope state (separate from dropTarget/category); host usePendingLifecycleMoves; drop handler resolves host via the already-exported resolveHostId + useForgeHostsRaw
```

### Pattern 1: commandId-correlated optimistic reconciliation (the crux of D-05)

**What:** A client-only `Record<skillName, PendingMove>` where each entry carries the exact `commandId` the client generated for that drag's `enqueueLifecycle` call. Reconciliation looks up the **specific command row by commandId**, not merely "the newest lifecycle row for this skill name."

**When to use:** Any drag-triggered (or future menu-triggered) optimistic row state where more than one in-flight command for the same skill could theoretically exist (e.g., a user drags a row, then immediately opens the ⋯ menu and clicks a different action before the first resolves).

**Why commandId, not skillName:** The existing `latestLifecycleForSkill(commands, skill.name)` helper (used today by `SkillLifecycleMenu`'s badge) matches by name + newest `createdAt`. That is correct for "show *a* badge for this row" but is the WRONG correlation for "did *my* specific drag-triggered command finish?" — if a second, unrelated command for the same skill gets enqueued (however unlikely given the daemon's per-skillName serial mutex documented in Phase 98's decisions), a skillName-only lookup could reconcile the wrong command. `useIntakeFeed.ts` (the codebase's own established precedent for exactly this problem, one directory up) already solved it correctly: dedupe/reconcile is by `commandId`, always.

**Example (grounded in real files, not invented):**
```typescript
// src/hooks/useIntakeFeed.ts:95-100 — the EXACT reconciliation precedent to port:
useEffect(() => {
  setPendingLocal((prev) =>
    prev.filter((r) => !serverCommands.some((s) => s.commandId === r.commandId))
  );
}, [serverCommands]);

// SkillLifecycleMenu.tsx:150-168 — the EXACT commandId-generation precedent to reuse:
const enqueue = (overrides: {...}) => {
  enqueueLifecycle({
    hostId,
    commandId: crypto.randomUUID(),   // <-- this is the correlation key
    skillName: skill.name,
    workspaceId: null,
    ...overrides,
  }).catch((err: unknown) => {
    toast.error(lifecycleRefusalMessage(err));
  });
};
```
The new hook should generate `commandId` at the SAME call site that calls `enqueueLifecycle` for a drag (Skills.tsx's new drop handler, and `MoveToProjectDialog.handleConfirm` for the Project-target case), store `{ commandId, action, destination }` in the pending map keyed by `skill.name`, and reconcile against `useLifecycleCommands().find(c => c.commandId === pending.commandId)` — a `find`, not `latestLifecycleForSkill`.

### Pattern 2: drop-target disambiguation by DOM identity (D-01, confirmed against live code)

**What:** `SkillRow.tsx:82-86`'s `onDragStart` sets ONLY `text/plain = skill.name` — no target-type metadata in the payload. `CategoryGrid.tsx:62-70`'s `onDragOver`/`onDrop` already proves the working pattern: `e.preventDefault()` in `onDragOver` (mandatory for native HTML5 drop to fire at all), track hover target in a single piece of state (`dropTargetCategory`), and read `e.dataTransfer.getData("text/plain")` only inside `onDrop`.

**Confirmed drift check against CONTEXT.md's cited line numbers:** All hold exactly as cited — `SkillRow.tsx:82-85` (drag payload), `Skills.tsx:134` (`handleDropOnCategory`), `Skills.tsx:53` (five-repos comment), `CategoryGrid.tsx:62-70` (drag pattern). No drift.

**Critical new-code requirement:** `Skills.tsx` currently has exactly ONE piece of drop-target state: `const [dropTarget, setDropTarget] = useState<string | null>(null)` (line 33), shared by the (single) `CategoryGrid`. The new scope rail needs its **own** independent state (e.g. `dropTargetScope`), NOT a reuse of `dropTarget` — reusing the same state variable would make hovering a category entry and hovering a scope-rail entry fight over the same highlight state, and (worse) `handleDropOnCategory`'s `setDropTarget(null)` reset (line 138) would clear a hover that belongs to the other rail if they shared state.

**Example:**
```typescript
// CategoryGrid.tsx:62-70 — the exact pattern the ScopeRail must mirror:
onDragOver={(e) => {
  e.preventDefault();                    // REQUIRED or onDrop never fires
  onDragOverCategory?.(cat.name);
}}
onDragLeave={() => onDragLeaveCategory?.()}
onDrop={(e) => {
  e.preventDefault();
  onDropOnCategory?.(cat.name, e);
}}
```

### Pattern 3: shared per-row scope predicate (closes a real D-02 consistency gap)

**What:** `SkillLifecycleMenu.tsx:141-148` computes `dormant`, `shadowed`, `nonDormantOrigins`, `multiScope`, `activeOrigin`, `moveDestinationIsProject` **inline, private to the component**. Nothing else in the codebase can read this predicate today. D-02 requires "the drag action matrix mirrors exactly what the ⋯ menu already permits" — but there is currently NO shared implementation that both the menu and a new drop handler could both call; today's logic exists in exactly one place and would have to be **duplicated** (with the attendant risk of the two copies drifting) if the drop handler is written independently.

**Recommendation:** Extract these lines into a pure function in `src/lib/skills.ts` (already the home of `isDormant`/`isShadowing`/`hasDormantCopy`, and already imported by both `SkillLifecycleMenu.tsx` and `Skills.tsx`):

```typescript
// NEW — src/lib/skills.ts, alongside isDormant/isShadowing/hasDormantCopy
export interface LifecycleActionState {
  dormant: boolean;
  shadowed: boolean;
  multiScope: boolean;
  activeOrigin?: string;
  moveDestinationIsProject: boolean;
}

export function resolveLifecycleActions(skill: SkillLike, lane: "active" | "cold" = "active"): LifecycleActionState {
  const dormant = isDormant(skill) || lane === "cold";
  const shadowed = isShadowing(skill);
  const nonDormantOrigins = (skill.origins ?? []).filter((o) => o !== DORMANT_ORIGIN);
  const multiScope = nonDormantOrigins.length > 1;
  const activeOrigin = nonDormantOrigins.length === 1 ? nonDormantOrigins[0] : undefined;
  return {
    dormant,
    shadowed,
    multiScope,
    activeOrigin,
    moveDestinationIsProject: activeOrigin === "claude-code",
  };
}
```
Then `SkillLifecycleMenu.tsx` calls this instead of its own inline block (behavior-preserving refactor, covered by its existing test suite), and the new scope-rail drop handler calls the exact same function. This is the only way to make "menu is source of truth, drag mirrors it" (D-02) a structural guarantee rather than a convention two people have to remember to keep in sync.

### The Drag Matrix — resolved cell-by-cell against real predicates

D-02's bullet list does not explicitly cover the **multi-scope** case. Cross-referencing against `SkillLifecycleMenu.tsx:283-305` (which disables Archive AND Move entirely for a multi-scope row, with tooltip "Active in multiple scopes — disambiguation ships in a later release"), the matrix must extend to:

| Row state (`resolveLifecycleActions`) | → Global | → Project | → Cold |
|---|---|---|---|
| `activeOrigin === "claude-code"` (active-global) | no-op (own scope) | opens `MoveToProjectDialog` (D-03) | archive (`enqueueLifecycle` direct) |
| `activeOrigin === "claude-code:project:…"` (active-project) | move-to-global (`enqueueLifecycle` direct) | no-op (own scope — project→project transfer is out of scope regardless of which of the 5 workspaces) | archive (`enqueueLifecycle` direct) |
| `dormant === true` (cold/dormant, not shadowed) | restore (`enqueueLifecycle` direct) | **rejected** — not-allowed cursor + inline hint (D-02) | no-op (already cold) |
| `dormant === true && shadowed === true` | **rejected** (shadow-blocked, same as the menu's disabled Restore) | rejected (D-02, compounds with shadow) | no-op |
| `multiScope === true` | **rejected** — mirrors the menu's disabled Archive/Move for this case (not explicit in D-02's bullets but required by "drag matrix mirrors the menu exactly") | rejected | rejected |

This table should be handed to the planner as the literal spec for the drop handler's `switch`/predicate — it is more complete than D-02's prose and closes the multi-scope gap silently, without requiring a new discuss-phase round (it is a direct, mechanical consequence of the already-locked "drag mirrors the menu" rule, not a new decision).

### Pattern 4: sequencing the pending state around the Project dialog (a real timing subtlety D-05 doesn't call out)

**What:** Dropping on the Project lane does **not** call `enqueueLifecycle` at drop time — it opens `MoveToProjectDialog` (D-03), and the actual mutation only fires when the user picks a workspace and clicks "Move skill" inside `MoveToProjectDialog.handleConfirm` (`MoveToProjectDialog.tsx:79-103`). The optimistic pending-row overlay must NOT begin at the drop event for a Project-target drag — there is no command yet, and painting a pending row that might never be confirmed (the user could cancel the dialog) would violate the "never claim unconfirmed state" house rule in spirit (D-05's own italicized language). The pending state for this path must begin inside `MoveToProjectDialog.handleConfirm`, using the same `commandId` it already generates at line 82.

**Existing but unused hook to reuse:** `MoveToProjectDialog` already declares an `onMoved?: () => void` prop (line 44) that is currently **never passed** by its only caller (`SkillLifecycleMenu.tsx:347-355`). This is a ready-made integration point: wire `onMoved` (or extend its signature to `onMoved?: (commandId: string) => void`) to call `usePendingLifecycleMoves`'s setter, rather than threading a new prop through the dialog. `DeleteSkillDialog` has the analogous unused `onDeleted?` prop — not relevant to this phase (drag never deletes, D-04) but confirms this "declared, not yet wired" pattern is already established twice in Phase 98's code, i.e. Phase 98 anticipated Phase 100 needing these hooks.

### Anti-Patterns to Avoid

- **Reconciling by skill name instead of commandId.** Works today only because there is (usually) at most one in-flight lifecycle command per skill; it is not a structural guarantee and is strictly weaker than what `useIntakeFeed.ts` already does correctly one directory over.
- **Sharing `dropTarget` state between the Categories grid and the new Scope rail.** Two independent drop surfaces need two independent hover-highlight state variables (see Pattern 2).
- **Duplicating `SkillLifecycleMenu`'s inline `activeOrigin`/`multiScope`/`dormant` computation into the new drop handler.** Extract to `resolveLifecycleActions` (Pattern 3) instead — otherwise D-02's "the two paths can never disagree" guarantee is only convention, not code.
- **Painting the pending-row overlay at drop time for a Project-target drag.** No command exists until the dialog confirms (Pattern 4) — an unconfirmed drop must not show as "pending."
- **Introducing `@dnd-kit`'s `DndContext` into the Skills page.** It's a real, already-installed dependency, but mixing it with the page's existing native-drag Categories grid creates two coexisting drag systems on one page — extend the native pattern instead (see Alternatives Considered).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lifecycle status vocabulary (queued/executing/done/failed/expired) | A new status enum for "drag" commands | `IntakeRowStatus` / `mapLifecycleStatus` (`src/hooks/useLifecycle.ts`) | Already covers every state a lifecycle command row can be in; a parallel enum would immediately diverge |
| Refusal-message extraction | Custom regex on the thrown error | `lifecycleRefusalMessage` (`src/hooks/useLifecycle.ts:85-90`) | Already strips the internal `lifecycle-refused:<kind>:` token and takes only the first line — reinventing this risks leaking the internal token to a toast |
| Host resolution for a drag-triggered command | A new host-picking heuristic | `resolveHostId` (exported from `SkillLifecycleMenu.tsx:76-84`) + `useForgeHostsRaw` | Already handles the "most-recently-seen online, else newest-seen-overall" convention (D-08) consistently across the app |
| Optimistic-row dedupe/reconcile | A bespoke `useState` + manual `useEffect` per component | Mirror `useIntakeFeed.ts`'s `dedupeByCommandId` + reconcile-on-server-update pattern | Proven, unit-tested precedent already in this codebase for the identical class of problem |

**Key insight:** Every piece of machinery this phase needs (status vocabulary, refusal messages, host resolution, optimistic reconciliation) already exists in the codebase in a form built for an almost-identical problem (intake rows, launch/stop pending rows). The phase's actual net-new code is small: a shared predicate extraction, a scope-rail component, and a commandId-keyed pending map — everything else is composition of existing hooks/mutations.

## Common Pitfalls

### Pitfall 1: Correlating the wrong command row on reconcile
**What goes wrong:** A pending overlay keyed and reconciled by skill name alone clears (or fails to clear) based on an unrelated command for the same skill.
**Why it happens:** `latestLifecycleForSkill` (the existing helper) is skillName+newest-`createdAt` — the natural thing to reach for, since it's already exported and used by the menu's badge.
**How to avoid:** Store and match on `commandId` (Pattern 1). `latestLifecycleForSkill` is fine for "show a badge for this row" (its current, narrower use) but is the wrong primitive for "did the command I fired resolve?"
**Warning signs:** A test where two lifecycle commands exist for the same skill (one from the menu, one from a drag) and the rollback toast fires for the wrong one, or never fires.

### Pitfall 2: Painting "pending" before a command actually exists (Project-target drops)
**What goes wrong:** The Project lane's drop opens a dialog, not a direct mutation. Painting pending state at drop time (before the user has even chosen a workspace, or if they cancel) shows a stuck/incorrect "pending" row with nothing to reconcile against.
**Why it happens:** The other two targets (Global, Cold) DO enqueue directly on drop, so a naive implementation that treats all three targets uniformly will make this mistake for Project.
**How to avoid:** Gate the optimistic paint on "a `commandId` was actually generated and `enqueueLifecycle` was actually called" — for Project, that's inside `MoveToProjectDialog.handleConfirm`, not the drop handler (Pattern 4).
**Warning signs:** Dragging onto Project shows a pending shimmer even if the user then clicks "Cancel Move" in the dialog.

### Pitfall 3: LAYER-1 synchronous throw vs. LAYER-2 async `failed` status — two different rollback paths
**What goes wrong:** `enqueueLifecycle`'s LAYER-1 preflight (`validateLifecyclePreflight`, e.g. shadow/collision/not-cold refusals) throws **before any `forgeCommands` row is inserted** (confirmed at `convex/forge.ts:1121-1132`) — so there is nothing to ever reconcile via `useLifecycleCommands()`. A LAYER-2 refusal (the daemon rejects after claiming the command) instead produces a real row with `status: "failed"` and a populated `error` field. A reconcile effect that ONLY watches `useLifecycleCommands()` will silently strand a pending row forever on a LAYER-1 refusal, because no row will ever appear.
**Why it happens:** The two failure modes look similar ("the mutation failed") but have opposite data shapes (promise rejection with no row vs. a row that eventually flips to `failed`).
**How to avoid:** The pending-map setter's own `enqueueLifecycle(...).catch(err => { clearPending(skillName); toast.error(lifecycleRefusalMessage(err)); })` must handle the synchronous-rejection case directly (exactly as `SkillLifecycleMenu.enqueue()` already does at lines 159-167) — do not rely solely on the `useLifecycleCommands()`-watching effect to catch this class of failure.
**Warning signs:** A test that mocks `enqueueLifecycle` to reject with a `lifecycle-refused:collision:` error and asserts the pending overlay clears — this must pass via the `.catch()` path, not the reconcile-effect path, since no row will ever exist for it to match.

### Pitfall 4: Multi-scope rows are a silent drag-matrix gap in D-02's prose
**What goes wrong:** D-02's bullet list enumerates active-global, active-project, and dormant/cold source rows, but never mentions a row that is active in BOTH global and project simultaneously (`multiScope`). Implementing only the explicitly-listed cases leaves multi-scope rows draggable with undefined behavior (likely: the drop handler crashes trying to resolve a single `activeOrigin`, or silently no-ops in a way that isn't visually communicated as "invalid").
**Why it happens:** D-02 was written focused on the common cases; the menu's own multi-scope guard (`SkillLifecycleMenu.tsx:283-305`) is a separate, later addition (Pitfall 1a from Phase 98) that CONTEXT.md's drag-matrix bullets don't cross-reference.
**How to avoid:** Apply the extended matrix in this document's "Drag Matrix" table — treat `multiScope === true` as invalid for every scope-lane target, mirroring the menu's disabled state exactly.
**Warning signs:** Dragging a skill that's active in two workspaces onto any scope lane does something other than showing a not-allowed cursor and doing nothing.

### Pitfall 5: `dropTarget` state collision between Categories and Scope rail
See Pattern 2 / Anti-Patterns. Concretely: if the new Scope rail reuses `Skills.tsx`'s existing `dropTarget`/`setDropTarget` state (line 33) instead of its own, hovering a scope entry then a category entry (or vice versa) will show stale/wrong highlights, and `handleDropOnCategory`'s `setDropTarget(null)` (line 138) will clear the OTHER rail's highlight state on an unrelated category drop.

## Code Examples

### Drag payload (unchanged, confirmed current)
```typescript
// src/components/skills/SkillRow.tsx:82-86
draggable={draggable}
onDragStart={(e) => {
  e.dataTransfer.setData("text/plain", skill.name);
  e.dataTransfer.effectAllowed = "move";
}}
```

### Drop-target pattern to mirror for the Scope rail (confirmed current)
```typescript
// src/components/skills/CategoryGrid.tsx:62-70
onDragOver={(e) => {
  e.preventDefault();
  onDragOverCategory?.(cat.name);
}}
onDragLeave={() => onDragLeaveCategory?.()}
onDrop={(e) => {
  e.preventDefault();
  onDropOnCategory?.(cat.name, e);
}}
```

### The reconciliation precedent to port (confirmed current, THE key pattern for D-05)
```typescript
// src/hooks/useIntakeFeed.ts:95-100 — dedupe/reconcile by commandId, not by name
useEffect(() => {
  setPendingLocal((prev) =>
    prev.filter((r) => !serverCommands.some((s) => s.commandId === r.commandId))
  );
}, [serverCommands]);
```
For phase 100's version, this needs to become status-aware (only clear on a TERMINAL status, and branch on `failed`/`expired` to fire a toast) rather than "clear on ANY server row with this commandId" (intake's simpler rule, since intake has no queued/executing pending-shimmer requirement the way this phase does):
```typescript
// Sketch for the NEW usePendingLifecycleMoves hook
const lifecycleCommands = useLifecycleCommands();
useEffect(() => {
  setPending((prev) => {
    const next = { ...prev };
    for (const [skillName, entry] of Object.entries(prev)) {
      const row = lifecycleCommands.find((c) => c.commandId === entry.commandId);
      if (!row) continue; // still in flight, or not yet visible — keep pending
      if (row.status === "done") {
        delete next[skillName];
      } else if (row.status === "failed" || row.status === "expired") {
        delete next[skillName];
        toast.error(
          row.status === "expired"
            ? "Expired — no daemon claimed this command."
            : lifecycleRefusalMessage(row.error ?? "")
        );
      }
      // queued / executing: leave pending as-is
    }
    return next;
  });
}, [lifecycleCommands]);
```

### Existing expiry copy to reuse verbatim (confirmed current, D-05's copywriting contract)
```typescript
// src/components/skills/IntakeSheet.tsx:135-139 — the intake precedent the UI-SPEC
// alludes to ("mirrors LIFE-06's… language already established"). The exact
// reusable line is the FIRST sentence only — the second line below is
// intake-specific (daemon/Phase-8 reference) and should NOT be copied for lifecycle:
"Expired — no daemon claimed this command."
```

### Refusal-message extraction (already exported, reuse as-is)
```typescript
// src/hooks/useLifecycle.ts:85-90
export function lifecycleRefusalMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const match = /lifecycle-refused:[^:]+:([\s\S]+)/.exec(raw);
  const message = (match ? match[1] : raw).split("\n")[0].trim();
  return message || "Lifecycle command failed";
}
```

## State of the Art

Not applicable in the traditional sense (no external ecosystem to be behind on) — this is a wholly internal pattern-reuse phase. The one relevant "old vs. new" contrast is internal to this codebase:

| Old Approach (pre-Phase-100) | Current/Target Approach (Phase 100) | When Changed | Impact |
|--------------------------|------------------|---------------|--------|
| Lifecycle mutations reachable only via the ⋯ menu, badge reconciled by skillName (`latestLifecycleForSkill`) | Also reachable via drag; pending overlay reconciled by `commandId` | This phase | The menu's own badge could optionally be upgraded to the same commandId-precision in a later pass, but is not required to change for this phase — `latestLifecycleForSkill` remains correct for its existing narrower purpose (single latest badge, not multi-source correlation) |
| `SkillLifecycleMenu`'s scope predicate is private/inline | Extracted to `resolveLifecycleActions` in `src/lib/skills.ts`, shared by menu + drag | This phase | Structural guarantee that D-02's "menu and drag never disagree" rule holds, instead of a convention |

**Deprecated/outdated:** Nothing in this domain is deprecated; this is additive-only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Forge daemon's per-skillName in-flight mutex (documented in Phase 98's decisions, "the per-skillName in-flight mutex lives in CommandPoller") means at most one lifecycle command is ever truly concurrent per skill in practice, making the commandId-vs-skillName correlation distinction mostly a defense-in-depth improvement rather than a currently-observable bug | Pattern 1 | Low — even if untrue, commandId correlation is strictly more correct and costs nothing extra to implement; recommending it is safe regardless |
| A2 | `MoveToProjectDialog`'s unused `onMoved` prop is the intended integration point for the pending-state hook (rather than the executor adding a new prop) | Pattern 4 | Low — worst case the executor adds a new prop or callback; the existing `onMoved?: () => void` signature may need widening to pass the commandId, a trivial signature change covered by `MoveToProjectDialog.test.tsx` |
| A3 | Multi-scope rows should reject ALL scope-lane drops (extending D-02 by cross-referencing the menu's actual disabled-state code, since D-02's prose doesn't explicitly cover this case) | Drag Matrix table, Pitfall 4 | Medium — if the planner/user actually wants multi-scope rows to be draggable to SOME lane, this assumption is wrong; flagged explicitly for planner confirmation since it extends (not just implements) a locked decision |

## Open Questions (RESOLVED)

1. **Should the ⋯ menu's own badge (`latestLifecycleForSkill`) be upgraded to commandId-precision in this phase, or left as-is?**
   - What we know: The existing badge logic works today because concurrent commands per skill are rare/prevented by the daemon's mutex.
   - What's unclear: Whether upgrading it is in-scope "completeness" (D-06) or scope creep beyond UX-01's audit framing.
   - Recommendation: Leave `latestLifecycleForSkill` unchanged (it still serves its narrower single-badge purpose correctly); only the NEW pending-map hook needs commandId precision. Planner should make this an explicit non-goal in the plan to avoid scope creep.
   - RESOLVED (2026-07-24, adopted by plans): Left unchanged. No Phase 100 plan touches `latestLifecycleForSkill`; only the new `usePendingLifecycleMoves` hook (Plan 100-02) uses commandId correlation. Non-goal honored.

2. **Does the multi-scope drag-matrix extension (Pitfall 4 / Assumption A3) need a user confirmation before locking, given it extends D-02 rather than purely implementing it?**
   - What we know: It's the only logically consistent reading of "drag matrix mirrors the menu exactly" applied to a case D-02's prose didn't enumerate.
   - What's unclear: Whether the user would prefer multi-scope rows to simply not be `draggable` at all (visually simpler) vs. draggable-but-always-rejected-with-a-hint (matches the "honest, visible" house style more, since a non-draggable row with no visual cue is a worse UX puzzle for the user).
   - Recommendation: Planner/executor discretion is sufficient here (matches CONTEXT.md's existing "Claude's Discretion" framing for related invalid-drop visual choices) — no new discuss-phase round needed, but the plan should state the chosen behavior explicitly rather than leaving it implicit.
   - RESOLVED (2026-07-24, adopted by plans): Planner discretion taken. Plan 100-01's `resolveScopeDrop` encodes multi-scope rows as rejecting all three lanes (mirroring the menu's disabled Archive/Move for multi-scope), stated explicitly as a testable decision rather than left implicit.

## Environment Availability

Skipped — no new external dependency, service, or CLI tool is introduced by this phase. The only environment dependency (a live Forge daemon, for end-to-end manual verification of the drag matrix and Cold Storage restore) already existed as a prerequisite for Phase 98/99 and is unchanged; it is non-blocking for writing/reviewing the code itself (per STATE.md's existing precedent of code-complete-then-defer-manual-verification for Phase 98).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 + `@testing-library/react` + jsdom |
| Config file | `vitest.config.ts` (existing, unchanged) |
| Quick run command | `npx vitest run src/components/skills/ScopeRail.test.tsx src/hooks/usePendingLifecycleMoves.test.ts` (new files) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Every row surface (`AllSkillsOverview`, `SkillsInCategory`, `ColdStorageView`, `QuickDeck`) renders the scope-gated ⋯ menu identically | unit (render assertion per surface) | `npx vitest run src/components/skills/AllSkillsOverview.test.tsx src/components/skills/ColdStorageView.test.tsx` | ✅ (existing files — audit for coverage gaps, extend if a surface is missing a case) |
| UX-01 | Drag is additive, never replaces the menu (menu still works after drag-matrix lands) | unit (regression — existing `SkillLifecycleMenu.test.tsx` suite stays green) | `npx vitest run src/components/skills/SkillLifecycleMenu.test.tsx` | ✅ |
| UX-02 | Drop on Global/Cold fires `enqueueLifecycle` with the correct `action`/`sourceOrigin`/`destination`, no dialog | unit (`fireEvent.drop` with mock `dataTransfer.getData` returning a fixture skill name) | `npx vitest run src/pages/__tests__/Skills.test.tsx` (extend) or a new `ScopeRail.test.tsx` | ❌ Wave 0 — no existing drop-simulation test at the Skills.tsx integration level (only `SkillRow.test.tsx` tests `dragStart`, not a full drag→drop round-trip) |
| UX-02 | Drop on Project opens `MoveToProjectDialog`, does NOT call `enqueueLifecycle` directly | unit | new test in `ScopeRail.test.tsx` or `Skills.test.tsx` | ❌ Wave 0 |
| UX-02 | Invalid drop (cold/dormant → Project, multi-scope → any lane, own-scope → same lane) fires zero mutations | unit | same file | ❌ Wave 0 |
| UX-02 | Extracted `resolveLifecycleActions` produces identical output to the menu's current inline computation, for every existing `SkillLifecycleMenu.test.tsx` fixture (activeGlobal/activeProject/dormant/multiScope/shadowedMerged) | unit | `npx vitest run src/lib/skills.test.ts` (extend if this file exists, else create) | Need to check — `src/lib/skills.ts` likely has a sibling `.test.ts`; extend it with `resolveLifecycleActions` cases mirroring the 5 existing menu fixtures |
| UX-03 | Pending map sets a `commandId`-correlated entry on drop, before the mutation resolves | unit | new `usePendingLifecycleMoves.test.ts` | ❌ Wave 0 |
| UX-03 | Reconcile clears pending on `done`, leaves it on `queued`/`executing` | unit | same file | ❌ Wave 0 |
| UX-03 | Reconcile clears + toasts on `failed` (with `lifecycleRefusalMessage`-style copy) and `expired` (with the reused "Expired — no daemon claimed this command." copy) | unit | same file | ❌ Wave 0 |
| UX-03 | A synchronous LAYER-1 rejection (no row ever created) also clears pending + toasts, via the `.catch()` path, not the reconcile-effect path | unit | same file | ❌ Wave 0 (Pitfall 3's exact regression test) |
| UX-04 | No `/manage-skills` string anywhere in the Cold Storage restore path | unit (regression) | `npx vitest run src/components/skills/ColdStorageView.test.tsx` | ✅ already asserts this (`ColdStorageView.test.tsx:61-64`) — re-run after phase changes, do not weaken |
| UX-04 | In-app restore actually works end-to-end | manual (requires live Forge daemon) | N/A — manual verification step, same category as Phase 98's two outstanding manual checks | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test files>`
- **Per wave merge:** `npm test` (full suite — currently ~2447 tests per Phase 99's verifier run; must stay green)
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/usePendingLifecycleMoves.test.ts` — covers UX-03 (new hook, no existing coverage)
- [ ] `src/components/skills/ScopeRail.test.tsx` (or equivalent, if the executor names the component differently) — covers UX-02's drop-target/matrix behavior
- [ ] Extend `src/pages/__tests__/Skills.test.tsx` — currently has ZERO drag/drop tests at all (confirmed by grep — only `CategoryGrid.test.tsx` tests click behavior, and no test exercises `handleDropOnCategory` end-to-end either); the new scope-rail drop handler needs its first-ever integration-level drop test in this phase, and it's a good opportunity to also backfill one for the pre-existing `handleDropOnCategory` if convenient (not required, but a true zero-coverage gap for a mutation-firing handler)
- [ ] `src/lib/skills.test.ts` — CONFIRMED exists already; extend it with `resolveLifecycleActions` cases covering the same 5 fixtures `SkillLifecycleMenu.test.tsx` already uses (activeGlobal/activeProject/dormant/multiScope/shadowedMerged)
- Framework install: none — Vitest/RTL/jsdom already fully configured, `fireEvent.dragStart/dragOver/drop` proven working in this exact test setup (`SkillRow.test.tsx:100`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes (unchanged) | `enqueueLifecycle`'s existing fail-closed Clerk auth check (`convex/forge.ts:1091-1094`) — this phase adds no new call sites that bypass it; drag and dialog paths both route through the same `enqueueLifecycle` mutation |
| V4 Access Control | Yes (unchanged) | LAYER-1 preflight (`validateLifecyclePreflight`) + LAYER-2 daemon re-check — unchanged; the client-side `resolveLifecycleActions` predicate is UX-only and must never be treated as the security boundary (the server re-validates independently regardless of what the drag UI permits) |
| V5 Input Validation | Yes (unchanged) | `isSafeSkillName` (`convex/forge.ts:726-732`) already guards the `skillName` that flows from a drag payload exactly as it does from the menu — the drag path introduces no new untrusted-input surface, since `skill.name` in the drag payload always originates from an already-validated `enrichedSkills` query result, never raw user text |
| V6 Cryptography | No | Not applicable — no crypto in this phase (`crypto.randomUUID()` is used for command idempotency, not a security boundary) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Client-side drag matrix used as the ONLY gate (trusting the browser to enforce "cold→Project is rejected") | Elevation of Privilege | Already mitigated — `validateLifecyclePreflight` independently re-checks every rule server-side regardless of what the client's drag predicate allowed; a malicious client could fire `enqueueLifecycle` directly with any payload and would still be rejected by the same LAYER-1 checks that gate the menu |
| Spoofed `dataTransfer` payload (a malicious page/extension setting `text/plain` to a skill name the user never dragged) | Tampering | Low relevance — `skill.name` from the drop is looked up against the live `enrichedSkills` query before any mutation fires (per Pattern 3's recommended flow); an unrecognized name simply fails to resolve a row and no-ops, and even a resolved-but-wrong name still passes through the same server-side `validateLifecyclePreflight`/`isSafeSkillName` gates as the menu |

## Sources

### Primary (HIGH confidence — direct code read this session)
- `C:\Users\mandr\codepulse\src\pages\Skills.tsx` — page shell, drop state, `handleDropOnCategory`
- `C:\Users\mandr\codepulse\src\components\skills\CategoryGrid.tsx` — drag-drop precedent pattern
- `C:\Users\mandr\codepulse\src\components\skills\SkillRow.tsx` — drag payload, `lane` prop
- `C:\Users\mandr\codepulse\src\components\skills\SkillLifecycleMenu.tsx` — scope predicate, `enqueue()`, `resolveHostId`
- `C:\Users\mandr\codepulse\src\components\skills\SkillLifecycleMenu.test.tsx` — full existing behavior contract (5 fixtures: activeGlobal/activeProject/dormant/multiScope/shadowedMerged)
- `C:\Users\mandr\codepulse\src\components\skills\MoveToProjectDialog.tsx` — unused `onMoved` hook point
- `C:\Users\mandr\codepulse\src\components\skills\DeleteSkillDialog.tsx` — D-04 confirmation, parallel unused `onDeleted` hook
- `C:\Users\mandr\codepulse\src\components\skills\ColdStorageView.tsx` + `.test.tsx` — UX-04's existing no-`/manage-skills` assertion
- `C:\Users\mandr\codepulse\src\lib\skills.ts` — `isDormant`/`isShadowing`/`hasDormantCopy`, extraction target for `resolveLifecycleActions`
- `C:\Users\mandr\codepulse\src\hooks\useIntake.ts` + `src\hooks\useLifecycle.ts` — status vocabulary, `lifecycleRefusalMessage`, `latestLifecycleForSkill`
- `C:\Users\mandr\codepulse\src\hooks\useIntakeFeed.ts` — THE commandId-dedupe/reconcile precedent
- `C:\Users\mandr\codepulse\src\components\skills\IntakeSheet.tsx` — reusable expiry copy
- `C:\Users\mandr\codepulse\convex\forge.ts` — `enqueueLifecycle`, `validateLifecyclePreflight`, `isSafeSkillName`, `resolveClaimTypes`
- `C:\Users\mandr\codepulse\src\components\skills\SkillRow.test.tsx` — jsdom drag-event testability proof
- `C:\Users\mandr\codepulse\package.json` — dependency/version confirmation (`@dnd-kit/*` already present, versions of React/Convex/sonner/lucide-react/vitest)
- `C:\Users\mandr\codepulse\.planning\phases\100-…\100-CONTEXT.md` and `100-UI-SPEC.md` — locked decisions and design contract (source of the D-01..D-06 references throughout)
- `C:\Users\mandr\codepulse\.planning\REQUIREMENTS.md`, `.planning\STATE.md` — requirement text and project history

### Secondary (MEDIUM confidence)
- None — no web search or Context7 lookup was needed; this phase's entire scope is internal codebase composition.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, every version verified directly from `package.json`
- Architecture: HIGH — every pattern cited is read from the live source tree in this session, not recalled from training data
- Pitfalls: HIGH — each pitfall is derived from a specific, cited code path (e.g. the LAYER-1-throws-before-row-insert behavior is read directly from `convex/forge.ts:1088-1134`), not speculative

**Research date:** 2026-07-24
**Valid until:** Effectively indefinite for the architectural findings (internal codebase facts don't go stale the way external library docs do) — but re-verify line numbers cited above if any of Phase 98/99's files are touched by an intervening quick-task before this phase is planned/executed.
