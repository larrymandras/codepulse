import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Convex mocks (must precede the component import) ────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

// Resolves to the SAME physical module both this test file's
// "../../convex/_generated/api" import AND convex/toolPolicyAlertEval.ts's
// own "./_generated/api" import target — vitest's module mock is keyed by
// resolved id, not import specifier text, so the mock below also intercepts
// toolPolicyAlertEval.ts's `internal` import. It supplies an empty
// `internal` object because `ALERTING_POLICY_KINDS` (the only export this
// suite actually consumes from that file) never touches `internal` —
// `internal.webhookDelivery.sendAlertWebhook` is only referenced inside
// evaluateToolPolicyAlerts, a function this suite never calls.
vi.mock("../../convex/_generated/api", () => ({
  api: {
    toolPolicyEvents: {
      recent: "toolPolicyEvents:recent",
      countsByKind: "toolPolicyEvents:countsByKind",
      lastReceivedAt: "toolPolicyEvents:lastReceivedAt",
    },
  },
  internal: {},
}));

import { useQuery } from "convex/react";
import ToolPolicyFeed from "./ToolPolicyFeed";
import { policyKindPresentation, POLICY_KIND_ORDER } from "../hooks/useToolPolicyEvents";
import { ALERTING_POLICY_KINDS } from "../../convex/toolPolicyAlertEval";

const mockUseQuery = vi.mocked(useQuery);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW_SEC = Math.floor(Date.now() / 1000);

const BOOT_ROW = {
  _id: "boot-1",
  event: "malformed_policy_boot",
  field: "tool_clusters",
  error: "invalid yaml: mapping values are not allowed here",
  timestamp: NOW_SEC,
};

const RELOAD_ROW = {
  _id: "reload-1",
  event: "malformed_policy_reload_rejected",
  field: "tool_clusters",
  error: "schema mismatch",
  timestamp: NOW_SEC,
};

// toolWasOffered / toolsOfferedCount deliberately ABSENT — the pre-105-02
// row shape (undefined, not false/0).
const LEAK_ROW_UNSET = {
  _id: "leak-1",
  event: "tool_call_leaked_as_text",
  tool: "web_search",
  sessionId: "sess-1",
  taskCategory: "research",
  round: 2,
  agentId: "agent-1",
  timestamp: NOW_SEC,
};

const LEAK_ROW_ZERO_COUNT = {
  _id: "leak-2",
  event: "tool_call_leaked_as_text",
  tool: "web_search",
  sessionId: "sess-2",
  toolWasOffered: false,
  toolsOfferedCount: 0,
  round: 1,
  agentId: "agent-2",
  timestamp: NOW_SEC,
};

const DENIED_ROW = {
  _id: "denied-1",
  event: "execution_denied",
  tool: "telegram_tool",
  sessionId: "sess-3",
  timestamp: NOW_SEC,
};

const UNKNOWN_ROW = {
  _id: "unknown-1",
  event: "some_future_policy_kind",
  tool: "mystery_tool",
  timestamp: NOW_SEC,
};

const FOUR_KIND_FEED = {
  rows: [BOOT_ROW, RELOAD_ROW, LEAK_ROW_UNSET, DENIED_ROW],
  truncated: false,
  cap: 200,
};

const EMPTY_COUNTS = {
  counts: Object.fromEntries(POLICY_KIND_ORDER.map((kind) => [kind, 0])),
  truncated: false,
  windowSeconds: 604800,
};

/**
 * Dispatches useQuery by its first arg (the mocked query identifier), the
 * same shape ToolUsagePanel.test.tsx's / TraceWaterfall.test.tsx's mock
 * scaffold uses (105-05/105-06, finding F5) — so one test can control the
 * feed, the counts and the last-received query independently.
 */
function mockUseQueryDispatch({
  feed = { rows: [], truncated: false, cap: 0 },
  counts = EMPTY_COUNTS,
  lastReceived,
}: {
  feed?: unknown;
  counts?: unknown;
  lastReceived?: unknown;
} = {}) {
  mockUseQuery.mockImplementation(((query: unknown) => {
    if (query === "toolPolicyEvents:recent") return feed;
    if (query === "toolPolicyEvents:countsByKind") return counts;
    if (query === "toolPolicyEvents:lastReceivedAt") return lastReceived;
    return undefined;
  }) as typeof useQuery);
}

function expandRow(label: string) {
  const badge = screen.getByText(label);
  const row = badge.closest(".cursor-pointer") as HTMLElement;
  fireEvent.click(row);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ToolPolicyFeed", () => {
  it("empty-is-not-healthy control: an empty feed with a never-received lastReceivedAt renders the never-received sentence and no reassuring 'healthy' language", () => {
    mockUseQueryDispatch({ lastReceived: { timestamp: null } });
    const { container } = render(<ToolPolicyFeed />);

    // Two elements legitimately carry this sentence at once (the header D-07
    // line and the empty-state body), so this asserts presence via getAllBy,
    // not a single-match getByText.
    expect(
      screen.getAllByText(/CodePulse has never received a tool-policy event from Ástríðr/).length
    ).toBeGreaterThanOrEqual(1);

    const text = (container.textContent ?? "").toLowerCase();
    for (const forbidden of ["healthy", "all clear", "no issues", "looks good"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("loading lastReceivedAt (undefined) renders the neutral placeholder, not the never-received sentence", () => {
    mockUseQueryDispatch({ lastReceived: undefined });
    render(<ToolPolicyFeed />);

    expect(screen.getByText("Checking…")).toBeInTheDocument();
    expect(
      screen.queryByText(/CodePulse has never received a tool-policy event/)
    ).not.toBeInTheDocument();
  });

  it("a lastReceivedAt timestamp two hours ago (UNIX seconds) renders as hours, not tens of thousands of days — the 1a136dc8 seconds-as-ms guard", () => {
    const twoHoursAgoSec = Math.floor(Date.now() / 1000) - 2 * 3600;
    // Non-empty feed so only the header D-07 line carries this text — the
    // empty-state body would otherwise echo the same relative-time clause.
    mockUseQueryDispatch({ feed: FOUR_KIND_FEED, lastReceived: { timestamp: twoHoursAgoSec } });
    render(<ToolPolicyFeed />);

    expect(screen.getByText(/Last policy event received 2h ago\./)).toBeInTheDocument();
    expect(screen.queryByText(/\d{4,}d ago/)).not.toBeInTheDocument();
  });

  it("execution_denied and malformed_policy_boot badges render with different colour tokens", () => {
    mockUseQueryDispatch({ feed: FOUR_KIND_FEED, lastReceived: { timestamp: NOW_SEC } });
    render(<ToolPolicyFeed />);

    const bootBadge = screen.getByText("Boot degraded to permissive");
    const deniedBadge = screen.getByText("Blocked by policy");
    expect(bootBadge.style.color).toBe("var(--status-error)");
    expect(deniedBadge.style.color).toBe("var(--status-info)");
    expect(bootBadge.style.color).not.toBe(deniedBadge.style.color);
  });

  it("exactly two Bell markers render across a four-kind fixture — only the two malformed kinds alert", () => {
    mockUseQueryDispatch({ feed: FOUR_KIND_FEED, lastReceived: { timestamp: NOW_SEC } });
    const { container } = render(<ToolPolicyFeed />);

    const bells = container.querySelectorAll('[aria-label="Also raised an alert"]');
    expect(bells).toHaveLength(2);
  });

  it("expanding a leak row with toolWasOffered undefined renders 'Unknown', never 'No'", () => {
    mockUseQueryDispatch({
      feed: { rows: [LEAK_ROW_UNSET], truncated: false, cap: 200 },
      lastReceived: { timestamp: NOW_SEC },
    });
    render(<ToolPolicyFeed />);

    expandRow("Leaked as text");
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.queryByText("No")).not.toBeInTheDocument();
  });

  it("toolsOfferedCount undefined renders 'No tool filter active'; toolsOfferedCount: 0 renders '0' — the two never collapse", () => {
    mockUseQueryDispatch({
      feed: { rows: [LEAK_ROW_UNSET], truncated: false, cap: 200 },
      lastReceived: { timestamp: NOW_SEC },
    });
    const { unmount } = render(<ToolPolicyFeed />);
    expandRow("Leaked as text");
    expect(screen.getByText("No tool filter active")).toBeInTheDocument();
    unmount();

    mockUseQueryDispatch({
      feed: { rows: [LEAK_ROW_ZERO_COUNT], truncated: false, cap: 200 },
      lastReceived: { timestamp: NOW_SEC },
    });
    render(<ToolPolicyFeed />);
    expandRow("Leaked as text");
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("No tool filter active")).not.toBeInTheDocument();
  });

  it("expanding a malformed_policy_boot row renders Field and Error but never a Tool label", () => {
    mockUseQueryDispatch({
      feed: { rows: [BOOT_ROW], truncated: false, cap: 200 },
      lastReceived: { timestamp: NOW_SEC },
    });
    render(<ToolPolicyFeed />);
    expandRow("Boot degraded to permissive");

    expect(screen.getByText("Field:")).toBeInTheDocument();
    expect(screen.getByText("Error:")).toBeInTheDocument();
    expect(screen.queryByText("Tool:")).not.toBeInTheDocument();
  });

  it("an unknown kind renders its raw string verbatim and is not dropped from the row list", () => {
    mockUseQueryDispatch({
      feed: { rows: [UNKNOWN_ROW], truncated: false, cap: 200 },
      lastReceived: { timestamp: NOW_SEC },
    });
    render(<ToolPolicyFeed />);

    expect(screen.getByText("some_future_policy_kind")).toBeInTheDocument();
  });

  it("renders the page-level disclaimer sentence verbatim", () => {
    mockUseQueryDispatch({ lastReceived: { timestamp: null } });
    render(<ToolPolicyFeed />);

    expect(
      screen.getByText(
        "This page observes tool behavior. It never disables a tool, changes policy, or blocks a call."
      )
    ).toBeInTheDocument();
  });

  it("renders the D-12 truncation banner when the feed reports truncated: true", () => {
    mockUseQueryDispatch({
      feed: { rows: [DENIED_ROW], truncated: true, cap: 200 },
      lastReceived: { timestamp: NOW_SEC },
    });
    render(<ToolPolicyFeed />);

    expect(screen.getByText(/Showing the most recent 200 policy events/)).toBeInTheDocument();
  });

  it("does not render the truncation banner when the feed reports truncated: false", () => {
    mockUseQueryDispatch({ feed: FOUR_KIND_FEED, lastReceived: { timestamp: NOW_SEC } });
    render(<ToolPolicyFeed />);

    expect(screen.queryByText(/Showing the most recent/)).not.toBeInTheDocument();
  });

  it("mutation-check regression guard: a two-state toolWasOffered ternary would render 'No' instead of 'Unknown' — this assertion catches that collapse (see SUMMARY for the mutate/observe/restore proof)", () => {
    mockUseQueryDispatch({
      feed: { rows: [LEAK_ROW_UNSET], truncated: false, cap: 200 },
      lastReceived: { timestamp: NOW_SEC },
    });
    render(<ToolPolicyFeed />);
    expandRow("Leaked as text");
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("mutation-check regression guard: execution_denied sharing tool_call_leaked_as_text's --status-warn token would collapse this exact colour-difference assertion (see SUMMARY for the mutate/observe/restore proof)", () => {
    // The pair that actually collides if execution_denied's token regresses
    // to --status-warn: both are the two view-only (non-alerting) kinds, so
    // a token collapse here is the realistic D-06 neutrality regression —
    // unlike boot (--status-error), which stays visually distinct either way.
    mockUseQueryDispatch({ feed: FOUR_KIND_FEED, lastReceived: { timestamp: NOW_SEC } });
    render(<ToolPolicyFeed />);
    const leakBadge = screen.getByText("Leaked as text");
    const deniedBadge = screen.getByText("Blocked by policy");
    expect(leakBadge.style.color).not.toBe(deniedBadge.style.color);
  });
});

describe("policyKindPresentation (pure kind-presentation map)", () => {
  it("malformed_policy_boot maps to the locked error token/label with alerts:true", () => {
    expect(policyKindPresentation("malformed_policy_boot")).toEqual({
      label: "Boot degraded to permissive",
      token: "var(--status-error)",
      alerts: true,
    });
  });

  it("execution_denied maps to the locked info token/label with alerts:false", () => {
    expect(policyKindPresentation("execution_denied")).toEqual({
      label: "Blocked by policy",
      token: "var(--status-info)",
      alerts: false,
    });
  });

  it("an unrecognised kind is shown verbatim with a neutral token and alerts:false", () => {
    expect(policyKindPresentation("brand_new_kind")).toEqual({
      label: "brand_new_kind",
      token: "var(--muted-foreground)",
      alerts: false,
    });
  });

  it("exactly the two malformed-policy kinds have alerts:true, matching ALERTING_POLICY_KINDS by set equality", () => {
    const alertingFromMap = POLICY_KIND_ORDER.filter(
      (kind) => policyKindPresentation(kind).alerts
    );
    expect(new Set(alertingFromMap)).toEqual(new Set(ALERTING_POLICY_KINDS));
    expect(alertingFromMap).toHaveLength(2);
  });
});
