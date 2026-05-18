# Skills Browser Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current prefix-derived skills page with a Convex-backed categorization system, dual grid/list views, and inline admin edit mode.

**Architecture:** Two new Convex tables (`skillCategories`, `skillOverrides`) layer presentation data on top of the existing `skills` table. Auto-seed logic in `syncInventory` creates default categories/overrides from skill name prefixes. The React page is rewritten with category tabs, view toggle, and edit mode.

**Tech Stack:** Convex (schema, mutations, queries), React 19, TypeScript, Tailwind CSS 4, Vitest, @testing-library/react

---

### Task 1: Add Convex Schema — `skillCategories` and `skillOverrides` Tables

**Files:**
- Modify: `convex/schema.ts:188-196` (add two tables after the `skills` table)

- [ ] **Step 1: Add `skillCategories` table to schema**

In `convex/schema.ts`, add after the `skills` table definition (after line 196):

```typescript
  skillCategories: defineTable({
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    icon: v.string(),
    color: v.string(),
    sortOrder: v.float64(),
  }).index("by_name", ["name"]),

  skillOverrides: defineTable({
    skillName: v.string(),
    displayName: v.string(),
    categoryName: v.string(),
    description: v.optional(v.string()),
    hidden: v.boolean(),
    isAutoAssigned: v.boolean(),
  })
    .index("by_skillName", ["skillName"])
    .index("by_categoryName", ["categoryName"]),
```

- [ ] **Step 2: Verify schema compiles**

Run: `cd C:/Users/mandr/codepulse && npx convex dev --once`
Expected: Schema validated, no errors.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat(skills): add skillCategories and skillOverrides tables to schema"
```

---

### Task 2: Add Category and Override Mutations

**Files:**
- Create: `convex/skillCategories.ts`
- Test: `convex/__tests__/skillCategories.test.ts`

- [ ] **Step 1: Write tests for the default prefix maps and titleCase helpers**

Create `convex/__tests__/skillCategories.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  DEFAULT_ICONS,
  DEFAULT_COLORS,
  extractPrefix,
  generateDisplayName,
} from "../skillCategories";

describe("extractPrefix", () => {
  it("extracts prefix before first hyphen", () => {
    expect(extractPrefix("gsd-plan-phase")).toBe("gsd");
  });

  it("extracts prefix for single-hyphen names", () => {
    expect(extractPrefix("legal-nda")).toBe("legal");
  });

  it('returns "uncategorized" for names without hyphens', () => {
    expect(extractPrefix("init")).toBe("uncategorized");
  });

  it('returns "uncategorized" for empty string', () => {
    expect(extractPrefix("")).toBe("uncategorized");
  });
});

describe("generateDisplayName", () => {
  it("strips prefix and titlecases segments", () => {
    expect(generateDisplayName("gsd-plan-phase", "gsd")).toBe("Plan Phase");
  });

  it("handles single segment after prefix", () => {
    expect(generateDisplayName("legal-nda", "legal")).toBe("Nda");
  });

  it("titlecases the full name for uncategorized skills", () => {
    expect(generateDisplayName("init", "uncategorized")).toBe("Init");
  });

  it("handles multi-word segments", () => {
    expect(generateDisplayName("gsd-code-review-fix", "gsd")).toBe(
      "Code Review Fix"
    );
  });
});

describe("DEFAULT_ICONS", () => {
  it("has entries for known prefixes", () => {
    expect(DEFAULT_ICONS["gsd"]).toBe("📋");
    expect(DEFAULT_ICONS["legal"]).toBe("⚖️");
    expect(DEFAULT_ICONS["sales"]).toBe("💼");
  });
});

describe("DEFAULT_COLORS", () => {
  it("has entries for known prefixes", () => {
    expect(DEFAULT_COLORS["gsd"]).toBe("indigo");
    expect(DEFAULT_COLORS["legal"]).toBe("red");
    expect(DEFAULT_COLORS["sales"]).toBe("amber");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/__tests__/skillCategories.test.ts`
Expected: FAIL — module `../skillCategories` not found.

- [ ] **Step 3: Implement skillCategories module with helpers and mutations**

Create `convex/skillCategories.ts`:

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const DEFAULT_ICONS: Record<string, string> = {
  gsd: "📋",
  legal: "⚖️",
  market: "📈",
  sales: "💼",
  geo: "🌐",
  codex: "🖥️",
  superpowers: "⚡",
  code: "💻",
  feature: "🔧",
  frontend: "🎨",
  skill: "🧩",
  bug: "🐛",
  ship: "🚀",
  review: "🔍",
};

export const DEFAULT_COLORS: Record<string, string> = {
  gsd: "indigo",
  legal: "red",
  market: "purple",
  sales: "amber",
  geo: "cyan",
  codex: "emerald",
  superpowers: "violet",
  code: "blue",
  feature: "orange",
  frontend: "pink",
  skill: "teal",
  bug: "rose",
  ship: "green",
  review: "yellow",
};

export function extractPrefix(skillName: string): string {
  if (!skillName || !skillName.includes("-")) return "uncategorized";
  return skillName.split("-")[0];
}

function titleCase(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function generateDisplayName(
  skillName: string,
  prefix: string
): string {
  if (prefix === "uncategorized") {
    return titleCase(skillName);
  }
  const withoutPrefix = skillName.slice(prefix.length + 1);
  return withoutPrefix
    .split("-")
    .map(titleCase)
    .join(" ");
}

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("skillCategories")
      .collect()
      .then((cats) => cats.sort((a, b) => a.sortOrder - b.sortOrder));
  },
});

export const countAutoAssigned = query({
  args: {},
  handler: async (ctx) => {
    const overrides = await ctx.db.query("skillOverrides").collect();
    return overrides.filter((o) => o.isAutoAssigned).length;
  },
});

export const getSkillsWithOverrides = query({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").collect();
    const overrides = await ctx.db.query("skillOverrides").collect();
    const categories = await ctx.db.query("skillCategories").collect();

    const overrideMap = new Map(overrides.map((o) => [o.skillName, o]));
    const categoryMap = new Map(categories.map((c) => [c.name, c]));

    return skills.map((skill) => {
      const override = overrideMap.get(skill.name);
      const category = override
        ? categoryMap.get(override.categoryName)
        : null;
      return {
        ...skill,
        displayName: override?.displayName ?? skill.name,
        categoryName: override?.categoryName ?? null,
        categoryDisplayName: category?.displayName ?? null,
        categoryIcon: category?.icon ?? "⚡",
        categoryColor: category?.color ?? "gray",
        overrideDescription: override?.description ?? null,
        hidden: override?.hidden ?? false,
        isAutoAssigned: override?.isAutoAssigned ?? true,
      };
    });
  },
});

export const createCategory = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    description: v.string(),
    icon: v.string(),
    color: v.string(),
    sortOrder: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("skillCategories")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("skillCategories", args);
  },
});

export const updateCategory = mutation({
  args: {
    id: v.id("skillCategories"),
    displayName: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    sortOrder: v.optional(v.float64()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("skillCategories") },
  handler: async (ctx, { id }) => {
    const cat = await ctx.db.get(id);
    if (!cat) return;
    const overrides = await ctx.db
      .query("skillOverrides")
      .withIndex("by_categoryName", (q) => q.eq("categoryName", cat.name))
      .collect();
    if (overrides.length > 0) {
      throw new Error(
        `Cannot delete category "${cat.displayName}" — ${overrides.length} skills are assigned to it. Reassign them first.`
      );
    }
    await ctx.db.delete(id);
  },
});

export const updateSkillOverride = mutation({
  args: {
    skillName: v.string(),
    displayName: v.optional(v.string()),
    categoryName: v.optional(v.string()),
    description: v.optional(v.string()),
    hidden: v.optional(v.boolean()),
  },
  handler: async (ctx, { skillName, ...updates }) => {
    const existing = await ctx.db
      .query("skillOverrides")
      .withIndex("by_skillName", (q) => q.eq("skillName", skillName))
      .first();
    if (!existing) return;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([, val]) => val !== undefined)
    );
    await ctx.db.patch(existing._id, { ...filtered, isAutoAssigned: false });
  },
});

export const bulkAcceptAutoAssigned = mutation({
  args: {},
  handler: async (ctx) => {
    const overrides = await ctx.db.query("skillOverrides").collect();
    const autoAssigned = overrides.filter((o) => o.isAutoAssigned);
    for (const override of autoAssigned) {
      await ctx.db.patch(override._id, { isAutoAssigned: false });
    }
    return autoAssigned.length;
  },
});

export const autoSeedSkill = mutation({
  args: { skillName: v.string() },
  handler: async (ctx, { skillName }) => {
    const existingOverride = await ctx.db
      .query("skillOverrides")
      .withIndex("by_skillName", (q) => q.eq("skillName", skillName))
      .first();
    if (existingOverride) return;

    const prefix = extractPrefix(skillName);

    let category = await ctx.db
      .query("skillCategories")
      .withIndex("by_name", (q) => q.eq("name", prefix))
      .first();

    if (!category) {
      const catId = await ctx.db.insert("skillCategories", {
        name: prefix,
        displayName: titleCase(prefix),
        description: "",
        icon: DEFAULT_ICONS[prefix] ?? "⚡",
        color: DEFAULT_COLORS[prefix] ?? "gray",
        sortOrder: Date.now(),
      });
      category = await ctx.db.get(catId);
    }

    await ctx.db.insert("skillOverrides", {
      skillName,
      displayName: generateDisplayName(skillName, prefix),
      categoryName: prefix,
      description: undefined,
      hidden: false,
      isAutoAssigned: true,
    });
  },
});

export const seedExistingSkills = mutation({
  args: {},
  handler: async (ctx) => {
    const skills = await ctx.db.query("skills").collect();
    let seeded = 0;
    for (const skill of skills) {
      const existing = await ctx.db
        .query("skillOverrides")
        .withIndex("by_skillName", (q) => q.eq("skillName", skill.name))
        .first();
      if (existing) continue;

      const prefix = extractPrefix(skill.name);

      let category = await ctx.db
        .query("skillCategories")
        .withIndex("by_name", (q) => q.eq("name", prefix))
        .first();

      if (!category) {
        const catId = await ctx.db.insert("skillCategories", {
          name: prefix,
          displayName: titleCase(prefix),
          description: "",
          icon: DEFAULT_ICONS[prefix] ?? "⚡",
          color: DEFAULT_COLORS[prefix] ?? "gray",
          sortOrder: Date.now(),
        });
        category = await ctx.db.get(catId);
      }

      await ctx.db.insert("skillOverrides", {
        skillName: skill.name,
        displayName: generateDisplayName(skill.name, prefix),
        categoryName: prefix,
        description: undefined,
        hidden: false,
        isAutoAssigned: true,
      });
      seeded++;
    }
    return seeded;
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/__tests__/skillCategories.test.ts`
Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/skillCategories.ts convex/__tests__/skillCategories.test.ts
git commit -m "feat(skills): add skillCategories module with CRUD mutations, auto-seed, and helpers"
```

---

### Task 3: Wire Auto-Seed into syncInventory

**Files:**
- Modify: `convex/registry.ts` (the `syncInventory` mutation, where new skills are inserted)

- [ ] **Step 1: Add auto-seed import at top of registry.ts**

At the top of `convex/registry.ts`, add the import:

```typescript
import { api } from "./_generated/api";
```

This is needed to call the `autoSeedSkill` mutation. If `api` is already imported, skip this step.

- [ ] **Step 2: Find the skill insertion point in syncInventory**

In `convex/registry.ts`, inside the `syncInventory` mutation, locate where a new skill is inserted into the `skills` table. It will be a block like:

```typescript
await ctx.db.insert("skills", { ... });
```

After that insert, add:

```typescript
await ctx.runMutation(api.skillCategories.autoSeedSkill, {
  skillName: skill.name,
});
```

Do the same in `syncFullInventory` if it also inserts new skills (look for the same pattern).

Also add it in `importSkills` after its insert block.

- [ ] **Step 3: Verify the backend compiles**

Run: `cd C:/Users/mandr/codepulse && npx convex dev --once`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/registry.ts
git commit -m "feat(skills): wire auto-seed into syncInventory, syncFullInventory, and importSkills"
```

---

### Task 4: Build CategoryTabs Component

**Files:**
- Create: `src/components/skills/CategoryTabs.tsx`
- Create: `src/components/skills/__tests__/CategoryTabs.test.tsx`

- [ ] **Step 1: Write tests for CategoryTabs**

Create `src/components/skills/__tests__/CategoryTabs.test.tsx`:

```typescript
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryTabs } from "../CategoryTabs";

const mockCategories = [
  {
    _id: "1" as any,
    name: "gsd",
    displayName: "Project Management",
    icon: "📋",
    color: "indigo",
    description: "Planning and execution",
    sortOrder: 0,
    _creationTime: 0,
  },
  {
    _id: "2" as any,
    name: "legal",
    displayName: "Legal",
    icon: "⚖️",
    color: "red",
    description: "Contracts and compliance",
    sortOrder: 1,
    _creationTime: 0,
  },
];

describe("CategoryTabs", () => {
  test("renders All tab and category tabs", () => {
    render(
      <CategoryTabs
        categories={mockCategories}
        activeCategory={null}
        onSelect={vi.fn()}
        editMode={false}
      />
    );
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("📋 Project Management")).toBeInTheDocument();
    expect(screen.getByText("⚖️ Legal")).toBeInTheDocument();
  });

  test("calls onSelect with category name when tab clicked", () => {
    const onSelect = vi.fn();
    render(
      <CategoryTabs
        categories={mockCategories}
        activeCategory={null}
        onSelect={onSelect}
        editMode={false}
      />
    );
    fireEvent.click(screen.getByText("⚖️ Legal"));
    expect(onSelect).toHaveBeenCalledWith("legal");
  });

  test("calls onSelect with null when All tab clicked", () => {
    const onSelect = vi.fn();
    render(
      <CategoryTabs
        categories={mockCategories}
        activeCategory="gsd"
        onSelect={onSelect}
        editMode={false}
      />
    );
    fireEvent.click(screen.getByText("All"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  test("highlights the active category", () => {
    const { container } = render(
      <CategoryTabs
        categories={mockCategories}
        activeCategory="gsd"
        onSelect={vi.fn()}
        editMode={false}
      />
    );
    const activeTab = screen.getByText("📋 Project Management").closest("button");
    expect(activeTab?.className).toContain("bg-indigo");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/__tests__/CategoryTabs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement CategoryTabs**

Create `src/components/skills/CategoryTabs.tsx`:

```tsx
import { Doc } from "../../../convex/_generated/dataModel";

type Category = Doc<"skillCategories">;

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (categoryName: string | null) => void;
  editMode: boolean;
  onEditCategory?: (category: Category) => void;
  onAddCategory?: () => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
  editMode,
  onEditCategory,
  onAddCategory,
}: CategoryTabsProps) {
  const isAllActive = activeCategory === null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <div className="flex gap-1.5 flex-1 min-w-0">
        <button
          onClick={() => onSelect(null)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            isAllActive
              ? "bg-indigo-600 text-white"
              : "bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
          }`}
        >
          All
        </button>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.name;
          return (
            <div key={cat.name} className="relative flex items-center">
              <button
                onClick={() => onSelect(cat.name)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? `bg-indigo-600 text-white`
                    : "bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                }`}
              >
                {cat.icon} {cat.displayName}
              </button>
              {editMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCategory?.(cat);
                  }}
                  className="ml-1 p-0.5 text-gray-500 hover:text-indigo-400 transition-colors"
                  title={`Edit ${cat.displayName}`}
                >
                  ✏️
                </button>
              )}
            </div>
          );
        })}
        {editMode && (
          <button
            onClick={onAddCategory}
            className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap bg-gray-800/50 text-gray-500 hover:text-indigo-400 hover:bg-gray-700/50 border border-dashed border-gray-600 transition-colors"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/skills/__tests__/CategoryTabs.test.tsx`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/CategoryTabs.tsx src/components/skills/__tests__/CategoryTabs.test.tsx
git commit -m "feat(skills): add CategoryTabs component with edit mode support"
```

---

### Task 5: Build ViewToggle Component

**Files:**
- Create: `src/components/skills/ViewToggle.tsx`
- Create: `src/components/skills/__tests__/ViewToggle.test.tsx`

- [ ] **Step 1: Write tests for ViewToggle**

Create `src/components/skills/__tests__/ViewToggle.test.tsx`:

```typescript
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewToggle } from "../ViewToggle";

describe("ViewToggle", () => {
  test("renders grid and list buttons", () => {
    render(<ViewToggle view="grid" onChange={vi.fn()} />);
    expect(screen.getByTitle("Grid view")).toBeInTheDocument();
    expect(screen.getByTitle("List view")).toBeInTheDocument();
  });

  test("highlights grid button when view is grid", () => {
    const { container } = render(
      <ViewToggle view="grid" onChange={vi.fn()} />
    );
    const gridBtn = screen.getByTitle("Grid view");
    expect(gridBtn.className).toContain("bg-indigo");
  });

  test("calls onChange with list when list button clicked", () => {
    const onChange = vi.fn();
    render(<ViewToggle view="grid" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("List view"));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  test("calls onChange with grid when grid button clicked", () => {
    const onChange = vi.fn();
    render(<ViewToggle view="list" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Grid view"));
    expect(onChange).toHaveBeenCalledWith("grid");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/__tests__/ViewToggle.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ViewToggle**

Create `src/components/skills/ViewToggle.tsx`:

```tsx
import { LayoutGrid, List } from "lucide-react";

export type SkillsView = "grid" | "list";

interface ViewToggleProps {
  view: SkillsView;
  onChange: (view: SkillsView) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        title="Grid view"
        onClick={() => onChange("grid")}
        className={`p-1.5 transition-colors ${
          view === "grid"
            ? "bg-indigo-600 text-white"
            : "text-gray-500 hover:text-gray-300"
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        title="List view"
        onClick={() => onChange("list")}
        className={`p-1.5 transition-colors ${
          view === "list"
            ? "bg-indigo-600 text-white"
            : "text-gray-500 hover:text-gray-300"
        }`}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/skills/__tests__/ViewToggle.test.tsx`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/ViewToggle.tsx src/components/skills/__tests__/ViewToggle.test.tsx
git commit -m "feat(skills): add ViewToggle component for grid/list switching"
```

---

### Task 6: Build SkillGrid Component (Grid View)

**Files:**
- Create: `src/components/skills/SkillGrid.tsx`
- Create: `src/components/skills/__tests__/SkillGrid.test.tsx`

- [ ] **Step 1: Write tests for SkillGrid**

Create `src/components/skills/__tests__/SkillGrid.test.tsx`:

```typescript
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillGrid } from "../SkillGrid";

const mockSkills = [
  {
    _id: "s1" as any,
    name: "gsd-plan-phase",
    displayName: "Plan Phase",
    description: "Create detailed plans",
    categoryIcon: "📋",
    categoryColor: "indigo",
    categoryName: "gsd",
    hidden: false,
    isAutoAssigned: false,
    useCount: 5,
    discoveredAt: 0,
    _creationTime: 0,
  },
  {
    _id: "s2" as any,
    name: "legal-nda",
    displayName: "NDA Generator",
    description: "Draft NDAs",
    categoryIcon: "⚖️",
    categoryColor: "red",
    categoryName: "legal",
    hidden: false,
    isAutoAssigned: true,
    useCount: 0,
    discoveredAt: 0,
    _creationTime: 0,
  },
];

describe("SkillGrid", () => {
  test("renders skill cards with display names", () => {
    render(
      <SkillGrid
        skills={mockSkills}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.getByText("Plan Phase")).toBeInTheDocument();
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
  });

  test("renders category icons on cards", () => {
    render(
      <SkillGrid
        skills={mockSkills}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.getByText("📋")).toBeInTheDocument();
    expect(screen.getByText("⚖️")).toBeInTheDocument();
  });

  test("calls onLaunch with skill name when card clicked", () => {
    const onLaunch = vi.fn();
    render(
      <SkillGrid skills={mockSkills} editMode={false} onLaunch={onLaunch} />
    );
    fireEvent.click(screen.getByText("Plan Phase"));
    expect(onLaunch).toHaveBeenCalledWith("gsd-plan-phase");
  });

  test("shows dashed border on auto-assigned skills in edit mode", () => {
    const { container } = render(
      <SkillGrid
        skills={mockSkills}
        editMode={true}
        onLaunch={vi.fn()}
      />
    );
    const cards = container.querySelectorAll("[data-skill]");
    const ndaCard = Array.from(cards).find(
      (c) => c.getAttribute("data-skill") === "legal-nda"
    );
    expect(ndaCard?.className).toContain("border-dashed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/__tests__/SkillGrid.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SkillGrid**

Create `src/components/skills/SkillGrid.tsx`:

```tsx
import { Pencil } from "lucide-react";

interface EnrichedSkill {
  _id: any;
  name: string;
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  categoryIcon: string;
  categoryColor: string;
  categoryName: string | null;
  hidden: boolean;
  isAutoAssigned: boolean;
  useCount?: number;
}

interface SkillGridProps {
  skills: EnrichedSkill[];
  editMode: boolean;
  onLaunch: (skillName: string) => void;
  onEditSkill?: (skillName: string) => void;
}

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-600/20 border-indigo-500/30",
  red: "bg-red-600/20 border-red-500/30",
  purple: "bg-purple-600/20 border-purple-500/30",
  amber: "bg-amber-600/20 border-amber-500/30",
  cyan: "bg-cyan-600/20 border-cyan-500/30",
  emerald: "bg-emerald-600/20 border-emerald-500/30",
  violet: "bg-violet-600/20 border-violet-500/30",
  blue: "bg-blue-600/20 border-blue-500/30",
  orange: "bg-orange-600/20 border-orange-500/30",
  pink: "bg-pink-600/20 border-pink-500/30",
  teal: "bg-teal-600/20 border-teal-500/30",
  rose: "bg-rose-600/20 border-rose-500/30",
  green: "bg-green-600/20 border-green-500/30",
  yellow: "bg-yellow-600/20 border-yellow-500/30",
  gray: "bg-gray-600/20 border-gray-500/30",
};

const ICON_BG_MAP: Record<string, string> = {
  indigo: "bg-indigo-600",
  red: "bg-red-600",
  purple: "bg-purple-600",
  amber: "bg-amber-600",
  cyan: "bg-cyan-600",
  emerald: "bg-emerald-600",
  violet: "bg-violet-600",
  blue: "bg-blue-600",
  orange: "bg-orange-600",
  pink: "bg-pink-600",
  teal: "bg-teal-600",
  rose: "bg-rose-600",
  green: "bg-green-600",
  yellow: "bg-yellow-600",
  gray: "bg-gray-600",
};

export function SkillGrid({
  skills,
  editMode,
  onLaunch,
  onEditSkill,
}: SkillGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {skills.map((skill) => {
        const colorClasses =
          COLOR_MAP[skill.categoryColor] ?? COLOR_MAP.gray;
        const iconBg =
          ICON_BG_MAP[skill.categoryColor] ?? ICON_BG_MAP.gray;
        const desc =
          skill.overrideDescription ?? skill.description ?? "";

        return (
          <button
            key={skill.name}
            data-skill={skill.name}
            onClick={() =>
              editMode ? onEditSkill?.(skill.name) : onLaunch(skill.name)
            }
            className={`relative text-left rounded-xl border p-4 transition-all hover:scale-[1.02] hover:shadow-lg ${colorClasses} ${
              editMode && skill.isAutoAssigned
                ? "border-dashed border-indigo-400"
                : ""
            }`}
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div
                className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center text-xl`}
              >
                {skill.categoryIcon}
              </div>
              <div className="text-sm font-semibold text-white">
                {skill.displayName}
              </div>
              {desc && (
                <div className="text-xs text-gray-400 line-clamp-2">
                  {desc}
                </div>
              )}
            </div>
            {editMode && (
              <div className="absolute top-2 right-2 text-gray-500 hover:text-indigo-400">
                <Pencil className="w-3.5 h-3.5" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/skills/__tests__/SkillGrid.test.tsx`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/SkillGrid.tsx src/components/skills/__tests__/SkillGrid.test.tsx
git commit -m "feat(skills): add SkillGrid component with color-coded category cards"
```

---

### Task 7: Build SkillList Component (List View)

**Files:**
- Create: `src/components/skills/SkillList.tsx`
- Create: `src/components/skills/__tests__/SkillList.test.tsx`

- [ ] **Step 1: Write tests for SkillList**

Create `src/components/skills/__tests__/SkillList.test.tsx`:

```typescript
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillList } from "../SkillList";

const mockCategories = [
  {
    _id: "1" as any,
    name: "gsd",
    displayName: "Project Management",
    icon: "📋",
    color: "indigo",
    description: "Planning and execution",
    sortOrder: 0,
    _creationTime: 0,
  },
  {
    _id: "2" as any,
    name: "legal",
    displayName: "Legal",
    icon: "⚖️",
    color: "red",
    description: "Contracts and compliance",
    sortOrder: 1,
    _creationTime: 0,
  },
];

const mockSkills = [
  {
    _id: "s1" as any,
    name: "gsd-plan-phase",
    displayName: "Plan Phase",
    description: "Create detailed plans",
    categoryIcon: "📋",
    categoryColor: "indigo",
    categoryName: "gsd",
    hidden: false,
    isAutoAssigned: false,
    useCount: 5,
    discoveredAt: 0,
    _creationTime: 0,
  },
  {
    _id: "s2" as any,
    name: "legal-nda",
    displayName: "NDA Generator",
    description: "Draft NDAs",
    categoryIcon: "⚖️",
    categoryColor: "red",
    categoryName: "legal",
    hidden: false,
    isAutoAssigned: false,
    useCount: 0,
    discoveredAt: 0,
    _creationTime: 0,
  },
];

describe("SkillList", () => {
  test("renders category headers with icons and counts", () => {
    render(
      <SkillList
        skills={mockSkills}
        categories={mockCategories}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.getByText("📋")).toBeInTheDocument();
    expect(screen.getByText("Project Management")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  test("renders skill cards within their category section", () => {
    render(
      <SkillList
        skills={mockSkills}
        categories={mockCategories}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.getByText("Plan Phase")).toBeInTheDocument();
    expect(screen.getByText("NDA Generator")).toBeInTheDocument();
  });

  test("calls onLaunch when skill card clicked", () => {
    const onLaunch = vi.fn();
    render(
      <SkillList
        skills={mockSkills}
        categories={mockCategories}
        editMode={false}
        onLaunch={onLaunch}
      />
    );
    fireEvent.click(screen.getByText("Plan Phase"));
    expect(onLaunch).toHaveBeenCalledWith("gsd-plan-phase");
  });

  test("hides empty categories", () => {
    const emptyCategory = {
      _id: "3" as any,
      name: "empty",
      displayName: "Empty Cat",
      icon: "🔮",
      color: "gray",
      description: "",
      sortOrder: 2,
      _creationTime: 0,
    };
    render(
      <SkillList
        skills={mockSkills}
        categories={[...mockCategories, emptyCategory]}
        editMode={false}
        onLaunch={vi.fn()}
      />
    );
    expect(screen.queryByText("Empty Cat")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/__tests__/SkillList.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SkillList**

Create `src/components/skills/SkillList.tsx`:

```tsx
import { Pencil } from "lucide-react";
import { Doc } from "../../../convex/_generated/dataModel";

type Category = Doc<"skillCategories">;

interface EnrichedSkill {
  _id: any;
  name: string;
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  categoryIcon: string;
  categoryColor: string;
  categoryName: string | null;
  hidden: boolean;
  isAutoAssigned: boolean;
  useCount?: number;
}

interface SkillListProps {
  skills: EnrichedSkill[];
  categories: Category[];
  editMode: boolean;
  onLaunch: (skillName: string) => void;
  onEditSkill?: (skillName: string) => void;
}

export function SkillList({
  skills,
  categories,
  editMode,
  onLaunch,
  onEditSkill,
}: SkillListProps) {
  const grouped = new Map<string, EnrichedSkill[]>();
  for (const skill of skills) {
    const cat = skill.categoryName ?? "uncategorized";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(skill);
  }

  return (
    <div className="space-y-6">
      {categories
        .filter((cat) => (grouped.get(cat.name)?.length ?? 0) > 0)
        .map((cat) => {
          const catSkills = grouped.get(cat.name) ?? [];
          return (
            <div key={cat.name}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700/50">
                <span className="text-lg">{cat.icon}</span>
                <div className="flex-1">
                  <div className="text-white text-sm font-semibold">
                    {cat.displayName}
                  </div>
                  {cat.description && (
                    <div className="text-gray-500 text-xs">
                      {cat.description}
                    </div>
                  )}
                </div>
                <span className="bg-gray-700/50 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                  {catSkills.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {catSkills.map((skill) => {
                  const desc =
                    skill.overrideDescription ?? skill.description ?? "";
                  return (
                    <button
                      key={skill.name}
                      data-skill={skill.name}
                      onClick={() =>
                        editMode
                          ? onEditSkill?.(skill.name)
                          : onLaunch(skill.name)
                      }
                      className={`text-left bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 hover:bg-gray-700/50 transition-colors ${
                        editMode && skill.isAutoAssigned
                          ? "border-dashed border-indigo-400"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs font-semibold truncate">
                            {skill.displayName}
                          </div>
                          {desc && (
                            <div className="text-gray-500 text-[11px] mt-0.5 truncate">
                              {desc}
                            </div>
                          )}
                        </div>
                        {editMode && (
                          <Pencil className="w-3 h-3 text-gray-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/skills/__tests__/SkillList.test.tsx`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/SkillList.tsx src/components/skills/__tests__/SkillList.test.tsx
git commit -m "feat(skills): add SkillList component with category-grouped sections"
```

---

### Task 8: Build Edit Popovers — SkillEditPopover and CategoryEditPopover

**Files:**
- Create: `src/components/skills/SkillEditPopover.tsx`
- Create: `src/components/skills/CategoryEditPopover.tsx`
- Create: `src/components/skills/__tests__/SkillEditPopover.test.tsx`
- Create: `src/components/skills/__tests__/CategoryEditPopover.test.tsx`

- [ ] **Step 1: Write tests for SkillEditPopover**

Create `src/components/skills/__tests__/SkillEditPopover.test.tsx`:

```typescript
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillEditPopover } from "../SkillEditPopover";

const mockCategories = [
  { name: "gsd", displayName: "Project Management", icon: "📋" },
  { name: "legal", displayName: "Legal", icon: "⚖️" },
];

describe("SkillEditPopover", () => {
  test("renders with pre-filled values", () => {
    render(
      <SkillEditPopover
        skillName="gsd-plan-phase"
        displayName="Plan Phase"
        description="Create detailed plans"
        categoryName="gsd"
        hidden={false}
        categories={mockCategories}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("Plan Phase")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Create detailed plans")).toBeInTheDocument();
  });

  test("calls onSave with updated values", () => {
    const onSave = vi.fn();
    render(
      <SkillEditPopover
        skillName="gsd-plan-phase"
        displayName="Plan Phase"
        description=""
        categoryName="gsd"
        hidden={false}
        categories={mockCategories}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    const nameInput = screen.getByDisplayValue("Plan Phase");
    fireEvent.change(nameInput, { target: { value: "Phase Planner" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Phase Planner" })
    );
  });

  test("calls onCancel when cancel clicked", () => {
    const onCancel = vi.fn();
    render(
      <SkillEditPopover
        skillName="gsd-plan-phase"
        displayName="Plan Phase"
        description=""
        categoryName="gsd"
        hidden={false}
        categories={mockCategories}
        onSave={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/__tests__/SkillEditPopover.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SkillEditPopover**

Create `src/components/skills/SkillEditPopover.tsx`:

```tsx
import { useState } from "react";

interface CategoryOption {
  name: string;
  displayName: string;
  icon: string;
}

interface SkillEditPopoverProps {
  skillName: string;
  displayName: string;
  description: string;
  categoryName: string;
  hidden: boolean;
  categories: CategoryOption[];
  onSave: (updates: {
    displayName: string;
    description: string;
    categoryName: string;
    hidden: boolean;
  }) => void;
  onCancel: () => void;
}

export function SkillEditPopover({
  displayName: initialName,
  description: initialDesc,
  categoryName: initialCategory,
  hidden: initialHidden,
  categories,
  onSave,
  onCancel,
}: SkillEditPopoverProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);
  const [categoryName, setCategoryName] = useState(initialCategory);
  const [hidden, setHidden] = useState(initialHidden);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl w-72 space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Display Name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Category</label>
        <select
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          {categories.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.icon} {cat.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">Hidden</label>
        <button
          onClick={() => setHidden(!hidden)}
          className={`w-10 h-5 rounded-full transition-colors ${
            hidden ? "bg-indigo-600" : "bg-gray-700"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              hidden ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onSave({ displayName, description, categoryName, hidden })
          }
          className="flex-1 bg-indigo-600 text-white text-sm py-1.5 rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-800 text-gray-300 text-sm py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write tests for CategoryEditPopover**

Create `src/components/skills/__tests__/CategoryEditPopover.test.tsx`:

```typescript
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryEditPopover } from "../CategoryEditPopover";

describe("CategoryEditPopover", () => {
  test("renders with pre-filled values", () => {
    render(
      <CategoryEditPopover
        displayName="Project Management"
        description="Planning and execution"
        icon="📋"
        color="indigo"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        canDelete={true}
      />
    );
    expect(
      screen.getByDisplayValue("Project Management")
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("📋")).toBeInTheDocument();
  });

  test("calls onSave with updated values", () => {
    const onSave = vi.fn();
    render(
      <CategoryEditPopover
        displayName="GSD"
        description=""
        icon="📋"
        color="indigo"
        onSave={onSave}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        canDelete={false}
      />
    );
    const nameInput = screen.getByDisplayValue("GSD");
    fireEvent.change(nameInput, {
      target: { value: "Project Management" },
    });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: "Project Management" })
    );
  });

  test("disables delete button when canDelete is false", () => {
    render(
      <CategoryEditPopover
        displayName="Legal"
        description=""
        icon="⚖️"
        color="red"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        canDelete={false}
      />
    );
    const deleteBtn = screen.getByText("Delete");
    expect(deleteBtn).toBeDisabled();
  });
});
```

- [ ] **Step 5: Implement CategoryEditPopover**

Create `src/components/skills/CategoryEditPopover.tsx`:

```tsx
import { useState } from "react";

const COLORS = [
  "indigo",
  "emerald",
  "amber",
  "red",
  "purple",
  "cyan",
  "pink",
  "orange",
  "gray",
  "violet",
];

const COLOR_CLASSES: Record<string, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  cyan: "bg-cyan-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  gray: "bg-gray-500",
  violet: "bg-violet-500",
};

interface CategoryEditPopoverProps {
  displayName: string;
  description: string;
  icon: string;
  color: string;
  onSave: (updates: {
    displayName: string;
    description: string;
    icon: string;
    color: string;
  }) => void;
  onCancel: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

export function CategoryEditPopover({
  displayName: initialName,
  description: initialDesc,
  icon: initialIcon,
  color: initialColor,
  onSave,
  onCancel,
  onDelete,
  canDelete,
}: CategoryEditPopoverProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl w-72 space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Display Name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Icon (emoji)</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          maxLength={4}
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full ${COLOR_CLASSES[c]} ${
                color === c
                  ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900"
                  : ""
              }`}
              title={c}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ displayName, description, icon, color })}
          className="flex-1 bg-indigo-600 text-white text-sm py-1.5 rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-800 text-gray-300 text-sm py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={`w-full text-xs py-1.5 rounded-lg transition-colors ${
          canDelete
            ? "text-red-400 hover:bg-red-900/30"
            : "text-gray-600 cursor-not-allowed"
        }`}
      >
        Delete
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Run all edit popover tests**

Run: `npx vitest run src/components/skills/__tests__/SkillEditPopover.test.tsx src/components/skills/__tests__/CategoryEditPopover.test.tsx`
Expected: All 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/skills/SkillEditPopover.tsx src/components/skills/CategoryEditPopover.tsx src/components/skills/__tests__/SkillEditPopover.test.tsx src/components/skills/__tests__/CategoryEditPopover.test.tsx
git commit -m "feat(skills): add SkillEditPopover and CategoryEditPopover inline editors"
```

---

### Task 9: Build NewSkillsBanner and EditModeToggle Components

**Files:**
- Create: `src/components/skills/NewSkillsBanner.tsx`
- Create: `src/components/skills/EditModeToggle.tsx`
- Create: `src/components/skills/__tests__/NewSkillsBanner.test.tsx`

- [ ] **Step 1: Write tests for NewSkillsBanner**

Create `src/components/skills/__tests__/NewSkillsBanner.test.tsx`:

```typescript
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewSkillsBanner } from "../NewSkillsBanner";

describe("NewSkillsBanner", () => {
  test("renders count of new skills", () => {
    render(
      <NewSkillsBanner count={5} onReview={vi.fn()} onAcceptAll={vi.fn()} />
    );
    expect(
      screen.getByText(/5 new skills auto-categorized/)
    ).toBeInTheDocument();
  });

  test("returns null when count is 0", () => {
    const { container } = render(
      <NewSkillsBanner count={0} onReview={vi.fn()} onAcceptAll={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("calls onReview when Review button clicked", () => {
    const onReview = vi.fn();
    render(
      <NewSkillsBanner count={3} onReview={onReview} onAcceptAll={vi.fn()} />
    );
    fireEvent.click(screen.getByText("Review"));
    expect(onReview).toHaveBeenCalled();
  });

  test("calls onAcceptAll when Accept All clicked", () => {
    const onAcceptAll = vi.fn();
    render(
      <NewSkillsBanner
        count={3}
        onReview={vi.fn()}
        onAcceptAll={onAcceptAll}
      />
    );
    fireEvent.click(screen.getByText("Accept All"));
    expect(onAcceptAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/skills/__tests__/NewSkillsBanner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement NewSkillsBanner**

Create `src/components/skills/NewSkillsBanner.tsx`:

```tsx
interface NewSkillsBannerProps {
  count: number;
  onReview: () => void;
  onAcceptAll: () => void;
}

export function NewSkillsBanner({
  count,
  onReview,
  onAcceptAll,
}: NewSkillsBannerProps) {
  if (count === 0) return null;

  return (
    <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-lg px-4 py-2.5 flex items-center gap-3">
      <span className="text-sm text-indigo-200">
        {count} new skill{count !== 1 ? "s" : ""} auto-categorized.
      </span>
      <button
        onClick={onReview}
        className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        Review
      </button>
      <button
        onClick={onAcceptAll}
        className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors"
      >
        Accept All
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implement EditModeToggle**

Create `src/components/skills/EditModeToggle.tsx`:

```tsx
import { Settings } from "lucide-react";

interface EditModeToggleProps {
  editMode: boolean;
  onToggle: () => void;
}

export function EditModeToggle({ editMode, onToggle }: EditModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={editMode ? "Exit edit mode" : "Edit skills & categories"}
      className={`p-1.5 rounded-lg transition-colors ${
        editMode
          ? "bg-indigo-600 text-white"
          : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
      }`}
    >
      <Settings className="w-4 h-4" />
    </button>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/components/skills/__tests__/NewSkillsBanner.test.tsx`
Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/skills/NewSkillsBanner.tsx src/components/skills/EditModeToggle.tsx src/components/skills/__tests__/NewSkillsBanner.test.tsx
git commit -m "feat(skills): add NewSkillsBanner and EditModeToggle components"
```

---

### Task 10: Restyle FrequentSkills as Pill Strip

**Files:**
- Modify: `src/components/skills/FrequentSkills.tsx`

- [ ] **Step 1: Rewrite FrequentSkills to accept enriched skills and show category-colored pills**

Replace the contents of `src/components/skills/FrequentSkills.tsx` with:

```tsx
interface EnrichedSkill {
  name: string;
  displayName: string;
  categoryColor: string;
  useCount?: number;
}

interface FrequentSkillsProps {
  skills: EnrichedSkill[];
  onLaunch: (skillName: string) => void;
}

const PILL_COLORS: Record<string, string> = {
  indigo: "from-indigo-600 to-indigo-500",
  red: "from-red-600 to-red-500",
  purple: "from-purple-600 to-purple-500",
  amber: "from-amber-600 to-amber-500",
  cyan: "from-cyan-600 to-cyan-500",
  emerald: "from-emerald-600 to-emerald-500",
  violet: "from-violet-600 to-violet-500",
  blue: "from-blue-600 to-blue-500",
  orange: "from-orange-600 to-orange-500",
  pink: "from-pink-600 to-pink-500",
  teal: "from-teal-600 to-teal-500",
  rose: "from-rose-600 to-rose-500",
  green: "from-green-600 to-green-500",
  yellow: "from-yellow-600 to-yellow-500",
  gray: "from-gray-600 to-gray-500",
};

export function FrequentSkills({ skills, onLaunch }: FrequentSkillsProps) {
  const frequent = skills
    .filter((s) => (s.useCount ?? 0) >= 1)
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
    .slice(0, 6);

  if (frequent.length === 0) return null;

  return (
    <div>
      <div className="text-gray-500 text-[11px] uppercase tracking-wider mb-2">
        Frequently Used
      </div>
      <div className="flex gap-2 flex-wrap">
        {frequent.map((skill) => {
          const gradient =
            PILL_COLORS[skill.categoryColor] ?? PILL_COLORS.gray;
          return (
            <button
              key={skill.name}
              onClick={() => onLaunch(skill.name)}
              className={`bg-gradient-to-r ${gradient} text-white text-xs font-medium px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity`}
            >
              {skill.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run existing FrequentSkills tests (if any) to verify nothing regresses**

Run: `npx vitest run --reporter=verbose 2>&1 | head -5` (quick check that no tests broke)

Run: `npx vitest run src/components/skills/`
Expected: All existing skill tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/skills/FrequentSkills.tsx
git commit -m "feat(skills): restyle FrequentSkills as category-colored pill strip"
```

---

### Task 11: Rewrite Skills Page — Full Integration

**Files:**
- Modify: `src/pages/Skills.tsx` (full rewrite)

- [ ] **Step 1: Rewrite Skills.tsx**

Replace the contents of `src/pages/Skills.tsx` with the full integrated page:

```tsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CategoryTabs } from "@/components/skills/CategoryTabs";
import { ViewToggle, type SkillsView } from "@/components/skills/ViewToggle";
import { EditModeToggle } from "@/components/skills/EditModeToggle";
import { SkillGrid } from "@/components/skills/SkillGrid";
import { SkillList } from "@/components/skills/SkillList";
import { FrequentSkills } from "@/components/skills/FrequentSkills";
import { NewSkillsBanner } from "@/components/skills/NewSkillsBanner";
import { SkillEditPopover } from "@/components/skills/SkillEditPopover";
import { CategoryEditPopover } from "@/components/skills/CategoryEditPopover";
import type { Doc } from "../../convex/_generated/dataModel";

function getStoredView(): SkillsView {
  return (localStorage.getItem("codepulse-skills-view") as SkillsView) ?? "grid";
}

export default function Skills() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [view, setView] = useState<SkillsView>(getStoredView);
  const [editMode, setEditMode] = useState(false);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Doc<"skillCategories"> | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const enrichedSkills = useQuery(api.skillCategories.getSkillsWithOverrides) ?? [];
  const categories = useQuery(api.skillCategories.listCategories) ?? [];
  const autoAssignedCount = useQuery(api.skillCategories.countAutoAssigned) ?? 0;

  const recordLaunch = useMutation(api.registry.recordSkillLaunch);
  const updateOverride = useMutation(api.skillCategories.updateSkillOverride);
  const updateCat = useMutation(api.skillCategories.updateCategory);
  const createCat = useMutation(api.skillCategories.createCategory);
  const deleteCat = useMutation(api.skillCategories.deleteCategory);
  const bulkAccept = useMutation(api.skillCategories.bulkAcceptAutoAssigned);
  const seedAll = useMutation(api.skillCategories.seedExistingSkills);

  const visibleSkills = useMemo(() => {
    let filtered = enrichedSkills.filter((s) => !s.hidden);
    if (activeCategory) {
      filtered = filtered.filter((s) => s.categoryName === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (s.overrideDescription ?? "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [enrichedSkills, activeCategory, search]);

  const handleLaunch = async (skillName: string) => {
    await recordLaunch({ name: skillName });
    navigate(`/chat?skill=${encodeURIComponent(skillName)}`);
  };

  const handleViewChange = (v: SkillsView) => {
    setView(v);
    localStorage.setItem("codepulse-skills-view", v);
  };

  const handleSaveSkillOverride = async (updates: {
    displayName: string;
    description: string;
    categoryName: string;
    hidden: boolean;
  }) => {
    if (!editingSkill) return;
    await updateOverride({
      skillName: editingSkill,
      ...updates,
    });
    setEditingSkill(null);
  };

  const handleSaveCategory = async (updates: {
    displayName: string;
    description: string;
    icon: string;
    color: string;
  }) => {
    if (editingCategory) {
      await updateCat({ id: editingCategory._id, ...updates });
      setEditingCategory(null);
    }
  };

  const handleCreateCategory = async (data: {
    displayName: string;
    description: string;
    icon: string;
    color: string;
  }) => {
    const name = data.displayName.toLowerCase().replace(/\s+/g, "-");
    await createCat({
      name,
      ...data,
      sortOrder: Date.now(),
    });
    setCreatingCategory(false);
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    await deleteCat({ id: editingCategory._id });
    setEditingCategory(null);
  };

  const handleReviewNew = () => {
    setEditMode(true);
  };

  const needsSeed = enrichedSkills.length > 0 && categories.length === 0;

  const editingSkillData = editingSkill
    ? enrichedSkills.find((s) => s.name === editingSkill)
    : null;

  const editingCategorySkillCount = editingCategory
    ? enrichedSkills.filter((s) => s.categoryName === editingCategory.name).length
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white font-heading">
          Skills
        </h1>
        {editMode && (
          <span className="text-xs text-indigo-400 bg-indigo-900/30 px-2 py-1 rounded">
            Edit Mode
          </span>
        )}
      </div>

      {needsSeed && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 text-center">
          <p className="text-gray-300 mb-3">
            Skills found but no categories set up yet.
          </p>
          <button
            onClick={() => seedAll()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors text-sm"
          >
            Set Up Categories
          </button>
        </div>
      )}

      {!needsSeed && (
        <>
          <input
            type="text"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onSelect={setActiveCategory}
                editMode={editMode}
                onEditCategory={setEditingCategory}
                onAddCategory={() => setCreatingCategory(true)}
              />
            </div>
            <ViewToggle view={view} onChange={handleViewChange} />
            <EditModeToggle
              editMode={editMode}
              onToggle={() => setEditMode(!editMode)}
            />
          </div>

          {autoAssignedCount > 0 && (
            <NewSkillsBanner
              count={autoAssignedCount}
              onReview={handleReviewNew}
              onAcceptAll={() => bulkAccept()}
            />
          )}

          <FrequentSkills skills={enrichedSkills} onLaunch={handleLaunch} />

          {view === "grid" ? (
            <SkillGrid
              skills={visibleSkills}
              editMode={editMode}
              onLaunch={handleLaunch}
              onEditSkill={setEditingSkill}
            />
          ) : (
            <SkillList
              skills={visibleSkills}
              categories={categories}
              editMode={editMode}
              onLaunch={handleLaunch}
              onEditSkill={setEditingSkill}
            />
          )}
        </>
      )}

      {editingSkillData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SkillEditPopover
            skillName={editingSkillData.name}
            displayName={editingSkillData.displayName}
            description={
              editingSkillData.overrideDescription ??
              editingSkillData.description ??
              ""
            }
            categoryName={editingSkillData.categoryName ?? "uncategorized"}
            hidden={editingSkillData.hidden}
            categories={categories.map((c) => ({
              name: c.name,
              displayName: c.displayName,
              icon: c.icon,
            }))}
            onSave={handleSaveSkillOverride}
            onCancel={() => setEditingSkill(null)}
          />
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <CategoryEditPopover
            displayName={editingCategory.displayName}
            description={editingCategory.description}
            icon={editingCategory.icon}
            color={editingCategory.color}
            onSave={handleSaveCategory}
            onCancel={() => setEditingCategory(null)}
            onDelete={handleDeleteCategory}
            canDelete={editingCategorySkillCount === 0}
          />
        </div>
      )}

      {creatingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <CategoryEditPopover
            displayName=""
            description=""
            icon="⚡"
            color="gray"
            onSave={handleCreateCategory}
            onCancel={() => setCreatingCategory(false)}
            onDelete={() => {}}
            canDelete={false}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run all tests to verify nothing regresses**

Run: `npx vitest run`
Expected: All tests pass. Some existing Skills tests may need updating if they relied on the old component structure — fix any that break.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Skills.tsx
git commit -m "feat(skills): rewrite Skills page with dual views, edit mode, and category tabs"
```

---

### Task 12: Clean Up Old Components

**Files:**
- Delete: `src/components/skills/SkillCategoryAccordion.tsx`
- Delete: `src/lib/skillCategories.ts`
- Modify: any test files that import the deleted modules

- [ ] **Step 1: Search for imports of the old modules**

Run: `grep -r "SkillCategoryAccordion\|skillCategories" src/ --include="*.ts" --include="*.tsx" -l`

This will show any files still importing the old modules. Remove or update those imports.

- [ ] **Step 2: Delete old files**

```bash
rm src/components/skills/SkillCategoryAccordion.tsx
rm src/lib/skillCategories.ts
```

Delete associated test files if they exist:
```bash
rm -f src/components/skills/__tests__/SkillCategoryAccordion.test.tsx
rm -f src/lib/__tests__/skillCategories.test.ts
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass. No broken imports.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(skills): remove old SkillCategoryAccordion and skillCategories prefix logic"
```

---

### Task 13: Verify End-to-End in Browser

**Files:** None (verification only)

- [ ] **Step 1: Start dev server and Convex backend**

Run in two terminals:
```bash
npm run dev
npm run dev:backend
```

- [ ] **Step 2: Navigate to /skills and verify the seed CTA**

Open `http://localhost:5173/skills`.
Expected: If no categories exist yet, see "Skills found but no categories set up yet." with a "Set Up Categories" button.

- [ ] **Step 3: Click "Set Up Categories" and verify auto-categorization**

Click the button.
Expected: Page populates with category tabs, skill cards appear in grid view, categories have default icons and colors.

- [ ] **Step 4: Test view toggle**

Click the list icon (☰).
Expected: View switches to grouped list with category headers.
Click grid icon (⊞).
Expected: View switches back to grid.

- [ ] **Step 5: Test search**

Type a skill name in the search bar.
Expected: Skills filter in real-time across both views.

- [ ] **Step 6: Test edit mode**

Click the gear icon.
Expected: Edit mode activates — pencil icons appear on cards, edit icons on category tabs, "+ Add" tab appears.

- [ ] **Step 7: Edit a skill**

Click a skill card in edit mode.
Expected: Popover appears with display name, description, category dropdown, hidden toggle.
Change the display name and save.
Expected: Skill card updates immediately.

- [ ] **Step 8: Edit a category**

Click the edit icon on a category tab.
Expected: Popover with display name, description, icon, color swatches.
Change the icon and color, save.
Expected: Category tab and card colors update.

- [ ] **Step 9: Test launch still works**

Exit edit mode (click gear again).
Click a skill card.
Expected: Navigates to `/chat?skill={name}`.

- [ ] **Step 10: Run full test suite one final time**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 11: Commit any fixes from verification**

```bash
git add -A
git commit -m "fix(skills): address issues found during browser verification"
```
