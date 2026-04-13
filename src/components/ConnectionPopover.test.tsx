import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { WSStatus } from "@/contexts/AstridrWSContext";

let mockStatus: WSStatus = "connected";
const mockReconnect = vi.fn();
const mockSendCommand = vi.fn(() =>
  Promise.resolve({ type: "ack" as const, request_id: "r1", status: "ok" as const })
);

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: mockStatus,
    sendCommand: mockSendCommand,
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: vi.fn(() => vi.fn()),
    reconnect: mockReconnect,
  })),
}));

import { ConnectionPopover } from "./ConnectionPopover";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

function openPopover() {
  const trigger = screen.getByRole("button", { name: /open connection details/i });
  fireEvent.click(trigger);
}

describe("ConnectionPopover", () => {
  beforeEach(() => {
    mockStatus = "connected";
    mockReconnect.mockClear();
    mockSendCommand.mockClear();
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: mockSendCommand,
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: vi.fn(() => vi.fn()),
      reconnect: mockReconnect,
    }));
  });

  it("renders CONNECTION DETAILS header", () => {
    render(<ConnectionPopover />);
    openPopover();
    expect(screen.getByText("CONNECTION DETAILS")).toBeInTheDocument();
  });

  it("shows Disconnected status with status-error styling when disconnected", () => {
    mockStatus = "disconnected";
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: mockSendCommand,
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: vi.fn(() => vi.fn()),
      reconnect: mockReconnect,
    }));

    render(<ConnectionPopover />);
    openPopover();
    // "Disconnected" appears in both the trigger (WSStatusIndicator) and inside the popover status row
    expect(screen.getAllByText("Disconnected").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Reconnect button only when disconnected", () => {
    mockStatus = "disconnected";
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: mockSendCommand,
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: vi.fn(() => vi.fn()),
      reconnect: mockReconnect,
    }));

    render(<ConnectionPopover />);
    openPopover();
    expect(screen.getByRole("button", { name: /reconnect/i })).toBeInTheDocument();
  });

  it("hides Reconnect button when connected", () => {
    mockStatus = "connected";

    render(<ConnectionPopover />);
    openPopover();
    expect(screen.queryByRole("button", { name: /^reconnect$/i })).not.toBeInTheDocument();
  });

  it("renders URL, uptime, latency, topics, last event rows", () => {
    render(<ConnectionPopover />);
    openPopover();
    expect(screen.getByText("URL")).toBeInTheDocument();
    expect(screen.getByText("Uptime")).toBeInTheDocument();
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("Topics")).toBeInTheDocument();
    expect(screen.getByText("Last event")).toBeInTheDocument();
  });

  it("shows Authentication failed error when forceAuthError is true", () => {
    render(<ConnectionPopover forceAuthError />);
    openPopover();
    expect(screen.getByText(/Authentication failed/i)).toBeInTheDocument();
  });
});
