/**
 * Skills page test (Phase 113 Plan 03, D-17) — jsdom render assertions.
 *
 * Covers the Global chip's rendered list + count, proving a plugin-origin
 * skill (`claude-code:plugin`) is included exactly as a personal-origin
 * skill (`claude-code`) is, and that the Project chip's predicate is
 * unaffected. Per the plan, the control (this suite run against the
 * UNMODIFIED page) is executed and its failure captured BEFORE the fix — see
 * 113-03-SUMMARY.md for the verbatim pre-fix output.
 *
 * Harness mirrors Reminders.test.tsx's convex/react + generated-api mocking
 * convention. The filter logic under test (visibleSkills/chipCounts inside
 * Skills.tsx) is kept REAL; only presentational/heavy children that pull
 * their own Convex queries or a portal are stubbed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

// Build a Proxy so `api.skillCategories.getSkillsWithOverrides` etc. resolve
// to a stable, path-describing string ref (Reminders.test.tsx's convention).
// Vitest mocks by RESOLVED module id, so this single mock intercepts every
// import of convex/_generated/api regardless of which file's relative path
// requested it (Skills.tsx, SkillLaunchProvider.tsx, MoveToProjectDialog.tsx…).
function makeApiProxy(path: string[] = []): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "toString" || prop === Symbol.toPrimitive) {
          return () => path.join(".");
        }
        if (typeof prop === "symbol") return undefined;
        return makeApiProxy([...path, prop]);
      },
    }
  );
}

vi.mock("../../convex/_generated/api", () => ({
  api: makeApiProxy(["api"]),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

// SkillLaunchProvider unconditionally mounts this modal (open=false by
// default) — its own hooks would otherwise run regardless of `open`. Mirrors
// SkillLifecycleMenu.test.tsx's identical stub.
vi.mock("@/components/forge/ForgeLaunchModal", () => ({
  ForgeLaunchModal: (props: { open: boolean }) => (
    <div data-testid="forge-modal-stub" data-open={String(props.open)} />
  ),
}));

// ── Heavy/portal children stubbed per the plan — the filter logic under
// test (visibleSkills/chipCounts) stays real; these components' OWN Convex
// queries, drag/DnD internals, or portals are irrelevant to this suite. ──
vi.mock("@/components/skills/vault/SkillVaultView", () => ({
  SkillVaultView: () => null,
}));
vi.mock("@/components/skills/ColdStorageView", () => ({
  ColdStorageView: () => null,
}));
vi.mock("@/components/skills/IntakeModal", () => ({
  IntakeModal: () => null,
}));
vi.mock("@/components/skills/IntakeSheet", () => ({
  IntakeSheet: () => null,
}));
vi.mock("@/components/skills/SkillCommandPalette", () => ({
  SkillCommandPalette: () => null,
}));
vi.mock("@/components/skills/SkillReviewDrawer", () => ({
  SkillReviewDrawer: () => null,
}));
vi.mock("@/components/skills/CategoryGrid", () => ({
  CategoryGrid: () => null,
}));
vi.mock("@/components/skills/SkillsInCategory", () => ({
  SkillsInCategory: () => null,
}));

// AllSkillsOverview: real filter output flows in via `skills` — render each
// received skill's `name` as text so the assertion reads rendered output
// PRODUCED BY THE REAL FILTER, never a prop captured from a mock.
vi.mock("@/components/skills/AllSkillsOverview", () => ({
  AllSkillsOverview: ({ skills }: { skills: Array<{ name: string }> }) => (
    <div data-testid="all-skills-overview">
      {skills.map((s) => (
        <div key={s.name} data-testid="overview-skill-row">
          {s.name}
        </div>
      ))}
    </div>
  ),
}));

// SkillFilterChips: render each chip's label + count as text and invoke the
// REAL onSelect/setChip handler on click, so chip selection exercises the
// real visibleSkills switch inside Skills.tsx — never a mocked handler.
vi.mock("@/components/skills/SkillFilterChips", () => ({
  SkillFilterChips: ({
    counts,
    onSelect,
  }: {
    active: string;
    counts: Record<string, number>;
    onSelect: (chip: string) => void;
  }) => (
    <div data-testid="skill-filter-chips">
      {Object.entries(counts).map(([id, count]) => (
        <button
          key={id}
          type="button"
          data-testid={`chip-${id}`}
          onClick={() => onSelect(id)}
        >
          {id}:{count}
        </button>
      ))}
    </div>
  ),
}));

// Import after mocks.
import Skills from "./Skills";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeSkill(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "skill",
    displayName: "Skill",
    description: "",
    overrideDescription: null,
    favorite: false,
    hidden: false,
    isAutoAssigned: false,
    useCount: 0,
    discoveredAt: 0,
    categoryName: null,
    origins: ["claude-code"],
    ...overrides,
  };
}

const personalSkill = makeSkill({ name: "personal-skill", displayName: "Personal Skill", origins: ["claude-code"] });
const pluginSkill = makeSkill({ name: "plugin-skill", displayName: "Plugin Skill", origins: ["claude-code:plugin"] });
const projectSkill = makeSkill({
  name: "project-skill",
  displayName: "Project Skill",
  origins: ["claude-code:project:abc123"],
});

const FIXTURE = [personalSkill, pluginSkill, projectSkill];

// Every non-fixture query (listHosts, listIntakeCommands, listWorkspaces,
// listLifecycleCommands…) must return a REFERENTIALLY STABLE array across
// renders — several hooks in this tree (useIntakeFeed, useForgeHostsRaw,
// SkillControlSurfaceProvider's useLifecycleCommands) wrap raw query results
// in useMemo/useEffect keyed on that reference. A mock returning a fresh `[]`
// literal on every call defeats that memoization and drives an infinite
// render loop (reproduced: OOM crash before this fix — see SUMMARY).
const STABLE_EMPTY: unknown[] = [];

function setupQueries(skills: unknown[] = FIXTURE) {
  // Also stable across calls — a fresh array here would re-trigger the same
  // `needsSeed`-adjacent memo churn for the categories query specifically.
  const categories = [
    { _id: "cat-1", name: "general", displayName: "General", icon: "⚡", color: "gray", description: "", sortOrder: 0 },
  ];
  mockUseQuery.mockImplementation((ref: unknown) => {
    const path = String(ref);
    if (path === "api.skillCategories.getSkillsWithOverrides") return skills;
    // Non-empty so `needsSeed` stays false and the main content (chips +
    // overview) renders. Every fixture skill has categoryName: null, so this
    // category holds zero of them — irrelevant to the chip test.
    if (path === "api.skillCategories.listCategories") return categories;
    return STABLE_EMPTY;
  });
  mockUseMutation.mockImplementation(() => vi.fn().mockResolvedValue(undefined));
}

beforeEach(() => {
  vi.clearAllMocks();
  setupQueries();
});

function renderSkills() {
  return render(
    <MemoryRouter>
      <Skills />
    </MemoryRouter>
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Skills page — Global chip includes plugin-origin skills (DEBT-05 frontend companion, D-17)", () => {
  it("Global chip renders BOTH the personal and the plugin skill by name, never the project skill", () => {
    renderSkills();
    fireEvent.click(screen.getByTestId("chip-global"));

    expect(screen.getByText("personal-skill")).toBeInTheDocument();
    expect(screen.getByText("plugin-skill")).toBeInTheDocument();
    expect(screen.queryByText("project-skill")).not.toBeInTheDocument();
  });

  it("Global chip's displayed count is 2 for the fixture (1 personal + 1 plugin)", () => {
    renderSkills();
    expect(screen.getByTestId("chip-global")).toHaveTextContent("global:2");
  });

  it("Project chip still renders only the project skill and its count is 1 — the project predicate is untouched", () => {
    renderSkills();
    expect(screen.getByTestId("chip-project")).toHaveTextContent("project:1");

    fireEvent.click(screen.getByTestId("chip-project"));
    expect(screen.getByText("project-skill")).toBeInTheDocument();
    expect(screen.queryByText("personal-skill")).not.toBeInTheDocument();
    expect(screen.queryByText("plugin-skill")).not.toBeInTheDocument();
  });
});
