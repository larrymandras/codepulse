/**
 * StrictModeToggle.test.tsx — Phase 183 Plan 04 (TDD RED gate, CONV-02)
 *
 * Covers:
 *   - OFF state: LockOpen icon (via aria-label), correct aria-label, calls onToggle(true) on click
 *   - ON state: Lock icon (via aria-label), correct aria-label, calls onToggle(false) on click
 *   - Controlled component: aria-checked reflects the `enabled` prop
 *
 * Tooltip copy (UI-SPEC exact strings) is Radix Portal content only rendered on
 * hover/focus open state — not asserted here, matching the existing MicToggle.test.tsx
 * precedent (aria-label/role assertions only, no tooltip-content DOM checks).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StrictModeToggle } from "./StrictModeToggle";

// Wrap in a TooltipProvider-compatible environment — the Radix tooltip requires a Provider.
import { TooltipProvider } from "@/components/ui/tooltip";

function renderStrictModeToggle(props: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return render(
    <TooltipProvider>
      <StrictModeToggle {...props} />
    </TooltipProvider>,
  );
}

describe("StrictModeToggle", () => {
  describe("OFF state (enabled=false)", () => {
    it('has aria-label "Enable strict mode"', () => {
      const onToggle = vi.fn();
      renderStrictModeToggle({ enabled: false, onToggle });
      expect(screen.getByRole("switch", { name: "Enable strict mode" })).toBeInTheDocument();
    });

    it("reflects aria-checked=false", () => {
      const onToggle = vi.fn();
      renderStrictModeToggle({ enabled: false, onToggle });
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    it("calls onToggle(true) when clicked", () => {
      const onToggle = vi.fn();
      renderStrictModeToggle({ enabled: false, onToggle });
      fireEvent.click(screen.getByRole("switch", { name: "Enable strict mode" }));
      expect(onToggle).toHaveBeenCalledOnce();
      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  describe("ON state (enabled=true)", () => {
    it('has aria-label "Disable strict mode"', () => {
      const onToggle = vi.fn();
      renderStrictModeToggle({ enabled: true, onToggle });
      expect(screen.getByRole("switch", { name: "Disable strict mode" })).toBeInTheDocument();
    });

    it("reflects aria-checked=true", () => {
      const onToggle = vi.fn();
      renderStrictModeToggle({ enabled: true, onToggle });
      expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("calls onToggle(false) when clicked", () => {
      const onToggle = vi.fn();
      renderStrictModeToggle({ enabled: true, onToggle });
      fireEvent.click(screen.getByRole("switch", { name: "Disable strict mode" }));
      expect(onToggle).toHaveBeenCalledOnce();
      expect(onToggle).toHaveBeenCalledWith(false);
    });
  });

  it("has no internal state — is purely controlled by the `enabled` prop", () => {
    const onToggle = vi.fn();
    const { rerender } = renderStrictModeToggle({ enabled: false, onToggle });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    rerender(
      <TooltipProvider>
        <StrictModeToggle enabled onToggle={onToggle} />
      </TooltipProvider>,
    );
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });
});
