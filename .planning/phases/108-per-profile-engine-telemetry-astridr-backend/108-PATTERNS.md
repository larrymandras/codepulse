# Phase 108: Per-Profile Engine Telemetry (astridr backend) - Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 9 (3 new, 6 modified) — cross-repo (astridr-repo `feature/brain-swap` + codepulse)
**Analogs found:** 9 / 9

All line numbers below were read live this session (2026-08-07). Where RESEARCH.md already
verified a citation this session, I did not re-read it; where CONTEXT.md's citation was stale I
used RESEARCH.md's corrected one. No further drift found beyond what RESEARCH.md's own
`⚠ Decision Conflicts Found` section already flags.

## File Classification

| New/Modified File | Repo | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `convex/controlVerbSwaps.ts` | codepulse | service/domain module | event-driven (ingest write + bounded read) | `convex/activeEngine.ts` | exact |
| `convex/controlVerbSwaps.test.ts` | codepulse | test | — | `convex/activeEngine.test.ts` | exact |
| astridr per-profile override store (new methods on `ModelRouter`) | astridr | service (in-process state) | CRUD (in-memory) | `_global_model_override` + accessor trio, `astridr/providers/router.py` | exact |
| `convex/schema.ts` (new `controlVerbSwaps` table) | codepulse | model/schema | — | `activeEngineSnapshots` table, `convex/schema.ts:2048-2072` | exact |
| `convex/retention.ts` (2 new `RETENTION_DAYS` entries) | codepulse | config | batch | `gatewayQuotaSnapshots`/`toolPolicyEvents` entries, `convex/retention.ts:39-65` | exact |
| `convex/runtimeIngest.ts` (new `case "control_verb_swap"`, rename fix, failed-status skip) | codepulse | controller (httpAction switch) | event-driven | `case "model_routing"`, `convex/runtimeIngest.ts:717-748` | exact |
| `astridr/channels/agent_processor.py` (`process()` — add try/finally reset) | astridr | controller | request-response | `channels/router.py`'s `set_goal_context`/`reset_goal_context` idiom, `astridr/channels/router.py:508-525` | exact |
| `astridr/api/ws_commands.py` (`SwapSetCommand` + `_handle_swap_set`) | astridr | route/command handler | request-response | `ChatSendCommand`/`AgentSendTaskCommand`'s `profile: str \| None = None` field, `astridr/api/ws_commands.py:54-72`; auth tier: `astridr/security/command_auth.py` (full file) | exact |
| `src/components/brains/GlobalSwapModal.tsx` (add D-15 swap-history section) | codepulse | component | request-response (read-only query render) | itself (existing file's own idiom); truncation-banner precedent: `src/components/ToolPolicyFeed.tsx:197-208` | exact (self) + role-match (truncation banner) |

## Pattern Assignments

### 1. `convex/controlVerbSwaps.ts` (NEW)

**Analog:** `convex/activeEngine.ts` (full file, 141 lines — read in full this session)

This is the strongest analog in the whole phase: same shape of problem (per-profile telemetry
table, one internal write path, one bounded read query), same repo, same author conventions,
written for the sibling table `activeEngineSnapshots` that this table is explicitly modeled on
(RESEARCH.md Item 3).

**Header comment convention** (`activeEngine.ts:1-16`):
```typescript
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { isUnresolvedRouting } from "./activeEngineFilters";

// ============================================================
// ACTIVE ENGINE SNAPSHOTS — Phase 103 (BSC-01, D-14)
// ============================================================
//
// The per-profile live-resolved brain-swap axis. This table holds ONLY the
// live resolved engine reported by Ástríðr telemetry (103-CONTRACT.md §4,
// the `model_routing` event) — it is NOT the persisted default (that stays
// Ástríðr-owned per D-03, mirrored in profileConfigs.modelPreferences).
//
// D-14: the UI must read the active engine ONLY from this table (fed by
// server-reported telemetry). It must NEVER call `recordRouting` to assert
// an engine from a client action or an ack payload.
```
For `controlVerbSwaps.ts`, the equivalent header should state D-13/D-14's own framing (RESEARCH.md
already drafted this exact header — copy it verbatim, it does not need re-authoring):
```typescript
// controlVerbSwaps: Phase 108 (TELE-02, D-13/D-14). Per-profile swap-history audit trail:
// astridr/engine/control_verbs/swap_model.py and swap_voice.py emit one row per swap attempt
// (restore/unresolved/refused/success) — this table stores every one, discriminated by `verb`,
// so a refusal is queryable, not just a spoken/toast-only notice (D-13). One table for
// brain+voice (D-14) — the readout filters to verb:"swap_model" for the D-15 GlobalSwapModal
// history section; voice rows are captured but not yet surfaced (deferred).
```

**Bounded-read query pattern** (`activeEngine.ts:36-57`, `latestByProfile`) — the direct template
for D-15's per-profile history read (RESEARCH.md Item 3 already specifies `.take(20)` +
`by_scope` index rather than `.take(200)` — this is a modal history section, not a dashboard):
```typescript
export const latestByProfile = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("activeEngineSnapshots")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    return deduplicateByProfile(rows);
  },
});
```
Adapt to: `.withIndex("by_scope", q => q.eq("scope", profileId)).order("desc").take(20)` — a plain
`query` (not `internalMutation`), since this is a read the client legitimately calls (D-15's modal
needs it), unlike the write path below.

**Internal-write-path pattern (CR-01 rule)** (`activeEngine.ts:59-91`, `recordRouting`) — copy this
shape exactly for the new insert mutation; the header comment's CR-01 rationale is copy-paste
applicable (a client-callable public `mutation` on a telemetry table is the exact defect class
CR-01 fixed here):
```typescript
/**
 * recordRouting — Append-only insert of one active-engine snapshot row.
 * ...
 * ENFORCED by the builder (CR-01 fix): declared as an `internalMutation`, so
 * it does not exist in the client-callable `api.` namespace at all — the
 * same precedent `convex/gatewayQuota.ts`'s `insertSnapshot` already
 * follows. This closes the devtools-forgeable write path a plain `mutation`
 * left open ...
 */
export const recordRouting = internalMutation({
  args: {
    profileId: v.string(),
    model: v.string(),
    mode: v.string(),
    selectionPath: v.optional(v.string()),
    expiresAt: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activeEngineSnapshots", { ...args });
  },
});
```
For `controlVerbSwaps`, the new insert mutation's `args` block should match RESEARCH.md's Item 3
schema (`verb`, `target`, `resolved`, `providerAffinity`, `voiceId`, `path`, `reason`, `scope`,
`sessionId`, `channel`, `timestamp`) field-for-field, `internalMutation`, invoked only from
`internal.controlVerbSwaps.record` inside `runtimeIngest.ts`'s new switch case — never from
`api.`.

**Sentinel/guard-module precedent, if a similar guard is needed:** `convex/activeEngineFilters.ts`
(full file, 52 lines) is the precedent for a *dependency-free* pure predicate shared between the
write path (`runtimeIngest.ts`) and a read path, used here for `isUnresolvedRouting`. Not
obviously needed for `controlVerbSwaps` (D-13 stores every emit including refusals — there is no
"unresolved sentinel" concept for this table), but if the plan needs one (e.g. to validate `verb`
is one of the two known values before insert), this is the file whose shape to copy — same
"deliberately dependency-free" header rationale (`activeEngineFilters.ts:24-28`).

---

### 2. `convex/controlVerbSwaps.test.ts` (NEW)

**Analog:** `convex/activeEngine.test.ts` (full file, 156 lines — read in full this session)

Copy its harness structure directly:
- **Source-level guard style** (no `convex-test` harness in this repo — confirmed by
  `activeEngine.test.ts:10-13`'s own comment: "Source-level schema parsing... keeps this test free
  of the Convex codegen/runtime"). Tests read the compiled `.ts` source with
  `readFileSync`/`stripCommentLines` and assert on regex matches against the source text, not on
  live mutation execution.
- **`stripCommentLines` helper** (`activeEngine.test.ts:14-19`) — copy verbatim; needed so a
  docstring that legitimately mentions "mutation"/"internalMutation" doesn't pollute a negative
  source-grep assertion.
- **CR-01 authorization-boundary guard** (`activeEngine.test.ts:93-116`) — the exact regression
  test to copy for the new insert mutation: asserts `internalMutation(` is used and `= mutation(`
  is NOT, asserts the raw (unstripped) source still contains the word "mutation" (sanity-checks the
  stripper itself isn't vacuously passing), and asserts `runtimeIngest.ts` calls
  `internal.controlVerbSwaps.record` (or whatever the mutation is named) and never
  `api.controlVerbSwaps.record`.
- **Pure-function unit tests** (`activeEngine.test.ts:39-84`, `deduplicateByProfile` tests) — if the
  new read query needs any pure helper (e.g. a per-scope dedup or a `verb === "swap_model"` filter
  extracted for testability), export it and test it the same way: table-driven cases including an
  empty-input case that must return `[]` not `undefined`.
- **Ingest-case source-guard style** (`activeEngine.test.ts:126-155`, the "UAT test 2" block) — the
  template for asserting the new `case "control_verb_swap"` in `runtimeIngest.ts` does the right
  coalescing/skip: locate the case body via `source.indexOf('case "control_verb_swap"')`, slice a
  bounded window, and assert on that window only — "scoped to the case body ONLY... asserting on
  the whole file would fail on their correct usage, not on this defect" (verbatim rationale to
  reuse).

---

### 3. Astridr per-profile override store (NEW methods on `ModelRouter`)

**Analog:** `_global_model_override` + its accessor trio, `astridr/providers/router.py`

**The state slot** (`router.py:115-119`, inside `ModelRouter.__init__`):
```python
# Phase 185 SWAP-01: process-wide global model override (D-01/D-02).
# A single runtime-only slot -- no TTL, no eviction dict. Wins over
# session/category/default but never over an explicit model= arg.
self._global_model_override: str | None = None
self._global_override_source: str | None = None
```
For D-04's per-profile store, the direct adaptation is a `dict[str, str]` keyed by profile_id
(and a parallel `dict[str, str | None]` for source, or fold source into a small dataclass) —
runtime-only, no TTL, per D-06.

**The accessor trio** (`router.py:602-625`):
```python
def set_global_override(self, model_name: str, source: str | None = None) -> None:
    """Set the process-wide global model override (Phase 185 SWAP-01, D-01/D-02).

    Unlike session overrides, this is a single scalar slot with NO TTL
    and NO eviction bookkeeping -- it holds until explicitly cleared or
    the process restarts. ``source`` records who/what set it (e.g.
    "voice-swap") so ``get_global_override_source`` can report it back
    (consumed by 185-05's ``swap.get_state``).
    """
    self._global_model_override = model_name
    self._global_override_source = source

def clear_global_override(self) -> None:
    """Clear the global model override, restoring normal resolution order."""
    self._global_model_override = None
    self._global_override_source = None

def get_global_override(self) -> str | None:
    """Return the currently active global model override, or None."""
    return self._global_model_override

def get_global_override_source(self) -> str | None:
    """Return the source string recorded with the current global override, or None."""
    return self._global_override_source
```
Mirror this exactly for `set_profile_override(profile_id, model_name, source=None)` /
`clear_profile_override(profile_id)` / `get_profile_override(profile_id)` — same docstring
register (cite the phase/decision IDs the way this trio does), same "no TTL, no eviction
bookkeeping" framing per D-06.

**Insertion point in `_resolve_model`** (`router.py:429-472`, full precedence chain read this
session — confirmed byte-identical to RESEARCH.md Item 5's citation, no drift):
```python
def _resolve_model(
    self,
    explicit_model: str | None,
    task_category: TaskCategory | None,
    session_id: str | None,
    messages: list[Message],
    agent_id: str | None = None,
) -> tuple[str | None, str]:
    # 1. Explicit model wins (D-06)
    if explicit_model:
        return explicit_model, "override"

    # 1b. Global process-wide swap override (Phase 185 SWAP-01, D-01/D-02).
    # Runtime-only, no TTL -- wins over session/category/default but never
    # over explicit_model above. selection_path "global-swap-override"
    # flows through the existing _emit_model_routing -> model_routing
    # Convex event unchanged (Pitfall 2).
    if self._global_model_override:
        return self._global_model_override, "global-swap-override"

    # 2. Session override (D-08) — skip expired entries
    ...
```
D-04's new rung goes between the `explicit_model` check and the `_global_model_override` check —
same `if <truthy>: return <value>, "<selection_path-literal>"` shape, reading
`get_profile_context()` from `astridr/engine/telemetry.py` (see file 7 below) then the new
per-profile dict.

**The emit helper to extend** (`router.py:399-427`, `_emit_model_routing` — confirmed byte-identical
to RESEARCH.md's citation):
```python
async def _emit_model_routing(
    self,
    resolved_model: str | None,
    selection_path: str,
    task_category: TaskCategory | None,
    complexity_result: Any | None,
    status: str = "success",
    error: str | None = None,
) -> None:
    """Emit a model_routing telemetry event (D-03, D-05, D-07, D-08, D-10)."""
    if self._telemetry is None:
        return
    payload: dict[str, Any] = {
        "status": status,
        "selectedModel": resolved_model or "default",   # D-11: rename key to "model"
        "selectionPath": selection_path,
        "taskCategory": task_category.value if task_category else "inferred",
        ...
    }
    if error is not None:
        payload["error"] = error
    await self._telemetry.send("model_routing", payload)
    logger.debug("router.telemetry_emitted", event_type="model_routing", status=status)
```
D-01/D-02's `profileId` field and the read-from-`get_profile_context()`-with-refuse-to-emit-on-None
guard both go here, at the very top of the function body (before the `if self._telemetry is None`
check or right after it — either order is fine since both are early-return guards).

**Call sites, confirmed unchanged from RESEARCH.md's line citations** (`router.py:302-304`,
`:375-377`, `:393-397`):
```python
# advisor success path
await self._emit_model_routing(
    resolved_model, "advisor", task_category, complexity_result,
)
...
# normal success path
await self._emit_model_routing(
    resolved_model, selection_path, task_category, complexity_result,
)
...
# failure path
await self._emit_model_routing(
    resolved_model, selection_path, task_category, complexity_result,
    status="failed", error=str(exc),
)
```
No call-site changes needed — D-01's ContextVar read happens inside `_emit_model_routing` itself,
not at each call site (this is the "single source of truth" property D-12 also relies on).

---

### 4. `convex/schema.ts` (new `controlVerbSwaps` table)

**Analog:** `activeEngineSnapshots`, `convex/schema.ts:2048-2072` (read this session, byte-identical
to CONTEXT.md's `:2062-2072` citation — the extra 12 lines are the section-header comment block
CONTEXT.md's citation started mid-way through):
```typescript
  // ============================================================
  // ACTIVE ENGINE SNAPSHOTS (Phase 103, BSC-01/D-14) — per-profile
  // live-resolved brain-swap telemetry, append-only.
  // ============================================================

  // Latest-per-profile reactive readback for the per-profile brain-swap axis
  // (103-CONTRACT.md §4, model_routing event). This is the LIVE resolved
  // engine only — the persisted default stays Ástríðr-owned (D-03) and is
  // never written here; that lives in profileConfigs.modelPreferences.
  // Modeled field-for-field on gatewayQuotaSnapshots above. mode carries the
  // contract's "session" | "pinned" | "inherited" vocabulary but is kept
  // v.string() (not a Literal union) to match this schema's defensive-
  // boundary convention — validated at the ingest edge (convex/activeEngine.ts),
  // not the schema.
  activeEngineSnapshots: defineTable({
    profileId: v.string(),
    model: v.string(),
    mode: v.string(), // "session" | "pinned" | "inherited"
    selectionPath: v.optional(v.string()),
    expiresAt: v.optional(v.float64()), // epoch seconds, set only when mode === "session"
    timestamp: v.float64(),
  })
    .index("by_profileId", ["profileId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
```
Same section-header-comment-block + doc-comment-on-table + `v.string()`-not-Literal-union
convention for the new `controlVerbSwaps` table (RESEARCH.md Item 3's proposed schema, already
field-matched 1:1 against `docs/astridr-contract.md:1198-1210`'s live `control_verb_swap` contract
table — verified this session, byte-identical to RESEARCH.md's citation):
```typescript
controlVerbSwaps: defineTable({
  verb: v.string(),                    // "swap_model" | "swap_voice"
  target: v.optional(v.string()),      // raw utterance/tag target; absent on restore
  resolved: v.optional(v.string()),    // resolved model id (swap_model) or voice display name (swap_voice)
  providerAffinity: v.optional(v.string()),  // swap_model only
  voiceId: v.optional(v.string()),     // swap_voice only
  path: v.string(),                    // "claude-native" | "openrouter" | "refused" | "restore" | "swap"
  reason: v.optional(v.string()),      // swap_model refusal discriminator only
  scope: v.optional(v.string()),       // D-13: explicit profileId when scoped, absent/null when global
  sessionId: v.optional(v.string()),
  channel: v.string(),
  timestamp: v.float64(),
})
  .index("by_scope", ["scope", "timestamp"])
  .index("by_timestamp", ["timestamp"]),
```

---

### 5. `convex/retention.ts` (2 new `RETENTION_DAYS` entries)

**Analog:** `gatewayQuotaSnapshots` (`:39-48`) and `toolPolicyEvents` (`:58-65`) entries — full file
read this session (187 lines), byte-identical to CONTEXT.md/RESEARCH.md's citations. Also
re-verified `grep -c "activeEngineSnapshots" convex/retention.ts` → **0** this session, confirming
RESEARCH.md's Item 4 re-verification still holds.

**Comment-style template to imitate** (`retention.ts:39-48`, the more directly relevant of the two —
this is the "table currently empty/about to start growing, bound it pre-emptively" case, which is
exactly `activeEngineSnapshots`'s and `controlVerbSwaps`'s situation):
```typescript
  // poll snapshots — 30 days (added 2026-07-31, Phase 104 D-20). The 5-minute
  // gatewayQuota poller was DEAD before this phase (`gatewayQuota:latestByProvider`
  // returned []), so this table never grew and was never pruned. D-20 repointed the
  // poller at the CLI-gateway sidecar and revives it, which turns a permanently-empty
  // table into ~288 rows/provider/day forever on the instance that has already gone
  // down twice from read growth. Bounding it here BEFORE the poller runs in anger
  // avoids ever needing a mass delete (which is what created the tombstone storms
  // this whole module exists to avoid). Only the latest row per provider is ever
  // read, so 30 days is pure headroom for trend queries, not a functional limit.
  gatewayQuotaSnapshots: 30,
```
```typescript
  // Phase 105 D-05 — new table, bounded BEFORE it can ever need a mass
  // delete (the same pre-emptive move D-20 made for gatewayQuotaSnapshots).
  // Policy events are low-volume (boot/reload fire once per boot; denials
  // and leaks are rare by design), so 90 days keeps the feed useful across
  // a milestone without exposing the instance to another tombstone-storm
  // incident; 14 would age the signal out faster than an operator would
  // notice it.
  toolPolicyEvents: 90,
```
New entries per D-10/D-14 and RESEARCH.md Item 4's resolution (30 days for both — same tier,
"append-only, only latest-row(s) ever read" rationale):
```typescript
  // Phase 108 D-10 — new table, bounded BEFORE it can ever grow (same
  // pre-emptive move as gatewayQuotaSnapshots/toolPolicyEvents above). Only
  // the latest row per profile is ever read via latestByProfile, so any
  // window is pure headroom, not a functional limit.
  activeEngineSnapshots: 30,
  // Phase 108 D-14 — new table, same tier as activeEngineSnapshots above
  // (keeps the mental model simple: both are Phase 108's new per-profile
  // engine-axis tables). Swap-history is a manual/rare operator action
  // (D-15's "what did I last switch this to"), so 30 days is ample without
  // reaching for the 90-day build/history tier reserved for higher-value
  // long-horizon tables.
  controlVerbSwaps: 30,
```

**Test-side guard to extend:** `convex/retention.test.ts` (full file, 68 lines, read this session) —
its `"every pruned table name is a real table in schema.ts (silent-no-op guard)"` test
(`retention.test.ts:37-40`) auto-covers any new `RETENTION_DAYS` key as long as the matching
`schema.ts` table exists; no new test code needed there beyond the schema addition itself. Its
`"every retention window is a positive whole number of days"` test (`:42-47`) likewise auto-covers
the two new `30` entries.

---

### 6. `convex/runtimeIngest.ts` (new `case "control_verb_swap"`, D-11 rename, D-12 mode-mapping wiring, failed-status skip)

**Analog:** `case "model_routing"`, `convex/runtimeIngest.ts:717-748` (re-read this session,
byte-identical to CONTEXT.md/RESEARCH.md's `:717-748` citation — no drift):
```typescript
        case "model_routing": {
          // Phase 103 (BSC-01, D-14): astridr's ModelRouter._emit_model_routing
          // (router.py:426) already sends this event on every resolution — this
          // case extends it into the per-profile activeEngineSnapshots table
          // (103-CONTRACT.md §4). Dual snake/camelCase coalescing is
          // load-bearing, not decoration: this file's own WR-06/168-06 lesson
          // (see the subagent_job case above) records that a single unhandled
          // null here previously poisoned an 8-event production batch.
          const d = data as any;
          const routedProfileId = d.profileId ?? d.profile_id;
          const routedModel = d.model;
          // UAT 2026-07-29 (103-UAT.md test 2): this case used to coalesce BOTH fields to the
          // literal string "unknown" and store the row. ...
          if (isUnresolvedRouting({ profileId: routedProfileId, model: routedModel })) {
            break;
          }
          await ctx.runMutation(internal.activeEngine.recordRouting, {
            profileId: routedProfileId,
            model: routedModel,
            mode: d.mode ?? "inherited",
            selectionPath: d.selectionPath ?? d.selection_path,
            expiresAt: d.expiresAt ?? d.expires_at,
            timestamp,
          });
          break;
        }
```
**D-11 note (rename is astridr-side, not this file's concern directly):** `routedModel = d.model`
already reads only `d.model` (no `selectedModel` fallback) — this is D-11's REJECTED alternative
("widening CodePulse's coalescing to accept both") already correctly NOT implemented. No change
needed here for the rename itself; the fix is entirely on the astridr producer side (file 3 above).

**D-12 note:** `mode: d.mode ?? "inherited"` already exists and needs no change — D-12 says `mode`
is derived astridr-side at the single emit helper, so this line's fallback stays exactly as-is (it
only guards a payload that somehow omits `mode` entirely, which D-12's astridr-side change makes
even less likely, not more).

**Failed-status skip (Claude's Discretion item, resolved by RESEARCH.md Item 6):** add one guard
line inside this same case, before the `isUnresolvedRouting` check or folded into it:
```typescript
if (d.status === "failed") break;
```
matching this file's own "must break, never throw" idiom already used one line below.

**New case template — the `git_commit` case immediately below** (`runtimeIngest.ts:749-757`) is a
simpler sibling showing the same `const d = data as any` + coalescing + `ctx.runMutation` + `break`
shape at a smaller scale — useful as a second reference point if the `model_routing` case feels
too state-laden to copy wholesale:
```typescript
        case "git_commit": {
          const d = data as any;
          await ctx.runMutation(api.git.recordCommit, {
            sha: d.sha ?? d.hash ?? "unknown",
            message: d.message ?? d.commit_message ?? "",
            branch: d.branch ?? "unknown",
            author: d.author ?? "unknown",
            filesChanged: d.filesChanged ?? d.files_changed ?? 0,
            timestamp: d.timestamp ?? timestamp,
          });
          break;
        }
```
New `case "control_verb_swap":` should follow the `model_routing` case's shape (dual coalescing,
`internal.controlVerbSwaps.record`, `break` never `throw`), storing every emit per D-13 (no
unresolved-guard equivalent — a refusal IS a valid row here, unlike `model_routing`).

**Confirmed test gap (RESEARCH.md A3, resolved this session):** `convex/runtimeIngest.test.ts`
**exists** (`ls` confirmed) but a targeted grep (`grep -n "model_routing\|control_verb_swap"
convex/runtimeIngest.test.ts`) returned **zero hits** — neither case has any test coverage today.
This is a genuine Wave 0 gap, not a "verify at plan time" unknown: the plan should add both a
`model_routing` coalescing/rename test and a new `control_verb_swap` ingest test to this existing
file, following whatever per-case test structure the rest of `runtimeIngest.test.ts` already uses
for its other cases (not read in full this session — inspect at plan/implementation time for its
per-case test convention before adding).

---

### 7. `astridr/channels/agent_processor.py` (`process()` — add missing `reset_profile_context`)

**Analog:** `set_goal_context`/`reset_goal_context` try/finally idiom, `astridr/channels/router.py:508-525`
(re-read this session, byte-identical to RESEARCH.md's citation):
```python
            # D-149-04: Set a fresh turn-scoped goal ID so all delegate_task calls
            # within this turn share one goal_id → swarm graph groups legs together.
            # Set BEFORE _route_locked (and any spawn_supervised_task inside it) so
            # spawned background tasks inherit this ContextVar at create_task time.
            # The finally block resets it after the turn to prevent leakage to
            # subsequent background tasks spawned from this context.
            _goal_token = set_goal_context(str(uuid.uuid4()))
            try:
                await self._route_locked(message, channel)
            except Exception:
                logger.exception("router.route_locked_unhandled", sender=message.sender_id, channel=_ch_id)
                ...
            finally:
                reset_goal_context(_goal_token)
```

**The set-point that needs the matching finally** — `AgentProcessor.process()`,
`astridr/channels/agent_processor.py:43-155` (full method read this session, byte-identical to
RESEARCH.md's citation). Today `set_profile_context` is called with no captured token and no
reset at all:
```python
    async def process(
        self,
        text: str,
        message: IncomingMessage,
        session: Any,
        profile: Any,
    ) -> str | None:
        ...
        if self._agent_loop is None:
            # Fallback stub -- echo with profile context
            return f"[{profile.name}] Received: {message.text}"

        try:
            from astridr.agent.loop import Session as AgentSession
            from astridr.providers.base import Message
            ...
            agent_session.active_profile = profile.id
            from astridr.engine.telemetry import set_profile_context
            set_profile_context(profile.id)          # <-- token discarded, never reset

            user_msg = Message(role="user", content=text)
            agent_response = await self._agent_loop.process(user_msg, agent_session)
            ...
            return response_text
        except Exception:
            logger.exception("router.agent_loop_error")
            ...
            return f"[{profile.name}] I encountered an error processing your request. Please try again."
```
Apply the `router.py:508-525` idiom exactly: capture the token
(`_profile_token = set_profile_context(profile.id)`), and add a `finally: reset_profile_context(
_profile_token)` wrapping the whole body from the `set_profile_context` call through the return —
note the existing `try/except Exception` block already covers most of that scope, so the cleanest
fix is likely restructuring to `try: ... finally: reset_profile_context(...)` nested inside (or
replacing) the current bare `try/except`, matching `router.py`'s pattern of `try/except Exception
... finally: reset_goal_context(...)` at the same nesting level. Confirm both `set_profile_context`
and `reset_profile_context` at `astridr/engine/telemetry.py:670-686` (read this session,
byte-identical to RESEARCH.md's citation):
```python
def set_profile_context(profile_id: str | None) -> contextvars.Token[str | None]:
    """Set the current OPERATIONAL profile id (personal/business/consulting)
    for ContextVar propagation to globally-registered tools (e.g. CLIGatewayTool).

    Returns a token for reset_profile_context().
    """
    return _current_profile_id.set(profile_id)


def reset_profile_context(token: contextvars.Token[str | None]) -> None:
    """Reset the profile context to its previous value."""
    _current_profile_id.reset(token)


def get_profile_context() -> str | None:
    """Return the current operational profile id, or None if not set."""
    return _current_profile_id.get()
```

---

### 8. `astridr/api/ws_commands.py` (`SwapSetCommand` + `_handle_swap_set` — add optional profile scope)

**Analog for the optional-field convention:** `AgentSendTaskCommand`/`ChatSendCommand`, which
already carry an optional `profile: str | None = None` field — the direct, in-repo precedent for
D-05's new field (found by grep this session, `astridr/api/ws_commands.py:54-72`):
```python
class AgentSendTaskCommand(BaseModel):
    type: Literal["agent.send_task"]
    request_id: str
    agent_id: str | None = None   # D-02
    task: str
    channel: str | None = None
    profile: str | None = None


class ChatSendCommand(BaseModel):
    type: Literal["chat.send"]
    request_id: str
    message: str
    profile: str | None = None
    interrupted_reply: str | None = None  # D-11/D-12: prior turn's cut-off reply text
    ...
```
Note these existing commands name the field `profile`, not `profile_id` — RESEARCH.md's Item 8
wiring recommendation uses `profile_id` (matching `args["profile_id"]`'s downstream consumer name
in `swap_model.py`/`swap_voice.py`'s `args.get("profile_id")`). Flag this naming choice explicitly
in the plan: either follow this file's own `profile` convention on the Pydantic field (translating
to `args["profile_id"]` inside `_handle_swap_set`) or use `profile_id` directly on the field too —
either is defensible, but state the choice rather than let it default silently.

**The class to extend** (`astridr/api/ws_commands.py:224-240`, confirmed exact — CONTEXT.md's
`:235-247` citation was off by the docstring/field-body split RESEARCH.md's Decision Conflict #3
already flagged; `:224` is the class line, `:237-239` are the three existing fields):
```python
class SwapSetCommand(BaseModel):
    """Manual brain/voice selection from the control-center dropdowns
    (Phase 186 D-17 BrainControl/VoiceControl). Dispatches through the
    SAME ``swap_model``/``swap_voice`` ``ControlVerb.execute`` a spoken
    "try on X" / "switch your voice to X" resolves to (looked up by name
    in ``VERB_REGISTRY``, never a parallel mutation) -- identical
    telemetry (``control_verb_swap``) and dedup semantics to a spoken
    swap. ``value`` is a catalogue id/display name (fed straight into the
    verb's own fuzzy resolver, same as a transcribed utterance would be);
    ``restore=True`` clears the override instead (``value`` ignored)."""

    type: Literal["swap.set"] = "swap.set"
    request_id: str = ""
    target: Literal["brain", "voice"]
    value: str | None = None
    restore: bool = False
```
Add `profile_id: str | None = None` here, and update the docstring's one-dispatch-path promise
paragraph to mention the new optional scope (D-05 rests explicitly on this docstring's promise
staying true).

**The handler to extend** (`astridr/api/ws_commands.py:1075-1123`, `_handle_swap_set`, full method
read this session, byte-identical to RESEARCH.md's citation):
```python
    async def _handle_swap_set(self, cmd: SwapSetCommand) -> dict:
        """Manual brain/voice selection (Phase 186 D-17, 186-09).
        ...
        """
        from astridr.engine.control_verbs.registry import (
            VERB_REGISTRY,
            ControlVerbContext,
        )

        verb_name = "swap_model" if cmd.target == "brain" else "swap_voice"
        verb = VERB_REGISTRY.get(verb_name)
        if verb is None:
            raise ValueError(f"{verb_name!r} control verb is not registered")

        if cmd.restore:
            args = {"restore": "true"}
        else:
            if not cmd.value:
                raise ValueError("value is required unless restore=true")
            args = {"target": cmd.value}

        ctx = ControlVerbContext(
            session_id=None, channel="codepulse-control-center", telemetry=self._telemetry,
        )
        result = await verb.execute(args, ctx)
        ...
        return {
            "handled": result.handled,
            "spoken_reply": result.spoken_reply,
            "target": cmd.target,
        }
```
Insert `if cmd.profile_id: args["profile_id"] = cmd.profile_id` after the `if cmd.restore: ...
else: ...` block (RESEARCH.md Item 8's exact recommendation), **plus** the Item 8 guard for the
voice-target case: reject/ignore `profile_id` when `cmd.target == "voice"` (Item 8's option (a),
recommended) — a `swap_voice` dispatch has no per-profile override concept today, so a `scope`
populated on a `control_verb_swap` row for a voice swap would be inert/misleading if not guarded.

**Auth tier — no change needed.** `astridr/security/command_auth.py` (full file, 51 lines, read
this session, byte-identical to RESEARCH.md's citation):
```python
ADMIN_COMMANDS: frozenset[str] = frozenset({"estop.activate", "estop.deactivate"})


class CommandAuth:
    def check(self, command_type: str, provided_key: str) -> str | None:
        if command_type in ADMIN_COMMANDS:
            if not hmac.compare_digest(provided_key, self._admin_key):
                return f"Command '{command_type}' requires admin key"
            return None
        # Standard commands: accept either service key or admin key
        if hmac.compare_digest(provided_key, self._service_key) or hmac.compare_digest(
            provided_key, self._admin_key
        ):
            return None
        return "Invalid service key"
```
`swap.set` is not in `ADMIN_COMMANDS` today and D-05/RESEARCH.md Item 8 both confirm it should
stay that way — no code change to this file, just confirm the plan does not add it here.

---

### 9. `src/components/brains/GlobalSwapModal.tsx` (add D-15 swap-history section)

**Analog for the file's own idiom:** itself (full file, 594 lines, read this session, byte-identical
to CONTEXT.md's description). Key conventions the new history section must match:

- **Dialog phase model** (`GlobalSwapModal.tsx:142, 267, 476-592`): the component already has a
  `phase: "confirm" | "result"` state machine rendered via a single `<Dialog>`/`<DialogContent>`
  that swaps its body based on `phase`. D-15's history section should NOT introduce a third phase —
  the plan/UI-SPEC discretion should decide whether it's a persistent block visible in the
  `"confirm"` phase (most natural: "here's what happened last time, here's what you're about to do")
  or a collapsible section, but it must compose with the existing two-phase structure rather than
  replace it.
- **Row-list rendering pattern** (`GlobalSwapModal.tsx:503-515`, the confirm-phase profile list):
  ```tsx
  <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
    {profiles.map((p) => (
      <div key={p.profileId} className="flex items-center gap-2 text-sm">
        <span className="flex-1">{profileLabel(p)}</span>
        {p.hasConfiguredDefault && (
          <Pin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="text-muted-foreground">{p.currentModelDisplayName}</span>
        <span aria-hidden="true">→</span>
        <span>{target.name}</span>
      </div>
    ))}
  </div>
  ```
  and the near-identical result-phase snapshot list (`:559-582`) — same `rounded-md border
  border-border p-2` container, same per-row `flex items-center gap-2 text-sm` shape, same
  icon-then-label-then-value ordering. Copy this exact container/row styling for the swap-history
  list rather than inventing new classes.
- **Status icon convention** (`GlobalSwapModal.tsx:536-554`): `Check`/`X`/`AlertTriangle` from
  `lucide-react`, colored via `text-(--status-ok)` / `text-(--status-error)` /
  `text-(--status-warn)` CSS-var tokens (per this repo's CLAUDE.md styling rule — never hardcode
  hex). A history row showing a refusal/unresolved outcome (D-13 stores these) should reuse this
  exact icon+token mapping, not invent a new palette.
- **Imports/hooks convention** (`GlobalSwapModal.tsx:50-63`): `useCommandDispatch`,
  `useGlobalBrainOverride` from `@/hooks/...`. The new history section needs a
  `useQuery(api.controlVerbSwaps.<queryName>, { profileId })`-style hook — check whether an
  existing `src/hooks/useControlVerbSwaps.ts`-shaped file should be added (this repo's own
  CLAUDE.md convention: "Custom hooks: `src/hooks/useFoo.ts` wraps `useQuery(api.foo.list) ?? []`")
  rather than calling `useQuery` inline in the modal — follow `useResolvedBrain.ts`'s existing
  pattern (imported at `:62`) for the wrapper-hook shape.

**Analog for the truncation-on-screen convention (Phase 105 D-11/D-12 precedent cited in
CONTEXT.md):** `src/components/ToolPolicyFeed.tsx:197-208` (read this session):
```tsx
      {feed.truncated && (
        <div
          className="text-sm rounded-md px-3 py-2"
          style={{
            color: "var(--status-warn)",
            border: "1px solid color-mix(in srgb, var(--status-warn) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--status-warn) 12%, transparent)",
          }}
        >
          Showing the most recent {feed.cap} policy events — older events aren&apos;t loaded.
        </div>
      )}
```
This is the exact "state truncation on screen" pattern CONTEXT.md's Claude's Discretion section
points at (Phase 105 D-11/D-12). For a `.take(20)`-bounded swap-history query, either reuse this
banner shape (if the list can silently truncate) or a simpler static caption ("Showing the last 20
swaps") if the query itself never reports a `truncated` flag — decide based on whether the new
query returns a `{ rows, truncated, cap }` shape (matching `useToolPolicyEvents`'s convention,
`src/hooks/useToolPolicyEvents.ts`) or a plain array (matching `latestByProfile`'s convention).
Given `activeEngine.ts`'s `latestByProfile` returns a plain array with no truncation flag, the
simpler static-caption form is the more consistent choice unless the plan has a specific reason to
add a `truncated` flag to the new query.

## Shared Patterns

### Dual snake/camelCase coalescing at the Convex ingest boundary
**Source:** `convex/runtimeIngest.ts:717-748` (the `model_routing` case), reinforced by the file's
own WR-06/168-06 header comment.
**Apply to:** the new `case "control_verb_swap"` in the same file. Every field read from the
astridr payload must coalesce `d.camelCase ?? d.snake_case`, and an unusable event must `break`,
never `throw` — a single bad event must not poison the rest of the ingest batch.

### `internalMutation`-only write paths for telemetry tables (CR-01 rule)
**Source:** `convex/activeEngine.ts:59-77` header comment (the CR-01 fix rationale), enforced by
`convex/activeEngine.test.ts:93-116`.
**Apply to:** the new `controlVerbSwaps` insert mutation — must be `internalMutation`, never a
public `mutation`, and must be invoked only via `internal.controlVerbSwaps.<name>` from
`runtimeIngest.ts`, never `api.controlVerbSwaps.<name>` from client code. Add the equivalent
source-level regression test (see file 2 above).

### Bound every read; state truncation on screen
**Source:** `convex/activeEngine.ts:46-57` (`latestByProfile`'s `.take(200)`),
`src/components/ToolPolicyFeed.tsx:197-208` (the truncation banner).
**Apply to:** the new `controlVerbSwaps` read query (`.take(20)` per RESEARCH.md Item 3) and its
`GlobalSwapModal.tsx` consumer.

### Bound a table's retention BEFORE it starts growing, with the reason in the comment
**Source:** `convex/retention.ts:39-48` (`gatewayQuotaSnapshots`), `:58-65` (`toolPolicyEvents`).
**Apply to:** both new `RETENTION_DAYS` entries (`activeEngineSnapshots`, `controlVerbSwaps`) — see
file 5 above for the drafted comment text.

### ContextVar set/reset/get trio with a try/finally at the set-point
**Source:** `astridr/engine/telemetry.py:588-603` (goal context API, the sibling to profile
context), `astridr/channels/router.py:508-525` (the try/finally set-point usage).
**Apply to:** `astridr/channels/agent_processor.py`'s `process()` method — add the missing
`reset_profile_context()` call in a `finally:` block (file 7 above). This is the one genuine
defect this phase must fix, per RESEARCH.md's "load-bearing once router.py starts reading this
ContextVar" analysis.

### One dispatch path per control verb — no parallel mutation
**Source:** `SwapSetCommand`'s own docstring, `astridr/api/ws_commands.py:224-233`.
**Apply to:** D-05's scope field — it must travel through the existing `args: dict[str, str]`
parameter into the existing `VERB_REGISTRY` lookup (`_handle_swap_set`,
`astridr/api/ws_commands.py:1090-1110`), never a new command type or a second mutation path.

## No Analog Found

None. All 9 files/changes in this phase have a strong same-repo, same-role analog (see table
above) — either an exact sibling built for the immediately preceding, structurally identical
phase (Phase 103/104/105 for the codepulse side, Phase 185/186 for the astridr side), or an
existing convention within the same file being modified.

## Metadata

**Analog search scope:**
- codepulse: `convex/activeEngine.ts`, `convex/activeEngine.test.ts`, `convex/activeEngineFilters.ts`,
  `convex/retention.ts`, `convex/retention.test.ts`, `convex/runtimeIngest.ts` (targeted sections),
  `convex/runtimeIngest.test.ts` (grep only), `convex/schema.ts` (targeted sections),
  `src/components/brains/GlobalSwapModal.tsx`, `src/components/ToolPolicyFeed.tsx`.
- astridr-repo (`feature/brain-swap`): `astridr/providers/router.py` (full class + targeted
  sections), `astridr/engine/telemetry.py` (targeted sections), `astridr/channels/router.py`
  (targeted sections), `astridr/channels/agent_processor.py` (full `process()` method),
  `astridr/api/ws_commands.py` (targeted sections), `astridr/security/command_auth.py` (full file),
  `astridr/engine/control_verbs/swap_model.py` (targeted sections),
  `astridr/engine/control_verbs/swap_voice.py` (targeted sections),
  `astridr/engine/control_verbs/registry.py` (targeted sections),
  `docs/astridr-contract.md` (targeted sections, `control_verb_swap` + `model_routing` field
  tables).
**Files scanned (Read/Grep tool calls):** 24.
**Pattern extraction date:** 2026-08-07.
**Drift check:** Re-verified `grep -c "activeEngineSnapshots" convex/retention.ts` → 0 (matches
RESEARCH.md). Re-verified `convex/controlVerbSwaps.ts`/`.test.ts` do not yet exist. Re-verified
`convex/runtimeIngest.test.ts` exists but has zero `model_routing`/`control_verb_swap` coverage
(resolves RESEARCH.md's open A3). No other citation drift found beyond RESEARCH.md's own
already-disclosed `⚠ Decision Conflicts Found` (dead-code `ProfileManager`, pre-existing
`_current_profile_id` ContextVar, `SwapSetCommand`'s off-by-a-few line citation).
