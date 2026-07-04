import type { Anchor } from "./docCommentsApi";

export interface RelocateResult {
  status: "located" | "stale";
  start: number | null;
  end: number | null;
  reason: string;
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0, i = haystack.indexOf(needle);
  while (i !== -1) { n++; i = haystack.indexOf(needle, i + 1); }
  return n;
}

/**
 * Mirrors the Python `relocate_anchor` exactly: position match → context match
 * (prefix+quote+suffix, unique) → unique-quote fallback → stale. This must stay
 * byte-for-byte symmetric with the backend — any divergence risks silently
 * re-locating a comment to the wrong span instead of correctly marking it stale.
 *
 * Note: the context-match step runs unconditionally (quote is always non-empty
 * for persisted anchors, so `needle` is never empty). With empty prefix/suffix,
 * `needle === quote`, so this step reports `context_match` — matching the
 * backend. The `quote_unique` branch only fires when the full context needle
 * is NOT unique (or absent) but the bare quote still is.
 */
export function relocateAnchor(source: string, anchor: Anchor): RelocateResult {
  if (anchor.quote && source.slice(anchor.start, anchor.end) === anchor.quote) {
    return { status: "located", start: anchor.start, end: anchor.end, reason: "position_match" };
  }
  const needle = anchor.prefix + anchor.quote + anchor.suffix;
  if (needle && countOccurrences(source, needle) === 1) {
    const start = source.indexOf(needle) + anchor.prefix.length;
    return { status: "located", start, end: start + anchor.quote.length, reason: "context_match" };
  }
  if (anchor.quote && countOccurrences(source, anchor.quote) === 1) {
    const start = source.indexOf(anchor.quote);
    return { status: "located", start, end: start + anchor.quote.length, reason: "quote_unique" };
  }
  return { status: "stale", start: null, end: null, reason: "not_found" };
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i++) if (source[i] === "\n") line++;
  return line;
}

/**
 * Build a full source-coordinate anchor from a user selection. `quote` is the
 * selected text; `renderedPrefix`/`renderedSuffix` are context strings from the
 * rendered view used to disambiguate repeated occurrences. Returns null when the
 * quote cannot be uniquely located in `source` — callers MUST refuse to persist
 * the comment in that case rather than guessing an anchor the backend would reject.
 */
export function captureAnchorFromSelection(
  source: string,
  quote: string,
  renderedPrefix: string,
  renderedSuffix: string,
): Anchor | null {
  if (!quote) return null;
  const contextNeedle = renderedPrefix + quote + renderedSuffix;
  let start = -1;
  if (contextNeedle && countOccurrences(source, contextNeedle) === 1) {
    start = source.indexOf(contextNeedle) + renderedPrefix.length;
  } else if (countOccurrences(source, quote) === 1) {
    start = source.indexOf(quote);
  } else {
    return null; // ambiguous or absent -> refuse rather than mis-anchor
  }
  const end = start + quote.length;
  return {
    quote,
    prefix: source.slice(Math.max(0, start - 32), start),
    suffix: source.slice(end, end + 32),
    start,
    end,
    line_start: lineAt(source, start),
    line_end: lineAt(source, end),
  };
}
