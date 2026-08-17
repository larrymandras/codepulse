# Phase 115: Workspace scanner - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

A **host-side Node scanner** that walks Larry's declared workspace roots, classifies what it finds
(department, access, secret), and POSTs a **versioned snapshot** to Convex for Phase 114's Workspace
Map view to render.

This phase delivers the **producer only** — the scanner, its classifier, its config, its ingest
endpoint and its storage. It does **not** build the map view (Phase 114), and it does not build the
Ástríðr-side `arms` lens (astridr A3, queued for v29).

**Sequencing note the ROADMAP currently gets wrong:** ROADMAP declares "Phase 115 **Depends on:**
Phase 114". The design's own dependency graph says the opposite — "C2 → enables C1's workspace lens"
(`agentic-os-second-brain.md:48`), where C2 is this phase and C1 is 114. The scanner feeds the map.
That ROADMAP line should be corrected; it is not a constraint on this phase.

</domain>

<decisions>
## Implementation Decisions

### Payload and secrets (the highest-stakes area)

- **D-01:** A snapshot carries path + metadata, NEVER file contents. Each record carries its
  relative path, size, mtime and derived classifications (department, access, isSecret). The donor's
  markdown link-extraction is **explicitly dropped** — `scan.js:149`'s
  `fs.readFileSync(path.join(ROOT, f.rel), 'utf8')` is the only place the donor reads file bodies,
  and this scanner walks the vault, `.claude` and `.claude-alt`. "Classification logic only" must
  exclude content reading by construction, not by omission. The scanner must be structurally unable
  to transmit file contents.

- **D-02:** Secret detection is DENY-BY-DEFAULT per root, not a secret-shaped regex. A file is
  treated as shareable only if it matches an explicit allowlist for its root; anything unmatched is
  treated as sensitive. Rationale is measured, not theoretical — the donor's `SECRET_RE`
  (`scan.js:46`) was tested against Larry's real tree and returned **PUBLIC** for all three of:
  `convex-selfhost/selfhosted.envfile` (holds `INSTANCE_SECRET`), `.claude.json` (holds an inline
  `Authorization: Bearer` token), and `.mcp.json`. An enumerating regex fails OPEN on every shape
  nobody anticipated; a deny-by-default allowlist fails CLOSED.

- **D-03:** Secret-classified paths are omitted from the snapshot entirely. They never leave the
  host — not even as a flagged/locked row, because a filename is itself a disclosure. The snapshot
  carries a **withheld count** per directory so the omission is visible in the map rather than
  silent. (This deliberately diverges from the donor's `accessOf()`, which ingests secrets and merely
  forces them to `access: 'claude'`.)

### Scanner home and triggering

- **D-04:** A separate `hooks/workspaceScan.mjs`, importing shared helpers from the existing scanner
  rather than copying them. `hooks/scanner.mjs` (338 lines) already owns the POST/bearer/dry-run
  plumbing, but it is the **SessionStart** environment scan, so it fires on every session. Folding a
  vault + all-repos walk into that path would violate the project's fire-and-forget hook rule
  outright. SessionStart must remain untouched by this phase.

  **Two mechanism corrections, measured at planning time 2026-08-12. Neither changes D-04's
  conclusion; both change how the executor must implement it.**

  1. *How SessionStart actually reaches the scanner.* `hooks/scanner.mjs` is **not** named in either
     `settings.json` — a fixed-string grep for `scanner` in both files returns only an unrelated
     `gsd-read-injection-scanner.js` (control: `hooks` appears 83× and 81× in those same files, so
     the grep works). The real path is indirect: `hooks/codepulse-hook.mjs` is wired at *user* scope
     in BOTH launchers (`.claude/settings.json:117`, `.claude-alt/settings.json:78`, among 8 event
     bindings each), and at `hooks/codepulse-hook.mjs:142-145` it does
     `const { runScan } = await import(scannerPath); await runScan(...)` when
     `resolvedEventType === "SessionStart"`. The call is **awaited inline in the dispatcher**, which
     makes D-04's constraint *stronger* than originally stated, not weaker — anything slow added
     under `runScan` blocks the hook directly.

  2. *There are no shared helpers to import yet.* `hooks/scanner.mjs` exports exactly ONE symbol —
     `runScan` (`hooks/scanner.mjs:33`); it is the only `^export` line in the file. The
     POST-with-bearer block is **inline inside `runScan`** at `hooks/scanner.mjs:220-241`, not
     factored out. So "importing shared helpers rather than copying them" is not currently possible
     as written: it requires first EXTRACTING that block into a shared module (e.g.
     `hooks/ingestPost.mjs`) that both `scanner.mjs` and the new `workspaceScan.mjs` import.
     Consequence the planner must handle explicitly: this phase therefore **does** edit a file on the
     awaited SessionStart path, which D-04's own rationale makes the highest-risk edit in the phase.
     That extraction task must be (a) strictly behavior-preserving, (b) verified by the existing
     `hooks/__tests__/scanner.test.mjs` staying green — note its header records that `scanner.mjs`
     had ZERO test coverage until Phase 113 added it, so those tests are the only regression net —
     and (c) checked against the ~40ms fire-and-forget budget. Copying the block instead of
     extracting it is the sanctioned fallback if the extraction cannot be made safely; duplicating 20
     lines is a smaller risk than regressing every session start.

- **D-05:** Nightly scheduled task + an on-demand flag. Two constraints are non-negotiable and both
  come from recorded incidents: the task is launched via `C:\Users\mandr\scripts\run-hidden.vbs`
  (verified present, 826 bytes) because `powershell -WindowStyle Hidden` does **not** hide when
  Windows Terminal is the default terminal; and the task must **not** carry
  `DisallowStartIfOnBatteries`, which silently no-ops the entire action and cost ClaudeConfigPull
  5+ weeks of never running.

- **D-06:** The walk is bounded by an explicit root list plus the donor's `EXCLUDE_DIRS`
  (`node_modules`, `.git`, `.venv`, `__pycache__`, `.next`, `.cache`, `dist`, `coverage`, `.turbo`,
  `.pytest_cache`, `.idea`, `.vscode-server`, …). Roots are named, not discovered. No depth cap was
  taken — the exclude set removes the pathological trees, and a silent depth truncation would
  present as a mysteriously incomplete map.

### Classification model

- **D-07:** Departments are Larry's three operating contexts — Work / Consulting / Personal. This
  mirrors how he defines his own operating model in his global CLAUDE.md. A department answers what
  a thing is FOR, which is the question a map should answer at a glance. Chosen over the donor's
  artifact-type model (skills/memory/projects/docs), which is derivable from paths but blurs Work
  and Personal together.

- **D-08:** Classification rules live in a config JSON checked into this repo. Mirrors the donor's
  own design (it reads `config/workspace.json`). Two consequences that matter downstream: the rules
  are reviewable in a diff, and the classifier becomes a **pure function of (path, config)** — which
  is what makes D-12's dry-run gate meaningful and the classifier unit-testable against alternate
  rule sets.

- **D-09:** `access` (Ástríðr-reachable vs local-only) is DERIVED from Ástríðr's compose bind mounts,
  not hand-maintained. Parse the mount sources from `astridr-repo/docker-compose.yml` — measured at
  discussion time: the vault → `/app/vault` (`:344`), `.claude` (`:345`, `:359`), `.agents` (`:360`),
  three repos' `.claude\skills` (`:369-371`), `.claude-alt` (`:539-541`), and `.claude.json` itself
  (`:540`). All are `:ro`. Derivation is self-correcting — change a mount and the map follows —
  whereas a hand-maintained prefix list is a second source of truth that goes stale silently.

- **D-14:** Root→department assignment is an explicit map in the same config; unmapped roots render as
  a visible "Unclassified" group. Nothing on disk records that `codepulse` is Personal and a
  ProtectAll repo is Work, so the mapping must be declared. It must **never silently default into a
  real department** — an unmapped root appearing as "Personal" would make the map assert a context it
  actually inferred. The dry-run report surfaces everything Unclassified.

### Storage, growth and the gate

- **D-10:** New `workspace*` tables copying the proven versioned pattern — NOT reuse of
  `graphSnapshots`. The pattern to copy is real and built: meta row holding an `activeVersion`
  pointer, entity rows keyed by `(snapshotId, version)`, and the pointer patched **LAST**
  (`graphSnapshots.ts:137`, "7. LAST: patch-or-insert meta doc with new activeVersion pointer") so a
  mid-scan crash can never show a partial map. Two reasons not to reuse the tables themselves:
  `graphSnapshotNodes` has fixed fields (`nodeId, label, type, community, source`) with nowhere for
  department/access/isSecret/size/mtime, forcing a lossy encoding into `type`/`source`; and see D-11.

- **D-11:** Growth is bounded by an inline, batch-capped prune at ingest — not by a cron. The writer
  deletes the oldest version's rows as part of the same ingest that adds a new one. This is a direct
  consequence of a live defect found during discussion: `sweepGraphSnapshotVersions` exists
  (`graphSnapshots.ts:168`, keeps 7 versions) but its cron registration is **commented out** at
  `crons.ts:145-151`, labelled `DISABLED 2026-07-14 — times out on self-hosted Convex`. A nightly
  producer must not depend on a sweep that is disabled for timing out on this exact backend, and must
  never issue a mass delete — the self-hosted instance's MVCC tombstone GC cannot absorb one (see
  CLAUDE.md's 2026-07-22 incident rules). Bounded by construction beats bounded by a schedule.

- **D-12:** The dry-run gate is STRUCTURAL — the dry-run writes a reviewable report, and the ingest
  path hard-refuses until an approval marker recording that report exists. The design mandates
  "classifier dry-run against the real tree reviewed before first ingest"; a procedural instruction
  would rest on discipline. The report carries per-department counts, the withheld-secret count, the
  Unclassified list, and a sample of classifications. **The refusal must be mutation-tested** —
  proven to actually fire, not asserted — per this project's standing rule that a gate which can
  skip itself must be shown to have evaluated something.

### Granularity

- **D-13:** Directories are nodes; individual files are counts, never nodes. Each directory node
  carries aggregate counts (file count, total size, department mix, withheld-secret count). Measured
  at discussion time: **21,029 files** across just `.claude` (12,152), `.claude-alt` (5,183) and the
  vault (3,694) — with repos not yet counted. A file-per-node graph is neither storable at that shape
  (`graphSnapshots`' own schema comment records that row-based storage was chosen because a blob
  "would exceed Convex's 8,192-element array-field limit") nor interactively renderable by Phase
  114's force-graph canvas. This also composes with D-01/D-03: individual filenames never need to
  leave the host to draw the map at all.

### Root classification (resolved at planning time, 2026-08-12)

Research surfaced two open questions that D-07/D-14 could not answer from disk. Both were put to
Larry during plan-phase and are now locked:

- **D-15:** The vault, `.claude` and `.claude-alt` each map to a single "Unclassified" department at
  the ROOT level. They demonstrably contain Work, Consulting and Personal material mixed together,
  and D-14 assigns departments per root — so any single department label for them would be an
  assertion the scanner inferred rather than knew. Both alternatives were rejected: declaring
  narrower vault sub-roots (each new vault folder then needs a config edit or silently goes
  Unclassified), and reintroducing the donor's sub-path `deptOf()` matching (`scan.js:63`), which
  D-07/D-14 explicitly replaced. Consequence the map must own: one large grey Unclassified group is
  expected and correct on the first cut, and D-12's dry-run report is what tells Larry whether it is
  too large to live with.

- **D-16:** Every ambiguous root under `C:\Users\mandr\` ships as a DECLARED root mapped to
  Unclassified — never omitted, never guessed into a real department. Research found ~10
  directories it could not classify from the name alone; several read as consulting-client names, but
  on directory naming alone with zero corroborating evidence. Declaring them Unclassified satisfies
  both failure modes at once: no wrong department lands silently (D-14's rule), and no real work is
  invisible (which a narrowed root list would have caused). D-12's dry-run report must list them with
  file counts and sizes so Larry can re-map the real ones in a single local config edit before first
  ingest. Their names are not recorded in this file — see D-17.

- **D-17:** The classification config is SPLIT — a tracked rules file plus a gitignored local root
  list. This AMENDS D-08. D-08 said "classification rules live in a config JSON checked into this
  repo," which is still true of the *rules*. But `larrymandras/codepulse` is a **public** repo
  (measured at planning time: `gh repo view` → `"visibility":"PUBLIC"`), and D-16's root list is an
  inventory of Larry's project directory names, several of which read like client engagements. Of
  those ~10 names, **7 appear in zero tracked files at HEAD** — committing them would be a new,
  permanent, one-way disclosure (git history survives deletion). So:
  - **Tracked** (`config/workspace.json`): the schema, `EXCLUDE_DIRS`/`EXCLUDE_FILES`, the D-02
    allowlist patterns, the department vocabulary, and the non-sensitive roots (the vault, `.claude`,
    `.claude-alt`, `codepulse`, `astridr-repo`). D-08's real goal — rules reviewable in a diff — is
    preserved in full, and the classifier stays a pure function of (path, config).
  - **Gitignored** (`config/workspace.local.json`): the sensitive root entries and their department
    mapping. Must be added to `.gitignore` in the same task that creates it.
  - The loader merges tracked ← local, local winning on key collision, and must **fail closed** if
    the local file is absent or malformed: missing local config means "scan only the tracked roots",
    never "scan everything unclassified" and never a crash that a nightly task would swallow.
  - Note the home-path question is separate and already settled by precedent: 188 tracked `.md` files
    already contain `C:\Users\mandr`, so paths of that form are not what this decision protects.

### Claude's Discretion

- Exact table/column names and index choice for the `workspace*` tables, within D-10's versioned
  shape and D-11's inline-prune constraint.
- The concrete allowlist patterns implementing D-02, and the initial root list for D-06 — proposed by
  the planner, **validated by D-12's dry-run report before first ingest** rather than guessed at
  planning time.
- The config file's exact schema and location within the repo (D-08).
- The report format for D-12, provided it carries the four contents named above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The design this phase implements

- `C:\Users\mandr\Mandras\02-projects\agentic-os-second-brain.md` — the approved design.
  **§"CodePulse" bullet C2** is this phase's scope statement. **Line 48 is the dependency graph**
  ("C2 → enables C1's workspace lens"), which contradicts and supersedes the ROADMAP's
  "115 depends on 114". This note is in the **vault, not the repo**.
- `.planning/ROADMAP.md` § "Phase 115: Workspace scanner" — currently a stub (`Goal: [To be
  planned]`, `Requirements: TBD`) with the inverted dependency noted above.

### The donor being adapted (classification logic ONLY)

- `C:\Users\mandr\Downloads\robonuggets-rubric-second-brain.zip` → `rubric-second-brain/scan.js`
  (18,227 bytes) — **the canonical donor source. It is NOT extracted anywhere on disk**; the two
  extracted donor dirs (`~/rubric`, `~/rubric-links`) do not contain it. Extract to a scratch path to
  read; do not vendor it into this repo.
  - `:15-20` `EXCLUDE_DIRS` / `EXCLUDE_FILES` — adopted by D-06.
  - `:46` `SECRET_RE` — **rejected** by D-02; measured to miss three real credential files.
  - `:50` `accessOf()` — the shared-prefix access model; **replaced** by D-09's derived model.
  - `:63` `deptOf()` — the department path-rules; the shape to adapt, but its `shared/projects` +
    `shared/memory` assumptions do not fit Larry's roots (D-07/D-14 replace them).
  - `:149` `readFileSync` — **the content read that D-01 explicitly drops.**
- `C:\Users\mandr\Mandras\04-research\rubric-toolkit-teardown.md` — prior security audit of this
  toolkit (2026-06-22). Verdict: *"clean enough to learn from / run locally, one caveat."* The
  caveat is `Access-Control-Allow-Origin: *` on a server with unauthenticated write/create/delete —
  **in the docs server, not the classifier**, so it is out of scope for what this phase takes. Do
  not re-derive this audit.

### Precedents in this repo (read before writing new plumbing)

- `hooks/scanner.mjs` — the host-side scan precedent: `runScan()`'s POST-with-bearer shape, its
  `--dry-run` / `isDirectRun` branch, and its injectable-deps pattern for testability. D-04 shares
  these helpers rather than copying them. Note its header comment explains why it deliberately has
  **no shebang** (breaks the Vite/Rolldown SSR transform used by its tests) — the same applies to any
  sibling script.
- `convex/graphSnapshots.ts` — the versioned-write pattern D-10 copies. `:50` documents the ordering
  contract, `:137` is the activeVersion-last patch, `:168` is `sweepGraphSnapshotVersions`.
- `convex/crons.ts:145-151` — **the disabled sweep**, with its `DISABLED 2026-07-14 — times out on
  self-hosted Convex` note. The direct justification for D-11.
- `convex/schema.ts:1880-1932` — `graphSnapshots` / `graphSnapshotNodes` / `graphSnapshotLinks`
  shapes, including the comment recording Convex's 8,192-element array-field and ~1 MiB document
  limits that forced row-based storage.
- `convex/retention.ts` — the `RETENTION_DAYS` + batch-capped delete pattern; the repo's reference
  for bounding a table before it grows.

### Host automation constraints

- `C:\Users\mandr\scripts\run-hidden.vbs` — verified present. The required launcher for D-05's
  scheduled task.
- `C:\Users\mandr\astridr-repo\docker-compose.yml:344-371, 539-541` — the bind-mount sources D-09
  derives `access` from.

### Project rules that bind this phase

- `CLAUDE.md` § "Self-Hosted Convex — Operational Rules" — never bulk-delete on the live instance;
  retention-style deletes stay batch-capped. Directly constrains D-11.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`hooks/scanner.mjs`** — POST/bearer/dry-run helpers, injectable deps for testing. D-04 imports
  from it; do not duplicate.
- **`hooks/skillScan.mjs`** (`collectClaudeCodeSkillsWithCoverage`) — an existing walker over
  `.claude` dirs with per-sub-source coverage declaration, hardened in Phase 113 (DEBT-05). Its
  coverage-declaration idea is directly relevant: a partial scan must not be mistaken for a complete
  one. Worth reading before designing the snapshot's completeness semantics.
- **`convex/graphSnapshots.ts`** — the versioned ingest, its ordering contract, and
  `selectVersionDeletes()` (pure, testable) which D-11's inline prune can model itself on.
- **`validateIngestAuth` / `getCorsHeaders`** (used by `/runtime-ingest`, reused by graph snapshot
  ingest) — the existing auth surface. A new workspace ingest route should reuse it, adding no new
  auth surface.

### Established Patterns

- **Versioned write, pointer flipped last** — a partial ingest is never visible.
- **Bound a table before it grows** — `RETENTION_DAYS` + batch-capped deletes; a mass delete is
  forbidden on the self-hosted instance.
- **Hooks are fire-and-forget** — anything on a SessionStart path must exit in ~40ms; this is why
  D-04 keeps the workspace walk off that path entirely.
- **Pure functions extracted for testability** — the classifier being a pure `(path, config)`
  function follows this and is what makes D-12's gate testable.

### Integration Points

- New HTTP ingest route in `convex/http.ts` alongside `/scan` and `/runtime-ingest` (reusing their
  auth), receiving the versioned workspace snapshot.
- New `workspace*` tables in `convex/schema.ts`.
- Phase 114 consumes the stored snapshot; this phase's node/link shape is 114's input contract.
  **D-13 (directory nodes) is the load-bearing part of that contract** — 114's renderer is sized by it.

</code_context>

<specifics>
## Specific Ideas

- **Environment probe limitation the executor should know:** `schtasks /query` returns **zero lines**
  from this session's shell — proven broken by a control, since it also fails to find
  `ConvexNightlyRestart`, which CLAUDE.md documents as deliberately installed. Task registration and
  verification for D-05 therefore **cannot be confirmed from this environment**. Treat existing-task
  state as unverified rather than absent, and have Larry confirm registration, or verify by another
  route.

- **Measured scale, for sizing:** `.claude` 12,152 files / `.claude-alt` 5,183 / vault (`Mandras`)
  3,694 = **21,029**, excluding `node_modules`/`.git`/`__pycache__`/`.venv`, and before any repo
  roots. Any design that emits per-file nodes must be re-checked against this number.

- **Donor secret-regex test results** (run during discussion, kept because the planner should not
  re-derive them): `selfhosted.envfile` → PUBLIC, `.claude.json` → PUBLIC, `.mcp.json` → PUBLIC,
  `generate_admin_key.sh` → PUBLIC; `.env`/`.env.local`/`server.pem`/`secrets.yaml` → SECRET.

</specifics>

<deferred>
## Deferred Ideas

- **Fixing `sweepGraphSnapshotVersions`' timeout** so the Phase-83 graph-snapshot sweep can be
  re-enabled. Real work and a real live defect (versions accumulate unbounded today), but it is a
  Phase-83 backend repair, not this phase's scope. D-11 routes around it rather than depending on it.
  Worth planting as its own item.
- **A CodePulse UI "rescan now" button** — considered under D-05 and not taken; it needs a host-side
  listener or gateway route beyond this phase's script scope.
- **Standalone `brain.js` wiring** for Larry's own `~/.claude` memory (the design notes the format
  matches exactly) — explicitly marked "not in scope" by the design itself; a possible `/gsd-quick`
  side-task.
- **Reading vault project-note frontmatter as the department source** — rejected under D-14 because
  it makes the scanner depend on vault note hygiene and requires content reads, cutting against D-01.
  Revisit only if the explicit config map proves burdensome.
- **Per-file detail via the donor's SPINE/expandable-node model** — rejected under D-13 for this
  phase; revisit if Phase 114 shows directory-level granularity is insufficient.

### Reviewed Todos (not folded)

Both matched only on the generic keywords "plan"/"phase" and are unrelated to a workspace scanner:

- `111-devtools-issues-panel-entry-unexamined.md` (score 0.6) — a DevTools "1 Issue" badge observed
  on Phase 111 surfaces. Belongs to Phase 111 follow-up.
- `llm-analytics-rollup-migration-cr01.md` (score 0.2) — LLM analytics rollup migration. Unrelated
  domain.

</deferred>

---

*Phase: 115-workspace-scanner*
*Context gathered: 2026-08-12*
