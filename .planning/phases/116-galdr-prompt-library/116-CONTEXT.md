---
truths:
  - D-01 Galdr's read endpoint is GET /galdr/prompt guarded by a new GALDR_API_KEY validator
  - D-02 One galdr key authorizes both read and write
  - D-03 The galdr skill fails loudly when Convex is unreachable and keeps no local cache
  - D-04 The galdr HTTP routes are agent/CLI only with no CORS and no OPTIONS handler
  - D-05 A fuzzy lookup match never auto-injects; it lists candidates and waits for a pick
  - D-06 A slug collision on save is refused with the existing prompt shown, never overwritten
  - D-07 The skill installs once to ~/.claude/skills/galdr/ and is force-added to the config repo
  - D-08 The skill surface is fetch, fill, inject, bump usage, plus galdr-save
  - D-09 Variables resolve from args first, then the skill asks for the remaining gaps
  - D-10 An unresolved variable blocks injection rather than reaching the model
  - D-11 The UI Copy action stays disabled until every variable has a value
  - D-12 Send-to-Chat resolves variables before the autoSend handoff fires
  - D-13 The prompts table is exempt from RETENTION_DAYS with the reason documented in place
  - D-14 promptVersions is bounded by newest-N-per-prompt, pruned on write
  - D-15 Every body-changing write appends one promptVersions snapshot
  - D-16 Deleting a prompt archives it; there is no hard delete in this phase
---

# Phase 116: Galdr Prompt Library - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Galdr is a Convex-spined prompt library usable from every surface Larry already works in.

**In scope:**
- `prompts` + `promptVersions` Convex tables (design doc §4.1 field lists are the starting shape, not a frozen spec).
- A `/galdr` page in CodePulse's `COMMAND` nav group — searchable card grid, category chips, favorites, usage sort, editor drawer with variable detection, preview, and version history.
- Claude Code skills `/galdr` (live fetch, fill, inject, bump usage) and `/galdr-save` (capture a prompt back to the DB).
- The HTTP endpoints those skills call.
- Send-to-Chat and clipboard copy, both with variable fill-in.

**Out of scope — belongs elsewhere, do not build here:**
- **Forge prompt-picker in the session composer.** Deferred by design (§4.1, §6) — it needs Forge Phase 23's WS-attach + stdin write. Tracked in forge's ROADMAP "Queued (post-v4.0)". Galdr does not wait for it and must not stub it.
- **Ástríðr's `galdr_lookup` tool.** Seeded as astridr SEED-028 for v29. This phase ships nothing inside astridr-repo.
- **The other three Seiðr surfaces** — Bifröst (117), Studio (118), Loom (119) — are independent phases.
- **Any v15.0 "Borealis" UI overhaul pieces.** SEED-005 holds the overhaul for v15.0; this phase uses current design-system tokens only.

</domain>

<decisions>
## Implementation Decisions

### Read-endpoint auth

- **D-01:** The skill reads via `GET /galdr/prompt?slug=…`, guarded by a **new** `GALDR_API_KEY` validator added alongside `validateIngestAuth` / `validateForgeIngestAuth` in `convex/ingestAuth.ts`. This is CodePulse's first authenticated *read* endpoint — of 56 routes in `convex/http.ts`, `/health` (line 37) is the only existing GET and every other route is write-ingest. The new validator MUST fail closed exactly like its two siblings (`ingestAuth.ts:76-85`, `96-105`): missing key ⇒ deny unless an explicit `GALDR_ALLOW_ANON=true` opt-in is set. Rationale for a separate key over reusing `ASTRIDR_INGEST_API_KEY`: that key is write-only-telemetry today, and reusing it would widen a leaked-key blast radius to include reading the prompt library.
- **D-02:** One `GALDR_API_KEY` authorizes both the read and the writes (`/galdr-save`, `usageCount` bump). The only holders are Larry's own CLI sessions, so a read/write split buys little against the cost of syncing two secrets across `.claude`, `.claude-alt`, and the laptop.
- **D-03:** When Convex is unreachable the skill **fails loudly and keeps no local cache.** This is load-bearing, not incidental: the whole live-fetch design exists so there is never a second, stale copy of a prompt body (§4.1 "zero sync"). A cache would reintroduce exactly the sync problem the design rejected. Losing `/galdr` while the backend is down is the accepted cost.
- **D-04:** The `/galdr` HTTP routes are **agent/CLI only** — no CORS headers, no `OPTIONS` handler, no allowlist entry, deliberately unlike the 20+ ingest route pairs in `convex/http.ts`. Browser writes go through the existing Clerk-authed Convex mutation path (design doc §3 auth note), so the UI never needs these routes. A planner that "helpfully" adds the OPTIONS pairing for consistency is contradicting this decision.

### Lookup & save semantics

- **D-05:** When `/galdr <search terms>` matches more than one prompt, the skill **lists the candidates (title, category, usage count) and waits for an explicit pick.** It never auto-injects on a fuzzy match. Reason: an injected wrong prompt is indistinguishable from a right one until the output is already wrong.
- **D-06:** When `/galdr-save <title>` produces an existing slug, the server **refuses** and returns the existing prompt's title and `updatedAt`. Nothing is silently overwritten and nothing is silently auto-suffixed. Updating an existing prompt must be an explicit, separate act.
- **D-07:** The skill installs **once** to `~/.claude/skills/galdr/`. Verified during discussion: `C:\Users\mandr\.claude-alt\skills` is a **Junction** to `C:\Users\mandr\.claude\skills`, so both config roots are covered by that single install — do not create a second copy, it would be the same directory. Reaching the **laptop** is a separate, explicit act: `.gitignore:72` in the `claude-code-config` repo (`C:\Users\mandr\.claude`) ignores `skills/` wholesale — 131 skill dirs on disk, exactly 9 force-added and tracked — so galdr requires `git add -f skills/galdr/SKILL.md`, matching the precedent of `archive-repo`, `wrap`, `verify`, and the other six.
- **D-08:** Skill surface is exactly design doc §4.1: bare `/galdr` lists categories + favorites; `/galdr <slug>` fetches, resolves variables, injects, and bumps `usageCount`; `/galdr-save <title>` captures back. No extra `--category` / `--recent` / `--favorites` flag surface in this phase.

### Variable fill-in contract

*(These four are one contract, not four independent choices: a prompt behaves identically on every surface, and a half-filled body never reaches a model.)*

- **D-09:** The skill resolves `{{variables}}` from **args first, then asks for the gaps** — `/galdr competitor-analysis company=Acme` fills what it can and prompts only for what remains. It does not infer values from surrounding conversation context.
- **D-10:** An unresolved variable at injection time causes the skill to **refuse to inject**, naming the missing variables. It does not inject literal `{{name}}` placeholders and does not substitute empty strings.
- **D-11:** In the CodePulse Copy dialog, **Copy stays disabled until every variable has a value** — the same rule as D-10, so behaviour does not diverge between skill and UI.
- **D-12:** Send-to-Chat **resolves variables first**, then hands the fully-filled body to the existing autoSend handoff. Ástríðr never receives a placeholder. Note for the planner: that handoff **auto-sends** on arrival (`src/components/skills/RunTargetChooser.tsx:86-94` → consumed at `src/pages/Chat.tsx:517`), so an unresolved body would be answered before anyone could correct it — this is why resolution must happen on the Galdr side of the handoff, not after it.

### Versioning & retention

- **D-13:** The `prompts` table is **exempt from `RETENTION_DAYS`, with the reason documented in place.** Every other new table in this repo has been bounded pre-emptively (`gatewayQuotaSnapshots: 30` per Phase 104 D-20, `toolPolicyEvents: 90` per Phase 105 D-05, both Phase 108 engine-axis tables per D-10) and the comments in `convex/retention.ts` are explicit that this is a standing rule. That rule was written for **firehoses**; a curated prompt library is its opposite, and a 90-day window would silently delete a prompt simply because it went a quarter unused. **The exemption must carry an inline comment saying so** — otherwise the next retention audit reads an unbounded table as an oversight and "fixes" it.
- **D-14:** `promptVersions` — the table that actually grows — is bounded by **newest-N-per-prompt (~20), pruned on write.** This bounds by the real growth driver (edit frequency) instead of by age: a prompt edited 40 times this week would otherwise keep all 40 while a year-old prompt loses its entire trail. N is a tunable constant, not a magic number scattered through call sites.
- **D-15:** **Every body-changing write appends one snapshot** — UI save, `/galdr-save` update, and restore alike. Restore appends a new version rather than rewinding, so the trail is append-only and complete.
- **D-16:** Deleting a prompt **sets `archived: true`** — hidden from the grid and from skill lookup, versions retained. No hard delete and no purge action in this phase, consistent with the standing "archive, don't `rm`" rule applied to skills and the vault.

### Claude's Discretion

The planner decides these; no user preference was expressed and none of them change the phase's shape:

- **Category model** — a plain `category` string field on `prompts` versus a separate categories table with overrides. Note the Skills page uses the heavier pattern (`api.skillCategories.getSkillsWithOverrides`, `listCategories` — `src/pages/Skills.tsx:78-79`); matching it buys consistency, a plain field buys simplicity. Pick one and say why.
- **`usageCount` semantics** — whether a bare `/galdr` listing, or a UI Copy, counts as a use, or only an actual injection does. Whatever is chosen, it must be stated in the schema comment so the number means one specific thing.
- **Nav placement and Lucide icon** for `/galdr` within the `COMMAND` group (`src/lib/navRegistry.ts:118-128`).
- **Seeding** — whether to ship any starter prompts or begin empty.
- **Naming hygiene** — an unrelated `promptSubmissions` table already exists (`convex/schema.ts:651`, hook telemetry). Keep `prompts`/`promptVersions` clearly distinct in module names, hook names, and comments so a future reader does not conflate them.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth (read first)

- `docs/proposals/2026-08-07-seidr-suite-design.md` §4.1 — the Galdr design: schema field lists, UI shape, the Claude Code integration, and the phase gate. §2 carries the suite-wide locked decisions (CodePulse is home; no donor code; ASCII slugs); §6 carries the constraints (Forge deferral, secrets stay out of Convex).
- `.planning/seeds/SEED-005-seidr-suite.md` — seed of record for phases 116-119, including the cross-repo stubs and the v15.0 UI-overhaul hold.
- `.planning/ROADMAP.md:664, 669` — the phase's one-line scope and the note that 116-119 are independent of everything despite the auto-generated "Depends on: Phase 115" line in the stub at `:826-834`.

### Auth and HTTP surface

- `convex/ingestAuth.ts:59-116` — `getCorsHeaders`, `validateIngestAuth`, `validateForgeIngestAuth`, `unauthorizedResponse`. The two validators are the fail-closed pattern D-01's new `GALDR_API_KEY` validator must copy.
- `convex/http.ts:34-91` — all 56 routes. Establishes both the POST-ingest + OPTIONS pairing convention *and* that `/health:37` is the sole GET, which is why D-01/D-04 are deliberate departures rather than oversights.

### UI reuse

- `src/pages/Skills.tsx` (820 lines; state at :52-103) — the UX donor named in design doc §4.1 "clone the Skills page UX": search, chips, categories, favorites, drawer editing.
- `src/components/skills/RunTargetChooser.tsx:86-94` — the send-to-Chat handoff Galdr reuses; note it auto-sends.
- `src/pages/Chat.tsx:509-517` — the consuming side (`location.state?.autoSend`), including the `firedRef` guard.
- `src/lib/navRegistry.ts:118-128` — the `COMMAND` nav group Galdr joins. Per repo CLAUDE.md, add nav entries here, never in `DashboardLayout.tsx`.

### Retention

- `convex/retention.ts` — `RETENTION_DAYS` and the batch-capped prune. Its inline comments record why each new table was bounded pre-emptively; D-13's exemption is an argued exception to that rule and must be documented as one.

### Standing repo rules

- `CLAUDE.md` (repo root) — "Self-Hosted Convex — Operational Rules": no bulk deletes or mass mutations on the live instance. D-14's prune-on-write must stay incremental and never sweep.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`RunTargetChooser` → `Chat` handoff** (`RunTargetChooser.tsx:86-94`, `Chat.tsx:517`): send-to-Chat is already built and proven; Galdr supplies a resolved body and reuses it rather than inventing a second handoff shape.
- **`convex/ingestAuth.ts` validators**: two working fail-closed bearer validators to copy verbatim in structure for `GALDR_API_KEY`.
- **`src/pages/Skills.tsx` + `src/components/skills/*`**: a complete worked example of the grid/chips/favorites/drawer UX, plus `DeleteSkillDialog` as the type-to-confirm precedent if a purge is ever added later (it is not in this phase — D-16).
- **`convex/retention.ts`**: existing batch-capped prune machinery; D-14's per-prompt cap should not fight it.

### Established Patterns

- **Clean build slot, verified.** `prompts` / `promptVersions` do not exist in `convex/schema.ts` — confirmed with a control that found `sessions:47`, `aggregates:953`, `subagentJobs:1028`, `controlVerbSwaps:2093` by the same pattern, so the negative is real and not a mis-spelled search. The only near-neighbour is the unrelated `promptSubmissions:651`.
- **New tables get bounded before they grow** — the rule D-13 argues an exception to and D-14 honours by a different mechanism.
- **Nav lives in the registry**, consumed by both `DashboardLayout` and `CommandPalette` (repo CLAUDE.md, Phase 96 WR-02).

### Integration Points

- `convex/schema.ts` — two new tables.
- `convex/http.ts` + `convex/ingestAuth.ts` — new routes and a new validator.
- `src/lib/navRegistry.ts` + `src/App.tsx` — new route and nav entry.
- `~/.claude/skills/galdr/SKILL.md` — outside the repo; reaches the laptop only via `git add -f` in the `claude-code-config` repo (D-07).
- `hooks/codepulse-hook.mjs:188-220` — the precedent for how a Node-side helper resolves the CodePulse URL and an ingest key from env/.env, if the skill needs the same resolution shape.

</code_context>

<specifics>
## Specific Ideas

- **"Clone the Skills page UX"** is Larry's own framing from the design doc — the visual and interaction target is the existing `/skills` page, not a new pattern.
- **The unfilled-variable rule is a hard stop on purpose.** The failure it prevents is a confidently-wrong output from a half-filled prompt, which reads as intentional work and is expensive to catch downstream.
- **The exemption comment on `prompts` is a deliverable, not a nicety** (D-13) — its absence is what would cause a future audit to break the feature.

</specifics>

<deferred>
## Deferred Ideas

- **Forge prompt-picker in the session composer** — needs Forge Phase 23 (WS attach + stdin write). Already tracked in forge's ROADMAP "Queued (post-v4.0)". Not stubbed here.
- **Ástríðr `galdr_lookup` tool** — astridr SEED-028, v29.
- **Richer skill flags** (`--category`, `--recent`, `--favorites`) — rejected for this phase's scope (D-08); revisit if the bare listing proves insufficient in use.
- **Hard delete / purge for prompts** — D-16 ships archive-only; a type-to-confirm purge (the `DeleteSkillDialog` pattern) is a later addition if archived rows ever become a problem.
- **Separate read vs write keys** — considered and rejected for now (D-02); revisit if the galdr key ever leaves Larry's own machines.

</deferred>

---

*Phase: 116-galdr-prompt-library*
*Context gathered: 2026-08-08*
