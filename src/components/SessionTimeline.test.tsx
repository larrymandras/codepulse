import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SessionTimeline from "./SessionTimeline";

// Mock react-router-dom (SessionTimeline may use Link)
vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock the privacy hook used inside SessionTimeline
vi.mock("../hooks/usePrivacyMask", () => ({
  usePrivacyMask: () => ({
    mask: (s: string) => s,
    maskFilePath: (s: string) => s,
  }),
}));

describe("SessionTimeline - provider badges (GW-14)", () => {
  const mockEvents = [
    { _id: "e1", eventType: "tool_call", toolName: "read_file", timestamp: 1700000000, payload: null },
    { _id: "e2", eventType: "tool_call", toolName: "write_file", timestamp: 1700000060, payload: null },
    { _id: "e3", eventType: "session_start", toolName: null, timestamp: 1699999900, payload: null },
  ];

  const mockToolExecutions = [
    { toolName: "read_file", timestamp: 1700000000, provider: "claude-cli", sessionId: "s1" },
    { toolName: "write_file", timestamp: 1700000060, provider: "codex", sessionId: "s1" },
  ];

  it("renders provider badge when toolExecution has provider set", () => {
    render(
      <SessionTimeline
        events={mockEvents}
        agents={[]}
        toolExecutions={mockToolExecutions}
      />
    );
    // Check that provider display names appear as badges
    expect(screen.getByText(/Claude CLI/i)).toBeTruthy();
    expect(screen.getByText(/Codex CLI/i)).toBeTruthy();
  });

  it("renders no badge when toolExecutions prop is empty", () => {
    render(
      <SessionTimeline
        events={mockEvents}
        agents={[]}
        toolExecutions={[]}
      />
    );
    expect(screen.queryByText(/Claude CLI/i)).toBeNull();
    expect(screen.queryByText(/Codex CLI/i)).toBeNull();
  });

  it("renders no badge for non-tool events", () => {
    render(
      <SessionTimeline
        events={[{ _id: "e3", eventType: "session_start", toolName: null, timestamp: 1699999900, payload: null }]}
        agents={[]}
        toolExecutions={mockToolExecutions}
      />
    );
    expect(screen.queryByText(/Claude CLI/i)).toBeNull();
  });

  it("falls back gracefully when provider is unknown", () => {
    const unknownProviderExec = [
      { toolName: "read_file", timestamp: 1700000000, provider: "unknown-provider", sessionId: "s1" },
    ];
    render(
      <SessionTimeline
        events={mockEvents}
        agents={[]}
        toolExecutions={unknownProviderExec}
      />
    );
    // Unknown provider should still render with the raw provider name
    expect(screen.getByText("unknown-provider")).toBeTruthy();
  });
});
