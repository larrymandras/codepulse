# Phase 113: Debt Sweep - Research

**Researched:** 2026-08-11
**Domain:** Vitest/Testing-Library internals (DEBT-06), Convex mutation/producer-consumer contract (DEBT-05), git/ops bootstrap for a self-hosted Convex sidecar (DEBT-07)
**Confidence:** HIGH — every claim below was verified live against this exact repo/environment in this session (deliberately-failing controls, read-only Convex queries, `du`/`git status`/`Get-ScheduledTask` probes), not inferred from training data or docs alone.

## Summary

This phase closes three independent tech-debt items. Research this session ran live, deliberately-failing controls for all three — not just read the code — because CONTEXT.md's own D-08 explicitly required it for DEBT-06, and the same discipline paid off on DEBT-05 and DEBT-07 too.

**DEBT-06** is now fully de-risked at the mechanics level: a control proves Vitest 4.1.9 DOES print the actual `textContent` in its `Received:` line on a `toBe` failure (D-08's core assumption is TRUE — the original failure's diagnostic value was in fact captured by Vitest and simply not retained by whoever saw it). A second control found something CONTEXT.md's D-08 did NOT anticipate and that changes the instrumentation design: `onTestFailed` fires **after** `@testing-library/react`'s auto-`afterEach(cleanup)` has already unmounted the DOM (proven both by reading the Vitest runner's own source and by an empirical control showing `document.body.innerHTML` is empty inside a global `onTestFailed`). A DOM-dump hook registered the way D-08 describes (globally, via `onTestFailed`) will only ever see an empty page. The fix is mechanical (capture inside a try/catch around the specific query, not via a global post-cleanup hook) but it is a real design point the plan must get right, or the "capture" deliverable will silently capture nothing.

**DEBT-05**'s wire-level finding is the most consequential thing found this session: `scannedOrigins` is **not currently sent by either producer** (grepped `hooks/scanner.mjs`'s `snapshot` object — no such field; grepped astridr's `bridge.py` payload builder — no such field either). Today the system runs exclusively on the legacy path (`sanitizeScannedOrigins` always receives `undefined`), which is the literal mechanism behind the 185→131→185 bug: a partial plugin-cache read still leaves the `claude-code` origin "present" in the incoming snapshot, so the legacy rule ("origin present → fully prunable") deletes every plugin skill absent from that partial read. D-03's manifest extension is therefore not incremental — it requires wiring `scannedOrigins` onto the wire for the first time. Separately, and more importantly for the plan's blast radius: **D-02's proposed new origin string (`claude-code:plugin`) has at least 6 hardcoded `origin === "claude-code"` call sites in frontend code** (`src/lib/skills.ts`, `src/pages/Skills.tsx`, `src/components/skills/SkillLifecycleMenu.tsx`) that classify scope/drag-drop/labels. Split the origin without touching these and ~57 plugin skills silently vanish from the Skills page's "Global" tab/count and lose working drag-and-drop — a real, visible regression in a phase whose stated boundary is "no UI work." This needs an explicit planning decision (see Open Questions).

**DEBT-07** confirms every D-12/D-13/D-15 factual claim (not a git repo, codepulse is PUBLIC, exact `du -sh` sizes) and surfaces one thing CONTEXT.md's D-14 did not cover: `docker-compose.yml` (D-13's explicit committed-scope file) hardcodes the live `INSTANCE_SECRET` value inline as a literal string in the `environment:` block — it is not sourced from `selfhosted.envfile` or any `${VAR}` substitution. Committing `docker-compose.yml` as-is, even to a private repo, puts a live secret in version control, which contradicts this project's own "never commit credentials" rule regardless of repo visibility. This must be parameterized before commit.

**Primary recommendation:** Plan DEBT-05 as two waves — (1) producer + server guard + migration (the CONTEXT.md-scoped work) and (2) the ~6-site frontend origin-classification fix, made a required task, not an afterthought. Plan DEBT-06 to capture diagnostics via a try/catch at the assertion site (or an equivalent pre-cleanup capture), not a naive global `onTestFailed`, and budget the soak at 30 full-suite iterations (~19 min) as the first checkpoint, extensible to 50 (~32 min) before invoking D-10's GUARDED exit bar. Plan DEBT-07 to parameterize `INSTANCE_SECRET` via `env_file:`/`${VAR}` substitution as part of the D-14 secrets work, before the first commit — not after.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Skill-catalog coverage declaration (D-01/D-03) | API/Backend (Convex `skillSync.ts`/`registry.ts`) | Producer script (`hooks/skillScan.mjs`, Node CLI, not a browser tier) | The guard is a pure function reused by two mutations; the producer is an out-of-browser Node script run by a Claude Code hook, not part of the SPA |
| Plugin/global skill origin split (D-02) | API/Backend (schema/origin taxonomy) | Browser/Client (`src/lib/skills.ts`, `src/pages/Skills.tsx`, `src/components/skills/SkillLifecycleMenu.tsx`) | The origin string is a backend-modeled value, but three frontend files branch on its literal value for scope/UI classification — a backend-only fix silently breaks client-tier behavior (see DEBT-05 findings below) |
| Refusal visibility (D-05) | API/Backend (`alerts` table write) | — | Reuses an existing table + existing consuming surface; no new tier touched |
| Existing-row re-origin migration (D-04) | API/Backend (`convex/migrations.ts` batch pattern) | — | Read-only census + batch-capped internal mutation, standard Convex ops pattern already established in this repo |
| Chat brain-pill flake capture (DEBT-06) | Browser/Client (Vitest/jsdom test environment, not the app's runtime tiers) | — | Purely a test-infrastructure concern; no production code tier is implicated unless a real bug is found |
| `convex-selfhost` version control (DEBT-07) | Outside all four app tiers — infrastructure/ops | — | A brand-new, separate private git repo for compose + scripts; explicitly touches no codepulse source per CONTEXT.md D-12 |

## Project Constraints (from CLAUDE.md)

- **Self-hosted Convex operational rules are binding on any DEBT-05 work that reads/writes the live backend during planning or execution:** never `npx convex import --replace-all` against the live instance; never bulk-delete/bulk-patch a large table (D-04's migration must stay batch-capped, `BATCH_SIZE = 500`, matching the existing `convex/migrations.ts` pattern); a dashboard-wide "no data" symptom is index rot/memory starvation until proven otherwise, not a reason to touch frontend code first.
- `ConvexNightlyRestart` and its restart/soak scripts (DEBT-07's subject matter) are deliberate, health-gated mitigations for a known unresolved memory-growth issue — DEBT-07 must not change their behavior, only bring them under version control as-is.
- Ástríðr API calls require `Authorization: Bearer` via `VITE_ASTRIDR_API_KEY` — not relevant to any of the three DEBT items directly, noted for completeness since it's a blanket project rule.
- `.env` files (`.env.local`, `selfhosted.envfile`, `admin-key.txt`) must never be read, written, or dumped by Claude Code, ever, at any confidence level. This research complied: `docker-compose.yml`'s hardcoded secret was discovered via a file that is NOT `.env`-shaped (it's a compose file, not blocked by the guard) and is reported here without repeating the literal value.
- Never use `--no-verify`/bypass hooks without explicit ask (project-wide git rule) — relevant to DEBT-07's first commit into the new repo.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DEBT-05 — prune-safety policy**
- D-01: Guard on BOTH sides — producer AND server. Neither alone is sufficient.
- D-02: Plugin skills move to their own origin (e.g. `claude-code:plugin` — a suggestion, not a lock). Today `collectClaudeCodeSkills` emits both the global skills dir and every plugin's skills under the single `claude-code` origin.
- D-03: The guard shape is an EXPLICIT COVERAGE DECLARATION, not a magnitude threshold. Extend the existing `scannedOrigins` manifest so the producer positively declares each source it actually read; an origin is prunable only when declared.
- D-04: Existing rows are re-originned by a one-shot, batch-capped migration derived from each row's stored `source`. Live counts (re-verified this session, see DEBT-05 below): 701 rows total — `claude-code`=188, `claude-code:available`=80, `native`=205, `bridge`=205, plus five `claude-code:project:*` origins (19,1,1,1,1). Migration must follow `convex/migrations.ts`'s existing `BATCH_SIZE = 500` pattern.

**DEBT-05 — refusal visibility**
- D-05: A refused prune writes an `alerts` row (existing table, dedicated `source` value).
- D-06: Refusals only — no per-scan coverage log.
- D-07: A failed sub-source read still emits — it just doesn't declare that source covered. Rest of the snapshot stays current.

**DEBT-06 — flake capture**
- D-08: Capture = retained soak output AND failure-time DOM instrumentation. The failing assertion is `expect(labelBefore).toBe("anthropic-sonnet-5")` at `src/pages/Chat.test.tsx:585-586`. Research must confirm with a deliberately-failing control before planning depends on it (**done — see DEBT-06 below**).
- D-09: Soak the FULL SUITE, repeated — not the file in isolation (already passes alone).
- D-10: Exit bar — if it does not reproduce within budget, ship the instrumentation and close as GUARDED. Requires amending DEBT-06's REQUIREMENTS.md wording if this branch is taken.
- D-11: A widened `waitFor` remains forbidden, and so is any assertion reshaping that makes it structurally unable to observe the defect.

**DEBT-07 — convex-selfhost under version control**
- D-12: Its own PRIVATE repo, `git init` in place at `C:\Users\mandr\convex-selfhost` (confirmed not currently a git repo; codepulse confirmed PUBLIC).
- D-13: Committed scope = compose + all scripts + a bootstrap README (`docker-compose.yml`, `docker-compose.standby.yml`, every `*.ps1`, `run-restart-hidden.vbs`, README documenting prerequisites/volumes/scheduled tasks/ignored-secret contents).
- D-14: Secrets are `.gitignore`d with committed key-name-only `.example` templates. Template must be built from documented key names — never by reading/dumping the live env file.
- D-15: Ignore set also excludes bulk/volatile content: `backups/` (22 GB), `migration/` (1.5 GB), `rebuild/` (721 MB), `forensics/` (868 KB), all `*.log`, `*.bak`, `soak-watch.state.json`, `canary-body.json`.
- D-16: "Reproducible from a fresh checkout" is proven by cloning to a temp path and running a checked-in preflight script — without starting a second Convex backend.

### Claude's Discretion
- Plan decomposition and sequencing across the three items (independent; wave structure is the planner's call).
- The exact new origin string for plugin skills (`claude-code:plugin` is a suggestion) and the exact `alerts.source` value.
- The soak iteration budget for D-09/D-10 (**research recommendation: 30 iterations first checkpoint, 50 as extension — see DEBT-06 below**).
- The precise shape of the coverage-declaration payload extension to `scannedOrigins`.

### Deferred Ideas (OUT OF SCOPE)
- Seiðr e2e flakiness (`galdr`/`bifrost`/`loom` under full-suite parallel load) — same class as DEBT-06, different instance, cause already understood, fix is a repo-wide Playwright config change. Not this phase.
- `diagnosis-*.md` and `health-report.md` in `convex-selfhost/` — deliberately left out of DEBT-07's initial commit scope.
- `e2e/theme-contrast.spec.ts` (20 failures, SEED-006) and `e2e/command-center-breakpoints.spec.ts` (3 failures, owned by in-flight Phase 111) — pre-existing, not this phase's, not regressions.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-05 | A transient scan that misses part of the skill catalog no longer prunes live skill rows. | Confirmed root mechanism live (legacy-path-only, `scannedOrigins` absent from both producers' wire payloads today); confirmed both prune call sites are structurally identical (one shared guard covers both); confirmed live origin census via read-only query; confirmed exact plugin-vs-personal split (57/131) within `claude-code` origin; **discovered and evidenced a required frontend companion fix** (6 call sites across 3 files) that CONTEXT.md's D-02 does not mention. |
| DEBT-06 | The intermittent `Chat.test.tsx` brain-pill failure is deterministic, root-caused from a captured failure, never masked by a widened `waitFor`. | Ran the D-08-mandated deliberately-failing control at the exact assertion site (`Chat.test.tsx:585-586`) — confirmed Vitest 4.1.9 prints the actual `textContent` in `Received:`. Ran a second control proving `getByTestId`/`findByTestId` (Testing Library DOM 10.4.1) throws (does not silently return-first) on multiple matches. **Discovered and evidenced** that `onTestFailed` fires after `@testing-library/react`'s auto-cleanup unmounts the DOM — changes D-08's instrumentation design. Measured full-suite wall-clock (38s) and confirmed CLI mechanics for D-09's soak (no `--repeat` flag; per-test `repeats` option is the wrong tool; `--sequence.shuffle` defaults false). |
| DEBT-07 | `convex-selfhost/`'s compose `logging:` block and restart scripts are under version control, reproducible from a fresh checkout. | Confirmed D-12/D-13/D-15's factual claims live (`git status`, `gh repo view`, `du -sh`, directory listing). Enumerated the real file scope (9 `*.ps1` files, not an assumed count). Confirmed the 7 live Scheduled Tasks and their exact invocation chains, surfacing an undocumented external dependency (`C:\Users\mandr\scripts\run-hidden.vbs`). **Discovered and evidenced** a hardcoded live secret in `docker-compose.yml` itself, outside D-14's originally-scoped secret files. Confirmed the two official Convex self-hosted env var names for D-14's `.example` template via an official source. |
</phase_requirements>

---

## DEBT-05 — Skill Prune Churn

### The wire-level truth (why the bug happens, verified end to end)

**`scannedOrigins` is not sent by either producer today.** `hooks/scanner.mjs:26-35` constructs the `/scan` POST body:

```js
const snapshot = {
  sessionId, scannedAt: Math.floor(Date.now() / 1000),
  mcpServers: [], hooks: [], plugins: [], skills: [], agents: [], slashCommands: [],
};
```

No `scannedOrigins` key exists anywhere in `scanner.mjs` [VERIFIED: grep of `hooks/scanner.mjs` for the string `scannedOrigins` returns zero hits]. Astridr's `capability_sync` payload builder (`astridr-repo/astridr/engine/bootstrap/bridge.py`, `_build_capability_sync_payload`, lines ~112-149) similarly builds `{"mcpServers": ..., "skills": ..., "hooks": ..., "plugins": ..., "slashCommands": ...}` with no `scannedOrigins` field [VERIFIED: grep of `bridge.py` for `scannedOrigins` returns zero hits]. Note: `bridge.py`'s origin-tagging uses the literal strings `"cc"`/`"bridge"`/`"native"`/`"host"`, which does not match the `"native"`/`"bridge"` origins actually observed in the live `skills` table below — astridr likely has a different/newer emitter than the one I located in a 5-minute grep of `astridr-repo`; treat astridr's exact current producer code as **UNVERIFIED** (out of this phase's repo anyway) and rely instead on the server-side guard being producer-agnostic, which D-01 already requires.

On the server, `convex/skillSync.ts:74-76`:
```ts
if (scannedOrigins) {
  for (const o of scannedOrigins) prunableOrigins.add(normalizeOrigin(o));
}
```
Since `scannedOrigins` is always `undefined` today, this branch never executes, and `sanitizeScannedOrigins(snap.scannedOrigins)` (`convex/registry.ts:182,350`) always returns `undefined`. **The system runs exclusively on the legacy path today**: `prunableOrigins = incomingByOrigin.keys()` (`skillSync.ts:73`) — any origin with ANY incoming skill is fully prunable for that origin, including skills absent from the partial read. This is the exact mechanism of the 185→131→185 bug: `collectClaudeCodeSkills` (`hooks/skillScan.mjs:134-141`) emits both the personal skills dir AND every plugin's skills under the single `"claude-code"` origin (`readSkillDir(globalDir, "claude-code", acc)` at :137; plugin fallback at :139-141 uses the same `"claude-code"` string). When `readInstalledPluginSkills` returns `false` (unusable/missing manifest, `skillScan.mjs:86-109`) and `walkPluginCache`'s fallback also under-reads (silent `existsSync`/`readdirSync` failures, `:111-124`), the incoming snapshot still contains SOME `claude-code`-origin rows (the personal skills that read fine) — so origin `"claude-code"` is "present," and every plugin skill absent from that partial read gets deleted by `computeSkillPrunes` (`skillSync.ts:79-84`).

**D-03's fix is therefore not additive to something half-working — it is standing up the manifest mechanism on the wire for the first time.** The plan must include a producer-side change to `scanner.mjs` (add `snapshot.scannedOrigins = [...]`) in addition to the `skillScan.mjs` collection changes, or D-03's server guard has nothing to read from CodePulse's own scanner.

### Both prune call sites are identical — one guard covers both [VERIFIED]

`convex/registry.ts:182-197` (inside `syncInventory`, called from `/scan` → `convex/scan.ts:23`) and `convex/registry.ts:350-365` (inside `syncFullInventory`, called from `convex/runtimeIngest.ts:1156` on the `capability_sync` runtime event) are byte-for-byte identical in their guard/prune logic:
```ts
const scannedOrigins = sanitizeScannedOrigins(snap.scannedOrigins);
if (snap.skills.length > 0 || (scannedOrigins !== undefined && scannedOrigins.length > 0)) {
  for (const row of computeSkillPrunes(existingSkills, snap.skills, scannedOrigins)) {
    await ctx.db.delete(row._id);
    await ctx.db.insert("configChanges", { ... changedBy: "scanner" | "capability_sync" ... });
  }
}
```
The only difference is the `changedBy` audit-trail string. A single shared guard/prune helper trivially serves both; a fix landing on only one (e.g. `syncInventory` but not `syncFullInventory`) is the "classic half-fix in this codebase" CONTEXT.md already warns about, and is now confirmed structurally easy to avoid (same pure function, same inputs).

### Live data census — read-only, re-verified this session [VERIFIED]

Ran `npx convex run migrations:listSkillOrigins` (public read-only `internalQuery`, no `--push`, no mutation) against the live self-hosted backend:

```
total: 701
native                          205  sample: /home/astridr/.claude/skills/article-extractor
bridge                           205  sample: claude_skill
claude-code                      188  sample: C:\Users\mandr\.claude\skills\article-extractor\SKILL.md
claude-code:available             80  sample: C:\Users\mandr\.claude\skills-available\artifacts-builder\SKILL.md
claude-code:project:1fa1797dd9db  19
claude-code:project:789c222cb6b9   1
claude-code:project:a3dd52ddc6ab   1
claude-code:project:5b1caabbdf8f   1
claude-code:project:35dcd75e840a   1
```
Exactly matches CONTEXT.md's D-04 figures (701 total, 188/80/205/205/19+1+1+1+1) — **zero drift**, independently re-derived.

**New this session:** called `npx convex run registry:listSkills` (public read-only query, full table dump) and computed the plugin/personal split within the `claude-code` origin client-side:
```
claude-code origin rows: 188
  plugin-sourced (source matches .claude\plugins\):  57
  non-plugin / personal (~/.claude/skills/):         131
  rows with no string source: 0
```
57 vs the "~56" cited throughout CONTEXT.md — consistent within normal catalog drift (a plugin update between when CONTEXT.md was written and this research ran). **All 188 rows are unambiguously classifiable** (no row lacks a `source`), so D-04's migration has a clean, deterministic split to work from. As a sanity check, 54 rows in the separate `native` origin ALSO have plugin-cache-shaped source paths (`/home/astridr/.claude/plugins/cache/...`) — these belong to astridr's own container and are structurally unrelated to `claude-code`'s single-origin bug (astridr's `native` origin isn't split the same way `collectClaudeCodeSkills` splits `claude-code`), so D-04's migration should filter strictly on `origin === "claude-code"`, not on the source-path pattern alone.

### The finding CONTEXT.md doesn't cover: frontend origin-string coupling [VERIFIED — this is the highest-value finding of this research]

Six call sites across three frontend files hardcode the literal string `"claude-code"` to mean "the active/global scope":

| File:line | Code | Effect if `claude-code:plugin` ships and this isn't updated |
|---|---|---|
| `src/lib/skills.ts:69` | `moveDestinationIsProject: activeOrigin === "claude-code"` | Plugin skills never resolve `moveDestinationIsProject` correctly |
| `src/lib/skills.ts:125,131` | `const isActiveGlobal = activeOrigin === "claude-code";` ... `sourceOrigin: "claude-code"` | Plugin skills fail `isActiveGlobal`, fall through to the "unrecognized origin" branch (`skills.ts:142-144`) which returns `{ kind: "noop" }` for **every** drag-drop target — plugin skills become undraggable in the Skills UI |
| `src/lib/skills.ts:165` | `if (origin === "claude-code") return "Claude Code";` (`originLabel`) | Plugin skills render their raw origin string (`"claude-code:plugin"`) instead of a human label in the origin `<select>` |
| `src/pages/Skills.tsx:132` | `case "global": return base.filter((s) => (s.origins ?? []).includes("claude-code"));` | Plugin skills **disappear from the "Global" filter chip's results entirely** |
| `src/pages/Skills.tsx:148` | `global: base.filter((s) => (s.origins ?? []).includes("claude-code")).length,` | The "Global" chip's displayed count silently drops by ~57 |
| `src/components/skills/SkillLifecycleMenu.tsx:88` | `if (origin === "claude-code") return "global";` (`scopeLabel`) | The ⋯ context menu mislabels plugin skills' scope |

This is a real, visible regression (Skills page "Global" tab count and contents, drag-and-drop, context menu labels), not a hypothetical edge case — 57 real rows are affected today. CONTEXT.md frames the phase as having "no UI work," and a Reviewed Todo was explicitly rejected on those grounds — but this isn't optional UI polish, it's a **required consequence of D-02** if the origin split is implemented literally. The mechanical fix is small (extract one `isGlobalOrigin(origin)` helper — `origin === "claude-code" || origin === PLUGIN_ORIGIN` — and use it at these ~6 sites instead of the literal comparison), but it must be an explicit task in the plan, not discovered during execution. See Open Questions.

`isProjectOrigin` (`Skills.tsx:112-113`, `.startsWith("claude-code:project:")`) is unaffected — the new origin string doesn't collide with that prefix.

### D-04 migration mechanics [VERIFIED via `convex/migrations.ts`]

`convex/migrations.ts` establishes the pattern to mirror: `BATCH_SIZE = 500` (`:5`); `listSkillOrigins` (`:15-33`, read-only `internalQuery`, used above); `purgeSkillsByOrigin` (`:39-48`, `internalMutation`, dry-run unless `apply: true`, returns `{ matched, deleted, dryRun, names: rows.slice(0,5)... }` when dry — this is the exact dry-run shape D-16/D-04 should reuse: default to a preview with a sample of affected names, require an explicit `apply: true` to mutate). Given the affected population is 57 rows (far below the 500 batch size and far below CLAUDE.md's "large table" bulk-patch concern), a single non-continuation batch mutation is appropriate, matching `purgeSkillsByOrigin`'s own "deliberately NOT batched-with-continuation" precedent for similarly small origin populations.

### Package Legitimacy Audit

Not applicable — DEBT-05 introduces no new external packages.

---

## DEBT-06 — Chat.test.tsx Flake

### Control 1 — does Vitest print the actual value on a `toBe` failure? [VERIFIED, D-08's core assumption CONFIRMED TRUE]

Backed up `src/pages/Chat.test.tsx` (byte-exact copy), mutated line 586's expected string to a deliberately wrong control value, ran only that test:

```
npx vitest run src/pages/Chat.test.tsx -t "keeps the base label byte-identical"
```
Result:
```
AssertionError: expected 'anthropic-sonnet-5' to be 'DELIBERATE_CONTROL_MISMATCH_9x7q2' // Object.is equality
Expected: "DELIBERATE_CONTROL_MISMATCH_9x7q2"
Received: "anthropic-sonnet-5"
 ❯ src/pages/Chat.test.tsx:586:25
```
**Confirmed at the exact assertion site**: Vitest 4.1.9's default reporter prints both `Expected:` and `Received:` on a string `toBe` mismatch. D-08's premise — that the original failure's actual `textContent` was likely captured in Vitest's own output and merely not retained — is **TRUE, not a hopeful assumption**. File restored: `diff` against the pre-edit backup returned exit 0 (byte-identical). Note for the record: `git diff --stat -- src/pages/Chat.test.tsx` was NOT empty after restoration — the file already carried 69 lines of unrelated, pre-existing uncommitted changes from a concurrent session (consistent with 113-HANDOFF.md's shared-checkout warning) **before** this research touched it; my edit and restoration are proven via the pre-edit backup diff, not via `git diff` against HEAD, which reflects the concurrent session's separate in-progress work, not mine.

### Control 2 — does `getByTestId`/`findByTestId` throw or silently return-first on multiple matches? [VERIFIED]

Scratch test (deleted after use, confirmed via `git status --porcelain` showing no residue) rendered two elements sharing one `data-testid` and called `screen.getByTestId(...)`:
```
TestingLibraryElementError: Found multiple elements by: [data-testid="dup-probe"]
Here are the matching elements: [both elements printed, plus full body markup]
```
`@testing-library/dom` 10.4.1 / `@testing-library/react` 16.3.2 **throws** on multiple matches — it does not silently return the first or last element. This directly bears on the "stale duplicate element" hypothesis: since `screen.findByTestId("chat-brain-pill-label")` at `Chat.test.tsx:585` resolves to a single `.textContent` before the failing assertion even runs, if the historical failure was a plain `toBe` string mismatch (as D-08's evidence suggests, not a `TestingLibraryElementError`), then **at the moment of that query, only one matching element existed in the DOM** — the failure is not "two elements coexisting and the wrong one was picked," it is "the single element present at query time held the wrong text." This narrows (does not close) the surviving hypothesis: it points toward a timing/unmount-remount race around that testid, not a simultaneous-duplicate scenario, unless the *captured* soak evidence someday shows a `TestingLibraryElementError` instead of a plain `toBe` mismatch — which the D-08 DOM-dump instrumentation (once fixed, see below) would be able to distinguish.

### Discovery: `onTestFailed` fires AFTER cleanup — D-08's instrumentation design needs to change [VERIFIED both by source and by empirical control]

Source (`node_modules/@vitest/runner/dist/chunk-artifact.js:2967-2989`), the per-test finalization order is fixed and sequential:
```
1. test.afterEach hooks   (line 2973)  <- @testing-library/react's auto afterEach(cleanup) lives here
2. beforeEach cleanups / fixture cleanup (2974-2979)
3. test.onFinished (onTestFinished)    (2983-2984)
4. test.onFailed  (onTestFailed)       (2986-2987)  <- LAST
```
`@testing-library/react/dist/index.js:18-27` auto-registers `afterEach(() => cleanup())` at import time whenever a global `afterEach` is detected (`vitest.config.ts:14` sets `globals: true`, so this fires for every test file). `cleanup()` unmounts every React tree and strips the DOM.

Empirical control (`beforeEach(() => onTestFailed(({errors}) => console.log(document.body.innerHTML)))`, registered exactly the way a `setup.ts` global hook would): on a deliberately-failing test, the logged `document.body.innerHTML` was **the empty string**. This confirms: **a naive `onTestFailed` hook added to `src/test/setup.ts`, as D-08 describes ("an `onTestFailed` hook dumping every matching element plus its DOM subtree"), will only ever observe a post-cleanup, empty DOM.** It cannot capture the stale/duplicate-element evidence D-08 wants.

Also observed (informational, not yet resolved): the `errors` field destructured from the `onTestFailed` callback's argument was `undefined` in this control even though the test demonstrably failed — the correct accessor for the failure's error list may be `task.result?.errors` rather than a top-level `errors` property; **UNVERIFIED**, flag for the implementer to confirm against this Vitest version's actual type (`@vitest/runner`'s `OnTestFailedHandler` type) rather than trusting the JSDoc example literally.

**Recommended instrumentation design for the plan** (mechanical, not requiring further research): capture DOM state **synchronously, inside the test, before cleanup runs** — either (a) wrap the specific fragile query/assertion in a local `try { ... } catch (e) { /* capture screen.debug() or queryAllByTestId output */ throw e; }`, or (b) use Testing Library's own `queryAllByTestId` (not `getByTestId`) at the point of interest to positively count matches without throwing, logging the count and each match's `textContent` as part of the assertion failure message itself (e.g. via a custom assertion message string built before the `expect(...).toBe(...)` call). Either approach runs before any `afterEach`, so it sees real DOM state. A global `onTestFailed` in `setup.ts` remains useful for cheaper diagnostics that don't need DOM (e.g. logging which test failed, mock call counts frozen by `vi.clearAllMocks()` timing) but not for a DOM dump.

### Soak mechanics — measured, not guessed [VERIFIED]

Full suite timing, this session, this machine:
```
npx vitest run
 Test Files  298 passed | 17 skipped (315)
      Tests  3958 passed | 193 todo (4151)
   Duration  36.78s (reported) / 38s (measured wall-clock via shell timer)
```
(Minor drift from 113-HANDOFF.md's "298 files / 3947 tests" snapshot is expected — ongoing concurrent-session work in this shared checkout; not a regression.)

**No `--repeat` CLI flag exists** — confirmed via `npx vitest --help` (no such flag listed) and via direct invocation: `npx vitest run --repeat=3 ...` errors `CACError: Unknown option --repeat`, identical in shape to a deliberately-invalid control flag (`--this-flag-does-not-exist-xyz` → same `CACError`), proving the check is real and not a parsing fluke. A `repeats` option DOES exist (`@vitest/runner`'s `TaskBase.repeats`, `tasks.d-DEYaIMIu.d.ts:507-511`) but it is a **per-task** option (`it('name', fn, { repeats: N })`), reruns only after a successful run, and its JSDoc states failures are not retried unless `retry` is also set — this is the wrong mechanism for D-09's explicit "soak the FULL SUITE, repeated" requirement (which is cross-file by design). **The correct mechanism is a shell loop around `npx vitest run`** (e.g. `for i in $(seq 1 N); do npx vitest run || { echo "FAILED at iteration $i"; break; }; done`), not any Vitest-native repeat flag.

`--sequence.shuffle` (files/tests) defaults to `false` [VERIFIED via `npx vitest --help --sequence`] — by default, declared test/file order is deterministic and identical across repeated `npx vitest run` invocations. Worker-thread/process scheduling timing is still non-deterministic run-to-run even with fixed declared order (this is presumably how the original single observed failure occurred under a normal, unshuffled `npx vitest run`). `--sequence.seed <seed>` only has effect when shuffle is enabled. No `pool`/`poolOptions`/`sequence` overrides exist in `vitest.config.ts` — Vitest's built-in defaults govern parallelism; this research did not verify which pool (threads/forks) is the v4.1.9 default and makes no claim about it (**UNVERIFIED**, not needed for the budget recommendation below).

**Budget recommendation** (statistical, from the measured 38s/run and D-10's own "roughly a dozen recorded runs" base rate ⇒ ~1/12 per-run failure probability): 30 full-suite iterations (~19 minutes) gives ≈93% probability of at least one reproduction if the true rate holds; 50 iterations (~32 minutes) gives ≈99%. Recommend: **first checkpoint at 30 plain (`npx vitest run`, unshuffled) iterations; if no repro, extend to 50; if still no repro, treat D-10's GUARDED exit bar as satisfied.** A separate, smaller (~15-20 iteration) `--sequence.shuffle` pass with no fixed seed is worth an optional follow-up budget line since both surviving hypotheses are cross-test/cross-file and shuffling exercises a materially different interleaving than the default deterministic order — but this is additive, not required to satisfy D-09's letter.

### Package Legitimacy Audit

Not applicable — DEBT-06 introduces no new external packages (only test-local instrumentation using already-installed Vitest/Testing Library APIs).

---

## DEBT-07 — convex-selfhost Under Version Control

### D-12 claims re-verified live [VERIFIED]

```
$ cd C:\Users\mandr\convex-selfhost && git status
fatal: not a git repository (or any of the parent directories): .git

$ gh repo view --json isPrivate,visibility,nameWithOwner   (run from codepulse)
{"isPrivate":false,"nameWithOwner":"larrymandras/codepulse","visibility":"PUBLIC"}
```
Both exactly match CONTEXT.md's D-12 claims.

### D-13 committed scope — the real file list [VERIFIED via `ls -la`]

`*.ps1` files present (9, not an assumed count):
```
backup-convex.ps1, deploy-retention-to-local.ps1, install-nas-key.ps1,
restart-convex.ps1, restore-cap-48g.ps1, retention-health-check.ps1,
retention-root-cause.ps1, soak-watch.ps1, verify-retention-fix.ps1
```
Plus `run-restart-hidden.vbs`, `docker-compose.yml`, `docker-compose.standby.yml` — matching D-13's named scope. One additional file exists that D-13 doesn't mention and D-15's pattern-based ignore rules (`*.bak`) already correctly exclude: `retention-health-check.ps1.pre-110.bak` (a stale pre-Phase-110 backup copy of the health-check script — excluded automatically by the `*.bak` glob, no plan action needed).

**Of the 9 scripts, only 6 are wired to a live Windows Scheduled Task** [VERIFIED via `Get-ScheduledTask`]:
```
ConvexBackup                  -> backup-convex.ps1                    (daily)
ConvexBackupFull   (Disabled) -> backup-convex.ps1 -Full               (daily, disabled)
ConvexNightlyRestart          -> run-restart-hidden.vbs -> restart-convex.ps1  (daily)
ConvexRestoreCap48 (Disabled) -> restore-cap-48g.ps1                   (daily, disabled)
ConvexRetentionHealthCheck    -> retention-health-check.ps1            (daily)
ConvexRetentionRootCause      -> retention-root-cause.ps1              (daily)
ConvexSoakWatch                -> soak-watch.ps1                        (time-triggered)
```
`deploy-retention-to-local.ps1`, `verify-retention-fix.ps1`, and `install-nas-key.ps1` are **not** referenced by any scheduled task — they are one-off/manual operator scripts. The README (D-13) should distinguish "scheduled, always-on" scripts from "manual, run-when-needed" scripts so a fresh-checkout reader knows which ones need re-registering as tasks vs. which are invoked ad hoc.

**External prerequisite not in D-13's original framing, but real**: 6 of the 7 scheduled tasks invoke their script via a shared hidden-window launcher, `C:\Users\mandr\scripts\run-hidden.vbs` — a machine-level utility that lives OUTSIDE `convex-selfhost/` and is not part of this new repo's scope. (`ConvexNightlyRestart` is the one exception — it uses its own in-repo `run-restart-hidden.vbs`, already covered by D-13.) The README/preflight (D-16) should document this as a required external prerequisite for re-registering the other 5 tasks from a fresh checkout, since cloning `convex-selfhost` alone does not provide it.

### D-14 — new finding: a live secret is hardcoded in the file D-13 puts in committed scope [VERIFIED — do not repeat the value]

`docker-compose.yml`'s `backend.environment` block sets `INSTANCE_SECRET=<a literal live hex value>` directly in the file (line 89) — it is **not** sourced via `env_file:` or `${VAR}` substitution from `selfhosted.envfile`. Confirmed by reading the full file (required per canonical_refs for the `logging:` block anyway). `docker-compose.standby.yml` already treats this as sensitive by convention — its own `INSTANCE_SECRET` line reads `__COPY_FROM_PRIMARY_COMPOSE__` (a manual-copy placeholder), which only makes sense if the primary's value is understood as something you wouldn't otherwise duplicate casually. **D-14 as written only scopes `admin-key.txt` and `selfhosted.envfile` for the `.gitignore`+`.example` treatment — it does not cover this.** Committing `docker-compose.yml` as CONTEXT.md's D-13 currently intends would put a live secret into git history, even in a private repo, which conflicts with this project's own "never commit credentials, API keys, or tokens" rule (that rule is not scoped to "public repos only"). **The literal secret value is not reproduced anywhere in this document** — do not add it to the plan, PR description, or commit message either.

Recommended fix shape (mechanical, no further research needed): change `docker-compose.yml` to `environment: - INSTANCE_SECRET=${INSTANCE_SECRET}` (or add an `env_file: - selfhosted.envfile` directive) and add `INSTANCE_SECRET` to `selfhosted.envfile`/`selfhosted.envfile.example`'s key list, migrating the actual value out of compose and into the already-`.gitignore`d env file — consistent with how the rest of the D-14 secrets story already works. This should be a task in the plan, executed **before** the first commit into the new repo, not a follow-up.

### D-15 sizes re-verified, nothing large missed [VERIFIED via `du -sh` on every top-level entry]

```
22G   backups
1.5G  migration
721M  rebuild
868K  forensics
(everything else: <=44K, largest is retention-health.log at 44K)
```
Exact match to CONTEXT.md's cited figures. A full `du -sh --max-depth=1 .` per-entry sweep (not just the four named directories) confirms nothing else in the directory approaches a size worth ignoring — the next-largest item after `forensics/` is `retention-health.log` at 44 KB, already covered by D-15's blanket `*.log` rule. D-15's ignore set is complete.

### D-14 key names — documented, not read from the live file [CITED: official get-convex/convex-backend self-hosted README]

The two environment variable names the Convex CLI's `--env-file` flag expects are `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` — confirmed via the official `get-convex/convex-backend` self-hosted README (`.env.local` example: `CONVEX_SELF_HOSTED_URL='http://127.0.0.1:3210'` / `CONVEX_SELF_HOSTED_ADMIN_KEY='<key>'`), and independently corroborated by 6+ prior CODE-COMPLETE phase artifacts already in this repo (`102-01-SUMMARY.md`, `103-02-SUMMARY.md`, `103-UAT.md`, `106-03-PLAN.md`, `108-07-PLAN.md`, `STATE.md:618`) that all use these exact two names when documenting live-backend probes — none of which required reading the live secret file, since this is public Convex CLI contract, not a project-specific secret name. `backup-convex.ps1:25` and `retention-health-check.ps1:50` both reference `selfhosted.envfile` via `-EnvFile` for `npx convex ... --env-file` invocations, confirming this file is genuinely consumed as a standard Convex CLI env-file today (not dead weight). `selfhosted.envfile.example` should list `CONVEX_SELF_HOSTED_URL=` and `CONVEX_SELF_HOSTED_ADMIN_KEY=` (plus, per the D-14 fix above, `INSTANCE_SECRET=` if that migration is folded in).

### D-16 preflight script — recommended shape (no live backend started)

`docker compose config` (confirmed via `docker compose config --help`: "Parse, resolve and render compose file in canonical format") parses and validates a compose file, including resolving `${VAR}` substitutions and failing loudly if a referenced env var is unset, **without starting any container**. This is the correct primitive for D-16's "asserts... without starting a second Convex backend." Recommended preflight checks: (1) required files present (`docker-compose.yml`, `docker-compose.standby.yml`, all `*.ps1`, `run-restart-hidden.vbs`, README, `selfhosted.envfile.example`); (2) `selfhosted.envfile` exists alongside its `.example` and both declare the same set of key NAMES (name-only comparison — split each line on `=` and diff the key lists, never print values); (3) `docker compose -f docker-compose.yml config --quiet` exits 0 (validates YAML + env substitution without starting anything); (4) external prerequisites present: `docker`, `docker compose`, and (documented, not necessarily hard-failed on) `C:\Users\mandr\scripts\run-hidden.vbs` for task re-registration.

### GitHub push-protection consideration [flagged, not resolved — see Open Questions]

`gh repo create --private` is a working, authenticated flow (`gh auth status` confirms `larrymandras` logged in with `repo` scope). GitHub's secret-scanning / push protection can apply to private repos depending on account/org settings; this research did not (and should not, pre-fix) attempt to push the current `docker-compose.yml` to test this, since it still contains the live secret. Once the D-14 parameterization fix above is applied, this risk is moot for that file — but the plan should not rely on push protection as a safety net either way; parameterize first.

### Package Legitimacy Audit

Not applicable — DEBT-07 introduces no new external packages; it version-controls existing operational scripts and a `docker-compose.yml` that already pins `ghcr.io/get-convex/convex-backend:latest` and `ghcr.io/get-convex/convex-dashboard:latest` (pre-existing image references, not new dependencies introduced by this phase).

---

## Validation Architecture

### DEBT-05
- **Observable outcome asserted:** After a simulated partial/transient scan (a snapshot where the plugin sub-source is deliberately made to fail/return incomplete), the live `skills` table's plugin-origin rows are **unchanged in count** — queried directly via `listSkillOrigins`/`listSkills` (the same read-only mechanism used in this research), not via a mutation's return value, a log line, or a counter. The real observable is the row count for the new plugin origin before vs. after the simulated partial scan.
- **Control that proves the check could fail:** Run the identical simulated-partial-scan input against the **pre-fix** code path (or with the new guard's coverage-declaration deliberately omitted) and confirm the plugin rows DO get deleted in that case — i.e., the test must first reproduce the 185→131→185 shape on old/unguarded logic before it can be trusted to show the new logic prevents it. `convex/__tests__/skillSync.test.ts` already has this shape (`REGRESSION: a declared-but-empty origin... prunes all its rows` / `backward-compat: omitting scannedOrigins reproduces the legacy... result`) — extend it with a genuinely new regression test asserting the OPPOSITE: an origin NOT declared in `scannedOrigins`, absent from incoming, but WAS previously fully present, survives.
- **Frontend companion (if D-02 ships literally):** Observable outcome is the Skills page's "Global" chip count and filtered list actually including plugin-originated skills, asserted via a Testing-Library query on rendered output (`screen.getByText`/count of rendered rows), not via a mocked/stubbed origin list. Control: render with a plugin-origin skill BEFORE the frontend fix lands and confirm it is absent from the "Global" filtered results (reproducing the regression), then confirm presence after.

### DEBT-06
- **Observable outcome asserted:** The literal rendered `textContent` of the brain-pill label element, read via Testing Library query, exactly as the existing assertion already does (`expect(labelBefore).toBe("anthropic-sonnet-5")`) — this must remain unchanged per D-11 (no widened `waitFor`, no reshaping the assertion to look at source data instead of rendered text).
- **Control that proves the check could fail:** Already executed and recorded above (Control 1) — a deliberately-mismatched expected value produces a real, informative failure with both `Expected:`/`Received:` populated. This proves the assertion mechanism is capable of catching a real mismatch, not silently passing regardless of DOM state.
- **Soak validation:** the observable is "0 failures across N full-suite runs" (a real count of failed test runs from the shell loop's exit codes / captured output), not a single "vitest exited 0" flag interpreted loosely — each iteration's actual pass/fail must be individually recorded (e.g., append to a log file per iteration) so a failure on iteration 23 of 30 is not silently overwritten by iteration 30's success.

### DEBT-07
- **Observable outcome asserted:** A `git clone` of the new private repo into a temp directory, followed by running the checked-in preflight script, exits 0 and its individual checks (files present, `docker compose config --quiet` exit code, key-name parity between `.example` and the real env file) are each independently true — not a single aggregate "preflight passed" boolean with no visibility into which check ran.
- **Control that proves the check could fail:** Before considering D-16 satisfied, deliberately break one thing (e.g. temporarily rename `docker-compose.yml` in the temp clone, or remove one key from a copy of `selfhosted.envfile`) and confirm the preflight script correctly reports that specific failure — proving the script does not unconditionally report success regardless of clone state.
- **Secret-exposure check:** Before the first commit, `git diff --cached` (or `git show <commit> -- docker-compose.yml`) must be manually reviewed to confirm no literal secret value appears in the staged content — this is a human/operator checkpoint, not automatable within this phase's scope, and should be an explicit checkpoint task in the plan.

## Common Pitfalls

### Pitfall 1: Fixing DEBT-05's origin split without the frontend companion fix
**What goes wrong:** Plugin skills silently vanish from the Skills page's "Global" view and lose drag-and-drop, while the Convex-side fix is fully correct and fully tested.
**Why it happens:** The origin taxonomy is duplicated as string-literal comparisons across 3 frontend files, none of which are in `convex/` or `hooks/`, so a plan scoped to "producer + server guard" naturally never looks at them.
**How to avoid:** Make the ~6-site frontend fix an explicit task, not a byproduct.
**Warning signs:** A code review or manual QA pass on the Skills page after the migration shows fewer "Global" skills than before, or plugin skills can't be dragged.

### Pitfall 2: DEBT-06's `onTestFailed` hook silently capturing nothing
**What goes wrong:** The plan ships a global `onTestFailed` DOM-dump hook in `setup.ts` exactly as D-08 describes; it "works" (no errors) but every captured dump is an empty `<body></body>`, forever, because cleanup always runs first.
**Why it happens:** `@testing-library/react`'s auto-cleanup registers as a normal `afterEach`, and Vitest's runner always executes `afterEach` before `onFailed`, unconditionally — this is fixed control flow in the test runner, not configurable via `sequence.hooks`.
**How to avoid:** Capture DOM state synchronously at the point of query/assertion (try/catch or `queryAllByTestId` inline), not via a post-hoc global hook.
**Warning signs:** The first captured "failure DOM dump" (from a deliberate control, before trusting it against the real flake) comes back empty — treat that as a bug in the instrumentation, not evidence the DOM was empty at test time.

### Pitfall 3: DEBT-07 committing `docker-compose.yml` with its live `INSTANCE_SECRET` inline
**What goes wrong:** The very first commit into the new private repo ships a live credential into git history — recoverable forever from that history even if a later commit removes it, and potentially blocked or flagged by GitHub secret scanning after the fact.
**Why it happens:** D-14's original scope named `admin-key.txt` and `selfhosted.envfile` as the secrets to protect; `docker-compose.yml` wasn't examined for inline secrets because it's a "config file," not an "env file."
**How to avoid:** Parameterize `INSTANCE_SECRET` via `${VAR}` substitution sourced from the (already-ignored) `selfhosted.envfile` before the first commit, and manually diff staged content for secret-shaped strings as an explicit pre-commit checkpoint.
**Warning signs:** `git show <commit> -- docker-compose.yml` after committing shows a long hex string on the `INSTANCE_SECRET=` line instead of a `${VAR}` reference.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Astridr's `bridge.py` is the current/only `capability_sync` payload builder, and its origin-tagging (`cc`/`bridge`/`native`/`host`) doesn't match the live `native`/`bridge` origins observed — flagged explicitly as UNVERIFIED in the DEBT-05 section, not relied upon for any recommendation. | DEBT-05 | Low — the server-side guard (D-01) is explicitly designed to be producer-agnostic, so this uncertainty doesn't change the recommended plan shape. |
| A2 | The `errors` field on `onTestFailed`'s callback argument is `undefined` in a minimal control, and the correct accessor may be `task.result?.errors` instead — not confirmed against the actual TypeScript type. | DEBT-06 | Low — cosmetic to the diagnostic hook's exact field access; doesn't affect the core finding (cleanup runs before onFailed) or the recommended fix shape. |
| A3 | Vitest 4.1.9's default `pool` (threads vs. forks) was not determined — `vitest.config.ts` has no explicit `pool`/`poolOptions` override. | DEBT-06 | Low — not load-bearing for the soak budget recommendation, which is based on measured wall-clock and a statistical target, not pool internals. |

**If this table is empty:** N/A — three low-risk items logged above, none affecting the core recommendations.

## Open Questions (ALL RESOLVED 2026-08-11)

> All three were put to Larry after this research landed and are now closed by locked decisions in `113-CONTEXT.md`. Each is answered inline below. Do not re-open them.

1. **[RESOLVED → D-17]** **Should the frontend origin-classification fix (6 sites, 3 files) be folded into DEBT-05's scope, or does it need explicit user sign-off given the phase's "no UI work" framing?**
   - **Answer (Larry, 2026-08-11): fold it into DEBT-05.** Recorded as D-17. Note the site count is **8 sites across 4 files**, not 6 across 3 — orchestrator verification found a 4th file this section missed, `src/components/OriginBadge.tsx:6`, where the failure mode is "renders no badge at all" (`BADGE_STYLES["claude-code:plugin"]` is `undefined`, so `styleFor` returns `undefined` and the component returns `null`). `src/lib/skillVault.ts:12` is safe by design and must NOT be touched. The shared `isGlobalOrigin()` helper suggested below was explicitly **rejected** — it widens a debt sweep into a refactor.
   - What we know: the fix is small and mechanical (one shared `isGlobalOrigin()` helper), and is a *required* consequence of D-02 as currently suggested, not optional polish — without it, ~57 plugin skills visibly disappear from the Skills page.
   - What's unclear: whether "no UI work" in CONTEXT.md's domain boundary was meant to exclude even this kind of required, defensive, non-visual-design change to existing pure-logic files.
   - Recommendation: fold it into DEBT-05's plan as a required task (it's a consequence of D-02, not new scope), but flag it explicitly to Larry at plan review since it does touch `src/pages/Skills.tsx` and `src/components/skills/SkillLifecycleMenu.tsx`.

2. **[RESOLVED → CONTEXT.md "Claude's Discretion", struck and decided]** **Exact soak iteration budget for D-09/D-10.**
   - **Answer (Larry, 2026-08-11): tiered — 30 iterations, then 50 more only if tier 1 is clean.** Stop immediately on reproduction. The orchestrator re-measured the full suite independently at **37.98s** (298 files, 3958 tests, 0 failures), so tier 1 ≈ 19 min and worst case ≈ 51 min.
   - What we know: 38s/run measured; 30 iterations (~19 min, ~93% detection probability at the assumed ~1/12 base rate) is a defensible first checkpoint; 50 (~32 min, ~99%) is a defensible extension.
   - What's unclear: whether the planner wants a single fixed budget or a tiered checkpoint-then-extend structure (research recommends tiered).
   - Recommendation: tiered — 30 then 50, GUARDED close if both are exhausted with no repro, per D-10.

3. **[RESOLVED → D-18]** **Should `docker-compose.yml`'s `INSTANCE_SECRET` parameterization be a DEBT-07 task, or does it require rotating the secret regardless (since it may have already been exposed in prior local `git init` experiments, backups, or NAS mirrors)?**
   - **Answer (Larry, 2026-08-11): parameterize only — rotation is explicitly OUT of scope for Phase 113.** Recorded as D-18. The NAS plaintext exposure is written down there so it is not silently dropped, but rotating `INSTANCE_SECRET` on the live self-hosted backend is a production operation well beyond "put this directory under version control." Implementation note: the planner used `env_file: - selfhosted.envfile` rather than `${VAR}` interpolation, because `${VAR}` reads a `.env` that falls outside `backup-convex.ps1:97`'s NAS mirror list while `selfhosted.envfile` is already in it — verified independently by the plan-checker against the live script.
   - What we know: the value is currently only on local disk (never committed, since the directory has never been a git repo) and is mirrored to NAS via `backup-convex.ps1:97`'s file list, which already includes `docker-compose.yml` in plaintext backups — so it has already left the local machine in some form regardless of DEBT-07.
   - What's unclear: whether that NAS exposure is considered acceptable (trusted private backup target) vs. whether DEBT-07 should trigger a rotation as a precaution.
   - Recommendation: parameterize before commit (required); rotation is a judgment call for Larry, not blocking for this phase's success criterion.

## Claims I Could NOT Verify

- Astridr's exact current `capability_sync` producer code and whether it ever sends (or could easily be made to send) a `scannedOrigins` manifest — out of this phase's repo, a 5-minute grep of `astridr-repo/astridr/engine/bootstrap/bridge.py` found a payload builder whose origin strings (`cc`/`bridge`/`native`/`host`) don't fully match the live DB's observed origins (`native`/`bridge` only), suggesting either a different/newer emitter exists or the mapping happens elsewhere. Not resolved; doesn't block DEBT-05's plan since the server guard is designed to be producer-agnostic regardless.
- Vitest 4.1.9's default `pool` setting (threads vs forks) — not determined, not needed for the recommendations made.
- The precise (`task.result?.errors` vs `errors`) accessor shape for `onTestFailed`'s callback in this Vitest version — flagged as a small implementation detail for whoever writes the instrumentation, not researched to type-level certainty.
- Whether GitHub push protection is enabled on Larry's account/org for private repos — not tested (deliberately, since the file that would trigger it still contains a live secret pending the recommended fix).

## Sources

### Primary (HIGH confidence — live, verified this session)
- `npx vitest run src/pages/Chat.test.tsx -t "..."` and two scratch control tests (created and deleted this session) — Vitest 4.1.9 / `@testing-library/dom` 10.4.1 / `@testing-library/react` 16.3.2 failure-output and cleanup-ordering behavior.
- `node_modules/@vitest/runner/dist/chunk-artifact.js:2967-2989`, `:772-775`, `:910-919` — Vitest's own source for hook execution order and `onTestFailed`'s "must be called inside a test" contract.
- `node_modules/@testing-library/react/dist/index.js:18-27` — auto-cleanup registration source.
- `npx vitest --help`, `npx vitest --help --sequence`, `npx vitest run --repeat=3 ...` (errors), `npx vitest run --this-flag-does-not-exist-xyz` (errors, control) — CLI flag surface for Vitest 4.1.9.
- `npx convex run migrations:listSkillOrigins`, `npx convex run registry:listSkills` — read-only live Convex queries against the self-hosted backend (no `--push`, no mutation).
- `hooks/skillScan.mjs`, `hooks/scanner.mjs`, `convex/skillSync.ts`, `convex/registry.ts`, `convex/migrations.ts`, `convex/scan.ts`, `convex/runtimeIngest.ts:1100-1159`, `convex/schema.ts` — read directly, line numbers re-verified against the live checkout this session (zero drift from CONTEXT.md's citations).
- `src/lib/skills.ts`, `src/pages/Skills.tsx`, `src/components/skills/SkillLifecycleMenu.tsx` — read directly; the frontend origin-coupling finding.
- `C:\Users\mandr\convex-selfhost\` — `git status`, `ls -la`, `du -sh` (per-entry), `Get-ScheduledTask`/`Actions`/`Triggers` — live filesystem/OS state.
- `gh repo view --json isPrivate,visibility,nameWithOwner`, `gh auth status`, `gh repo create --help` — live GitHub CLI state.
- `docker compose config --help` — official CLI documentation of the config-validation-without-starting primitive.

### Secondary (MEDIUM confidence)
- Official `get-convex/convex-backend` self-hosted README (via WebSearch, content matches 6+ independently-written prior-phase artifacts already in this repo) — `CONVEX_SELF_HOSTED_URL`/`CONVEX_SELF_HOSTED_ADMIN_KEY` env var names.
- `astridr-repo/astridr/engine/bootstrap/bridge.py` — read directly, but flagged UNVERIFIED as the current/only `capability_sync` producer (see Claims I Could NOT Verify).

### Tertiary (LOW confidence)
- None relied upon for any recommendation in this document.

## Metadata

**Confidence breakdown:**
- DEBT-05 mechanics: HIGH — wire-level absence of `scannedOrigins` confirmed by direct grep of both producers' actual code; live data census independently re-derived and matched CONTEXT.md exactly; frontend coupling finding backed by exact file:line quotes.
- DEBT-06 mechanics: HIGH — both D-08-mandated controls executed and captured verbatim; cleanup-ordering finding backed by both source code and an empirical reproduction.
- DEBT-07 mechanics: HIGH — every D-12/D-13/D-15 factual claim re-verified live; the new secret-exposure finding is a direct file read, not inference.
- Astridr producer behavior (DEBT-05 tangential): LOW — out of repo, not fully resolved, explicitly flagged, does not block the plan.

**Research date:** 2026-08-11
**Valid until:** ~7 days for the live Convex data census and Windows Scheduled Task state (both drift with normal operation); the Vitest/Testing-Library mechanics findings are stable until either package's next major/minor upgrade (check `package.json` pins before relying on them long-term).
