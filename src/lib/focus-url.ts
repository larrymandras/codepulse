/**
 * Cross-graph navigation helpers (Phase 85, GH-04).
 *
 * Pure, framework-free. Builds focus URLs for each graph surface and
 * provides the normalized-exact key used for eager match resolution (D-04).
 * No React imports. Fully unit-testable.
 */

/** Discriminated union representing a cross-graph navigation target. */
export type FocusTarget =
  | { surface: "graphs"; nodeId: string }
  | { surface: "tool-galaxy"; nodeId: string }
  | { surface: "knowledge-graph"; entityName: string; hops?: number };

/**
 * Strip graphify:<repo>: or vault: prefix, lowercase, trim.
 *
 * Keeps agent:/tool: prefixes intact — those are Galaxy-internal namespaces
 * stripped by the caller before passing the bare name. Single responsibility:
 * normalize only snapshot/vault-namespace prefixes (D-04).
 */
export function normalizeFocusKey(raw: string): string {
  return raw
    .replace(/^graphify:[^:]+:/, "")
    .replace(/^vault:/, "")
    .toLowerCase()
    .trim();
}

/**
 * Returns true when two node identifiers resolve to the same normalized key.
 * Exact equality only — no fuzzy, substring, or Levenshtein (D-04: a wrong
 * jump is worse than a missing one).
 */
export function focusKeysMatch(a: string, b: string): boolean {
  return normalizeFocusKey(a) === normalizeFocusKey(b);
}

/**
 * Emit the correct URL string for a cross-graph jump, including the optional
 * from param. Per-surface URL shapes (D-02):
 *   - graphs:           /graphs?focus=<nodeId>
 *   - tool-galaxy:      /tool-galaxy?focus=<nodeId>
 *   - knowledge-graph:  /knowledge-graph?focus=<entityName>&lens=entity&hops=<n>
 */
export function buildFocusUrl(target: FocusTarget, fromUrl?: string): string {
  const from = fromUrl ? `&from=${encodeURIComponent(fromUrl)}` : "";
  switch (target.surface) {
    case "graphs":
      return `/graphs?focus=${encodeURIComponent(target.nodeId)}${from}`;
    case "tool-galaxy":
      return `/tool-galaxy?focus=${encodeURIComponent(target.nodeId)}${from}`;
    case "knowledge-graph": {
      const hops = target.hops ?? 1;
      return `/knowledge-graph?focus=${encodeURIComponent(target.entityName)}&lens=entity&hops=${hops}${from}`;
    }
  }
}

/**
 * Thin wrapper that serializes an origin URL for the from param.
 * Callers use this so param encoding stays consistent across surfaces (D-06).
 */
export function encodeFromParam(originUrl: string): string {
  return encodeURIComponent(originUrl);
}

/**
 * Validate a from-param value for safe in-app return navigation.
 *
 * IMPORTANT (CR-01): the value passed here is already once-decoded. The sole
 * production caller (useFocusParam) reads it via react-router's
 * `useSearchParams().get("from")`, which applies one `decodeURIComponent`. This
 * guard MUST NOT decode again — a second decode would over-decode the inner
 * `?focus` value and corrupt ids containing `&`, `=`, `#`, or `%`. So the inner
 * focus stays percent-encoded in the returned path (correct: the return chip
 * navigates to it, and the destination decodes it once when reading `focus`).
 *
 * T-85-01 open-redirect / XSS guard: the return chip navigates to this value,
 * so it MUST be constrained to same-origin in-app paths. Returns null for any
 * value that fails the guard:
 *   - null / empty → null
 *   - does not start with single `/` → null
 *   - starts with `//` (protocol-relative) → null
 *   - contains a backslash `\` (browsers normalize `\` to `/`) → null
 *   - contains `://` (absolute URL) → null
 *   - matches any URI scheme (`javascript:`, `http:`, etc.) → null
 */
export function decodeFromParam(raw: string | null): string | null {
  if (!raw) return null;

  // Already once-decoded by the router — do NOT decode again (CR-01).
  const path = raw;

  // Must start with a single `/`
  if (!path.startsWith("/")) return null;

  // Must NOT be protocol-relative (e.g. //evil.com)
  if (path.startsWith("//")) return null;

  // Must NOT contain a backslash — browsers treat `\` like `/`, so `/\evil.com`
  // and `\\evil.com` are protocol-relative escapes (WR-01 defense-in-depth).
  if (path.includes("\\")) return null;

  // Must NOT contain a scheme separator (e.g. https://evil.com)
  if (path.includes("://")) return null;

  // Must NOT match any URI scheme like javascript:, data:, etc.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;

  return path;
}
