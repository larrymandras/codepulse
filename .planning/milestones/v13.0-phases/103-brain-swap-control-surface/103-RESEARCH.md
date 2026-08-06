# Phase 103: Brain-Swap Control Surface - Research

**Researched:** 2026-07-28
**Domain:** CodePulse (React/Convex) client contract + UI for a not-yet-built astridr backend; cross-repo verification against `astridr-repo` (read-only)
**Confidence:** MEDIUM — the CodePulse-side architecture findings are HIGH (grounded in live code, file:line evidence throughout). The astridr-side contract recommendations are MEDIUM (grounded in real, currently-shipped adjacent code, but propose NEW shapes for infrastructure that does not exist yet — Phase 184.1 will make the final call).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Swap Scope & Persistence**
- **D-01:** The swap unit is the **persona / profile** — `profileConfigs.profileId` + `modelPreferences` (mirrored by `agentProfiles`). "Per agent" in ROADMAP/BSC language means *per profile*. `agents.agentId` is per-run read-only telemetry and is NOT a swap target; astridr has no seam to re-brain a running agent.
- **D-02:** The surface exposes **both** a temporary session swap (1h TTL, astridr's `set_session_override` / `/model use`) **and** a sticky per-profile pinned default (`/model default`). Matches design spec D4. The UI must make clear **which of the two is currently in force** so a temporary override never reads as permanent.
- **D-03:** **Ástríðr owns the persisted default** (Supabase, per design spec D4 parity with `agent_model_defaults`). CodePulse dispatches the change and reads the result back — it does NOT hold its own authoritative copy. This deliberately overrides CodePulse's usual "Convex-first, then dispatch" convention, because two stores would reproduce the exact stale-config divergence BSC-01 exists to kill.
- **D-04:** The `--agentic` per-CLI-brain toggle (design spec D2 hybrid mode) is **deferred**. This phase ships CLI brains in **text mode only**. The text-mode fallback notice (a tool-needing turn silently falls back to an API model) still must be surfaced honestly.

**Control Placement**
- **D-05:** Primary switcher = **chat composer pill + header badge** (design spec §7 items 1 and 3): a compact brain pill in `src/components/ChatInput.tsx` opening the rich picker, plus an always-visible active-brain badge in the `DashboardLayout` status cluster.
- **D-06:** The per-profile live view **replaces the existing stale rows in place**. Settings → Agents (`src/pages/Settings.tsx:630-678`) already renders one row per profile showing `{p.profileId} / {p.model}` at line 663 — that `agentProfiles.model` is a synced config field, i.e. precisely the stale read BSC-01 forbids. Swap it for the live reactive engine and add a swap affordance to the row. Do NOT build a parallel per-profile view that leaves the stale one on screen.
- **D-07:** Picker is **grouped: Subscription / API / Local**, fuzzy-searchable over the open registry. Each row = color dot · name · billing chip · health dot · quota bar (design spec §7 item 2).
- **D-08:** Global scope is a **mode inside the same picker**, not a separate place: an explicit `This profile` / `All profiles` scope selector that **resets to profile scope every time the picker opens** and must be moved deliberately.

**Global-Swap Ritual (BSC-03)**
- **D-09:** Confirmation is a **modal that lists what actually changes** — every affected profile with `current → new` engine per row. The friction is informational, not ceremonial (no type-to-confirm). The modal doubles as the preview of what a revert would undo.
- **D-10:** A global swap is **revertible**: snapshot each profile's prior engine before firing, and offer `Revert global swap` (in the success toast and until the next swap supersedes it).
- **D-11:** Pinned defaults are **overwritten, but recorded**. Global means global — every profile moves — and the snapshot records which engines were *pinned* vs *inherited* so a revert restores the exact prior state **including pin status**. The confirm modal flags "N profiles have pinned defaults that will be overwritten."
- **D-12:** Partial failure yields an **honest per-profile result** — N switched / M failed with reasons; failed rows keep displaying their real, unchanged engine. No all-or-nothing rollback (a rollback that itself fails produces a worse state). This is BSC-04 applied per row rather than per batch.

**Status, Readback & the Stub Seam (BSC-04)**
- **D-13:** Dispatch is a **WS command via `useCommandDispatch`** — `gateway.model.set` (`{ profileId | scope, model, … }`), mirroring the proven `gateway.provider.set_enabled` pattern. The ack channel carries status/error and `useCommandDispatch` already wires sonner toasts on both outcomes.
- **D-14:** The **resulting active engine comes from Convex-reactive telemetry**, not from the ack. Ástríðr emits the active engine → Convex table → `useQuery`. The UI never asserts the engine itself; it renders only what the backend reported. This makes BSC-01's "reactive, not a stale config read" structurally true and gives the swap and the view one shared truth.
- **D-15:** In-flight = **pending overlay, old engine stays truth**. The pill keeps showing the actually-active engine with a distinct `switching to X…` treatment layered on top. On failure the pending state simply drops — there is nothing to roll back because the UI never claimed the swap succeeded. **No optimistic switching** (BSC-04 forbids it; Phase 100 already cost a code review round on optimistic pending-state/commandId reconciliation).
- **D-16:** **One adapter + env flag** for the stub seam. All brain traffic goes through a single module (e.g. `src/lib/brainsApi.ts`) exposing one interface with two implementations — stub and live — selected by a `VITE_` flag. Everything above the seam is written against the real contract, so going live is a flag flip plus one module, not a rewrite. The stub must be visibly identifiable as stub data in the UI so it can never be mistaken for a live reading.
- **D-17:** Phase 103 **ships `103-CONTRACT.md`** as a real deliverable: the concrete message shapes for `gateway.model.set` (+ `set_default`), the brain-catalog payload (`/api/models` / `models.catalog`), and the active-engine telemetry event. Astridr Phase 184.1 implements against this document rather than guessing. The stub adapter must provably conform to it.

### Claude's Discretion
- Exact component decomposition of the picker (single component vs picker + row + scope selector).
- Naming of the adapter module, the env flag, and the Convex table/field carrying the active engine.
- Visual treatment of the pending overlay, the stub-data indicator, and the billing/health/quota chips (subject to `/gsd-ui-phase 103`, already resolved — see UI-SPEC).
- Whether the brain-catalog read is REST or a WS event — D-13 fixes only the *write* transport; pick whichever makes the contract cleaner and note it in `103-CONTRACT.md`.

### Deferred Ideas (OUT OF SCOPE)
- **Astridr Phase 184.1 itself** — `GatewayProvider`, `model_registry`, the `/model` command expansion, the affinity/mis-route fix, and the REST/WS surface. Belongs in `astridr-repo`, built against this phase's `103-CONTRACT.md`. This is the blocking follow-on for live BSC-05.
- **Live end-to-end brain-swap verification** — the original BSC-05 wording. Closes only once 184.1 ships; track as a follow-on gate, not as satisfied by this phase.
- **`--agentic` CLI mode** (design spec D2 / §7 item 2) — per-brain agentic switch delegating the turn to the CLI's own tool loop. Deferred by D-04.
- **Voice / War Room brain-swap** — astridr Phase 185 (voice control verbs + wardrobe); voice swaps stay runtime-only per the locked rule. Out of CodePulse scope entirely. **IMPORTANT CORRECTION — see "Critical Discovery" section below: Phase 185 is not a future phase. It has already shipped, on this same branch, with its own live CodePulse UI. Treat this as existing adjacent infrastructure, not a hypothetical.**
- **Fix the broken `claude-sdk` gateway adapter** (missing `sdk-runner/run.js`) — design spec Follow-on Phase B, astridr-side.
- **Expensive/unknown-model warn+confirm ritual** and **the CLI→API fallback notice treatment** — raised in CONTEXT.md as candidate gray areas. **RESOLVED — see Q6 below: 103-UI-SPEC.md already specifies both. No planning gap remains.**
- **Header-badge behavior when profiles disagree on engine** (mixed global state) — raised in CONTEXT.md as undiscussed. **RESOLVED — see Q7 below: 103-UI-SPEC.md §2 already specifies "Mixed brains" treatment. No planning gap remains.**

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BSC-01 | Live view of current reasoning engine, per-profile AND globally, reactive from Convex/telemetry (not stale config) | See "Reactive Readback Path" (Q2) — the natural telemetry feed (`model_routing`) exists but is unwired (no profile scoping, no CodePulse ingest case); 103-CONTRACT.md must specify the fix. Settings.tsx's real per-profile source must be `profileConfigs` (via `api.profiles.listConfigs`), not the empty `agentProfiles` table — see "Critical Discovery #2". |
| BSC-02 | Switch engine on the fly, dispatched to astridr's brain-swap endpoint over authenticated `/api/*` | See "Contract Shapes" (Q1) — recommends WS dispatch (not REST) via a `gateway.model.set` command modeled on the REAL `SwapSetCommand`/`ConfigUpdateCommand` conventions in `ws_commands.py`, not the non-existent `gateway.provider.set_enabled` "precedent." |
| BSC-03 | Scope control: per-profile vs global, global requires explicit deliberate confirmation | See "Global Swap: Snapshot, Revert, Partial Failure" (Q5) — recommends client-side snapshot + client-side fan-out dispatch (N single-profile commands aggregated), not a new server-side batch command. |
| BSC-04 | Honest live status: in-flight → success/failure → resulting engine reconciled from astridr, never optimistic | See "Dispatch + Status Honesty" (Q4) — `useCommandDispatch`'s built-in success toast is NOT the same claim as "engine switched"; a separate reactive-diff toast is needed. D-15 already structurally forbids the Phase-100 commandId-reconciliation trap by design — the planner must resist re-introducing it. |
| BSC-05 (redefined) | Contract published + stub provably conforms + surface degrades honestly; live verification deferred | See "Validation Architecture" below — the stub/live honesty boundary is made explicit per claim. |

</phase_requirements>

## Summary

This phase is well-scoped by CONTEXT.md and its UI-SPEC is already checker-approved 6/6 — most of D-01 through D-17 have concrete, buildable answers grounded in this codebase's existing conventions (`useCommandDispatch`, `AstridrWSContext`, `SectionErrorBoundary`, the shadcn primitive set). The UI-SPEC has already resolved two of the three items CONTEXT.md flagged as open gray areas (the expensive-model ritual and the header-badge mixed state); only the CLI→API fallback notice needed no further resolution either, since it too is specified in UI-SPEC §12.

However, this research surfaced **four significant findings that were not visible to `/gsd-discuss-phase` or `/gsd-ui-phase`, all grounded in live code, that the planner must account for**:

1. **A separate, already-shipped, already-live brain-swap mechanism exists in this exact codebase** (astridr Phase 185/186, "voice control verbs" — `swap.set`/`swap.get_state`/`swap.catalogue` WS commands, `BrainControl.tsx`, `SwapBadge.tsx`, `VoiceControl.tsx`). It uses the same "Brain" vocabulary and Lucide icon, but is a **global, runtime-only, process-wide override** — structurally different from Phase 103's **per-profile, persisted** mechanism. These will coexist in the app and *can legitimately disagree at the same moment*. This is a real user-facing confusion risk that CONTEXT.md never mentions and the planner must explicitly reconcile.
2. **The "proven pattern" `gateway.provider.set_enabled`, cited in both the design spec and D-13 as the reference shape, does not exist anywhere in `astridr-repo`'s backend** (zero matches). It is dispatched client-side (`ProviderControls.tsx:188`) into a WS command dispatcher whose Pydantic discriminated union has no such type — so today it would round-trip a validation-error ack. `gateway.model.set` should be modeled on the REAL, working `SwapSetCommand`/`ConfigUpdateCommand` shape instead.
3. **`agentProfiles` (the table Settings.tsx currently renders and D-06 targets) is confirmed EMPTY in production** — `convex/profiles.ts:113` says so explicitly ("RESEARCH Assumption A1: agentProfiles has zero rows and is not the real persona-model change path"). The real, populated, live-synced per-profile source is `profileConfigs` (`api.profiles.listConfigs`). D-06's row list must be re-sourced accordingly.
4. **The composer-pill host named in D-05 (`ChatInput.tsx`) is used only by an unrelated feature** (`InsightsChat.tsx` — an LLM-over-telemetry Q&A tool with no profile concept) and the real Ástríðr chat page (`Chat.tsx`) is explicitly single-persona with its own inline composer and no profile switcher. There is currently no per-profile chat surface in this codebase for a "brain pill" to attach to with per-profile meaning. This is a genuine gap the planner must resolve (likely: descope/retarget D-05 item 1, or explicitly define which `profileId` the Chat page's composer would swap).

**Primary recommendation:** Build the contract and stub exactly as CONTEXT.md/UI-SPEC direct for D-06 through D-17 (these are solid), but before planning tasks: (a) explicitly reconcile the header badge/composer pill against the already-shipped SwapBadge/BrainControl mechanism, (b) re-source Settings.tsx's per-profile list from `profileConfigs` not `agentProfiles`, (c) get an explicit planner/user decision on where the composer pill actually lives given D-05 item 1's host doesn't exist as assumed, and (d) write `103-CONTRACT.md` against the real `ws_commands.py` conventions, not the unverified `gateway.provider.set_enabled` citation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Brain picker UI (composer pill, header badge, Settings row, modal) | Browser / Client (React) | — | Pure presentation + local interaction state; no server logic lives here |
| Swap dispatch (`gateway.model.set`) | API / Backend (astridr, not built) | Browser (stub simulation) | The actual model-router mutation is astridr's; CodePulse only sends the request and renders the result |
| Active-engine truth | Database / Storage (Convex, fed by astridr telemetry) | API / Backend (astridr emits it) | BSC-01's entire point is that the UI is a *reader* of this tier, never a computer of it |
| Brain catalogue (reachable models/CLIs) | API / Backend (astridr — health/quota/registry) | Browser (stub simulation) | Requires live provider-key + CLI-health knowledge only astridr has |
| Stub/live seam | Browser / Client (`src/lib/brainsApi.ts`) | — | A build-time/env-time switch, not a runtime service boundary |
| Global-swap snapshot for revert | Browser / Client (in-memory, tab-scoped) | — | D-03 explicitly forbids CodePulse from holding its own authoritative copy of the *persisted* default; a short-lived revert pointer is not that — see Q5 |
| Config audit trail (`configChanges`) | Database / Storage (Convex) | — | Existing, already wired for `modelPreferences` changes (`convex/profiles.ts:109-127`) — free side-effect, not something this phase builds |

## Critical Discovery: An Adjacent Brain-Swap Mechanism Already Exists and Ships Live

This was not in CONTEXT.md's `<code_context>` and must inform planning.

`astridr-repo` is currently on branch `feature/brain-swap`, which already contains **Phase 185 ("Voice Control Verbs — Brain Hot-Swap & Wardrobe") and Phase 186, both marked `[x]` complete** in `astridr-repo/.planning/ROADMAP.md:27,299-314`. This shipped a **fully separate, fully live** brain-swap mechanism:

- **Backend:** `astridr/engine/control_verbs/swap_model.py` — a `ControlVerb` that resolves a spoken/typed target ("try on grok", "switch your brain to sonnet") to a model id and calls `ModelRouter.set_global_override(resolved, source="voice-swap")` (swap_model.py:493). Restore calls `_router.clear_global_override()` (swap_model.py:432). This is wired into `ModelRouter._resolve_model()` as rung **1b**, ahead of session overrides (`astridr/providers/router.py:441-447`, `selection_path == "global-swap-override"`).
- **WS command surface (real, working, in `astridr/api/ws_commands.py`):**
  - `swap.get_state` (line 199-208) — read-only pull of the in-memory override, sourced purely from `ModelRouter`'s global override + voice's runtime slot, **never** config/YAML (its own docstring: "a restart resets both to default, so there is nothing to persist here").
  - `swap.set` (line 224-240) — manual brain/voice selection from CodePulse's control-center dropdowns; looks up `swap_model`/`swap_voice` in `VERB_REGISTRY` and calls the exact same `execute()` a spoken command would (`_handle_swap_set`, line 1075-1123) — "not a parallel mutation path."
  - `swap.catalogue` (line 242-256) — read-only live catalogue for the dropdowns; Claude tiers first (from `swap_model._CLAUDE_TIER_MAP`), then the live OpenRouter catalogue sorted `(vendor, name)` (`_handle_swap_catalogue`, line 1125-1198).
  - A live push (`swap.state` event) fires after every swap so open tabs update immediately (`ws_commands.py:693,1115`).
- **CodePulse-side UI (real, shipped, live today):**
  - `src/components/voice/SwapBadge.tsx` — a top-bar read-only "Brain: {name}" pill (Lucide `Brain` icon), shown always; accent-styled when an override is active, muted "Brain: Auto" otherwise. Mounted in `Chat.tsx` (the single-persona Ástríðr page), seeded via `swap.get_state` on connect and kept live via `swap.state` (`Chat.tsx:171-232`).
  - `src/components/control-center/BrainControl.tsx` — an interactive popover (fuzzy-filterable, vendor-grouped) that dispatches `swap.set`/fetches `swap.catalogue`, mounted in `ControlCenterPanel.tsx` on the Chat page.
  - `src/components/control-center/VoiceControl.tsx` — the voice analog.

**Why this matters for Phase 103 planning:**

1. **These are two axes, not one.** The existing mechanism is a single **global, in-memory, runtime-only** override (`ModelRouter._global_model_override`) that applies to every turn regardless of profile, resets on restart, and has no persistence. Phase 103's D-01/D-02/D-03 mechanism is **per-profile, session-or-sticky, Supabase-persisted**. Both can be true at once for the same backend process — e.g. a voice-triggered global override active while a completely different per-profile pinned default sits underneath it, invisible until the override clears. `_resolve_model()`'s resolution order (`router.py:429-472`) actually encodes this exactly: explicit → **global-swap-override (1b)** → session override (2) → codepulse-agent-default (3) → category rule (4) → fallback (5). A Phase-103-set per-profile default at rung 3 would be **silently shadowed** by an active Phase-185 global override at rung 1b, and the UI has no way to represent that today.
2. **Vocabulary/icon collision.** Both surfaces will say "Brain: {name}" using the same Lucide `Brain` icon (`SwapBadge.tsx:60`, `BrainControl.tsx:200`) in the same app, but mean different things. UI-SPEC 103 does not reuse the `Brain` icon (it uses generic color dots) and was authored without visibility into this precedent — recommend the planner explicitly decide whether Phase 103's controls should reuse `Brain` (for icon-vocabulary consistency) or deliberately differentiate (to avoid implying they're the same control).
3. **No location collision today** — `SwapBadge`/`BrainControl` are scoped to the Chat page only (not `DashboardLayout`), so Phase 103's new `DashboardLayout` header badge (D-05 item 2) does not literally overlap on screen. But a user on the Chat page will see BOTH a Chat-page-scoped "Brain: Auto" pill (global runtime override) and, once built, a DashboardLayout-scoped brain badge (per-profile) simultaneously, potentially showing different things.
4. This is flagged as an **Open Question** below (not a blocker) because none of D-01..D-17 are technically impossible — but the planner should treat "reconcile with the existing SwapBadge/BrainControl mechanism" as an explicit task, not an afterthought discovered mid-implementation.

## Standard Stack

No new external packages are required. Every primitive Phase 103 needs is already installed (per `103-UI-SPEC.md` "Registry Safety" — `popover`, `command` (cmdk), `toggle-group`, `dialog`, `badge`, `progress`, `scroll-area`, `tooltip`, all under `src/components/ui/`) and every data-layer pattern (Convex `useQuery`, `useCommandDispatch`, `sonner`) is already in use elsewhere in this codebase.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cmdk` (via `ui/command.tsx`) | already installed | Fuzzy-searchable grouped list (D-07) | Already the picker primitive for `CommandPalette.tsx`/`SkillCommandPalette.tsx` — reuse, don't reinstall |
| Convex `useQuery`/`useMutation` | already installed | Reactive active-engine read (D-14) | Existing project-wide data pattern |
| `sonner` (toast) | already installed | Swap accept/reject/revert notifications | Already wired into `useCommandDispatch` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| REST `/api/models` catalogue read | WS `models.catalog`/reuse-shaped `swap.catalogue` pattern | See Q1(b) — recommend WS; avoids a second auth path and has a real, working precedent (`swap.catalogue`) to model after |
| Server-side global-swap fan-out command | Client-side dispatch of N single-profile commands, aggregated | See Q5 — avoids requiring Phase 184.1 to build batch semantics in its first cut; naturally satisfies D-12's per-row honesty |

**Installation:** none required.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new npm/PyPI/cargo packages. All UI primitives and data patterns are already installed and in use elsewhere in this repository (confirmed via `103-UI-SPEC.md`'s own Registry Safety table and direct inspection of `src/components/ui/`). No `slopcheck`/registry verification gate is triggered.

## Architecture Patterns

### System Architecture Diagram

```
 Operator (browser)
       │
       ▼
 ┌─────────────────────────────┐        VITE_BRAINS_STUB flag (D-16)
 │  Brain picker / pill /      │◄──────────────────────────────┐
 │  header badge / Settings row│                                │
 └──────────────┬──────────────┘                                │
                 │ calls                                          │
                 ▼                                                │
       ┌───────────────────┐        ┌───────────────────────┐    │
       │ src/lib/brainsApi │─stub──►│ in-memory fake catalog│────┘
       │  (one interface,  │        │ + fake pending/latency│
       │   two impls)      │        └───────────────────────┘
       └─────────┬─────────┘
                  │ live
                  ▼
   ┌────────────────────────────────┐
   │ useCommandDispatch (existing)  │──dispatch──► AstridrWSContext.sendCommand
   │  gateway.model.set             │              (ws://…/ws/telemetry, bearer)
   └────────────────────────────────┘                     │
                                                             ▼
                                              ┌──────────────────────────┐
                                              │ astridr CommandDispatcher │  ◄── DOES NOT EXIST YET
                                              │ (Phase 184.1, per         │      (this phase stubs it;
                                              │  103-CONTRACT.md)         │       184.1 implements it)
                                              └──────────────┬────────────┘
                                                              │ emits (new/extended event)
                                                              ▼
                                              ┌──────────────────────────┐
                                              │ convex/runtimeIngest.ts  │  ◄── needs a NEW case
                                              │  case "model_routing"?  │      (does not exist yet)
                                              └──────────────┬────────────┘
                                                              ▼
                                              ┌──────────────────────────┐
                                              │ new Convex table         │
                                              │ (active engine, per      │
                                              │  profileId, latest-wins) │
                                              └──────────────┬────────────┘
                                                              ▼
                                              useQuery(api.<table>.latestByProfile)
                                                              │
                                                              ▼
                                          same picker/pill/badge/Settings row
                                          (this is the ONLY path that ever
                                           updates the displayed engine — D-14)
```

### Recommended Project Structure
```
src/
├── lib/
│   └── brainsApi.ts          # D-16 seam: BrainsAdapter interface, stub + live impls, VITE_ flag
├── hooks/
│   └── useActiveEngine.ts    # wraps useQuery(api.<newTable>.latestByProfile) — per-profile map + isMixed
├── components/
│   └── brains/
│       ├── BrainPicker.tsx           # D-07 grouped/fuzzy picker (Popover + Command)
│       ├── BrainPickerRow.tsx        # dot/name/billing/health/quota row + inline expensive-tier expansion
│       ├── GlobalSwapModal.tsx       # D-09/D-11/D-12 confirm→result Dialog
│       └── BrainHeaderBadge.tsx      # D-05 item 2, DashboardLayout status cluster
convex/
├── activeEngine.ts            # NEW: ingest write + latestByProfile query (models gatewayQuota.ts's dedup pattern)
└── schema.ts                  # NEW table (append-only migration — safe under self-hosted Convex rules)
```

### Pattern 1: Adapter Seam (D-16)
**What:** One `BrainsAdapter` TypeScript interface, two implementations (`stubBrainsAdapter`, `liveBrainsAdapter`), selected once at module load by an env flag — never per-call.
**When to use:** Any time the astridr-side contract this UI depends on does not exist yet.
**Precedent in this codebase:** `src/lib/astridrApi.ts:1-2` reads `import.meta.env.VITE_ASTRIDR_API_URL`/`VITE_ASTRIDR_API_KEY` once, at module scope, not per-call — follow the identical idiom for the new flag. The closest *behavioral* precedent for env-flag-gated conditional behavior in this codebase is Clerk auth (`CLAUDE.md`: "Optional Clerk auth (gracefully skipped if `VITE_CLERK_PUBLISHABLE_KEY` not set)") — note this is a single-branch skip, not a full two-implementation adapter, so treat "one interface, two implementations" as a new-to-this-codebase pattern (not a well-worn one) and be correspondingly careful with its tests.
```typescript
// src/lib/brainsApi.ts (recommended shape)
export interface BrainsAdapter {
  isStub: boolean;
  getCatalogue(): Promise<CatalogueEntry[]>;
  dispatchSwap(cmd: GatewayModelSetCommand): Promise<AckResponse>;
}
const BRAINS_STUB = (import.meta.env.VITE_BRAINS_STUB as string | undefined) === "true";
export const BRAINS_STUB_ACTIVE = BRAINS_STUB; // single source of truth for the STUB chip/banner (D-16)
export const brainsApi: BrainsAdapter = BRAINS_STUB ? stubBrainsAdapter : liveBrainsAdapter;
```

### Pattern 2: Latest-Per-Key Reactive Table (for D-14's active-engine table)
**What:** A table that stores one row per event, deduplicated client- or query-side to "most recent per key."
**When to use:** Exactly this phase's active-engine-per-profile need.
**Existing precedent to copy verbatim:** `convex/gatewayQuota.ts:15-25` (`deduplicateByProvider`) + `:123-134` (`latestByProvider` query, `order("desc").take(100)` then dedupe). Recommend the new active-engine table/query be a straight rename of this exact pattern (`deduplicateByProfile` / `latestByProfile`), including the same "current-only, no history" comment (`gatewayQuota.ts:121`).

### Anti-Patterns to Avoid
- **Treating `gateway.provider.set_enabled` as a proven reference shape.** It is dispatched client-side (`ProviderControls.tsx:188`) but has **zero matches** anywhere in `astridr-repo`'s Python code — no Pydantic command, no handler. Model `gateway.model.set` on the REAL `SwapSetCommand`/`ConfigUpdateCommand` conventions in `ws_commands.py` instead.
- **Re-introducing Phase 100's commandId reconciliation.** D-15 already avoids this by design (truth is a plain "latest wins" reactive query, not a per-command state machine) — do not add commandId tracking "for extra safety"; it reintroduces exactly the class of bug that cost two Critical review findings last time.
- **Assuming `agentProfiles` is a live data source.** It is confirmed empty in production (`convex/profiles.ts:113`). Any per-profile list must be built from `profileConfigs` (`api.profiles.listConfigs`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Quota bar | A custom div-based bar | shadcn `Progress` primitive (already flagged by UI-SPEC §3) | `GatewayQuotaPanel.tsx`'s existing bar is hand-rolled and explicitly called out in UI-SPEC as legacy — don't extend that pattern, use `progress.tsx` |
| Fuzzy search over ~300 catalogue entries | A custom filter | `cmdk`'s built-in fuzzy matching (already used by `CommandPalette.tsx`/`BrainControl.tsx`'s own type-to-filter `Input`) | `BrainControl.tsx:26-27` documents this exact scale problem was already hit and solved once (widened popover, added filter input) — same catalogue size applies here |
| "Latest value per key" dedup | A bespoke reducer | Copy `gatewayQuota.ts`'s `deduplicateByProvider` pattern verbatim | Already tested, already the established idiom for exactly this shape in this codebase |
| Global-swap partial-failure aggregation | A new server-side batch endpoint | `Promise.allSettled` over N client-dispatched single-profile commands | Avoids requiring Phase 184.1 to design batch semantics in its very first cut; matches D-12 exactly |

**Key insight:** Every mechanical piece this phase needs (dedup-latest-by-key, fuzzy grouped search, quota bars, WS command dispatch with toast) already has a working, tested precedent in this exact codebase. The actual work is composition + the one genuinely new thing (the stub/live adapter seam), not new infrastructure.

## Common Pitfalls

### Pitfall 1: Colliding with the shipped Phase 185/186 brain-swap mechanism
**What goes wrong:** A user sees two different "Brain: X" indicators (Chat-page `SwapBadge`, DashboardLayout header badge) disagree, and concludes the app is broken.
**Why it happens:** They are genuinely different axes (global runtime override vs per-profile persisted default) that CONTEXT.md never cross-referenced.
**How to avoid:** Explicitly label/reconcile in planning — at minimum, the DashboardLayout badge's tooltip should make clear it reflects the *profile* default, distinct from any active voice/text global override. Consider whether the global-override rung (`router.py:441-447`, `selection_path == "global-swap-override"`) shadowing a profile default is something Phase 103's UI should surface at all (an open question, see below).
**Warning signs:** QA seeing "wrong" engine shown in one surface vs another when a voice/text `swap_model` command was recently used.

### Pitfall 2: `agentProfiles`-sourced UI silently rendering nothing
**What goes wrong:** Building D-06's replacement row list against `useAgentProfiles()` (backed by the empty `agentProfiles` table) instead of `profileConfigs`.
**Why it happens:** D-06's own text says "mirrored by `agentProfiles`" and Settings.tsx already queries it — easy to keep using the same source out of inertia.
**How to avoid:** Source the profile list from `api.profiles.listConfigs` (real, populated, `convex/profiles.ts:188-197`); use `agentProfiles` only as an optional join for `displayName`/`avatarId` when present.
**Warning signs:** Empty or near-empty per-profile list in a dev/stub environment that should show multiple profiles.

### Pitfall 3: cmdk duplicate-value selection bug
**What goes wrong:** Two catalogue rows with the same *display name* (e.g. a Claude tier entry and an OpenRouter-native Anthropic duplicate) share a `CommandItem value`, causing double-highlight and an ArrowDown navigation loop.
**Why it happens:** Documented project memory (`cmdk-and-global-hotkey-gotchas.md`): cmdk selection is value-keyed, not index-keyed.
**How to avoid:** Always set `<CommandItem value={entry.id}>` (the catalogue's unique id), never `entry.name`. Note `_handle_swap_catalogue` (`ws_commands.py:1181`) already explicitly excludes OpenRouter's duplicate `anthropic/...` entries for exactly this class of collision on the *existing* brain catalogue — the new `/api/models`-equivalent catalogue for Phase 103 should document the same exclusion rule in `103-CONTRACT.md`.
**Warning signs:** Arrow-key navigation "sticking" or highlighting two rows in the picker during manual QA.

### Pitfall 4: Global hotkey collision
**What goes wrong:** Binding a keyboard shortcut to open the brain picker that collides with existing global hotkeys.
**Why it happens:** `Ctrl+K`/`Cmd+K` is owned by `DashboardLayout.tsx:447` (command palette) and `Ctrl+Shift+K` is owned by `SkillCommandPalette.tsx:53` (skills palette) — both already taken, confirmed live in code.
**How to avoid:** Per D-05/UI-SPEC, the picker opens by click only (no keyboard shortcut is specified or needed) — do not add one without checking both files first.
**Warning signs:** N/A if no new hotkey is added — this is a straightforward "don't."

### Pitfall 5: `useQuery` throwing unmounts the whole page
**What goes wrong:** A malformed/missing active-engine query throws inside `useQuery`, blanking every page that renders the new header badge (which is dashboard-wide, i.e. every page).
**Why it happens:** Documented project-wide Convex hazard (CLAUDE.md/MEMORY notes; also the exact "v9.0 VitalsRail active-profile trap" BSC-01 itself names).
**How to avoid:** `useQuery(api.activeEngine.latestByProfile) ?? {}` (never let it return `undefined`/throw uncaught) and wrap the header badge, Settings row, and picker in `SectionErrorBoundary`, per existing project convention.
**Warning signs:** A missing/renamed Convex function or schema field regressing every page at once, not just the brain surfaces.

## Code Examples

### Existing command dispatch pattern (to reuse, not reinvent)
```typescript
// Source: src/hooks/useCommandDispatch.ts (33 lines, verbatim)
export function useCommandDispatch() {
  const { sendCommand, status } = useAstridrWS();
  const dispatch = useCallback(
    async (cmd: Record<string, unknown>, successMsg?: string): Promise<AckResponse> => {
      const result = await sendCommand(cmd);
      if (result.status === "ok" && successMsg) toast.success(successMsg);
      if (result.status === "error") toast.error(result.error ?? "Command failed");
      return result;
    },
    [sendCommand]
  );
  return { dispatch, isConnected: status === "connected" };
}
```
**Recommendation for Phase 103:** do NOT pass a `successMsg` to `dispatch()` for `gateway.model.set` — "ok" here means "accepted," not "engine switched" (D-14). Fire the real "{Profile} switched to {Engine}" toast from a separate effect that diffs the previous vs. new value of the reactive active-engine query (see Q4 below).

### Real, working WS command shape to model `gateway.model.set` after
```python
# Source: astridr-repo/astridr/api/ws_commands.py:224-240 (SwapSetCommand, real & shipped)
class SwapSetCommand(BaseModel):
    type: Literal["swap.set"] = "swap.set"
    request_id: str = ""
    target: Literal["brain", "voice"]
    value: str | None = None
    restore: bool = False
```
**Recommendation:** `gateway.model.set` should follow this exact idiom (Pydantic discriminated union member, `type` Literal + `request_id`, a small enum-like discriminator field) rather than the unverified `gateway.provider.set_enabled` shape. See Q1 for the full proposed schema.

### Latest-per-key dedup pattern to copy for the new active-engine table
```typescript
// Source: convex/gatewayQuota.ts:15-25, verbatim
export function deduplicateByProvider<T extends { provider: string; timestamp: number }>(
  rows: T[]
): T[] {
  const byProvider = new Map<string, T>();
  for (const row of rows) {
    if (!byProvider.has(row.provider)) byProvider.set(row.provider, row);
  }
  return Array.from(byProvider.values());
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Static `ALLOWED_MODELS` allowlist gate (`engine/model_defaults.py:50`) | Design spec's open dynamic registry (`model_registry.py`, not yet built) | Proposed 2026-07-17, not yet implemented | Phase 103's picker must be built against an OPEN catalogue contract even though today's astridr backend still gates on the static set for its own `/model use` command |
| `agentProfiles.model` (static, synced) | `profileConfigs.modelPreferences` (live-synced from astridr) + a new reactive active-engine table (D-14, doesn't exist yet) | Ongoing (this phase is part of the transition) | D-06 is precisely this migration for the Settings surface |
| Global-only runtime brain override (Phase 185/186, shipped) | Per-profile persisted default + session override (Phase 103/184.1, this contract) | Phase 185/186 shipped already; 184.1 not started | Two coexisting mechanisms — see "Critical Discovery" |

**Deprecated/outdated:** None of the astridr-side static gating is deprecated yet — Phase 184.1 has not shipped, so `ALLOWED_MODELS`/`MODEL_PROVIDER_AFFINITY` are still the live, active gate for `/model use` today. Do not write CodePulse code that assumes the open registry already exists on the backend.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The composer pill (D-05 item 1) has no clean current-code host and should be retargeted or explicitly deferred pending a per-profile chat surface decision | Critical Discovery / Q8 landmine #8 | If wrong (i.e. a per-profile chat surface does exist that this research missed), the planner would unnecessarily descope a requirement; verify with a repo-wide search for a per-profile chat UI before finalizing the plan |
| A2 | `gateway.provider.set_enabled` has no server-side handler and would currently error if dispatched live | Critical Discovery #2, Pitfall/Anti-pattern | If wrong (a handler exists elsewhere not found by this grep — e.g. a legacy dispatcher file not searched), the "don't model after it" recommendation is overcautious but not harmful; the recommended alternative (`SwapSetCommand`-style) is safe either way |
| A3 | The new active-engine table should be a new Convex table (not an extension of `profileConfigs`) | Q1(c)/Q2 | If wrong, and the planner instead extends `profileConfigs` with a live field, that would violate D-03 ("CodePulse does NOT hold its own authoritative copy") less directly, but risks conflating the *persisted default* (Ástríðr-owned) with the *live resolved engine* (telemetry-owned) in one table — recommend keeping them separate regardless |
| A4 | Client-side fan-out (N single-profile commands + `Promise.allSettled`) is preferable to a server-side batch command for the global swap | Q5 | If Phase 184.1 later decides server-side fan-out is required for atomicity/perf reasons, the contract would need a v2 addition — low risk since this is an additive change, not a breaking one |
| A5 | The `model_routing` telemetry event is the intended feed for D-14, rather than an entirely new event name | Q1(c)/Q2 | If Phase 184.1 instead introduces a dedicated `gateway.model_active`-style event, 103-CONTRACT.md's exact field names would need adjustment — the underlying ingest-case-and-new-table architecture recommendation stands regardless of the final event name |

**If this table is empty:** N/A — see entries above.

## Open Questions (RESOLVED)

> All three resolved during `/gsd-plan-phase 103` on 2026-07-28. Original text retained below each
> question; the resolution is stated inline first.

**OQ1 — RESOLVED (operator, 2026-07-28): accept the shadowing, do not render it.** Phase 103's UI
surfaces the per-profile default and does **not** attempt to show that a live global override is
shadowing it. Rationale: the per-profile axis is stub-backed this phase, so the conflict cannot
manifest for real until astridr Phase 184.1 ships a live per-profile mechanism. The interaction is
recorded in `103-CONTRACT.md` (item 9) so 184.1 does not rediscover it. **Carry-forward risk,
stated plainly:** once 184.1 is live, showing a per-profile default as though it were the running
engine while a global override is in force is the v9.0 VitalsRail stale-config trap in a new
costume — the exact failure BSC-01 exists to kill. Revisit at that gate, not before.

**OQ2 — RESOLVED (operator, 2026-07-28): the composer pill goes on `src/pages/Chat.tsx`.**
`ChatInput.tsx` was the wrong host (imported solely by the unrelated `InsightsChat.tsx`).
Carried into `103-07-PLAN.md` `<host_correction>`; `ChatInput.tsx` / `InsightsChat.tsx` are
explicitly off-limits. Profile scope for the pill comes from `default_profile_id` on the catalogue
ack (`103-CONTRACT.md` §3) — no CodePulse-side active-profile mechanism was invented.

**OQ3 — RESOLVED (planner): one command with a `mode` discriminator.** `103-01-PLAN.md:118-119`
specifies a single `gateway.model.set` carrying `mode`, matching the real shipped precedent
(`SwapSetCommand`'s `restore` flag) rather than the design spec's two literal command types.
Flagged in the contract as a recommendation, since Phase 184.1 is out of this phase's control.

---

*Original open questions, retained for the record:*

1. **How should Phase 103's UI represent an active Phase-185/186 global voice/text override shadowing a profile's own default?**
   - What we know: `_resolve_model()`'s resolution order places the global override (rung 1b) ahead of the profile default (rung 3) — a profile's Phase-103-set default can be silently inactive whenever a global override is in force.
   - What's unclear: whether the operator needs to *see* this shadowing in the new UI at all, or whether it's acceptable for Phase 103's badge to show "what would be active if no global override existed" (i.e., the profile default) and let `SwapBadge`/`BrainControl` on the Chat page be the sole indicator of the override.
   - Recommendation: raise explicitly with the user before task breakdown — this is a product decision, not a technical one. At minimum, 103-CONTRACT.md should note the interaction exists so Phase 184.1 doesn't have to rediscover it.

2. **Where does the composer pill (D-05 item 1) actually live?**
   - What we know: `ChatInput.tsx` is used only by `InsightsChat.tsx` (unrelated feature); the actual Ástríðr chat page (`Chat.tsx`) is explicitly single-persona with no profile concept and its own inline composer (no `ChatInput.tsx` reuse, no skill-chip row at or near line 494).
   - What's unclear: whether the intent was ever a literal `ChatInput.tsx` edit, or whether "composer pill" should be reinterpreted as "wherever a profile-scoped task/message composer exists" (e.g. `RunAstridrPopover.tsx`/`RunTargetChooser.tsx`, which do carry a `profile` field per `src/pages/Executions.tsx`/`src/components/skills/RunTargetChooser.tsx` grep hits) or should simply be deferred until such a surface exists.
   - Recommendation: confirm with the user before planning D-05 item 1 as a task; D-05 item 2 (header badge) and D-06 (Settings row) have no such ambiguity and can proceed as specified.

3. **Should `gateway.model.set` and `gateway.model.set_default` be one command (discriminated by a `kind` field) or two literal command types?**
   - What we know: the design spec (§7 backend contract) names two distinct commands; the real, shipped precedent (`SwapSetCommand`) uses one command with a boolean/enum mode field (`restore: bool`) rather than two types.
   - What's unclear: whether Phase 184.1's author will prefer matching the design spec literally or the codebase's own established idiom.
   - Recommendation: 103-CONTRACT.md should propose the one-command-with-discriminator shape (matches real precedent) but flag it explicitly as a recommendation, not a requirement, since Phase 184.1 is out of this phase's control.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Self-hosted Convex backend | New `activeEngine` table + `listConfigs`/`gatewayQuota`-style queries | Required for any real (non-stub) verification | per `convex-selfhost` setup, operationally live per CLAUDE.md | None needed for stub-only development — schema push is additive only (new table), safe under the self-hosted "no bulk delete/import --replace-all" rule |
| Ástríðr WS backend (`ws://localhost:8181/ws/telemetry`) | Live adapter path only | Not required for this phase (stub-first, D-16) | N/A | Stub adapter — this phase's entire point is to not depend on this |
| Ástríðr CLI Gateway sidecar (port 8200) | Subscription CLI brain rows' real health/quota (live path only) | Not required for this phase | N/A | Stub adapter simulates health/quota values |
| `npx convex dev` / `deploy` | Pushing the new active-engine table's schema | Required once, when the table is added | Standard Convex CLI, already used project-wide | None needed — this is a normal additive schema deploy, not a data mutation |

**Missing dependencies with no fallback:** None — this phase is explicitly designed to be buildable and testable with zero live astridr dependency.

**Missing dependencies with fallback:** Ástríðr WS backend and CLI Gateway — both fall back to the stub adapter per D-16, which is the phase's whole design, not a workaround.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom) + Playwright (E2E) |
| Config file | `vitest.config.ts` / Playwright config (existing, unchanged) |
| Quick run command | `npx vitest run src/components/brains` (or the specific new test file) |
| Full suite command | `npm test` (Vitest) and `npm run test:e2e` (Playwright) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BSC-01 | Header badge / Settings row render the reactive active engine per profile, and "Mixed brains" when profiles disagree | unit (component) | `npx vitest run src/components/brains/BrainHeaderBadge.test.tsx` | ❌ Wave 0 |
| BSC-01 | Adding a `case "model_routing"`-equivalent ingest handler correctly writes/dedupes per-profile rows | unit (Convex) | `npx vitest run convex/activeEngine.test.ts` | ❌ Wave 0 |
| BSC-02 | Picker dispatches `gateway.model.set` via `useCommandDispatch` and the stub adapter conforms to the same interface as live | unit (component + contract) | `npx vitest run src/lib/brainsApi.test.ts` | ❌ Wave 0 |
| BSC-03 | Global-swap confirm modal lists every affected profile's `current → new`, flags pinned-default overwrite count | unit (component) | `npx vitest run src/components/brains/GlobalSwapModal.test.tsx` | ❌ Wave 0 |
| BSC-03 | Scope selector resets to "This profile" on every picker open (except the mixed-badge entry exception) | unit (component) | same file as above | ❌ Wave 0 |
| BSC-04 | Pending state never optimistically flips the base label; a failed dispatch drops the pending suffix with no error styling on the pill itself | unit (component) | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ❌ Wave 0 |
| BSC-04 | Partial-failure global swap keeps failed rows on their real, unchanged engine (never shows the attempted target as landed) | unit (component) | same file as above | ❌ Wave 0 |
| BSC-05 (redefined) | Stub adapter's `getCatalogue()`/`dispatchSwap()` return shapes match the TypeScript interface `103-CONTRACT.md` defines | unit (contract conformance) + `tsc --noEmit` | `npx vitest run src/lib/brainsApi.test.ts && npx tsc --noEmit` | ❌ Wave 0 |
| BSC-05 (redefined) | Stub banner + STUB chip render whenever `VITE_BRAINS_STUB=true`, never otherwise | unit (component) | `npx vitest run src/components/brains/BrainPicker.test.tsx` | ❌ Wave 0 |
| E2E | Full picker-open → normal swap → toast round trip against the stub | e2e | `npm run test:e2e -- brain-swap.spec.ts` | ❌ Wave 0 |

### What CAN and CANNOT be proven with a stub (the BSC-05 honesty boundary)

**Provable against the stub, this phase:**
- The contract's TypeScript shapes are internally consistent and the stub conforms to them (compile-time + a runtime conformance test).
- All client-side logic: scope-selector reset behavior, pending-overlay-never-optimistic (D-15), partial-failure row rendering (D-12), pinned-default-overwrite count (D-11), revert restoring prior state from the client-held snapshot, expensive/unknown-tier inline confirm, stub-data indicator visibility (D-16). None of this depends on a real backend.
- The mixed-engine "Mixed brains" badge computation, given a fixture with ≥2 distinct stubbed engine values.

**CANNOT be proven this phase (explicitly deferred to the follow-on gate):**
- That astridr's real `gateway.model.set` endpoint exists, accepts the contract's payload, and actually changes the resolved model for the next real turn.
- That the active-engine telemetry event actually flows from a real astridr process into the new Convex table (requires `model_routing`'s profile-scoping gap and CodePulse's missing ingest case to both be fixed by Phase 184.1 first).
- That CLI subscription brains (claude-cli/codex/antigravity) are actually reachable/healthy/quota-tracked through a real CLI Gateway.
- Any interaction between this phase's per-profile mechanism and the already-live Phase 185/186 global override (Open Question 1) — this requires a real running astridr process to observe at all.

**A green stub test suite must never be reported as "BSC-05 verified."** Every test above proves contract conformance and UI honesty, not live integration.

### Fixtures that actually exercise the behavior (not just render-without-error)
- **Expensive/unknown-tier inline expansion:** the stub catalogue fixture MUST include at least one entry with `costTier: "expensive"` and one with `costTier: "unknown"` — a fixture with only `"normal"` entries will render the row-click-dispatches-immediately path and prove nothing about the confirm-expansion behavior (UI-SPEC §3/§11).
- **Global-swap pinned-default restore:** the stub fixture MUST include ≥2 profiles where at least one has a *pinned* default and at least one has only an *inherited* value — a fixture where every profile is in the same state cannot distinguish D-11's pin-status-preserving revert from a naive "restore last known model" implementation.
- **Partial-failure result rows:** the stub adapter's `dispatchSwap` must be configurable to fail for a subset of profiles in a global swap (e.g. by profileId allow/deny-list in the test) — a stub that always succeeds cannot exercise D-12 at all.
- **Mixed-brains header badge:** the fixture must seed the active-engine table/query with ≥2 distinct engine values across profiles simultaneously — a single-profile or all-agree fixture cannot trigger the "Mixed brains" stacked-dot path (UI-SPEC §2).
- **cmdk duplicate-value regression guard:** include a catalogue fixture with two entries sharing a display `name` but different `id`s, and assert both remain independently selectable/highlightable (regression guard for Pitfall 3).

### Wave 0 Gaps
- [ ] `src/lib/brainsApi.ts` + `src/lib/brainsApi.test.ts` — the adapter seam and its contract-conformance test (does not exist yet)
- [ ] `convex/activeEngine.ts` (or equivalent) + `convex/activeEngine.test.ts` + schema.ts table addition — the new reactive table (does not exist yet)
- [ ] `src/hooks/useActiveEngine.ts` — the per-profile + mixed-state reactive hook (does not exist yet)
- [ ] `src/components/brains/*` test files — none of these components exist yet
- [ ] `103-CONTRACT.md` itself — the deliverable this phase must produce (D-17)
- [ ] Playwright `brain-swap.spec.ts` — new E2E spec against the stub

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no new auth surface; it reuses the existing WS bearer-subprotocol connection |
| V3 Session Management | No | N/A |
| V4 Access Control | Partial | `gateway.model.set` should follow the same command-auth tier as `swap.set`/`config.update` (regular, non-admin) — confirmed neither is in astridr's `ADMIN_COMMANDS` set (`astridr/security/command_auth.py:15`, only `estop.activate`/`estop.deactivate` are admin-gated). 103-CONTRACT.md should state this explicitly so Phase 184.1 doesn't over- or under-gate it. |
| V5 Input Validation | Yes | Any real implementation must validate `modelId`/`profileId` server-side (Pydantic, matching every existing command in `ws_commands.py`) — the stub adapter should mirror this by rejecting malformed shapes in dev, to catch contract drift early |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A spoofed/forged WS command dispatched by an unauthenticated client | Spoofing | Already mitigated at the transport layer — `AstridrWSContext`'s bearer subprotocol handshake gates the whole connection; no new work needed here |
| A stub-mode build accidentally shipped to production, silently always showing fake data | Repudiation / Information Disclosure (of a wrong state) | D-16's persistent, non-dismissible STUB indicators (chip + banner) are the mitigation — this is a UI/product control, not a traditional security control, but the failure mode (operator trusting fake data to make a real swap decision) is real and already addressed by UI-SPEC §10 |
| Audit-trail gap for who changed a profile's model | Repudiation | Already covered — `convex/profiles.ts:109-127` writes a `configChanges` audit row on every `modelPreferences` change, `changedBy` distinguishing `"dashboard"` (this phase's operator-driven changes) from `"astridr-sync"` |

## Sources

### Primary (HIGH confidence — live code read directly)
- `C:\Users\mandr\codepulse\.planning\phases\103-brain-swap-control-surface\103-CONTEXT.md` — locked decisions D-01..D-17
- `C:\Users\mandr\codepulse\.planning\phases\103-brain-swap-control-surface\103-UI-SPEC.md` — approved visual/interaction contract, checker-approved 6/6
- `C:\Users\mandr\codepulse\.planning\REQUIREMENTS.md` (lines 9-17, 40-43) — BSC-01..05, out-of-scope note
- `C:\Users\mandr\codepulse\.planning\ROADMAP.md` (lines 628-651) — Phase 103 goal/success criteria
- `C:\Users\mandr\astridr-repo\docs\superpowers\specs\2026-07-17-astridr-brain-swap-design.md` — full design spec, read in full
- `C:\Users\mandr\astridr-repo\docs\superpowers\specs\2026-07-17-brain-swap-roadmap-changeset.md` — roadmap registration changeset
- `C:\Users\mandr\astridr-repo\astridr\providers\router.py` (lines 380-480) — `_resolve_model`, `_emit_model_routing`, global-override rung
- `C:\Users\mandr\astridr-repo\astridr\engine\model_defaults.py` — `ALLOWED_MODELS`, `MODEL_PROVIDER_AFFINITY`, `EXPENSIVE_MODELS`
- `C:\Users\mandr\astridr-repo\astridr\channels\commands.py` (lines 172-223) — existing `/model` command
- `C:\Users\mandr\astridr-repo\astridr\engine\control_verbs\swap_model.py` — full file, the shipped global-override mechanism
- `C:\Users\mandr\astridr-repo\astridr\api\ws_commands.py` — full file, real WS command union + handlers, `SwapSetCommand`/`SwapGetStateCommand`/`SwapCatalogueGetCommand`
- `C:\Users\mandr\astridr-repo\astridr\security\command_auth.py` (lines 1-40) — `ADMIN_COMMANDS` tier
- `C:\Users\mandr\astridr-repo\.planning\ROADMAP.md` (lines 27, 283-314) — Phase 185/186 shipped status
- `C:\Users\mandr\codepulse\src\hooks\useCommandDispatch.ts` — full file
- `C:\Users\mandr\codepulse\src\contexts\AstridrWSContext.tsx` — full file
- `C:\Users\mandr\codepulse\src\lib\astridrApi.ts` — full file
- `C:\Users\mandr\codepulse\src\lib\providers.ts` — full file
- `C:\Users\mandr\codepulse\src\components\control-center\BrainControl.tsx` — full file
- `C:\Users\mandr\codepulse\src\components\voice\SwapBadge.tsx` — full file
- `C:\Users\mandr\codepulse\src\components\control-center\ControlCenterPanel.tsx` (lines 1-60)
- `C:\Users\mandr\codepulse\src\pages\Chat.tsx` (lines 1-60, 160-260, 480-520)
- `C:\Users\mandr\codepulse\src\pages\Settings.tsx` (lines 610-685)
- `C:\Users\mandr\codepulse\src\components\ChatInput.tsx` — full file
- `C:\Users\mandr\codepulse\src\pages\InsightsChat.tsx` (lines 1-60)
- `C:\Users\mandr\codepulse\src\layouts\DashboardLayout.tsx` (lines 440-475, 560-609) — hotkeys, status cluster
- `C:\Users\mandr\codepulse\src\components\skills\SkillCommandPalette.tsx` (line 53) — Ctrl+Shift+K owner
- `C:\Users\mandr\codepulse\convex\schema.ts` (lines 45-140, 495-518) — `sessions`, `agents`, `agentProfiles`, `profileConfigs`
- `C:\Users\mandr\codepulse\convex\profiles.ts` — full file, incl. the "agentProfiles has zero rows" comment (line ~113)
- `C:\Users\mandr\codepulse\convex\runtimeIngest.ts` (event-type switch, grepped for all cases + `model_routing` absence)
- `C:\Users\mandr\codepulse\convex\gatewayQuota.ts` — full file, dedup-latest pattern
- `C:\Users\mandr\codepulse\convex\providerConfig.ts` (lines 1-50)
- `C:\Users\mandr\codepulse\src\hooks\useProviderHealth.ts` — full file
- `C:\Users\mandr\codepulse\src\components\ProviderControls.tsx` — full file, incl. the `gateway.provider.set_enabled` dispatch site
- `C:\Users\mandr\codepulse\src\components\control-center\BrainControl.test.tsx` (lines 1-50) — existing test pattern to follow
- `C:\Users\mandr\codepulse\.planning\config.json` — no `nyquist_validation`/`security_enforcement` overrides (both treated as enabled)
- `C:\Users\mandr\codepulse\CLAUDE.md` — project constraints (see below)

### Secondary (MEDIUM confidence)
- None — all findings in this document were verified directly against live code or the approved CONTEXT/UI-SPEC documents; no unverified WebSearch claims were used (this research required no external library documentation).

### Tertiary (LOW confidence)
- None.

## Project Constraints (from CLAUDE.md)

- Every `/api/*` fetch MUST carry `Authorization: Bearer` via `authHeaders()` from `src/lib/astridrApi.ts` — n/a for this phase's recommended WS-only transport (Q1(b)), but any REST fallback the planner chooses instead MUST still comply.
- Styling: token-driven theming; never hardcode hex; compose the 30 shadcn/ui primitives; Lucide icons only. UI-SPEC already documents the one pre-existing exception (`PROVIDER_COLORS` literal hexes) — do not add a second.
- Self-Hosted Convex operational rules: never `import --replace-all`, never bulk-delete/bulk-patch the live instance. This phase's only Convex change is an **additive new table** (active engine) — explicitly safe under these rules; flag any task that touches existing rows in bulk as out of bounds.
- No new packages this phase (see Package Legitimacy Audit) — nothing to reconcile against these rules.

## Metadata

**Confidence breakdown:**
- Standard stack / package legitimacy: HIGH — no new packages, all reuse verified live in this repo
- Architecture (contract shapes, adapter seam, reactive readback): MEDIUM-HIGH — CodePulse-side patterns are HIGH confidence (read directly); the proposed astridr-side contract shapes are MEDIUM (grounded in real adjacent code, but propose new surface for infrastructure Phase 184.1 hasn't built yet)
- Pitfalls / landmines: HIGH — every pitfall cited has direct file:line evidence, not inference
- The four "Critical Discovery" findings (existing Phase 185/186 mechanism, non-existent `gateway.provider.set_enabled`, empty `agentProfiles`, composer-pill host mismatch): HIGH — each independently verified via direct grep/read, not assumption

**Research date:** 2026-07-28
**Valid until:** 30 days (stable — astridr's `feature/brain-swap` branch and CodePulse's current state), but re-verify immediately if astridr Phase 184.1 begins implementation before this phase executes, since any of its real design choices could change the contract recommendations here from "proposed" to "must match what was actually built"
