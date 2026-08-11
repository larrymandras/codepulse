---
phase: 113-debt-sweep
plan: 08
subsystem: infrastructure
tags: [convex, self-hosted, git, secrets, preflight, disaster-recovery]

# Dependency graph
requires:
  - phase: 113-07
    provides: "proven .gitignore, initialised repo, parameterized docker-compose.yml, key-name-only template"
provides:
  - "convex-selfhost committed and pushed to a PRIVATE remote (larrymandras/convex-selfhost, isPrivate confirmed by read-back)"
  - "README.md — bootstrap, secret key names, volumes, all 7 scheduled tasks, 6 external prerequisites, the logging block, the nightly-restart rationale"
  - "preflight.ps1 — 36 named PASS/FAIL/SKIP checks, starts no container, exits non-zero on failure"
  - "restrict-convex-lan.ps1 now under version control — the LAN firewall rules survive an edit or deletion"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "two-run reproducibility proof: a clean clone SKIPS env-dependent checks while the real directory RUNS them; neither run alone proves the checkout is reproducible"
    - "skip-is-not-a-pass summary: every skipped check is named with its reason in the summary and counted separately, so a validator cannot silently skip itself"
    - "enumerate external dependencies from the code, never from memory — a grep over the scripts found 6 where the first draft documented 1"

key-files:
  created:
    - C:/Users/mandr/convex-selfhost/README.md
    - C:/Users/mandr/convex-selfhost/preflight.ps1
  modified: []

requirements-completed: [DEBT-07]
---

# 113-08 — convex-selfhost under version control (DEBT-07 closed)

## What shipped

`larrymandras/convex-selfhost`, **private** (confirmed by read-back, not by the flag passed):
one commit, exactly 17 files — both compose files, all ten `.ps1` scripts, `run-restart-hidden.vbs`,
the key-name-only template, a bootstrap README and `preflight.ps1`.

**The point of the exercise:** `restrict-convex-lan.ps1` — the Windows Firewall rules blocking LAN
access to the unauthenticated Convex mutation surface — is now versioned. It previously existed on
exactly one disk.

## Evidence

| Check | Result |
|---|---|
| Repo identity before staging | `C:/Users/mandr/convex-selfhost` — not codepulse |
| Staged by explicit name (no `-A`, no glob) | 17 files |
| Forbidden files staged / committed | **0** |
| Untracked remaining after staging | **0** |
| Secret detector on staged content | **0** |
| **Control:** same detector on `docker-compose.yml.pre113.bak` | **1** |
| 32+ char hex literal in staged content | **0** (control on backup: 1) |
| Operator diff review | done — see *Operator review findings* |
| Remote visibility read-back | `{"isPrivate":true,"visibility":"PRIVATE"}` |
| Commit contents | 17 files, matching the staged list |

### D-16 reproducibility — two runs, because neither alone is proof

Cloned from the **remote** (not the local directory), so the proof covers what was actually pushed.

| Run | Result |
|---|---|
| Clean clone | 17 tracked files, secrets absent, **exit 0**, `checks_run=36 passed=32 failed=0 skipped=4`, all four skips named with reasons |
| Real directory (113-08 Task 1) | **exit 0**, `checks_run=36 passed=36 failed=0 skipped=0` |

**Why the clean-clone run alone would not be sufficient:** it SKIPS the three env-dependent checks
(B, C, D) because a fresh clone legitimately has no `selfhosted.envfile` — so on its own it cannot
distinguish "those checks passed" from "those checks never executed." The real-directory run, where
`skipped=0`, is what proves they execute and pass. The pair is the proof.

### D-16 controls — a preflight never shown to fail is not a check

| Control | Result |
|---|---|
| `docker-compose.yml` deleted from the clone | **exit 1**, `FAIL file:docker-compose.yml -- missing from the checkout`, `failed=1`, every other check unchanged |
| `selfhosted.envfile` with 1 of 3 keys | check C moved **SKIP → FAIL**: `missing from selfhosted.envfile: CONVEX_SELF_HOSTED_ADMIN_KEY, INSTANCE_SECRET`; `skipped` 4→1; **names only, no values** |

Temp clone deleted and confirmed gone. Real repo afterwards: 1 commit, 0 modified, 0 untracked.

## Operator review findings (Task 2)

The staged diff carries **environment-identifying content by design**, which is why D-12 required a
private repo:

- `backup-convex.ps1:22-23` — NAS `user@host`, `/volume1/...` path, and a LAN IP in a comment.
- `docker-compose.yml` ×5 lines — the tailnet MagicDNS hostname.
- `restrict-convex-lan.ps1` — LAN and tailnet CIDR, documenting its own measurement.

None are credentials. `install-nas-key.ps1` — the file the plan singled out — reads
`id_ed25519.pub`, the **public** key; no private key material is read anywhere.

## Defects found and fixed during execution

- **My own README and preflight covered 1 external prerequisite when there are 6.** Enumerated from
  the scripts (`grep -rhoE "C:.Users.mandr.(scripts|[.]forge|[.]local|[.]ssh)[^'\"` ]*" *.ps1`), the
  real set includes `claude-self-diagnose.ps1`, `notebooklm-keepwarm.alert.conf` (which holds
  `soak-watch.ps1`'s Telegram credentials), `run-forge.vbs`, `claude.exe` and `id_ed25519.pub`. A
  fresh clone would have passed preflight with five dependencies silently absent, making
  "reproducible from a fresh checkout" false. Found only because Task 2's human checkpoint forced an
  actual enumeration. Fixed in both files; all six are now named checks.
- **A broken probe reported as evidence.** An earlier hostname/IP sweep printed "zero hits" and was
  offered to the operator as assurance. Its pattern was mangled by shell escaping and it never looked
  for DNS names at all. Re-run with a control that fires, it found the NAS host, the LAN IP and the
  tailnet hostname. The finding was corrected before the commit.
- **`113-08`'s own "all nine scripts"** was stale — there are ten, and the tenth was
  `restrict-convex-lan.ps1`, i.e. the security-relevant one. Corrected in commit `f2010471` before
  execution.
- **The plan's "six of the seven scheduled tasks invoke `run-hidden.vbs`"** is wrong; it is **five**.
  `ConvexNightlyRestart` uses the in-repo `run-restart-hidden.vbs` and `ConvexRestoreCap48` calls
  `powershell.exe` directly. The README documents the measured reality.

## Deviation

Step 9 (`gh repo create`) was blocked by the permission classifier as an outward-facing action. The
operator ran it; Claude verified the outcome by read-back rather than assuming the flag was honoured.

## Residual

`docker-compose.yml.pre113.bak` still holds the live `INSTANCE_SECRET` on disk and is ignored by
`*.bak`. It is the `cp`-restore path — never `git checkout`. The NAS plaintext exposure of that
secret via `backup-convex.ps1:97` is unchanged and remains recorded in D-18, deliberately not
actioned. Rotation stays out of scope.
