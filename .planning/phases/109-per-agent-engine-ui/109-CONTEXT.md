# Phase 109: Per-Agent Engine UI - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Make CodePulse's **already-built per-profile brain surfaces read Phase 108's now-real telemetry**,
report honest server-confirmed per-profile swap status, and give TELE-02's swap-history readout a
host with a real profile scope.

**In scope:** ENGINE-03 (current engine on the picker's "This profile" scope, the header badge, and
the pre-swap confirm modal's current-engine column — telemetry-sourced, never config), ENGINE-04
(honest in-flight → success/failure → server-reconciled per-profile swap), TELE-02's **surfaced**
half (the routed half shipped in Phase 108 and was proven live).

**Scoping correction, verified at discussion (2026-08-07).** The inherited framing — "Phase 108 made
the telemetry real, so 109 lights up the waiting UI" — is materially incomplete. The read half is
genuinely built and correct (`useActiveEngine.ts`, `useResolvedBrain.ts`, the four
`src/components/brains/` components). The **write and reconcile halves are wired to a contract that
does not exist**, and three separate honesty defects sit in the read path:

- **The per-profile client seam dispatches commands Ástríðr never implemented.**
  `createLiveBrainsAdapter` sends `{type:"gateway.model.set"}` (`src/lib/brainsApi.ts:165-170`, called
  from `BrainPicker.tsx:310-313`) and `{type:"models.catalog"}` (`brainsApi.ts:157-160`). Ástríðr's
  dispatcher registry (`astridr/api/ws_commands.py:405-435`) registers **neither**; a repo-wide grep
  for both strings across `astridr/` returns **zero matches**. An unknown `type` fails Pydantic union
  validation (`ws_commands.py:463-471`) and returns an error ack. Phase 108's **D-05 deliberately
  rejected** `gateway.model.set` in favour of extending `swap.set` with an optional `profile_id`.
  The picker's default scope is `"profile"` (`BrainPicker.tsx:203`), so this is the default path.
- **A scoped pin emits no telemetry row.** `swap_model.py`'s success branch sets the override and
  emits only `control_verb_swap`; Phase 108's own evidence states it plainly — *"a pin alone only
  writes the override; the emit fires on the next real resolution"*
  (`108-ENGINE-05-EVIDENCE.md:1682`). A **restore** does emit immediately
  (`_emit_restore_routing`, `swap_model.py:437-495`). And `swap.get_state` returns only
  `model_override`/`model_source` — the **global** slot
  (`astridr/engine/control_verbs/dispatch.py:95-106`) — so no readback can confirm a per-profile swap
  today.
- **The read-side precedence is inverted against D-04.** `resolveActiveBrain` checks
  `globalOverride` first and returns early (`useResolvedBrain.ts:250-254`), while Ástríðr resolves a
  per-profile override **above** the global one (Phase 108 D-04, `router.py`'s `_resolve_model` chain,
  set at `swap_model.py:617-620`). A pinned profile under an active global override therefore renders
  the global model while Ástríðr will actually use the pin. This is 103-CONTRACT.md §9, which
  108-CONTEXT.md's deferred list assigned to this phase.
- **The `lastTurn` fallback rung's stated premise is dead.** `useLastTurnModel`'s docstring justifies
  itself by the per-profile rung being "permanently empty because the backend emitter never sends
  `profileId` and uses a different key name (`selectedModel`, not `model`)"
  (`useResolvedBrain.ts:205-211`). Phase 108's **D-01** and **D-11** fixed exactly those two things.
  It now feeds a **fleet-wide** model into a **per-profile** read.

**Already built, do not rebuild:** `useActiveEngine`/`deriveMixedState`, `resolveActiveBrain`,
`convex/activeEngine.ts`, `convex/controlVerbSwaps.ts`, `useControlVerbSwaps` with
`filterBrainSwaps`/`describeSwapOutcome` (the four-way outcome vocabulary is decided and tested),
`SwapHistorySection`, and the whole `GlobalSwapModal` BSC-04 state machine — which this phase
**reuses as the pattern**, not rewrites.

**Out of scope:** the v15.0 "Borealis Console" UI overhaul (held per `CLAUDE.md`; do not pull
quick-wins forward), voice swap history, `brain.fallback` (103-CONTRACT.md §5), session-mode swaps
with a TTL (108 D-06), and the remaining Group B event kinds (Phase 112 / TELE-03).

</domain>

<decisions>
## Implementation Decisions

### The per-profile client seam (ENGINE-03, ENGINE-04)

- **D-01:** **Retire the D-16 stub seam entirely.** Delete `stubBrainsAdapter`,
  `createStubBrainsAdapter`, `brainsFixtures.ts`, `BRAINS_STUB_ACTIVE`, the `VITE_BRAINS_STUB` read
  (`brainsApi.ts:212-218`) and all four STUB chips (`BrainHeaderBadge.tsx:206`,
  `BrainPicker.tsx:452`/`:477`, `Chat.tsx:244`, `Settings.tsx:315`). Per-profile traffic dispatches
  `swap.set` with `profile_id` through the **same WS sender the global axis already uses**
  (`GlobalSwapModal.tsx:512`, `BrainControl.tsx:178`). The stub existed only because the backend did
  not; Phase 108 built it. **Rejected:** repointing the adapter's two methods and keeping the flag —
  it leaves a build-time flag that decides whether the operator sees real or fabricated data
  (`103-SECURITY.md`'s T-103-03 surface) alive inside the milestone whose purpose is removing
  sentinel/fabricated readings.
  **Consequence, not optional:** `playwright.config.ts:24,30` sets `VITE_BRAINS_STUB: 'true'` in
  `webServer.env` specifically so `e2e/brain-swap.spec.ts`'s stub round trip is exercisable. That
  spec and that config entry must be resolved in this phase, not left dangling.

- **D-02:** **One catalogue for both scopes.** Delete the scope-conditional fetch
  (`BrainPicker.tsx:236-266`) and always read
  `sendCommand({type:"swap.catalogue", target:"brain"})` through the existing adapter
  (`BrainPicker.tsx:98-125`). The catalogue is a list of reachable engines — it was never
  scope-dependent; only the dispatch is, and `_handle_swap_catalogue` takes no profile argument.
  This also removes the scope-toggle re-fetch race the generation counter at `:244-264` exists to
  guard, and kills the header badge's now-dead `brainsApi.getCatalogue()` (which returns `[]` on the
  live path, leaving its provider dot permanently neutral). **Rejected:** keeping two sources — a
  per-profile catalogue that legitimately differs (e.g. per-profile credentials making an engine
  unreachable) is speculative today, with no argument on the server to express it.

- **D-03:** **Ástríðr reports `default_profile_id` on an existing live ack.** Retiring the seam kills
  `getDefaultProfileId()`, which both the header badge (`BrainHeaderBadge.tsx:80-93`) and Chat's
  composer pill (`Chat.tsx:566-570`) depend on. The value is **real on the Ástríðr side** —
  `config.profiles[0].id`, documented at `astridr/engine/bootstrap/wiring.py:344-350` as "Ástríðr's
  own resolved chat-channel default profile ... that 103-CONTRACT.md §3 calls `default_profile_id`",
  i.e. what an unattributed `chat.send` actually routes to. Add it to an existing ack (`swap.catalogue`
  or `readiness.get`) so CodePulse reads the authoritative value. **Rejected:** deriving it from
  Convex `profileConfigs` ordering (`BrainHeaderBadge.tsx:93`'s current `profiles[0]?.profileId`
  fallback) — that is a *different* ordering from astridr's config, so the badge could dispatch a
  per-profile swap at a profile the operator never named; and dropping the concept, which would strip
  the per-profile swap affordance from the two most-visible surfaces.
  **Precedent:** Phase 108 already owned small astridr changes from this roadmap.

- **D-04:** **No client-side pre-dispatch validator.** Delete `validateGatewayModelSet`
  (`brainsApi.ts:76-110`) with no replacement. The global axis already dispatches `swap.set` with no
  client validator and that is the shipped, live-verified path. Ástríðr validates fail-closed:
  Pydantic on the union tag (`ws_commands.py:463`), then explicit `profile_id` checks against
  `known_profile_ids()` in `_handle_swap_set` — including a **reject-rather-than-degrade** branch when
  validation is impossible, and a `target='voice'` rejection. **Rejected:** porting it to a
  `validateSwapSet` — this validator *is* the evidence that a client-side mirror of server rules
  drifts silently, having faithfully validated a command the server never accepted for a whole
  milestone.

### Post-swap reconciliation and read precedence (ENGINE-04, ENGINE-03)

- **D-05:** **Per-profile overrides are added to `swap.state`, and the swap confirmation reads back
  the override.** Extend `build_swap_state_payload`
  (`astridr/engine/control_verbs/dispatch.py:95-106`) with the per-profile override map; the
  accessors already exist (`get_profile_override`/`get_profile_override_source`, used at
  `swap_model.py:583`, `:617-620`). **This is what BSC-04 literally does:** the global axis resolves
  `confirming → confirmed` on `modelOverride === confirmTarget` (`GlobalSwapModal.tsx:451-458`) —
  the **override slot** from `swap.state`, not a resolved `model_routing` row. It arrives on the same
  `swap.state` push `_handle_swap_set` already fires after every dispatch, so
  `GLOBAL_SWAP_CONFIRM_TIMEOUT_MS` (4000ms, `GlobalSwapModal.tsx:157`) remains viable.
  **No D-14 risk:** `dispatch.py:78-79` states the payload is in-memory only, never `config/*.yaml`.
  **Rejected:** emitting a `model_routing` row on the successful-set path as the confirm source — the
  row lands only after the ~5s telemetry batch interval (`108-ENGINE-05-EVIDENCE.md:1695`), so the 4s
  timeout would nearly always fire "accepted, unconfirmed", and it asserts a resolution that has not
  happened. **Also rejected:** a CodePulse-only terminal state ("pinned; takes effect next turn") —
  fully honest and zero cross-repo, but a per-profile swap would sit unconfirmed indefinitely for an
  idle profile, so it never matches the BSC-04 contract ENGINE-04 explicitly points at.

- **D-06:** **The per-profile override becomes the TOP rung of `resolveActiveBrain`.** New order,
  mirroring Ástríðr's own chain: **per-profile override → global override → per-profile telemetry row
  → lastTurn (fleet only, D-07) → none**, with a new `source` discriminant. This fixes **two** things
  at once: 103-CONTRACT.md §9's precedence inversion (a pinned profile currently renders the global
  model), and the post-pin staleness window (a just-confirmed pin renders immediately instead of
  showing the stale engine until that profile's next resolution). **Not a D-14 violation** — it is
  Ástríðr's live in-memory override reported over `swap.state`, the same class of value the existing
  `global` rung already reads, not a config read. **Rejected:** fixing precedence only (leaves the
  confirm dialog and the current-engine column disagreeing right after a successful pin) and
  rendering the disagreement explicitly per §9's own framing (most informative, but the widest change
  to a badge that renders on every page — recorded as a deferred idea, not discarded).

- **D-07:** **The `lastTurn` rung serves fleet reads only, never a scoped one.** Keep
  `useLastTurnModel` for the no-`profileId` fleet read — `run.completed.model` is genuine
  server-pushed state — and remove it from the scoped branch (`useResolvedBrain.ts:266-269`). A scoped
  read with no telemetry then returns `source:"none"`, which is ENGINE-03's success criterion 3
  verbatim ("an honest absent/unknown state, not a fabricated current engine").
  **Also required:** correct `useLastTurnModel`'s docstring on disk — it still cites the nonexistent
  "Ástríðr Phase 184.1" that v14.0 scoping proved was never real, and states a premise Phase 108
  falsified. **Rejected:** deleting the rung entirely (defensible — D-03's boot seed emits one row per
  profile at every process start, `bootstrap/core.py:1437`, so the fleet fallback is nearly
  unreachable — but it costs nothing to keep where it is honest) and keeping it as-is (a per-profile
  surface presenting another profile's model as this profile's engine is the exact fabricated-reading
  class ENGINE-03 exists to remove, and it is now avoidable rather than a necessary stopgap).

### Model-id normalization and catalogue metadata (ENGINE-03)

- **D-08:** **One shared comparator, applied at every equality site; stored rows stay byte-faithful.**
  Export the currently-private `stripVendorPrefix` (`brainsApi.ts:239-242`) and add a
  `modelIdsMatch(a, b)`; use it at `BrainHeaderBadge.tsx:96` (provider-dot vendor lookup),
  `deriveMixedState`'s distinct-model `Set` (`useActiveEngine.ts:49`), `BrainPickerRow`'s `isCurrent`
  highlight, and `GlobalSwapModal.tsx:502`'s `snap.find`. The split is real and documented:
  `mode:"inherited"` rows carry provider-prefixed ids (`anthropic/claude-sonnet-5`) because the boot
  seed reads `profile.model_default` from config, while `mode:"pinned"` rows carry bare ids
  (`claude-opus-4-8`) from the catalogue resolver — both visible in
  `108-ENGINE-05-EVIDENCE.md:1670` and `:1688`, and the root cause is already recorded at
  `brainsApi.ts:228-231` ("`modelPreferences.primary` is vendor-prefixed while live `swap.catalogue`
  ids are not"). **The live consequence:** one model in two formats reads as **"Mixed brains"**, and
  the provider dot goes neutral for every `inherited` row. Note `resolveModelDisplayName` already
  tolerates the prefix — **display was never broken; equality is.**
  **Requires a guard:** a test that fails if a raw `===` on a model id reappears at any of these
  sites, since this is a rule that must hold per-site.
  **Rejected:** canonicalizing inside `useActiveEngine` (the hook would stop returning what the
  server actually reported, and `GlobalSwapModal`'s global-axis comparisons sit outside it anyway);
  normalizing at ingest (transforms the stored record of what Ástríðr said, and existing rows still
  need read-side tolerance); and fixing the producer in astridr per D-11's "fix the producer"
  precedent (the split is not a naming slip but two genuinely different sources, and comparisons
  against catalogue ids need tolerance regardless because that format is Ástríðr's to change).

- **D-09:** **Grouping and billing derive from CodePulse's own provider registry.** D-02's single
  catalogue returns only `id`/`name`/`vendor` (`BrainPicker.tsx:98-106`), so
  `normalizeGlobalCatalogueEntry` flattens every entry to `group`/`billing: "api"`,
  `costTier: "normal"` — collapsing the D-07 Subscription/API/Local grouping and disabling the
  cost-tier confirm. Restore genuine grouping by mapping the catalogue's `vendor` onto
  `PROVIDER_BILLING`/`getBillingType` (`src/lib/providers.ts:22-35`), which classify all 7 providers
  as `api` or `subscription` and are the same registry the cost-intelligence pages bill from — real
  data, not invented. **Mandatory honesty clause:** a vendor with no mapping renders in an explicit
  **"Unclassified"** group and must never be silently defaulted to `api`. **Rejected:** accepting the
  flattening (subscription-vs-API blast radius is precisely what an expensive-model confirm protects
  against) and enriching `swap.catalogue` in astridr (correct long-term and would benefit
  `BrainControl` too, but a third cross-repo change here, and cost tier may have no source of truth
  on that side — deferred, not dropped).

### Swap-history readout — TELE-02's surfaced half

- **D-10:** **Hosted on Settings' per-profile engine rows.** `Settings.tsx:249-336` renders one row
  per `profileConfig` with an unambiguous `profileId`, that profile's current engine, and its own
  `BrainPicker` — the only surface in the app that lists every profile with a real id. A collapsible
  history under each row needs no new route and no nav entry. History is audit content, and Settings
  is where audit content lives. **Rejected:** the pre-swap confirm modal (D-15's original argument —
  history at the moment of decision — is still sound, but it is only visible mid-swap, so it cannot
  answer the question without starting one) and inside `BrainPicker`'s popover (reaches all four
  mount sites, but that popover already carries a catalogue list, scope toggle and inline confirm,
  and renders in hosts with very different available heights).
  **This closes the D-15 handoff** that 108-CONTEXT.md left open.

- **D-11:** **Combined history — per-profile rows plus global swaps — via a NEW bounded
  `listGlobal` query.** `listByScope`'s signature stays exactly as it is
  (`convex/controlVerbSwaps.ts:76-87`). Add `listGlobal` reading the same `by_scope` index at
  `scope: null`, capped by `SWAP_HISTORY_CAP`, and merge by `timestamp` client-side with global rows
  visually marked. **Rationale:** under D-04's precedence a global swap genuinely *does* change an
  unpinned profile's engine, so a scoped-only history claims nothing happened when something did —
  the same argument D-13 used in Phase 108 to reject a successes-only history.
  **Rejected:** per-profile only (zero Convex change, but an operator asking "why did this profile's
  engine change?" sees an empty history whenever the cause was a global swap — the common case for an
  unpinned profile) and loosening `listByScope` to `profileId: v.optional(v.string())` (the option
  108-CONTEXT.md's corrected D-15 named — one query, one index, but an existing argument silently
  gains a second meaning and every current caller's contract widens).

- **D-12:** **Global rows are always shown, marked, with a live pinned-state note.** Render every
  global row tagged `global`, and when the profile currently holds its own override, show one note on
  the section: *"this profile is pinned — global swaps below did not change its engine."* The note is
  derived from **live** override state, now available via D-05's extended `swap.state`, not
  reconstructed from history. **Rejected:** showing global rows with no effect claim at all (asserts
  nothing false, but reads as causal history when some entries had no effect here, requiring the
  operator to know D-04's precedence) and filtering by pin state at row time (strictly the most
  accurate causal history, but pin state over time is stored nowhere — the override is in-memory and
  `controlVerbSwaps` has no pin-state field — so it would need reconstruction from scoped
  set/restore rows and would be wrong across any astridr restart, which clears overrides silently).

### Cross-repo scope

**Exactly two Ástríðr changes are in scope**, both on `feature/brain-swap` (the deployed branch):
D-03's `default_profile_id` on an existing ack, and D-05's per-profile overrides in
`build_swap_state_payload`. Everything else is CodePulse. Note REQUIREMENTS.md item 7 (carried
forward from v13.0): `feature/brain-swap` is far behind `main`, and that divergence is a live
consideration for any astridr commit this phase makes.

### Claude's Discretion

- **A live-verification gate for the UI, mirroring ENGINE-05.** Not discussed explicitly, but
  strongly indicated: Phase 108's live gate found **five real defects** that unit tests, a
  three-agent adversarial gate, a code review and the phase verifier had all passed over
  (`108-VERIFICATION.md`, `108-07-SUMMARY.md`). ENGINE-04's central claim is *"server-confirmed rather
  than optimistic"* — a claim a green unit suite structurally cannot prove, and `BRAINS_STUB_ACTIVE`
  has already masked exactly this class of failure from the whole test suite once
  (`103-VALIDATION.md:143`). The planner should schedule an operator-attended live round against the
  running self-hosted stack, and should not mark ENGINE-03/ENGINE-04 satisfied from tests alone.
- **`e2e/brain-swap.spec.ts` and `playwright.config.ts:24,30`** — repoint to real rows, rewrite
  against the live path, or skip with an explicit honest reason. Planner decides; D-01 makes it
  mandatory to decide.
- **Which existing ack carries `default_profile_id`** (`swap.catalogue` vs `readiness.get`) — D-03
  does not pick.
- **The `vendor` → provider-registry key mapping** for D-09 (the catalogue reports e.g. `anthropic`,
  the registry keys are e.g. `anthropic_direct`), and what "Local" means for Ollama.
- **The new `source` discriminant name** for D-06's rung, and whether
  `GLOBAL_SWAP_CONFIRM_TIMEOUT_MS` needs a different value on the per-profile path.
- **Scoped-restore confirmation semantics** — derive from D-05: the readback is the *absence* of that
  profile's override, mirroring how the global axis confirms a revert-clear against `null`.
- **Where the WS sender registration lands** after D-01, and `BrainsWsRegistrar.tsx`'s fate (its
  docstring is written around the stub flag).
- **Truncation on the merged history list** — `SWAP_HISTORY_CAP` applies per query, so D-11's merge
  can reach 2× cap; state truncation on screen per this repo's standing rule (Phase 105 D-11/D-12).
- **Whether `103-CONTRACT.md` §3/§8/§9 get corrected in place** as a deliverable, following Phase
  108's D-08 precedent (it lives under `.planning/milestones/v13.0-phases/`, an archived directory —
  edit there, do not fork a second contract).
- **Whether to also close the pin/restore emit asymmetry in astridr** — benign for the UI after D-06,
  but `activeEngineSnapshots` still holds a stale row for a pinned profile until its next resolution,
  which any future consumer of that table will hit.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The per-profile contract (authoritative)

- `.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md` — **§3** =
  `default_profile_id` (D-03), **§4** = the `model_routing` event shape, **§6** = authorization tier,
  **§8** = the all-profiles axis (why `GlobalSwapModal` could not host a per-profile readout),
  **§9** = rendering the disagreement between the global and per-profile axes (D-06). Phase 108's
  D-08 corrected §1/§2 in place; §3/§8/§9 may need the same treatment.
- `.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTEXT.md` — Phase 103's
  decisions, including the **D-14 boundary** (the UI reads the active engine ONLY from telemetry,
  never a config read) and **D-16** (the stub seam D-01 retires).
- `.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-UI-SPEC.md` — §2 (badge /
  mixed-state contract) and §3 (the two confirm frictions that must never stack, which D-09's
  cost-tier restoration interacts with).
- `.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-VALIDATION.md` — the live
  checkpoint record; **:143** documents `VITE_BRAINS_STUB` masking a real defect from the entire test
  suite, and **:211**/**:241** record the `VITE_BRAINS_STUB=false` live runs.
- `.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-SECURITY.md` — T-103-03
  (stub-vs-live provenance) and the ASVS V5 contract-drift canary D-04 removes.

### Phase 108 — what this phase binds to

- `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-CONTEXT.md` — **D-01/D-02**
  (ContextVar profile plumbing, refuse-to-emit), **D-04** (per-profile override outranks global — the
  precedence D-06 mirrors on the read side), **D-05** (`swap.set` extended, `gateway.model.set`
  rejected), **D-09** (emit-on-change), **D-11** (`selectedModel` → `model`), **D-13/D-14**
  (`control_verb_swap` storage), and the **corrected, falsified D-15** with its explicit Phase-109
  handoff.
- `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-ENGINE-05-EVIDENCE.md` —
  **:1670**/**:1688** the model-id format split in raw rows (D-08), **:1682** "a pin alone only writes
  the override; the emit fires on the next real resolution" (D-05), **:1695** the ~5s telemetry batch
  interval.
- `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-07-SUMMARY.md` §"Carry-Forward
  Items for Phase 109" — the three items this context resolves as D-05/D-08/D-11.
- `.planning/phases/108-per-profile-engine-telemetry-astridr-backend/108-VERIFICATION.md` — the honest
  record of `SwapHistorySection` being wired-but-inert, and why.

### Milestone scope

- `.planning/REQUIREMENTS.md` — ENGINE-03/ENGINE-04 verbatim, TELE-02 with its full reassignment note
  (including the corrected "routed half was DONE" claim), the **Scoping evidence** table (lines
  13-25), and carried-forward item 7 (the `feature/brain-swap` ↔ `main` divergence).
- `.planning/ROADMAP.md` § "Phase 109" — goal, the 3 success criteria, and the TELE-02 inheritance
  note that demands the `listByScope` decision be made before planning (D-11).

### CodePulse — the surfaces being changed

- `src/lib/brainsApi.ts` — the seam D-01 retires: `:76-110` the validator (D-04), `:118-143` the stub,
  `:153-184` the live adapter's two nonexistent commands, `:212-218` the flag, `:239-273`
  `stripVendorPrefix`/`resolveModelDisplayName` (D-08's export source), `:228-231` the recorded root
  cause of the format split.
- `src/hooks/useResolvedBrain.ts` — `:244-290` `resolveActiveBrain`'s rung order (D-06), `:250-254`
  the global-first early return, `:266-269` the scoped `lastTurn` rung (D-07), `:201-242`
  `useLastTurnModel` and its now-false docstring.
- `src/hooks/useActiveEngine.ts` — `:8-19` the D-14 boundary statement, `:40-56` `deriveMixedState`
  and `:49` its distinct-model `Set` (D-08), `:73-105` the map build.
- `src/components/brains/BrainPicker.tsx` — `:98-125` the live-catalogue adapter (D-02's survivor),
  `:203` the default `profile` scope, `:236-266` the scope-conditional fetch D-02 deletes,
  `:310-313` the `gateway.model.set` dispatch, `:452`/`:477` STUB chips.
- `src/components/brains/BrainHeaderBadge.tsx` — `:80-93` `getDefaultProfileId` + the `profiles[0]`
  fallback (D-03), `:95-99` the exact-match vendor lookup (D-08), `:126-127`/`:206` stub gating.
- `src/components/brains/GlobalSwapModal.tsx` — **the BSC-04 pattern to reuse**: `:138-157` the
  5-state outcome union + timeout constant, `:422-426` the bounded fallback, `:448-458` the readback
  confirm (D-05's model), `:484-565` dispatch + revert, `:277-284` `SwapHistorySection`'s honest gate.
- `src/components/brains/BrainPickerRow.tsx` — `isCurrent` (D-08) and the scope-blind `needsCostConfirm`
  predicate (D-09).
- `src/pages/Settings.tsx:249-336` — the per-profile engine rows that host D-10.
- `src/pages/Chat.tsx:119-121, 155-192, 563-570, 697` — the single-persona composer pill and its
  `default_profile_id` dependency (D-03).
- `src/hooks/useControlVerbSwaps.ts` — the built hook, `filterBrainSwaps`, and `describeSwapOutcome`'s
  four-way vocabulary (already decided — do not re-derive).
- `convex/controlVerbSwaps.ts:68-87` — `listByScope`, unchanged by D-11; `convex/controlVerbSwapsFilters.ts`
  — the **only** legal import path for `isBrainSwap`/`SWAP_HISTORY_CAP` from browser code (the WR-02
  bundling defect; a re-export would let it return silently).
- `src/lib/providers.ts:22-35` — `PROVIDER_BILLING`/`getBillingType`, D-09's real data source.
- `playwright.config.ts:24,30` — the `VITE_BRAINS_STUB: 'true'` entry D-01 forces a decision on;
  `e2e/brain-swap.spec.ts` is the dependent spec.

### astridr-repo (branch `feature/brain-swap`) — two changes only

- `astridr/api/ws_commands.py:405-435` — the dispatcher registry: the authoritative list of WS command
  types, containing neither `gateway.model.set` nor `models.catalog`.
- `astridr/api/ws_commands.py` `_handle_swap_set` — the fail-closed `profile_id` validation (D-04's
  reason for no client validator), the `target='voice'` rejection, and the post-dispatch `swap.state`
  push D-05 rides.
- `astridr/api/ws_commands.py:242-256` — `SwapSetCommand` with `profile_id`, the shape D-01 dispatches.
- `astridr/engine/control_verbs/dispatch.py:77-106` — `build_swap_state_payload`, extended by D-05;
  `:78-79` states in-memory-only (the D-14 argument).
- `astridr/engine/control_verbs/swap_model.py:437-495` — `_emit_restore_routing` (the restore-emits /
  set-does-not asymmetry) and `:583`, `:617-620` — the per-profile override accessors D-05 reads.
- `astridr/engine/bootstrap/wiring.py:344-350` — the authoritative `default_profile_id` definition
  (D-03).
- `astridr/engine/bootstrap/core.py:1437` — D-03's boot seed, one `model_routing` per profile per
  process start (the reason D-07's fleet fallback is nearly unreachable).

### Operational rules that constrain this phase

- `CLAUDE.md` § "Self-Hosted Convex — Operational Rules" — the live backend is self-hosted; never bulk
  mutate.
- `CLAUDE.md` § "Design Findings (v15.0 overhaul)" — the `sketch-findings-codepulse` overhaul is held
  for v15.0; do not pull pieces into this phase.
- `CLAUDE.md` § "Ástríðr API Integration" — any new `fetch()` to Ástríðr needs `authHeaders()`.
- Claude memory `convex-topology-all-local` — `npx convex` targets the CLOUD deployment by default;
  live-verification reads must target the local self-hosted instance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`GlobalSwapModal`'s outcome state machine is the ENGINE-04 pattern, already shipped and
  live-verified**: `pending → confirming → confirmed`, with `accepted` as a bounded honest fallback
  and `error` from the ack. D-05 makes the per-profile path reuse it rather than invent a second
  vocabulary.
- **`useResolvedBrain`/`resolveActiveBrain`** is already the single resolver every brain surface
  reads, and it is a pure function with direct unit tests — D-06 is a rung insertion, not a rewrite.
- **`BrainPicker`'s live-catalogue adapter** (`:98-125`) already handles the real `swap.catalogue`
  shape; D-02 makes it the only path instead of deleting it.
- **`useControlVerbSwaps` + `filterBrainSwaps` + `describeSwapOutcome` + `SwapHistorySection`** are
  built, tested, and forward-compatible — D-10 supplies the host they were waiting for.
- **`PROVIDER_BILLING`/`getBillingType`** already classify all 7 providers; D-09 consumes them rather
  than inventing metadata.
- **`stripVendorPrefix`** already exists and is correct — D-08 exports it and adds a comparator beside
  it.
- **`dispatchBounded`** in `GlobalSwapModal` — the hang/rejection-tolerant dispatch wrapper the
  per-profile path should reuse rather than a bare `await sendCommand`.

### Established Patterns

- **Every brain surface reads ONE resolver** so they cannot disagree with each other (`useActiveEngine`
  and `BrainHeaderBadge` docstrings both state this). Any new state D-06 introduces must land in
  `resolveActiveBrain`, never in a component.
- **Hooks coalesce at the query boundary and never return `undefined`** — `useActiveEngine.ts:66-72`
  records why: the header badge renders on every page via `DashboardLayout`, so a throwing or
  undefined `useQuery` unmounts the whole tree and blanks the dashboard (T-103-09).
- **Telemetry write paths are `internalMutation`, never `mutation`** (CR-01). D-11's new query is a
  read; nothing in this phase gains a client-callable write to a telemetry table.
- **Bound every read** with a stated cap, never `.collect()`, and state truncation on screen
  (Phase 105 D-11/D-12).
- **Convex server modules must not be value-imported by browser code** — the WR-02 defect;
  `controlVerbSwapsFilters.ts` exists solely to give `isBrainSwap`/`SWAP_HISTORY_CAP` one safe import
  path. D-11's merge helper must live on the correct side of that line.
- **Absence is rendered as absence, never as a value** — `source:"none"`, `SwapHistorySection`'s
  render-nothing gate, `resolveModelDisplayName` returning the id unchanged rather than prettifying.

### Integration Points

- **CodePulse → Ástríðr (write):** `swap.set` with `profile_id` over the existing WS command path —
  `CommandDispatcher` → `VERB_REGISTRY` → `swap_model.ControlVerb.execute`. No new endpoint.
- **Ástríðr → CodePulse (confirm):** the `swap.state` push, extended by D-05. Same channel the global
  axis confirms on.
- **Ástríðr → CodePulse (display):** `model_routing` → `/runtime-ingest` → `activeEngineSnapshots` →
  `useActiveEngine`. Unchanged; this phase only fixes how the values are compared and ranked.
- **Cross-repo deploy ordering** matters for any live gate: an astridr rebuild
  (`COMPOSE_PROFILES=prod,war-room docker compose up --build -d`) plus a Convex deploy to the
  **self-hosted** instance.

</code_context>

<specifics>
## Specific Ideas

- **"Matching BSC-04" was checked, not assumed.** ENGINE-04's wording points at the global axis's
  contract, and reading it revealed the global axis confirms against the **override slot**, not a
  resolved engine row — which is why D-05 extends `swap.state` rather than chasing a telemetry row.
  The planner should preserve that distinction in the code comments: the *confirmation* reads the
  override; the *current-engine display* reads telemetry. Both are honest; they answer different
  questions.
- **Three of this phase's four problems are inverted or dead premises inherited from Phase 103**, all
  written while the backend did not exist: a validator for a command that was never implemented, a
  fallback rung justified by an emitter bug that is now fixed, and a read-side precedence that
  contradicts the write-side chain. The planner should expect more of this class in the
  `src/components/brains/` docstrings and treat those comments as **claims, not evidence** — several
  already cite the nonexistent "Ástríðr Phase 184.1".
- **D-09's "Unclassified" group is load-bearing, not cosmetic.** Defaulting an unmapped vendor to
  `api`/`normal` would silently suppress the expensive-model confirm for exactly the engines nobody
  has classified yet — the failure mode is quiet and expensive.
- **D-12's note is derived from live state, never reconstructed.** The temptation to infer historical
  pin state from the history rows themselves should be resisted: overrides are in-memory and an
  astridr restart clears them with no row to say so.

</specifics>

<deferred>
## Deferred Ideas

- **Rendering the two-axis disagreement explicitly** (103-CONTRACT.md §9's own framing, e.g.
  "`claude-opus-4-8` (pinned for this profile) · global override: `grok-4.5`") — considered and set
  aside in favour of D-06's simpler rung insertion. The most informative option; revisit if operators
  find the resolved single value hides something they need.
- **Voice swap history as a surfaced feature** — rows are captured by Phase 108's D-14, but Ástríðr
  rejects `profile_id` for `target='voice'` (`_handle_swap_set`), so a voice swap can **never** be
  per-profile and cannot honestly appear in D-10's per-profile row. Needs its own global-scoped
  surface.
- **Enriching `swap.catalogue` with `group`/`billing`/`costTier` in astridr** — rejected by D-09 in
  favour of CodePulse's existing registry. Correct long-term, and would benefit `BrainControl` too.
- **A profile switcher on Chat's composer pill** — Chat is deliberately single-persona
  (`Chat.tsx:119-121`); adding a switcher is a new capability, not a clarification of this phase.
- **Emitting a `model_routing` row on the successful-set path** to close the pin/restore asymmetry —
  rejected as the *confirmation* source by D-05, but still worth doing for `activeEngineSnapshots`
  freshness; listed under Claude's Discretion for the planner to size.
- **Session-mode swaps with a TTL** (103-CONTRACT.md §2's `mode:"session"` and the unused
  `activeEngineSnapshots.expiresAt`) — deferred by Phase 108's D-06, still deferred. Note
  `BrainHeaderBadge.tsx:188-196` already renders a `mode === "session"` branch that nothing can
  currently produce.
- **`brain.fallback` telemetry** (103-CONTRACT.md §5) — a real gap, tied to CLI brains, outside this
  phase's requirements.

</deferred>

---

*Phase: 109-per-agent-engine-ui*
*Context gathered: 2026-08-07*
