# Phase 103 Client Contract — Per-Profile Brain Swap

**Amendment (2026-08-07, CodePulse Phase 108, D-08):** §1, §2, §4, §6, and §7 below are corrected
in place. This document originally attributed the per-profile backend to "Ástríðr Phase 184.1" — corrected: no such phase exists (`grep -rn "184\.1"` across astridr's `.planning/` returns nothing; `.planning/REQUIREMENTS.md`'s "Scoping evidence" table, gathered 2026-08-06, records the check) — and specified a `gateway.model.set` command that was never built and is now formally superseded (D-05). The axis is delivered by **CodePulse Phase 108** on astridr branch `feature/brain-swap`, via the **scoped `swap.set`** command, not a new one. Corrected loudly rather than quietly: a contract documenting behaviour that does not exist is the same defect class TELE-01 exists to fix one repo over. Superseded text is kept, explicitly labelled, rather than deleted — see each section for what changed and why.

**Status:** Draft, ships as a Phase 103 deliverable (D-17). **Sections 2, 4, and 6 below are now
corrected against the real Phase 108 implementation (see amendment above); sections 3, 5, 8, and 9
remain unbuilt specification, not an observation of running code — those are out of scope for
Phase 108 and their claims are not falsified by it.**

**Scope: per-profile axis only.** The GLOBAL brain swap already ships and works today
(`swap.set` / `swap.catalogue` / `swap.state`, Ástríðr Phase 185/186 — verified live against
`astridr-repo` @ `feature/brain-swap` 2026-07-28). This document does **not** redesign or replace
any of that. It adds exactly one new axis: a **per-profile** persisted default plus a **per-profile**
session override, neither of which exists in Ástríðr today.

**⚠ `gateway.provider.set_enabled` has zero handlers anywhere in `astridr/`.** It is dispatched
client-side from `src/components/ProviderControls.tsx:188` into a Pydantic discriminated-union
WS command dispatcher (`astridr/api/ws_commands.py`) that contains no member of that type — today
it would round-trip a validation-error ack. It is dead code, not a working precedent, and **must
not be used as a reference shape** for anything in this contract (D-13's correction). Every shape
below is modeled instead on `SwapSetCommand`/`SwapCatalogueGetCommand` (`ws_commands.py:224-256`),
the real, live, shipped command family the global axis already uses.

---

## 1. Scope and status header

| Axis | Status | Commands |
|------|--------|----------|
| Global (all profiles, process-wide, runtime-only, no TTL) | **LIVE today** (Ástríðr Phase 185/186) | `swap.set` (`target: "brain"`), `swap.catalogue` (`target: "brain"`), `swap.state` (pushed) |
| Per-profile (this document) | **Delivered by CodePulse Phase 108** on astridr branch `feature/brain-swap` (D-04/D-05/D-08, corrected 2026-08-07). Its write command is the **scoped `swap.set`** (`target: "brain"` + optional `profile_id`) — **not** `gateway.model.set`, which was never built and is superseded (see §2). | `swap.set` with `profile_id` (scoped), `model_routing` (telemetry, per-profile), `control_verb_swap` (telemetry, swap-history) |

The two axes coexist in the same running Ástríðr process and can genuinely disagree at the same
moment — see item 9 below. Phase 103's CodePulse UI does not attempt to reconcile or render that
disagreement; it surfaces the per-profile default only. **`models.catalog` and `brain.fallback`
remain unbuilt** — out of Phase 108's scope, unchanged by this amendment.

---

## 2. Write command: scoped `swap.set` (supersedes `gateway.model.set`, D-05)

**Corrected 2026-08-07 (Phase 108 D-05/D-08).** The per-profile axis does **not** get a second
command. It extends the **existing, live** `SwapSetCommand` (`astridr/api/ws_commands.py:224-256`)
with an optional `profile_id` field — one dispatch path through `VERB_REGISTRY` for both manual and
spoken swaps, scoped or not:

```python
class SwapSetCommand(BaseModel):
    type: Literal["swap.set"] = "swap.set"
    request_id: str = ""
    target: Literal["brain", "voice"]
    value: str | None = None           # required unless restore=True; ignored when target="voice"
                                        # and profile_id is set (rejected, see below)
    restore: bool = False              # clears the override; `value` ignored
    profile_id: str | None = None      # Phase 108 D-04: optional per-profile scope. None (or
                                        # omitted) is byte-identical to today's global behavior.
```

**Fail-closed validation (§7):** `profile_id` set + `target="voice"` is rejected — `swap_voice` has
no per-profile override concept, only a single global override pair. `profile_id` set but not a
member of the server's known profile set is rejected. Both reject **before** `VERB_REGISTRY`
dispatch, so an invalid scope never falls through to a global apply.

**Restore semantics when both overrides can be live (Claude's Discretion, resolved by D-04):** a
**scoped** `restore=true` (`profile_id` set) clears only that profile's override; an **unscoped**
`restore=true` (`profile_id` omitted) clears the global override and leaves every profile's pin
intact.

**D-06: no `mode` field, no session TTL.** The per-profile override is **runtime-only**, mirroring
the global axis exactly — cleared by `restore=true` or a process restart, no expiry bookkeeping on
the resolve hot path. The considered-and-rejected `GatewayModelSetCommand` shape below still
carries a `mode: "session" | "default"` field with a 1-hour TTL; that TTL was rejected, not built,
and is **deferred, not dropped** — `activeEngineSnapshots.expiresAt` (schema) stays present and
unused, available if a later phase wants session-scoped swaps.

### Considered and rejected: a separate `gateway.model.set` command (D-05)

The original contract specified a distinct command, reproduced here for the deferred-ideas record
— **do not implement this shape**:

```python
class GatewayModelSetCommand(BaseModel):
    type: Literal["gateway.model.set"] = "gateway.model.set"
    request_id: str = ""
    scope: Literal["profile"]
    profile_id: str
    model: str | None = None           # required unless restore=True
    mode: Literal["session", "default"]  # rejected: session TTL, see D-06 above
    restore: bool = False
```

```typescript
// Rejected TypeScript mirror — do not implement
export interface GatewayModelSetCommand {
  type: "gateway.model.set";
  request_id: string;
  scope: "profile";
  profile_id: string;
  model?: string | null;
  mode: "session" | "default";
  restore?: boolean;
}
```

**Why rejected (D-05):** `SwapSetCommand`'s docstring makes a load-bearing promise that a manual
pick and a spoken swap dispatch through the exact same `swap_model`/`swap_voice`
`ControlVerb.execute` — "never a parallel mutation." A second command is a second path into the
same override state, which is how two axes end up able to disagree without either knowing.
Omitting the new `profile_id` field on `SwapSetCommand` is byte-identical to today's behavior,
which a brand-new command cannot offer for free.

**Ack shape (unchanged):**

```typescript
export interface BrainsAck {
  type: "ack";
  request_id: string;
  status: "ok" | "error";
  error?: string;
}
```

**D-14 rule, stated explicitly:** the ack means the command was **ACCEPTED** for processing, never
that the engine has actually **SWITCHED**. Clients MUST NOT render engine state from the ack payload
alone — the resulting active engine is read back only from the `model_routing` telemetry event
(§4) flowing into Convex. This mirrors how the global axis already works: `swap.set`'s ack is
followed by a separate `swap.state` push, and the UI renders only the push, never the ack.

---

## 3. Catalogue read `models.catalog`

**Transport: WS, not REST.** Rationale — avoids a second auth path (the WS bearer-subprotocol
handshake already gates every command; a REST catalogue endpoint would need its own
`authHeaders()`-based auth flow for no benefit) and there is a real, working precedent
(`SwapCatalogueGetCommand` / `swap.catalogue`, `ws_commands.py:242-256`) to model the shape after.

```python
class ModelsCatalogCommand(BaseModel):
    type: Literal["models.catalog"] = "models.catalog"
    request_id: str = ""
```

**Ack entry shape** (one array element per reachable engine):

```typescript
export interface CatalogueEntry {
  id: string;                                    // unique, stable — REQUIRED. cmdk selection is
                                                   // value-keyed (see codebase memory
                                                   // cmdk-and-global-hotkey-gotchas.md); a picker
                                                   // built on `name` instead of `id` produces a
                                                   // double-highlight/ArrowDown-loop regression.
  name: string;                                   // display only — NOT required to be unique
  vendor: string;
  group: "subscription" | "api" | "local";        // D-07's three fixed groups
  billing: "api" | "sub";
  costTier: "normal" | "expensive" | "unknown";
  quotaRemainingPct?: number;                     // 0-1, omitted when the entry has no quota concept
                                                   // (e.g. flat-fee subscription CLI brains)
  health?: "reachable" | "degraded" | "unreachable";
}

export interface ModelsCatalogAck extends BrainsAck {
  entries: CatalogueEntry[];
  default_profile_id: string;   // the profile the Ástríðr chat channel resolves against — gives
                                 // the Chat composer pill a defined scope without CodePulse
                                 // inventing one (OQ2 resolution, 103-CONTEXT.md)
}
```

**Duplicate-exclusion rule:** the server MUST exclude OpenRouter-native `anthropic/...` duplicates
exactly as `_handle_swap_catalogue` already does (`ws_commands.py:1125-1198`, ~line 1181) for the
global catalogue. `id` uniqueness across the returned array is a hard requirement of this contract
— a violation is a contract-conformance bug, not a display nuance.

---

## 4. Active-engine telemetry event `model_routing`

**D-14 per-profile readback.** Delivered on the **existing** `/runtime-ingest` HTTP path — **no
second ingest endpoint** is created by this contract.

**This event name is not new.** `astridr/providers/router.py` (`ModelRouter._emit_model_routing`)
already calls `self._telemetry.send("model_routing", payload)` on every resolution — it is a real,
live emitter today. corrected 2026-08-07: the originally-cited "Phase 184.1" does not exist; CodePulse Phase 108 extended this existing payload (profileId/model/mode, D-11/D-12) — it did not invent a new event.

```typescript
export interface ModelRoutingEvent {
  profile_id: string;
  model: string;
  mode: "session" | "pinned" | "inherited";
  // Corrected 2026-08-07 (Phase 108 D-04/D-11/D-12): selection_path mirrors
  // router.py's own _resolve_model vocabulary, now 8 live values, not the
  // original 6 (both "advisor" and "profile-swap-override" were missing):
  // "override" | "profile-swap-override" | "global-swap-override" |
  // "session-override" | "codepulse-default" | "category-rule" | "default" |
  // "advisor"
  // "advisor" is a hardcoded literal emitted from inside chat() and never
  // flows through _resolve_model. "mode" is derived from selection_path at
  // the single emit helper (_emit_model_routing) via a .get(selection_path,
  // "inherited") mapping with an "inherited" catch-all default — a value
  // with no explicit mapping entry is never left unmapped.
  selection_path: string;
  expires_at?: number;   // epoch seconds — set ONLY when mode === "session"
  timestamp: number;
}
```

**Field name (corrected 2026-08-07, D-11):** the field above is `model`, matching this contract.
The astridr emitter previously sent `selectedModel` — renamed in Phase 108 to `model` so the
contract and the live emitter agree; there is no longer any drift between this document and
`router.py`'s payload.

The emitter MUST send this event after every resolution change **and** on process start, so the
Convex-side table is never empty-by-default (an empty table must read as "no data yet," not be
mistaken for "no swap has ever happened"). The CodePulse consumer MUST tolerate both snake_case
and camelCase field names, matching this repo's existing ingest convention — see
`convex/runtimeIngest.ts:512-524` (`case "profile_config"`) and `:835-847`
(`case "provider_health"`), both of which coalesce `d.profileId ?? d.profile_id ?? "unknown"` /
equivalent. A new `case "model_routing"` in that same switch statement follows the identical
defensive-boundary idiom — this file's own comments document that a single unhandled `null` here
previously poisoned an 8-event production batch (WR-06/168-06).

---

## 5. CLI-to-API fallback event `brain.fallback` (D-04)

CLI brains ship **text-mode only** this phase — the `--agentic` hybrid mode (design spec D2) is
**deferred and NOT part of this contract**. A text-mode CLI brain that receives a tool-needing turn
silently falls back to an API model today; this event makes that fallback honest instead of silent.

```typescript
export interface BrainFallbackEvent {
  profile_id: string;
  cli_model: string;       // the CLI brain that could not handle the turn
  fallback_model: string;  // the API model that actually answered
  reason: string;
}
```

Delivered as a WS event (not `/runtime-ingest` — this is a live, transient notice, not persisted
state; the UI fires a `sonner` toast on receipt per `103-UI-SPEC.md` §12, it does not need a Convex
row). No response/ack is expected — this is a fire-and-forget notification, not a command.

---

## 6. Authorization tier (ASVS V4)

**Corrected 2026-08-07 (Phase 108):** the scoped `swap.set` (§2) — not `gateway.model.set`, which
was never built — and `models.catalog` (§3, still unbuilt) are **regular, non-admin commands**,
matching the existing tier of unscoped `swap.set` and `config.update`.
`astridr/security/command_auth.py:15` defines
`ADMIN_COMMANDS: frozenset[str] = frozenset({"estop.activate", "estop.deactivate"})` — that is the
**entire** admin set. Neither command belongs in it, and Phase 108 kept it that way: `swap.set`
stays out of `ADMIN_COMMANDS` for both scoped and unscoped calls (asserted by
`grep -c "swap.set" astridr/security/command_auth.py` returning `0`), gated instead by the same
service-key tier every other non-estop command uses (`CommandAuth.check`, `command_auth.py:30`),
never the admin key. Stating this explicitly closes off both failure modes: under-gating (no auth
check at all) and over-gating (accidentally requiring the admin key, which would make the picker
unusable for a normal operator session — over-gating a routine operator action behind the estop-only
admin tier is itself the access-control failure this section exists to prevent).

---

## 7. Input validation (ASVS V5)

The server MUST validate `value` and `profile_id` via Pydantic exactly as every other command in
`ws_commands.py` does (field types + the `Literal`/`str` constraints shown in §2/§3 above). An
unknown or absent `profile_id` is an **error ack**, never a silent global apply — this is the one
failure mode that would be most dangerous to get wrong, since it would turn a per-profile swap
request into an unintended global one.

**Corrected 2026-08-07 (Phase 108):** this rule is now implemented, not merely specified.
`_handle_swap_set` (`astridr/api/ws_commands.py`) validates fail-closed BEFORE `VERB_REGISTRY`
dispatch: `target="voice"` + `profile_id` is rejected, an unresolvable/absent validation source is
rejected rather than proceeding, and an unknown `profile_id` (checked against
`MessageRouter.known_profile_ids()`) is rejected — each path asserted, in the test suite, to leave
`verb.execute` with **zero calls**, not merely to raise an exception afterward.

**Client-side canary (superseded, not yet re-implemented):** the original text here described a
`validateGatewayModelSet` stub adapter (in `src/lib/brainsApi.ts`) performing a client-side half of
this validation before dispatch, and referenced an "eventual Phase 184.1 implementation" — corrected
at the top of this document: no such phase exists. That stub targeted the now-rejected
`gateway.model.set` shape (§2) and is superseded by this amendment. A client-side canary for the
real, scoped `swap.set` is Phase 109's UI-binding work, not built by Phase 108, whose validation
lives server-side only.

---

## 8. No server-side batch command

A **global** swap is **N client-dispatched single-profile `gateway.model.set` commands**, aggregated
client-side with `Promise.allSettled`. This contract does **not** define, and Phase 184.1 **must
NOT design**, any server-side batch/fan-out command in its first cut. This falls directly out of
D-12 (per-row honesty for partial failure) — a `Promise.allSettled` result is naturally one outcome
per profile with no additional server-side aggregation logic required. Note also that "All profiles"
scope in the Phase 103 UI dispatches the **existing live** `swap.set` (global axis), not N
`gateway.model.set` calls — this per-profile fan-out pattern is Claude's discretion to reuse in a
future global-per-profile-command world, not something this phase's UI actually exercises.

---

## 9. Known interaction: the global override shadows the per-profile default

`router.py`'s `_resolve_model` resolution order (`router.py:437-472`) is, in priority order:

1. `explicit_model` (explicit per-call override) — `"override"`
2. **`self._global_model_override`** (Phase 185 voice/text global swap) — `"global-swap-override"`
3. Session override (per-session, 1h TTL) — `"session-override"`
4. CodePulse per-agent default (Supabase cache) — `"codepulse-default"`
5. Task-category routing rule — `"category-rule"`
6. Fallback / `FailoverProvider` default — `"default"`

The live global override sits at rung 2, **ahead of** where a Phase-103 per-profile default would
resolve (rung 4). This means a per-profile pinned default set through this contract's
`gateway.model.set` (`mode: "default"`) can be **silently inactive** whenever any global override
is in force — the profile's own row would show its pinned default, but the profile is actually
running on the global override.

**Recorded here so Phase 184.1 does not have to rediscover it.** Phase 103's CodePulse UI does
**not** attempt to render this shadowing (operator decision, `103-CONTEXT.md` OQ1 resolution,
2026-07-28) — it surfaces the per-profile default/session-override state as reported by
`model_routing`, full stop. **Carry-forward risk for whoever builds against this contract:** once
the per-profile mechanism is genuinely live, showing a per-profile default as though it were the
running engine while a global override actually governs that turn recreates exactly the "stale
config read presented as live state" failure this whole phase (BSC-01) exists to kill — the only
reason it's safe to defer here is that the per-profile axis is stub-backed this phase, so the
conflict cannot manifest for real yet.

---

## 10. Conformance obligations

`src/lib/brainsApi.ts`'s stub adapter (`stubBrainsAdapter`) conforms to every shape defined in
sections 2-5 above and is the executable check that this document is internally consistent:

- `validateGatewayModelSet` implements §2's/§7's validation rule and is shared by both the stub and
  live adapter implementations — it cannot silently drift between "what the doc says" and "what the
  stub actually accepts."
- `STUB_CATALOGUE` entries satisfy every field/enum constraint in §3's `CatalogueEntry` shape.
- `STUB_PROFILE_ENGINES` entries satisfy §4's `mode` vocabulary (`"pinned" | "inherited"` — the
  UI-facing subset of `model_routing`'s `mode`, since `"session"` degrades to a countdown treatment
  of the same underlying state).
- `src/lib/brainsApi.test.ts` asserts the dispatched command's exact field names against this
  document character-for-character (see that file's own top-of-file comment) — a green run there
  proves contract conformance and UI honesty only, and is explicitly **not** live BSC-05
  verification (`103-RESEARCH.md` "Validation Architecture" — What CAN and CANNOT be proven with a
  stub).

corrected 2026-08-07: the line originally here named "Phase 184.1's implementer" — no such phase exists (see the amendment note at the top of this document). CodePulse Phase 108 built the per-profile backend from the corrected §1/§2/§4/§6/§7 above, on astridr branch `feature/brain-swap`, without needing any CodePulse source beyond this document.
