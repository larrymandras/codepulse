/**
 * ShareScreenToggle.test.tsx — Phase 184 Plan 06 (TDD RED gate, VISION-01)
 *
 * Covers the 3-state visual contract (184-UI-SPEC.md):
 *   - idle: ScreenShareOff icon, "SHARE" label, aria-label "Share your screen",
 *     aria-pressed=false, click calls onStart
 *   - armed: ScreenShareOff icon, "SHARE" label, aria-label "Share your screen",
 *     aria-pressed=false, click calls onStart (armed → click opens the picker)
 *   - active: ScreenShare icon, "SHARING" label, aria-label "Stop sharing your
 *     screen", aria-pressed=true, click calls onStop
 *
 * Icon identity is asserted via the lucide icon's data-testid-free DOM shape —
 * ScreenShare/ScreenShareOff render distinct <svg> children, so we assert via
 * the button's accessible name + a snapshot of the rendered icon's class list
 * (both icons carry lucide's `lucide-<name>` class), matching the existing
 * MicToggle-family precedent of icon-swap-via-aria-label assertions.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShareScreenToggle } from "./ShareScreenToggle";
import type { ScreenShareState } from "@/hooks/useScreenShare";

function renderToggle(props: {
  state: ScreenShareState;
  onStart: () => void;
  onStop: () => void;
}) {
  return render(
    <TooltipProvider>
      <ShareScreenToggle {...props} />
    </TooltipProvider>,
  );
}

describe("ShareScreenToggle", () => {
  describe("idle state", () => {
    it('renders "SHARE" label and aria-label "Share your screen"', () => {
      renderToggle({ state: "idle", onStart: vi.fn(), onStop: vi.fn() });
      expect(screen.getByRole("button", { name: "Share your screen" })).toBeInTheDocument();
      expect(screen.getByText("SHARE")).toBeInTheDocument();
    });

    it("aria-pressed=false", () => {
      renderToggle({ state: "idle", onStart: vi.fn(), onStop: vi.fn() });
      expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    });

    it("renders the ScreenShareOff icon", () => {
      renderToggle({ state: "idle", onStart: vi.fn(), onStop: vi.fn() });
      expect(document.querySelector("svg.lucide-screen-share-off")).toBeInTheDocument();
    });

    it("click calls onStart", () => {
      const onStart = vi.fn();
      renderToggle({ state: "idle", onStart, onStop: vi.fn() });
      fireEvent.click(screen.getByRole("button", { name: "Share your screen" }));
      expect(onStart).toHaveBeenCalledOnce();
    });

    it("has no ring class (not awaiting attention)", () => {
      renderToggle({ state: "idle", onStart: vi.fn(), onStop: vi.fn() });
      expect(screen.getByRole("button").className).not.toContain("ring-2");
    });
  });

  describe("armed state", () => {
    it('renders "SHARE" label and aria-label "Share your screen" (label unchanged)', () => {
      renderToggle({ state: "armed", onStart: vi.fn(), onStop: vi.fn() });
      expect(screen.getByRole("button", { name: "Share your screen" })).toBeInTheDocument();
      expect(screen.getByText("SHARE")).toBeInTheDocument();
    });

    it("renders the pulsing ring", () => {
      renderToggle({ state: "armed", onStart: vi.fn(), onStop: vi.fn() });
      expect(screen.getByRole("button").className).toContain("ring-2");
      expect(screen.getByRole("button").className).toContain("ring-(--status-info)");
    });

    it("click calls onStart (armed → click opens the real picker)", () => {
      const onStart = vi.fn();
      renderToggle({ state: "armed", onStart, onStop: vi.fn() });
      fireEvent.click(screen.getByRole("button", { name: "Share your screen" }));
      expect(onStart).toHaveBeenCalledOnce();
    });
  });

  describe("active state", () => {
    it('renders the ScreenShare icon + "SHARING" label + aria-pressed=true + aria-label "Stop sharing your screen"', () => {
      renderToggle({ state: "active", onStart: vi.fn(), onStop: vi.fn() });
      const button = screen.getByRole("button", { name: "Stop sharing your screen" });
      expect(button).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByText("SHARING")).toBeInTheDocument();
      expect(document.querySelector("svg.lucide-screen-share")).toBeInTheDocument();
      expect(document.querySelector("svg.lucide-screen-share-off")).not.toBeInTheDocument();
    });

    it("has no ring (steady-state confirmation, not attention)", () => {
      renderToggle({ state: "active", onStart: vi.fn(), onStop: vi.fn() });
      expect(screen.getByRole("button").className).not.toContain("ring-2");
    });

    it("click calls onStop", () => {
      const onStop = vi.fn();
      renderToggle({ state: "active", onStart: vi.fn(), onStop });
      fireEvent.click(screen.getByRole("button", { name: "Stop sharing your screen" }));
      expect(onStop).toHaveBeenCalledOnce();
    });
  });

  it("has no hardcoded hex colors (token-only contract)", () => {
    const { container } = renderToggle({ state: "idle", onStart: vi.fn(), onStop: vi.fn() });
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
