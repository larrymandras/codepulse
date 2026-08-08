# Phase 109: Per-Agent Engine UI - Research

**Researched:** 2026-08-08
**Domain:** Cross-repo real-time UI (CodePulse React/Convex) bound to a WS control-verb backend (astridr Python), reading/writing per-profile engine-swap state.
**Confidence:** HIGH — every claim below is either `[VERIFIED: <mechanism>]` (I read the live source at the cited file:line, or ran a live probe and pasted the output) or explicitly tagged `[ASSUMED]`/`[OPEN]` where the codebase does not yet answer it. There are effectively zero external "standard stack" questions in this phase — it is 100% verification of an already-locked, already-decided design against live code, so confidence is driven by how much I could directly read, not by ecosystem research.

## Summary

109-CONTEXT.md and 109-UI-SPEC.md (revision 3) are unusually complete — 12 locked decisions, a fully speced UI contract, and an honest "claims not evidence" framing already applied to Phase 103's inherited docstrings. My job here was almost entirely **verification against live source in both repos**, not new-technology research. I re-read every cited file:line in both repos (codepulse `master`, astridr-repo `feature/brain-swap`) and traced every WS command / Convex query / React hook the phase touches.

**Bottom line: the CONTEXT.md/UI-SPEC.md design is sound and almost entirely confirmed by the live code.** I found four load-bearing corrections the planner needs before writing tasks:

1. **D-11's `scope: null` query will silently return zero rows if implemented literally.** Convex's own docs state `undefined` (not `null`) matches a missing optional field in an index query, and CodePulse's own ingest path (`runtimeIngest.ts`'s `normalizeOptional`) already strips every explicit `null` to `undefined` before a global swap's `scope` field reaches storage — so `listGlobal` must query `q.eq("scope", undefined)`, not `q.eq("scope", null)`.
2. **D-05's cited accessor call sites are wrong.** `get_profile_override`/`get_profile_override_source` are not "used at `swap_model.py:583, :617-620`" (those lines are telemetry-dict construction and the override *setter* calls) — the getters live at `astridr/providers/router.py:805`/`:843` and have **no existing enumerator** for "every profile currently overridden." `build_swap_state_payload` needs a **new** `ModelRouter` method to produce the per-profile map D-05 asks for; none exists today.
3. **D-09's literal instruction ("map the catalogue's vendor onto `PROVIDER_BILLING`") does not do what it says if implemented as a direct key lookup.** The live `swap.catalogue` handler never emits a vendor value that is a `PROVIDER_BILLING` key (`anthropic_direct`/`openrouter`/`ollama`/`claude-cli`/...) — it emits either the literal string `"anthropic"` (pinned Claude tier) or an arbitrary OpenRouter model-vendor slug (`"google"`, `"x-ai"`, `"meta-llama"`, ...). A literal `vendorKey in PROVIDER_BILLING` lookup puts essentially the **entire real catalogue** (300+ entries) into "Unclassified," and the pre-existing "Subscription"/"Local" catalogue groups can **never** be populated from live data at all (no Ollama or CLI-gateway entry is ever returned by `swap.catalogue`). This needs an explicit translation rule, not a direct lookup — full evidence and a proposed rule below (§C.9).
4. **`e2e/brain-swap.spec.ts` cannot be "repointed to real rows."** Every assertion in it (fixed group order `['Subscription','API','Local']`, brand-name rows `"Codex CLI"`/`"Antigravity CLI"`, the `"No brain reported"` string §A retires, and the `gateway.model.set` dispatch mechanism D-01 deletes) depends on stub-only fixture content or soon-to-be-retired copy. It also targets a WS backend (`ws://localhost:8181/ws/telemetry`) that Playwright's `webServer` config never starts — so a live rewrite would not even be exercisable in CI. Recommend deleting it and its `playwright.config.ts:24,30` stub env, replacing its one genuinely load-bearing coverage (mouse/keyboard parity) with a unit test — full reasoning in §B.6.

I also found and verified **two additional model-id raw-`===` equality sites** beyond CONTEXT.md's four named ones (`Chat.tsx:178`, `Settings.tsx:251`, both vendor-dot lookups) and **one more** inside `BrainPicker.tsx:291` (the D-14 success-toast gate) — see §C.8's full defect-class sweep.

**Primary recommendation:** proceed exactly as CONTEXT.md/UI-SPEC.md direct, with the four corrections above folded into the relevant plan tasks, and the D-09 vendor-mapping ambiguity resolved explicitly at plan time (not left to accidental implementation) since it changes whether "Unclassified"/"Subscription"/"Local" are reachable at all from live data.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Per-profile engine resolution (read) | API/Backend (astridr `ModelRouter._resolve_model`) | Frontend (CodePulse `resolveActiveBrain`) | astridr owns the authoritative precedence chain; CodePulse's resolver is a pure mirror of the same order, never an independent computation. |
| Per-profile swap dispatch (write) | API/Backend (astridr `swap_model` control verb via WS) | Frontend (CodePulse dispatch UI) | The WS command is the only mutation path; CodePulse never asserts success client-side (D-14 boundary, unchanged this phase). |
| Swap confirmation/reconciliation | API/Backend (astridr `swap.state` push) | Frontend (CodePulse `GlobalSwapModal`-pattern state machine) | Confirmation is a server-pushed readback, not a client optimistic flip. |
| Catalogue (model list + vendor) | API/Backend (astridr `swap.catalogue` handler, reads OpenRouter + static Claude tier) | Frontend (CodePulse grouping/billing classification) | astridr owns "what models exist"; CodePulse owns "how we group/label them for billing" — this phase's D-09 boundary. |
| Swap-history audit trail | Database/Storage (Convex `controlVerbSwaps` table) | Frontend (CodePulse `Settings.tsx` host) | Already fully routed by Phase 108; this phase only adds a query (`listGlobal`) and a host UI. |
| Billing/cost-tier classification | Frontend (CodePulse `PROVIDER_BILLING` registry) | — | Deliberately NOT astridr's responsibility per D-09 (rejected enriching `swap.catalogue`) — CodePulse's own registry is the source of truth, with the caveat in §C.9 below. |

<user_constraints>
## User Constraints (from CONTEXT.md)

All 12 decisions (D-01 through D-12) in `109-CONTEXT.md` are **LOCKED** — this research verifies *how* to execute them, it does not revisit *whether*. Full text is in `.planning/phases/109-per-agent-engine-ui/109-CONTEXT.md`; do not re-litigate. Key structural constraints the planner must carry forward verbatim:

- **D-01:** Retire the entire `brainsApi.ts`/D-16 stub seam. Per-profile dispatch goes through the same WS sender the global axis uses (`useAstridrWS().sendCommand`, typically via `useCommandDispatch()`), not a new adapter.
- **D-02:** One catalogue (`swap.catalogue`) for both scopes — delete the scope-conditional fetch.
- **D-03:** `default_profile_id` added to an existing live ack — planner picks `swap.catalogue` or `readiness.get` (this research recommends `swap.catalogue`, see §C.1).
- **D-04:** No client-side pre-dispatch validator — delete `validateGatewayModelSet` with no replacement.
- **D-05:** `swap.state`/`build_swap_state_payload` extended with a per-profile override map; the per-profile swap confirmation reads back the override slot, mirroring BSC-04's global-axis pattern exactly.
- **D-06:** Per-profile override becomes the TOP rung of `resolveActiveBrain`, above global override. New `source` discriminant (proposed: `"override"`), renders identically to `source:"profile"` + `mode:"pinned"` — invisible distinction to the operator.
- **D-07:** `lastTurn` rung serves fleet-wide (no-`profileId`) reads only, never a scoped read. Correct `useLastTurnModel`'s stale "Ástríðr Phase 184.1" docstring in the same change.
- **D-08:** Export `stripVendorPrefix`, add `modelIdsMatch(a, b)`, apply at every raw `===` model-id-comparison site (four named + at least two more found this research — see §C.8). Stored rows stay byte-faithful; only comparisons change.
- **D-09:** Grouping/billing derived from CodePulse's own `PROVIDER_BILLING`/`getBillingType` registry, not invented. Mandatory "Unclassified" group/chip for any vendor with no mapping — must never silently default to `api`. See §C.9 for the concrete mapping this research found necessary.
- **D-10:** Swap history hosted on `Settings.tsx`'s existing per-profile engine rows (`:249-336`), via a `Collapsible` disclosure.
- **D-11:** New bounded `listGlobal` Convex query (reads `by_scope` index at the "global" key), merged client-side with `listByScope`'s per-profile rows by `timestamp`. `listByScope`'s signature is UNCHANGED. See §D.10 for the exact query shape correction.
- **D-12:** Global rows always shown, marked `GLOBAL`, with a live-state-derived (never history-reconstructed) pinned note when the profile currently holds its own override.

### Claude's Discretion

- A live-verification gate for the UI, mirroring Phase 108's ENGINE-05 gate — not explicitly discussed but strongly indicated (see `## Validation Architecture` below, mandatory).
- `e2e/brain-swap.spec.ts` + `playwright.config.ts:24,30` — repoint, rewrite, or skip with an honest reason. This research recommends **skip with an honest reason** — see §B.6.
- Which ack carries `default_profile_id` (`swap.catalogue` vs `readiness.get`) — this research recommends `swap.catalogue` — see §C.1.
- The `vendor` → provider-registry mapping for D-09, and what "Local" means for Ollama — see §C.9 (a direct per-vendor-slug lookup does not work; a translation rule is required).
- The `source` discriminant literal name (proposed `"override"`) and whether `GLOBAL_SWAP_CONFIRM_TIMEOUT_MS` needs a different value on the per-profile path.
- Scoped-restore confirmation semantics — derive from D-05: readback is the *absence* of that profile's override.
- Where the WS sender registration lands after D-01, and `BrainsWsRegistrar.tsx`'s fate — this research found it becomes **fully dead code** once `brainsApi.ts` (its only consumer) is deleted — see §B.5.
- Truncation on the merged history list — `SWAP_HISTORY_CAP` applies per query, so D-11's merge can reach 2× cap; state truncation on screen.
- Whether `103-CONTRACT.md` §3/§8/§9 get corrected in place — following Phase 108's D-08 precedent.
- Whether to also close the pin/restore emit asymmetry in astridr (`activeEngineSnapshots` stays stale for a pinned profile until its next resolution) — benign for this phase's UI after D-06, listed as a possible follow-up.

### Deferred Ideas (OUT OF SCOPE)

- Rendering the two-axis (global vs per-profile) disagreement explicitly (103-CONTRACT.md §9's own framing) — set aside in favor of D-06's simpler rung insertion.
- Voice swap history as a surfaced feature — `target='voice'` rejects `profile_id` server-side (verified, `ws_commands.py:1127-1128`), so it can never be per-profile.
- Enriching `swap.catalogue` with `group`/`billing`/`costTier` server-side — rejected by D-09 in favor of CodePulse's own registry (though see §C.9's finding that this rejection has real cost — the registry alone cannot cleanly classify the live catalogue's vendor shape).
- A profile switcher on Chat's composer pill (deliberately single-persona).
- Emitting a `model_routing` row on the successful-set path to close the pin/restore emit asymmetry — worth doing, sized as a follow-up.
- Session-mode swaps with a TTL (103-CONTRACT.md §2 `mode:"session"`, Phase 108 D-06) — still deferred.
- `brain.fallback` telemetry (103-CONTRACT.md §5) — out of scope, tied to CLI brains.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-03 | Operator sees each profile's current engine (picker "This profile" scope, header badge, pre-swap confirm modal's current-engine column) sourced from telemetry, never config. | §B (D-01/D-02 seam retirement) + §C (D-06 precedence fix, D-07 honest-absent, D-08 comparator, D-09 grouping) all directly implement this. Confirmed exact file:line for every read site (BrainHeaderBadge.tsx, BrainPicker.tsx, Chat.tsx, GlobalSwapModal.tsx). |
| ENGINE-04 | Per-profile swap reports honest live status (in-flight → success/failure → server-reconciled), matching BSC-04. | §A.2 (D-05's exact `build_swap_state_payload` extension + the missing enumerator method), §C confirms `GlobalSwapModal`'s outcome state machine (`GlobalOutcome`, `dispatchBounded`) is the pattern to reuse verbatim. `## Validation Architecture` below designs the live gate this requirement needs (a green unit suite cannot prove "server-confirmed"). |
| TELE-02 (surfaced half) | `control_verb_swap` history surfaced as per-profile swap history with a real scope. | §D (D-10 host, D-11 query — including the corrected `scope: undefined` vs `null` finding, D-12 live-derived pinned note). |
</phase_requirements>

## Validation Architecture

### What a green unit suite structurally cannot prove here

ENGINE-04's central claim — "server-confirmed rather than optimistic" — is a claim about **cross-process, cross-language, real-time behavior**: a React client dispatching a real WS command to a real Python process, that process mutating real in-memory router state and pushing a real `swap.state` broadcast back over the same socket, and the client's `useEffect` correctly resolving `pending → confirming → confirmed`. Every one of Phase 108's three live-gate-caught defects (`108-VERIFICATION.md` "Adversarial Findings", `108-07-SUMMARY.md`) was **invisible to unit tests by construction**, because:

- Unit tests on the CodePulse side construct their own mock WS payloads — already in the shape the TypeScript code *expects*. They cannot discover that the Python emitter actually sends `session_id: null` (not `undefined`) or `provider_affinity` as a JSON array (not a string), because the mock never diverges from the assumption being tested.
- Unit tests on the astridr side assert the Python emitter's own output shape in isolation — they never pass that payload through Convex's actual `v.optional(v.string())` validator, which is where `isOptionalString()`'s `null`-rejection bug actually bit.
- Code review reads each side of the boundary separately and reasons about it from memory/documentation, not from the literal bytes crossing the wire.

**The specific defect class a live gate catches here: type-shape mismatches at the Python→JSON→Convex-validator serialization boundary**, and (per the third 108-07 defect, "stale `pinned` row surviving a restore") **state-machine asymmetries that only manifest across two real dispatches in sequence** (set, then restore, then re-read) — not reproducible from a single mocked call.

Phase 109 has this exact boundary risk in three new places: D-03's new `default_profile_id` field on an existing ack, D-05's new per-profile override map on `swap.state`, and D-11's new Convex query reading a field (`scope`) whose absent/null semantics are already proven non-obvious (§D.10 below). All three should be exercised live, not just unit-tested, before ENGINE-03/ENGINE-04/TELE-02 are marked complete — this mirrors 109-CONTEXT.md's own "Claude's Discretion" item calling for an ENGINE-05-pattern gate, and this research confirms with concrete new evidence (the `scope: null` vs `undefined` finding) that the risk is real, not hypothetical.

**Precision correction to 109-CONTEXT.md's own framing:** CONTEXT.md's Discretion section states "Phase 108's live gate found five real defects that unit tests, a three-agent adversarial gate, a code review and the phase verifier had all passed over." The cited source documents do not support "five found by the live gate" — `108-07-SUMMARY.md`'s own frontmatter and `REQUIREMENTS.md`'s ENGINE-05 entry both say the live gate (108-07) found **three** defects (`session_id`-null drop, `providerAffinity` array-vs-string, stale `pinned` row post-restore). The other two (a `status:"failed"` skip gap and a batch-poisoning non-string-id guard) were found and fixed earlier, in 108-03, by that plan's own adversarial-audit/unit-test-level work — i.e. exactly the layer CONTEXT.md's sentence says "passed over" them. Milestone-wide the count is 5; attributed to the live gate specifically, it is 3. This doesn't change the recommendation (a live gate is still necessary and still catches a distinct defect class unit tests can't), but the planner should not cite "five" as the live gate's own catch count. `[VERIFIED: .planning/phases/108.../108-07-SUMMARY.md frontmatter; REQUIREMENTS.md ENGINE-05 entry; .planning/REQUIREMENTS.md ENGINE-01 entry]`

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (unit/component) + Playwright (E2E) |
| Config file | `vitest.config.ts` (implicit via `vite.config.ts`/`package.json`), `playwright.config.ts` |
| Quick run command | `npx vitest run src/components/brains src/hooks/useResolvedBrain.test.tsx src/hooks/useActiveEngine.test.ts src/hooks/useControlVerbSwaps.test.ts convex/controlVerbSwaps.test.ts convex/runtimeIngest.test.ts` |
| Full suite command | `npm test` (Vitest) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-03 | `resolveActiveBrain` inserts `override` above `global`, below nothing | unit | `npx vitest run src/hooks/useResolvedBrain.test.tsx` | ✅ (extend existing) |
| ENGINE-03 | `modelIdsMatch` fixes mixed-state/vendor-dot false positives at every site | unit | `npx vitest run src/hooks/useActiveEngine.test.ts src/components/brains/BrainHeaderBadge.test.tsx` | ✅ (extend existing; `BrainHeaderBadge.test.tsx` — confirm exists, see note) |
| ENGINE-03 | Scope-aware cost-confirm gate agrees for mouse AND keyboard paths, every (scope, costTier) combo | unit | `npx vitest run src/components/brains/BrainPicker.test.tsx src/components/brains/BrainPickerRow.test.tsx` | ✅ (extend existing; UI-SPEC §F explicitly calls for this new parity test) |
| ENGINE-04 | Per-profile dispatch reuses `GlobalSwapModal`'s outcome vocabulary (pending/confirming/confirmed/accepted/error) | unit | new test file, e.g. `src/hooks/useProfileSwap.test.ts` (name TBD by planner) | ❌ Wave 0 |
| ENGINE-04 | Server-confirmed (not optimistic) swap against the REAL running stack | manual / live gate | operator-attended, see below | N/A — cannot be automated per this requirement's own definition |
| TELE-02 | `listGlobal` returns rows with `scope` absent, merges correctly with `listByScope` | unit | `npx vitest run convex/controlVerbSwaps.test.ts` | ✅ (extend existing) |
| TELE-02 | Settings collapsible section renders history/empty/truncation/pinned-note states | component | `npx vitest run src/pages/Settings.test.tsx` | ❔ confirm exists — not directly checked this session; grep before Wave 0 |

### Sampling Rate

- **Per task commit:** the quick-run command above (scoped to touched files).
- **Per wave merge:** `npm test` (full Vitest suite).
- **Phase gate:** full suite green AND the live-stack gate below completed with an operator sign-off, before `/gsd:verify-work`.

### The operator-attended live gate (mirrors Phase 108's ENGINE-05 pattern)

Given the boundary-defect class the live gate uniquely catches (above), the planner should schedule a Phase-108-style `autonomous: false` gate plan as the LAST wave, covering at minimum:

1. **D-03 live probe:** dispatch the chosen ack command (`swap.catalogue` recommended) against the running astridr-agent and confirm `default_profile_id` arrives as a real profile id, not `undefined`/empty — read back in the browser console or via a raw WS client, not inferred from code.
2. **D-05 live probe:** dispatch a scoped `swap.set`, then read `swap.state` and confirm the per-profile override map contains the pinned profile with the correct model — then dispatch a scoped restore and confirm the SAME profile is ABSENT from the map (not present with a `null` value — this is the same absent-vs-null distinction found in §D.10, and it is exactly the kind of shape assumption a live probe, not a unit test, should pin down).
3. **D-06 live probe:** with a profile pinned via a scoped `swap.set`, and a DIFFERENT global override active, confirm the picker/badge/Settings row render the PINNED model (not the global one) — this is the precedence-inversion bug ENGINE-03 exists to fix, and it needs two real overrides active simultaneously to exercise, which no single mocked test naturally constructs.
4. **D-11 live probe:** confirm `listGlobal` actually returns rows once a real unscoped swap has been dispatched (i.e. the `scope: undefined` query genuinely matches — this is the corrected finding from §D.10 and is the single highest-risk item in this phase to leave unverified live).
5. **Environment reachability** (see below) confirmed BEFORE the gate starts, exactly as Phase 108's plan did.

### Wave 0 Gaps

- [ ] `src/hooks/useProfileSwap.test.ts` (or wherever the planner lands the per-profile dispatch/outcome-state hook) — no test file exists yet because the hook itself doesn't exist yet; this is Wave-0-shaped work, build the hook's test alongside it, TDD-style, not after.
- [ ] Confirm `src/pages/Settings.test.tsx` exists and what it currently covers, before assuming D-10's collapsible history section slots into existing test infrastructure — not verified this session (time-boxed out); planner should grep this first thing in Wave 0.
- [ ] Framework install: none — Vitest/Playwright/Testing Library already fully wired.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Self-hosted Convex backend | Every Convex query/mutation this phase touches, and the live gate | ✓ `[VERIFIED: curl http://127.0.0.1:3210/version → HTTP 200]` | running in `convex-backend` container, up 6h at research time | — |
| astridr-agent (feature/brain-swap) | D-03/D-05 WS commands, the live gate | ✓ `[VERIFIED: curl http://127.0.0.1:8181/health → HTTP 200; docker ps shows astridr-agent healthy, port 8181 published]` | container up 16h at research time — **not yet rebuilt with this phase's D-03/D-05 changes, since they don't exist yet; must rebuild before the live gate, per CLAUDE.md's `docker compose up --build -d` rule** | — |
| `war-room` compose profile (5 workers) | Not required by this phase directly, but confirms the profile is currently up if any other work shares the stack | ✓ `[VERIFIED: docker ps shows astridr-war-room-{freya,gondul,ragnhildr,hervor,astridr} all healthy]` | — | — |
| `astridr-cli-gateway` | Not required by this phase | ✓ up 14 min at research time (recently restarted per git log's OAuth-expiry incident) | — | — |
| Playwright's `webServer` reaching a live astridr WS at `ws://localhost:8181/ws/telemetry` | A hypothetical live-rewritten `e2e/brain-swap.spec.ts` | ✗ `[VERIFIED: playwright.config.ts's webServer only runs \`npm run dev\` — no astridr backend is started or guaranteed by the E2E harness itself]` | — | Manual/local-only E2E is possible when a developer already has the stack running, but CI cannot rely on it — supports the recommendation to skip rather than rewrite (§B.6). |

**Missing dependencies with no fallback:** none — everything this phase needs is already running.

**Missing dependencies with fallback:** the E2E-reaches-live-backend gap above; fallback is the operator-attended live gate (which is already the plan) instead of automated E2E.

## Security Domain

This phase adds no new authentication, session, or cryptography surface. Relevant ASVS categories:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | Yes (unchanged) | `_handle_swap_set`'s fail-closed `profile_id` validation against `known_profile_ids()` (`ws_commands.py:1129-1138`, verified live) — D-04 explicitly relies on this and adds no client mirror. |
| V5 Input Validation | Yes (unchanged) | Same fail-closed server validation; D-04 deletes the client-side validator specifically because it drifted from server truth for a whole milestone (103-SECURITY.md T-103-03 precedent). |
| V6 Cryptography | No | No new secrets/crypto this phase. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A build-time flag (`VITE_BRAINS_STUB`) deciding whether the operator sees real or fabricated data | Spoofing/Tampering (103-SECURITY.md T-103-03) | D-01 removes the flag entirely — no replacement, per this phase's own honesty mandate. |
| A devtools-forgeable Convex mutation writing a fabricated "server-confirmed" swap-history row | Tampering | Already closed — `controlVerbSwaps.record` is `internalMutation`, unreachable from `api.*` (verified, `convex/controlVerbSwaps.ts:46`). D-11's new `listGlobal` is a `query`, adds no new write surface. |

## A. Cross-repo (astridr, `feature/brain-swap`) — the two in-scope changes

### A.1 — D-03: which existing ack should carry `default_profile_id`

**Recommendation: `swap.catalogue`, not `readiness.get`.**

Evidence:
- `_handle_readiness_get` (`astridr/api/ws_commands.py:1079-1087`) returns exactly `{"ready": is_ready()}` — no profile concept at all, and is semantically about backend bootstrap completion, unrelated to profiles. `[VERIFIED: read live]`
- `_handle_swap_catalogue` (`ws_commands.py:1167-1240`) returns `{"target": ..., "entries": [...]}` — already the SINGLE catalogue fetch D-02 mandates every consumer make. `[VERIFIED: read live]`
- **Call-frequency evidence, decisive:** `readiness.get` is currently called ONLY from `ControlCenterPanel.tsx`'s warm-up-pill poll (`:108-134`), and that poll **stops permanently once `ready===true`** (`if (ack.status === "ok" && ack.ready === true) { setReady(true); return; }` — no further `setTimeout`, `[VERIFIED: read live]`). In steady state (backend already warmed up, which is true almost all the time), no component ever calls `readiness.get` again. `BrainHeaderBadge` and `BrainComposerPill`, which both need `default_profile_id`, would each need to add a **brand-new** WS round trip they don't otherwise make.
- By contrast, both consumers already need to fetch the catalogue (for vendor-dot lookups and the picker itself) — post-D-02 that's a direct `swap.catalogue` call. Piggybacking `default_profile_id` onto it costs **zero additional round trips**.
- `BrainHeaderBadge` is mounted once, globally, in `DashboardLayout` — its catalogue-fetch `useEffect` runs once per app session (not per page nav), so re-parsing a stable `default_profile_id` field on each of its own (infrequent) catalogue refetches is harmless.

**Concrete shape:** add `"default_profile_id": <str>` to `_handle_swap_catalogue`'s return dict (`ws_commands.py:1240`), sourced the same way `_setup_ws_telemetry`'s `default_profile_id` parameter is (`config.profiles[0].id if config.profiles else "personal"` — see the Line-Number Drift note on this exact computation below). The handler doesn't currently have a way to reach `config` — check whether `self._config` or an equivalent is already available on the class that owns `_handle_swap_catalogue`, or whether it needs to be threaded in at construction (same pattern D-05's enumerator gap needs, see A.2).

### A.2 — D-05: exact `build_swap_state_payload` extension

**Current payload shape** (`astridr/engine/control_verbs/dispatch.py:77-101`, `[VERIFIED: read live]`):
```python
def build_swap_state_payload(router: Any | None) -> dict[str, Any]:
    ...
    return {
        "model_override": model_override,       # str | None — GLOBAL only
        "model_source": model_source,             # str | None
        "voice_override_id": get_active_voice_override(ASTRIDR_PERSONA_ID),
        "voice_override_name": get_active_voice_name(ASTRIDR_PERSONA_ID),
    }
```
`:78-79`'s docstring does confirm "in-memory ONLY, never config/*.yaml" — CONTEXT.md's D-14-safety claim holds. `[VERIFIED]`

**Accessor signatures** (`astridr/providers/router.py`, `[VERIFIED: read live]`):
```python
def get_global_override(self) -> str | None: ...              # :774
def get_global_override_source(self) -> str | None: ...        # :778
def get_profile_override(self, profile_id: str) -> str | None: ...          # :805
def get_profile_override_source(self, profile_id: str) -> str | None: ...   # :843
```

**CORRECTION to CONTEXT.md's citation:** D-05 says these accessors are "used at `swap_model.py:583`, `:617-620`" — that is wrong. Line 583 is `"verb": "swap_model",` inside a telemetry dict literal; lines 617-628 are the **setter** calls (`_router.set_profile_override(...)` / `_router.set_global_override(...)`), not the getters. The getters are called from `_resolve_model` (`router.py:592-594` for profile, `:601-602` for global) — the READ side, not the swap-execution side. This doesn't change D-05's intent, but the planner should not go looking for getter usage at the cited lines. `[VERIFIED: read live]`

**The real gap D-05 needs closed, not mentioned in CONTEXT.md:** `ModelRouter` has **no method that enumerates every profile currently holding an override** — only `get_profile_override(profile_id)`, a single-profile lookup. `[VERIFIED: grep for `_profile_model_overrides`/`_profile_override_sources` across `router.py` — only per-id `.get()`/`.pop()` accessors exist, no `.items()`/enumerator exposed publicly]`. `build_swap_state_payload(router)` takes no profile argument and its result is broadcast (pushed to every connected client via `send_live`), so "the per-profile override map" D-05 literally asks for must be **every** profile's override, not just one. This requires a new `ModelRouter` method, e.g.:
```python
def get_all_profile_overrides(self) -> dict[str, str]:
    """Snapshot of every profile currently holding a model override."""
    return dict(self._profile_model_overrides)

def get_all_profile_override_sources(self) -> dict[str, str | None]:
    return dict(self._profile_override_sources)
```
and `build_swap_state_payload` adds something like:
```python
"profile_overrides": {
    pid: {"model": model, "source": router.get_profile_override_source(pid)}
    for pid, model in router.get_all_profile_overrides().items()
} if router is not None else {}
```
This is a genuinely new method, not an existing accessor CodePulse can already reach — flag it explicitly as a task, not assume it's a one-line payload edit.

**Push-fires-on-both-paths, confirmed:** `_handle_swap_set` (`ws_commands.py:1089-1165`) pushes `swap.state` unconditionally after `result = await verb.execute(args, ctx)` (`:1156-1159`, wrapped in a try/except that only logs a warning on push failure) — this runs whether the swap succeeded OR the verb declined (`handled=False`, e.g. an affinity-guard refusal), because nothing branches on `result.handled` before the push. It does NOT fire if the earlier fail-closed `profile_id` validation raises (`:1121-1138`, before the push code) — those cases produce an error ack with no state push, which is the correct UX (CodePulse shows the error immediately, no confirm-wait needed). `[VERIFIED: read live]`

**Restore-vs-set asymmetry, confirmed exactly as CONTEXT.md states:** a scoped SET only writes the override + emits `control_verb_swap` (audit log) — it does NOT emit a `model_routing` row, so `activeEngineSnapshots` (what `useActiveEngine`/telemetry reads) stays stale until the profile's next real turn. A scoped RESTORE calls `_emit_restore_routing` (`swap_model.py:437-511`, confirmed) which DOES emit a `model_routing` row immediately via `_emit_profile_model_routing_seed`, specifically because "the newly-inherited resolution is a KNOWN state, not an absence." `[VERIFIED: read live, function docstring + body]`. This asymmetry is why D-05 correctly reads the **override slot** (`swap.state`) for confirmation, not a telemetry row — the telemetry row for a SET never arrives in time (or at all, for an idle profile).

**D-05's restore-confirm semantics (Claude's Discretion item):** confirmed the read-back is exactly "the absence of that profile's override" — `get_all_profile_overrides()`'s dict simply won't contain the restored profile's id anymore. Mirrors the global axis's existing `modelOverride === confirmTarget` check where `confirmTarget` is `null` after a global restore (`GlobalSwapModal.tsx:537`, `setConfirmTarget(prior)` where `prior` can be `null`).

### A.3 — `feature/brain-swap` branch state (REQUIREMENTS.md item 7)

**REQUIREMENTS.md's framing is stale.** It states "`feature/brain-swap` → `main` is 322 commits behind." Current live measurement, run this session:

```
$ git merge-base main feature/brain-swap
67118e86  (fix(deps): resolve 29 Dependabot alerts...)
$ git log --oneline main..feature/brain-swap | wc -l
432   # commits ONLY on feature/brain-swap since divergence
$ git log --oneline feature/brain-swap..main | wc -l
10    # commits ONLY on main since divergence
```
`feature/brain-swap` is now **10 commits behind main**, not 322 — and 432 commits ahead of the shared base (its own accumulated history, including all of Phases 185/186/108). `feature/brain-swap`'s HEAD (`93df0e58`, dated 2026-08-08) is newer than `main`'s HEAD (`5e4e257d`, dated 2026-08-06). `[VERIFIED: git log/git merge-base output above]` — **the "322 behind" figure predates significant work on this branch and should not be relayed to the planner as current.**

**The specific concrete concern in that carried-forward item IS still live and confirmed real**, independent of the stale commit count: `main`'s `5e4e257d fix(cors): drop the decommissioned-host default for CODEPULSE_ORIGIN` has NOT been merged into `feature/brain-swap`. On `feature/brain-swap`, `astridr/channels/web.py:973` still reads:
```python
prod_origin = os.environ.get("CODEPULSE_ORIGIN", "https://tidy-whale-981.convex.site")
```
`[VERIFIED: grep on feature/brain-swap, live]` — `tidy-whale-981.convex.site` is the retired/frozen cloud Convex deployment (per this repo's own `convex-topology-all-local` memory and `CLAUDE.md`'s self-hosted rules). This is a dormant default (only matters if `CODEPULSE_ORIGIN` is unset in the deployed container's env, which it may or may not be) but is a real, unmerged fix on the exact branch this phase's astridr changes land on. **Recommend flagging to the operator, not silently fixing** — it's outside this phase's explicit 2-change scope (D-03/D-05 only), but worth a one-line note in the plan since the next astridr commit on this branch is imminent.

Do NOT change the branch or merge anything — this is a reporting-only finding per the read-only constraint.

## B. CodePulse seam retirement (D-01, D-02, D-04)

### B.4 — Complete inventory of D-01's stub-retirement touch points

Verified via bare-symbol grep first (per the defect-class discipline), then narrowed. Full hit list:

| Symbol | File:line | Confirmed live |
|---|---|---|
| `stubBrainsAdapter` | `src/lib/brainsApi.ts:143` (definition), consumed only via `brainsApi` export (`:218`) | ✓ |
| `createStubBrainsAdapter` | `src/lib/brainsApi.ts:118-141` (definition) | ✓ |
| `brainsFixtures.ts` | `src/lib/brainsFixtures.ts` (whole file — `STUB_CATALOGUE`, `STUB_PROFILE_ENGINES`, `STUB_DEFAULT_PROFILE_ID`, `makeStubFailureSet`), imported only by `brainsApi.ts:19` | ✓ |
| `BRAINS_STUB_ACTIVE` | Defined `brainsApi.ts:216`. Consumers: `BrainHeaderBadge.tsx:44,126,206`; `BrainPicker.tsx` (imported `:90`, used in chips at `:452`,`:477`); `Chat.tsx` (STUB chip `:244`); `Settings.tsx` (STUB chip `:315`) | ✓ — matches CONTEXT.md's list exactly |
| `VITE_BRAINS_STUB` | Read once, `brainsApi.ts:212`. Also set in `playwright.config.ts:30` (webServer env) | ✓ |
| 4 STUB chips | `BrainHeaderBadge.tsx:206-213`, `BrainPicker.tsx:452-459` (trigger chip) and `:477-482` (popover banner — note this is a 5th render site if counted separately from the trigger chip; UI-SPEC §E already lists it as its own bullet), `Chat.tsx:244-251`, `Settings.tsx:315-322` | ✓ — 5 physical render sites (UI-SPEC §E counts them this way), "four chips" in CONTEXT.md's prose is describing 4 *component families*, not 4 lines |
| `validateGatewayModelSet` | `brainsApi.ts:76-110` (definition), called from `createStubBrainsAdapter.dispatchSwap` (`:125`) and `createLiveBrainsAdapter.dispatchSwap` (`:166`) — no other call sites | ✓ |
| `getCatalogue` (adapter method) | Interface `brainsApi.ts:64`; consumers: `BrainPicker.tsx:260` (per-profile branch, deleted by D-02), `BrainHeaderBadge.tsx:73`, `Chat.tsx:165` | ✓ |
| `getDefaultProfileId` | Interface `brainsApi.ts:66`; consumers: `BrainHeaderBadge.tsx:81`, `Chat.tsx:570` | ✓ |
| `BrainsWsRegistrar.tsx` | Whole file — mounted once in `App.tsx:109` inside the WS provider tree | ✓ — becomes fully dead once `brainsApi.ts` (its only reason to exist, per its own docstring) is deleted; see §B.5 |

**Test/config files also touching this seam** (not in CONTEXT.md's list, found via the broader sweep):
- `src/components/brains/BrainsWsRegistrar.test.tsx` — tests the registration effect; delete alongside the component.
- `e2e/brain-swap.spec.ts` + `playwright.config.ts:24,30` — see §B.6.
- Any `*.test.tsx`/`*.test.ts` importing `stubBrainsAdapter`/`createStubBrainsAdapter`/`STUB_CATALOGUE`/`BRAINS_STUB_ACTIVE` directly (not individually enumerated here — planner should re-run the bare-symbol grep at task time, since test files churn between research and execution).

**No hits found** for `gateway.model.set`/`models.catalog` anywhere in `astridr/` (`[VERIFIED: grep -rn` for both literal strings across `astridr/`, zero matches, confirming CONTEXT.md's claim]) — confirming these commands are genuinely dead on arrival server-side, not just undocumented.

### B.5 — The WS sender chain, and `BrainsWsRegistrar`'s fate

Traced the full chain, three distinct existing call patterns:

1. **`GlobalSwapModal.tsx`** (the BSC-04 pattern to reuse): `const { dispatch } = useCommandDispatch()` (`:343`) → `dispatch` wraps `useAstridrWS().sendCommand` with toast side-effects (`src/hooks/useCommandDispatch.ts:12-33`) → wrapped again in a local `dispatchBounded` closure (`GlobalSwapModal.tsx:354-380`) that races the dispatch against `GLOBAL_SWAP_DISPATCH_TIMEOUT_MS` (15s) so a queued-forever command can't hang the dialog. The actual `swap.set` command object is built at `GlobalSwapModal.tsx:511-516` — `{type:"swap.set", target:"brain", value: target.id, restore:false}` — confirming CONTEXT.md's `:512` citation exactly.
2. **`BrainControl.tsx`**: calls `useAstridrWS().sendCommand` directly (`:140`, `:177-182`) — no `useCommandDispatch`, no bounded timeout, no toast. Simpler, unbounded pattern.
3. **`BrainsWsRegistrar.tsx`**: bridges `useAstridrWS().sendCommand` into `brainsApi.ts`'s module-scope `liveSendCommand` singleton via `registerBrainsWsSender`, solely so `createLiveBrainsAdapter`'s closures (which have no React context, per their own docstring) can reach the socket.

**Once `brainsApi.ts` is deleted (D-01), pattern 3 has no consumer left — `registerBrainsWsSender` and `liveSendCommand` cease to exist, and `BrainsWsRegistrar` has nothing to register.** The per-profile dispatch path (`BrainPicker.tsx`'s `handleProfileDispatch`, currently building the dead `gateway.model.set` shape at `:310-317`) should be rewritten to call `useCommandDispatch()`/`dispatch` the same way `GlobalSwapModal` does — reusing pattern 1 (bounded, matches the outcome state machine D-05 asks the per-profile path to reuse), not pattern 2's simpler unbounded form. **Recommendation: delete `BrainsWsRegistrar.tsx` and `BrainsWsRegistrar.test.tsx` entirely, and remove its mount from `App.tsx:109`** (with the adjacent comment at `:108` that references it).

### B.6 — `e2e/brain-swap.spec.ts` + `playwright.config.ts:24,30`

**Recommendation: skip with a documented reason; do not attempt to repoint or rewrite.** Evidence, read the full spec and config live:

- `playwright.config.ts:24,30` — confirmed exact citation: `webServer.env.VITE_BRAINS_STUB: 'true'` (line 30), with the comment at line 24 explaining why. `[VERIFIED]`
- The spec asserts (in order): a fixed cmdk group-heading order `['Subscription', 'API', 'Local']` (`:84-85`); specific stub-fixture brand names `"Codex CLI"`/`"Antigravity CLI"` (`:110-112`, `:186-187`); the STUB banner text `"Running on stub brain data"` as its own honesty gate (`:72-81`); and the badge label `"No brain reported"` (`:123`, `:197`).
- **Every one of these is invalidated by this phase's own changes**, independent of the stub-retirement question alone: (1) the group order can never be `['Subscription','API','Local']` from live data — per §C.9's finding, the real catalogue can only ever populate "API" (plus, post-D-09, possibly "Unclassified") because `swap.catalogue` never returns an Ollama or CLI-gateway entry; (2) `"Codex CLI"`/`"Antigravity CLI"` are stub-fixture-only names that don't exist in the live OpenRouter/Claude-tier catalogue; (3) `"No brain reported"` is the exact string UI-SPEC §A retires in favor of `"Not reported"`, unconditionally, regardless of the stub decision.
- **The dispatch mechanism itself is dead:** the spec's round trip clicks a row, which today calls `handleProfileDispatch` → `brainsApi.dispatchSwap({type:"gateway.model.set", ...})` (`BrainPicker.tsx:310-317`) — D-01 deletes this whole path.
- **A live rewrite is not viable in this harness:** `AstridrWSContext` connects to `ws://localhost:8181/ws/telemetry` by default (`src/contexts/AstridrWSContext.tsx:230-231`, `[VERIFIED]`). `playwright.config.ts`'s `webServer` only runs `npm run dev` (Vite dev server) — it starts and guarantees nothing on port 8181. In CI (`reuseExistingServer: !process.env.CI` → always `false` in CI, so Playwright always spins up a fresh dev server there), there is no live astridr backend reachable, so any live-path assertion would hang/time out or need to be conditionally skipped exactly the way the CURRENT stub-absent guard already does — except now for the opposite reason.
- The spec's one genuinely valuable, NOT stub-dependent piece of coverage is the **keyboard-vs-mouse parity** regression it was built to catch (103-11/CR-02's finding that cmdk's `CommandItem`s never wired `onSelect`). That coverage need is **already being replaced** by UI-SPEC §F's explicitly-recommended new unit test (mouse-path and keyboard-path outcomes must agree for every `(scope, costTier)` combination) — which is a stronger, more targeted test for that exact regression class than an E2E round trip, and doesn't depend on a live backend at all.

**Recommended action:** delete `e2e/brain-swap.spec.ts`, delete the `VITE_BRAINS_STUB: 'true'` `webServer.env` block in `playwright.config.ts` (lines 29-31, and the explanatory comment at 24-28), and ensure the mouse/keyboard-parity unit test (already required by D-09/UI-SPEC §F) explicitly documents in its own comment that it supersedes this spec's original regression-guard purpose — so a future reader doesn't wonder why E2E coverage for brain-swap disappeared.

## C. Read-path correctness (D-06, D-07, D-08, D-09)

### C.7 — `resolveActiveBrain`'s exact current rung order and consumers

Verbatim (`src/hooks/useResolvedBrain.ts:244-290`, `[VERIFIED]`):
```ts
export interface ResolvedBrain {
  source: "global" | "profile" | "mixed" | "lastTurn" | "none";  // :40
  model: string | null;
  mode?: NonNullable<ActiveEngineMap[string]>["mode"];
  expiresAt?: number;
  distinctModels: string[];
}

export function resolveActiveBrain(args): ResolvedBrain {
  if (globalOverride) return { source: "global", ... };          // :252-254

  if (profileId !== undefined) {
    const engine = activeEngines[profileId];
    if (engine) return { source: "profile", ... };                // :258-266
    if (lastTurnModel) return { source: "lastTurn", ... };         // :267-269
    return { source: "none", ... };                                // :270
  }

  const mixedState = deriveMixedState(activeEngines);
  if (mixedState.mixed) return { source: "mixed", ... };
  if (mixedState.single) return { source: "profile", ... };
  if (lastTurnModel) return { source: "lastTurn", ... };
  return { source: "none", ... };
}
```
D-06 inserts the profile-override rung between the function's top and the current `if (globalOverride)` check.

**Every consumer of `.source` that a new `"override"` value must be handled by** (full sweep, `[VERIFIED: grep for `.source ===` and `useResolvedBrain(` across `src/`]`):

| File | Lines | What breaks if `"override"` isn't handled |
|---|---|---|
| `BrainHeaderBadge.tsx` | `:105-107` (`isMixed`/`isGlobal`/`isProfile`), `:114` (absent-state ternary), `:126-127` (`isConfirmedLive`) | A pinned profile via the new rung would fall through to neither `isGlobal` nor `isProfile` — render as if unreported, contradicting SC1. Must extend `isProfile` per UI-SPEC §B. |
| `Chat.tsx` (`BrainComposerPill`) | `:140` (`pillTitle`'s type union — will fail to typecheck without adding `"override"`), `:180` (`isGlobal`), `:185` (absent-state), `:227`,`:236` (`mode==="session"`/`"pinned"` chips) | Same class of gap — the pin chip/session chip logic keys off `source==="profile"` only. |
| `LlmStatusPanel.tsx` | `:76-80` — **NOT named in CONTEXT.md or UI-SPEC, found this research.** `const brainLabel = resolved.source === "none" ? "Auto" : resolved.model ?? "Auto"` | Low risk — this only branches on `"none"` vs everything-else and reads `.model` directly, so `"override"` flows through correctly with NO code change needed. Flagging so the planner doesn't miss it during the `.source` sweep, but no fix required here. Also note: this site still renders literal `"Auto"` for the none-case, which §A's canonical-string rule (`"Not reported"`) arguably should also reach — not named in UI-SPEC §A's four-surface list; **flagged as an open question below**, not assumed in scope. |
| `useResolvedBrain.test.tsx`, `LlmStatusPanel.test.tsx` | Test fixtures literally construct `{ source: "global", ... }` etc. | Add fixtures/assertions for `"override"`. |

### C.8 — D-08 defect-class sweep: every model-id raw-`===` equality site

Per the instruction to grep the pattern, not the four literals, I ran a repo-wide sweep for `.id ===`, `.model ===`, and `find((e) => e.id === ...)`-shaped comparisons, then manually filtered out unrelated domains (graph node ids, task ids, avatar ids, etc.). Confirmed sites, beyond CONTEXT.md's four:

| Site | Code | In CONTEXT.md's list? |
|---|---|---|
| `BrainHeaderBadge.tsx:96` | `catalogue?.find((e) => e.id === modelId)?.vendor` | ✓ named |
| `useActiveEngine.ts:49` | `Array.from(new Set(reported.map((e) => e.model)))` (Set membership, not `===` directly, but the same raw-equality class) | ✓ named |
| `BrainPicker.tsx:560-561` | `isCurrent` prop: `globalOverrideModel === entry.id` / `activeEngine?.model === entry.id` | ✓ named ("BrainPickerRow's isCurrent") — confirmed the actual comparison lives in `BrainPicker.tsx`, passed down as a prop |
| `GlobalSwapModal.tsx:502` | `snap.find((s) => s.model === modelOverride)` | ✓ named |
| **`Chat.tsx:178`** | `catalogue?.find((e) => e.id === resolved.model)?.vendor` — the composer pill's own vendor-dot lookup | ✗ **NOT named — found this research** |
| **`Settings.tsx:251`** | `engineCatalogue?.find((entry) => entry.id === engine?.model)?.vendor` — the per-profile row's vendor-dot lookup | ✗ **NOT named — found this research** |
| **`BrainPicker.tsx:291`** | `if (activeEngine?.model === pendingTarget.id)` — gates the D-14 "genuinely landed" success toast | ✗ **NOT named — found this research; arguably the highest-impact miss, since a format mismatch here means the success toast silently never fires for an `inherited`-mode profile whose confirmed engine comes back in the OTHER id format** |

**Recommendation:** the planner's D-08 task list should explicitly include `Chat.tsx:178`, `Settings.tsx:251`, and `BrainPicker.tsx:291` alongside the four CONTEXT.md names — all six are the same defect class (raw `===`/Set-membership on a value that can arrive in either vendor-prefixed or bare format) and D-08's own "requires a guard" language ("a rule that must hold per-site") implies completeness, not a fixed enumerated list.

**On the "guard test" itself:** this repo has **no existing ESLint custom-rule or static source-scanning test infrastructure** `[VERIFIED: no `.eslintrc*`/`eslint.config.*` at repo root; grep for `readFileSync`-based source-scanning test patterns in `src/` returned only unrelated cost-panel test files]`. The idiomatic fit for this codebase, matching its established pattern of exporting pure predicates for direct testability (`needsCostConfirm`, `isBrainSwap`, `quotaLevel` are all this shape) and its documented aversion to "comment trips its own grep" static-text assertions (5+ prior incidents per this project's LESSONS), is a **behavioral** test per site: feed two ids that differ only by vendor-prefix format (e.g. `"anthropic/claude-sonnet-5"` vs `"claude-sonnet-5"`) through each of the six consumers and assert they are treated as equal (no "Mixed brains", no neutral vendor dot, no double `isCurrent` miss, toast DOES fire). This is stronger than a literal-text scan — it catches the defect even if a future refactor changes variable names — and fits `BrainPicker.test.tsx:989`'s own existing precedent comment about the `isCurrent` fix.

### C.9 — D-09: actual `vendor` values vs `PROVIDER_BILLING` keys — the mapping problem

**This is the highest-value correction in this research.** D-09's text describes the mapping as roughly 1:1 ("catalogue reports e.g. `anthropic`, registry keys are e.g. `anthropic_direct`"), implying a simple alias table. The live evidence shows it is not that simple.

**What `swap.catalogue` actually returns** (`ws_commands.py:1199-1240`, `[VERIFIED: read live]`):
- The static, pinned Claude tier (`swap_model._CLAUDE_TIER_MAP` — `opus`/`sonnet`/`haiku`/`fable`): every entry hardcodes `"vendor": "anthropic"` (`:1202`).
- The dynamic OpenRouter catalogue: every entry sets `"vendor": model_id.split("/", 1)[0]` (`:1225`) — i.e. whatever OpenRouter's own routing prefix is for that model: `"google"`, `"x-ai"`, `"meta-llama"`, `"mistralai"`, `"deepseek"`, `"qwen"`, etc. (not individually enumerated here — this is ~300+ entries per the code's own comment at `:1231`, and the set is whatever OpenRouter currently lists, not a fixed enum). Anthropic-native OpenRouter listings are explicitly excluded (`:1223-1224`) to avoid duplicating the pinned tier.
- **`grep -in "ollama"` across `swap_model.py` and `ws_commands.py` returns zero hits.** No CLI-gateway provider (`claude-cli`/`codex`/`antigravity`) appears either. `[VERIFIED]` — `swap.catalogue` structurally can never return an entry whose vendor matches `ollama`/`claude-cli`/`codex`/`antigravity`.

**What `PROVIDER_BILLING`'s keys actually are** (`src/lib/providers.ts:22-29`, `[VERIFIED]`): `anthropic_direct`, `openrouter`, `ollama`, `claude-cli`, `codex`, `antigravity`, `claude-sdk` — these describe **execution/billing channels for agent invocation** (which of Larry's subscriptions or API keys pays for a given agent turn), a completely different axis from "which company trained this model" (the `vendor` field's actual meaning in the live catalogue).

**Consequence of a literal `vendorKey in PROVIDER_BILLING` lookup:** `"anthropic"` is not a key in `PROVIDER_BILLING` (the key is `"anthropic_direct"`) — so even the pinned Claude tier fails a literal lookup. Every OpenRouter-routed entry's vendor slug (`"google"`, `"x-ai"`, ...) is also not a `PROVIDER_BILLING` key. **A literal implementation puts essentially the entire real catalogue into "Unclassified"**, and the "Subscription"/"Local" groups can never contain a single real entry, ever, from live data (no Ollama/CLI-gateway vendor is structurally possible).

**Corroborating evidence this mismatch is real, not a misreading:** the STUB fixtures that D-01 deletes (`brainsFixtures.ts:25-94`) used vendor values `"claude-cli"`, `"codex"`, `"antigravity"`, `"anthropic_direct"`, `"openrouter"`, `"ollama"` — a DIRECT 1:1 match with `PROVIDER_BILLING`'s keys. This strongly suggests the original per-profile design (Phase 103, imagining a richer catalogue) assumed the real backend would eventually report vendor as a billing-channel key. **It does not — `swap.catalogue`'s vendor field has always meant "model manufacturer," and the stub's shape was aspirational, not a contract the live handler ever honored.** `[VERIFIED: brainsFixtures.ts vs ws_commands.py, both read live]`

**Also note:** `normalizeGlobalCatalogueEntry` (`BrainPicker.tsx:125-134`, the GLOBAL axis's existing entry adapter, already live and unchanged by D-09) independently corroborates this — its own docstring states "Every global-axis entry is billed per-token through the gateway" and hardcodes `billing:"api"` for literally everything, with no attempt at per-vendor classification. This is consistent with my finding that every real catalogue entry (Claude-tier native or OpenRouter-routed) genuinely IS billed `"api"`.

**Proposed resolution (this research's recommendation, requires explicit planner sign-off, not silent implementation):**
```ts
function mapCatalogueVendorToBilling(vendor: string): { group: "subscription"|"api"|"local"|"unclassified"; billing: "api"|"sub"|null } {
  if (!vendor) return { group: "unclassified", billing: null };
  if (vendor === "anthropic") return { group: "api", billing: PROVIDER_BILLING["anthropic_direct"] === "api" ? "api" : "sub" };
  // Every other non-empty vendor slug that can reach this catalogue came through
  // swap_model._openrouter.get_models() (ws_commands.py:1206-1238) — there is no
  // third source. Billed via OpenRouter's API regardless of which underlying
  // lab made the model.
  return { group: "api", billing: "api" };
}
```
**Explicit tradeoff to surface to the planner:** under this rule, "Unclassified" only fires if `vendor` is empty/missing (a malformed payload), and "Subscription"/"Local" groups are ALWAYS empty (filtered out by the existing `.filter((g) => g.entries.length > 0)` pattern) in every live render. This is **honest** (matches what the server can actually report) but makes "Unclassified" effectively a defensive dead branch today, and makes D-07's original 3-group design (Subscription/API/Local) partially aspirational until/unless `swap.catalogue` is ever extended (explicitly deferred by this phase's own Deferred Ideas list). **Alternative:** implement D-09 as a LITERAL per-vendor-slug lookup against `PROVIDER_BILLING` (no `"anthropic"` alias, no openrouter catch-all) — this makes "Unclassified" the common case (nearly the whole catalogue) and satisfies the letter of "never silently default to api" most conservatively, at the cost of making the cost-tier confirm fire for almost every row, which is closer to the D-09-rejected "accept the flattening" outcome UI-SPEC/CONTEXT.md explicitly did NOT want. **This is genuinely a design decision with evidence on both sides — flagged in Open Questions below, not decided unilaterally here.**

**"What Local means for Ollama":** given the above, "Local" cannot be populated from `swap.catalogue` today under either resolution. If the planner wants a non-empty "Local" group, it would require either (a) accepting it stays empty until a future astridr change (matches this phase's own Deferred Ideas item rejecting `swap.catalogue` enrichment), or (b) sourcing Ollama-reachable models from a DIFFERENT existing signal CodePulse already has (not investigated this session — out of this research's scope per the "no new stack research" framing, and CONTEXT.md doesn't indicate this exists). Recommend treating "Local" as honestly-always-empty this phase.

## D. Swap-history readout (D-10, D-11, D-12)

### D.10 — `controlVerbSwaps.ts`, the `by_scope` index, and the `scope: null` question

**Schema** (`convex/schema.ts:2093-2124`, `[VERIFIED]`):
```ts
controlVerbSwaps: defineTable({
  ...
  scope: v.optional(v.string()), // D-13: explicit profileId when scoped, ABSENT when global
  ...
}).index("by_scope", ["scope", "timestamp"])
  .index("by_timestamp", ["timestamp"])  // confirmed unconsumed, documented as intentionally future-facing
```
The schema comment itself already says "**absent** when global," not "null when global" — a signal CONTEXT.md's `scope: null` phrasing was imprecise even before checking the ingest path.

**Confirmed at the ingest boundary** (`convex/runtimeIngest.ts:236-248`, `:401-421`, `[VERIFIED]`): `resolveControlVerbSwapEvent`'s `normalizeOptional()` explicitly converts any `null` value (including `scope`) to `undefined` before it reaches `internal.controlVerbSwaps.record`'s args — with an explicit code comment stating WHY: "Convex's `v.optional(...)` validators accept an omitted key or `undefined` but reject an explicit `null` outright." So a global swap's stored document **never** has `scope: null` — the key is simply absent (`undefined`).

**Convex's own documented semantics** (`[CITED: docs.convex.dev/database/types, fetched live this session]`):
> "You can use `undefined` in filters and index queries, and it will match documents that do not have the field. `.withIndex("by_a", q=>q.eq("a", undefined))` matches document `{}` and `{b: 1}`, but not `{a: 1}` or `{a: null, b: 1}`."
> "In Convex's ordering scheme, `undefined < null < all other values`..."

**Conclusion, HIGH confidence:** `listGlobal` MUST be written as `.withIndex("by_scope", (q) => q.eq("scope", undefined))`. If implemented literally per D-11's decision-text wording (`q.eq("scope", null)`), it will **silently return zero rows, forever** — not throw, not error, just an empty result that looks like "no global swaps yet" even after real ones have been dispatched. This is exactly the class of silent-drop defect Phase 108's live gate caught twice (§ Validation Architecture above) — a strong argument for including this specific query in the live gate's probe list (already added, see D-11 live probe item above).

**Concrete shape:**
```ts
export const listGlobal = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("controlVerbSwaps")
      .withIndex("by_scope", (q) => q.eq("scope", undefined))
      .order("desc")
      .take(SWAP_HISTORY_CAP);
  },
});
```

### D.11 — `SWAP_HISTORY_CAP`, and the WR-02 import-path constraint

`SWAP_HISTORY_CAP = 20` (`convex/controlVerbSwapsFilters.ts:20`, `[VERIFIED]`). The file's own docstring explains the WR-02 split precisely: `controlVerbSwaps.ts` imports `internalMutation`/`query` from `./_generated/server`, so any browser code value-importing a constant/predicate directly from it pulls the whole Convex server runtime into the client bundle — a real bug found at runtime after 108-06 shipped (per `108-REVIEW.md`, not independently re-verified this session but the code-level evidence — the split file's existence and its exact docstring explanation — is itself strong corroboration).

**Verified the constraint is real, not just documented:** `src/hooks/useControlVerbSwaps.ts` imports `SWAP_HISTORY_CAP`/`isBrainSwap` from `../convex/controlVerbSwapsFilters` (per `GlobalSwapModal.tsx:63-68`'s import block, which imports `describeSwapOutcome`/`filterBrainSwaps`/`SWAP_HISTORY_CAP`/`useControlVerbSwaps` all from `@/hooks/useControlVerbSwaps` — i.e. browser code reaches these constants exclusively through the hook, which itself reaches them exclusively through `controlVerbSwapsFilters.ts`, never `controlVerbSwaps.ts` directly). `[VERIFIED: import statements read live]`

**D-11's merge helper (client-side `listByScope` + `listGlobal` combine-by-timestamp function) must live on the BROWSER side of this line** — i.e. it is a plain TypeScript function with no `./_generated/server` or `convex/values` import, callable from `src/hooks/useControlVerbSwaps.ts` (or a new sibling), NOT added to `controlVerbSwaps.ts` or `controlVerbSwapsFilters.ts` in a way that re-exports server-runtime-dependent code. `controlVerbSwapsFilters.ts`'s own docstring already establishes the precedent this file is for (dependency-free constants/predicates usable from both bundles) — the merge function is a plausible additional export there, since merging two already-fetched arrays by timestamp needs neither `convex/values` nor `./_generated/*`.

### D.12 — `Settings.tsx:249-336` row structure and the Collapsible primitive

**Confirmed row structure** (`Settings.tsx:246-339`, `[VERIFIED]`): one `.map()` over `profileConfigs`, each row rendering avatar, display name, `profileId`, an inline engine-status line (currently reading `activeEngines[c.profileId]` — RAW `useActiveEngine()`, NOT `useResolvedBrain(profileId)` — see the flag below), a pending-suffix span, session/pinned mode chips, a STUB chip (deleted by D-01), and a `BrainPicker` mounted with a "Swap" trigger button (`:325-339`). D-10's collapsible history section slots directly under this per-row block, exactly as UI-SPEC §H specifies.

**`src/components/ui/collapsible.tsx` exists and is a thin Radix wrapper** (`Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` around `radix-ui`'s `Collapsible` primitive, `[VERIFIED]`).

**Correction to UI-SPEC §H:** it states this primitive is "installed, unused elsewhere in this codebase; this is its first consumer." **This is factually wrong — six existing files already import it**: `src/components/AlertRuleForm.tsx`, `CommandTryItForm.tsx`, `forge/ForgeLaunchModal.tsx`, `reminders/ReminderList.tsx`, `skills/IntakeReportView.tsx`, `skills/IntakeSheet.tsx` (`[VERIFIED: grep for the import path across src/]`). This is good news for the planner, not a blocker — there is existing in-repo precedent for exactly how this codebase composes `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`; `ReminderList.tsx` is the closest analog (a per-row disclosure inside a list, similar to D-10's shape) and worth a quick read before building D-10's section rather than inventing the composition pattern from the primitive alone.

**Flag, not a defect:** the Settings row currently reads its engine value from raw `useActiveEngine()`, bypassing `resolveActiveBrain` entirely (no override/lastTurn fallback). ENGINE-03 SC1 does not name the Settings row among its three mandated surfaces (picker/badge/confirm-modal), and UI-SPEC §B conditions its rule on "any Settings-row equivalent that comes to read `useResolvedBrain(profileId)`" — implying this is optional this phase. Since D-10 mounts the swap-history section directly under this exact row, an operator who just pinned a profile there would see the pin's OWN row still showing the pre-pin engine (stale, correct-per-D-06-scope-but-confusing) right next to fresh history proving the pin happened. **Raised as an Open Question below** rather than assumed in or out of scope.

## Line-Number Drift

CONTEXT.md file:line citations checked against live source this session, with disposition:

| Citation | Status |
|---|---|
| `astridr/api/ws_commands.py:405-435` (dispatcher registry, neither `gateway.model.set` nor `models.catalog` registered) | ✓ Held — confirmed zero hits for either string anywhere in `astridr/`. |
| `astridr/api/ws_commands.py:242-256` (`SwapSetCommand` with `profile_id`) | Not independently re-verified this session (out of the numbered questions' direct scope) — treat as unconfirmed, low risk. |
| `astridr/engine/control_verbs/dispatch.py:77-106` (`build_swap_state_payload`) | ✓ Held exactly. |
| `astridr/engine/control_verbs/dispatch.py:78-79` (in-memory-only claim) | ✓ Held exactly. |
| `astridr/engine/control_verbs/swap_model.py:437-495` (`_emit_restore_routing`) | ✓ Held (function body runs to ~511; 437-495 covers the documented/logical span). |
| `astridr/engine/control_verbs/swap_model.py:583, :617-620` ("the accessors `get_profile_override`/`get_profile_override_source` ... used at") | ✗ **DRIFT.** `:583` is a telemetry-dict key (`"verb": "swap_model"`), `:617-628` are the **setter** calls (`set_profile_override`/`set_global_override`), not the getters. The getters are defined and called in `astridr/providers/router.py` (`:805`/`:843` definitions, `:592-594`/`:601-602` call sites inside `_resolve_model`) — see §A.2. |
| `astridr/engine/bootstrap/wiring.py:344-350` (`default_profile_id` "documented" as `config.profiles[0].id`) | ~ **Partial drift.** The cited lines contain an accurate CONCEPTUAL description (a comment) but not the actual value computation — that happens at the call site, `astridr/engine/bootstrap/core.py:1298`: `default_profile_id=config.profiles[0].id if config.profiles else "personal"`. The function signature at `wiring.py:261` shows a hardcoded fallback literal `"personal"`, which could mislead a reader who stops at that line without following the call site. |
| `astridr/engine/bootstrap/core.py:1437` (D-03 boot seed) | Not independently re-verified this session — out of the numbered questions' direct scope. |
| `src/lib/brainsApi.ts` — every cited range (`:76-110`, `:118-143`, `:153-184`, `:212-218`, `:228-231`, `:239-273`) | ✓ All held exactly. |
| `src/hooks/useResolvedBrain.ts:244-290`, `:250-254`, `:266-269` | ✓ Held with 1-2 line rounding (actual early-return is `:252-254`, scoped-lastTurn rung is `:267-269`) — not material drift. |
| `src/hooks/useActiveEngine.ts:8-19`, `:40-56`, `:49`, `:73-105` | ✓ Held exactly. |
| `src/components/brains/BrainPicker.tsx:98-125`, `:203`, `:236-266`, `:310-313`, `:452`/`:477` | ✓ Held (`:310-313` for the `gateway.model.set` dispatch is slightly narrow — the full call spans `:310-317` — but the literal string itself is exactly at `:311`, so the citation is directionally correct). |
| `src/components/brains/BrainHeaderBadge.tsx:80-93`, `:95-99`, `:126-127`/`:206`, `:114` | ✓ Held (`:114` is the ternary condition; the rendered string `"No brain reported"` itself is one line further at `:115` — trivial). |
| `src/components/brains/GlobalSwapModal.tsx:138-157`, `:422-426`, `:448-458`, `:484-565`, `:277-284` | ✓ Held for all directly checked (`:448-458` exact; `:512` for the `swap.set` literal exact). `:422-426` and `:277-284` not independently re-verified this session. |
| `src/pages/Chat.tsx:119-121, 155-192, 563-570, 697` | ✓ Held exactly. |
| `convex/controlVerbSwaps.ts:68-87` (`listByScope`) | ✓ Held (function itself at `:76-87`; `:68-75` is its doc-comment, both within the cited range). |
| `src/lib/providers.ts:22-35` | ✓ Held exactly. |
| `playwright.config.ts:24,30` | ✓ Held exactly. |
| UI-SPEC §H: "installed, unused elsewhere in this codebase" (collapsible.tsx) | ✗ **DRIFT.** Six existing files already import it — see §D.12. |
| CONTEXT.md Discretion: "Phase 108's live gate found five real defects" | ✗ **DRIFT (precision, not direction).** Live gate (108-07) itself found 3, per its own SUMMARY/REQUIREMENTS entries; 5 is the milestone-wide total including 2 found earlier in 108-03 by non-live-gate work. See `## Validation Architecture` above. |

**Everything not listed above as drifted was either confirmed exactly, or not independently re-checked this session** (astridr changes are scoped to exactly 2 items per CONTEXT.md, so most astridr-side citations outside D-03/D-05's direct evidence chain were not re-traced).

## Open Questions for the Planner (RESOLVED)

*All five closed during `/gsd-plan-phase 109` on 2026-08-08. Resolution recorded inline per question
below; the original text of each question is preserved unchanged for traceability.*

- **Q1 → RESOLVED as `109-CONTEXT.md` D-13** (operator decision): the alias + OpenRouter catch-all
  rule. Implemented by plan `109-07`.
- **Q2 → RESOLVED as `109-CONTEXT.md` D-14** (operator decision): yes, upgrade the Settings row label
  to `useResolvedBrain(profileId)`. Implemented by plan `109-04`.
- **Q3 → RESOLVED in plan `109-04` Task 2**: `LlmStatusPanel.tsx`'s `"Auto"` fallback becomes
  UI-SPEC §A's canonical `"Not reported"`, with the reason recorded in that task.
- **Q4 → DELEGATED to execution, deliberately**: plan `109-01`'s `<read_first>` requires reading
  `_handle_swap_catalogue`'s dependency injection before writing the D-03 change, with explicit
  either-branch guidance. Not answerable from research without reading the DI, so it is pinned as a
  read-first obligation rather than a guess.
- **Q5 → RESOLVED as report-don't-fix in plan `109-01` Task 3**: the stale `web.py:973` CORS default
  is surfaced to the operator with pasted evidence. Fixing it would breach this phase's locked
  two-change astridr scope fence.

1. **D-09's vendor-mapping resolution (§C.9) — genuinely undecided, not a research gap.** Should `"Unclassified"` be reachable only on malformed/missing vendor data (my proposed `anthropic`-alias + openrouter-catch-all rule, which makes Subscription/Local permanently empty but classifies ~100% of real entries as API), or should it be a literal per-vendor-slug `PROVIDER_BILLING` lookup with no aliasing (which makes Unclassified the common case for nearly the whole live catalogue, satisfying the letter of "never silently default" most conservatively but defeating the cost-tier confirm's usefulness for almost every row)? **What would settle it:** ask whether the cost-tier confirm gate is meant to protect against genuinely-uncertain billing (favor my proposed rule) or against ANY vendor CodePulse hasn't explicitly reviewed (favor the literal lookup). This is a product/UX call, not something more code-reading resolves.
2. **Should `Settings.tsx`'s per-profile engine display (§D.12) also be upgraded to `useResolvedBrain(profileId)`?** Not one of ENGINE-03 SC1's three named surfaces, and UI-SPEC §B explicitly conditions its rule rather than mandating it here. Given D-10 mounts swap history directly under this exact row, leaving it on raw telemetry means a freshly-pinned profile's own row can show a stale engine right next to history proving the pin succeeded. **What would settle it:** whether the planner considers this row's data-source correctness in-scope for "the picker's This profile scope... shows a profile's actual current engine" (SC1's wording doesn't literally name Settings, but the row's own embedded `BrainPicker` IS the "This profile" scope surface — arguably SC1 already covers it via that embedded picker, just not the row's OWN label above it).
3. **`LlmStatusPanel.tsx`'s absent-state string (§C.7)** — should its literal `"Auto"` fallback also be replaced with UI-SPEC §A's canonical `"Not reported"` string, given it renders the exact same "no telemetry yet" condition UI-SPEC §A is trying to make consistent everywhere? Not named in §A's four-surface list. Low risk either way since `"override"` flows through this component with no code change required regardless.
4. **Does `astridr`'s `_handle_swap_catalogue` handler have access to `config` today**, to compute `default_profile_id = config.profiles[0].id if config.profiles else "personal"` the same way `core.py:1298` does? Not checked this session — the class owning `_handle_swap_catalogue` was read for its command-handling logic but not audited for what dependencies are already injected into it (`self._config` or similar). **What would settle it:** read the `__init__`/dependency-injection of the class containing `_handle_swap_catalogue` (same file, likely nearby `_handle_swap_set`'s own dependency list) before writing the D-03 astridr task.
5. **The stale `web.py:973` CORS default on `feature/brain-swap` (§A.3)** — worth a one-line flag to the operator before or alongside this phase's astridr commits, even though it's outside the 2-change scope? Recommend surfacing it in the plan's own summary rather than silently fixing or silently ignoring it.

## Sources

### Primary (HIGH confidence — read live this session)
- `astridr-repo` (`feature/brain-swap`): `astridr/api/ws_commands.py`, `astridr/engine/control_verbs/dispatch.py`, `astridr/engine/control_verbs/swap_model.py`, `astridr/providers/router.py`, `astridr/engine/bootstrap/wiring.py`, `astridr/engine/bootstrap/core.py`, `astridr/channels/web.py`, `astridr/channels/router.py`.
- `codepulse` (`master`): `src/lib/brainsApi.ts`, `src/lib/brainsFixtures.ts`, `src/lib/providers.ts`, `src/hooks/useResolvedBrain.ts`, `src/hooks/useActiveEngine.ts`, `src/components/brains/BrainPicker.tsx`, `BrainPickerRow.tsx`, `BrainHeaderBadge.tsx`, `GlobalSwapModal.tsx`, `BrainsWsRegistrar.tsx`, `src/pages/Chat.tsx`, `src/pages/Settings.tsx`, `src/components/control-center/BrainControl.tsx`, `ControlCenterPanel.tsx`, `src/contexts/AstridrWSContext.tsx`, `src/hooks/useCommandDispatch.ts`, `src/components/control-center/LlmStatusPanel.tsx`, `convex/schema.ts`, `convex/controlVerbSwaps.ts`, `convex/controlVerbSwapsFilters.ts`, `convex/runtimeIngest.ts`, `playwright.config.ts`, `e2e/brain-swap.spec.ts`.
- `.planning/phases/108-.../108-VERIFICATION.md`, `108-07-SUMMARY.md`, `108-ENGINE-05-EVIDENCE.md`, `.planning/REQUIREMENTS.md` (108/109 entries), `.planning/ROADMAP.md` (Phase 108/109 sections).
- Live git commands: `git log`, `git merge-base`, `git rev-list` on both repos.
- Live probes: `docker ps`, `curl http://127.0.0.1:3210/version` (200), `curl http://127.0.0.1:8181/health` (200).

### Secondary (MEDIUM confidence)
- Convex documentation `docs.convex.dev/database/types`, fetched live this session (`[CITED]`) — the `undefined`-vs-`null` index-matching semantics underpinning §D.10's correction. Single-source but from Convex's own official docs, directly quoted.

### Tertiary (LOW confidence)
- None relied upon as load-bearing — every claim above traces to either live source code, a live command probe, or an official Convex doc quote.

## Metadata

**Confidence breakdown:**
- Cross-repo (astridr) findings: HIGH — every claim traces to a live `Read`/`Grep` of the actual file on `feature/brain-swap`, not training-data assumptions about astridr's structure.
- CodePulse seam retirement/read-path findings: HIGH — same standard, full files read for every component named in CONTEXT.md/UI-SPEC.
- D-09 vendor-mapping finding: HIGH confidence in the EVIDENCE (verified vendor values and PROVIDER_BILLING keys genuinely don't align), MEDIUM confidence in my PROPOSED resolution rule (a legitimate design call, flagged as Open Question #1, not asserted as the only correct answer).
- Validation Architecture: HIGH — grounded in Phase 108's own verification artifacts, not a generic template.

**Research date:** 2026-08-08
**Valid until:** ~7 days (fast-moving — this phase depends on a branch (`feature/brain-swap`) actively receiving commits, and the live stack's exact state (container freshness, branch divergence) will change before implementation starts).
