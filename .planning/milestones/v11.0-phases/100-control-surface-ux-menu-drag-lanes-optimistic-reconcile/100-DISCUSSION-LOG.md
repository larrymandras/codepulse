# Phase 100: Control-Surface UX (⋯ Menu, Drag Lanes, Optimistic Reconcile) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
**Areas discussed:** Scope-lane layout & drag coexistence, 'Project' drop ambiguity, Optimistic reconcile boldness, UX-01/UX-04 remaining scope, Restore drag semantics, Delete safety

**Pre-discussion finding (shaped the framing):** scouting the code showed UX-01 (⋯ menu) and UX-04 (cold restore) are largely already shipped by Phases 98/99, while UX-02 (drag across scope lanes) is genuinely new — today's drag is drag-to-*category* (`updateOverride`), and there are no Global/Project/Cold scope lanes.

---

## Scope-lane layout & drag coexistence (UX-02) → D-01

| Option | Description | Selected |
|--------|-------------|----------|
| Droppable scope rail | Scope section on the existing left rail below Categories; drag row onto Global/Project/Cold. Category grid stays droppable. Different DOM targets → no payload collision. Smallest change. | ✓ |
| Kanban scope lanes | Restructure main area into 3 columns; category demoted to a filter. Biggest relayout. | |
| Transient drop overlay | Layout unchanged; drop bar slides in on drag-start. Less discoverable. | |

**User's choice:** Droppable scope rail (Recommended).
**Notes:** Keeps the current category IA intact; scope-drop fires `enqueueLifecycle`, category-drop fires `updateOverride`, independent.

---

## 'Project' drop ambiguity (UX-02) → D-03

| Option | Description | Selected |
|--------|-------------|----------|
| Open workspace picker | Drop on Project opens the existing Phase 98 MoveToProjectDialog to pick which of 5 repos. No new UI. | ✓ |
| Per-workspace targets | One drop sub-lane per synced repo. Precise but cluttered/dynamic. | |
| Active-workspace default | Move to a current workspace context if present, else picker. No ambient current-workspace on the page. | |

**User's choice:** Open workspace picker (Recommended).

---

## Optimistic reconcile boldness (UX-03) → D-05

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistic + honest rollback | Row moves to destination instantly with a pending shimmer (not 'done'); success settles, fail/expiry snaps back + toast. Snappy, visibly unconfirmed. | ✓ |
| Stay-in-place badge | Row stays in source lane, queued→executing→done/failed/expired, only moves on rescan. ≈ Phase 98's existing behavior. | |
| Ghost-in-destination | Source dims, ghost in destination; solidify on success, vanish on fail. Two rows per skill reads busy. | |

**User's choice:** Optimistic + honest rollback (Recommended).
**Notes:** Weighed against the "honest state, no false success" house rule — the pending state is always visibly unconfirmed and rolls back on failure/expiry, so it satisfies both.

---

## UX-01 / UX-04 remaining scope + cross-repo armory note → D-06 / D-07

| Option | Description | Selected |
|--------|-------------|----------|
| Completeness + defer armory | UX-01/UX-04 as a completeness/consistency audit + verification; defer the cross-repo armory tiles + tool-receipts note to its own phase/backlog. | ✓ |
| Fold in armory now | Completeness audit AND pull armory/tool-receipts into this phase. Expands into the chat-answer surface. | |
| UX-01/04 need real new work | Treat them as net-new (prominent Restore button, shadowed badge, bulk affordances). | |

**User's choice:** Completeness + defer armory (Recommended).

---

## Restore drag semantics (cold→Project) → D-02

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the menu | Drag mirrors the menu exactly: cold→Global = restore; cold→Project rejected (restore is global-only, Phase 98) with an honest 'restore to Global first, then move' hint. Zero new backend. | ✓ |
| Extend restore to Project | Direct cold→Project restore via picker. Adds a project-destination restore path + project shadow pre-check 98 left global-only. | |
| Compound restore-then-move | One gesture fires restore then move. Phase 98 rejected non-atomic compound mutations. | |

**User's choice:** Mirror the menu (Recommended).

---

## Delete safety → D-04

| Option | Description | Selected |
|--------|-------------|----------|
| Menu-only delete | Drag lanes are Global/Project/Cold only (move/archive/restore). No trash drop target; permanent delete stays behind the type-the-name confirm. | ✓ |
| Add a trash drop zone | Dedicated delete/trash drop target (still gated by the confirm). Easy misfire. | |

**User's choice:** Menu-only delete (Recommended).
**Notes:** `.claude/` has no git safety net — accidental destructive drag is unacceptable.

---

## Claude's Discretion

- Native HTML5 drag vs `dnd-kit` for the scope rail (extend native unless the optimistic interaction needs more).
- No confirmation on non-destructive drag (archive/move/restore reversible); only permanent delete keeps its confirm.
- Where the optimistic client state lives (pending-moves map keyed by `skillName`, reconciled against the lifecycle command list).
- Visual form of the pending shimmer, scope-rail drop highlight, not-allowed-cursor affordance, and rollback toast copy (reuse `IntakeStatusBadge` / `useIntake` mapping).
- Invalid/same-scope drop = not-allowed cursor vs silent no-op (must stay honest).

## Deferred Ideas

- Armory tiles + tool-receipts (chat-answer surface) — SEED-002 / astridr SEED-024 — its own phase/backlog.
- Restore-to-project as a single mutation — revisit only if two-step restore-then-move proves annoying.
- One-click compound "swap" — still rejected (non-atomic).
- Bulk multi-select lifecycle/launch — already deferred in REQUIREMENTS.
- Persistent "shadowed" badge on dormant rows — visibility polish, not required for UX-01..04.
