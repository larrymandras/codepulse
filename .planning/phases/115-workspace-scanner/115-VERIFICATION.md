---
phase: 115-workspace-scanner
verified: 2026-08-13T13:13:07Z
status: failed
score: 15/17 decisions verified, 1 partial (openly recorded), 1 failed
verifier_note: >
  Goal-backward verification against the 17 locked decisions in 115-CONTEXT.md.
  No claim in any SUMMARY or in 115-LIVE-EVIDENCE.md was accepted as evidence;
  every decision below was re-derived from live code, live Convex data, or a
  freshly-run probe. Every probe is control-paired; one probe (the git-history
  disclosure check) failed its control on first run and was rewritten before its
  result was used.
gaps:
  - truth: "D-17 — no sensitive root name is committed to this PUBLIC repo"
    status: failed
    reason: >
      Three Consulting-department root directory names are committed in a tracked
      file, one of them with ZERO prior tracked precedent — the exact "new,
      permanent, one-way disclosure" D-17 was written to prevent. Not yet pushed.
    artifacts:
      - path: ".planning/phases/115-workspace-scanner/115-LIVE-EVIDENCE.md"
        issue: >
          Line 200 quotes Larry verbatim naming three directories and labelling
          them "are Consulting". Measured against the last commit before Phase 115
          (577abadc): one name had 0 tracked files then and 1 now; two had 1 file
          then (93-CALIBRATION.md) and 2 now. Controls: 'codepulse' 683 files at
          baseline / 731 at HEAD (probe reads history); 'zzq-not-a-real-token-9x7q2'
          0 / 0 (probe does not over-match).
    missing:
      - "Redact or remove the three directory names at 115-LIVE-EVIDENCE.md:200 before pushing"
      - "Rewrite the local-only commits that introduced them (origin/master is 143 commits behind; nothing is published yet)"
      - "Decide whether the pre-existing mention in 93-CALIBRATION.md is also to be redacted"
deferred:
  - truth: "graphSnapshots.ts candidate-selection read still full-collects across versions"
    addressed_in: "Not this phase — Phase 83 backend repair"
    evidence: "Recorded OPEN at crons.ts:145-162; the cron stays disabled. D-11 routes around it by design."
human_verification:
  - test: "Confirm a log line near 04:15 in C:\\Users\\mandr\\.forge\\codepulse-workspace-scan.log on the morning of 2026-08-14 that nobody triggered"
    expected: "A START/EXIT=0 pair stamped ~04:15, distinct from the 08:30 manual runs already present"
    why_human: "Cannot exist before 2026-08-14 04:15. NextRunTime is confirmed as 2026-08-14 04:15:00."
  - test: "Decide the disposition of the D-17 disclosure at 115-LIVE-EVIDENCE.md:200"
    expected: "Names redacted and local history rewritten before any push, or an explicit accepted-risk decision"
    why_human: "Rewriting committed history in a shared checkout is Larry's call, not the verifier's."
---

# Phase 115: Workspace scanner — Verification Report

**Phase Goal (ROADMAP.md:934):** Larry's declared workspace roots are walked nightly and stored as a
versioned, department-classified directory map in Convex — with secret-classified file paths
structurally unable to leave the host, and no snapshot transmitted until a dry-run report has been
reviewed and approved.

**Verified:** 2026-08-13T13:13:07Z
**Status:** failed — 1 blocker. The engineering goal is achieved and the secrets/gate machinery is
sound; the failure is a public-repo disclosure created by the phase's own artifacts, against the
phase's own locked decision.
**Re-verification:** No — initial verification.

---

## Method note

This phase has no REQ-IDs; the 17 decisions D-01..D-17 are the acceptance-bearing units. SUMMARY
files and `115-LIVE-EVIDENCE.md` were read for *claims* only. Each decision below is backed by one
of: a fresh probe run in this session, a live read of the self-hosted Convex backend at
`127.0.0.1:3210`, or a `file:line` in the shipped source.

Three probes I ran are worth naming because they are what the findings rest on:

- **`d0123probe.mjs`** — imports the real modules, walks a synthetic tree containing five
  distinctively-named secret files, and asks whether any of those names reach the snapshot, the
  report, or even a `statSync` call.
- **`d12probe.mjs`** — recomputes `canonicalReportHash(classificationView(report))` under ten
  mutations, with a stability control and a distinguishing control.
- **`leak3.cjs`** — compares tracked-file occurrences of every Work/Consulting root name at HEAD
  against the last commit before Phase 115 began.

**A control failure I hit and corrected:** my first history probe (`leak2.cjs`) reported "0 tracked
files at baseline" for *every* token including the control `codepulse`, which is impossible. The
cause was my own argument order — `git grep -lFi <sha> -- <token>` treats the SHA as the pattern and
the token as a pathspec. The zero was a broken-probe artifact, not a fact about the repo. Rewritten
as `git grep -lFi <token> <sha>`; the control then returned 683 files. No result from the broken run
is used below.

---

## Decision-by-decision

| # | Decision | Status | Evidence |
|---|----------|--------|----------|
| **D-01** | Snapshot carries path + metadata, never file contents; scanner structurally unable to transmit contents | ✓ VERIFIED | `walkRoot`'s deps are exactly `{readdirSync, statSync, mountedSet}` with no defaults (`hooks/workspaceScan.mjs:80-81`); a caller cannot gain read capability by omission. Sliced the real `walkRoot` body and counted read symbols: `readFileSync` 0, `readFile` 0, `createReadStream` 0, `openSync` 0, `readSync` 0, `fs.` 0. **Control:** `statSync` occurs 5× in the same slice, proving the slice is the real body and the probe can see a symbol when present. The module's only content reads are `docker-compose.yml` (`:276`), `.env.local` (`:856`,`:879`) and the approve-mode report read (`:727`) — none under a scanned root, and none reachable from the walk. |
| **D-02** | Deny-by-default allowlist per root, not a secret-shaped regex | ✓ VERIFIED | Ran `isShareable` against the **live tracked config**, 22 cases, 22 correct. Refused: `selfhosted.envfile`, `generate_admin_key.sh`, `.claude.json`, `.mcp.json`, `.env`, `.env.local`, `server.pem`, `secrets.yaml`, `id_rsa`, `Makefile` (extensionless), `config.json`, `docker-compose.yml`, `settings.toml`, `backup.sqlite3`, `notes.md.bak`, `credentials`, `trailingdot.`, `.hidden.md`. **Control:** `README.md`, `App.tsx`, `main.py`, `logo.svg` all returned `true` — 4 shareable results, so a constant-`false` function is excluded. Dotfile refusal precedes extension matching (`workspaceClassifier.mjs:80`); extensionless refused at `:83`. |
| **D-03** | Secret-classified paths omitted entirely; only a per-directory withheld count leaves the host | ✓ VERIFIED | Synthetic walk with five distinctively-named secret files. Each: `in snapshot=false`, `in report=false`, `statSync'd=false`. **Control:** a visible file in the same directory *was* `statSync`'d (`true`), so the probe can observe a stat when one happens. Withheld files contribute zero bytes — totals came back `files=2 withheld=5 bytes=84`, exactly the 2 visible files × 42 (`workspaceScan.mjs:131-135`, increment-then-`continue` before any stat). Live backend confirms the shape: distinct dir-row keys are exactly `access,department,dirPath,fileCount,latestMtime,rootId,totalSize,withheldCount` — no filename field exists to leak into. |
| **D-04** | Separate `workspaceScan.mjs`; shared helper imported not copied; SessionStart untouched | ✓ VERIFIED | `hooks/ingestPost.mjs` exists and is imported by both `scanner.mjs:19` (used `:222`) and `workspaceScan.mjs:63`. Grep for `workspaceScan` in `codepulse-hook.mjs` and `scanner.mjs`: **zero hits**. **Control:** the same grep finds `scanner.mjs`/`runScan` on the hook path at `codepulse-hook.mjs:144-146`, so the probe does see a hook-path reference when one exists. `hooks/__tests__/scanner.test.mjs` — the only regression net on the awaited SessionStart path — is green in the 12-file / 267-test run. |
| **D-05** | Nightly scheduled task via `run-hidden.vbs`, no battery gate, plus an on-demand flag | ⚠ PARTIAL (openly recorded OPEN) | Live `Get-ScheduledTask` (**control: `ConvexNightlyRestart` present → probe works in this shell, contradicting CONTEXT.md's `schtasks` note**): `CodePulse-WorkspaceScan` State=Ready; Execute=`wscript.exe`, Args include `run-hidden.vbs`; **`DisallowStartIfOnBatteries=False`**, `StopIfGoingOnBatteries=False`, `StartWhenAvailable=True`; Trigger `2026-08-13T04:15:00-04:00`; NextRunTime `2026-08-14 04:15`. The log `~/.forge/codepulse-workspace-scan.log` holds two runs, both `EXIT=0 success (ingested)` at 08:30:02 and 08:30:40 — and the live snapshot's `receivedAt` 1786624243.195 (= 08:30:43 EDT) falls inside the second run's window, so the log and the database corroborate each other. **The scheduler firing unattended is NOT proven and cannot be before 2026-08-14 04:15.** Correctly recorded OPEN at `115-LIVE-EVIDENCE.md:557-559,610-612` and in the ROADMAP tick at `:663`. |
| **D-06** | Bounded by explicit root list + `EXCLUDE_DIRS`; no depth cap | ✓ VERIFIED | `isExcludedDir` applied per dirent (`workspaceScan.mjs:121`); 26 exclude dirs in tracked config. No numeric depth cap anywhere in `walkDir`. Cycle bound is identity-based: symlink/reparse dirents skipped and counted (`:115-118`), plus a visited `dev:ino` set seeded with the root (`:189-191`) — skips are surfaced as `cyclesSkipped` in the report's warnings (`:502-506`), never silent. A **real on-disk Windows junction loop** test exists (`hooks/__tests__/workspaceScan.test.mjs:449-486`) and asserts both termination *and* that the sibling shareable file is still found — so "bailed out of the whole root" is excluded. Live: 53 of 53 roots covered, `scannedRootsComplete: true`. |
| **D-07** | Departments are Work / Consulting / Personal | ✓ VERIFIED | `DEPARTMENTS = ["Work","Consulting","Personal","Unclassified"]` (`workspaceConfig.mjs:16`), enforced in `resolveRootDepartment` (`workspaceClassifier.mjs:101`). Live department mix over 4,912 stored rows: Personal 2,339 / Consulting 1,324 / Unclassified 695 / Work 554 — all four present, so the axis is not degenerate. |
| **D-08** | Classification rules in a tracked config JSON; classifier a pure function of (path, config) | ✓ VERIFIED | `config/workspace.json` tracked (`git ls-files config/` → exactly that one file). `hooks/workspaceClassifier.mjs` has **zero** `fs`/`require`/`node:fs` imports (**control: 8 `^export` lines, so the file is non-trivial**). `loadWorkspaceConfig` is the sole I/O wrapper (`workspaceConfig.mjs:94`), and `mergeWorkspaceConfig` above it is pure. |
| **D-09** | `access` derived from Ástríðr's compose bind mounts, not hand-maintained | ✓ VERIFIED | Ran `loadMountedSet` against the real `C:/Users/mandr/astridr-repo/docker-compose.yml`: `ok=true`, **18** distinct mount sources. Probes: vault → `astridr-reachable`, vault subdir → `astridr-reachable`, `.claude-alt` → `astridr-reachable` (this is the **two-service union** working — that mount exists only under `cli-gateway`, and a service-name-hardcoded implementation would miss it), `codepulse` → `astridr-reachable`. **Negative control:** `C:/Users/mandr/definitely-not-mounted-9x7q2` → `local-only`, so the function is not constant-true. Live meta: `accessDerivationOk: true`, 1,523 reachable / 3,389 local-only. Fails closed on empty set (`workspaceClassifier.mjs:262,272-274`). |
| **D-10** | New versioned `workspace*` tables, pointer patched LAST | ✓ VERIFIED | `workspaceSnapshots` + `workspaceDirs` at `convex/schema.ts:2393-2441`. Ordering contract honoured: rows inserted at step 3 (`workspace.ts:124-140`), meta doc with `activeVersion` written at step 5 (`:163-189`) — nothing before it is visible to `getWorkspaceMap`, which reads only `meta.activeVersion` (`:316`). Version allocation is server-side only: `upsertWorkspaceSnapshot` has **no `version` arg** (`:104-106`), so a producer cannot overwrite history. Live: exactly one meta row, `activeVersion: 10`; never two active by construction (single scalar field). |
| **D-11** | Growth bounded by an inline, batch-capped prune at ingest — not a cron, never a mass delete | ✓ VERIFIED (with a documented mechanism change) | Bounded read, never `.collect()`: `.take(WORKSPACE_DELETE_CAP + 1)` (`workspace.ts:251-256`); exactly ONE version per call (`:248`); cap-hit path leaves the version in `storedVersions` and sets `pruneIncomplete` rather than raising the cap (`:267-274`). Arithmetic is asserted in the passing suite, not left to a comment: `MAX_PRUNE_CALLS * WORKSPACE_DELETE_CAP >= MAX_DIRS_PER_INGEST` (`convex/workspaceHttp.test.ts:335-336`; 6 × 1,500 = 9,000 ≥ 8,000) and `1 + (CAP+1) + CAP < 4096` (`:327`; 3,002). **Live proof the prune actually runs and bounds the table:** meta `storedVersions: [8,9,10]`, `prunedVersion: 7`, `pruneIncomplete: false`; the **oldest surviving `workspaceDirs` row is version 8** (`convex data workspaceDirs --order asc`), so versions 1–7 hold zero rows. Mechanism note: the prune moved from *same mutation* to *same request* (separate `internalMutation`, driven by a bounded loop at `workspaceHttp.ts:255-267`) — D-11's substance (request-driven, single-version, capped, no cron) is intact; see the stale-comment finding below. |
| **D-12** | Structural dry-run gate; ingest hard-refuses until an approval marker exists; refusal mutation-tested | ✓ VERIFIED | **Source order:** the refusal returns at `workspaceScan.mjs:787-796`; the *only* `postSnapshot` call is at `:806`. There is exactly one call site and no path from the gate to it that bypasses the return. **Hash behaviour, re-derived independently:** widened allowlist (+`.json`) → CHANGED; department changed → CHANGED; root added → CHANGED; root drops out of coverage → CHANGED; `excludeDirs` changed → CHANGED; `localConfigStatus` merged→absent → CHANGED; `accessDerivationOk` flipped → CHANGED. **Stability control:** identical classification with a different `generatedAt` → SAME hash. The two documented deliberate non-invalidations hold: file-count churn → unchanged, `evidence` prose edit → unchanged. **Approval matrix:** case 1 (valid marker) `true` — the passing control that makes the other three meaningful; case 2 drift `false`; case 3 marker absent `false`; case 4 marker corrupt `false`. **"A hash that never changes would have been caught":** yes — six `expect(h(x)).not.toBe(h(base))` assertions (`workspaceScan.test.mjs:604,618,626,634,642,655`) are unsatisfiable by a constant-returning `classificationView`. Case 5 (injected `postSnapshot` spy never called under refusal) is present at `workspaceScan.test.mjs:798`. |
| **D-13** | Directories are nodes; files are counts, never nodes | ✓ VERIFIED | One row per directory (`workspaceScan.mjs:156-165`); `buildSnapshot` uses an explicit 8-key projection rather than passing the walk row through (`:314-323`), so a stray key cannot ride along. Live backend: 4,912 dir rows for `totalDirs: 4,912`, and the union of all row keys across all 4,912 rows is exactly the 8 declared fields. Re-derived totals from the rows match the stored meta exactly (files 229,210 / withheld 5,677 / bytes 32,959,025,804) — the server-derived aggregate does not disagree with the rows. |
| **D-14** | Root→department is an explicit map; unmapped roots render Unclassified, never a real department | ✓ VERIFIED | `resolveRootDepartment` returns a real department **only** when the root is found by id AND its declared value is in the fixed vocabulary; every other path returns `UNCLASSIFIED` (`workspaceClassifier.mjs:98-103`). `normalizeRoot` independently coerces an out-of-vocabulary department to Unclassified at load (`workspaceConfig.mjs:25-26`) — two independent gates. Live: 23 root ids in `unclassifiedRootIds` out of 53. |
| **D-15** | Vault / `.claude` / `.claude-alt` each map to Unclassified at root level | ⚠ VERIFIED with a scope deviation | The vault is live-confirmed Unclassified (present in `unclassifiedRootIds`) with its D-15 rationale carried in `config/workspace.json:61`. **However `.claude` and `.claude-alt` are no longer scanned at all** — both roots were removed at the D-12 review because the first real scan measured 15,648 dirs against a ~16,000-doc write ceiling. This is recorded, with the measurement, at `config/workspace.json:55` (`_rootExclusionRationale`) and `115-LIVE-EVIDENCE.md:182-188`. I record it as a deviation rather than a failure because CONTEXT.md's "Claude's Discretion" places the root list explicitly under D-12 dry-run validation rather than fixing it at planning time. Reader-facing consequence: D-15's premise is now moot for two of its three named roots. |
| **D-16** | Every ambiguous root under the home directory ships DECLARED and mapped Unclassified, never omitted, never guessed | ✓ VERIFIED | 53 roots declared live (3 tracked + 50 in the gitignored local file), 23 mapped Unclassified. Nothing was guessed into a department by the code — `resolveRootDepartment` cannot do so (D-14). The re-mapping of some roots into Work/Consulting was a human decision at the D-12 review, which is exactly the mechanism D-16 specifies. |
| **D-17** | Config SPLIT — tracked rules + gitignored local root list; nothing sensitive committed to this PUBLIC repo | ✗ **FAILED** | **The mechanism is correct.** Loader fails closed to tracked-roots-only on absent/malformed/version-mismatched local config (`workspaceConfig.mjs:57-62,105-113`), returning `localConfigStatus` so the condition is visible; live status is `merged`. `git check-ignore -v` confirms all three of `config/workspace.local.json`, `config/workspace-scan-report.json`, `config/workspace-scan.approved.sha256` are ignored at `.gitignore:34-36`; **control:** `git check-ignore config/workspace.json` exits 1 (not ignored) and that file *is* tracked, so the probe discriminates. None of the three has ever been committed on any branch. **The outcome is not.** See the blocker below. |

**Score:** 15 verified · 1 partial (D-05, openly recorded OPEN) · 1 failed (D-17).

---

## Blocker — D-17 disclosure

`115-LIVE-EVIDENCE.md:200` is a **tracked** file in a repo whose visibility D-17 records as PUBLIC.
It quotes Larry verbatim naming three directories and labelling them **"are Consulting"**. That
second half matters independently of the names: it maps a directory name to a client-engagement
department, which is the semantic content D-17 exists to protect, not merely the string.

Measured against `577abadc` (the last commit before 2026-08-12):

| | tracked files at baseline | tracked files at HEAD | verdict |
|---|---|---|---|
| Consulting name A | **0** | 1 (`115-LIVE-EVIDENCE.md`) | **new disclosure, zero precedent** |
| Consulting name B | 1 (`93-CALIBRATION.md`) | 2 (+`115-LIVE-EVIDENCE.md`) | precedent existed |
| Consulting name C | 1 (`93-CALIBRATION.md`) | 2 (+`115-LIVE-EVIDENCE.md`) | precedent existed |
| Work name D | 15 | 19 (4 added by 115) | broad precedent — not a finding |

Controls for that table: `codepulse` returned 683 files at baseline and 731 at HEAD (the probe reads
history correctly); `zzq-not-a-real-token-9x7q2` returned 0 at both (the probe does not over-match).

**Severity is bounded by one fact: it is not published.** `origin/master` is at `3a5c86bc`
(2026-08-11) and HEAD is **143 commits ahead**; `115-LIVE-EVIDENCE.md` does not exist at
`origin/master`. So this is still fixable with an edit plus a rewrite of local-only commits, with no
GitHub-side history to contend with. It becomes irreversible on the next push.

This is the same defect class D-17 itself documents, committed by the phase that wrote the decision —
which is worth stating plainly, because the split config, the `.gitignore` block and the fail-closed
loader all work exactly as designed. The leak did not come through the mechanism. It came through
prose.

---

## Secondary findings — stale comments (not blocking)

The prune moved out of the ingest mutation during plan 115-09. Three comments still describe the
pre-change design, and this project's own rule is that a comment contradicting the code is a defect,
not noise:

| File:line | Says | Code actually |
|---|---|---|
| `convex/workspace.ts:20` | "an INLINE, batch-capped prune inside the SAME mutation" | `:191` "NO PRUNE HERE"; `:203` "'same mutation' → 'same request'" |
| `convex/schema.ts:2377` | "an INLINE, batch-capped prune inside the same ingest mutation" | same as above |
| `convex/workspaceHttp.ts:52` | "prune deletes (<= WORKSPACE_DELETE_CAP, **4,000**)" | `workspace.ts:73` — the cap is **1,500** |

The third is the one worth fixing first: it is the budget arithmetic in the comment that justifies
`MAX_DIRS_PER_INGEST`, and it cites a number the code no longer uses. The *live* arithmetic is
correct and test-asserted; only the comment is wrong. Note the same file already carries a
self-correction recording that an earlier version of this exact constant was "looser than the limit
it cites" — so this is a second instance of a defect that file has already been bitten by once.

---

## Anti-patterns and hygiene

| Check | Result |
|---|---|
| `TBD` / `FIXME` / `XXX` in phase-115 shipped code (10 files) | **0** (control: `D-12` appears 13× in `workspaceScan.mjs`, so the grep is live) |
| `TODO` / `HACK` / `PLACEHOLDER` in the three largest modules | 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx vitest run hooks/__tests__/ convex/workspace*.test.ts convex/graphSnapshots.test.ts` | 12 files, **267 passed**, 9 todo, 0 failed |
| Home path `C:\Users\mandr` in tracked files (fixed-string `git grep -lF`) | 204 repo-wide, 11 in phase-115 artifacts, 3 shipped scripts. **Not a finding** — D-17 explicitly settles this by precedent (188 at planning time). Negative control `C:\Users\zzznotreal` → 0. |
| Working tree at verification time | clean; nothing touched by this verification |

---

## Honesty check on the two known-open items

Both are recorded correctly and no artifact claims otherwise:

1. **D-05 unattended firing** — `115-LIVE-EVIDENCE.md:557-559` states the distinction explicitly ("a
   manual `Start-ScheduledTask` proves the ACTION works; it does not prove the SCHEDULER fires it")
   and marks it **OPEN, due 2026-08-14**. `ROADMAP.md:663` repeats the caveat in the completion tick.
   Live `NextRunTime` of 2026-08-14 04:15 confirms the item genuinely cannot close earlier.
2. **`graphSnapshots.ts` candidate-selection read** — `crons.ts:145-162` names the mechanism (a
   `.collect()` across up to seven versions), says explicitly "Do NOT re-enable on the strength of
   the line above", and separates what WAS fixed 2026-08-13 (per-version deletes → bounded `.take()`)
   from what was not. The cron remains commented out.

I found no instance of a green recorded against something that was not measured.

---

## Could not verify

1. **D-05's unattended firing** — impossible before 2026-08-14 04:15. Human item above.
2. **Mid-ingest crash ordering under a real crash** — the tests construct the post-crash *state*
   (a stale `storedVersions` entry pointing at an already-deleted version) and prove self-heal from
   it, which is a legitimate substitute, but no crash was actually induced. Carried as `it.todo` per
   `115-VALIDATION.md:76-86`.
3. **`graphSnapshots.ts` candidate-selection** — out of scope by design; confirmed honestly recorded,
   not independently re-measured.
4. **Provenance of the root-trim decision** — `115-LIVE-EVIDENCE.md:184` records "Larry's decisions,
   2026-08-12: trim the four bulk root groups" as a *paraphrase*, whereas the same file gives the
   root-placement decision verbatim. I cannot verify the trim was authorised in those terms from the
   repo alone. Flagged for completeness, not asserted as a defect.

---

## What I dropped and why

- **Home paths in 204 tracked files** — measured, then dropped: D-17 explicitly settles path-shaped
  disclosure by precedent, so reporting it would be re-litigating a locked decision.
- **`115-VALIDATION.md`'s unticked D-12 mutation-test box (`:110-118`)** — dropped: I confirmed both
  halves (cases 1–4 in `workspaceApproval.test.mjs`, case 5 at `workspaceScan.test.mjs:798`) are
  green, so the box is stale bookkeeping with no bearing on the gate.
- **`.claude`/`.claude-alt` root removal** — kept as a recorded deviation under D-15 rather than
  raised as a finding, because CONTEXT.md's Claude's Discretion section places the root list under
  D-12 review by design.
- **Several comment/prose nits in the phase artifacts** — dropped as unsubstantiated or cosmetic. I
  did not report anything I could not back from live code, live Convex data, or a control-paired
  probe run in this session.

---

_Verified: 2026-08-13T13:13:07Z_
_Verifier: Claude (gsd-verifier) — uncommitted; left for the orchestrator to commit._
