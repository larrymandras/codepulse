import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: new Proxy({}, {
    get: () => new Proxy({}, { get: () => "mock-fn-ref" }),
  }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import { useQuery } from "convex/react";
const mockUseQuery = vi.mocked(useQuery);

import Skills from "../Skills";

const MOCK_SKILLS = [
  { _id: "1", name: "legal-nda", description: "Generate NDAs", useCount: 5, discoveredAt: 1000 },
  { _id: "2", name: "legal-review", description: "Review contracts", useCount: 0, discoveredAt: 1001 },
  { _id: "3", name: "asi-briefing", description: "Daily briefing", useCount: 10, discoveredAt: 1002 },
  { _id: "4", name: "ecosystem-scout", description: "Scout ecosystem", useCount: 1, discoveredAt: 1003 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(MOCK_SKILLS as any);
});

describe("Skills page", () => {
  it("renders page title and skill count", () => {
    render(<Skills />);
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders category headers", () => {
    render(<Skills />);
    expect(screen.getByText("Asi")).toBeInTheDocument();
    expect(screen.getByText("Ecosystem")).toBeInTheDocument();
    expect(screen.getByText("Legal")).toBeInTheDocument();
  });

  it("expands a category on click to reveal skills", () => {
    render(<Skills />);
    expect(screen.queryByText("Nda")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Legal"));
    expect(screen.getByText("Nda")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("shows frequently used section for skills with useCount >= 1", () => {
    render(<Skills />);
    expect(screen.getByText("Frequently Used")).toBeInTheDocument();
    expect(screen.getByText("asi-briefing")).toBeInTheDocument();
    expect(screen.getByText("legal-nda")).toBeInTheDocument();
    expect(screen.getByText("ecosystem-scout")).toBeInTheDocument();
  });

  it("filters skills by search text", () => {
    render(<Skills />);
    const search = screen.getByPlaceholderText("Search skills...");
    fireEvent.change(search, { target: { value: "briefing" } });
    expect(screen.getByText("Asi")).toBeInTheDocument();
    expect(screen.queryByText("Legal")).not.toBeInTheDocument();
    expect(screen.queryByText("Ecosystem")).not.toBeInTheDocument();
  });

  it("auto-expands categories matching search", () => {
    render(<Skills />);
    const search = screen.getByPlaceholderText("Search skills...");
    fireEvent.change(search, { target: { value: "nda" } });
    expect(screen.getByText("Nda")).toBeInTheDocument();
  });

  it("shows empty state when no skills exist", () => {
    mockUseQuery.mockReturnValue([] as any);
    render(<Skills />);
    expect(screen.getByText(/No skills discovered yet/)).toBeInTheDocument();
  });

  it("shows empty search message when no matches", () => {
    render(<Skills />);
    const search = screen.getByPlaceholderText("Search skills...");
    fireEvent.change(search, { target: { value: "zzzznotfound" } });
    expect(screen.getByText(/No skills match your search/)).toBeInTheDocument();
  });

  it("navigates to chat with skill param on skill launch", () => {
    render(<Skills />);
    fireEvent.click(screen.getByText("Legal"));
    fireEvent.click(screen.getByText("Nda"));
    expect(mockNavigate).toHaveBeenCalledWith("/chat?skill=legal-nda");
  });
});
