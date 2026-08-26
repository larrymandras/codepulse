# Requirements

**Active milestone: v15.0 — "Borealis Console" Premium UI Overhaul** (Phases 120+, started 2026-08-17 via `/gsd-new-milestone`, consuming the `MILESTONE-CONTEXT.md` prepared 2026-08-07).

Prior milestones (requirements archived in full, extract-don't-delete):

- **v14.0 — Per-Agent Engine Visibility, Convex Durability & Mission Board** shipped 2026-08-17 → [milestones/v14.0-REQUIREMENTS.md](milestones/v14.0-REQUIREMENTS.md). Phases 108–119, 86 plans, **15/17 satisfied** (MISSION-01 PARTIAL, MISSION-02 reassigned to SEED-007).
- **v13.0 — Brain-Swap Control, Cost Intelligence & Consolidation** shipped 2026-08-06 → [milestones/v13.0-REQUIREMENTS.md](milestones/v13.0-REQUIREMENTS.md) (14/15).
- **v11.0 — Skills Command Center** shipped 2026-07-25 → [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22).
- **v12.0 — Reminders & Calendar** shipped 2026-07-23 → [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md) (9/9).

---

## v15.0 requirements — ARCHIVED

v15.0 shipped 2026-08-26 (Phases 120–127, 87 plans, 30/30 Complete). Its full
requirements section — POLISH / TOKEN / SHELL / SIGNAL / A11Y / DEBT / SWEEP /
JANITOR, plus design inputs, milestone acceptance, out-of-scope and traceability —
moved verbatim to [milestones/v15.0-REQUIREMENTS.md](milestones/v15.0-REQUIREMENTS.md).

---

## Carried forward from v14.0 (still open, not scoped into v15.0)

Items 5 (CR-01) and the accessibility half have been **absorbed** into this milestone as DEBT-08 and A11Y-01..03 respectively; the rest stay open.

1. **MISSION-01 duration + orphan recovery** → SEED-007. Blocked on data shape, not effort: no `running` row can arrive. **Do not tick MISSION-01's checkbox** — auto-re-ticked by tooling twice, reverted twice.
2. **MISSION-02 humanized tool activity** → SEED-007. No job↔tool join key exists in astridr.
3. **`message_routed` routed but unsurfaced** — needs its own UI design pass (D-13). *Candidate to fold into SHELL/TOKEN work if capacity allows, but not scoped.*
4. **`links` has no recorded retention decision** — `bifrost.ts:53` does an unbounded `.collect()` on the public `list` query. Low practical risk (operator-curated).
5. ~~`llm-analytics-rollup` CR-01~~ → **absorbed as DEBT-08**.
6. **`detectCredentialValue` rule C** still cannot see a colon-joined token as one run; rule A covers the realistic shape by name, so this is deliberate.
7. **Nyquist coverage partial** — 109/112/113/114 partial, 117/119 have no VALIDATION.md.
8. **DEBT-06 remains latent** — the intermittent `Chat.test.tsx` failure was closed *guarded*, never root-caused; instrumentation ships the next occurrence's diagnosis.
9. **Cross-repo, astridr:** `feature/brain-swap` → `main` divergence; `web.py` on the deployed branch still carries a decommissioned-host CORS default removed on `main`.
