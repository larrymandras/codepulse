/**
 * SwapBadge.test.tsx — Phase 185 Plan 07 (SWAP-01/02, D-04/D-16)
 *
 * Covers:
 *   - both overrides null/undefined → renders nothing (default, D-04/D-16)
 *   - modelOverride only → "Brain: <model>" shown, no "Voice:" badge
 *   - voiceOverride only → "Voice: <name>" shown, no "Brain:" badge
 *   - both set → both badges shown simultaneously
 *   - read-only: no Switch/button rendered (unlike StrictModeToggle)
 *
 * Tooltip copy (Radix Portal content, only rendered on hover/focus open state)
 * is not asserted here — matching the StrictModeToggle.test.tsx precedent.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SwapBadge } from "./SwapBadge";
import { TooltipProvider } from "@/components/ui/tooltip";

function renderSwapBadge(props: { modelOverride?: string | null; voiceOverride?: string | null; lastModel?: string | null }) {
  return render(
    <TooltipProvider>
      <SwapBadge {...props} />
    </TooltipProvider>,
  );
}

describe("SwapBadge", () => {
  it("shows a persistent muted 'Brain: Auto' pill when both overrides are null (185-08 request)", () => {
    renderSwapBadge({ modelOverride: null, voiceOverride: null });
    expect(screen.getByText(/Brain: Auto/)).toBeInTheDocument();
    expect(screen.queryByText(/Voice:/)).not.toBeInTheDocument();
  });

  it("shows 'Brain: Auto' when both overrides are undefined", () => {
    renderSwapBadge({});
    expect(screen.getByText(/Brain: Auto/)).toBeInTheDocument();
    expect(screen.queryByText(/Voice:/)).not.toBeInTheDocument();
  });

  it("shows the last resolved model muted when no override is pinned (185-08)", () => {
    renderSwapBadge({ modelOverride: null, voiceOverride: null, lastModel: "google/gemini-2.5-flash" });
    expect(screen.getByText(/Brain: google\/gemini-2\.5-flash/)).toBeInTheDocument();
    expect(screen.queryByText(/Brain: Auto/)).not.toBeInTheDocument();
  });

  it("override wins over lastModel", () => {
    renderSwapBadge({ modelOverride: "grok-4.5", voiceOverride: null, lastModel: "google/gemini-2.5-flash" });
    expect(screen.getByText(/Brain: grok-4\.5/)).toBeInTheDocument();
    expect(screen.queryByText(/gemini/)).not.toBeInTheDocument();
  });

  it("shows the pinned model (not Auto) when modelOverride is set", () => {
    renderSwapBadge({ modelOverride: "Grok 4.5", voiceOverride: null });
    expect(screen.getByText(/Brain: Grok 4\.5/)).toBeInTheDocument();
    expect(screen.queryByText(/Brain: Auto/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Voice:/)).not.toBeInTheDocument();
  });

  it("shows the voice badge alongside 'Brain: Auto' when only voiceOverride is set", () => {
    renderSwapBadge({ modelOverride: null, voiceOverride: "Rachel" });
    expect(screen.getByText(/Voice: Rachel/)).toBeInTheDocument();
    expect(screen.getByText(/Brain: Auto/)).toBeInTheDocument();
  });

  it("shows both badges when both overrides are active", () => {
    renderSwapBadge({ modelOverride: "Grok 4.5", voiceOverride: "Rachel" });
    expect(screen.getByText(/Brain: Grok 4\.5/)).toBeInTheDocument();
    expect(screen.getByText(/Voice: Rachel/)).toBeInTheDocument();
  });

  it("is read-only — no Switch or button controls (unlike StrictModeToggle)", () => {
    renderSwapBadge({ modelOverride: "Grok 4.5", voiceOverride: "Rachel" });
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
