# Phase 115 — Live Evidence

Plan 115-09 (and, appended later, plan 115-10). Every entry here is a raw output captured during
execution, not a restatement. Where a claim rests on a probe, the probe's **control** is recorded
alongside it — a result the probe would return whether or not the thing were true carries no
information, so an uncontrolled probe is not written down as evidence here.

Date of the plan-115-09 run: **2026-08-12**.

---

## Task 1 — Deploy the schema and route to the self-hosted backend

### 1.1 Backend liveness, control-paired

| Probe | Result |
|---|---|
| `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3210/version` | **200** |
| `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3210/definitely-not-a-real-route-9x7q2` | **404** |

The two responses **differ**, so the 200 is informative. This project has previously cited a `/health`
200 as evidence when a bogus path returned 200 identically; that failure mode is excluded here.

Container state at probe time:

```
convex-backend Up 7 hours (healthy)
```

### 1.2 Working-tree and branch state immediately before the deploy

A deploy ships the working tree, not HEAD, so both were checked as their own tool calls whose output
was read:

```
$ git status --porcelain
            <- empty: clean
$ git branch --show-current
master
```

### 1.3 The deploy command, verbatim

```
npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
```

`--env-file` is mandatory. `./CLAUDE.md`'s Commands section historically carried a bare
`npx convex deploy --yes`, and `package.json`'s `"deploy"` script is `npx convex deploy && npx vite build`
— both of which can target the retired cloud deployment `tidy-whale-981` (frozen 2026-07-15). Neither
was used. The command did not prompt, so `-y` was not needed.

### 1.4 Deploy output, verbatim

```
> Deploying code to deployment:
> `-- http://127.0.0.1:3210
- Deploying to http://127.0.0.1:3210...

[OK] No indexes are deleted by this push
Uploading functions to Convex...
Generating TypeScript bindings...
Running TypeScript...
Pushing code to your Convex deployment...
Schema validation complete.
Finalizing push...
[OK] Deployed Convex functions to http://127.0.0.1:3210
```

Read against the plan's three required checks:

- **Line naming the target instance:** `Deploying code to deployment: http://127.0.0.1:3210`, and the
  closing `Deployed Convex functions to http://127.0.0.1:3210`. This is the self-hosted instance the
  env file declares.
- **`*.convex.cloud` hostname:** **absent**. No cloud host appears anywhere in the output.
- **Deleted-index / destructive-change line:** **absent**, and stated positively by the CLI itself —
  `No indexes are deleted by this push`. This is the exact line that, in its negative form
  (`Deleted table indexes:`), was the only announcement of a schema rollback during a 2026-08-12
  incident in this project, so its positive form is quoted here deliberately rather than summarised.

`Schema validation complete.` confirms the `workspaceSnapshots` and `workspaceDirs` definitions from
plan 115-04 were accepted by the running backend, not merely type-checked locally.

### 1.5 Function-existence probe, control-paired

Exit code alone proves nothing here, and neither does a blank stdout — `npx convex run` prints nothing
for a `null` return, which is indistinguishable from a call that produced no result. Both probes were
therefore issued against the backend's HTTP query API, which returns an explicit JSON envelope. The
admin key came from `docker exec convex-backend ./generate_admin_key.sh` and was passed through an
environment variable; it is not printed here or anywhere in the transcript. No `--push` flag was used
on any command.

Real function:

```
POST http://127.0.0.1:3210/api/query   {"path":"workspace:getWorkspaceMap","args":{}}
HTTP 200
{
  "status": "success",
  "value": null
}
```

Bogus control:

```
POST http://127.0.0.1:3210/api/query   {"path":"workspace:definitelyNotAFunction9x7q2","args":{}}
HTTP 200
{
  "status": "error",
  "errorMessage": "[Request ID: 0105be9431baf44d] Server Error\nCould not find public function for 'workspace:definitelyNotAFunction9x7q2'.\n"
}
```

**Both halves are required and both are present.** `status: success, value: null` is plan 115-04's
designed graceful-skip before any ingest has landed; the control proves the probe can tell that apart
from a function that does not exist. The `null` on its own would have proved nothing.

A separate `npx convex run` against the bogus name independently listed the backend's available
functions, whose tail includes:

```
- workspace:upsertWorkspaceSnapshot
- workspace:getWorkspaceMap
```

### 1.6 Commands deliberately NOT run

- `npx convex env list` — against the self-hosted backend this prints full `NAME=VALUE` pairs rather
  than masked values (a behaviour that differed on the retired cloud deployment), and running it on a
  doc's say-so has already leaked three keys into a session transcript in this project. It does not
  appear in this plan's transcript.
- `npx convex run <fn> --push` — `--push` deploys the working tree before running, turning a read-only
  probe into an unauthorised deploy. It does not appear in this plan's transcript.
- `npx convex import --replace-all` — forbidden by `./CLAUDE.md` after the 2026-07-21/22 multi-day
  outage. It does not appear in this plan's transcript.

### 1.7 Reachability caveat

Every probe above ran from this host, over loopback. Loopback, the Docker bridge NAT and WSL are each
special-cased, so **none of these results say anything about external reachability** and none is cited
that way. That question is settled only by a device that is neither this machine nor a container on it.

**Task 1 disposition: PASS.** The `workspace*` tables and the `/workspace-ingest` route are live on the
self-hosted backend, established by deploy output naming that instance plus a control-paired
function-existence probe — never by exit 0.

---

## Task 2 — Larry's review of the real dry-run report

Three review rounds. Each round's numbers were presented in full; only the deltas are summarised here.

### Round 1 — the first real scan

`node hooks/workspaceScan.mjs --dry-run` → **15,648 dirs, 274,664 visible files, 29,488 withheld,
~31.6 GiB**, hash `8edf5ab3…`. Departments: **Work 0, Consulting 0**, Personal 1,022 dirs,
Unclassified 14,626. Only two of 66 roots carried a real department, both scanner *inferences*
(`codepulse`, `astridr-repo` → Personal, from Larry's global CLAUDE.md). Coverage
`scannedRootsComplete: false`.

Withheld set, by extension FAMILY only — no filename anywhere: 9,636 extensionless, 5,752 `.json`,
2,719 `.sql`, 2,126 `.jsonl`, 1,085 `.dat`, 1,080 `.sh`, 977 dotfiles, 930 `.gz`, 761 `.yaml`, 549
`.parquet`, 538 `.toml`, 147 `.ps1`, 99 `.log`, 40 `.csv`, tail of 157 further families = 551.
The headline 9.7% withheld rate is diluted by `wakeword-training`'s 203,822 audio files; excluding
that one root it is **29.3%**, consistent with a deny-by-default allowlist. An independent second walk
agreed exactly on visible files (274,664) and differed by one on withheld (29,489 vs 29,488) — one
transient file in the ten minutes between walks, not a classification discrepancy.

Coverage gap traced rather than left as "a root failed": four `EPERM scandir` failures on
`astridr-repo`'s `.tmp/pytest-astridr`, `.tmp/pytest-astridr-media`, `.tmp/pytest-imagegen-full`,
`.tmp/pytest-imagegen-unit` — plain directories, not links, almost certainly created by a container
running as root against the bind-mounted repo. **Control:** the same probe run against `codepulse`,
which the report marks covered, read 601 dirs with **0** failures. So the flag is honest and its blast
radius is four pytest scratch directories.

### Round 1 finding — a blocking defect the review surfaced

`totals.dirs` = 15,648 was the number nobody had measured before this run, and it broke the ingest.
Recorded in full in the "Corrections" section below, because two of the three diagnoses were wrong.

### Round 2 — after Larry's re-map and trim

Larry's decisions, 2026-08-12: trim the four bulk root groups; re-map departments. Applied to
`config/workspace.local.json` (gitignored) and `config/workspace.json` (tracked). Result:
**4,912 dirs, 229,178 files, 5,648 withheld, ~30.7 GiB**, hash `6c8a5b1d…`. Work 554 dirs / 2,212
files; Consulting 1,324 / 4,995; Personal 2,339 / 219,212; Unclassified 695 / 2,759. The
`>5,000 directories` warning disappeared on its own.

### Round 3 — after the coverage fix

`.tmp` added to `excludeDirs`. **`scannedRootsComplete: true`, 53 of 53 roots covered.** The same probe
that found the four `EPERM` failures now reports **zero** — a before/after contrast on an identical
probe, not a bare absence claim. Totals unchanged at 4,912 dirs. Hash
`7565e00bde7d630ef36319319796b052c2efa4cd1a7b04f1dda89abbd21ff100`.

### Larry's response, verbatim, 2026-08-12

Round 1 → **"Re-map Work roots first"** and **"Raise the cap, then ingest (Recommended)"**.
Root placement → **"[THREE ROOT NAMES REDACTED] are Consulting, leave the
others unclassified for now, I would like to see if we even need those anymore"**.
Round 3, on whether anything needed fixing first → **"Fix astridr-repo coverage too"**, **"Verify the
~16,000 ceiling"**.
Final gate → **"approved"**.

### Approval marker

```
$ node hooks/workspaceScan.mjs --approve
[workspaceScan] approved (exit 0)
PASS approval marker matches the reviewed report
marker line 1: 7565e00bde7d630ef36319319796b052c2efa4cd1a7b04f1dda89abbd21ff100
```

`git status --porcelain config/` after approval: **empty**. The report, the marker and the local
config are all invisible to git. Control: `git check-ignore config/workspace.json` exits **1**
(not ignored), proving the ignore rules are specific rather than blanket, while
`config/workspace.local.json`, `config/workspace-scan-report.json` and
`config/workspace-scan.approved.sha256` all report IGNORED.

**No withheld filename appears anywhere in this file** — extension families and counts only.

### An honest note on re-approval

The first ingest after approval was **REFUSED (exit 3)**: the tree changed between `--approve` and the
ingest's own walk, so the hash differed. That is D-12 working, and it is recorded as live proof the
refusal fires against real drift rather than only in unit tests. Every subsequent ingest round in Task
3 therefore re-ran `--dry-run → --approve → ingest`, and each round printed the
**classification-invariant projection** (department dir counts, total dirs, coverage) before approving.
That projection was **identical every time** — `W=554 C=1324 P=2339 U=695 dirs=4912 cov=53/53
complete=true` — so what was re-approved was always the same classification Larry reviewed; only file
counts and byte totals drifted. See the D-12/D-05 finding below: this drift is fatal to an unattended
nightly run, and that is an open issue, not a solved one.

---

## Task 3 — First live ingest and it.todo conversion

### Ingest sequence

| Version | Result | Prune |
|---|---|---|
| 1 | `ingested` (exit 0) | none (below keep threshold) |
| 2 | `ingested` (exit 0) | none |
| 3 | `ingested` (exit 0) | none |
| 4 | **`post-failed` (exit 4)** | first prune activation — failed, see Corrections |
| 5 | `ingested` (exit 0) | `prunedVersion: 1`, `pruneIncomplete: true` |
| 6 | `ingested` (exit 0) | `prunedVersion: 3`, `pruneIncomplete: false` |

### Version 1, verified against the report and the marker

```
activeVersion       1
storedVersions      [1]
totalDirs           4912      (matches report.totals.dirs)
totalFiles          229181    (matches report.totals.files)
totalWithheldFiles  5648      (matches report.totals.withheldFiles)
dryRunReportHash    "7555de97c4fe26d2dbfbef7e8980f3329c3e2b449086ddc9e7a91099c181ccbf"
                              (matches the approval marker exactly)
pruneIncomplete     false
prunedVersion       absent    (correct on a first ingest — nothing to prune)
rootCount           53
generatedAt         1786571195
```

`generatedAt` sanity: 1786571195 interpreted as epoch **seconds** lands on 2026-08-12, matching the
schema's stated convention. Read as milliseconds it would be 1970 — the check is recorded because a
threshold comparison that passes vacuously reads identically to one that passes correctly.

`getWorkspaceMap` returned **4,912 rows for 4,912 `totalDirs`**, non-empty. An empty table after a
claimed-successful ingest was pre-declared a FAILURE; it did not occur.

### Final state after version 6

```
activeVersion    6
totalDirs        4912      rowsReturned 4912
storedVersions   [4, 5, 6]      <- exactly WORKSPACE_KEEP_VERSIONS
prunedVersion    3
pruneIncomplete  false
```

### it.todo #1 — activeVersion increments, never two active versions — **VERIFIED LIVE**

Observed at 1, 2, 3, then 5 and 6. `getWorkspaceMap` returned only the active version's rows at every
step — `rowsReturned` equalled `totalDirs` each time, never a mixture of versions.

### it.todo #2 — the prune deletes the right rows — **VERIFIED LIVE, both halves**

- **Negative half:** the oldest row physically remaining in `workspaceDirs`, read with
  `--order asc --limit 1`, carries `version = 4`. Versions 1, 2 and 3 therefore hold **zero rows** —
  physically deleted, not merely dropped from the `storedVersions` bookkeeping array.
- **Positive half / control:** the same query shape with `--order desc --limit 1` returns a row at
  `version = 6`, proving the query returns data at all; and the active version returned 4,912 of
  4,912 rows.

A zero row count for a pruned version, on its own, is indistinguishable from a query that always
returns nothing. Both halves are required and both are recorded.

### it.todo #3 — the deferred-remainder self-heal — **EXERCISED LIVE**

Not a fabricated exercise and not skipped. At version 5 the prune fully removed version 1, then hit
`MAX_PRUNE_CALLS` partway through version 2, leaving 412 rows and setting `pruneIncomplete: true`.
The **next** ingest (version 6) finished that remainder and went on to fully remove version 3, ending
at `pruneIncomplete: false` and `storedVersions [4,5,6]`. So the deferral was carried across an ingest
boundary and completed — a self-heal, not a leak.

**What was NOT exercised:** the *crash* path specifically. No crash was induced between the delete
loop and the meta patch. The idempotency argument for that path rests on code reading, not on a live
observation, and the `it.todo` text says so.

### it.todo #4 — graceful-skip before ingest — **VERIFIED LIVE**

Cross-referenced from Task 1.5's control-paired probe: `{status: success, value: null}` pre-ingest
against `Could not find public function` for a bogus name.

### Backend health after six ingests

```
$ docker stats convex-backend --no-stream
convex-backend  MEM=18.65GiB / 64GiB (29.13%)  CPU=0.01%

$ curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3210/version
200
$ curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3210/definitely-not-a-real-route-9x7q2
404
```

The 200 is paired with its bogus-path control and the two differ, so it carries information. No
dashboard-wide "no data / all zeros" state occurred. Memory at 18.65 GiB is consistent with this
instance's documented working-set climb between `ConvexNightlyRestart` runs
(`./CLAUDE.md` § Self-Hosted Convex, ~0.17–1.04 GiB/h) and is not attributed to these ingests — no
before-reading was taken, so no claim is made either way.

`npx convex import --replace-all` does not appear anywhere in this plan's transcript.
Full suite after all changes: **316 files passed, 17 skipped; 4,286 tests passed, 197 todo.**

---

## Corrections — three diagnoses, two of them wrong

This section exists because the first two explanations for the version-4 failure were confidently
wrong and were acted on. Recording only the final answer would misrepresent how it was found.

**The symptom.** Ingests 1–3 succeeded. Ingest 4 — the first where the prune activates — returned
`post-failed (exit 4)`. The route returns a generic `INGEST_FAILED` by design
(`convex/workspaceHttp.ts:222-226`, so directory paths cannot leak into a response), so the real error
was invisible until the internal mutation was called directly through the admin API:

```
Uncaught Error: Too many reads in a single function execution (limit: 4096).
    at async handler (../convex/workspace.ts:206:4)
```

**Wrong diagnosis 1 — the write ceiling.** The original constants were justified against a
"~16,000-doc per-mutation write ceiling". That ceiling is real — Convex's docs confirm
`Documents written 16,000`, which also settled `115-RESEARCH.md`'s Assumption A6 — but it is not what
this code hit. `MAX_DIRS_PER_INGEST` was also set to **20,000**, i.e. *above* the very ceiling its own
comment invoked as its reason for existing, so the guard admitted payloads that would then die inside
the mutation. Corrected to 8,000 with a regression test asserting the relationship against the
exported constants.

**Wrong diagnosis 2 — the delete loop's reads.** The `.collect()` over the whole stale version was
replaced with `.take(CAP+1)`, and the cap was then bisected: **4,000 → 2,000 → 1,000 → 500, all
failed identically.** The cap was never the lever.

**The actual cause, isolated by a control.** Holding the prune work constant (version 1 still holding
4,912 rows, cap 500) and varying only the insert count: **4,912 inserts FAILED, 100 inserts
SUCCEEDED.** A query issued after N inserts in the same mutation must merge that transaction's own
pending write set, at roughly N reads. That explains every observation — versions 1–3 succeeded
because with no prune there is no query after the inserts; version 4 failed at any cap because
`take()` had to see 4,912 pending rows first.

**The fix (D-11 deviation, approved by Larry).** `pruneWorkspaceVersions` became its own
`internalMutation`, called by the ingest route in a bounded loop after the insert commits. Each call is
its own transaction with a fresh read budget and no pending write set. D-11's substance is unchanged —
still request-driven, never a cron; still a single-version capped delete, never a mass delete. What
changed is *same mutation* → *same request*. `WORKSPACE_DELETE_CAP` 4,000 → 1,500 and
`MAX_PRUNE_CALLS` 6, with the steady-state invariant `MAX_PRUNE_CALLS * CAP >= MAX_DIRS_PER_INGEST`
(9,000 ≥ 8,000) asserted in a test rather than left in a comment.

**Same defect, NOT fixed here.** `convex/graphSnapshots.ts:193-219` caps deletes at 15,000 while
reading via `.collect()`. Its cron is disabled at `crons.ts:145-151` for a "candidate-selection read
[that] times out", which is very likely this same bug under a wrong diagnosis. Out of scope for
Phase 115; recorded as a follow-up.

### A side effect I caused, disclosed

The 100-directory control run **wrote a real version 4 to the live database** — 100 dirs, with a
placeholder `dryRunReportHash` — and pruned 500 rows from version 1. For a period the live
`getWorkspaceMap` returned a 100-directory truncation rather than the approved snapshot. It should
have been run against a scratch `snapshotId`. Versions 1–3 were intact throughout and nothing was
lost; version 5 restored a real full snapshot and version 6 confirmed it. Recorded because the
alternative is a durable artifact that implies the live data was untouched.

### Deploys

Four deploys, all via
`npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`. Every one reported
`No indexes are deleted by this push` and `Deployed Convex functions to http://127.0.0.1:3210`. No
`*.convex.cloud` host appeared in any output.

---

## Resolved after the first checkpoint report

Both items Larry flagged were fixed the same session; the evidence is below rather than a claim that
they were.

### R1. D-12's hash now covers the CLASSIFICATION, not the file inventory — **FIXED**

`hashableView` returned the whole report minus `generatedAt`/`reportHash`, so the approval hash covered
every file count and byte total. Measured: three consecutive dry-runs gave 229,178 → 229,180 → 229,181
files and two distinct hashes, and the first post-approval ingest refused with exit 3 after seconds of
drift. Over 24 hours a change is certain, so plan 115-10's nightly task would have exited 3 **every
night, forever**.

`classificationView()` now projects only the allowlist and exclusions, every root with its
department/access/covered flag, the Unclassified set, coverage, `localConfigStatus` and
`accessDerivationOk`. `buildDryRunReport` also emits a new `classification` block carrying the
allowlist and exclude lists — **the report did not contain the allowlist at all before**, so the old
whole-report hash could not see the single most important thing the approval exists for: widening the
allowlist changed which files transmit and invalidated nothing.

Proven in both directions, since a hash that never changes is as broken as one that always does.

*Live control, on the real tree.* Two walks differing by exactly one planted, then removed,
allowlisted file:

```
walk A: files=229205 bytes=32958930029
walk B: files=229206 bytes=32958930071
tree moved between walks: true

OLD whole-report hash equal?   false   <- the old rule WOULD have refused
NEW classification hash equal? true
```

A first attempt at this control returned `tree moved between walks: false` and was reported
**INCONCLUSIVE** rather than as a pass — a quiet tree explains an unchanged hash just as well as a
correct fix does.

*Live end-to-end.* One `--dry-run` + one `--approve`, then **two consecutive ingests with no
re-approval** — versions 7 and 8, both `ingested (exit 0)`. Under the old rule the second would have
refused. That is the nightly case.

*Unit.* File churn, byte totals, the sample, and reworded `evidence` prose do **not** invalidate; a
department change, a widened allowlist, a dropped directory exclusion, lost coverage, a new root, and a
degraded `localConfigStatus` all **do**. A GUARD test asserts the fixture is non-degenerate — the first
version of these tests mutated an empty `excludeDirs` array and passed vacuously.

The D-12 case 5 control was also split. Its name promised "someone widened the allowlist and re-ran the
nightly task" while its body only added a file — so the scenario it advertised was never exercised.
Now `(c1)` a file appearing after approval **ingests**, and `(c2)` the allowlist widened after approval
**refuses** with exit 3 and never calls `postSnapshot`.

### R2. The version-4 truncation I caused is gone — **FIXED**

Cleaned up by letting the versions roll forward rather than by hand-deleting rows. Final state:

```
activeVersion    8      totalDirs 4912   rowsReturned 4912
storedVersions   [6, 7, 8]
prunedVersion    5      pruneIncomplete false
oldest row physically remaining in workspaceDirs: version 6
```

The oldest surviving row is version **6**, so version 4's 100-directory snapshot is physically deleted
along with versions 1, 2, 3 and 5. All three retained versions are real, complete 4,912-directory
snapshots.

---

## Open issues

**1. `graphSnapshots.ts` carries the same `.collect()`-with-a-delete-cap defect** (see Corrections).
Inert today because its cron is disabled at `crons.ts:145-151`. Not fixed — out of Phase 115's scope.

**2. The crash path of the prune's idempotency was never exercised.** The deferred-remainder path was
exercised for real; the crash-between-delete-and-patch path rests on code reading only, and the
`it.todo` text says so.

**3. D-05's unattended firing is still unproven.** The gate no longer blocks it and two consecutive
ingests now succeed on one approval, but no scheduled task has been registered and no overnight run has
been observed. That is plan 115-10's work and is not claimed here.
