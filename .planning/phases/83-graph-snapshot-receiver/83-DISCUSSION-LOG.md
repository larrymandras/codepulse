# Phase 83: Graph Snapshot Receiver - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 83-graph-snapshot-receiver
**Areas discussed:** Storage shape, Replacement/atomicity, History retention, Read API shape, Truncation metadata

---

## Storage shape

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata doc + entity rows | One `graphSnapshots` doc + `graphSnapshotNodes`/`graphSnapshotLinks` rows keyed by snapshotId. Safe at any scale; enables per-source/community filtering. | ✓ |
| Chunked-array docs | nodes/links split into arrays ≤8000 across a few chunk rows. Middle ground, weaker fit for GH-03/KG-09. | |
| Single blob doc | Mirror kgSummary one-row blob. FAILS at worst-case (array >8192 / doc >1 MiB). | |

**User's choice:** Metadata doc + entity rows
**Notes:** Decisive finding presented: worst-case ~9k links exceeds Convex's 8,192-element array limit and ~1.2 MB exceeds the ~1 MiB doc limit, so the kgSummary blob model would silently reject large snapshots.

---

## Replacement / atomicity

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned swap | Write new version → flip activeVersion last → sweep old. Readers never see a half-written graph. | ✓ |
| Batched delete+insert | httpAction pages deletes then inserts under same snapshotId; brief inconsistent window on partial failure. | |
| You decide | Defer to researcher on Convex limits. | |

**User's choice:** Versioned swap
**Notes:** Chosen for atomicity (no corrupt half-replaced graph) and to avoid one giant delete+insert transaction. Conveniently makes history retention nearly free.

---

## History retention

| Option | Description | Selected |
|--------|-------------|----------|
| Keep last N (≈7) | Sweep keeps most recent N versions per snapshotId. ~a week of nightly history; sets up Phase 87 code/vault-graph temporal diff. | ✓ |
| Latest-only | Sweep all non-active versions after flip. Simplest; forecloses code/vault-graph diff. | |
| You decide | Pick N at plan time. | |

**User's choice:** Keep last N (e.g. 7)
**Notes:** Nearly free given versioning. Producer's "replace don't accumulate" honored at the active-pointer level; history is an internal CodePulse retention choice. Requires a retention sweep cron (mirror sweepForgeLogChunks).

---

## Read API shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full-graph getter + list | `getProjectGraph({snapshotId?})` returns whole active version (ForceGraphCanvas-ready) + `listSnapshots()`. Filtering client-side. | ✓ |
| Split, server-filtered getters | getSnapshotMeta/getNodes/getLinks with server-side filtering. More surface, premature for bounded data. | |
| You decide | Pick at plan time. | |

**User's choice:** Full-graph getter + list
**Notes:** Matches GAL-04 client-side-filtering precedent and the bounded payload. Flagged: confirm single-query read stays within Convex limits or paginate internally.

---

## Truncation metadata

| Option | Description | Selected |
|--------|-------------|----------|
| Store producer sources[] + record actual stored counts | Persist sources[] verbatim as authoritative "X of Y"; also drop dangling links + record receiver's storedNode/LinkCount as integrity signal. | ✓ |
| Trust producer sources[] verbatim | Persist counts exactly as sent; no receiver-side re-validation. | |
| You decide | Lock fields at plan time. | |

**User's choice:** Store producer sources[] + record actual stored counts
**Notes:** Divergence between producer-emitted and receiver-stored counts becomes a visible data-quality signal rather than a silent broken graph.

---

## Claude's Discretion

- Exact schema field names/types + index names for the three tables.
- Internal `version` representation (monotonic int vs timestamp vs ulid).
- Batch sizes for versioned write + retention sweep cadence + final N.
- Whether `getProjectGraph` defaults snapshotId to the known id or most-recent.
- `internalMutation` (not `mutation`) for httpAction-driven entity writes.

## Deferred Ideas

- Multi-project / multi-snapshotId support (schema-ready; no UI here).
- Code/vault-graph temporal diff UI (Phase 87, KG-11; enabled by keep-N retention).
- Snapshot freshness/staleness banner (Phase 84 client concern).
- **Flagged for research:** (1) verify the producer is wired into Ástríðr's nightly cron + pointed at the right repos/vault; (2) confirm Convex per-mutation write + per-query read limits vs ~13.5k worst-case rows.
