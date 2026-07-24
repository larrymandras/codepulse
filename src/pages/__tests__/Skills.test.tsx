import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

const mockRecordLaunch = vi.fn().mockResolvedValue(undefined);
const mockUpdateOverride = vi.fn().mockResolvedValue(undefined);
const mockUpdateCat = vi.fn().mockResolvedValue(undefined);
const mockCreateCat = vi.fn().mockResolvedValue(undefined);
const mockDeleteCat = vi.fn().mockResolvedValue(undefined);
const mockBulkAccept = vi.fn().mockResolvedValue(undefined);
const mockSeedAll = vi.fn().mockResolvedValue(undefined);
// Plan 100-04: handleDropOnScope's direct-enqueue branch and the page-level
// MoveToProjectDialog stub both resolve api.forge.enqueueLifecycle to this
// one spy, so the integration drop tests below can assert call args/absence.
const mockEnqueueLifecycle = vi.fn().mockResolvedValue(undefined);
const mockToggleFav = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn((ref: string) => {
    if (ref === "mock-recordSkillLaunch") return mockRecordLaunch;
    if (ref === "mock-toggleFavorite") return mockToggleFav;
    if (ref === "mock-updateSkillOverride") return mockUpdateOverride;
    if (ref === "mock-updateCategory") return mockUpdateCat;
    if (ref === "mock-createCategory") return mockCreateCat;
    if (ref === "mock-deleteCategory") return mockDeleteCat;
    if (ref === "mock-bulkAcceptAutoAssigned") return mockBulkAccept;
    if (ref === "mock-seedExistingSkills") return mockSeedAll;
    if (ref === "mock-enqueueLifecycle") return mockEnqueueLifecycle;
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
      toggleFavorite: "mock-toggleFavorite",
    },
    registry: {
      recordSkillLaunch: "mock-recordSkillLaunch",
    },
    // Phase 98: SkillRow now always renders SkillLifecycleMenu, which reads
    // api.forge.* (host list, lifecycle commands, enqueueLifecycle) via the
    // real useForgeHostsRaw/useLifecycleCommands hooks. Stub these refs so
    // that generic useQuery mock below can recognize and no-op them — the
    // menu's own behavior is covered by SkillLifecycleMenu.test.tsx.
    forge: {
      listHosts: "mock-listHosts",
      listLifecycleCommands: "mock-listLifecycleCommands",
      listWorkspaces: "mock-listWorkspaces",
      enqueueLifecycle: "mock-enqueueLifecycle",
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

// Phase 99 Plan 06: Skills.tsx now mounts SkillLaunchProvider, which renders
// the one page-level ForgeLaunchModal. Stub it to a lightweight marker (its
// own behavior is covered by ForgeLaunchModal.test.tsx/SkillLaunchProvider.
// test.tsx) so this suite doesn't pull in the modal's own forge queries.
vi.mock("@/components/forge/ForgeLaunchModal", () => ({
  ForgeLaunchModal: (props: { open: boolean }) => (
    <div data-testid="forge-modal-stub" data-open={String(props.open)} />
  ),
}));

// IntakeModal talks to api.forge.* internally; stub it — its behavior is
// covered by IntakeModal.test.tsx. The feed hook is stubbed so this suite
// stays isolated from api.forge queries.
vi.mock("@/components/skills/IntakeModal", () => ({
  IntakeModal: () => null,
}));

// The page-level MoveToProjectDialog (Plan 100-04) is stubbed to a marker div
// — its own workspace-picker behavior is covered by MoveToProjectDialog.test.
// tsx. This suite only needs to assert Skills.tsx opened it (or didn't) and
// with which skillName/sourceOrigin, without pulling in its own Convex
// listWorkspaces query / Radix Select internals.
vi.mock("@/components/skills/MoveToProjectDialog", () => ({
  MoveToProjectDialog: (props: {
    open: boolean;
    skillName: string;
    sourceOrigin: string;
  }) => (
    <div
      data-testid="move-to-project-dialog-stub"
      data-open={String(props.open)}
      data-skill={props.skillName}
      data-source={props.sourceOrigin}
    />
  ),
}));
vi.mock("@/hooks/useIntakeFeed", () => ({
  useIntakeFeed: () => ({
    rows: [],
    isLoading: false,
    activeCount: 0,
    labelFor: () => "",
    handleEnqueued: vi.fn(),
    handleEnqueueFailed: vi.fn(),
  }),
  useCountdownNow: () => 0,
  formatCountdown: () => "0:00",
}));

import { useQuery } from "convex/react";
const mockUseQuery = vi.mocked(useQuery);

import Skills from "../Skills";
import { DORMANT_ORIGIN } from "@/lib/skills";

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
    favorite: false,
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
    favorite: false,
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
    favorite: false,
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
    favorite: false,
    useCount: 0,
    discoveredAt: 1003,
  },
];

const MOCK_WITH_DORMANT = [
  ...MOCK_ENRICHED_SKILLS,
  {
    _id: "s5",
    name: "cold-tool",
    displayName: "Cold Tool",
    description: "A dormant skill",
    categoryName: null as string | null,
    categoryDisplayName: null as string | null,
    categoryIcon: "⚡",
    categoryColor: "gray",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: false,
    favorite: false,
    useCount: 0,
    discoveredAt: 1004,
    origins: [DORMANT_ORIGIN],
  },
];

// Plan 100-04 integration drop-matrix fixtures — one skill per resolveScopeDrop
// branch under test. `categoryName: "legal"` so needsSeed never trips (MOCK_
// CATEGORIES already declares that category).
const DROP_TEST_SKILLS = [
  {
    _id: "d1",
    name: "active-global-skill",
    displayName: "Active Global Skill",
    description: "",
    categoryName: "legal",
    categoryDisplayName: "Legal",
    categoryIcon: "⚖️",
    categoryColor: "red",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: false,
    favorite: false,
    useCount: 0,
    discoveredAt: 2001,
    origins: ["claude-code"],
  },
  {
    _id: "d2",
    name: "active-project-skill",
    displayName: "Active Project Skill",
    description: "",
    categoryName: "legal",
    categoryDisplayName: "Legal",
    categoryIcon: "⚖️",
    categoryColor: "red",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: false,
    favorite: false,
    useCount: 0,
    discoveredAt: 2002,
    origins: ["claude-code:project:abc1234"],
  },
  {
    _id: "d3",
    name: "dormant-skill",
    displayName: "Dormant Skill",
    description: "",
    categoryName: null as string | null,
    categoryDisplayName: null as string | null,
    categoryIcon: "⚡",
    categoryColor: "gray",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: false,
    favorite: false,
    useCount: 0,
    discoveredAt: 2003,
    origins: [DORMANT_ORIGIN],
  },
  {
    _id: "d4",
    name: "multi-scope-skill",
    displayName: "Multi Scope Skill",
    description: "",
    categoryName: "legal",
    categoryDisplayName: "Legal",
    categoryIcon: "⚖️",
    categoryColor: "red",
    overrideDescription: null,
    hidden: false,
    isAutoAssigned: false,
    favorite: false,
    useCount: 0,
    discoveredAt: 2004,
    origins: ["claude-code", "claude-code:project:abc1234"],
  },
];

function setupMocks(
  // widened: MOCK_WITH_UNCATEGORIZED has `categoryName: string | null`, which the
  // narrower inferred type of MOCK_ENRICHED_SKILLS rejects.
  skills: readonly Record<string, unknown>[] = MOCK_ENRICHED_SKILLS,
  categories: readonly Record<string, unknown>[] = MOCK_CATEGORIES,
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
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  setupMocks();
});

// The recomposed page renders each category's display name twice — once as a
// CategoryGrid nav item in the left rail, once as an AllSkillsOverview section
// header — so a bare getByText("Legal") is ambiguous. Scope to the nav item.
function getCategoryNavItem(displayName: string) {
  const items = screen.getAllByTestId("category-nav-item");
  const item = items.find((el) => within(el).queryByText(displayName));
  if (!item) throw new Error(`Category nav item "${displayName}" not found`);
  return item;
}

describe("Skills page", () => {
  it("renders page title", () => {
    render(<Skills />);
    expect(screen.getByText("Skills")).toBeInTheDocument();
  });

  it("renders category cards on default view", () => {
    render(<Skills />);
    expect(getCategoryNavItem("Legal")).toBeInTheDocument();
    expect(getCategoryNavItem("Project Management")).toBeInTheDocument();
  });

  it("shows skill counts on category cards", () => {
    render(<Skills />);
    expect(within(getCategoryNavItem("Legal")).getByText("2")).toBeInTheDocument();
    expect(within(getCategoryNavItem("Project Management")).getByText("1")).toBeInTheDocument();
  });

  it("shows New Category button", () => {
    render(<Skills />);
    expect(screen.getByText("New Category")).toBeInTheDocument();
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
    fireEvent.click(getCategoryNavItem("Legal"));
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
    expect(screen.getByText("Contract Review")).toBeInTheDocument();
    expect(screen.queryByText("Plan Phase")).not.toBeInTheDocument();
  });

  it("goes back to category grid from drill-in", () => {
    render(<Skills />);
    fireEvent.click(getCategoryNavItem("Legal"));
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Back"));
    expect(screen.getByText("New Category")).toBeInTheDocument();
  });

  it("shows seed CTA when skills exist but no categories", () => {
    setupMocks(MOCK_ENRICHED_SKILLS, [], 0);
    render(<Skills />);
    expect(screen.getByText(/no categories set up yet/)).toBeInTheDocument();
    expect(screen.getByText("Auto-Classify")).toBeInTheDocument();
    expect(screen.getByText("Set Up Manually")).toBeInTheDocument();
  });

  it("banner counts the skills REVIEW will actually show, not the countAutoAssigned query", () => {
    // Changed 2026-07-09. The banner used to read `api.skillCategories.countAutoAssigned`,
    // which counts overrides *including hidden ones*, so it could advertise a number the
    // review drawer would never display. It now derives from the same list the drawer
    // renders. MOCK_WITH_UNCATEGORIZED adds exactly one isAutoAssigned && !hidden skill;
    // the stale `3` below is now ignored on purpose.
    setupMocks(MOCK_WITH_UNCATEGORIZED, MOCK_CATEGORIES, 3);
    render(<Skills />);
    expect(screen.getByText(/1 new skill auto-categorized/i)).toBeInTheDocument();
  });

  it("renders the Command Deck with most-used chips", () => {
    render(<Skills />);
    expect(screen.getByText("Command Deck")).toBeInTheDocument();
    // gsd-plan-phase has useCount 10 — its invocation chip must be present.
    expect(screen.getByText("/gsd-plan-phase")).toBeInTheDocument();
  });

  it("has no inline Open in Chat row action (retired no-op, D-13/Pitfall 1-2) — Run lives on the row's ⋯ menu instead", () => {
    render(<Skills />);
    fireEvent.click(getCategoryNavItem("Legal"));
    expect(screen.queryByLabelText("Open legal-nda in Chat")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /Skill actions for/i }).length
    ).toBeGreaterThan(0);
  });

  it("filters skills by search in drill-in view", () => {
    render(<Skills />);
    fireEvent.click(getCategoryNavItem("Legal"));
    const searchInput = screen.getByPlaceholderText("Filter skills...");
    fireEvent.change(searchInput, { target: { value: "nda" } });
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
    expect(screen.queryByText("Contract Review")).not.toBeInTheDocument();
  });

  it("global search filters the overview across all categories", () => {
    render(<Skills />);
    const searchInput = screen.getByPlaceholderText("Filter skills...");
    fireEvent.change(searchInput, { target: { value: "plan" } });
    expect(screen.getByText("Plan Phase")).toBeInTheDocument();
    expect(screen.queryByText("NDA Generator")).not.toBeInTheDocument();
  });

  it("scope chips narrow the overview by origin (replaces the origin dropdown)", () => {
    const mockWithOrigins = MOCK_ENRICHED_SKILLS.map((s) => ({
      ...s,
      origins: s.name === "legal-review" ? ["claude-code:project:abc"] : ["claude-code"],
    }));
    setupMocks(mockWithOrigins);
    render(<Skills />);

    // Project chip → only the project-origin skill remains in the overview.
    fireEvent.click(screen.getByTestId("skill-chip-project"));
    expect(screen.getByText("Contract Review")).toBeInTheDocument();
    expect(screen.queryByText("NDA Generator")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan Phase")).not.toBeInTheDocument();

    // Global chip → the project skill drops out, global skills return.
    fireEvent.click(screen.getByTestId("skill-chip-global"));
    expect(screen.queryByText("Contract Review")).not.toBeInTheDocument();
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
  });

  it("the Unused smart-view chip shows only never-run, non-dormant skills", () => {
    render(<Skills />);
    fireEvent.click(screen.getByTestId("skill-chip-unused"));
    expect(screen.getByTestId("skill-chip-unused")).toHaveAttribute("aria-pressed", "true");
    // Contract Review (useCount 0, not dormant) stays; used skills are filtered out.
    expect(screen.getByText("Contract Review")).toBeInTheDocument();
    expect(screen.queryByText("NDA Generator")).not.toBeInTheDocument(); // useCount 5
    expect(screen.queryByText("Plan Phase")).not.toBeInTheDocument(); // useCount 10
  });

  describe("bulk select (increment 3)", () => {
    it("selecting a row reveals the bulk bar and bulk-favorites the selection", () => {
      render(<Skills />);
      expect(screen.queryByRole("toolbar", { name: /bulk actions/i })).toBeNull();
      fireEvent.click(screen.getByRole("checkbox", { name: /select legal-nda/i }));
      expect(screen.getByText("1 selected")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /^favorite$/i }));
      expect(mockToggleFav).toHaveBeenCalledWith({ skillName: "legal-nda" });
    });

    it("bulk Archive requires a confirm before enqueuing archive commands", () => {
      const mocked = MOCK_ENRICHED_SKILLS.map((s) => ({ ...s, origins: ["claude-code"] }));
      setupMocks(mocked);
      render(<Skills />);
      fireEvent.click(screen.getByRole("checkbox", { name: /select legal-nda/i }));
      fireEvent.click(screen.getByRole("button", { name: /^archive$/i }));
      // Confirm dialog appears; nothing enqueued yet.
      expect(screen.getByText(/archive 1 skill to cold storage/i)).toBeInTheDocument();
      expect(mockEnqueueLifecycle).not.toHaveBeenCalled();
      // Confirm → the archive command fires for the selected skill only.
      fireEvent.click(screen.getByRole("button", { name: /^archive 1$/i }));
      expect(mockEnqueueLifecycle).toHaveBeenCalledWith(
        expect.objectContaining({
          skillName: "legal-nda",
          action: "archive",
          destination: "cold",
        })
      );
    });
  });

  it("copy is the primary action on a drilled-in skill row, and does not record a launch (D-13)", async () => {
    render(<Skills />);
    fireEvent.click(getCategoryNavItem("Legal"));
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
    expect(mockRecordLaunch).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  describe("Cold Storage rail entry", () => {
    // Scoped to the nav-toggle testid, not bare text/role — Plan 100-03's
    // ScopeRail also renders a "Cold Storage" scope entry (always visible,
    // fixed 3-entry rail) immediately below Categories, so a bare
    // getByRole("button", { name: /cold storage/i }) is now ambiguous.
    it("is absent when no dormant skills exist", () => {
      render(<Skills />);
      expect(screen.queryByTestId("cold-storage-nav-toggle")).not.toBeInTheDocument();
    });

    it("appears with the dormant skill count when a dormant skill exists", () => {
      setupMocks(MOCK_WITH_DORMANT as any);
      render(<Skills />);
      const coldStorageButton = screen.getByTestId("cold-storage-nav-toggle");
      expect(within(coldStorageButton).getByText("1")).toBeInTheDocument();
    });

    it("shows the dormant skill row and explainer, and hides overview content, when clicked", () => {
      setupMocks(MOCK_WITH_DORMANT as any);
      render(<Skills />);
      fireEvent.click(screen.getByTestId("cold-storage-nav-toggle"));
      expect(screen.getByText("Cold Tool")).toBeInTheDocument();
      expect(
        screen.getByText(/Dormant skills live on disk but are not loaded/i)
      ).toBeInTheDocument();
      expect(screen.queryByText("NDA Generator")).not.toBeInTheDocument();
    });

    it("leaves cold storage view when a rail category is clicked", () => {
      setupMocks(MOCK_WITH_DORMANT as any);
      render(<Skills />);
      fireEvent.click(screen.getByTestId("cold-storage-nav-toggle"));
      expect(screen.getByText("Cold Tool")).toBeInTheDocument();
      fireEvent.click(getCategoryNavItem("Legal"));
      expect(screen.getByText("NDA Generator")).toBeInTheDocument();
      expect(screen.queryByText("Cold Tool")).not.toBeInTheDocument();
    });

    it("a SHADOWED skill (dormant copy + active copy) still surfaces in Cold Storage (98-REVIEW WR-04)", () => {
      // The registry merges every origin for a name into ONE row — filtering
      // by isDormant hid the cold copy of any name that was also active,
      // making the archive-collision remediation ('delete it first')
      // unreachable. hasDormantCopy keeps it visible.
      const MOCK_WITH_SHADOWED = [
        ...MOCK_ENRICHED_SKILLS,
        {
          _id: "s6",
          name: "shadowed-tool",
          displayName: "Shadowed Tool",
          description: "Active AND dormant",
          categoryName: null as string | null,
          categoryDisplayName: null as string | null,
          categoryIcon: "⚡",
          categoryColor: "gray",
          overrideDescription: null,
          hidden: false,
          isAutoAssigned: false,
          favorite: false,
          useCount: 0,
          discoveredAt: 1005,
          origins: [DORMANT_ORIGIN, "claude-code"],
        },
      ];
      setupMocks(MOCK_WITH_SHADOWED as any);
      render(<Skills />);
      const coldStorageButton = screen.getByTestId("cold-storage-nav-toggle");
      expect(within(coldStorageButton).getByText("1")).toBeInTheDocument();
      fireEvent.click(coldStorageButton);
      expect(screen.getByText("Shadowed Tool")).toBeInTheDocument();
    });
  });

  // Plan 100-04: integration drop tests over the ScopeRail wiring —
  // handleDropOnScope dispatching through resolveScopeDrop (D-02). Fires a
  // native drop event directly on a `[data-scope]` entry with a plain-object
  // dataTransfer (mirrors ScopeRail.test.tsx's own `fireEvent.drop` convention)
  // — no drag-start simulation needed, since handleDropOnScope resolves the
  // skill from `dataTransfer.getData` alone, not from the dragging-skill
  // context (that context only drives ScopeRail's own hover highlight).
  describe("Scope drag matrix (Plan 100-04)", () => {
    function getScopeEntry(container: HTMLElement, scope: string) {
      const el = container.querySelector(`[data-testid="scope-rail-entry"][data-scope="${scope}"]`);
      if (!el) throw new Error(`Scope entry "${scope}" not found`);
      return el;
    }

    function dropSkillOnScope(container: HTMLElement, scope: string, skillName: string) {
      const entry = getScopeEntry(container, scope);
      fireEvent.drop(entry, { dataTransfer: { getData: () => skillName } });
    }

    beforeEach(() => {
      setupMocks(DROP_TEST_SKILLS as any);
    });

    it("drop active-global skill onto Cold -> enqueueLifecycle(archive, claude-code, cold); no dialog", () => {
      const { container } = render(<Skills />);
      dropSkillOnScope(container, "cold", "active-global-skill");

      expect(mockEnqueueLifecycle).toHaveBeenCalledTimes(1);
      expect(mockEnqueueLifecycle.mock.calls[0][0]).toMatchObject({
        action: "archive",
        sourceOrigin: "claude-code",
        destination: "cold",
        skillName: "active-global-skill",
      });
      expect(
        screen.getByTestId("move-to-project-dialog-stub")
      ).toHaveAttribute("data-open", "false");
    });

    it("drop active-project skill onto Global -> enqueueLifecycle(move, project origin, global)", () => {
      const { container } = render(<Skills />);
      dropSkillOnScope(container, "global", "active-project-skill");

      expect(mockEnqueueLifecycle).toHaveBeenCalledTimes(1);
      expect(mockEnqueueLifecycle.mock.calls[0][0]).toMatchObject({
        action: "move",
        sourceOrigin: "claude-code:project:abc1234",
        destination: "global",
        skillName: "active-project-skill",
      });
    });

    it("drop active-global skill onto Project -> opens MoveToProjectDialog, no enqueue at drop time (Pitfall 2)", () => {
      const { container } = render(<Skills />);
      dropSkillOnScope(container, "project", "active-global-skill");

      expect(mockEnqueueLifecycle).not.toHaveBeenCalled();
      const dialogStub = screen.getByTestId("move-to-project-dialog-stub");
      expect(dialogStub).toHaveAttribute("data-open", "true");
      expect(dialogStub).toHaveAttribute("data-skill", "active-global-skill");
      expect(dialogStub).toHaveAttribute("data-source", "claude-code");
    });

    it("drop dormant skill onto Project -> invalid, no enqueue, no dialog", () => {
      const { container } = render(<Skills />);
      dropSkillOnScope(container, "project", "dormant-skill");

      expect(mockEnqueueLifecycle).not.toHaveBeenCalled();
      expect(
        screen.getByTestId("move-to-project-dialog-stub")
      ).toHaveAttribute("data-open", "false");
    });

    it("drop multi-scope skill onto any lane -> invalid, no enqueue", () => {
      const { container } = render(<Skills />);
      dropSkillOnScope(container, "cold", "multi-scope-skill");

      expect(mockEnqueueLifecycle).not.toHaveBeenCalled();
    });

    it("drop active-global skill onto Global (own scope) -> noop, no enqueue", () => {
      const { container } = render(<Skills />);
      dropSkillOnScope(container, "global", "active-global-skill");

      expect(mockEnqueueLifecycle).not.toHaveBeenCalled();
    });
  });
});
