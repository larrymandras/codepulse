# Phase 116: Galdr Prompt Library - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 21 (16 new, 5 modified)
**Analogs found:** 20 / 21 (1 partial — the slug-collision mutation shape is genuinely novel, see "No Analog Found")

All analogs below were confirmed by direct `Read`/`Grep` of the live repo in this session — no claim is carried over from CONTEXT.md/RESEARCH.md without a fresh read. Where RESEARCH.md's proposed code was itself unverified (e.g. its `savePrompt` example), that is called out explicitly rather than presented as an existing analog.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/schema.ts` (modify — add `prompts`, `promptVersions`) | model/schema | CRUD | `convex/schema.ts:8-18` (`runtime_events`, `archived` field) + `:651-656` (`promptSubmissions`, naming-collision neighbour) | exact (field idiom) |
| `convex/ingestAuth.ts` (modify — add `validateGaldrAuth`) | middleware/auth | request-response | `convex/ingestAuth.ts:76-85` (`validateIngestAuth`) | exact |
| `convex/http.ts` (modify — add 2 routes, no OPTIONS) | route/config | request-response | `convex/http.ts:34-93` (route registration) + `convex/health.ts:37,48` (the one existing GET, no-CORS precedent) | exact (route form) / deliberate departure (no OPTIONS, no CORS) |
| `convex/galdr.ts` (new — query/mutation domain module) | service/model | CRUD | `convex/registry.ts:678-691` (`recordSkillLaunch`, no-op-safe mutation shape) | role-match |
| `convex/galdrHttp.ts` (new — 2-3 httpAction handlers) | controller | request-response | `convex/configVersionIngest.ts` (full file, POST handler) + `convex/health.ts:48-82` (GET handler, no CORS) | exact |
| `convex/__tests__/galdr.test.ts` (new) | test | CRUD | `convex/__tests__/skillCategories.test.ts:1-42` (source-level unit test shape) | role-match |
| `convex/__tests__/galdrHttp.test.ts` (new) | test | request-response | `convex/__tests__/ingestAuth.test.ts:1-74` (`new Request(...)` + assert header/status shape) | exact |
| `convex/__tests__/ingestAuth.test.ts` (extend) | test | request-response | itself, lines 10-61 (5-case shape: missing header / wrong key / correct key / fail-closed / anon opt-in) | exact |
| `convex/retention.test.ts` (extend) | test | batch | itself, lines 28-80 (assert-key-absent / assert-key-present pattern) | exact |
| `src/pages/Galdr.tsx` (new) | component/page | CRUD | `src/pages/Skills.tsx:1-110` (state block, imports, provider composition) | exact (named UX donor) |
| `src/hooks/useGaldrPrompts.ts` (new) | hook | CRUD | `src/hooks/useActiveEngine.ts:1-24` + repo `CLAUDE.md` "Custom hooks" line | exact |
| `src/components/galdr/PromptEditorDrawer.tsx` (new) | component | CRUD | `src/components/skills/IntakeSheet.tsx:1-48` (Sheet shell, width override, header/description) | role-match |
| `src/components/galdr/FillVariablesDialog.tsx` (new) | component | request-response | `src/components/skills/RunTargetChooser.tsx:84-96` (`submitChat`, `AutoSendHandoff` build) — for the handoff call only; the Dialog shell itself has no close in-repo analog (see below) | partial |
| `src/components/galdr/SendSplitButton.tsx` (new) | component | event-driven | `src/components/skills/RunTargetChooser.tsx:116-213` (full file — `RunTargetItems`, `DropdownMenu` split-trigger) | exact |
| `src/lib/navRegistry.ts` (modify) | config | — | itself, lines 54-95 (`iconComponents`) and 118-129 (`COMMAND` group) | exact |
| `src/App.tsx` (modify) | route | — | itself, line 65 (`const Skills = lazy(...)`) and line 137 (`<Route path="/skills" .../>`) | exact |
| `src/components/galdr/FillVariablesDialog.test.tsx` (new) | test | request-response | `src/components/blocks/__tests__/ApprovalBlock.test.tsx:1-70` (RTL render + `queryByText`/disabled-state assertions) | role-match |
| `e2e/galdr-send-to-chat.spec.ts` (new, or extend `navigation.spec.ts`) | test | request-response | `e2e/navigation.spec.ts:1-63` (full file — `beforeEach` onboarding-skip, `goto`/`click`/`toHaveURL`) | exact |
| `~/.claude/skills/galdr/SKILL.md` (new, outside repo) | skill doc | event-driven | `~/.claude/skills/webapp-testing/SKILL.md:1-33` (frontmatter, "black-box script" framing, decision tree) | role-match |
| `~/.claude/skills/galdr/scripts/galdr-client.mjs` (new, outside repo) | utility/script | file-I/O + request-response | `hooks/codepulse-hook.mjs:171-232` (`postJson`, `resolveUrl`, `resolveIngestKey`) | role-match (env-resolution strategy must diverge — see Pitfall below) |

## Pattern Assignments

### `convex/schema.ts` — add `prompts` + `promptVersions` tables

**Analog:** `convex/schema.ts:8-18` (archived-field idiom) and `:651-656` (`promptSubmissions`, the naming-collision neighbour to avoid conflating with).

**Archived-field pattern to copy verbatim** (`convex/schema.ts:8-18`):
```typescript
runtime_events: defineTable({
  eventType: v.string(),
  data: v.any(),
  timestamp: v.float64(),
  critical: v.boolean(),
  receivedAt: v.float64(),
  archived: v.optional(v.boolean()),
})
  .index("by_type", ["eventType"])
  .index("by_timestamp", ["timestamp"]),
```
Confirmed 9 total precedents for `archived: v.optional(v.boolean())` across `convex/schema.ts` (lines 14, 33, 316, 571, 1116, 1197, 1213, 1231, 1573) — D-16's soft-delete should use this exact form, filtered with `!archived` (undefined and `false` both read as "not archived").

**The neighbour to stay distinct from** (`convex/schema.ts:651-656`):
```typescript
promptSubmissions: defineTable({
  sessionId: v.string(),
  promptLength: v.float64(),
  promptId: v.optional(v.string()),
  timestamp: v.float64(),
}).index("by_timestamp", ["timestamp"]),
```
This is unrelated hook telemetry (prompt-length tracking for Claude Code sessions) — confirms UI-SPEC's naming-hygiene note is correct: name the new tables/hooks `prompts`/`promptVersions`/`useGaldrPrompts`, never a bare `usePrompts`.

**Confirmed clean build slot:** `grep -n "slug" convex/schema.ts` returns zero hits (only the `promptSubmissions` line matched on the combined grep, and it has no `slug` field) — Galdr is the first table needing a `slug` field/index in this schema.

---

### `convex/ingestAuth.ts` — add `validateGaldrAuth`

**Analog:** `convex/ingestAuth.ts:76-85` (`validateIngestAuth`), structurally identical to `:96-105` (`validateForgeIngestAuth`).

**Full pattern to copy verbatim in structure** (`convex/ingestAuth.ts:76-85`):
```typescript
export function validateIngestAuth(request: Request): boolean {
  const expectedKey = _env.ASTRIDR_INGEST_API_KEY;
  if (!expectedKey) {
    // Fail closed: a missing key must not silently open the ingest family to the
    // public internet. Require an explicit opt-in for the dev/anon path.
    return _env.ASTRIDR_INGEST_ALLOW_ANON === "true";
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```
`validateGaldrAuth` is `GALDR_API_KEY` / `GALDR_ALLOW_ANON` on this same shape (D-01). `_env` is already module-scoped at `ingestAuth.ts:10` (`(globalThis as any).process?.env ?? {}`) — no new env-access plumbing needed, just add the two new keys to the same lookups.

**`unauthorizedResponse()` to reuse as-is** (`convex/ingestAuth.ts:111-116`):
```typescript
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}
```
Note this response deliberately carries **no CORS headers at all** — it already matches D-04's "no CORS" requirement for the whole `/galdr` surface without any change.

**Do NOT touch `getCorsHeaders`/`getCorsHeadersWithAllowlist`** (`ingestAuth.ts:35-65`) — Galdr's handlers must never call it (D-04).

---

### `convex/http.ts` + `convex/galdrHttp.ts` — new GET/POST routes, no OPTIONS

**Analog for POST handler shape:** `convex/configVersionIngest.ts` (full file, 57 lines) — read in full:
```typescript
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

export const configVersionIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    // ... field extraction + required-field 400 ...
    await ctx.runMutation(api.agentConfigVersions.createVersion, { /* ... */ });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});
```
**Copy this shape but delete every `getCorsHeaders(request)` call and the `OPTIONS` branch entirely** (D-04) — Galdr's POST handler needs `validateGaldrAuth`/`unauthorizedResponse` from `ingestAuth.ts`, a `ctx.runMutation` call into `convex/galdr.ts`, and plain `{ "Content-Type": "application/json" }` headers with nothing spread in.

**Analog for GET handler + no-CORS confirmation:** `convex/health.ts:48-82` (`healthCheck`) — confirmed by direct read: this handler **never imports or calls `getCorsHeaders`/`validateIngestAuth` at all**, and its two `Response` blocks use bare `{ "Content-Type": "application/json" }` headers only. This is the one existing precedent in the repo for an httpAction with zero CORS involvement — Galdr's GET route should match this file's header shape exactly (plus the new auth check, which `/health` doesn't need).

**Route registration analog** (`convex/http.ts:34-38`, confirming the sole existing GET has no OPTIONS pairing):
```typescript
http.route({ path: "/runtime-ingest", method: "POST", handler: runtimeIngest });
http.route({ path: "/ingest", method: "POST", handler: buildIngest });
http.route({ path: "/scan", method: "POST", handler: scanEndpoint });
http.route({ path: "/health", method: "GET", handler: healthCheck });
```
Note line 37 (`/health`) has no matching OPTIONS route in the file — confirmed by reading the full 56-route block (`:34-91`) that every OTHER route below it (`/v1/metrics`, `/preflight-ingest`, `/forge-ingest`, etc.) is a POST+OPTIONS pair. `/galdr/prompt` GET+POST should be added the same way `/health` was: two `http.route()` calls, zero OPTIONS calls.

---

### `convex/galdr.ts` — new query/mutation domain module

**Analog for mutation shape (no-op-safe on lookup miss):** `convex/registry.ts:678-691` (`recordSkillLaunch`):
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
This is the exact precedent RESEARCH.md's Pitfall 1 cites for why Galdr's `usageCount` bump route can pass `skillName: \`galdr:${slug}\`` into `recordSkillLaunch` safely — verified directly: the `if (!skill) return;` line means an unmatched name is a true no-op, never a throw.

**Retention/prune-on-write — do NOT touch `convex/retention.ts`'s `RETENTION_DAYS`.** Confirmed by full read of `convex/retention.ts` (199 lines): `pruneBatchV3` (`:101-198`) deletes by `_creationTime` cutoff **across the entire table** via a single shared cursor per table-index — this is structurally incompatible with D-14's per-`promptId` count cap. `PRUNED_TABLES = Object.keys(RETENTION_DAYS)` (`:80`) drives a nightly `internalMutation` scheduler chain; there is no per-document-scoped variant anywhere in this file to extend. `promptVersions` pruning must be a private helper called inline from the save/restore mutation in `galdr.ts`, never a `RETENTION_DAYS` entry — `convex/retention.test.ts` (below) will otherwise pass on this typo/miscategorization by design, since it only validates *table existence*, not semantic correctness.

---

### `convex/__tests__/ingestAuth.test.ts` — extend with `validateGaldrAuth` cases

**Analog:** itself, `convex/__tests__/ingestAuth.test.ts:10-61` — the exact 5-case shape to replicate for `GALDR_API_KEY`/`GALDR_ALLOW_ANON`, confirmed by full read:
```typescript
it("rejects request without Authorization header", () => { ... });
it("rejects request with wrong API key", () => { ... });
it("accepts request with correct API key", () => { ... });
it("fails closed when no API key configured and no anon opt-in (CSO-95-01)", () => { ... });
it("allows anon ingest only when ASTRIDR_INGEST_ALLOW_ANON=true (dev opt-in, CSO-95-01)", () => { ... });
```
Each uses `vi.stubEnv(...)` + a real `new Request(...)` + `vi.unstubAllEnvs()` cleanup — copy this exact idiom with `GALDR_API_KEY`/`GALDR_ALLOW_ANON` substituted.

---

### `convex/retention.test.ts` — extend to assert `prompts` is absent (D-13)

**Analog:** itself, `convex/retention.test.ts:70-80` ("still keeps the cost/trend tables forever" test):
```typescript
it("still keeps the cost/trend tables forever — pruning these would break dashboards", () => {
  for (const keepForever of ["aggregates", "llmMetrics", "sessions", "alerts"]) {
    expect(
      Object.keys(RETENTION_DAYS),
      `${keepForever} must NOT be pruned`
    ).not.toContain(keepForever);
  }
});
```
Add `"prompts"` to this same list (or a dedicated assertion) — this is the exact idiom D-13's phase-requirement row calls for. Also confirmed: `convex/retention.test.ts:22-26` derives `schemaTables` via a source-level regex against `convex/schema.ts` (`^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*defineTable\(`), so adding `prompts`/`promptVersions` to the schema will automatically make them visible to this test file's liveness check without any test-side wiring.

---

### `src/pages/Galdr.tsx` — the named UX donor page

**Analog:** `src/pages/Skills.tsx:1-110` (imports + `SkillsBody` state block), confirmed by direct read.

**State shape to mirror** (`Skills.tsx:52-72`):
```typescript
function SkillsBody() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // ... 15 more useState calls for drawer/dialog/search/chip state ...
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<SkillChip>("all");
  const enrichedSkills = useQuery(api.skillCategories.getSkillsWithOverrides) ?? [];
  const categories = useQuery(api.skillCategories.listCategories) ?? [];
```
Galdr needs a much smaller subset of this shape: `search`, `chip` (category/favorites/recent), `editingPrompt`/drawer-open state, and the two `useQuery` calls (`useGaldrPrompts()` for the list). Do not port the drag-drop/lifecycle/scope-move state — those are Skills-specific (100+ skills, multi-scope, intake pipeline) and out of Galdr's scope per D-08.

**Filter chip row analog:** `src/components/skills/SkillFilterChips.tsx` (full file, 72 lines) — the single-select chip row with counts:
```typescript
<button
  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-bold transition-all ${
    isActive
      ? "border-primary bg-primary/15 text-primary shadow-[var(--glow-xs)]"
      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
  }`}
>
```
Confirmed at `SkillFilterChips.tsx:50-53` — this is the exact "active chip = accent fill + `var(--glow-xs)`" rule UI-SPEC's Color section cites.

---

### `src/hooks/useGaldrPrompts.ts` — new hook

**Analog:** `src/hooks/useActiveEngine.ts:1-6` (import shape) plus the repo's own stated convention — `CLAUDE.md` line 66: *"Custom hooks: `src/hooks/useFoo.ts` wraps `useQuery(api.foo.list) ?? []` to handle undefined during loading."* Confirmed live in `useActiveEngine.ts:1-4`:
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
```
`useGaldrPrompts.ts` should be a thin wrapper: `export function useGaldrPrompts() { return useQuery(api.galdr.list) ?? []; }` (plus whatever filter args the grid needs) — no heavier hook (e.g. `useActiveEngine`'s per-profile map derivation) is warranted here; that hook's complexity is domain-specific to engine routing, not a shape to imitate beyond the import/fallback idiom.

---

### `src/components/galdr/PromptEditorDrawer.tsx` — editor Sheet

**Analog:** `src/components/skills/IntakeSheet.tsx` (full file read, 1-70+ shown) — `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle`/`SheetDescription` composition with a width override:
```typescript
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
    <SheetHeader>
      <SheetTitle className="text-xs font-mono font-bold uppercase tracking-[0.2em] text-primary/70">
        Intake
      </SheetTitle>
      <SheetDescription>Validation reports for submitted skills.</SheetDescription>
    </SheetHeader>
    <div className="px-4 pb-6"> ... loading/empty/content states ... </div>
```
Confirmed `IntakeSheet.tsx:40` uses `w-full sm:max-w-xl` — UI-SPEC's cited width precedent for Galdr's wider `w-full sm:max-w-2xl` drawer (stacking body editor + preview + version history, which `IntakeSheet` doesn't need). Reuse the `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` import already present in this file (`IntakeSheet.tsx:11-14`) for the Preview and Version History sections.

---

### `src/components/galdr/SendSplitButton.tsx` — 3-target send dropdown

**Analog:** `src/components/skills/RunTargetChooser.tsx` (full file, 213 lines) — this is the strongest analog in the whole phase.

**Handoff-build pattern to copy for the "Send to Chat" path** (`RunTargetChooser.tsx:84-89`):
```typescript
const submitChat = (text: string) => {
  setChatOpen(false);
  navigate("/chat", {
    state: { autoSend: { text, skillName: skill.name } },
  });
};
```
Galdr's Send split-button reuses this exact `navigate("/chat", { state: { autoSend: {...} } })` call — substitute `skillName: \`galdr:${prompt.slug}\`` (Pitfall 1, already verified safe against `recordSkillLaunch`'s no-op guard).

**Dropdown shell to copy** (`RunTargetChooser.tsx:183-193`):
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
  <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
    <RunTargetItems lastTarget={lastTarget} onPick={pick} />
  </DropdownMenuContent>
</DropdownMenu>
```
The `onCloseAutoFocus={(e) => e.preventDefault()}` line is a documented Radix gotcha fix (comment at `RunTargetChooser.tsx:14-16`: "opening a Popover from a DropdownMenuItem's onSelect fights Radix's own close-autofocus return") — copy it verbatim; Galdr's SendSplitButton opens `FillVariablesDialog` (a Dialog, not a Popover) from a `DropdownMenuItem`, so the same class of focus-return conflict is a realistic risk.

**Row rendering pattern** (`RunTargetChooser.tsx:125-146`, `TARGET_ITEMS` const at `:40-48`): each row is `{ target, icon: LucideIcon, label }`, rendered via `DropdownMenuItem` with `onSelect={(e) => { e.preventDefault(); onPick(target); }}`. Galdr's three targets (`Send to Chat` / `Copy` / `Copy as command`) map onto this shape directly — `MessageSquare` and `Terminal` icons are already imported project-wide (confirmed both appear in `navRegistry.ts:31,43`); `Copy` is a first use in this file set per UI-SPEC, but is a standard `lucide-react` export (no new dependency).

---

### `src/components/galdr/FillVariablesDialog.tsx` — variable fill-in modal

**Analog (partial) for the handoff call:** `RunTargetChooser.tsx:84-96` (`submitChat`/`submitAstridr`), reused as above.

**No close in-repo analog for the Dialog shell itself** — RunChatPopover.tsx (the single-field precedent UI-SPEC explicitly rules out reusing) is a `Popover`, not a `Dialog`, and no existing component in this repo builds a multi-field `Dialog` form with N dynamically-generated `<Input>` rows gating a disabled submit button. The closest structural cousins are `src/components/skills/IntakeModal.tsx` (a `Dialog`, not yet read in full this session) and the bulk-archive `AlertDialog` at `Skills.tsx:680-716` (not read this session) — neither is a strong match for "N dynamic fields, submit disabled until all non-empty." Build this component fresh from shadcn's `Dialog`/`DialogHeader`/`DialogTitle`/`DialogFooter` primitives (already installed, confirmed in UI-SPEC's Registry Safety table) rather than adapting an existing form component.

---

### `src/lib/navRegistry.ts` — add `sparkles` icon + `/galdr` entry

**Analog:** itself. Confirmed by full read: `iconComponents` (`:54-95`) has **no `sparkles` key** — the nearest existing import is `Sparkles` inside `RunTargetChooser.tsx:20` (a component-local import, not registered in `navRegistry.ts`), so UI-SPEC's claim of "not yet in the map" is verified true, not assumed.

**Exact insertion points:**
```typescript
// iconComponents (add alongside existing entries, :54-95):
sparkles: Sparkles,   // new import from lucide-react

// navGroups → COMMAND (insert after /skills, line 125, before /reminders, line 126):
{ to: "/skills", label: "Skills", icon: "wand-2", group: "COMMAND" },
{ to: "/galdr", label: "Galdr", icon: "sparkles", group: "COMMAND" },   // NEW
{ to: "/reminders", label: "Reminders", icon: "clock", group: "COMMAND" },
```
Confirmed exact line numbers by direct read of `navRegistry.ts:118-129` — `/skills` is line 125, `/reminders` is line 126, exactly as UI-SPEC states.

---

### `src/App.tsx` — add lazy route

**Analog:** itself, confirmed by grep:
```typescript
const Skills = lazy(() => import("./pages/Skills"));
// ...
<Route path="/skills" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Skills...</div>}><Skills /></Suspense>} />
```
(`App.tsx:65` and `:137`). Add `const Galdr = lazy(() => import("./pages/Galdr"));` alongside the other lazy imports and a matching `<Route path="/galdr" ...>` line with the same `Suspense`/fallback shape, fallback text "Loading Galdr...".

---

### `convex/__tests__/galdr.test.ts` + `convex/__tests__/galdrHttp.test.ts`

**Analog for `galdr.test.ts` (pure-function/source-level unit shape):** `convex/__tests__/skillCategories.test.ts:1-42` — plain `describe`/`it`/`expect` against imported pure functions, no Convex test harness/mocking:
```typescript
import { describe, it, expect } from "vitest";
import { DEFAULT_ICONS, DEFAULT_COLORS, extractPrefix, ... } from "../skillCategories";

describe("extractPrefix", () => {
  it("extracts prefix before first hyphen", () => {
    expect(extractPrefix("gsd-plan-phase")).toBe("gsd");
  });
```
D-06/D-14/D-15/D-16's assertable pieces (slug-collision refusal shape, prune-cap math, archive-filter predicate) should be extracted as pure/testable helpers the same way, rather than requiring a live Convex mutation-testing harness for every case.

**Analog for `galdrHttp.test.ts` (Request/Response assertion shape):** `convex/__tests__/ingestAuth.test.ts:63-73` (CORS-header-presence-by-assertion pattern), inverted for D-04's "no CORS header" requirement:
```typescript
it("CORS headers include POST in allowed methods (dev fallback)", () => {
  const req = new Request("http://localhost/ingest");
  const headers = getCorsHeaders(req);
  expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
});
```
For Galdr, assert the **inverse** directly on the httpAction's real `Response` object (not on `getCorsHeaders`, which Galdr's handler must never call): `expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull()`.

---

### `src/components/galdr/FillVariablesDialog.test.tsx`

**Analog:** `src/components/blocks/__tests__/ApprovalBlock.test.tsx:1-70` — React Testing Library `render` + `screen.getByText`/`queryByText` + `fireEvent.click` + `act`, gating on external status:
```typescript
import { render, screen, fireEvent, act } from "@testing-library/react";
// ...
test("block.status='approved' renders resolved approved view, no buttons", () => {
  render(<ApprovalBlock block={makeBlock({ status: "approved" })} />);
  expect(screen.getByText("Approved — sent to Ástríðr")).toBeInTheDocument();
  expect(screen.queryByText("Approve")).toBeNull();
});
```
For D-11, the equivalent assertion is on `disabled` state rather than presence/absence: render with some fields empty → `expect(screen.getByRole("button", { name: /copy/i })).toBeDisabled()`; fill all fields → `expect(...).not.toBeDisabled()`. This file also demonstrates the `act(async () => { fireEvent.click(...) })` idiom needed for any async submit handler.

---

### `e2e/galdr-send-to-chat.spec.ts`

**Analog:** `e2e/navigation.spec.ts` (full file, 63 lines) — confirmed the exact `beforeEach`/onboarding-skip/goto/click/assert shape to replicate:
```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('codepulse_onboarding_complete', 'true');
  });
});

test('navigates to alerts page', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('a[href="/alerts"]').first();
  await link.click();
  await expect(page).toHaveURL('/alerts');
});
```
The `beforeEach` onboarding-overlay suppression is REQUIRED — its own comment (`navigation.spec.ts:4-9`) states the overlay is `fixed inset-0 z-50` and intercepts every pointer event, independent of any auth state. Any new Galdr e2e spec that clicks through the sidebar must copy this `beforeEach` verbatim or every click will time out.

---

### `~/.claude/skills/galdr/SKILL.md`

**Analog:** `~/.claude/skills/webapp-testing/SKILL.md:1-33` — frontmatter + "script is a black box" framing:
```yaml
---
name: webapp-testing
description: Toolkit for interacting with and testing local web applications by writing Python Playwright scripts. Use when...
license: Complete terms in LICENSE.txt
---
```
```
**Always run scripts with `--help` first** to see usage. DO NOT read the source until you
try running the script first and find that a customized solution is absolutely necessary.
```
Galdr's SKILL.md should follow this same shape: YAML frontmatter (`name: galdr`, a `description:` naming the trigger phrases `/galdr`/`/galdr-save`), then prose that drives `scripts/galdr-client.mjs` as a black box for the deterministic fetch/auth/JSON parts, reserving the markdown itself for the reasoning D-09/D-05 require (args-then-ask variable resolution, presenting fuzzy-match candidates, refusing on unresolved variables) — none of which belongs in the script.

---

### `~/.claude/skills/galdr/scripts/galdr-client.mjs`

**Analog:** `hooks/codepulse-hook.mjs:171-232` (full function bodies read) — `postJson`, `resolveUrl`, `resolveIngestKey`:
```javascript
async function postJson(url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    console.error(`[codepulse-hook] POST ${url} failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

function resolveUrl() {
  if (process.env.CODEPULSE_URL) return process.env.CODEPULSE_URL;
  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) { /* regex-match CONVEX_SITE_URL / VITE_CONVEX_URL out of the file */ }
  return "https://ideal-sandpiper-297.convex.site";
}
```
**Copy the `AbortController` + timeout pattern and the `env var → fallback` priority order verbatim.** **Do NOT copy the `join(__dirname, "..", ".env.local")` relative-path resolution** — confirmed by RESEARCH.md's Pitfall 4 and independently verifiable by inspection: `codepulse-hook.mjs` lives at `codepulse/hooks/`, one level below the repo root where `.env.local` sits, so `join(__dirname, "..", ".env.local")` resolves correctly only because the hook is *inside* this repo. `~/.claude/skills/galdr/scripts/galdr-client.mjs` has no fixed relative path back to `codepulse/` (it runs from an arbitrary CWD in any Claude Code session), so this exact line would silently resolve to a nonexistent path outside the repo. Also fail loudly per D-03 if `resolveGaldrKey()` returns `null` — do not fall back to `postJson`'s existing swallow-and-`console.error` behavior for the auth-key-missing case; that pattern is fine for the hook's best-effort telemetry (`hooks/codepulse-hook.mjs` never blocks on a failed POST) but wrong for Galdr, which must refuse to proceed unauthenticated.

---

## Shared Patterns

### Fail-closed bearer auth (apply to: `convex/ingestAuth.ts`, `convex/galdrHttp.ts`)
**Source:** `convex/ingestAuth.ts:76-85`, `:96-105` — two working siblings, both plain `===` string comparison (not constant-time — an accepted, pre-existing repo-wide pattern per RESEARCH.md's Security Domain section, not something to "improve" unilaterally for Galdr alone).

### No-CORS / no-OPTIONS HTTP surface (apply to: `convex/http.ts`, `convex/galdrHttp.ts`)
**Source:** `convex/health.ts:48-82` — the one other httpAction in this repo that never calls `getCorsHeaders`. D-04 makes Galdr the second.

### Soft-delete via `archived` flag (apply to: `convex/schema.ts`, `convex/galdr.ts`)
**Source:** `convex/schema.ts` — 9 existing `archived: v.optional(v.boolean())` precedents (lines 14, 33, 316, 571, 1116, 1197, 1213, 1231, 1573), filtered with `!archived` everywhere it's queried.

### AutoSendHandoff / Send-to-Chat (apply to: `src/components/galdr/SendSplitButton.tsx`, `src/components/galdr/FillVariablesDialog.tsx`)
**Source:** `src/components/skills/RunTargetChooser.tsx:84-96` (build + `navigate`), `src/pages/Chat.tsx:530-584` (consuming `firedRef`-guarded effect, confirmed by direct read — auto-fires on arrival, no confirmation step in Chat itself). `src/lib/skillRun.ts:16-20` is the `AutoSendHandoff` type Galdr must satisfy (`text`, `skillName`, optional `profile`) — `skillName` is required but safely no-op-absorbed by `recordSkillLaunch` for an unmatched name (`convex/registry.ts:678-691`).

### Nav registry insertion (apply to: `src/lib/navRegistry.ts` only — never `DashboardLayout.tsx`)
**Source:** repo `CLAUDE.md` line 62, and `navRegistry.ts:1-10`'s own header comment explaining why it was extracted (Phase 96 WR-02, so both `DashboardLayout` and `CommandPalette` can consume it without a circular import).

### RTL disabled-button assertions (apply to: `FillVariablesDialog.test.tsx`)
**Source:** `src/components/blocks/__tests__/ApprovalBlock.test.tsx` — `render`/`screen.getByText`/`queryByText`/`fireEvent`/`act` idiom, adapted from presence-assertions to `toBeDisabled()`/`not.toBeDisabled()`.

## No Analog Found

| File / Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Slug-uniqueness check-then-insert (inside `convex/galdr.ts`'s `savePrompt`) | service/model | CRUD | Confirmed by grep: zero existing `slug` fields anywhere in `convex/schema.ts` — no prior table in this repo has needed a uniqueness constraint, and Convex has no server-side unique index, so there is no existing query-then-insert-inside-one-mutation precedent to copy. RESEARCH.md's Architecture Pattern 4 proposes a shape (`ctx.db.query("prompts").withIndex("by_slug", ...).first()` → `ConvexError` on hit), but that code is **proposed, not verified live** — treat it as a starting draft per the standing "plan-authored code is a draft" rule, not a citable analog. |
| Multi-field dynamic-count `Dialog` form (`FillVariablesDialog.tsx`'s shell) | component | request-response | No existing component in this repo builds a `Dialog` with N dynamically-generated fields gating a disabled submit. `RunChatPopover.tsx` (single-field, `Popover` not `Dialog`) is explicitly ruled out as a model by UI-SPEC itself. `IntakeModal.tsx` and the bulk-archive `AlertDialog` (`Skills.tsx:680-716`) were not read in full this session and are not confirmed close enough to cite as analogs — build this component from shadcn `Dialog` primitives directly. |
| `promptVersions` prune-on-write (count-cap, not age-cutoff) | service/model | batch | `convex/retention.ts`'s entire prune mechanism (`pruneBatchV3`, cursor-seeked, table-wide, age-based) is architecturally incompatible with a per-document count cap — confirmed by full read. This is a small, purpose-built helper with no existing shape to copy; RESEARCH.md's Pattern 5 code example is again a proposed draft, not a verified analog. |

## Metadata

**Analog search scope:** `convex/` (schema, http, ingestAuth, retention, registry, health, configVersionIngest, `__tests__/`), `src/pages/`, `src/components/skills/`, `src/lib/`, `src/hooks/`, `hooks/codepulse-hook.mjs`, `e2e/`, `~/.claude/skills/webapp-testing/`
**Files scanned:** 24 read directly this session (full or targeted reads), plus 3 greps for absence-confirmation (`slug` in schema.ts, `sparkles` in navRegistry.ts, `archived` precedent count)
**Pattern extraction date:** 2026-08-10

---

## PATTERN MAPPING COMPLETE

**Phase:** 116 - Galdr Prompt Library
**Files classified:** 21 (16 new, 5 modified)
**Analogs found:** 20 / 21 exact-or-role-match; 1 partial (Dialog shell); 3 items flagged "no analog" (slug-collision mutation, dynamic-field Dialog shell, count-cap prune helper) as genuinely novel to this repo

### Coverage
- Files with exact analog: 14
- Files with role-match analog: 6
- Files with partial/no analog: 3 (all flagged explicitly, not silently assumed)

### Key Patterns Identified
- Every backend auth/HTTP piece has a verbatim-copyable sibling (`validateIngestAuth` → `validateGaldrAuth`; `configVersionIngest`/`health.ts` → `galdrHttp.ts`) — confirmed by direct read, not assumed from RESEARCH.md.
- D-04's "no CORS, no OPTIONS" is not unprecedented: `convex/health.ts` already does exactly this for its one GET route — Galdr is the second, not the first, instance of this shape.
- `src/components/skills/RunTargetChooser.tsx` is the strongest single analog in the phase — it supplies both the Send-to-Chat handoff call AND the split-button dropdown shell verbatim.
- Two backend mechanisms (slug-collision check, per-document version prune) and one UI component (multi-field Dialog) have **no existing in-repo precedent** — RESEARCH.md's proposed code for these is a draft to verify during implementation, not a citable pattern.

### File Created
`C:\Users\mandr\codepulse\.planning\phases\116-galdr-prompt-library\116-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns (with file:line) directly in each plan's action section.
