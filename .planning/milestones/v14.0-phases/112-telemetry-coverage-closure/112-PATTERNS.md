# Phase 112: Telemetry Coverage Closure - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 10 seams (per RESEARCH.md §Secondary Research Question 1), covering
`governor_decision` (routed + surfaced, D-04) and `message_routed` (routed only, no UI this
phase, D-13)
**Analogs found:** 10 / 10 — every cited analog exists at (or very near) its cited location.
One line-number correction below (retention.test.ts's Phase-108 assertion block starts at
line 68, not 68-71 as a range — the block itself runs 68-71, confirmed exact).

All excerpts below are quoted verbatim from live files, read in this session. Do not
paraphrase from this document — re-read the cited `file:line` before writing code that
depends on exact syntax (validator shapes, regex patterns, etc.).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/schema.ts` (new table(s) + index) | model | CRUD (append-only insert, indexed read) | `controlVerbSwaps` (`schema.ts:2140-2171`), `activeEngineSnapshots` (`schema.ts:2109-2118`) | exact |
| `convex/<domain>.ts` (new, e.g. `governorDecisions.ts`) | service | CRUD | `convex/controlVerbSwaps.ts` (full file) | exact |
| `convex/<domain>Filters.ts` (new, if a CAP constant is needed) | utility | transform | `convex/controlVerbSwapsFilters.ts` (full file) | exact |
| `convex/runtimeIngest.ts` — new `case` | controller (dispatch) | event-driven | `case "control_verb_swap"` at `runtimeIngest.ts:1022-1051` | exact |
| `convex/runtimeIngest.ts` — new `resolve<Kind>Event()` | transform | event-driven | `resolveControlVerbSwapEvent` (`runtimeIngest.ts:369-421`) + `isOptionalString`/`normalizeOptional`/`isOptionalStringArray` (`runtimeIngest.ts:207-268`) | exact |
| `convex/retention.ts` — new `RETENTION_DAYS` entry | config | batch (nightly prune) | `controlVerbSwaps: 30` entry + comment (`retention.ts:76-87`) | exact |
| `convex/retention.test.ts` — extend | test | batch | `retention.test.ts:68-71` (Phase 108 tables-must-not-become-unbounded assertion) | exact |
| `src/hooks/use<Domain>.ts` (new) | hook | request-response (reactive query) | `src/hooks/useControlVerbSwaps.ts` — see caveat below, this hook is NOT the thin `?? []` wrapper RESEARCH.md's checklist implies | partial — see note |
| `GovernorDecisionLog` component (new) | component | request-response | `SwapHistoryList.tsx` (structural) + `DeliveryHistory.tsx` (hosting/loading/empty/error) | exact (per approved UI-SPEC) |
| `convex/<domain>.test.ts`, `convex/runtimeIngest.test.ts` additions | test | CRUD / event-driven | `convex/controlVerbSwaps.test.ts` (CR-01 + bounded-read guards), `convex/runtimeIngest.test.ts:1207-1298` (null-normalization resolver tests) | exact |

**Note on the hook analog:** `useControlVerbSwaps.ts` is NOT a thin `useQuery(...) ?? []`
wrapper — it's a two-query combine-and-merge hook (`listByScope` + `listGlobal` via
`mergeSwapHistory`) because `control_verb_swap` has a per-profile scope axis that
`governor_decision` does not (confirmed no `profileId` field in the contract or the live
measurement — UI-SPEC's own Host rationale, `112-UI-SPEC.md:169-174`, says exactly this: "it
needs a single global mount"). The genuinely-thin pattern to copy is `listGlobal`'s
single-query shape from that same file (`controlVerbSwaps.ts:111-120`) plus a bare
`useQuery(api.<domain>.<query>) ?? []` — there is no existing hook file in this repo that is
*only* that one line, so this is a synthesis of two real, cited patterns rather than a single
file copy. Shown in full below.

---

## Pattern Assignments

### 1. `convex/schema.ts` — new domain table(s) + index

**Analog A — `controlVerbSwaps`, `convex/schema.ts:2120-2171`** (closest structural match:
append-only audit trail, bounded `.take()` read pattern, no per-profile scoping needed for
`governor_decision` since it carries no `profileId`):

```typescript
  // ============================================================
  // CONTROL VERB SWAPS (Phase 108, TELE-02/D-13/D-14) — per-profile
  // swap-history audit trail, append-only.
  // ============================================================

  // astridr/engine/control_verbs/swap_model.py and swap_voice.py emit one
  // `control_verb_swap` event per swap attempt (restore/unresolved/
  // affinity-refused/success). D-13: every emit is stored here, INCLUDING
  // refusals — the refusal path is exactly where the affinity guard and the
  // resolver fail, and a history that stores only successes would claim
  // every swap worked. D-14: one table holds BOTH brain (verb:"swap_model")
  // and voice (verb:"swap_voice") swaps, discriminated by `verb`, because
  // both verbs emit the same event name on the same channel — the D-15
  // readout filters to verb:"swap_model"; voice rows are captured but not
  // yet surfaced (deferred, not dropped). `scope` is the one new column this
  // phase adds: the explicit profileId when a swap was scoped, absent when
  // global. `verb`/`path` are kept v.string() (not Literal unions) to match
  // this schema's defensive-boundary convention — validated at the ingest
  // edge (convex/controlVerbSwaps.ts), not the schema, so an unexpected
  // astridr value is stored and diagnosable rather than poisoning the batch.
  controlVerbSwaps: defineTable({
    verb: v.string(), // "swap_model" | "swap_voice"
    target: v.optional(v.string()), // raw utterance/tag target; absent on restore
    resolved: v.optional(v.string()), // resolved model id (swap_model) or voice display name (swap_voice)
    providerAffinity: v.optional(v.array(v.string())),
    voiceId: v.optional(v.string()), // swap_voice only
    path: v.string(), // "claude-native" | "openrouter" | "refused" | "restore" | "swap"
    reason: v.optional(v.string()), // swap_model refusal discriminator only
    scope: v.optional(v.string()), // D-13: explicit profileId when scoped, absent when global
    sessionId: v.optional(v.string()),
    channel: v.string(),
    timestamp: v.float64(),
  })
    .index("by_scope", ["scope", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
```

**Analog B — `activeEngineSnapshots`, `convex/schema.ts:2095-2118`** (the "kept `v.string()`
not a Literal union, validated at the ingest edge" convention, applicable to `governor_decision`'s
free-form `emitter` field per RESEARCH.md Pitfall 3):

```typescript
  activeEngineSnapshots: defineTable({
    profileId: v.string(),
    model: v.string(),
    mode: v.string(), // "session" | "pinned" | "inherited"
    selectionPath: v.optional(v.string()),
    expiresAt: v.optional(v.float64()), // epoch seconds, set only when mode === "session"
    timestamp: v.float64(),
  })
    .index("by_profileId", ["profileId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),
```

**Shape to imitate for `governorDecisions`:** contract §2.40 fields are `emitter` (string,
free-form per RESEARCH.md Pitfall 3 — never a `Literal` union), `priority` (string, 4 observed
values but keep `v.string()` per this schema's own convention), `spoke` (boolean), `held_reason`
(`v.optional(v.string())` — **must** go through the null-normalization pattern below before
reaching this validator), `timestamp` (`v.float64()`, epoch seconds). Index at minimum
`by_timestamp` for the bounded `.take()` read (no `profileId` exists on this kind — do not add a
`by_profileId`/`by_scope` index that has nothing to key on).

**Shape to imitate for `message_routed`'s table (D-13, routed but not surfaced):** per
RESEARCH.md's measured payload shape, fields are `channel`, `profile`, `sender`, `session_id`
— all `v.string()` per the same defensive-boundary convention (RESEARCH.md's A2 assumption:
`profile` is not a fixed enum). Add its own `RETENTION_DAYS` entry per D-06 even though it has
no UI this phase — routing without retention-bounding is the exact anti-pattern D-06 exists to
prevent.

---

### 2. `convex/<domain>.ts` (new) — `internalMutation` write + bounded `query` reads

**Analog:** `convex/controlVerbSwaps.ts` (full file, 121 lines). Full write mutation and one
global-scope read (the closer analog for `governor_decision`, which has no `profileId` to
scope by — `listGlobal`, not `listByScope`, is the pattern to copy):

```typescript
// convex/controlVerbSwaps.ts:1-3
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { SWAP_HISTORY_CAP } from "./controlVerbSwapsFilters";
```

```typescript
// convex/controlVerbSwaps.ts:46-66 — the internalMutation write pattern (CR-01)
/**
 * record — Append-only insert of one control_verb_swap row. Never patches or
 * deletes an existing row.
 *
 * D-13: this mutation is the ONLY write path for the swap-history axis, and
 * it is reachable ONLY from the astridr `control_verb_swap` telemetry ingest
 * case (convex/runtimeIngest.ts, plan 108-03). The UI must NEVER call this
 * directly to assert a swap happened.
 *
 * ENFORCED (CR-01 rule, same as activeEngine.ts's recordRouting): declared
 * as an `internalMutation`, so it does not exist in the client-callable
 * `api.` namespace at all. This closes the devtools-forgeable write path a
 * plain `mutation` would leave open — any holder of the shipped
 * VITE_CONVEX_URL could otherwise call `api.controlVerbSwaps.record`
 * directly and insert a fabricated "server-confirmed" swap-history row that
 * the D-15 GlobalSwapModal history section would render as truth.
 */
export const record = internalMutation({
  args: {
    verb: v.string(),
    target: v.optional(v.string()),
    resolved: v.optional(v.string()),
    providerAffinity: v.optional(v.array(v.string())),
    voiceId: v.optional(v.string()),
    path: v.string(),
    reason: v.optional(v.string()),
    scope: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    channel: v.string(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("controlVerbSwaps", { ...args });
  },
});
```

```typescript
// convex/controlVerbSwaps.ts:111-120 — the bounded GLOBAL (no-scope) read pattern,
// the closer analog for governor_decision (no profileId axis at all)
export const listGlobal = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("controlVerbSwaps")
      .withIndex("by_scope", (q) => q.eq("scope", undefined))
      .order("desc")
      .take(SWAP_HISTORY_CAP);
  },
});
```

For `governorDecisions`, this becomes (shape only, not a proposed final implementation —
naming is Claude's Discretion):

```typescript
export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("governorDecisions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(GOVERNOR_DECISION_CAP); // never .collect()
  },
});
```
(This exact shape is also given in RESEARCH.md's Code Examples section, `convex/controlVerbSwaps.ts:76-87`-attributed but actually closer to the `by_timestamp`-only global-read idiom above — same pattern, no per-scope filter needed.)

**CR-01 rule to state explicitly in the plan:** the write mutation MUST be `internalMutation`,
never `mutation` — this is a repo-wide, ASVS V4-tagged security requirement (see
`112-RESEARCH.md`'s Security Domain table), not a style preference.

---

### 3. `convex/<domain>Filters.ts` (new, if needed) — CAP constant + pure helpers

**Analog:** `convex/controlVerbSwapsFilters.ts` (full file, 88 lines). The documented reason
for the split, verbatim:

```typescript
// convex/controlVerbSwapsFilters.ts:1-13
/**
 * controlVerbSwapsFilters.ts — the shared, dependency-free constant + predicate for the
 * control-verb-swap axis (Phase 108, TELE-02, D-13/D-14).
 *
 * Split out of `convex/controlVerbSwaps.ts` (bundling defect found at RUNTIME after 108-06 shipped,
 * see 108-REVIEW.md): `controlVerbSwaps.ts` imports `internalMutation`/`query` from
 * `./_generated/server` to define `record`/`listByScope`, so any browser code that value-imported
 * `SWAP_HISTORY_CAP`/`isBrainSwap` directly from that file pulled the whole Convex server runtime
 * into the client bundle — exactly the "Convex functions should not be imported in the browser"
 * warning. Mirrors `activeEngineFilters.ts`'s precedent for the active-engine axis: deliberately
 * dependency-free — no `convex/values`, no `./_generated/*`, no React — so the Convex server bundle
 * and the browser bundle can both import it without either pulling in the other's runtime.
 */
```

```typescript
// convex/controlVerbSwapsFilters.ts:15-20
/** Row cap for the per-scope swap-history read. Exported so the D-15 UI's
 * on-screen truncation caption and the server query's `.take()` cannot drift
 * apart — mirrors `activeEngine.ts`'s bounded-read discipline, sized for a
 * modal history section (vs. `latestByProfile`'s 200 for a dashboard-wide
 * read). */
export const SWAP_HISTORY_CAP = 20;
```

For `governorDecisions`, this becomes a single exported `GOVERNOR_DECISION_CAP` constant (no
`isBrainSwap`-equivalent predicate needed — there is no verb-discrimination axis for this
kind). Only create this file if the component needs the cap for its own truncation caption
(per the UI-SPEC's "Showing the last N…" convention below) — if the cap is only ever consumed
server-side, it can stay in `<domain>.ts` directly. `controlVerbSwapsFilters.ts` exists
specifically because `SWAP_HISTORY_CAP` is consumed by BOTH `controlVerbSwaps.ts` (server) and
`src/hooks/useControlVerbSwaps.ts` (browser) — same test applies here.

---

### 4 & 5. `convex/runtimeIngest.ts` — dispatch `case` + `resolve<Kind>Event()` (highest-value excerpt)

**The null-normalization helpers — quote in full, `runtimeIngest.ts:207-268`:**

```typescript
// convex/runtimeIngest.ts:207-227
/** Runtime type guard: `undefined`, `null`, or a `string` — matches every
 * `v.optional(v.string())` field this file forwards to a Convex
 * `internalMutation`. A field of any other type must never reach the
 * mutation call (its argument validator throws, uncaught, inside the batch
 * loop — the WR-06/168-06 class).
 *
 * 108-07 gap closure: `null` is treated as "field absent", same as
 * `undefined`. A producer can legitimately serialize an absent optional
 * field as an explicit JSON `null` rather than omitting the key (confirmed
 * live: astridr's buffered `_post_to_convex()` did exactly this for
 * `session_id` on every WS-originated `control_verb_swap`) — Convex's own
 * `v.optional(v.string())` validator does NOT accept an explicit `null`, so
 * this guard used to reject it, `resolveControlVerbSwapEvent` returned
 * `null` for the WHOLE event, and the insert was silently skipped with no
 * exception and no counter increment. This guard only decides SKIP vs
 * PROCEED — it never forwards a `null` itself. See `normalizeOptional`
 * below, which is what strips the `null` out of the value actually
 * returned to the caller. */
function isOptionalString(value: unknown): value is string | undefined | null {
  return value === undefined || value === null || typeof value === "string";
}

/** Runtime type guard: `undefined`, `null`, or a `number` — matches every
 * `v.optional(v.float64())` field. Same `null`-as-absent rationale as
 * `isOptionalString` above (108-07 gap closure). */
function isOptionalNumber(value: unknown): value is number | undefined | null {
  return value === undefined || value === null || typeof value === "number";
}
```

```typescript
// convex/runtimeIngest.ts:236-248
/**
 * normalizeOptional — converts an explicit `null` to `undefined`, passing
 * every other value through unchanged. Convex's `v.optional(...)`
 * validators accept an omitted key or `undefined` but reject an explicit
 * `null` outright, so any value that survives an `isOptionalString`/
 * `isOptionalNumber` check (which now treats `null` as valid-because-absent)
 * MUST be passed through this before it reaches a mutation arg — otherwise
 * the type guard's own `null` allowance would just relocate the throw from
 * the guard to the validator. 108-07 gap closure.
 */
function normalizeOptional<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}
```

```typescript
// convex/runtimeIngest.ts:250-268 — the array variant, in case governor_decision or
// message_routed ever needs it (not currently needed by either per RESEARCH.md's payload
// shapes, but shown for completeness since it's the same defect class)
function isOptionalStringArray(value: unknown): value is string[] | undefined | null {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}
```

**The resolver to imitate — quote in full, `runtimeIngest.ts:332-421`** (interface +
docstring + body):

```typescript
// convex/runtimeIngest.ts:332-344
interface ResolvedControlVerbSwapEvent {
  verb: string;
  target?: string;
  resolved?: string;
  providerAffinity?: string[];
  voiceId?: string;
  path: string;
  reason?: string;
  scope?: string;
  sessionId?: string;
  channel: string;
  timestamp: number;
}
```

```typescript
// convex/runtimeIngest.ts:369-421
export function resolveControlVerbSwapEvent(
  data: unknown,
  timestamp: number
): ResolvedControlVerbSwapEvent | null {
  const d = (data ?? {}) as Record<string, any>;
  const verb = d.verb;
  const path_ = d.path;
  const channel = d.channel;
  if (typeof verb !== "string" || !verb) return null;
  if (typeof path_ !== "string" || !path_) return null;
  if (typeof channel !== "string" || !channel) return null;

  const target = d.target;
  const resolved = d.resolved;
  const providerAffinity = d.providerAffinity ?? d.provider_affinity;
  const voiceId = d.voiceId ?? d.voice_id;
  const reason = d.reason;
  const scope = d.scope ?? d.profileId ?? d.profile_id;
  const sessionId = d.sessionId ?? d.session_id;

  if (
    !isOptionalString(target) ||
    !isOptionalString(resolved) ||
    !isOptionalStringArray(providerAffinity) ||
    !isOptionalString(voiceId) ||
    !isOptionalString(reason) ||
    !isOptionalString(scope) ||
    !isOptionalString(sessionId)
  ) {
    return null;
  }

  // normalizeOptional: any of these may have survived the guards above as
  // an explicit `null` (108-07 gap closure — this is the exact defect
  // confirmed live: astridr's WS `swap.set` dispatch always constructs
  // `ControlVerbContext(session_id=None, ...)`, and the buffered telemetry
  // post serialized that as literal `"session_id": null`) — strip it to
  // `undefined` before it reaches controlVerbSwaps.record's v.optional()
  // validators, which reject an explicit `null`.
  return {
    verb,
    target: normalizeOptional(target),
    resolved: normalizeOptional(resolved),
    providerAffinity: normalizeOptional(providerAffinity),
    voiceId: normalizeOptional(voiceId),
    path: path_,
    reason: normalizeOptional(reason),
    scope: normalizeOptional(scope),
    sessionId: normalizeOptional(sessionId),
    channel,
    timestamp,
  };
}
```

**D-14's concrete implication:** for `resolveGovernorDecisionEvent`, `held_reason` MUST go
through `isOptionalString(heldReason)` then `normalizeOptional(heldReason)` exactly like
`target`/`resolved`/etc. above — this is not a hypothetical, it is the majority wire shape
(424 of 646 held rows arrive as explicit JSON `null`, per D-14/RESEARCH.md's cross-tab).

**The dispatch case to imitate — quote in full, `runtimeIngest.ts:1022-1051`:**

```typescript
// convex/runtimeIngest.ts:1022-1051
          case "control_verb_swap": {
            // Phase 108 (TELE-02, D-13/D-14): routes a swap-attempt event into
            // the controlVerbSwaps domain table (convex/controlVerbSwaps.ts,
            // plan 108-02), in addition to the generic runtime_events row this
            // file already writes for every event above. Resolution/skip logic
            // (dual snake/camelCase coalescing, required-field + — gap closure —
            // runtime type-checking of every forwarded field) lives in
            // `resolveControlVerbSwapEvent` above, same extraction rationale as
            // `resolveModelRoutingEvent`.
            //
            // D-13: unlike model_routing, there is deliberately NO
            // isUnresolvedRouting-equivalent SEMANTIC guard in that resolver —
            // a refusal (affinity guard, resolver failure) IS a valid row for
            // this table. Do not "harden" it into dropping refusals; only a
            // runtime TYPE mismatch causes a skip there.
            const resolved = resolveControlVerbSwapEvent(data, timestamp);
            if (!resolved) {
              // 108-07 gap closure: this is the exact defect the live
              // ENGINE-05 proof found — every WS swap.set dispatch used to
              // be refused here (an explicit `session_id: null` rejected by
              // the pre-fix isOptionalString) with zero visible signal.
              skippedCount++;
              console.warn(
                "[runtimeIngest] skipped control_verb_swap event: resolveControlVerbSwapEvent rejected the payload (missing/wrong-typed verb, path, or channel, or a wrong-typed optional field)"
              );
              break;
            }
            await ctx.runMutation(internal.controlVerbSwaps.record, resolved);
            break;
          }
```

**Where the case goes:** inside the `switch (evt.eventType)` block that starts at
`runtimeIngest.ts:526`, itself inside the per-event `try { ... }` at `runtimeIngest.ts:509`
(closes at `~1071`+). The always-run generic insert into `runtime_events`
(`ctx.runMutation(api.events.insertEvent, ...)`) happens at `runtimeIngest.ts:517-523`,
BEFORE the switch — confirmed still true, routing is strictly additive, this write is
untouched by adding a new case.

**Per-event isolation is inherited, not something to re-add** — the enclosing `try` at
`runtimeIngest.ts:509` (comment block `runtimeIngest.ts:483-508` explains the WR-06/168-06
history) already wraps both the generic insert and the entire switch. A malformed
`governor_decision`/`message_routed` event increments `skippedCount` (declared at
`runtimeIngest.ts:480`) via the resolver-returns-null path, or is caught by the per-event
`try`/`catch` if a throw somehow still occurs — no new try/catch discipline is needed per
case.

---

### 6. `convex/retention.ts` — new `RETENTION_DAYS` entry

**Analog:** `controlVerbSwaps: 30` entry, `retention.ts:76-87` (closest structural fit for
`governorDecisions` — append-only audit list read via bounded `.take()`, same as
`controlVerbSwaps`, not a latest-per-key lookup like `activeEngineSnapshots`/
`gatewayQuotaSnapshots`):

```typescript
// convex/retention.ts:76-87
  // Phase 108 D-10 — new table, bounded BEFORE it can ever grow (same
  // pre-emptive move as gatewayQuotaSnapshots/toolPolicyEvents above). Only
  // the latest row per profile is ever read via activeEngine.latestByProfile,
  // so any window is pure headroom, not a functional limit.
  activeEngineSnapshots: 30,
  // Phase 108 D-14 — new table, same tier as activeEngineSnapshots above
  // (keeps the mental model simple: both are Phase 108's new per-profile
  // engine-axis tables). Swap-history is a manual/rare operator action
  // (D-15's "what did I last switch this to"), so 30 days is ample without
  // reaching for the 90-day build/history tier reserved for higher-value
  // long-horizon tables.
  controlVerbSwaps: 30,
```

**The array/map header comment establishing the "exported for the test" contract,
`retention.ts:35-38`:**

```typescript
// convex/retention.ts:35-38
// Exported for retention.test.ts, which asserts every key here is a REAL schema
// table: a typo'd table name is a permanent SILENT no-op — the nightly prune
// simply never deletes anything for it and nothing ever reports the mismatch.
export const RETENTION_DAYS: Record<string, number> = {
```

**Recommended windows per RESEARCH.md's Secondary Q4 (Claude's Discretion, not locked):**
`governorDecisions: 30` (closest read-pattern match to `controlVerbSwaps` — append-only,
bounded-`.take()` audit list, at the measured 83.3 rows/day this accumulates ~2,500 rows over
30 days); `message_routed`'s table at 90 (matches `toolPolicyEvents`' "rare event" framing —
at 0.7-1.2 rows/day this accumulates well under 200 rows regardless of window chosen).

---

### 7. `convex/retention.test.ts` — the drift-guard test (D-10's model)

**Analog:** `convex/retention.test.ts`, full file read (231 lines). The exact mechanism,
quoted:

**Source-level schema parsing (not a live import), `retention.test.ts:14-27`:**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { RETENTION_DAYS, PRUNE_PREDICATES } from "./retention";
import { summarizeOverhangProbe } from "./retentionCursor";

const schemaSource = readFileSync(resolve(process.cwd(), "convex/schema.ts"), "utf-8");

/** Every `someTable: defineTable({` declared in schema.ts. */
const schemaTables = new Set(
  Array.from(schemaSource.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*defineTable\(/gm)).map(
    (m) => m[1]
  )
);
```

**The "guard the guard" liveness check, `retention.test.ts:29-36`** — must be copied
verbatim in spirit for whatever source-parsing D-10's own test does:

```typescript
describe("RETENTION_DAYS", () => {
  it("parsed a plausible set of tables out of schema.ts (harness liveness check)", () => {
    // Guard the guard: if the regex ever stops matching, every assertion below
    // would pass vacuously against an empty set.
    expect(schemaTables.size).toBeGreaterThan(20);
    expect(schemaTables.has("alerts")).toBe(true);
    expect(schemaTables.has("llmMetrics")).toBe(true);
  });

  it("every pruned table name is a real table in schema.ts (silent-no-op guard)", () => {
    const unknown = Object.keys(RETENTION_DAYS).filter((t) => !schemaTables.has(t));
    expect(unknown).toEqual([]);
  });
```

**The specific-value, not-generic assertion (the shape proven necessary by mutation testing —
D-10 needs its own equivalent for `governor_decision`/`message_routed`'s dispositions),
`retention.test.ts:57-71`:**

```typescript
  // Post-execution gap closure (adversarial mutation-testing pass, 2026-08-07): deleting the
  // `controlVerbSwaps: 30` entry from RETENTION_DAYS outright was caught by nothing above — the
  // existing tests only assert generic properties (every key is a real schema table, every
  // window is positive, gatewayQuotaSnapshots specifically, a narrowed keep-forever list —
  // Phase 110 D-03 dropped `aggregates` from it, since `aggregates` is now itself a
  // RETENTION_DAYS key protected by a predicate rather than by absence) and never
  // asserted these two Phase 108 tables are present at all. A table silently becoming unbounded
  // is the exact class of defect CLAUDE.md records as having caused a real OOM crash-loop on
  // this self-hosted instance. Unlike the CR-01/scope-filter guards elsewhere in this repo, this
  // one needs no source-level regex workaround — RETENTION_DAYS is a plain object, so this is a
  // full behavioral assertion against the live values, not a stand-in for one.
  it("bounds controlVerbSwaps (D-14) and activeEngineSnapshots (D-10) at 30 days — Phase 108 tables must not silently become unbounded", () => {
    expect(RETENTION_DAYS).toHaveProperty("controlVerbSwaps", 30);
    expect(RETENTION_DAYS).toHaveProperty("activeEngineSnapshots", 30);
  });
```

**The known-present/known-absent pairing pattern for a documented exemption (the template for
D-11's "reason and measurement date" requirement), `retention.test.ts:73-93`:**

```typescript
  it("prompts and promptVersions are exempt by design (Phase 116 D-13)", () => {
    // Absence assertions alone would pass vacuously against an empty or
    // mis-imported RETENTION_DAYS — controlVerbSwaps is a known-present
    // control in the same assertion style.
    expect(Object.keys(RETENTION_DAYS)).not.toContain("prompts");
    expect(Object.keys(RETENTION_DAYS)).not.toContain("promptVersions");
    expect(Object.keys(RETENTION_DAYS)).toContain("controlVerbSwaps");

    // Prove the absence above is a real exemption of real tables, not a typo:
    // both tables actually exist in schema.ts.
    expect(schemaTables.has("prompts")).toBe(true);
    expect(schemaTables.has("promptVersions")).toBe(true);

    // The exemption must be documented in place, not merely absent — read
    // convex/retention.ts's own source the same way this file already reads
    // convex/schema.ts's source above.
    const retentionSource = readFileSync(resolve(process.cwd(), "convex/retention.ts"), "utf-8");
    expect(retentionSource).toContain("D-13");
    expect(retentionSource).toContain("prompts");
    expect(retentionSource).toContain("promptVersions");
  });
```

**Direct implication for D-10/D-11's new disposition-const test:** build the same three-layer
model — (1) a liveness/"guard the guard" check that the enumeration mechanism (regex over
`runtimeIngest.ts`'s switch cases, or a hand-maintained list of the 7 Group B kinds) finds a
plausible non-empty, non-trivial set; (2) a specific `toHaveProperty`/`toBe` assertion per
kind's disposition (not a generic "every kind has *some* disposition" loop — proven
insufficient by the exact mutation-testing finding quoted above); (3) a `retentionSource`-style
`.toContain(...)` assertion that the reason/date text is actually present in the source near
each entry, for D-11's "reason and measurement date" requirement.

---

### 8. `src/hooks/use<Domain>.ts` (new) — thin reactive-query hook

**Analog A — the file-splitting/export discipline, `src/hooks/useControlVerbSwaps.ts:32-36`:**

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { isBrainSwap, mergeSwapHistory, SWAP_HISTORY_CAP } from "../../convex/controlVerbSwapsFilters";

export { SWAP_HISTORY_CAP };
```

**Analog B — the genuinely-thin single-query shape to copy for `governor_decision`** (no
merge, no scope axis — this is a synthesis from `listGlobal`'s query shape, shown fully at
seam 2 above, wrapped the way every other `useFoo.ts` hook in this repo wraps a query; there
is no example this simple already in the repo because every existing routed-and-surfaced
domain table so far has had a `profileId` axis to scope by):

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GOVERNOR_DECISION_CAP } from "../../convex/governorDecisionsFilters"; // if that file exists

export { GOVERNOR_DECISION_CAP };

export type GovernorDecisionRow = {
  _id: string;
  emitter: string;
  priority: string;
  spoke: boolean;
  heldReason?: string;
  timestamp: number;
};

const EMPTY_ROWS: GovernorDecisionRow[] = [];

export function useGovernorDecisions(): GovernorDecisionRow[] {
  return (useQuery(api.governorDecisions.listRecent, {}) as GovernorDecisionRow[] | undefined)
    ?? EMPTY_ROWS;
}
```

Note this returns `[] `during loading, matching `useControlVerbSwaps.ts`'s own stated
convention (`useControlVerbSwaps.ts:5-11`: "collapse loading and empty into one honest-empty
default... 'no history yet' and 'still loading' are both correctly, honestly rendered as an
empty history section"). **This differs from the UI-SPEC's stated Loading state**, which
distinguishes `useQuery(...) === undefined` (skeleton) from `rows.length === 0` (empty
message) — per `112-UI-SPEC.md`'s States section, the component itself must read the RAW
`useQuery` result (not a coalesced hook) to draw that distinction, matching
`DeliveryHistory.tsx`'s own pattern (seam 9 below calls `useQuery` directly in the component,
not through a coalescing hook). **Flag this to the planner as a decision point:** either the
hook returns `Row[] | undefined` (preserving the loading/empty distinction, requiring the
component to check `=== undefined`) or the component calls `useQuery` directly as
`DeliveryHistory.tsx` does and skips the hook layer entirely for this simple case.

---

### 9. New React component — `GovernorDecisionLog`

**Analog A — `SwapHistoryList.tsx`** (full file read, 117 lines) — the structural shape
(single component, one row-rendering loop, cap-aware truncation caption):

```typescript
// src/components/brains/SwapHistoryList.tsx:29-44
import { AlertTriangle, Check, Pin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { describeSwapOutcome, useCombinedSwapHistory, SWAP_HISTORY_CAP } from "@/hooks/useControlVerbSwaps";
import { useProfileBrainOverrides } from "@/hooks/useResolvedBrain";

/** `timestamp` on a `controlVerbSwaps` row is epoch SECONDS (`runtimeIngest.ts`'s
 * `now = Date.now() / 1000`), never milliseconds — multiply before handing to `Date`. Short
 * clock-time only; the row list is capped so a full date is rarely needed to disambiguate.
 * Mirrors the pre-Phase-109 `formatSwapTime` this file's docstring describes lifting from
 * `GlobalSwapModal.tsx`. */
function formatSwapTime(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

```typescript
// src/components/brains/SwapHistoryList.tsx:69-116 — the row/empty/truncation-caption shape
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No swaps recorded yet for this profile — includes both direct swaps and global
          overrides.
        </p>
      ) : (
        <>
          {rows.map((row) => {
            const outcome = describeSwapOutcome(row);
            return (
              <div key={row._id} className="flex items-center gap-2 text-sm">
                {/* status icon, timestamp, badge, content, outcome label — one row per record */}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {atCap
              ? `Showing the last ${SWAP_HISTORY_CAP} combined swaps (per-profile + global) — earlier swaps may exist.`
              : `Showing ${rows.length} swap${rows.length === 1 ? "" : "s"} (per-profile + global).`}
          </p>
        </>
      )}
    </div>
  );
```

**Analog B — `DeliveryHistory.tsx`** (full file read, 152 lines) — the hosting/loading/empty
pattern the UI-SPEC explicitly says to follow (its own citation, `DeliveryHistory.tsx:19-29`
for empty state, `:31-38` for loading, both confirmed byte-exact):

```typescript
// src/components/DeliveryHistory.tsx:1-17
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SectionHeader } from "./SectionHeader";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

export function DeliveryHistory() {
  const emailLogs = useQuery(api.deliveryLogs.listEmailLogs, {});
  const pagerdutyLogs = useQuery(api.deliveryLogs.listPagerdutyLogs, {});
```

```typescript
// src/components/DeliveryHistory.tsx:19-38 — empty-state renderer + loading branch
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-base font-semibold text-gray-300 mb-1">
        No deliveries yet
      </p>
      <p className="text-sm text-muted-foreground max-w-xs">
        Delivery history appears here after the first scheduled digest or
        PagerDuty trigger.
      </p>
    </div>
  );

  if (emailLogs === undefined || pagerdutyLogs === undefined) {
    return (
      <div className="space-y-4">
        <SectionHeader title="DELIVERY HISTORY" />
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }
```

```typescript
// src/components/DeliveryHistory.tsx:82-90 — epoch-seconds timestamp formatting, Table row shape
                    <TableCell className="tabular-nums text-sm text-muted-foreground">
                      {new Date(log.sentAt * 1000).toLocaleString()}
                    </TableCell>
```

**UI-SPEC's exact host location** (confirmed byte-exact against live `Settings.tsx`, read
lines 930-982):

```typescript
// src/pages/Settings.tsx:970-982 (Delivery History + Notification Preferences,
// the two existing SectionErrorBoundary-wrapped cards this component's mount
// point sits between)
      {/* Delivery History */}
      <SectionErrorBoundary name="Delivery History">
      <div className="bg-card border border-border rounded-xl p-4 mt-12">
        <DeliveryHistory />
      </div>
      </SectionErrorBoundary>

      {/* Notification Preferences */}
      <SectionErrorBoundary name="Notification Preferences">
      <div className="bg-card border border-border rounded-xl p-4 mt-12">
        <NotificationPreferences />
      </div>
      </SectionErrorBoundary>
```

`GovernorDecisionLog` mounts as a new `<SectionErrorBoundary name="Governor Decisions">`
block inserted between these two, per UI-SPEC (`112-UI-SPEC.md:166-174`), using the identical
`bg-card border border-border rounded-xl p-4 mt-12` card chrome.

**`heldReasonCopy` reuse (D-15/UI-SPEC's Row-level copy table) — quote in full,
`src/components/InboxCard.tsx:170-174`:**

```typescript
function heldReasonCopy(reason?: "focus" | "quiet-hours"): string {
  if (reason === "quiet-hours") return "held during quiet hours";
  if (reason === "focus") return "held during focus mode";
  return "held";
}
```
This function is **not exported** from `InboxCard.tsx` (verified — no `export` keyword on it
or on `RiskBadge`/`ProfileBadge`, all module-private). The UI-SPEC's Row-level copy table says
to reuse the wording "verbatim, not a new phrasing" — since the function itself is private,
`GovernorDecisionLog` must re-implement the same two-line if/else with byte-identical strings
rather than importing it, unless the planner chooses to export it from `InboxCard.tsx` first
(a small, separate, callable-out change).

**`SectionErrorBoundary`'s fallback — confirms UI-SPEC's citation exactly,
`src/components/SectionErrorBoundary.tsx:35-59`:**

```typescript
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-gray-800/50 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
              <span className="text-red-400 text-base">!</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base text-gray-300">
                {this.props.name ? `${this.props.name} failed to load` : "Something went wrong"}
              </p>
              <p className="text-sm text-gray-500 truncate mt-0.5">
                {this.state.error?.message || "An unexpected error occurred."}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 rounded-lg transition-colors shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
```
No changes needed here — `<SectionErrorBoundary name="Governor Decisions">` automatically
produces "Governor Decisions failed to load" via the `this.props.name` interpolation above,
matching UI-SPEC's stated error copy exactly.

**Settled: no existing `DeliveryHistory.test.tsx`** — confirmed via glob, zero results. The
component-test template to use instead is `SwapHistoryList.test.tsx` (full file read, 220
lines) — the mocking pattern for a component whose data comes from a custom hook:

```typescript
// src/components/brains/SwapHistoryList.test.tsx:1-32
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SWAP_HISTORY_CAP,
  type CombinedSwapHistoryRow,
} from "@/hooks/useControlVerbSwaps";
import { SwapHistoryList } from "./SwapHistoryList";

const mockUseCombinedSwapHistory = vi.fn<
  (profileId: string | undefined) => { rows: CombinedSwapHistoryRow[]; totalCount: number; atCap: boolean }
>();
vi.mock("@/hooks/useControlVerbSwaps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useControlVerbSwaps")>();
  return {
    ...actual,
    useCombinedSwapHistory: (profileId: string | undefined) =>
      mockUseCombinedSwapHistory(profileId),
  };
});

beforeEach(() => {
  mockUseCombinedSwapHistory.mockReset();
  mockUseCombinedSwapHistory.mockReturnValue({ rows: [], totalCount: 0, atCap: false });
});
```

And a representative assertion pattern (empty-state string match, `SwapHistoryList.test.tsx:147-157`):

```typescript
describe("SwapHistoryList — empty state and truncation captions", () => {
  it("renders the section-H empty-state string when there are zero rows", () => {
    mockUseCombinedSwapHistory.mockReturnValue({ rows: [], totalCount: 0, atCap: false });
    render(<SwapHistoryList profileId="personal" />);

    expect(
      screen.getByText(
        "No swaps recorded yet for this profile — includes both direct swaps and global overrides."
      )
    ).toBeInTheDocument();
  });
```

For `GovernorDecisionLog.test.tsx`, mock `useQuery` (or the new `useGovernorDecisions` hook,
whichever the planner chooses per seam 8's decision point) directly, following this same
`vi.mock` + `beforeEach(mockReset)` shape, and assert the exact UI-SPEC empty/loading/error
copy strings, not just "renders without crashing."

---

### 10. Convex/hook/component test files — CR-01 + bounded-read guards

**Analog:** `convex/controlVerbSwaps.test.ts` (full file, 245 lines). Quote the CR-01 guard
verbatim, `controlVerbSwaps.test.ts:108-131`:

```typescript
// CR-01 guard: record must be an internalMutation, never a public mutation,
// and must be invoked ONLY through the internal. namespace from the ingest
// path. This is the same regression guard shape as activeEngine.test.ts's
// CR-01 block, for the same reason: a public `mutation` builder would let
// any holder of the shipped VITE_CONVEX_URL forge a "server-confirmed"
// swap-history row from browser devtools, which the D-15 GlobalSwapModal
// history section would then render as truth.
describe("CR-01 — record authorization boundary (source-level guard)", () => {
  const controlVerbSwapsPath = path.resolve(__dirname, "./controlVerbSwaps.ts");

  it("declares record with internalMutation, never with a public mutation builder", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(/record\s*=\s*internalMutation\(/);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });

  it("stays true even though the file's own docstrings mention the word 'mutation'", () => {
    // Sanity check on the stripping itself: the raw (unstripped) file DOES
    // contain the word "mutation" in prose — if it didn't, the negative
    // assertion above would be vacuous.
    const raw = readFileSync(controlVerbSwapsPath, "utf-8");
    expect(raw).toMatch(/mutation/i);
  });
});
```

Quote the bounded-read guard verbatim, `controlVerbSwaps.test.ts:133-158`:

```typescript
describe("bounded read — listByScope never .collect()s", () => {
  const controlVerbSwapsPath = path.resolve(__dirname, "./controlVerbSwaps.ts");

  it("uses .take( and never .collect( on the append-only table", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(/\.take\(/);
    expect(source).not.toMatch(/\.collect\(/);
  });

  it("imports SWAP_HISTORY_CAP from the shared filters module and uses it (not a duplicated literal) inside .take(", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(
      /import\s*\{[^}]*SWAP_HISTORY_CAP[^}]*\}\s*from\s*["']\.\/controlVerbSwapsFilters["']/
    );
    expect(source).not.toMatch(/export const SWAP_HISTORY_CAP/);
    expect(source).toMatch(/\.take\(SWAP_HISTORY_CAP\)/);
  });

  it("SWAP_HISTORY_CAP constant equals 20, matching the modal-history sizing rationale", () => {
    expect(SWAP_HISTORY_CAP).toBe(20);
  });
});
```

The `stripCommentLines` helper these guards depend on, `controlVerbSwaps.test.ts:15-24`:

```typescript
/** Strip full-line comments (// or *-prefixed doc-comment lines) so a
 * docstring that legitimately mentions the words "mutation" or "record"
 * cannot pollute a source-level grep-style assertion. Copied verbatim from
 * activeEngine.test.ts. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}
```

**`record.exportArgs()` — reading the LIVE validator instead of a hand-typed literal (the
mutation-provability pattern), `controlVerbSwaps.test.ts:37-57`:**

```typescript
describe("record args shape (read from the live validator, not a hand-typed literal)", () => {
  /** `exportArgs` is a real but TypeScript-untyped runtime property that
   * Convex's internalMutation()/mutation() builders attach to the returned
   * function object ... specifically so the CLI can serialize a
   * function's validators for the deploy manifest. It isn't part of the
   * public `RegisteredMutation` TS type, hence the narrow `as` cast — this
   * reads the same object `npx convex deploy` reads, not a mock. */
  function recordArgFields(): Record<string, { fieldType: { type: string }; optional: boolean }> {
    const exportArgs = (record as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    return schema.value;
  }

  it("declares verb/path/channel/timestamp as required (non-optional)", () => {
    const fields = recordArgFields();
    expect(fields.verb.optional).toBe(false);
    // ...
  });
```

**Resolver null-normalization test cases — the exact template for D-14's `held_reason`
three-wire-shape coverage, `convex/runtimeIngest.test.ts:1207-1298`** (quote in full — this is
the precise shape the new resolver test cases must follow):

```typescript
// convex/runtimeIngest.test.ts:1207-1256
describe("108-07 fix 1 — null-valued optional fields are treated as absent, not rejected", () => {
  it("resolveControlVerbSwapEvent resolves the exact live-captured payload with 3 explicit-null optional fields (previously returned null)", () => {
    const result = resolveControlVerbSwapEvent(
      {
        verb: "swap_model",
        target: null,
        resolved: null,
        provider_affinity: null,
        path: "restore",
        session_id: null,
        channel: "codepulse-control-center",
        scope: "consulting",
      },
      1000
    );
    expect(result).not.toBeNull();
    expect(result?.verb).toBe("swap_model");
    expect(result?.path).toBe("restore");
    expect(result?.channel).toBe("codepulse-control-center");
    expect(result?.scope).toBe("consulting");
  });

  it("resolveControlVerbSwapEvent normalizes every null optional field to undefined — never forwards a literal null (Convex v.optional(v.string()) rejects an explicit null)", () => {
    const result = resolveControlVerbSwapEvent(
      {
        verb: "swap_model",
        path: "restore",
        channel: "c",
        target: null,
        resolved: null,
        providerAffinity: null,
        voiceId: null,
        reason: null,
        scope: null,
        sessionId: null,
      },
      1000
    );
    expect(result).not.toBeNull();
    expect(result?.target).toBeUndefined();
    // ... one assertion per optional field ...
    // The observable difference that matters to the Convex validator: a
    // JSON-serialized `null` key survives; an `undefined` key is dropped.
    expect(JSON.stringify(result)).not.toMatch(/:null/);
  });
```

```typescript
// convex/runtimeIngest.test.ts:1269-1298 — the "null carve-out doesn't widen to arbitrary
// wrong types" control, and the "required fields are unaffected" control
  it("a genuinely wrong-typed optional field (not null) is still rejected — the null carve-out does not widen to arbitrary types", () => {
    expect(
      resolveControlVerbSwapEvent(
        { verb: "swap_model", path: "restore", channel: "c", target: 42 },
        1000
      )
    ).toBeNull();
    // ...
  });

  it("required (non-optional) fields are unaffected by the null carve-out — a null verb/path/channel still refuses the event", () => {
    expect(
      resolveControlVerbSwapEvent({ verb: null, path: "restore", channel: "c" }, 1000)
    ).toBeNull();
    // ...
  });
});
```

**Direct instruction for the planner:** the equivalent `resolveGovernorDecisionEvent` test
block needs (at minimum) three cases mirroring the D-14 finding's three wire shapes —
`held_reason: "focus"`/`"quiet-hours"` (explicit string, 73/646 rows), `held_reason: null`
(explicit null, **majority shape**, 424/646 rows), and `held_reason` key absent entirely
(149/646 rows) — each asserting `result?.heldReason` resolves to the same `undefined` for the
null and absent cases, and the real string for the string case. A test suite that only covers
`undefined` and a real string (not explicit `null`) has NOT covered the majority real-world
shape, per RESEARCH.md Pitfall 1's own warning sign.

**The dispatch-case static source check, `convex/runtimeIngest.test.ts:980-992`** (the
pattern for D-10's own "the new case exists and forwards to the right internal function"
regression guard):

```typescript
  it("the control_verb_swap case calls resolveControlVerbSwapEvent and forwards its result to internal.controlVerbSwaps.record, never api.controlVerbSwaps — static source check", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = stripCommentLinesForIngestTests(
      readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8")
    );
    const caseMatch = source.match(/case "control_verb_swap": \{[\s\S]*?\n {8}\}/);
    expect(caseMatch).not.toBeNull();
    const caseBody = caseMatch![0];
    expect(caseBody).toContain("resolveControlVerbSwapEvent(");
    expect(caseBody).toContain("internal.controlVerbSwaps.record");
    expect(caseBody).not.toContain("api.controlVerbSwaps");
  });
```

---

## Shared Patterns

### Optional-field null-vs-absent normalization
**Source:** `convex/runtimeIngest.ts:207-268` (`isOptionalString`, `isOptionalNumber`,
`isOptionalStringArray`, `normalizeOptional`)
**Apply to:** the new `governor_decision` resolver's `held_reason` field (D-14, mandatory —
majority wire shape), and any `message_routed` field that could plausibly arrive as an
explicit JSON `null` (RESEARCH.md found none in its 10-row sample, but the guard costs nothing
to apply defensively to `channel`/`sender` if the planner chooses).

### `internalMutation`-only write path (CR-01)
**Source:** `convex/controlVerbSwaps.ts:38-46` (docstring + declaration), enforced by
`convex/controlVerbSwaps.test.ts:108-131`
**Apply to:** every new domain-table write mutation this phase creates — never a plain
`mutation`.

### Bounded `.take()`, never `.collect()`
**Source:** `convex/controlVerbSwaps.ts:76-87,111-120`, enforced by
`convex/controlVerbSwaps.test.ts:133-158`
**Apply to:** every new domain-table read query. `convex/events.ts:310`'s `countByType` is the
named anti-pattern — do not call it, do not model a new query on it.

### `RETENTION_DAYS` pre-emptive bounding + drift-guard test
**Source:** `convex/retention.ts:35-87`, `convex/retention.test.ts` (full file)
**Apply to:** every new domain table (D-06), including `message_routed`'s table even though it
has no UI this phase.

### Server/client bundle-boundary split for shared constants
**Source:** `convex/controlVerbSwapsFilters.ts:1-13` (docstring explaining the 108-06 bundling
defect)
**Apply to:** any CAP constant or pure helper the new component needs to import — never
value-import from a file that also imports `internalMutation`/`query`.

### Card chrome + error-boundary hosting
**Source:** `src/pages/Settings.tsx:970-982`, `src/components/SectionErrorBoundary.tsx:35-59`
**Apply to:** `GovernorDecisionLog`'s mount point — `<SectionErrorBoundary name="Governor
Decisions"><div className="bg-card border border-border rounded-xl p-4 mt-12">...`.

---

## No Analog Found

None — all 10 seams have a confirmed, live, `file:line`-verified analog.

---

## Corrections to RESEARCH.md's cited lines

All line numbers RESEARCH.md cited were verified in this session and found accurate, with
one clarification:

- `retention.test.ts:68-71` — RESEARCH.md cites this range for the Phase 108
  tables-must-not-become-unbounded assertion; confirmed exact (the `it(...)` block runs lines
  68-71 verbatim).
- `controlVerbSwaps.test.ts:115-131` (CR-01) and `:133+` (bounded-read) — confirmed: CR-01
  block is exactly lines 115-131, bounded-read block starts at line 133 and runs to 158.
- `runtimeIngest.ts:369-421` (resolver) and `:207-268` (helpers) — confirmed exact, plus the
  `ResolvedControlVerbSwapEvent` interface itself lives just above the resolver at
  `runtimeIngest.ts:332-344` (not separately cited by RESEARCH.md, but needed to write the
  equivalent interface for `governor_decision`).
- `runtimeIngest.ts:1022` (dispatch case) — confirmed exact, case body runs 1022-1051.
- `useControlVerbSwaps.ts` — RESEARCH.md's checklist item 8 describes this as a "thin
  `useQuery(...) ?? []` wrapper," which underclaims its actual complexity (it's a two-query
  merge hook, `useCombinedSwapHistory`). See the File Classification note above — this is a
  documentation nuance, not a wrong pointer; the file exists exactly where cited and is a valid
  analog for the IMPORT/EXPORT-SPLIT discipline, just not for the "thin wrapper" shape.

---

## Metadata

**Analog search scope:** `convex/schema.ts`, `convex/controlVerbSwaps.ts`,
`convex/controlVerbSwapsFilters.ts`, `convex/runtimeIngest.ts`, `convex/runtimeIngest.test.ts`,
`convex/controlVerbSwaps.test.ts`, `convex/retention.ts`, `convex/retention.test.ts`,
`src/hooks/useControlVerbSwaps.ts`, `src/components/brains/SwapHistoryList.tsx`,
`src/components/brains/SwapHistoryList.test.tsx`, `src/components/DeliveryHistory.tsx`,
`src/components/InboxCard.tsx`, `src/components/SectionErrorBoundary.tsx`,
`src/components/ui/badge.tsx`, `src/pages/Settings.tsx`.
**Files scanned:** 16 (all named by RESEARCH.md's seam list plus `badge.tsx` for the
Typography weight-cap claim UI-SPEC makes).
**Pattern extraction date:** 2026-08-12
