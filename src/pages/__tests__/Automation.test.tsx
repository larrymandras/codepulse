import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// NOTE: relative mock paths are resolved from THIS file's location
// (src/pages/__tests__/), so they must use one extra ".." vs. the paths used
// inside src/pages/Automation.tsx itself, to land on the same absolute module.

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    automation: {
      cronSummary: "cronSummary",
      recentCrons: "recentCrons",
      recentHeartbeats: "recentHeartbeats",
      recentJobs: "recentJobs",
    },
    pipelineCheckpoints: {
      overview: "checkpointOverview",
      recent: "checkpointRecent",
    },
    integrationCalls: {
      overview: "integrationOverview",
      recent: "integrationRecent",
    },
  },
}));

// Known-length static catalog, independent of the real CRON_SCHEDULES data —
// proves the metric is computed from the imported list, not a hardcoded 12.
vi.mock("../../lib/cronSchedules", () => ({
  CRON_SCHEDULES: [
    { jobName: "test job 1", label: "Test Job 1", interval: "Every 1 min", source: "convex", intervalSeconds: 60 },
    { jobName: "test job 2", label: "Test Job 2", interval: "Every 2 min", source: "convex", intervalSeconds: 120 },
    { jobName: "test job 3", label: "Test Job 3", interval: "Every 3 min", source: "convex", intervalSeconds: 180 },
  ],
}));

const mockSendCommand = vi.fn().mockResolvedValue({ status: "ok" });
vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribeEvent: vi.fn(() => () => {}),
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useQuery } from "convex/react";
const mockUseQuery = vi.mocked(useQuery);

import Automation from "../Automation";

beforeEach(() => {
  vi.clearAllMocks();
  mockSendCommand.mockResolvedValue({ status: "ok" });
  // cronSummary undefined (loading) — proves no `?? 12` fallback is used.
  (mockUseQuery as any).mockImplementation((ref: unknown) => {
    switch (ref) {
      case "cronSummary":
        return undefined;
      case "recentCrons":
      case "recentHeartbeats":
      case "recentJobs":
        return [];
      case "checkpointOverview":
        return undefined;
      case "checkpointRecent":
        return [];
      case "integrationOverview":
        return undefined;
      case "integrationRecent":
        return [];
      default:
        return undefined;
    }
  });
});

describe("Automation — F4 honesty (D-06)", () => {
  test("schedules metric shows the computed CRON_SCHEDULES.length, not the literal 12 fallback", () => {
    render(<Automation />);
    expect(screen.getByText("Configured Schedules")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });

  test("no fake 'enabled' live badge is shown for the static catalog", () => {
    render(<Automation />);
    expect(screen.queryByText("ACTIVE")).not.toBeInTheDocument();
    expect(screen.queryByText("DISABLED")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });
});
