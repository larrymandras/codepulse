# Phase 100: Control-Surface UX - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 9 (2 new, 7 modified/audited)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/skills/ScopeRail.tsx` (NEW) | component | event-driven (drag/drop) | `src/components/skills/CategoryGrid.tsx` | exact |
| `src/hooks/usePendingLifecycleMoves.ts` (NEW) | hook | event-driven (client-optimistic reconcile) | `src/hooks/useIntakeFeed.ts` | exact |
| `src/lib/skills.ts` (MODIFY — add `resolveLifecycleActions`) | utility | transform | same file's own `isDormant`/`isShadowing`/`hasDormantCopy` helpers + the inline block in `SkillLifecycleMenu.tsx:141-148` (extraction source) | exact (self-extraction) |
| `src/pages/Skills.tsx` (MODIFY — render `<ScopeRail>`, own `dropTargetScope` state, host `usePendingLifecycleMoves`) | controller/page | event-driven | itself (`handleDropOnCategory` / `dropTarget` state, `Skills.tsx:33,134-139,297-346`) | exact (extend existing pattern in the same file) |
| `src/components/skills/SkillLifecycleMenu.tsx` (MODIFY — consume `resolveLifecycleActions`) | component | request-response | itself (behavior-preserving refactor) | exact |
| `src/components/skills/SkillRow.tsx` (MODIFY — pending overlay) | component | presentational/transform | itself; dormant-badge overlay at `SkillRow.tsx:87-89,100-104` is the visual precedent for a second, non-conflicting overlay state | exact |
| `src/components/skills/MoveToProjectDialog.tsx` (MODIFY — wire `onMoved` with `commandId`) | component | request-response | itself (`handleConfirm`, `MoveToProjectDialog.tsx:79-103`) | exact |
| `src/components/skills/ScopeRail.test.tsx` (NEW) | test | event-driven | `src/components/skills/SkillLifecycleMenu.test.tsx` (mocking convention: `convex/react` + generated `api` module mocked, no `ConvexProvider` needed) | role-match |
| `src/hooks/usePendingLifecycleMoves.test.ts` (NEW) | test | event-driven | no direct sibling test exists for `useIntakeFeed.ts` — see "No Analog Found" | partial |

**Audit-only (UX-01/UX-04 completeness — likely no code change unless a gap is found):**
`src/components/skills/AllSkillsOverview.tsx`, `src/components/skills/SkillsInCategory.tsx`, `src/components/skills/ColdStorageView.tsx`, `src/components/skills/QuickDeck.tsx` — see "Shared Patterns / UX-01 audit" below.

---

## Pattern Assignments

### `src/components/skills/ScopeRail.tsx` (NEW — component, event-driven)

**Analog:** `src/components/skills/CategoryGrid.tsx` (full file read, 130 lines)

**Imports pattern** (`CategoryGrid.tsx:1-4`):
```typescript
import { useMemo } from "react";
import { Plus, Settings } from "lucide-react";
import { Doc } from "../../../convex/_generated/dataModel";
import { categoryHex } from "@/lib/categoryColors";
```
ScopeRail's equivalent imports: `Globe`, `FolderGit2`, `Archive` from `lucide-react` (UI-SPEC mandates matching `DestinationBadge`'s icon set exactly — see `IntakeStatusBadge.tsx:24-26,225-229`), plus `resolveLifecycleActions` from `@/lib/skills`.

**Drop-target props contract to mirror** (`CategoryGrid.tsx:8-19`):
```typescript
interface CategoryGridProps {
  categories: Category[];
  skillCounts: Record<string, number>;
  onSelectCategory: (categoryName: string) => void;
  onEditCategory: (category: Category) => void;
  onAddCategory: () => void;
  dropTargetCategory?: string | null;
  onDragOverCategory?: (categoryName: string) => void;
  onDragLeaveCategory?: () => void;
  onDropOnCategory?: (categoryName: string, e: React.DragEvent) => void;
  selectedCategory?: string | null;
}
```
ScopeRail's props: replace `categories`/`skillCounts` with a fixed 3-entry list (Global/Project/Cold), replace `dropTargetCategory`/`onDragOverCategory`/`onDragLeaveCategory`/`onDropOnCategory` with `dropTargetScope`/`onDragOverScope`/`onDragLeaveScope`/`onDropOnScope` — **an independent state variable/prop set, never shared with the category props** (Research Pattern 2 / Pitfall 5).

**Core drag-drop pattern to copy verbatim** (`CategoryGrid.tsx:62-70`):
```typescript
onDragOver={(e) => {
  e.preventDefault();                    // REQUIRED or onDrop never fires
  onDragOverCategory?.(cat.name);
}}
onDragLeave={() => onDragLeaveCategory?.()}
onDrop={(e) => {
  e.preventDefault();
  onDropOnCategory?.(cat.name, e);
}}
```

**Highlight class pattern to copy verbatim** (`CategoryGrid.tsx:71-77`):
```typescript
className={`group relative flex items-center gap-3 w-full px-3 py-2 rounded transition-all cursor-pointer overflow-hidden border ${
  isActive
    ? 'bg-primary/20 border-primary shadow-[var(--glow-xs)]'
    : isDropTarget
    ? 'bg-primary/30 border-dashed border-primary shadow-[var(--glow-sm)]'
    : 'bg-transparent border-transparent hover:bg-accent/50 hover:border-border'
}`}
```
UI-SPEC extends this with a third, invalid-drop branch (not present in CategoryGrid, since categories have no "invalid" concept): `border-dashed border-destructive/40 bg-destructive/5` + `cursor-not-allowed`, rendered only for cold/dormant-row-over-Project (D-02).

**Section header pattern** (`Skills.tsx:298-301`, the "Categories" header the new "Scope" header must match exactly):
```typescript
<h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2 pl-2">
  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]" />
  Categories
</h2>
```

**Error handling:** None needed at this component's own level — the drop handler in `Skills.tsx` owns the `enqueueLifecycle` call and its `.catch()` (see Skills.tsx section below); ScopeRail itself is presentation + event-forwarding only, same division of responsibility as CategoryGrid (CategoryGrid never calls a mutation itself either).

---

### `src/hooks/usePendingLifecycleMoves.ts` (NEW — hook, event-driven reconcile)

**Analog:** `src/hooks/useIntakeFeed.ts` (full file read, 146 lines) — THE commandId-dedupe/reconcile precedent, per RESEARCH.md Pattern 1.

**Imports pattern** (`useIntakeFeed.ts:13-15`):
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntakeCommandsRaw } from "@/hooks/useIntake";
import type { IntakeCommandRow } from "@/hooks/useIntake";
```
`usePendingLifecycleMoves`'s equivalent: `useLifecycleCommands` from `@/hooks/useLifecycle` (already exported, reactive Convex subscription — no polling needed), plus `lifecycleRefusalMessage` and `toast` from `sonner`.

**Core reconcile pattern to port verbatim, then extend to be status-aware** (`useIntakeFeed.ts:95-100` — the EXACT precedent cited by RESEARCH.md):
```typescript
// Drop a pendingLocal row once ANY server row shares its commandId.
useEffect(() => {
  setPendingLocal((prev) =>
    prev.filter((r) => !serverCommands.some((s) => s.commandId === r.commandId))
  );
}, [serverCommands]);
```
Intake's rule is simpler ("clear on ANY match"); the lifecycle version must branch on terminal status only (`done` clears silently, `failed`/`expired` clear **and** toast) — see RESEARCH.md's "Sketch for the NEW usePendingLifecycleMoves hook" for the exact status-aware rewrite; do not just port the intake version unmodified.

**Setter pattern** (`useIntakeFeed.ts:78-83`, the paint-before-await precedent):
```typescript
const handleEnqueued = useCallback((row: IntakeCommandRow) => {
  if (row.fileName !== null) {
    fileNameMemory.current[row.commandId] = row.fileName;
  }
  setPendingLocal((prev) => [row, ...prev]);
}, []);
```
`usePendingLifecycleMoves`'s equivalent setter is keyed by `skillName` (a `Record<skillName, PendingMove>`, not an array — CONTEXT.md's discretion note), storing `{ commandId, action, destination }`.

**Failure setter pattern** (`useIntakeFeed.ts:85-93`, the synchronous-rejection precedent — directly answers RESEARCH.md's Pitfall 3, LAYER-1 throws before any row exists):
```typescript
const handleEnqueueFailed = useCallback((commandId: string, message: string) => {
  setPendingLocal((prev) =>
    prev.map((r) =>
      r.commandId === commandId
        ? { ...r, status: "failed" as const, error: message }
        : r
    )
  );
}, []);
```
For `usePendingLifecycleMoves`, the analogous case is: the drop handler's own `enqueueLifecycle(...).catch(err => { clearPending(skillName); toast.error(lifecycleRefusalMessage(err)); })` must clear pending directly — **it cannot rely on the reconcile-effect**, since no `forgeCommands` row is ever inserted for a LAYER-1 refusal (RESEARCH.md Pitfall 3).

**Error/refusal-message extraction (reuse as-is, do not reimplement)** (`src/hooks/useLifecycle.ts:85-90`):
```typescript
export function lifecycleRefusalMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const match = /lifecycle-refused:[^:]+:([\s\S]+)/.exec(raw);
  const message = (match ? match[1] : raw).split("\n")[0].trim();
  return message || "Lifecycle command failed";
}
```

**Reactive data source (reuse as-is)** (`src/hooks/useLifecycle.ts:106-126`):
```typescript
export function useLifecycleCommandsRaw(): LifecycleCommandRow[] | undefined {
  const raw = useQuery(api.forge.listLifecycleCommands, {});
  return useMemo(
    () => (raw === undefined ? undefined : raw.map(adaptLifecycleCommand)),
    [raw]
  );
}
export const EMPTY_LIFECYCLE_ROWS: LifecycleCommandRow[] = [];
export function useLifecycleCommands(): LifecycleCommandRow[] {
  return useLifecycleCommandsRaw() ?? EMPTY_LIFECYCLE_ROWS;
}
```
Note the `useMemo`-stable-identity discipline (`useIntakeFeed.ts:66-68` makes the identical point for its own `serverCommands`) — an unmemoized `.map()`/`?? []` allocates a fresh array every render and can loop the reconcile effect into "Maximum update depth exceeded." This is a load-bearing gotcha in both analogs; the new hook must preserve it.

**Correlation key — the one thing NOT to copy from `latestLifecycleForSkill`:**
```typescript
// src/hooks/useLifecycle.ts:135-147 — DO NOT use this for reconcile;
// it is skillName + newest-createdAt, the WRONG correlation for
// "did MY specific drag-triggered command finish?"
export function latestLifecycleForSkill(
  rows: LifecycleCommandRow[],
  skillName: string
): LifecycleCommandRow | null { /* ... */ }
```
Use `lifecycleCommands.find((c) => c.commandId === entry.commandId)` instead (a `find`, not this helper).

---

### `src/lib/skills.ts` (MODIFY — extract `resolveLifecycleActions`)

**Analog:** the file's own established helper style (`isDormant`, `isShadowing`, `hasDormantCopy` — `src/lib/skills.ts:20-39`), plus the extraction source, `SkillLifecycleMenu.tsx:141-148`.

**Existing helper style to match** (`src/lib/skills.ts:20-29`):
```typescript
export function isDormant(skill: SkillLike): boolean {
  const origins = skill.origins ?? [];
  return origins.length > 0 && origins.every((o) => o === DORMANT_ORIGIN);
}

export function isShadowing(skill: SkillLike): boolean {
  const origins = skill.origins ?? [];
  return origins.includes(DORMANT_ORIGIN) && origins.some((o) => o !== DORMANT_ORIGIN);
}
```
All are pure, unit-tested, no React/Convex import — `src/lib/skills.test.ts` already exists and is the test target to extend.

**Exact inline block to extract, verbatim source** (`SkillLifecycleMenu.tsx:141-148`):
```typescript
const dormant = isDormant(skill) || lane === "cold";
const shadowed = isShadowing(skill);
const nonDormantOrigins = (skill.origins ?? []).filter(
  (o) => o !== DORMANT_ORIGIN
);
const multiScope = nonDormantOrigins.length > 1;
const activeOrigin = nonDormantOrigins.length === 1 ? nonDormantOrigins[0] : undefined;
const moveDestinationIsProject = activeOrigin === "claude-code";
```
RESEARCH.md's Pattern 3 gives the exact target signature (`resolveLifecycleActions(skill, lane)` returning `LifecycleActionState`) — this is a behavior-preserving refactor; `SkillLifecycleMenu.tsx`'s existing test fixtures (`activeGlobal`/`activeProject`/`dormant`/`multiScope`/`shadowedMerged`, confirmed present in `SkillLifecycleMenu.test.tsx`) must produce identical output before/after.

**Multi-scope disabled-state precedent to mirror in the drag matrix** (`SkillLifecycleMenu.tsx:283-305`):
```typescript
) : multiScope ? (
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()}>
          <ArchiveIcon /> Archive
        </DropdownMenuItem>
        <DropdownMenuItem disabled onSelect={(e) => e.preventDefault()}>
          <FolderInput /> Move…
        </DropdownMenuItem>
      </div>
    </TooltipTrigger>
    <TooltipContent>
      Active in multiple scopes — disambiguation ships in a later release.
    </TooltipContent>
  </Tooltip>
) : ( /* ... */ )
```
The drag matrix must reject `multiScope === true` for every lane, exactly mirroring this (RESEARCH.md's Drag Matrix table + Pitfall 4/Assumption A3).

---

### `src/pages/Skills.tsx` (MODIFY — new `dropTargetScope` state, `<ScopeRail>` render, host `usePendingLifecycleMoves`)

**Analog:** itself — the existing category-drag wiring is the exact pattern to replicate for scope.

**Existing state to NOT reuse (own independent state required)** (`Skills.tsx:33`):
```typescript
const [dropTarget, setDropTarget] = useState<string | null>(null);
```
Add a sibling `const [dropTargetScope, setDropTargetScope] = useState<string | null>(null);` — confirmed load-bearing by RESEARCH.md Pitfall 5: sharing state means `handleDropOnCategory`'s `setDropTarget(null)` (line 138) clears the OTHER rail's highlight on an unrelated drop.

**Existing drop handler to mirror the shape of, not the mutation** (`Skills.tsx:134-139`):
```typescript
const handleDropOnCategory = async (categoryName: string, e?: React.DragEvent) => {
  const skillName = e?.dataTransfer.getData("text/plain");
  if (!skillName) return;
  await updateOverride({ skillName, categoryName });
  setDropTarget(null);
};
```
The new `handleDropOnScope(scope, e)` follows the identical `dataTransfer.getData("text/plain")` → resolve-and-branch shape, but instead of one mutation call it branches through `resolveLifecycleActions` (from `src/lib/skills.ts`) to decide no-op / direct `enqueueLifecycle` / open `MoveToProjectDialog`, and calls `usePendingLifecycleMoves`'s setter before awaiting (RESEARCH.md's "paint-before-await" requirement, IntakeModal's B2 precedent).

**Existing rail-mount pattern to replicate below Categories** (`Skills.tsx:297-314`):
```typescript
<div className="flex flex-col gap-2">
  <h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2 pl-2">
    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]" />
    Categories
  </h2>
  <CategoryGrid
    categories={categories}
    skillCounts={skillCounts}
    onSelectCategory={handleSelectCategory}
    onEditCategory={setEditingCategory}
    onAddCategory={() => setCreatingCategory(true)}
    dropTargetCategory={dropTarget}
    onDragOverCategory={(name) => setDropTarget(name)}
    onDragLeaveCategory={() => setDropTarget(null)}
    onDropOnCategory={(name, e) => handleDropOnCategory(name, e)}
    selectedCategory={selectedCategory}
  />
</div>
```
`<ScopeRail>` mounts as a sibling block immediately below this one (D-01: "below the Categories grid"), same `gap-4` rail rhythm (UI-SPEC Spacing Scale, `md` token).

**Enrichment lookup needed for the new handler:** `Skills.tsx` already holds `enrichedSkills` (line 41) — the scope-rail drop handler resolves the dropped `skillName` against this same array (mirrors how `handleDropOnCategory` doesn't need to resolve the skill object at all, but the scope handler does, to read `.origins` via `resolveLifecycleActions`).

---

### `src/components/skills/SkillRow.tsx` (MODIFY — pending overlay)

**Analog:** itself — the existing dormant-badge overlay is the direct visual precedent for a second, mutually-exclusive overlay state.

**Existing overlay pattern to extend, not replace** (`SkillRow.tsx:87-89, 100-104`):
```typescript
className={`group relative flex items-center gap-3 px-3 py-2 hover:bg-primary/10 transition-colors ${
  dormant ? "opacity-50" : ""
}`}
...
{dormant && (
  <span className="text-[9px] font-mono uppercase tracking-widest border border-muted-foreground/40 text-muted-foreground rounded px-1 shrink-0">
    dormant
  </span>
)}
```
UI-SPEC mandates the pending state use a **different** opacity (`70%`, not the existing `50%`) specifically so "pending" and "dormant" never look identical (UI-SPEC "Optimistic pending row" section) — this is a deliberate divergence from the dormant pattern's exact value, not a copy-verbatim case.

**New prop needed:** `SkillRow` needs a `pending?: PendingMove` (or similar) prop, threaded from whichever list component (`AllSkillsOverview`, `SkillsInCategory`, `ColdStorageView`) looks up `usePendingLifecycleMoves()[skill.name]` — mirrors how `hostId`/`lane` are already optional pass-through props (`SkillRow.tsx:24-31`) with the same "existing call sites keep compiling untouched" discipline.

**Badge reuse (no new component needed):** the existing `RowStatusBadge` rendering inside `SkillLifecycleMenu` (`SkillLifecycleMenu.tsx:199-218`) already covers `queued`/`executing`/`failed` — the new pending-row indicator (left-edge pulsing bar) is purely additive alongside it, not a replacement.

---

### `src/components/skills/MoveToProjectDialog.tsx` (MODIFY — wire `onMoved` with `commandId`)

**Analog:** itself, full file already read (172 lines) — the integration point is a currently-unused prop.

**Existing unused hook point** (`MoveToProjectDialog.tsx:44`):
```typescript
/** Fired after enqueueLifecycle resolves successfully. */
onMoved?: () => void;
```
**Currently never invoked by its only caller** — confirmed: `SkillLifecycleMenu.tsx:347-355` renders `<MoveToProjectDialog ... />` without passing `onMoved` at all.

**Exact call site to widen** (`MoveToProjectDialog.tsx:79-103`):
```typescript
const handleConfirm = async () => {
  if (confirmDisabled) return;
  setSubmitting(true);
  const commandId = crypto.randomUUID();
  try {
    await enqueueLifecycle({
      hostId,
      commandId,
      action: "move",
      skillName,
      sourceOrigin,
      destination: "project",
      workspaceId,
    });
    onMoved?.();
    // Close ONLY on success ...
    onOpenChange(false);
  } catch (err: unknown) {
    toast.error(lifecycleRefusalMessage(err));
  } finally {
    setSubmitting(false);
  }
};
```
RESEARCH.md's Pattern 4: widen `onMoved?: () => void` to `onMoved?: (commandId: string) => void` and call it with the already-generated `commandId` (line 82) — this is the ONLY place the pending overlay may begin for a Project-target drag (never at drop time, since the dialog can still be cancelled). Covered by the existing `MoveToProjectDialog.test.tsx` per RESEARCH.md's Assumption A2.

---

## Shared Patterns

### Toast / refusal messaging
**Source:** `src/hooks/useLifecycle.ts:85-90` (`lifecycleRefusalMessage`)
**Apply to:** `usePendingLifecycleMoves`'s `.catch()` handler, the reconcile effect's `failed` branch, `MoveToProjectDialog` (unchanged, already wired)
```typescript
export function lifecycleRefusalMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const match = /lifecycle-refused:[^:]+:([\s\S]+)/.exec(raw);
  const message = (match ? match[1] : raw).split("\n")[0].trim();
  return message || "Lifecycle command failed";
}
```
Never paraphrase or invent a generic "Move failed" string (UI-SPEC Copywriting Contract) — the toast IS the daemon's real reason.

### Expiry copy (reuse verbatim)
**Source:** `src/components/skills/IntakeSheet.tsx:135-139` (first line only)
```
"Expired — no daemon claimed this command."
```
**Apply to:** the reconcile effect's `expired` branch in `usePendingLifecycleMoves`.

### Mutation call shape (`enqueueLifecycle`)
**Source:** `SkillLifecycleMenu.tsx:150-168` (`enqueue()` helper)
**Apply to:** the new scope-rail drop handler in `Skills.tsx` for Global/Cold targets (direct call, no dialog)
```typescript
enqueueLifecycle({
  hostId,
  commandId: crypto.randomUUID(),
  skillName: skill.name,
  workspaceId: null,
  ...overrides,
}).catch((err: unknown) => {
  toast.error(lifecycleRefusalMessage(err));
});
```

### Host resolution
**Source:** `SkillLifecycleMenu.tsx:76-84` (`resolveHostId`, already exported)
**Apply to:** the scope-rail drop handler needs the same host — reuse `resolveHostId(hostsRaw ?? [], hostIdProp)` + `useForgeHostsRaw()`, do not invent a new host-picking heuristic (RESEARCH.md's "Don't Hand-Roll" table).

### Test mocking convention (Convex without a Provider)
**Source:** `SkillLifecycleMenu.test.tsx:21-105`
```typescript
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));
vi.mock("../../../convex/_generated/api", () => ({
  api: { forge: { listHosts: "mock-listHosts", /* ... */ } },
}));
```
Plus the jsdom `ResizeObserver` shim (`beforeAll`, lines 78-86) needed for any Radix-based component (`DropdownMenu`/`Tooltip`), and jsdom `fireEvent.dragStart/dragOver/drop` with a plain-object `dataTransfer` mock (proven at `SkillRow.test.tsx:100`, per RESEARCH.md).
**Apply to:** `ScopeRail.test.tsx`, `usePendingLifecycleMoves.test.ts`, and any extended `Skills.test.tsx` drop-simulation tests.

### Scope/destination iconography and labels (design-system level, not code)
**Source:** `IntakeStatusBadge.tsx:225-229` (`DESTINATION_MAP`)
```typescript
const DESTINATION_MAP: Record<string, DestinationConfig> = {
  global: { label: "Global", Icon: Globe },
  project: { label: "Project", Icon: FolderGit2 },
  cold: { label: "Cold storage", Icon: Archive },
};
```
**Apply to:** `ScopeRail`'s three entry labels/icons must use these exact strings/icons (UI-SPEC explicitly requires "same three strings and same icons... as the existing `DestinationBadge` component").

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/hooks/usePendingLifecycleMoves.test.ts` | test | event-driven | `useIntakeFeed.ts` (the hook's own analog) has no sibling `.test.ts` in the codebase today — its behavior is only exercised indirectly through `IntakeStrip.test.tsx`/`IntakeSheet.test.tsx`. The planner should write this as a direct hook-level test (e.g. via `@testing-library/react`'s `renderHook`), following `SkillLifecycleMenu.test.tsx`'s Convex-mocking convention (see Shared Patterns) rather than an indirect component test, since no existing direct-hook-test example exists to copy structurally. |

## Metadata

**Analog search scope:** `src/components/skills/`, `src/hooks/`, `src/lib/`, `src/pages/` — all files named explicitly in CONTEXT.md's "CodePulse surfaces to extend" list, plus their existing `.test.tsx`/`.test.ts` siblings where present.
**Files scanned:** 13 (CategoryGrid.tsx, SkillRow.tsx, useIntakeFeed.ts, SkillLifecycleMenu.tsx + .test.tsx, src/lib/skills.ts, useLifecycle.ts, MoveToProjectDialog.tsx, IntakeStatusBadge.tsx, Skills.tsx, ColdStorageView.tsx, QuickDeck.tsx — plus existence checks on skills.test.ts, CategoryGrid.test.tsx, useIntakeFeed.test.ts, Skills.test.tsx)
**Pattern extraction date:** 2026-07-24
