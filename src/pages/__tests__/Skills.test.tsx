import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockRecordLaunch = vi.fn().mockResolvedValue(undefined);
const mockUpdateOverride = vi.fn().mockResolvedValue(undefined);
const mockUpdateCat = vi.fn().mockResolvedValue(undefined);
const mockCreateCat = vi.fn().mockResolvedValue(undefined);
const mockDeleteCat = vi.fn().mockResolvedValue(undefined);
const mockBulkAccept = vi.fn().mockResolvedValue(undefined);
const mockSeedAll = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn((ref: string) => {
    if (ref === "mock-recordSkillLaunch") return mockRecordLaunch;
    if (ref === "mock-updateSkillOverride") return mockUpdateOverride;
    if (ref === "mock-updateCategory") return mockUpdateCat;
    if (ref === "mock-createCategory") return mockCreateCat;
    if (ref === "mock-deleteCategory") return mockDeleteCat;
    if (ref === "mock-bulkAcceptAutoAssigned") return mockBulkAccept;
    if (ref === "mock-seedExistingSkills") return mockSeedAll;
    return vi.fn().mockResolvedValue(undefined);
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    skillCategories: {
      getSkillsWithOverrides: "mock-getSkillsWithOverrides",
      listCategories: "mock-listCategories",
      countAutoAssigned: "mock-countAutoAssigned",
      updateSkillOverride: "mock-updateSkillOverride",
      updateCategory: "mock-updateCategory",
      createCategory: "mock-createCategory",
      deleteCategory: "mock-deleteCategory",
      bulkAcceptAutoAssigned: "mock-bulkAcceptAutoAssigned",
      seedExistingSkills: "mock-seedExistingSkills",
    },
    registry: {
      recordSkillLaunch: "mock-recordSkillLaunch",
    },
  },
}));

vi.mock("../../../convex/_generated/dataModel", () => ({
  Doc: {},
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import { useQuery } from "convex/react";
const mockUseQuery = vi.mocked(useQuery);

import Skills from "../Skills";

const MOCK_CATEGORIES = [
  {
    _id: "cat1",
    name: "legal",
    displayName: "Legal",
    icon: "⚖️",
    color: "red",
    description: "Contracts and compliance",
    sortOrder: 0,
    _creationTime: 0,
  },
  {
    _id: "cat2",
    name: "gsd",
    displayName: "Project Management",
    icon: "📋",
    color: "indigo",
    description: "Planning and execution",
    sortOrder: 1,
    _creationTime: 0,
  },
];

const MOCK_ENRICHED_SKILLS = [
  {
    _id: "s1",
    name: "legal-nda",
    displayName: "NDA Generator",
    description: "Generate NDAs",
    categoryName: "legal",
    categoryDisplayName: "Legal",
    categoryIcon: "⚖️",
    categoryColor: "red",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: false,
    useCount: 5,
    discoveredAt: 1000,
  },
  {
    _id: "s2",
    name: "legal-review",
    displayName: "Contract Review",
    description: "Review contracts",
    categoryName: "legal",
    categoryDisplayName: "Legal",
    categoryIcon: "⚖️",
    categoryColor: "red",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: false,
    useCount: 0,
    discoveredAt: 1001,
  },
  {
    _id: "s3",
    name: "gsd-plan-phase",
    displayName: "Plan Phase",
    description: "Create detailed plans",
    categoryName: "gsd",
    categoryDisplayName: "Project Management",
    categoryIcon: "📋",
    categoryColor: "indigo",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: false,
    useCount: 10,
    discoveredAt: 1002,
  },
];

function setupMocks(
  skills = MOCK_ENRICHED_SKILLS,
  categories = MOCK_CATEGORIES,
  autoAssigned = 0,
) {
  (mockUseQuery as any).mockImplementation((ref: any) => {
    if (ref === "mock-getSkillsWithOverrides") return skills as any;
    if (ref === "mock-listCategories") return categories as any;
    if (ref === "mock-countAutoAssigned") return autoAssigned as any;
    return undefined;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe("Skills page", () => {
  it("renders page title", () => {
    render(<Skills />);
    expect(screen.getByText("Skills")).toBeInTheDocument();
  });

  it("renders category tabs", () => {
    render(<Skills />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("⚖️ Legal")).toBeInTheDocument();
    expect(screen.getByText("📋 Project Management")).toBeInTheDocument();
  });

  it("renders skill cards in grid view", () => {
    render(<Skills />);
    expect(screen.getAllByText("NDA Generator").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Contract Review")).toBeInTheDocument();
    expect(screen.getAllByText("Plan Phase").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by category when tab clicked", () => {
    const { container } = render(<Skills />);
    fireEvent.click(screen.getByText("⚖️ Legal"));
    const gridCards = container.querySelectorAll("[data-skill]");
    const gridNames = Array.from(gridCards).map((c) => c.getAttribute("data-skill"));
    expect(gridNames).toContain("legal-nda");
    expect(gridNames).toContain("legal-review");
    expect(gridNames).not.toContain("gsd-plan-phase");
  });

  it("filters skills by search text", () => {
    const { container } = render(<Skills />);
    const search = screen.getByPlaceholderText("Search skills...");
    fireEvent.change(search, { target: { value: "nda" } });
    const gridCards = container.querySelectorAll("[data-skill]");
    const gridNames = Array.from(gridCards).map((c) => c.getAttribute("data-skill"));
    expect(gridNames).toContain("legal-nda");
    expect(gridNames).not.toContain("legal-review");
    expect(gridNames).not.toContain("gsd-plan-phase");
  });

  it("shows seed CTA when skills exist but no categories", () => {
    setupMocks(MOCK_ENRICHED_SKILLS, [], 0);
    render(<Skills />);
    expect(screen.getByText(/no categories set up yet/)).toBeInTheDocument();
    expect(screen.getByText("Auto-Classify")).toBeInTheDocument();
    expect(screen.getByText("Set Up Manually")).toBeInTheDocument();
  });

  it("shows new skills banner when auto-assigned count > 0", () => {
    setupMocks(MOCK_ENRICHED_SKILLS, MOCK_CATEGORIES, 3);
    render(<Skills />);
    expect(screen.getByText(/3 new skills auto-categorized/)).toBeInTheDocument();
  });

  it("shows frequently used skills", () => {
    render(<Skills />);
    expect(screen.getByText("Frequently Used")).toBeInTheDocument();
  });

  it("navigates to chat on skill launch", async () => {
    const { container } = render(<Skills />);
    const gridCard = container.querySelector('[data-skill="legal-nda"]');
    expect(gridCard).toBeTruthy();
    fireEvent.click(gridCard!);
    expect(mockRecordLaunch).toHaveBeenCalledWith({ name: "legal-nda" });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat?skill=legal-nda");
    });
  });
});
