/**
 * IntakeReportView test (Phase 07-02) — jsdom render assertions.
 *
 * Not explicitly scripted by 07-02-PLAN.md's Task 3 <action> (unlike Tasks
 * 1/2, which name the test file directly), but Task 3 carries tdd="true" and
 * this component is the plan's XSS-mitigation surface (T-07-02-01) — Rule 2
 * (missing critical functionality: automated coverage for a
 * security-relevant render path) adds this file. Documented as a deviation
 * in 07-02-SUMMARY.md.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "convex/react";
import type { IntakeCommandRow } from "@/hooks/useIntake";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

import { IntakeReportView } from "./IntakeReportView";

function makeRow(overrides: Partial<IntakeCommandRow>): IntakeCommandRow {
  return {
    commandId: "cmd-1",
    status: "done",
    hostId: "desktop",
    destination: "global",
    workspaceId: null,
    storageId: null,
    githubUrl: "https://github.com/owner/repo",
    subpath: null,
    fileName: null,
    report: null,
    error: null,
    createdAt: 1_700_000_000_000,
    expiresAt: 1_700_000_000_000 + 5 * 60 * 1000,
    ...overrides,
  };
}

describe("IntakeReportView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue([]);
  });

  it("returns null for a non-done row (defensive guard)", () => {
    const { container } = render(
      <IntakeReportView row={makeRow({ status: "queued" })} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the exact truncated-report copy AND still renders the CLI command block", () => {
    render(
      <IntakeReportView
        row={makeRow({ report: { truncated: true, reason: "report exceeded size cap" } })}
      />
    );
    expect(
      screen.getByText(
        "Report too large to store — run the CLI command below for the full report."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/skill-intake admit "https:\/\/github\.com\/owner\/repo" --to global --write/)
    ).toBeInTheDocument();
  });

  it("renders a VerdictBadge, a severity tally, and a 4-column findings table for a real report", () => {
    render(
      <IntakeReportView
        row={makeRow({
          report: {
            schema_version: 1,
            tool_version: "0.1.1",
            verdict: "reject",
            candidate: { input: "owner/repo" },
            findings: [
              {
                rule_id: "RULE-01",
                req_id: null,
                severity: "error",
                message: "Unparseable frontmatter",
                path: "SKILL.md",
                line: 1,
                detail: null,
              },
            ],
            summary: { error: 1, warning: 0, info: 0 },
          },
        })}
      />
    );

    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.getByText("1 error")).toBeInTheDocument();
    expect(screen.getByText("Rule")).toBeInTheDocument();
    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(screen.getByText("File:line")).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("RULE-01")).toBeInTheDocument();
    expect(screen.getByText("SKILL.md:1")).toBeInTheDocument();
    expect(screen.getByText("Unparseable frontmatter")).toBeInTheDocument();
  });

  it("renders an HTML-like finding message as inert visible text, never as parsed markup", () => {
    render(
      <IntakeReportView
        row={makeRow({
          report: {
            verdict: "reject",
            candidate: { input: "owner/repo" },
            findings: [
              {
                rule_id: "RULE-XSS",
                severity: "error",
                message: "<script>alert(1)</script>",
                path: null,
                line: null,
              },
            ],
            summary: { error: 1, warning: 0, info: 0 },
          },
        })}
      />
    );

    expect(
      screen.getByText("<script>alert(1)</script>")
    ).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("appends --project <path> to the CLI command for a project destination", () => {
    vi.mocked(useQuery).mockReturnValue([
      { workspaceId: "ws-1", name: "my-repo", class: "synced", rootPath: "/repo" },
    ]);
    render(
      <IntakeReportView
        row={makeRow({
          destination: "project",
          workspaceId: "ws-1",
          report: {
            verdict: "admit",
            candidate: { input: "owner/repo" },
            findings: [],
            summary: { error: 0, warning: 0, info: 0 },
          },
        })}
      />
    );

    expect(
      screen.getByText(/skill-intake admit "owner\/repo" --to project --write --project "\/repo"/)
    ).toBeInTheDocument();
  });

  it("quotes a workspace rootPath containing spaces so the copied command survives a shell paste (WR-06 regression)", () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        workspaceId: "ws-1",
        name: "my-repo",
        class: "synced",
        rootPath: "C:\\Users\\larry mandras\\repo",
      },
    ]);
    render(
      <IntakeReportView
        row={makeRow({
          destination: "project",
          workspaceId: "ws-1",
          report: {
            verdict: "admit",
            candidate: { input: "owner/repo" },
            findings: [],
            summary: { error: 0, warning: 0, info: 0 },
          },
        })}
      />
    );

    expect(
      screen.getByText((content) =>
        content.includes('--project "C:\\Users\\larry mandras\\repo"')
      )
    ).toBeInTheDocument();
  });

  it("escapes embedded double quotes in a report-derived src so hostile content cannot break out of the quoted operand (WR-06 regression)", () => {
    render(
      <IntakeReportView
        row={makeRow({
          report: {
            verdict: "reject",
            candidate: { input: 'owner/repo" && evil "' },
            findings: [],
            summary: { error: 0, warning: 0, info: 0 },
          },
        })}
      />
    );

    expect(
      screen.getByText((content) =>
        content.includes('skill-intake admit "owner/repo\\" && evil \\"" --to global --write')
      )
    ).toBeInTheDocument();
  });

  it("renders a collapsed 'Raw JSON' toggle", () => {
    render(
      <IntakeReportView
        row={makeRow({
          report: {
            verdict: "admit",
            candidate: { input: "owner/repo" },
            findings: [],
            summary: { error: 0, warning: 0, info: 0 },
          },
        })}
      />
    );
    expect(screen.getByText("Raw JSON")).toBeInTheDocument();
  });
});
