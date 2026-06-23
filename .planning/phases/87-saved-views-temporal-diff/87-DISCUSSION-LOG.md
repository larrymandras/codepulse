# Phase 87: Saved Views + Temporal Diff - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 87-saved-views-temporal-diff
**Areas discussed:** View persistence & sharing, What a 'view' captures, Animation data source & scope, Diff 'changed' semantics

> Context: `87-UI-SPEC.md` was generated WITHOUT a CONTEXT.md ("decisions derived from prior art").
> This discussion confirmed or corrected its principled guesses where product weight applied.

---

## View Persistence & Sharing

### Storage backend
| Option | Description | Selected |
|--------|-------------|----------|
| New Convex table | New `savedKgViews` table; satisfies SC#2 shareable links | ✓ |
| idb personal-only | Lightest, but cannot share — would scope KG-10 down | |

### Ownership scope
| Option | Description | Selected |
|--------|-------------|----------|
| Global to deployment | No owner field; all operators see all views; matches single-operator reality | ✓ |
| Per-user (Clerk) | Scoped to Clerk identity; needs auth ON; extra schema | |

### Share-link token
| Option | Description | Selected |
|--------|-------------|----------|
| Short opaque random token | `?view=<token>`, revocable, decoupled from doc ID | ✓ |
| Raw Convex doc ID | Zero extra field; exposes internals, not revocable | |

**User's choice:** Convex table + global scope + short opaque token (all UI-SPEC-aligned).
**Notes:** All three matched the UI-SPEC's assumptions — now confirmed rather than guessed.

---

## What a 'view' captures

### Restored state set
| Option | Description | Selected |
|--------|-------------|----------|
| Full SC#1 set: lens + filters + focus + hops | Honors SC#1 literally; re-centers on focused entity + hop depth | ✓ |
| Lens + filters only (UI-SPEC shape) | Simpler; misses focus+hops half of SC#1 | |

### Search query inclusion
| Option | Description | Selected |
|--------|-------------|----------|
| Exclude searchQuery | Saved Search view restores empty; terms are ephemeral | ✓ |
| Include searchQuery | Re-runs saved query; couples to stale text + gated endpoint | |

**User's choice:** Full SC#1 set; exclude searchQuery.
**Notes:** ⚠️ CORRECTION to UI-SPEC — its `useSavedViews` shape dropped focus+hops. Schema must add them.

---

## Animation data source & scope

### Frame date source
| Option | Description | Selected |
|--------|-------------|----------|
| Client-synthesized interval over picked range | Range+interval → even as-of dates via `fetchOverview({asOf})`; zero cross-repo dep | ✓ |
| New Ástríðr /api/kg/snapshots endpoint | Real snapshot dates; needs SEED + gate; stays dark until shipped | |
| Both: synthesized now, endpoint later | Synthesized ships now; SEED for later upgrade | |

### Degrade posture
| Option | Description | Selected |
|--------|-------------|----------|
| Graceful-degrade, no hard block | Phase-86 posture; per-frame empty/error copy; phase ships regardless | ✓ |
| Hard requirement — block until real history | Risks blocking on cross-repo dependency | |

**User's choice:** Client-synthesized intervals; graceful-degrade.
**Notes:** ⚠️ DEVIATION from UI-SPEC — no `fetchSnapshotDates()`, no Ástríðr endpoint, no SEED.
`useKgAnimation` derives frames from range+interval; `KGAnimateControls` needs a range+interval picker.
KG-11 ships fully self-contained this phase.

---

## Diff 'changed' semantics

### Node "changed" definition
| Option | Description | Selected |
|--------|-------------|----------|
| Both: fact/attribute OR relationship changes | Most informative; catches fact edits + relationship gain/loss | ✓ |
| Fact/attribute values only | Narrower; relationship-only changes wouldn't recolor node | |

### Edge diffing
| Option | Description | Selected |
|--------|-------------|----------|
| Independently classified added/removed/changed | New edge between unchanged nodes shows as added; truer KG read | ✓ |
| Inherit from node membership only | Simpler; misses pure relationship changes (KG blind spot) | |

**User's choice:** Node changed = attrs OR relationships; edges diffed independently.
**Notes:** Resolves UI-SPEC's internal tension in favor of independent edge classification.

---

## Claude's Discretion
- Animation frame interval/granularity UX (day/week/month vs auto-fit ~12–30 frames; total-frame cap)
  — implementer discretion within D-07. Playback speed (0.5×/1×/2×) is separate from frame interval.
- All visual/token/copy/layout decisions defer to `87-UI-SPEC.md` except where D-05 and D-07 correct it.

## Deferred Ideas
- Real Ástríðr-provided KG snapshot dates (`/api/kg/snapshots`) as a future swappable upgrade to
  `useKgAnimation` — not this phase.
- Per-user view ownership / sharing permissions — deferred (global scope chosen); revisit only if
  CodePulse becomes multi-tenant.
