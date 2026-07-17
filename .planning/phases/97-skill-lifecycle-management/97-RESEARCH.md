# Phase 97: Real Skill Intake & Daemon Foundation - Research

**Researched:** 2026-07-17
**Domain:** Cross-repo command-bridge execution (Convex ↔ Forge daemon ↔ Python CLI) — turning a dry-run validation pipeline into a real filesystem-writing one
**Confidence:** HIGH (all claims below are `[VERIFIED: live code]` — read directly from the three repos' current `master`/working trees and cross-checked against live host state; no training-data guesses on library APIs were needed for this phase)

## Summary

**Headline finding — this changes the shape of the plan:** the daemon-side execution machinery this phase's ROADMAP.md assumed did not exist **already exists and is merged to `forge`'s `master`** (branch `feat/forge-intake-daemon`, 15 commits, last commit `a364adf` 2026-07-16 — one day before this phase was scoped). `CommandPoller` already has a working `intake` branch: a startup capability probe (`probeIntakeCli`) gates `supportedTypes` to include `"intake"` only when the CLI is genuinely invocable, a serial (non-parallel) intake queue prevents a process stampede, and `createIntakeRunner` composes download-staging, GitHub default-branch resolution, and CLI invocation into a working `IntakeFn`. **DAEMON-04 (advertise supported types) is already done.** D-06's fan-out "resolve → confirm the set → install" UX is **already fully built end-to-end on the CodePulse client** (`useGithubTreeScan` hits the GitHub Trees API directly, `SkillCollectionPicker` renders the confirm checklist, and `IntakeModal.handleSubmit` already fires one `enqueueIntake` per confirmed skill) — this needs **zero new engineering**, only the copy changes the UI-SPEC already specifies.

What genuinely does **not** exist yet, confirmed by direct inspection: (1) the daemon never passes `--write` — every `admit` invocation today is dry-run-only by explicit code comment (`D-P6-01`), so nothing lands on disk; (2) `mapExitCodeToResult` only classifies exit codes `0/1/2/3` (the dry-run-only contract) — real writes reach exit codes `4`–`9`, which the current code dumps into a generic "unexpected exit code" bucket reading an **empty `stderr`** (the real refusal reason is on **stdout**, in plain text, not JSON); (3) DAEMON-03 (post-write registry rescan → `syncInventory`) has no implementation anywhere in the daemon; (4) the daemon has never called `--allow-unrecoverable`, which the CLI's own router **unconditionally requires** for `global`/`project` destinations (hardcoded, not a live gitignore check) — omitting it means every real `global`/`project` write will refuse with exit 4, 100% of the time, until this flag is added.

**Primary recommendation:** Phase 97's real engineering surface is narrower than scoped — it is (a) extend `buildAdmitArgs`/`mapExitCodeToResult` in `forge/src/process/intake-exec.ts` for real writes (add `--write` + conditional `--allow-unrecoverable`, map exit codes 4-9 correctly, extract the write-outcome message from stdout rather than assuming it lives in the JSON report), (b) build the DAEMON-03 rescan (genuinely new: walk `~/.claude/skills/`, `~/.claude/skills-available/`, and each synced workspace's `.claude/skills/`, parse SKILL.md frontmatter, POST to `registry.syncInventory`), and (c) one manual host precondition (`~/.claude/skill-intake.toml` with `[astridr] confirmed = true`) that is currently **absent** and will block every cold-storage install with exit 6 until created.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Upload/GitHub-URL input, destination picker, fan-out confirm UI | Browser/Client (CodePulse `IntakeModal`) | — | Already built; UI-SPEC-scoped copy deltas only |
| Command queue, auth, TTL, idempotency | API/Backend (Convex `forgeCommands`/`enqueueIntake`) | — | Already built (Phase 80/06); no change needed for intake queueing itself |
| GitHub fan-out enumeration (list candidate skills at a subpath) | Browser/Client (`useGithubTreeScan` → GitHub Trees API directly) | — | Client-side, already shipped; does NOT go through the daemon or skill-intake CLI |
| Command claim/dispatch, capability negotiation (`supportedTypes`) | Local Daemon (`forge` `CommandPoller`) | — | Already built and merged; probe-gated |
| Validate + write to host filesystem | Local Daemon → shells out to Python CLI (`skill-intake admit --write`) | — | D-02 locked: daemon never reimplements validate+write natively |
| Write-outcome exit-code classification (admit/reject/refuse/crash) | Local Daemon (`forge/src/process/intake-exec.ts`) | — | **Genuinely incomplete** — only handles the dry-run subset (0/1/2/3) today |
| Host skill inventory rescan + registry sync | Local Daemon (new) → Convex `registry.syncInventory` | — | **Not built at all** — DAEMON-03 is real new work |
| Registry storage, per-origin prune, UI reactivity | API/Backend (Convex `skills` table + `syncInventory`) | Browser/Client (`useQuery` auto-refresh) | Already built (pre-existing `/scan` pipeline); daemon just needs to feed it |
| Report rendering, verdict/finding display | Browser/Client (`IntakeReportView`) | — | Already built; shape matches skill-intake's `ReportEnvelope` 1:1 — **no adapter needed** for the validation-only case |
| Collision / refusal-reason UI copy (D-07) | Browser/Client + API/Backend | Local Daemon (must synthesize the actionable string) | **Gap**: `ReportEnvelope.findings` never carries router-refusal reasons — daemon must inject them |

## User Constraints (from CONTEXT.md)

<user_constraints>

### Locked Decisions

- **D-01:** Intake executor lives in the existing Forge daemon (`C:\Users\mandr\forge`, host `lmofficenew`) — extend `CommandPoller`. One daemon, one poller, one auth path. *(Confirmed already true — see Summary.)*
- **D-02:** The daemon shells out to the existing `skill-intake` Python package / `manage-skills` CLI to perform the validated write — never reimplements validate+write natively in TS. Daemon captures the tool's real report + exit code and surfaces it back through `forgeCommands` ack/report. Implication: daemon host must have Python + `skill-intake` available.
- **D-03:** After each successful write the daemon runs a full host skill rescan and posts the whole inventory snapshot to `registry.syncInventory` (upsert by name+origin + per-origin prune). Chosen over targeted single-skill upsert for host-truth guarantee and correct fan-out reconciliation.
- **D-04:** For `"project"` destination, target path resolved from synced Forge workspaces only — daemon maps `workspaceId` → absolute path, writes to `<workspace>/.claude/skills/<name>/`. No free-text host paths. *(Confirmed already true — `intake-runner.ts` already calls `getWorkspace(db, workspaceId)`.)*
- **D-05:** Public GitHub repos only this phase — no token handling. URL-shape + path-traversal guards already in `enqueueIntake` still apply.
- **D-06:** Multi-skill fan-out (one URL + subpath resolves to N skills): resolve → confirm the set → install. Candidates enumerated and user confirms before anything is written. **Research confirms**: this is fully built client-side already (see Summary/Open Questions) — no server-side dry-resolve mode is needed or exists.
- **D-07:** Phase 97 is first-install only — same-name collision at destination scope is a clean failed install with an actionable error (INTAKE-04), never a silent overwrite. Overwrite/update deferred; `isShadowing`-aware activation is Phase 98.

### Claude's Discretion

- Failure atomicity mechanics (temp-write-then-move vs in-place + cleanup) and "no partial directory on disk" — delegate to `skill-intake`'s own semantics where possible. **Research confirms**: `atomic_write.place_directory()` already guarantees this via `os.replace()` (atomic on NTFS) with rollback-on-exception; no daemon-side work needed.
- Cold-storage destination path convention (`.claude/skills-available/` / dormant origin) — follow existing `manage-skills`/registry convention. **Research confirms**: `skill-intake`'s own `DEFAULT_COLD_STORAGE_ROOT = ~/.claude/skills-available` matches this exactly.
- Exact `commandType`/payload shape for the daemon `intake` branch and how `supportedTypes` is extended — follow launch/stop precedent. **Research confirms**: already implemented exactly this way (`ForgeCommand.intakePayload`, `supportedTypes: intakeAvailable ? [...,'intake'] : [...]`).

### Deferred Ideas (OUT OF SCOPE)

- Private-repo GitHub auth (token storage / daemon secret handling) — future phase.
- Skill versioning/overwrite-update — Future Requirements; Phase 97 rejects same-name collisions (D-07).
- Lifecycle mutations (archive/restore/move/delete) + DAEMON-02 — Phase 98.
- Launch/dispatch to Chat/Forge-agent/Ástríðr — Phase 99.
- Control-surface UX (⋯ menu, drag lanes, in-app Cold Storage restore) — Phase 100.
- Bulk multi-select lifecycle actions and `importSkills` catalog bulk-import UI.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTAKE-01 | Upload SKILL.md, pick scope, file lands on host disk | `intake-runner.ts` download+stage path already works in dry-run; needs `--write` added to `buildAdmitArgs`. Convex upload→`storageId`→`downloadUrl` bridge already complete. |
| INTAKE-02 | Install from GitHub URL (+ optional subpath), URL-shape/path-traversal guards enforced pre-write | `github-ref.ts`'s `resolveIntakeTargetUrl` + `enqueueIntake`'s `isAcceptedGithubUrlShape`/`isSafeSubpath` already enforce guards client+server side before the command is even queued. Needs `--write` added. |
| INTAKE-03 | Skill appears on Skills page automatically post-install (daemon rescan, no manual refresh) | **No implementation exists.** New daemon module needed: walk skill roots, parse SKILL.md frontmatter, build `syncInventory` snapshot shape, POST after each successful `--write`. `registry.syncInventory`/`skillSync.ts` (upsert-by-name+origin, per-origin prune) already exist and are ready to receive it. |
| INTAKE-04 | Real execution/validation report surfaced; failed install = actionable error, no partial state | Report shape (`ReportEnvelope`) already renders correctly via `IntakeReportView` for validation-only outcomes. **Gap**: router-level write refusals (exit 4-7) and post-placement-but-loud outcomes (exit 8-9) are NOT represented in the JSON report — daemon must synthesize an actionable message from stdout text and inject it so `IntakeReportView`/D-07 copy can render it. Atomicity (no partial dir) already guaranteed by `atomic_write.place_directory()`. |
| DAEMON-01 | Daemon executes `intake` commands, validates then writes to destination scope | Execution harness (probe, serial queue, CLI invocation, timeout/kill) already built and merged. Only the `--write`/`--allow-unrecoverable` flag wiring and exit-code mapping extension are missing. |
| DAEMON-03 | Post-mutation full rescan re-syncs registry | Not built. See INTAKE-03. |
| DAEMON-04 | Daemon advertises supported command types so old daemons never claim unrunnable commands | **Already fully implemented and shipped** (`probeIntakeCli` → `supportedTypes: [...,'intake']` gate in `index.ts`). No work needed. |
</phase_requirements>

## Standard Stack

No new libraries are required for this phase. Every piece of infrastructure (Convex command queue, Fastify daemon, `cross-spawn`, `typer`/Python CLI) is already installed and in use across the three repos.

### Core (existing, reused)
| Component | Repo | Purpose | Status |
|-----------|------|---------|--------|
| `forgeCommands` queue + `CommandPoller` | codepulse (Convex) + forge | Command transport, claim/ack, TTL | Shipped (Phase 80/82) |
| `createIntakeRunner`/`runIntakeCli`/`probeIntakeCli` | forge | CLI invocation harness, spawn/timeout/kill, capability probe | Shipped 2026-07-16 (`feat/forge-intake-daemon`, merged to `master`) — **dry-run only today** |
| `skill-intake` CLI (`admit`, `--write`, `--to`, `--allow-unrecoverable`, `--allow-overwrite`) | skill-intake (Python, Typer) | Validate + atomic write, provenance ledger, cold-storage marker gate | Shipped; `--write` path is code-complete and tested in skill-intake's own suite, simply never invoked by the daemon yet |
| `~/.claude/scripts/skill-intake.py` shim | host | Runs the CLI via `uv run --directory <source>` (never `pip install`/import) | Present, `[VERIFIED: live check]` |
| `uv` (astral-sh) | host | Package/venv manager the shim depends on | Present, `uv 0.10.11`, `[VERIFIED: live check]` |
| `registry.syncInventory` / `skillSync.ts` | codepulse (Convex) | Upsert-by-(name,origin) + per-origin prune inventory sync | Shipped, already used by an existing `/scan` endpoint |

**No `npm install` / `pip install` needed for this phase.** The only genuinely new artifact is a **host config file** (`~/.claude/skill-intake.toml` with `[astridr] confirmed = true`) — not a package — required before any cold-storage write can succeed (see Pitfalls).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shell out to Python CLI (D-02, locked) | Reimplement validate+write in TS in the daemon | Rejected by CONTEXT.md — would fork install semantics from the canonical installer; not reconsidered here. |
| Daemon builds its own skill-directory scanner from scratch for DAEMON-03 | Reuse `skill_intake.provenance.report_query.scan()` | **Not viable as-is**: `report_query.scan()` only enumerates skills that went through `admit`'s provenance ledgers (cold-storage frontmatter + global/project JSON ledgers) — it does NOT walk the full active `~/.claude/skills/` tree for skills installed by other means (hand-copied, pre-existing). A full rescan for DAEMON-03 needs its own directory walk + SKILL.md frontmatter parse, matching whatever scanner already feeds today's `/scan` endpoint (not located in `forge` or `skill-intake` — likely an Ástríðr-side or standalone script; confirm exact source before duplicating). |

## Package Legitimacy Audit

**No external packages are installed by this phase.** All infrastructure (Convex, Fastify/`cross-spawn` in forge, Typer in skill-intake) is pre-existing and was vetted in prior phases. The `uv`/Python toolchain used by the shim is already present on the host (`uv 0.10.11`, `[VERIFIED: live check]`). Skip the legitimacy gate — nothing to audit.

## Architecture Patterns

### System Architecture Diagram

```
Browser (CodePulse IntakeModal)
  │  1. user picks file/GitHub URL + destination (global/project/cold)
  │  2. if GitHub URL: useGithubTreeScan() hits api.github.com/.../git/trees
  │     directly (client-only, no daemon/CLI involvement) → SkillCollectionPicker
  │     renders "N skills found" + confirm checklist (D-06, ALREADY BUILT)
  │  3. on confirm: one enqueueIntake() mutation call PER selected skill
  ▼
Convex (enqueueIntake mutation)
  │  - Clerk fail-closed auth
  │  - XOR(storageId, githubUrl) validation, GitHub URL-shape + subpath
  │    traversal guards (isAcceptedGithubUrlShape / isSafeSubpath) — ALREADY BUILT
  │  - inserts forgeCommands row: commandType="intake", status="queued"
  ▼
Convex (forgeCommandsClaim httpAction, bearer-authed)
  │  - daemon POSTs {hostId, supportedTypes} every 7s
  │  - claimAndUpsertHost atomically flips queued→executing for types the
  │    daemon declares (["launch","stop","intake"] iff probeIntakeCli() passed)
  │  - resolves storageId → downloadUrl (ephemeral, never persisted)
  ▼
Forge daemon (CommandPoller, host lmofficenew)  ── ALREADY BUILT, dry-run only ──
  │  - intake commands go to a SERIAL queue (never parallel — D-P8-06)
  │  - intake-runner.ts:
  │      · storageId path: fetch(downloadUrl) → write temp SKILL.md
  │      · githubUrl + subpath path: github-ref.ts resolves the real default
  │        branch via git Smart-HTTP info/refs, builds /tree/<branch>/<subpath>
  │      · destination="project": getWorkspace(db, workspaceId) → rootPath
  │  - buildAdmitArgs() constructs argv:
  │        ['admit', positional, '--to', dest, '--format', 'json']
  │      ⚠ MISSING: '--write' (never passed today — pure dry-run)
  │      ⚠ MISSING: '--allow-unrecoverable' when dest ∈ {global, project}
  │        (router.py UNCONDITIONALLY requires it for those two destinations
  │        — hardcoded, not a live gitignore check — omitting it => every
  │        real write to global/project refuses with exit 4, always)
  │  - runIntakeCli() spawns `python <shim> admit ...`, 2-min timeout,
  │    taskkill /T /F on timeout (Windows process-tree kill)
  ▼
skill-intake.py shim → uv run --directory <skill-intake source> skill-intake admit ...
  │  - re-syncs venv from uv.lock on every call (never stale, D-09)
  ▼
skill-intake CLI (Python, Typer) — admit command, `--write`
  │  1. resolve candidate (local path or GitHub fetch+extract)
  │  2. run_all() rule registry → build_report() → ReportEnvelope
  │     (verdict: admit|reject|error; findings[]; summary tally)
  │  3. router.compute_write_plan() — computes refusals BEFORE any write:
  │       - NO_UNRECOVERABLE_OVERRIDE (4): dest ∈ {global,project} and
  │         --allow-unrecoverable not passed — ALWAYS fires for those two
  │         destinations unless the flag is present
  │       - NO_OVERWRITE_OVERRIDE (5): dest exists, differs from candidate,
  │         --allow-overwrite not passed — THIS IS D-07's collision case;
  │         daemon must NEVER pass --allow-overwrite
  │       - ASTRIDR_MARKER_ABSENT (6): --to cold and
  │         ~/.claude/skill-intake.toml [astridr] confirmed != true
  │         ⚠ CURRENTLY ABSENT ON THIS HOST — every cold install will
  │         refuse with exit 6 until this file is created
  │       - PROJECT_GIT_TOPLEVEL_UNRESOLVED (7): --project path has no .git
  │  4. typer.echo(render_json(report))   ← FIRST stdout line, JSON
  │     typer.echo(render_write_plan(plan))  ← subsequent lines, HUMAN TEXT
  │  5. if --write: execute_write_plan() → atomic_write.place_directory()
  │     (os.replace, atomic on NTFS; rollback-on-exception; archives
  │     superseded version to a sibling dir rather than deleting it)
  │     - on refusal (4/5/6/7): outcome.exit_code set, outcome.message
  │       printed to STDOUT (not stderr!) via typer.echo(outcome.message)
  │     - on placement success + post-placement step failure (8/9): still
  │       "loud, not rolled back" — the skill IS on disk
  ▼
forge intake-exec.ts: mapExitCodeToResult(exitCode, stdout, stderr)
  │  ⚠ TODAY only handles 0/1/2/3 (the pre-existing dry-run-only contract,
  │    documented explicitly: "Exit-code contract (dry-run only — --write
  │    is NEVER passed, D-P6-01)"). Any other code → generic "unexpected
  │    exit code" using STDERR (which is EMPTY for router refusals — the
  │    real reason is later stdout lines, currently discarded).
  │  ⚠ MUST BE EXTENDED for 4-9 once --write is wired, and must capture the
  │    refusal reason from stdout (not just the first JSON line) so
  │    IntakeReportView / D-07's actionable-error copy has something to render.
  ▼
CommandPoller.executeIntake() → POST /forge-commands-ack {commandId, status, report, error}
  ▼
Convex ackCommand → forgeCommands row: status=done|failed, report=<capped JSON>
  ▼
CodePulse IntakeReportView — renders verdict/findings/summary (ALREADY BUILT,
shape matches ReportEnvelope 1:1, no adapter needed for the validation-clean case)

═══════════ SEPARATE, NOT YET BUILT (DAEMON-03/INTAKE-03) ═══════════

Forge daemon (new module, post-successful-write trigger)
  │  - walk ~/.claude/skills/ (global, gitignored active tree)
  │  - walk ~/.claude/skills-available/ (cold storage, git-tracked)
  │  - walk <workspace>/.claude/skills/ for each synced forgeWorkspaces row
  │  - parse each SKILL.md's frontmatter → {name, description, upstream, command}
  │  - build snapshot: {skills: [{name, origin, description, source, ...}], ...}
  ▼
POST to Convex /scan (scanEndpoint httpAction, bearer-authed) — reuses the
EXISTING endpoint/mutation (registry.syncInventory), which already does
upsert-by-(name,origin) + per-origin prune. No Convex-side change needed —
only the daemon-side snapshot builder + POST call are new.
```

### Pattern 1: Serial intake queue (already built)
**What:** Intake commands are pushed onto a private array and drained one at a time via `await` in a loop — never `Promise.all`/fire-and-forget like launch/stop.
**When to use:** Any command type that shells out to a CLI process (avoids a process stampede if the operator fans out N GitHub-subpath skills at once).
**Example:**
```typescript
// Source: forge/src/emit/command-poller.ts (live, merged)
private enqueueIntake(cmd: ForgeCommand): void {
  this.intakeQueue.push(cmd);
  if (!this.intakeDraining) {
    this.intakeDraining = true;
    void this.drainIntakeQueue();
  }
}
private async drainIntakeQueue(): Promise<void> {
  while (this.intakeQueue.length > 0) {
    const cmd = this.intakeQueue.shift()!;
    await this.executeIntake(cmd);
  }
  this.intakeDraining = false;
}
```

### Pattern 2: Capability probe gates advertised types (already built)
**What:** At daemon startup, spawn the exact CLI invocation a real command would use (with `--help` appended) and only declare `"intake"` in `supportedTypes` if it exits 0 within budget.
**When to use:** Any command type whose executability depends on host-local tooling that may not be present (python/uv here).
**Example:**
```typescript
// Source: forge/src/index.ts (live, merged)
const intakeAvailable = await probeIntakeCli(intakeCfg);
supportedTypes: intakeAvailable ? ['launch', 'stop', 'intake'] : ['launch', 'stop'],
intakeFn: intakeAvailable
  ? createIntakeRunner({ db, cfg: intakeCfg, tmpRoot: tmpRootFor(config) })
  : undefined,
```

### Pattern 3: Client-side fan-out enumeration, N independent commands (already built, D-06)
**What:** GitHub-tree scanning happens entirely in the browser against `api.github.com` — never through the daemon or CLI. The user confirms a checklist; on submit, one `enqueueIntake` fires per checked path, each becoming its own independent `forgeCommands` row.
**When to use:** Any "install N things from one source" UX where the enumeration source (here, GitHub's own API) is directly reachable from the browser and doesn't need server-side secrets.
**Example:**
```typescript
// Source: codepulse/src/components/skills/IntakeModal.tsx (live)
if (hasUrl && selectedSubpaths.length > 1) {
  await Promise.all(
    selectedSubpaths.map((subpath, i) =>
      enqueueIntake({ hostId, commandId: commandIds[i], destination, workspaceId, githubUrl, subpath })
    )
  );
}
```

### Anti-Patterns to Avoid
- **Assuming `report.verdict` reflects write success:** `ReportEnvelope.verdict` is set by `run_all()`/`build_report()` **before** `router.compute_write_plan()` runs. A validation-clean candidate that gets refused for router reasons (collision, missing `--allow-unrecoverable`, missing cold marker) still has `verdict: "admit"` in the JSON — the refusal is a *separate*, exit-code-driven outcome. Do not render `report.verdict` as if it were "was anything written."
- **Reading only `stderr` for the failure message on any non-0/1/2/3 exit code:** router refusals write their message to **stdout** via `typer.echo(outcome.message)` (no `err=True`). `mapExitCodeToResult`'s current catch-all reads `stderr.trim()`, which will be empty for exit 4-9 — producing a useless generic error instead of the real, already-actionable refusal reason.
- **Passing `--allow-overwrite`:** Never do this (violates D-07 directly) — the absence of this flag is precisely what turns a collision into exit 5 instead of a silent clobber. This is enforcement-for-free from the CLI, not something the daemon needs to detect itself.
- **Forgetting `--allow-unrecoverable` for `global`/`project`:** This is not conditional on any live gitignore-check — `router.py` hardcodes `requires_unrecoverable_override = destination in (GLOBAL, PROJECT)`. Omitting the flag means literally every real write to those two destinations fails, always, with a router refusal (exit 4) — not an edge case, the default case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skill validation rules (frontmatter, bloat, nesting, precedence, junction-escape) | A TS reimplementation of the rule registry | `skill-intake`'s existing `rules/registry.py` via CLI shell-out (D-02, locked) | Single source of truth; already comprehensive and tested |
| Atomic directory placement on Windows/NTFS (rename semantics, overwrite archival) | Custom `fs.rename`/`fs.rmdir` sequencing in TS | `skill-intake`'s `atomic_write.place_directory()` | Already handles the NTFS "empty dest still raises PermissionError" gotcha and rollback-on-exception; reimplementing risks reintroducing a data-loss bug this module was specifically hardened against |
| Collision detection at install time | A daemon-side "does this skill name already exist" pre-check | The CLI's own `NO_OVERWRITE_OVERRIDE` refusal (exit 5), triggered automatically by never passing `--allow-overwrite` | Free correctness — the CLI already does byte-identical-vs-different comparison (`trees_are_byte_identical`) so a harmless re-admit of unchanged content doesn't spuriously refuse |
| GitHub default-branch resolution for a subpath-scoped fetch | Assuming `main`/`master`/`HEAD` as a literal branch name | `github-ref.ts`'s `resolveIntakeTargetUrl` (already built) — parses the real `symref=HEAD:refs/heads/<name>` from Git's Smart-HTTP `info/refs` | A literal `HEAD` token in a `/tree/HEAD/<subpath>` URL is rejected by the CLI (`RefNotFoundError`, exit 2) — this is a real, already-solved gotcha, not hypothetical |
| Multi-skill fan-out enumeration for a GitHub subpath | A server-side "list all SKILL.md under this subpath" endpoint or a skill-intake dry-resolve mode | The already-shipped client-side `useGithubTreeScan` (direct GitHub Trees API call) | Confirmed no CLI-side dry-resolve mode exists or is needed — D-06 is fully solved client-side already |

**Key insight:** Nearly everything Phase 97's requirements ask for at the *validation and placement* layer is already built, either in `skill-intake` (Python) or in `forge`'s existing dry-run intake harness. The actual delta is thin: flip on `--write` correctly (with its two required companion flags), extend the exit-code→outcome mapping to cover the write-specific codes, and build the one genuinely-missing piece (DAEMON-03's rescan).

## Common Pitfalls

### Pitfall 1: `--allow-unrecoverable` omission silently fails every global/project write
**What goes wrong:** Every real `--write` to `global` or `project` destinations refuses with exit 4 (`NO_UNRECOVERABLE_OVERRIDE`), 100% of the time.
**Why it happens:** `router.py`'s `compute_write_plan()` hardcodes `requires_unrecoverable_override = destination in (Destination.GLOBAL, Destination.PROJECT)` — it is **not** a live check of whether the target tree is actually gitignored. `buildAdmitArgs` in `forge/src/process/intake-exec.ts` currently never appends this flag.
**How to avoid:** `buildAdmitArgs` must append `--allow-unrecoverable` whenever `destination !== 'cold'`. Cold storage is git-tracked by design and must **never** get this flag (its own gate is the ASTRIDR-01 marker, Pitfall 2).
**Warning signs:** Every global/project intake command acks `failed` with an exit-4-shaped stderr-empty error immediately after `--write` is turned on; a smoke test against `global`/`project` destinations is the fastest way to catch this before it reaches a user.

### Pitfall 2: Cold-storage confirmation marker is absent on this host today
**What goes wrong:** Every `--to cold --write` install refuses with exit 6 (`ASTRIDR_MARKER_ABSENT`).
**Why it happens:** `skill-intake`'s `astridr_marker.load_astridr_confirmation()` requires `~/.claude/skill-intake.toml` to contain a `[astridr]` table with `confirmed = true`. `[VERIFIED: live check]` — this file **does not currently exist** on `lmofficenew` (`cat` returned "No such file or directory"). This is a deliberate, hand-edited-only gate (`astridr_marker.py`'s own docstring: "The marker lives in a file only Larry hand-edits and no code in this codebase ever writes this key").
**How to avoid:** This is a one-time **manual host setup step**, not a code change — create `~/.claude/skill-intake.toml` with:
```toml
[astridr]
confirmed = true
```
Flag this as a `checkpoint:human-verify` task in the plan, gating the cold-storage success-criteria test. Do not attempt to have the daemon or any Phase 97 code write this key — that would defeat the gate's entire purpose (T-4-ForgedMarker in the source comments explicitly documents that no code path may ever set this).
**Warning signs:** Cold-storage installs consistently ack `failed` with an exit-6 shaped error while global/project installs (once Pitfall 1 is fixed) succeed.

### Pitfall 3: Write-outcome refusal reason lives on stdout (not stderr), and outside the JSON report
**What goes wrong:** `mapExitCodeToResult` today only special-cases exit codes 0/1/2/3 (documented explicitly as "dry-run only" in the code's own header comment). Exit codes 4-9 — which only become reachable once `--write` is passed — fall into the generic branch, which reads `stderr.trim()`. But router refusals print their message via `typer.echo(outcome.message)` with **no `err=True`**, i.e., to **stdout**, as text *after* the first JSON line. `stderr` will be empty. The result: instead of the CLI's own already-actionable refusal text ("X already exists and differs from the candidate — pass --allow-overwrite to write here"), the daemon reports a useless "Intake CLI exited with unexpected code 5" with no detail.
**Why it happens:** `parseIntakeStdout` intentionally only parses the FIRST physical line as JSON (by design, for the validation report) — everything after that (the human-readable write-plan manifest + outcome message) is currently discarded entirely by `mapExitCodeToResult`.
**How to avoid:** Extend `mapExitCodeToResult` (and/or `parseIntakeStdout`) so that for exit codes 4-9: (a) still parse the first line as the `ReportEnvelope` (it is always present and valid — validation ran before any router decision), AND (b) capture the remaining stdout lines (or a specific known-format extraction of `outcome.message`) as the actionable failure/warning text, then have the daemon compose an `IntakeResult` whose `report`/`error` fields let CodePulse render the D-07 collision copy pattern correctly. This is new code this phase must write — it does not exist today in any form.
**Warning signs:** A collision-test install shows a green "Admit" verdict badge with no findings, rather than the actionable "A skill named X already exists..." error the UI-SPEC mandates.

### Pitfall 4: Exit codes 8/9 are "loud, not rolled back" — the skill IS on disk despite a non-zero exit
**What goes wrong:** Treating exit 8 (`EXIT_CATALOG_REGEN_FAILED_AFTER_PLACEMENT`) or 9 (`EXIT_LEDGER_WRITE_FAILED_AFTER_PLACEMENT`) as a plain failure and reporting "nothing was written" (per the UI-SPEC's mandatory "Nothing was written" clause for generic failures) would be **factually wrong** — the atomic skill placement already succeeded; only a secondary bookkeeping step (catalog regen / provenance ledger write) failed afterward.
**Why it happens:** `skill-intake`'s own design philosophy here is "report, don't roll back" (explicit in `cli.py`'s docstring) — since the atomic write already committed, rolling back would itself be a second risky filesystem operation.
**How to avoid:** The daemon's exit-code mapping must NOT lump 8/9 into the same "failed, nothing written" bucket as 4/5/6/7. Surface them as a distinct partial-success/warning state (the skill installed; a secondary step needs attention) — INTAKE-04's "leaves no partial state on disk" guarantee is actually satisfied here (the skill IS there), so the UI's "Nothing was written" copy must not fire for these two codes specifically.
**Warning signs:** A skill that visibly appears on the Skills page after a rescan, while its intake command row still reads "failed — nothing was written" — a directly self-contradicting UI state.

### Pitfall 5: DAEMON-03's rescan needs a purpose-built scanner — no existing function enumerates "every active skill"
**What goes wrong:** Assuming `skill_intake.provenance.report_query.scan()` (the function backing the CLI's `report` command) can be reused as the DAEMON-03 rescan source.
**Why it happens:** `report_query.scan()` only enumerates skills that have gone through `admit`'s provenance-tagging (cold-storage frontmatter + global/project JSON ledgers) — it explicitly does NOT read or recompute the actual installed skill directory tree (`global_skills_root` parameter is accepted for signature parity but "not consulted," per its own docstring). Skills installed by other means (hand-copied, pre-existing before `skill-intake` existed) would be silently excluded from a rescan built on this function, causing DAEMON-03's per-origin prune to delete them from the registry as "no longer present."
**How to avoid:** Build the rescan as a genuine filesystem walk of `~/.claude/skills/` (global), `~/.claude/skills-available/` (cold), and each `forgeWorkspaces` row's `<rootPath>/.claude/skills/` (project) — parsing each `SKILL.md`'s frontmatter directly — mirroring whatever scanner already feeds today's `/scan` endpoint (confirm and reuse its origin-string conventions, e.g. `"claude-code[:available|:project:<key>]"` per `schema.ts`'s own comment, rather than inventing a new taxonomy).
**Warning signs:** A skill that was manually placed (not via intake) disappears from the registry after the first daemon rescan.

### Pitfall 6: ACL landmine flagged in CONTEXT.md does not currently reproduce
**What goes wrong / clarification:** CONTEXT.md flags a "known landmine" — Phase 82's codex-sandbox ACL block on `~/.claude/skills/`, fixed via `icacls ... /grant` in `promoteWorkspace`.
**Live verification:** `icacls "$HOME/.claude/skills"` on `lmofficenew` today shows `LMOFFICENEW\mandr:(I)(OI)(CI)(F)` — Full Control, inherited — alongside `CodexSandboxUsers` with Modify. The daemon runs as this same interactive user (`forge/src/config/acl.ts` explicitly uses `USERDOMAIN\USERNAME`, not a service account). **`[VERIFIED: live check]` — no ACL block currently exists on this path**; `promoteWorkspace`'s icacls grant is scoped to promoted *workspace* directories for job-artifact writes, a different mechanism from skill destinations.
**How to avoid:** Do not spend plan effort pre-emptively re-applying `promoteWorkspace`'s icacls grant to skill directories — it is unrelated machinery and the live ACL state already permits the daemon's writes. If a write nonetheless fails with EPERM during execution, treat that as a fresh, host-specific finding to debug then — not a known/expected blocker.

## Code Examples

### Current dry-run-only argv builder (needs extension)
```typescript
// Source: forge/src/process/intake-exec.ts (live, current state)
export function buildAdmitArgs(
  positional: string,
  destination: IntakePayload['destination'],
  projectRootPath: string | null,
): string[] {
  if (destination === 'project') {
    if (projectRootPath === null) {
      throw new Error('buildAdmitArgs: projectRootPath is required for destination "project"');
    }
    return ['admit', positional, '--to', 'project', '--project', projectRootPath, '--format', 'json'];
  }
  return ['admit', positional, '--to', destination, '--format', 'json'];
  // ⚠ Never appends --write. Never appends --allow-unrecoverable.
}
```

### The full exit-code contract this phase must map (from skill-intake's own cli.py docstring)
```
0 = admit (validation clean; write succeeded if --write)
1 = reject / quarantine (validation found an ERROR-severity finding)
2 = bad CLI args / candidate resolution failure (no ReportEnvelope constructed at all)
3 = internal crash or audit-guard violation
--- exit codes below only reachable with --write ---
4 = refused: unrecoverable (gitignored) destination, --allow-unrecoverable not passed
5 = refused: destination exists and differs from candidate, --allow-overwrite not passed  ← D-07's collision case
6 = refused: --to cold and ASTRIDR-01 marker absent from ~/.claude/skill-intake.toml
7 = refused: --to project and --project path has no resolvable git top-level
8 = placed successfully, but CATALOG.md regeneration failed afterward (loud, not rolled back)
9 = placed successfully, but a post-placement provenance/ledger write failed (loud, not rolled back)
```

### The CLI command CodePulse's own UI already assumes will exist (corroborating evidence for D-02)
```typescript
// Source: codepulse/src/components/skills/IntakeReportView.tsx (live, already shipped)
const command = `skill-intake admit ${quoteArg(src)} --to ${destination} --write${
  destination === "project" ? ` --project ${quoteArg(workspace?.rootPath ?? "<workspace path>")}` : ""
}`;
// This reconstructed "copy the equivalent CLI command" string ALREADY includes --write —
// the UI author anticipated exactly this phase's change.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| ROADMAP.md's framing: "the Forge daemon does not execute intake" | The daemon DOES execute intake — in dry-run-only mode | Merged `feat/forge-intake-daemon` → `master`, 2026-07-16 (commit `a364adf`), one day before this phase's roadmap/context were written | Phase 97's actual remaining scope is narrower — mostly flag-wiring + exit-code mapping + the new DAEMON-03 rescan, not building the daemon execution harness from scratch |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The existing scanner that currently feeds CodePulse's `/scan` endpoint (populating today's live `skills` table) lives outside `forge` and `skill-intake` (likely astridr-repo or a standalone script) — not located in this research session. | Don't Hand-Roll / Pitfall 5 | If a suitable scanner does exist inside `forge` already, DAEMON-03 could reuse/extend it rather than building fresh — worth a 10-minute grep of astridr-repo/other scripts before starting DAEMON-03 implementation. Low risk either way — building fresh is safe, just possibly redundant. |
| A2 | `INTAKE_TIMEOUT_MS = 120_000` (2 minutes, set for the dry-run-only contract) is sufficient once `--write` is added — the actual file-placement step (`os.replace`) is fast; the slow part (network fetch/extract) is unchanged by adding `--write`. | Code Examples / Architecture | If large-repo GitHub fetches occasionally exceed 2 minutes, installs would time out and `taskkill` the process mid-write — but `place_directory`'s atomicity means a killed process can only ever leave the pre-write state or a fully-placed state, never a partial one, so this is a UX/retry concern, not a data-integrity one. |

**Risk profile:** Both assumptions are LOW risk — neither blocks correct behavior if wrong, only efficiency (A1) or retry UX (A2).

## Open Questions (RESOLVED)

1. **Where does today's live `/scan` snapshot come from?** — **RESOLVED: low-risk either way, deferred** (Plan 02 builds a fresh directory walk, which is correct regardless of any pre-existing astridr-side walker; reusing one would be an efficiency optimization only, not a correctness gate).
   - What we know: `convex/scan.ts`'s `scanEndpoint` and `registry.syncInventory` are live and already populate the `skills` table for some existing feeder (per `origin` values like `"native"`, `"bridge"`, `"cc"`, `"claude-code[:...]"` seen in `schema.ts` comments).
   - What's unclear: which script/service currently calls `POST /scan` — not found in `forge` or `skill-intake`; likely astridr-repo or a manual script outside GSD-tracked repos for either.
   - Recommendation: a 10-minute grep of astridr-repo's own tools/scripts before starting DAEMON-03 work, to decide "reuse an existing walker" vs. "write fresh" — either path is viable, this only affects effort/consistency, not correctness (see A1).

2. **Exact wire format for a synthesized write-refusal message (Pitfall 3).** — **RESOLVED: adapter is Convex-side, per Plan 05** (Plan 01's daemon emits a structured `write-refused:<kind>:` / `post-placement-warning:<kind>:` error string with the report kept verbatim per D-P8-10; Plan 05's `ackCommand` adapter `synthesizeWriteRefusalReport` composes the house copy into BOTH `error` and a synthetic `report.findings` entry — the `error` half is required because IntakeSheet's failed branch renders only `row.error`).
   - What we know: the CLI's refusal reason is human-readable prose in `outcome.message` (e.g., `"{path} already exists and differs from the candidate -- pass --allow-overwrite to write here"`), printed to stdout after the JSON report line.
   - What's unclear: whether to (a) regex/string-extract this from the daemon's captured stdout and inject it as a synthetic `finding` in the report object before acking (keeping `IntakeReportView` unchanged, per UI-SPEC's stated preference), or (b) add a new top-level field the daemon composes (e.g. `{...report, writeRefusal: {code, reason}}`) that CodePulse's server-side ack handler adapts.
   - Recommendation: plan-phase should decide this explicitly — UI-SPEC already anticipates "if plan-phase research finds the real skill-intake report shape diverges, an adapter belongs in `convex/forge.ts` (server-side), not a new UI branch." The synthetic-finding approach (a) is the more surgical fit: it reuses `IntakeReportView`'s existing `findings` table with zero UI changes beyond what UI-SPEC already specifies, by having the daemon (or a Convex-side adapter in `ackCommand`) inject a `{rule_id: "write-refused", severity: "error", message: <extracted reason>}` finding and flip a synthesized `verdict` when the write outcome (not the validation outcome) failed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `uv` (astral-sh) | Shim's `uv run --directory` invocation | ✓ `[VERIFIED: live check]` | 0.10.11 | Shim already fails loud with an install command if absent (exit 3) — no daemon-side fallback needed |
| `C:/Users/mandr/skill-intake` source checkout | Shim's `SKILL_INTAKE_SOURCE` hardcoded path | ✓ `[VERIFIED: live check]` | current `master`, `admit --write` code-complete | — |
| `~/.claude/scripts/skill-intake.py` shim | `resolveIntakeCfg()`'s default `FORGE_INTAKE_CLI` path | ✓ `[VERIFIED: live check]` | — | `FORGE_INTAKE_CLI` env var override exists if the shim path ever needs to change |
| `~/.claude/skill-intake.toml` with `[astridr] confirmed = true` | Cold-storage writes only (exit 6 gate) | ✗ `[VERIFIED: live check — file absent]` | — | **No code fallback by design** — must be manually created (checkpoint:human-verify). Global/project destinations are unaffected. |
| `~/.claude/skills/` ACL state | Daemon's write access for global-destination installs | ✓ `[VERIFIED: live check]` — `LMOFFICENEW\mandr:(F)` inherited | — | — |
| `forge` daemon running with `CONVEX_FORGE_INGEST_URL` + `FORGE_INGEST_API_KEY` set | Command bridge (claim/ack) to function at all | Not verified this session (runtime state, not repo state) — confirm live at execution time | — | Command bridge already logs a clear "disabled" message when unset; no silent failure mode |

**Missing dependencies with no fallback:**
- `~/.claude/skill-intake.toml` `[astridr]` marker — blocks cold-storage only, until manually created.

**Missing dependencies with fallback:**
- None beyond the marker above; everything else needed is already present and verified live.

## Validation Architecture

### Test Frameworks (three repos, three frameworks)
| Repo | Framework | Config | Quick run | Full suite |
|------|-----------|--------|-----------|------------|
| codepulse | Vitest | `vite.config.ts` | `npx vitest run convex/forge.test.ts` | `npm test` |
| forge | Vitest | `vitest.config.ts` | `npx vitest run src/process/intake-exec.test.ts src/emit/command-poller.test.ts` | `npm test` (= `vitest run`) |
| skill-intake | pytest | `pyproject.toml` `[tool.pytest.ini_options]` | `uv run pytest tests/ -k admit` | `uv run pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAEMON-01 | `buildAdmitArgs` appends `--write` + conditional `--allow-unrecoverable` | unit | `npx vitest run src/process/intake-exec.test.ts` (forge) | ✅ file exists, needs new cases — Wave 0 |
| DAEMON-01 | `mapExitCodeToResult` correctly classifies exit codes 4-9 | unit | `npx vitest run src/process/intake-exec.test.ts` (forge) | ✅ file exists, needs new cases — Wave 0 |
| INTAKE-04 | Collision (exit 5) surfaces the actionable D-07 copy pattern | unit + manual | `npx vitest run convex/forge.test.ts` (codepulse, if adapter lands server-side) + live UAT | ⚠ Wave 0 — adapter location undecided (Open Question 2) |
| INTAKE-03 / DAEMON-03 | Rescan snapshot builder produces a valid `syncInventory`-shaped payload | unit | new test file, forge | ❌ Wave 0 — module doesn't exist yet |
| INTAKE-03 | Post-rescan, Skills page reflects new skill with no manual refresh | manual (Convex reactivity, no new transport) | live UAT | N/A — relies on existing reactive `useQuery`, no new test needed |
| INTAKE-01/02 | Live end-to-end: real file lands on disk, at correct scope | manual (cross-repo, requires live daemon + real filesystem) | operator checkpoint | N/A — cannot be meaningfully unit-tested; requires a live round-trip |

### Sampling Rate
- **Per task commit:** run the relevant repo's quick-run command (forge or codepulse, whichever file changed).
- **Per wave merge:** full suite in whichever repo(s) touched that wave; cross-repo waves need both `forge`'s and `codepulse`'s full suites green.
- **Phase gate:** full suite green in both `forge` and `codepulse` before `/gsd:verify-work`; skill-intake's own suite is NOT expected to change this phase (no code changes needed there — the `--write` path is already complete and tested on the skill-intake side).

### Wave 0 Gaps
- [ ] `forge/src/process/intake-exec.test.ts` — extend with cases for `--write`/`--allow-unrecoverable` argv construction and exit-code-4-9 classification (file exists, needs new `describe` blocks)
- [ ] A new forge module + test file for the DAEMON-03 rescan snapshot builder (module does not exist yet — name/location is a plan-phase decision)
- [ ] Decide and scaffold the Open-Question-2 adapter location (daemon-side vs. Convex `ackCommand`-side) before writing its test

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V4 Access Control | yes | Clerk fail-closed auth on `enqueueIntake` (already shipped); bearer-authed `/forge-commands-claim`/`/forge-commands-ack` (already shipped, `FORGE_INGEST_API_KEY`) |
| V5 Input Validation | yes | GitHub URL-shape regex (ported 1:1 from skill-intake's own `github_url.py`) + subpath path-traversal rejection (`isSafeSubpath` — rejects `..`, leading slash, Windows drive-letter absolute/relative paths) — already shipped and unit-tested |
| V6 Cryptography | no | Not applicable — no new cryptographic operations this phase |
| V12 File/Resource Handling | yes | Atomic placement (`os.replace`, same-volume staging dir) prevents partial writes; 1 MB upload cap (`MAX_INTAKE_UPLOAD_BYTES`) already enforced server-side before a command is even queued |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Path traversal via `subpath` (`../../` escaping the candidate tree) | Tampering | `isSafeSubpath` (client+server, already shipped) rejects `..` segments, leading slash/backslash, and Windows drive-letter prefixes before a command is ever queued |
| Symlink/junction escape inside an uploaded or fetched skill directory | Tampering / Information Disclosure | `skill-intake`'s `audit_guard.arm()`/`disarm()` scoping + `walk_candidate_tree()`'s junction-skip (never followed, never byte-copied as if real) — this is `skill-intake`'s own hardening, not something Phase 97 needs to add |
| A malicious SKILL.md's content reaching raw HTML injection in the report UI | Tampering | `IntakeReportView` renders every report-derived string via React's default JSX escaping — no `dangerouslySetInnerHTML` anywhere in that file (already verified in the component's own security comment + this session's read) |
| Cross-repo command replay / duplicate `commandId` | Tampering | `enqueueIntake`'s idempotent-by-`commandId` no-op (WR-04) — already shipped |
| A refused-write's error text (derived from an attacker-controlled skill/repo name) breaking out of the reconstructed copyable CLI command string | Tampering (XSS-adjacent, terminal injection) | `IntakeReportView`'s `quoteArg()` already escapes embedded double quotes in `src`/`workspace.rootPath` before interpolating into the copyable command string — extend the same discipline to any new refusal-reason text surfaced by Pitfall 3's fix, since that text can contain an attacker-influenced path/skill name |

## Sources

### Primary (HIGH confidence — live code read this session)
- `C:\Users\mandr\codepulse\convex\forge.ts`, `forgeCommands.ts`, `registry.ts`, `skillSync.ts`, `schema.ts` — full command-queue, ack, and registry-sync contract
- `C:\Users\mandr\codepulse\src\components\skills\IntakeModal.tsx`, `IntakeReportView.tsx`, `SkillCollectionPicker.tsx`, `src\hooks\useGithubTreeScan.ts`, `useIntake.ts` — client-side intake UX, confirmed fan-out already built
- `C:\Users\mandr\forge\src\emit\command-poller.ts`, `intake-runner.ts`, `intake-config.ts`, `intake-types.ts`, `intake-probe.ts`, `github-ref.ts`, `src\process\intake-exec.ts`, `src\index.ts` — daemon-side intake execution harness (confirmed merged to `master`, `git log` verified commit `a364adf` 2026-07-16)
- `C:\Users\mandr\skill-intake\src\skill_intake\cli.py`, `routing\router.py`, `routing\plan.py`, `routing\atomic_write.py`, `routing\astridr_marker.py`, `provenance\destination.py`, `provenance\report_query.py`, `paths.py`, `rules\base.py`, `report\schema.py` — full `admit`/`--write` contract, exit-code map, atomicity guarantees, cold-storage marker gate
- Live host checks: `git log`/`git branch` (forge, confirms merge to master), `icacls` (confirms no ACL block), `uv --version` (confirms toolchain present), `cat ~/.claude/skill-intake.toml` (confirms marker absent)

### Secondary / Tertiary
None — every claim in this document was verified directly against live repository code or live host state this session; no WebSearch or training-data-only claims were needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, every claim verified against live `package.json`/`pyproject.toml`/installed toolchain
- Architecture: HIGH — full execution path read end-to-end across all three repos, including exact exit-code semantics from source
- Pitfalls: HIGH — each pitfall is a direct code-read finding (e.g., `requires_unrecoverable_override` hardcoded destination check, marker-file absence confirmed via live `cat`), not inferred

**Research date:** 2026-07-17
**Valid until:** 14 days (fast-moving — the daemon-side intake harness was merged the day before this research and is clearly still under active iteration; re-verify `forge`'s `master` HEAD hasn't moved before planning executes)
