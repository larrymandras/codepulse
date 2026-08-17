# Phase 108: Per-Profile Engine Telemetry (astridr backend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 108-per-profile-engine-telemetry-astridr-backend
**Areas discussed:** Profile identity plumbing, Scoped swap command shape, Emit cadence + row volume, control_verb_swap route + readout

---

## Profile identity plumbing

### Q1 — How should a real profileId reach ModelRouter's emit point (and the per-profile override lookup)?

| Option | Description | Selected |
|--------|-------------|----------|
| ContextVar at the loop boundary | Set once where the profile is already resolved (near `ProfileManager.resolve_profile`), read by `_emit_model_routing` and `_resolve_model`. Precedent: Phase 94's `_current_trace_id`, Phase 105's D-10 round ContextVar. Zero signature churn. | ✓ |
| Thread profile_id through chat() kwargs | Explicit param at every call site. Greppable, but any caller that forgets it silently produces an unattributed call. | |
| Resolve from session_id at emit time | Look up via ProfileManager at emit. No new mechanism, but a hot-path lookup that fails for every session-less call. | |

**User's choice:** ContextVar at the loop boundary → D-01

### Q2 — What happens when an LLM call has NO profile in context (cron, subagents, background, boot)?

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse to emit | No row written at all; ENGINE-01 read literally. Keeps CodePulse's guard as a second line, not the only one. | ✓ |
| Attribute to the resolved default profile | Fall back to `config.profiles[0].id`. Never sparse, but a cron tick renders as the personal profile's engine. | |
| Emit under an explicit non-profile scope | `profileId:"system"` sentinel, filtered UI-side. Re-introduces a sentinel into the table whose 93 sentinels had to be pruned. | |

**User's choice:** Refuse to emit → D-02

### Q3 — 103-CONTRACT.md §4 requires an emit on process start, but at boot there is no profile context. How is that resolved?

| Option | Description | Selected |
|--------|-------------|----------|
| Boot-seed per profile from config, mode:"inherited" | Emit one event per profile at the existing `bootstrap/core.py:1343-1359` loop. Not a D-14 violation: astridr reports what it resolved to, which is what "inherited" means. | ✓ |
| Drop the boot emit | Table stays empty until a profile runs a turn. Strictly honest but Phase 109 ships against an empty table. | |
| Boot-seed only profiles with an explicit pinned default | Narrower, but gaps become indistinguishable from "never ran". | |

**User's choice:** Boot-seed per profile → D-03

### Q4 — Should the same ContextVar drive the per-profile override, and where in the precedence chain?

| Option | Description | Selected |
|--------|-------------|----------|
| Same ContextVar; per-profile above global | explicit → per-profile → global → session → category → default. Unscoped path byte-identical to today. | ✓ |
| Same ContextVar; global still wins | A global voice swap overrides every profile including pinned ones. Makes a per-profile pin silently ineffective. | |
| Separate mechanism from the emitter | Override keyed by an explicitly passed id. Two sources of profile identity that can disagree. | |

**User's choice:** Per-profile above global → D-04

---

## Scoped swap command shape

### Q1 — ENGINE-02 says extend swap.set; 103-CONTRACT.md §2 specifies gateway.model.set. Which ships?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend swap.set with optional scope | ENGINE-02's own wording; keeps one dispatch path and the docstring's "never a parallel mutation" promise. Requires correcting the contract. | ✓ |
| Implement gateway.model.set as specified | Honours the written contract, but creates a second command surface and a second path into the same override state. | |
| Extend swap.set, keep gateway.model.set as an alias | Max compatibility; two names for one behaviour. | |

**User's choice:** Extend swap.set → D-05

### Q2 — Does the scoped swap support the contract's session (1h TTL) vs default (sticky) modes?

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime-only, no TTL — mirror the global axis | Same lifetime as `_global_model_override`. One less mechanism to prove at the live gate. `expiresAt` / `mode:"session"` recorded as deferred. | ✓ |
| Support session TTL as specified | Fully honours the contract; adds expiry bookkeeping and a second live behaviour ENGINE-05 must prove. | |
| Sticky-only, persisted across restart | Most durable, but a persisted override IS a config read — collapses the D-14 boundary. | |

**User's choice:** Runtime-only, no TTL → D-06

### Q3 — Does a spoken swap become per-profile automatically from the channel's resolved profile?

| Option | Description | Selected |
|--------|-------------|----------|
| Spoken stays global; only explicit scope is per-profile | Preserves ENGINE-02's byte-identical guarantee literally; spoken UX unchanged. | ✓ |
| Spoken becomes per-profile from the channel | More intuitive per-persona behaviour, but silently changes today's behaviour for every existing voice swap. | |
| Spoken per-profile behind an opt-in phrase | Preserves the default while exposing the axis by voice; adds NLU surface and a second resolver path. | |

**User's choice:** Spoken stays global → D-07

### Q4 — What happens to 103-CONTRACT.md, whose §1 status and §2 command shape are now both false?

| Option | Description | Selected |
|--------|-------------|----------|
| Correct it in place, as a Phase 108 deliverable | Same commit as the code, per the Stale Docs rule. It is the doc Phase 109 binds to. | ✓ |
| Supersede it with a fresh 108-CONTRACT.md | Cleaner archive hygiene, but two contracts for one axis. | |
| Correct it AND stamp the stale claims visibly | Most faithful to project convention; noisier document. | |

**User's choice:** Correct in place → D-08

---

## Emit cadence + row volume

### Q1 — What cadence ships, given model_routing fires on every LLM resolution into an unpruned table?

| Option | Description | Selected |
|--------|-------------|----------|
| Emit-on-change in astridr | Per-profile last-emitted tuple; send only on difference, plus the boot seed. Contract-literal (§4 says "resolution change"). | ✓ |
| Emit every resolution, dedupe at ingest | Simple emitter, but a Convex read+write per LLM call on the ingest hot path. | |
| Emit every resolution, store every row | Genuine per-call history; unbounded growth on an unpruned table — the 2026-07-21/22 shape. | |

**User's choice:** Emit-on-change in astridr → D-09

### Q2 — activeEngineSnapshots is absent from RETENTION_DAYS. Do we bound it here?

| Option | Description | Selected |
|--------|-------------|----------|
| Add it to RETENTION_DAYS in this phase | The pre-emptive move already recorded for `gatewayQuotaSnapshots` and `toolPolicyEvents`. This phase is what starts feeding it. | ✓ |
| Leave it to Phase 110 (DUR-01) | Cleaner separation, but 110 is independent and may run after 109. | |
| No retention — emit-on-change makes it negligible | True today; makes the bound depend on a behaviour a future change could undo. | |

**User's choice:** Add it here → D-10

### Q3 — astridr sends selectedModel; CodePulse reads d.model. Which side changes?

| Option | Description | Selected |
|--------|-------------|----------|
| Rename in astridr to match the contract | Fix the producer; one name for one thing. Check for other consumers first. | ✓ |
| Widen CodePulse's coalescing to accept both | Zero cross-repo risk; enshrines two names and leaves the contract contradicted. | |
| Rename AND widen | Belt and braces during the rebuild window; leaves a dead coalescing branch. | |

**User's choice:** Rename in astridr → D-11

### Q4 — How is the mode field (session|pinned|inherited) derived at emit?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from selection_path | `_resolve_model` already returns why a model won. One source of truth; mode can never disagree with the path. | ✓ |
| Set mode explicitly at each emit call site | Most explicit; can drift from selection_path. | |
| Drop mode; derive it in CodePulse | Minimal payload; deriving semantics consumer-side is how repos drift. | |

**User's choice:** Derive from selection_path → D-12

---

## control_verb_swap route + readout

### Q1 — What lands in the domain table, given the payload has no profileId and fires on refusals too?

| Option | Description | Selected |
|--------|-------------|----------|
| Every emit, with an outcome field + profile scope | All emit sites stored, `path`/`reason` carried through, scope added. Refusals are the operationally interesting rows. | ✓ |
| Successes only | Cleanest "history" reading; loses the affinity-guard and resolver failures. | |
| Every emit, verbatim payload, no new fields | Zero emitter change; a table with no profile column cannot deliver per-profile history. | |

**User's choice:** Every emit + outcome + scope → D-13
**Notes:** Mid-question verification found **six** emit sites, not the two cited in REQUIREMENTS.md — `swap_model.py:444,472,483,495` plus `swap_voice.py:211,232`.

### Q2 — Does the table hold voice swaps too, or brain only?

| Option | Description | Selected |
|--------|-------------|----------|
| Both, discriminated by verb | One table, existing `verb` field as discriminator, readout filtered to brain. | ✓ |
| Brain only; voice stays in runtime_events | Smallest table, but an undocumented disposition for a Group B sub-kind — what TELE-03 exists to prevent. | |
| Two separate tables | Cleanest per-axis reads; two schemas and two retention entries for one event shape. | |

**User's choice:** Both, discriminated by verb → D-14

### Q3 — Where does TELE-02's minimal per-profile swap-history readout live?

| Option | Description | Selected |
|--------|-------------|----------|
| A history section inside the existing GlobalSwapModal | Already exists from Phase 103; the surface an operator is on when history is relevant. No new route or nav entry. | ✓ |
| A panel on an existing page (Settings/Dashboard) | More discoverable, but plants a surface Phase 109 may want to move. | |
| Query only — no UI in this phase | Purely backend; TELE-02 says "and surfaced", so it would close on something no human can see. | |

**User's choice:** GlobalSwapModal history section → D-15

### Q4 — What counts as proof for the ENGINE-05 integration gate?

| Option | Description | Selected |
|--------|-------------|----------|
| Live scoped swap read back from Convex rows | Rebuild, real scoped swap, then read the backend rows directly: real profileId + model, other profiles unchanged, matching history row, plus the unscoped control. The 106-08 Test 8 precedent. | ✓ |
| Live swap verified through the CodePulse UI | Closer to the operator path, but 108 would gate on UI Phase 109 has not built yet. | |
| Integration test against a running stack in CI | Repeatable, but this stack is self-hosted with no CI path, and the BSC-05 lesson is about the live machine specifically. | |

**User's choice:** Backend row readback → D-16

---

## Claude's Discretion

- Restore semantics when both a global and a per-profile override are live (derive from D-04's precedence)
- Exact ContextVar set-point, subagent inheritance, and asyncio task-boundary behaviour
- Retention windows for `activeEngineSnapshots` and the new swap-history table
- New table name, schema, and indexes for the `control_verb_swap` route
- Whether the `status="failed"` resolution emit writes a snapshot row at all
- Bounding/pagination of the swap-history readout query
- Auth tier for the new scope field on `swap.set` (103-CONTRACT.md §6, ASVS V4)

## Deferred Ideas

- Session-mode swaps with a TTL (`mode:"session"`, `activeEngineSnapshots.expiresAt`) — D-06
- `gateway.model.set` as a distinct command — rejected by D-05, recorded in the corrected contract
- Voice swap history as a surfaced feature — rows captured by D-14, readout filters to brain
- `brain.fallback` telemetry (103-CONTRACT.md §5) — real gap, outside this phase's four requirements
- Auto-scoping a spoken swap by channel profile — rejected by D-07
- Rendering global-vs-per-profile axis disagreement (103-CONTRACT.md §9) — Phase 109 or later
