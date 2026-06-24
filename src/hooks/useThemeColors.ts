import { useState, useEffect } from "react";
import { hexToRgba } from "@/lib/hexToRgba";

/**
 * ThemeColors — resolved hex/rgba values for the active theme.
 *
 * All fields are resolved from CSS custom properties on document.documentElement
 * at runtime via getComputedStyle. Canvas consumers (ForceGraphCanvas, CodeVaultGraph,
 * KnowledgeGraph) use these because canvas APIs cannot read CSS variables natively.
 *
 * Field names are STABLE — downstream consumers in Plan 06 (canvas wave) and
 * Phase 91 (3D Memory Galaxy) destructure these fields. Do not rename.
 */
export interface ThemeColors {
  primary: string;           // var(--primary)
  primaryAlpha18: string;    // var(--primary) @ 0.18 — graph link edges
  primaryAlpha55: string;    // var(--primary) @ 0.55 — KG current node
  accent: string;            // var(--accent)
  vaultNode: string;         // var(--vault-node-color) — vault nodes (dedicated token, NOT --accent)
  vaultNodeAlpha18: string;  // var(--vault-node-color) @ 0.18 — vault link edges
  chartBar: string;          // var(--chart-bar)
  chartBarAccent: string;    // var(--chart-bar-accent)
  statusOk: string;          // var(--status-ok)
  statusWarn: string;        // var(--status-warn)
  statusError: string;       // var(--status-error)
  statusInfo: string;        // var(--status-info)
}

/**
 * resolveThemeColors — read the current theme's CSS custom properties from
 * getComputedStyle(document.documentElement) and return a ThemeColors object.
 *
 * Called as:
 *  - useState lazy initializer (runs once on mount)
 *  - MutationObserver callback (runs on data-theme attribute change)
 *
 * IMPORTANT: Do NOT cache the CSSStyleDeclaration. Call getComputedStyle fresh
 * on each invocation so the MutationObserver always sees the post-attribute-change
 * CSSOM values (Pitfall 2 from RESEARCH.md).
 */
export function resolveThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);

  const get = (token: string): string => style.getPropertyValue(token).trim();

  const primary = get("--primary");
  const vaultNode = get("--vault-node-color");

  // Development guard: warn once if a token returned an oklch value.
  // All dark-theme token blocks use hex exclusively; oklch means class="dark"
  // was removed or the wrong token was read (Pitfall 3).
  if (process.env.NODE_ENV !== "production") {
    if (primary.startsWith("oklch")) {
      console.warn(
        "[useThemeColors] --primary resolved to oklch — ensure class=\"dark\" is on <html> " +
        "and [data-theme] is set. Canvas fillStyle will be invalid."
      );
    }
  }

  return {
    primary,
    primaryAlpha18: hexToRgba(primary, 0.18),
    primaryAlpha55: hexToRgba(primary, 0.55),
    accent: get("--accent"),
    vaultNode,
    vaultNodeAlpha18: hexToRgba(vaultNode, 0.18),
    chartBar: get("--chart-bar"),
    chartBarAccent: get("--chart-bar-accent"),
    statusOk: get("--status-ok"),
    statusWarn: get("--status-warn"),
    statusError: get("--status-error"),
    statusInfo: get("--status-info"),
  };
}

/**
 * useThemeColors — React hook that returns the active theme's resolved colors
 * and re-resolves whenever document.documentElement[data-theme] changes.
 *
 * Uses a MutationObserver with attributeFilter: ['data-theme'] so only theme
 * switches trigger a re-resolve — not arbitrary attribute changes on <html>.
 *
 * The MutationObserver is disconnected on unmount (no leak).
 */
export function useThemeColors(): ThemeColors {
  // Lazy initializer: resolveThemeColors() runs synchronously during render.
  // Because the pre-paint inline script in index.html sets data-theme before
  // React loads, the initial colors are always the correct theme — no flash.
  const [colors, setColors] = useState<ThemeColors>(resolveThemeColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(resolveThemeColors());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}
