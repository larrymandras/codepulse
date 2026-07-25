# Phase 98: Skill Lifecycle Mutations (Archive / Restore / Move / Delete) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 98-skill-lifecycle-mutations-archive-restore-move-delete
**Areas discussed:** Executor engine, isShadowing guard, Delete semantics, Phase-98 UI surface

---

## Executor engine

| Option | Description | Selected |
|--------|-------------|----------|
| Native TS in daemon (Recommended) | Lifecycle ops are directory renames — no validation pipeline needed; daemon already owns the fs surface (skill-rescan); skill-intake is install-only, manage-skills is a SKILL.md procedure not a binary | ✓ |
| Extend skill-intake CLI | Add lifecycle verbs to the canonical Python tool and shell out (mirrors D-02's single-source-of-truth rationale) | |
| You decide | Let research confirm tooling and pick at plan time | |

**User's choice:** Native TS in daemon

| Option | Description | Selected |
|--------|-------------|----------|
| Fail clean (Recommended) | Archive fails with actionable error if a dormant same-name copy exists in cold storage; nothing moves; operator resolves manually | ✓ |
| Suffix the incoming copy | Land as `name-2/`/timestamped — never blocks but pollutes cold storage | |
| Overwrite the cold copy | Newest wins — silently destroys the old dormant version | |

**User's choice:** Fail clean on cold-storage collision
**Notes:** Command-type/payload shape, rescan-after-mutation, and atomic move mechanics left to Phase 97 precedent + Claude discretion.

---

## isShadowing guard

| Option | Description | Selected |
|--------|-------------|----------|
| Hard block (Recommended) | Restore refused with clear error ("archive the active one first") — two deliberate steps | ✓ |
| Flag + offer swap | One-click archive-then-restore compound command — requires atomic two-mutation sequencing | |
| Allow with warning | Proceed with persistent shadowed badge — but duplicate active names are a real conflict in Claude Code | |

**User's choice:** Hard block

| Option | Description | Selected |
|--------|-------------|----------|
| Both layers (Recommended) | Convex enqueue pre-checks registry (instant feedback) AND daemon re-verifies live filesystem (host truth wins) | ✓ |
| Daemon only | Single authority but full round-trip to learn a restore was doomed | |
| Convex only | Instant but registry is a snapshot — out-of-band file changes slip through | |

**User's choice:** Both layers

---

## Delete semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Cold storage only (Recommended) | Permanent delete exists solely on cold rows — forces archive→delete two-step through a reversible state | ✓ |
| Anywhere, behind confirm | Any row offers permanent delete — one less step but no dormant copy ever exists on misclick | |
| You decide | Planner picks by UI ergonomics | |

**User's choice:** Cold storage only

| Option | Description | Selected |
|--------|-------------|----------|
| Type the skill name (Recommended) | GitHub-style: destructive button enables only after typing the exact name — .claude/ has no git safety net | ✓ |
| Two-step confirm dialog | Standard AlertDialog with red button — rhythm-click can get through | |
| OS recycle bin as backstop | Daemon moves dir to Recycle Bin instead of unlinking — recoverable but untracked | |

**User's choice:** Type the skill name
**Notes:** Archive itself (the default "delete") is reversible — light/no confirm, Claude's discretion.

---

## Phase-98 UI surface

| Option | Description | Selected |
|--------|-------------|----------|
| Simple ⋯ menu now (Recommended) | Basic shadcn DropdownMenu on SkillRow/ColdStorageView with scope-valid actions; Phase 100 upgrades in place — no throwaway buttons | ✓ |
| Inline icon buttons | Fastest but crowded and ripped out by Phase 100 | |
| Detail-panel actions only | Rows untouched but mutations buried a click deep | |

**User's choice:** Simple ⋯ menu now

| Option | Description | Selected |
|--------|-------------|----------|
| Badge, row stays put (Recommended) | Pending/executing badge in current lane, flips on rescan; honest expiry when daemon offline | ✓ |
| Optimistic move now | Pulls Phase 100's UX-03 forward — scope growth | |
| You decide | Whatever falls out of intake-row reuse | |

**User's choice:** Badge, row stays put

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled + reason (Recommended) | Restore item disabled with tooltip/inline reason via existing isShadowing helper; daemon backstops staleness | ✓ |
| Enabled, error on attempt | Clickable but rejected at enqueue — invites dead-end clicks | |
| Shadow badge + disabled | Persistent badge even before action — Phase 100 polish territory | |

**User's choice:** Disabled + reason
**Notes:** "Move → project" reuses the intake workspace-picker pattern (97 D-04); exact form at Claude's discretion.

---

## Claude's Discretion

- Archive confirmation weight (light or none — reversible action)
- Move-to-project workspace-picker dialog form (reuse intake pattern)
- Lifecycle commandType/payload shape + supportedTypes advertising (follow launch/stop/intake precedent)
- Atomic move mechanics (rename vs copy-verify-delete cross-volume)
- Whether to fix the forge workspace-startup-snapshot follow-up inside this phase (recommended — move-to-project depends on it)

## Deferred Ideas

- Optimistic lane-move + reconcile, drag lanes — Phase 100 (UX-02/03)
- One-click "swap" compound command — possible Phase 100+ convenience
- Persistent "shadowed" badge on dormant rows — Phase 100 visibility polish
- Bulk multi-select lifecycle actions — already deferred in REQUIREMENTS
- OS Recycle-Bin backstop for permanent delete — considered, not chosen
