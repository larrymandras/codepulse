---
phase: 113-debt-sweep
plan: 07
subsystem: infrastructure
tags: [convex, self-hosted, docker-compose, git, secrets, gitignore]

# Dependency graph
requires: []
provides:
  - "C:/Users/mandr/convex-selfhost/.gitignore — written BEFORE `git init`, proven load-bearing in both directions by `git check-ignore -v`"
  - "convex-selfhost initialised as its own PRIVATE git repo (`git init -b main`), nothing staged, zero commits"
  - "docker-compose.yml sources INSTANCE_SECRET from the gitignored selfhosted.envfile via `env_file:` instead of an inline literal (D-18)"
  - "selfhosted.envfile.example — key-name-only template built from documented names, never from the live file"
  - "docker-compose.yml.pre113.bak — pre-edit backup still holding the live value, covered by the *.bak ignore rule"
affects: ["113-08 (owns staging, the README, preflight, and the first commit)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ignore-set-before-init: the .gitignore is authored first and `git init` second, so no `git add -A` can ever stage the 24 GB of bulk that lives in the same directory"
    - "bidirectional check-ignore proof: assert the ignore rules match what MUST be ignored AND exit non-zero for what MUST be committed — without the second half, 'everything is ignored' and 'the right things are ignored' are indistinguishable"
    - "length-only secret verification: prove a secret reaches a container with `| awk '{print length($2)}'` and `printf %s \"$VAR\" | wc -c`, never by printing the value"

key-files:
  created:
    - C:/Users/mandr/convex-selfhost/.gitignore
    - C:/Users/mandr/convex-selfhost/selfhosted.envfile.example
  modified:
    - C:/Users/mandr/convex-selfhost/docker-compose.yml

requirements-completed: []
---

# 113-07 — convex-selfhost made safe to version-control

DEBT-07 is **not** closed by this plan. 113-08 owns the README, the preflight and the first
commit. This plan only makes the directory safe to stage.

## What shipped

1. **`.gitignore`, authored before `git init`.** Four sections: secrets (D-14/D-18), bulk
   operational data with measured sizes (D-15), volatile files, and the `diagnosis-*.md` /
   `health-report.md` notes deliberately held out of the initial commit scope (D-13).
2. **Repo initialised** with `git init -b main`. Nothing staged, no commits — 113-08 owns that.
3. **`INSTANCE_SECRET` parameterized** out of `docker-compose.yml` and into the already-ignored
   `selfhosted.envfile`, reached via an `env_file:` directive on the `backend` service. Rotation was
   explicitly out of scope (D-18, Larry's call).
4. **`selfhosted.envfile.example`** with three documented key names and no values.

## Evidence

| Check | Result |
|---|---|
| `check-ignore -v` on the 7 must-ignore paths | all 7 matched a rule, with line numbers |
| **Control:** `check-ignore -q` on compose + 3 scripts | **exit 1, no output** — the set does not swallow what must ship |
| `git status --porcelain` | 14 untracked (`.gitignore` + 10 `.ps1` + 2 compose + 1 `.vbs`); **0** bulk/log/secret/deferred entries |
| Staged / committed | 0 / 0 |
| `wc -l` compose | 121 → 122 (−1 Edit A, +2 Edit B, net +1) |
| Secret in tracked compose | **0** |
| **Control:** same detector on the backup | **1** — the detector fires when a secret IS present |
| `docker compose config --quiet` | exit 0 |
| `INSTANCE_SECRET` length via compose render | **64** (>20), value never printed |
| **Control:** broken `env_file` | **no integer printed**; `config --quiet` exit 1 |
| Template lines carrying a value | **0**; template not ignored (exit 1) while the real file is (exit 0) |
| `docker-compose.standby.yml` | untouched |

### Live recreate — the acceptance test Larry chose

The compose edit only takes effect on `up`/`--force-recreate` (`restart-convex.ps1:60` uses `docker
restart`, so the nightly task would never have exercised it). Rather than let an unattended 02:00 run
be the first exercise, it was proven under observation:

| | Before | After |
|---|---|---|
| container id | `a41bfddb…` | `89adcf74…` (genuinely recreated) |
| `/version` | 200 | 200 (healthy in ~60s) |
| galdr prompts | 1 | **1** |
| loom runs | 4 | **4** |
| `INSTANCE_SECRET` inside the running container | — | **64 chars**, from `env_file` |

Data identity across the recreate is the real proof: a wrong or missing `INSTANCE_SECRET` changes the
instance identity, so unchanged row counts plus a 64-char value sourced from the env file is the
positive result. Post-recreate: Ástríðr→Convex ingest still flowing (newest `events` row 17s old),
`3211/health` 200, dashboard 200, and both `Block-Convex-*-LAN` firewall rules still enabled.

## Deviations and defects found

- **A bug in my own first `.gitignore`, caught by the plan's control.** The measured sizes were
  written as trailing comments (`backups/  # 22 GB`). `.gitignore` has no inline-comment syntax — `#`
  only opens a comment at the start of a line — so all four bulk patterns were literal strings
  matching nothing, and the 24 GB would have been stageable. `check-ignore -v` reported no match for
  all four. Fixed by moving each size onto its own comment line, with the reason recorded in the file
  so the next editor does not repeat it. **This is exactly the failure the D-15 control exists to
  catch, and without it the file would have looked correct.**
- **Plan defect, minor: Verification 3's control cannot assert what it claims.** The plan requires the
  broken-`env_file` pipeline to "exit non-zero and print no integer". A shell pipeline's `$?` is the
  exit status of the LAST command — `awk`, which succeeds while printing nothing — so it reports 0
  regardless. The meaningful half (no integer printed) held, and `docker compose config --quiet`
  exiting 1 was used as the independent confirmation. Any future plan asserting on a piped exit code
  needs `PIPESTATUS` or a restructure.
- **`113-08`'s script count was stale and was corrected before this plan ran** (commit `f2010471`):
  its D-13 acceptance truth said "all nine scripts", but there are **ten** `.ps1` files. The tenth,
  `restrict-convex-lan.ps1`, was created 2026-08-11 and carries the firewall rules blocking LAN access
  to the unauthenticated Convex mutation surface — an executor following the literal count would have
  left precisely the load-bearing script untracked.

## Notes for 113-08

- The untracked set is now exactly the commit scope: `.gitignore`, 10 `.ps1`, 2 compose files,
  `run-restart-hidden.vbs`, plus `selfhosted.envfile.example`. Re-derive it from `git status` rather
  than from any enumerated list — that is what went stale here once already.
- `docker-compose.yml.pre113.bak` holds the live secret and is ignored by `*.bak`. It must never be
  committed; it is the `cp`-restore path if anything needs reverting (never `git checkout`).
- The NAS plaintext exposure of `INSTANCE_SECRET` via `backup-convex.ps1:97` is unchanged and remains
  recorded in D-18, not actioned.
