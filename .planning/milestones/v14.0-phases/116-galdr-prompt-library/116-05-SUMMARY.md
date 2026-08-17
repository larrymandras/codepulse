---
phase: 116-galdr-prompt-library
plan: 05
subsystem: infra

tags: [convex, self-hosted, deploy, galdr, auth, checkpoint]

# Dependency graph
requires:
  - phase: 116-01
    provides: "prompts / promptVersions table definitions in convex/schema.ts"
  - phase: 116-04
    provides: "convex/galdrHttp.ts handlers and the four /galdr routes in convex/http.ts"
provides:
  - "prompts and promptVersions live on the self-hosted Convex instance at 127.0.0.1:3210, readable"
  - "four /galdr routes answering on the HTTP-actions port 3211, fail-closed without a bearer and 200 with one"
  - "convex/_generated/api.d.ts carrying the galdr module, unblocking the typed api.galdr.* surface"
affects: [116-06, 116-07, 116-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bogus-bearer control alongside the 401/200 pair: a third probe sends a well-formed but wrong bearer and must also 401. Without it, no-auth 401 + real-bearer 200 is still consistent with a gate that only checks whether an Authorization header exists. The bogus probe is what proves the validator compares the value."

key-files:
  created:
    - .planning/phases/116-galdr-prompt-library/116-05-SUMMARY.md
  modified: []

key-decisions:
  - "Deploy run inline in the main session with Larry present and explicitly green-lighting it, per the plan's Task 2 and the Phase 107-05 precedent — not delegated to a subagent"
  - "GALDR_API_KEY was already set on the backend when the phase resumed; Larry set it in his own PowerShell window during the prior session, which closed before he could confirm. Presence established by name-only listing, never by reading the value."
  - "Every env-list invocation piped through `cut -d= -f1`. The bare `npx convex env list` prints NAME=VALUE against this self-hosted backend and dumps live secrets (verified 2026-08-10); the plan's earlier claim that it masks values was false and had already cost a real exposure."
  - "The bearer probe read GALDR_API_KEY into a shell variable via command substitution and printed only %{http_code}, so the value never entered the transcript."

patterns-established: []

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-08-10
---

# 116-05: Deploy the Galdr surface to the live self-hosted instance

## What happened

Both tasks complete. The two tables and four routes are live on the self-hosted
backend, proven by reads that return data and by a paired authorization probe.

## Task 1 — Pre-flight (auto)

| Check | Result |
|-------|--------|
| Backend container | `convex-backend \| Up 11 hours (healthy) \| 0.0.0.0:3210-3211->3210-3211/tcp` |
| Health | `GET http://127.0.0.1:3210/version` → HTTP 200 |
| Resolved target | `Self-hosted deployment configured.` followed by the dashboard subcommand's refusal — the refusal is the positive signal |
| `.convex.cloud` in that output | zero occurrences |
| `GALDR_API_KEY` present | **yes** |
| env-list form used | `npx convex env list \| cut -d= -f1` — name-only, never bare |
| Secret values printed | none |
| `git status convex/` | clean |
| Schema tables in working tree | `prompts` at `convex/schema.ts:2139`, `promptVersions` at `:2172` |

HTTP-actions port read from `convex-selfhost/docker-compose.yml:76` (`"3211:3211"`),
not assumed.

## Task 2 — Deploy (blocking checkpoint, passed)

`npx convex deploy` from `C:\Users\mandr\codepulse`. No `--replace-all`; no
`npx convex import` in any form.

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
✔ Added table indexes:
  [+] promptVersions.by_promptId   promptId, _creationTime
  [+] prompts.by_category   category, _creationTime
  [+] prompts.by_slug   slug, _creationTime
  [+] prompts.by_updatedAt   updatedAt, _creationTime
✔ Deployed Convex functions to http://127.0.0.1:3210
```

Exit 0.

### Acceptance criteria

| Criterion | Evidence |
|-----------|----------|
| Deploy output contains `127.0.0.1:3210` | quoted above, twice |
| Zero occurrences of `.convex.cloud` | `grep -c 'convex.cloud'` over the captured log → `0` |
| Schema push succeeded | `Schema validation complete.` (this CLI version's wording) |
| No index deleted | `✔ No indexes are deleted by this push`; four indexes added, none removed |
| `npx convex run galdr:list` returns `[]` | returned `[]`, exit 0 |
| `api.d.ts` contains `galdr` | 8 occurrences |
| No import / no `--replace-all` | neither appears in the session record |

### Authorization probe — `http://127.0.0.1:3211/galdr/list`

```
no-auth        -> HTTP 401
bogus-bearer   -> HTTP 401
real-bearer    -> HTTP 200
```

The 200 is the control that makes the 401 mean "the gate decided" rather than
"the route is missing". The bogus-bearer row is an addition beyond the plan: it
closes the remaining gap where a gate that merely checked for the *presence* of
an `Authorization` header would have produced an identical 401/200 pair.

## Deviations from plan

One addition, no removals: the bogus-bearer control described above. The plan
specified a two-call pair; three calls were run.

## Open items

None for this plan. The next blocking gate is whatever 116-06 defines; plans
116-06, 116-07 and 116-08 remain unexecuted.

Note for 116-07: the skill script needs the same `GALDR_API_KEY` value reachable
as a user-level environment variable or in `~/.claude/skills/galdr/.env`. That
half is **not** verified by this plan — only the backend's copy was proven.
