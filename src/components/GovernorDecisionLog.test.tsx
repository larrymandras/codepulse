/**
 * GovernorDecisionLog.test.tsx — Phase 112 (TELE-03, D-04).
 *
 * Mocks `convex/react`'s `useQuery` and the generated `api` module directly,
 * the same shape `BlackboardPanel.test.tsx` uses for a component that calls
 * `useQuery` without a wrapper hook. `GOVERNOR_DECISION_CAP` is imported for
 * real (it is dependency-free) so the at-cap assertions cannot drift from
 * the component's own constant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import { GOVERNOR_DECISION_CAP } from "../../convex/governorDecisionsFilters";
import { GovernorDecisionLog } from "./GovernorDecisionLog";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    governorDecisions: {
      listRecent: "governorDecisions:listRecent",
    },
  },
}));

const mockUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  mockUseQuery.mockReset();
});

interface Row {
  _id: string;
  _creationTime: number;
  emitter: string;
  priority: string;
  spoke: boolean;
  heldReason?: string;
  timestamp: number;
}

let rowCounter = 0;
function makeRow(overrides: Partial<Row> = {}): Row {
  rowCounter += 1;
  return {
    _id: `row-${rowCounter}`,
    _creationTime: 1754530000,
    emitter: "reminder_nudge",
    priority: "normal",
    spoke: true,
    timestamp: 1754530000,
    ...overrides,
  };
}

describe("GovernorDecisionLog — loading vs empty are provably distinguished", () => {
  it("loading: renders the skeleton and does NOT render the empty-state heading", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<GovernorDecisionLog />);

    expect(document.querySelector(".animate-pulse")).not.toBeNull();
    expect(
      screen.queryByText("No governor decisions yet")
    ).not.toBeInTheDocument();
  });

  it("empty: renders the empty-state copy and does NOT render the skeleton", () => {
    mockUseQuery.mockReturnValue([]);
    render(<GovernorDecisionLog />);

    expect(screen.getByText("No governor decisions yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Decision history appears here once the interrupt governor evaluates its first proactive event (reminder, watch pulse, heartbeat, or a similar automated nudge)."
      )
    ).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).toBeNull();
  });
});

describe("GovernorDecisionLog — populated rows", () => {
  it("renders Spoke and Held labels, emitter text, and the focus held-reason prose", () => {
    const spokeRow = makeRow({ spoke: true, emitter: "watch_pulse" });
    const heldFocusRow = makeRow({
      spoke: false,
      heldReason: "focus",
      emitter: "reminder_nudge",
    });
    mockUseQuery.mockReturnValue([spokeRow, heldFocusRow]);

    render(<GovernorDecisionLog />);

    expect(screen.getByText("Spoke")).toBeInTheDocument();
    expect(screen.getByText("Held")).toBeInTheDocument();
    expect(screen.getByText("watch_pulse")).toBeInTheDocument();
    expect(screen.getByText("reminder_nudge")).toBeInTheDocument();
    expect(screen.getByText("held during focus mode")).toBeInTheDocument();
  });

  it("renders the quiet-hours held-reason prose for a held row with heldReason 'quiet-hours'", () => {
    const heldQuietRow = makeRow({
      spoke: false,
      heldReason: "quiet-hours",
      emitter: "heartbeat",
    });
    mockUseQuery.mockReturnValue([heldQuietRow]);

    render(<GovernorDecisionLog />);

    expect(screen.getByText("held during quiet hours")).toBeInTheDocument();
  });

  it("renders the bare 'held' fallback when heldReason is undefined on a held row", () => {
    const heldNoReasonRow = makeRow({
      spoke: false,
      heldReason: undefined,
      emitter: "heartbeat",
    });
    mockUseQuery.mockReturnValue([heldNoReasonRow]);

    render(<GovernorDecisionLog />);

    expect(screen.getByText("held")).toBeInTheDocument();
  });
});

describe("GovernorDecisionLog — at-cap truncation caption", () => {
  it("renders the at-cap caption naming GOVERNOR_DECISION_CAP when the row count equals the cap", () => {
    const rows = Array.from({ length: GOVERNOR_DECISION_CAP }, (_, i) =>
      makeRow({ timestamp: 1000 + i })
    );
    mockUseQuery.mockReturnValue(rows);

    render(<GovernorDecisionLog />);

    expect(
      screen.getByText(
        `Showing the last ${GOVERNOR_DECISION_CAP} decisions — earlier decisions may exist.`
      )
    ).toBeInTheDocument();
  });

  it("does NOT render the at-cap caption when the row count is below the cap — a caption that always renders proves nothing", () => {
    const rows = [makeRow(), makeRow()];
    mockUseQuery.mockReturnValue(rows);

    render(<GovernorDecisionLog />);

    expect(
      screen.queryByText(
        `Showing the last ${GOVERNOR_DECISION_CAP} decisions — earlier decisions may exist.`
      )
    ).not.toBeInTheDocument();
    expect(screen.getByText("Showing 2 decisions.")).toBeInTheDocument();
  });
});
