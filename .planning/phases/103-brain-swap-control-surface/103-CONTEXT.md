# Phase 103: Brain-Swap Control Surface - Context

**Gathered:** 2026-07-27
**Corrected:** 2026-07-28 — see `<blocker_reframing>`. Research during `/gsd-plan-phase 103`
found that a **global** brain swap already ships and works; only the **per-profile** axis is
missing. D-05, D-06, D-13 are marked `[CORRECTED]`; D-08, D-14, D-16 are marked `[AMENDED]`.
**Gap closure 2026-07-28:** D-11 is additionally marked `[AMENDED gap-closure 2026-07-28]`,
arising from the `103-VERIFICATION.md` gap cycle rather than from planning research — see that
entry for its evidence and for what it deliberately leaves untouched.
All corrections were verified against live code before being written here.
**Status:** Ready for planning

<domain>
## Phase Boundary

CodePulse gains an operator surface for Ástríðr's reasoning engine ("brain"): a live view of
which engine is active — globally and per persona — plus an on-the-fly swap across keyed API
models and subscription CLIs, with explicit per-profile vs global scope and honest,
server-confirmed status.

**This phase builds the CodePulse client only.** The Ástríðr-side brain-swap backend is not in
scope here (see the BSC-05 reframing below) — but this phase *does* publish the client contract
that backend must satisfy.

</domain>

<blocker_reframing>
## BSC-05 Reframing — CORRECTED 2026-07-28 (supersedes the 2026-07-27 reading below)

> **⚠ CORRECTION (2026-07-28, during `/gsd-plan-phase 103`).** The 2026-07-27 reading below —
> "the backend does not exist" — is **half wrong**, and four locked decisions were built on it.
> The error: the 07-27 verification searched only for the *Phase 184.1* seams
> (`gateway_provider.py`, `model_registry.py`, `/api/models`, `gateway.model.set`) and concluded
> from their absence that no brain swap exists at all. It never searched for the seam that
> **actually ships**.
>
> **A working GLOBAL brain swap is live today** (astridr Phase 185/186, verified against live code
> 2026-07-28):
>
> | Piece | Evidence |
> |---|---|
> | Write command | `astridr/api/ws_commands.py:224` `SwapSetCommand` (`type: "swap.set"`, `target: "brain"\|"voice"`, `value`, `restore`) |
> | Dispatcher registration | `astridr/api/ws_commands.py:419` — `"swap.set": self._handle_swap_set` |
> | Handler | `astridr/api/ws_commands.py:1075` `_handle_swap_set` — routes through the SAME `swap_model` `ControlVerb.execute` a spoken "try on X" resolves to; never a parallel mutation |
> | Catalogue read | `SwapCatalogueGetCommand` (`swap.catalogue`) — live, 1h-TTL cached, ~300+ OpenRouter entries |
> | Reactive readback | `_handle_swap_set` pushes `swap.state` live after execution |
> | Shipped CodePulse UI | `src/components/control-center/BrainControl.tsx` (Phase 186-09) — popover picker, live catalogue, type-to-filter, provider grouping, its own `186-UI-SPEC.md`, three live checkpoint rounds with the operator; plus `src/components/voice/SwapBadge.tsx` |
>
> **What genuinely does NOT exist is the PER-PROFILE axis** — the Phase 184.1 seams. `swap.set`
> carries no scope discriminator and runs with `session_id=None`: it is a **global, process-wide,
> in-memory runtime override**. There is no per-profile brain target anywhere in astridr.
>
> **Operator decision (2026-07-28): the shipped global swap IS this phase's global scope.**
> Phase 103 builds the **per-profile axis only** (stub-backed behind the D-16 seam) and wires
> D-08's `All profiles` mode to the **live** `swap.set` path — not to a stub. Consequences:
> - Do NOT build a second global brain picker. `BrainControl.tsx` stays; Phase 103 extends the
>   model rather than duplicating the surface.
> - Half of this phase is genuinely live and end-to-end verifiable. That materially strengthens
>   the redefined BSC-05 below — the stub boundary now covers per-profile only.
> - D-05, D-06 and D-13 are amended in `<decisions>` below; each amendment is marked
>   **`[CORRECTED 2026-07-28]`** and carries its evidence.
>
> Everything from here to the end of this section is the superseded 2026-07-27 record, retained
> because its findings about the **per-profile** seams remain accurate and still scope the stub.

### Superseded 2026-07-27 record (per-profile findings still valid)

ROADMAP.md states Phase 103 "gates on astridr's brain-swap backend (astridr Phase 184.1) being
live end-to-end." **That backend was never built.** Verified against `astridr-repo` on branch
`feature/brain-swap`:

| Expected per the design spec | Actual state |
|---|---|
| `astridr/providers/gateway_provider.py` | **absent** — `astridr/providers/` contains only `base.py`, `anthropic_provider.py`, `openrouter.py`, `ollama.py`, `mock_provider.py`, `failover.py`, `router.py` |
| `astridr/engine/model_registry.py` | **absent** |
| Dynamic registry replacing the static gate | `astridr/engine/model_defaults.py:50` still declares `ALLOWED_MODELS: set[str] = …` |
| `claude-cli\|codex-cli\|antigravity-cli → ["gateway"]` affinity | **zero matches** for `claude-cli` or `gateway` in `model_defaults.py` — the live `/model use claude-cli` mis-route identified in the design spec §2 is still live |
| `/api/models` REST or `gateway.model.set` WS command | **zero matches** across `astridr/` |
| Phase 184.1 / `BRAINS-01..06` registered in astridr's roadmap | **not present** in `astridr-repo/.planning/ROADMAP.md` or `REQUIREMENTS.md` |

The CLI Gateway sidecar itself *does* exist (`astridr-repo/gateway/`, port 8200) — but wired as a
**tool** (`astridr/tools/cli_gateway.py`), not as a brain. The design spec's §12 decision to
register Phase 184.1 in astridr's roadmap was never executed.

**Operator decision (2026-07-27): contract-first, stub-backed.** Phase 103 proceeds as scoped.
CodePulse locks the client contract, builds the full surface against a stub behind one adapter
seam, and **BSC-05 is redefined**:

> ~~"Verify astridr's list-engines / swap / read-current endpoints work end-to-end on the running
> stack before any UI is built against them."~~
>
> **BSC-05 (as executed) — split by axis per the 2026-07-28 correction:**
>
> - **Global axis — LIVE, verify for real.** `swap.set` / `swap.catalogue` / `swap.state` exist and
>   work. BSC-05's original wording ("verified working end-to-end on the running stack") **is
>   satisfiable here and MUST be satisfied** — exercise it against the running stack, do not stub it.
> - **Per-profile axis — stub-backed, contract-first.** The client contract is published as a
>   deliverable (`103-CONTRACT.md`), the stub adapter provably conforms to it, and the surface
>   degrades honestly when the per-profile backend is absent. Live end-to-end verification of the
>   per-profile path moves to a follow-on gate, closed when astridr Phase 184.1 ships.
>
> The Phase-90 War Room lesson ("endpoint exists ≠ integration works") applies with full force to
> the global axis — it is not discharged by the endpoint existing.

**Planner MUST NOT** attempt to close BSC-05 as originally worded, and **MUST NOT** treat a green
stub as live-verified. The Phase-90 War Room lesson ("endpoint exists ≠ integration works") is
acknowledged and consciously deferred here, not satisfied.

**Follow-on required (astridr-repo, not this phase):** register Phase 184.1 from the approved
design spec and implement `GatewayProvider` + `model_registry` + the REST/WS surface against
`103-CONTRACT.md`.

</blocker_reframing>

<decisions>
## Implementation Decisions

### Swap Scope & Persistence
- **D-01:** The swap unit is the **persona / profile** — `profileConfigs.profileId` +
  `modelPreferences` (mirrored by `agentProfiles`). "Per agent" in ROADMAP/BSC language means
  *per profile*. `agents.agentId` is per-run read-only telemetry and is NOT a swap target;
  astridr has no seam to re-brain a running agent.
- **D-02:** The surface exposes **both** a temporary session swap (1h TTL, astridr's
  `set_session_override` / `/model use`) **and** a sticky per-profile pinned default
  (`/model default`). Matches design spec D4. The UI must make clear **which of the two is
  currently in force** so a temporary override never reads as permanent.
- **D-03:** **Ástríðr owns the persisted default** (Supabase, per design spec D4 parity with
  `agent_model_defaults`). CodePulse dispatches the change and reads the result back — it does
  NOT hold its own authoritative copy. This deliberately overrides CodePulse's usual
  "Convex-first, then dispatch" convention, because two stores would reproduce the exact
  stale-config divergence BSC-01 exists to kill.
- **D-04:** The `--agentic` per-CLI-brain toggle (design spec D2 hybrid mode) is **deferred**.
  This phase ships CLI brains in **text mode only**. The text-mode fallback notice (a tool-needing
  turn silently falls back to an API model) still must be surfaced honestly.

### Control Placement
- **D-05 `[CORRECTED 2026-07-28]`:** Primary switcher = **chat composer pill + header badge**
  (design spec §7 items 1 and 3): a compact brain pill opening the rich picker, plus an
  always-visible active-brain badge in the `DashboardLayout` status cluster.
  **Correction — the pill's host file was wrong.** The original decision named
  `src/components/ChatInput.tsx`; that component is imported by exactly one file,
  `src/pages/InsightsChat.tsx`, which is an unrelated surface. The real Ástríðr chat is
  `src/pages/Chat.tsx`. **Operator decision 2026-07-28: the pill goes on the `Chat.tsx` composer**
  — the evident intent of D-05, with the file corrected. Do NOT add it to `InsightsChat`.
  Note the control-center already ships a brain box (`BrainControl.tsx`); the composer pill is an
  additional entry point to the same state, not a competing one.
- **D-06 `[CORRECTED 2026-07-28]`:** The per-profile live view **replaces the existing stale rows
  in place**. Settings → Agents (`src/pages/Settings.tsx:630-678`) already renders one row per
  profile showing `{p.profileId} / {p.model}` at line 663 — a synced config field, i.e. precisely
  the stale read BSC-01 forbids. Swap it for the live reactive engine and add a swap affordance to
  the row. Do NOT build a parallel per-profile view that leaves the stale one on screen.
  **Correction — the backing table was wrong.** The original decision treated `agentProfiles.model`
  as the source. `convex/profiles.ts:113` states explicitly that **`agentProfiles` has zero rows
  and is not the real persona-model change path**; the real per-profile source is `profileConfigs`
  (read via `api.profiles.listConfigs`). Bind the live view and the swap to `profileConfigs`.
  The audit-trail freebie still applies: `convex/profiles.ts:109-125` already writes a
  `configChanges` row when `profileConfigs.modelPreferences` changes.
- **D-07:** Picker is **grouped: Subscription / API / Local**, fuzzy-searchable over the open
  registry. Each row = color dot · name · billing chip · health dot · quota bar (design spec §7
  item 2).
- **D-08 `[AMENDED 2026-07-28]`:** Global scope is a **mode inside the same picker**, not a separate
  place: an explicit `This profile` / `All profiles` scope selector that **resets to profile scope
  every time the picker opens** and must be moved deliberately.
  **Amendment — `All profiles` dispatches the LIVE global path, not a stub.** Per the 2026-07-28
  correction, the shipped Phase-185/186 global swap (`swap.set` with `target: "brain"`) **is** this
  phase's global scope. Wire `All profiles` to it directly. Only the `This profile` branch goes
  through the D-16 stub seam. The picker therefore has one live branch and one stubbed branch, and
  the stub indicator (D-16) must appear on the per-profile branch **only** — labelling live global
  data as stub would be its own honesty failure.

### Global-Swap Ritual (BSC-03)
- **D-09:** Confirmation is a **modal that lists what actually changes** — every affected profile
  with `current → new` engine per row. The friction is informational, not ceremonial (no
  type-to-confirm). The modal doubles as the preview of what a revert would undo.
- **D-10:** A global swap is **revertible**: snapshot each profile's prior engine before firing,
  and offer `Revert global swap` (in the success toast and until the next swap supersedes it).
- **D-11 `[AMENDED gap-closure 2026-07-28]`:** Pinned defaults are **overwritten, but recorded**.
  Global means global — every profile moves — and the snapshot records which engines were *pinned*
  vs *inherited* so a revert restores the exact prior state **including pin status**. The confirm
  modal flags "N profiles have pinned defaults that will be overwritten."
  **Amendment — a global swap SHADOWS pinned defaults; it does not overwrite them, so the confirm
  copy's verb changes.** Operator decision 2026-07-28, taken during the `103-VERIFICATION.md`
  gap-closure cycle. The original wording assumed a global swap writes a new default into every
  profile. It does not, and per `103-CONTRACT.md` §8 it must not: *"'All profiles' scope in the
  Phase 103 UI dispatches the **existing live** `swap.set` (global axis), not N `gateway.model.set`
  calls."* `GlobalSwapModal` shipped fanning out N `gateway.model.set` calls anyway — the
  astridr-Phase-184.1-**deferred** per-profile command — which on the live stack failed with
  `union_tag_invalid` for every profile, every time (`103-VALIDATION.md` defect #5, live-observed).
  Gap-closure plan `103-12` removes that fan-out, after which **nothing writes to
  `profileConfigs.modelPreferences` during a global swap at all.**
  What actually happens is **shadowing**, not overwriting: per `103-CONTRACT.md` §9, `router.py`'s
  `_resolve_model` resolves the global override at **rung 2** and a per-profile default at **rung 4**
  (`router.py:437-472`), so while the override is in force each profile's pinned default remains
  intact on disk but inactive at resolution time. Leaving the copy as "will be overwritten" would
  ship a false status string of exactly the class BSC-04 exists to eliminate — the confirm modal
  would name a mutation the system never performs, in the one dialog whose entire job (D-09) is to
  state what actually changes.
  **What this amendment does NOT change:** the pinned-default **count** and the `Pin` icons stay in
  the confirm listing; the snapshot still records *pinned* vs *inherited*; and the revert still
  restores the exact prior state **including pin status**. D-11's disclosure and recording
  obligations are untouched — **only the verb changes**, from "overwritten" to language describing
  the pinned defaults as shadowed while the global override is in force.
- **D-12:** Partial failure yields an **honest per-profile result** — N switched / M failed with
  reasons; failed rows keep displaying their real, unchanged engine. No all-or-nothing rollback
  (a rollback that itself fails produces a worse state). This is BSC-04 applied per row rather
  than per batch.

### Status, Readback & the Stub Seam (BSC-04)
- **D-13 `[CORRECTED 2026-07-28]`:** Dispatch is a **WS command via `useCommandDispatch`** —
  `gateway.model.set` (`{ profileId | scope, model, … }`) for the per-profile branch. The ack
  channel carries status/error and `useCommandDispatch` already wires sonner toasts on both
  outcomes.
  **Correction — the cited reference pattern is dead code.** The original decision said to mirror
  "the proven `gateway.provider.set_enabled` pattern". That command has **zero** handlers anywhere
  in `astridr/` — `src/components/ProviderControls.tsx:188` dispatches it into a Pydantic command
  union that contains no such type. It is not proven; it does not work. **Model the new per-profile
  command on `SwapSetCommand` instead** (`astridr/api/ws_commands.py:224`, dispatcher `:419`,
  handler `:1075`) — the real, live, working shape, including its `request_id` convention, its
  `restore` flag idiom, and its post-execution `swap.state` live push. `103-CONTRACT.md` (D-17)
  must specify the per-profile command in that shape so Phase 184.1 implements against something
  with a working precedent rather than against a fiction.
  *(The dead `gateway.provider.set_enabled` call at `ProviderControls.tsx:188` is a real pre-existing
  bug. It is OUT OF SCOPE for this phase — note it as a follow-up, do not fix it here.)*
- **D-14 `[AMENDED 2026-07-28]`:** The **resulting active engine comes from server-reported state**,
  never from the client's own assertion and never from the ack payload alone. The UI renders only
  what the backend reported. This makes BSC-01's "reactive, not a stale config read" structurally
  true and gives the swap and the view one shared truth.
  **Amendment — two readback transports, one per axis:**
  - **Global:** `swap.state`, already live-pushed by `_handle_swap_set`
    (`astridr/api/ws_commands.py:1075`) and already consumed upstream in `Chat.tsx`. Reuse it.
    Do NOT route the global engine through Convex just to satisfy the original wording — that would
    add a hop and a staleness window to a path that is already correct.
  - **Per-profile:** Convex-reactive telemetry as originally specified — Ástríðr emits the active
    per-profile engine → Convex table → `useQuery`. Specified in `103-CONTRACT.md` (D-17); stubbed
    until 184.1 ships.

  Both feed one shared view-model so the badge and picker cannot disagree with themselves.
- **D-15:** In-flight = **pending overlay, old engine stays truth**. The pill keeps showing the
  actually-active engine with a distinct `switching to X…` treatment layered on top. On failure
  the pending state simply drops — there is nothing to roll back because the UI never claimed the
  swap succeeded. **No optimistic switching** (BSC-04 forbids it; Phase 100 already cost a code
  review round on optimistic pending-state/commandId reconciliation).
- **D-16 `[AMENDED 2026-07-28]`:** **One adapter + env flag** for the stub seam — now scoped to the
  **per-profile branch only**. The global branch is live (see the correction block and D-08) and
  must NOT be routed through the stub or marked with the stub indicator. All *per-profile* brain
  traffic goes through a single
  module (e.g. `src/lib/brainsApi.ts`) exposing one interface with two implementations — stub and
  live — selected by a `VITE_` flag. Everything above the seam is written against the real
  contract, so going live is a flag flip plus one module, not a rewrite. The stub must be
  visibly identifiable as stub data in the UI so it can never be mistaken for a live reading.
- **D-17:** Phase 103 **ships `103-CONTRACT.md`** as a real deliverable: the concrete message
  shapes for `gateway.model.set` (+ `set_default`), the brain-catalog payload (`/api/models` /
  `models.catalog`), and the active-engine telemetry event. Astridr Phase 184.1 implements
  against this document rather than guessing. The stub adapter must provably conform to it.

### Claude's Discretion
- Exact component decomposition of the picker (single component vs picker + row + scope selector).
- Naming of the adapter module, the env flag, and the Convex table/field carrying the active engine.
- Visual treatment of the pending overlay, the stub-data indicator, and the billing/health/quota chips
  (subject to `/gsd-ui-phase 103`, which the roadmap already flags with `UI hint: yes`).
- Whether the brain-catalog read is REST or a WS event — D-13 fixes only the *write* transport;
  pick whichever makes the contract cleaner and note it in `103-CONTRACT.md`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Brain-swap design (the primary feed for this phase)
- `C:\Users\mandr\astridr-repo\docs\superpowers\specs\2026-07-17-astridr-brain-swap-design.md` —
  the approved design spec. **Read in full.** §3 locked decisions D1-D7, §4 the two seams
  (`GatewayProvider`, dynamic model registry), §5 command surface, §7 the CodePulse controls this
  phase implements, §8 the v1 in/out boundary, §11 open risks. Note: §12's instruction to register
  astridr Phase 184.1 was never executed — see `<blocker_reframing>` above.
- `C:\Users\mandr\astridr-repo\docs\superpowers\specs\2026-07-17-brain-swap-roadmap-changeset.md` —
  companion changeset for the roadmap placement.

### Phase requirements & scope
- `.planning/ROADMAP.md` §"Phase 103: Brain-Swap Control Surface" (lines ~637-651) — goal,
  dependencies, 5 success criteria, `UI hint: yes`.
- `.planning/REQUIREMENTS.md` lines 13-17 — BSC-01 … BSC-05, plus line 41 (astridr-side backend
  explicitly out of CodePulse scope).

### Project conventions that constrain this phase
- `CLAUDE.md` §"Ástríðr API Integration" — every `/api/*` fetch MUST carry
  `Authorization: Bearer` via `authHeaders()` from `src/lib/astridrApi.ts`.
- `CLAUDE.md` §"Styling" — token-driven theming; never hardcode hex, compose the 30 shadcn/ui
  primitives in `src/components/ui/`, Lucide icons only.
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — no `import --replace-all`, no bulk
  deletes/patches on the live instance.

### Astridr-side code this contract must match
- `astridr-repo/astridr/providers/router.py` (`ModelRouter._resolve_model`, ~line 424) — the
  resolution order a swap participates in: explicit → session override → agent default → category
  rule → failover default.
- `astridr-repo/astridr/engine/model_defaults.py:50` — the static `ALLOWED_MODELS` gate the
  dynamic registry is meant to replace; `MODEL_PROVIDER_AFFINITY` (~line 113) still lacks any
  gateway entry.
- `astridr-repo/astridr/channels/commands.py` (~line 174) — the existing `/model` command;
  `astridr/channels/router.py` (~line 658) — where it is intercepted.
- `astridr-repo/gateway/` + `docker-compose.yml` (`astridr-cli-gateway`, port 8200) — the CLI
  sidecar; `astridr/tools/cli_gateway.py` — its current tool-only wiring.

</canonical_refs>

<code_context>
## Existing Code Insights

### Already-shipped brain-swap surface `[ADDED 2026-07-28 — missing from the 07-27 pass]`
The 2026-07-27 context pass did not find these. They are live and are the single most important
prior art for this phase. **Read all of them before planning any picker component.**
- `src/components/control-center/BrainControl.tsx` — the shipped global brain picker (Phase 186-09).
  Popover + live `swap.catalogue` fetch + type-to-filter `Input` + provider-grouped rows +
  "Restore usual brain". Its docstring records three live checkpoint rounds with the operator
  (~300-entry catalogue → widened popover, non-truncating wrapping rows, provider section headers).
  **Every one of those is a UX lesson this phase must not re-learn.**
- `src/components/control-center/BrainControl.test.tsx` — the existing test idiom for a
  catalogue-fetch → select → dispatch flow. Copy this structure.
- `src/components/control-center/VoiceControl.tsx` — the same pattern on the voice axis.
- `src/components/voice/SwapBadge.tsx` — the existing badge fed by in-memory swap state, seeded in
  `Chat.tsx` via `swap.get_state` on mount.
- `src/components/control-center/ControlCenterPanel.tsx:273` — how the BRAIN box is hosted.
- `.planning/phases/…186…/186-UI-SPEC.md` — the approved UI contract BrainControl was built to.
  Reconcile `103-UI-SPEC.md` against it; where they disagree on the global surface, 186 describes
  shipped reality.

### Reusable Assets (all verified present 2026-07-27)
- `src/lib/astridrApi.ts` — `authHeaders()`; mandatory for any `/api/*` read.
- `src/contexts/AstridrWSContext.tsx` — WS transport + `sendCommand` + `AckResponse`.
- `src/hooks/useCommandDispatch.ts` — thin `sendCommand` wrapper adding sonner success/error
  toasts and exposing `isConnected`; the proven dispatch pattern (Phase 56). **33 lines — read it.**
- `src/lib/providers.ts` + `PROVIDER_COLORS` — provider identity/colors for picker rows.
- `src/hooks/useProviderHealth.ts` + `src/components/ProviderHealthPanel.tsx` — health dots.
- `convex/gatewayQuota.ts` + `src/components/GatewayQuotaPanel.tsx` — quota bars for CLI brains.
- `convex/providerConfig.ts`, `src/components/ProviderControls.tsx`,
  `src/components/LLMProviderConfig.tsx` — the existing LLM-provider settings surface.
- `src/components/ChatInput.tsx` — host for the composer brain pill (skill-chip row pattern at
  `src/pages/Chat.tsx:494`).
- `src/components/ui/` — shadcn primitives incl. `popover`, `switch`, `tabs`, `scroll-area`;
  `cmdk` for fuzzy search; `StatusBadge`; `SectionErrorBoundary`.

### Established Patterns
- **Command dispatch:** `useCommandDispatch().dispatch(cmd, successMsg)` → WS ack → toast.
  `gateway.provider.set_enabled` is the reference shape for `gateway.model.set`.
- **Reactive reads:** `useQuery(api.domain.fn) ?? []` behind a `src/hooks/useX.ts` wrapper.
- **Config audit trail:** `convex/profiles.ts:109-125` already writes a `configChanges` audit row
  when `modelPreferences` changes — a swap that lands in `profileConfigs` gets auditing for free.
- **Error isolation:** wrap widget groups in `<SectionErrorBoundary name="…">`. Relevant here: a
  throwing `useQuery` unmounts the React tree and blanks every page using it.
- **Global hotkeys:** `DashboardLayout` owns `Ctrl+K` / `Ctrl+Shift+K` — grep it before binding
  any new shortcut for the picker.

### Integration Points
- `convex/schema.ts:508` `profileConfigs` (`profileId`, `modelPreferences`, `budget`, `channels`)
  and `:85` `agentProfiles` (`profileId`, `model`, `displayName`, `avatarId`) — the profile unit
  D-01 binds to.
- `convex/schema.ts:61` `agents` (`agentId`, `agentType`, `model`) — per-run telemetry, explicitly
  NOT a swap target.
- `src/pages/Settings.tsx:630-678` — the profile rows D-06 replaces (stale `p.model` at line 663).
- `src/layouts/DashboardLayout.tsx` status cluster — host for the active-brain badge.
- `convex/runtimeIngest.ts` — where an active-engine telemetry event would land (D-14).

</code_context>

<specifics>
## Specific Ideas

- The design spec's vocabulary note holds: the codebase says **provider / model**; "brain" is the
  **user-facing label only**. Do not rename code symbols to "brain" beyond the new adapter/UI layer.
- The BSC-01 failure mode has a name in this project: the **v9.0 VitalsRail active-profile trap** —
  showing a synced config value as if it were live state. `Settings.tsx:663` is a live instance of
  it, and D-06 exists to remove it.
- Phase 100's optimistic pending-state machine (commandId-reconciled, two Critical review findings)
  is the cautionary precedent behind D-15's no-optimistic-switching rule.

</specifics>

<deferred>
## Deferred Ideas

- **Astridr Phase 184.1 itself** — `GatewayProvider`, `model_registry`, the `/model` command
  expansion, the affinity/mis-route fix, and the REST/WS surface. Belongs in `astridr-repo`, built
  against this phase's `103-CONTRACT.md`. **This is the blocking follow-on** for live BSC-05.
- **Live end-to-end brain-swap verification** — the original BSC-05 wording. Closes only once
  184.1 ships; track as a follow-on gate, not as satisfied by this phase.
- **`--agentic` CLI mode** (design spec D2 / §7 item 2) — per-brain agentic switch delegating the
  turn to the CLI's own tool loop. Deferred by D-04.
- **Voice / War Room brain-swap** — astridr Phase 185 (voice control verbs + wardrobe); voice swaps
  stay runtime-only per the locked rule. Out of CodePulse scope entirely.
- **Fix the broken `claude-sdk` gateway adapter** (missing `sdk-runner/run.js`) — design spec
  Follow-on Phase B, astridr-side.
- ~~**Expensive/unknown-model warn+confirm ritual** and **the CLI→API fallback notice treatment**~~
  **RESOLVED `[2026-07-28]`** — both were picked up by `/gsd-ui-phase 103` as predicted and are
  fully specified in `103-UI-SPEC.md` §11 (expensive/unknown-model ritual), §12 (CLI→API fallback
  toast: `sonner`, `--status-warn` tone, `ArrowRightLeft` icon), plus copy in the Copywriting
  Contract (lines 107, 108, 116) and the color contract (line 88). **No planning gap remains.**
  Note §12's explicit carve-out: badging the individual chat bubble with "(fallback)" is OUT of
  this phase's scope — no `ChatBubble` changes required.
- ~~**Header-badge behavior when profiles disagree on engine** (mixed global state)~~
  **RESOLVED `[2026-07-28]`** — `103-UI-SPEC.md` line 120 specifies "Mixed brains" + a stacked
  color-dot cluster, click-through opening the picker with the full per-profile breakdown, and
  line 144 carries the matching D-08 scope-reset exception for a picker opened from a mixed-state
  badge. **No planner's-call required.**

</deferred>

---

*Phase: 103-Brain-Swap Control Surface*
*Context gathered: 2026-07-27*
