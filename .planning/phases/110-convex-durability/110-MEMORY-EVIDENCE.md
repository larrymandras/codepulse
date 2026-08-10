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

*(Task 2 continues below with the structured D-09 write-up and Verdict.)*
