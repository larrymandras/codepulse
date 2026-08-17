# Phase 109: Per-Agent Engine UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 109-per-agent-engine-ui
**Areas discussed:** Client seam rewrite/retire, Post-swap reconciliation, Model-id normalization, Swap-history host

---

## Client seam rewrite/retire

### Q1 — What happens to the D-16 stub seam?

| Option | Description | Selected |
|--------|-------------|----------|
| Retire the seam | Delete stub adapter, fixtures, `BRAINS_STUB_ACTIVE`, all four STUB chips; per-profile traffic dispatches `swap.set`/`swap.catalogue` through the sender the global axis already uses. Caveat: `playwright.config.ts` sets `VITE_BRAINS_STUB=true` for CI. | ✓ |
| Repoint, keep the flag | Rewrite only the live adapter's two methods; keep the stub + flag for tests and offline dev. Smaller diff, e2e unchanged. | |
| You decide | Claude's discretion. | |

**User's choice:** Retire the seam
**Notes:** Recommended on the grounds that a build-time flag deciding whether the operator sees real or fabricated data contradicts the milestone's purpose. → CONTEXT.md **D-01**

### Q2 — What replaces the per-profile catalogue source?

| Option | Description | Selected |
|--------|-------------|----------|
| One catalogue, both scopes | Delete the scope-conditional fetch (`BrainPicker.tsx:236-266`), always use live `swap.catalogue`. Also removes the scope-toggle re-fetch race and the header badge's dead `getCatalogue()`. | ✓ |
| Keep two sources | Give the profile branch its own read. Only justified if a per-profile catalogue can legitimately differ; `_handle_swap_catalogue` takes no profile argument. | |
| You decide | Planner reads the handler and picks. | |

**User's choice:** One catalogue, both scopes
**Notes:** → CONTEXT.md **D-02**. Surfaced the D-09 consequence (grouping metadata loss), discussed separately below.

### Q3 — Where does the default profile come from after `getDefaultProfileId()` dies?

| Option | Description | Selected |
|--------|-------------|----------|
| Ástríðr reports it | Add `default_profile_id` to an existing live ack. It is a real value on that side (`config.profiles[0].id`, `wiring.py:344-350`) and 103-CONTRACT.md §3's own named field. | ✓ |
| Drop the concept | Header badge picker always opens on "All profiles"; per-profile swaps only on Settings rows. Pure CodePulse. | |
| Keep the `profiles[0]` fallback | Zero work. Cost: Convex ordering ≠ astridr config ordering, so the badge could dispatch at an unnamed profile. | |

**User's choice:** Ástríðr reports it
**Notes:** → CONTEXT.md **D-03**. Precedent cited: Phase 108 already owned small astridr changes from this roadmap.

### Q4 — What replaces `validateGatewayModelSet`?

| Option | Description | Selected |
|--------|-------------|----------|
| Drop it | The global axis already dispatches `swap.set` with no client validator; Ástríðr validates fail-closed (Pydantic union tag + `known_profile_ids()` + reject-rather-than-degrade). | ✓ |
| Port it to `validateSwapSet` | Keep the ASVS V5 contract-drift canary against the real shape. | |
| You decide | Planner decides from 103-SECURITY.md's threat model. | |

**User's choice:** Drop it
**Notes:** The deciding argument was that this validator is itself the evidence the mirror drifts — it faithfully validated a command the server never accepted. → CONTEXT.md **D-04**

---

## Post-swap reconciliation

### Q1 — Where does a per-profile swap's server confirmation come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-profile overrides in `swap.state` | Extend `build_swap_state_payload`; accessors already exist. This is literally what BSC-04 does — the global axis confirms on the override slot, not a resolved row. Rides the existing post-dispatch push, so the 4s timeout holds. | ✓ |
| Emit a routing row on set | Mirror `_emit_restore_routing` on the success path. Cost: lands after the ~5s batch, so the 4s timeout would nearly always fire "accepted, unconfirmed"; asserts a resolution that has not happened. | |
| CodePulse-only honest state | Add a "pinned; takes effect next turn" terminal state. Zero cross-repo, fully honest. Cost: never matches BSC-04 for an idle profile. | |

**User's choice:** Per-profile overrides in `swap.state`
**Notes:** Grounded on reading `GlobalSwapModal.tsx:451-458` — the confirm compares `modelOverride === confirmTarget`, i.e. the override slot. → CONTEXT.md **D-05**

### Q2 — Does the per-profile override become a rung in `resolveActiveBrain`?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add it above global | New order mirroring astridr's own chain. Fixes the §9 precedence inversion *and* the post-pin staleness window. Not a D-14 violation (in-memory runtime state, not config). | ✓ |
| Fix precedence only | Reorder without adding the override as a rung. Leaves the confirm dialog and the column disagreeing after a pin. | |
| Render the disagreement explicitly | Surface both axes per §9's framing. Most informative, widest change to a badge on every page. | |

**User's choice:** Yes — add it above global
**Notes:** → CONTEXT.md **D-06**. The rejected third option is preserved as a deferred idea.

### Q3 — What happens to the `lastTurn` fallback rung?

| Option | Description | Selected |
|--------|-------------|----------|
| Fleet reads only, never scoped | Keep for the no-`profileId` read (genuine `run.completed` state), remove from the scoped branch so a scoped read with no telemetry returns `source:"none"` — ENGINE-03 SC3 verbatim. Also fix the docstring citing the nonexistent "Phase 184.1". | ✓ |
| Remove the rung entirely | D-03's boot seed makes the fleet fallback nearly unreachable. Simplest resolution order. | |
| Keep as-is | Zero work. Cost: presents another profile's model as this profile's engine. | |

**User's choice:** Fleet reads only, never scoped
**Notes:** → CONTEXT.md **D-07**. Premise checked: `useResolvedBrain.ts:205-211`'s justification was falsified by Phase 108's D-01 + D-11.

---

## Model-id normalization

### Q1 — Where does canonicalization live?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared comparator, every compare site | Export `stripVendorPrefix` + add `modelIdsMatch`; apply at all four equality sites. Stored rows stay byte-faithful; tolerates the catalogue format CodePulse does not control. Needs a test that fails if a raw `===` returns. | ✓ |
| Canonicalize in `useActiveEngine` | Strip once on the read path. One place, no per-site discipline. Cost: the hook stops returning what the server reported; global-axis comparisons still uncovered. | |
| Fix the producer in astridr | The D-11 precedent verbatim. Cost: the split is two real sources, not a naming slip; catalogue comparisons still need tolerance. | |
| Normalize at ingest | Store a canonical field alongside the raw. Cost: existing rows un-normalized anyway; transforms the record of what Ástríðr said. | |

**User's choice:** Shared comparator, every compare site
**Notes:** → CONTEXT.md **D-08**. Established that display was never broken (`resolveModelDisplayName` already tolerates the prefix) — equality is.

### Q2 — What happens to Subscription/API/Local grouping and the cost-tier confirm?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from the provider registry | Map the catalogue's `vendor` onto `PROVIDER_BILLING`/`getBillingType` — real data from the registry the cost pages bill from. Unmapped vendors render "Unclassified", never defaulted to API. | ✓ |
| Accept the flattening | Single list, no cost-tier confirm; honest about what the live axis carries. Cost: loses the expensive-model guardrail. | |
| Enrich `swap.catalogue` in astridr | Add the fields on the side that knows them; benefits `BrainControl` too. Cost: a third cross-repo change; cost tier may have no source there. | |

**User's choice:** Derive from the provider registry
**Notes:** → CONTEXT.md **D-09**. The "Unclassified" clause was flagged as load-bearing, not cosmetic.

---

## Swap-history host

### Q1 — Which surface hosts the per-profile readout?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings per-profile engine row | `Settings.tsx:249-336` already lists every profile with a real `profileId`, its current engine, and its own picker. No new route, no nav entry; reads `listByScope` as-is. | ✓ |
| The pre-swap confirm modal | History at the moment of decision — D-15's original and still-sound argument, applied per-profile. Cost: only visible mid-swap. | |
| `BrainPicker`'s "This profile" scope | Reaches all four mount sites. Cost: the tallest surface in the app gets taller, across hosts with different heights. | |

**User's choice:** Settings per-profile engine row
**Notes:** → CONTEXT.md **D-10**. Closes the D-15 handoff 108-CONTEXT.md left open.

### Q2 — Per-profile-only history, or combined with global swaps?

| Option | Description | Selected |
|--------|-------------|----------|
| Combined, via a second query | Add a bounded `listGlobal` rather than loosening `listByScope`; merge by timestamp with global rows marked. Rationale: under D-04 a global swap really does change an unpinned profile's engine. | ✓ |
| Per-profile only | `listByScope` untouched, zero Convex change. Cost: empty history when the cause was a global swap. | |
| Make `profileId` optional | One query serves both. Cost: an existing arg silently gains a second meaning; every caller's contract widens. | |

**User's choice:** Combined, via a second query
**Notes:** → CONTEXT.md **D-11**. This is the decision ROADMAP.md's Phase 109 note explicitly asked to be locked before planning.

### Q3 — How does a pinned profile's combined history present global rows?

| Option | Description | Selected |
|--------|-------------|----------|
| Always show, marked, with a live note | Tag global rows and add "this profile is pinned — global swaps below did not change its engine", derived from live override state via D-05. | ✓ |
| Show all global rows unlabeled by effect | Asserts nothing false. Cost: reads as causal history when some entries had no effect here. | |
| Filter by pin state at row time | Most accurate causally. Cost: pin state over time is stored nowhere; wrong across any astridr restart. | |

**User's choice:** Always show, marked, with a live note
**Notes:** → CONTEXT.md **D-12**

---

## Claude's Discretion

No question was answered "You decide". The discretion items in CONTEXT.md were identified by Claude
during scouting rather than deferred by the user:

- A live-verification gate for the UI, mirroring ENGINE-05 (strongly indicated by Phase 108's five
  gate-found defects and by `VITE_BRAINS_STUB` having masked this defect class from the whole suite
  once — `103-VALIDATION.md:143`).
- `e2e/brain-swap.spec.ts` + `playwright.config.ts:24,30` — repoint, rewrite, or honest skip.
- Which existing ack carries `default_profile_id` (`swap.catalogue` vs `readiness.get`).
- The `vendor` → provider-registry key mapping, and what "Local" means for Ollama.
- The new `source` discriminant name, and whether the 4s confirm timeout needs a per-profile value.
- Scoped-restore confirmation semantics (readback = absence of that profile's override).
- Where the WS sender registration lands, and `BrainsWsRegistrar.tsx`'s fate.
- Truncation on the merged history list (per-query cap means the merge can reach 2× cap).
- Whether `103-CONTRACT.md` §3/§8/§9 get corrected in place, per Phase 108's D-08 precedent.
- Whether to also close the pin/restore emit asymmetry in astridr.

## Deferred Ideas

- Rendering the two-axis disagreement explicitly (103-CONTRACT.md §9) — the rejected option from
  Reconciliation Q2, preserved rather than discarded.
- Voice swap history as a surfaced feature — rows are captured, but Ástríðr rejects `profile_id` for
  `target='voice'`, so a voice swap can never be per-profile.
- Enriching `swap.catalogue` with `group`/`billing`/`costTier` in astridr — the rejected option from
  Normalization Q2.
- A profile switcher on Chat's composer pill — raised as a candidate at the final check-in and not
  pursued; a new capability, not a clarification.
- Emitting a `model_routing` row on the successful-set path for snapshot freshness — rejected as the
  confirmation source, retained as a discretion item.
- Session-mode swaps with a TTL (Phase 108 D-06) — note `BrainHeaderBadge.tsx:188-196` already renders
  a `mode === "session"` branch nothing can currently produce.
- `brain.fallback` telemetry (103-CONTRACT.md §5).
