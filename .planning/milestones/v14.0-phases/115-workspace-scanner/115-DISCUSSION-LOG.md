# Phase 115: Workspace scanner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 115-workspace-scanner
**Areas discussed:** Secrets & what gets ingested, Scanner home, Department model & scan roots, Snapshot storage & the dry-run gate, Granularity & department source

---

## Secrets & what gets ingested

### Q1 — What should a snapshot row carry about each file?

| Option | Description | Selected |
|--------|-------------|----------|
| Path + metadata, never contents | Path, size, mtime, derived classifications. Drops the donor's markdown link-extraction (`scan.js:149`), so the scanner structurally cannot exfiltrate content | ✓ |
| Path + metadata + markdown links | Adds a doc-to-doc link graph; requires reading every markdown body under the vault and `.claude` | |
| Paths only | Most conservative; loses size weighting and recency signal | |

**User's choice:** Path + metadata, never contents.

### Q2 — How should secret detection be built?

| Option | Description | Selected |
|--------|-------------|----------|
| Deny-by-default per root | Shareable only if allowlisted for its root; everything unmatched is sensitive. Fails closed | ✓ |
| Extend the donor's regex | Add the missed cases; still fails open on unanticipated shapes | |
| Regex + gitignore awareness | Adds gitignored-as-sensitive; does nothing outside git repos | |

**User's choice:** Deny-by-default per root.
**Notes:** Driven by a measurement, not a preference — the donor's `SECRET_RE` returned PUBLIC for
`selfhosted.envfile`, `.claude.json` and `.mcp.json`, all of which hold real credentials.

### Q3 — What happens to a file classified as secret?

| Option | Description | Selected |
|--------|-------------|----------|
| Omit from the snapshot entirely | Never leaves the host; a visible withheld count keeps the omission honest | ✓ |
| Ingest, flagged and access-locked | Mirrors the donor's `accessOf()`; useful for an audit lens but puts the paths in the DB | |
| Ingest a redacted placeholder | Directory + count, filenames replaced | |

**User's choice:** Omit entirely.
**Notes:** A filename can itself be a disclosure, so flagging is not sufficient.

---

## Scanner home

### Q1 — Where should the scanner live?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate script, shared helpers | New `hooks/workspaceScan.mjs` importing scanner.mjs's helpers; SessionStart untouched | ✓ |
| Extend `hooks/scanner.mjs` | Least duplication, but grows two very different trigger paths in one 338-line SessionStart file | |
| Standalone script under `~/scripts` | Cleanest separation; untested by the repo's suite | |

**User's choice:** Separate script, shared helpers.
**Notes:** `codepulse-hook.mjs` is wired at *user* scope for BOTH launchers, so it fires every
session — a vault + all-repos walk on that path breaks the fire-and-forget rule.

### Q2 — What triggers a scan?

| Option | Description | Selected |
|--------|-------------|----------|
| Nightly task + on-demand flag | Matches the design; launched via `run-hidden.vbs`, no battery gating | ✓ |
| On-demand only for now | Defers task registration until the classifier output has been reviewed | |
| Nightly + a UI rescan button | Needs a host-side listener beyond this phase's scope | |

**User's choice:** Nightly task + on-demand flag.

### Q3 — How should the walk be bounded?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit root list + donor exclude set | Named roots plus `EXCLUDE_DIRS`; predictable and reviewable | ✓ |
| + hard depth cap | Safer against runaway symlinks; risks silently truncating a deep repo | |
| Respect `.gitignore` inside repos | Prunes build output per-repo; pairs badly with deny-by-default secrets | |

**User's choice:** Explicit root list + donor exclude set.

---

## Department model & scan roots

### Q1 — What should the departments be?

| Option | Description | Selected |
|--------|-------------|----------|
| Work / Consulting / Personal | Mirrors Larry's own stated operating model; answers what a thing is FOR | ✓ |
| Artifact type (skills/memory/projects/docs) | Path-derivable, no mapping to maintain; blurs Work and Personal | |
| Repo/root-centric | Zero classification logic; adds little over Explorer | |

**User's choice:** Work / Consulting / Personal.

### Q2 — Where should classification rules live?

| Option | Description | Selected |
|--------|-------------|----------|
| Config JSON checked into the repo | Mirrors the donor's design; reviewable in a diff; makes the classifier a pure function | ✓ |
| Code constants | Simpler; retuning means editing code, untestable against alternate rule sets | |
| Config JSON outside the repo | Keeps the taxonomy out of a public repo; untracked and lost on rebuild | |

**User's choice:** Config JSON, checked in.

### Q3 — How is `access` determined?

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from astridr's compose bind mounts | Empirical and self-correcting; encodes that all mounts are `:ro` | ✓ |
| Hand-maintained prefix list | Explicit, no YAML parsing; a second source of truth that goes stale | |
| Skip access coloring this phase | Reduces scope; the design names it a C2 deliverable | |

**User's choice:** Derive from the bind mounts.

---

## Snapshot storage & the dry-run gate

### Q1 — Where should snapshots be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| New workspace tables, versioned pattern copied | First-class classification fields; owns a retention approach that actually runs | ✓ |
| Reuse `graphSnapshots` as-is | No new schema; lossy field encoding, and inherits a disabled sweep | |
| Reuse and fix the sweep first | Honest, fixes a live defect; puts a Phase-83 repair on this phase's critical path | |

**User's choice:** New workspace tables.
**Notes:** Decided after finding `crons.ts:145-151` — the graph-snapshot sweep is commented out,
labelled `DISABLED 2026-07-14 — times out on self-hosted Convex`.

### Q2 — How should growth be bounded?

| Option | Description | Selected |
|--------|-------------|----------|
| Prune inline at ingest, batch-capped | Bounded by construction, no cron dependency, never a mass delete | ✓ |
| Keep N versions via a working cron | Familiar; a cron can be silently disabled exactly as this one was | |
| Keep only the active version | Simplest bound; loses any workspace-over-time diff | |

**User's choice:** Prune inline at ingest.

### Q3 — How should the dry-run gate be enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| Report + ingest refuses without an approval marker | Structural gate; refusal must be mutation-tested | ✓ |
| Report, review is procedural | Less machinery; rests on discipline | |
| Dry-run by default, `--commit` to write | Safe default; does not force anyone to READ the output | |

**User's choice:** Report + enforced refusal.

---

## Granularity & department source

### Q1 — What is a node?

| Option | Description | Selected |
|--------|-------------|----------|
| Directories are nodes; files are counts | Collapses 21k+ files to a few hundred nodes; composes with the no-filenames secret decision | ✓ |
| Donor SPINE model | Per-file detail where it matters; needs an expansion query path and spine tuning | |
| Directories + files in leaf dirs | More edge detail; needs a cap or the bound is undone | |

**User's choice:** Directories are nodes.
**Notes:** Grounded in a measurement — 21,029 files across `.claude`, `.claude-alt` and the vault,
before any repos.

### Q2 — Where does the department mapping come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit config map; unmapped → Unclassified | Never silently defaults into a real department; dry-run surfaces the gaps | ✓ |
| Infer from git remote | Self-maintaining for repos; useless for vault/`.claude`, and guesses | |
| Vault project notes as source of truth | Reuses an existing source of truth; needs content reads, cutting against D-01 | |

**User's choice:** Explicit config map.

---

## Claude's Discretion

- Exact table/column names and index choice for the `workspace*` tables (within D-10/D-11).
- The concrete allowlist patterns for D-02 and the initial root list for D-06 — proposed by the
  planner, validated by the D-12 dry-run before first ingest rather than guessed at planning time.
- The config file's exact schema and location in the repo.
- The dry-run report's format, provided it carries the four required contents.

## Deferred Ideas

- Fixing `sweepGraphSnapshotVersions`' timeout so the Phase-83 sweep can be re-enabled (a real live
  defect, but Phase-83 scope).
- A CodePulse UI "rescan now" button.
- Standalone `brain.js` wiring for `~/.claude` memory (the design itself marks it out of scope).
- Vault project-note frontmatter as the department source (revisit only if the config map chafes).
- The donor's SPINE/expandable per-file model (revisit if directory granularity proves insufficient
  for Phase 114).

## Reviewed Todos (not folded)

- `111-devtools-issues-panel-entry-unexamined.md` — matched on generic keywords only; Phase 111
  follow-up.
- `llm-analytics-rollup-migration-cr01.md` — unrelated domain.
