import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * useGaldrPrompts.ts — thin reactive wrappers over the Galdr prompt library
 * (Phase 116, plan 116-08).
 *
 * Deliberately named `useGaldrPrompts`, never `usePrompts`: an unrelated
 * `promptSubmissions` table already exists at `convex/schema.ts:651` (Claude Code
 * hook prompt-length telemetry), and a bare `usePrompts` would read as its hook.
 *
 * These absorb the undefined-during-loading case and derive nothing else, per the
 * repo's wrapper convention (`useActiveEngine.ts`).
 */

/** The live prompt library. `[]` while loading, never `undefined`. */
export function useGaldrPrompts() {
  return useQuery(api.galdr.list) ?? [];
}

/**
 * Same data, but keeping the loading signal the `?? []` fallback destroys.
 *
 * `useGaldrPrompts()` cannot tell "still loading" from "the library is empty" —
 * both are `[]`. 116-UI-SPEC requires those to render differently (skeleton cards
 * vs. the "No prompts yet" panel), so any surface that draws both needs this
 * variant. The plain wrapper above is kept for callers that genuinely only want
 * the rows.
 */
export function useGaldrPromptsState() {
  const prompts = useQuery(api.galdr.list);
  return { prompts: prompts ?? [], isLoading: prompts === undefined };
}

/**
 * Version history for one prompt. Returns `undefined` while loading OR when no
 * prompt is selected — the drawer distinguishes those itself, and `"skip"` keeps
 * us from issuing a query with no id.
 */
export function useGaldrPromptVersions(promptId: string | null | undefined) {
  return useQuery(
    api.galdr.listVersions,
    promptId ? { promptId: promptId as never } : "skip"
  );
}
