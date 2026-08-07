/**
 * activeEngineFilters.ts — the shared, dependency-free sentinel guard for the active-engine axis.
 *
 * Added closing a UAT finding (2026-07-29, 103-UAT.md test 2): the header badge and the Chat
 * composer pill were both displaying the literal string "unknown" as if it were a real engine
 * name, with the confirmed-live pulse lit, whenever no global override was in force.
 *
 * The chain was:
 *   1. `runtimeIngest.ts`'s `model_routing` case coalesced a routing event's missing fields to the
 *      literal string "unknown" (`d.profileId ?? d.profile_id ?? "unknown"`) and inserted the row.
 *      So the sentinel came from the NORMAL live ingest path, not a stray manual probe row like the
 *      103-08 incident — deleting the row could never fix it.
 *   2. `useActiveEngine`'s defensive join preserved that row because its profileId is absent from
 *      profileConfigs (correct for a real profile racing the join — but it also admitted this).
 *   3. With all 3 real profiles unreported (null, excluded), the sentinel became `deriveMixedState`'s
 *      ONLY reported entry, so it read as "every profile agrees on model 'unknown'" and
 *      `resolveActiveBrain` returned source:"profile" instead of source:"none".
 *
 * D-14 says a profile with no reported telemetry must read as unreported, never as a guess. A row
 * that carries no resolvable profile or model is not a reading — it is the absence of one, and this
 * module is the single place that decides that, for BOTH the write path (convex/runtimeIngest.ts,
 * which refuses to store it) and the read path (src/hooks/useActiveEngine.ts, which refuses to
 * trust rows already in the table).
 *
 * Deliberately dependency-free — no `convex/values`, no `./_generated/*`, no React — so the Convex
 * server bundle and the browser bundle can both import it without either pulling in the other's
 * runtime.
 */

/** The literal string the ingest path used to substitute for an unresolved field. */
export const UNRESOLVED_SENTINEL = "unknown";

/**
 * True when a `model_routing` row carries no usable profile or engine identity — i.e. it is the
 * absence of a reading rather than a reading. Checked on both the write and the read path, so a
 * sentinel already sitting in `activeEngineSnapshots` (there is one in production as of
 * 2026-07-29) is inert even before it is deleted.
 *
 * TOTAL over its declared input type by contract, not just by the type signature: TypeScript
 * types are erased at runtime, and `runtimeIngest.ts` calls this with a raw, untrusted ingest
 * payload cast through `data as any` — so `row.profileId`/`row.model` can arrive as any JSON
 * type (number, boolean, object, array), not just `string | null | undefined`. A non-string
 * truthy value used to reach `row.profileId?.trim()` and throw `TypeError: ... .trim is not a
 * function`, which — because the `model_routing` case has no per-event try/catch — aborted every
 * remaining event in the batch (the exact WR-06/168-06 class this file's own header and
 * `runtimeIngest.ts:736-742`'s comment claim immunity to). A non-string value is treated as
 * unresolved (returns `true`), never thrown on, so the caller's existing `break` skips just that
 * one event.
 */
export function isUnresolvedRouting(row: {
  profileId?: unknown;
  model?: unknown;
}): boolean {
  const rawProfileId = row.profileId;
  const rawModel = row.model;
  if (typeof rawProfileId !== "string" || typeof rawModel !== "string") {
    return true;
  }
  const profileId = rawProfileId.trim();
  const model = rawModel.trim();
  return (
    !profileId ||
    !model ||
    profileId === UNRESOLVED_SENTINEL ||
    model === UNRESOLVED_SENTINEL
  );
}
