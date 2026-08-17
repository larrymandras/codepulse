# Phase 109: Per-Agent Engine UI - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 19 (CodePulse only — the 2 astridr-repo changes are cross-repo and out of this
tool's scope; RESEARCH.md §A already gives them concrete shapes)
**Analogs found:** 17 / 19 (2 are pure deletions with no analog needed)

All line numbers below were re-read live against `codepulse@master` this session (2026-08-08), the
same day RESEARCH.md was produced — no drift found beyond what RESEARCH.md already documents. Where
a citation matches RESEARCH.md's own corrected line number, that is noted; this document does not
re-litigate RESEARCH.md's corrections (D-11's `scope: undefined` vs `null`, D-05's accessor
citations, D-09's vendor mapping) — it maps *code shape*, RESEARCH.md already fixed the *facts*.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hooks/useProfileSwap.ts` (NEW, name TBD by planner) | hook | event-driven (WS dispatch + readback) | `GlobalSwapModal.tsx`'s inline outcome state machine (`:142-157`, `:354-380`, `:448-458`) | exact (pattern to extract into a hook, not a component) |
| `convex/controlVerbSwaps.ts` (add `listGlobal`) | query (Convex) | CRUD (bounded read) | `listByScope` in the same file (`:76-87`) | exact — same file, sibling query |
| `convex/controlVerbSwapsFilters.ts` (add merge helper) | utility (pure) | transform | `isBrainSwap`/`SWAP_HISTORY_CAP` in the same file (`:20`, `:29-31`) | exact — same file, sibling export |
| `src/pages/Settings.tsx` (add D-10 collapsible section) | component (page) | request-response (render) | `src/components/reminders/ReminderList.tsx`'s `Collapsible` composition (`:668-705`) | role-match (list-row disclosure) |
| `src/lib/brainsApi.ts` (export `stripVendorPrefix`, add `modelIdsMatch`, delete stub/validator) | utility | transform | `resolveModelDisplayName`'s own prefix-tolerant match (`:249-273`) — same file, sibling export | exact |
| `src/components/brains/BrainPicker.tsx` | component | event-driven (dispatch) + request-response (catalogue) | `GlobalSwapModal.tsx`'s `dispatch`/`dispatchBounded` pattern (`:343`, `:354-380`) for the D-01 dispatch rewrite | role-match |
| `src/components/brains/BrainPickerRow.tsx` (add `needsConfirm` prop) | component (presentational) | request-response | itself — existing `needsCostConfirm`/`quotaLevel` exported-predicate pattern (`:83-85`, `:93-97`) | exact (internal precedent) |
| `src/components/brains/BrainHeaderBadge.tsx` | component | request-response | itself + `useResolvedBrain.ts` consumer sweep (RESEARCH.md §C.7 table) | exact (existing consumer, extend not rewrite) |
| `src/pages/Chat.tsx` | component | request-response | itself (`BrainComposerPill`) — same consumer-sweep table | exact |
| `src/hooks/useResolvedBrain.ts` (D-06 rung insertion) | hook | transform (pure resolver) | itself — `resolveActiveBrain`'s existing rung chain (`:244-290`) | exact (insertion, not new pattern) |
| `src/hooks/useActiveEngine.ts` (D-08 comparator at `:49`) | hook | transform | itself — `deriveMixedState`'s `Set` construction | exact |
| `src/components/brains/BrainsWsRegistrar.tsx` | component | event-driven | — (deletion, D-01) | n/a |
| `src/lib/brainsFixtures.ts` | fixture | — | — (deletion, D-01) | n/a |
| `e2e/brain-swap.spec.ts` | test (E2E) | — | — (deletion, per RESEARCH.md §B.6) | n/a |
| `playwright.config.ts` (remove stub env) | config | — | itself | exact (surgical removal) |
| `convex/schema.ts` (no change — `controlVerbSwaps.scope` already `v.optional(v.string())`) | model | — | — | n/a — confirms D-11 needs no schema change |

## Pattern Assignments

### 1. `src/hooks/useProfileSwap.ts` (NEW hook, event-driven) — the priority item

**Analog:** `src/components/brains/GlobalSwapModal.tsx`'s inline outcome state machine. This is a
component-internal pattern today; the planner's job is extracting it into a standalone hook
consumed by `BrainPicker.tsx`'s per-profile dispatch, `BrainHeaderBadge.tsx`, `Chat.tsx`, and
`Settings.tsx` — all four surfaces that render the pending/confirming/accepted/confirmed/error
suffix per UI-SPEC §C.

**The outcome union to copy verbatim** (`GlobalSwapModal.tsx:142-157`):
```typescript
/**
 * D-14/D-15 applied to the single-command global axis: an ack means ACCEPTED, never SWITCHED.
 * "confirming" resolves to "confirmed" only once the `swap.state` readback matches; "accepted" is
 * the bounded fallback when no readback arrives within `GLOBAL_SWAP_CONFIRM_TIMEOUT_MS` — it never
 * claims the switch/clear landed, only that the command was accepted for processing.
 */
type GlobalOutcome =
  | { status: "pending" }
  | { status: "confirming" }
  | { status: "confirmed" }
  | { status: "accepted" }
  | { status: "error"; reason: string };

/**
 * Bounded wait for the `swap.state` readback before falling back to an honest "accepted, not yet
 * confirmed" reading — long enough for a normal WS round trip, short enough that the dialog never
 * looks hung. Exported for direct test control.
 */
export const GLOBAL_SWAP_CONFIRM_TIMEOUT_MS = 4000;
```
Per UI-SPEC §C, D-05 requires the per-profile path to reuse this exact 5-state vocabulary (renamed
per-instance, e.g. `ProfileSwapOutcome`) — do not invent a second vocabulary. UI-SPEC §C also
specifies a per-profile-only addition (a toast firing once on entering `accepted`, since there is no
modal visibly holding the state) — that's new behavior layered on top of this reused shape, not a
divergence from it.

**`dispatchBounded` — the hang/rejection-tolerant wrapper to reuse** (`GlobalSwapModal.tsx:354-380`):
```typescript
async function dispatchBounded(
  cmd: Record<string, unknown>
): Promise<{ status: "ok" | "error"; error?: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      dispatch(cmd).then((ack) => ({ status: ack.status, error: ack.error })),
      new Promise<{ status: "error"; error: string }>((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              status: "error",
              error: "no response from Ástríðr — the command was never delivered",
            }),
          GLOBAL_SWAP_DISPATCH_TIMEOUT_MS
        );
      }),
    ]);
  } catch (err) {
    return {
      status: "error",
      error: err instanceof Error ? err.message : "the command could not be delivered",
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
```
`dispatch` itself comes from `useCommandDispatch()` (`GlobalSwapModal.tsx:343`, imported from
`@/hooks/useCommandDispatch` at `:62`) — the new hook should call `useCommandDispatch()` internally,
not `useAstridrWS().sendCommand` directly (that's `BrainControl.tsx`'s simpler, unbounded pattern,
explicitly NOT the one to copy per RESEARCH.md §B.5).

**The readback confirm effect to copy, with the D-05 substitution** (`GlobalSwapModal.tsx:448-458`):
```typescript
// D-14/D-15 readback: once the server-pushed swap.state matches the value we're waiting to
// confirm (target.id for a swap, null for a revert-clear), the "confirming" outcome resolves to
// "confirmed" — never before, and never from the ack alone.
useEffect(() => {
  if (outcome.status !== "confirming") return;
  if (modelOverride === confirmTarget) {
    setOutcome({ status: "confirmed" });
    clearConfirmTimeout();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [modelOverride, outcome.status, confirmTarget]);
```
**Critical substitution for the per-profile path (per the phase brief and D-05):** the global axis
confirms against `modelOverride` from `useGlobalBrainOverride()` — the **global** override slot. The
per-profile path must confirm against **this profile's entry in the new per-profile override map**
D-05 adds to `swap.state` (RESEARCH.md §A.2's `profile_overrides` shape), i.e.
`profileOverrides[profileId]?.model === confirmTarget` — NOT a resolved `activeEngines[profileId]`
telemetry row. Comment this substitution explicitly in the new hook, per UI-SPEC's own instruction
("the *confirmation* reads the override; the *current-engine display* reads telemetry — both honest,
different questions").

**The timeout-start helper to copy** (`GlobalSwapModal.tsx:422-426`):
```typescript
function startConfirmTimeout() {
  clearConfirmTimeout();
  confirmTimeoutRef.current = setTimeout(() => {
    setOutcome((prev) => (prev.status === "confirming" ? { status: "accepted" } : prev));
  }, GLOBAL_SWAP_CONFIRM_TIMEOUT_MS);
}
```

**Restore/scoped-restore confirm semantics** (per RESEARCH.md §A.2's confirmation): the readback for
a scoped restore is the **absence** of the profile's id from `profile_overrides`, mirroring
`GlobalSwapModal.tsx:537`'s `setConfirmTarget(prior)` where `prior` can be `null` — for the
per-profile hook this becomes "confirmed when `profileOverrides[profileId]` is undefined."

**Dispatch shape** (per D-01, replacing the dead `gateway.model.set` currently at
`BrainPicker.tsx:310-317`): mirror `GlobalSwapModal.tsx:511-516`'s literal command shape, adding
`profile_id`:
```typescript
const ack = await dispatchBounded({
  type: "swap.set",
  target: "brain",
  value: target.id,
  restore: false,
  profile_id: profileId,
});
```

### 2. `convex/controlVerbSwaps.ts` — new `listGlobal` query

**Analog:** `listByScope` in the same file (`convex/controlVerbSwaps.ts:76-87`), verbatim:
```typescript
/**
 * listByScope — Returns the most recent swap-history rows for one profile
 * scope, newest first. A `query`, not an `internalMutation`, because D-15's
 * modal legitimately reads it from the client. Bounded by SWAP_HISTORY_CAP
 * over the by_scope index — never an unbounded collect on this append-only table
 * (T-108-12): an unbounded read on a growing table is exactly what breached
 * the 16 MiB limit in Phase 88.
 */
export const listByScope = query({
  args: {
    profileId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("controlVerbSwaps")
      .withIndex("by_scope", (q) => q.eq("scope", args.profileId))
      .order("desc")
      .take(SWAP_HISTORY_CAP);
  },
});
```

**`listGlobal`'s required shape (RESEARCH.md §D.10's corrected form — `undefined`, not `null`):**
```typescript
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
Same index (`by_scope`), same cap import (`SWAP_HISTORY_CAP` from `./controlVerbSwapsFilters`,
already imported at `controlVerbSwaps.ts:3`), same `.order("desc").take(...)` bound-read discipline.
`listByScope`'s signature is unchanged by D-11 (confirmed — no args added, no behavior change).

### 3. Client-side merge helper (D-11) — which side of the WR-02 line

**The constraint, stated by the file that exists solely to enforce it**
(`convex/controlVerbSwapsFilters.ts:1-13`):
```typescript
/**
 * controlVerbSwapsFilters.ts — the shared, dependency-free constant + predicate for the
 * control-verb-swap axis (Phase 108, TELE-02, D-13/D-14).
 *
 * Split out of `convex/controlVerbSwaps.ts` (bundling defect found at RUNTIME after 108-06 shipped,
 * see 108-REVIEW.md): `controlVerbSwaps.ts` imports `internalMutation`/`query` from
 * `./_generated/server` to define `record`/`listByScope`, so any browser code that value-imported
 * `SWAP_HISTORY_CAP`/`isBrainSwap` directly from that file pulled the whole Convex server runtime
 * into the client bundle — exactly the "Convex functions should not be imported in the browser"
 * warning. ... deliberately dependency-free — no `convex/values`, no `./_generated/*`, no React —
 * so the Convex server bundle and the browser bundle can both import it without either pulling in
 * the other's runtime.
 */
```
**Verdict: the merge helper belongs in `controlVerbSwapsFilters.ts`, exported alongside
`isBrainSwap`/`SWAP_HISTORY_CAP`, not in `controlVerbSwaps.ts` and not re-exported from it.** It
needs neither `convex/values` nor `./_generated/*` (it merges two already-fetched, already-typed
arrays by `timestamp`), so it satisfies the file's own dependency-free contract exactly. Do not add
it directly to `src/hooks/useControlVerbSwaps.ts` either — that hook already imports
`isBrainSwap`/`SWAP_HISTORY_CAP` from `controlVerbSwapsFilters.ts` (see below), so putting the merge
function there instead of in the shared filters file would strand it as a one-off rather than a
reusable, directly-testable export following this file's own established precedent.

**The exact existing pure-predicate export shape to match** (`controlVerbSwapsFilters.ts:22-31`):
```typescript
/**
 * isBrainSwap — Pure helper: true when a controlVerbSwaps row is a brain
 * (swap_model) swap rather than a voice (swap_voice) swap. Exported so it
 * can be unit-tested directly and reused by a future D-15 readout, following
 * `deduplicateByProfile`'s precedent (activeEngine.ts) of exporting a pure
 * predicate solely for testability.
 */
export function isBrainSwap<T extends { verb: string }>(row: T): boolean {
  return row.verb === "swap_model";
}
```
The merge function (e.g. `mergeSwapHistory(scoped: SwapHistoryRow[], global: SwapHistoryRow[])`)
should follow this exact export style: a plain, generic-friendly, pure function with a one-paragraph
docstring citing the WR-02 constraint and the D-11 decision, exported directly (no default export,
no class). `src/hooks/useControlVerbSwaps.ts` already re-exports `SWAP_HISTORY_CAP` (`:24`) and
imports `isBrainSwap`/`SWAP_HISTORY_CAP` from `../../convex/controlVerbSwapsFilters` (`:22`) — the
new hook-side consumer of `listGlobal` should import the merge helper from the same path.

### 4. Settings.tsx collapsible swap-history section (D-10)

**`Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` IS already used in this codebase —
correcting UI-SPEC §H's own "first consumer" claim** (RESEARCH.md §D.12 flagged this drift). Six
files import it; `src/components/reminders/ReminderList.tsx` is the closest analog — a per-section
disclosure inside a list, same shape as D-10's per-row history section.

**Import block** (`ReminderList.tsx:31-35`):
```typescript
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
```

**The exact composition this codebase uses** (`ReminderList.tsx:668-705`):
```tsx
<Collapsible open={doneOpen} onOpenChange={setDoneOpen}>
  <CollapsibleTrigger asChild>
    <button type="button" className="flex items-center gap-1 px-1 py-1 w-full text-left">
      {doneOpen ? (
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <GroupHeader
        label="Done"
        count={groups.done.length}
        accentVar={accentVar}
        reduceMotion={reduceMotion}
      />
    </button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    {groups.done.length === 0 ? (
      <p className="text-sm text-muted-foreground px-1 py-2">Nothing completed yet.</p>
    ) : (
      <div className="flex flex-col gap-1.5">
        {groups.done.map((r) => (
          <ReminderRow key={r._id} reminder={r} /* ... */ />
        ))}
      </div>
    )}
  </CollapsibleContent>
</Collapsible>
```
Pattern to copy: `Collapsible` wraps a local `useState` boolean (`open`/`onOpenChange` — no
uncontrolled/defaultOpen usage in this repo's precedent); `CollapsibleTrigger asChild` wraps a plain
`<button type="button">` with a rotating Chevron icon + a label/count row; `CollapsibleContent` holds
either an empty-state `<p>` or the mapped row list. This is exactly the shape UI-SPEC §H specifies
(Chevron rotation, "Swap history (N)" count badge, empty-state copy, mapped rows) — build D-10's
section as a sibling composition of the same three primitives, not a hand-rolled toggle.

**Where it mounts — the existing per-profile row it nests under** (`Settings.tsx:246-339`, full
row already read; key excerpt at `:255-266`):
```tsx
{profileConfigs.map((c) => {
  const linkedProfile = profiles.find((ap) => ap.profileId === c.profileId) ?? null;
  const engine = activeEngines[c.profileId] ?? null;
  const vendor = engineCatalogue?.find((entry) => entry.id === engine?.model)?.vendor;
  // ...
  return (
    <div key={c._id} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2">
      {/* avatar, name, profileId, engine-status line, BrainPicker trigger */}
```
D-10's `Collapsible` section is a new sibling block rendered directly beneath this `<div>`, inside
the same `.map()` iteration, indented `md` (16px) per UI-SPEC §H — it needs `c.profileId` (already
in scope) to call `useControlVerbSwaps(c.profileId)` / the new merge helper.

**`SwapHistorySection`'s existing render shape to reuse for the row anatomy inside
`CollapsibleContent`** (`GlobalSwapModal.tsx:277-333`, the "honest render-nothing gate" +
row/empty/truncation pattern the phase brief asked to identify):
```tsx
export function SwapHistorySection({ profileId }: { profileId: string | undefined }) {
  const rows = useControlVerbSwaps(profileId);

  // D-15 correction: an unscoped mount (today's only mount site) has no
  // profile to show history FOR — render nothing rather than a permanent
  // "no history yet" that can never resolve. The hook above is still called
  // unconditionally (Rules of Hooks); only the render is gated.
  if (profileId === undefined) {
    return null;
  }

  const brainSwaps = filterBrainSwaps(rows).slice(0, SWAP_HISTORY_CAP);
  const atCap = brainSwaps.length >= SWAP_HISTORY_CAP;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
      <p className="text-xs text-muted-foreground">Recent swaps</p>
      {brainSwaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No swap history to show yet.</p>
      ) : (
        <>
          {brainSwaps.map((row) => {
            const outcome = describeSwapOutcome(row);
            return (
              <div key={row._id} className="flex items-center gap-2 text-sm">
                {/* icon by outcome.kind, time, target → resolved, outcome.label */}
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {atCap
              ? `Showing the last ${SWAP_HISTORY_CAP} swaps`
              : `Showing ${brainSwaps.length} swap${brainSwaps.length === 1 ? "" : "s"}`}
          </p>
        </>
      )}
    </div>
  );
}
```
`SwapHistorySection` is exported (`GlobalSwapModal.tsx:277`) specifically for reuse — its own
docstring at `:270-276` says so explicitly ("This is the intended reuse seam for Phase 109's real
per-profile host, not test-only scaffolding"). D-10/D-11/D-12 mean this row-rendering body gets
extended (merged rows instead of `filterBrainSwaps(rows)` alone, a `GLOBAL` badge per D-12, a pinned
note above the list) rather than reimplemented from scratch — either call `SwapHistorySection`
directly with an extended internal implementation, or lift its row-rendering body into a new
sibling component that both `GlobalSwapModal`'s own mount (`:638`,
`<SwapHistorySection profileId={undefined} />` — kept mounted but render-nothing, per its own
comment at `:633`) and Settings' new D-10 section can share. Either is consistent with this pattern;
the planner decides which, but must not fork a second, divergent row-rendering implementation.

**Current mount site (for the "honest gate" the brief asked to identify)**
(`GlobalSwapModal.tsx:630-639`, paraphrased from context read this session): `GlobalSwapModal`
mounts `<SwapHistorySection profileId={undefined} />` unconditionally today (its only call site),
which the function's own `profileId === undefined` guard renders as `null` — the component stays
mounted (not deleted) "so the component/hook stay exercised," per the inline comment at `:633`, even
though nothing currently renders from it. D-10 is what finally gives this component a `profileId`
that renders content.

### 5. `modelIdsMatch` comparator (D-08) and the export-predicate convention

**Home: beside `stripVendorPrefix` in `src/lib/brainsApi.ts:239-242`.**
```typescript
/** Strips a leading vendor namespace: "anthropic/claude-sonnet-5" -> "claude-sonnet-5". */
function stripVendorPrefix(modelId: string): string {
  const slash = modelId.lastIndexOf("/");
  return slash === -1 ? modelId : modelId.slice(slash + 1);
}
```
D-08 requires exporting this (currently private/unexported — no `export` keyword) and adding
`modelIdsMatch(a, b)` immediately beside it, using the exact same prefix-stripping logic already
proven correct by `resolveModelDisplayName`'s own matching (`brainsApi.ts:254-260`):
```typescript
export function resolveModelDisplayName(
  modelId: string,
  catalogue: CatalogueEntry[] | null | undefined,
  fallbackNames?: Record<string, string> | null
): string {
  const bare = stripVendorPrefix(modelId);

  if (catalogue && catalogue.length > 0) {
    const exact = catalogue.find((e) => e.id === modelId);
    if (exact) return exact.name;
    const suffix = catalogue.find((e) => stripVendorPrefix(e.id) === bare);
    if (suffix) return suffix.name;
  }
  // ...
}
```
`modelIdsMatch(a, b)` is this same two-step comparison (exact match first, then bare-suffix match)
collapsed into a boolean predicate: `a === b || stripVendorPrefix(a) === stripVendorPrefix(b)`. The
surrounding file comment block (`brainsApi.ts:220-236`) already documents the root cause
(`modelPreferences.primary` vendor-prefixed vs live `swap.catalogue` ids bare) — the new export's
docstring should cite this same block rather than re-deriving the explanation.

**The established "pure exported predicate, directly unit-tested" convention this codebase uses —
confirmed by three separate examples, all in `src/components/brains/`:**

1. `isBrainSwap` (`convex/controlVerbSwapsFilters.ts:29-31`, shown in full above).
2. `needsCostConfirm` (`BrainPickerRow.tsx:77-85`):
```typescript
/**
 * needsCostConfirm — the single source of truth for the expand-to-confirm branch (UI-SPEC §3).
 * Exported so `BrainPicker.tsx`'s `handleActivate` (103-11, CR-02) can make the exact same
 * decision for the keyboard path (`CommandItem.onSelect`) that this row makes for the mouse path
 * — the condition itself must never be duplicated/inlined a second time.
 */
export function needsCostConfirm(entry: CatalogueEntry): boolean {
  return entry.costTier === "expensive" || entry.costTier === "unknown";
}
```
3. `quotaLevel` (`BrainPickerRow.tsx:87-97`):
```typescript
/**
 * quotaLevel — re-tokenized threshold logic copied from
 * ProviderHealthPanel.tsx:45-51's `quotaBarColor` (thresholds kept verbatim:
 * >=20% ok, 5-20% warn, <5% error — only the hardcoded Tailwind color-500
 * literals are replaced with status tokens). Exported for direct unit testing.
 */
export function quotaLevel(pct: number): "ok" | "warn" | "error" {
  if (pct < 0.05) return "error";
  if (pct < 0.2) return "warn";
  return "ok";
}
```
All three share the shape `modelIdsMatch` must follow: no side effects, no React, a one-purpose
docstring naming (a) what calls it and why it must be the single source of truth, and (b) which
prior duplicated-logic defect this export exists to prevent. `needsCostConfirm`'s docstring is the
closest analog in spirit to `modelIdsMatch` — it exists precisely so two independent call sites (a
keyboard path and a mouse path) cannot silently diverge, which is exactly D-08's own stated
"requires a guard... a rule that must hold per-site" framing.

**RESEARCH.md's confirmed guard-test recommendation** (§C.8, since this codebase has no
ESLint/static-scan test infra): the guard is a **behavioral** test per site — feed two ids differing
only by vendor prefix through each of the six consumers and assert they're treated as equal — not a
literal-text source scan.

## Every model-id raw-`===`/Set-equality site (D-08), current exact line — for concrete task actions

| # | File:line | Current code | In CONTEXT.md's 4-item list? |
|---|---|---|---|
| 1 | `BrainHeaderBadge.tsx:96` | `entries?.find((e) => e.id === modelId)?.vendor` (provider-dot vendor lookup) | Yes |
| 2 | `useActiveEngine.ts:49` | `Array.from(new Set(reported.map((e) => e.model)))` (distinct-model Set for mixed-state) | Yes |
| 3 | `BrainPicker.tsx:558-562` (`isCurrent` passed into `BrainPickerRow`) | `globalOverrideModel === entry.id` / `activeEngine?.model === entry.id` | Yes ("BrainPickerRow's `isCurrent`" — comparison actually lives in `BrainPicker.tsx`) |
| 4 | `GlobalSwapModal.tsx:502` | `snap.find((s) => s.model === modelOverride)` (prior-override display-name lookup) | Yes |
| 5 | `Chat.tsx:178` | `catalogue?.find((e) => e.id === resolved.model)?.vendor` (composer pill vendor-dot lookup) | **No — found by RESEARCH.md, must be added** |
| 6 | `Settings.tsx:251` (confirmed this session, verbatim: `engineCatalogue?.find((entry) => entry.id === engine?.model)?.vendor`) | per-profile row vendor-dot lookup | **No — found by RESEARCH.md, must be added** |
| 7 | `BrainPicker.tsx:291` (confirmed this session, verbatim: `if (activeEngine?.model === pendingTarget.id)`) | gates the D-14 "genuinely landed" success toast | **No — found by RESEARCH.md; flagged as the highest-impact miss, since a format mismatch here means the success toast silently never fires for an `inherited`-mode profile** |

All 7 are the same defect class per D-08's own "a rule that must hold per-site" language — the
planner's D-08 task should enumerate all 7, not just the 4 CONTEXT.md named.

## Shared Patterns

### Dispatch + bounded-timeout wrapper (`dispatchBounded`)
**Source:** `GlobalSwapModal.tsx:354-380`, built on `useCommandDispatch()` (`@/hooks/useCommandDispatch`)
**Apply to:** the new `useProfileSwap`/per-profile dispatch hook (item 1 above) — this is the ONE
dispatch seam this phase should introduce for the per-profile axis, replacing `BrainPicker.tsx`'s
current direct `brainsApi.dispatchSwap(...)` call (`:310-317`) and NOT reusing `BrainControl.tsx`'s
simpler unbounded `useAstridrWS().sendCommand` pattern (confirmed the wrong analog by RESEARCH.md §B.5).

### Pure exported predicate for cross-site-consistency guards
**Source:** `isBrainSwap` (`convex/controlVerbSwapsFilters.ts:29-31`), `needsCostConfirm`
(`BrainPickerRow.tsx:83-85`), `quotaLevel` (`BrainPickerRow.tsx:93-97`)
**Apply to:** `modelIdsMatch`/`stripVendorPrefix` export (D-08), and the new `listGlobal`/`listByScope`
merge helper (D-11) — every "must not silently diverge across call sites" rule in this phase should
ship as one of these, directly unit-testable, never inlined per-site.

### Honest render-nothing / render-absence gate
**Source:** `SwapHistorySection`'s `if (profileId === undefined) return null;`
(`GlobalSwapModal.tsx:284-286`); `resolveModelDisplayName`'s "never invent a name, return the id
unchanged" (`brainsApi.ts:233-236`, `:272`); `Settings.tsx:282-287`'s existing correct "Not reported"
string.
**Apply to:** every §A absent-state site (D-07), the new `listGlobal`/merge empty state (D-11), and
the D-12 pinned note ("appears only while the pin is genuinely active... no separate 'was pinned as
of' retrospective claim").

### WR-02 browser/server import boundary
**Source:** `convex/controlVerbSwapsFilters.ts`'s own docstring (`:1-13`) and
`src/hooks/useControlVerbSwaps.ts:20-24`'s import block (`isBrainSwap`/`SWAP_HISTORY_CAP` from
`../../convex/controlVerbSwapsFilters`, never `../../convex/controlVerbSwaps`).
**Apply to:** the D-11 merge helper (item 3 above) — the one new cross-cutting constraint this phase
must not violate for any new Convex-table-shaped constant/predicate.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `astridr/providers/router.py` new `get_all_profile_overrides()`/`get_all_profile_override_sources()` methods (D-05, RESEARCH.md §A.2) | backend method | transform | Cross-repo, out of this tool's codebase scope; RESEARCH.md already supplies a concrete proposed shape. |
| `astridr/api/ws_commands.py`'s `default_profile_id` addition to `_handle_swap_catalogue` (D-03) | backend handler field | request-response | Same — cross-repo; RESEARCH.md §A.1 supplies the concrete shape and the `config.profiles[0].id if config.profiles else "personal"` source expression. |
| D-09's `mapCatalogueVendorToBilling` function | utility (pure) | transform | No prior "vendor slug → billing channel" translator exists anywhere in this codebase to pattern-match against — RESEARCH.md §C.9 is the only source for this shape (a genuinely new mapping, not a reuse), and D-09's own resolution is explicitly flagged as an open product decision, not a coding pattern question. |

## Metadata

**Analog search scope:** `src/components/brains/`, `src/hooks/`, `src/pages/Chat.tsx`,
`src/pages/Settings.tsx`, `src/lib/brainsApi.ts`, `src/lib/providers.ts`, `convex/controlVerbSwaps.ts`,
`convex/controlVerbSwapsFilters.ts`, `src/components/reminders/ReminderList.tsx` (Collapsible
precedent), `src/components/ui/collapsible.tsx`.
**Files scanned:** 19 target files + 6 analog source files read in full/targeted-range this session.
**Pattern extraction date:** 2026-08-08
