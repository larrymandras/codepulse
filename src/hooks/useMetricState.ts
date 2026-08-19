import { DEFAULT_STALE_AFTER_MS } from "@/lib/metricState";
import type { MetricState } from "@/lib/metricState";

/**
 * useMetricState — derive the common Convex case of the shared six-state
 * vocabulary (`loading` / `ready` / `empty` / `stale`) from a raw
 * `useQuery` return value.
 *
 * This hook can NEVER return `"error"` and never will. A failing Convex
 * query throws synchronously during render and is caught by the nearest
 * `SectionErrorBoundary`, so `error` reaches the primitive as an explicit
 * `state` prop from inside that boundary's fallback — not from here.
 * Duplicating that inference in this hook would fight the boundary instead
 * of composing with it (see 122-CONTEXT.md D-14 and the interfaces block of
 * 122-09-PLAN.md).
 *
 * `unavailable` is likewise NEVER inferred — it is a caller-supplied flag
 * only. Convex's `useQuery` return type is `Query["_returnType"] |
 * undefined`, `undefined` STRICTLY while loading (per the SDK's own doc
 * comment) — nothing in that type can distinguish "still loading" from
 * "nothing will ever emit here". Guessing either way is exactly the
 * fabrication class TOKEN-04 removes, so the caller must say so explicitly.
 *
 * `updatedAt`, when provided, is expected in EPOCH MILLISECONDS (this repo
 * has been bitten before by an epoch-seconds figure reading as 1970 — see
 * the project's own lessons). A value that would place `updatedAt` before
 * 2001 is treated as a caller error (almost certainly epoch seconds passed
 * where milliseconds were expected) and is loudly rejected rather than
 * silently read as "extremely stale".
 */

const MIN_PLAUSIBLE_EPOCH_MS = new Date("2001-01-01T00:00:00Z").getTime();

export interface UseMetricStateOptions {
  /** Per-tile staleness window in ms. Beats DEFAULT_STALE_AFTER_MS when set. */
  staleAfter?: number;
  /** Caller-declared: no emitter exists behind this metric at all. Always
   *  wins, including over `value === undefined` — a metric with no emitter
   *  is not "loading forever", it is a known absence. */
  unavailable?: boolean;
}

export interface UseMetricStateResult<T> {
  state: MetricState;
  value: T | undefined;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") {
    // A real zero is a real value (never empty). Distinguishing "empty
    // object" from "object holding real data" is intentionally narrow: only
    // a plain object with no own keys counts, so we never misclassify a
    // populated result shape as empty.
    return Object.keys(value as object).length === 0;
  }
  // 0, "", false, NaN etc. are NOT empty here — a real zero is a real value,
  // and rendering it as "no signal yet" would be the same false claim in
  // the opposite direction (see the behavior block of 122-09-PLAN.md).
  return false;
}

function isStale(updatedAt: number | undefined, staleAfter: number): boolean {
  // Absence of a timestamp is not evidence of age. A caller that never
  // supplies `updatedAt` gets no staleness classification at all, ever.
  if (updatedAt === undefined) return false;

  if (updatedAt < MIN_PLAUSIBLE_EPOCH_MS) {
    // Fail loudly rather than silently reading this as "extremely stale" --
    // the overwhelmingly likely cause is epoch SECONDS passed where
    // MILLISECONDS were expected (this repo's own history: a figure divided
    // by 1000 read as 1970 and a staleness check built on it passed
    // vacuously). A silent misread here would be worse than a thrown error,
    // because it would look like a working staleness gate.
    throw new Error(
      `useMetricState: updatedAt (${updatedAt}) is implausibly old for an ` +
        "epoch-millisecond timestamp (before 2001). This almost always " +
        "means epoch SECONDS were passed where MILLISECONDS were expected."
    );
  }

  return Date.now() - updatedAt > staleAfter;
}

/**
 * @param value - the raw return value of `useQuery(...)`, i.e.
 *   `Query["_returnType"] | undefined`.
 * @param updatedAt - epoch milliseconds the value was last updated, if
 *   known. `undefined` means "no timestamp available" and can never
 *   produce `"stale"`.
 * @param options - `staleAfter` (ms, defaults to DEFAULT_STALE_AFTER_MS) and
 *   `unavailable` (caller-declared, defaults to false).
 */
export function useMetricState<T>(
  value: T | undefined,
  updatedAt: number | undefined,
  options: UseMetricStateOptions = {}
): UseMetricStateResult<T> {
  const { staleAfter = DEFAULT_STALE_AFTER_MS, unavailable = false } = options;

  // Precedence, highest first: unavailable > loading > empty > stale > ready.
  // Each branch is justified below, in outranking order.

  // 1. unavailable wins over EVERYTHING, including `value === undefined`.
  // A metric declared to have no emitter is a known absence, not an
  // indefinite loading state -- conflating the two would silently hide a
  // caller's explicit "this does not exist" behind a perpetual spinner.
  if (unavailable) {
    return { state: "unavailable", value: undefined };
  }

  // 2. Convex's useQuery returns `undefined` STRICTLY while loading (per its
  // own doc comment). Nothing else in this hook can produce `undefined`
  // for `value`, so this branch is unambiguous once `unavailable` is ruled
  // out above.
  if (value === undefined) {
    return { state: "loading", value: undefined };
  }

  // 3. An empty result (empty array, null, or a keyless object) is real
  // information -- the query answered, and the answer is "nothing here".
  // `0` is explicitly excluded from this check (see isEmptyValue).
  if (isEmptyValue(value)) {
    return { state: "empty", value };
  }

  // 4. A value old enough per the staleness window is shown, not hidden --
  // stale is a real value plus an honesty affordance, never a substitute
  // for the value itself.
  if (isStale(updatedAt, staleAfter)) {
    return { state: "stale", value };
  }

  // 5. Everything else is a current, real value.
  return { state: "ready", value };
}
