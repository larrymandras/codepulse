# Phase 108: Per-Profile Engine Telemetry (astridr backend) - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Ástríðr's **per-profile engine axis genuinely exist** — a telemetry emitter that reports a
real `profileId` + model, a `swap.set` that can be scoped to one profile, and a queryable domain
route for `control_verb_swap` — then prove all three against the live running stack before Phase
109's UI binds to them.

**This phase is primarily astridr-repo work**, on branch `feature/brain-swap` (the deployed
branch). The CodePulse half is small and mostly already built.

**Scoping correction, verified at discussion (2026-08-07):** the inherited framing "the emitter
does not exist" is **imprecise**. Both halves of the pipe already exist and are broken in two
specific, checkable ways:

- `ModelRouter._emit_model_routing` (`astridr/providers/router.py:399-427`) **does** fire on every
  resolution, from four call sites (`:302`, `:375`, `:393` and the boot-adjacent path). Its payload
  carries **no `profileId` at all**, and it sends **`selectedModel`**, not `model`.
- CodePulse's `case "model_routing"` (`convex/runtimeIngest.ts:717-748`) reads `d.profileId ??
  d.profile_id` and `d.model` — **both undefined** against today's payload — so
  `isUnresolvedRouting()` `break`s every single event.

That is the complete mechanism behind "93 rows, all `{profileId:"unknown", model:"unknown"}`" and
why the axis has never carried a valid row. The fix is a payload change plus profile plumbing, not
a new emitter.

**Also already built, do not rebuild:** `convex/activeEngine.ts` (`recordRouting` internalMutation,
`latestByProfile`, `pruneUnresolved`), the `activeEngineSnapshots` table (`convex/schema.ts:2062`),
and the unresolved-value guard. The Phase 103 UI components (`src/components/brains/`:
`BrainPicker`, `BrainHeaderBadge`, `GlobalSwapModal`, `BrainFallbackNotice`) exist and are waiting
on real rows — **Phase 109 owns lighting them up**, not this phase.

**In scope:** ENGINE-01 (per-profile emitter), ENGINE-02 (scoped `swap.set`), ENGINE-05
(integration gate), TELE-02 (`control_verb_swap` domain route + minimal readout).

**Out of scope:** ENGINE-03/ENGINE-04 (Phase 109's current-engine UI and honest swap status), the
richer per-profile engine surfaces, the `brain.fallback` event (103-CONTRACT.md §5), CLI `--agentic`
hybrid mode, and the remaining Group B event kinds (Phase 112 / TELE-03).

</domain>

<decisions>
## Implementation Decisions

### Profile identity plumbing (ENGINE-01, ENGINE-02)

- **D-01:** **A `contextvars.ContextVar` set at the loop boundary carries the profile.** Set once
  where the profile is already resolved (agent loop / message intake, near
  `ProfileManager.resolve_profile`, `astridr/engine/profile_manager.py:105`); read by
  `_emit_model_routing` AND by `_resolve_model`. **Rejected:** threading `profile_id` through every
  `chat()` call site (any caller that forgets it silently produces an unattributed call — the exact
  failure ENGINE-01 exists to kill), and resolving from `session_id` at emit (a hot-path lookup that
  fails for every session-less call, which is where the sentinels came from). **Precedent in this
  codebase, not invention:** Phase 94's `_current_trace_id` ContextVar trio and Phase 105's D-10
  per-round ContextVar were both added for exactly this reason — the provider layer has no access
  to loop-level context. `ModelRouter.chat` sees only `session_id`/`agent_id`.

- **D-02:** **No profile in context → refuse to emit.** Cron ticks, subagents, background sweeps and
  any other session-less call write **no** `model_routing` row at all (debug-log on the astridr
  side). This is ENGINE-01 read literally ("an unresolved value is refused at emit rather than
  written"), and it keeps CodePulse's `isUnresolvedRouting()` guard as a genuine second line rather
  than the only one. **Rejected:** attributing to `config.profiles[0].id` (a cron tick would render
  as the personal profile's current engine — a fabricated reading of the same family BSC-01 exists
  to prevent) and a `profileId:"system"` sentinel (re-introduces a sentinel into the table whose 93
  sentinel rows had to be pruned).
  **Accepted cost:** a profile that only ever runs background work stays silent on this axis.

- **D-03:** **Boot-seeds one `model_routing` per profile, `mode:"inherited"`.** 103-CONTRACT.md §4
  requires an emit on process start so the table is never empty-by-default, but at boot there is no
  inbound message and therefore no profile context — D-02 would block it. Resolved by emitting at
  the **same bootstrap point that already loops `config.profiles` to push `profile_config`**
  (`astridr/engine/bootstrap/core.py:1343-1359`), one event per profile carrying that profile's
  `model_default` with `mode:"inherited"`.
  **This is not a D-14 violation.** D-14 forbids the *UI* sourcing the current engine from a config
  read. Here astridr — the authority — reports what it actually resolved to at boot, which is
  precisely what `mode:"inherited"` means in the contract's own vocabulary.

- **D-04:** **The same ContextVar drives the per-profile override, which sits ABOVE the global one.**
  `_resolve_model` (`astridr/providers/router.py:429-472`) gains one step:
  `explicit_model` → **per-profile override** → global override (`_global_model_override`,
  `:446`) → session override → category rule → default. A profile-specific choice is more specific
  than a process-wide one, so it wins. With no profile in context the chain is **byte-identical to
  today**, which is what ENGINE-02 requires. **Rejected:** a separate explicitly-passed key for the
  override (two sources of profile identity that can disagree — the emitter could report a profile
  the override never applied to).

### Scoped swap command shape (ENGINE-02)

- **D-05:** **Extend the existing `SwapSetCommand` with an optional profile scope.** Add optional
  scope/`profile_id` fields to `astridr/api/ws_commands.py:235-247`. **Rejected:** implementing the
  separate `gateway.model.set` command that 103-CONTRACT.md §2 specifies. Rationale — ENGINE-02's own
  wording says `swap.set`, and one command keeps **one dispatch path**: `SwapSetCommand`'s docstring
  makes a load-bearing promise that manual and spoken swaps go through the same `swap_model`
  `ControlVerb.execute` looked up in `VERB_REGISTRY`, "never a parallel mutation", with identical
  `control_verb_swap` telemetry and dedup semantics. A second command is a second path into the same
  override state — which is how two axes end up able to disagree without either knowing. Omitting the
  new fields is byte-identical to today's behaviour.
  **Consequence, not optional:** 103-CONTRACT.md §2 must be corrected on disk (see D-08).

- **D-06:** **The per-profile override is runtime-only, no TTL — mirroring the global axis.** It
  lives in process memory alongside `_global_model_override`, cleared by `restore=true` or a
  restart. **Rejected:** the contract's `mode: "session"` 1-hour TTL (adds expiry bookkeeping, a
  sweep or lazy-expiry check on the resolve hot path, and a second live behaviour ENGINE-05 must
  prove) and a persisted sticky override (a persisted override IS a config read, collapsing the D-14
  boundary). **Deliberately left unused, recorded not dropped:** `activeEngineSnapshots.expiresAt`
  and the contract's `mode:"session"` — deferred, available if a later phase wants session swaps.

- **D-07:** **A spoken swap stays GLOBAL; only an explicit scope is per-profile.** The `swap_model`
  verb applies a per-profile override only when the command carried an explicit profile scope; a
  spoken "try on X" with no scope keeps calling `set_global_override` exactly as today
  (`astridr/engine/control_verbs/swap_model.py:493`). Preserves ENGINE-02's byte-identical-unscoped
  guarantee literally, and keeps the spoken UX unchanged. **Rejected:** auto-scoping a spoken swap
  to the utterance's channel profile — it silently changes today's global behaviour for every
  existing voice swap with no signal to the operator that the blast radius shrank.

- **D-08:** **`103-CONTRACT.md` is corrected IN PLACE, as a Phase 108 deliverable, in the same commit
  as the code.** Three claims in it are now false and it is the document Phase 109 will bind to:
  §1's status table says the per-profile axis is "Not built" and attributes it to "Ástríðr Phase
  184.1" (**no such phase exists** — v14.0 scoping proved it; the brain-swap backend shipped as
  astridr Phases 185/186), and §2 specifies `gateway.model.set`, rejected by D-05. Leaving it wrong
  reproduces the exact defect class TELE-01 exists to fix one repo over. Note it lives under
  `.planning/milestones/v13.0-phases/`, an archived directory — edit it there rather than forking a
  second contract.

### Emit cadence, payload shape, and row volume (ENGINE-01)

- **D-09:** **Emit-on-change, in astridr, at the source.** The emitter keeps a per-profile
  last-emitted `(model, mode, selection_path)` and sends only when it differs — plus D-03's boot
  seed. **Rejected:** emitting every resolution and deduping at ingest (every LLM call would cost a
  Convex read+write on the ingest hot path, on the instance that has already gone down twice from
  read growth) and emitting + storing every row (unbounded growth on an unpruned table fed by the
  system's highest-frequency event — the exact shape of the 2026-07-21/22 outage).
  **Contract-literal, not a deviation:** 103-CONTRACT.md §4 says "after every resolution **change**".
  It also matches how the axis is actually read — `latestByProfile` only ever wants the newest row
  per profile.

- **D-10:** **`activeEngineSnapshots` is added to `RETENTION_DAYS` in this phase.** Verified
  2026-08-07: `grep -c "activeEngineSnapshots" convex/retention.ts` → **0**. It is append-only and
  unbounded, and this is the phase that turns it from permanently-empty into growing. Bounding it
  before it can ever need a mass delete is the same pre-emptive move `convex/retention.ts`'s own
  comments record for `gatewayQuotaSnapshots` (Phase 104 D-20, `:39-48`) and `toolPolicyEvents`
  (Phase 105 D-05, `:58-65`) — both added while the table was still empty. Only the latest row per
  profile is ever read, so any window is pure headroom. **Rejected:** deferring to Phase 110/DUR-01
  (110 is explicitly independent and may run after 109, leaving the table live and growing with
  nothing bounding it) and skipping retention because emit-on-change makes volume negligible (true
  today, but it makes the bound depend on a behaviour a future emitter change could silently undo).

- **D-11:** **astridr renames `selectedModel` → `model` to match the contract.** 103-CONTRACT.md §4
  names the field `model`; `convex/runtimeIngest.ts:727` reads `d.model`; `router.py:413` sends
  `selectedModel`. Fix the producer — one name for one thing. **Rejected:** widening CodePulse's
  coalescing to accept both (enshrines two names and leaves the contract contradicted by the live
  emitter). **Required check before the rename lands:** grep astridr for any other consumer of
  `selectedModel` on this event; if one exists, emit both fields for one release rather than
  breaking it silently.

- **D-12:** **`mode` is derived from `selection_path`, at the single emit helper.**
  `_resolve_model` already returns a vocabulary that says exactly *why* a model won (`"override"`,
  `"global-swap-override"`, `"session-override"`, `"category-rule"`, `"default"` — `router.py:437-472`).
  Map it: a per-profile or global swap override → `"pinned"`, a session override → `"session"`,
  everything else → `"inherited"`. One source of truth, so `mode` can never disagree with the
  `selection_path` shipped alongside it. **Rejected:** per-call-site mode literals (drift) and
  deriving mode in the CodePulse consumer (the schema field is required and the contract specifies
  it — deriving semantics consumer-side is how the two repos drift).

### `control_verb_swap` domain route + readout (TELE-02)

- **D-13:** **All emits are stored, with an outcome and a profile scope field.** Verified
  2026-08-07: there are **six** `control_verb_swap` emit sites, not two —
  `swap_model.py:444` (restore), `:472` (unresolved), `:483` (affinity-refused), `:495` (success),
  plus `swap_voice.py:211,232`. Store every one, carrying the existing `path`/`reason` fields
  through, and add a scope field (the explicit `profile_id` when scoped, null when global).
  **Rejected:** successes-only — the refusal path is exactly where the affinity guard and the
  resolver fail, and a history that stores only successes claims every swap worked.

- **D-14:** **One table, holding brain AND voice swaps, discriminated by the existing `verb` field.**
  `swap_model` and `swap_voice` emit the same event name on the same channel; the payload already
  carries `verb`. The readout filters to brain. **Rejected:** brain-only ingest (an undocumented
  disposition for a Group B sub-kind — exactly what TELE-03 exists to prevent — leaving live voice
  rows with no queryable surface) and two separate tables (two schemas, two retention entries, one
  event shape). **Follow the D-10 precedent:** the new table gets a `RETENTION_DAYS` entry in this
  phase too.

- **D-15:** **The minimal readout is a swap-history section inside the existing `GlobalSwapModal`.**
  `src/components/brains/GlobalSwapModal.tsx` already exists from Phase 103 and is the surface an
  operator is looking at at the exact moment history is relevant ("what did I last switch this to,
  and did it take?"). No new route, no nav entry, and it composes with Phase 109's confirm-modal work
  rather than competing with it. **Rejected:** a panel on Settings/Dashboard (plants a surface Phase
  109 may want to move, and picks a host page on 109's behalf) and query-only with no UI (TELE-02
  says "and surfaced" — closing it on a query no human can see is an unprovable claim).

### Integration gate (ENGINE-05)

- **D-16:** **Proof is a live scoped swap read back from Convex ROWS, not from the UI.** Rebuild the
  astridr stack, issue a real scoped `swap.set` for one profile, then read `activeEngineSnapshots`
  and the new swap-history table **directly out of the running self-hosted backend**, asserting: a
  real `profileId` + model (never a sentinel), the **other** profiles unchanged, and a matching
  swap-history row. Include the **unscoped control** — a global swap still behaves byte-identically
  (D-04/D-07). Evidence is backend rows because an optimistic overlay cannot manufacture them — the
  106-08 Test 8 precedent. **Rejected:** verifying through the CodePulse UI (Phase 109 is the phase
  that makes those surfaces read telemetry, so 108 would gate on UI it has not built, and a rendered
  value is not proof of a stored row) and a CI integration test (this stack is self-hosted with no CI
  path to it, and BSC-05 / the Phase-90 lesson is that "endpoint exists" and "integration works"
  diverge on the live machine specifically).

### Claude's Discretion

- **Restore semantics when both overrides are live.** Not discussed explicitly. Derive from D-04's
  precedence: a **scoped** `restore=true` clears only that profile's override; an **unscoped**
  `restore=true` clears the global one and leaves per-profile pins intact. Make it explicit in the
  plan and in the corrected contract.
- **Exact ContextVar set-point** (agent loop vs channel intake), subagent inheritance, and behaviour
  across `asyncio` task boundaries — planner/researcher to determine from the code. Note
  `contextvars` propagate into tasks created with `asyncio.create_task` but not across threads.
- **Retention windows** for `activeEngineSnapshots` and the new swap-history table — pick from the
  existing bands in `convex/retention.ts` (14 / 30 / 90) with a stated reason, following the
  `toolPolicyEvents` comment style.
- **New table name and exact schema/indexes** for the `control_verb_swap` route.
- **Whether the failed-resolution emit** (`router.py:393`, `status="failed"`) should write a
  snapshot row at all — a failed resolution arguably did not change the active engine.
- **Bounding/pagination** of the swap-history readout query (this repo's standing rule: never
  `.collect()`, and state truncation on screen — Phase 105 D-11/D-12).
- **Auth tier** for the new scope field on `swap.set` (103-CONTRACT.md §6, ASVS V4).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The per-profile contract (authoritative, and being corrected by this phase)

- `.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md` — the
  per-profile axis contract. **§2** = the write command (superseded by D-05, correct it per D-08),
  **§4** = the `model_routing` telemetry event shape and the "emit on process start" requirement
  (D-03), **§5** = `brain.fallback` (out of scope this phase), **§6** = authorization tier.
  **§1's status table is factually wrong** — see D-08.
- `.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTEXT.md` — Phase 103's
  own decisions, including the **D-14 boundary** (the UI reads the active engine ONLY from
  telemetry, never a config read) that this phase must not violate.

### Milestone scope and requirements

- `.planning/REQUIREMENTS.md` — ENGINE-01/02/05 and TELE-02 verbatim, plus the **"Scoping evidence"
  table** (lines 13-25) recording which inherited claims were checked and what the checks showed.
- `.planning/ROADMAP.md` § "Phase 108" — goal, the 4 success criteria, and the TELE-02 sequencing
  note explaining why `control_verb_swap` rides along.

### astridr-repo (branch `feature/brain-swap`) — primary build target

- `astridr/providers/router.py:399-427` — `_emit_model_routing`, the emitter to extend (payload at
  `:411-423`; the `selectedModel` name at `:413`).
- `astridr/providers/router.py:429-472` — `_resolve_model` and its `selection_path` vocabulary
  (D-12's mapping source); `:446` is the global-override step D-04 inserts above.
- `astridr/providers/router.py:118, 611-621` — `_global_model_override` and its
  set/clear/get accessors, the model for the per-profile store.
- `astridr/providers/router.py:302, 375, 393` — the three in-flight `_emit_model_routing` call
  sites (`:393` is the `status="failed"` path).
- `astridr/api/ws_commands.py:235-247` — `SwapSetCommand`, extended by D-05. Its docstring states
  the one-dispatch-path promise D-05 rests on. Handler registration at `:419`.
- `astridr/engine/control_verbs/swap_model.py:422-500` — the `_execute` body and 4 of the 6
  `control_verb_swap` emit sites (`:444`, `:472`, `:483`, `:495`); `:493` is `set_global_override`.
- `astridr/engine/control_verbs/swap_voice.py:211, 232` — the other 2 emit sites (D-14).
- `astridr/engine/profile_manager.py:105` — `resolve_profile`, where the profile is already known
  (D-01's ContextVar set-point neighbourhood).
- `astridr/engine/bootstrap/core.py:1343-1359` — the existing per-profile `profile_config` push
  loop; D-03's boot seed goes here.

### CodePulse — the receiving half (mostly already built)

- `convex/runtimeIngest.ts:717-748` — `case "model_routing"`, including the D-14 comment block and
  the `isUnresolvedRouting` guard. The `control_verb_swap` case is added to this same switch.
- `convex/activeEngine.ts` — `recordRouting` (internalMutation, the ONLY write path),
  `latestByProfile` (bounded `.take(200)`), `pruneUnresolved`. Its header comments state D-14.
- `convex/activeEngineFilters.ts` — `isUnresolvedRouting`, the sentinel guard.
- `convex/schema.ts:2062-2072` — `activeEngineSnapshots` fields and indexes (note the unused
  `expiresAt`, D-06).
- `convex/retention.ts:28-71` — `RETENTION_DAYS`, `BATCH_SIZE`, and the batch-capped prune. D-10
  and D-14 add entries here. The `gatewayQuotaSnapshots` (`:39-48`) and `toolPolicyEvents`
  (`:58-65`) comments are the precedent to imitate.
- `src/components/brains/` — `GlobalSwapModal.tsx` (D-15's host), `BrainPicker.tsx`,
  `BrainHeaderBadge.tsx`, `BrainPickerRow.tsx`, `BrainsWsRegistrar.tsx`, `BrainFallbackNotice.tsx`
  — all Phase 103, all waiting on real rows. **Phase 109 owns them; do not rewire them here.**

### Operational rules that constrain this phase

- `CLAUDE.md` § "Self-Hosted Convex — Operational Rules" — never bulk-delete, never
  `import --replace-all`; retention-style deletes stay batch-capped.
- Claude memory `convex-topology-all-local` — `npx convex` targets the CLOUD deployment by default;
  the live backend is the local self-hosted one. D-16's row reads must target the right instance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`recordRouting` + `activeEngineSnapshots` + the `model_routing` ingest case** — the entire
  CodePulse receiving half is built and correct. This phase feeds it, it does not rebuild it.
- **`_global_model_override` and its accessor trio** (`router.py:118, 611-621`) — the exact shape
  the per-profile store should imitate (a keyed dict + set/clear/get scoped by profile).
- **The bootstrap `config.profiles` loop** (`bootstrap/core.py:1343-1359`) already iterates every
  profile at exactly the right moment for D-03's boot seed, and already has `telemetry` in scope.
- **`GlobalSwapModal.tsx`** — an existing modal to host D-15's history section; no new route needed.
- **The `retention.ts` batch-capped machinery** — D-10/D-14 are one-line `RETENTION_DAYS` additions,
  not new prune code.
- **ContextVar precedent** — Phase 94's `_current_trace_id` trio and Phase 105's D-10 per-round
  ContextVar are working examples of this exact pattern in this exact codebase.

### Established Patterns

- **Dual snake/camelCase coalescing at the ingest boundary** is mandatory, not decoration.
  `runtimeIngest.ts`'s own comments record that a single unhandled `null` here previously poisoned
  an 8-event production batch (WR-06/168-06). A bad event must `break`, never throw.
- **Telemetry-table write paths are `internalMutation`, never `mutation`** — the CR-01 rule stated
  in `activeEngine.ts`'s header. Any new swap-history write path follows it.
- **Every runtime event always lands in `runtime_events` AND routes to a domain table when a case
  exists** (`runtimeIngest.ts:205, 235`). Adding the `control_verb_swap` case does not remove its
  generic row.
- **Bound every read** — `.take()` with a stated cap, never `.collect()` on a growing table; state
  truncation on screen (Phase 105 D-11/D-12).
- **Bound a table's retention BEFORE it starts growing**, with the reason written in the comment
  (`gatewayQuotaSnapshots`, `toolPolicyEvents`).

### Integration Points

- **astridr → CodePulse:** the existing `/runtime-ingest` HTTP path. **No new endpoint** — the
  contract is explicit about this. Both `model_routing` and `control_verb_swap` ride it.
- **WS command path:** `swap.set` dispatches through `CommandDispatcher` (`ws_commands.py:419`) →
  `VERB_REGISTRY` → `swap_model.ControlVerb.execute`. The scope field rides this unchanged path.
- **Cross-repo deploy ordering** matters for D-16: an astridr rebuild (`docker compose up --build`,
  with the `war-room` profile per the global rule) plus a Convex deploy to the **self-hosted**
  instance. Sequence it in the plan.

</code_context>

<specifics>
## Specific Ideas

- The ENGINE-05 gate must include the **unscoped control** — proving a global swap still behaves
  byte-identically is what makes "per-profile works" a real claim rather than a claim that something
  changed. An absence/behaviour proof without a control is vacuous (the 2026-08-05 lesson).
- The `mode:"inherited"` boot seed is deliberately worded as "what astridr resolved to", not "what
  config says" — the distinction is what keeps D-14 intact, and it should be stated that way in the
  code comment so a future reader does not "fix" it into a violation.
- 103-CONTRACT.md's §1 wrongness is worth correcting loudly rather than quietly: it is the same
  defect class (a contract documenting behaviour that does not exist) that TELE-01 was written to
  fix in astridr's own contract doc.

</specifics>

<deferred>
## Deferred Ideas

- **Session-mode swaps with a TTL** (103-CONTRACT.md §2's `mode:"session"`, and the already-present
  `activeEngineSnapshots.expiresAt` field) — deferred by D-06, not dropped. Available if a later
  phase wants temporary per-profile swaps.
- **`gateway.model.set` as a distinct command** — rejected by D-05 in favour of extending
  `swap.set`. Recorded in the corrected contract as a considered-and-rejected shape.
- **Voice swap history as a surfaced feature** — the rows are captured by D-14, but the D-15 readout
  filters to brain. Surfacing voice history is a future UI decision.
- **`brain.fallback` telemetry** (103-CONTRACT.md §5) — a real gap, but tied to CLI brains and
  outside this phase's four requirements.
- **Auto-scoping a spoken swap by channel profile** (rejected by D-07) — revisit only with an
  explicit operator-facing signal that the blast radius changed.
- **Rendering the disagreement between the global and per-profile axes** (103-CONTRACT.md §9) —
  Phase 109's problem, and possibly beyond it.

</deferred>

---

*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Context gathered: 2026-08-07*
