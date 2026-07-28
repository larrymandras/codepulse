# Requirements

**Active milestone: v13.0 — Brain-Swap Control, Cost Intelligence & Consolidation** (Phases 103–106, formalized 2026-07-27 via `/gsd-new-milestone`).

Prior milestone v11.0 (Skills Command Center) shipped 2026-07-25 → [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22). v12.0 (Reminders & Calendar) shipped 2026-07-23 → [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md). The three post-v11.0 follow-ups (display-name fix, bridge coverage, Chat command-center) all shipped 2026-07-26; Phase-98 UAT tests 5 + 4-shadowed verified live 2026-07-27.

---

## Phase 103 — Brain-Swap Control Surface

A CodePulse surface to switch Ástríðr's reasoning engine (keyed API models + subscription CLIs) on the fly. This is the CodePulse half of the astridr brain-swap thread (astridr Phase 184.1, which explicitly scopes "+ CodePulse controls").

- **BSC-01** — Live view of the **current reasoning engine** per agent AND globally, reactive from Convex/telemetry (not a stale config read — the v9.0 "VitalsRail active-profile" trap). — ✅ **satisfied 2026-07-28** (Phase 103, Plans 103-01..103-07 — header badge, composer pill, and Settings row all read exclusively through `useActiveEngine()`; the `Settings.tsx` stale `p.model` config read is deleted).
- **BSC-02** — **Switch the engine on the fly**: choose from keyed API models (Claude family — Opus 4.8 / Sonnet 5 / Fable 5 / Haiku 4.5 — and any others astridr exposes) and subscription CLIs (Claude Code / Codex / Antigravity); dispatched to astridr's brain-swap endpoint via authenticated `/api/*` (bearer per CLAUDE.md). — ✅ **satisfied 2026-07-28** (Phase 103, Plans 103-01..103-07 — `BrainPicker` reachable from all three hosts; per-profile branch stub-backed pending astridr Phase 184.1, global branch dispatches the live `swap.set`).
- **BSC-03** — **Scope control**: per-agent swap vs global swap; a global swap requires an explicit confirm (irreversible-ish, affects all agents).
- **BSC-04** — **Honest live status**: show swap in-flight → success/failure → the *resulting* active engine reconciled back from astridr (server-confirmed, not optimistic-only).
- **BSC-05 (integration gate)** — Before building any UI against them, **verify astridr's brain-swap endpoints work end-to-end on the running stack** (list-engines + swap + read-current). "Endpoint exists ≠ integration works" (Phase-90 War Room lesson). Close this gate *during* execution, not after.

## Phase 104 — Cost Intelligence

- **COST-01** — **Per-model / per-provider cost breakdown over time** (chart + table), correctly attributing the current model mix (sonnet-5 / opus-4.8 / fable-5 etc.).
- **COST-02** — **Budget thresholds**, configurable per-model and/or global (and per-goal where the data supports it), persisted in Convex.
- **COST-03** — **Anomaly / budget alerts** when spend spikes or crosses a threshold, delivered through the existing alert-routing layer (no new channel plumbing).

## Phase 105 — Tool & Trace Observability

- **OBS-01** — **Tool-usage analytics**: per-tool call frequency + success/failure rates over time.
- **OBS-02** — **Surface the astridr tool-filter signals** in CodePulse: ingest + a view for `agent_loop.tool_call_leaked_as_text` / `tool_policy_event` (the silent-filter-trap detector shipped astridr `b7e4a534`), so a leaked/off-turn tool is visible with the offending tool name.
- **OBS-03** — **Deeper trace waterfall**: extend the existing `TraceWaterfall` with nested spans, per-tool timings, and cache-hit visibility per turn.

## Phase 106 — Consolidation & Hardening

- **DEBT-01** — **Typed-api sweep**: eliminate remaining `anyApi` usages (e.g. `Ideation.tsx`) → type-safe Convex calls.
- **DEBT-02** — **Retire cloud Convex `tidy-whale-981`**: export pre-2026-07-15 history (~56 GB peak — plan it), confirm nothing reads it, then cancel. Fully closes the cloud→self-hosted migration.
- **DEBT-03** — **Build/chunk cleanup**: code-split the >500 kB chunks (`react-force-graph-3d`, `WarRoom`, `useSpeechRecognition`) below the warning threshold; laptop Tailscale set-up.
- **DEBT-04** — **Finish deferred manual UAT**: Phase-98 Test-4 remaining menu sub-cases (active-single / dormant-non-shadowed / multi-scope), the full "Hey Ástríðr" wake → "stop" barge-in → "goodbye" re-arm voice sequence, and Phase-100's manual live-Forge-daemon drag round-trip.

---

### Out of scope (v13.0)
- Astridr-side brain-swap *backend* (owned by astridr Phase 184.1 — CodePulse consumes it; BSC-05 gates on it being live).
- New alert delivery channels (COST-03 reuses existing routing).
- Any mass mutation of the live self-hosted Convex (DEBT-02 exports/cancels the *cloud* instance only).
