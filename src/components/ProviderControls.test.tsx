import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProviderControls from "./ProviderControls";
import { useProviderConfig } from "../hooks/useProviderConfig";

// Mock convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock command dispatch
vi.mock("../hooks/useCommandDispatch", () => ({
  useCommandDispatch: vi.fn(() => ({ dispatch: vi.fn(), isConnected: false })),
}));

// Mock provider config hook
vi.mock("../hooks/useProviderConfig", () => ({
  useProviderConfig: vi.fn(() => ({
    configs: [],
    setEnabled: vi.fn(),
    setPriority: vi.fn(),
  })),
}));

describe("ProviderControls", () => {
  it("renders a heading", () => {
    render(<ProviderControls />);
    expect(screen.getByText("Gateway Providers")).toBeTruthy();
  });

  it("shows seed button when configs are empty", () => {
    render(<ProviderControls />);
    expect(screen.getByText("Seed Gateway Defaults")).toBeTruthy();
  });

  it("renders a drag handle per provider when configs exist", () => {
    // Override mock to return configs
    vi.mocked(useProviderConfig).mockReturnValue({
      configs: [
        { provider: "claude-cli", enabled: true, priority: 0, _id: "id1" as any, _creationTime: 0, updatedAt: 0 },
        { provider: "codex", enabled: true, priority: 1, _id: "id2" as any, _creationTime: 0, updatedAt: 0 },
        { provider: "antigravity", enabled: true, priority: 2, _id: "id3" as any, _creationTime: 0, updatedAt: 0 },
        { provider: "claude-sdk", enabled: true, priority: 3, _id: "id4" as any, _creationTime: 0, updatedAt: 0 },
      ],
      setEnabled: vi.fn() as any,
      setPriority: vi.fn() as any,
    });
    render(<ProviderControls />);
    const handles = screen.getAllByLabelText(/Drag to reorder/);
    expect(handles.length).toBeGreaterThanOrEqual(4);
  });
});
