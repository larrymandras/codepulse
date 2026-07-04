# Phase 81: Live Log Streaming - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 81-live-log-streaming
**Areas discussed:** Log cap thresholds (D-2), Log viewer UX, listJobLogs load bound, Forge-side handoff scope

> SPEC.md was loaded (requirements/contract locked) — discussion covered implementation-only decisions the SPEC left open.

---

## Log cap thresholds (D-2)

| Option | Description | Selected |
|--------|-------------|----------|
| ~1 MB/job + 7-day TTL | SPEC suggestion. Drop-oldest past ~1MB; daily TTL sweep. Bounds storage + runaway jobs. | ✓ |
| 256 KB/job + 7-day TTL | Tighter storage, less scrollback. | |
| 5 MB/job + 7-day TTL | More history; higher storage. | |

**User's choice:** ~1 MB/job + 7-day TTL (SPEC's suggested anchor)
**Notes:** Exact byte accounting + sweep cadence at plan time; cron/cleanup test required (SC#3).

---

## Log viewer UX

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-follow, pause on scroll-up | Terminal-style tail; scroll-up pauses follow, "jump to latest" resumes. | ✓ |
| Auto-follow always | Always snaps to newest. | |
| Manual scrollback only | No auto-follow. | |

**User's choice:** Auto-follow, pause on scroll-up
**Notes:** Standard `tail -f` UX in the Phase 79 ForgeJobDetail pane.

---

## listJobLogs load bound

| Option | Description | Selected |
|--------|-------------|----------|
| All retained chunks for the job | Retention (~1MB) already bounds it; single reactive query, full scrollback. Mirrors listJobs bounded-take. | ✓ |
| Last N chunks (e.g. 500) | Explicit cap + "load older" path. | |
| Paginated on scroll | Most scalable; complicates live tail. | |

**User's choice:** All retained chunks for the job
**Notes:** Order by seq (fallback _creationTime); no pagination.

---

## Forge-side handoff scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include it (makeLogSink + live round-trip) | SC#4: real fetch + FORGE_LOG_INGEST_URL + round-trip; closes Forge 08-HUMAN-UAT. ~1 cross-repo task. | ✓ |
| CodePulse receiver only | Defer Forge wiring to a follow-up. | |

**User's choice:** Include it in Phase 81
**Notes:** Add seq counter (D-1); keep T-6-KEYLEAK (never log bearer).

---

## Claude's Discretion

- Exact per-job byte-accounting method, retention sweep cron cadence, and `listJobLogs` take-limit constant (consistent with D-01/D-03).

## Deferred Ideas

None — discussion stayed within phase scope.
