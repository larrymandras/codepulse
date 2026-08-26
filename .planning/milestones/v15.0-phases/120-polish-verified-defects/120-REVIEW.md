---
phase: 120-polish-verified-defects
reviewed: 2026-08-17T00:00:00Z
depth: deep
files_reviewed: 76
files_reviewed_list:
  - e2e/polish-geometry.spec.ts
  - src/components/ActiveSessions.tsx
  - src/components/AgentAvatar.tsx
  - src/components/AgentTopology.tsx
  - src/components/AgentVoiceCard.tsx
  - src/components/BlackboardPanel.tsx
  - src/components/CallGraphPanel.tsx
  - src/components/CallStatsBar.tsx
  - src/components/CommandTryItForm.tsx
  - src/components/ConnectionPopover.tsx
  - src/components/ConversationTimeline.tsx
  - src/components/CostBreakdown.tsx
  - src/components/DockerPanel.tsx
  - src/components/DriftTimeline.tsx
  - src/components/EStopButton.tsx
  - src/components/EventFeed.tsx
  - src/components/FactsTable.tsx
  - src/components/GitActivityWidget.tsx
  - src/components/HeroStatsBar.tsx
  - src/components/MetricCard.tsx
  - src/components/OperatorScoreCard.tsx
  - src/components/PulseChart.tsx
  - src/components/RunTimeline.tsx
  - src/components/StatusBadge.test.tsx
  - src/components/StatusBadge.tsx
  - src/components/TeamStatusCards.tsx
  - src/components/ToolBreakdown.tsx
  - src/components/ToolExecutionPanel.tsx
  - src/components/WarRoomKanbanColumn.tsx
  - src/components/__tests__/EStopButton.test.tsx
  - src/components/blocks/ThinkingBlock.tsx
  - src/components/brains/BrainHeaderBadge.tsx
  - src/components/brains/BrainPicker.tsx
  - src/components/brains/GlobalSwapModal.tsx
  - src/components/forge/ForgeMetadataPanel.tsx
  - src/components/forge/ForgeStatusBadge.test.tsx
  - src/components/forge/ForgeStatusBadge.tsx
  - src/components/hr/AgentCard.tsx
  - src/components/hr/AgentDetailSheet.tsx
  - src/components/hr/CatalogBrowser.tsx
  - src/components/hr/CatalogCard.tsx
  - src/components/hr/TeamCard.tsx
  - src/components/hr/TeamEditor.tsx
  - src/components/hr/WizardShell.tsx
  - src/components/hr/detail/DetailConfigTab.tsx
  - src/components/skills/NewSkillsBanner.tsx
  - src/components/skills/ScopeRail.tsx
  - src/components/skills/SkillCommandDeck.tsx
  - src/components/tasks/MoveToActionConfirmDialog.test.tsx
  - src/components/tasks/MoveToActionConfirmDialog.tsx
  - src/components/warroom/DeleteWarRoomDialog.test.tsx
  - src/components/warroom/DeleteWarRoomDialog.tsx
  - src/components/workspace/WorkspaceMapCanvas.tsx
  - src/index.css
  - src/layouts/DashboardLayout.tsx
  - src/lib/prefersReducedMotion.test.ts
  - src/lib/prefersReducedMotion.ts
  - src/pages/Analytics.tsx
  - src/pages/Dashboard.tsx
  - src/pages/Dreaming.tsx
  - src/pages/ForgePage.tsx
  - src/pages/GraphsHub.tsx
  - src/pages/HivePage.tsx
  - src/pages/Infrastructure.tsx
  - src/pages/MeetingBot.tsx
  - src/pages/Memory.tsx
  - src/pages/Quality.tsx
  - src/pages/Settings.tsx
  - src/pages/Skills.tsx
  - src/pages/Tasks.tsx
  - src/pages/WarRoom.tsx
  - src/pages/WhatsApp.tsx
  - src/pages/hr/AgentAnalytics.tsx
  - src/pages/hr/Catalog.tsx
  - src/pages/hr/Roster.tsx
  - src/pages/hr/Teams.tsx
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 120: Code Review Report

**Reviewed:** 2026-08-17
**Depth:** deep (full read of every changed file, plus cross-file trace of the two new
AlertDialog confirms into their page-level callers, and of every `animate-pulse`
gate into the Record/consumption-site pattern it strips from)
**Files Reviewed:** 76
**Status:** issues_found

## Summary

This phase is almost entirely mechanical (class-string deletion) and is backed by unusually
strong self-produced evidence — a fabrication inventory, a full `animate-pulse` census with a
per-site classification table, and a geometry-fix writeup with a revert-and-refail control. I
traced every one of the ~110 `hover:scale-[1.01]` removals, all ~50 `animate-pulse`
kill/keep-gate sites, both new `AlertDialog` confirms into their page-level wiring, the
`StatusBadge`/`ForgeStatusBadge` quiet-law rewrite against its own SC#4 constraint, the
`prefersReducedMotion` helper and its consumption sites (including the two `Record`-based
`cloneElement`/regex-strip sites in `BlackboardPanel.tsx` and `CostBreakdown.tsx`/`AgentAvatar.tsx`),
and the CSS deletions in `index.css` against remaining class references (no orphans found).

One real, phase-introduced logic defect survives: `WarRoom.tsx`'s new delete-confirm handler
swallows the delete mutation's rejection instead of letting it propagate, which silently defeats
the new `DeleteWarRoomDialog`'s documented "stay open and let the operator retry on failure"
contract — the dialog closes on every outcome, success or failure. `Tasks.tsx`'s analogous new
handler does not have this problem (no local try/catch), which is what makes this a genuine
asymmetry rather than a shared, intentional pattern.

Everything else checked out: the reduced-motion gates are wired correctly (including the two
`Record`-value consumption-site strips, verified against the literal Record contents); the quiet
badge law removes the fill exactly on `ok`/`warn`/`info` and leaves it exactly on `error` in both
`StatusBadge.tsx` and `ForgeStatusBadge.tsx`, with SC#4 (`auth_failed` vs `failed` distinctness)
intact by token rather than by fill color; the two new `AlertDialog`s correctly gate Confirm (via
`e.preventDefault()` + explicit `onOpenChange(false)` only after a resolved promise), correctly do
not fire on Cancel, and have no timeout; the header `flex-wrap`/`min-h-14`/`gap-y-1` change and the
`EStopButton` `shrink-0`/`whitespace-nowrap` fix are both backed by a Playwright spec with a
load-bearing revert-and-refail control that I read and re-derived by hand against the current
source; and no CSS class deleted from `index.css` (`.matrix-bg`, `.glitch-text`, `.nav-active-shadow`,
`.nav-hover-shadow`) has any remaining reference anywhere in `src/`.

## Warnings

### WR-01: DeleteWarRoomDialog's "stay open on failure" contract is defeated by its own caller

**File:** `src/pages/WarRoom.tsx:102-123` (the new `handleConfirmDeleteRoom`, wired as
`onConfirm` at `WarRoom.tsx:492`), contradicting `src/components/warroom/DeleteWarRoomDialog.tsx:53-65`

**Issue:** `DeleteWarRoomDialog.handleConfirm` is explicitly designed, and documented in its own
header comment, to keep the dialog open on a rejected `onConfirm` so the operator can retry:

```tsx
// src/components/warroom/DeleteWarRoomDialog.tsx:53-65
const handleConfirm = async () => {
  setSubmitting(true);
  try {
    await onConfirm();
    // Close ONLY on success — a rejected delete keeps the dialog open so
    // the operator can retry, with the error toasted instead.
    onOpenChange(false);
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : "Failed to delete room");
  } finally {
    setSubmitting(false);
  }
};
```

This mechanism only works if the `onConfirm` prop actually rejects when the delete fails. The
`onConfirm` wired at the call site is `handleConfirmDeleteRoom`, which is the pre-phase
`window.confirm` handler's body carried over almost verbatim — including its own top-level
`try { ... } catch (err) { toast.error(...) }`, which **swallows** the `deleteWarRoom` mutation's
rejection and returns normally instead of re-throwing:

```tsx
// src/pages/WarRoom.tsx:102-123
const handleConfirmDeleteRoom = useCallback(async () => {
  if (!pendingDeleteRoom) return;
  const room = pendingDeleteRoom;
  try {
    if (room.status === "active") {
      try { await closeWarRoom(room.roomId); } catch { /* no live room to close */ }
    }
    await deleteWarRoom({ roomId: room.roomId });
    setSelectedRoomId((cur) => (cur === room.roomId ? null : cur));
    toast.success(`Deleted "${room.name}"`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to delete room");
  }
}, [deleteWarRoom, pendingDeleteRoom]);
```

Because this function never re-throws, `DeleteWarRoomDialog`'s `await onConfirm()` always
resolves — its own `catch` branch (the one that would keep the dialog open) is dead code when
reached through this caller. The dialog therefore calls `onOpenChange(false)` and closes
**whether the delete succeeded or failed**. The operator does get an error toast, but the
documented retry affordance ("a rejected delete keeps the dialog open so the operator can
retry") never fires — they have to reopen the delete flow from the room list instead of retrying
in place. This is a phase-introduced regression, not a pre-existing pattern: the old
`window.confirm`-gated code had the same internal try/catch, but there was no dialog-level retry
contract for it to defeat.

The component's own test suite (`DeleteWarRoomDialog.test.tsx:73-89`) proves the *component* keeps
the dialog open on a rejecting `onConfirm` — it passes a raw `vi.fn().mockRejectedValue(...)`
directly, bypassing `WarRoom.tsx` entirely. That test is correct and passes, but it cannot catch
this defect because it never exercises the real caller.

**Confidence:** High — traced the full call chain (`DeleteWarRoomDialog.tsx` → `WarRoom.tsx`) and
the `MoveToActionConfirmDialog`/`Tasks.tsx` sibling for contrast (its `handleConfirmMove` at
`Tasks.tsx:162-171` has no try/catch, so `moveColumn`'s rejection propagates correctly there,
confirming this is an isolated regression, not a repo-wide pattern).

**Fix:** Re-throw from `handleConfirmDeleteRoom` (or drop its outer try/catch and let the toast
live in the dialog's own catch, matching `MoveToActionConfirmDialog`'s pattern):

```tsx
const handleConfirmDeleteRoom = useCallback(async () => {
  if (!pendingDeleteRoom) return;
  const room = pendingDeleteRoom;
  if (room.status === "active") {
    try { await closeWarRoom(room.roomId); } catch { /* no live room to close */ }
  }
  await deleteWarRoom({ roomId: room.roomId }); // let a rejection propagate to the dialog
  setSelectedRoomId((cur) => (cur === room.roomId ? null : cur));
  toast.success(`Deleted "${room.name}"`);
}, [deleteWarRoom, pendingDeleteRoom]);
```

## Info

### IN-01: Empty `className=""` left after the `hover:scale-[1.01]` sweep

**File:** `src/components/CallGraphPanel.tsx:21,44,59`; `src/pages/Dashboard.tsx:113,119,153,158,167,172`
(and likely a few more of the ~110 sweep sites — not separately enumerated here)

**Issue:** Several sites in the mechanical `hover:scale-[1.01] transition-transform duration-300`
removal had nothing else in their class string, leaving `className=""` (`CallGraphPanel.tsx`) or
`className=""` on a plain wrapper `<div>` (`Dashboard.tsx`) rather than dropping the prop
entirely. Harmless — `GlassPanel`'s `cn(...)` merge and a bare `<div className="">` both no-op on
an empty string — but it is dead, slightly confusing markup left behind by a find-and-replace
sweep that could just as easily have removed the attribute.

**Confidence:** High (verified: `GlassPanel.tsx:19-23` merges `className` via `cn(...)`, which
tolerates an empty string with no effect).

**Fix:** Cosmetic only — drop the empty `className=""` attribute at these sites in a follow-up
pass. Not worth a dedicated commit on its own.

## What I dropped, and why

- **The header's `flex-wrap` + `justify-between` interaction across two lines** — when the header
  wraps to two rows, `justify-between` distributes each row's items independently, which *could*
  look asymmetric (e.g. the icon cluster right-aligned on its own second row with empty space to
  its left). I could not render the page to confirm this is actually the case, and the phase's own
  `120-GEOMETRY-EVIDENCE.md` documents a revert-and-refail Playwright control plus an
  approved-without-detail human check at exactly this breakpoint. Speculative without a rendered
  screenshot; dropped.
- **Escape/overlay-dismiss during an in-flight confirm** — pressing Escape or clicking the overlay
  while `submitting` is `true` closes the dialog via Radix's default `onOpenChange` behavior; the
  in-flight request itself is unaffected (it closes over a local `room`/`pendingMove` snapshot, so
  no crash), but the operator loses the dialog's own visual "retrying" state if the request later
  fails. This is not new to Phase 120 — it matches the copied `DeleteSkillDialog`/
  `ForgeStopConfirmDialog` precedent verbatim, per D-14's explicit "copy the existing pattern"
  instruction. Not a phase-introduced regression; dropped.
- **`MeetingBot.tsx:512`'s surviving `hover:bg-(--accent)/50`** — a violet-accent hover effect on a
  call-history row, structurally similar to the search-pill fabrication D-05 fixed, but D-05 names
  exactly one site (`DashboardLayout.tsx:600`) and D-01 forbids adjacent cleanup beyond the
  enumerated kill list. Not a defect in this phase's own success criteria; dropped.
- **`Math.random`, `simulation`/`mock`/`demo` comment hits, decorative status dots** — all already
  swept and triaged in the phase's own `120-FABRICATION-INVENTORY.md` §4 with ~126 items dropped
  and reasons recorded there; re-verified a sample of the dropped families (Family A/C/G) against
  live code rather than re-running the full sweep from scratch, and found no disagreement.
- **`CostBreakdown.tsx`'s dead `text-${...}` runtime-interpolated Tailwind class and
  `VitalsRail.tsx`'s hardcoded Convex-connected dot** — both are real, both are explicitly recorded
  as known, deliberately-deferred residues owned by Phase 122 (see `120-FABRICATION-INVENTORY.md`
  §3), not this phase's scope; not re-reported as new findings here.

---

_Reviewed: 2026-08-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
