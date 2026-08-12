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

_Pending. The report is generated and presented in this task; nothing is recorded here until Larry
responds explicitly. Silence is not a pass._

---

## Task 3 — First live ingest and it.todo conversion

_Pending Task 2._
