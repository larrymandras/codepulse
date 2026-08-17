/**
 * StatusBadge test — POLISH-05 / D-16 (quiet law) and D-15 (spine word).
 *
 * This component has 19 consumers and had no direct test before this plan,
 * which is why the fill change is riskier than it looks: the `legacyMap`
 * mixes five vocabularies (job status, execution mode, voice call, roster,
 * swarm task) behind one lookup, so a change intended for job status can
 * silently mangle an unrelated vocabulary that shares a semantic or a word.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  describe("D-15 vocabulary — completed relabelled, swarm done unaffected", () => {
    it('renders "SUCCEEDED" (not "DONE") for job status completed', () => {
      render(<StatusBadge status="completed" />);
      expect(screen.getByText("SUCCEEDED")).toBeInTheDocument();
      expect(screen.queryByText("DONE")).not.toBeInTheDocument();
    });

    it('CONTROL: swarm task status "done" still renders "DONE" — proves the ' +
      "relabel was scoped to job `completed` and did not sweep a same-word " +
      "entry in the swarm vocabulary", () => {
      render(<StatusBadge status="done" />);
      expect(screen.getByText("DONE")).toBeInTheDocument();
      expect(screen.queryByText("SUCCEEDED")).not.toBeInTheDocument();
    });
  });

  describe("D-16 fill law — only Failed renders filled", () => {
    it("failed renders WITH the bg-(--status-error) fill present", () => {
      const { container } = render(<StatusBadge status="failed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("bg-(--status-error)");
    });

    it(
      "completed (ok semantic) renders quiet: no bg-(--status-*) fill, but " +
        "the text-(--status-ok) token IS present — proves 'quiet' means " +
        "recoloured, not uncoloured",
      () => {
        const { container } = render(<StatusBadge status="completed" />);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).not.toMatch(/bg-\(--status-(ok|warn|info|error)\)/);
        expect(badge.className).toContain("text-(--status-ok)");
      }
    );

    it(
      "running (warn semantic) renders quiet: no bg-(--status-*) fill, but " +
        "the text-(--status-warn) token IS present",
      () => {
        const { container } = render(<StatusBadge status="running" />);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).not.toMatch(/bg-\(--status-(ok|warn|info|error)\)/);
        expect(badge.className).toContain("text-(--status-warn)");
      }
    );

    it(
      "live (voice call, ok/info-adjacent semantic) renders quiet: no " +
        "bg-(--status-*) fill, but its text token IS present",
      () => {
        const { container } = render(<StatusBadge status="live" />);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).not.toMatch(/bg-\(--status-(ok|warn|info|error)\)/);
        expect(badge.className).toContain("text-(--status-ok)");
      }
    );
  });

  describe("unmapped status — graceful fallback", () => {
    it("renders the raw status uppercased and the bg-muted idle chip, not a crash", () => {
      const { container } = render(<StatusBadge status="totally-unmapped" />);
      expect(screen.getByText("TOTALLY-UNMAPPED")).toBeInTheDocument();
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("bg-muted");
      expect(badge.className).toContain("text-muted-foreground");
    });
  });
});
