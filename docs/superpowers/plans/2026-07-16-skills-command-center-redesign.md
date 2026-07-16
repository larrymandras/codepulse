# Skills Command Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the CodePulse Skills page as a premium command center: one unified Quick Deck, a Ctrl+K palette, copy-as-primary skill rows, global search, and Intake collapsed to a strip + slide-over Sheet.

**Architecture:** Frontend-only recomposition of `src/pages/Skills.tsx` and `src/components/skills/*`. New pure helpers go in `src/lib/`; intake state lifts out of `IntakePanel` into a `useIntakeFeed()` hook so a strip, a Sheet, and the modal can share it. Zero Convex/schema changes — all existing queries/mutations are reused as-is.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind 4 tokens, shadcn/ui (`command.tsx` = cmdk ^1.1.1, `sheet.tsx`, `dialog.tsx`, `button.tsx`), Convex React hooks, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-16-skills-command-center-redesign-design.md`

## Global Constraints

- **Zero Convex/schema changes.** Only `src/` files change.
- **Primary action everywhere = copy invocation** (via `skillInvocation()` from `@/lib/skills`); "Open in Chat" is secondary. Copy actions still call `api.registry.recordSkillLaunch`.
- **Tokens only** in new/touched styling: `--primary`, `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-accent`, `border-border`, `shadow-[var(--glow-xs|sm)]`. No `gray-*`, `indigo-*`, or `text-white` classes. Exception: category colors from the centralized `COLOR_HEX` map (user data) and amber for the favorite star.
- **Section header pattern** (shared): `text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary/70`; the pulsing dot (`w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]`) ONLY on sections reflecting live data.
- **Dormant skills** (`isDormant()` from `@/lib/skills`) never appear in the Quick Deck; elsewhere they render dimmed with a `dormant` badge and copy feedback says "Dormant" instead of "Copied".
- **Drag-drop contract preserved:** `e.dataTransfer.setData("text/plain", skill.name)` with `effectAllowed = "move"`; category drop targets unchanged.
- **Intake aria contracts preserved verbatim** (locked in Phase 07): status chip wrapped in `aria-live="polite"`, the queued countdown wrapped in `aria-live="off"`.
- **No `onMouseEnter`/`onMouseLeave` style mutation** — hover styling via CSS classes only.
- Commands: test = `npx vitest run <file>`, typecheck = `npx tsc --noEmit`. Repo root: `C:\Users\mandr\codepulse`.

---

### Task 1: Centralized category colors (`categoryHex`)

**Files:**
- Create: `src/lib/categoryColors.ts`
- Create: `src/lib/categoryColors.test.ts`
- Modify: `src/components/skills/CategoryGrid.tsx` (delete local `COLOR_HEX`, import)
- Modify: `src/components/skills/SkillsInCategory.tsx` (delete local `COLOR_HEX`, import)

**Interfaces:**
- Consumes: nothing.
- Produces: `COLOR_HEX: Record<string, string>` and `categoryHex(color: string | null | undefined): string` — later tasks (`AllSkillsOverview`, restyles) import these from `@/lib/categoryColors`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/categoryColors.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { COLOR_HEX, categoryHex } from "./categoryColors";

describe("categoryHex", () => {
  it("returns the hex for a known color name", () => {
    expect(categoryHex("cyan")).toBe("#06b6d4");
    expect(categoryHex("red")).toBe("#ef4444");
  });

  it("falls back to gray for unknown, null, and undefined", () => {
    expect(categoryHex("chartreuse")).toBe(COLOR_HEX.gray);
    expect(categoryHex(null)).toBe(COLOR_HEX.gray);
    expect(categoryHex(undefined)).toBe(COLOR_HEX.gray);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/categoryColors.test.ts`
Expected: FAIL — cannot resolve `./categoryColors`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/categoryColors.ts`:

```ts
// Single source of truth for category accent colors. Category `color` is user
// data (picked in CategoryEditPopover), so this stays a name→hex palette
// rather than theme tokens.
export const COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1", red: "#ef4444", purple: "#a855f7", amber: "#f59e0b",
  cyan: "#06b6d4", emerald: "#10b981", violet: "#8b5cf6", blue: "#3b82f6",
  orange: "#f97316", pink: "#ec4899", teal: "#14b8a6", rose: "#f43f5e",
  green: "#22c55e", yellow: "#eab308", gray: "#6b7280",
};

export function categoryHex(color: string | null | undefined): string {
  return COLOR_HEX[color ?? "gray"] ?? COLOR_HEX.gray;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/categoryColors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Migrate the two surviving consumers**

In `src/components/skills/CategoryGrid.tsx`: delete the local `const COLOR_HEX: Record<string, string> = { ... }` block, add `import { categoryHex } from "@/lib/categoryColors";`, and replace `const hex = COLOR_HEX[cat.color] ?? COLOR_HEX.gray;` with `const hex = categoryHex(cat.color);`.

In `src/components/skills/SkillsInCategory.tsx`: same deletion + import; replace `const hex = COLOR_HEX[categoryColor] ?? COLOR_HEX.gray;` with `const hex = categoryHex(categoryColor);` and `const catHex = COLOR_HEX[cat.color] ?? COLOR_HEX.gray;` with `const catHex = categoryHex(cat.color);`.

(`FavoriteSkills.tsx` and `FrequentSkills.tsx` also hold copies but are deleted in Task 10 — leave them.)

- [ ] **Step 6: Typecheck and run the page suite**

Run: `npx tsc --noEmit && npx vitest run src/pages/__tests__/Skills.test.tsx`
Expected: both clean/green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/categoryColors.ts src/lib/categoryColors.test.ts src/components/skills/CategoryGrid.tsx src/components/skills/SkillsInCategory.tsx
git commit -m "refactor(skills): centralize category color palette in lib/categoryColors"
```

---

### Task 2: `deckSkills()` ranking helper

**Files:**
- Modify: `src/lib/skills.ts` (add `favorite` to `SkillLike`, add `deckSkills`)
- Modify: `src/lib/skills.test.ts` (append describe block)

**Interfaces:**
- Consumes: `isDormant`, `topSkills` (same module).
- Produces: `deckSkills(skills: SkillLike[], limit = 10): SkillLike[]` and `SkillLike.favorite?: boolean` — Task 3's `QuickDeck` calls `deckSkills`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/skills.test.ts`:

```ts
import { deckSkills } from "./skills";

describe("deckSkills", () => {
  const base = { origins: ["claude-code"] };
  it("pins favorites first (by useCount), then fills with most-used non-favorites", () => {
    const deck = deckSkills([
      { ...base, name: "big", useCount: 50, favorite: false },
      { ...base, name: "fav-low", useCount: 2, favorite: true },
      { ...base, name: "fav-high", useCount: 9, favorite: true },
      { ...base, name: "mid", useCount: 5, favorite: false },
    ]);
    expect(deck.map((s) => s.name)).toEqual(["fav-high", "fav-low", "big", "mid"]);
  });

  it("includes a never-used favorite but not a never-used non-favorite", () => {
    const deck = deckSkills([
      { ...base, name: "fav-unused", useCount: 0, favorite: true },
      { ...base, name: "unused", useCount: 0, favorite: false },
    ]);
    expect(deck.map((s) => s.name)).toEqual(["fav-unused"]);
  });

  it("excludes dormant skills even when favorited, and hidden skills", () => {
    const deck = deckSkills([
      { name: "cold-fav", origins: [DORMANT_ORIGIN], useCount: 99, favorite: true },
      { ...base, name: "ghost", useCount: 99, favorite: true, hidden: true },
      { ...base, name: "alive", useCount: 1, favorite: false },
    ]);
    expect(deck.map((s) => s.name)).toEqual(["alive"]);
  });

  it("never duplicates a favorite in the most-used fill and caps at limit", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      ...base, name: `s${i}`, useCount: 20 - i, favorite: i < 3,
    }));
    const deck = deckSkills(many, 10);
    expect(deck).toHaveLength(10);
    expect(new Set(deck.map((s) => s.name)).size).toBe(10);
    expect(deck.slice(0, 3).every((s) => s.favorite)).toBe(true);
  });
});
```

(`DORMANT_ORIGIN` is already imported at the top of this test file; if not, add it to the existing `./skills` import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/skills.test.ts`
Expected: FAIL — `deckSkills` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/skills.ts`, add `favorite?: boolean;` to the `SkillLike` type (after `hidden?: boolean;`), then append:

```ts
/**
 * The Quick Deck: favorites pinned first (any useCount — a pinned skill is
 * pinned), then most-used non-favorites fill the remaining slots. Dormant
 * skills never appear — copying their invocation would do nothing.
 */
export function deckSkills(skills: SkillLike[], limit = 10): SkillLike[] {
  const eligible = skills.filter((s) => !s.hidden && !isDormant(s));
  const favorites = eligible
    .filter((s) => s.favorite)
    .sort(
      (a, b) =>
        (b.useCount ?? 0) - (a.useCount ?? 0) ||
        (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
    );
  const favoriteNames = new Set(favorites.map((s) => s.name));
  const fill = topSkills(eligible, limit).filter((s) => !favoriteNames.has(s.name));
  return [...favorites, ...fill].slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/skills.test.ts`
Expected: PASS (existing + 4 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills.ts src/lib/skills.test.ts
git commit -m "feat(skills): deckSkills ranking - favorites pinned, most-used fill"
```

---

### Task 3: `QuickDeck` component

**Files:**
- Create: `src/components/skills/QuickDeck.tsx`
- Create: `src/components/skills/QuickDeck.test.tsx`

**Interfaces:**
- Consumes: `deckSkills`, `skillInvocation`, `SkillLike` from `@/lib/skills`.
- Produces: `QuickDeck` with props `{ skills: DeckSkill[]; onUse: (skillName: string) => void; onOpenInChat: (skillName: string) => void; onToggleFavorite: (skillName: string) => void; limit?: number }` where `DeckSkill = SkillLike & { displayName: string; categoryIcon: string; favorite: boolean }`. Task 10 mounts it with `enrichedSkills`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/skills/QuickDeck.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QuickDeck } from "./QuickDeck";
import { DORMANT_ORIGIN } from "@/lib/skills";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

const skills = [
  { name: "gsd-code-review", displayName: "Code Review", categoryIcon: "📋", origins: ["claude-code"], useCount: 11, favorite: false },
  { name: "legal-nda", displayName: "NDA", categoryIcon: "⚖️", origins: ["claude-code"], useCount: 3, favorite: true, command: "/legal nda <file>" },
  { name: "cold-thing", displayName: "Cold", categoryIcon: "⚡", origins: [DORMANT_ORIGIN], useCount: 99, favorite: true },
  { name: "never-used", displayName: "Never", categoryIcon: "⚡", origins: ["claude-code"], useCount: 0, favorite: false },
];

const noop = () => {};

describe("QuickDeck", () => {
  it("pins favorites first, excludes dormant and never-used non-favorites", () => {
    render(<QuickDeck skills={skills} onUse={noop} onOpenInChat={noop} onToggleFavorite={noop} />);
    const chips = screen.getAllByTestId("deck-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("/legal nda");
    expect(chips[1]).toHaveTextContent("/gsd-code-review");
    expect(screen.queryByText(/cold-thing/)).toBeNull();
  });

  it("copies the invocation and records the use on chip click", async () => {
    const onUse = vi.fn();
    render(<QuickDeck skills={skills} onUse={onUse} onOpenInChat={noop} onToggleFavorite={noop} />);
    screen.getAllByTestId("deck-chip")[1].click();
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/gsd-code-review"));
    expect(onUse).toHaveBeenCalledWith("gsd-code-review");
    await waitFor(() => expect(screen.getByText("copied")).toBeTruthy());
  });

  it("says 'copy failed' when the clipboard rejects, still records the use", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const onUse = vi.fn();
    render(<QuickDeck skills={skills} onUse={onUse} onOpenInChat={noop} onToggleFavorite={noop} />);
    screen.getAllByTestId("deck-chip")[0].click();
    await waitFor(() => expect(screen.getByText("copy failed")).toBeTruthy());
    expect(onUse).toHaveBeenCalledWith("legal-nda");
  });

  it("hover actions open Chat and toggle favorite without copying", () => {
    const onOpenInChat = vi.fn();
    const onToggleFavorite = vi.fn();
    render(<QuickDeck skills={skills} onUse={noop} onOpenInChat={onOpenInChat} onToggleFavorite={onToggleFavorite} />);
    screen.getByLabelText("Open legal-nda in Chat").click();
    expect(onOpenInChat).toHaveBeenCalledWith("legal-nda");
    screen.getByLabelText("Toggle favorite legal-nda").click();
    expect(onToggleFavorite).toHaveBeenCalledWith("legal-nda");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("renders nothing when the deck is empty", () => {
    const { container } = render(
      <QuickDeck skills={[{ name: "a", displayName: "A", categoryIcon: "⚡", origins: ["claude-code"], useCount: 0, favorite: false }]} onUse={noop} onOpenInChat={noop} onToggleFavorite={noop} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/skills/QuickDeck.test.tsx`
Expected: FAIL — cannot resolve `./QuickDeck`.

- [ ] **Step 3: Implement**

Create `src/components/skills/QuickDeck.tsx`:

```tsx
import { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { deckSkills, skillInvocation, type SkillLike } from "@/lib/skills";

export type DeckSkill = SkillLike & {
  displayName: string;
  categoryIcon: string;
  favorite: boolean;
};

interface QuickDeckProps {
  skills: DeckSkill[];
  /** Records the copy so useCount keeps ranking the deck. */
  onUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onToggleFavorite: (skillName: string) => void;
  limit?: number;
}

/**
 * The unified quick-access dock: favorites pinned, most-used fill (deckSkills).
 * Chip click copies the invocation (primary action); hover reveals open-in-Chat
 * and favorite-toggle. Replaces SkillPills + FavoriteSkills + FrequentSkills.
 */
export function QuickDeck({ skills, onUse, onOpenInChat, onToggleFavorite, limit = 10 }: QuickDeckProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const deck = deckSkills(skills, limit) as DeckSkill[];

  if (deck.length === 0) return null;

  const handleCopy = async (skill: DeckSkill) => {
    const invocation = skillInvocation(skill);
    setFailed(null);
    try {
      await navigator.clipboard.writeText(invocation);
      setCopied(skill.name);
      setTimeout(() => setCopied((c) => (c === skill.name ? null : c)), 1500);
    } catch {
      // Don't claim "copied" when nothing reached the clipboard.
      setFailed(skill.name);
      setTimeout(() => setFailed((f) => (f === skill.name ? null : f)), 2500);
    }
    onUse(skill.name);
  };

  return (
    <section aria-label="Command deck" className="flex flex-col gap-2">
      <h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]" />
        Command Deck
      </h2>
      <div className="flex flex-wrap gap-2">
        {deck.map((skill) => {
          const invocation = skillInvocation(skill);
          const isCopied = copied === skill.name;
          const isFailed = failed === skill.name;
          return (
            <div
              key={skill.name}
              data-testid="deck-chip-wrap"
              className={`group inline-flex items-center rounded-full border transition-all ${
                isFailed
                  ? "border-destructive/50 bg-destructive/10"
                  : isCopied
                    ? "border-primary bg-primary/20 shadow-[var(--glow-sm)]"
                    : "border-primary/25 bg-card hover:border-primary hover:shadow-[var(--glow-xs)]"
              }`}
            >
              <button
                data-testid="deck-chip"
                onClick={() => handleCopy(skill)}
                title={`${invocation} — click to copy${skill.useCount ? ` · used ${skill.useCount}×` : ""}`}
                aria-label={`Copy invocation ${invocation}`}
                className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 font-mono text-xs transition-colors ${
                  isFailed ? "text-destructive" : isCopied ? "text-primary" : "text-foreground group-hover:text-primary"
                }`}
              >
                <span aria-hidden="true">{skill.categoryIcon}</span>
                <span className="truncate max-w-[14rem]">{invocation}</span>
                {skill.favorite && (
                  <Star aria-hidden="true" className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                )}
                <span className={`text-[10px] tabular-nums ${isCopied || isFailed ? "" : "text-muted-foreground"}`}>
                  {isFailed ? "copy failed" : isCopied ? "copied" : (skill.useCount ?? 0)}
                </span>
              </button>
              <div className="flex w-0 overflow-hidden items-center gap-0.5 transition-all group-hover:w-14 group-focus-within:w-14 group-hover:pr-2 group-focus-within:pr-2">
                <button
                  onClick={() => onOpenInChat(skill.name)}
                  aria-label={`Open ${skill.name} in Chat`}
                  className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onToggleFavorite(skill.name)}
                  aria-label={`Toggle favorite ${skill.name}`}
                  className="p-1 rounded text-muted-foreground hover:text-amber-400 transition-colors"
                >
                  <Star className={`w-3.5 h-3.5 ${skill.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/skills/QuickDeck.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/QuickDeck.tsx src/components/skills/QuickDeck.test.tsx
git commit -m "feat(skills): QuickDeck - unified favorites+most-used dock, copy-primary"
```

---

### Task 4: `SkillRow` component

**Files:**
- Create: `src/components/skills/SkillRow.tsx`
- Create: `src/components/skills/SkillRow.test.tsx`

**Interfaces:**
- Consumes: `isDormant`, `skillInvocation`, `SkillLike` from `@/lib/skills`.
- Produces: `SkillRow` with props `{ skill: RowSkill; onRecordUse: (skillName: string) => void; onOpenInChat: (skillName: string) => void; onEdit: (skillName: string) => void; onToggleFavorite: (skillName: string) => void; draggable?: boolean }` where `RowSkill = SkillLike & { displayName: string; description?: string | null; overrideDescription?: string | null; favorite: boolean }`. Tasks 5 and 6 render it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/skills/SkillRow.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SkillRow } from "./SkillRow";
import { DORMANT_ORIGIN } from "@/lib/skills";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

const skill = {
  name: "legal-nda",
  displayName: "NDA Generator",
  description: "Generate NDAs",
  overrideDescription: null,
  origins: ["claude-code"],
  useCount: 5,
  favorite: false,
};

const handlers = () => ({
  onRecordUse: vi.fn(),
  onOpenInChat: vi.fn(),
  onEdit: vi.fn(),
  onToggleFavorite: vi.fn(),
});

describe("SkillRow", () => {
  it("copy is the primary action: copies invocation, records use, shows Copied", async () => {
    const h = handlers();
    render(<SkillRow skill={skill} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/legal-nda"));
    expect(h.onRecordUse).toHaveBeenCalledWith("legal-nda");
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
  });

  it("shows Failed when the clipboard rejects", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const h = handlers();
    render(<SkillRow skill={skill} {...h} />);
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(screen.getByText("Failed")).toBeTruthy());
  });

  it("dormant skill renders a dormant badge and Dormant copy feedback", async () => {
    const h = handlers();
    render(<SkillRow skill={{ ...skill, origins: [DORMANT_ORIGIN] }} {...h} />);
    expect(screen.getByText("dormant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => expect(screen.getByText("Dormant")).toBeTruthy());
  });

  it("secondary actions: chat, edit, favorite", () => {
    const h = handlers();
    render(<SkillRow skill={skill} {...h} />);
    fireEvent.click(screen.getByLabelText("Open legal-nda in Chat"));
    expect(h.onOpenInChat).toHaveBeenCalledWith("legal-nda");
    fireEvent.click(screen.getByLabelText("Edit legal-nda"));
    expect(h.onEdit).toHaveBeenCalledWith("legal-nda");
    fireEvent.click(screen.getByLabelText("Toggle favorite legal-nda"));
    expect(h.onToggleFavorite).toHaveBeenCalledWith("legal-nda");
  });

  it("sets the drag payload to the skill name", () => {
    const h = handlers();
    const { container } = render(<SkillRow skill={skill} {...h} />);
    const row = container.querySelector('[data-skill="legal-nda"]')!;
    const setData = vi.fn();
    fireEvent.dragStart(row, { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith("text/plain", "legal-nda");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/skills/SkillRow.test.tsx`
Expected: FAIL — cannot resolve `./SkillRow`.

- [ ] **Step 3: Implement**

Create `src/components/skills/SkillRow.tsx`:

```tsx
import { useState } from "react";
import { GripVertical, MessageSquare, Pencil, Star } from "lucide-react";
import { isDormant, skillInvocation, type SkillLike } from "@/lib/skills";

export type RowSkill = SkillLike & {
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  favorite: boolean;
};

interface SkillRowProps {
  skill: RowSkill;
  /** Records the copy so useCount keeps ranking. */
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onEdit: (skillName: string) => void;
  onToggleFavorite: (skillName: string) => void;
  draggable?: boolean;
}

type CopyState = "idle" | "copied" | "dormant" | "failed";

const COPY_LABEL: Record<CopyState, string> = {
  idle: "Copy",
  copied: "Copied",
  dormant: "Dormant",
  failed: "Failed",
};

/**
 * The one skill row used by the category view and the all-skills overview.
 * Copy is the primary action; Chat/edit/favorite reveal on hover or focus.
 */
export function SkillRow({
  skill,
  onRecordUse,
  onOpenInChat,
  onEdit,
  onToggleFavorite,
  draggable = true,
}: SkillRowProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const dormant = isDormant(skill);
  const invocation = skillInvocation(skill);
  const desc = skill.overrideDescription ?? skill.description ?? "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invocation);
      // Dormant copy succeeds but warns: the skill is not loaded.
      setCopyState(dormant ? "dormant" : "copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 1800);
    onRecordUse(skill.name);
  };

  return (
    <div
      data-skill={skill.name}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", skill.name);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group relative flex items-center gap-3 px-3 py-2 hover:bg-primary/10 transition-colors ${
        dormant ? "opacity-50" : ""
      }`}
    >
      <GripVertical className="w-3.5 h-3.5 text-primary/30 group-hover:text-primary cursor-grab flex-shrink-0" />

      <div className="flex items-center w-64 flex-shrink-0 gap-2 pr-4 border-r border-primary/10">
        <span className="text-foreground font-mono font-bold text-sm tracking-wide truncate">
          {skill.displayName}
        </span>
        {skill.favorite && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
        {dormant && (
          <span className="text-[9px] font-mono uppercase tracking-widest border border-muted-foreground/40 text-muted-foreground rounded px-1 shrink-0">
            dormant
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-4">
        {desc ? (
          <div className="text-muted-foreground text-xs truncate">{desc}</div>
        ) : (
          <div className="text-muted-foreground/30 text-xs italic">No description available</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {(skill.useCount ?? 0) > 0 && (
          <span className="text-[11px] font-mono text-primary/60 px-2 w-14 text-right tabular-nums">
            {skill.useCount}×
          </span>
        )}

        <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity gap-1 pr-2 border-r border-primary/10">
          <button
            onClick={() => onOpenInChat(skill.name)}
            aria-label={`Open ${skill.name} in Chat`}
            title="Open in Chat"
            className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggleFavorite(skill.name)}
            aria-label={`Toggle favorite ${skill.name}`}
            title="Toggle favorite"
            className="p-1 rounded hover:bg-amber-400/20 text-muted-foreground hover:text-amber-400 transition-colors"
          >
            <Star className={`w-3.5 h-3.5 ${skill.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
          </button>
          <button
            onClick={() => onEdit(skill.name)}
            aria-label={`Edit ${skill.name}`}
            title="Edit metadata"
            className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={handleCopy}
          aria-label={`Copy ${invocation}`}
          className={`text-[11px] font-mono font-bold uppercase tracking-widest border rounded px-3 py-1 transition-all min-w-[4.5rem] ${
            copyState === "copied"
              ? "text-primary-foreground bg-primary border-primary"
              : copyState === "failed"
                ? "text-destructive border-destructive/50"
                : copyState === "dormant"
                  ? "text-muted-foreground border-muted-foreground/40"
                  : "text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {COPY_LABEL[copyState]}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/skills/SkillRow.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/SkillRow.tsx src/components/skills/SkillRow.test.tsx
git commit -m "feat(skills): SkillRow - shared copy-primary row with hover actions"
```

---

### Task 5: `SkillsInCategory` adopts `SkillRow`

**Files:**
- Modify: `src/components/skills/SkillsInCategory.tsx`

**Interfaces:**
- Consumes: `SkillRow`, `RowSkill` from Task 4.
- Produces: changed props — `onLaunch` is REPLACED by `onOpenInChat: (skillName: string) => void` and `onRecordUse: (skillName: string) => void`; `skills` becomes `RowSkill[]`. Task 10 (Skills.tsx) passes the new props.

- [ ] **Step 1: Rewrite the row body**

In `src/components/skills/SkillsInCategory.tsx`:

1. Replace the imports of `GripVertical, Pencil, Star` usage in rows: change the lucide import to `import { ArrowLeft } from "lucide-react";` and add `import { SkillRow, type RowSkill } from "./SkillRow";`.
2. Delete the local `SkillEntry` interface; change the props interface:

```tsx
interface SkillsInCategoryProps {
  categoryName: string | null;
  categoryDisplayName: string;
  categoryIcon: string;
  categoryColor: string;
  skills: RowSkill[];
  categories: CategoryOption[];
  onBack: () => void;
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onEditSkill: (skillName: string) => void;
  onReassignSkill: (skillName: string, newCategoryName: string) => void;
  onToggleFavorite: (skillName: string) => void;
}
```

3. Replace the entire "Dense Skill Rows" `<div className="flex flex-col divide-y ...">…</div>` block with:

```tsx
      <div className="flex flex-col divide-y divide-primary/10 border-t border-b border-primary/20 bg-background/30">
        {skills.map((skill) => (
          <SkillRow
            key={skill.name}
            skill={skill}
            onRecordUse={onRecordUse}
            onOpenInChat={onOpenInChat}
            onEdit={onEditSkill}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
```

4. In the header `<h2>`, replace `text-white` with `text-foreground`. In the empty state keep the copy `[ NO SKILLS FOUND IN SECTOR ]` unchanged.
5. Update the destructured function parameters to match the new prop names (`onRecordUse`, `onOpenInChat` in place of `onLaunch`).

- [ ] **Step 2: Typecheck (page will fail to compile until Task 10 — scope the check)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `src/pages/Skills.tsx` (it still passes `onLaunch`). That is the known intermediate state; anything else, fix here. To keep the tree green for tests, apply the minimal interim patch to `src/pages/Skills.tsx` — replace the `<SkillsInCategory ... onLaunch={handleLaunch} ...>` props with:

```tsx
                onRecordUse={(name) => void recordLaunch({ name })}
                onOpenInChat={handleLaunch}
```

(Task 10 replaces this file wholesale; this just keeps every commit compiling.)

- [ ] **Step 3: Run the page suite**

Run: `npx tsc --noEmit && npx vitest run src/pages/__tests__/Skills.test.tsx`
Expected: typecheck clean. Two page tests fail: "navigates to chat on skill launch" (no more "Launch" text) — update that test now to the new secondary action:

```tsx
  it("navigates to chat via the row's Open in Chat action", async () => {
    render(<Skills />);
    fireEvent.click(screen.getByText("Legal"));
    fireEvent.click(screen.getByLabelText("Open legal-nda in Chat"));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/chat?skill=legal-nda");
    });
    expect(mockRecordLaunch).toHaveBeenCalledWith({ name: "legal-nda" });
  });
```

Also add the clipboard mock to this file's `beforeEach` (SkillRow copies now render on the page):

```tsx
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  setupMocks();
});
```

Run again: `npx vitest run src/pages/__tests__/Skills.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/skills/SkillsInCategory.tsx src/pages/Skills.tsx src/pages/__tests__/Skills.test.tsx
git commit -m "refactor(skills): SkillsInCategory renders shared SkillRow, copy-primary"
```

---

### Task 6: `AllSkillsOverview` component

**Files:**
- Create: `src/components/skills/AllSkillsOverview.tsx`
- Create: `src/components/skills/AllSkillsOverview.test.tsx`

**Interfaces:**
- Consumes: `SkillRow`, `RowSkill` (Task 4), `categoryHex` (Task 1).
- Produces: `AllSkillsOverview` with props `{ skills: OverviewSkill[]; categories: OverviewCategory[]; onSelectCategory: (name: string) => void; onRecordUse: (skillName: string) => void; onOpenInChat: (skillName: string) => void; onEdit: (skillName: string) => void; onToggleFavorite: (skillName: string) => void }` where `OverviewSkill = RowSkill & { categoryName: string | null }` and `OverviewCategory = { name: string; displayName: string; icon: string; color: string }`. `skills` arrive ALREADY filtered (hidden/origin/search) by the page. Task 10 mounts it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/skills/AllSkillsOverview.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AllSkillsOverview } from "./AllSkillsOverview";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/skills/AllSkillsOverview.test.tsx`
Expected: FAIL — cannot resolve `./AllSkillsOverview`.

- [ ] **Step 3: Implement**

Create `src/components/skills/AllSkillsOverview.tsx`:

```tsx
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SkillRow, type RowSkill } from "./SkillRow";
import { categoryHex } from "@/lib/categoryColors";

export type OverviewSkill = RowSkill & { categoryName: string | null };

export interface OverviewCategory {
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

interface AllSkillsOverviewProps {
  /** Already filtered by the page: non-hidden + origin filter + search. */
  skills: OverviewSkill[];
  categories: OverviewCategory[];
  onSelectCategory: (name: string) => void;
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onEdit: (skillName: string) => void;
  onToggleFavorite: (skillName: string) => void;
}

const PREVIEW_COUNT = 8;

/** The default main view: every category as a section, uncategorized last. */
export function AllSkillsOverview({
  skills,
  categories,
  onSelectCategory,
  onRecordUse,
  onOpenInChat,
  onEdit,
  onToggleFavorite,
}: AllSkillsOverviewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const byCat = new Map<string, OverviewSkill[]>();
    for (const s of skills) {
      const key = s.categoryName ?? "";
      const list = byCat.get(key);
      if (list) list.push(s);
      else byCat.set(key, [s]);
    }
    const catByName = new Map(categories.map((c) => [c.name, c]));
    const named = [...byCat.entries()]
      .filter(([key]) => key !== "")
      .map(([key, list]) => ({ key, cat: catByName.get(key) ?? null, list }))
      .sort((a, b) => b.list.length - a.list.length);
    return { named, uncategorized: byCat.get("") ?? [] };
  }, [skills, categories]);

  if (skills.length === 0) {
    return (
      <div className="text-center font-mono text-sm tracking-widest text-muted-foreground py-8 border border-dashed border-primary/20 rounded bg-primary/5">
        [ NO SKILLS MATCH ]
      </div>
    );
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderList = (key: string, list: OverviewSkill[]) => {
    const isExpanded = expanded.has(key);
    const shown = isExpanded ? list : list.slice(0, PREVIEW_COUNT);
    return (
      <>
        <div className="flex flex-col divide-y divide-primary/10 border-t border-b border-primary/20 bg-background/30">
          {shown.map((skill) => (
            <SkillRow
              key={skill.name}
              skill={skill}
              onRecordUse={onRecordUse}
              onOpenInChat={onOpenInChat}
              onEdit={onEdit}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
        {list.length > PREVIEW_COUNT && (
          <button
            onClick={() => toggle(key)}
            className="self-start mt-1 inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-primary/60 hover:text-primary transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="w-3 h-3" /> Show less
              </>
            ) : (
              <>
                <ChevronRight className="w-3 h-3" /> Show all ({list.length})
              </>
            )}
          </button>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {groups.named.map(({ key, cat, list }) => {
        const hex = categoryHex(cat?.color);
        return (
          <section key={key} className="flex flex-col gap-2">
            <div className="flex items-center gap-3 border-b px-1 pb-1" style={{ borderColor: `${hex}40` }}>
              <button
                onClick={() => onSelectCategory(key)}
                aria-label={`Open ${cat?.displayName ?? key} category`}
                className="flex items-center gap-2 group/hdr"
              >
                <span className="text-lg" aria-hidden="true">
                  {cat?.icon ?? "⚡"}
                </span>
                <h3 className="text-foreground text-sm font-mono font-bold tracking-widest uppercase group-hover/hdr:text-primary transition-colors">
                  {cat?.displayName ?? key}
                </h3>
              </button>
              <span
                className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
                style={{ color: hex, borderColor: `${hex}50`, backgroundColor: `${hex}10` }}
              >
                {list.length}
              </span>
            </div>
            {renderList(key, list)}
          </section>
        );
      })}

      {groups.uncategorized.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-3 border-b border-border px-1 pb-1">
            <span className="text-lg" aria-hidden="true">📦</span>
            <h3 className="text-muted-foreground text-sm font-mono font-bold tracking-widest uppercase">
              Uncategorized
            </h3>
            <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground flex-shrink-0">
              {groups.uncategorized.length}
            </span>
            <span className="text-xs text-muted-foreground/60 ml-2">
              Drag onto a category to assign
            </span>
          </div>
          {renderList("", groups.uncategorized)}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/skills/AllSkillsOverview.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/AllSkillsOverview.tsx src/components/skills/AllSkillsOverview.test.tsx
git commit -m "feat(skills): AllSkillsOverview - grouped global view with show-all collapse"
```

---

### Task 7: `SkillCommandPalette` (Ctrl+K)

**Files:**
- Create: `src/components/skills/SkillCommandPalette.tsx`
- Create: `src/components/skills/SkillCommandPalette.test.tsx`

**Interfaces:**
- Consumes: `Command*` from `@/components/ui/command`, `Dialog/DialogContent/DialogTitle/DialogDescription` from `@/components/ui/dialog`, `isDormant`/`skillInvocation` from `@/lib/skills`.
- Produces: `SkillCommandPalette` with props `{ open: boolean; onOpenChange: (open: boolean) => void; skills: PaletteSkill[]; categories: { name: string; displayName: string }[]; onRecordUse: (skillName: string) => void; onOpenInChat: (skillName: string) => void }` where `PaletteSkill = SkillLike & { displayName: string; description?: string | null; overrideDescription?: string | null; categoryName: string | null; categoryIcon: string; favorite: boolean }`. Registers its own global Ctrl/Cmd+K listener. Task 10 mounts it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/skills/SkillCommandPalette.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SkillCommandPalette } from "./SkillCommandPalette";

// cmdk calls scrollIntoView on selection; jsdom has no layout.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

const skills = [
  { name: "legal-nda", displayName: "NDA Generator", description: "Generate NDAs", overrideDescription: null, categoryName: "legal", categoryIcon: "⚖️", favorite: true, origins: ["claude-code"], useCount: 5 },
  { name: "gsd-plan-phase", displayName: "Plan Phase", description: "Create detailed plans", overrideDescription: null, categoryName: "gsd", categoryIcon: "📋", favorite: false, origins: ["claude-code"], useCount: 10 },
  { name: "hidden-one", displayName: "Hidden", description: null, overrideDescription: null, categoryName: null, categoryIcon: "⚡", favorite: false, origins: ["claude-code"], hidden: true },
];

const categories = [
  { name: "legal", displayName: "Legal" },
  { name: "gsd", displayName: "Project Management" },
];

function renderPalette(open = true) {
  const onOpenChange = vi.fn();
  const onRecordUse = vi.fn();
  const onOpenInChat = vi.fn();
  render(
    <SkillCommandPalette
      open={open}
      onOpenChange={onOpenChange}
      skills={skills}
      categories={categories}
      onRecordUse={onRecordUse}
      onOpenInChat={onOpenInChat}
    />
  );
  return { onOpenChange, onRecordUse, onOpenInChat };
}

describe("SkillCommandPalette", () => {
  it("Ctrl+K toggles the palette", () => {
    const { onOpenChange } = renderPalette(false);
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("lists favorites group first and hides hidden skills", () => {
    renderPalette();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getAllByText("NDA Generator").length).toBeGreaterThan(0);
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("typing filters to matching skills", async () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search skills..."), { target: { value: "plan" } });
    await waitFor(() => expect(screen.queryByText("NDA Generator")).toBeNull());
    expect(screen.getByText("Plan Phase")).toBeInTheDocument();
  });

  it("selecting an item copies its invocation, records use, shows feedback", async () => {
    const { onRecordUse } = renderPalette();
    fireEvent.click(screen.getByText("Plan Phase"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/gsd-plan-phase"));
    expect(onRecordUse).toHaveBeenCalledWith("gsd-plan-phase");
    await waitFor(() => expect(screen.getByText(/\/gsd-plan-phase copied/)).toBeTruthy());
  });

  it("Ctrl+Enter opens the highlighted skill in Chat and closes", () => {
    const { onOpenInChat, onOpenChange } = renderPalette();
    fireEvent.change(screen.getByPlaceholderText("Search skills..."), { target: { value: "plan" } });
    fireEvent.keyDown(screen.getByPlaceholderText("Search skills..."), { key: "Enter", ctrlKey: true });
    expect(onOpenInChat).toHaveBeenCalledWith("gsd-plan-phase");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/skills/SkillCommandPalette.test.tsx`
Expected: FAIL — cannot resolve `./SkillCommandPalette`.

- [ ] **Step 3: Implement**

Create `src/components/skills/SkillCommandPalette.tsx`:

```tsx
import { useEffect, useMemo, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { isDormant, skillInvocation, type SkillLike } from "@/lib/skills";

export type PaletteSkill = SkillLike & {
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  categoryName: string | null;
  categoryIcon: string;
  favorite: boolean;
};

interface SkillCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skills: PaletteSkill[];
  categories: { name: string; displayName: string }[];
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
}

/**
 * Ctrl+K fuzzy finder over every non-hidden skill. Enter copies the
 * invocation (primary action, recorded); Ctrl+Enter opens the skill in Chat.
 * Composes Dialog + Command directly (not CommandDialog) because Ctrl+Enter
 * needs cmdk's controlled `value` to know the highlighted item.
 */
export function SkillCommandPalette({
  open,
  onOpenChange,
  skills,
  categories,
  onRecordUse,
  onOpenInChat,
}: SkillCommandPaletteProps) {
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setFeedback(null);
  }, [open]);

  const visible = useMemo(() => skills.filter((s) => !s.hidden), [skills]);

  const groups = useMemo(() => {
    const favorites = visible.filter((s) => s.favorite);
    const catLabel = new Map(categories.map((c) => [c.name, c.displayName]));
    const byCat = new Map<string, PaletteSkill[]>();
    for (const s of visible) {
      const key = s.categoryName ?? "";
      const list = byCat.get(key);
      if (list) list.push(s);
      else byCat.set(key, [s]);
    }
    const named = [...byCat.entries()]
      .filter(([key]) => key !== "")
      .map(([key, list]) => ({ key, label: catLabel.get(key) ?? key, list }))
      .sort((a, b) => b.list.length - a.list.length);
    return { favorites, named, uncategorized: byCat.get("") ?? [] };
  }, [visible, categories]);

  const handleCopy = async (skill: PaletteSkill) => {
    const invocation = skillInvocation(skill);
    try {
      await navigator.clipboard.writeText(invocation);
      setFeedback(
        isDormant(skill)
          ? `${invocation} copied — dormant, not loaded`
          : `${invocation} copied`
      );
    } catch {
      setFeedback("copy failed");
    }
    onRecordUse(skill.name);
  };

  const handleOpenChat = (skill: PaletteSkill) => {
    onOpenInChat(skill.name);
    onOpenChange(false);
  };

  const renderItem = (skill: PaletteSkill) => {
    const invocation = skillInvocation(skill);
    const desc = skill.overrideDescription ?? skill.description ?? "";
    return (
      <CommandItem
        key={skill.name}
        value={skill.name}
        keywords={[skill.displayName, invocation, desc]}
        onSelect={() => void handleCopy(skill)}
        className={isDormant(skill) ? "opacity-50" : ""}
      >
        <span aria-hidden="true">{skill.categoryIcon}</span>
        <span className="font-mono text-primary">{invocation}</span>
        <span className="truncate text-muted-foreground">{skill.displayName}</span>
        {skill.favorite && <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
        {isDormant(skill) && (
          <span className="ml-auto text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            dormant
          </span>
        )}
      </CommandItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Skill palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search skills. Enter copies the invocation; Ctrl+Enter opens in Chat.
        </DialogDescription>
        <Command
          value={value}
          onValueChange={setValue}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              const skill = visible.find((s) => s.name === value);
              if (skill) handleOpenChat(skill);
            }
          }}
        >
          <CommandInput placeholder="Search skills..." />
          <CommandList>
            <CommandEmpty>No skills found.</CommandEmpty>
            {groups.favorites.length > 0 && (
              <CommandGroup heading="Favorites">
                {groups.favorites.map(renderItem)}
              </CommandGroup>
            )}
            {groups.named.map((g) => (
              <CommandGroup key={g.key} heading={g.label}>
                {g.list.map(renderItem)}
              </CommandGroup>
            ))}
            {groups.uncategorized.length > 0 && (
              <CommandGroup heading="Uncategorized">
                {groups.uncategorized.map(renderItem)}
              </CommandGroup>
            )}
          </CommandList>
          <div
            aria-live="polite"
            className="border-t border-border px-3 py-2 text-[11px] font-mono text-muted-foreground"
          >
            {feedback ?? "↵ copy invocation · ctrl+↵ open in Chat"}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
```

Note: a favorited skill appears in both its Favorites group and its category group. cmdk requires unique item values to track selection — if duplicate values misbehave in the live app (selection jumping), suffix the category-group copies with `value={`${skill.name}:cat`}` and resolve `visible.find((s) => s.name === value.split(":")[0])` in the Ctrl+Enter handler.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/skills/SkillCommandPalette.test.tsx`
Expected: PASS (5 tests). If radix Dialog complains about missing `ResizeObserver`/`DOMRect` in jsdom, check `src/test/setup.ts` first — IntakeModal tests already exercise Dialog, so the polyfills should exist.

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/SkillCommandPalette.tsx src/components/skills/SkillCommandPalette.test.tsx
git commit -m "feat(skills): Ctrl+K command palette - copy-primary, ctrl+enter opens Chat"
```

---

### Task 8: `useIntakeFeed` hook

**Files:**
- Create: `src/hooks/useIntakeFeed.ts`
- Create: `src/hooks/useIntakeFeed.test.tsx`

**Interfaces:**
- Consumes: `useIntakeCommandsRaw`, `IntakeCommandRow` from `@/hooks/useIntake`.
- Produces:

```ts
export interface IntakeFeed {
  rows: IntakeCommandRow[];        // merged, deduped, capped at 20, newest-first
  isLoading: boolean;              // server query still undefined AND nothing local
  now: number;                     // shared 1 Hz tick, only live while a row is queued
  activeCount: number;             // rows with status pending | queued | executing
  labelFor: (row: IntakeCommandRow) => string;
  handleEnqueued: (row: IntakeCommandRow) => void;
  handleEnqueueFailed: (commandId: string, message: string) => void;
}
export function useIntakeFeed(): IntakeFeed;
export function formatCountdown(ms: number): string;  // "m:ss"
```

Tasks 9–10 consume all of this. The pendingLocal/reconciliation/fileName-memory/countdown logic moves here VERBATIM from `IntakePanel.tsx` (including its comments — they document hard-won Convex identity constraints).

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useIntakeFeed.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }));
vi.mock("../../convex/_generated/api", () => ({
  api: { forge: { listIntakeCommands: "mock-listIntakeCommands" } },
}));

import { useIntakeFeed, formatCountdown } from "./useIntakeFeed";
import type { IntakeCommandRow } from "./useIntake";

const serverRow = (over: Partial<IntakeCommandRow> = {}): IntakeCommandRow => ({
  commandId: "cmd-1",
  status: "queued",
  hostId: "h1",
  destination: "global",
  workspaceId: null,
  storageId: null,
  githubUrl: "https://github.com/acme/repo",
  subpath: null,
  fileName: null,
  report: null,
  error: null,
  createdAt: 1000,
  expiresAt: 999999,
  ...over,
});

// The hook consumes useIntakeCommandsRaw, which maps raw Convex docs through
// adaptIntakeCommand — feed it raw-doc-shaped objects.
const rawDoc = (over: Record<string, unknown> = {}) => ({
  commandId: "cmd-1",
  status: "queued",
  hostId: "h1",
  intakePayload: { destination: "global", githubUrl: "https://github.com/acme/repo" },
  createdAt: 1000,
  expiresAt: 999999,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIntakeFeed", () => {
  it("isLoading while the query is undefined and nothing is pending locally", () => {
    const { result } = renderHook(() => useIntakeFeed());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows).toEqual([]);
  });

  it("handleEnqueued prepends an optimistic row immediately", () => {
    mockUseQuery.mockReturnValue([]);
    const { result } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ status: "pending", fileName: "SKILL.md" })));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].status).toBe("pending");
    expect(result.current.activeCount).toBe(1);
  });

  it("handleEnqueueFailed flips the optimistic row to failed with the reason", () => {
    mockUseQuery.mockReturnValue([]);
    const { result } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ status: "pending" })));
    act(() => result.current.handleEnqueueFailed("cmd-1", "network down"));
    expect(result.current.rows[0].status).toBe("failed");
    expect(result.current.rows[0].error).toBe("network down");
  });

  it("drops the optimistic row once a server row shares its commandId", () => {
    mockUseQuery.mockReturnValue([]);
    const { result, rerender } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ status: "pending", fileName: "SKILL.md" })));
    mockUseQuery.mockReturnValue([rawDoc()]);
    rerender();
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].status).toBe("queued");
  });

  it("labelFor remembers the uploaded filename after the server row (fileName null) wins", () => {
    mockUseQuery.mockReturnValue([]);
    const { result, rerender } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ status: "pending", fileName: "SKILL.md" })));
    mockUseQuery.mockReturnValue([rawDoc()]);
    rerender();
    expect(result.current.labelFor(result.current.rows[0])).toBe("SKILL.md");
  });

  it("labelFor falls back to the repo label for GitHub rows", () => {
    mockUseQuery.mockReturnValue([rawDoc({ intakePayload: { destination: "global", githubUrl: "https://github.com/acme/repo", subpath: "skills/foo" } })]);
    const { result } = renderHook(() => useIntakeFeed());
    expect(result.current.labelFor(result.current.rows[0])).toBe("acme/repo skills/foo");
  });

  it("caps merged rows at 20", () => {
    mockUseQuery.mockReturnValue(
      Array.from({ length: 20 }, (_, i) => rawDoc({ commandId: `srv-${i}` }))
    );
    const { result } = renderHook(() => useIntakeFeed());
    act(() => result.current.handleEnqueued(serverRow({ commandId: "local-1", status: "pending" })));
    expect(result.current.rows).toHaveLength(20);
    expect(result.current.rows[0].commandId).toBe("local-1");
  });

  it("does not run the 1 Hz tick without a queued row, runs it with one", () => {
    vi.useFakeTimers();
    mockUseQuery.mockReturnValue([rawDoc({ status: "done" })]);
    const { result, rerender } = renderHook(() => useIntakeFeed());
    const before = result.current.now;
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current.now).toBe(before);
    mockUseQuery.mockReturnValue([rawDoc({ status: "queued" })]);
    rerender();
    act(() => void vi.advanceTimersByTime(1100));
    expect(result.current.now).toBeGreaterThan(before);
  });
});

describe("formatCountdown", () => {
  it("formats m:ss and clamps at 0:00", () => {
    expect(formatCountdown(125000)).toBe("2:05");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useIntakeFeed.test.tsx`
Expected: FAIL — cannot resolve `./useIntakeFeed`.

- [ ] **Step 3: Implement**

Create `src/hooks/useIntakeFeed.ts` — the logic is MOVED from `IntakePanel.tsx` (keep its comments):

```ts
/**
 * useIntakeFeed — the intake state that used to live inside IntakePanel
 * (Phase 07-02, CP-06), lifted to a hook so IntakeStrip, IntakeSheet, and
 * IntakeModal can share ONE instance owned by Skills.tsx. The Sheet unmounts
 * its content when closed; pendingLocal/fileName memory must survive that.
 *
 * Reconciliation is simpler than ForgePage's launch/stop pattern: there is no
 * second forgeJobs table for intake — a pendingLocal row is dropped once ANY
 * server row shares its commandId, since the server row IS the terminal
 * state for intake.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntakeCommandsRaw } from "@/hooks/useIntake";
import type { IntakeCommandRow } from "@/hooks/useIntake";

/** Display cap applied AFTER merge — pendingLocal rows can transiently push
 * the total above the server's already-20-capped listIntakeCommands result. */
const DISPLAY_LIMIT = 20;

/** Dedupe by commandId — the local optimistic row (listed first) wins. */
function dedupeByCommandId(rows: IntakeCommandRow[]): IntakeCommandRow[] {
  const seen = new Set<string>();
  const out: IntakeCommandRow[] = [];
  for (const row of rows) {
    if (seen.has(row.commandId)) continue;
    seen.add(row.commandId);
    out.push(row);
  }
  return out;
}

/** Formats a millisecond duration as "m:ss" for the queued-row countdown. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Strips the github.com host prefix for a compact row label. */
function extractRepoLabel(url: string): string {
  return url.replace(/^https?:\/\/github\.com\//, "");
}

export interface IntakeFeed {
  rows: IntakeCommandRow[];
  isLoading: boolean;
  now: number;
  activeCount: number;
  labelFor: (row: IntakeCommandRow) => string;
  handleEnqueued: (row: IntakeCommandRow) => void;
  handleEnqueueFailed: (commandId: string, message: string) => void;
}

export function useIntakeFeed(): IntakeFeed {
  // Distinguish "still loading" (undefined) from "no commands yet" ([]) so
  // consumers can show Skeleton rows instead of the empty-state copy (WR-01).
  const raw = useIntakeCommandsRaw();
  // Stable identity: raw ?? [] would allocate a fresh [] every render while
  // loading, churning the reconciliation effect below (deps [serverCommands])
  // into an infinite update loop.
  const serverCommands = useMemo(() => raw ?? [], [raw]);

  const [pendingLocal, setPendingLocal] = useState<IntakeCommandRow[]>([]);

  // Session-scoped commandId -> fileName memory. Server rows always carry
  // fileName: null (07-01's documented client-only contract); without this an
  // upload row's label would fall through to "Unknown" once the server row
  // replaces the optimistic one. Session-scoped by design.
  const fileNameMemory = useRef<Record<string, string>>({});

  const handleEnqueued = useCallback((row: IntakeCommandRow) => {
    if (row.fileName !== null) {
      fileNameMemory.current[row.commandId] = row.fileName;
    }
    setPendingLocal((prev) => [row, ...prev]);
  }, []);

  const handleEnqueueFailed = useCallback((commandId: string, message: string) => {
    setPendingLocal((prev) =>
      prev.map((r) =>
        r.commandId === commandId
          ? { ...r, status: "failed" as const, error: message }
          : r
      )
    );
  }, []);

  // Drop a pendingLocal row once ANY server row shares its commandId.
  useEffect(() => {
    setPendingLocal((prev) =>
      prev.filter((r) => !serverCommands.some((s) => s.commandId === r.commandId))
    );
  }, [serverCommands]);

  const rows = useMemo(
    () =>
      dedupeByCommandId([...pendingLocal, ...serverCommands]).slice(
        0,
        DISPLAY_LIMIT
      ),
    [pendingLocal, serverCommands]
  );

  const isLoading = raw === undefined && pendingLocal.length === 0;

  // Shared per-second tick for the queued countdown — a single timer, gated on
  // the presence of a queued row so an idle feed never re-renders consumers.
  const hasQueuedRow = rows.some((r) => r.status === "queued");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasQueuedRow) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasQueuedRow]);

  const activeCount = useMemo(
    () =>
      rows.filter(
        (r) => r.status === "pending" || r.status === "queued" || r.status === "executing"
      ).length,
    [rows]
  );

  const labelFor = useCallback(
    (row: IntakeCommandRow): string =>
      row.fileName ??
      fileNameMemory.current[row.commandId] ??
      (row.githubUrl
        ? `${extractRepoLabel(row.githubUrl)}${row.subpath ? " " + row.subpath : ""}`
        : "Unknown"),
    []
  );

  return { rows, isLoading, now, activeCount, labelFor, handleEnqueued, handleEnqueueFailed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useIntakeFeed.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useIntakeFeed.ts src/hooks/useIntakeFeed.test.tsx
git commit -m "refactor(intake): lift IntakePanel state into shared useIntakeFeed hook"
```

---

### Task 9: `IntakeStrip` + `IntakeSheet`

**Files:**
- Create: `src/components/skills/IntakeStrip.tsx`
- Create: `src/components/skills/IntakeStrip.test.tsx`
- Create: `src/components/skills/IntakeSheet.tsx`
- Create: `src/components/skills/IntakeSheet.test.tsx`

**Interfaces:**
- Consumes: `IntakeFeed`, `formatCountdown` (Task 8); `RowStatusBadge`, `VerdictBadge`, `DestinationBadge` from `@/components/skills/IntakeStatusBadge`; `IntakeReportView`; `Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription` from `@/components/ui/sheet`; `Collapsible*`, `Skeleton` from ui.
- Produces:
  - `IntakeStrip` props: `{ rows: IntakeCommandRow[]; activeCount: number; labelFor: (row: IntakeCommandRow) => string; onOpen: () => void }` — renders `null` when `rows.length === 0`.
  - `IntakeSheet` props: `{ open: boolean; onOpenChange: (open: boolean) => void; feed: IntakeFeed }`.

- [ ] **Step 1: Write the failing strip tests**

Create `src/components/skills/IntakeStrip.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntakeStrip } from "./IntakeStrip";
import type { IntakeCommandRow } from "@/hooks/useIntake";

const row = (over: Partial<IntakeCommandRow> = {}): IntakeCommandRow => ({
  commandId: "cmd-1",
  status: "queued",
  hostId: "h1",
  destination: "global",
  workspaceId: null,
  storageId: null,
  githubUrl: "https://github.com/acme/repo",
  subpath: null,
  fileName: null,
  report: null,
  error: null,
  createdAt: 1000,
  expiresAt: 999999,
  ...over,
});

const labelFor = () => "acme/repo";

describe("IntakeStrip", () => {
  it("renders nothing when there are no rows", () => {
    const { container } = render(
      <IntakeStrip rows={[]} activeCount={0} labelFor={labelFor} onOpen={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the latest row's label, an active count, and opens on click", () => {
    const onOpen = vi.fn();
    render(
      <IntakeStrip
        rows={[row(), row({ commandId: "cmd-2", status: "done" })]}
        activeCount={1}
        labelFor={labelFor}
        onOpen={onOpen}
      />
    );
    expect(screen.getByText("acme/repo")).toBeInTheDocument();
    expect(screen.getByText("1 active")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open intake history/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("omits the active count when nothing is active", () => {
    render(
      <IntakeStrip rows={[row({ status: "done" })]} activeCount={0} labelFor={labelFor} onOpen={vi.fn()} />
    );
    expect(screen.queryByText(/active/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement the strip**

Run: `npx vitest run src/components/skills/IntakeStrip.test.tsx` → FAIL (unresolved import).

Create `src/components/skills/IntakeStrip.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
import {
  RowStatusBadge,
  VerdictBadge,
} from "@/components/skills/IntakeStatusBadge";
import type { IntakeCommandRow } from "@/hooks/useIntake";

interface IntakeStripProps {
  rows: IntakeCommandRow[];
  activeCount: number;
  labelFor: (row: IntakeCommandRow) => string;
  onOpen: () => void;
}

/**
 * One-line intake summary under the page header: latest row's status + label,
 * live count, click to open the IntakeSheet. Renders nothing when intake has
 * never been used — the fold belongs to the skills themselves.
 */
export function IntakeStrip({ rows, activeCount, labelFor, onOpen }: IntakeStripProps) {
  const latest = rows[0];
  if (!latest) return null;

  const chip =
    latest.status === "done" ? (
      <VerdictBadge
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        verdict={(latest.report as any)?.verdict ?? "error"}
      />
    ) : (
      <RowStatusBadge status={latest.status as Exclude<IntakeCommandRow["status"], "done">} />
    );

  return (
    <button
      onClick={onOpen}
      aria-label="Open intake history"
      className="w-full bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-3 hover:border-primary/50 hover:shadow-[var(--glow-xs)] transition-all text-left"
    >
      <span className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary/70 shrink-0">
        Intake
      </span>
      <span aria-live="polite">{chip}</span>
      <span className="text-sm text-foreground truncate flex-1">{labelFor(latest)}</span>
      {activeCount > 0 && (
        <span className="text-xs font-mono text-primary px-2 py-0.5 rounded border border-primary/40 bg-primary/10 shrink-0">
          {activeCount} active
        </span>
      )}
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
    </button>
  );
}
```

Run: `npx vitest run src/components/skills/IntakeStrip.test.tsx` → PASS (3 tests).

- [ ] **Step 3: Write the failing sheet tests (port of IntakePanel.test.tsx)**

Create `src/components/skills/IntakeSheet.test.tsx`. Port the row-list cases from `src/components/skills/IntakePanel.test.tsx` — same fixtures and assertions, rendered through the sheet. The countdown/reconciliation/cap cases now live in `useIntakeFeed.test.tsx` (Task 8) and are NOT duplicated here. Build feeds by hand:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntakeSheet } from "./IntakeSheet";
import type { IntakeFeed } from "@/hooks/useIntakeFeed";
import type { IntakeCommandRow } from "@/hooks/useIntake";

const row = (over: Partial<IntakeCommandRow> = {}): IntakeCommandRow => ({
  commandId: "cmd-1",
  status: "queued",
  hostId: "h1",
  destination: "global",
  workspaceId: null,
  storageId: null,
  githubUrl: "https://github.com/acme/repo",
  subpath: null,
  fileName: null,
  report: null,
  error: null,
  createdAt: 1000,
  expiresAt: 999999,
  ...over,
});

const feed = (over: Partial<IntakeFeed> = {}): IntakeFeed => ({
  rows: [],
  isLoading: false,
  now: 0,
  activeCount: 0,
  labelFor: (r) => r.fileName ?? "acme/repo",
  handleEnqueued: vi.fn(),
  handleEnqueueFailed: vi.fn(),
  ...over,
});

function renderSheet(f: IntakeFeed) {
  return render(<IntakeSheet open onOpenChange={vi.fn()} feed={f} />);
}

describe("IntakeSheet", () => {
  it("renders Skeleton placeholder rows while loading, never the empty-state copy", () => {
    const { container } = renderSheet(feed({ isLoading: true }));
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("No intake commands yet")).toBeNull();
  });

  it("renders the locked empty-state copy once resolved to []", () => {
    renderSheet(feed());
    expect(screen.getByText("No intake commands yet")).toBeInTheDocument();
    expect(screen.getByText(/Drop a SKILL\.md or paste a GitHub URL/)).toBeInTheDocument();
  });

  it("renders the expired-row copy verbatim, with the Phase 8 secondary line", () => {
    renderSheet(feed({ rows: [row({ status: "expired" })] }));
    expect(screen.getByText("Expired — no daemon claimed this command.")).toBeInTheDocument();
    expect(screen.getByText(/Intake execution ships with the Forge daemon \(Phase 8\)\./)).toBeInTheDocument();
  });

  it("renders a failed row's error reason", () => {
    renderSheet(feed({ rows: [row({ status: "failed", error: "boom" })] }));
    expect(screen.getByText("Failed: boom")).toBeInTheDocument();
  });

  it("renders DestinationBadge for every row regardless of status", () => {
    renderSheet(feed({ rows: [row(), row({ commandId: "c2", status: "done", destination: "cold" })] }));
    expect(screen.getByText(/global/i)).toBeInTheDocument();
    expect(screen.getByText(/cold/i)).toBeInTheDocument();
  });

  it("clicking a done row's trigger toggles the report open", () => {
    renderSheet(
      feed({ rows: [row({ status: "done", report: { verdict: "approved" } })] })
    );
    const trigger = screen.getByRole("button", { name: /acme\/repo/ });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("data-state")).toBe("open");
  });

  it("shows the queued countdown from feed.now inside aria-live=off", () => {
    const { container } = renderSheet(
      feed({ rows: [row({ status: "queued", expiresAt: 125000 })], now: 0 })
    );
    expect(screen.getByText(/Expires in 2:05/)).toBeInTheDocument();
    const off = container.querySelector('[aria-live="off"]');
    expect(off?.textContent).toContain("2:05");
  });
});
```

(Adjust the `DestinationBadge`/`RowStatusBadge` text expectations to the badges' actual rendered text — check `IntakeStatusBadge.tsx` when porting; the IntakePanel tests contain the exact strings to reuse.)

- [ ] **Step 4: Run to verify failure, then implement the sheet**

Run: `npx vitest run src/components/skills/IntakeSheet.test.tsx` → FAIL (unresolved import).

Create `src/components/skills/IntakeSheet.tsx` — the row-list JSX moves from `IntakePanel.tsx` nearly verbatim (keep the aria-live comments and the `nonDoneStatus` compile-time guard):

```tsx
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  RowStatusBadge,
  VerdictBadge,
  DestinationBadge,
} from "@/components/skills/IntakeStatusBadge";
import { IntakeReportView } from "@/components/skills/IntakeReportView";
import { formatCountdown } from "@/hooks/useIntakeFeed";
import type { IntakeFeed } from "@/hooks/useIntakeFeed";
import type { IntakeCommandRow } from "@/hooks/useIntake";

interface IntakeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feed: IntakeFeed;
}

/** Full intake history + reports, slid over from the right. State lives in
 * useIntakeFeed (owned by Skills.tsx) so closing the sheet loses nothing. */
export function IntakeSheet({ open, onOpenChange, feed }: IntakeSheetProps) {
  const { rows, isLoading, now, labelFor } = feed;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary/70">
            Intake
          </SheetTitle>
          <SheetDescription>
            Validation reports for submitted skills.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {isLoading && rows.length === 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="mt-2">
              <p className="text-base font-medium">No intake commands yet</p>
              <p className="text-sm text-muted-foreground">
                Drop a SKILL.md or paste a GitHub URL with &quot;Validate
                skill&quot; — reports appear here.
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {rows.map((row) => {
                const label = labelFor(row);
                const isDone = row.status === "done";
                const isQueued = row.status === "queued";
                // Runtime-guaranteed by the isDone check above; RowStatusBadge's
                // status prop is typed Exclude<IntakeRowStatus, "done"> so a
                // "done" row can never render it (Plan 07-01 compile-time guard).
                const nonDoneStatus = row.status as Exclude<
                  IntakeCommandRow["status"],
                  "done"
                >;

                const chip = isDone ? (
                  <VerdictBadge
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    verdict={(row.report as any)?.verdict ?? "error"}
                  />
                ) : isQueued ? (
                  // A per-second live region is hostile to screen readers — the
                  // countdown text overrides the outer aria-live="polite" chip
                  // container with aria-live="off" (locked accessibility contract).
                  <span aria-live="off">
                    <RowStatusBadge
                      status={nonDoneStatus}
                      countdownLabel={`Expires in ${formatCountdown(row.expiresAt - now)}`}
                    />
                  </span>
                ) : (
                  <RowStatusBadge status={nonDoneStatus} />
                );

                const rowContent = (
                  <div className="flex items-center gap-3 py-2">
                    <span aria-live="polite">{chip}</span>
                    <span className="text-sm flex-1 truncate">{label}</span>
                    <DestinationBadge destination={row.destination ?? "global"} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleTimeString()}
                    </span>
                    {isDone && (
                      <span className="text-muted-foreground" aria-hidden="true">
                        {expandedId === row.commandId ? "▾" : "▸"}
                      </span>
                    )}
                  </div>
                );

                return (
                  <div key={row.commandId} className="border-b border-border last:border-b-0">
                    {isDone ? (
                      <Collapsible
                        open={expandedId === row.commandId}
                        onOpenChange={(o) => setExpandedId(o ? row.commandId : null)}
                      >
                        <CollapsibleTrigger asChild>
                          <button type="button" className="w-full text-left">
                            {rowContent}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <IntakeReportView row={row} />
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      rowContent
                    )}

                    {row.status === "expired" && (
                      <div className="pb-2">
                        <p className="text-sm text-foreground">
                          Expired — no daemon claimed this command.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Intake execution ships with the Forge daemon (Phase 8).
                        </p>
                      </div>
                    )}

                    {row.status === "failed" && (
                      <p className="text-sm text-foreground pb-2">Failed: {row.error}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

Run: `npx vitest run src/components/skills/IntakeSheet.test.tsx` → PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/skills/IntakeStrip.tsx src/components/skills/IntakeStrip.test.tsx src/components/skills/IntakeSheet.tsx src/components/skills/IntakeSheet.test.tsx
git commit -m "feat(intake): IntakeStrip summary + IntakeSheet slide-over replace inline panel"
```

---

### Task 10: Recompose `Skills.tsx`, delete legacy components, update page tests

**Files:**
- Modify: `src/pages/Skills.tsx` (full rewrite below)
- Modify: `src/pages/__tests__/Skills.test.tsx`
- Delete: `src/components/skills/SkillPills.tsx`, `src/components/skills/SkillPills.test.tsx`, `src/components/skills/FavoriteSkills.tsx`, `src/components/skills/FrequentSkills.tsx`, `src/components/skills/FrequentSkills.test.tsx`, `src/components/skills/UncategorizedSkills.tsx`, `src/components/skills/IntakePanel.tsx`, `src/components/skills/IntakePanel.test.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1–9 plus existing `CategoryGrid`, `NewSkillsBanner`, `SkillReviewDrawer`, `SkillEditPopover`, `CategoryEditPopover`, `IntakeModal` (props: `open`, `onClose`, `onEnqueued`, `onEnqueueFailed`), `PageHeader`, `Button`, `originOptions`.
- Produces: the final page. No component consumes Skills.tsx.

- [ ] **Step 1: Rewrite `src/pages/Skills.tsx`**

Replace the file's entire contents with:

```tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CategoryGrid } from "@/components/skills/CategoryGrid";
import { SkillsInCategory } from "@/components/skills/SkillsInCategory";
import { AllSkillsOverview } from "@/components/skills/AllSkillsOverview";
import { QuickDeck } from "@/components/skills/QuickDeck";
import { SkillCommandPalette } from "@/components/skills/SkillCommandPalette";
import { NewSkillsBanner } from "@/components/skills/NewSkillsBanner";
import { SkillReviewDrawer } from "@/components/skills/SkillReviewDrawer";
import { SkillEditPopover } from "@/components/skills/SkillEditPopover";
import { CategoryEditPopover } from "@/components/skills/CategoryEditPopover";
import { IntakeModal } from "@/components/skills/IntakeModal";
import { IntakeStrip } from "@/components/skills/IntakeStrip";
import { IntakeSheet } from "@/components/skills/IntakeSheet";
import { useIntakeFeed } from "@/hooks/useIntakeFeed";
import { Button } from "@/components/ui/button";
import { originOptions } from "@/lib/skills";
import type { Doc } from "../../convex/_generated/dataModel";

export default function Skills() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Doc<"skillCategories"> | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [reviewing, setReviewing] = useState(false);
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [intakeSheetOpen, setIntakeSheetOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const enrichedSkills = useQuery(api.skillCategories.getSkillsWithOverrides) ?? [];
  const categories = useQuery(api.skillCategories.listCategories) ?? [];
  const feed = useIntakeFeed();

  const recordLaunch = useMutation(api.registry.recordSkillLaunch);
  const updateOverride = useMutation(api.skillCategories.updateSkillOverride);
  const updateCat = useMutation(api.skillCategories.updateCategory);
  const createCat = useMutation(api.skillCategories.createCategory);
  const deleteCat = useMutation(api.skillCategories.deleteCategory);
  const toggleFav = useMutation(api.skillCategories.toggleFavorite);
  const bulkAccept = useMutation(api.skillCategories.bulkAcceptAutoAssigned);
  const seedAll = useMutation(api.skillCategories.seedExistingSkills);

  // Distinct, distinguishable labels — five repos must not all render as "Project".
  const originChoices = useMemo(() => originOptions(enrichedSkills), [enrichedSkills]);

  const reviewSkills = useMemo(
    () => enrichedSkills.filter((s) => s.isAutoAssigned && !s.hidden),
    [enrichedSkills]
  );

  const visibleSkills = useMemo(() => {
    return enrichedSkills.filter(
      (s) =>
        !s.hidden &&
        (originFilter === "all" || (s.origins ?? []).includes(originFilter))
    );
  }, [enrichedSkills, originFilter]);

  // One filter bar, both views: applies to the overview AND the drilled-in
  // category (the old rail input only pretended to search "all skills").
  const filteredSkills = useMemo(() => {
    if (!search) return visibleSkills;
    const q = search.toLowerCase();
    return visibleSkills.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q) ||
        (s.overrideDescription ?? "").toLowerCase().includes(q)
    );
  }, [visibleSkills, search]);

  const skillCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of visibleSkills) {
      if (s.categoryName) {
        counts[s.categoryName] = (counts[s.categoryName] ?? 0) + 1;
      }
    }
    return counts;
  }, [visibleSkills]);

  const categorySkills = useMemo(() => {
    if (!selectedCategory) return [];
    return filteredSkills.filter((s) => s.categoryName === selectedCategory);
  }, [filteredSkills, selectedCategory]);

  const selectedCategoryData = useMemo(() => {
    if (!selectedCategory) return null;
    const cat = categories.find((c) => c.name === selectedCategory);
    if (!cat) return null;
    return { name: cat.name, displayName: cat.displayName, icon: cat.icon, color: cat.color };
  }, [selectedCategory, categories]);

  const handleRecordUse = (skillName: string) => {
    void recordLaunch({ name: skillName });
  };

  const handleOpenInChat = async (skillName: string) => {
    await recordLaunch({ name: skillName });
    navigate(`/chat?skill=${encodeURIComponent(skillName)}`);
  };

  const handleReassignSkill = async (skillName: string, newCategoryName: string) => {
    await updateOverride({ skillName, categoryName: newCategoryName });
  };

  const handleDropOnCategory = async (categoryName: string, e?: React.DragEvent) => {
    const skillName = e?.dataTransfer.getData("text/plain");
    if (!skillName) return;
    await updateOverride({ skillName, categoryName });
    setDropTarget(null);
  };

  const handleSaveSkillOverride = async (updates: {
    displayName: string;
    description: string;
    categoryName: string;
    hidden: boolean;
    favorite: boolean;
  }) => {
    if (!editingSkill) return;
    const { favorite, ...overrideUpdates } = updates;
    await updateOverride({ skillName: editingSkill, ...overrideUpdates });
    const currentSkill = enrichedSkills.find((s) => s.name === editingSkill);
    if (currentSkill && currentSkill.favorite !== favorite) {
      await toggleFav({ skillName: editingSkill });
    }
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
    await createCat({ name, ...data, sortOrder: Date.now() });
    setCreatingCategory(false);
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    await deleteCat({ id: editingCategory._id });
    setEditingCategory(null);
  };

  const needsSeed = enrichedSkills.length > 0 && categories.length === 0;

  const editingSkillData = editingSkill
    ? enrichedSkills.find((s) => s.name === editingSkill)
    : null;

  const editingCategorySkillCount = editingCategory
    ? enrichedSkills.filter((s) => s.categoryName === editingCategory.name).length
    : 0;

  const categoryOptions = categories.map((c) => ({
    name: c.name,
    displayName: c.displayName,
    icon: c.icon,
    color: c.color,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Skills"
        className="mb-6"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open skill palette"
            >
              <Search className="w-4 h-4" />
              <span className="font-mono text-xs text-muted-foreground">Ctrl+K</span>
            </Button>
            <Button onClick={() => setIntakeModalOpen(true)}>Validate skill</Button>
          </div>
        }
      />

      {reviewSkills.length > 0 && (
        <NewSkillsBanner
          // Count what REVIEW will actually show, so the banner and the drawer
          // never disagree. countAutoAssigned includes hidden skills; this doesn't.
          count={reviewSkills.length}
          onReview={() => setReviewing(true)}
          onAcceptAll={() => bulkAccept()}
        />
      )}

      <IntakeStrip
        rows={feed.rows}
        activeCount={feed.activeCount}
        labelFor={feed.labelFor}
        onOpen={() => setIntakeSheetOpen(true)}
      />

      <QuickDeck
        skills={enrichedSkills}
        onUse={handleRecordUse}
        onOpenInChat={handleOpenInChat}
        onToggleFavorite={(name) => toggleFav({ skillName: name })}
      />

      {needsSeed && (
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground mb-3">
            Skills found but no categories set up yet.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => seedAll()}>Auto-Classify</Button>
            <Button variant="secondary" onClick={() => setCreatingCategory(true)}>
              Set Up Manually
            </Button>
          </div>
        </div>
      )}

      {!needsSeed && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left rail: categories navigation */}
          <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-4">
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-2 py-1.5 text-base text-foreground"
              aria-label="Filter by origin"
            >
              <option value="all">All origins</option>
              {originChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2 pl-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]" />
                Categories
              </h2>
              <CategoryGrid
                categories={categories}
                skillCounts={skillCounts}
                onSelectCategory={setSelectedCategory}
                onEditCategory={setEditingCategory}
                onAddCategory={() => setCreatingCategory(true)}
                dropTargetCategory={dropTarget}
                onDragOverCategory={(name) => setDropTarget(name)}
                onDragLeaveCategory={() => setDropTarget(null)}
                onDropOnCategory={(name, e) => handleDropOnCategory(name, e)}
                selectedCategory={selectedCategory}
              />
            </div>

            <div className="mt-4 pt-4 border-t border-primary/20">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 text-sm font-mono font-bold uppercase tracking-widest rounded transition-all ${
                  !selectedCategory
                    ? "bg-primary/20 text-primary border border-primary/50"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary border border-transparent"
                }`}
              >
                Overview / All
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <input
              type="text"
              placeholder="Filter skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-primary/20 rounded px-4 py-2 text-sm font-mono text-primary placeholder:text-primary/40 focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all shadow-[var(--glow-xs)]"
            />

            {!selectedCategory && (
              <AllSkillsOverview
                skills={filteredSkills}
                categories={categoryOptions}
                onSelectCategory={setSelectedCategory}
                onRecordUse={handleRecordUse}
                onOpenInChat={handleOpenInChat}
                onEdit={setEditingSkill}
                onToggleFavorite={(name) => toggleFav({ skillName: name })}
              />
            )}

            {selectedCategory && selectedCategoryData && (
              <SkillsInCategory
                categoryName={selectedCategoryData.name}
                categoryDisplayName={selectedCategoryData.displayName}
                categoryIcon={selectedCategoryData.icon}
                categoryColor={selectedCategoryData.color}
                skills={categorySkills}
                categories={categoryOptions}
                onBack={() => {
                  setSelectedCategory(null);
                  setSearch("");
                }}
                onRecordUse={handleRecordUse}
                onOpenInChat={handleOpenInChat}
                onEditSkill={setEditingSkill}
                onReassignSkill={handleReassignSkill}
                onToggleFavorite={(name) => toggleFav({ skillName: name })}
              />
            )}
          </div>
        </div>
      )}

      <SkillCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        skills={enrichedSkills}
        categories={categoryOptions}
        onRecordUse={handleRecordUse}
        onOpenInChat={handleOpenInChat}
      />

      <IntakeSheet open={intakeSheetOpen} onOpenChange={setIntakeSheetOpen} feed={feed} />

      <IntakeModal
        open={intakeModalOpen}
        onClose={() => setIntakeModalOpen(false)}
        onEnqueued={(row) => {
          feed.handleEnqueued(row);
          // Immediate feedback: show the new row in context.
          setIntakeSheetOpen(true);
        }}
        onEnqueueFailed={feed.handleEnqueueFailed}
      />

      {reviewing && (
        <SkillReviewDrawer
          skills={reviewSkills}
          categories={categories.map((c) => ({
            name: c.name,
            displayName: c.displayName,
            icon: c.icon,
          }))}
          onAccept={(skillName) => {
            // updateSkillOverride always clears isAutoAssigned. Re-send the existing
            // category so "accept" confirms the guess; an uncategorized skill still
            // accepts (category stays null) rather than silently doing nothing.
            const s = enrichedSkills.find((x) => x.name === skillName);
            void updateOverride(
              s?.categoryName ? { skillName, categoryName: s.categoryName } : { skillName }
            );
          }}
          onMove={(skillName, categoryName) => void updateOverride({ skillName, categoryName })}
          onHide={(skillName) => void updateOverride({ skillName, hidden: true })}
          onAcceptAll={() => {
            void bulkAccept();
            setReviewing(false);
          }}
          onClose={() => setReviewing(false)}
        />
      )}

      {/* ── Modals ── */}
      {editingSkillData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <SkillEditPopover
            skillName={editingSkillData.name}
            displayName={editingSkillData.displayName}
            originalDescription={editingSkillData.description ?? ""}
            description={editingSkillData.overrideDescription ?? ""}
            categoryName={editingSkillData.categoryName ?? "uncategorized"}
            hidden={editingSkillData.hidden}
            favorite={editingSkillData.favorite}
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
            isNew
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete the replaced components**

```bash
git rm src/components/skills/SkillPills.tsx src/components/skills/SkillPills.test.tsx src/components/skills/FavoriteSkills.tsx src/components/skills/FrequentSkills.tsx src/components/skills/FrequentSkills.test.tsx src/components/skills/UncategorizedSkills.tsx src/components/skills/IntakePanel.tsx src/components/skills/IntakePanel.test.tsx
```

Then verify nothing else imports them: `npx tsc --noEmit` must pass with zero references to the deleted files.

- [ ] **Step 3: Update `src/pages/__tests__/Skills.test.tsx`**

Apply these changes:

1. **Mock block** — replace the `IntakePanel` stub with `IntakeModal` + intake feed stubs, and extend the api mock with `forge`:

```tsx
// IntakeModal talks to api.forge.* internally; stub it — its behavior is
// covered by IntakeModal.test.tsx. The feed hook is stubbed so this suite
// stays isolated from api.forge queries.
vi.mock("@/components/skills/IntakeModal", () => ({
  IntakeModal: () => null,
}));
vi.mock("@/hooks/useIntakeFeed", () => ({
  useIntakeFeed: () => ({
    rows: [],
    isLoading: false,
    now: 0,
    activeCount: 0,
    labelFor: () => "",
    handleEnqueued: vi.fn(),
    handleEnqueueFailed: vi.fn(),
  }),
  formatCountdown: () => "0:00",
}));
```

(The `api` mock does NOT need a `forge` key once `useIntakeFeed` is stubbed.)

2. **beforeEach** — add the clipboard mock (done in Task 5 if not already):

```tsx
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  setupMocks();
});
```

3. **Replace** `it("shows frequently used skills", ...)` with:

```tsx
  it("renders the Command Deck with most-used chips", () => {
    render(<Skills />);
    expect(screen.getByText("Command Deck")).toBeInTheDocument();
    // gsd-plan-phase has useCount 10 — its invocation chip must be present.
    expect(screen.getByText("/gsd-plan-phase")).toBeInTheDocument();
  });
```

4. **Replace** `it("filters skills by search in drill-in view", ...)` with:

```tsx
  it("filters skills by search in drill-in view", () => {
    render(<Skills />);
    fireEvent.click(screen.getByText("Legal"));
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

  it("copy is the primary action on a drilled-in skill row", async () => {
    render(<Skills />);
    fireEvent.click(screen.getByText("Legal"));
    fireEvent.click(screen.getByRole("button", { name: /copy \/legal-nda/i }));
    await waitFor(() => {
      expect(mockRecordLaunch).toHaveBeenCalledWith({ name: "legal-nda" });
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
```

5. The uncategorized tests keep working (`AllSkillsOverview` renders "Uncategorized", "Misc Tool", and "Drag onto a category to assign"). Delete only the "with separator" phrase from the first test's name if desired; assertions stand.
6. `it("navigates to chat via the row's Open in Chat action", ...)` from Task 5 stands unchanged.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck clean; ALL tests green (page suite, all new component suites, all untouched suites). Fix any straggler imports of deleted components.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(skills): recompose Skills page - deck, palette, overview, intake strip/sheet"
```

---

### Task 11: Style pass — `NewSkillsBanner`, `CategoryGrid` tokens

**Files:**
- Modify: `src/components/skills/NewSkillsBanner.tsx`
- Modify: `src/components/skills/CategoryGrid.tsx`

**Interfaces:** none change — visual-only.

- [ ] **Step 1: Align NewSkillsBanner with the strip language**

In `src/components/skills/NewSkillsBanner.tsx`, replace the root `<div className=...>` line's classes with:

```tsx
    <div className="bg-card border border-primary/30 rounded-lg px-4 py-2 flex items-center justify-between shadow-[var(--glow-xs)] relative overflow-hidden">
```

and the message `<span>` classes with:

```tsx
        <span className="text-sm text-primary font-mono font-bold tracking-widest uppercase relative z-10">
```

(Same height/rhythm as `IntakeStrip`: `px-4 py-2`, `rounded-lg`, `bg-card`. The scanline stays — this section reflects live review state.)

- [ ] **Step 2: Token cleanup in CategoryGrid**

In `src/components/skills/CategoryGrid.tsx`:
- Replace `'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'` with `'bg-transparent border-transparent hover:bg-accent/50 hover:border-border'`.
- Replace `text-white group-hover:text-primary` with `text-foreground group-hover:text-primary`.
- Replace `hover:text-white` (edit button) with `hover:text-foreground`.
- In the count badge style object, replace both `'#fff'` literals with `'var(--primary-foreground)'`.
- Remove `drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]` from the icon span (raw white glow breaks the light + readable themes).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run src/pages/__tests__/Skills.test.tsx`
Expected: clean + green (no behavioral assertions touch these classes).

- [ ] **Step 4: Commit**

```bash
git add src/components/skills/NewSkillsBanner.tsx src/components/skills/CategoryGrid.tsx
git commit -m "style(skills): token-driven NewSkillsBanner strip + CategoryGrid cleanup"
```

---

### Task 12: Full verification — suite, live app, themes

**Files:** none created (screenshots go to the session scratchpad).

- [ ] **Step 1: Full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all green. Record final counts.

- [ ] **Step 2: Live smoke test**

Dev server runs at `http://localhost:5173/skills` (the `\CodePulseUI` scheduled task keeps Vite alive; check `~/.forge/codepulse-autostart.log` if down). Verify by driving the real page (Playwright script from the repo root — `node` resolves `playwright` from repo `node_modules`, so run scripts with the repo as CWD and the script file inside the repo, or use the `webapp-testing` skill):

1. Page loads: Command Deck renders chips; categories rail intact.
2. `Ctrl+K` opens the palette; typing filters; `Enter` copies (verify clipboard or the footer feedback text); `Ctrl+Enter` navigates to `/chat?skill=...`.
3. Click a deck chip → "copied" state appears.
4. Overview: groups render largest-first, "Show all (n)" expands, filter bar narrows across groups.
5. Drill into a category → rows render, Copy primary works, drag a row onto a rail category → it moves.
6. "Validate skill" → modal opens; enqueue a GitHub URL → IntakeSheet slides open with the optimistic row; close the sheet; the IntakeStrip shows the row.
7. Review banner (if auto-assigned skills exist) opens the drawer.

- [ ] **Step 3: Theme sweep**

In the browser console or the ThemeSwitcher, cycle `cyan`, `emerald`, `readable`, `aubergine`, and light. Confirm: no white-on-light text, no fixed indigo/gray artifacts, glows suppressed under `readable`.

- [ ] **Step 4: Screenshots + graph update**

Capture before/after full-page screenshots (before = git stash or the pre-redesign commit if needed; after = current) to the scratchpad for the record. Then run `graphify update .` (AST-only) per project rules.

- [ ] **Step 5: Final commit (if verification produced fixes)**

```bash
git add -A
git commit -m "fix(skills): live-QA fixes from command-center verification"
```

---

## Self-Review Notes (completed at plan-writing time)

- **Spec coverage:** deck (T2/T3), palette (T7), SkillRow copy-primary (T4/T5), global search + overview (T6/T10), intake strip/sheet/hook (T8/T9), tokens + COLOR_HEX centralization (T1/T11), seed-state restyle (T10 Step 1), zero-Convex constraint (no convex/ file touched), verification incl. theme sweep (T12). The spec's "rail search becomes palette trigger" is satisfied by the header ⌘K button + main filter bar; no separate rail search input remains.
- **Type consistency:** `onRecordUse`/`onOpenInChat`/`onEdit`/`onToggleFavorite` names are uniform across SkillRow, SkillsInCategory, AllSkillsOverview, QuickDeck (`onUse` on QuickDeck mirrors the old SkillPills contract deliberately — it records a copy). `RowSkill`/`OverviewSkill`/`PaletteSkill`/`DeckSkill` all extend `SkillLike`.
- **Known intermediate state:** Task 5 leaves Skills.tsx on an interim patch; every commit still compiles and tests green.
