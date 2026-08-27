---
id: SEED-002
status: absorbed
absorbed: 2026-08-27
absorbed_by: [BOARD-01, BOARD-02, BOARD-03]
planted: 2026-07-20
planted_during: v11.0 pause / astridr v28.0 (JARVIS v5 + TARS deep-read, Codex-converged)
trigger_when: astridr SEED-023 (Mission Control) enters planning — this is its frontend half. PAIRS WITH (does not replace) Phase 99 Skill Launch/Dispatch; armory tiles + receipts ride Phase 100.
scope: Medium
origin: "TARS server.py:1068-1099 stream-json→live telemetry parse + JARVIS v5 missions.py event buffer. Full analysis: C:\\Users\\mandr\\Mandras\\04-research\\jarvis-v5-tars-astridr-gap-analysis.md; astridr spec: astridr-repo/docs/superpowers/specs/2026-07-20-jarvis-v5-tars-v29-changeset.md"
paired_seed: astridr-repo/.planning/seeds/SEED-023-mission-control-jobs-board.md
---

> **Absorbed 2026-08-27 (Phase 128, PARTIAL — see `128-SEED-RECONCILIATION.md` Finding 1).**
> v16.0's BOARD-01/02/03 scope the live-board, humanized-tool-activity, and HITL-confirm-card
> thirds of this seed. NOT covered by any v16.0 requirement: squad grouping ("phase two, astridr
> MC-2") and the self-critique `{critique, follow_up}` "deploy follow-up" card remain unscoped
> ideas — not re-scoped here, flagged so a later reader does not assume BOARD-01..03 close this
> seed completely.

# SEED-002: Mission Control jobs board (frontend half of astridr SEED-023)

A live jobs board for Ástríðr's background missions: per-mission cards streaming
tool/note/result events from the stream-json parse in astridr, with:

- **Humanized tool labels** ("reading Gmail…", "Write index.html") — JARVIS missions.py
  tool_label mapping is the reference.
- **Per-mission cost** (`total_cost_usd` from the CLI result event) + duration + status
  (EN ROUTE / AWAITING_CONFIRM / COMPLETE / FAILED, with boot-time orphan recovery shown
  honestly as FAILED).
- **Confirm cards**: missions with gated steps surface awaiting_confirm items (e.g.
  Subscription Reaper KEEP/KILL cards) resolving through the existing HITL approval-block
  contract (178.1 / update-by-id pattern — reuse, don't fork).
- **Self-critique follow-up**: the {critique, follow_up} epilogue renders as a one-tap
  "deploy follow-up" card.
- **Squad grouping** (phase two, astridr MC-2): parent mission with grouped children.
- Receipts display under chat answers (tools_used / tool_errors) — shared component with
  Phase 100 Control-Surface UX armory tiles.

Relationship to v11.0: Phase 99 launches SKILLS (chat.send / Forge / Ástríðr dispatch);
this seed adds MISSION telemetry + control. Build order per Codex + v11 resume plan:
98 → 99 → 100, with this seed slotting when astridr's MC-1 backend exists to feed it.
Convex tables/telemetry shapes must follow docs/astridr-contract.md on the astridr side.
**Prerequisite (2026-08-10, Phase 111):** this live board waits on SEED-007's emitter revival — see `.planning/seeds/SEED-007-mission-emitter-revival.md`.
