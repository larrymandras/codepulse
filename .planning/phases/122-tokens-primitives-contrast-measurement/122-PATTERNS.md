# Phase 122: Tokens, Primitives & Contrast Measurement - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 9 (from `<specific_targets>`) + shared cross-cutting patterns
**Analogs found:** 9 / 9 (one — `EmptyState` — has no direct analog; nearest structural neighbors given)

All file:line citations below were personally opened this session. Where CONTEXT.md's counts were
spot-checked, the command and result are shown; where not re-derived, CONTEXT.md's figure is used
as-is and not restated as newly verified.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/index.css.ratchet.test.ts` (or similar; D-25 ratchet) | test | batch (corpus scan) | `src/pages/Analytics.structuralGuard.test.ts` | exact — structural precedent named by RESEARCH.md, confirmed by reading |
| `src/hooks/useMetricState.ts` (D-14) | hook | transform (derive discriminated state) | `src/lib/loomStepState.ts` (`stepStateFrom`, pure fn) for the derivation shape; `src/hooks/useThrottledQuery.ts` for hook/JSDoc conventions | partial — no existing **hook** takes a value+options and returns a discriminated union; closest derivation logic is a pure function, not a hook |
| `e2e/theme-rendered-result.spec.ts` (D-27) | test | E2E / rasterised probe | `e2e/theme-contrast.spec.ts` (axe pattern) + `e2e/theme-reduced-motion.spec.ts` (control-pairing pattern) | role-match — no existing spec rasterises via canvas; confirmed absent |
| Shared state module (D-19/D-20; e.g. `src/lib/metricState.ts`) | utility (vocabulary/lookup table) | transform | `src/lib/loomStepState.ts` (`STEP_STATE_COLOR`, token-keyed by state enum) | strong — state-enum → token map is the same shape; needs extending with copy+icon, which loomStepState doesn't carry |
| `src/components/MetricCard.tsx` (D-13, rewrite) | component | request-response (props in, JSX out) | itself (rewritten in place) — `src/components/ui/skeleton.tsx` for the loading-shape sub-pattern | exact — editing the file itself |
| `src/components/StatusBadge.tsx` (D-07) | component | transform (lookup table → variant) | itself (rewritten in place) | exact |
| `src/components/PageHeader.tsx` (D-17/D-18) | component | request-response | itself (extended in place) | exact |
| `src/components/EmptyState.tsx` (D-19, new) | component | request-response | **no analog — new pattern.** Nearest structural neighbors: `src/components/GlassPanel.tsx` (presentational wrapper shape) and `src/components/ui/skeleton.tsx` (state-shaped placeholder) | none — confirmed absent, see below |
| `src/components/chat/VitalsRail.tsx:253` (D-16) | component | event-driven (WS connection state) | its own sibling at `:248` (Ástríðr dot) | exact — same file, three lines away |

## Pattern Assignments

### 1. `src/index.css.ratchet.test.ts` (D-25/D-26 corpus ratchet)

**Analog:** `src/pages/Analytics.structuralGuard.test.ts` (300 lines, read in full)

This is the load-bearing precedent RESEARCH.md names, and it is a genuinely strong match: it already
implements the "derive population from the corpus every run, never an enumerated list" idiom D-25
demands, and its own test suite already proves the two-mutation-plus-negative-control pattern D-26
asks for verbatim.

**What to imitate structurally** (header comment, lines 1-19): state the derivation strategy up front
and name the KNOWN LIMITATION explicitly rather than hedging silently:
```typescript
/**
 * D-04 structural ratchet: derives — from the AST of `src/pages/Analytics.tsx` itself — whether
 * any query-shaped hook sits unprotected in the page's own function body... Contains no list of
 * today's query names: `REACT_SAFE_HOOKS` below is a closed, framework-owned allowlist...
 */
```
D-25's ratchet is corpus-wide (`git grep` across `src/`), not single-file AST like this one — so the
executor should imitate the **allowlist discipline and mutation-testing rig**, not the AST machinery
itself. D-25's own corpus-derivation shape is closer to `git grep -lF`/`-lE`, which is exactly what
RESEARCH.md's own code example already sketches (see `122-RESEARCH.md` "Corpus-derived ratchet
skeleton", lines 488-516) — that skeleton is the mechanism; this file is the **rigor** template.

**The `KNOWN_EXEMPT`-as-frozen-record shape to imitate** (lines 53-69):
```typescript
/**
 * Small, closed set of presentational primitives that are rendered today without their own
 * `SectionErrorBoundary` ancestor and are verified to own no query of their own. Every entry
 * must actually appear in `Analytics.tsx`... and must be grepped for `useQuery|usePaginatedQuery`
 * before being added.
 *
 * - "GlassPanel" (`src/components/GlassPanel.tsx`) — a pure `motion.div` styling wrapper around
 *   `children`, nothing else. Grepped for `useQuery|usePaginatedQuery` 2026-08-18: 0 matches.
 */
const PRESENTATIONAL_ALLOWLIST = new Set(["GlassPanel", "SectionHeader"]);
```
D-25's `KNOWN_EXEMPT` must carry the same per-entry justification comment, not just a bare path list —
this is what makes it "a record, not a blessing" per D-25's own wording.

**`git grep` exit-code handling to imitate** (this pattern is actually in RESEARCH.md's own skeleton,
not in `Analytics.structuralGuard.test.ts` itself, since the latter reads a file directly rather than
shelling out — cite both):
```typescript
function filesWithPattern(pattern: string): string[] {
  try {
    return execSync(`git grep -lE ${JSON.stringify(pattern)} -- src`, { encoding: "utf8" })
      .trim().split("\n").filter(Boolean);
  } catch (e: any) {
    if (e.status === 1) return []; // git grep exit 1 == "no matches", not an error
    throw e;
  }
}
```
Verified live this session: `git grep -lE 'bg-(slate|zinc|gray|neutral|stone)-[0-9]{2,3}' -- src | wc -l`
→ **94 files** (a *files* count, distinct unit from CONTEXT.md's D-02 occurrence count of 310 — not a
disagreement, just a different unit, consistent with D-02's own footnote). This confirms the `git grep
-l` population-derivation approach returns a workable, non-trivial file set for the ratchet to bucket.

**The two-mutation-plus-negative-control idiom to imitate** (lines 231-300, this is D-26's exact shape):
```typescript
it("Case A: a synthetic hoisted hook, never seen in this repo, fails the ratchet", () => {
  const mutated = insertSyntheticHookCall(REAL_SOURCE);
  // Case C (validity precondition), asserted BEFORE the failure assertion below: a
  // syntactically invalid mutation would produce a parse error that reads exactly like the
  // guard firing. If this were not empty, the failure below would be evidence of nothing.
  const { diagnostics } = ts.transpileModule(mutated, {
    fileName: "Analytics.tsx", reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.Preserve },
  });
  expect(diagnostics ?? []).toEqual([]);

  const { hoistedHooks } = analyzeAnalyticsSource(mutated);
  expect(hoistedHooks).toContain("useTotallyNewThingNobodyHasWrittenYet");
});
...
it("negative control: the unmutated real source trips neither check", () => {
  // Without this, an analyzer that reports a violation for every input would pass Case A and
  // Case B while proving nothing about the real file.
  const result = analyzeAnalyticsSource(REAL_SOURCE);
  expect(result.hoistedHooks).toEqual([]);
  expect(result.unwrappedElements).toEqual([]);
});
```
D-26's "Case B" (a violation in a file appearing on **no** list) maps directly onto this file's
"Case B: a synthetic unwrapped element, never seen in this repo" — same idiom, different population
source (this file: one page's JSX tree; D-25's ratchet: every file in `src/`). Mutations here are
**string transforms held in memory** (never written to disk), which the executor should also copy —
it is what makes the mutation tests fast and disk-safe.

### 2. `src/hooks/useMetricState.ts` (D-14)

**Analog A (derivation shape):** `src/lib/loomStepState.ts:28-42` — `stepStateFrom`, read in full.

This is the closest thing in the repo to "take raw data, derive a discriminated UI state," even
though it is a plain exported function, not a hook:
```typescript
export type StepState = "pending" | "running" | "complete" | "error" | "warn";

/**
 * Precedence, highest first: error > warn > complete > running > pending.
 * ...
 */
export function stepStateFrom(events: StepEventLike[], stepId: string): StepState {
  const mine = events.filter((e) => e.stepId === stepId);
  if (mine.length === 0) return "pending";
  if (mine.some((e) => e.event === "error")) return "error";
  if (mine.some((e) => e.event === "warn")) return "warn";
  if (mine.some((e) => e.event === "complete")) return "complete";
  if (mine.some((e) => e.event === "start" || e.event === "action")) return "running";
  return "pending";
}
```
Imitate: the **precedence-ordered if-chain with a documented rationale per branch** (its comment
block at lines 18-27 justifies *why* error outranks complete). `useMetricState`'s own precedence
(unavailable > loading > empty > stale > ready, per D-14/RESEARCH.md's suggested shape) should carry
the same per-branch justification, especially for why `unavailable` must be caller-supplied rather
than inferred (D-14's central constraint).

**Analog B (hook conventions):** `src/hooks/useThrottledQuery.ts` (42 lines, read in full) — closest
example of a small, generically-typed hook with a JSDoc header explaining a non-obvious constraint:
```typescript
/**
 * Wraps useQuery with throttled React state updates.
 *
 * NOTE (CPHLTH-05): This hook throttles UI re-renders, NOT the underlying
 * Convex subscription. The subscription stays live and reactive...
 */
export function useThrottledQuery<Query extends FunctionReference<"query">>(
  queryFn: Query, args: Query["_args"], intervalMs: number = 500
): Query["_returnType"] | undefined { ... }
```
**No existing hook in `src/hooks/` (128 files enumerated) takes a bare value + options object and
returns a discriminated state union** — `useLiveState.ts` (RESEARCH.md's own suggestion) was checked
and is a poor shape match: it's a `useReducer`-driven WebSocket topic-subscription hook (157 lines),
not a pure value-in/state-out derivation. `useChannelHealth.ts`/`useProviderHealth.ts` were checked
and are one-line `useThrottledQuery` wrappers with no state derivation at all. **Say plainly: the
hook's *shape* (pure derivation from a value) has no hook-level precedent in this repo** — the
executor is composing `loomStepState.ts`'s derivation-function idiom with `useThrottledQuery.ts`'s
hook-file conventions, not copying an existing hook wholesale.

### 3. `e2e/theme-rendered-result.spec.ts` (D-27)

**Analog A (matrix/theme-switching structure):** `e2e/theme-contrast.spec.ts` (72 lines, read in full):
```typescript
const THEMES = ["cyan", "emerald", "readable", "aubergine"] as const;
...
await page.addInitScript((t: string) => {
  localStorage.setItem("codepulse-theme", t);
  localStorage.setItem("codepulse_onboarding_complete", "true");
}, theme);
await page.goto(pg.path);
await page.waitForLoadState("networkidle");
```
Imitate the `addInitScript`-before-`goto` theme-setting idiom and the onboarding-overlay suppression
— any rendered-result page load needs the same setup to avoid measuring the onboarding modal instead
of the page.

**Analog B (control-pairing structure):** `e2e/theme-reduced-motion.spec.ts` (39 lines, read in full)
— demonstrates the "assert X, then assert NOT-X under the opposite condition" control shape D-27
needs (its own two tests both assert the SAME direction today — hidden under both aubergine and
readable — which is a weaker control than D-27 needs; the *shape* of pairing two `test()` blocks in
one `describe` is what to imitate, not the specific assertions).

**Confirmed: no existing Playwright spec in this repo rasterises via canvas.** `Glob("e2e/*.ts")`
enumerated all 16 spec files; none contain `getImageData`/`canvas` (spot-checked the two most likely
candidates, `theme-contrast.spec.ts` and `theme-reduced-motion.spec.ts`, both read in full, neither
does). RESEARCH.md's own "Rasterised contrast probe with sentinel-guarded fillStyle" code block
(`122-RESEARCH.md:453-470`) is therefore the actual mechanism source — this is new code for the
phase, composed from Playwright's `page.evaluate` + the Canvas 2D API, not an in-repo rollout.

### 4. Shared state module (D-19/D-20)

**Analog:** `src/lib/loomStepState.ts:44-57` — `STEP_STATE_COLOR`, a state-enum-keyed, token-driven
lookup table:
```typescript
/**
 * CSS var per state. Every colour is a token — no hex literals, per the repo's
 * standing rule. `pending` deliberately uses the muted border rather than a
 * status colour: a step that has not run yet has no health to report...
 */
export const STEP_STATE_COLOR: Record<StepState, string> = {
  pending: "var(--muted-foreground)",
  running: "var(--primary)",
  complete: "var(--status-ok)",
  warn: "var(--status-warn)",
  error: "var(--status-error)",
};
```
This is the strongest available analog for the "tone" half of D-19's module — same shape (enum key →
token value), same discipline (a comment justifying why a state gets a *neutral* rather than a status
colour, directly relevant to how `loading`/`unavailable` should be styled). It does **not** cover the
"copy" or "icon" halves D-19 needs — no existing lookup table in `src/lib/` combines copy+icon+tone
for one enum. `src/lib/eventIcons.ts` (read in full) was checked as a candidate and rejected: its
`EVENT_ICONS`/`getEventColor` are two **separate, unkeyed-together** lookup tables over an open-ended
event-type string, not a closed six-state enum, and its icons are raw emoji, not `lucide-react`
components (this repo's icon convention per `CLAUDE.md`: "Icons: Lucide only"). `src/lib/
categoryColors.ts` (read in full) was also checked and rejected — it is explicitly a **user-data**
palette (`color` picked in a UI popover), not a design-token vocabulary, and its own header comment
says so ("Category `color` is user data... so this stays a name→hex palette rather than theme
tokens" — the opposite of what D-19 needs).

**Recommendation for the executor:** extend `loomStepState.ts`'s table shape to a `Record<MetricState,
{ label: string; icon: LucideIcon; tone: string }>`, keeping the per-entry justification-comment
discipline.

### 5. `src/components/MetricCard.tsx` (D-13 rewrite in place)

**File:** `src/components/MetricCard.tsx` (159 lines, read in full). Current props surface (lines
53-64):
```typescript
interface MetricCardProps {
  label: string;
  value: string | number;
  numericValue?: number;
  trend?: "up" | "down" | "neutral";
  severity?: "critical" | "error" | "warning" | "info" | "default";
  threshold?: ThresholdConfig;
  format?: (v: number) => string;
  onClick?: () => void;
  sparklineData?: number[];
}
```
D-13 requires `state` to be ADDED, source-compatible with the above — every one of these props must
survive across the 36 consumer files' import shape (`import MetricCard from "../components/
MetricCard"` / `import MetricCard from "@/components/MetricCard"`, both forms present per a spot
check of `src/pages/BuildProgress.tsx:3`).

**What D-13 explicitly strips**, all confirmed present at these exact lines:
- `glow-card` class — line 105 (`className="glow-card bg-card/60 backdrop-blur-md ..."`)
- hardcoded `text-white` — line 141 (`className="text-3xl font-medium tracking-tight text-white"`)
- hardcoded trend colours — lines 88-90 (`trend === "up" ? "text-emerald-500" : trend === "down" ?
  "text-red-500" : "text-muted-foreground"`)
- two inline `rgba()` box-shadows — lines 100-101 (`const restCardShadow = "0 0 15px
  rgba(255,255,255,0.02)"`; `hoverCardShadow` uses `color-mix(... transparent)`, which is
  token-driven already — only `restCardShadow`'s literal `rgba()` is the hardcoded one D-13 targets)

**Repo primitive that already models explicit variant states well** (per the `<specific_targets>`
prompt): `src/components/ui/skeleton.tsx` (14 lines, read in full) — `animate-pulse rounded-md
bg-accent`, the simplest possible "shaped like the content it replaces" placeholder, directly usable
for MetricCard's `loading` state per D-15's "skeletons must be shaped like the content they replace."
`StatusBadge.tsx`'s `semanticStyles` lookup (below) is the other strong precedent for a Record-keyed
variant table, one component over.

### 6. `src/components/StatusBadge.tsx` (D-07)

**File:** `src/components/StatusBadge.tsx` (84 lines, read in full). D-07's cited mis-mapping is
confirmed at the exact stated line:
```
47:  strict: { semantic: "error", label: "STRICT" },
```
Full context (lines 22-28, the tier table StatusBadge currently drives from) and (lines 39-68, the
`legacyMap` containing line 47's `strict` entry):
```typescript
const semanticStyles: Record<string, string> = {
  ok: "text-(--status-ok) border border-(--status-ok)/40 bg-transparent",
  error: "bg-(--status-error) text-white",
  warn: "text-(--status-warn) border border-(--status-warn)/40 bg-transparent",
  info: "text-(--status-info) border border-(--status-info)/40 bg-transparent",
  idle: "bg-muted text-muted-foreground",
};
...
const legacyMap: Record<string, { semantic: string; label: string }> = {
  ...
  // Execution modes (v6.0)
  strict: { semantic: "error", label: "STRICT" },
  adaptive: { semantic: "warn", label: "ADAPTIVE" },
  standard: { semantic: "ok", label: "STANDARD" },
  ...
};
```
This confirms D-07's premise exactly: `strict` (an execution **mode**, not a failure) is keyed to the
`error` semantic and therefore renders filled-red via `semanticStyles.error`, alongside genuine
failures. D-07's new four-tier law (Strong/Quiet-but-unmistakable/Quietest/Separate-visual-grammar)
requires a structural change from this two-level `legacyMap → semanticStyles` indirection to
something that can express "execution modes are a SEPARATE visual grammar," not just a different
`semantic` value within the same one. **The file itself is the correct pattern to imitate for the
Record-keyed-lookup + justification-comment style** (see the comment block at lines 17-21 explaining
the POLISH-05/D-16 "only Failed renders filled" law this phase now supersedes) — the executor should
keep that documentation discipline while restructuring the tier logic. `src/components/forge/
ForgeStatusBadge.tsx` (the second badge implementation named in D-07/`120-BADGE-INVENTORY.md`) was
not opened this session — CONTEXT.md's own inventory reference (`120-BADGE-INVENTORY.md`) is the
authoritative source for its 3 files / 5 render sites; re-derive from that document, not from a
symbol search here, per D-07's own instruction ("Do not re-derive it as a discovery task").

### 7. `src/components/PageHeader.tsx` (D-17/D-18)

**File:** `src/components/PageHeader.tsx` (23 lines, read in full) — current full contract:
```typescript
interface PageHeaderProps {
  title: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}
export function PageHeader({ title, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-6 w-6" />}
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      {actions}
    </div>
  );
}
```
D-17 grows this with an optional 11px mono uppercase eyebrow and optional subtitle, reading the new
surface/hairline/type tokens — additive to the existing `title`/`icon`/`actions`/`className` props.

**The 4 named-exemption pages, each confirmed this session by direct read:**
- `src/pages/Analytics.tsx:54` — `<h1 className="text-2xl font-bold text-foreground">Analytics</h1>`,
  no `PageHeader` import anywhere in the file (grepped). Uses `SectionHeader` (a *different*,
  lower-tier component, `src/components/SectionHeader.tsx`) for its two subsection dividers instead
  (lines 177, 231).
- `src/pages/BuildProgress.tsx:24` — `<h1 className="text-2xl font-bold text-foreground
  mb-4">Build Progress</h1>`. Note this string is byte-identical to `PageHeader`'s own generated
  classes (`"text-2xl font-bold text-foreground"` + a separate `mb-4`) — i.e. this page hand-rolled
  exactly what `PageHeader` already produces, making it the simplest of the four conversions.
- `src/pages/Chat.tsx:928` — `<h1 className="font-mono font-bold tracking-[0.15em]
  text-base">ÁSTRÍÐR</h1>` — a small mono brand wordmark deep in a voice/avatar UI section, not a
  page-title position at all. Confirms CONTEXT.md's own framing ("Chat's full-bleed presence view
  being the likely case" for a genuine exemption) — this is not a page header competing with
  `PageHeader`, it is unrelated brand chrome; record as a named exemption with this reason.
- `src/pages/ForgePage.tsx:151` — `<h1 className="text-2xl font-bold text-foreground">Forge</h1>`,
  no `PageHeader` import (grepped; only `GlassPanel`/`SectionErrorBoundary`/Forge-domain component
  imports present).

### 8. `src/components/EmptyState.tsx` (D-19) — no analog, new pattern

**Confirmed absent:** `Glob("src/components/EmptyState*")` → no files found. This is genuinely new
code, not a rewrite.

**Nearest structural neighbors** (composition candidates, not analogs to copy wholesale):
- `src/components/GlassPanel.tsx` (29 lines, read in full) — the repo's generic panel wrapper
  (`bg-card border border-border`, `motion.div` entry animation gated on `useReducedMotion()`).
  `EmptyState` will likely render INSIDE a `GlassPanel`-shaped container at "panel/page scale" per
  D-19, but `GlassPanel` itself carries no state/copy/icon logic — it's pure chrome.
- `src/components/ui/skeleton.tsx` (14 lines, read in full) — the loading-placeholder shape
  `EmptyState` sits alongside (D-19: "the metric tile renders them at tile scale and `EmptyState`
  renders them at panel/page scale" — `loading` state at panel scale may route through a skeleton,
  not through `EmptyState`'s own copy+icon rendering; the boundary is the shared state module's job
  to encode, not this component's).

Say plainly, per the constraint: there is no existing "empty state" or "no data" panel component in
this repo to imitate. Design its shape from the shared state module (item 4 above) + D-20's design
law (`"no signal yet"` fixed empty-state phrasing).

### 9. `src/components/chat/VitalsRail.tsx` (D-16)

**File section:** `src/components/chat/VitalsRail.tsx:240-258` (read in full, exact range). Both dots,
three lines apart, confirmed:
```tsx
240:          <Link
241:            to="/infrastructure"
242:            className="group flex items-center justify-between px-3.5 py-2.5 hover:bg-primary/5 transition-colors"
243:            title="Open Infrastructure"
244:          >
245:            <span className="flex items-center gap-3.5">
246:              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
247:                <span
248:                  className={`w-2 h-2 rounded-full ${disconnected ? "bg-red-500" : "bg-green-500"}`}
249:                />
250:                Ástríðr
251:              </span>
252:              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
253:                <span className="w-2 h-2 rounded-full bg-green-500" />
254:                Convex
255:              </span>
256:            </span>
```
Line 248 (Ástríðr, correct) is the analog; line 253 (Convex, fabricated — hardcoded `bg-green-500`
with no state binding at all) is the fix target. D-16's binding is a straight structural copy of line
248's ternary, substituting the Convex connection signal for `disconnected`.

**RESEARCH.md's correction to D-16's literal text applies here** (`122-RESEARCH.md` Pattern 3,
lines 271-313): D-16's prose says `useConvex().connectionState()`, but that is a one-shot snapshot
with no reactivity (verified against `node_modules/convex@1.42.1/dist/esm-types/react/client.d.ts`
and `dist/esm/react/client.js:531-550` in that research pass). The SDK's reactive
`useConvexConnectionState()` hook is the correct binding — same `ConnectionState.isWebSocketConnected`
boolean field, but re-renders on change:
```tsx
import { useConvexConnectionState } from "convex/react";
const { isWebSocketConnected } = useConvexConnectionState();
<span className={`w-2 h-2 rounded-full ${isWebSocketConnected ? "bg-green-500" : "bg-red-500"}`} />
```
This mirrors line 248's `disconnected ? "bg-red-500" : "bg-green-500"` shape with the condition
inverted (connected=true → green, matching `!disconnected` → green on the sibling).

## Shared Patterns

### Token-driven Record<enum, string> lookup tables
**Source:** `src/lib/loomStepState.ts:51-57` (`STEP_STATE_COLOR`), `src/components/StatusBadge.tsx:22-28`
(`semanticStyles`)
**Apply to:** the shared state module (D-19), `MetricCard`'s severity/state styling, `StatusBadge`'s
rewritten tier table
**Discipline to copy:** every value is a `var(--token)` reference, never a raw hex/Tailwind palette
class, and each table carries a comment justifying any non-obvious mapping (e.g. why `pending` gets a
neutral rather than a status colour).

### `git grep`-based corpus population, never a hand-maintained list
**Source:** `122-RESEARCH.md`'s corpus-ratchet skeleton (lines 488-516) + the rigor of
`src/pages/Analytics.structuralGuard.test.ts`'s `PRESENTATIONAL_ALLOWLIST` discipline (lines 53-69)
**Apply to:** D-25's ratchet test, all four buckets (palette, hex, `duration-NNN`, violet)
**Discipline to copy:** `try/catch` around `execSync`, treating exit code 1 as "zero matches" not an
error; every allowlist entry carries a dated, checkable justification comment.

### Playwright theme-setting via `addInitScript` before `goto`
**Source:** `e2e/theme-contrast.spec.ts:25-31`
**Apply to:** `e2e/theme-rendered-result.spec.ts` (D-27) — every themed page load needs
`localStorage.setItem("codepulse-theme", ...)` + the onboarding-overlay suppression before
`page.goto()`, or the rasterised probe measures the onboarding modal instead of the themed page.

### Control-paired assertions (never a measurement without its negative)
**Source:** `e2e/theme-reduced-motion.spec.ts`'s two-test `describe` shape;
`Analytics.structuralGuard.test.ts`'s "negative control: the unmutated real source trips neither
check" (lines 293-299)
**Apply to:** D-11/D-12 (reduced-motion + must-differ control), D-21 (before/after contrast delta),
D-26/D-27 (ratchet mutation tests + rendered-result git-state control) — every one of these decisions
independently mandates the same shape RESEARCH.md and CONTEXT.md both call out.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/EmptyState.tsx` | component | request-response | Confirmed absent via `Glob`; no existing "empty/no-data panel" component in this repo. Compose from `GlassPanel` (chrome) + the new shared state module (content), per D-19. |
| `src/hooks/useMetricState.ts` | hook | transform | No existing hook takes a bare value + options and returns a discriminated state union. Nearest logic-shape precedent (`loomStepState.ts`'s `stepStateFrom`) is a plain function, not a hook — the executor is composing two partial analogs (item 2 above), not copying one. |
| `e2e/theme-rendered-result.spec.ts` (the canvas/`getImageData` rasterisation mechanism specifically) | test | E2E | Confirmed no existing spec in `e2e/*.ts` (16 files enumerated) uses canvas rasterisation. The mechanism comes from `122-RESEARCH.md`'s own verified code sample, not an in-repo rollout. |

## Metadata

**Analog search scope:** `src/components/`, `src/components/ui/`, `src/hooks/` (128 files
enumerated), `src/lib/` (74 files enumerated), `src/pages/` (targeted reads: `Analytics.tsx`,
`BuildProgress.tsx`, `Chat.tsx`, `ForgePage.tsx`), `e2e/` (16 files enumerated).
**Files scanned (opened in full or targeted-range read):** `Analytics.structuralGuard.test.ts`,
`MetricCard.tsx`, `StatusBadge.tsx`, `PageHeader.tsx`, `VitalsRail.tsx` (lines 220-264),
`useLiveState.ts`, `useThrottledQuery.ts`, `useChannelHealth.ts`, `useProviderHealth.ts`,
`useLiveFlash.ts`, `useCostDerived.ts`, `loomStepState.ts`, `eventIcons.ts`, `categoryColors.ts`,
`formatters.ts`, `GlassPanel.tsx`, `ui/skeleton.tsx`, `theme-contrast.spec.ts`,
`theme-reduced-motion.spec.ts`.
**Pattern extraction date:** 2026-08-18
