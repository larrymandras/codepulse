---
phase: 83-graph-snapshot-receiver
plan: 03
type: summary
wave: 3
requirements: [GH-01]
status: complete
---

# Plan 83-03 — Live round-trip verification of the graph-snapshot receiver

## Objective (met)

Prove GH-01's receiver works end-to-end against a running Convex backend with a
faithfully-shaped producer-envelope fixture, not just unit-green logic. A real
POST → persist → read-back round-trip, idempotent re-POST, and an auth negative
test were all observed on live data.

## What was built

- `convex/graphSnapshots.fixture.ts` — a faithful mirror of the producer `data`
  payload (`astridr/automation/graph_snapshot.py build_graph_snapshot()`),
  intentionally heterogeneous: a numeric-`community` graphify node, a
  `community: null` vault node, a `truncated: true` source with
  `emittedNodeCount < nodeCount`, and exactly one intentional **dangling link**
  (`target: "graphify:codepulse:missing"`) so the D-05 drop is observable. No
  bearer key or secret appears in the file; the verification POST reads the key
  from the deployment env at call time.

## CHECKPOINT — live round-trip (operator-delegated automatic run)

Run against deployment `tidy-whale-981` (host `https://tidy-whale-981.convex.site`),
authed with `ASTRIDR_INGEST_API_KEY` (43 chars, read from deployment env, never
printed). Functions deployed via `npx convex dev --once` — schema validated
against the new module and all three indexes were created without error (this
alone confirms schema↔module consistency).

| Check | Expected | Observed | Result |
|-------|----------|----------|--------|
| Authed POST #1 to `/runtime-ingest` | 200 | 200 | PASS |
| `getProjectGraph` returns populated active graph | non-null, nodes+links | full graph | PASS |
| `storedNodeCount` | 3 | 3 | PASS |
| `storedLinkCount` (dangling link dropped, D-05) | 2 | 2 (`…:missing` absent from links) | PASS |
| Vault node with `community: null` present | yes | `vault:GraphSnapshotReceiver` present, community null | PASS |
| `activeVersion` after POST #1 | 1 | 1 | PASS |
| Re-POST same snapshotId → `activeVersion` | 2, one active graph | 2; counts unchanged (3 nodes / 2 links, not doubled) | PASS |
| Unauthenticated POST → 401 (T-83-01 bearer gate) | 401 | 401 `{"error":"Unauthorized"}` | PASS |
| `listSnapshots` rows | exactly one | one row | PASS |

Idempotent full-replacement is confirmed: the meta doc `_id` is stable across
both POSTs while `activeVersion` advances 1 → 2 and stored counts stay at 3/2 —
i.e. the pointer flips to a fresh version rather than appending duplicate rows.

## Deviations / findings

- **RESEARCH.md envelope inaccuracy (no code impact).** 83-RESEARCH.md
  "Telemetry Envelope" (lines 433–451) shows the wire event key as
  `event_type` (snake_case). The actual batched HTTP path that POSTs to
  `/runtime-ingest` — `telemetry.py::_post_to_convex` L415–425 — emits
  `"eventType": evt.event_type` (**camelCase**). The 83-02 dispatch was
  correctly keyed on `evt.eventType`, so GH-01 production wiring is sound; only
  the first verification envelope used the wrong key (HTTP 400 on the legacy
  `eventType: v.string()` validator) and was corrected. Snake-case `event_type`
  at telemetry.py L281/L330 is the WebSocket payload, not the HTTP batch.

## Verification

- Live round-trip: all nine checkpoint rows PASS (table above).
- `npx tsc --noEmit` clean (fixture compiles against the upsert arg shape).

## Key files

- created: `convex/graphSnapshots.fixture.ts`

## Self-Check: PASSED
