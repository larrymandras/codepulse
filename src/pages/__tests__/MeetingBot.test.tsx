import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RosterAgent } from "@/hooks/useRosterAgents";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: new Proxy(
    {},
    {
      get: () => new Proxy({}, { get: () => "mock-fn-ref" }),
    }
  ),
}));

vi.mock("@/lib/astridrApi", () => ({
  sendMeetingBot: vi.fn(),
}));

// shadcn Select uses Radix primitives that require a browser-like environment.
// In jsdom the SelectContent portal/scroll behavior is absent — mock the
// Select primitives to expose only what's needed to assert rendered options,
// following the established convention (see ThemeSwitcher.test.tsx).
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-root">{children}</div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="select-trigger">{children}</button>
  ),
  SelectValue: () => <span data-testid="select-value" />,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`select-item-${value}`}>{children}</div>,
}));

// Controllable roster mock — each test sets the returned agents array.
let mockAgents: RosterAgent[] = [];
vi.mock("@/hooks/useRosterAgents", () => ({
  useRosterAgents: () => ({
    agents: mockAgents,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// Import after mocks
import MeetingBot from "../MeetingBot";

function makeAgent(id: string, name: string): RosterAgent {
  return {
    id,
    name,
    tier: "domain",
    active: true,
    budget_fraction: 0,
    status: "active",
  } as RosterAgent;
}

describe("MeetingBot — live roster agent select (D-10/F9)", () => {
  it("renders options from the live roster, not the hardcoded 6 names", () => {
    mockAgents = [makeAgent("odin", "Odin"), makeAgent("thor", "Thor")];

    render(<MeetingBot />);

    expect(screen.getByTestId("select-item-odin")).toBeInTheDocument();
    expect(screen.getByTestId("select-item-thor")).toBeInTheDocument();

    // Previously-hardcoded names must not appear.
    expect(screen.queryByTestId("select-item-hervor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("select-item-gondul")).not.toBeInTheDocument();
    expect(screen.queryByText("Hervor")).not.toBeInTheDocument();
    expect(screen.queryByText("Gondul")).not.toBeInTheDocument();
  });

  it("renders no stale hardcoded names when the roster is empty", () => {
    mockAgents = [];

    render(<MeetingBot />);

    expect(screen.queryByTestId("select-item-hervor")).not.toBeInTheDocument();
    expect(screen.queryByText("Freya")).not.toBeInTheDocument();
    expect(screen.queryByText("Ástríðr")).not.toBeInTheDocument();
    expect(screen.queryByText("Ragnhildr")).not.toBeInTheDocument();
  });
});
