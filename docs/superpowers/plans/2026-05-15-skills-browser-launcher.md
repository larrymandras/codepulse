# Skills Browser & Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/skills` page to CodePulse that displays all Astridr skills by category with expandable accordions, a frequently-used section, search, and one-click launch to the chat page.

**Architecture:** Convex-native. Skills already flow from Astridr to Convex via `/scan`. We add a `useCount` field, a `recordSkillLaunch` mutation, a new page with client-side category grouping, and a `?skill=` URL param on the Chat page for pre-fill.

**Tech Stack:** React 19, TypeScript, Convex (schema + mutations + queries), Tailwind CSS 4, React Router v7, Vitest + Testing Library.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `convex/schema.ts` | Modify (line 188-195) | Add `useCount` field to `skills` table |
| `convex/registry.ts` | Modify (after line 587) | Add `recordSkillLaunch` mutation |
| `src/lib/skillCategories.ts` | Create | Pure functions: `groupByCategory()`, `titleCase()`, `stripPrefix()` |
| `src/lib/__tests__/skillCategories.test.ts` | Create | Unit tests for category logic |
| `src/components/skills/SkillButton.tsx` | Create | Individual skill launch button |
| `src/components/skills/SkillButton.test.tsx` | Create | SkillButton component tests |
| `src/components/skills/SkillCategoryAccordion.tsx` | Create | Category row with expand/collapse + skill grid |
| `src/components/skills/SkillCategoryAccordion.test.tsx` | Create | Accordion component tests |
| `src/components/skills/FrequentSkills.tsx` | Create | Top strip of most-used skills |
| `src/components/skills/FrequentSkills.test.tsx` | Create | FrequentSkills component tests |
| `src/pages/Skills.tsx` | Create | Main page: query, group, search, render |
| `src/pages/__tests__/Skills.test.tsx` | Create | Page integration tests |
| `src/pages/Chat.tsx` | Modify (lines 7, 29-34) | Add `?skill=` param pre-fill + badge |
| `src/layouts/DashboardLayout.tsx` | Modify (line 104-112) | Add Skills nav item to COMMAND group |
| `src/App.tsx` | Modify (lines 60-63, 99) | Add lazy-loaded `/skills` route |

---

### Task 1: Schema — Add `useCount` to Skills Table

**Files:**
- Modify: `convex/schema.ts:188-195`

- [ ] **Step 1: Add `useCount` field**

In `convex/schema.ts`, find the `skills` table (line 188) and add the `useCount` field:

```typescript
  skills: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    source: v.optional(v.string()),
    lastUsedAt: v.optional(v.float64()),
    discoveredAt: v.float64(),
    origin: v.optional(v.string()), // "native" | "bridge" | "cc" | "catalog"
    useCount: v.optional(v.float64()),
  }).index("by_name", ["name"]),
```

- [ ] **Step 2: Verify Convex accepts the schema**

Run: `npx convex dev --once` (or check the running dev backend picks it up)
Expected: Schema push succeeds, no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(skills): add useCount field to skills table"
```

---

### Task 2: Mutation — `recordSkillLaunch`

**Files:**
- Modify: `convex/registry.ts` (after line 587)

- [ ] **Step 1: Add the mutation**

In `convex/registry.ts`, after the `listSkills` query (line 587), add:

```typescript
export const recordSkillLaunch = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const skill = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (!skill) return;
    await ctx.db.patch(skill._id, {
      useCount: (skill.useCount ?? 0) + 1,
      lastUsedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx convex dev --once`
Expected: No type errors, mutation registered.

- [ ] **Step 3: Commit**

```bash
git add convex/registry.ts
git commit -m "feat(skills): add recordSkillLaunch mutation"
```

---

### Task 3: Category Utility Functions

**Files:**
- Create: `src/lib/skillCategories.ts`
- Create: `src/lib/__tests__/skillCategories.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/skillCategories.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { groupByCategory, titleCase, stripPrefix } from "../skillCategories";

describe("titleCase", () => {
  it("capitalizes first letter", () => {
    expect(titleCase("legal")).toBe("Legal");
  });

  it("handles single character", () => {
    expect(titleCase("a")).toBe("A");
  });

  it("handles empty string", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("stripPrefix", () => {
  it("removes category prefix from skill name", () => {
    expect(stripPrefix("legal-nda", "legal")).toBe("Nda");
  });

  it("handles multi-word suffix", () => {
    expect(stripPrefix("legal-contract-review", "legal")).toBe("Contract Review");
  });

  it("returns full name title-cased when no prefix match", () => {
    expect(stripPrefix("standalone", "standalone")).toBe("Standalone");
  });
});

describe("groupByCategory", () => {
  const skills = [
    { name: "legal-nda", description: "Generate NDAs" },
    { name: "legal-review", description: "Review contracts" },
    { name: "asi-briefing", description: "Daily briefing" },
    { name: "standalone", description: "No prefix" },
  ];

  it("groups by first dash-separated prefix", () => {
    const groups = groupByCategory(skills as any);
    const categoryNames = groups.map((g) => g.category);
    expect(categoryNames).toContain("Legal");
    expect(categoryNames).toContain("Asi");
    expect(categoryNames).toContain("Standalone");
  });

  it("sorts categories alphabetically", () => {
    const groups = groupByCategory(skills as any);
    const names = groups.map((g) => g.category);
    expect(names).toEqual([...names].sort());
  });

  it("places skills in correct groups", () => {
    const groups = groupByCategory(skills as any);
    const legal = groups.find((g) => g.category === "Legal");
    expect(legal?.skills).toHaveLength(2);
    expect(legal?.skills[0].name).toBe("legal-nda");
  });

  it("returns empty array for empty input", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/skillCategories.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility functions**

Create `src/lib/skillCategories.ts`:

```typescript
interface SkillLike {
  name: string;
  description?: string;
  useCount?: number;
  lastUsedAt?: number;
  [key: string]: unknown;
}

export interface CategoryGroup<T extends SkillLike = SkillLike> {
  category: string;
  prefix: string;
  skills: T[];
}

export function titleCase(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function stripPrefix(skillName: string, prefix: string): string {
  if (skillName === prefix) return titleCase(skillName);
  const suffix = skillName.slice(prefix.length + 1);
  return suffix
    .split("-")
    .map(titleCase)
    .join(" ");
}

function getPrefix(name: string): string {
  const idx = name.indexOf("-");
  return idx === -1 ? name : name.slice(0, idx);
}

export function groupByCategory<T extends SkillLike>(skills: T[]): CategoryGroup<T>[] {
  if (skills.length === 0) return [];

  const map = new Map<string, T[]>();
  for (const skill of skills) {
    const prefix = getPrefix(skill.name);
    const existing = map.get(prefix);
    if (existing) {
      existing.push(skill);
    } else {
      map.set(prefix, [skill]);
    }
  }

  return Array.from(map.entries())
    .map(([prefix, groupSkills]) => ({
      category: titleCase(prefix),
      prefix,
      skills: groupSkills,
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/skillCategories.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skillCategories.ts src/lib/__tests__/skillCategories.test.ts
git commit -m "feat(skills): add category grouping utility functions"
```

---

### Task 4: SkillButton Component

**Files:**
- Create: `src/components/skills/SkillButton.tsx`
- Create: `src/components/skills/SkillButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/skills/SkillButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillButton } from "./SkillButton";

describe("SkillButton", () => {
  const defaultProps = {
    displayName: "NDA Generator",
    description: "Generate non-disclosure agreements",
    onLaunch: vi.fn(),
  };

  it("renders skill name and description", () => {
    render(<SkillButton {...defaultProps} />);
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
    expect(screen.getByText("Generate non-disclosure agreements")).toBeInTheDocument();
  });

  it("calls onLaunch when clicked", () => {
    const onLaunch = vi.fn();
    render(<SkillButton {...defaultProps} onLaunch={onLaunch} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onLaunch).toHaveBeenCalledOnce();
  });

  it("renders without description", () => {
    render(<SkillButton displayName="Test" onLaunch={vi.fn()} />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/SkillButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SkillButton**

Create `src/components/skills/SkillButton.tsx`:

```tsx
import { Play } from "lucide-react";

interface SkillButtonProps {
  displayName: string;
  description?: string;
  onLaunch: () => void;
}

export function SkillButton({ displayName, description, onLaunch }: SkillButtonProps) {
  return (
    <button
      onClick={onLaunch}
      className="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-indigo-500/50 hover:bg-gray-700/50 transition-all duration-200 text-left group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{displayName}</div>
        {description && (
          <div className="text-xs text-gray-400 truncate">{description}</div>
        )}
      </div>
      <Play className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 shrink-0 transition-colors" />
    </button>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/skills/SkillButton.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/SkillButton.tsx src/components/skills/SkillButton.test.tsx
git commit -m "feat(skills): add SkillButton component"
```

---

### Task 5: SkillCategoryAccordion Component

**Files:**
- Create: `src/components/skills/SkillCategoryAccordion.tsx`
- Create: `src/components/skills/SkillCategoryAccordion.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/skills/SkillCategoryAccordion.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillCategoryAccordion } from "./SkillCategoryAccordion";

const mockSkills = [
  { name: "legal-nda", displayName: "Nda", description: "Generate NDAs" },
  { name: "legal-review", displayName: "Review", description: "Review contracts" },
];

describe("SkillCategoryAccordion", () => {
  it("renders category name and skill count", () => {
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={false}
        onToggle={vi.fn()}
        onLaunchSkill={vi.fn()}
      />
    );
    expect(screen.getByText("Legal")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("does not show skills when collapsed", () => {
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={false}
        onToggle={vi.fn()}
        onLaunchSkill={vi.fn()}
      />
    );
    expect(screen.queryByText("Nda")).not.toBeInTheDocument();
  });

  it("shows skills when expanded", () => {
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={true}
        onToggle={vi.fn()}
        onLaunchSkill={vi.fn()}
      />
    );
    expect(screen.getByText("Nda")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("calls onToggle when header is clicked", () => {
    const onToggle = vi.fn();
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={false}
        onToggle={onToggle}
        onLaunchSkill={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Legal"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("calls onLaunchSkill with skill name when a skill button is clicked", () => {
    const onLaunchSkill = vi.fn();
    render(
      <SkillCategoryAccordion
        category="Legal"
        skills={mockSkills}
        isOpen={true}
        onToggle={vi.fn()}
        onLaunchSkill={onLaunchSkill}
      />
    );
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onLaunchSkill).toHaveBeenCalledWith("legal-nda");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/SkillCategoryAccordion.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SkillCategoryAccordion**

Create `src/components/skills/SkillCategoryAccordion.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
import { SkillButton } from "./SkillButton";

interface SkillDisplay {
  name: string;
  displayName: string;
  description?: string;
}

interface SkillCategoryAccordionProps {
  category: string;
  skills: SkillDisplay[];
  isOpen: boolean;
  onToggle: () => void;
  onLaunchSkill: (skillName: string) => void;
}

export function SkillCategoryAccordion({
  category,
  skills,
  isOpen,
  onToggle,
  onLaunchSkill,
}: SkillCategoryAccordionProps) {
  return (
    <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center w-full px-4 py-3 hover:bg-gray-700/30 transition-colors"
      >
        <ChevronRight
          className={`w-4 h-4 text-gray-400 mr-3 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        />
        <span className="text-sm font-semibold text-white flex-1 text-left">
          {category}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
          {skills.length}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {skills.map((skill) => (
            <SkillButton
              key={skill.name}
              displayName={skill.displayName}
              description={skill.description}
              onLaunch={() => onLaunchSkill(skill.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/skills/SkillCategoryAccordion.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/SkillCategoryAccordion.tsx src/components/skills/SkillCategoryAccordion.test.tsx
git commit -m "feat(skills): add SkillCategoryAccordion component"
```

---

### Task 6: FrequentSkills Component

**Files:**
- Create: `src/components/skills/FrequentSkills.tsx`
- Create: `src/components/skills/FrequentSkills.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/skills/FrequentSkills.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FrequentSkills } from "./FrequentSkills";

describe("FrequentSkills", () => {
  it("renders nothing when no skills have been used", () => {
    const skills = [
      { name: "legal-nda", description: "NDAs", useCount: 0 },
      { name: "asi-briefing", description: "Briefing" },
    ];
    const { container } = render(
      <FrequentSkills skills={skills as any} onLaunchSkill={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders skills sorted by useCount descending", () => {
    const skills = [
      { name: "legal-nda", description: "NDAs", useCount: 3 },
      { name: "legal-review", description: "Review", useCount: 10 },
      { name: "asi-briefing", description: "Briefing", useCount: 1 },
    ];
    render(
      <FrequentSkills skills={skills as any} onLaunchSkill={vi.fn()} />
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("legal-review");
    expect(buttons[1]).toHaveTextContent("legal-nda");
    expect(buttons[2]).toHaveTextContent("asi-briefing");
  });

  it("limits to 6 skills maximum", () => {
    const skills = Array.from({ length: 10 }, (_, i) => ({
      name: `skill-${i}`,
      description: `Skill ${i}`,
      useCount: 10 - i,
    }));
    render(
      <FrequentSkills skills={skills as any} onLaunchSkill={vi.fn()} />
    );
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });

  it("shows use count badge", () => {
    const skills = [
      { name: "legal-nda", description: "NDAs", useCount: 5 },
    ];
    render(
      <FrequentSkills skills={skills as any} onLaunchSkill={vi.fn()} />
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/FrequentSkills.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement FrequentSkills**

Create `src/components/skills/FrequentSkills.tsx`:

```tsx
import { Zap } from "lucide-react";

interface SkillLike {
  name: string;
  description?: string;
  useCount?: number;
}

interface FrequentSkillsProps {
  skills: SkillLike[];
  onLaunchSkill: (name: string) => void;
}

const MAX_FREQUENT = 6;

export function FrequentSkills({ skills, onLaunchSkill }: FrequentSkillsProps) {
  const frequent = skills
    .filter((s) => (s.useCount ?? 0) >= 1)
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
    .slice(0, MAX_FREQUENT);

  if (frequent.length === 0) return null;

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5" />
        Frequently Used
      </h2>
      <div className="flex flex-wrap gap-2">
        {frequent.map((skill) => (
          <button
            key={skill.name}
            onClick={() => onLaunchSkill(skill.name)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 hover:border-indigo-500/50 transition-all text-sm text-indigo-300"
          >
            {skill.name}
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-600/30 text-indigo-400">
              {skill.useCount}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/skills/FrequentSkills.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/FrequentSkills.tsx src/components/skills/FrequentSkills.test.tsx
git commit -m "feat(skills): add FrequentSkills component"
```

---

### Task 7: Skills Page

**Files:**
- Create: `src/pages/Skills.tsx`
- Create: `src/pages/__tests__/Skills.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/pages/__tests__/Skills.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/__tests__/Skills.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Skills page**

Create `src/pages/Skills.tsx`:

```tsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Search, Wand2 } from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { groupByCategory, stripPrefix } from "../lib/skillCategories";
import { FrequentSkills } from "../components/skills/FrequentSkills";
import { SkillCategoryAccordion } from "../components/skills/SkillCategoryAccordion";

export default function Skills() {
  const skills = useQuery(api.registry.listSkills) ?? [];
  const recordLaunch = useMutation(api.registry.recordSkillLaunch);
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const lowerSearch = search.toLowerCase().trim();

  const filteredGroups = useMemo(() => {
    const groups = groupByCategory(skills);
    if (!lowerSearch) return groups;

    return groups
      .map((group) => {
        const categoryMatch = group.category.toLowerCase().includes(lowerSearch);
        if (categoryMatch) return group;
        const filtered = group.skills.filter(
          (s) =>
            s.name.toLowerCase().includes(lowerSearch) ||
            (s.description ?? "").toLowerCase().includes(lowerSearch)
        );
        if (filtered.length === 0) return null;
        return { ...group, skills: filtered };
      })
      .filter(Boolean) as typeof groups;
  }, [skills, lowerSearch]);

  const searchExpandedCategories = useMemo(() => {
    if (!lowerSearch) return new Set<string>();
    return new Set(filteredGroups.map((g) => g.category));
  }, [filteredGroups, lowerSearch]);

  function toggleCategory(category: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function handleLaunchSkill(skillName: string) {
    recordLaunch({ name: skillName }).catch(() => {});
    navigate(`/chat?skill=${skillName}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white font-[Cinzel]">Skills</h1>
          {skills.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
              {skills.length}
            </span>
          )}
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      <SectionErrorBoundary name="Skills">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Wand2 className="w-10 h-10 mb-3 opacity-40" />
            <p>No skills discovered yet. Skills appear here after Astridr scans its skills directory.</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No skills match your search.
          </div>
        ) : (
          <>
            {!lowerSearch && (
              <FrequentSkills skills={skills} onLaunchSkill={handleLaunchSkill} />
            )}
            <div className="space-y-2">
              {filteredGroups.map((group) => (
                <SkillCategoryAccordion
                  key={group.category}
                  category={group.category}
                  skills={group.skills.map((s) => ({
                    name: s.name,
                    displayName: stripPrefix(s.name, group.prefix),
                    description: s.description,
                  }))}
                  isOpen={
                    openCategories.has(group.category) ||
                    searchExpandedCategories.has(group.category)
                  }
                  onToggle={() => toggleCategory(group.category)}
                  onLaunchSkill={handleLaunchSkill}
                />
              ))}
            </div>
          </>
        )}
      </SectionErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/__tests__/Skills.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Skills.tsx src/pages/__tests__/Skills.test.tsx
git commit -m "feat(skills): add Skills browser page"
```

---

### Task 8: Chat Page — Skill Pre-Fill Integration

**Files:**
- Modify: `src/pages/Chat.tsx:7,29-34`
- Modify: `src/components/ChatInput.tsx:44-49,59-60`

- [ ] **Step 1: Add `initialValue` prop to ChatInput**

In `src/components/ChatInput.tsx`, add `initialValue` to the props interface (line 44-49):

```tsx
export interface ChatInputProps {
  onSend: (message: string) => void;
  onVoiceSend?: (text: string) => void;
  disabled?: boolean;
  disconnected?: boolean;
  initialValue?: string;
}
```

Update the component signature and add a `useEffect` to apply the initial value (line 59-60):

```tsx
export function ChatInput({ onSend, onVoiceSend, disabled = false, disconnected = false, initialValue }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isVoiceInputRef = useRef(false);
  const initialAppliedRef = useRef(false);

  useEffect(() => {
    if (initialValue && !initialAppliedRef.current) {
      setValue(initialValue);
      initialAppliedRef.current = true;
    }
  }, [initialValue]);
```

- [ ] **Step 2: Add skill param reading to Chat page**

In `src/pages/Chat.tsx`, add the import (line 7):

```tsx
import { useState, useEffect, useRef, useCallback, type UIEvent } from "react";
import { useSearchParams } from "react-router-dom";
```

Inside the `Chat` component (after line 31), add skill param handling:

```tsx
export default function Chat() {
  const { status, sendCommand, subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();
  const [searchParams, setSearchParams] = useSearchParams();

  const skillParam = searchParams.get("skill");
  const [skillBadge, setSkillBadge] = useState<string | null>(null);

  useEffect(() => {
    if (skillParam) {
      setSkillBadge(skillParam);
      setSearchParams({}, { replace: true });
    }
  }, [skillParam, setSearchParams]);
```

- [ ] **Step 3: Add skill badge rendering and pass initialValue to ChatInput**

Find the ChatInput usage in Chat.tsx (around line 438) and update it:

```tsx
      {skillBadge && (
        <div className="flex items-center gap-2 px-4 pb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-xs text-indigo-300">
            Skill: {skillBadge}
            <button
              onClick={() => setSkillBadge(null)}
              className="hover:text-white ml-1"
            >
              &times;
            </button>
          </span>
        </div>
      )}
      <ChatInput
        onSend={handleSend}
        onVoiceSend={handleVoiceSend}
        disabled={isStreaming || isDisconnected}
        disconnected={isDisconnected}
        initialValue={skillBadge ? `/${skillBadge}` : undefined}
      />
```

- [ ] **Step 4: Verify no type errors**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Chat.tsx src/components/ChatInput.tsx
git commit -m "feat(skills): add ?skill= param pre-fill to Chat page"
```

---

### Task 9: Routing — Add Skills Page to App and Nav

**Files:**
- Modify: `src/App.tsx:60-63,99`
- Modify: `src/layouts/DashboardLayout.tsx:104-112`

- [ ] **Step 1: Add lazy import in App.tsx**

In `src/App.tsx`, after the Session Kanban lazy import (line 63), add:

```tsx
// Skills browser
const Skills = lazy(() => import("./pages/Skills"));
```

- [ ] **Step 2: Add route in App.tsx**

After the `/chat` route (around line 99), add:

```tsx
              <Route path="/skills" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Skills...</div>}><Skills /></Suspense>} />
```

- [ ] **Step 3: Add nav item in DashboardLayout.tsx**

In `src/layouts/DashboardLayout.tsx`, find the `commandNavItems` array (line 104). Add the Skills entry after Sessions:

```typescript
const commandNavItems = [
  { to: "/chat", label: "Chat", icon: "message", group: "COMMAND" },
  { to: "/live-run", label: "Live Run", icon: "activity", group: "COMMAND" },
  { to: "/inbox", label: "Inbox", icon: "inbox", group: "COMMAND" },
  { to: "/tasks", label: "Tasks", icon: "kanban", group: "COMMAND" },
  { to: "/config", label: "Config", icon: "sliders", group: "COMMAND" },
  { to: "/transcripts", label: "Transcripts", icon: "scroll", group: "COMMAND" },
  { to: "/sessions", label: "Sessions", icon: "layout", group: "COMMAND" },
  { to: "/skills", label: "Skills", icon: "wand-2", group: "COMMAND" },
];
```

- [ ] **Step 4: Verify the app compiles and renders**

Run: `npm run dev` and visit `http://localhost:5173/skills` in a browser.
Expected: Skills page renders (may show empty state if no skills are synced). "Skills" appears in the COMMAND nav group sidebar.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/layouts/DashboardLayout.tsx
git commit -m "feat(skills): add /skills route and nav entry"
```

---

### Task 10: Full Integration Test

**Files:**
- None new — verify existing tests still pass

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All existing tests pass, all new tests pass.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Manual verification**

Open `http://localhost:5173/skills` in a browser. Verify:
1. Page renders with title and search bar
2. If skills are synced, categories display as accordion rows
3. Clicking a category expands to show skill buttons
4. Clicking a skill button navigates to `/chat?skill=<name>`
5. Chat page shows skill badge and pre-fills input with `/<skillName>`
6. Search filters categories and auto-expands matching ones
7. "Skills" nav item appears in sidebar COMMAND section

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "feat(skills): integration fixes"
```
