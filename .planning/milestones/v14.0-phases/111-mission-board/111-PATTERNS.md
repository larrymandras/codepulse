# Phase 111: Mission Board - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 6 in-scope (2 modify, 1 delete, 1 modify-mount, 2 read-only context)
**Analogs found:** 6 / 6

This is a subtraction phase — no new component shape is introduced. Every analog below exists to
show the executor the EXACT existing idiom to preserve, and the exact prior precedent for removing
a component + its mount cleanly. Nothing here should be used to justify inventing new markup.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/JobsPanel.tsx` | component (list panel) | request-response (Convex live query) | itself (built from `BlackboardPanel.tsx`) + `MissionTimelinePanel.tsx`'s `relativeTime`/`normalizeMs` | exact (self) / exact (day-tier formatter) |
| `src/components/control-center/ActiveAgentsPanel.tsx` | component (deleted) | request-response | `src/components/brains/BrainsWsRegistrar.tsx` (prior deletion precedent, commit `cff6d866`) | role-match (deletion precedent) |
| `src/pages/Chat.tsx` (~1053-1055, import ~41) | page (mount site) | request-response | `src/App.tsx` diff in `cff6d866` (mount removal precedent) | exact (deletion-precedent shape) |
| `src/pages/LiveRun.tsx:251` | page (mount site, unchanged) | request-response | n/a — read-only context, no action | n/a |
| `src/hooks/useSubagentJobs.ts` | hook | request-response | n/a — read-only context, no action | n/a |
| `src/components/StatusBadge.tsx` | component (shared) | transform | n/a — read-only context, prohibition only | n/a |

---

## Pattern Assignments

### `src/components/JobsPanel.tsx` (component, request-response)

**Analog:** the file's own header docstring names its template explicitly — `BlackboardPanel.tsx`
(`src/components/BlackboardPanel.tsx:1-7`), which `JobsPanel` already mirrors line-for-line. Treat
`BlackboardPanel` as the "what shape is correct" reference and `JobsPanel`'s *current* code as the
diff base.

**Current full file** (`src/components/JobsPanel.tsx:1-110`) — already read in full; the four
concrete edits this phase makes are below, each anchored to the current line.

**1. `stateIcon` map pruning (D-08)** — current (`JobsPanel.tsx:26-32`):
```tsx
const stateIcon: Record<string, React.ReactNode> = {
  queued: <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />,
  running: <Zap className="h-3.5 w-3.5 text-[#22c55e] animate-pulse" />,
  completed: <CheckCircle className="h-3.5 w-3.5 text-primary/80" />,
  failed: <XCircle className="h-3.5 w-3.5 text-[#ef4444]" />,
  cancelled: <Ban className="h-3.5 w-3.5 text-muted-foreground" />,
};
```
Remove the `queued` and `running` keys only. The fallback usage at the call site
(`JobsPanel.tsx:88`) already reads `stateIcon[job.status] ?? <Clock ... />` — this is the exact
fallback shape UI-SPEC requires be preserved (see StatusBadge section below for the sibling rule).
Do not add an `unknown` key — an unmapped status (including `"unknown"`) must fall through to that
same `<Clock className="h-3.5 w-3.5 text-muted-foreground/50" />` default, unchanged.

**2. Hex→token color fix, same map** — `failed: <XCircle className="h-3.5 w-3.5 text-[#ef4444]" />`
becomes `text-(--status-error)`. Confirmed live house syntax for this exact token, `file:line`
evidence (repo-wide grep, Tailwind 4 arbitrary-CSS-property form `text-(--var)`, NOT
`text-[var(--x)]`):
- `src/pages/ConfigPage.tsx:352` — `className="text-base text-(--status-error)"`
- `src/components/blocks/ErrorBlock.tsx:8` — `className="text-sm font-semibold text-(--status-error) mb-1"`
- `src/components/brains/SwapHistoryList.tsx:81` — `<X className="h-4 w-4 shrink-0 text-(--status-error)" aria-hidden="true" />`
- `src/components/control-center/ActiveAgentsPanel.tsx:56` — `className="w-3.5 h-3.5 text-(--status-ok) animate-pulse shrink-0"` (same token family, `--status-ok`, in the file being deleted this phase — confirms the syntax is already load-bearing in this exact directory)

Note `BlackboardPanel.tsx:28,31,32` and `SwarmTaskNode.tsx:104-106` still carry the same
`text-[#ef4444]`/`text-[#22c55e]` hardcoded-hex pattern `JobsPanel.tsx:30` has today — those are
OUT OF SCOPE (not named in CONTEXT.md's file list); do not "fix" them incidentally.

**3. `formatElapsed` rewrite (D-09)** — current (`JobsPanel.tsx:34-48`):
```tsx
function formatElapsed(job: SubagentJobRow): string {
  const ref = job.finishedAt ?? job.submittedAt;
  if (!ref) return "";
  const refMs = ref < 1e12 ? ref * 1000 : ref; // defensive: tolerate an already-ms value
  const diffMs = Date.now() - refMs;
  const s = Math.floor(diffMs / 1000);
  if (s < 0) return "";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}
```
The `ref < 1e12 ? ref * 1000 : ref` guard (line 40) is the exact normalization UI-SPEC mandates be
preserved verbatim — do not remove or alter it. The tier structure to extend to a day bucket is
already implemented elsewhere in this codebase and should be pattern-matched rather than invented:
`src/components/control-center/MissionTimelinePanel.tsx:67-83`:
```tsx
function normalizeMs(ts: number): number {
  // Ástríðr timestamps are frequently seconds-epoch (~1.78e9); Date.now()
  // is ms-epoch (~1.78e12). Same defensive normalization BlackboardPanel/
  // JobsPanel already use.
  return ts < 1e12 ? ts * 1000 : ts;
}

function relativeTime(tsMs: number): string {
  const diffMs = Date.now() - tsMs;
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}
```
This is the closest live precedent for exactly the tier UI-SPEC's copy table adds ("< 24h" →
"≥ 24h, no cap"). The new `formatElapsed` should follow this tier shape (s/m/h/d, uncapped day
count) but with UI-SPEC's required copy strings (`finished moments ago` for <60s — note
`MissionTimelinePanel` renders a bare `0s ago` for the sub-minute case, which UI-SPEC's copy
contract explicitly overrides for this surface; do not copy that sub-tier verbatim) and
`finished {m}m ago` / `finished {h}h ago` / `finished {d}d ago` for the rest.

**4. Header copy + pulsing-dot removal (D-10)** — current (`JobsPanel.tsx:60-69`):
```tsx
<div>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-xs font-mono uppercase tracking-widest text-primary flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      BACKGROUND JOBS
    </h2>
    <Badge variant="outline" className="text-xs font-mono">
      {jobCount} jobs
    </Badge>
  </div>
```
Delete the `<span className="w-2 h-2 rounded-full bg-primary animate-pulse" />` line outright (no
replacement glyph per UI-SPEC), change `BACKGROUND JOBS` → `MISSION HISTORY`, change
`{jobCount} jobs` → `{jobCount} missions`. The empty-state block (`JobsPanel.tsx:71-78`) gets new
copy per UI-SPEC's table (`No mission history` / the `delegate_task(background=True)` body line) —
keep the existing `ListTodo` icon and the exact `flex flex-col items-center justify-center py-6
gap-2 text-center` wrapper shape unchanged (UI-SPEC: "keep existing muted `ListTodo`, unchanged").

---

### `src/components/control-center/ActiveAgentsPanel.tsx` (component, delete)

**Decision (UI-SPEC, locked):** delete outright, no re-source, no replacement affordance.

**Deletion precedent found in this repo** — commit `cff6d866`
("feat(109-03): delete the D-16 stub seam...") deleted `BrainsWsRegistrar.tsx` +
`BrainsWsRegistrar.test.tsx` and its single mount site in `src/App.tsx`, in the same commit, with
no replacement left behind. Mount-removal diff (`git show cff6d866 -- src/App.tsx`):
```diff
-import { BrainsWsRegistrar } from "./components/brains/BrainsWsRegistrar";
 ...
-        {/* 103-08 scope addition: wires brainsApi's live adapter to the shared WS connection --
-            see BrainsWsRegistrar.tsx docstring for the dangling-wire bug this closes. */}
-        <BrainsWsRegistrar />
         <AuthGuard>
```
The same commit also fixed every downstream test that referenced the deleted seam
(`BrainPickerRow.test.tsx`'s import, `GlobalSwapModal.test.tsx`'s mock/test block) rather than
leaving them broken — this is the house pattern to follow for `ActiveAgentsPanel.test.tsx` and
`Chat.test.tsx` below, not just the component + mount.

A second, smaller precedent — commit `4d33db8c` ("chore(skills): remove QuickDeck — superseded by
SkillCommandDeck") — deleted `QuickDeck.tsx` + `QuickDeck.test.tsx` with a two-line commit body
stating what superseded it and confirming nothing else imported it. Less directly applicable here
(QuickDeck had zero remaining mounts/tests to fix), but useful for the commit-message register: name
what's being removed, why, and what (if anything) supersedes it — here, "MISSION-03 / absent, not
fabricated," not a feature supersession.

**Every remaining repo-wide reference to `ActiveAgentsPanel`** (grep `ActiveAgentsPanel`, whole
repo, 8 hits) — the deletion must clear ALL of these or the build breaks:

| File | Line | What it is |
|---|---|---|
| `src/components/control-center/ActiveAgentsPanel.tsx` | whole file | the component — delete |
| `src/components/control-center/ActiveAgentsPanel.test.tsx` | whole file | its test — delete (see below) |
| `src/pages/Chat.tsx` | `41` | `import { ActiveAgentsPanel } from "@/components/control-center/ActiveAgentsPanel";` — delete |
| `src/pages/Chat.tsx` | `1053-1055` | the `<SectionErrorBoundary name="Active Agents"><ActiveAgentsPanel /></SectionErrorBoundary>` mount — delete both lines, not just the inner component (UI-SPEC explicit: "do not leave an empty boundary") |
| `src/pages/Chat.test.tsx` | `781` | `"ACTIVE AGENTS"` entry inside `SEVEN_PANEL_LABELS` array — remove; the array (and likely its name/comment, "seven panel components") needs updating since it becomes six |
| `src/pages/Chat.test.tsx` | `762-763` | doc comment listing `IntelligenceFeedPanel/ActiveAgentsPanel/MissionTimelinePanel/...` — update to drop the name, since D-06/D-07 no longer mount it |
| `.planning/phases/111-mission-board/*` | n/a | planning docs — out of scope for code edits, ignore |
| `.planning/ROADMAP.md` | n/a | contains the stale "data that streams today" claim CONTEXT.md already flags for correction per the Stale Docs rule — not this executor's file list, but worth flagging if the plan touches ROADMAP.md |

**`ActiveAgentsPanel.test.tsx` full content** (`src/components/control-center/ActiveAgentsPanel.test.tsx:1-73`)
— already read in full above; delete the whole file. It has four `it()` blocks, all asserting
behavior that no longer exists after deletion (`"agent-tile"` testid, `"No agents running."` text,
`"ACTIVE AGENTS"` header) — there is nothing in it worth preserving or porting, since the panel's
entire premise (a `status === "running"` filter against a table that never gets a `running` row) is
the defect being fixed.

**Chat.tsx mount + wrapper, exact current text to remove** (`src/pages/Chat.tsx:1053-1055`):
```tsx
              <SectionErrorBoundary name="Active Agents">
                <ActiveAgentsPanel />
              </SectionErrorBoundary>
```
Sibling in the same rail, which becomes the sole occupant (`src/pages/Chat.tsx:1046-1056`):
```tsx
            <div
              data-testid="cc-left-rail"
              className="flex flex-col gap-2 lg:flex-row lg:overflow-x-auto lg:gap-3 lg:col-span-3 xl:flex-col xl:overflow-visible xl:gap-2 xl:col-span-1 min-h-0 xl:max-h-[70vh] xl:overflow-y-auto"
            >
              <SectionErrorBoundary name="Intelligence Feed">
                <IntelligenceFeedPanel />
              </SectionErrorBoundary>
              <SectionErrorBoundary name="Active Agents">
                <ActiveAgentsPanel />
              </SectionErrorBoundary>
            </div>
```
Per UI-SPEC, no layout compensation is needed — `cc-left-rail`'s existing `flex flex-col gap-2`
(and its `lg:flex-row`/`xl:flex-col` variants) already handles a single child correctly.

---

### `src/pages/Chat.tsx` (page, mount-site edit only)

Covered above as part of the `ActiveAgentsPanel` deletion — the only edits in this file are the
import line removal (`Chat.tsx:41`) and the mount+wrapper removal (`Chat.tsx:1053-1055`). No other
part of `Chat.tsx` is in scope. `MissionTimelinePanel` (`Chat.tsx:1124`, inside its own
`SectionErrorBoundary name="Mission Timeline"`) is a DIFFERENT panel/mount and is explicitly
out of scope per D-13 — do not touch it, and do not let any new naming collide with it.

---

## Shared Patterns

### `StatusBadge` fallback chain (prohibition, not a build target)

**Source:** `src/components/StatusBadge.tsx:9-59` (full file already read).

Full resolution chain, quoted verbatim (`StatusBadge.tsx:48-58`):
```tsx
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const legacy = legacyMap[status];
  const resolvedSemantic = legacy?.semantic ?? status;
  const resolvedLabel = label ?? legacy?.label ?? status.toUpperCase();
  const style = semanticStyles[resolvedSemantic] ?? semanticStyles.idle;

  return (
    <Badge variant="secondary" className={cn("rounded-sm text-sm", style)}>
      {resolvedLabel}
    </Badge>
  );
}
```
`legacyMap` (`StatusBadge.tsx:17-46`) already has entries for `queued`, `running`, `completed`,
`failed`, `cancelled`, `timed_out` — no `unknown` entry exists, and UI-SPEC's contract requires none
be added. For `status: "unknown"`: `legacy` is `undefined` → `resolvedSemantic = "unknown"` →
`semanticStyles["unknown"]` is `undefined` → falls back to `semanticStyles.idle` (`"bg-muted
text-muted-foreground"`) → `resolvedLabel = "unknown".toUpperCase()` = `"UNKNOWN"`. This is already
exactly the honest, muted rendering the UI-SPEC and MISSION-03 require. **Apply to:** this file is
read-only context — no edit is needed or permitted here; this excerpt exists so the executor can
verify the prohibition is already satisfied rather than adding a mapping entry.

No `StatusBadge.test.tsx` exists in the repo (confirmed via glob, zero hits) — there is no existing
test-file idiom to extend for this component; if plan.md wants coverage of the fallback-to-idle
behavior for `"unknown"`, it is new test-file territory, not a modification.

### Epoch-seconds normalization (preserve verbatim, do not "fix")

Both existing occurrences use the identical ternary guard and near-identical comment. Pattern to
match exactly (variable names differ, logic is the same expression):
- `JobsPanel.tsx:40` — `const refMs = ref < 1e12 ? ref * 1000 : ref; // defensive: tolerate an already-ms value`
- `MissionTimelinePanel.tsx:71` — `return ts < 1e12 ? ts * 1000 : ts;` (inside `normalizeMs`, comment at lines 67-70 explains the seconds-vs-ms Ástríðr contract)
- `BlackboardPanel.tsx:44` — `const refMs = ref < 1e12 ? ref * 1000 : ref;` (third sibling, read-only/out-of-scope this phase, cited only to show the idiom is used 3x already, i.e. it is house convention, not a one-off)

### `EntityRow` shape (unchanged, do not modify)

`src/components/EntityRow.tsx:1-37` — full file already read. `JobsPanel`'s row usage
(`JobsPanel.tsx:84-103`) already composes this correctly (`wrapPrimary`, `icon`, `primary`,
`secondary`, `trailing`) and this phase does not touch `EntityRow.tsx` or the shape of the
`<EntityRow>` call — only the values passed into `icon`/`trailing` change as a byproduct of the
`stateIcon` map and `formatElapsed` edits above.

### Token-driven color usage (apply the pattern, not the specific token, elsewhere)

Confirmed live syntax used throughout `src/` for CSS-var-backed status colors is the Tailwind 4
arbitrary-property form `text-(--status-error)` / `text-(--status-ok)` / `text-(--status-warn)` /
`text-(--status-info)` — NOT `text-[var(--x)]`. 60+ occurrences repo-wide (see grep evidence in the
`JobsPanel.tsx` section above); this is unambiguously the house form and the one to use for the
single hex→token fix this phase makes.

### Test harness conventions (`src/test/setup.ts`)

`src/test/setup.ts:1-139` — full file already read. Relevant for any new/edited test file touching
these surfaces: it globally stubs `SpeechRecognition`, `window.Audio`/`HTMLAudioElement.play`,
`Worker`, `AudioWorkletNode`, `AudioContext.audioWorklet.addModule`, and mocks `livekit-client`.
None of these are relevant to `JobsPanel`/`ActiveAgentsPanel` tests specifically (no audio/voice/
worker dependency in this surface) — noted only so the executor doesn't need to re-derive that this
phase's tests need no new global setup.

**Nearest component test analog for the row/panel shape itself:**
`src/components/BlackboardPanel.test.tsx:1-174` (full file already read) — same
`useX()` hook + `EntityRow` + `StatusBadge` + header-label + empty-state + epoch-normalization test
shape `JobsPanel`'s own tests (if the plan adds a `JobsPanel.test.tsx`, which does not currently
exist — confirmed via glob) should follow:
- Mock the Convex hook directly (`vi.mock("../hooks/useSwarmGraph", ...)` → equivalent
  `vi.mock("../hooks/useSubagentJobs", ...)`), not `convex/react` — this file does BOTH (mocks
  `convex/react` AND the domain hook); `ActiveAgentsPanel.test.tsx` (being deleted) shows the
  simpler single-layer mock pattern that matches `JobsPanel`'s own hook-only dependency:
  ```tsx
  vi.mock("@/hooks/useSubagentJobs", () => ({
    useSubagentJobs: vi.fn(() => []),
  }));
  ```
  (`ActiveAgentsPanel.test.tsx:4-6`, being deleted this phase — cited here only as the mock-shape
  precedent for a future `JobsPanel.test.tsx`, not as code to keep.)
- Header-label assertion: `expect(screen.getByText("BLACKBOARD")).toBeInTheDocument()`
  (`BlackboardPanel.test.tsx:86`) → equivalent would assert `"MISSION HISTORY"`.
- Empty-state assertion pair: `BlackboardPanel.test.tsx:66-78` asserts both the heading and body
  text — same two-line pattern for `"No mission history"` + the `delegate_task(background=True)`
  body line.
- Epoch-seconds test pair: `BlackboardPanel.test.tsx:128-173` (two tests: renders correct `5m` for
  a 300s-ago seconds-epoch timestamp, and asserts NO `\d{4,}h` bogus value appears) — directly
  portable pattern for testing `formatElapsed`'s new day tier and the preserved `< 1e12` guard.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| — | — | — | Every in-scope file has a direct analog (self, sibling panel, or prior deletion commit) — none needed a cross-domain substitute. |

**Explicitly searched for and NOT found:**
- No `JobsPanel.test.tsx` exists today (glob returned zero hits) — there is no existing test file
  for this component to diff against; `BlackboardPanel.test.tsx` is the nearest analog if the plan
  adds one, per the Shared Patterns section above.
- No `StatusBadge.test.tsx` exists — the fallback-to-idle behavior for unmapped statuses has no
  existing test coverage anywhere in the repo to point at.
- No prior commit was found that deletes a panel AND simultaneously renames/relabels a sibling
  test-array constant like `SEVEN_PANEL_LABELS` — `cff6d866` fixes downstream test *mocks/imports*
  broken by a deletion, but its analogous array-shrink (if any existed) was not located; treat the
  `SEVEN_PANEL_LABELS` → six-panel rename in `Chat.test.tsx` as novel work guided by, but not
  copied from, `cff6d866`'s general "fix every downstream leftover the deletion exposed" discipline.

## Metadata

**Analog search scope:** `src/components/`, `src/components/control-center/`, `src/pages/`,
`src/hooks/`, `src/test/`, plus repo-wide `git log --diff-filter=D` for deletion precedent.
**Files scanned (read in full or targeted range):** `JobsPanel.tsx`, `ActiveAgentsPanel.tsx`,
`ActiveAgentsPanel.test.tsx`, `StatusBadge.tsx`, `useSubagentJobs.ts`, `EntityRow.tsx`,
`BlackboardPanel.tsx`, `BlackboardPanel.test.tsx`, `MissionTimelinePanel.tsx` (lines 55-84),
`Chat.tsx` (lines 30-45, 1020-1155), `Chat.test.tsx` (lines 740-960), `LiveRun.tsx` (lines 230-260),
`retention.ts` (lines 1-95), `src/test/setup.ts`, plus commits `cff6d866` and `4d33db8c` (full
diffs of touched files).
**Pattern extraction date:** 2026-08-10
