---
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - convex/forge.test.ts
  - convex/forge.ts
  - convex/schema.ts
  - C:/Users/mandr/forge/src/emit/command-poller.test.ts
  - C:/Users/mandr/forge/src/emit/command-poller.ts
  - C:/Users/mandr/forge/src/index.ts
  - C:/Users/mandr/forge/src/process/lifecycle-exec.test.ts
  - C:/Users/mandr/forge/src/process/lifecycle-exec.ts
  - src/components/skills/AllSkillsOverview.test.tsx
  - src/components/skills/ColdStorageView.test.tsx
  - src/components/skills/ColdStorageView.tsx
  - src/components/skills/DeleteSkillDialog.test.tsx
  - src/components/skills/DeleteSkillDialog.tsx
  - src/components/skills/MoveToProjectDialog.test.tsx
  - src/components/skills/MoveToProjectDialog.tsx
  - src/components/skills/SkillLifecycleMenu.test.tsx
  - src/components/skills/SkillLifecycleMenu.tsx
  - src/components/skills/SkillRow.test.tsx
  - src/components/skills/SkillRow.tsx
  - src/components/skills/__tests__/SkillsInCategory.test.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/hooks/useLifecycle.test.ts
  - src/hooks/useLifecycle.ts
  - src/pages/__tests__/Skills.test.tsx
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 98: Code Review Report

**Reviewed:** 2026-07-21
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed the full Phase 98 surface: Convex mutation/preflight/adapter (`convex/forge.ts` + schema), the Forge daemon executor and poller (`lifecycle-exec.ts`, `command-poller.ts`, `index.ts`), and the CodePulse UI (menu, dialogs, hook, row wiring) plus all tests. The path-safety layers (isSafeSkillName on both sides, fixed-root resolution, V12 no-client-paths, delete cold-only host-truth re-check) are solid, and the daemon's mutex/serial-queue dispatch is correct. However, tracing the archive/move flows *end-to-end across the three repos* reveals three Critical defects: project-scoped archive/move can never succeed (the daemon needs a workspaceId the UI never sends and cannot know), the multi-scope tooltip crashes the Skills page (no TooltipProvider above the routed page — the exact Phase-84 regression class this repo already has a test documenting), and every LAYER-1 preflight refusal is silently swallowed by fire-and-forget mutation calls. All three are masked by tests that mock away the failing layer.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Archive / Move-to-Global of a project-scoped skill can never succeed — UI sends `workspaceId: null`, daemon cannot resolve the project source root

**Confidence:** High
**Files:** `src/components/skills/SkillLifecycleMenu.tsx:117-147`, `C:/Users/mandr/forge/src/process/lifecycle-exec.ts:131-139, 303-311`, `convex/forge.ts:634-636`

The menu offers Archive and "Move to Global…" for a single-scope *project* skill (`activeOrigin === "claude-code:project:<key>"`), and always enqueues with `workspaceId: null`:

```ts
// SkillLifecycleMenu.tsx:123-129
void enqueueLifecycle({
  hostId,
  commandId: crypto.randomUUID(),
  skillName: skill.name,
  workspaceId: null,
  ...overrides,
});
```

Convex preflight only requires workspaceId when the **destination** is `project` (`forge.ts:634`: `if (args.destination === "project" && !args.workspaceId)`), so the command queues fine. The daemon then resolves the **source**:

```ts
// lifecycle-exec.ts:134-138 (resolveRoot, scope === 'project')
if (!workspaceId) return null;
const ws = getWorkspace(deps.db, workspaceId);
```

`workspaceId` is null → `resolvePath` returns null → `runLifecycle` returns `'lifecycle-refused:collision:could not resolve source path (missing/unknown workspace)'` (lifecycle-exec.ts:306-311). `scopeFromOrigin`'s own comment confirms the origin hash is one-directional and "the caller's `workspaceId` ... is what identifies the actual project root" (lifecycle-exec.ts:118-123) — but no caller can supply it: the UI only knows the origin hash, not the workspaceId. So **every archive or move of a project-scoped skill fails at the daemon, 100% of the time**, and (via WR-01) the persisted error copy is factually wrong ("A dormant copy of "X" already exists in Cold Storage" for archive; "A skill named "X" is already active in global" for move). The test at `SkillLifecycleMenu.test.tsx:288-302` asserts `workspaceId: null` for a project-origin move — it encodes the broken contract; `lifecycle-exec.test.ts` never exercises a project-scoped *source* with a null workspaceId.

**Fix:** The daemon must resolve a project source from host truth instead of requiring an un-knowable workspaceId. In `runLifecycle`, when `scopeFromOrigin(payload.sourceOrigin) === 'project'` and `payload.workspaceId` is null, scan `listWorkspaces(deps.db)` for the workspace whose `repoKey(ws.rootPath)` matches the `<key>` suffix of `sourceOrigin` (or, if repoKey is unavailable here, for the workspace whose `<root>/.claude/skills/<skillName>` exists — with a refusal if more than one matches). Alternatively, extend the Convex `skills` schema/sync to carry the workspaceId per project origin and thread it through the UI. Either way, add a lifecycle-exec test for "archive project-scoped skill, workspaceId null".

### CR-02: Opening the ⋯ menu on a multi-scope skill throws "`Tooltip` must be used within `TooltipProvider`" and blanks the Skills page

**Confidence:** High
**Files:** `src/components/skills/SkillLifecycleMenu.tsx:216-237`, `src/components/ui/tooltip.tsx:21-25`, `src/layouts/DashboardLayout.tsx:182/309, 576/588, 592-597`

`SkillLifecycleMenu` renders raw `<Tooltip>` in the multi-scope branch (and the shadow branch, see WR-04). This repo's `tooltip.tsx` does **not** embed a provider — `Tooltip` is a bare `TooltipPrimitive.Root` (tooltip.tsx:21-25). Neither of DashboardLayout's two `TooltipProvider`s wraps the routed page content: one closes at the end of the sidebar (lines 182→309), the other wraps only the header button cluster (576→588); `<Outlet />` at line 595 sits outside both. The repo already documents this exact failure class:

> `CodeVaultGraph.tooltip.test.tsx:5-10` — "…renders with the REAL \[tooltip]… '`Tooltip` must be used within `TooltipProvider`' at render time when no \[provider]… must supply its own local TooltipProvider."

A skill active in both global and a project (`origins: ["claude-code", "claude-code:project:…"]` — a common real state) takes the `multiScope` branch. Opening its ⋯ menu mounts `DropdownMenuContent` → `<Tooltip>` (SkillLifecycleMenu.tsx:216) → Radix throws → the page-level `ErrorBoundary` around `<Outlet />` swallows the whole Skills page. `SkillLifecycleMenu.test.tsx:128-133` masks this by wrapping every render in `<TooltipProvider>` — the precise gap the Phase-84 regression test warns against.

**Fix:** Wrap `SkillLifecycleMenu`'s returned tree (or at minimum each `<Tooltip>` usage) in a local `<TooltipProvider delayDuration={200}>`, mirroring `CodeVaultGraph.tsx:585`'s documented pattern, and add a no-mock provider regression test like `CodeVaultGraph.tooltip.test.tsx`.

### CR-03: Every LAYER-1 preflight refusal is silently swallowed — the user's click does nothing, and the spec'd refusal copy is unreachable

**Confidence:** High
**Files:** `src/components/skills/SkillLifecycleMenu.tsx:123-129`, `src/components/skills/MoveToProjectDialog.tsx:81-95`, `src/components/skills/DeleteSkillDialog.tsx:70-84`, `convex/forge.ts:644-668, 1116-1127`

`enqueueLifecycle` deliberately throws **before any row is inserted** on a preflight refusal (forge.ts:1067-1071 "no doomed command is ever queued"). But no caller catches:

- `SkillLifecycleMenu.tsx:123` — `void enqueueLifecycle({...})` (fire-and-forget)
- `MoveToProjectDialog.tsx:81-95` / `DeleteSkillDialog.tsx:70-84` — `try { await enqueueLifecycle(...) } finally { onOpenChange(false); }` — no `catch`; the rejection escapes as an unhandled promise rejection and the dialog closes as if it succeeded.

Because no row is inserted, there is no `forgeCommands` doc → no `RowStatusBadge`, no error anywhere. This is reachable through an *enabled* menu item: a skill active in global that also has a dormant copy (`origins: ["claude-code", "claude-code:available"]`) shows an enabled Archive (nonDormantOrigins has length 1, SkillLifecycleMenu.tsx:110-114); clicking it hits `lifecycle-refused:collision:a dormant copy already exists in cold storage` (forge.ts:650-654) — and the user sees *nothing*. The 98-UI-SPEC cold-collision house copy exists only in `composeLifecycleRefusalHouseCopy`, which runs in `ackCommand` — a path a LAYER-1 refusal never reaches. Net effect: the entire LAYER-1 refusal UX is a black hole plus a console unhandled-rejection.

**Fix:** Catch the mutation rejection at each of the three call sites and surface it (the repo already has `Toaster` mounted in DashboardLayout:604 — `toast.error(...)` with the thrown message, or reuse the intake feed's `handleEnqueueFailed` pattern). In the dialogs, move `onOpenChange(false)` out of `finally` so a failed confirm keeps the dialog open with the error visible.

## Warnings

### WR-01: Daemon overloads the `collision` kind for six non-collision failures, so the Convex adapter composes factually wrong user-facing copy

**Confidence:** High
**Files:** `C:/Users/mandr/forge/src/process/lifecycle-exec.ts:250, 262, 269, 281, 292, 309, 317, 337, 347`, `convex/forge.ts:264-272`

`composeLifecycleRefusalHouseCopy` maps `kind === "collision"` + `action === "archive"` to a *fixed* string — `A dormant copy of "${name}" already exists in Cold Storage. Rename or delete it first, then archive again.` — discarding the raw reason entirely (forge.ts:264-266; same for move at 267-269). But the daemon emits `lifecycle-refused:collision:` for things that are not collisions:

```ts
// lifecycle-exec.ts:337
error: `lifecycle-refused:collision:${payload.skillName} no longer exists at its source location (already moved or deleted)`,
// lifecycle-exec.ts:309
error: 'lifecycle-refused:collision:could not resolve source path (missing/unknown workspace)',
// lifecycle-exec.ts:347
error: `lifecycle-refused:collision:${payload.skillName} contains ${reparsePoints.length} reparse point(s)…`,
```

An archive whose source vanished therefore persists the error "A dormant copy of "legal" already exists in Cold Storage…" — false, and it instructs a remediation ("delete it first") for a problem that doesn't exist. Same for move (unknown destination workspace renders as "already active in this project"). Only lifecycle-exec.ts:325-331 (destination exists) is a genuine collision.

**Fix:** Reserve `collision` for the destination-exists case; introduce distinct kinds (e.g. `source-missing`, `unresolvable`, `reparse`, `invalid-name`) that fall through to the generic `${label} failed: ${raw}. Nothing changed on disk.` branch in `composeLifecycleRefusalHouseCopy` — the generic branch already renders the raw reason accurately.

### WR-02: The persisted lifecycle failure copy (`row.error`) is never rendered anywhere — a failed command shows only a bare "Failed" chip

**Confidence:** High (as-submitted scope)
**Files:** `src/components/skills/SkillLifecycleMenu.tsx:156-159`, `src/components/skills/IntakeStatusBadge.tsx:98-122`, `src/hooks/useLifecycle.ts:69`

`adaptLifecycleCommand` carries `error: doc.error ?? null` into `LifecycleCommandRow`, and `ackCommand` + `synthesizeLifecycleRefusalReport` go to great lengths to persist actionable house copy. But the only consumer is `SkillLifecycleMenu`, which renders `<RowStatusBadge status={...} />` — status label + icon only; `inFlight.error` is never read. A repo-wide grep confirms the only component rendering a command's `.error` is `IntakeSheet.tsx:153` (intake-only). Combined with CR-03, **no lifecycle refusal — LAYER 1 or LAYER 2 — ever shows its reason to the user**: layer 1 is swallowed, layer 2 is persisted then dropped on the floor.

**Fix:** Surface `inFlight.error` for `status === "failed"` — e.g. wrap the failed `RowStatusBadge` in a `Tooltip` carrying the house copy (once CR-02's provider fix lands), or a `title` attribute at minimum.

### WR-03: `moveTree`'s copy+delete fallback leaves a partial destination on mid-copy failure, and the orphan then blocks every retry as a phantom "collision"

**Confidence:** Medium-high
**Files:** `C:/Users/mandr/forge/src/process/lifecycle-exec.ts:214-222, 324-331`

```ts
// lifecycle-exec.ts:216-218
if (CROSS_VOLUME_CODES.has(code)) {
  copyTreeReadWrite(src, dest);
  fs.rmSync(src, { recursive: true, force: true });
}
```

If `copyTreeReadWrite` throws partway (disk full, Drive I/O error — and cross-volume is the stated *common* case), the error propagates to `runLifecycle`'s catch and the ack is `failed` with the raw message (no `lifecycle-refused:` prefix, so it passes through the adapter verbatim). The half-written `dest` directory is never cleaned up. The next attempt hits the destination-exists check (lifecycle-exec.ts:325) and is refused with `already exists at the destination` — the user is now wedged behind a partial copy that no UI action can remove (it's not a registry row). This also falsifies the phase's "atomic mutation / nothing changed on disk" guarantee (D-01/D-02).

**Fix:** Wrap the fallback in try/catch and `fs.rmSync(dest, { recursive: true, force: true })` on copy failure before rethrowing (source is untouched at that point, so cleanup restores the true "nothing changed" state).

### WR-04: The shadow-blocked Restore branch is dead code (`isDormant` and `isShadowing` are mutually exclusive), and the dormant copy of a shadowed skill is unreachable — the collision copy's own remediation is impossible in the UI

**Confidence:** High
**Files:** `src/components/skills/SkillLifecycleMenu.tsx:108-109, 178-204`, `src/lib/skills.ts:20-29`, `src/components/skills/SkillLifecycleMenu.test.tsx:28-41`

```ts
// skills.ts:20-28
isDormant:   origins.length > 0 && origins.every((o) => o === DORMANT_ORIGIN);
isShadowing: origins.includes(DORMANT_ORIGIN) && origins.some((o) => o !== DORMANT_ORIGIN);
```

The menu's shadow-tooltip branch requires `dormant && shadowed` (SkillLifecycleMenu.tsx:178-180) — impossible against live data, as the test file itself concedes ("mutually exclusive by construction… here it's spied", SkillLifecycleMenu.test.tsx:28-41). Consequences: (a) the 98-UI-SPEC §3 shadow-block UI can never render — dead code shipped with mocked-only test coverage; (b) a skill that exists active + dormant is one merged row, which is filtered *out* of ColdStorageView (`isDormant` false) and gets the *active* menu — so its dormant copy can be neither restored (correct) nor **deleted** (a gap): the CR-03 archive-collision copy says "Rename or delete it first, then archive again", but no UI surface offers Delete for that dormant copy. Users hit a hard dead-end loop.

**Fix:** Either split merged rows so a shadowed name's dormant copy still appears in Cold Storage (with Restore disabled + shadow tooltip — which would make the "dead" branch live and reachable), or add a "Delete dormant copy" item to the active-branch menu when `origins.includes(DORMANT_ORIGIN)`.

## Info

### IN-01: No action↔destination coherence validation on `enqueueLifecycle` or in the daemon

**File:** `convex/forge.ts:1073-1129`, `C:/Users/mandr/forge/src/process/lifecycle-exec.ts:300-353`
**Issue:** `action: "archive"` with `destination: "global"` (or `"restore"` with `"cold"`, etc.) passes both the validator unions and `validateLifecyclePreflight`; the daemon executes archive/restore/move identically as `moveTree(src, dest)`, so a mislabeled action performs a differently-labeled move and, on refusal, composes the wrong action's house copy. Only the UI enforces the pairing, but the mutation is a public (Clerk-authed) surface.
**Fix:** Add a coherence guard to `validateLifecyclePreflight` (archive⇒cold, restore⇒global|project, delete⇒cold).

### IN-02: `commandId` comments promise a ULID; the UI sends UUIDv4

**File:** `convex/forge.ts:1076` (`// client-generated ULID`), `src/components/skills/SkillLifecycleMenu.tsx:125`, `MoveToProjectDialog.tsx:80`, `DeleteSkillDialog.tsx:69` (`crypto.randomUUID()`)
**Issue:** Harmless functionally (opaque unique string), but the comment contract and any future lexicographic-ordering assumption on commandId would be wrong.
**Fix:** Update the comments (or switch to a shared ULID helper if ordering ever matters).

---

**What I dropped and why:** `resolveHostId`'s `Date.now()` inside `useMemo` (hosts refresh every ~7s poll, staleness bounded and immaterial); `poll()`'s unguarded `res.json()` and launch/stop's duplicate-commandId `.unique()` hazard (both pre-existing Phase-80 code, explicitly deferred in 06-REVIEW WR-04, not touched by this phase); persistent failed-badge with no dismiss (subsumed by WR-02's fix); per-row duplicate `useQuery` subscriptions (Convex dedupes by query key; perf is out of v1 scope); `rmSync` symlink-following concern in delete (Node's `rmSync` removes links without traversing targets — not substantiable as a defect).

---

_Reviewed: 2026-07-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
