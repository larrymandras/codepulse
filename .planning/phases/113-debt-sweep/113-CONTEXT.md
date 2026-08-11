# Phase 113: Debt Sweep - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Three small, independent tech-debt items are closed. Nothing else.

1. **DEBT-05** — a transient/partial catalog scan no longer prunes live skill rows (observed 185 → 131 → 185, ~56 plugin skills).
2. **DEBT-06** — the intermittent `src/pages/Chat.test.tsx` brain-pill failure (`D-106-04-01`) is addressed from a **captured** failure, never masked by a widened `waitFor`.
3. **DEBT-07** — `convex-selfhost/`'s compose `logging:` block and restart scripts are under version control and reproducible from a fresh checkout.

The three items are independent of each other and of every other v14.0 phase. This phase adds no new product capability.

</domain>

<decisions>
## Implementation Decisions

### DEBT-05 — prune-safety policy

- **D-01: Guard on BOTH sides — producer and server.** `hooks/skillScan.mjs` must stop emitting a snapshot that is indistinguishable from a complete one when a sub-source read has silently failed, AND the server-side prune path must independently refuse to act on a snapshot that does not authorize the deletion. Neither alone is sufficient: the producer fix addresses the known cause, the server guard covers producers we do not control (`native`/`bridge` feeders) and causes not yet identified.

- **D-02: Plugin skills move to their own origin.** Today `collectClaudeCodeSkills` (`hooks/skillScan.mjs:135-141`) emits both the global `~/.claude/skills` dir and every installed plugin's skills under the single `claude-code` origin, which is the structural reason a failed plugin read prunes live rows: the origin is still *present* in the snapshot, just missing ~56 names. A distinct origin (e.g. `claude-code:plugin`) makes the failure mode impossible rather than merely detected. Precedent already exists in the same function: cold storage uses `claude-code:available` for exactly this isolation reason.

- **D-03: The guard shape is an EXPLICIT COVERAGE DECLARATION, not a magnitude threshold.** Extend the existing `scannedOrigins` manifest (documented at `convex/skillSync.ts:47-55`) so the producer positively declares each source it actually read; an origin is prunable only when declared. Deterministic — no number to tune, and no legitimate large cleanup (uninstalling a big plugin) gets refused. A scanner bug then presents as "nothing pruned", which is safe, rather than "56 rows deleted", which is not. **Rejected:** a percentage/absolute magnitude threshold (heuristic, refuses legitimate cleanups) and soft-delete with a grace period (adds a row lifecycle state + sweeper — too large for a phase scoped as a small sweep).

- **D-04: Existing rows are re-originned by a one-shot, batch-capped migration derived from each row's stored `source`.** Live counts, read 2026-08-11 from the self-hosted backend via `migrations:listSkillOrigins`: 701 rows total, of which `claude-code` = 188, `claude-code:available` = 80, `native` = 205, `bridge` = 205, plus five `claude-code:project:*` origins (19, 1, 1, 1, 1). Each row's `source` is a full path, so plugin rows are identifiable (`…\.claude\plugins\…`) from data already stored — the reassignment is derivable and dry-runnable, not guessed. 188 rows is far below the scale `CLAUDE.md`'s no-bulk-patch-on-live rule targets, but the migration must still follow the existing batch pattern in `convex/migrations.ts` (`BATCH_SIZE = 500`). **Rejected:** letting the next scan self-heal it (heals via the exact prune path being hardened, and the new coverage guard would likely and correctly refuse it) and tolerating duplicates (leaves a permanently orphaned origin — the condition `convex/migrations.ts:10-13` already warns about).

### DEBT-05 — refusal visibility

- **D-05: A refused prune writes an `alerts` row.** Reuse the existing `alerts` table (`convex/schema.ts:111-131`) with a dedicated `source` value; it already carries `severity`, `acknowledged`/`status`, and webhook delivery, and there is a consuming surface. This is the actual gap that let 185 → 131 → 185 run unnoticed for a whole milestone — a `console.warn` in Convex logs is only visible to someone already looking. **Rejected:** log-line-only (invisible in practice); alerts row *plus* a Skills-page indicator (adds UI work to a non-UI phase).

- **D-06: Refusals only — no per-scan coverage log.** Write a signal only when the guard blocks something or the scanner aborts. Keeps every row in `alerts` meaningful and adds no write to the normal scan path on a backend with documented memory pressure. **Rejected:** persisting declared coverage on every scan (more diagnostic power, but a new write per cycle and it would need its own `RETENTION_DAYS` entry).

- **D-07: A failed sub-source read still emits — it just doesn't declare that source covered.** The rest of the snapshot (global skills, project skills, cold storage) stays current and the undeclared source is simply not prunable this cycle. Degrades gracefully and pairs exactly with D-03. **Rejected:** aborting the whole scan (one flaky plugin read freezes the entire catalog, including sources that read fine) and bounded retry (adds timing/retry logic to a hook that must stay fire-and-forget).

### DEBT-06 — flake capture

- **D-08: Capture = retained soak output AND failure-time DOM instrumentation.** The failing assertion is `expect(labelBefore).toBe("anthropic-sonnet-5")` (`src/pages/Chat.test.tsx:585-586` — re-derived 2026-08-11; the deferred-item doc's `:576-577` is stale, the file shifted after Phase 111-02 edited it), a plain string `toBe` — Vitest normally prints both sides, so the actual `textContent` was likely present in the original failing run's output and merely not retained, rather than being unobtainable as the deferred item implies. **Research must confirm this with a deliberately-failing control before planning depends on it.** Retained output alone is still insufficient: the leading remaining hypothesis (a stale element surviving from an earlier render) turns on whether *two* elements matched the testid, which a string diff cannot show. An `onTestFailed` hook dumping every matching element plus its DOM subtree is therefore additive and may stay in permanently.

- **D-09: Soak the FULL SUITE, repeated.** The single observed failure occurred in a full-suite run, and both surviving hypotheses involve cross-test or cross-file state. A file-in-isolation soak is a false all-clear — the file already passes in isolation, so a green result there would prove nothing. **Rejected:** isolation-only, and isolation-first-then-escalate (cheaper per iteration but slower to a definitive answer when the cause is cross-file, which is what the evidence points at).

- **D-10: Exit bar — if it does not reproduce within budget, ship the instrumentation and close as GUARDED.** The deliverable in that case is that the *next* occurrence is self-diagnosing rather than lost, plus the recorded refutations. This masks nothing and does not hold the phase hostage to a defect seen once in roughly a dozen recorded runs. **If this branch is taken, DEBT-06's requirement wording in `REQUIREMENTS.md` must be amended to match what was actually delivered — a "guarded, not root-caused" close must not be recorded as "root-caused".** The soak budget itself is set at planning.

- **D-11: A widened `waitFor` remains forbidden** — this is the requirement's own success criterion, restated here so no plan can reintroduce it as a convenience. Same for any reshaping of the assertion that makes it structurally unable to observe the defect (e.g. asserting on source data rather than rendered text); that is a mask wearing a different hat.

### DEBT-07 — convex-selfhost under version control

- **D-12: Its own PRIVATE repo, `git init` in place at `C:\Users\mandr\convex-selfhost`.** Confirmed 2026-08-11: that directory is not currently a git repo (`fatal: not a git repository`), and `codepulse` is **PUBLIC** (`gh repo view` → `"isPrivate":false,"visibility":"PUBLIC"`). Committing a directory that holds `admin-key.txt`, `selfhosted.envfile`, and forensic notes into a public repo is a non-starter. **Rejected:** an `ops/convex-selfhost/` subfolder inside codepulse (public exposure; one careless `git add` publishes a live admin key) and a local-only repo with no remote (a disk loss takes the recovery scripts along with the thing they recover).

- **D-13: Committed scope = compose + all scripts + a bootstrap README.** `docker-compose.yml`, `docker-compose.standby.yml`, every `*.ps1`, `run-restart-hidden.vbs`, and a README documenting prerequisites, volumes, scheduled tasks, and what each ignored secret must contain. The README is what makes "reproducible from a fresh checkout" true rather than asserted. **Rejected:** compose+scripts only (a checkout with no instructions is a claim, not a fact) and including the dated `diagnosis-*.md` / `health-report.md` operational notes (genuine history, but they carry host paths and container internals and would make any later "make it public" decision costly — deferred, not discarded).

- **D-14: Secrets are `.gitignore`d with committed key-name-only `.example` templates.** `admin-key.txt` and `selfhosted.envfile` ignored; a `selfhosted.envfile.example` listing variable NAMES with empty values sits beside the real file. **The template must be built from documented key names — never by reading or dumping the live env file** (the env-file-guard hook blocks reading it, and that block is correct). **Rejected:** ignore-plus-prose (prose goes stale more quietly than a file sitting next to the real one) and relocating the secrets out of the directory (structurally safest, but it changes paths the compose file and every script reference — a real change to a running production stack for a version-control task).

- **D-15: The ignore set must also exclude the bulk/volatile content**, measured 2026-08-11: `backups/` (22 GB), `migration/` (1.5 GB), `rebuild/` (721 MB), `forensics/` (868 KB), all `*.log`, `*.bak`, `soak-watch.state.json`, and `canary-body.json`. This is recorded as a decision rather than left for the planner to rediscover, because a `git add -A` in that directory before the ignore file exists would attempt to stage ~24 GB.

- **D-16: "Reproducible from a fresh checkout" is proven by cloning to a temp path and running a checked-in preflight script** that asserts every required file, env key, and external prerequisite is present or documented — **without starting a second Convex backend.** The preflight keeps paying off after this phase. **Rejected:** a README checklist verified by reading (the weakest class of check under this repo's own verification rules) and a full standby bring-up (strongest proof, but it means a second Convex process near a self-hosted backend with documented memory pressure and volume sensitivity — it would need its own safety design, which is more than this item is worth).

### Claude's Discretion

- Plan decomposition and sequencing across the three items (they are independent; wave structure is the planner's call).
- The exact new origin string for plugin skills (`claude-code:plugin` is a suggestion, not a lock) and the exact `alerts.source` value.
- The soak iteration budget for D-09/D-10.
- The precise shape of the coverage-declaration payload extension to `scannedOrigins`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DEBT-05 — skill prune churn
- `convex/skillSync.ts` — pure helpers. `computeSkillPrunes` at :57-86 (the per-origin prune rule), `sanitizeScannedOrigins` at :32-36, and the manifest semantics documented at :38-55. This is where the server-side guard lands.
- `convex/registry.ts` — the two call sites that actually delete, at :187 and :355 (the only two references to `computeSkillPrunes` besides the :6 import), each preceded by its own `sanitizeScannedOrigins` call and prune-eligibility condition.
- `convex/migrations.ts` — `listSkillOrigins` (read-only origin census, used to produce the live counts in D-04) and the existing `BATCH_SIZE = 500` migration pattern. Its comment at :10-13 states the orphaned-origin failure mode that D-04 is avoiding.
- `hooks/skillScan.mjs` — the producer. `readInstalledPluginSkills` at :86 (returns `false` on a missing/unparseable/empty manifest), `walkPluginCache` at :111 (silently returns on any `existsSync`/`readdirSync`/`statSync` failure), and `collectClaudeCodeSkills` at :134 — where :137 emits the global skills dir and the plugin fallback at :139-141 emit under the *same* `claude-code` origin, while :144 correctly isolates cold storage as `claude-code:available`.
- `convex/schema.ts` — `skills` table at :198, `alerts` table at :111-131 (the refusal-signal target, D-05).
- `convex/__tests__/skillSync.test.ts` — existing unit coverage for the pure helpers; the guard's tests belong here.

### DEBT-06 — Chat.test.tsx flake
- `.planning/milestones/v13.0-phases/106-consolidation-hardening/deferred-items.md` §`D-106-04-01` (:6-62) — **required reading.** Records the original failure, and the three causes already REFUTED (shared-fixture contamination of the brain mocks; async catalogue changing the label mid-assertion; `useGlobalModelNames`). Do not re-investigate these. Two caveats: its stated next lever is partially superseded by D-08 above, and **every source line number it cites is now stale** — all four were re-derived on 2026-08-11 and are given below. Trust its reasoning, re-derive its pointers.
- `src/pages/Chat.test.tsx` — the failing assertion at :585-586, inside the `describe` block starting :512 whose `beforeEach` (:513-521) resets `vi.clearAllMocks()`, `registeredEventHandlers`, `mockStatus`, `mockActiveEngineMap`, `lastBrainPickerProps`, `mockCatalogueEntries`, and `mockDefaultProfileId`.
- `src/pages/Chat.tsx:196` — `resolveModelDisplayName(resolved.model as string, catalogue, globalModelNames)`, the label's source (doc says :184).
- `src/lib/brainsApi.ts:111` — the `if (catalogue && catalogue.length > 0)` guard that renders hypothesis 2 inert (doc says :256).
- `src/hooks/useResolvedBrain.ts:122` **and** `:199` — the `status !== "connected" || !sendCommand` early returns that render hypothesis 3 inert. Note there are TWO such guards, not the single one at :170 the doc cites.
- `src/test/setup.ts` — where a global `onTestFailed`/DOM-dump hook would be wired.

### DEBT-07 — convex-selfhost versioning
- `C:\Users\mandr\convex-selfhost\docker-compose.yml` — the `logging:` block at :69-73 (`json-file`, `max-size: 10m`, `max-file: 3`), with the rationale comment at :63-68 that cites `107-OCC-EVIDENCE.md`. This block is one of the two artifacts the success criterion names.
- `C:\Users\mandr\convex-selfhost\restart-convex.ps1` + `run-restart-hidden.vbs` — the restart mechanism `CLAUDE.md` documents as deliberate and health-gated.
- `CLAUDE.md` § "Self-Hosted Convex — Operational Rules (2026-07-22 incident)" — the hard rules any work near this stack must respect (never `import --replace-all`, no bulk deletes/patches on live, `ConvexNightlyRestart` is deliberate).
- `.planning/phases/110-convex-durability/110-MEMORY-EVIDENCE.md` — the memory-growth evidence the restart scripts exist to manage; establishes why the standby-bring-up proof was rejected in D-16.

### Phase-level
- `.planning/ROADMAP.md` § "Phase 113: Debt Sweep" (:849-861) — goal and the three success criteria.
- `.planning/REQUIREMENTS.md` :63-65 — DEBT-05/06/07 as written. **D-10 may require amending the DEBT-06 line.**
- `.planning/phases/113-debt-sweep/113-HANDOFF.md` — prior-session environment facts: the no-auth Playwright invocation, the `npx convex env list` value-printing hazard, the shared-checkout commit discipline, and the list of known-failing tests that are NOT this phase's and NOT regressions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scannedOrigins` manifest** (`convex/skillSync.ts:38-55`) — already exists as a producer-declares-coverage mechanism, added at 98-05. D-03 extends it rather than inventing a new one.
- **`claude-code:available` origin** (`hooks/skillScan.mjs`) — existing precedent for isolating a sub-source onto its own origin specifically so per-origin pruning cannot cross-contaminate. D-02 follows it exactly.
- **`alerts` table** (`convex/schema.ts:111-131`) — severity, acknowledge state, status, `ruleId`, webhook delivery, and four indexes. Nothing new is needed for D-05.
- **`convex/migrations.ts`** — established batch-capped migration + read-only census pattern for the `skills` table. D-04's migration should mirror it.
- **`sanitizeScannedOrigins`** — existing precedent for treating the `/scan` snapshot body (`v.any()`) as untrusted input. Any new manifest field needs the same treatment.

### Established Patterns
- **Pruning is PER-ORIGIN, and an undeclared origin is never touched.** This is the invariant the whole fix hangs off; the bug is that plugin and global skills share one origin, so "origin present" is true while most of its rows are absent.
- **Pure helpers live in `skillSync.ts` and are unit-tested with no Convex ctx** (`convex/__tests__/skillSync.test.ts`). The guard should be a pure function so it is testable without a backend.
- **Hooks must stay fire-and-forget** — this constrains D-07 (no retry/backoff loops in `skillScan.mjs`).
- **Two independent feeders write `skills`:** the Claude-Code host scanner (`claude-code*` origins, 289 rows) and an astridr-side feeder (`native`/`bridge`, 205 rows each, sources like `/home/astridr/.claude/skills/...`). The guard must not assume a single producer.

### Integration Points
- `convex/registry.ts:187` and `:355` — the two prune call sites; both need the guard, and a fix applied to only one is the classic half-fix in this codebase.
- `hooks/skillScan.mjs` → `/scan` HTTP route → `convex/registry.ts` — the full producer→consumer path a coverage declaration must travel end to end.
- `src/test/setup.ts` — global test setup where DEBT-06's failure-time instrumentation attaches.
- `C:\Users\mandr\convex-selfhost\` — outside the codepulse repo entirely; DEBT-07 creates a *separate* repo and touches no codepulse source.

</code_context>

<specifics>
## Specific Ideas

- The DEBT-05 symptom to reproduce and then disprove: skill count oscillating **185 → 131 → 185** across a scan cycle, ~56 plugin skills.
- The DEBT-06 assertion, verbatim: `expect(labelBefore).toBe("anthropic-sonnet-5")` — the element WAS found and its text differed, which is what makes "stale duplicate element" the surviving hypothesis rather than a routine async race.
- DEBT-07's ignore set is driven by measured sizes, not guesses: `backups/` 22 GB, `migration/` 1.5 GB, `rebuild/` 721 MB.

</specifics>

<deferred>
## Deferred Ideas

- **Seiðr e2e flakiness** (`galdr`, `bifrost`, `loom` specs under full-suite parallel load) — same *class* as DEBT-06, different instance. Cause is already understood (contention over one shared Convex instance and one dev server; 15/15 reliable in isolation) and the fix is a separate serial Playwright project, i.e. a repo-wide `playwright.config` change. Explicitly out of scope, per the discussion.
- **`diagnosis-*.md` and `health-report.md` in `convex-selfhost/`** — genuine investigation history, deliberately left out of DEBT-07's initial commit scope. Worth revisiting once the private repo exists and the exposure question is settled.
- **`e2e/theme-contrast.spec.ts` — 20 failures** (SEED-006) and **`e2e/command-center-breakpoints.spec.ts` — 3 failures** (owned by in-flight Phase 111). Named in `113-HANDOFF.md` as pre-existing and NOT this phase's; recorded here so no plan mistakes them for regressions it caused.

### Reviewed Todos (not folded)
- **`111-devtools-issues-panel-entry-unexamined.md`** — an unopened "1 Issue" devtools badge observed on both Phase 111 surfaces. Matched only on generic keywords ("111", "phase"); it is Phase 111's finding and 113 has no UI work. Not folded.
- **`llm-analytics-rollup-migration-cr01.md`** — move the Analytics LLM queries onto the `aggregates` rollups (Phase 104 CR-01). Matched on generic keywords ("convex", "phase", "2026"); it carries its own trigger ("next time /analytics throws, or the next Analytics-touching phase") and is scoped Medium, i.e. its own phase. Not folded.

</deferred>

---

*Phase: 113-debt-sweep*
*Context gathered: 2026-08-11*
