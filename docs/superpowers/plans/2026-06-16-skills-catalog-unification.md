# Skills Catalog Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface local Claude Code skills (personal + plugin + per-repo project) in CodePulse's live Skills browser alongside Ástríðr's, kept current automatically via the existing SessionStart scanner.

**Architecture:** Skills become identity `(name, origin)` so multiple feeders coexist; registry pruning is per-origin. The local host feeder is the existing `hooks/scanner.mjs` (run by the existing SessionStart hook), extended to walk `SKILL.md` directories and tag origin `claude-code` / `claude-code:project:<repoKey>`. Ástríðr already feeds via `capability_sync` (verify-only).

**Tech Stack:** Convex (TypeScript mutations/queries), React 19 + Tailwind, Node ESM scanner, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-skills-catalog-unification-design.md`

---

## File Structure

- `convex/skillSync.ts` — **new**, pure helpers: `normalizeOrigin`, `computeSkillPrunes`, `groupSkillRowsByName`. Holds all testable sync logic, no Convex `ctx`.
- `convex/__tests__/skillSync.test.ts` — **new**, unit tests for the above.
- `convex/schema.ts` — **modify**, add `by_name_origin` index to `skills`.
- `convex/registry.ts` — **modify**, `syncInventory` + `syncFullInventory` skill sections, `importSkills`, `repairSkillsFromOverrides`, new `normalizeLegacySkillOrigins`.
- `convex/skillCategories.ts` — **modify**, `getSkillsWithOverrides` groups rows by name.
- `src/components/OriginBadge.tsx` — **modify**, add `claude-code` / project / `unknown` styles.
- `src/pages/Skills.tsx` — **modify**, add origin filter.
- `hooks/skillScan.mjs` — **new**, pure-ish scan helpers (frontmatter parse, repoKey, skill-dir collection).
- `hooks/__tests__/skillScan.test.mjs` — **new**, tests.
- `hooks/scanner.mjs` — **modify**, collect directory skills + bearer auth + dry-run.
- `hooks/codepulse-hook.mjs` — **modify**, resolve & pass `ASTRIDR_INGEST_API_KEY` to the scanner.
- `vitest.config.ts` — **modify**, include `hooks/**/*.test.mjs`.

---

## Task 1: Pure sync helpers (normalizeOrigin, computeSkillPrunes, groupSkillRowsByName)

**Files:**
- Create: `convex/skillSync.ts`
- Test: `convex/__tests__/skillSync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/__tests__/skillSync.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeOrigin,
  computeSkillPrunes,
  groupSkillRowsByName,
} from "../skillSync";

describe("normalizeOrigin", () => {
  it("passes through a non-empty origin", () => {
    expect(normalizeOrigin("claude-code")).toBe("claude-code");
  });
  it("maps missing/empty origin to 'unknown'", () => {
    expect(normalizeOrigin(undefined)).toBe("unknown");
    expect(normalizeOrigin(null)).toBe("unknown");
    expect(normalizeOrigin("   ")).toBe("unknown");
  });
});

describe("computeSkillPrunes", () => {
  const cc = { _id: "1", name: "deploy", origin: "claude-code" };
  const ccGone = { _id: "2", name: "old-cc", origin: "claude-code" };
  const native = { _id: "3", name: "asi-briefing", origin: "cc" };
  const proj = { _id: "4", name: "repo-skill", origin: "claude-code:project:abc" };

  it("prunes only same-origin rows absent from the snapshot", () => {
    const prunes = computeSkillPrunes(
      [cc, ccGone, native, proj],
      [{ name: "deploy", origin: "claude-code" }]
    );
    expect(prunes.map((p) => p._id)).toEqual(["2"]); // ccGone only
  });

  it("never prunes an origin absent from the snapshot", () => {
    const prunes = computeSkillPrunes(
      [cc, native],
      [{ name: "asi-briefing", origin: "cc" }] // only native origin present
    );
    expect(prunes.map((p) => p._id)).toEqual([]); // cc untouched
  });

  it("handles a multi-origin snapshot with per-origin name sets", () => {
    // 'deploy' exists under claude-code; a project row with the SAME name
    // must NOT be preserved by the global presence of 'deploy'.
    const projDeployGone = { _id: "5", name: "deploy", origin: "claude-code:project:abc" };
    const prunes = computeSkillPrunes(
      [cc, projDeployGone],
      [
        { name: "deploy", origin: "claude-code" },
        { name: "repo-skill", origin: "claude-code:project:abc" },
      ]
    );
    expect(prunes.map((p) => p._id)).toEqual(["5"]); // project 'deploy' pruned
  });

  it("treats missing origin as 'unknown' on both sides", () => {
    const legacy = { _id: "6", name: "legacy", origin: undefined };
    const prunes = computeSkillPrunes([legacy], [{ name: "other" }]);
    expect(prunes.map((p) => p._id)).toEqual(["6"]);
  });
});

describe("groupSkillRowsByName", () => {
  it("collapses (name, origin) rows into one entry with sorted origins", () => {
    const grouped = groupSkillRowsByName([
      { name: "deploy", origin: "cc", discoveredAt: 10, useCount: 2 },
      { name: "deploy", origin: "claude-code", discoveredAt: 5, description: "Deploy it", useCount: 3, lastUsedAt: 99 },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].origins).toEqual(["cc", "claude-code"]);
    expect(grouped[0].description).toBe("Deploy it");
    expect(grouped[0].discoveredAt).toBe(5);
    expect(grouped[0].useCount).toBe(5);
    expect(grouped[0].lastUsedAt).toBe(99);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/__tests__/skillSync.test.ts`
Expected: FAIL — cannot find module `../skillSync`.

- [ ] **Step 3: Write minimal implementation**

Create `convex/skillSync.ts`:

```ts
// Pure helpers for skill registry sync — unit-tested in isolation (no Convex ctx).

export type SkillRow = { _id: string; name: string; origin?: string | null };
export type IncomingSkill = { name: string; origin?: string | null };

/** Normalize a possibly-missing origin to a stable, non-empty string. */
export function normalizeOrigin(origin?: string | null): string {
  const o = (origin ?? "").trim();
  return o.length > 0 ? o : "unknown";
}

/**
 * Decide which existing skill rows to delete given an incoming snapshot.
 * Pruning is PER-ORIGIN: only origins present in the incoming snapshot are
 * eligible, and within each such origin only names absent from that origin's
 * incoming set are removed. Origins not present in the snapshot are untouched,
 * so other feeders' skills survive.
 */
export function computeSkillPrunes<T extends SkillRow>(
  existing: T[],
  incoming: IncomingSkill[]
): T[] {
  const incomingByOrigin = new Map<string, Set<string>>();
  for (const s of incoming) {
    const o = normalizeOrigin(s.origin);
    if (!incomingByOrigin.has(o)) incomingByOrigin.set(o, new Set());
    incomingByOrigin.get(o)!.add(s.name);
  }
  const prunes: T[] = [];
  for (const row of existing) {
    const o = normalizeOrigin(row.origin);
    const names = incomingByOrigin.get(o);
    if (!names) continue; // origin not in this snapshot → untouched
    if (!names.has(row.name)) prunes.push(row);
  }
  return prunes;
}

export type GroupedSkill = {
  name: string;
  origins: string[];
  description?: string;
  source?: string;
  discoveredAt: number;
  useCount: number;
  lastUsedAt?: number;
};

/** Collapse (name, origin) rows into one entry per name for display. */
export function groupSkillRowsByName(
  rows: Array<{
    name: string;
    origin?: string | null;
    description?: string;
    source?: string;
    discoveredAt: number;
    useCount?: number;
    lastUsedAt?: number;
  }>
): GroupedSkill[] {
  const byName = new Map<string, GroupedSkill>();
  for (const r of rows) {
    let g = byName.get(r.name);
    if (!g) {
      g = { name: r.name, origins: [], discoveredAt: r.discoveredAt, useCount: 0 };
      byName.set(r.name, g);
    }
    const o = normalizeOrigin(r.origin);
    if (!g.origins.includes(o)) g.origins.push(o);
    if (!g.description && r.description) g.description = r.description;
    if (!g.source && r.source) g.source = r.source;
    g.discoveredAt = Math.min(g.discoveredAt, r.discoveredAt);
    g.useCount += r.useCount ?? 0;
    if (r.lastUsedAt && (!g.lastUsedAt || r.lastUsedAt > g.lastUsedAt)) g.lastUsedAt = r.lastUsedAt;
  }
  for (const g of byName.values()) g.origins.sort();
  return [...byName.values()];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run convex/__tests__/skillSync.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add convex/skillSync.ts convex/__tests__/skillSync.test.ts
git commit -m "feat(skills): pure per-origin sync helpers + tests"
```

---

## Task 2: Add `by_name_origin` index to the skills table

**Files:**
- Modify: `convex/schema.ts:190-198`

- [ ] **Step 1: Add the index**

Replace the `skills` table closing (currently `}).index("by_name", ["name"]),` at `convex/schema.ts:198`) with:

```ts
  })
    .index("by_name", ["name"])
    .index("by_name_origin", ["name", "origin"]),
```

- [ ] **Step 2: Regenerate Convex types**

Run: `npx convex codegen`
Expected: regenerates `convex/_generated/*` with the new index; no errors.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (index not yet used, no new errors).

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat(skills): add by_name_origin index for composite identity"
```

---

## Task 3: Wire helpers into `syncFullInventory` (capability_sync path)

**Files:**
- Modify: `convex/registry.ts` — add import; replace skill section (`registry.ts:267-320`).

- [ ] **Step 1: Add the import**

At the top of `convex/registry.ts` (after the existing imports), add:

```ts
import { normalizeOrigin, computeSkillPrunes } from "./skillSync";
```

- [ ] **Step 2: Replace the skill upsert + prune block**

Replace the entire block from `// --- Skills: upsert with origin ---` through the end of the removed-skills loop (`registry.ts:267-320`) with:

```ts
    // --- Skills: upsert by (name, origin) identity ---
    const existingSkills = await ctx.db.query("skills").collect();

    if (Array.isArray(snap.skills)) {
      for (const skill of snap.skills) {
        const origin = normalizeOrigin(skill.origin);
        const existing = await ctx.db
          .query("skills")
          .withIndex("by_name_origin", (q) =>
            q.eq("name", skill.name).eq("origin", origin)
          )
          .first();
        if (existing) {
          await ctx.db.patch(existing._id, {
            description: skill.description ?? existing.description,
            source: skill.source ?? existing.source,
            origin,
          });
        } else {
          await ctx.db.insert("skills", {
            name: skill.name,
            description: skill.description ?? undefined,
            source: skill.source ?? undefined,
            discoveredAt: now,
            origin,
          });
          await ctx.runMutation(api.skillCategories.autoSeedSkill, {
            skillName: skill.name,
          });
          await ctx.db.insert("configChanges", {
            configKey: `skill:${skill.name}`,
            oldValue: undefined,
            newValue: skill,
            changedBy: "capability_sync",
            changedAt: now,
          });
        }
      }

      // Per-origin pruning (only when snapshot included non-empty skills)
      if (snap.skills.length > 0) {
        for (const row of computeSkillPrunes(existingSkills, snap.skills)) {
          await ctx.db.delete(row._id);
          await ctx.db.insert("configChanges", {
            configKey: `skill:${row.name}`,
            oldValue: row,
            newValue: null,
            changedBy: "capability_sync",
            changedAt: now,
          });
        }
      }
    }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. The helper tests from Task 1 already cover the pruning logic.

- [ ] **Step 4: Re-run the helper tests (regression)**

Run: `npx vitest run convex/__tests__/skillSync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add convex/registry.ts
git commit -m "feat(skills): syncFullInventory uses composite identity + per-origin prune"
```

---

## Task 4: Wire helpers into `syncInventory` (/scan path)

**Files:**
- Modify: `convex/registry.ts` — skill section (`registry.ts:118-165`).

- [ ] **Step 1: Replace the skill upsert + prune block**

Replace the block from `// --- Skills: upsert + drift detection ---` through the end of its removed-skills loop (`registry.ts:118-165`) with:

```ts
    // --- Skills: upsert by (name, origin) identity ---
    const existingSkills = await ctx.db.query("skills").collect();

    if (Array.isArray(snap.skills)) {
      for (const skill of snap.skills) {
        const origin = normalizeOrigin(skill.origin);
        const existing = await ctx.db
          .query("skills")
          .withIndex("by_name_origin", (q) =>
            q.eq("name", skill.name).eq("origin", origin)
          )
          .first();
        if (!existing) {
          await ctx.db.insert("skills", {
            name: skill.name,
            description: skill.description,
            source: skill.source,
            discoveredAt: now,
            origin,
          });
          await ctx.runMutation(api.skillCategories.autoSeedSkill, {
            skillName: skill.name,
          });
          await ctx.db.insert("configChanges", {
            configKey: `skill:${skill.name}`,
            oldValue: undefined,
            newValue: skill,
            changedBy: "scanner",
            changedAt: now,
          });
        } else {
          await ctx.db.patch(existing._id, {
            description: skill.description ?? existing.description,
            source: skill.source ?? existing.source,
            origin,
          });
        }
      }

      // Per-origin pruning (only when snapshot included non-empty skills)
      if (snap.skills.length > 0) {
        for (const row of computeSkillPrunes(existingSkills, snap.skills)) {
          await ctx.db.delete(row._id);
          await ctx.db.insert("configChanges", {
            configKey: `skill:${row.name}`,
            oldValue: row,
            newValue: null,
            changedBy: "scanner",
            changedAt: now,
          });
        }
      }
    }
```

Note: `existingSkills` is already declared once here; ensure there is exactly one `const existingSkills` in `syncInventory` (the MCP/plugin sections above use their own `existingServers`/`existingPlugins`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/registry.ts
git commit -m "feat(skills): syncInventory uses composite identity + per-origin prune"
```

---

## Task 5: Normalize origin in `importSkills` and `repairSkillsFromOverrides`

**Files:**
- Modify: `convex/registry.ts:894-899` (importSkills insert) and `convex/registry.ts:1015-1018` (repair insert).

- [ ] **Step 1: importSkills — tag inserts as catalog**

In `importSkills`, change the `ctx.db.insert("skills", {...})` (currently at `registry.ts:894`) to include an origin:

```ts
        await ctx.db.insert("skills", {
          name: item.name,
          description: item.description,
          source: item.source ?? args.importSource,
          discoveredAt: now,
          origin: "catalog",
        });
```

- [ ] **Step 2: repairSkillsFromOverrides — tag inserts as unknown**

In `repairSkillsFromOverrides`, change the insert (currently at `registry.ts:1015`) to:

```ts
        await ctx.db.insert("skills", {
          name: override.skillName,
          discoveredAt: now,
          origin: "unknown",
        });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/registry.ts
git commit -m "fix(skills): normalize origin on importSkills/repair inserts"
```

---

## Task 6: One-time legacy origin normalization mutation

**Files:**
- Modify: `convex/registry.ts` (add a new exported mutation near `repairSkillsFromOverrides`).

- [ ] **Step 1: Add the mutation**

Append to `convex/registry.ts`:

```ts
/**
 * One-time: backfill origin="unknown" on pre-existing skill rows that were
 * inserted before composite (name, origin) identity. Run once after deploy:
 *   npx convex run registry:normalizeLegacySkillOrigins
 */
export const normalizeLegacySkillOrigins = mutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("skills").collect();
    let fixed = 0;
    for (const r of rows) {
      if (!r.origin || r.origin.trim() === "") {
        await ctx.db.patch(r._id, { origin: "unknown" });
        fixed++;
      }
    }
    return { fixed, total: rows.length };
  },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add convex/registry.ts
git commit -m "feat(skills): normalizeLegacySkillOrigins one-time migration"
```

---

## Task 7: Group skills by name in `getSkillsWithOverrides`

**Files:**
- Modify: `convex/skillCategories.ts:85-114`.

- [ ] **Step 1: Add the import**

At the top of `convex/skillCategories.ts`, add:

```ts
import { groupSkillRowsByName } from "./skillSync";
```

- [ ] **Step 2: Replace the query body**

Replace the `getSkillsWithOverrides` handler body (`skillCategories.ts:87-113`) with:

```ts
  handler: async (ctx) => {
    const rows = await ctx.db.query("skills").collect();
    const grouped = groupSkillRowsByName(rows);
    const overrides = await ctx.db.query("skillOverrides").collect();
    const categories = await ctx.db.query("skillCategories").collect();

    const overrideMap = new Map(overrides.map((o) => [o.skillName, o]));
    const categoryMap = new Map(categories.map((c) => [c.name, c]));

    return grouped.map((skill) => {
      const override = overrideMap.get(skill.name);
      const category = override ? categoryMap.get(override.categoryName) : null;
      return {
        ...skill,
        origin: skill.origins[0], // backward-compat: first origin
        displayName: override?.displayName ?? skill.name,
        categoryName: override?.categoryName ?? null,
        categoryDisplayName: category?.displayName ?? null,
        categoryIcon: category?.icon ?? "⚡",
        categoryColor: category?.color ?? "gray",
        overrideDescription: override?.description ?? null,
        hidden: override?.hidden ?? false,
        isAutoAssigned: override?.isAutoAssigned ?? true,
        favorite: override?.favorite ?? false,
      };
    });
  },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add convex/skillCategories.ts
git commit -m "feat(skills): getSkillsWithOverrides groups rows by name with origins[]"
```

---

## Task 8: OriginBadge — add claude-code / project / unknown styles

**Files:**
- Modify: `src/components/OriginBadge.tsx`.

- [ ] **Step 1: Replace the file**

Replace `src/components/OriginBadge.tsx` with:

```tsx
const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  native: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Native" },
  bridge: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Bridge" },
  cc: { bg: "bg-amber-500/10", text: "text-amber-400", label: "CC" },
  catalog: { bg: "bg-gray-500/10", text: "text-gray-500", label: "Catalog" },
  "claude-code": { bg: "bg-purple-500/10", text: "text-purple-400", label: "Claude Code" },
  unknown: { bg: "bg-gray-500/10", text: "text-gray-500", label: "Unknown" },
};

const PROJECT_STYLE = { bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Project" };

function styleFor(origin: string) {
  if (origin.startsWith("claude-code:project:")) return PROJECT_STYLE;
  return BADGE_STYLES[origin];
}

interface OriginBadgeProps {
  origin?: string | null;
}

export default function OriginBadge({ origin }: OriginBadgeProps) {
  if (!origin) return null;
  const style = styleFor(origin);
  if (!style) return null;

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. Existing call sites (Capabilities, PluginPanel, etc.) still pass a single `origin` string and now render CC/Project/Unknown badges.

- [ ] **Step 3: Commit**

```bash
git add src/components/OriginBadge.tsx
git commit -m "feat(skills): OriginBadge supports claude-code/project/unknown origins"
```

---

## Task 9: Origin filter on the Skills page

**Files:**
- Modify: `src/pages/Skills.tsx` — add `originFilter` state and apply it to `visibleSkills`.

- [ ] **Step 1: Add filter state**

After the `const [search, setSearch] = useState("");` line (`Skills.tsx:22`), add:

```tsx
  const [originFilter, setOriginFilter] = useState<string>("all");
```

- [ ] **Step 2: Derive available origins and apply the filter**

Replace the `visibleSkills` useMemo (`Skills.tsx:37-39`) with:

```tsx
  const allOrigins = useMemo(() => {
    const set = new Set<string>();
    for (const s of enrichedSkills) for (const o of (s.origins ?? [])) set.add(o);
    return [...set].sort();
  }, [enrichedSkills]);

  const visibleSkills = useMemo(() => {
    return enrichedSkills.filter(
      (s) =>
        !s.hidden &&
        (originFilter === "all" || (s.origins ?? []).includes(originFilter))
    );
  }, [enrichedSkills, originFilter]);
```

- [ ] **Step 3: Render the filter control**

Locate the search input in the Skills page JSX (the element bound to `value={search}`) and add this `<select>` immediately before or after it:

```tsx
        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-foreground"
          aria-label="Filter by origin"
        >
          <option value="all">All origins</option>
          {allOrigins.map((o) => (
            <option key={o} value={o}>
              {o.startsWith("claude-code:project:") ? "Project" : o}
            </option>
          ))}
        </select>
```

- [ ] **Step 4: Type-check + run existing UI tests**

Run: `npx tsc --noEmit && npx vitest run src/components/skills`
Expected: PASS (no regressions in existing skills component tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Skills.tsx
git commit -m "feat(skills): origin filter on the Skills page"
```

---

## Task 10: Scanner helpers (frontmatter, repoKey, skill-dir collection)

**Files:**
- Create: `hooks/skillScan.mjs`
- Test: `hooks/__tests__/skillScan.test.mjs`
- Modify: `vitest.config.ts` (include hooks tests)

- [ ] **Step 1: Add the hooks glob to vitest**

In `vitest.config.ts`, change the `include` array (`vitest.config.ts:16`) to:

```ts
    include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts', 'hooks/**/*.test.mjs'],
```

- [ ] **Step 2: Write the failing test**

Create `hooks/__tests__/skillScan.test.mjs`:

```js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseFrontmatter, repoKey, collectClaudeCodeSkills } from "../skillScan.mjs";

describe("parseFrontmatter", () => {
  it("extracts name and description", () => {
    const fm = parseFrontmatter('---\nname: deep-research\ndescription: "Do research"\n---\nbody');
    expect(fm.name).toBe("deep-research");
    expect(fm.description).toBe("Do research");
  });
  it("returns {} when no frontmatter", () => {
    expect(parseFrontmatter("no frontmatter here")).toEqual({});
  });
});

describe("repoKey", () => {
  it("is stable and case-normalized on win32", () => {
    const a = repoKey("C:/Users/x/Repo", "win32");
    const b = repoKey("c:\\users\\x\\repo\\", "win32");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });
  it("is case-sensitive off win32", () => {
    expect(repoKey("/home/x/Repo", "linux")).not.toBe(repoKey("/home/x/repo", "linux"));
  });
});

describe("collectClaudeCodeSkills", () => {
  let home, cwd;
  beforeAll(() => {
    home = mkdtempSync(join(tmpdir(), "home-"));
    cwd = mkdtempSync(join(tmpdir(), "repo-"));
    // personal skill
    mkdirSync(join(home, ".claude", "skills", "deep-research"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", "deep-research", "SKILL.md"),
      "---\nname: deep-research\ndescription: Research\n---\n");
    // plugin-cache skill
    mkdirSync(join(home, ".claude", "plugins", "cache", "p", "1.0.0", "skills", "brainstorm"), { recursive: true });
    writeFileSync(join(home, ".claude", "plugins", "cache", "p", "1.0.0", "skills", "brainstorm", "SKILL.md"),
      "---\nname: brainstorm\ndescription: Ideas\n---\n");
    // project skill (mark repo root with .git)
    mkdirSync(join(cwd, ".git"), { recursive: true });
    mkdirSync(join(cwd, ".claude", "skills", "repo-skill"), { recursive: true });
    writeFileSync(join(cwd, ".claude", "skills", "repo-skill", "SKILL.md"),
      "---\nname: repo-skill\ndescription: Local\n---\n");
  });
  afterAll(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
  });

  it("collects personal + plugin as claude-code and project as claude-code:project:<key>", () => {
    const skills = collectClaudeCodeSkills({ home, cwd, platform: "linux" });
    const byName = Object.fromEntries(skills.map((s) => [s.name, s]));
    expect(byName["deep-research"].origin).toBe("claude-code");
    expect(byName["brainstorm"].origin).toBe("claude-code");
    expect(byName["repo-skill"].origin).toBe(`claude-code:project:${repoKey(cwd, "linux")}`);
    expect(byName["deep-research"].description).toBe("Research");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run hooks/__tests__/skillScan.test.mjs`
Expected: FAIL — cannot find `../skillScan.mjs`.

- [ ] **Step 4: Write the implementation**

Create `hooks/skillScan.mjs`:

```js
// Pure-ish skill discovery for the CodePulse scanner. No network, no Convex.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export function parseFrontmatter(text) {
  const m = text.match(/^---\s*([\s\S]*?)\s*---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

export function repoKey(repoRoot, platform = process.platform) {
  let canon = repoRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  if (platform === "win32") canon = canon.toLowerCase();
  return createHash("sha1").update(canon).digest("hex").slice(0, 12);
}

export function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 30; i++) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function readSkillDir(skillsDir, origin, acc) {
  if (!existsSync(skillsDir)) return;
  let names;
  try { names = readdirSync(skillsDir); } catch { return; }
  for (const name of names) {
    const md = join(skillsDir, name, "SKILL.md");
    if (!existsSync(md)) continue;
    let fm = {};
    try { fm = parseFrontmatter(readFileSync(md, "utf8")); } catch {}
    acc.push({ name: fm.name || name, description: fm.description || "", source: md, origin });
  }
}

function walkPluginCache(dir, origin, acc, depth = 0) {
  if (depth > 8 || !existsSync(dir)) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === "node_modules" || e === ".git") continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (!st.isDirectory()) continue;
    if (e === "skills") readSkillDir(p, origin, acc);
    else walkPluginCache(p, origin, acc, depth + 1);
  }
}

export function collectClaudeCodeSkills({ home, cwd, platform = process.platform }) {
  const acc = [];
  readSkillDir(join(home, ".claude", "skills"), "claude-code", acc);
  walkPluginCache(join(home, ".claude", "plugins", "cache"), "claude-code", acc);
  const root = findRepoRoot(cwd);
  readSkillDir(join(root, ".claude", "skills"), `claude-code:project:${repoKey(root, platform)}`, acc);
  return acc;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run hooks/__tests__/skillScan.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add hooks/skillScan.mjs hooks/__tests__/skillScan.test.mjs vitest.config.ts
git commit -m "feat(skills): scanner skill-dir collection helpers + tests"
```

---

## Task 11: Wire directory skills + bearer auth + dry-run into the scanner

**Files:**
- Modify: `hooks/scanner.mjs` (import, skill push, POST headers, direct-run key + dry-run).

- [ ] **Step 1: Import the collector**

Add to the imports at the top of `hooks/scanner.mjs`:

```js
import { collectClaudeCodeSkills } from "./skillScan.mjs";
```

- [ ] **Step 2: Push real directory skills into the snapshot**

Immediately after the project-settings block ends (after `scanner.mjs:72`, before the project agents block), add:

```js
  // ── Claude Code skills (personal + plugin cache + per-repo project) ──
  try {
    snapshot.skills.push(...collectClaudeCodeSkills({ home, cwd }));
  } catch (err) {
    console.error(`[codepulse-scanner] skill scan failed: ${err.message}`);
  }
```

(`home` and `cwd` are already defined at `scanner.mjs:19-21`.)

- [ ] **Step 3: Accept an ingest key and send a bearer on /scan**

Change the `runScan` signature (`scanner.mjs:18`) to:

```js
export async function runScan(sessionId, codepulseUrl, ingestKey) {
```

Replace the POST block (`scanner.mjs:183-189`) with:

```js
    const headers = { "Content-Type": "application/json" };
    if (ingestKey) headers["Authorization"] = `Bearer ${ingestKey}`;
    else console.warn("[codepulse-scanner] no ASTRIDR_INGEST_API_KEY set — posting unauthenticated (server may reject)");
    const resp = await fetch(`${codepulseUrl}/scan`, {
      method: "POST",
      headers,
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    });
```

- [ ] **Step 4: Direct-run dry-run + key resolution**

Replace the direct-run block (`scanner.mjs:240-259`, the `if (isDirectRun) { ... }` body) with:

```js
if (isDirectRun) {
  const sessionId = process.argv[2] || "manual-scan";
  const dryRun = process.argv.includes("--dry-run");

  // Inline URL resolution (same logic as codepulse-hook.mjs)
  let url = process.env.CODEPULSE_URL || "";
  if (!url) {
    const envPath = join(__scanner_dirname, "..", ".env.local");
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        const m = content.match(/^CONVEX_SITE_URL\s*=\s*(.+)$/m);
        if (m) url = m[1].trim();
      } catch {}
    }
  }
  if (!url) url = "https://ideal-sandpiper-297.convex.site";

  // Resolve the ingest key (env first, then .env.local)
  let key = process.env.ASTRIDR_INGEST_API_KEY || "";
  if (!key) {
    const envPath = join(__scanner_dirname, "..", ".env.local");
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        const m = content.match(/^ASTRIDR_INGEST_API_KEY\s*=\s*(.+)$/m);
        if (m) key = m[1].trim();
      } catch {}
    }
  }

  if (dryRun) {
    // Build the snapshot but print skills instead of posting.
    const { homedir } = await import("node:os");
    const { collectClaudeCodeSkills } = await import("./skillScan.mjs");
    const skills = collectClaudeCodeSkills({ home: homedir(), cwd: process.cwd() });
    console.log(JSON.stringify(skills, null, 2));
    console.log(`[codepulse-scanner] DRY RUN — ${skills.length} skills would be posted.`);
    process.exit(0);
  }

  runScan(sessionId, url, key).then(() => {
    console.log("[codepulse-scanner] Scan complete.");
    process.exit(0);
  });
}
```

- [ ] **Step 5: Verify dry-run lists real skills**

Run: `node hooks/scanner.mjs manual --dry-run`
Expected: prints a JSON array including your `~/.claude/skills` (origin `claude-code`) and, if run inside a repo with `.claude/skills`, project skills; final line reports the count.

- [ ] **Step 6: Commit**

```bash
git add hooks/scanner.mjs
git commit -m "feat(skills): scanner collects directory skills, sends bearer, supports --dry-run"
```

---

## Task 12: Pass the ingest key from the hook to the scanner

**Files:**
- Modify: `hooks/codepulse-hook.mjs` (add resolver, pass to runScan).

- [ ] **Step 1: Add a scan-key resolver**

After `resolveIngestKey()` (`codepulse-hook.mjs:55`), add:

```js
function resolveScanKey() {
  if (process.env.ASTRIDR_INGEST_API_KEY) return process.env.ASTRIDR_INGEST_API_KEY;

  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, "utf-8");
      const keyMatch = envContent.match(/^ASTRIDR_INGEST_API_KEY\s*=\s*(.+)$/m);
      if (keyMatch) return keyMatch[1].trim();
    } catch {
      // ignore read errors
    }
  }
  return null;
}
```

- [ ] **Step 2: Pass the key to runScan**

In the SessionStart block, change the `runScan` call (`codepulse-hook.mjs:156`) to:

```js
      await runScan(sessionId, codepulseUrl, resolveScanKey());
```

- [ ] **Step 3: Syntax check**

Run: `node --check hooks/codepulse-hook.mjs`
Expected: no output (valid).

- [ ] **Step 4: Commit**

```bash
git add hooks/codepulse-hook.mjs
git commit -m "feat(skills): hook resolves ASTRIDR_INGEST_API_KEY for the scanner"
```

---

## Task 13: Local config + deploy + real end-to-end verification

**Files:** none (operational). Requires the ingest key — Larry adds it; the assistant never reads or prints it.

- [ ] **Step 1: Ensure the ingest key is available (manual)**

Larry: add `ASTRIDR_INGEST_API_KEY=<value>` to CodePulse's gitignored `.env.local` (value matches `astridr-repo/.env` `ASTRIDR_INGEST_API_KEY` and CodePulse's Convex deployment env var of the same name). Confirm `.env.local` is gitignored:

Run: `git check-ignore .env.local`
Expected: prints `.env.local` (ignored).

- [ ] **Step 2: Deploy backend + run the migration**

Run: `npx convex deploy --yes`
Then: `npx convex run registry:normalizeLegacySkillOrigins`
Expected: deploy succeeds; migration returns `{ fixed, total }`.

- [ ] **Step 3: Dry-run, then live scan**

Run: `node hooks/scanner.mjs verify-session --dry-run` → confirm ~100+ `claude-code` skills listed.
Run: `node hooks/scanner.mjs verify-session` → expect `Scan complete.` with no auth warning.

- [ ] **Step 4: Confirm skills appear (real outcome)**

Open the CodePulse Skills page and the Capabilities page. Verify Claude Code skills are present with a "Claude Code" badge (and "Project" badges for the current repo). Filter by origin on the Skills page.

- [ ] **Step 5: Collision regression — Ástríðr coexists**

Trigger an Ástríðr `capability_sync` (restart the `astridr` container, or wait for the periodic health-check sync). Then re-open the Skills page:
- Claude Code skills MUST still be present (not wiped by Ástríðr's sync).
- Run `node hooks/scanner.mjs verify-session` again; confirm Ástríðr `cc`/`native` skills are still present (not wiped by the host scan).

- [ ] **Step 6: Confirm no Convex limit errors on first load**

Run: `npx convex logs --prod` (or check the dashboard) during/after the first full scan. Expected: no mutation size/time errors from `syncInventory`/`autoSeedSkill`. If errors appear, batch `autoSeedSkill` into a scheduled action (note in handoff) before relying on automatic syncs.

- [ ] **Step 7: Commit any config docs (if added)**

```bash
git add -A
git commit -m "docs(skills): verification notes for skills catalog unification" || echo "nothing to commit"
```

---

## Task 14: Ástríðr verify-only

**Files:** none (verification against `~/astridr-repo`).

- [ ] **Step 1: Confirm Ástríðr tags origin**

Confirm `astridr-repo/astridr/engine/bootstrap/bridge.py:119-152` still tags every `capability_sync` skill/item with an `origin` (currently `cc`/`bridge`/`native`/`host`). If any skill path emits no origin, it will be normalized to `unknown` by CodePulse — acceptable, but note it.

- [ ] **Step 2: End-to-end coexistence (already exercised in Task 13 Step 5)**

Confirm the two-way coexistence test in Task 13 Step 5 passed. No Ástríðr code change is expected; if a regression is found, open a separate task — do not modify Ástríðr under this plan without explicit approval (Ástríðr prod runs off `main`).

---

## Self-Review Notes

- **Spec coverage:** Component 1 → Tasks 1–6; Component 1a (name-scoped overrides) → unchanged by design (Task 7 groups by name, overrides stay name-keyed); Component 2 → Tasks 7–9; Component 3 → Tasks 10–11; Component 4 → Task 12; Component 5 (auth) → Tasks 11–13; Component 6 (Ástríðr verify) → Task 14. Migration/normalization → Tasks 5–6.
- **First-sync fan-out:** surfaced as an explicit verification gate (Task 13 Step 6) rather than pre-optimized (YAGNI); remediation path noted.
- **Types:** `normalizeOrigin`/`computeSkillPrunes`/`groupSkillRowsByName` signatures are consistent across Tasks 1, 3, 4, 7. `runScan(sessionId, url, ingestKey)` consistent across Tasks 11–12. `repoKey(root, platform)` consistent across Tasks 10–11.
