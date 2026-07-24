---
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/lib/skills.ts
  - src/hooks/usePendingLifecycleMoves.ts
  - src/components/skills/SkillLifecycleMenu.tsx
  - src/components/skills/ScopeRail.tsx
  - src/components/skills/SkillRow.tsx
  - src/components/skills/MoveToProjectDialog.tsx
  - src/pages/Skills.tsx
findings:
  critical: 2
  warning: 1
  info: 1
  total: 4
resolved:
  - CR-01
  - CR-02
  - IN-01
accepted:
  - WR-01
status: resolved
resolution_commit: 5f68801
---

# Phase 100: Code Review Report

> **Resolution (2026-07-24, commit `5f68801`):** CR-01, CR-02, and IN-01 fixed
> and covered by new regression tests (111 affected tests green, tsc clean).
> CR-02 mechanism, reachability (`ColdStorageView` renders draggable shadowed
> rows with `lane="cold"`), and destructiveness were verified against live code
> before fixing. WR-01 accepted as-is: the just-enqueued command is `queued`
> (never terminal) when `onMoved`→`beginPending` runs, so the reactive
> `lifecycleCommands` update reconciles it normally; the proposed fix (adding
> `pending` to the reconcile effect deps) would reintroduce the render loop the
> code deliberately avoids. See below for the original findings.

# Phase 100: Code Review Report

**Reviewed:** 2026-07-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Control-Surface UX drag-and-drop lifecycle feature: the shared
`resolveLifecycleActions`/`resolveScopeDrop` drag-matrix predicate
(`src/lib/skills.ts`), the client-only optimistic pending-move state machine
(`src/hooks/usePendingLifecycleMoves.ts`), and the components that wire drag
sources (`SkillRow.tsx`), drop targets (`ScopeRail.tsx`, `Skills.tsx`), and the
non-drag `⋯` menu (`SkillLifecycleMenu.tsx`, `MoveToProjectDialog.tsx`).

`skills.ts`'s pure predicate functions are well-factored and the unit tests in
`skills.test.ts` genuinely exercise the matrix, including the `lane="cold"`
override for shadowed-merged rows. However, that `lane` parameter is never
actually threaded through the live drag pipeline — `SkillRow`'s `onDragStart`
does not record which lane a row was dragged from, so `ScopeRail` and
`Skills.tsx`'s `handleDropOnScope` always resolve drops with the default
`"active"` lane. For a skill that is both active elsewhere and dormant (a
shadowed-merged row, the exact case Cold Storage was built to surface per
98-REVIEW WR-04), dragging it out of the Cold Storage view resolves against
the wrong branch of the matrix — in the worst case, dropping such a row back
onto its own "Cold Storage" rail entry silently **archives the skill's live
active copy**, a destructive action the drag matrix's own doc comments claim
can never diverge from the menu. This is the single most severe finding
(CR-02).

Separately, the optimistic pending-move reconciliation in
`usePendingLifecycleMoves.ts` correlates strictly by `commandId` inside its
`useEffect` — that part is correct and tested. But the `clearPending(skillName)`
escape hatch used by `Skills.tsx`'s LAYER-1-refusal `.catch()` handler takes no
`commandId` and unconditionally deletes whatever is currently pending for that
skill name. Nothing in the UI prevents starting a second drag for a skill
while a prior move is still in flight, so a slow-then-failing first command
can wipe out a second, still-in-flight command's optimistic indicator
(CR-01) — directly violating the "never reconcile the wrong drag" invariant
the hook's own doc comment states.

## Critical Issues

### CR-01: `clearPending` deletes by skillName only, not by commandId — a stale rejection can wipe a newer in-flight move

**File:** `src/hooks/usePendingLifecycleMoves.ts:42-46,63-70`
**File:** `src/pages/Skills.tsx:174-209` (the exercising call site, `.catch()` at line 205-208)

**Issue:** `PendingLifecycleMoves.clearPending` is typed as `(skillName: string) => void` and its implementation deletes `next[skillName]` unconditionally:

```ts
const clearPending = useCallback((skillName: string) => {
  setPending((prev) => {
    if (!(skillName in prev)) return prev;
    const next = { ...prev };
    delete next[skillName];
    return next;
  });
}, []);
```

`handleDropOnScope` in `Skills.tsx` calls `beginPending` (paint) then fires
`enqueueLifecycle(...).catch((err) => { clearPending(skillName); ... })`.
Nothing disables dragging a row while it already has a pending move (the
`pending` overlay in `SkillRow.tsx` is purely cosmetic — `draggable` stays
`true`), so a user can drag the same skill a second time before the first
`enqueueLifecycle` call settles:

1. Drag `foo` → Cold. `beginPending("foo", {commandId: A, ...})`; `enqueueLifecycle(A)` in flight.
2. Before it settles, drag `foo` again → Global. `beginPending("foo", {commandId: B, ...})` overwrites `pending.foo` with B; `enqueueLifecycle(B)` in flight.
3. Command A rejects (e.g. a LAYER-1 refusal). Its `.catch()` fires `clearPending("foo")`, which deletes `pending.foo` **regardless of the fact it now holds commandId B**, and shows a toast for A's error while B is still (or already successfully) executing.

The reconcile `useEffect` correctly guards this exact scenario by matching
`row.commandId === move.commandId` before clearing — but the direct
`clearPending` escape hatch bypasses that guard entirely, so command A's
failure can erase the optimistic UI for command B, leaving the row looking
"settled" while B may still be pending, and surfacing a toast that describes
the wrong action.

**Fix:** Give `clearPending` (and `beginPending`'s overwrite) commandId
awareness, e.g.:

```ts
const clearPending = useCallback((skillName: string, commandId?: string) => {
  setPending((prev) => {
    const current = prev[skillName];
    if (!current) return prev;
    if (commandId && current.commandId !== commandId) return prev; // superseded — leave the newer entry alone
    const next = { ...prev };
    delete next[skillName];
    return next;
  });
}, []);
```

and pass the locally-captured `commandId` from `handleDropOnScope`'s
`.catch()`:

```ts
const commandId = crypto.randomUUID();
beginPending(skillName, { commandId, action: result.action, destination: result.destination });
enqueueLifecycle({ ... , commandId, ... }).catch((err: unknown) => {
  clearPending(skillName, commandId);
  toast.error(lifecycleRefusalMessage(err));
});
```

### CR-02: Drag path never threads `lane` — shadowed rows dragged from Cold Storage resolve against the wrong branch, and can silently archive the live copy

**File:** `src/components/skills/SkillRow.tsx:86-91` (drag payload has no lane)
**File:** `src/components/skills/ScopeRail.tsx:60` (`resolveScopeDrop(draggingSkill, scope)` — no lane arg)
**File:** `src/pages/Skills.tsx:181` (`resolveScopeDrop(skill, scope as ...)` — no lane arg)

**Issue:** `resolveScopeDrop`/`resolveLifecycleActions` accept a `lane`
parameter specifically so a row rendered in the Cold Storage view (a
shadowed-merged skill: dormant copy + an active copy elsewhere, per
98-REVIEW WR-04) is treated as the dormant copy, exactly as
`SkillLifecycleMenu` does when it's rendered with `lane="cold"`
(`ColdStorageView.tsx:55`, `SkillRow.tsx:153` forwards `lane` to the menu).

The drag path never captures or forwards this. `SkillRow`'s `onDragStart`
only does:

```ts
onDragStart={(e) => {
  e.dataTransfer.setData("text/plain", skill.name);
  e.dataTransfer.effectAllowed = "move";
  setDraggingSkill(skill);
}}
```

`skill` carries no lane marker, so both `ScopeRail`'s hover-preview
(`resolveScopeDrop(draggingSkill, scope)`) and `Skills.tsx`'s
`handleDropOnScope` (`resolveScopeDrop(skill, scope as "global" | "project" | "cold")`)
always resolve with the default `lane="active"` — even when the row being
dragged was rendered by `ColdStorageView` with `lane="cold"`.

Concretely, for a shadowed-merged skill `{ origins: [DORMANT_ORIGIN,
"claude-code"] }` shown in Cold Storage:

- Under the (wrong) default `lane="active"`: `dormant=false`, `shadowed=true`,
  `activeOrigin="claude-code"` → falls into the `isActiveGlobal` branch.
- Dragging it to **Global** resolves to `{ kind: "noop" }` instead of the
  menu's correct `{ kind: "reject", hint: "Shadowed by an active skill —
  archive it first." }` — the user gets silent nothing instead of the honest
  block the `⋯` menu shows for the identical row.
- Dragging it back onto **Cold Storage** (its own visible rail entry — an
  easy misdrag from a view that IS Cold Storage) resolves to
  `{ kind: "enqueue", action: "archive", sourceOrigin: "claude-code",
  destination: "cold" }` — this **archives the skill's live active global
  copy**, a destructive, unrequested mutation the menu path would never allow
  (the menu's cold-lane branch only offers a shadow-disabled Restore and
  Delete Permanently on the dormant copy — never Archive).

This directly contradicts the module's own documented guarantee
(`skills.ts:87-90`: "the ⋯ menu and the drag path derive their allowed
actions from this ONE shared predicate, so they can never drift out of
sync") — the predicate is shared, but the `lane` input to it is not, so the
guarantee doesn't actually hold for shadowed rows. This is also unexercised
by the integration test: `Skills.test.tsx`'s "Scope drag matrix" suite
explicitly notes it "resolves the skill from `dataTransfer.getData` alone,
not from the dragging-skill context" and never constructs a
`DORMANT_ORIGIN` + active-origin fixture to drop from Cold Storage.

**Fix:** Carry the originating lane through the drag payload (e.g. via
`dataTransfer.setData` or the `draggingSkill` context) and thread it to both
call sites:

```ts
// SkillRow.tsx
onDragStart={(e) => {
  e.dataTransfer.setData("text/plain", skill.name);
  e.dataTransfer.effectAllowed = "move";
  setDraggingSkill(skill, lane ?? "active"); // extend context to carry lane
}}
```

```ts
// ScopeRail.tsx
const { draggingSkill, draggingLane } = useDraggingSkill();
const dropResult = isDropTarget && draggingSkill
  ? resolveScopeDrop(draggingSkill, scope, draggingLane)
  : null;
```

```ts
// Skills.tsx handleDropOnScope — resolve lane the same way (context, or a
// second dataTransfer key set alongside "text/plain")
const result = resolveScopeDrop(skill, scope as "global" | "project" | "cold", lane);
```

At minimum, add an integration test dropping a `DORMANT_ORIGIN` + active
shadowed fixture from the Cold Storage view to lock in the correct
(shadow-blocked) behavior before shipping.

## Warnings

### WR-01: Reconcile effect only re-runs on `lifecycleCommands` changes — a pending entry added when its command is already terminal can get stuck

**File:** `src/hooks/usePendingLifecycleMoves.ts:75-98`
**File:** `src/pages/Skills.tsx:492-503` (the exposed call site)
**File:** `src/components/skills/MoveToProjectDialog.tsx:79-103` (`onMoved` fires after `await`)

**Issue:** The reconcile `useEffect`'s dependency array is `[lifecycleCommands]`
only — it does not re-run when `pending` itself changes. `beginPending` is a
plain `setPending` call with no correctness check against the current
`lifecycleCommands` snapshot. This is safe for `handleDropOnScope`'s direct
enqueue branch, which calls `beginPending` *before* `enqueueLifecycle` is even
invoked ("paint-before-await" — the row's command cannot possibly be terminal
yet).

But the Move-to-Project dialog path breaks that invariant: `Skills.tsx`'s
`onMoved` handler calls `beginPending` only *after* `enqueueLifecycle` has
already resolved (`MoveToProjectDialog.tsx:93` calls `onMoved?.(commandId)`
post-`await`). If, by the time that callback runs, the reactive
`lifecycleCommands` query has already delivered a terminal row for that
`commandId` in the *same* snapshot the reconcile effect last saw (i.e. no
further change occurs before this `beginPending` call), the newly-added
pending entry will not be reconciled until some *unrelated* lifecycle event
happens to change the `lifecycleCommands` array reference again. Until then,
the row shows a stuck "in progress" indicator for a command that's actually
already done/failed/expired.

This is a narrow timing window in practice (the daemon-execution model means
commands are rarely terminal microseconds after `enqueueLifecycle` resolves),
but it is a real, provable structural gap: nothing forces a reconciliation
pass immediately after `beginPending`, unlike the drop-direct path's
paint-before-await ordering which sidesteps the issue by construction.

**Fix:** Either (a) have `beginPending` immediately check the current
`lifecycleCommands` for a terminal row with that `commandId` and skip adding
the entry (or immediately mark it settled), or (b) add `pending`'s keys (or a
version counter) to the effect's dependency list so a newly-added entry is
always checked against the current data on the next tick:

```ts
useEffect(() => {
  setPending((prev) => { /* existing reconcile body */ });
}, [lifecycleCommands, pending]); // guard against infinite loop via the `changed` flag already in place
```

## Info

### IN-01: `resolveScopeDrop`'s "unreachable" fallback is reachable for origin-less/unrecognized-origin skills

**File:** `src/lib/skills.ts:142-143`

**Issue:** The comment above the final fallback claims it "should be
unreachable given the shapes above," but a skill with `origins: []` (or only
unrecognized origin strings that are neither `"claude-code"` nor
`claude-code:project:*` nor the dormant sentinel) produces `dormant=false`,
`multiScope=false`, `activeOrigin=undefined`, `isActiveGlobal=false`,
`isActiveProject=false`, and falls through to `return { kind: "noop" }` here.
Not a functional bug (a silent no-op is a safe default), but the comment
overstates the guarantee and could mislead a future maintainer into removing
the branch.

**Fix:** Soften the comment to state the actual precondition (e.g., "reached
only for a skill with no recognized origin — treated as a safe no-op rather
than a crash") or add a one-line unit test in `skills.test.ts` covering
`origins: []` to document the intended behavior explicitly.

---

_Reviewed: 2026-07-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
