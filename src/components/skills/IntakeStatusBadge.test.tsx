/**
 * IntakeStatusBadge test — RowStatusBadge, SeverityBadge, VerdictBadge,
 * DestinationBadge. Follows ForgeStatusBadge.test.tsx's render/assert
 * convention (@testing-library/react, no Convex mock needed).
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  RowStatusBadge,
  SeverityBadge,
  VerdictBadge,
  DestinationBadge,
} from "./IntakeStatusBadge";

describe("RowStatusBadge", () => {
  it('renders "Queued…" for pending', () => {
    render(<RowStatusBadge status="pending" />);
    expect(screen.getByText("Queued…")).toBeInTheDocument();
  });

  it('renders "Queued" for queued with no countdownLabel', () => {
    render(<RowStatusBadge status="queued" />);
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("renders the countdownLabel for queued when provided", () => {
    render(<RowStatusBadge status="queued" countdownLabel="Expires in 4:32" />);
    expect(screen.getByText("Expires in 4:32")).toBeInTheDocument();
  });

  it('renders "Executing…" for executing', () => {
    render(<RowStatusBadge status="executing" />);
    expect(screen.getByText("Executing…")).toBeInTheDocument();
  });

  it('renders "Failed" for failed', () => {
    render(<RowStatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it('renders "Expired" for expired', () => {
    render(<RowStatusBadge status="expired" />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("renders a neutral fallback chip without throwing for an unmapped status", () => {
    expect(() =>
      // @ts-expect-error — deliberately passing a garbage value to test the runtime fallback
      render(<RowStatusBadge status="some-garbage-value" />)
    ).not.toThrow();
    expect(screen.getByText("some-garbage-value")).toBeInTheDocument();
  });
});

describe("SeverityBadge", () => {
  it('renders "Error" for error', () => {
    render(<SeverityBadge severity="error" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it('renders "Warning" for warning', () => {
    render(<SeverityBadge severity="warning" />);
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it('renders "Info" for info', () => {
    render(<SeverityBadge severity="info" />);
    expect(screen.getByText("Info")).toBeInTheDocument();
  });

  it("renders a neutral fallback chip without throwing for an unmapped severity", () => {
    expect(() =>
      render(<SeverityBadge severity="some-garbage-value" />)
    ).not.toThrow();
    expect(screen.getByText("some-garbage-value")).toBeInTheDocument();
  });
});

describe("VerdictBadge", () => {
  it('renders "Admit" for admit', () => {
    render(<VerdictBadge verdict="admit" />);
    expect(screen.getByText("Admit")).toBeInTheDocument();
  });

  it('renders "Reject" for reject', () => {
    render(<VerdictBadge verdict="reject" />);
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it('renders "Error" for error', () => {
    render(<VerdictBadge verdict="error" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders a neutral fallback chip without throwing for an unmapped verdict", () => {
    expect(() =>
      render(<VerdictBadge verdict="some-garbage-value" />)
    ).not.toThrow();
    expect(screen.getByText("some-garbage-value")).toBeInTheDocument();
  });
});

describe("DestinationBadge", () => {
  it('renders "Global" for global via shadcn Badge variant="outline"', () => {
    const { container } = render(<DestinationBadge destination="global" />);
    expect(screen.getByText("Global")).toBeInTheDocument();
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("data-variant")).toBe("outline");
  });

  it('renders "Project" for project', () => {
    render(<DestinationBadge destination="project" />);
    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it('renders "Cold storage" for cold', () => {
    render(<DestinationBadge destination="cold" />);
    expect(screen.getByText("Cold storage")).toBeInTheDocument();
  });

  it("renders the raw string as a fallback label without throwing for an unmapped destination, still via variant=outline", () => {
    const { container } = render(
      <DestinationBadge destination="some-garbage-value" />
    );
    expect(screen.getByText("some-garbage-value")).toBeInTheDocument();
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge?.getAttribute("data-variant")).toBe("outline");
  });
});
