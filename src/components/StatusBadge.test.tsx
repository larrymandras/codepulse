/**
 * StatusBadge test — D-07 (Phase 122) four-tier badge law, plus the D-15
 * (Phase 120) spine-word control this plan must not disturb.
 *
 * This component has 22 consumers across six vocabularies (job status,
 * execution mode, voice call, roster, swarm task, quality) mixed behind
 * one `legacyMap` lookup, so a change intended for one vocabulary can
 * silently mangle another that shares a semantic or a word. See
 * 122-BADGE-LAW.md for the full per-entry tier assignment and reasoning.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StatusBadge } from "./StatusBadge";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("StatusBadge", () => {
  describe("D-15 vocabulary — completed relabelled, swarm done unaffected", () => {
    it('renders "SUCCEEDED" (not "DONE") for job status completed', () => {
      render(<StatusBadge status="completed" />);
      expect(screen.getByText("SUCCEEDED")).toBeInTheDocument();
      expect(screen.queryByText("DONE")).not.toBeInTheDocument();
    });

    it('CONTROL: swarm task status "done" still renders "DONE" — proves the ' +
      "relabel was scoped to job `completed` and did not sweep a same-word " +
      "entry in the swarm vocabulary. `done` and `completed` now SHARE a " +
      "tier (both quietest, D-07) while keeping DIFFERENT labels -- tier " +
      "and vocabulary are orthogonal.", () => {
      render(<StatusBadge status="done" />);
      expect(screen.getByText("DONE")).toBeInTheDocument();
      expect(screen.queryByText("SUCCEEDED")).not.toBeInTheDocument();
    });
  });

  describe("D-07 Strong tier — the fill law", () => {
    it("failed renders WITH the --status-error-fill pairing present (Strong, filled)", () => {
      const { container } = render(<StatusBadge status="failed" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("bg-(--status-error-fill)");
      expect(badge.className).toContain("text-(--status-error-on-fill)");
    });

    it("regression (quality) renders Strong — same fill pairing as failed", () => {
      const { container } = render(<StatusBadge status="regression" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("bg-(--status-error-fill)");
    });

    it("verify_rejected (swarm, 'rejected verification') renders Strong", () => {
      const { container } = render(<StatusBadge status="verify_rejected" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("bg-(--status-error-fill)");
    });

    it(
      "auth_failed (direct-semantic-literal convention: warn + explicit " +
        "tier=\"strong\") renders the Strong tier's warn-fill pairing, " +
        "DISTINCT from failed's error-fill pairing — SC#4 (auth_failed " +
        "must stay visually distinct from failed) survives the tier being " +
        "shared, because colour still comes from `semantic`, not `tier`",
      () => {
        const { container: authFailed } = render(
          <StatusBadge status="warn" tier="strong" label="Auth Failed" />
        );
        const authBadge = authFailed.firstChild as HTMLElement;
        expect(screen.getByText("Auth Failed")).toBeInTheDocument();
        expect(authBadge.className).toContain("bg-(--status-warn)");
        expect(authBadge.className).not.toContain("--status-error-fill");

        const { container: failedContainer } = render(<StatusBadge status="failed" />);
        const failedBadge = failedContainer.firstChild as HTMLElement;
        expect(failedBadge.className).toContain("--status-error-fill");
        expect(failedBadge.className).not.toContain("bg-(--status-warn)");
      }
    );
  });

  describe("D-07 mode grammar — execution modes are never an outcome", () => {
    it(
      "strict does NOT render the same class string as failed — the exact " +
        "defect D-07 exists to fix (a MODE used to render like a FAILURE)",
      () => {
        const { container: strictContainer } = render(<StatusBadge status="strict" />);
        const { container: failedContainer } = render(<StatusBadge status="failed" />);
        const strictClass = (strictContainer.firstChild as HTMLElement).className;
        const failedClass = (failedContainer.firstChild as HTMLElement).className;
        expect(strictClass).not.toBe(failedClass);
        // Specifically: strict must not carry ANY fill token.
        expect(strictClass).not.toMatch(/bg-\(--status-(ok|warn|info|error)(-fill)?\)/);
      }
    );

    it("strict renders the mode grammar (dashed border), not the outcome tiers", () => {
      const { container } = render(<StatusBadge status="strict" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("border-dashed");
      expect(badge.className).not.toContain("bg-(--status-error-fill)");
    });

    it("adaptive, standard and filler all render the dashed mode grammar", () => {
      for (const status of ["adaptive", "standard", "filler"]) {
        const { container } = render(<StatusBadge status={status} />);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("border-dashed");
      }
    });

    it("stalled (an OUTCOME, not a mode, despite living in the v6.0 comment block) renders Strong, not mode", () => {
      const { container } = render(<StatusBadge status="stalled" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("--status-error-fill");
      expect(badge.className).not.toContain("border-dashed");
    });
  });

  describe("D-07 Quietest tier — administrative / inactive / terminal-success states", () => {
    it(
      "completed (ok semantic) renders quietest: flat bg-muted, no border, " +
        "no text-(--status-ok) — CHANGED from Phase 120's quiet-ok treatment " +
        "per D-07's explicit 'succeeded, completed' Quietest assignment",
      () => {
        const { container } = render(<StatusBadge status="completed" />);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("bg-muted");
        expect(badge.className).toContain("text-muted-foreground");
        expect(badge.className).not.toContain("text-(--status-ok)");
        // The shadcn Badge primitive always carries a base
        // `border border-transparent` — assert no COLOURED border rides
        // along, not the absence of the word "border" itself.
        expect(badge.className).not.toMatch(/border-\(--status-/);
      }
    );

    it(
      "deregistered (roster) renders quietest, not strong — moves OUT of the " +
        "filled treatment it had only as a side effect of sharing the " +
        "`error` semantic with genuine failures (120-BADGE-INVENTORY.md §4: " +
        "an administrative removal, not a run outcome)",
      () => {
        const { container } = render(<StatusBadge status="deregistered" />);
        const badge = container.firstChild as HTMLElement;
        expect(badge.className).toContain("bg-muted");
        expect(badge.className).not.toContain("--status-error-fill");
      }
    );
  });

  describe("D-07 Quiet tier — unchanged entries stay byte-identical to Phase 120", () => {
    it("running (warn semantic) renders quiet: no bg fill, text-(--status-warn) token present", () => {
      const { container } = render(<StatusBadge status="running" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).not.toMatch(/bg-\(--status-(ok|warn|info|error)(-fill)?\)/);
      expect(badge.className).toContain("text-(--status-warn)");
    });

    it("live (voice call, ok semantic) renders quiet: no bg fill, its text token IS present", () => {
      const { container } = render(<StatusBadge status="live" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).not.toMatch(/bg-\(--status-(ok|warn|info|error)(-fill)?\)/);
      expect(badge.className).toContain("text-(--status-ok)");
    });
  });

  describe("both calling conventions", () => {
    it("legacy domain-word lookup still resolves label + tier (e.g. queued)", () => {
      render(<StatusBadge status="queued" />);
      expect(screen.getByText("QUEUED")).toBeInTheDocument();
    });

    it("direct semantic literal + custom label still bypasses legacyMap (e.g. CronJobList's ok/idle usage)", () => {
      render(<StatusBadge status="ok" label="ACTIVE" />);
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      expect(screen.queryByText("OK")).not.toBeInTheDocument();
    });

    it("direct semantic literal defaults error to Strong tier (e.g. Security.tsx's BLOCKED chip)", () => {
      const { container } = render(<StatusBadge status="error" label="BLOCKED" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("--status-error-fill");
    });
  });

  describe("unmapped status — graceful fallback", () => {
    it("renders the raw status uppercased and the bg-muted quietest chip, not a crash", () => {
      const { container } = render(<StatusBadge status="totally-unmapped" />);
      expect(screen.getByText("TOTALLY-UNMAPPED")).toBeInTheDocument();
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain("bg-muted");
      expect(badge.className).toContain("text-muted-foreground");
    });
  });

  describe("source hygiene", () => {
    it("StatusBadge.tsx contains no hex colour literal and no raw neutral-palette class", () => {
      // Strip comment lines before matching, per the plan's measurement
      // discipline — a comment naming a token is not a violation.
      // (Reads the file directly since this is a static-source assertion,
      // not a render assertion.)
      const src = fs.readFileSync(
        path.join(__dirname, "StatusBadge.tsx"),
        "utf-8"
      );
      const codeOnly = src
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
        .join("\n");
      expect(codeOnly).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(codeOnly).not.toMatch(/-(slate|zinc|gray|neutral|stone)-[0-9]/);
    });
  });
});
