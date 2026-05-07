import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock checkHealth so no network calls are made in tests
vi.mock("@/lib/openDesignApi", () => ({
  checkHealth: vi.fn(() => Promise.resolve({ status: "ok" })),
  importClaudeDesign: vi.fn(),
}));

// Mock Convex hooks — DesignStudio uses useDesignProjects (useQuery) and useAction
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useAction: vi.fn(() => vi.fn()),
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock useDesignProjects hook
vi.mock("@/hooks/useDesignProjects", () => ({
  useDesignProjects: vi.fn(() => []),
}));

// Lazy-load friendly import
import DesignStudio from "./DesignStudio";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DesignStudio page", () => {
  it("renders without crashing at /design-studio route", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/design-studio"]}>
        <DesignStudio />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("shows Embedded Studio and Native UI tabs", () => {
    render(
      <MemoryRouter>
        <DesignStudio />
      </MemoryRouter>
    );
    expect(screen.getByRole("tab", { name: "Embedded Studio" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Native UI" })).toBeInTheDocument();
  });

  it("shows DaemonStatusBadge in page header", () => {
    render(
      <MemoryRouter>
        <DesignStudio />
      </MemoryRouter>
    );
    // DaemonStatusBadge starts in "connecting" state and shows "Connecting" text
    expect(screen.getByText("Connecting")).toBeInTheDocument();
  });

  it("shows Import ZIP button in page header", () => {
    render(
      <MemoryRouter>
        <DesignStudio />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: "Import ZIP" })).toBeInTheDocument();
  });
});
