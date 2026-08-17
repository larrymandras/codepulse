# Phase 112 — Live Evidence (plan 112-07)

Operator-gated deploy and post-deploy probes against the live self-hosted Convex
backend. Every command and output below is verbatim.

- **T0 (this session's deploy):** `2026-08-12T16:10:19Z` (epoch seconds `1786551019`), local `2026-08-12 12:10:19 EDT`
- **HEAD at deploy:** `0ca49e0d6a2a6b23f4fa01d4dadfdc95849275eb`
- **Deploy authorized by:** operator, in-session, before the command was run

---

## Task 1 — Deploy

### Pre-deploy assertions

- `convex-backend` — `Up 4 hours (healthy)` (`docker ps`)
- Working tree clean (`git status --porcelain` returned nothing)
- `git diff eb084397..HEAD --stat -- convex/` returned **empty** — the deploy surface is exactly
  Phase 112's own work. The concurrent Phase 115 session has touched **no** `convex/` file
  (verified: `git log --grep="115-0"` + `git show --name-only` produced zero `convex/` paths);
  its changes are confined to `hooks/`, which `convex deploy` does not ship.
- Last commit touching `convex/schema.ts` is `65a4870e feat(112-02)` — this phase's own.

### Command

```
npx convex deploy --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile
```

`--env-file` present. No `--push`, no `--prod`, not `npm run deploy`, not a bare
`npx convex deploy`.

### Output (verbatim)

```
▌ Deploying code to deployment:
▌ └─ http://127.0.0.1:3210
- Deploying to http://127.0.0.1:3210...

✔ No indexes are deleted by this push
Uploading functions to Convex...
Generating TypeScript bindings...
Running TypeScript...
Pushing code to your Convex deployment...
Schema validation complete.
Finalizing push...
✔ Deployed Convex functions to http://127.0.0.1:3210
EXIT_CODE=0
```

**Deployment target line:** `http://127.0.0.1:3210` — the self-hosted instance.
**`tidy-whale-981` appears nowhere in the output.** Exit code 0.

### Deployed-surface probe, with discriminating control

```
$ npx convex run governorDecisions:listRecent '{}' --env-file <path>
[ { "_creationTime": 1786550453222.4312, "_id": "ns7zzaq02jyhcdfwwgjazq6bjh8cb99g",
    "emitter": "watch_pulse", "priority": "normal", "spoke": false,
    "timestamp": 1786550449.4234 }, ... ]

$ npx convex run governorDecisions:definitelyNotARealFunction9x7q2 '{}' --env-file <path>
✖ Failed to run function "governorDecisions:definitelyNotARealFunction9x7q2":
Could not find function for 'governorDecisions:definitelyNotARealFunction9x7q2'.
```

The two calls return **different kinds of result**, so the probe carries information. Same control
applied to `messageRoutes`:

```
$ npx convex run messageRoutes:listRecent '{}' --env-file <path>
[]
$ npx convex run messageRoutes:notARealFn9x7q2 '{}' --env-file <path>
✖ Could not find function for 'messageRoutes:notARealFn9x7q2'.
```

`messageRoutes:listRecent` returning `[]` is a **deployed and empty** surface, not a missing one —
the control is what distinguishes those two states.

---

## UNRESOLVED — an earlier deploy this session did not run

The domain table already held rows **before** T0, which the plan did not anticipate. Stating what
is measured, and not inventing a cause:

- All 11 `governorDecisions` rows were created in an 88 ms window at `2026-08-12T16:00:53Z`
  — **9 minutes 26 seconds before this session's deploy at 16:10:19Z**.
- `governor_decision` arrives as an **hourly** `watch_pulse` burst. The generic `events` table
  shows bursts at `15:00:52Z` and `16:00:53Z` and nothing between.
- The `15:00:52Z` burst is present in generic `events` but **absent** from the domain table; the
  `16:00:53Z` burst is present in **both**.

Therefore a deploy of this phase's code occurred **between 15:00:52Z and 16:00:53Z**, from a source
this session cannot identify. Candidates, neither confirmed: one of this phase's executor agents
(each was explicitly forbidden to deploy and each asserted it ran none), or the concurrent Phase 115
session working in the same checkout. No `npx convex dev` process is running — checked
`Get-CimInstance Win32_Process` for all `node.exe` command lines, with vite/forge/next visible as a
control proving the probe works.

This does not invalidate the results below: this session's deploy re-pushed the same committed
`HEAD`, exited 0, and reported `Schema validation complete`. It is recorded because an
unattributed production deploy is worth knowing about, and because the T0 anchoring the plan
specified is not the moment the route actually went live.

---

## Task 2 — Live probes

### D-04 — `governor_decision` reaches the domain table

**PASS.** `governorDecisions` is **not empty** — 11 rows. The plan pre-declared an empty domain
table a FAILURE; that condition is not met.

| Measure | Value |
|---|---|
| Rows in `governorDecisions` | 11 |
| Oldest / newest `_creationTime` | `2026-08-12T16:00:53.134Z` / `.222Z` |
| Distinct `emitter` | `watch_pulse` |
| Distinct `priority` | `normal` |

### D-14 — the explicit-null path, proven in production

**PASS, zero shortfall.** The generic `events` table is the independent witness: if the validator
were rejecting rows, generic would exceed domain over the same window. It does not.

| Measure | Value |
|---|---|
| `governor_decision` rows in generic `events`, **in the 16:00:53 burst second** | **11** |
| Rows in domain `governorDecisions` | **11** |
| **Shortfall** | **0** |
| Rows with a `heldReason` key present | 0 |
| Rows with `heldReason === null` | **0** — the value the validator would have rejected never reaches storage |

`heldReason` absent rather than null on every row is `normalizeOptional` doing exactly its job:
an explicit JSON `null` on the wire becomes an absent field, so the row stores instead of the whole
event being refused. This is the mechanism that made Phase 108's `control_verb_swap` land zero rows.

**Unit sanity check** (required, because a threshold comparison can pass vacuously on a wrong unit
interpretation): `_creationTime` is epoch **milliseconds**, event `timestamp` is epoch **seconds**.
Formatting the newest row yields `2026-08-12`, which matches today's wall clock. The comparison is
therefore being made in the units it claims.

### Post-T0 window — no traffic, and that is measured, not assumed

| Measure | Value |
|---|---|
| Generic `events` `governor_decision` at/after T0 | **0** |
| Domain `governorDecisions` at/after T0 | **0** |

Both sides are zero, so the absence of new domain rows is **absence of input**, not silent
dropping. `astridr-agent` is `Up 4 hours (healthy)`, so the emitter is alive; `watch_pulse` is
hourly, and the next burst is due at approximately `17:00:5xZ`. A shortfall could only be
demonstrated by generic exceeding domain, and it does not.

### D-13 — `message_routed`

**OPEN — not passed, and deliberately not claimed as passed.**

The `messageRoutes` surface is deployed and reachable (proven above with a discriminating control),
and it holds **0 rows**. That zero is explained by a paired probe rather than asserted away:
`message_routed` was measured during planning at **10 rows in 14 days** (~0.7–1.2/day), against
`governor_decision`'s 1,168 rows / 83.3 per day. At roughly one row per day, nothing was expected to
arrive in this verification window, and nothing did.

This is stated as **"the route is deployed; its end-to-end delivery is unproven"** — never as proof
the route works. Confirming it requires either waiting for organic traffic or a later observation.

---

---

## Final measurement — 2026-08-13T11:56Z (T0 + ~19.75 h)

The Task 2 figures above were taken minutes after the deploy, over a single 88 ms burst of 11
rows from one emitter. They are **superseded** by this measurement, which spans nearly twenty
hours and eight distinct emitters. Both are recorded; the earlier one was too thin to carry the
D-14 verdict on its own, and saying so is part of the evidence.

### Method correction, recorded because the first attempt was wrong

Matching the two tables on `_creationTime` produced a shortfall of **−1** — the domain table
appearing to hold one row MORE than the generic table. That is not a surplus and not a defect:
the generic `events` row and the domain row are **two separate inserts** from the same ingest
call, with `_creationTime` values a few milliseconds apart, so a window whose bounds are taken
from domain insert times clips the corresponding generic rows at the boundary.

The correct join key is the event's own `timestamp` field, which carries the **same value** into
both tables. A `-1` was not rounded away or explained as noise; the comparison was rebuilt.

Equally, a naive `74 generic since T0` vs `50 domain rows` comparison would have manufactured a
false shortfall of 24. `listRecent` is `.take(GOVERNOR_DECISION_CAP)`-bounded at 50, so the domain
read is truncated by the CAP, not by data loss. The valid comparison is confined to the window the
capped read actually covers.

### Result

| Measure — window `2026-08-12 15:00:30 ET` → `2026-08-13 07:01:10 ET` | Value |
|---|---|
| Domain `governorDecisions` rows in window | **50** |
| Generic `events` `governor_decision` rows in window | **50** |
| **Shortfall** | **0** |
| **Timestamp multisets identical** | **true** |
| Rows with `heldReason === null` | **0** |
| Sanity: newest row date | `2026-08-13` (matches wall clock) |

`timestamp multisets identical: true` is a **one-to-one correspondence**, not merely equal counts:
every generic `governor_decision` event in the window has exactly one matching domain row. This is
the strongest form of the D-14 proof available without a synthetic injection.

### Live data diversity at final measurement

| Dimension | Observed |
|---|---|
| Emitters (8) | `cron:dep_scanner`, `cron:task_section_email`, `cron:task_also_deliver`, `cron:task_delivery`, `watch_pulse`, `cron:operator_score`, `cron:skill_health`, `startup_test` |
| Priorities (4) | `high`, `normal`, `money`, `low` |
| `spoke` true / false | 19 / 31 |

The earlier snapshot had one emitter, one priority, and zero `spoke: true` rows. Both the Spoke
and Held branches of the UI are now exercised by real data.

---

## Task 3 — Operator confirmation

**APPROVED** by the operator, 2026-08-13. Verbatim resume signal: `approve3d` (typo for
"approved"; the operator had already supplied two screenshots as their report).

The operator's report was delivered as two screenshots of the running Settings → notifications
tab rather than as prose. Observations, read from that evidence and confirmed by the operator:

| Bullet | Observed |
|---|---|
| Rows render, not the empty state | 50 rows; footer reads `Showing the last 50 decisions — earlier decisions may exist.` |
| At least one `Spoke` and one `Held` | 2× `Spoke` at 1:00:47 PM; many `Held` |
| `Held` Reason cell | bare `held` — never "Failed" or "Error" |
| `Spoke` Reason cell | **em dash** (—) |
| `When` plausible, no 1970 date | `1:00:46 PM`, `1:00:47 PM`, `2:00:48 PM`, `5:01:20 PM` |
| Priority = neutral outline badges | `normal`, `low`, `money` all render in the same neutral outline style |
| Only coloured element is the Spoke icon | cyan check on `Spoke`; grey crossed-eye on `Held` |

**One operator-reported discrepancy, investigated and resolved as NOT a defect.** The operator
reported not seeing rows at the timestamps quoted from the database. Diagnosis: they were viewing
the bottom of the table; the newest rows sit at the top. Proven rather than asserted — the
operator's screenshot ended at `1:00:46 PM ×3` and the live query's last three rows were also
`1:00:46 PM ×3`. Because the 50-row window slides forward as rows arrive, a page stale at the
5:01 PM snapshot would have had an oldest row around 12:00 PM, seven rows earlier. An identical
bottom edge is only possible if the page also held the newer rows. Separately confirmed the
returned sequence is exactly sorted descending on `timestamp` (`ordering agrees: true`), so the
`by_timestamp` index is behaving.

A note on a 4-second offset that could later be mistaken for drift: the UI renders the event's own
`timestamp`, while `_creationTime` is Convex's insert time roughly 4 s later. Quoted DB times and
displayed times differ by that amount consistently, in every burst. The UI is reading the correct
field.

---

## Summary of verdicts

| Item | Verdict | Basis |
|---|---|---|
| Deploy reached the self-hosted backend | **PASS** | target line `http://127.0.0.1:3210`, exit 0, no `tidy-whale-981` |
| Both new function surfaces deployed | **PASS** | probe + discriminating control on each |
| D-04 `governor_decision` → domain table | **PASS** | 50 rows across 8 emitters; table not empty |
| D-14 explicit-null path in production | **PASS** | 50 generic == 50 domain over ~19.75 h, **timestamp multisets identical**; 0 rows with `heldReason === null` |
| D-13 `message_routed` end-to-end | **OPEN** | surface deployed and reachable (control-paired), 0 rows, explained by its measured ~0.7–1.2 rows/day rate |
| Operator UI confirmation | **PASS** | approved 2026-08-13; all seven bullets evidenced, one reported discrepancy investigated and resolved as a scroll position |
| Deploy provenance before T0 | **UNRESOLVED** | bounded to 15:00:52Z–16:00:53Z; source unidentified; no `convex dev` running (control-checked) |
