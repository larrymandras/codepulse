# Phase 103: Brain-Swap Control Surface - Context

**Gathered:** 2026-07-27
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
## BSC-05 Reframing — the backend does not exist (verified 2026-07-27)

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
> **BSC-05 (as executed):** The client contract is published as a deliverable (`103-CONTRACT.md`),
> the stub adapter provably conforms to it, and the surface degrades honestly when the backend is
> absent. Live end-to-end verification against astridr moves to a follow-on gate, closed when
> astridr Phase 184.1 ships.

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
- **D-05:** Primary switcher = **chat composer pill + header badge** (design spec §7 items 1 and 3):
  a compact brain pill in `src/components/ChatInput.tsx` opening the rich picker, plus an
  always-visible active-brain badge in the `DashboardLayout` status cluster.
- **D-06:** The per-profile live view **replaces the existing stale rows in place**. Settings →
  Agents (`src/pages/Settings.tsx:630-678`) already renders one row per profile showing
  `{p.profileId} / {p.model}` at line 663 — that `agentProfiles.model` is a synced config field,
  i.e. precisely the stale read BSC-01 forbids. Swap it for the live reactive engine and add a
  swap affordance to the row. Do NOT build a parallel per-profile view that leaves the stale one
  on screen.
- **D-07:** Picker is **grouped: Subscription / API / Local**, fuzzy-searchable over the open
  registry. Each row = color dot · name · billing chip · health dot · quota bar (design spec §7
  item 2).
- **D-08:** Global scope is a **mode inside the same picker**, not a separate place: an explicit
  `This profile` / `All profiles` scope selector that **resets to profile scope every time the
  picker opens** and must be moved deliberately.

### Global-Swap Ritual (BSC-03)
- **D-09:** Confirmation is a **modal that lists what actually changes** — every affected profile
  with `current → new` engine per row. The friction is informational, not ceremonial (no
  type-to-confirm). The modal doubles as the preview of what a revert would undo.
- **D-10:** A global swap is **revertible**: snapshot each profile's prior engine before firing,
  and offer `Revert global swap` (in the success toast and until the next swap supersedes it).
- **D-11:** Pinned defaults are **overwritten, but recorded**. Global means global — every profile
  moves — and the snapshot records which engines were *pinned* vs *inherited* so a revert restores
  the exact prior state **including pin status**. The confirm modal flags
  "N profiles have pinned defaults that will be overwritten."
- **D-12:** Partial failure yields an **honest per-profile result** — N switched / M failed with
  reasons; failed rows keep displaying their real, unchanged engine. No all-or-nothing rollback
  (a rollback that itself fails produces a worse state). This is BSC-04 applied per row rather
  than per batch.

### Status, Readback & the Stub Seam (BSC-04)
- **D-13:** Dispatch is a **WS command via `useCommandDispatch`** — `gateway.model.set`
  (`{ profileId | scope, model, … }`), mirroring the proven `gateway.provider.set_enabled`
  pattern. The ack channel carries status/error and `useCommandDispatch` already wires sonner
  toasts on both outcomes.
- **D-14:** The **resulting active engine comes from Convex-reactive telemetry**, not from the ack.
  Ástríðr emits the active engine → Convex table → `useQuery`. The UI never asserts the engine
  itself; it renders only what the backend reported. This makes BSC-01's "reactive, not a stale
  config read" structurally true and gives the swap and the view one shared truth.
- **D-15:** In-flight = **pending overlay, old engine stays truth**. The pill keeps showing the
  actually-active engine with a distinct `switching to X…` treatment layered on top. On failure
  the pending state simply drops — there is nothing to roll back because the UI never claimed the
  swap succeeded. **No optimistic switching** (BSC-04 forbids it; Phase 100 already cost a code
  review round on optimistic pending-state/commandId reconciliation).
- **D-16:** **One adapter + env flag** for the stub seam. All brain traffic goes through a single
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
- **Expensive/unknown-model warn+confirm ritual** and **the CLI→API fallback notice treatment** —
  raised as candidate gray areas, not discussed. Both are required by the design spec (§6) and
  should be picked up during `/gsd-ui-phase 103` or planning.
- **Header-badge behavior when profiles disagree on engine** (mixed global state) — not discussed;
  planner's call, informed by D-08/D-11.

</deferred>

---

*Phase: 103-Brain-Swap Control Surface*
*Context gathered: 2026-07-27*
