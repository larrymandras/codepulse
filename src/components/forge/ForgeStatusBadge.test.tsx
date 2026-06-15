/**
 * ForgeStatusBadge test — ported from forge StatusBadge.test.tsx.
 *
 * SC#4: auth_failed MUST be visually distinct from failed:
 *   - auth_failed: amber bg/text + KeyRound icon + "Auth Failed" label
 *   - failed:      red bg/text + XCircle icon + "Failed" label
 *
 * ForgeClientConfig/window.__FORGE_CONFIG__ mock blocks are dropped
 * (forge-only; not applicable in CodePulse).
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ForgeStatusBadge } from "./ForgeStatusBadge";
import type { JobStatus } from "@/hooks/useForge";

describe("ForgeStatusBadge", () => {
  describe("auth_failed status (SC#4 — must be distinct from failed)", () => {
    it('renders the label "Auth Failed" (not "Failed")', () => {
      render(<ForgeStatusBadge status="auth_failed" />);
      expect(screen.getByText("Auth Failed")).toBeInTheDocument();
    });

    it('does NOT render the label "Failed" for auth_failed', () => {
      render(<ForgeStatusBadge status="auth_failed" />);
      expect(screen.queryByText("Failed")).not.toBeInTheDocument();
    });

    it("renders with amber color token for auth_failed (distinct from red for failed)", () => {
      const { container } = render(<ForgeStatusBadge status="auth_failed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge).not.toBeNull();
      const badgeHtml = badge.outerHTML;
      // auth_failed uses bg-amber-900/60 — must contain amber in the class string
      expect(badgeHtml).toMatch(/amber/i);
    });

    it("renders a KeyRound icon (lock/key affordance — not XCircle)", () => {
      const { container } = render(<ForgeStatusBadge status="auth_failed" />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      // The badge element should have an aria-label referencing auth_failed
      const badgeEl = container.firstChild as HTMLElement;
      expect(badgeEl.getAttribute("aria-label")).toContain("auth_failed");
    });
  });

  describe("failed status", () => {
    it('renders the label "Failed" (not "Auth Failed")', () => {
      render(<ForgeStatusBadge status="failed" />);
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it('does NOT render "Auth Failed" for failed status', () => {
      render(<ForgeStatusBadge status="failed" />);
      expect(screen.queryByText("Auth Failed")).not.toBeInTheDocument();
    });

    it("renders with red color token (distinct from amber for auth_failed)", () => {
      const { container } = render(<ForgeStatusBadge status="failed" />);
      const badge = container.firstChild as HTMLElement;
      const badgeHtml = badge.outerHTML;
      // failed uses bg-red-900/60 — must contain red in the class string
      expect(badgeHtml).toMatch(/red/i);
      // must NOT contain amber
      expect(badgeHtml).not.toMatch(/amber/i);
    });
  });

  describe("all 6 status labels (UI-SPEC Copywriting Contract)", () => {
    const statusLabels: Array<{ status: JobStatus; label: string }> = [
      { status: "queued", label: "Queued" },
      { status: "running", label: "Running" },
      { status: "completed", label: "Completed" },
      { status: "failed", label: "Failed" },
      { status: "stopped", label: "Stopped" },
      { status: "auth_failed", label: "Auth Failed" },
    ];

    statusLabels.forEach(({ status, label }) => {
      it(`renders label "${label}" for status "${status}"`, () => {
        render(<ForgeStatusBadge status={status} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe("accessibility", () => {
    it("includes aria-label with the status text", () => {
      const { container } = render(<ForgeStatusBadge status="running" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.getAttribute("aria-label")).toBeTruthy();
    });

    it('aria-label for auth_failed includes "auth_failed"', () => {
      const { container } = render(<ForgeStatusBadge status="auth_failed" />);
      const badge = container.firstChild as HTMLElement;
      const label = badge.getAttribute("aria-label") ?? "";
      expect(label.toLowerCase()).toMatch(/auth.?failed/i);
    });
  });

  describe("data attributes (test-compatibility contract)", () => {
    it("exposes data-status attribute on each badge", () => {
      const { container } = render(<ForgeStatusBadge status="queued" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.getAttribute("data-status")).toBe("queued");
    });

    it("exposes data-color-scheme attribute on each badge", () => {
      const { container } = render(<ForgeStatusBadge status="auth_failed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.getAttribute("data-color-scheme")).toBe("amber");
    });

    it("data-color-scheme for failed is red (not amber)", () => {
      const { container } = render(<ForgeStatusBadge status="failed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.getAttribute("data-color-scheme")).toBe("red");
    });
  });

  describe("running status — animate-spin", () => {
    it("applies animate-spin to the icon for running status", () => {
      const { container } = render(<ForgeStatusBadge status="running" />);
      const icon = container.querySelector("svg");
      expect(icon).not.toBeNull();
      // SVG className is SVGAnimatedString in jsdom — use getAttribute or classList
      expect(icon?.getAttribute("class")).toContain("animate-spin");
    });

    it("does NOT apply animate-spin for stopped status", () => {
      const { container } = render(<ForgeStatusBadge status="stopped" />);
      const icon = container.querySelector("svg");
      expect(icon?.getAttribute("class")).not.toContain("animate-spin");
    });
  });
});
