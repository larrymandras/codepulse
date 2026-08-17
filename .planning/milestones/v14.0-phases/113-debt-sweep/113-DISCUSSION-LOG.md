# Phase 113: Debt Sweep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 113-debt-sweep
**Areas discussed:** Prune-safety policy (DEBT-05), Prune-refusal visibility (DEBT-05), Flake-capture bar (DEBT-06), convex-selfhost repo shape (DEBT-07)

---

## Todo cross-reference

| Option | Description | Selected |
|--------|-------------|----------|
| Fold neither | Both matched on generic keywords, not on 113's domain; they keep their own triggers | ✓ |
| Fold both into 113 | Adds a UI investigation and a Medium-scoped migration to a small-sweep phase | |
| Fold only the devtools badge | Cheap, but it is Phase 111's finding | |

**User's choice:** Fold neither.
**Notes:** The first pass returned all three options selected (mutually exclusive under multiSelect) and was re-asked as a single-select to disambiguate.

---

## Prune-safety policy (DEBT-05)

### Where the guard lives

| Option | Description | Selected |
|--------|-------------|----------|
| Both, producer + server | Scanner stops emitting an indistinguishably-partial snapshot AND `computeSkillPrunes` independently refuses; also covers producers we don't control | ✓ |
| Server-side only | One place, fully unit-testable, protects against any malformed producer — but the scanner keeps silently lying about coverage | |
| Producer-side only | Fixes the root cause at origin — but leaves the server trusting any snapshot | |

**User's choice:** Both, producer + server.

### Plugin-skill origin split

| Option | Description | Selected |
|--------|-------------|----------|
| Split, plus keep the guard | Distinct origin makes the failure mode structurally impossible; follows the `claude-code:available` precedent; needs a one-time re-origin | ✓ |
| Don't split — guard only | No migration, no orphan risk — but the two sub-sources stay conflated | |
| You decide | Let research measure migration safety on the live instance first | |

**User's choice:** Split, plus keep the guard.
**Notes:** Live counts were read during the discussion (`migrations:listSkillOrigins`, 701 rows, `claude-code` = 188), which is what made the migration question answerable rather than speculative.

### Guard shape

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit coverage declaration | Extends the existing `scannedOrigins` manifest; deterministic, no tuning, a scanner bug fails safe | ✓ |
| Magnitude threshold | Simple and cause-agnostic — but a heuristic with a number to tune, and it refuses legitimate large cleanups | |
| Soft-delete with grace period | Most forgiving of transient scans — but adds a row lifecycle state and a sweeper | |

**User's choice:** Explicit coverage declaration.

### Re-origin of existing rows

| Option | Description | Selected |
|--------|-------------|----------|
| One-shot migration derived from `source` | Deterministic and dry-runnable from data already stored; 188 rows; reuses the existing batch pattern | ✓ |
| Let the next scan self-heal it | No migration code — but heals via the exact prune path being hardened, and the new guard would likely refuse it | |
| No migration — tolerate duplicates | Cheapest — but leaves a permanently orphaned origin | |

**User's choice:** One-shot migration derived from `source`.

---

## Prune-refusal visibility (DEBT-05)

### What the operator sees

| Option | Description | Selected |
|--------|-------------|----------|
| Write an `alerts` row | Reuses the existing table with severity/acknowledge/webhook; closes the gap that let 185→131→185 go unnoticed | ✓ |
| Log line only | Zero new writes — but effectively invisible, which is why this went undiagnosed | |
| Alerts row + Skills page indicator | Most informative at point of use — but adds UI work to a non-UI phase | |

**User's choice:** Write an `alerts` row.

### Coverage logging

| Option | Description | Selected |
|--------|-------------|----------|
| Refusals only | Every row meaningful, no per-scan write on a memory-pressured backend | ✓ |
| Record coverage on every scan | Catches a source that quietly stops being scanned — but a new write per cycle plus a retention entry | |

**User's choice:** Refusals only.

### Scanner behaviour on a failed sub-source read

| Option | Description | Selected |
|--------|-------------|----------|
| Emit, but don't declare that source covered | Unrelated sources stay current, the failed one is simply not prunable; pairs with the coverage guard | ✓ |
| Abort the whole scan | Impossible to get subtly wrong — but one flaky read freezes the entire catalog | |
| Retry, then emit undeclared | Recovers from a genuine mid-write read — but adds retry logic to a hook that must stay fire-and-forget | |

**User's choice:** Emit, but don't declare that source covered.

---

## Flake-capture bar (DEBT-06)

### Capture mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Retained output + DOM instrumentation | The string diff can't discriminate the stale-duplicate-element hypothesis; the DOM dump can, and can stay in permanently | ✓ |
| Retained output only | Cheapest, zero code change — but insufficient if the answer is a duplicate element | |
| DOM instrumentation only | No soak cost — but seen once in ~12 runs, so the phase can't close on it | |

**User's choice:** Retained output + DOM instrumentation.
**Notes:** Discussion surfaced that the deferred item's premise ("the run that failed did not record it") is probably wrong — a `toBe` string mismatch normally prints both sides, so the missing piece was likely output retention, not instrumentation. Recorded in CONTEXT.md as requiring a control before planning relies on it.

### Soak shape

| Option | Description | Selected |
|--------|-------------|----------|
| Full suite, repeated | The only shape that can reproduce cross-file contamination; matches the conditions of the observed failure | ✓ |
| File in isolation, high repeat count | Hundreds of cheap iterations — but green forever if the cause is cross-file, i.e. a false all-clear | |
| Both, isolation first | Ordered by cost — but slower to a definitive answer when the cause is cross-file | |

**User's choice:** Full suite, repeated.

### Exit bar if it doesn't reproduce

| Option | Description | Selected |
|--------|-------------|----------|
| Ship the instrumentation, close as guarded | Next occurrence is self-diagnosing rather than lost; masks nothing; requires amending DEBT-06's wording to match | ✓ |
| Leave DEBT-06 open, close the other two | Most rigorous — but the phase can never complete on a defect that may never reproduce on demand | |
| Decide at the checkpoint | Evidence-informed — but leaves the planner without a definite acceptance criterion | |

**User's choice:** Ship the instrumentation, close as guarded.

### Seiðr e2e flakiness

| Option | Description | Selected |
|--------|-------------|----------|
| Stays out | Its fix is a repo-wide playwright.config change; cause already understood; different investigation | ✓ |
| Fold it in | Both flake instances in one sweep — but a repo-wide config change inside a small-sweep phase | |

**User's choice:** Stays out.

---

## convex-selfhost repo shape (DEBT-07)

### Location

| Option | Description | Selected |
|--------|-------------|----------|
| Its own PRIVATE repo | No exposure risk from a directory holding live credentials and forensic notes; separate cadence | ✓ |
| Own repo, local only, no remote | Version control with no publishing decision — but a disk loss takes the recovery scripts too | |
| `ops/convex-selfhost/` inside codepulse | One repo, in lockstep — but codepulse is PUBLIC, so one careless `git add` publishes a live admin key | |

**User's choice:** Its own PRIVATE repo.
**Notes:** `gh repo view` was run during the discussion and returned `"isPrivate":false,"visibility":"PUBLIC"` for codepulse, which is what removed the third option from contention.

### Committed scope

| Option | Description | Selected |
|--------|-------------|----------|
| Compose + scripts + bootstrap README | Exactly what the requirement asks, plus the thing that makes "reproducible" true rather than asserted | ✓ |
| Also the operational notes | Genuine history — but host paths and container internals make a later public decision costly | |
| Compose + scripts only | Smallest change — but a checkout with no instructions isn't reproducible | |

**User's choice:** Compose + scripts + bootstrap README.

### Secrets

| Option | Description | Selected |
|--------|-------------|----------|
| `.gitignore` + committed `.example` templates | A fresh checkout knows exactly what to supply; templates built from documented key names only | ✓ |
| `.gitignore` only, document in README | Fewer files — but prose goes stale more quietly | |
| Relocate secrets out of the directory | Structurally safest — but changes paths a running production stack depends on | |

**User's choice:** `.gitignore` + committed `.example` templates.

### Reproducibility proof

| Option | Description | Selected |
|--------|-------------|----------|
| Clone to a temp dir + preflight script | Real evidence, keeps paying off, never touches the running instance | ✓ |
| Documented checklist, verified by reading | Cheapest, zero risk — but the weakest class of check under this repo's rules | |
| Full standby bring-up | Strongest proof — but a second Convex process near a memory-pressured self-hosted backend | |

**User's choice:** Clone to a temp dir + preflight script.

---

## Claude's Discretion

- Plan decomposition and sequencing across the three independent items.
- The exact new plugin-origin string and the `alerts.source` value.
- The soak iteration budget for the DEBT-06 full-suite runs.
- The precise payload shape of the coverage-declaration extension to `scannedOrigins`.

## Deferred Ideas

- Seiðr e2e flakiness (`galdr`/`bifrost`/`loom` under parallel load) — needs a serial Playwright project; repo-wide config change.
- `diagnosis-*.md` and `health-report.md` in `convex-selfhost/` — left out of the initial commit scope pending the exposure decision.
- `e2e/theme-contrast.spec.ts` (20 failures, SEED-006) and `e2e/command-center-breakpoints.spec.ts` (3 failures, Phase 111's) — recorded so no plan mistakes them for its own regressions.
- Two reviewed-but-not-folded todos: `111-devtools-issues-panel-entry-unexamined.md`, `llm-analytics-rollup-migration-cr01.md`.
