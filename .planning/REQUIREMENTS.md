# Requirements

**No active milestone.** v13.0 closed 2026-08-06 — start the next one with `/gsd-new-milestone`.

Prior milestones (requirements archived in full, extract-don't-delete):

- **v13.0 — Brain-Swap Control, Cost Intelligence & Consolidation** shipped 2026-08-06 → [milestones/v13.0-REQUIREMENTS.md](milestones/v13.0-REQUIREMENTS.md). Phases 103–107, 53 plans, **14/15 satisfied**. The one exception is **BSC-01 ⚠ PARTIAL** — its global axis is satisfied and live-verified, its per-agent axis was deliberately deferred as scope. Audit: [milestones/v13.0-MILESTONE-AUDIT.md](milestones/v13.0-MILESTONE-AUDIT.md).
- **v11.0 — Skills Command Center** shipped 2026-07-25 → [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md) (22/22).
- **v12.0 — Reminders & Calendar** shipped 2026-07-23 → [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md).

---

## Carried forward into the next milestone

None of these block anything; all are recorded with evidence in the v13.0 audit.

1. **convex-backend memory growth — root cause OPEN.** Measured 2026-08-06: `db.sqlite3` stays **byte-identical** while memory climbs ~7.6 → 31 GiB, so it is accumulated runtime working set, **not** data volume — which rules out retention as the lever and excludes any hypothesis resting on row count. Mitigated, not fixed, by `ConvexNightlyRestart` (02:00 daily, health-gated). See `milestones/v13.0-phases/107-aggregates-rollup-sharding/107-OCC-EVIDENCE.md` § J.
2. **BSC-01 per-agent axis** — the deferred half of v13.0's one PARTIAL requirement. Pick it up here if per-agent engine visibility is still wanted.
3. **Skill-registry prune churn.** `computeSkillPrunes` deletes rows for any name absent from an incoming snapshot, so a scan that transiently misses the plugin cache silently drops ~56 live plugin skills until the next full scan (observed 185 → 131 → 185). Nothing permanently lost.
4. **Astridr event-kind coverage.** 7 kinds have real emitters but no domain route; **5 more are documented in `astridr-contract.md` but have no emitter at all** (contract drift — fixable in astridr-repo, no CodePulse work). Nothing is lost today: all land in `runtime_events`. Scoped in the 105 `deferred-items.md`.
5. **`D-106-04-01`** — intermittent `Chat.test.tsx` brain-pill failure. Three candidate causes refuted and recorded; deliberately **not** masked with a `waitFor`. The one thing that would crack it: capture the actual `textContent` on failure.
6. **`convex-selfhost/` is not a git repo** — its compose `logging:` block and the restart scripts are unversioned and live only on disk.
7. **Cross-repo, astridr:** `feature/brain-swap` → `main` is 322 commits behind (a release decision, not a bug). The CI-telemetry fix was cherry-picked onto `main` separately; `web.py` on `feature/brain-swap` still carries the decommissioned-host CORS default that was removed on `main`.
