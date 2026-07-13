# Phase 96: UI deep-dive cleanup — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
**Areas discussed:** Mission Control vs Tasks (F1), Fake telemetry policy (F3+F4), Orphan/duplicate salvage (F5+F9), Approval flow unification (F6)

---

## Mission Control vs Tasks (F1)

| Option | Description | Selected |
|--------|-------------|----------|
| Merge into one board (Recommended) | One Tasks page with a view toggle (by-status / by-agent); kills duplication permanently | ✓ |
| Keep both, move MC to COMMAND | Cheapest honest fix; duplication remains but correctly classified | |
| Delete Mission Control | Least code, loses the per-agent view | |

**User's choice:** Merge into one board.

Follow-up — survivor & default view:

| Option | Description | Selected |
|--------|-------------|----------|
| /tasks survives, by-status default (Recommended) | Kanban-by-status default; MC's per-agent view is the toggle; /mission-control → /tasks?view=agent | ✓ |
| /tasks survives, by-agent default | Per-agent view first | |
| /mission-control survives | MC absorbs Tasks | |

**User's choice:** /tasks survives, by-status default, redirect preserved.

---

## Fake telemetry policy (F3+F4)

**Header SYS/LAT literals (DashboardLayout.tsx:712,716):**

| Option | Description | Selected |
|--------|-------------|----------|
| Wire to real data (Recommended) | systemResources via Convex; hide readout when no recent data | ✓ |
| Remove the readout | Drop SYS/LAT entirely | |

**Security Audit Chain "Valid" hardcode (Security.tsx:223,227):**

| Option | Description | Selected |
|--------|-------------|----------|
| Remove the fake badge (Recommended) | Drop the integrity claim; keep entry count labeled honestly | ✓ |
| Compute real integrity | Real chain verification in Convex — bigger than a UI cleanup phase | |
| Label as static/unverified | Keep badge with 'not live-verified' caption | |

**Automation static cron list (Automation.tsx:34-40):**

| Option | Description | Selected |
|--------|-------------|----------|
| Label as configured, not live (Recommended) | Keep static catalog, drop fake enabled indicators and totalJobs ?? 12; live cron deferred | ✓ |
| Wire live cron state now | Cross-repo emission work inside a UI cleanup phase | |
| Remove the cron section | Drop the list until real data exists | |

**Duplicated Network Policy placeholder (Infrastructure.tsx:259-263, Security.tsx:425-444):**

| Option | Description | Selected |
|--------|-------------|----------|
| Remove both (Recommended) | Empty placeholder on two pages; deferred until a real allowlist exists | ✓ |
| Keep on Security only | | |
| Keep on Infrastructure only | | |

---

## Orphan/duplicate salvage (F5+F9)

**Profiles.tsx + Agents.tsx (~900 dead lines):**

| Option | Description | Selected |
|--------|-------------|----------|
| Delete both outright (Recommended) | Unreachable since HR restructure; git history preserves the code | ✓ |
| Salvage Agents.tsx tabs into HR first | Port DnD registry/runtime/topology/security tabs, then delete | |

**Memory "Durable Facts" vs Dreaming "Facts" duplication:**

| Option | Description | Selected |
|--------|-------------|----------|
| Shared component, keep both surfaces (Recommended) | Extract one FactsTable used by both pages | ✓ |
| Keep Memory only | | |
| Keep Dreaming only | | |

**Dead-UI policy (TokenSavingsIndicator zeros, void errorTrend, disabled stubs, unused imports, Skills onDelete no-op, MeetingBot hardcoded names):**

| Option | Description | Selected |
|--------|-------------|----------|
| Remove dead, wire the two cheap ones (Recommended) | Delete dead/disabled UI; wire MeetingBot to live roster; real Skills delete handler or drop affordance | ✓ |
| Remove everything, wire nothing | Pure deletion pass | |
| Keep disabled stubs as roadmap hints | Keep Import Conversations / Start Backfill visible-but-disabled | |

---

## Approval flow unification (F6)

| Option | Description | Selected |
|--------|-------------|----------|
| Verify, fix, and unify (Recommended) | Read Ástríðr WS handler contract, fix the wrong sender, extract one shared approval component | ✓ |
| Verify and fix only | Fix broken payload, leave two UIs | |
| Verify only, defer fixes | Document only; leaves a known-broken approval path live | |

---

## Claude's Discretion

- F2 CommandPalette fix approach (import `navItems`, fix stale deep links)
- F7 `<PageHeader>` API shape + 35-page migration order; removal of `max-h-[500px]` caps
- F8 mobile collapse pattern per page (stacked vs toggleable)
- F10 minors; whether DOM `bg-[#09090b]` canvas backgrounds ride along
- Wave/ordering structure

## Deferred Ideas

- Live cron state telemetry (Ástríðr-side cron-status emission → Convex → Automation)
- Real Provider Allowlist / Network Policy feature
- Real audit-chain integrity verification in Convex
