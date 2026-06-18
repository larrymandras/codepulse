# Phase 75 (Agent Console) — SUPERSEDED

**Status:** SUPERSEDED by v7.0 Forge Integration
**Decided:** 2026-06-18 (Larry)
**Superseded by:** CodePulse v7.0 Forge (phases 78–82, shipped + verified live 2026-06-17)

---

## Why this phase was retired

Phase 75 was the original **Agent Console** design: drive Claude Code / Codex from the
dashboard and inspect their working dirs via a **browser-direct** path —
`POST/DELETE :8200/tasks` + WS stream + `:8200/browse` file reads, authed by a
scoped token minted at `:8181`.

It was gated on two Ástríðr Surface-Substrate deliverables:

| Gate | Ástríðr phase | Status |
|------|---------------|--------|
| **M1.P0** | 133 access-spike — scoped-token mint (ACC-02) + CORS allowlist (ACC-03) | ✅ shipped 2026-06-10 |
| **M1.P3** | 136 gateway-browse — read-only `:8200/browse/{repos,tree,file}` | ✅ shipped 2026-06-10 (human-approved live) |

**Both gates cleared 2026-06-10.** But while Phase 75 sat parked, CodePulse built
**Forge** (v7.0) as a different — and more robust — bridge for the *same* capability:

| Capability | Phase 75 (browser-direct) | Delivered instead by Forge (v7.0) |
|------------|---------------------------|-----------------------------------|
| Launch / stop agents | 75-04 / 75-05 | Phase 80 — command-bridge (Convex `forgeCommands` queue) |
| Live logs | browser WS from `:8200` | Phase 81 — `forgeLogChunks` + reactive query |
| File / artifact preview | M1.P3 `:8200/browse` | Phase 82 — Forge daemon file emission |
| Works when dashboard is cloud-served | ❌ mixed-content blocked | ✅ daemon UP / queue DOWN avoids browser→localhost |

Forge's daemon + Convex transport survives cloud hosting (no browser→`http://localhost`
mixed-content problem) and is fully shipped + verified live. Phase 75 would have been a
second implementation of the same feature set over a local-only transport.

## Consequence

- The 6 planned-but-unexecuted Phase 75 plans (75-01 … 75-06) are **retired**, not executed.
- The two remaining cross-repo gateway delta edits Phase 75 needed in `astridr-repo/gateway`
  — add `POST`+`DELETE` to CORS `allow_methods` (`app.py:165`), and add a `model` field to
  `TaskRequest` — are **no longer required**.
- The CON-* requirements are retained in `REQUIREMENTS.md` and considered satisfied by Forge.
- The M1.P0 / M1.P3 gateway endpoints remain available (latent infra) for any future
  ad-hoc local inspection use, but are not on the critical path.

## If Phase 75 is ever revived

Revive only if browser-direct streaming (lower latency than the Convex round-trip) or the
model-selector UX proves materially better than Forge's bridge for the local-only setup.
The plans and UI-SPEC remain in this directory for reference.
