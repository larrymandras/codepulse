# DUR-03 Memory-Growth Root-Cause — Evidence

**Plan:** 110-02
**Date:** 2026-08-10
**Repo:** codepulse (`master`), live self-hosted `convex-backend` at `127.0.0.1:3210`

This file is a verbatim command transcript. No Convex admin key, deploy key, bearer token, or any
other credential value appears anywhere below. Environment variables are recorded as bare **names
only** — `docker inspect`'s `Config.Env` output is piped through `cut -d= -f1` before it reaches
this file, and `npx convex env list` (which prints full `NAME=VALUE` against this self-hosted
backend) was never run.

**Container image identity** (anchors every claim below to a specific binary):
- Repo digest: `ghcr.io/get-convex/convex-backend@sha256:f0de0647e46c0ac830a6dda036ee78e4956cecc00144d951bf39b14cc570ad4d`
- Image built: `2026-07-21T00:54:28.490576988Z`
- Running container (`convex-backend`) created/recreated: `2026-08-06T17:51:02.482371472Z` (the `restart-convex.ps1` recreate documented in `health-report.md` — the container has been restarted nightly since, most recently `2026-08-10T02:00:37`, but not recreated from a new image)

---

## Task 1 — Raw probe transcript (captured 2026-08-10, live)

### A. Knob probe (D-09) — control-paired

```
$ for NAME in DOCUMENT_RETENTION_DELAY UDF_CACHE_MAX_SIZE MODULE_CACHE_MAX_SIZE_BYTES INDEX_CACHE_SIZE DOCUMENTS_IN_MEMORY FUNRUN_ DEFINITELY_NOT_A_REAL_ENV_VAR_9X7Q2; do
  echo "== $NAME =="
  MSYS_NO_PATHCONV=1 docker exec convex-backend grep -a -c "$NAME" /convex/convex-local-backend
done

== DOCUMENT_RETENTION_DELAY ==
1
== UDF_CACHE_MAX_SIZE ==
1
== MODULE_CACHE_MAX_SIZE_BYTES ==
1
== INDEX_CACHE_SIZE ==
2
== DOCUMENTS_IN_MEMORY ==
1
== FUNRUN_ ==
2
== DEFINITELY_NOT_A_REAL_ENV_VAR_9X7Q2 ==
0
```

**Control pair, same block:** `DOCUMENT_RETENTION_DELAY` (known-present, already a live knob per
`docker inspect`) returns `1`; `DEFINITELY_NOT_A_REAL_ENV_VAR_9X7Q2` (known-absent) returns `0`.
The technique is validated — every other line in this block is now a fact about the binary, not a
guess about the grep.

### B. Live environment (D-09) — name-only filter, no `npx convex env list`

```
$ docker inspect convex-backend --format '{{range .Config.Env}}{{println .}}{{end}}' | cut -d= -f1

INSTANCE_NAME
INSTANCE_SECRET
CONVEX_CLOUD_ORIGIN
CONVEX_SITE_ORIGIN
DISABLE_BEACON
RUST_LOG
DOCUMENT_RETENTION_DELAY
PATH
```

Of the candidate memory-bounding knobs probed in section A, only `DOCUMENT_RETENTION_DELAY` is
actually *set* on the running container — it controls tombstone GC delay (1800s per RESEARCH.md),
not a cache/working-set cap. None of `UDF_CACHE_MAX_SIZE`, `MODULE_CACHE_MAX_SIZE_BYTES`,
`INDEX_CACHE_SIZE`, `DOCUMENTS_IN_MEMORY`, or any `FUNRUN_*` knob is set — the binary accepts them
(section A), but this deployment runs every one of them at its compiled-in default.

### C. Upstream default values for the named knobs — re-derived, not carried over

RESEARCH.md's "~1.5 GiB of bounded budget" claim was re-fetched live from the same upstream source
file it cites, rather than trusted:

```
$ gh api repos/get-convex/convex-backend/contents/crates/common/src/knobs.rs --jq '.content' \
    | base64 -d > /tmp/knobs.rs
$ wc -l /tmp/knobs.rs
1970 /tmp/knobs.rs

$ grep -n -E "UDF_CACHE_MAX_SIZE|MODULE_CACHE_MAX_SIZE_BYTES|INDEX_CACHE_SIZE|DOCUMENTS_IN_MEMORY|FUNRUN_" /tmp/knobs.rs
68:pub static UDF_CACHE_MAX_SIZE: LazyLock<usize> =
69:    LazyLock::new(|| env_config("UDF_CACHE_MAX_SIZE", 104857600));
72:pub static SHARED_UDF_CACHE_MAX_SIZE: LazyLock<usize> =
73:    LazyLock::new(|| env_config("SHARED_UDF_CACHE_MAX_SIZE", 1024 * 1048576));
341:pub static DOCUMENTS_IN_MEMORY: LazyLock<usize> =
342:    LazyLock::new(|| env_config("DOCUMENTS_IN_MEMORY", 512));
1246:pub static MODULE_CACHE_MAX_SIZE_BYTES: LazyLock<u64> =
1247:    LazyLock::new(|| env_config("MODULE_CACHE_MAX_SIZE_BYTES", 100_000_000));
1254:pub static FUNRUN_INDEX_CACHE_SIZE: LazyLock<u64> =
1255:    LazyLock::new(|| env_config("FUNRUN_INDEX_CACHE_SIZE", 50_000_000)); // 50 MB
1266:pub static FUNRUN_MODULE_CACHE_SIZE: LazyLock<u64> =
1267:    LazyLock::new(|| env_config("FUNRUN_MODULE_CACHE_SIZE", 250_000_000));
1278:pub static FUNRUN_CODE_CACHE_SIZE: LazyLock<u64> =
1279:    LazyLock::new(|| env_config("FUNRUN_CODE_CACHE_SIZE", 500_000_000));
1906:pub static INDEX_CACHE_SIZE: LazyLock<u64> =
1907:    LazyLock::new(|| env_config("INDEX_CACHE_SIZE", 512 * 1024 * 1024));
```

Sum of the byte-sized caches named in this plan's candidate list (`UDF_CACHE_MAX_SIZE` +
`MODULE_CACHE_MAX_SIZE_BYTES` + `FUNRUN_INDEX_CACHE_SIZE` + `FUNRUN_MODULE_CACHE_SIZE` +
`FUNRUN_CODE_CACHE_SIZE` + `INDEX_CACHE_SIZE`):
`104,857,600 + 100,000,000 + 50,000,000 + 250,000,000 + 500,000,000 + 536,870,912 = 1,541,728,512`
bytes ≈ **1.44 GiB** — confirms RESEARCH.md's "roughly 1.5 GiB" figure by direct re-derivation
from the source, not by trusting the prior write-up.

`DOCUMENTS_IN_MEMORY` is a **document count** cap (default 512), not a byte size — excluded from
the byte sum, but it is one more general-purpose knob whose default is bounded and unrelated to
sustained multi-GiB growth. A sibling knob not on this plan's candidate list, `SHARED_UDF_CACHE_MAX_SIZE`
(default `1024 * 1048576` = 1 GiB), exists adjacent to `UDF_CACHE_MAX_SIZE` in the same file —
including it, the total named-cache budget is still only **~2.44 GiB**.

### D. Upstream issue and PR status — re-derived live, this run

```
$ date -u +"%Y-%m-%dT%H:%M:%SZ"
2026-08-10T20:43:31Z

$ gh issue view 495 --repo get-convex/convex-backend --json number,state,stateReason,author,title,closedAt
{"author":{"login":"santigamo","name":"Santi"},"closedAt":null,"number":495,"state":"OPEN",
 "stateReason":"","title":"Self-hosted SQLite backend: index_scan materializes the entire index
 range (ignores size_hint / no LIMIT), causing \"too many system operations\" + OOM on large
 tables"}

$ gh issue view 525 --repo get-convex/convex-backend --json number,state,stateReason,author,title,closedAt
{"author":{"login":"Sjotie","name":""},"closedAt":null,"number":525,"state":"OPEN","stateReason":"",
 "title":"Self-hosted: in-process searchlight disk cache and segment LRUs are uncoordinated — RAM
 growth from deleted-but-mapped segments, meta.json watcher log flood, and ENOENT query failures"}

$ gh pr view 522 --repo get-convex/convex-backend --json number,state,mergedAt,title,url
{"mergedAt":null,"number":522,"state":"OPEN",
 "title":"Fix SQLite persistence materializing entire ranges in index_scan and load_documents (#495)",
 "url":"https://github.com/get-convex/convex-backend/pull/522"}
```

**Correction to the plan's own field list:** the plan's `<how-to-verify>`/task text asks for
`author_association`; `gh issue view --json` in the installed `gh` version has no such field
(confirmed by requesting it and reading the "Unknown JSON field" error's list of available
fields). Substituted `author` (GitHub login) — both #495 and #525 are filed by community members
(`santigamo`, `Sjotie`), not Convex-org maintainers; nothing here claims official maintainer
triage status either way.

**Both issues:** `state: OPEN`, `stateReason: ""` (GitHub only populates `stateReason` on closed
issues — an empty string on an open issue is the correct/expected value, not a probe failure).
**PR #522:** `state: OPEN`, `mergedAt: null` → **unmerged**. Re-confirms RESEARCH.md's Assumption
A3 correction: a fix for #495 exists upstream as an open PR, but nothing in the image running here
(built 2026-07-21, PR opened afterward) or on `main` today has picked it up.

### C (plan's letter) — #525 ruled out, with positive control

```
$ grep -c "searchIndex\|vectorIndex" convex/schema.ts
0
$ grep -c "\.index(" convex/schema.ts
288
```

`schema.ts` defines `288` `.index(...)` calls and **zero** `searchIndex`/`vectorIndex` calls. The
positive control (`288`) proves the grep pattern itself works against this file — the `0` above is
a fact about the schema, not a silently-broken search string. #525's mechanism (uncoordinated
search-index segment LRUs) requires a table using `.searchIndex()`/`.vectorIndex()`; this schema
has none, so #525 does not apply to this deployment.

### D (plan's letter) — Current growth reading, timestamped

```
$ date -u +"%Y-%m-%dT%H:%M:%SZ"
2026-08-10T20:43:48Z

$ docker stats --no-stream convex-backend
CONTAINER ID   NAME             CPU %     MEM USAGE / LIMIT   MEM %     NET I/O         BLOCK I/O         PIDS
a41bfddb8465   convex-backend   134.75%   23.31GiB / 64GiB    36.42%    103MB / 178MB   14.6MB / 21.8GB   86

$ MSYS_NO_PATHCONV=1 docker exec convex-backend ls -la /convex/data/db.sqlite3
-rw-r--r-- 1 root root 6753239040 Aug 10 20:43 /convex/data/db.sqlite3
```

**Heap-vs-page-cache breakdown, same methodology as `health-report.md` §5** (re-run live, not
carried forward):

```
$ MSYS_NO_PATHCONV=1 docker exec convex-backend sh -c 'grep "^anon " /sys/fs/cgroup/memory.stat; grep "^active_file " /sys/fs/cgroup/memory.stat; grep "^inactive_file " /sys/fs/cgroup/memory.stat; cat /sys/fs/cgroup/memory.current'
anon 24865218560
active_file 109113344
inactive_file 7966720
25055739904
```

`anon` = 24,865,218,560 bytes ≈ **23.16 GiB**; `active_file + inactive_file` ≈ 0.109 GiB. Today's
reading is ~99.5% anonymous heap, not the ~20% reclaimable page cache `health-report.md` measured
on 2026-08-06 — a different mix than the prior sample, recorded here as an observation, not
explained (D-09 declines to fund the attribution work that would explain the variance).

**Implied current-cycle rate, against the last recorded restart baseline** (`restart-convex.log`,
`.planning/phases/110-convex-durability/110-CONTEXT.md`'s D-10 citation):
- Last restart: `2026-08-10 02:00:37`, memory after = `8181 MiB`
- This reading: `2026-08-10 20:43:48` UTC-equivalent local, memory = `23.31 GiB` = `23,869 MiB`
- Elapsed: `18h 43m` ≈ `18.72h`
- Growth: `23,869 − 8,181 = 15,688 MiB` over `18.72h` ≈ **0.82 GiB/h**

This is materially **higher** than the `~0.17 GiB/h` baseline `health-report.md` and CONTEXT.md's
D-10 cite (measured over a longer, multi-day 2026-07-30→08-06 window). Recorded honestly as a
discrepancy, not smoothed over: this single ~18.7h sample does not overturn a multi-day baseline,
and D-09 explicitly declines to fund the multi-day controlled study that would settle whether
today's rate is a new steady state, a transient (this container has been running continuously
since the 08-06 recreate, i.e. this is its 5th consecutive nightly-restart cycle, one cycle deeper
into currently-unexplained territory than any single sample in `health-report.md`), or normal
day-to-day variance. Either way, it does not change the D-09 verdict below: even the higher rate
implies nothing about a *bounded* cache knob, since the summed named-cache budget (~1.44–2.44 GiB,
section C above) cannot itself explain multi-GiB/day growth at any observed rate.

---

## D-09 — Knob probe

Raw transcript: Task 1 §A (control-paired binary grep), §B (live env, name-only), §C (upstream
default values re-derived from `knobs.rs`), above.

**Verdict:** No general-purpose memory-bounding knob was found **among the candidates probed**
(`DOCUMENT_RETENTION_DELAY`, `UDF_CACHE_MAX_SIZE`, `MODULE_CACHE_MAX_SIZE_BYTES`,
`INDEX_CACHE_SIZE`, `DOCUMENTS_IN_MEMORY`, the `FUNRUN_*` cache family). All six are compiled into
this exact binary (confirmed via a control-paired `grep -a`, §A) and all default to a bounded size;
only `DOCUMENT_RETENTION_DELAY` is actually set on the running container, and it governs tombstone
GC timing, not a working-set cap (§B). The summed byte-sized budget of the named caches is
~1.44 GiB (~2.44 GiB including the adjacent, not-originally-named `SHARED_UDF_CACHE_MAX_SIZE`, §C)
— nowhere close to the observed climb (Task 1 §D: 23.31 GiB present, ~15.7 GiB of growth in a
single 18.7h inter-restart window). This is a **scope-limited absence claim**: "no bounding knob
was found among the candidates investigated," per RESEARCH.md's Assumption A1 — the ~1,970-line
`knobs.rs` file has subsystems beyond these six that were not individually itemized, so this does
not claim "no knob exists anywhere in the binary."

## D-09 — Upstream root-cause status

Raw transcript: Task 1 §D (live `gh issue view`/`gh pr view`), above. Re-verified this run,
2026-08-10T20:43Z — nothing here is carried forward from RESEARCH.md.

**Verdict:** `get-convex/convex-backend#495` ("index_scan materializes the entire index range...
OOM on large tables") is `state: OPEN`, filed by a community member, not a maintainer. Its linked
fix, **PR #522**, is also `state: OPEN` with `mergedAt: null` — **unmerged**. This is the strongest
identified candidate mechanism: on self-hosted SQLite persistence, `index_scan` reads the entire
matched index interval into memory before applying `.take(N)`, so any bounded-looking read against
a wide range still costs memory proportional to the whole range. A fix exists upstream but has not
shipped in any build — a materially different operational position than "nothing can be done,"
and the fact most likely to change after this phase closes (re-check `#522`'s merge state before
citing this evidence file as current beyond a few weeks out).

**Scope limit, stated honestly (RESEARCH.md Assumption A2):** no live experiment in this repo
isolated `index_scan`/`#495` as *the* cause of the observed growth — D-09 explicitly declines to
fund the multi-day controlled attribution study that would prove causation. This write-up records
`#495` as the strongest *candidate contributor*, not as a proven root cause.

## D-09 — #525 ruled out

Raw transcript: Task 1 §C (plan's letter, the `.index(`-controlled schema grep), above.

**Verdict:** `get-convex/convex-backend#525` ("in-process searchlight disk cache and segment LRUs
are uncoordinated — RAM growth...") is `state: OPEN`, also community-filed, no linked PR found.
Its mechanism requires a table using `.searchIndex()`/`.vectorIndex()`. `convex/schema.ts` defines
zero of either (control: `288` `.index(...)` calls in the same file, proving the grep itself works)
— so #525 is ruled out for this deployment, not merely unconfirmed.

## Already-refuted hypotheses (cited, not re-derived — `health-report.md`, 2026-08-06)

- **OCC-retry theory** (the growth is caused by optimistic-concurrency retries on
  `events.js:ingest`/`aggregates`): refuted. `health-report.md` §6 compared equivalent windows —
  604 OCC/retry lines in a 4.8h window on 08-05 vs. **10** lines (0 on `events`/`aggregates`) in a
  3.6h window on 08-06, with heap flat (anon Δ ≈ −3.6 MB over 5.4 min) while OCC contention was
  effectively absent. Memory still climbed regardless.
- **Page cache accounting for the bulk of the `docker stats` figure**: refuted as a *general*
  explanation, not merely for this run. `health-report.md` §5 found ~20% page cache / ~80% anon
  heap on 2026-08-06; Task 1 §D above found ~0.5% page cache / ~99.5% anon heap on 2026-08-10 —
  the ratio is not stable, so "it's mostly page cache" cannot be relied on as the explanation
  either day, though the underlying instruction (measure `anon`, not raw `docker stats`, before
  treating a reading as heap growth) still holds and was re-applied here.

## Verdict

**Branch selected: knob-absent.** No general-purpose memory-bounding knob was found among the six
candidates probed on this exact binary (`ghcr.io/get-convex/convex-backend@sha256:f0de0647e4...`,
built 2026-07-21). Their summed bounded budget (~1.44–2.44 GiB) cannot explain the observed climb
(23.31 GiB present; ~15.7 GiB of growth across one ~18.7h inter-restart window on 2026-08-10,
notably faster than the ~0.17 GiB/h baseline on record, though a single-sample discrepancy is not
grounds to revise that baseline). The strongest identified candidate contributor is upstream issue
**#495** (SQLite `index_scan` materializing entire index ranges before truncation) — `state: OPEN`,
`stateReason: ""`, filed by a community member. Its fix, **PR #522**, is `state: OPEN`,
`mergedAt: null` — a patch exists but is unmerged, so it is in no build available to this
deployment. Issue **#525** is ruled out (this schema has zero `.searchIndex()`/`.vectorIndex()`
usage, confirmed with a positive `.index(` control). Both the 2026-08-05 OCC-retry hypothesis and
the "it's mostly page cache" hypothesis are refuted/unreliable per `health-report.md` and this
run's own heap-vs-cache breakdown.

Per D-09, this is the explicitly-permitted "documented, not fixed" closure: **DUR-03 closes as
root-cause identified and documented, not resolved.** Per D-10, no knob was found, so there is
nothing to enable and no measured-trial decision is needed — the Task 3 checkpoint exists to
confirm this branch selection and the CLAUDE.md wording, not to make a D-10 call.

**Scope-limited wording, stated once more for the record:** this is "no bounding knob was found
among the candidates investigated" and "#495 is the strongest candidate contributor" — not "no
knob exists" and not "#495 is the cause." No live experiment isolated it, and D-09 declines to
fund one.
