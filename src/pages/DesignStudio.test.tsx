import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock checkHealth so no network calls are made in tests
vi.mock("@/lib/openDesignApi", () => ({
  checkHealth: vi.fn(() => Promise.resolve({ status: "ok" })),
  importClaudeDesign: vi.fn(),
}));

// Mock Convex hooks — DesignStudio uses useDesignProjects (useQuery) and useAction
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useAction: vi.fn(() => vi.fn(() => Promise.resolve())),
  useMutation: vi.fn(() => vi.fn()),
}));

// Mock useDesignProjects hook
vi.mock("@/hooks/useDesignProjects", () => ({
  useDesignProjects: vi.fn(() => []),
}));

// Mock DaemonStatusBadge and IframeEmbed — both fire async state updates via
// checkHealth polling after mount. Synchronous stubs eliminate those act(...)
// warnings. These components have their own unit tests.
vi.mock("@/components/design-studio/DaemonStatusBadge", () => ({
  default: () => <span>Connecting</span>,
}));
vi.mock("@/components/design-studio/IframeEmbed", () => ({
  default: () => <div data-testid="iframe-embed" />,
}));

// Lazy-load friendly import
import DesignStudio from "./DesignStudio";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DesignStudio page", () => {
  it("renders without crashing at /design-studio route", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/design-studio"]}>
        <DesignStudio />
      </MemoryRouter>
    );
    await waitFor(() => expect(container.firstChild).toBeTruthy());
  });

  it("shows Embedded Studio and Native UI tabs", async () => {
    render(
      <MemoryRouter>
        <DesignStudio />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Embedded Studio" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Native UI" })).toBeInTheDocument();
    });
  });

  it("shows DaemonStatusBadge in page header", async () => {
    render(
      <MemoryRouter>
        <DesignStudio />
      </MemoryRouter>
    );
    // DaemonStatusBadge is mocked to render "Connecting" synchronously
    await waitFor(() => expect(screen.getByText("Connecting")).toBeInTheDocument());
  });

  it("shows Import ZIP button in page header", async () => {
    render(
      <MemoryRouter>
        <DesignStudio />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Import ZIP" })).toBeInTheDocument()
    );
  });

  it("bug_006_logs_sync_errors_instead_of_swallowing", async () => {
    const { useAction } = await import("convex/react");
    const syncError = new Error("Sync failed");
    (useAction as ReturnType<typeof vi.fn>).mockReturnValue(
      vi.fn(() => Promise.reject(syncError))
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <DesignStudio />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("sync"),
        expect.anything()
      );
    });

    consoleSpy.mockRestore();
  });
});
