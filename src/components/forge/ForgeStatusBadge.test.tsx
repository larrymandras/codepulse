/**
 * ForgeStatusBadge test — ported from forge StatusBadge.test.tsx.
 *
 * POLISH-05 / D-16 (2026-08-17): only `failed` renders filled now; every
 * other status is a quiet text/border chip. SC#4 (auth_failed distinct from
 * failed) survives the quiet law but is now proven by TOKEN presence/absence
 * rather than by a substring match on a fill colour word — see the "SC#4
 * guard" describe block below.
 *
 * SC#4: auth_failed MUST be visually distinct from failed:
 *   - auth_failed: --status-warn token (quiet) + KeyRound icon + "Auth Failed" label
 *   - failed:      bg-red-900/60 fill + --status-error token + XCircle icon + "Failed" label
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

    // SC#4 GUARD (2026-08-17, POLISH-05/D-16): the quiet law removed the
    // bg-amber-900/60 fill this test used to assert on, so a substring match
    // on the word "amber" no longer proves anything — it was always only a
    // proxy for "this is not the failed badge". A ONE-SIDED assertion here
    // (checking only that auth_failed carries --status-warn) cannot
    // distinguish "distinct from failed" from "both badges render the same
    // token" — that is exactly the failure mode T-120-13 registers. So this
    // is a PAIRED CONTROL across both renders: each status's class string
    // must carry its own token and must NOT carry the other's.
    it("SC#4 guard: auth_failed carries --status-warn (not --status-error) and failed carries --status-error (not --status-warn)", () => {
      const { container: authFailedContainer } = render(
        <ForgeStatusBadge status="auth_failed" />
      );
      const authFailedBadge = authFailedContainer.firstChild as HTMLElement;
      const authFailedClass = authFailedBadge.className;

      const { container: failedContainer } = render(
        <ForgeStatusBadge status="failed" />
      );
      const failedBadge = failedContainer.firstChild as HTMLElement;
      const failedClass = failedBadge.className;

      expect(authFailedClass).toContain("--status-warn");
      expect(authFailedClass).not.toContain("--status-error");
      expect(failedClass).toContain("--status-error");
      expect(failedClass).not.toContain("--status-warn");
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

  describe("all 6 status labels (D-15 spine word update, 2026-08-17)", () => {
    const statusLabels: Array<{ status: JobStatus; label: string }> = [
      { status: "queued", label: "Queued" },
      { status: "running", label: "Running" },
      { status: "completed", label: "Succeeded" },
      { status: "failed", label: "Failed" },
      { status: "stopped", label: "Cancelled" },
      { status: "auth_failed", label: "Auth Failed" },
    ];

    statusLabels.forEach(({ status, label }) => {
      it(`renders label "${label}" for status "${status}"`, () => {
        render(<ForgeStatusBadge status={status} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe("Phase 80 new statuses (pending / stopping_pending / expired)", () => {
    const newStatusLabels: Array<{ status: JobStatus; label: string }> = [
      { status: "pending", label: "Queued…" },
      { status: "stopping_pending", label: "Stopping…" },
      { status: "expired", label: "Expired" },
    ];

    newStatusLabels.forEach(({ status, label }) => {
      it(`renders label "${label}" for status "${status}"`, () => {
        render(<ForgeStatusBadge status={status} />);
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it("pending uses emerald (text-primary) and animates", () => {
      const { container } = render(<ForgeStatusBadge status="pending" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.outerHTML).toMatch(/text-primary/);
      const icon = container.querySelector("svg");
      expect(icon?.getAttribute("class")).toContain("animate-spin");
    });

    // Corrected 2026-08-17 (POLISH-05/D-16): the quiet law dropped the
    // bg-amber-900/40 fill this test used to match on with /amber/i — the
    // class string no longer contains that word at all now that the colour
    // is carried by the --status-warn token, not a fill. This is one of the
    // plan's own predicted-safe assertions that in fact broke; the
    // data-color-scheme attribute (a SEPARATE derived value, untouched by
    // this phase) is what still legitimately reads "amber".
    it("stopping_pending carries the --status-warn token and animates", () => {
      const { container } = render(<ForgeStatusBadge status="stopping_pending" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("--status-warn");
      expect(badge.getAttribute("data-color-scheme")).toBe("amber");
      const icon = container.querySelector("svg");
      expect(icon?.getAttribute("class")).toContain("animate-spin");
    });

    it("expired uses a non-animated Clock and stone color-scheme", () => {
      const { container } = render(<ForgeStatusBadge status="expired" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.getAttribute("data-color-scheme")).toBe("stone");
      const icon = container.querySelector("svg");
      expect(icon?.getAttribute("class")).not.toContain("animate-spin");
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

  describe("fill law (POLISH-05/D-16, 2026-08-17): only failed renders filled", () => {
    it("failed's class string contains the one sanctioned fill", () => {
      const { container } = render(<ForgeStatusBadge status="failed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("bg-red-900/60");
    });

    // Iterates rather than spot-checks: a future ninth status added with a
    // fill (or a regression reintroducing one on an existing status) fails
    // this suite instead of passing silently.
    const nonFailedStatuses: JobStatus[] = [
      "queued",
      "running",
      "completed",
      "stopped",
      "auth_failed",
      "pending",
      "stopping_pending",
      "expired",
    ];

    nonFailedStatuses.forEach((status) => {
      it(`${status}'s class string contains no bg-* fill token`, () => {
        const { container } = render(<ForgeStatusBadge status={status} />);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).not.toMatch(/bg-(red|green|blue|amber|zinc)-\d/);
      });
    });
  });

  describe("unknown status — graceful fallback (no crash)", () => {
    // status is typed JobStatus, but the daemon can emit a value outside the
    // union (it lands as a v.string() and is cast unchecked). The badge must
    // degrade to a neutral chip showing the raw value, not throw.
    it("renders the raw status text instead of crashing", () => {
      const unknown = "paused" as JobStatus;
      expect(() =>
        render(<ForgeStatusBadge status={unknown} />)
      ).not.toThrow();
      expect(screen.getByText("paused")).toBeInTheDocument();
    });

    it("still renders an icon and the data-status attribute for an unknown status", () => {
      const unknown = "timeout" as JobStatus;
      const { container } = render(<ForgeStatusBadge status={unknown} />);
      expect(container.querySelector("svg")).not.toBeNull();
      expect(
        container.querySelector('[data-status="timeout"]')
      ).not.toBeNull();
    });
  });
});
