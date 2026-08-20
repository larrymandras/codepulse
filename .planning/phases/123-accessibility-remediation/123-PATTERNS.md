# Phase 123: Accessibility Remediation - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 65 sweep files (opacity-modifier deletions, 1 bucket) + 15 individually-classified files/new-files
**Analogs found:** 15 / 15 individually-classified items have a concrete in-repo analog. The sweep bucket has no single analog — it is a mechanical class edit across 65 files, patterned below from its own highest-leverage member (`DashboardLayout.tsx`).

All population figures below were re-derived live this session (not inherited from CONTEXT.md/RESEARCH.md) and agree exactly:
```
grep -rhoE 'text-primary/[0-9]+' src | wc -l                          # 86
grep -rhoE 'text-muted-foreground/[0-9]+' src | wc -l                 # 88
grep -rhoE 'text-\(--[a-zA-Z-]+\)/[0-9]+' src | wc -l                 # 2   -> 176 total occurrences
{ grep -rlE 'text-primary/[0-9]+' src; grep -rlE 'text-muted-foreground/[0-9]+' src; \
  grep -rlE 'text-\(--[a-zA-Z-]+\)/[0-9]+' src; } | sort -u | wc -l   # 65 files
grep -c '\.test\.' <65-file-list>                                     # 1 (JobsPanel.test.tsx)
```
Confirms CONTEXT.md/RESEARCH.md's corrected 176/65/1 figures. Do not use 75.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| ~65 files, `text-primary\|text-muted-foreground\|text-(--token)/NN` sites (D-01/D-04) | component (style edit) | transform (className string) | `src/layouts/DashboardLayout.tsx:91,148` (highest-leverage member of its own bucket) | exact — same defect, same remedy, in-bucket |
| `src/layouts/DashboardLayout.tsx:607-620` (SYS:/LAT: badge, D-15) | component (style edit) | transform | Same file's own `:91`/`:148` sites — same remedy (delete `/NN`, no exemption list) | exact |
| `src/components/IdeationRow.tsx:30`, `InboxCard.tsx:98`, `ScanResultsPanel.tsx:41`, `TaskDetail.tsx:29` (D-05 warn-fill) | component (style edit) | transform | `src/components/StatusBadge.tsx:53-56` (`strongStyles.warn`, the already-measured correct pairing) | exact — literal token swap, control already exists in-repo |
| `src/components/InboxCard.tsx` header comment, `ScanResultsPanel.tsx:10-14` header comment (D-05 rider) | comment/doc | n/a | same files' own doc-comment blocks | exact, with one caveat — see Pattern Assignments |
| `src/components/forge/ForgeJobList.tsx:171-175` (`aria-busy`+`aria-label` div, D-06) | component (ARIA fix) | transform | `src/components/skills/SkillReviewDrawer.tsx:90-94` (sibling `aria-busy` site, same phase, same bucket) | exact — both are D-06's named floor |
| `src/components/skills/SkillReviewDrawer.tsx:93` (`aria-busy={busy === s.name}`, D-06) | component (ARIA fix) | transform | `ForgeJobList.tsx:171-175` (inverse direction, same bucket) | exact |
| `src/components/forge/ForgeJobList.tsx:227` (`aria-selected` on `<button>`, RESEARCH Assumption A2) | component (ARIA fix, conditional) | transform | Same file's own `:174` fix, once D-06's measurement fires on it | speculative — not yet confirmed by axe; D-06 is measurement-defined, do not pre-fix |
| `src/pages/ForgePage.tsx:150-159` (hand-rolled header, D-09) | page (component swap) | request-response (page render) | `src/pages/Dashboard.tsx:54` / `src/pages/Analytics.tsx:172` / `src/pages/LiveRun.tsx:207` (`<PageHeader>` call sites; Dashboard is the simplest, Analytics/LiveRun show `actions` slot usage) | exact — `PageHeader` component itself, `src/components/PageHeader.tsx` |
| `e2e/theme-contrast.spec.ts` `PAGES` array + gate guard (D-11/D-13/D-14/D-16) | test harness (e2e config + assertions) | request-response (HTTP page load → axe scan) | same file, existing `PAGES`/gate-guard/`A11Y_MEASURE_ONLY` blocks — edits in place, not a new harness | exact |
| `e2e/theme-contrast.global-teardown.ts` (NEW, D-11 mechanism) | test harness (Playwright hook) | event-driven (cross-worker aggregation) | `e2e/global-setup.ts` (sibling lifecycle hook, same `playwright.config.ts` wiring shape) + RESEARCH.md's own verified recipe (Pattern 2) | exact — recipe already written and empirically verified this session |
| `e2e/global-setup.ts` edit (truncate skip-log at run start, D-11) | test harness (Playwright hook) | file I/O | same file's existing `.env.local` load / guard-and-throw shape (`:35-41`) | exact |
| D-12 self-test spec (NEW — inject gated sign-in state) | test harness (e2e, deterministic fixture) | request-response | `e2e/theme-contrast.spec.ts:59-70` (the exact `signInText`/`appShellNav` locator pair this self-test must reproduce without a live Clerk key) | exact — the assertion shape already exists, only the injection is new |
| `e2e/theme-rendered-result.spec.ts` extension (font-size/weight reader, D-03; isolation harness pass 2, D-02) | test harness (canvas rasterisation) | transform (DOM → pixel sample) | same file's own `sampleColor`/`compositeSample`/`getThemeTokenText` (`:84-165`) — extend verbatim, do not rewrite | exact — RESEARCH.md's own "Don't Hand-Roll" table names this explicitly |
| `src/index.css` (D-07, add `@source not "../scripts"` or fold `scripts/` into the existing exclusion) | config (Tailwind directive) | n/a | same file's existing `@source not "../.planning";` (`:5`) | exact — identical directive shape, new exclusion path |
| `scripts/migrate_tokens.py:24` (D-07, literal `"bg-gray-950/50"` string) | script (one-off migration tool) | n/a | no in-repo analog — this is the only Python file in the sweep's blast radius | none — see "No Analog Found" |
| `src/tokenSweep.ratchet.test.ts` (D-17 — explicitly NOT extended) | test (corpus ratchet) | transform (git-grep population → assertion) | itself — read, not written; the six existing buckets are the pattern the planner must NOT imitate for `/NN` (D-17 rejects a seventh bucket) | n/a (reference-only) |

---

## Pattern Assignments

### The opacity-modifier sweep (D-01/D-04) — ~65 files, 176 occurrences

**Analog:** `src/layouts/DashboardLayout.tsx:91,148` — the two sites carrying 184 of 205 measured contrast-violation nodes between them, so this is simultaneously the analog and the single highest-value fix in the sweep.

**The defect, verbatim (`DashboardLayout.tsx:91`):**
```tsx
<p className="text-xs uppercase tracking-widest text-primary/60 font-mono font-bold drop-shadow-[...]">
  {label}
</p>
```
**The defect, verbatim (`DashboardLayout.tsx:148`):**
```tsx
className={({ isActive }) =>
  `group flex items-center ... ${
    isActive
      ? "is-active text-primary bg-primary/10"
      : "text-muted-foreground/80 hover:text-primary hover:bg-primary/5"
  }`
}
```
**Remedy pattern (D-04 — delete the `/NN`, do not reintroduce alpha; step to a quieter token only if two adjacent elements collapse to the same level):**
```tsx
// :91 — delete /60
<p className="text-xs uppercase tracking-widest text-primary font-mono font-bold drop-shadow-[...]">
// :148 — delete /80
: "text-muted-foreground hover:text-primary hover:bg-primary/5"
```
Note `bg-primary/10`, `hover:bg-primary/5`, `border-primary/20`, `drop-shadow-[...oklch(...0.3)]` etc. on these same lines are **not** in scope — the sweep's grep patterns (`text-primary/NN`, `text-muted-foreground/NN`, `text-(--token)/NN`) only match the `text-*` prefix. `bg-*/NN` and `border-*/NN` opacity modifiers on the same elements are a different, unmeasured population; do not sweep them as a side effect.

**Why this is a class fix, not 65 instance fixes:** Tailwind v4 compiles every `/NN` occurrence into a `color-mix(in oklab, var(--token) NN%, transparent)` rule inside an `@supports` block, with the full-opacity `color:var(--token)` rule already emitted immediately above it (verified this session against `dist/assets/index-*.css`). Deleting `/NN` therefore always falls back to a rule that already exists — there is no case where the base rule is absent. This is why D-04 can be applied mechanically across all 65 files rather than requiring a per-site contrast recomputation before editing (D-02/D-03's harness is what later PROVES each deletion cleared threshold — the edit itself is uniform).

**Cluster sizing (re-derived this session, occurrence count per file, top of distribution):**
```
15  src/components/hr/detail/DetailConfigTab.tsx
 9  src/pages/KnowledgeGraph.tsx
 9  src/layouts/DashboardLayout.tsx
 6  src/pages/ToolGalaxy.tsx
 6  src/components/kg/KGSearchResults.tsx
 6  src/components/graph/CodeVaultGraph.tsx
 6  src/components/ToolExecutionPanel.tsx
 5  src/components/chat/VitalsRail.tsx
 5  src/components/BlackboardPanel.tsx
 4  src/components/JobsPanel.test.tsx   <- the one test file in the population
```
The remaining ~55 files hold 1-3 occurrences each (one-off leaves). This confirms RESEARCH.md's framing: `DashboardLayout.tsx` is the highest-*measured-node*-impact file (184/205 DOM nodes across 20 axe cells, because it is shared app-shell chrome rendered on every page/theme) but is not the highest-*occurrence-count* file in source — `DetailConfigTab.tsx` (15) and `KnowledgeGraph.tsx`/`DashboardLayout.tsx` (9 each) are. The planner should size waves off shared-chrome-vs-leaf, not off raw occurrence count: a fix to `DashboardLayout.tsx` clears far more measured nodes than a fix to `DetailConfigTab.tsx` even though the latter has more occurrences, because `DetailConfigTab.tsx` renders on an unmeasured (until D-16 widens) `hr/` detail route.

**Discretion note for the planner:** D-04's "default is delete" is uniform across the bucket, so the sweep itself does not need per-file wave splitting by risk — the only judgment call per site is whether deleting `/NN` collapses two adjacent elements' visual hierarchy (then step to a quieter token), which D-18's operator checkpoint catches for the two named shell elements but not for the other ~63 files. Consider whether D-18's checkpoint should sample beyond `DashboardLayout.tsx`/`ForgePage.tsx`, or whether that is out of this phase's stated D-18 scope (it names exactly two things to check).

---

### D-05 — warn-fill / foreground pairing (worst ratio in the app, ~1.4-1.8:1)

**Analog / control (already correct, copy verbatim):** `src/components/StatusBadge.tsx:53-56`
```tsx
// Strong tier: filled. `error` uses the sanctioned fill pair
// (--status-error-fill/--status-error-on-fill, defined by plan 122-03 for
// exactly this). `warn`'s background reuses the app's existing sanctioned
// solid-warn-fill idiom (IdeationRow.tsx:30, InboxCard.tsx:98,
// ScanResultsPanel.tsx:41, TaskDetail.tsx:29 all already use bg-(--status-
// warn)) rather than inventing a new token — needed so a warn-semantic
// Strong entry (e.g. an authentication failure) stays visually distinct
// from an error-semantic Strong entry (a genuine failure) while both are
// equally "filled". Its FOREGROUND, though, is `--primary-foreground`
// (dark near-black), not those files' `text-(--foreground)` — measured
// (122-BADGE-LAW.md §8) and rejected: light --foreground text on the
// bright amber --status-warn fill rasterises to ~1.4-1.8:1, far below AA.
// No hex, no palette class — token-driven per CLAUDE.md.
const strongStyles: Record<string, string> = {
  error: "bg-(--status-error-fill) text-(--status-error-on-fill)",
  warn: "bg-(--status-warn) text-(--primary-foreground)",
};
```
StatusBadge's own comment names the exact four defective call sites and their exact remedy — the fix is a literal token swap:

| Site | Current (defective) | Remedy |
|---|---|---|
| `src/components/IdeationRow.tsx:30` | `medium: "bg-(--status-warn) text-(--foreground)"` | `text-(--primary-foreground)` |
| `src/components/InboxCard.tsx:98` | `medium: "bg-(--status-warn) text-(--foreground)"` | `text-(--primary-foreground)` |
| `src/components/ScanResultsPanel.tsx:41` | `case "MEDIUM": return "bg-(--status-warn) text-(--foreground)";` | `text-(--primary-foreground)` |
| `src/components/TaskDetail.tsx:29` | `medium: "bg-(--status-warn)"` (no explicit text color set on this one — verify the consuming element's inherited foreground before assuming it needs the same swap) | **resolved below — the pairing is assembled at `:67`, not here** |

**RESOLVED + SCOPE WIDENED at plan time 2026-08-20 (orchestrator, measured live).** Two findings the
table above does not yet carry. Both change what the planner must write.

**(a) `TaskDetail.tsx`'s pairing is assembled from two fragments and no contiguous-literal grep can
find it.** `PRIORITY_COLORS` (`:27-31`) holds background classes only; the text colour is hardcoded
in the consuming template at **`:67`** — `` `... text-(--foreground) uppercase ${PRIORITY_COLORS[task.priority]}` ``.
So there is no `text-(--foreground)` at `:29` to swap, and an executor told to swap one would find
nothing and either stall or invent an edit. **Critically, `:67` applies to all three priorities**, so
changing it to `--primary-foreground` also repaints the `--status-error` and `--status-ok` fills.
This is not a blind swap and must be measured, not assumed (D-02: measured, never calculated).

**(b) The defective pairing is a CLASS, and warn is only its measured instance.** Re-derived live:

```
grep -rnE 'bg-\(--status-(error|warn|ok)\)[^"]*text-\(--foreground\)' src --include=*.tsx
```

returns **7 contiguous code sites across 3 files** — `IdeationRow.tsx:30`; `InboxCard.tsx:97,98,99`;
`ScanResultsPanel.tsx:39,41,43` — plus 3 doc-comment lines (`ScanResultsPanel.tsx:11,12,13`).
`TaskDetail.tsx:67` is an **8th** site this regex structurally *cannot* match, per (a). Only 3 of the
8 are `warn`; the rest pair `--foreground` against `--status-error` and `--status-ok` fills, which
nothing in this phase has measured.

**Why this matters and what it does NOT authorise.** `StatusBadge.tsx:50-51` records in its own
comment that `--foreground` on `--status-warn` rasterises to **~1.4–1.8:1**, and `:55` ships the
blessed warn remedy (`text-(--primary-foreground)`). But `StatusBadge` has **no `ok` entry at all**,
and its error remedy is a *different token pair entirely* (`bg-(--status-error-fill)
text-(--status-error-on-fill)`, `:54`) — so the warn control does **not** transfer to the error and
ok siblings, and there is no shipped control for `ok`. The planner must therefore **measure all 8
sites** through D-02's harness and remedy each per its own ratio, rather than pattern-matching
`--primary-foreground` across the class. Fixing only the 3 warn sites would be the
instance-not-class shape D-01 exists to reject; fixing all 8 by assumption would be the
calculated-not-measured shape D-02 exists to reject.

**Header-comment correction (D-05 rider) — one citation needs correcting:**
`ScanResultsPanel.tsx:10-14` genuinely documents the defective pairing and must be corrected:
```
 * Severity badge colors per UI-SPEC scan color rules:
 *   HIGH   → bg-(--status-error)  text-(--foreground)
 *   MEDIUM → bg-(--status-warn)   text-(--foreground)
 *   LOW    → bg-(--status-ok)     text-(--foreground)
```
`InboxCard.tsx:12`, as cited in CONTEXT.md, does **not** currently hold this comment — re-read live this session, line 12 is part of a five-item-type doc block (`* held stripe by design — never upgraded...`), unrelated to badge fills. `InboxCard.tsx`'s `RiskBadge` function (`:95-99`) carries **no** preceding doc comment naming the pairing at all — the file has drifted since CONTEXT.md's citation was written (planner should re-grep at plan time; the fix (swap the token) is unaffected, but there is no comment to correct in this file, only in `ScanResultsPanel.tsx`).

---

### D-06 — `aria-busy`/ARIA floor sites

**Site 1 — `src/components/forge/ForgeJobList.tsx:171-175`:**
```tsx
<div
  className="flex flex-col gap-2 p-3"
  aria-busy="true"
  aria-label="Loading jobs"
>
```
**Site 2 — `src/components/skills/SkillReviewDrawer.tsx:90-94` (sibling pattern, same bucket):**
```tsx
<li
  key={s.name}
  className="rounded-lg border border-border bg-card p-3"
  aria-busy={busy === s.name}
>
```
Both are plain `<div>`/`<li>` elements (no explicit `role`) carrying `aria-busy` plus, in the Forge case, `aria-label`. `aria-prohibited-attr` fires when an ARIA attribute is not permitted for the element's implicit ARIA role — the planner should confirm via axe (not by spec-reading alone, per D-06's own "measurement-defined, no hand-census" rule) which specific attribute combination trips it before choosing between (a) adding an explicit `role="status"`/`role="group"` that permits both attributes, or (b) moving `aria-label` to a wrapping labelled region and leaving `aria-busy` alone. `SkillReviewDrawer.tsx`'s site has no `aria-label`, so if axe flags only the Forge combination, the two sites may need different remedies despite the shared floor status.

**Not-yet-confirmed candidate (RESEARCH Assumption A2, do not pre-fix):** `ForgeJobList.tsx:227`
```tsx
<button
  ...
  aria-selected={isSelected}
  aria-label={`Job ${job.id}: ${job.agent} — ${job.prompt ?? "(no prompt)"}`}
>
```
`aria-selected` is role-restricted (option/row/tab/gridcell/etc.) and a bare `<button>` does not carry one of those roles. D-06's own decision text says this floor is "measurement-defined... whatever fires on across the scanned route set" — this site is on `/forge`, one of the 5 measured routes, so the widened/current axe run will settle it. Flag it for the plan but do not fix it ahead of a measured hit.

---

### D-09 — `PageHeader` adoption for `/forge`

**Analog:** `src/components/PageHeader.tsx` (the component itself) + `src/pages/Dashboard.tsx:54` (simplest call site) + `src/pages/Analytics.tsx:172` / `src/pages/LiveRun.tsx:207` (call sites using the `actions` slot, closer to Forge's shape since Forge also has a header-row action button).

**Component (full, `src/components/PageHeader.tsx`):**
```tsx
export function PageHeader({ title, icon: Icon, eyebrow, subtitle, actions, className }: PageHeaderProps) {
  return (
    // cn() (twMerge) so caller-passed margin overrides (mb-0, mb-0.5, …) beat
    // the baked-in mb-4 — raw concatenation loses to CSS emission order.
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-6 w-6" />}
        <div>
          {eyebrow && <p ... className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{eyebrow}</p>}
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p ... className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}
```
**Simplest call site (`Dashboard.tsx:54`):** `<PageHeader title="Dashboard" />`

**Defect being replaced (`ForgePage.tsx:150-161`):**
```tsx
<div className="flex items-center justify-between shrink-0">
  <h1 className="text-2xl font-bold text-foreground">Forge</h1>
  {/* Mobile-only toggle to reveal the job list overlay (F8) */}
  <button type="button" onClick={() => setListOpen(true)} aria-label="Show job list"
    className="md:hidden flex items-center justify-center size-11 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors">
    <PanelLeft className="h-5 w-5" />
  </button>
</div>
```
**The already-known trap (D-09's non-negotiable rider, confirmed live in `tokenSweep.ratchet.test.ts`'s own `KNOWN_EXEMPT` entry for this exact file):**
```
"src/pages/ForgePage.tsx": [{
  bucket: "pageheader",
  reason: "Hand-rolls the identical shape PageHeader produces (its own comment says so) and is
    convertible -- deferred, NOT a design exemption. A straight substitution would double
    the vertical spacing above the master-detail body since PageHeader bakes in mb-4 and
    ForgePage's current header carries none. ...",
  ledger: "122-PAGEHEADER-ADOPTION.md, Named exemption register, row 2 (ForgePage.tsx:151)",
}]
```
`ForgePage.tsx`'s current wrapper is `<div className="flex items-center justify-between shrink-0 space-y-4">` (parent container carries `space-y-4` from the outer flex-col, not `mb-4` on the header itself). **The plan must (a) do the PageHeader substitution, passing the mobile-toggle button as `actions`, and (b) remove `tokenSweep.ratchet.test.ts`'s `KNOWN_EXEMPT["src/pages/ForgePage.tsx"]` entry in the same change** — leaving it in place after conversion would make the ratchet permanently blind to a future regression on this exact file, and (c) satisfy D-18's rider: visually confirm the `mb-4` this adds does not double the gap above the master-detail `GlassPanel` body.

---

### D-11 — fail-on-skip via `globalTeardown` + `fs` side-channel

**Analog:** `e2e/global-setup.ts` (sibling lifecycle hook already wired in `playwright.config.ts`) + RESEARCH.md's own verified recipe. **Do not implement `test.afterAll`** — empirically falsified this session (corrupts `result.status` on the last-run test in its scope from `"skipped"` to `"failed"`, defeating the exact three-way distinction D-11 exists to preserve; see `123-RESEARCH.md` §5 / Pitfall 2).

**New file, `e2e/theme-contrast.global-teardown.ts`:**
```typescript
import { readFileSync, existsSync } from "node:fs";

export default function globalTeardown() {
  const p = "e2e/.a11y-skip-log.txt"; // must be cleared in globalSetup at run start
  const count = existsSync(p) ? readFileSync(p, "utf8").trim().split("\n").filter(Boolean).length : 0;
  if (count > 0) {
    throw new Error(`${count} contrast-suite cell(s) were skipped (Clerk gate) -- suite must fail`);
  }
}
```
**Skip-branch edit inside `e2e/theme-contrast.spec.ts`'s existing gate check (`:63-70`):**
```typescript
if (await signInText.count()) {
  appendFileSync("e2e/.a11y-skip-log.txt", `${theme}__${pg.name}\n`);
  test.skip(true, `Clerk auth gate present — ${pg.name} never rendered, ...`);
}
```
**`playwright.config.ts` wiring (sibling to the existing `globalSetup` line):**
```typescript
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/theme-contrast.global-teardown.ts', // NEW
  // ...
});
```
**`e2e/global-setup.ts` edit — analog is the file's own existing guard-and-throw shape at `:35-41`** (same "fail loud with a specific message" idiom, applied to a new precondition):
```typescript
// add near the top of the existing globalSetup(), before clerkSetup():
import { existsSync, unlinkSync } from "node:fs";
const skipLog = "e2e/.a11y-skip-log.txt";
if (existsSync(skipLog)) unlinkSync(skipLog); // truncate stale log from a prior failing run
```
**Regression control (C7 in `123-VALIDATION.md`):** after implementing, grep the JSON reporter output for `"status": "failed"` co-occurring with `"type": "skip"` in `annotations` — any hit means the `afterAll` corruption pattern crept back in.

---

### D-12 — self-test injecting the gated sign-in state

**Analog:** `e2e/theme-contrast.spec.ts:59-70` — the exact locator pair (`signInText`/`appShellNav`) and skip-branch logic this self-test must exercise deterministically, without a live Clerk key:
```typescript
const signInText = page.getByText("Sign in to access the telemetry dashboard");
const appShellNav = page.getByRole("navigation", { name: "Main navigation" }).first();
await expect(signInText.or(appShellNav).first()).toBeVisible({ timeout: 15000 });
if (await signInText.count()) {
  test.skip(true, `Clerk auth gate present — ...`);
}
```
The self-test's job (per D-12's "durable half") is to render/stub the app in a state where `signInText` is guaranteed present (e.g. `page.route()` intercepting the auth check, or mounting `AuthGuard` directly with a mocked unauthenticated Clerk state — `AuthGuard.tsx:18-37` is the component that substitutes the sign-in screen and is the actual mechanism under test), run it through the same skip+log+`globalTeardown` path, and assert the run exits non-zero with the skip count intact. No existing spec in this repo stubs Clerk state directly — check whether `src/test/setup.ts` (which the project CLAUDE.md notes does NOT globally mock Clerk) has any per-test-file Clerk-mocking precedent before inventing one; if none exists, `page.route()`-level interception of whatever call `AuthGuard` gates on is the more portable choice for an e2e-layer (not jsdom) test.

---

### D-02/D-03 — isolation harness extension (font-size/weight reader)

**Analog:** `e2e/theme-rendered-result.spec.ts:158-165` (`getThemeTokenText`, the closest existing "read a computed property off a live element" helper) — extend with a sibling that reads `font-size`/`font-weight` rather than a CSS custom property:
```typescript
// existing pattern to extend from:
async function getThemeTokenText(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => getComputedStyle(document.documentElement).getPropertyValue(t).trim(), token);
}
```
New helper needs `page.evaluate` against the **target element** (not `document.documentElement`), reading `fontSize`/`fontWeight` off `getComputedStyle(el)`, to implement D-03's threshold rule: ≥24px, or ≥18.66px + bold, gets the 3:1 large-text floor; everything else gets 4.5:1. Reuse `sampleColor`/`compositeSample`/`contrastRatio`/`relativeLuminance` verbatim (already imported/defined in the same file, `:84-180`) — do not write a second rasteriser or a second luminance formula (RESEARCH.md's "Don't Hand-Roll" table names both explicitly).

**Sentinel-guard discipline to replicate (mandatory, this file's own house style, `:84-99`):**
```typescript
ctx.fillStyle = SENTINEL;
ctx.fillStyle = color; // unparseable input silently leaves fillStyle at SENTINEL
if (ctx.fillStyle.toLowerCase() === SENTINEL) return null;
```
Every new sampler added for pass 2 must return `null` (never a guessed default) on an unparseable colour, and every consumer must assert `.not.toBeNull()` rather than substitute a fallback — this is C3 in `123-VALIDATION.md` and the file's own header comment states it as law.

---

### D-07 — Tailwind scan boundary

**Analog:** `src/index.css:5` — `@source not "../.planning";` is the existing exclusion directive; extend the same mechanism rather than inventing a second one:
```css
@source not "../.planning";
@source not "../scripts";   /* NEW — scripts/migrate_tokens.py:24 carries "bg-gray-950/50" as a
                                Python dict key, which Tailwind's default whole-repo scan root
                                otherwise compiles into the production stylesheet */
```
Verify at plan time whether a single `@source not` can carry multiple paths or whether Tailwind v4 requires one directive per exclusion (check installed `tailwindcss@4.3.2` docs/changelog before assuming either shape) — RESEARCH.md did not confirm this multi-path syntax.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/migrate_tokens.py` | script (one-off migration tool) | n/a | Only Python file touched by this phase; every other file in scope is TypeScript/TSX/CSS. No in-repo Python analog for "a literal string inside a migration script that Tailwind's JIT scanner also reads." The fix is likely a rename/comment change (e.g. splitting `"bg-gray-950/50"` so it no longer forms a scannable class-name token, or relying solely on the `@source not "../scripts"` exclusion) rather than a pattern to imitate — decide at plan time whether the `@source` exclusion alone suffices or whether the literal itself should also be defused. |

## Shared Patterns

### Token-only remedy, no hex (CLAUDE.md §Styling)
**Source:** project-wide rule, reinforced by `StatusBadge.tsx`'s own comment ("No hex, no palette class — token-driven per CLAUDE.md")
**Apply to:** every file in the D-01/D-04 sweep and the D-05 warn-fill fix. No plan in this phase should introduce a literal hex/oklch value; Phase 122 froze the palette.

### Sentinel-guarded rasterised colour sampling (never regex-scrape `getComputedStyle`)
**Source:** `e2e/theme-rendered-result.spec.ts:84-99` (`sampleColor`), reinforced by memory `[[tailwind-v4-oklch-defeats-css-color-scraping]]`
**Apply to:** D-02's isolation harness, D-03's font-size/weight-gated threshold check, and any future colour-claim control (C6 in `123-VALIDATION.md`). Tailwind v4 emits `oklch()`/`oklab()` — a number-extraction regex over a computed colour string reads the hue angle as a channel.

### Corpus-derived population, never a hardcoded file list
**Source:** `src/tokenSweep.ratchet.test.ts`'s design discipline (`git grep --untracked` at test time, `KNOWN_EXEMPT` as "a record, not a blessing")
**Apply to:** any new census this phase builds (D-06's ARIA floor, D-16's route widening). D-17 explicitly declines to add a `/NN` bucket to this specific file — do not extend `tokenSweep.ratchet.test.ts` itself for opacity modifiers — but the *discipline* (re-derive, don't enumerate) still governs any new harness code this phase writes.

### `test.skip()` with a message, never a silent skip
**Source:** `e2e/theme-contrast.spec.ts:63-70`
**Apply to:** D-11's skip branch (unchanged in shape, only gains the `appendFileSync` side-channel call) and D-12's self-test.

## Metadata

**Analog search scope:** `src/` (components, pages, layouts), `e2e/`, `src/tokenSweep.ratchet.test.ts`, `scripts/migrate_tokens.py`, `.planning/phases/120-*`, `.planning/phases/122-*` (for prior-phase precedent/exemption records)
**Files scanned:** 65 (sweep population) + 12 individually read in full + `App.tsx` route table cross-check
**Pattern extraction date:** 2026-08-20
