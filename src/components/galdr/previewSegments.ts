/**
 * previewSegments — split a substituted prompt body into plain and
 * still-placeholder runs so a preview can tint the leftovers.
 *
 * Shared by FillVariablesDialog and PromptEditorDrawer. 116-UI-SPEC.md's editor
 * section calls for "the same substitution logic as the drawer's preview panel —
 * extract as a shared pure function, not duplicated"; `substituteVariables` is
 * that shared function, and this is the shared rendering split that goes with it.
 *
 * The pattern is built fresh from `VARIABLE_PATTERN_SOURCE` on every call rather
 * than held at module scope: a `/g` RegExp carries mutable `lastIndex`, and a
 * shared instance produces position-dependent misses (T-116-12). Nothing here
 * re-defines what a variable IS — that lives once, in convex/galdrVariables.ts.
 */
import { VARIABLE_PATTERN_SOURCE } from "../../../convex/galdrVariables";

export interface PreviewSegment {
  text: string;
  unresolved: boolean;
}

export function splitPreview(resolved: string): PreviewSegment[] {
  const pattern = new RegExp(VARIABLE_PATTERN_SOURCE, "g");
  const segments: PreviewSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(resolved)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: resolved.slice(cursor, match.index), unresolved: false });
    }
    segments.push({ text: match[0], unresolved: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < resolved.length) {
    segments.push({ text: resolved.slice(cursor), unresolved: false });
  }
  return segments;
}
