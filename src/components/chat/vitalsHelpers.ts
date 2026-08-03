/**
 * vitalsHelpers.ts — small formatting helpers shared between `VitalsRail.tsx`
 * and the promoted command-center `SystemMonitorPanel.tsx` (188-11 Task 2).
 * Extracted so both consumers derive the context-window fuel bar identically
 * instead of a copy-pasted second implementation.
 */

/**
 * contextWindow — known per-model context-window sizes (public facts, not
 * stored in-schema). Returns `null` for an unrecognised model so the fuel
 * bar can honestly hide rather than inventing a denominator.
 */
export function contextWindow(model: string | null | undefined): number | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes("1m")) return 1_000_000;
  if (m.includes("opus") || m.includes("sonnet") || m.includes("haiku")) return 200_000;
  if (m.includes("gpt-5") || m.includes("gpt5")) return 400_000;
  return null;
}

export const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`);
