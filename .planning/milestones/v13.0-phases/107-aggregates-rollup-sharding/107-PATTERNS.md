# Phase 107: Aggregates Rollup Sharding - Pattern Map

**Mapped:** 2026-08-05
**Scope:** Zero new files. Modifies `convex/schema.ts`, `convex/analyticsRollup.ts`, `convex/events.ts`,
and 3 test files. This document extracts in-repo CONVENTIONS for those edits — it does not restate
RESEARCH.md's mechanism/correctness findings.

## 1. Optional-field-on-existing-table precedent (closest analog to D-04)

**Best match: `billingType` on `aggregates.dimensions`, added Phase 67.** Same table, same
"added later, old rows lack it, readers must default the missing value" shape as D-01's
`shard: v.optional(v.float64())`.

Every reader defaults the missing value the same way — `?? "api"`:
- `convex/aggregates.ts:59` — `` `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}::${dims?.goalId ?? ""}` ``
- `convex/aggregates.ts:620-623` — comment: `"Legacy rows (no billingType in dimensions) default to 'api' (conservative)."` then `const bt = (r.dimensions as { billingType?: string } | null)?.billingType ?? "api";`
- `convex/aggregates.ts:78,265,738,798` — `` const billingType = (r as any).billingType ?? getBillingType(r.provider); ``

And it has a dedicated regression test for exactly the "legacy row missing the field" case —
`convex/aggregates.test.ts:375-388`:
```typescript
test("legacy rows without billingType dimension are treated as 'api'", () => {
  // Phase 67: backward compat — legacy rows (no billingType) default to "api"
  const rows = [
    { value: 10, dimensions: { provider: "anthropic_direct" } }, // no billingType field
    { value: 5, dimensions: { provider: "codex", billingType: "subscription" } },
  ];
  const billingTypeFilter = "api";
  const filtered = rows.filter((r) => {
    const bt = (r.dimensions as { billingType?: string })?.billingType ?? "api";
    return bt === billingTypeFilter;
  });
  expect(filtered).toHaveLength(1);
  ...
```

**Convention for the planner:** `shard` is D-01's group-key equivalent of `billingType` — write a
symmetric Wave-0 test, e.g. `"legacy rows without shard are treated as shard 0 / participate in
summing normally"`, matching this exact shape (seed one row with no `shard`, one with an explicit
value, assert the accumulation is correct). Note `billingType` lives inside `dimensions: v.any()`
while `shard` is a **top-level** schema field (per D-01/schema.ts:958-961) — the nullish-coalescing
default pattern is identical, only the access path differs (`r.shard ?? 0` vs `dims?.billingType ?? "api"`).

## 2. Read-patch-or-insert convention

Two shapes coexist in this repo. `analyticsRollup.ts`'s own two functions are the closer analog to
what the shard change touches (multi-row collect + JS-side sub-key match). A second, simpler
"latest-by-key" shape exists elsewhere and should NOT be used as the template here (different
problem: single time-series row per key, not multiple co-located dimension rows).

**In-file precedent (the pattern the shard field must slot into), `convex/analyticsRollup.ts:33-56`:**
```typescript
const bucketRows = await ctx.db
  .query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "events").eq("period", "hourly").eq("bucket_start", hourStart)
  )
  .collect();
// JS-side dimension match (Pitfall 3) — never an object-equality filter on the
// dimensions field; collect the bucket rows and match in JS instead.
const existing = bucketRows.find((r) => {
  const dims = r.dimensions as { event_type?: string } | null;
  return dims?.event_type === eventType;
});

if (existing) {
  await ctx.db.patch(existing._id, { value: existing.value + 1 });
} else {
  await ctx.db.insert("aggregates", {
    metric_type: "events", period: "hourly", bucket_start: hourStart,
    value: 1, dimensions: { event_type: eventType },
  });
}
```
The shard field slots in as one more equality clause in the `.find()` predicate and one more
key in the insert payload — exactly RESEARCH.md's recommendation, and exactly this file's own
established shape (`dimensions` is unindexed and JS-matched here for the same reason `shard`
should stay unindexed).

**Simpler "latest wins" upsert shape elsewhere (NOT the template, cited for contrast only)** —
`convex/providerHealth.ts:19-40` and `convex/channelHealth.ts:16-36`, both: single `.first()`
lookup on an index (`by_provider` / `by_channel`, `.order("desc")`), patch-if-found /
insert-if-not. This is a single-row-per-key upsert, not a multi-row-collect-then-JS-match — do
not model the shard change on this shape; `analyticsRollup.ts`'s own functions are the right
template since they already handle the multi-row-per-index-key case `shard` extends.

## 3. Convex test-fixture convention (`makeStore()`)

Verbatim from `convex/analyticsRollup.test.ts:22-53` — this is the fake-`ctx.db` harness new
multi-shard fixtures must match:
```typescript
// --- in-memory aggregates + events store (mirrors convex/llm.test.ts:7-14) ---
type Row = Record<string, any>;

function makeStore() {
  const aggregates: Row[] = [];
  const events: Row[] = [];
  let nextId = 0;

  const tableOf = (name: string) => (name === "events" ? events : aggregates);

  const db = {
    query: (table: string) => ({
      withIndex: (_name: string, _fn?: any) => ({
        collect: async () => tableOf(table).slice(),
        first: async () => tableOf(table)[0] ?? null,
      }),
    }),
    insert: async (table: string, data: Row) => {
      const _id = String(nextId++);
      tableOf(table).push({ ...data, _id });
      return _id;
    },
    patch: async (id: string, data: Row) => {
      for (const t of [aggregates, events]) {
        const idx = t.findIndex((r) => r._id === id);
        if (idx >= 0) Object.assign(t[idx], data);
      }
    },
  };

  return { aggregates, events, db };
}
```
Note the fake `withIndex()` **ignores the index predicate entirely** and just returns the whole
table — filtering happens only via the real code's own `.find()`/JS-match logic, or via direct
array literals in the test itself (see below). This means Wave-0 fixtures do not need to construct
real Convex index query builders — just push plain row objects into `aggregates: Row[]`.

**Existing consumer of this harness that must change (Pitfall 1 from RESEARCH.md)** —
`convex/analyticsRollup.test.ts:193-208`, the "increment patch-or-insert" test, currently calls
`incrementEventBucket(ctx, eventType, timestamp)` with no shard argument; it will need a fixed
explicit shard (e.g. `0`) once the signature gains a `shard` parameter — this is the concrete
file:line the planner should point the "update patch-or-insert test" task at.

**Other Convex test files seed `aggregates` rows as plain array literals**, not via `makeStore()`
— e.g. `convex/aggregates.test.ts:377-380` seeds `{ value: 10, dimensions: {...} }` objects
directly and calls the read-side fold function on that array. Use this simpler literal-array
style for read-side (`aggregates.ts`/`analyticsRollupQueries.ts`/`analytics.ts`) shard-summing
tests; reserve `makeStore()` for tests that exercise the actual mutation/write-path functions
(`analyticsRollup.test.ts` only).

## 4. Exported-constant placement (D-01's `AGGREGATE_SHARD_COUNT`)

**Dominant convention: `convex/lib/` for constants/utilities imported by multiple `convex/*.ts`
modules across both the write and read path.** Two existing files establish this:

- `convex/lib/providers.ts:1-5` — explicit header: `"Central provider registry for CodePulse. Single source of truth for all known provider names. Import from here — never hardcode provider arrays elsewhere."` Exports `ALL_PROVIDERS`, `PROVIDER_BILLING`, `getBillingType()`.
- `convex/lib/sankeyClassify.ts:1-11` — header explicitly states the reason for extraction: `"Extracted VERBATIM from convex/analytics.ts:53-65 ... This is the SOLE source of categoryOf/outcomeOf so the read path ... and the ingest-time write path ... can never drift."`

**`analyticsRollup.ts` itself already imports from `convex/lib/` for exactly this
cross-module-constant reason** — `convex/analyticsRollup.ts:20-21`:
```typescript
import { categoryOf, outcomeOf } from "./lib/sankeyClassify";
import { getBillingType } from "./lib/providers";
```
And `convex/providerHealth.ts:3` imports the same constant from `./lib/providers` in a
*different* module, confirming the "used by ≥2 files → put it in `convex/lib/`" pattern is live,
not just a one-off.

**Recommendation with evidence, not a guess:** since D-01 requires `AGGREGATE_SHARD_COUNT` to be
imported by every write site (`analyticsRollup.ts` AND `events.ts`, per RESEARCH.md's own code
example at line 151), this matches the `convex/lib/` precedent's exact trigger condition
(cross-module shared constant) rather than the "define constants in the owning module" case —
there is no example in this repo of a constant needed by 2+ modules being left un-hoisted to
`lib/`. Planner's call on the exact filename (a new `convex/lib/aggregates.ts`, or adding to
existing `convex/lib/providers.ts` — the latter is a naming mismatch, so a new small file is
likely cleaner), but the **directory** is not actually an open question given this evidence.

## No Analog Found

- No precedent in this repo for a constant living in a bare `convex/constants.ts` at the top
  level (outside `lib/`) — `convex/lib/` is the only shared-constants location that exists.
