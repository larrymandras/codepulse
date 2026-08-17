---
phase: 116-galdr-prompt-library
plan: 07
subsystem: skill

tags: [claude-code, skill, galdr, node, cli, live-verification]

# Dependency graph
requires:
  - phase: 116-05
    provides: "the live /galdr routes on the self-hosted backend, bearer-gated"
provides:
  - "~/.claude/skills/galdr/SKILL.md — the reasoning layer for /galdr and /galdr-save"
  - "~/.claude/skills/galdr/scripts/galdr-client.mjs — the deterministic fetch layer, Node built-ins only"
  - "both force-added and pushed in the claude-code-config repo, so the skill reaches the laptop"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reasoning/IO split: SKILL.md owns every judgement (candidate presentation, args-then-ask, refuse-on-unresolved); the script owns transport and makes no decisions. The script performs no variable detection and no substitution — it prints the server's `variables` array as given, so the skill cannot disagree with the CodePulse UI about what a variable is."
    - "Verify a reasoning-layer skill with independent fresh-context agents rather than self-testing. The author of a SKILL.md already knows the expected answer, which makes their own compliance the weakest available evidence for exactly the behaviours most likely to fail."

key-files:
  created:
    - "C:/Users/mandr/.claude/skills/galdr/SKILL.md"
    - "C:/Users/mandr/.claude/skills/galdr/scripts/galdr-client.mjs"
  modified:
    - .planning/phases/116-galdr-prompt-library/116-04-PLAN.md
    - .planning/phases/116-galdr-prompt-library/116-07-PLAN.md

key-decisions:
  - "Env resolution settled (RESEARCH Assumption A1 / Open Question 1): process.env, then an absolute-path skill-local .env built from os.homedir(), then a URL-only default of http://127.0.0.1:3211. No default for the key — a missing key is a hard exit 2, never an anonymous request."
  - "Default base URL is the HTTP-actions port 3211, read from convex-selfhost/docker-compose.yml:76, not the backend API port 3210. Pointing at the wrong one yields confusing 404s rather than an honest error."
  - "The script writes no file at all (D-03). Losing /galdr while the backend is down is the accepted cost; a cached second copy is the drift live fetch exists to prevent."
  - "Two plan defects corrected on disk rather than worked around — see Deviations."

patterns-established:
  - "Pair every failure-path assertion with a working control. Exit 2 and exit 3 are indistinguishable from 'the script cannot run at all' without a green `list` beside them."

requirements-completed: []

# Metrics
duration: ~50min
completed: 2026-08-10
---

# 116-07: The /galdr and /galdr-save Claude Code skill

All three tasks complete, including the blocking checkpoint.

## Task 1 — galdr-client.mjs

Exercised as real child processes, never reasoned about from the source:

| Check | Result |
|---|---|
| `--help` | exit 0, names `list` / `fetch` / `save` / `bump` |
| **CONTROL** — correct key + URL, `list` | **exit 0**, JSON carries `categories` and `favorites` |
| Key deleted from the child environment | **exit 2**, stderr names `GALDR_API_KEY` |
| Unroutable `CODEPULSE_URL` | **exit 3 at 10.1s**, stderr names the base URL |
| Write APIs in source (comments stripped) | none |
| Files on disk after every run above | `scripts/galdr-client.mjs` only — nothing cached |
| Key or Authorization value in any output | never |

The 10.1s bound is what proves the AbortController is wired rather than an OS
timeout. The control is what makes the two non-zero exits mean anything.

## Task 2 — SKILL.md

| Criterion | Result |
|---|---|
| Frontmatter `name: galdr` | present |
| `--recent`, `--favorites` | 0, 0 |
| `--category` | 1 — inside the `save` invocation only, never on a lookup line |
| **CONTROL** — `--body-file`, `--title` | 2, 2 |
| variables taken AS GIVEN | present |
| REFUSE to inject | present |
| Exit codes 2 / 3 / 4 documented | present |
| "no cached copy, by design" | present |

The control caught a real defect: `--title` was **0** on the first pass. The
script exits 2 without it, so the skill as first written would have failed every
save. A criterion that only ever confirms what you expected would not have found
that.

## Task 3 — install and live round trip

**Part one, install.** `git add -f` (required — `.gitignore:72` ignores `skills/`
wholesale; 9 skill dirs were tracked before this). `git ls-files skills/galdr/`
asserted **non-empty before** committing, since a failed force-add produces an
empty result that reads identically to success. Commit `c2140fb`, exactly the two
intended files, pushed `d65322f..c2140fb main -> main` with `@{u}..HEAD` empty
against a confirmed `origin/main` upstream. No credentials file exists in the
skill directory; the key resolves from the user environment.

Single-install confirmed by inode, not by listing: `.claude/skills/galdr/SKILL.md`
and `.claude-alt/skills/galdr/SKILL.md` are both inode `19140298417277882` —
the same file through the junction, not a copy.

**Part two, the round trip.** Run as four independent fresh-context agents, each
given only the literal user input and an operational note about environment
staleness — no hint about the expected behaviour. See Deviations for why this is
a proxy rather than the letter of the checkpoint.

| Probe | Behaviour observed |
|---|---|
| bare `/galdr` | Listed `planning (1)` and an empty favorites. Ran no `fetch`, no `bump`, injected nothing. |
| `/galdr adversarial-plan-review` (no args) | **Refused to inject.** Named the missing variable `plan_path` and asked for it. No `bump`. |
| `/galdr adversarial-plan-review plan_path=…` | **Injected the fully substituted body**, zero remaining double-brace placeholders, then bumped usage. |
| `/galdr adversarial` (partial word) | `match: null`. Listed the one candidate and **waited**, explicitly declining to auto-select the *sole* candidate. No `bump`. |

Two results are worth more than the others.

The no-args probe volunteered that it would not infer `plan_path` from the
repository even though `.planning/phases/110-convex-durability/` was sitting in
git status in front of it — D-09's no-inference rule holding under actual
temptation, not in the abstract.

The partial-word probe refused to auto-select when there was exactly **one**
candidate. That is the case where a model most naturally "helps", and it is the
one D-05 exists for.

**Usage semantics control:** `usageCount` is **1** after all four probes. Only
the delivery bumped it; the browse, the refusal, and the candidate list all
correctly bumped nothing.

All four agents resolved the skill through the `.claude-alt` junction path,
independently re-confirming the single install.

Every one of them also hit the stale-environment exit 2 first and recovered using
SKILL.md's own Troubleshooting note — unplanned evidence that the note is correct
and load-bearing.

## Deviations from plan

**The round trip used fresh subagent contexts, not a second Claude Code CLI
session.** The checkpoint asks for the latter. Four independent agents that load
SKILL.md cold and act on it is the closest available substitute and is far
stronger than the author self-testing, but it is not the literal article: same
harness, same model, no separate session boundary. Recorded as a proxy so nobody
later reads it as the checkpoint's own words.

**Two plan defects corrected on disk** (commit `ca7520b4`) rather than
transcribed:

1. `116-07`'s `<interfaces>` block documented `201 -> { ok: true, slug, promptId }`.
   The live response omits `slug`, deliberately — `convex/galdrHttp.ts:135-143`
   explains that `createPrompt` does not return it and re-deriving `slugify(title)`
   at the HTTP layer would drift from `convex/galdrSlug.ts`. Applying the
   defect-class rule found the identical stale line at `116-04-PLAN.md:143`,
   corrected too. `116-04-SUMMARY.md:85` had the as-built behaviour right all
   along; only the plan lines lagged.
2. Task 2's acceptance banned the literal `--category` while Task 1 of the same
   plan mandates it on `save`. Reworded to D-08's actual intent — no flag may
   widen or filter the *lookup* path — in both the prose and the frontmatter
   `truths`, which is what the decision-coverage gate reads.

## Open items

None for this plan.

Worth carrying forward: the library currently holds exactly one prompt
(`adversarial-plan-review`), created as the round-trip fixture. It is a real,
useful prompt rather than a throwaway, so it is left in place — but it is the
entire contents of the library until real use begins.
