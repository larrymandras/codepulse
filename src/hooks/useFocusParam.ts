/**
 * useFocusParam — generic on-mount focus-param hook (Phase 85, GH-04).
 *
 * Reads ?focus and ?from query params on mount. Once `nodes` resolves (not
 * undefined), locates the target node by id equality and calls onFocus exactly
 * once. Falls back silently to a no-op when the node is absent (D-04 / SC#3).
 *
 * Ref-agnostic: the caller closes over its own graph handle ref inside
 * `onFocus`, so the hook works for all three surfaces (CodeVaultGraph,
 * ToolGalaxy, KnowledgeGraph) without importing any canvas type.
 */

import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { decodeFromParam } from "../lib/focus-url";

export interface UseFocusParamOptions<N> {
  /** The already-loaded node list (undefined = still loading). */
  nodes: N[] | undefined;
  /** Extract a stable id from a node for matching the ?focus param value. */
  getId: (node: N) => string;
  /**
   * Called with the matched node exactly once when found.
   * The caller closes over its own fgRef / centerAt / zoom logic so this
   * hook stays ref-agnostic and fully unit-testable without a canvas.
   */
  onFocus: (node: N) => void;
}

/**
 * Read ?focus=<value> and ?from=<encoded-url> from the URL on mount.
 *
 * - Waits for `nodes` to resolve (undefined = still loading).
 * - Applies `onFocus` exactly once via an appliedRef one-shot guard.
 * - Silent no-op when no node matches the focus param (SC#3).
 * - Returns `{ fromParam }` — the decoded, same-origin-guarded return target
 *   (null when absent or when from fails the T-85-01 guard).
 */
export function useFocusParam<N>({
  nodes,
  getId,
  onFocus,
}: UseFocusParamOptions<N>): { fromParam: string | null } {
  const [searchParams] = useSearchParams();
  const focusParam = searchParams.get("focus");
  const fromRaw = searchParams.get("from");

  // T-85-01: guard the from param through decodeFromParam before returning
  const fromParam = decodeFromParam(fromRaw);

  // One-shot guard — prevent applying focus more than once across re-renders
  const appliedRef = useRef(false);

  useEffect(() => {
    // No focus param → nothing to do
    if (!focusParam) return;
    // Already applied once → stay no-op
    if (appliedRef.current) return;
    // Still loading → wait for data to resolve
    if (nodes === undefined) return;

    appliedRef.current = true;
    const target = nodes.find((n) => getId(n) === focusParam);
    if (target) {
      onFocus(target);
    }
    // Silent no-op when absent (SC#3) — no error, no fallback
  }, [focusParam, nodes, getId, onFocus]);

  return { fromParam };
}
