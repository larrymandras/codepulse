# Phase 93: Eval Pipeline & Quality KPIs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 93-Eval Pipeline & Quality KPIs
**Areas discussed:** Cross-repo emitter scope, Judge design, Regression semantics, KPI surface placement

---

## Cross-repo emitter scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include Ástríðr change | Mirror score to CodePulse from spawn_score, Phase 90 transcript-ingest pattern (26874fac) | ✓ |
| CodePulse-only + handoff | Build endpoint/table/UI here; leave Ástríðr emit as handoff task | |
| You decide | Claude picks at planning time | |

**User's choice:** Include Ástríðr change (recommended)
**Notes:** Scout found `langfuse_eval.py` writes only to Langfuse — nothing POSTs to CodePulse today.

| Option | Description | Selected |
|--------|-------------|----------|
| New eventType on /runtime-ingest | `task_quality` case on existing Bearer-authed dispatch; zero new routes | ✓ |
| Dedicated /eval-ingest route | Own httpAction like /war-room-ingest | |
| You decide | | |

**User's choice:** New eventType on /runtime-ingest (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Dual-write, independent gates | CodePulse mirror gated on CONVEX_URL+key; Langfuse write untouched | ✓ |
| CodePulse replaces Langfuse | Rip out langfuse client write | |
| You decide | | |

**User's choice:** Dual-write, independent gates (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Live E2E required | Real score in prod Convex + rendered in UI before phase-done | ✓ |
| Tests green + manual smoke later | convex-test + unit test suffice | |
| You decide | | |

**User's choice:** Live E2E required (recommended) — Phase 90's 5-gap live-testing lesson cited.

---

## Judge design

| Option | Description | Selected |
|--------|-------------|----------|
| Convex-resident data only | events + session metadata + llmMetrics; judge observable behavior | ✓ |
| Mirror session transcripts into Convex first | Richer judgments, second cross-repo emitter + new table | |
| You decide | | |

**User's choice:** Convex-resident data only (recommended)
**Notes:** Constraint surfaced: Convex cloud action cannot reach local Ástríðr API (localhost:8181).

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated eval config, Haiku default | Own slot via briefings.ts pattern, default claude-haiku-4-5 | ✓ |
| Reuse briefings' llmConfig slot | Shared config — briefing model change would shift judge scoring | |
| Opus/Sonnet judge | Higher cost, overkill for structured rubric | |

**User's choice:** Dedicated eval config, Haiku default (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-persona quota | ~3 completed sessions per active persona per night | ✓ |
| Flat random sample | e.g. 10 random/night; quiet personas starve | |
| Judge everything | Unbounded nightly cost | |

**User's choice:** Per-persona quota (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-dimension + overall | 3–4 code-defined dimensions 0–1 + overall; per-dimension rows | ✓ |
| Single overall score | One number, no drill-down | |
| You decide | | |

**User's choice:** Multi-dimension + overall (recommended)

---

## Regression semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Both, persona-scoped | profileSwitches AND persona-scoped configChanges | ✓ |
| profileSwitches only | Misses instruction edits | |
| configChanges only | Misses explicit switches | |

**User's choice:** Both, persona-scoped (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Before/after window means | ~7d windows, min sample count, threshold drop | ✓ |
| Reuse z-score anomaly engine | Noisy at ~3 samples/night | |
| UI comparison only | No auto-detect | |

**User's choice:** Before/after window means (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Alert via existing engine | Inherits routing, ack/mute, severity prefs | ✓ |
| UI flag only | Quiet; can sit unseen | |
| Both, alert at higher bar | Two-tier threshold | |

**User's choice:** Alert via existing engine (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative, code-defined | ≥5 judged sessions/side, meaningful drop; constants in code | ✓ |
| Conservative + settings knobs | Same defaults + Settings UI | |
| Eager detection | More false alarms | |

**User's choice:** Conservative, code-defined (recommended) — matches standing zero-false-positive bar.

---

## KPI surface placement

| Option | Description | Selected |
|--------|-------------|----------|
| New Quality page | Dedicated route + nav entry | ✓ |
| Section on Analytics | Already dense | |
| Section on Agents page | Regression context fits awkwardly | |

**User's choice:** New Quality page (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Persona cards + drill-in | KPI card grid → detail w/ trend, change markers, dimensions, judged sessions | ✓ |
| Single multi-line trend chart | Unreadable past ~5 personas | |
| Table-first | Chart secondary | |

**User's choice:** Persona cards + drill-in (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — rationale + dimensions | Store judge rationale per dimension, render with session link | ✓ |
| Scores only | Uninterpretable bad scores | |
| You decide | | |

**User's choice:** Yes — rationale + dimensions (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| 30d default + range picker | evalScores kept indefinitely (tiny volume) | ✓ |
| 90d default | Busier charts | |
| 30d + archival sweep | Likely unnecessary at this volume | |

**User's choice:** 30d default + range picker (recommended)

---

## Claude's Discretion

- Idempotency key mechanics (follow Phase 88 `by_idempotencyKey` precedent)
- `evalScores` schema/indexes; persona identity mapping (agent_id ↔ profileId); persona-scoped configKey set
- Rubric dimension wording, judge prompt, structured-output parsing
- Cron UTC slot (avoid 01:00–06:05 contention)
- Chart implementation and empty states
- Exact threshold/window constants (within conservative bounds)

## Deferred Ideas

- Session-transcript mirroring into Convex (conversational-quality judging) — own phase if ever
- Rubric editing UI — already in REQUIREMENTS.md Future
- Settings knobs for regression thresholds
- evalScores archival sweep

**Reviewed todo (not folded):** `eval-and-trace-observability-v10.md` — milestone seed, already formalized into REQUIREMENTS.md; kept as canonical ref.
