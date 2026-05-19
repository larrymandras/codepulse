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

const MOCK_WITH_UNCATEGORIZED = [
  ...MOCK_ENRICHED_SKILLS,
  {
    _id: "s4",
    name: "misc-tool",
    displayName: "Misc Tool",
    description: "Unassigned skill",
    categoryName: null as string | null,
    categoryDisplayName: null as string | null,
    categoryIcon: "⚡",
    categoryColor: "gray",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: true,
    useCount: 0,
    discoveredAt: 1003,
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

  it("renders category cards on default view", () => {
    render(<Skills />);
    expect(screen.getByText("Legal")).toBeInTheDocument();
    expect(screen.getByText("Project Management")).toBeInTheDocument();
  });

  it("shows skill counts on category cards", () => {
    render(<Skills />);
    expect(screen.getByText("2 skills")).toBeInTheDocument();
    expect(screen.getByText("1 skill")).toBeInTheDocument();
  });

  it("shows Add Category card", () => {
    render(<Skills />);
    expect(screen.getByText("Add Category")).toBeInTheDocument();
  });

  it("shows uncategorized section with separator when uncategorized skills exist", () => {
    setupMocks(MOCK_WITH_UNCATEGORIZED as any);
    render(<Skills />);
    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
    expect(screen.getByText("Misc Tool")).toBeInTheDocument();
    expect(screen.getByText("Drag onto a category to assign")).toBeInTheDocument();
  });

  it("does not show uncategorized section when all skills are categorized", () => {
    render(<Skills />);
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument();
  });

  it("drills into category when card is clicked", () => {
    render(<Skills />);
    fireEvent.click(screen.getByText("Legal"));
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
    expect(screen.getByText("Contract Review")).toBeInTheDocument();
    expect(screen.queryByText("Plan Phase")).not.toBeInTheDocument();
  });

  it("goes back to category grid from drill-in", () => {
    render(<Skills />);
    fireEvent.click(screen.getByText("Legal"));
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Back"));
    expect(screen.getByText("Add Category")).toBeInTheDocument();
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
    render(<Skills />);
    fireEvent.click(screen.getByText("Legal"));
    const launchButtons = screen.getAllByText("Launch");
    fireEvent.click(launchButtons[0]);
    expect(mockRecordLaunch).toHaveBeenCalledWith({ name: "legal-nda" });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat?skill=legal-nda");
    });
  });

  it("filters skills by search in drill-in view", () => {
    render(<Skills />);
    fireEvent.click(screen.getByText("Legal"));
    const searchInput = screen.getByPlaceholderText("Search skills...");
    fireEvent.change(searchInput, { target: { value: "nda" } });
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
    expect(screen.queryByText("Contract Review")).not.toBeInTheDocument();
  });
});
