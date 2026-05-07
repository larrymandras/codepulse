import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import SkillPicker from "./SkillPicker";

// Mock the API module
vi.mock("@/lib/openDesignApi", () => ({
  fetchSkills: vi.fn(),
}));

import { fetchSkills } from "@/lib/openDesignApi";
const mockFetchSkills = vi.mocked(fetchSkills);

const MOCK_SKILLS = [
  { id: "skill-1", title: "Web Components", category: "frontend", summary: "Build reusable web components" },
  { id: "skill-2", title: "Data Visualization", category: "analytics", summary: "Create interactive charts" },
  { id: "skill-3", title: "API Design", category: "backend", summary: "Design RESTful APIs" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SkillPicker", () => {
  it("renders skill cards after API fetch", async () => {
    mockFetchSkills.mockResolvedValue(MOCK_SKILLS);

    render(<SkillPicker selectedSkillId={null} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Web Components")).toBeInTheDocument();
      expect(screen.getByText("Data Visualization")).toBeInTheDocument();
      expect(screen.getByText("API Design")).toBeInTheDocument();
    });
  });

  it("filters skills by search text", async () => {
    mockFetchSkills.mockResolvedValue(MOCK_SKILLS);

    render(<SkillPicker selectedSkillId={null} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Web Components")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search \d+ skills\.\.\./);
    fireEvent.change(searchInput, { target: { value: "web" } });

    expect(screen.getByText("Web Components")).toBeInTheDocument();
    expect(screen.queryByText("Data Visualization")).not.toBeInTheDocument();
    expect(screen.queryByText("API Design")).not.toBeInTheDocument();
  });

  it("calls onSelect when skill card clicked", async () => {
    mockFetchSkills.mockResolvedValue(MOCK_SKILLS);
    const onSelect = vi.fn();

    render(<SkillPicker selectedSkillId={null} onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Web Components")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Web Components").closest('[role="radio"]')!);

    expect(onSelect).toHaveBeenCalledWith("skill-1");
  });

  it("shows error state when API fails", async () => {
    mockFetchSkills.mockRejectedValue(new Error("Network error"));

    render(<SkillPicker selectedSkillId={null} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows empty state when search has no matches", async () => {
    mockFetchSkills.mockResolvedValue(MOCK_SKILLS);

    render(<SkillPicker selectedSkillId={null} onSelect={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Web Components")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search \d+ skills\.\.\./);
    fireEvent.change(searchInput, { target: { value: "xyznosuchskill" } });

    expect(screen.getByText("No skills match your search")).toBeInTheDocument();
  });
});
