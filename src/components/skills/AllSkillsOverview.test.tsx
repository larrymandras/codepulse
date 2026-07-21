import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllSkillsOverview } from "./AllSkillsOverview";

// Phase 98: SkillRow now always renders SkillLifecycleMenu, which calls
// useQuery/useMutation (host list, lifecycle commands, enqueueLifecycle) —
// stub convex/react so this suite doesn't need a real ConvexProvider. The
// menu's own behavior is covered by SkillLifecycleMenu.test.tsx.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

const categories = [
  { name: "legal", displayName: "Legal", icon: "⚖️", color: "red" },
  { name: "gsd", displayName: "Project Management", icon: "📋", color: "indigo" },
];

const mk = (name: string, categoryName: string | null, extra: Record<string, unknown> = {}) => ({
  name,
  displayName: name,
  description: `${name} desc`,
  overrideDescription: null,
  favorite: false,
  origins: ["claude-code"],
  categoryName,
  ...extra,
});

const handlers = () => ({
  onSelectCategory: vi.fn(),
  onRecordUse: vi.fn(),
  onOpenInChat: vi.fn(),
  onEdit: vi.fn(),
  onToggleFavorite: vi.fn(),
});

describe("AllSkillsOverview", () => {
  it("groups by category (largest first) with uncategorized last", () => {
    const skills = [
      mk("g1", "gsd"), mk("g2", "gsd"),
      mk("l1", "legal"),
      mk("u1", null),
    ];
    render(<AllSkillsOverview skills={skills} categories={categories} {...handlers()} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toContain("Project Management");
    expect(headings[1]).toContain("Legal");
    expect(headings[2]).toContain("Uncategorized");
    expect(screen.getByText("Drag onto a category to assign")).toBeInTheDocument();
  });

  it("clicking a group header drills into that category", () => {
    const h = handlers();
    render(<AllSkillsOverview skills={[mk("l1", "legal")]} categories={categories} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /open legal category/i }));
    expect(h.onSelectCategory).toHaveBeenCalledWith("legal");
  });

  it("collapses a group beyond 8 rows behind a Show all toggle", () => {
    const skills = Array.from({ length: 11 }, (_, i) => mk(`g${i}`, "gsd"));
    render(<AllSkillsOverview skills={skills} categories={categories} {...handlers()} />);
    expect(screen.getAllByText(/desc$/)).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: /show all \(11\)/i }));
    expect(screen.getAllByText(/desc$/)).toHaveLength(11);
    fireEvent.click(screen.getByRole("button", { name: /show less/i }));
    expect(screen.getAllByText(/desc$/)).toHaveLength(8);
  });

  it("renders the terminal empty state when no skills match", () => {
    render(<AllSkillsOverview skills={[]} categories={categories} {...handlers()} />);
    expect(screen.getByText("[ NO SKILLS MATCH ]")).toBeInTheDocument();
  });
});
