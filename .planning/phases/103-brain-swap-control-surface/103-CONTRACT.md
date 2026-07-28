# Phase 103 Client Contract — Per-Profile Brain Swap

**Status:** Draft, ships as a Phase 103 deliverable (D-17). This is the contract Ástríðr Phase
184.1 implements against. It is not documentation-after-the-fact — no Phase 184.1 code exists yet;
everything described in sections 2-5 below is a specification, not an observation of running code.

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
| Per-profile (this document) | **Not built.** Ástríðr Phase 184.1 implements this contract. CodePulse Phase 103 ships a stub adapter conforming to it. | `gateway.model.set`, `models.catalog`, `model_routing` (telemetry), `brain.fallback` (telemetry) |

The two axes coexist in the same running Ástríðr process and can genuinely disagree at the same
moment — see item 9 below. Phase 103's CodePulse UI does not attempt to reconcile or render that
disagreement; it surfaces the per-profile default only.

---

## 2. Write command `gateway.model.set`

Modeled directly on `SwapSetCommand` (`astridr/api/ws_commands.py:224-240`) — same discriminated
`type` Literal, same `request_id` convention, same boolean-restore idiom:

```python
class GatewayModelSetCommand(BaseModel):
    type: Literal["gateway.model.set"] = "gateway.model.set"
    request_id: str = ""
    scope: Literal["profile"]          # global swaps use the EXISTING swap.set — this contract
                                        # defines only the profile scope; do not add "global" here.
    profile_id: str
    model: str | None = None           # required unless restore=True
    mode: Literal["session", "default"]  # D-02: temporary (1h TTL) vs sticky pinned default
    restore: bool = False              # mirrors SwapSetCommand.restore — clears the override/default,
                                        # `model` is ignored when true
```

```typescript
// TypeScript mirror (src/lib/brainsApi.ts)
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

**Ack shape:**

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

**This event name is not new.** `astridr/providers/router.py:426` (`ModelRouter._emit_model_routing`)
already calls `self._telemetry.send("model_routing", payload)` on every resolution — it is a real,
live emitter today, just not yet profile-scoped or consumed by CodePulse's ingest switch. Phase
184.1 extends its existing payload; it does not invent a new event.

```typescript
export interface ModelRoutingEvent {
  profile_id: string;
  model: string;
  mode: "session" | "pinned" | "inherited";
  // selection_path mirrors router.py's own _resolve_model vocabulary (router.py:437-472):
  // "override" | "global-swap-override" | "session-override" | "codepulse-default" |
  // "category-rule" | "default"
  selection_path: string;
  expires_at?: number;   // epoch seconds — set ONLY when mode === "session"
  timestamp: number;
}
```

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

`gateway.model.set` and `models.catalog` are **regular, non-admin commands**, matching the existing
tier of `swap.set` and `config.update`. `astridr/security/command_auth.py:15` defines
`ADMIN_COMMANDS: frozenset[str] = frozenset({"estop.activate", "estop.deactivate"})` — that is the
**entire** admin set. Neither new command belongs in it. Phase 184.1 must gate these commands with
the same service-key tier every other non-estop command uses (`CommandAuth.check`,
`command_auth.py:30`), never the admin key. Stating this explicitly closes off both failure modes:
under-gating (no auth check at all) and over-gating (accidentally requiring the admin key, which
would make the picker unusable for a normal operator session).

---

## 7. Input validation (ASVS V5)

The server MUST validate `model` and `profile_id` via Pydantic exactly as every other command in
`ws_commands.py` does (field types + the `Literal`/`str` constraints shown in §2/§3 above). An
unknown or absent `profile_id` is an **error ack**, never a silent global apply — this is the one
failure mode that would be most dangerous to get wrong, since it would turn a per-profile swap
request into an unintended global one.

**Client-side canary:** the stub adapter's `validateGatewayModelSet` (in `src/lib/brainsApi.ts`)
performs the client-side half of this same validation before dispatch, rejecting a malformed
command with an error ack rather than a thrown exception. This is not a substitute for server-side
validation — it exists to catch contract drift between this document and the eventual Phase 184.1
implementation early, in CI, before any live traffic is involved.

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

Phase 184.1's implementer can build the entire per-profile backend from sections 1-9 of this
document without reading any CodePulse source.
