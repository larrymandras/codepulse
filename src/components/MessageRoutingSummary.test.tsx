/**
 * MessageRoutingSummary.test.tsx — D-13's closed follow-up.
 *
 * Mocks `convex/react`'s `useQuery` and the generated `api` module directly,
 * the shape GovernorDecisionLog.test.tsx uses for a component that calls
 * `useQuery` without a wrapper hook.
 *
 * PrivacyProvider is NOT mocked — the masking assertions drive the real
 * provider by seeding its localStorage key, so they exercise the same path a
 * user toggling privacy mode does. A mocked privacy context could not catch a
 * component that forgot to read the flag at all.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useQuery } from "convex/react";
import { PrivacyProvider } from "../contexts/PrivacyContext";
import { MessageRoutingSummary } from "./MessageRoutingSummary";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    messageRoutes: {
      channelSummary: "messageRoutes:channelSummary",
    },
  },
}));

const mockUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  mockUseQuery.mockReset();
  localStorage.clear();
});

/** Seed the real PrivacyProvider's persisted state before render.
 *
 * `enabled` and `level` are INDEPENDENT in PrivacyContext — `setLevel`
 * (PrivacyContext.tsx:59-66) writes only `level` and never touches `enabled` —
 * so they are separate parameters here. Seeding them together as one flag is
 * what hid the screenshot-mode defect: every masking test passed while the
 * real "default off, then pick Screenshot" transition rendered raw PII.
 */
function setPrivacy(enabled: boolean, level: "off" | "demo" | "screenshot" = "off") {
  localStorage.setItem(
    "codepulse-privacy",
    JSON.stringify({
      enabled,
      maskPaths: true,
      maskEmails: true,
      maskKeys: true,
      maskIps: true,
      level,
    })
  );
}

function renderIt() {
  return render(
    <PrivacyProvider>
      <MessageRoutingSummary />
    </PrivacyProvider>
  );
}

/** A summary payload shaped exactly like `channelSummary`'s return value.
 *
 * The COUNTS are the live 2026-08-26 measurement (telegram 51 / whatsapp 2 /
 * 53 total / 16 sessions) so the fixture stays honest about the data's real
 * shape. The sender IDENTIFIERS are synthetic — this repo is public, and real
 * account identifiers do not belong in test data. */
function summary(overrides: Partial<any> = {}) {
  return {
    windowDays: 14,
    since: Math.floor(Date.now() / 1000) - 14 * 86400,
    total: 53,
    atCap: false,
    channels: [
      { channel: "telegram", count: 51, senders: ["5550101234"] },
      { channel: "whatsapp", count: 2, senders: ["99887766554433@lid"] },
    ],
    profiles: ["personal"],
    sessionCount: 16,
    daily: [1, 3, 2, 5, 1, 1, 4, 8, 2, 3, 1, 2, 5, 15],
    ...overrides,
  };
}

// ============================================================
// The three states must stay DISTINCT (the sibling's T-112-17 rule): a
// still-loading section must never read as a confirmed zero.
// ============================================================

describe("MessageRoutingSummary — loading vs empty vs populated are distinguished", () => {
  it("loading: renders a skeleton, and NOT the empty-state heading or any channel", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { container } = renderIt();

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText(/no messages routed/i)).toBeNull();
    expect(screen.queryByText("telegram")).toBeNull();
  });

  it("empty: renders the empty-state heading, and NOT the skeleton", () => {
    mockUseQuery.mockReturnValue(
      summary({ total: 0, channels: [], profiles: [], sessionCount: 0, daily: new Array(14).fill(0) })
    );
    const { container } = renderIt();

    expect(screen.getByText(/no messages routed/i)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("empty: names the window length from the payload, so the copy cannot drift from the query", () => {
    mockUseQuery.mockReturnValue(
      summary({ windowDays: 30, total: 0, channels: [], profiles: [], sessionCount: 0, daily: new Array(30).fill(0) })
    );
    renderIt();
    expect(screen.getByText(/last 30 days/i)).toBeInTheDocument();
  });

  it("populated: renders channels, and NOT the skeleton or the empty state", () => {
    mockUseQuery.mockReturnValue(summary());
    const { container } = renderIt();

    expect(screen.getByText("telegram")).toBeInTheDocument();
    expect(screen.getByText("whatsapp")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(screen.queryByText(/no messages routed/i)).toBeNull();
  });
});

// ============================================================
// Channel mix — the reason this surface is an aggregate rather than the
// row table the governor_decision axis got.
// ============================================================

describe("MessageRoutingSummary — channel mix", () => {
  it("shows each channel's count and its share of the window", () => {
    mockUseQuery.mockReturnValue(summary());
    renderIt();

    expect(screen.getByText("51")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    // 51/53 = 96.2% -> 96%, 2/53 = 3.8% -> 4%
    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(screen.getByText("4%")).toBeInTheDocument();
  });

  it("renders channels in the order the server sent them (busiest first)", () => {
    mockUseQuery.mockReturnValue(summary());
    renderIt();

    const names = screen
      .getAllByTestId("message-route-channel-name")
      .map((el) => el.textContent);
    expect(names).toEqual(["telegram", "whatsapp"]);
  });

  it("sizes each bar to the EXACT share, while only the label rounds", () => {
    // Deliberately unrounded: rounding the bar itself would snap a sub-1%
    // channel to a zero-width bar and render it as absent. The label rounds
    // for readability (96% / 4%), the geometry does not.
    mockUseQuery.mockReturnValue(summary());
    renderIt();

    const bars = screen.getAllByTestId("message-route-bar");
    expect(bars[0]).toHaveStyle({ width: `${(51 / 53) * 100}%` });
    expect(bars[1]).toHaveStyle({ width: `${(2 / 53) * 100}%` });
  });

  it("still renders a visible bar for a channel under 1% of the window", () => {
    mockUseQuery.mockReturnValue(
      summary({
        total: 1000,
        channels: [
          { channel: "telegram", count: 998, senders: [] },
          { channel: "whatsapp", count: 2, senders: [] },
        ],
      })
    );
    renderIt();

    const bars = screen.getAllByTestId("message-route-bar");
    // 2/1000 = 0.2% — nonzero width, and the label rounds to 0%.
    expect(bars[1]).toHaveStyle({ width: "0.2%" });
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("does not divide by zero when a channel list somehow arrives with a zero total", () => {
    mockUseQuery.mockReturnValue(
      summary({ total: 0, channels: [{ channel: "telegram", count: 0, senders: [] }] })
    );
    // total 0 takes the empty state; the assertion is that it does not throw
    // and does not render NaN anywhere.
    const { container } = renderIt();
    expect(container.textContent).not.toMatch(/NaN/);
  });
});

// ============================================================
// Sender PII
// ============================================================

describe("MessageRoutingSummary — sender masking", () => {
  it("masks the sender when privacy mode is ON", () => {
    setPrivacy(true, "demo");
    mockUseQuery.mockReturnValue(summary());
    const { container } = renderIt();

    expect(screen.getByText(/55\*\*\*34/)).toBeInTheDocument();
    expect(screen.getByText(/99\*\*\*33@lid/)).toBeInTheDocument();
    // The raw handles must not survive anywhere in the tree — including in a
    // title/aria attribute, which is why this checks innerHTML not just text.
    expect(container.innerHTML).not.toContain("5550101234");
    expect(container.innerHTML).not.toContain("99887766554433");
  });

  it("shows the raw sender when privacy mode is OFF", () => {
    setPrivacy(false);
    mockUseQuery.mockReturnValue(summary());
    renderIt();

    expect(screen.getByText(/5550101234/)).toBeInTheDocument();
    expect(screen.getByText(/99887766554433@lid/)).toBeInTheDocument();
  });

  // ----------------------------------------------------------------
  // `enabled` and `level` are independent. PrivacyContext.setLevel writes only
  // `level`, so selecting Screenshot from the DEFAULT off state leaves
  // `enabled` false. Gating masking on `enabled` alone therefore renders raw
  // phone numbers in a view whose entire purpose is being safe to screenshot.
  // ----------------------------------------------------------------
  it("masks the sender at SCREENSHOT level even though `enabled` is still false", () => {
    setPrivacy(false, "screenshot");
    mockUseQuery.mockReturnValue(summary());
    const { container } = renderIt();

    expect(container.innerHTML).not.toContain("5550101234");
    expect(container.innerHTML).not.toContain("99887766554433");
    expect(screen.getByText(/55\*\*\*34/)).toBeInTheDocument();
  });

  it("masks the sender at DEMO level even though `enabled` is still false", () => {
    // Demo mode blurs `[data-sensitive]` with hover-to-reveal, so the raw text
    // would otherwise be one hover away from an audience watching a demo.
    setPrivacy(false, "demo");
    mockUseQuery.mockReturnValue(summary());
    const { container } = renderIt();

    expect(container.innerHTML).not.toContain("5550101234");
    expect(container.innerHTML).not.toContain("99887766554433");
  });

  it("marks the sender `data-sensitive` so the app's own privacy CSS can reach it", () => {
    // `.privacy-screenshot [data-sensitive] { visibility: hidden }` and
    // `.privacy-demo [data-sensitive] { filter: blur(4px) }` (index.css:649-661)
    // are the app's designed mechanism. Without the attribute they cannot
    // apply to this element at all, whatever the level.
    setPrivacy(false, "off");
    mockUseQuery.mockReturnValue(summary());
    renderIt();

    const senderEls = screen.getAllByTestId("message-route-senders");
    expect(senderEls.length).toBeGreaterThan(1); // control: more than one channel renders senders
    for (const el of senderEls) {
      expect(el).toHaveAttribute("data-sensitive");
    }
  });

  it("renders nothing for a channel with no known sender rather than an empty label", () => {
    setPrivacy(false);
    mockUseQuery.mockReturnValue(
      summary({
        total: 1,
        channels: [{ channel: "telegram", count: 1, senders: [] }],
      })
    );
    renderIt();
    expect(screen.queryByTestId("message-route-senders")).toBeNull();
  });

  it("joins multiple senders on one channel", () => {
    setPrivacy(false);
    mockUseQuery.mockReturnValue(
      summary({
        total: 2,
        channels: [
          { channel: "telegram", count: 2, senders: ["1234567890", "5550101234"] },
        ],
      })
    );
    renderIt();
    expect(screen.getByTestId("message-route-senders").textContent).toContain(
      "1234567890"
    );
    expect(screen.getByTestId("message-route-senders").textContent).toContain(
      "5550101234"
    );
  });
});

// ============================================================
// Volume + cardinality footer
// ============================================================

describe("MessageRoutingSummary — volume", () => {
  it("renders a sparkline labelled with the window", () => {
    mockUseQuery.mockReturnValue(summary());
    renderIt();

    const spark = screen.getByTestId("message-route-sparkline");
    expect(spark).toHaveAttribute("role", "img");
    expect(spark.getAttribute("aria-label")).toMatch(/14 days/i);
  });

  it("shows the per-day average derived from total and windowDays", () => {
    mockUseQuery.mockReturnValue(summary());
    renderIt();
    // 53 / 14 = 3.785... -> 3.8
    expect(screen.getByText("3.8 / day")).toBeInTheDocument();
  });
});

describe("MessageRoutingSummary — cardinality footer", () => {
  it("summarises profiles, sessions and messages", () => {
    mockUseQuery.mockReturnValue(summary());
    renderIt();

    const footer = screen.getByTestId("message-route-footer").textContent ?? "";
    expect(footer).toContain("1 profile");
    expect(footer).toContain("16 sessions");
    expect(footer).toContain("53 messages");
  });

  it("singularises correctly", () => {
    mockUseQuery.mockReturnValue(
      summary({ total: 1, sessionCount: 1, profiles: ["personal"] })
    );
    const footer = (renderIt(), screen.getByTestId("message-route-footer").textContent ?? "");
    expect(footer).toContain("1 profile");
    expect(footer).toContain("1 session");
    expect(footer).toContain("1 message");
    expect(footer).not.toContain("sessions");
    expect(footer).not.toContain("messages");
  });

  it("pluralises profiles", () => {
    mockUseQuery.mockReturnValue(summary({ profiles: ["personal", "work"] }));
    renderIt();
    expect(screen.getByTestId("message-route-footer").textContent).toContain(
      "2 profiles"
    );
  });
});

// ============================================================
// Cap disclosure — no silent truncation.
// ============================================================

describe("MessageRoutingSummary — cap disclosure", () => {
  it("says so when the window read hit its cap", () => {
    mockUseQuery.mockReturnValue(summary({ atCap: true, total: 2000 }));
    renderIt();
    expect(screen.getByText(/earlier messages in this window/i)).toBeInTheDocument();
  });

  it("stays silent when the window is complete", () => {
    mockUseQuery.mockReturnValue(summary({ atCap: false }));
    renderIt();
    expect(screen.queryByText(/earlier messages in this window/i)).toBeNull();
  });
});

// ============================================================
// The component must read the aggregate, not the row list.
// ============================================================

describe("MessageRoutingSummary — reads the aggregate query", () => {
  it("subscribes to messageRoutes:channelSummary", () => {
    mockUseQuery.mockReturnValue(summary());
    renderIt();
    expect(mockUseQuery).toHaveBeenCalledWith("messageRoutes:channelSummary", {});
  });
});
