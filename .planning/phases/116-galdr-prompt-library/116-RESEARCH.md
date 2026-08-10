# Phase 116: Galdr Prompt Library - Research

**Researched:** 2026-08-10
**Domain:** Convex (self-hosted) authenticated HTTP surface + Claude Code skill authoring + React/shadcn UI (UI-SPEC already covers UI in full)
**Confidence:** HIGH (all findings grounded in file:line reads of this repo; no external library research was needed — zero new packages this phase)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The skill reads via `GET /galdr/prompt?slug=…`, guarded by a **new** `GALDR_API_KEY` validator added alongside `validateIngestAuth` / `validateForgeIngestAuth` in `convex/ingestAuth.ts`. This is CodePulse's first authenticated *read* endpoint — of 56 routes in `convex/http.ts`, `/health` (line 37) is the only existing GET and every other route is write-ingest. The new validator MUST fail closed exactly like its two siblings: missing key ⇒ deny unless an explicit `GALDR_ALLOW_ANON=true` opt-in is set. A separate key (not `ASTRIDR_INGEST_API_KEY`) avoids widening a leaked-key blast radius to include reading the prompt library.
- **D-02:** One `GALDR_API_KEY` authorizes both the read and the writes (`/galdr-save`, `usageCount` bump). Only holder is Larry's own CLI sessions; a read/write split buys little.
- **D-03:** When Convex is unreachable the skill **fails loudly and keeps no local cache.** Load-bearing, not incidental — the whole live-fetch design exists so there is never a second, stale copy of a prompt body.
- **D-04:** The `/galdr` HTTP routes are **agent/CLI only** — no CORS headers, no `OPTIONS` handler, no allowlist entry, deliberately unlike the 20+ ingest route pairs in `convex/http.ts`. Browser writes go through the existing Clerk-authed Convex mutation path. A planner that "helpfully" adds the OPTIONS pairing for consistency is contradicting this decision.
- **D-05:** When `/galdr <search terms>` matches more than one prompt, the skill **lists the candidates (title, category, usage count) and waits for an explicit pick.** Never auto-injects on a fuzzy match.
- **D-06:** When `/galdr-save <title>` produces an existing slug, the server **refuses** and returns the existing prompt's title and `updatedAt`. Nothing is silently overwritten and nothing is silently auto-suffixed.
- **D-07:** The skill installs **once** to `~/.claude/skills/galdr/`. `.claude-alt/skills` is a Junction to `.claude/skills`, so one install covers both config roots. Reaching the laptop requires `git add -f skills/galdr/SKILL.md` in `claude-code-config`, matching `archive-repo`/`wrap`/`verify`/the other six force-added skills.
- **D-08:** Skill surface is exactly design doc §4.1: bare `/galdr` lists categories + favorites; `/galdr <slug>` fetches, resolves variables, injects, and bumps `usageCount`; `/galdr-save <title>` captures back. No extra `--category` / `--recent` / `--favorites` flags this phase.
- **D-09:** The skill resolves `{{variables}}` from **args first, then asks for the gaps** — `/galdr competitor-analysis company=Acme` fills what it can and prompts only for what remains. No inference from surrounding conversation context.
- **D-10:** An unresolved variable at injection time causes the skill to **refuse to inject**, naming the missing variables. No literal `{{name}}` placeholders, no empty-string substitution.
- **D-11:** In the CodePulse Copy dialog, **Copy stays disabled until every variable has a value** — same rule as D-10.
- **D-12:** Send-to-Chat **resolves variables first**, then hands the fully-filled body to the existing autoSend handoff. `Chat.tsx`'s handoff **auto-sends on arrival** (`firedRef` guard, no confirmation step in Chat itself) — resolution must happen on the Galdr side, before navigation, not after.
- **D-13:** The `prompts` table is **exempt from `RETENTION_DAYS`, with the reason documented in place.** Every other new table has been bounded pre-emptively; that rule was written for firehoses, and a curated prompt library is the opposite — a 90-day window would silently delete a prompt simply because it went a quarter unused. The exemption must carry an inline comment.
- **D-14:** `promptVersions` is bounded by **newest-N-per-prompt (~20), pruned on write** — bounds by edit frequency (the real growth driver), not age.
- **D-15:** **Every body-changing write appends one snapshot** — UI save, `/galdr-save` update, and restore alike. Restore appends a new version rather than rewinding.
- **D-16:** Deleting a prompt **sets `archived: true`** — hidden from grid and skill lookup, versions retained. No hard delete, no purge action this phase.

### Claude's Discretion — already resolved by 116-UI-SPEC.md

The UI-SPEC (revision 1, checker-approved) has already settled every item CONTEXT.md left open. The planner should treat these as **locked**, not re-litigate:

- **Category model → plain `category: v.string()` field** on `prompts`, not a `skillCategories`-style table. Chips derived at render time from live distinct values.
- **`usageCount` semantics → increments only on actual body delivery**: skill injection (`/galdr <slug>`), UI Copy with every variable resolved, UI Send-to-Chat with every variable resolved. **Not** bumped by opening the card/drawer, favoriting, or "Copy as command". `lastUsedAt` updates on the same trigger. Schema comment specified verbatim in UI-SPEC.
- **Nav placement/icon → COMMAND group, after `/skills`, `Sparkles` icon** (`sparkles` key, not yet in `iconComponents`).
- **Seeding → begin empty**, no starter prompts (standing anti-pattern: no fabricated data for a user-content table).
- **Naming hygiene → `prompts`/`promptVersions`** kept visibly distinct from the unrelated `promptSubmissions` table (`convex/schema.ts:651`) in every hook/component/file name (e.g. `useGaldrPrompts`, not `usePrompts`).

### Deferred Ideas (OUT OF SCOPE)

- **Forge prompt-picker in the session composer** — needs Forge Phase 23 (WS attach + stdin write). Tracked in Forge's ROADMAP "Queued (post-v4.0)". Not stubbed here.
- **Ástríðr `galdr_lookup` tool** — astridr SEED-028, v29. Nothing ships inside astridr-repo this phase.
- **Richer skill flags** (`--category`, `--recent`, `--favorites`) — rejected for this phase (D-08).
- **Hard delete / purge for prompts** — D-16 ships archive-only; a type-to-confirm purge is a later addition.
- **Separate read vs write keys** — rejected (D-02); revisit only if the key ever leaves Larry's machines.
- **Any v15.0 "Borealis" UI overhaul pieces** — SEED-005 holds the overhaul; this phase uses current design-system tokens only.
- **"Archived" restore view in the UI** — UI-SPEC explicitly flags this as a disclosed scope-boundary, not a requirement. An archived prompt is retained in the DB but not reachable again from the CodePulse UI this phase.
- **Tags UI field** — UI-SPEC leaves this to the planner's discretion; the schema field can exist unused if deferred.

</user_constraints>

<phase_requirements>
## Phase Requirements

No `REQ-XX` IDs are mapped to this phase — `ROADMAP.md`'s stub for Phase 116 carries `Requirements: TBD`, and `.planning/REQUIREMENTS.md`'s active milestone (v14.0, Phases 108-113) has no traceability row for 116-119. This is a design-doc-driven phase (Seiðr Suite, `docs/proposals/2026-08-07-seidr-suite-design.md`), not a REQUIREMENTS.md-driven one. **The 16 locked decisions D-01..D-16 in 116-CONTEXT.md are the acceptance-bearing units for this phase** — the planner should map plan tasks to those IDs instead of REQ-IDs, and the Validation Architecture section below does the same.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01..D-04 | Auth/HTTP surface (new bearer validator, GET route, fail-closed, no CORS) | §"HTTP/Auth surface" below — exact `convex/ingestAuth.ts` pattern to copy, GET query-param reading, `getCorsHeaders` must NOT be called on `/galdr` routes |
| D-05, D-08, D-09, D-10 | Skill surface, variable resolution | §"Claude Code skill authoring" below — SKILL.md + bundled Node script split, modeled on `webapp-testing`'s script pattern and `hooks/codepulse-hook.mjs`'s env resolution |
| D-06 | Slug collision refusal | §"Convex has no unique constraints" pitfall — transactional check-then-insert + `ConvexError` so the client can read `.data` |
| D-07 | Skill install / force-add | §"Claude Code skill authoring" — confirmed junction + force-add precedent already verified in CONTEXT.md; no new research needed |
| D-11, D-12 | UI Copy/Send-to-Chat gating | §"AutoSendHandoff.skillName is required" pitfall — `recordSkillLaunch` no-ops safely on an unmatched name, verified at `convex/registry.ts:678-691` |
| D-13, D-14, D-15 | Retention exemption / prune-on-write | §"promptVersions prune-on-write vs. convex/retention.ts" below |
| D-16 | Archive-only delete | §"Existing `archived` field convention" — `v.optional(v.boolean())`, 7 existing precedents in `convex/schema.ts` |
| (implicit) Schema deploy | New tables reaching the live self-hosted backend | §"Convex schema deploy mechanics" below — live evidence from Phase 107-05 |

</phase_requirements>

## Summary

This phase adds two Convex tables, a new authenticated HTTP surface (CodePulse's first authenticated GET route), a `/galdr` page, and a two-skill Claude Code integration (`/galdr`, `/galdr-save`). 116-CONTEXT.md and 116-UI-SPEC.md are unusually complete — every schema field, UI component, copy string, and architectural decision is already locked. This research does not re-derive any of that; it fills the five gaps the orchestrator flagged as under-specified: skill authoring mechanics, the concrete auth/HTTP implementation, confirmation of the two UI-SPEC discretion calls (already resolved — no new decision needed from the planner), the versioning/retention interaction, and self-hosted deploy mechanics.

**Primary recommendation:** Build the skill as a **SKILL.md + one bundled Node script** (`~/.claude/skills/galdr/scripts/galdr-client.mjs`), following the `webapp-testing` skill's "script is a black box, SKILL.md drives the reasoning" pattern — not an all-markdown skill. The script owns the deterministic parts (env/`.env.local` resolution copied from `hooks/codepulse-hook.mjs:187-232`, the authenticated fetch, JSON parsing); the SKILL.md markdown owns the parts that need model reasoning (args-then-ask variable resolution, refusing on an unresolved variable, presenting fuzzy-match candidates). On the backend, copy `convex/ingestAuth.ts`'s two existing validators verbatim in structure for a new `validateGaldrAuth`, and copy `convex/configVersionIngest.ts`'s POST-handler shape for the write route — but the new GET route must NOT call `getCorsHeaders` at all (D-04). The `promptVersions` prune-on-write is architecturally distinct from `convex/retention.ts`'s day-based batch prune (D-14 bounds by *count*, not *age*) — it belongs inside the prompt-save mutation itself, not as a new `RETENTION_DAYS` entry, and must never be added to that dict.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Prompt CRUD + versioning | Database (Convex) | API (Convex mutations) | `prompts`/`promptVersions` tables own persistence; mutations own the slug-collision and prune-on-write logic (Convex has no server-side unique constraints or triggers) |
| Browser-side reads/writes | API (Convex query/mutation via Clerk-authed client) | Browser (React) | Existing pattern — UI never calls the new HTTP routes; it calls `useQuery`/`useMutation` directly, same as every other CodePulse page |
| Agent/CLI reads/writes | API (Convex httpAction, bearer-authed) | — | `/galdr/prompt` GET + POST are the only path for Claude Code skills and any future non-browser agent (Ástríðr's `galdr_lookup`, deferred) — deliberately NOT reachable from a browser fetch (no CORS) |
| Variable resolution (args → ask → refuse) | Browser/Client (skill = CLI agent reasoning) | API (server never resolves variables) | The server is a dumb store; resolution logic is duplicated by design in two places — the skill (CLI) and `FillVariablesDialog` (UI) — per CONTEXT.md's "one contract, not two" framing |
| Send-to-Chat handoff | Browser/Client (React Router state) | API (existing `sendMessage` → Ástríðr WS) | Galdr reuses the existing `RunTargetChooser`→`Chat.tsx` handoff verbatim; no new handoff shape |
| Retention/pruning | Database (Convex, cron-scheduled internalMutation) | — | `promptVersions` prune-on-write executes inline inside the save mutation (not the nightly `convex/retention.ts` cron) because its bound is a per-document count, not a global age cutoff |

## Standard Stack

No new external packages this phase. Every backend primitive (`httpAction`, `mutation`, `v.*` validators, `defineTable`) is already in use throughout `convex/`; every UI primitive is already installed per 116-UI-SPEC.md's Registry Safety table (`card`, `sheet`, `dialog`, `alert-dialog`, `badge`, `button`, `input`, `textarea`, `dropdown-menu`, `collapsible`, `skeleton`, `tooltip`). The Claude Code skill uses only Node.js built-ins (`fetch`, `readFileSync`/`existsSync` from `node:fs`, `join` from `node:path`) — the same zero-dependency approach `hooks/codepulse-hook.mjs` already uses.

**Installation:** none required.

## Package Legitimacy Audit

**Not applicable this phase.** Zero new packages are installed in either `codepulse/package.json` or the Claude Code skill (Node built-ins only, no `npm install` in `~/.claude/skills/galdr/`). The Package Legitimacy Gate protocol is skipped per its own scope ("whenever this phase installs external packages") — it does not.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌───────────────────────────────────────────┐
                    │        Convex self-hosted backend          │
                    │            (http://127.0.0.1:3210)          │
                    │                                             │
                    │  prompts (slug unique via check-then-insert)│
                    │  promptVersions (newest-N-per-prompt)       │
                    └───────────────┬─────────────────────────────┘
                                    │
              ┌─────────────────────┼──────────────────────────┐
              │                     │                          │
      Clerk-authed mutations   validateGaldrAuth()        (no route — D-04
      (browser UI, existing        (new, copies             blocks any
      pattern, no new auth)        ingestAuth.ts             browser fetch)
              │                     shape)
              │                     │
    ┌─────────▼─────────┐   ┌───────▼──────────────────────┐
    │  /galdr page       │   │ GET  /galdr/prompt?slug=…    │
    │  (React, Convex    │   │ POST /galdr/prompt           │
    │  subscriptions,    │   │ (Bearer GALDR_API_KEY,       │
    │  card grid +       │   │  no CORS/OPTIONS)             │
    │  editor drawer)    │   └───────┬──────────────────────┘
    └────────────────────┘           │
                                      │  fetch() with Authorization header
                          ┌───────────▼────────────────────────┐
                          │ ~/.claude/skills/galdr/SKILL.md      │
                          │  + scripts/galdr-client.mjs           │
                          │                                       │
                          │  /galdr <slug|search> [k=v ...]      │
                          │    → fetch → args-then-ask fill      │
                          │    → refuse-on-unresolved → inject   │
                          │    → bump usageCount (via same POST) │
                          │  /galdr-save <title>                 │
                          │    → POST, refuse on slug collision  │
                          └───────────────────────────────────────┘
```

The primary use case (`/galdr competitor-analysis company=Acme` from any Claude Code session on either machine) traces: skill script resolves `CODEPULSE_URL`/`GALDR_API_KEY` from env or `.env.local` → GET with Bearer header → server validates → 200 with `{title, body, category, variables[]}` or a candidates array (D-05) → skill fills `company` from the arg, asks for any remaining `{{var}}` → on full resolution, injects the resolved body into context and re-POSTs to bump `usageCount`/`lastUsedAt`.

### Recommended Project Structure

```
convex/
├── schema.ts                     # add prompts + promptVersions tables
├── ingestAuth.ts                 # add validateGaldrAuth() alongside the existing two
├── http.ts                       # add GET /galdr/prompt, POST /galdr/prompt (no OPTIONS pair — D-04)
├── galdr.ts                      # NEW — query/mutation module: getBySlug, search, save,
│                                  #   archive, restore, listVersions (mirrors registry.ts's shape)
├── galdrHttp.ts                  # NEW — the two httpAction handlers (mirrors configVersionIngest.ts)
└── __tests__/
    ├── ingestAuth.test.ts        # extend with validateGaldrAuth cases (5 tests, same shape as existing)
    └── galdr.test.ts             # NEW — slug collision, prune-on-write, archive semantics

src/
├── pages/Galdr.tsx                       # NEW
├── hooks/useGaldrPrompts.ts              # NEW — wraps useQuery(api.galdr.list) ?? []
├── components/galdr/
│   ├── PromptEditorDrawer.tsx            # NEW
│   ├── FillVariablesDialog.tsx           # NEW
│   └── SendSplitButton.tsx               # NEW
├── lib/navRegistry.ts                    # add sparkles icon + /galdr COMMAND entry
└── App.tsx                               # add lazy route

~/.claude/skills/galdr/                   # OUTSIDE this repo — force-added to claude-code-config
├── SKILL.md
└── scripts/
    └── galdr-client.mjs                  # bundled fetch/auth helper, Node built-ins only
```

### Pattern 1: Fail-closed bearer auth validator (copy structure verbatim)

**What:** `convex/ingestAuth.ts` already has two working fail-closed validators. D-01 requires a third with the identical shape — env var lookup, `Bearer <key>` string comparison, `ALLOW_ANON` opt-in fallback.
**When to use:** For `validateGaldrAuth`, added to the same file.
**Example — the exact pattern to replicate** (source: `convex/ingestAuth.ts:76-85`):
```typescript
export function validateGaldrAuth(request: Request): boolean {
  const expectedKey = _env.GALDR_API_KEY;
  if (!expectedKey) {
    // Fail closed: a missing key must not silently open /galdr to the
    // public internet. Require an explicit opt-in for the dev/anon path.
    return _env.GALDR_ALLOW_ANON === "true";
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```
This is a plain string comparison (`===`), not constant-time — identical to both existing siblings. This is an accepted, pre-existing repo-wide pattern; Galdr should match it rather than introduce a different comparison method for one validator.

### Pattern 2: GET httpAction with query-string args (new — no existing GET-with-params precedent)

**What:** `/health` (`convex/health.ts:48`) is the only existing GET, and it takes no params. D-01's `GET /galdr/prompt?slug=…` needs `new URL(request.url).searchParams.get("slug")`.
**Example:**
```typescript
// convex/galdrHttp.ts
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { validateGaldrAuth, unauthorizedResponse } from "./ingestAuth";

export const galdrPromptGet = httpAction(async (ctx, request) => {
  if (!validateGaldrAuth(request)) return unauthorizedResponse();

  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }, // no CORS header — D-04
    });
  }

  const result = await ctx.runQuery(api.galdr.getBySlugOrSearch, { slug });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```
No `getCorsHeaders(request)` spread anywhere in this handler or its response — every one of the 56 existing routes in `convex/http.ts` includes it; Galdr's two routes are the deliberate exception (D-04).

### Pattern 3: Skill = SKILL.md (reasoning) + bundled script (deterministic I/O)

**What:** None of the 9 force-added skills (`archive-repo`, `canary`, `capture-learnings`, `cso`, `design-review`, `dogfood`, `verify`, `webapp-testing`, `wrap`) currently do an authenticated HTTP fetch. The closest precedent for "bundle a script, keep SKILL.md thin" is `webapp-testing/scripts/with_server.py`, whose own SKILL.md explicitly instructs: *"DO NOT read the source until you try running the script first... These scripts can be very large and thus pollute your context window. They exist to be called directly as black-box scripts."*
**When to use:** For `/galdr` and `/galdr-save`. The fetch/auth/JSON-parse logic is deterministic and testable — put it in `scripts/galdr-client.mjs`. The variable-resolution reasoning (args-then-ask, refuse-on-unresolved, present fuzzy candidates) genuinely needs the model's judgment — keep that in SKILL.md prose, driving the script as a subprocess.
**Env resolution to copy** (source: `hooks/codepulse-hook.mjs:187-232`, cited directly in CONTEXT.md's Integration Points):
```javascript
// scripts/galdr-client.mjs — url/key resolution, same shape as codepulse-hook.mjs
function resolveUrl() {
  if (process.env.CODEPULSE_URL) return process.env.CODEPULSE_URL;
  const envPath = join(__dirname, "..", "..", "..", "..", "codepulse", ".env.local");
  // NOTE: the skill lives OUTSIDE this repo (~/.claude/skills/galdr/), so it
  // cannot resolve a relative .env.local path the way codepulse-hook.mjs does
  // from inside the repo. Prefer requiring CODEPULSE_URL / GALDR_API_KEY as
  // real environment variables set in the shell profile or a dedicated
  // ~/.claude/skills/galdr/.env the script loads explicitly — do not assume
  // the skill process's CWD is inside codepulse.
  return "https://ideal-sandpiper-297.convex.site"; // fallback, matches hook's prod fallback
}
function resolveGaldrKey() {
  return process.env.GALDR_API_KEY ?? null; // no key ⇒ script must fail loudly (D-03), never silently proceed unauthenticated
}
```
**Pitfall this surfaces (flag for the planner):** `codepulse-hook.mjs` resolves `.env.local` via a path *relative to itself*, because it lives inside the repo (`hooks/`). The galdr skill lives at `~/.claude/skills/galdr/`, a different filesystem location entirely with no fixed relative path back to `codepulse/`. The planner must decide the skill's env-resolution strategy explicitly (e.g., a real shell-level `GALDR_API_KEY`/`CODEPULSE_URL` env var, or a skill-local `.env` file) rather than copying the relative-path trick verbatim — copying it verbatim would silently resolve to nothing outside the repo.

### Pattern 4: Convex mutations have no unique constraints — collision check must be transactional

**What:** No table in this schema currently has a `slug` field (confirmed: `grep -n "slug" convex/schema.ts` returns zero hits) — Galdr is the first. Convex offers no server-side unique-index enforcement; D-06's "refuse on collision" must be implemented as an explicit query-then-insert *inside a single mutation function*. Convex mutations are fully transactional/serializable (OCC-based, same guarantee already relied on throughout `convex/aggregateShard.ts` per the 107-series plans), so a read-then-write race within one mutation body is safe — two concurrent `/galdr-save` calls for the same slug cannot both succeed.
**Example:**
```typescript
// convex/galdr.ts
export const savePrompt = mutation({
  args: { title: v.string(), slug: v.string(), body: v.string(), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("prompts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) {
      // ConvexError so the client can read err.data (plain Error is redacted
      // to "Server Error" client-side — 2026-07-27 lesson, already established
      // repo-wide practice for this exact reason).
      throw new ConvexError({
        code: "SLUG_COLLISION",
        existingTitle: existing.title,
        existingUpdatedAt: existing.updatedAt,
      });
    }
    const promptId = await ctx.db.insert("prompts", { ...args, /* ... */ });
    await ctx.db.insert("promptVersions", { promptId, body: args.body, savedAt: Date.now() });
    return promptId;
  },
});
```

### Pattern 5: `promptVersions` prune-on-write is a DIFFERENT mechanism from `convex/retention.ts`

**What:** `convex/retention.ts`'s entire design (cursor-seeked batch delete, `RETENTION_DAYS[table]` cutoff, `MAX_BATCHES_PER_NIGHT` cap) exists to bound an *unbounded, age-based* table by deleting everything older than N days, run as a scheduled nightly cron across the *whole table*. D-14 is a fundamentally different shape: bound *each individual prompt's* version count to ~20, evaluated at write time, scoped to one `promptId`. This is a tiny, single-document-scoped operation (query `promptVersions` by `promptId` index, order desc, if count > 20 delete the oldest excess) that belongs **inline inside the save/restore mutation**, not as a new entry in `RETENTION_DAYS`.
**Why this matters:** `RETENTION_DAYS`'s own test (`retention.test.ts`, referenced in the file's header comment) asserts every key is a real schema table name — but even a syntactically valid entry would be *semantically wrong* here, because `pruneBatchV3` deletes by `_creationTime` cutoff across the *entire table*, not per-`promptId`. Adding `promptVersions: 30` there would delete old versions of *actively-edited* prompts just as readily as abandoned ones — the opposite of D-14's intent (bound by edit frequency, not calendar age).
**Example (inline, inside the same mutation as Pattern 4):**
```typescript
const PROMPT_VERSION_CAP = 20; // tunable constant, not scattered magic numbers (per D-14's own text)

async function pruneOldVersions(ctx: MutationCtx, promptId: Id<"prompts">) {
  const versions = await ctx.db
    .query("promptVersions")
    .withIndex("by_promptId", (q) => q.eq("promptId", promptId))
    .order("desc")
    .collect(); // bounded by design — one prompt's versions, never the whole table
  for (const v of versions.slice(PROMPT_VERSION_CAP)) {
    await ctx.db.delete(v._id); // incremental, single-document-scoped — never a bulk sweep (repo CLAUDE.md rule)
  }
}
```
This respects the repo's standing "never bulk-delete on the live instance" rule (`CLAUDE.md` "Self-Hosted Convex — Operational Rules") because the delete count per call is bounded by `PROMPT_VERSION_CAP`, not by table size — it is architecturally incapable of becoming a mass delete no matter how large `promptVersions` grows globally.

### Existing `archived` field convention

`convex/schema.ts` already has 7 tables using `archived: v.optional(v.boolean())` (e.g. lines 14, 33, 316, 571, 1116, 1197, 1213, 1231, 1573) — this is the established idiom for D-16's soft-delete. Follow it verbatim: `archived: v.optional(v.boolean())`, filtered with `!archived` (undefined and `false` both read as not-archived) in every query that lists/searches active prompts.

### Anti-Patterns to Avoid

- **Adding an OPTIONS route pair for `/galdr/prompt`** "for consistency" with the other 56 routes — D-04 explicitly forbids this; every existing POST route in `convex/http.ts` has a matching OPTIONS line, but Galdr's two routes must not.
- **Reusing `ASTRIDR_INGEST_API_KEY`** instead of a dedicated `GALDR_API_KEY` — D-01 rejected this explicitly (blast-radius argument).
- **Adding `promptVersions` to `convex/retention.ts`'s `RETENTION_DAYS` dict** — see Pattern 5 above; this would be the "helpfully consistent" mistake a planner unfamiliar with the D-13/D-14 distinction might make.
- **Skipping the inline exemption comment on `prompts`** — D-13 states explicitly that its absence is what causes a future retention audit to "fix" the missing bound by mistake (this already happened once in this repo's history per `retention.ts`'s own header comment about tables getting bounded pre-emptively).
- **Building the `skillCategories`-style categories table** — UI-SPEC already resolved this discretion call in favor of a plain string field; building the heavier pattern would contradict a settled decision, not merely add scope.
- **Copying `hooks/codepulse-hook.mjs`'s `.env.local`-relative-to-`__dirname` resolution verbatim into the skill script** — see Pattern 3's pitfall; the skill lives outside the repo and that relative path will not resolve.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bearer-token auth | A new auth scheme, JWT, or session mechanism | Copy `validateIngestAuth`'s fail-closed shape verbatim into `validateGaldrAuth` | Two working, audited implementations already exist in this exact file; a third divergent shape is pure risk for zero benefit |
| Send-to-Chat delivery | A new navigation/handoff mechanism | Reuse `useRunLaunch`'s `submitChat` pattern / `navigate("/chat", { state: { autoSend: {...} } })` verbatim | `Chat.tsx:541-584` already handles connection-state branching, toast-on-failure, and the `firedRef` double-fire guard; reinventing it would drop that hardening |
| Category admin UI | A `skillCategories`-style overrides table + drag-drop reassignment UI | Plain `category: v.string()` field, chips derived from live distinct values | Already decided by UI-SPEC — building the heavier pattern is scope creep against a settled decision, not a legitimate implementation choice |
| Version pruning | A generic "retention" abstraction shared with `convex/retention.ts` | A small dedicated `pruneOldVersions()` helper, inline in the save mutation | The two pruning shapes (age-cutoff-across-whole-table vs. count-cap-per-document) are different enough that a shared abstraction would obscure both, not simplify either |
| Markdown rendering of the prompt body/preview | A `dangerouslySetInnerHTML` render or a new markdown pipeline | Plain-text mono rendering (per UI-SPEC's JetBrains Mono treatment — no markdown-render specified for the preview panel) | The repo already has `react-markdown` installed and used elsewhere for genuinely-markdown content, but the UI-SPEC's own component inventory describes the preview as substituted plain text, not rendered markdown — introducing an HTML-render path here would be a new, unnecessary XSS surface for content that Larry's own agents author |

**Key insight:** Almost everything this phase needs already has a proven, in-repo precedent (auth validator, ingest POST handler, `archived` field, Send-to-Chat handoff). The two genuinely novel pieces — a unique-slug constraint and a per-document version cap — are novel specifically because no prior CodePulse table needed either; both need small, purpose-built code rather than a shared abstraction bent to fit.

## Common Pitfalls

### Pitfall 1: `AutoSendHandoff.skillName` is a required field, but Galdr prompts aren't "skills"

**What goes wrong:** `src/lib/skillRun.ts:16-20` defines `AutoSendHandoff` with `skillName: string` as non-optional, and `Chat.tsx:542,562` calls `recordSkillLaunch({ name: handoff.skillName })` on a successful send. A planner might assume this call needs a matching row in the `skills` table, or skip Send-to-Chat entirely thinking it's a hard type/runtime conflict.
**Why it happens:** The handoff type and the consuming effect were built exclusively for the Skills page; Galdr is the first non-skill consumer.
**How to avoid:** `recordSkillLaunch` (`convex/registry.ts:678-691`) is a no-op-safe lookup: `if (!skill) return;` — an unmatched name silently does nothing (no error, no exception). Galdr can pass any string (e.g. `` `galdr:${slug}` ``) as `skillName` to satisfy the type; it will not corrupt the `skills` registry and will not throw.
**Warning signs:** If the planner instead adds a Galdr row to the `skills` table just to make `recordSkillLaunch` "succeed," that is unnecessary — it was never going to fail either way. **Verified** at `convex/registry.ts:678-691`.

### Pitfall 2: `promptVersions` prune-on-write must not be confused with `convex/retention.ts`'s prune

See Architecture Pattern 5 above — this is significant enough to repeat as a pitfall: adding `promptVersions` to `RETENTION_DAYS` is syntactically valid (it would pass `retention.test.ts`'s "is this a real table name" check) but semantically wrong, silently deleting version history by calendar age instead of by per-prompt count.

### Pitfall 3: Convex self-hosted deploy target must be verified, not assumed

**What goes wrong:** `npx convex deploy`/`npx convex dev` could target the wrong deployment (this repo's own memory file documents `npx convex run`/`deploy` hitting the CLOUD deployment `tidy-whale-981` in some contexts, while production telemetry posts to the self-hosted instance — two separate DBs).
**How to avoid:** The most recent schema-adding deploy in this repo (Phase 107-05, adding a `shard` field) verified its target from the CLI's **own output**, not from configuration: it asserted the printed URL contained `127.0.0.1:3210` (never `.convex.cloud`) and that the push printed `No indexes are deleted by this push` / `Schema validation complete.` before treating the deploy as real. The plan explicitly ran this step **inline in the main session**, not via a subagent, because it is the one irreversible action in the phase and the deploy authorization is native to the interactive session (documented reasoning in `107-05-SUMMARY.md`'s key-decisions).
**Warning signs:** Any deploy output mentioning `.convex.cloud` instead of `127.0.0.1:3210` means the push landed on the wrong deployment — stop immediately, do not proceed with UI work that assumes the schema is live.

### Pitfall 4: `GALDR_API_KEY` env var resolution outside the repo is unverified

**What goes wrong:** `hooks/codepulse-hook.mjs`'s URL/key resolvers work because the hook script lives inside `codepulse/` and can find `.env.local` via a relative path from `__dirname`. The `~/.claude/skills/galdr/` skill has no such relative path back to this repo — it runs from an arbitrary CWD (any Claude Code session, any project).
**How to avoid:** The planner must pick and document an explicit resolution strategy — a real shell/user-level environment variable (set once, e.g. in the Windows user environment or the shell profile sourced by every session), or a skill-local `~/.claude/skills/galdr/.env` the script loads with an explicit absolute path. Do not port the relative-`.env.local` trick verbatim.
**Confidence:** This is flagged `[ASSUMED]` risk, not a confirmed defect — the exact resolution strategy is a planner decision, not something this research can settle without seeing how Larry's shell environment is actually configured (out of scope to probe `.env`/shell profile files per the standing "never read .env" rule).

## Code Examples

### `validateGaldrAuth` (extend `convex/ingestAuth.ts`)
```typescript
// Source: convex/ingestAuth.ts:76-85 (validateIngestAuth), copied structurally
export function validateGaldrAuth(request: Request): boolean {
  const expectedKey = _env.GALDR_API_KEY;
  if (!expectedKey) {
    return _env.GALDR_ALLOW_ANON === "true";
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```

### GET route registration (extend `convex/http.ts`) — no OPTIONS pair
```typescript
// Source pattern: convex/http.ts:37 (/health, the only other GET), deliberately
// WITHOUT the OPTIONS-pairing convention every other line in this file uses.
import { galdrPromptGet, galdrPromptPost } from "./galdrHttp";

http.route({ path: "/galdr/prompt", method: "GET", handler: galdrPromptGet });
http.route({ path: "/galdr/prompt", method: "POST", handler: galdrPromptPost });
// deliberately no OPTIONS route — D-04
```

### Test model for the new validator (extend `convex/__tests__/ingestAuth.test.ts`)
```typescript
// Source: convex/__tests__/ingestAuth.test.ts:10-61 — same 5-case shape
// (missing header / wrong key / correct key / fail-closed-no-key / anon opt-in)
// applied to validateGaldrAuth + GALDR_API_KEY / GALDR_ALLOW_ANON.
describe("galdr auth", () => {
  it("fails closed when no API key configured and no anon opt-in", () => {
    vi.stubEnv("GALDR_API_KEY", "");
    const req = new Request("http://localhost/galdr/prompt?slug=x", { method: "GET" });
    expect(validateGaldrAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });
  // ... 4 more cases mirroring the existing suite
});
```

## State of the Art

Not applicable in the "old approach → new approach" sense — this is a greenfield feature phase with no prior Galdr implementation to migrate from, and no framework/library version is changing. The one genuinely new-to-this-repo pattern is the unique-slug-via-transactional-check-then-insert (Architecture Pattern 4) — there is no "old approach" to contrast it with, since no prior table needed slug uniqueness.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `GALDR_API_KEY`/`CODEPULSE_URL` env resolution strategy for the out-of-repo skill script is undetermined — this research recommends a real environment variable or a skill-local `.env`, but does not confirm which Larry prefers or how his shell profile is currently structured. | Pitfall 4, Pattern 3 | Low — worst case the planner picks a reasonable default (shell env var) and it needs a one-line correction later; does not block any other part of the phase |

**If this table is empty:** N/A — one assumption logged above; everything else in this research is grounded in direct file:line reads of the live repo (auth validators, HTTP routes, retention module, schema conventions, deploy evidence from Phase 107-05, `recordSkillLaunch` behavior, skill directory contents).

## Open Questions

1. **Exact env-var resolution mechanism for the galdr skill script**
   - What we know: the pattern to copy (`hooks/codepulse-hook.mjs:187-232`) resolves `.env.local` relative to the hook's own location inside the repo.
   - What's unclear: the skill lives outside the repo at `~/.claude/skills/galdr/`, so that relative resolution cannot work unmodified.
   - Recommendation: planner decides between (a) a real shell/user environment variable set once outside any repo, or (b) a skill-local `~/.claude/skills/galdr/.env` loaded via an absolute path the script constructs from `os.homedir()`. Either is a small, contained decision — does not need a fresh research pass.

2. **Whether the skill's `usageCount` bump on injection reuses the same POST route as `/galdr-save`, or needs a third route**
   - What we know: design doc §4.1 says `/galdr <slug>` "injects into context, bumps usageCount" — implying a write happens after a successful fetch+resolve, distinct from `/galdr-save`'s "capture a new prompt" semantics.
   - What's unclear: whether this is a third, minimal route (e.g. `POST /galdr/prompt/bump-usage`) or an optional flag on the existing write route.
   - Recommendation: a third, narrow route (`{slug}` in, `{ok:true}` out, no body-changing side effects, so it does NOT append a `promptVersions` snapshot per D-15's "body-changing write" scope) keeps the write route's contract clean — bumping usage is not a body-changing write and must not trigger Pattern 5's version-append logic.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex self-hosted backend | New tables + HTTP routes | ✓ (confirmed running — Phase 107-05 deployed against it 2026-08-05, `docker inspect` continuity evidence) | per `convex-selfhost/` compose | — |
| Node.js (skill script runtime) | `~/.claude/skills/galdr/scripts/galdr-client.mjs` | ✓ (Claude Code's own runtime; `hooks/codepulse-hook.mjs` already runs as a Node script in the same environment) | — | — |
| git (force-add to claude-code-config) | D-07 skill install reaching the laptop | ✓ (already the mechanism for 9 other skills) | — | — |
| Playwright (e2e) | Nav registry / navigation smoke test | ✓ (`e2e/navigation.spec.ts` already exists as a model) | per `package.json` devDependencies | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (convex + React unit/integration), Playwright (e2e) |
| Config file | `package.json` scripts (`"test": "vitest"`); Convex tests colocated `convex/**/*.test.ts` and `convex/__tests__/*.test.ts`; React tests `src/**/*.test.tsx`; e2e `e2e/*.spec.ts` |
| Quick run command | `npx vitest run convex/__tests__/ingestAuth.test.ts convex/__tests__/galdr.test.ts` |
| Full suite command | `npx vitest run && npx tsc --noEmit` (add `npm run test:e2e` for the nav-registry smoke test before phase gate) |

### Phase Decisions → Test Map

(No `REQ-XX` IDs exist for this phase — see `<phase_requirements>` above. Rows keyed by decision ID.)

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-01, D-02 | `validateGaldrAuth` fails closed with no key; accepts correct Bearer key | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | ❌ Wave 0 — extend existing file with galdr cases |
| D-04 | `/galdr/prompt` responses carry no `Access-Control-Allow-Origin` header | unit/integration | `npx vitest run convex/__tests__/galdrHttp.test.ts` (assert header absence on a real `Response`) | ❌ Wave 0 |
| D-06 | Second `/galdr-save` with the same slug returns the existing prompt's title/updatedAt, does not overwrite | unit | `npx vitest run convex/__tests__/galdr.test.ts` (call `savePrompt` twice, assert `ConvexError` on the second, assert row count in `prompts` unchanged) | ❌ Wave 0 |
| D-09, D-10 | Skill refuses to inject with an unresolved variable named in the refusal message | manual (skill behavior is Claude Code reasoning, not a unit-testable function) — cover the underlying `galdr-client.mjs` variable-detection helper (regex `{{name}}` extraction) with a unit test | unit + manual | `npx vitest run` (if the detection regex is extracted as a pure function shared with the UI's own detector) + manual `/galdr <slug>` session with an unfilled variable | ❌ Wave 0 (extract shared pure function first) |
| D-11 | UI Copy button `disabled` until every variable is non-empty/non-whitespace | unit (React Testing Library) | `npx vitest run src/components/galdr/FillVariablesDialog.test.tsx` | ❌ Wave 0 |
| D-12 | Send-to-Chat only navigates after every variable is resolved; Chat.tsx auto-sends the resolved body, not a placeholder | e2e | `npx playwright test e2e/galdr-send-to-chat.spec.ts` (or extend `e2e/navigation.spec.ts`'s pattern) | ❌ Wave 0 |
| D-13 | `prompts` absent from `RETENTION_DAYS`, with an inline exemption comment | unit (static assertion) | `npx vitest run convex/retention.test.ts` (assert `"prompts" in RETENTION_DAYS === false`, and grep-assert the comment exists — or a simple string-contains check on the source) | ✅ `convex/retention.test.ts` exists — extend it |
| D-14 | Saving a 21st version for one prompt leaves exactly 20 rows for that `promptId` | unit | `npx vitest run convex/__tests__/galdr.test.ts` (insert 21 versions via repeated `savePrompt`, assert `promptVersions` count for that `promptId` == 20) | ❌ Wave 0 |
| D-15 | Restore appends a new version rather than mutating/deleting the restored one | unit | `npx vitest run convex/__tests__/galdr.test.ts` | ❌ Wave 0 |
| D-16 | Archiving sets `archived: true`, row excluded from `list`/skill lookup, `promptVersions` untouched | unit | `npx vitest run convex/__tests__/galdr.test.ts` | ❌ Wave 0 |
| Schema deploy | New tables reach the live self-hosted instance, not the cloud deployment | manual, evidence-gated (matches Phase 107-05's precedent — inline in the main session, not delegated) | `npx convex deploy` — assert CLI output contains `127.0.0.1:3210` and `Schema validation complete.` | ✅ established procedure, no new file needed |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed test file>` + `npx tsc --noEmit`
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green (`npx vitest run`, `npx tsc --noEmit`, `npm run test:e2e`) before `/gsd:verify-work`, plus the live gate from design doc §4.1: "a prompt saved from a Claude Code session on the desktop is retrievable by `/galdr` in a second session AND appears in the CodePulse UI; sending to Chat produces a real Ástríðr turn; version history shows the edit trail" — this is a manual, live-stack check (mirrors the ENGINE-05 "endpoint exists ≠ integration works" discipline this repo has already learned the hard way in Phase 108).

### Wave 0 Gaps
- [ ] `convex/__tests__/galdr.test.ts` — covers D-06, D-14, D-15, D-16 (slug collision, prune-on-write, restore-appends, archive semantics)
- [ ] `convex/__tests__/galdrHttp.test.ts` — covers D-04 (no CORS header), request/response shape for the two httpAction handlers
- [ ] Extend `convex/__tests__/ingestAuth.test.ts` — covers D-01/D-02 (5 new cases mirroring the existing 5)
- [ ] Extend `convex/retention.test.ts` — covers D-13 (assert `prompts` is NOT a `RETENTION_DAYS` key)
- [ ] `src/components/galdr/FillVariablesDialog.test.tsx` — covers D-11 (disabled-until-filled)
- [ ] `e2e/galdr-send-to-chat.spec.ts` (or extend `e2e/navigation.spec.ts`) — covers D-12 and the nav-registry entry landing correctly
- [ ] A shared pure function for `{{variable}}` detection, used by BOTH the skill script and the UI's drawer/dialog — currently no such extraction exists anywhere in the repo; without it, D-09/D-10's regex logic would be duplicated and could silently drift between skill and UI (contradicting CONTEXT.md's explicit "one contract, not two" framing for D-09–D-12)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Bearer-token comparison, fail-closed (`validateGaldrAuth`, copies `validateIngestAuth`'s proven shape) |
| V3 Session Management | No | Stateless bearer-token auth, no sessions on the agent/CLI surface; browser side already covered by existing Clerk session handling (out of this phase's scope) |
| V4 Access Control | Yes | No CORS/OPTIONS on `/galdr/prompt` (D-04) is itself the access-control boundary — a browser cannot call these routes even with a stolen key, since the fetch would be blocked by the browser's own CORS enforcement before the request reaches the missing-ACAO-header response |
| V5 Input Validation | Yes | Convex `v.*` validators on every mutation arg (`v.string()`, `v.optional(v.string())`, etc.) — same pattern used across all 40+ existing tables |
| V6 Cryptography | Partial | Bearer-token comparison uses plain `===`, not constant-time — matches the two existing validators exactly; this is a pre-existing, accepted repo-wide pattern (single-operator system, low realistic timing-attack surface over HTTPS to a self-hosted instance), not a new risk Galdr introduces. Not recommended to "fix" unilaterally in this phase — would create an inconsistency with the two siblings it's meant to mirror. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bearer key leaked via query string / server logs | Information Disclosure | The design doc and D-01 both specify the key travels in the `Authorization` header, never `?slug=`'s query string — verified this is the only param in the URL; keep it that way in implementation |
| A compromised `GALDR_API_KEY` reads/writes the entire prompt library (one key, no scoping) | Elevation of Privilege | Accepted risk per D-02 ("only holder is Larry's own CLI sessions... a read/write split buys little") — do not silently add scoping the decision explicitly rejected |
| Unresolved-variable body reaching a model (prompt injection via a half-filled template) | Tampering | D-09/D-10/D-11/D-12's refuse-on-unresolved contract is itself the mitigation — enforce it identically on skill and UI (the "one contract, not two" framing), since a divergence here is a security-relevant bug, not just a UX inconsistency |
| Rendering user-authored prompt body/preview as HTML | Tampering (stored XSS) | No existing table's free-text field is rendered via `dangerouslySetInnerHTML` anywhere in this repo (not verified exhaustively, but the pattern is absent from every component read during this research); render the prompt body/preview as plain text, not interpreted markdown/HTML (see Don't Hand-Roll table) |
| Convex self-hosted deploy landing on the wrong (cloud) deployment | Tampering / Denial of Service | Verify every schema-push CLI output for `127.0.0.1:3210` before trusting it — see Pitfall 3 |

## Sources

### Primary (HIGH confidence — direct file:line reads of this repo, same session)
- `.planning/phases/116-galdr-prompt-library/116-CONTEXT.md` — 16 locked decisions, canonical refs, code_context
- `.planning/phases/116-galdr-prompt-library/116-UI-SPEC.md` — checker-approved UI contract, revision 1
- `docs/proposals/2026-08-07-seidr-suite-design.md` §4.1, §2, §6
- `convex/ingestAuth.ts` — both existing validators, CORS allowlist logic
- `convex/http.ts` — all 56 routes, GET/OPTIONS pairing convention
- `convex/retention.ts` — `RETENTION_DAYS`, batch-cursor prune mechanics, header comments explaining prior incidents
- `convex/health.ts` — the only existing GET httpAction
- `convex/configVersionIngest.ts` — POST httpAction template
- `convex/registry.ts:678-691` — `recordSkillLaunch`'s no-op-safe-on-unmatched-name behavior
- `convex/schema.ts` — `archived` field convention (7 precedents), `promptSubmissions` naming-collision check, confirmed zero existing `slug` fields
- `convex/__tests__/ingestAuth.test.ts` — test shape to replicate
- `src/components/skills/RunTargetChooser.tsx`, `src/lib/skillRun.ts`, `src/pages/Chat.tsx:509-584` — `AutoSendHandoff` shape and the auto-send effect
- `src/lib/navRegistry.ts` — nav registration pattern
- `hooks/codepulse-hook.mjs:160-240` — env/`.env.local` resolution pattern
- `.planning/milestones/v13.0-phases/107-aggregates-rollup-sharding/107-05-SUMMARY.md` — live self-hosted deploy evidence and verification method
- `~/.claude/skills/{archive-repo,verify,wrap,webapp-testing}/SKILL.md` — skill authoring conventions, bundled-script pattern
- `CLAUDE.md` (repo root) — Self-Hosted Convex Operational Rules, tech stack, testing commands
- `.planning/REQUIREMENTS.md`, `.planning/config.json` — confirmed no REQ-IDs map to Phase 116; confirmed `nyquist_validation`/`security_enforcement` keys absent (both treated as enabled)

### Secondary / Tertiary
None used — every claim in this research traces to a direct read of this repo's own source or planning artifacts. No WebSearch/Context7 lookups were needed since this phase introduces zero new external libraries.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, confirmed by reading `package.json` and UI-SPEC's Registry Safety table
- Architecture (auth/HTTP/skill patterns): HIGH — every pattern is copied from a live, working precedent in this exact repo, cited by file:line
- Retention/versioning interaction: HIGH — read `convex/retention.ts` in full; the mechanism distinction (age-cutoff vs. count-cap) is structural, not speculative
- Skill env-resolution outside the repo: MEDIUM — the gap is real (flagged in Assumptions Log) but the fix is a small, contained planner decision, not a research unknown
- Security domain: HIGH for auth/access-control (mirrors audited existing code); MEDIUM for the "no XSS surface exists elsewhere" claim (not exhaustively verified across every component, stated as such)

**Research date:** 2026-08-10
**Valid until:** 30 days (stable, self-hosted internal repo; the one time-sensitive fact — the live Convex backend running at `127.0.0.1:3210`, continuity confirmed through 2026-08-05 — should be re-verified at execution time via the same CLI-output-assertion method, not assumed still true)
