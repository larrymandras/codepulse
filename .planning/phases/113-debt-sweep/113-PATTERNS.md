# Phase 113: Debt Sweep - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 15 (12 modified in-repo, 1 confirmed no-change, 1 test file, ~4 net-new files in a separate non-codepulse repo for DEBT-07)
**Analogs found:** 12 / 13 in-repo files have a direct in-repo analog (mostly "extend the file itself" — this is a debt-fix phase, not new-file scaffolding). DEBT-07 has zero in-repo analog by design (external private repo) — recorded explicitly below, with codepulse's own `.gitignore`/`.env.example`/README/`scripts/verify-skills-page.mjs` surfaced as the closest available conventions to mirror.

All line numbers below were re-read directly from the live, shared checkout in this session (2026-08-11) — they match CONTEXT.md/RESEARCH.md's citations with **zero drift** except where noted.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/skillSync.ts` | utility (pure helpers, Convex-adjacent) | transform | itself — `sanitizeScannedOrigins`/`computeSkillPrunes` already in file | exact (extend existing function family) |
| `convex/registry.ts` (`syncInventory` :182-197, `syncFullInventory` :350-365) | mutation (two call sites, structurally identical) | CRUD (upsert+prune) | itself — the two prune blocks are byte-for-byte identical analogs of each other | exact |
| `convex/migrations.ts` | migration | batch | itself — `purgeSkillsByOrigin` (:39-48) is the near-exact shape for D-04's re-origin migration | exact |
| `convex/schema.ts` (`alerts` table) | model | CRUD | itself — table already has the exact shape D-05 needs, no schema change required | exact (no-op) |
| `convex/__tests__/skillSync.test.ts` | test | unit | itself — existing `describe("computeSkillPrunes")`/`describe("sanitizeScannedOrigins (GC-03)")` blocks are the template for the new regression test | exact |
| `hooks/skillScan.mjs` | utility (Node CLI producer) | file-I/O → transform | itself — `readSkillDir`/`readInstalledPluginSkills`/`walkPluginCache`/`collectClaudeCodeSkills` | exact |
| `hooks/scanner.mjs` (:76-85) | utility (Node CLI producer, wire builder) | file-I/O → HTTP POST | itself — the `snapshot` object literal (:26-35) and the skill-scan try/catch block (:76-85) | exact |
| `src/lib/skills.ts` (:69, :125, :131, :165) | utility (pure display/logic helpers) | transform | itself — 4 sites already isolate origin literals as named predicates (`isActiveGlobal`, `originLabel`) | exact |
| `src/pages/Skills.tsx` (:132, :148) | component (page) | transform (client-side filter) | itself — `visibleSkills`/`chipCounts` `useMemo` blocks, both already keyed on the literal `"claude-code"` string | exact |
| `src/components/skills/SkillLifecycleMenu.tsx` (:88) | component | transform | itself — `scopeLabel()` helper (:86-91) | exact |
| `src/components/OriginBadge.tsx` (:1-9) | component | transform (lookup table) | itself — `BADGE_STYLES` record | exact |
| `src/lib/skillVault.ts` | utility (pure model builder) | transform | N/A — **no change needed**, see below | n/a (confirmed safe) |
| `src/pages/Chat.test.tsx` (:581-599) | test | request-response (RTL query/assert) | itself — the `it("keeps the base label byte-identical...")` block is both the defect site and its own analog for the instrumentation shape | exact |
| `src/test/setup.ts` | config (global test setup) | n/a | itself, for context only — **not** where the fix lands (see Shared Patterns / Pitfall note) | n/a (context, not a fix site) |
| `convex-selfhost/` (D-12–D-16, separate private repo) | config + docs (ops bootstrap) | file-I/O (git/compose) | **none in codepulse** — see "No Analog Found" | no analog |

## Pattern Assignments

### `convex/skillSync.ts` (utility, transform)

**Analog:** itself — this file already contains the exact shape of guard the phase needs; D-01/D-03's server-side guard is a natural extension of `sanitizeScannedOrigins`/`computeSkillPrunes`, not a new pattern.

**Existing "untrusted input → sanitize → typed value" pattern** (`convex/skillSync.ts:23-36`):
```ts
/**
 * Guard an untrusted snapshot's `scannedOrigins` before it can act as a
 * prune-authorizing manifest (the /scan snapshot body is `v.any()`). Only a
 * real array passes through; any other shape falls back to `undefined` — the
 * legacy incoming-origins-only prune path (98-05 GC-03).
 */
export function sanitizeScannedOrigins(
  value: unknown
): Array<string | null | undefined> | undefined {
  return Array.isArray(value) ? value : undefined;
}
```
This is the exact pattern to mirror for any new coverage-declaration field the plan adds to the manifest payload (per-origin "did I actually read this" flags, not just a flat array) — validate shape defensively, degrade to the old behavior on anything malformed, never throw.

**Core per-origin prune logic** (`convex/skillSync.ts:57-86`, full function already read above) — `computeSkillPrunes` is where D-03's "prunable only when declared" extension lands. The existing manifest union (`:73-76`) is the model:
```ts
const prunableOrigins = new Set<string>(incomingByOrigin.keys());
if (scannedOrigins) {
  for (const o of scannedOrigins) prunableOrigins.add(normalizeOrigin(o));
}
```

**No error-handling pattern needed here** — these are pure functions with no I/O; malformed input degrades to a safe default rather than throwing (see `sanitizeScannedOrigins` above). Any new guard function added for D-01/D-03 should follow the same shape: pure, total (no throw), degrade-to-legacy on ambiguity.

---

### `convex/registry.ts` (mutation, CRUD — TWO identical call sites)

**Analog:** itself. `syncInventory` (:182-197) and `syncFullInventory` (:350-365) are structurally byte-for-byte identical prune blocks — CONTEXT.md and RESEARCH.md both flag that a fix landing on only one is "the classic half-fix in this codebase." Confirmed live 2026-08-11:

**Imports** (`convex/registry.ts:1-9`):
```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import {
  normalizeOrigin,
  computeSkillPrunes,
  maxDefined,
  sanitizeScannedOrigins,
} from "./skillSync";
```

**Prune call site #1 — `syncInventory`** (`convex/registry.ts:175-197`):
```ts
      // Per-origin pruning: fires when the snapshot has skills OR declares a
      // scannedOrigins manifest (98-05 — a manifest lets an emptied-but-covered
      // origin prune even with zero incoming skills; a totally empty,
      // manifest-less snapshot still cannot wipe anything). The manifest is
      // sanitized once and used for BOTH the guard and the call — a malformed
      // non-array value degrades to the legacy prune path instead of throwing
      // mid-sync (GC-03).
      const scannedOrigins = sanitizeScannedOrigins(snap.scannedOrigins);
      if (
        snap.skills.length > 0 ||
        (scannedOrigins !== undefined && scannedOrigins.length > 0)
      ) {
        for (const row of computeSkillPrunes(existingSkills, snap.skills, scannedOrigins)) {
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
```

**Prune call site #2 — `syncFullInventory`** (`convex/registry.ts:343-365`): identical to the above except `changedBy: "capability_sync"` in place of `"scanner"`. The D-01 server-side guard and D-05 alerts-write must be added to **both**, sharing one helper if possible — do not add it to only one.

**Audit-trail write pattern (reuse for D-05's alerts write)** — both call sites already write a `configChanges` row per prune (`ctx.db.insert("configChanges", {...})`), which is the direct precedent for D-05's `ctx.db.insert("alerts", {...})` on refusal: same shape (insert a record with a `changedBy`/`source` tag, `changedAt`/`createdAt` timestamp, and enough payload to reconstruct what happened), just a different target table.

---

### `convex/migrations.ts` (migration, batch)

**Analog:** itself — `purgeSkillsByOrigin` (:39-48) plus `listSkillOrigins` (:15-33) is the exact template for D-04's re-origin migration; this file's own header comment at `:10-13` already documents the orphaned-origin failure mode D-04 must avoid.

**Read-only census pattern** (`convex/migrations.ts:15-33`, already used to produce D-04's live counts):
```ts
export const listSkillOrigins = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("skills").collect();
    const byOrigin = new Map<string, { count: number; sampleName: string; sampleSource?: string }>();
    for (const r of rows) {
      const o = r.origin ?? "unknown";
      const cur = byOrigin.get(o);
      if (cur) cur.count++;
      else byOrigin.set(o, { count: 1, sampleName: r.name, sampleSource: r.source });
    }
    return {
      total: rows.length,
      origins: [...byOrigin.entries()]
        .map(([origin, v]) => ({ origin, ...v }))
        .sort((a, b) => b.count - a.count),
    };
  },
});
```

**Dry-run-by-default batch mutation pattern** (`convex/migrations.ts:35-48`) — this is the exact shape D-04's migration should mirror (filter by a derivable condition, default preview with a name sample, `apply: true` required to write):
```ts
/**
 * Delete every `skills` row for one origin. Dry-run unless `apply: true`.
 * Deliberately NOT batched-with-continuation: the orphan origins are ~130 rows each.
 */
export const purgeSkillsByOrigin = internalMutation({
  args: { origin: v.string(), apply: v.optional(v.boolean()) },
  handler: async (ctx, { origin, apply }) => {
    const rows = (await ctx.db.query("skills").collect()).filter((r) => (r.origin ?? "unknown") === origin);
    if (!apply) {
      return { origin, matched: rows.length, deleted: 0, dryRun: true, names: rows.slice(0, 5).map((r) => r.name) };
    }
    for (const r of rows) await ctx.db.delete(r._id);
    return { origin, matched: rows.length, deleted: rows.length, dryRun: false };
  },
});
```
D-04's migration is a `patch` (re-origin, i.e. `ctx.db.patch(r._id, { origin: NEW_ORIGIN })`) rather than a `delete`, so `backfillAstridrProviderTag` (`convex/migrations.ts:193-221`) is actually the **closer** shape — same dry-run-by-default/`apply: true`-to-write contract, but patches instead of deletes, and its docstring is the house style for explaining *why* a migration exists and what population it targets:
```ts
export const backfillAstridrProviderTag = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (ctx, { apply }) => {
    const targets = ["astridr", "unknown"];
    let matched = 0;
    let patched = 0;
    const samples: { sessionId: string; toolName: string; timestamp: number }[] = [];
    for (const sessionId of targets) {
      const rows = await ctx.db
        .query("toolExecutions")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .take(BATCH_SIZE);
      const untagged = rows.filter((r) => r.provider === undefined);
      matched += untagged.length;
      for (const row of untagged.slice(0, 5 - samples.length)) {
        samples.push({ sessionId, toolName: row.toolName, timestamp: row.timestamp });
      }
      if (apply) {
        for (const row of untagged) {
          await ctx.db.patch(row._id, { provider: "astridr" });
          patched++;
        }
      }
    }
    return { matched, patched, dryRun: !apply, samples };
  },
});
```
`BATCH_SIZE = 500` is declared once at file top (`:5`) and referenced by every migration in the file — D-04's migration (57 rows, per RESEARCH.md's live re-derivation) should reference the same constant even though it's a single non-continuation batch, per this file's own convention (stated explicitly in `backfillAstridrProviderTag`'s docstring: "well under BATCH_SIZE ... but batch-capped anyway per this file's own convention").

**Filter derivation note (from RESEARCH.md, load-bearing for the plan):** D-04 must filter strictly on `origin === "claude-code"` AND a plugin-cache-shaped `source` path — NOT on the source-path pattern alone, because 54 unrelated `native`-origin rows (astridr container paths) also match a plugin-cache-shaped path and must not be touched.

---

### `convex/__tests__/skillSync.test.ts` (test, unit)

**Analog:** itself — the file already contains a `describe("computeSkillPrunes")` block with a "REGRESSION:" naming convention for exactly this class of test, and a sibling `describe("sanitizeScannedOrigins (GC-03)")` block for shape-validation tests. The new DEBT-05 survival regression test (RESEARCH.md's Validation Architecture: "an origin NOT declared in `scannedOrigins`, absent from incoming, but WAS previously fully present, survives") should live in the `computeSkillPrunes` describe block, next to its two closest existing siblings:

**House style for a regression test** (`convex/__tests__/skillSync.test.ts:89-105`):
```ts
it("REGRESSION: a declared-but-empty origin (in scannedOrigins, absent from incoming) prunes all its rows", () => {
  const prunes = computeSkillPrunes(
    [cc, proj],
    [{ name: "deploy", origin: "claude-code" }],
    ["claude-code", "claude-code:project:abc"]
  );
  expect(prunes.map((p) => p._id)).toEqual(["4"]); // proj pruned — declared-but-empty
});

it("REGRESSION: an undeclared origin (not in scannedOrigins, not in incoming) stays untouched", () => {
  const prunes = computeSkillPrunes(
    [cc, proj],
    [{ name: "deploy", origin: "claude-code" }],
    ["claude-code"] // proj's origin is NOT declared
  );
  expect(prunes.map((p) => p._id)).toEqual([]); // proj untouched — unscanned/unreachable
});
```
Pattern: import only the pure functions (`import { normalizeOrigin, computeSkillPrunes, groupSkillRowsByName, maxDefined, sanitizeScannedOrigins } from "../skillSync";`, `:1-8`), no Convex ctx/mock needed, `_id` strings are small literal fixtures (`"1"`–`"6"`), assertions are always `expect(prunes.map((p) => p._id)).toEqual([...])` — never asserting on the full row object.

**The exact NEW test the D-01 guard needs (name it in this style):** a control proving the mandated failure mode — a partial/transient plugin read still "present" under the shared origin — no longer prunes plugin rows once D-02's origin split + D-03's coverage guard land. `sanitizeScannedOrigins`'s own describe block (`:130-160`) is the template for asserting the guard degrades safely on malformed manifest shapes, reusing the `computeSkillPrunes([cc, proj], [...], sanitizeScannedOrigins({}))` composition shown at `:150-159`.

---

### `hooks/skillScan.mjs` (utility, file-I/O producer)

**Analog:** itself — `collectClaudeCodeSkills` (:134-166) already has the exact isolation precedent D-02 needs (cold storage's separate origin).

**Existing origin-isolation precedent D-02 must follow** (`hooks/skillScan.mjs:134-145`):
```js
export function collectClaudeCodeSkills({ home, cwd, platform = process.platform }) {
  const acc = [];
  const globalDir = join(home, ".claude", "skills");
  readSkillDir(globalDir, "claude-code", acc);
  // Prefer the installed version of each plugin; fall back to walking the whole cache.
  if (!readInstalledPluginSkills(home, "claude-code", acc)) {
    walkPluginCache(join(home, ".claude", "plugins", "cache"), "claude-code", acc);
  }
  // Cold storage: present on disk but NOT loaded by Claude Code. Distinct origin so
  // per-origin pruning keeps it isolated from the active-skill rows.
  readSkillDir(join(home, ".claude", "skills-available"), "claude-code:available", acc);
  ...
```
D-02's fix is mechanical: change the two `"claude-code"` string arguments at the `readInstalledPluginSkills(home, "claude-code", acc)` / `walkPluginCache(..., "claude-code", acc)` call sites (:139-140) to the new plugin origin string (e.g. `"claude-code:plugin"`), following the exact comment style already used for the `:144` cold-storage isolation.

**Producer-side failure signal for D-01/D-07** — `readInstalledPluginSkills` already returns a boolean (`false` on missing/unparseable/empty manifest, :86-109) and `walkPluginCache` already silently no-ops on any fs error (:111-124, try/catch around `readdirSync`/`statSync`). This is exactly where D-07's "a failed sub-source read still emits — it just doesn't declare that source covered" needs its return-value plumbing: `collectClaudeCodeSkills` must surface which sub-sources actually succeeded (not just push their rows), likely by returning `{ skills, coveredOrigins }` instead of a bare array — this is a **breaking return-shape change** to a function `scanner.mjs` (:78) already calls positionally, so both call sites in `scanner.mjs` (:78 and :301, `mergeUsage(collectClaudeCodeSkills(...), ...)`) need updating together.

---

### `hooks/scanner.mjs` (utility, wire builder)

**Analog:** itself — the `snapshot` object literal is the wire contract; RESEARCH.md's single most consequential finding is that `scannedOrigins` is a key that does not exist here yet.

**Current wire payload — confirmed live, `scannedOrigins` absent** (`hooks/scanner.mjs:26-35`):
```js
const snapshot = {
  sessionId,
  scannedAt: Math.floor(Date.now() / 1000),
  mcpServers: [],
  hooks: [],
  plugins: [],
  skills: [],
  agents: [],
  slashCommands: [],
};
```

**The exact fire-and-forget, no-throw call site the D-01/D-03 wire-up must extend** (`hooks/scanner.mjs:76-85`):
```js
  // ── Claude Code skills (personal + plugin cache + per-repo project) ──
  try {
    const skills = collectClaudeCodeSkills({ home, cwd });
    // Join real invocation counts from the host skill-usage log so the dashboard can
    // rank by use. Without this every row sits at useCount 0 and "Most Used" is empty.
    mergeUsage(skills, readSkillUsage(home));
    snapshot.skills.push(...skills);
  } catch (err) {
    console.error(`[codepulse-scanner] skill scan failed: ${err.message}`);
  }
```
This `try/catch` is the mechanism that swallows a full-scan failure today and is the concrete site where `snapshot.scannedOrigins = [...]` must be assigned — only inside the `try` block, on the sub-sources that actually completed, per D-07's "degrades gracefully" decision. Per CLAUDE.md and D-07 ("Hooks must stay fire-and-forget"), no retry/backoff may be added here — the existing catch-and-log shape is the pattern to preserve, not replace.

**Downstream pass-through confirmed, no change needed:** `convex/scan.ts` (35 lines, read in full) forwards the entire POST body untouched — `await ctx.runMutation(api.registry.syncInventory, { snapshot: body })` (`convex/scan.ts:23`) — so once `scanner.mjs` adds the `scannedOrigins` key, it reaches `syncInventory`'s `snap.scannedOrigins` with no HTTP-layer change required.

---

### `src/lib/skills.ts` (utility, 4 origin-coupling sites — D-17)

**Analog:** itself — every one of the 4 sites already isolates the `"claude-code"` literal behind a named local (`isActiveGlobal`, a `sourceOrigin:` field, `originLabel()`), so the fix pattern at each site is "replace one equality/lookup with a call to a shared predicate," not a structural rewrite.

**Site 1 — `resolveLifecycleActions`, `moveDestinationIsProject`** (`src/lib/skills.ts:55-71`, full function already read):
```ts
export function resolveLifecycleActions(
  skill: SkillLike,
  lane: "active" | "cold" = "active"
): LifecycleActionState {
  const dormant = isDormant(skill) || lane === "cold";
  const shadowed = isShadowing(skill);
  const nonDormantOrigins = (skill.origins ?? []).filter((o) => o !== DORMANT_ORIGIN);
  const multiScope = nonDormantOrigins.length > 1;
  const activeOrigin = nonDormantOrigins.length === 1 ? nonDormantOrigins[0] : undefined;
  return {
    dormant,
    shadowed,
    multiScope,
    activeOrigin,
    moveDestinationIsProject: activeOrigin === "claude-code",   // <-- line 69, D-17 site
  };
}
```

**Site 2 — `resolveScopeDrop`, `isActiveGlobal` + `sourceOrigin:`** (`src/lib/skills.ts:125,131`, inside the function already read at :97-145):
```ts
  const isActiveGlobal = activeOrigin === "claude-code";        // <-- line 125
  const isActiveProject = activeOrigin?.startsWith(PROJECT_PREFIX) ?? false;

  if (isActiveGlobal) {
    if (targetScope === "global") return { kind: "noop" };
    if (targetScope === "project") return { kind: "dialog" };
    return { kind: "enqueue", action: "archive", sourceOrigin: "claude-code", destination: "cold" };  // <-- line 131
  }
```

**Site 3 — `originLabel`** (`src/lib/skills.ts:163-170`):
```ts
export function originLabel(origin: string, projectName?: string | null): string {
  if (origin === DORMANT_ORIGIN) return "Dormant (cold storage)";
  if (origin === "claude-code") return "Claude Code";           // <-- line 165
  if (origin.startsWith(PROJECT_PREFIX)) {
    return projectName ? `Project · ${projectName}` : `Project · ${origin.slice(PROJECT_PREFIX.length, PROJECT_PREFIX.length + 7)}`;
  }
  return origin;
}
```
Note this function's own fallback (`return origin;`) is exactly the failure mode: without a fix, a `claude-code:plugin` origin renders its raw string in the `<select>` instead of a human label — same shape as `OriginBadge`'s failure below.

**Existing shared-constant pattern already in this file** — `DORMANT_ORIGIN`/`PROJECT_PREFIX` (`src/lib/skills.ts:3-4`) are exactly the precedent for adding a `PLUGIN_ORIGIN` constant (or reusing a shared `isGlobalOrigin()` helper, per RESEARCH.md's Pitfall 1 recommendation) rather than repeating the literal at each site:
```ts
export const DORMANT_ORIGIN = "claude-code:available";
const PROJECT_PREFIX = "claude-code:project:";
```
CONTEXT.md D-17 explicitly rejects extracting a shared `isGlobalOrigin()` helper "now" as widening the phase — the 4 in-file sites plus the 2 in `Skills.tsx` are mechanical, individually-editable comparisons, per Larry's decision. Do not introduce a new shared predicate unless the plan explicitly reopens that decision.

---

### `src/pages/Skills.tsx` (component/page, 2 origin-coupling sites — D-17)

**Analog:** itself — both sites are `.includes("claude-code")` inside sibling `useMemo` blocks that already share the same `base` filtered array.

**Site 1 — `visibleSkills`, "global" filter chip** (`src/pages/Skills.tsx:117-138`, full block already read):
```ts
  const visibleSkills = useMemo(() => {
    const base = manageableSkills.filter((s) => !s.hidden);
    switch (chip) {
      ...
      case "global":
        return base.filter((s) => (s.origins ?? []).includes("claude-code"));   // <-- line 132
      case "project":
        return base.filter(isProjectOrigin);
      default:
        return base;
    }
  }, [manageableSkills, chip]);
```

**Site 2 — `chipCounts`, "Global" chip count** (`src/pages/Skills.tsx:140-152`):
```ts
  const chipCounts = useMemo((): Record<SkillChip, number> => {
    const base = manageableSkills.filter((s) => !s.hidden);
    return {
      all: base.length,
      favorites: base.filter((s) => s.favorite).length,
      mostused: base.filter((s) => (s.useCount ?? 0) > 0).length,
      unused: base.filter((s) => (s.useCount ?? 0) === 0 && !isDormant(s)).length,
      recent: Math.min(30, base.filter((s) => (s.discoveredAt ?? 0) > 0).length),
      global: base.filter((s) => (s.origins ?? []).includes("claude-code")).length,  // <-- line 148
      project: base.filter(isProjectOrigin).length,
      cold: base.filter(hasDormantCopy).length,
    };
  }, [manageableSkills]);
```
Existing sibling pattern already in this same file (`:112-113`, one line above the `visibleSkills` block) shows the multi-value-match idiom to reuse for a two-origin OR condition instead of a single `.includes()`:
```ts
  const isProjectOrigin = (s: { origins?: string[] }) =>
    (s.origins ?? []).some((o) => o.startsWith("claude-code:project:"));
```

---

### `src/components/skills/SkillLifecycleMenu.tsx` (component, 1 site — D-17)

**Analog:** itself — `scopeLabel()` is a tiny pure helper, structurally identical in shape to `skills.ts`'s `originLabel()`.

**Site** (`src/components/skills/SkillLifecycleMenu.tsx:86-91`):
```ts
/** "claude-code" -> "global", "claude-code:project:<key>" -> "project". */
function scopeLabel(origin: string): string {
  if (origin === "claude-code") return "global";        // <-- line 88
  if (origin.startsWith("claude-code:project:")) return "project";
  return origin;
}
```
Same fallback-returns-raw-string failure mode as `originLabel` above.

---

### `src/components/OriginBadge.tsx` (component, lookup-table site — 4th file, not named in CONTEXT.md's D-17 list until this research pass)

**Analog:** itself — full 34-line file already read; this is a `Record<string, {...}>` lookup rather than an `===` comparison, so its failure mode differs from the other 3 files and the fix shape differs too (add a key, not change a comparison).

**Full lookup table + failure path** (`src/components/OriginBadge.tsx:1-25`):
```tsx
const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  native: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Native" },
  bridge: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Bridge" },
  cc: { bg: "bg-amber-500/10", text: "text-amber-400", label: "CC" },
  catalog: { bg: "bg-gray-500/10", text: "text-gray-500", label: "Catalog" },
  "claude-code": { bg: "bg-purple-500/10", text: "text-purple-400", label: "Claude Code" },  // <-- line 6
  "claude-code:available": { bg: "bg-slate-500/10", text: "text-slate-400", label: "Dormant" },
  unknown: { bg: "bg-gray-500/10", text: "text-gray-500", label: "Unknown" },
};

const PROJECT_STYLE = { bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Project" };

function styleFor(origin: string) {
  if (origin.startsWith("claude-code:project:")) return PROJECT_STYLE;
  return BADGE_STYLES[origin];
}

export default function OriginBadge({ origin }: OriginBadgeProps) {
  if (!origin) return null;
  const style = styleFor(origin);
  if (!style) return null;   // <-- a claude-code:plugin origin falls through here today: NO badge renders at all
  ...
```
**Verified failure mode (traced, not assumed):** `styleFor("claude-code:plugin")` fails the `startsWith("claude-code:project:")` check, then `BADGE_STYLES["claude-code:plugin"]` is `undefined`, then `OriginBadge` returns `null` — plugin skills would render with **no origin badge at all** (silently missing UI, not a mislabeled one) if this file isn't updated. Fix is additive: one new `BADGE_STYLES` entry, same shape as the existing `"claude-code"` / `"claude-code:available"` rows.

---

### `src/lib/skillVault.ts` — CONFIRMED NO CHANGE NEEDED

**Traced, not assumed** (`src/lib/skillVault.ts:108-112`):
```ts
function classifyOrigin(origin: string): VaultContainerId {
  if (origin === DORMANT_ORIGIN) return "cold";
  if (origin.startsWith(PROJECT_PREFIX)) return "project";
  return "global";
}
```
This is exactly the "anything else falls through to global" design the file's own header comment (`:9-12`) describes. A new `claude-code:plugin` origin matches neither `DORMANT_ORIGIN` nor `PROJECT_PREFIX`, so it correctly falls through to `"global"` with zero code changes. **No plan task should touch this file** — CONTEXT.md D-17 already states this; this pass re-derived it from the live function body rather than trusting the prior claim.

---

### `src/pages/Chat.test.tsx` (test, request-response — DEBT-06)

**Analog:** itself — the failing test IS its own best analog; the fix is instrumentation added at the existing query site, not a new test file or a new testing pattern borrowed from elsewhere.

**The exact site to instrument** (`src/pages/Chat.test.tsx:581-599`, full `it` block already read):
```tsx
it("keeps the base label byte-identical while pending and shows a switching-to suffix; drops the suffix (label unchanged) on error ack", async () => {
  mockActiveEngineMap = { "assistant-default": { model: "anthropic-sonnet-5", mode: "inherited" } };
  renderPlainChat();

  const labelBefore = (await screen.findByTestId("chat-brain-pill-label")).textContent;
  expect(labelBefore).toBe("anthropic-sonnet-5");   // <-- :586, the failing assertion

  act(() => {
    lastBrainPickerProps?.onPendingChange?.({
      label: "· switching to Codex CLI…",
      kind: "inflight",
    });
  });

  expect(await screen.findByTestId("chat-brain-pill-pending")).toHaveTextContent(
    "switching to Codex CLI"
  );
  expect(screen.getByTestId("chat-brain-pill-label").textContent).toBe(labelBefore);
```
**Sibling test one block up, in the SAME `describe`, is the pattern for a positive `screen.findByTestId` + `within()` composition** (`src/pages/Chat.test.tsx:573-579`):
```tsx
it("renders the pill's own visible trigger inside the picker it opens (single control, no relay)", async () => {
  mockActiveEngineMap = { "assistant-default": { model: "anthropic-sonnet-5", mode: "inherited" } };
  renderPlainChat();

  const picker = await screen.findByTestId("mock-chat-brain-picker");
  expect(within(picker).getByTestId("chat-brain-pill-label")).toBeInTheDocument();
});
```
**Per D-08 (amended) and RESEARCH.md's confirmed mechanics, the instrumentation must NOT be a global `onTestFailed` hook in `setup.ts`** — it fires after Testing Library's auto-`afterEach(cleanup)` unmounts the DOM (proven both from `@vitest/runner` source and an empirical control this session). The correct pattern, per RESEARCH.md's explicit recommendation, is one of:
- `screen.queryAllByTestId("chat-brain-pill-label")` immediately before the `toBe` assertion — logs match count + each match's `textContent` into the assertion failure message itself, synchronously, before any cleanup runs; or
- a local `try { ... } catch (e) { /* attach captured state */ throw e; }` wrapped tightly around the query+assertion pair.

Either shape is a **local addition to this one `it` block** — there is no existing in-repo file to copy this exact instrumentation idiom from (RESEARCH.md confirms it as newly-designed this session, not a pre-existing pattern), but the surrounding test's structure (render → `screen.findByTestId` → assert on `.textContent`) is unchanged and must stay unchanged per D-11 (no widened `waitFor`, no reshaping the assertion to look at source data).

**`beforeEach` reset block this `it` inherits** (`src/pages/Chat.test.tsx:513-521`):
```tsx
beforeEach(() => {
  vi.clearAllMocks();
  registeredEventHandlers.clear();
  mockStatus = "connected";
  mockActiveEngineMap = {};
  lastBrainPickerProps = null;
  mockCatalogueEntries = [];
  mockDefaultProfileId = "assistant-default";
});
```

---

## Shared Patterns

### Dry-run-by-default, `apply: true`-to-write internal mutation
**Source:** `convex/migrations.ts` (`purgeSkillsByOrigin` :39-48, `backfillAstridrProviderTag` :193-221)
**Apply to:** D-04's re-origin migration.
```ts
handler: async (ctx, { apply }) => {
  // ...compute matched rows...
  if (!apply) return { matched: rows.length, dryRun: true, samples: rows.slice(0, 5)... };
  for (const r of rows) await ctx.db.patch(r._id, { ... });
  return { matched: rows.length, dryRun: false };
}
```

### Untrusted-input sanitize-to-safe-default (never throw)
**Source:** `convex/skillSync.ts:23-36` (`sanitizeScannedOrigins`)
**Apply to:** any new manifest/coverage-declaration field added to the `/scan` snapshot's `v.any()` body — D-01/D-03's server guard.

### Two-call-site duplication is intentional in this codebase and both must be fixed together
**Source:** `convex/registry.ts:182-197` vs `:350-365` — proven byte-for-byte identical except one string literal (`changedBy`).
**Apply to:** any DEBT-05 server-side change (guard, alerts write) — a shared helper function is safer than editing both blocks by hand, but if edited by hand, both edits must be verified identical in shape.

### Fire-and-forget hook, log-and-continue on error, no retry
**Source:** `hooks/scanner.mjs:76-85` (skill-scan try/catch), reinforced by CLAUDE.md's "Hooks must stay fire-and-forget" rule and D-07's explicit rejection of bounded retry.
**Apply to:** `hooks/skillScan.mjs` and `hooks/scanner.mjs` changes for D-01/D-07 — never add retry/backoff/timing logic to these files.

### Origin-literal-as-named-local, not inline comparisons repeated ad hoc
**Source:** `src/lib/skills.ts:3-4` (`DORMANT_ORIGIN`, `PROJECT_PREFIX`), `:69/:125/:165` (`isActiveGlobal`, `moveDestinationIsProject`, etc.)
**Apply to:** the D-17 frontend fix sites — CONTEXT.md's rejected-alternative note applies: extract a shared `isGlobalOrigin()` only if the plan explicitly reopens that discretion call; otherwise each site gets its own mechanical edit in the existing per-site style.

### `REGRESSION:`-prefixed test naming for prune/guard defect coverage
**Source:** `convex/__tests__/skillSync.test.ts:89,98,150`
**Apply to:** the new DEBT-05 survival test and any D-01 producer-guard unit test.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `C:\Users\mandr\convex-selfhost\docker-compose.yml`, `docker-compose.standby.yml`, `*.ps1` scripts, `run-restart-hidden.vbs`, new `README.md`, new `.gitignore`, new `selfhosted.envfile.example`, new preflight script | config + docs + ops script | file-I/O (git/compose bootstrap) | **This entire item lives outside the codepulse repository** (a brand-new private repo at `C:\Users\mandr\convex-selfhost\`, per D-12). Nothing in codepulse's own `convex/`, `src/`, or `hooks/` trees is a role/data-flow analog for "bootstrap a private ops repo, parameterize a docker-compose secret, write a preflight validation script." Stated explicitly rather than forced: **no analog exists in this repo.** |

**Closest available conventions in codepulse worth mirroring for DEBT-07** (not analogs in the role/data-flow sense above — surfaced per the phase brief's request to check for existing preflight/health-check/`.gitignore` conventions):

- **Secrets `.gitignore` + `.example` template pattern** — codepulse's own `.gitignore` (root, read in full):
  ```
  # Secrets: ignore all env files except the committed template (CSO-95-03)
  .env
  .env.*
  !.env.example
  ```
  paired with `.env.example` (root, read in full — 20 lines, every real value blanked or replaced with a placeholder, e.g. `VITE_CONVEX_URL=https://your-deployment.convex.cloud`, `VITE_ASTRIDR_API_KEY=`). This is the exact "ignore the real file, commit a key-name-only template" shape D-14 specifies for `selfhosted.envfile`/`selfhosted.envfile.example` — mirror the format (comment above each var explaining its purpose, blank/placeholder values, no live data).

- **Bootstrap README shape** — codepulse's own `README.md:1-20` (Quick Start section): title + one-line description + tech stack line + a fenced `git clone` → `cd` → `npm install` → `cp .env.example .env.local` → edit → run sequence. D-13's bootstrap README should follow the same "clone → copy template → edit → run" structure, substituting `git clone` (private repo), `cp selfhosted.envfile.example selfhosted.envfile`, `docker compose up`.

- **Per-check PASS/FAIL preflight script shape** — `scripts/verify-skills-page.mjs:26-42` (read in full for this section):
  ```js
  const fail = [];
  const ok = (cond, label, extra = "") => {
    console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
    if (!cond) fail.push(label);
  };
  ok((await pageHeading.count()) > 0, "Skills Database heading renders");
  ```
  This is the closest in-repo pattern to D-16's "asserts every required file, env key, and external prerequisite is present ... not a single aggregate boolean with no visibility into which check ran" requirement — an `ok()` helper that logs PASS/FAIL per named check and accumulates failures, rather than one bare exit-code assertion. Mirror this shape (per-check label + PASS/FAIL line + accumulated failure list + non-zero exit if any failed) for the `convex-selfhost` preflight script, substituting Playwright/DOM checks for file-existence/`docker compose config --quiet`/key-name-parity checks per RESEARCH.md's D-16 section.

## Metadata

**Analog search scope:** `convex/` (schema.ts, skillSync.ts, registry.ts, migrations.ts, scan.ts, __tests__/), `hooks/` (skillScan.mjs, scanner.mjs), `src/lib/` (skills.ts, skillVault.ts), `src/pages/` (Skills.tsx, Chat.test.tsx), `src/components/` (OriginBadge.tsx, skills/SkillLifecycleMenu.tsx), `src/test/setup.ts`, plus repo-root `.gitignore`/`.env.example`/`README.md` and `scripts/verify-skills-page.mjs` for the DEBT-07 no-analog fallback.
**Files scanned:** 15 read directly this session (all line-number citations re-verified live, zero drift from CONTEXT.md/RESEARCH.md).
**Pattern extraction date:** 2026-08-11
