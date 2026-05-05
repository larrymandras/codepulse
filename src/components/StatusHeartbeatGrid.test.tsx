import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusHeartbeatGrid from "./StatusHeartbeatGrid";

const mockSubscribeEvent = vi.fn(() => vi.fn());
vi.mock("../contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({ subscribeEvent: mockSubscribeEvent }),
}));

vi.mock("../hooks/useAgentStatus", () => ({
  useRecentAgentStatus: () => [],
  useLatestAgentStatus: () => undefined,
}));

vi.mock("./AgentAvatar", () => ({
  default: () => <div data-testid="avatar" />,
}));

vi.mock("motion/react", () => ({
  motion: { div: ({ children, className }: any) => <div className={className}>{children}</div> },
}));

vi.mock("./InfoTooltip", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

describe("StatusHeartbeatGrid", () => {
  it("renders a tile for each agent in roster", () => {
    render(<StatusHeartbeatGrid />);
    expect(screen.getByText("Astridhr")).toBeDefined();
    expect(screen.getByText("Urdhr")).toBeDefined();
  });

  it("all tiles render as idle when no events exist", () => {
    const { container } = render(<StatusHeartbeatGrid />);
    const idleTiles = container.querySelectorAll(".bg-gray-500\\/10");
    expect(idleTiles.length).toBe(10);
  });

  it("contains the InfoTooltip text", () => {
    render(<StatusHeartbeatGrid />);
    expect(screen.getByText(/Real-time status/)).toBeDefined();
  });

  it("subscribes to agent_status WebSocket events", () => {
    render(<StatusHeartbeatGrid />);
    expect(mockSubscribeEvent).toHaveBeenCalledWith("agent_status", expect.any(Function));
  });
});
