# Phase 118, Plan 02 — OpenArt MCP Evidence

**Question answered:** does the hosted OpenArt MCP expose real generation tools, and if not, does
authenticating make them appear? This measurement is what `118-14` mechanically asserts against
before any third-leg code is written (D-09 AMENDMENT 2026-08-13).

## Run metadata

- Date: 2026-08-14
- Run by: the `/gsd-execute-phase 118` orchestrator session, **inline**, not a `gsd-executor` subagent.
- **Why inline (deliberate workflow deviation):** Task 1 requires enumerating "the tooling actually
  available in this session," and Task 2 requires invoking `mcp__openart__authenticate`. The
  `gsd-executor` agent type is provisioned with `Read, Write, Edit, Bash, Grep, Glob,
  mcp__context7__*` only — it has no OpenArt MCP access and no visibility into this session's
  deferred-tool registry. A subagent could therefore only have *guessed* the tool surface, which
  Task 1's rule 2 explicitly forbids ("Never hand-construct an identifier"). Running inline is the
  only way to satisfy the plan's own constraint.

## Method

Enumeration was performed with the harness's `ToolSearch` verb, which is the authoritative surface
for this session's tool registry: it matches a query against the deferred-tool list and returns the
complete JSONSchema definition of each matching tool. Names were read off the returned schemas
verbatim; none were constructed, guessed, or completed from memory.

- Query for the subject: `+openart` (the `+` prefix requires the literal token in the tool name),
  `max_results: 25` — well above the number of tools any plausible surface would return, so the
  result is not truncated.
- Query for the control: `+github`, run in the same session moments later by the same mechanism.

No OAuth flow was attempted in this task. No token, authorization code, or callback URL appears
anywhere in this file.

## Pre-auth surface

`ToolSearch "+openart"` returned exactly **two** tools, both belonging to the OAuth handshake and
neither capable of generating media:

```
mcp__openart__authenticate
mcp__openart__complete_authentication
```

The `authenticate` tool's own description is itself authoritative evidence about the server's state,
and is quoted verbatim:

> The `openart` MCP server (http at https://mcp.openart.ai/mcp) is installed but requires
> authentication. Call this tool to start the OAuth flow — you'll receive an authorization URL to
> share with the user. Once the user completes authorization in their browser, the server's real
> tools will become available automatically.

Two facts follow directly from that string, neither inferred: the server **is** installed and
reachable (so this is not `SERVER_NOT_CONNECTED`), and the vendor's own MCP implementation asserts
that **real tools exist behind the auth wall**. What it does not say — and what no pre-auth
measurement can establish — is whether any of those real tools performs *generation* as opposed to
gallery browsing, account queries, or read-only listing. That is precisely what Task 2 measures.

## Control

**Control server: `github`** — known connected and functional in this session.

`ToolSearch "+github"` returned **8** complete tool schemas at an explicit `max_results: 8` cap
(the cap, not the surface, bounded that number); the session's deferred-tool registry lists **44**
`mcp__github__*` entries in total. Every returned schema was a real, functional operation
(`create_pull_request`, `get_commit`, `search_code`, `delete_file`, …) — not an auth stub.

The control therefore proves the enumeration method **can** surface real, non-auth tools when they
exist. OpenArt's two-tool auth-only result is consequently a finding about OpenArt, not an artifact
of the method. Had the control also come back empty or auth-only, this run would prove nothing and
this file would say so instead of issuing a verdict.

**A note on a control that was considered and REJECTED.** `ToolSearch "+higgsfield"` returns an
identical two-tool auth-only surface (`mcp__higgsfield__authenticate`,
`mcp__higgsfield__complete_authentication`). That is a genuinely interesting corroboration — two
independent OAuth-gated MCP servers presenting the same shape — but it is **not** a valid control
for this measurement, because a second auth-gated server cannot demonstrate that the method is
capable of seeing real tools. Using it as the control would have been the "probe returns the same
answer whether or not the thing is broken" failure. `github` was used instead.

## Verdict (pre-auth)

**AUTH_REQUIRED**

Only auth tools are visible; the server is installed and reachable; proceed to Task 2's OAuth
checkpoint. The fallback branch is not selected at this point and must not be recorded as selected
until Task 2 returns a result.

## Post-auth surface

Larry completed the OAuth consent in his browser on 2026-08-14. **`complete_authentication` was
never called** — the flow completed on the redirect and the MCP server re-registered itself
automatically, deregistering the two auth tools in the same moment. Recorded precisely because the
plan's action text anticipated calling it; the tool was gone by the time the surface changed, so
claiming it was invoked would be false.

Re-enumerated by the **same method as Task 1** (`ToolSearch "+openart"`, `max_results: 25`). The
surface is now **16 tools**, none of them auth:

```
mcp__openart__openart_account_get          mcp__openart__openart_model_cost
mcp__openart__openart_creation_get         mcp__openart__openart_model_form_get
mcp__openart__openart_creation_list        mcp__openart__openart_model_list
mcp__openart__openart_creation_show        mcp__openart__openart_project_create
mcp__openart__openart_creation_wait        mcp__openart__openart_project_list
mcp__openart__openart_generate_image       mcp__openart__openart_upload_list
mcp__openart__openart_generate_video       mcp__openart__openart_upload_metadata_get
mcp__openart__openart_upload_pick          mcp__openart__openart_upload_sign
```

## Post-auth control

**Control server: `github`**, the same control as Task 1, re-enumerated in the same run at the same
`max_results: 8` cap: **8** real tool schemas returned, unchanged. The control is therefore stable
across both measurements, so the pre→post difference below is a change in OpenArt, not a change in
the enumeration method or in the session's tool registry generally.

## Difference between the pre-auth and post-auth tool lists

Stated explicitly, as the plan requires — and the difference is **not** "the same list plus extras":

| | Pre-auth | Post-auth |
|---|---|---|
| Tool count | 2 | 16 |
| `authenticate` / `complete_authentication` | present | **gone** (deregistered) |
| Generation tools | none | **`openart_generate_image`, `openart_generate_video`** |
| Supporting surface | none | models, costs, projects, uploads, creation polling |

The two auth tools were **replaced**, not supplemented. An identical list would have been a finding;
this is the opposite — the vendor's post-auth claim in Task 1 is confirmed by measurement.

**Registration is not capability, so it was proven separately.** A tool appearing in the registry
only shows the server advertised it. One read-only authenticated call was made —
`openart_account_get` — and it returned a real account payload (plan tier and credit balance; the
account email is deliberately not reproduced in this file). So the OAuth session genuinely works;
this is not a shelf of tools that 401 on first use.

## Credit-balance finding — the leg is capable but cannot currently execute

`openart_account_get` reports plan **Free**, balance **7 credits**.

`openart_model_cost` (no arguments — prices every model/mode at its default config, cheapest-first)
puts the **cheapest generation of any kind at 10 credits**: `kling-3-omni` `text2image` at
1k / 4:3. The next tier is 15 (Nano Banana 2 Lite, Seedream 4.5, Seedream 5 Lite), and video starts
at 50. No configuration on the list is affordable at 7 credits.

So the OpenArt leg is **capable but not currently executable**: 7 < 10, and D-09 requires an
end-to-end proof, not a capability demonstration. This is a balance problem, not a surface problem —
which is why `second-direct-api` (defined as "no usable OpenArt generation surface") is the wrong
branch for it. Found at wave 1 rather than at wave 9, which is what this probe existed to do.

## Third leg selection

**THIRD_LEG: openart-mcp**

Confirmed with Larry at the Task 2 checkpoint after the credit finding above was put in front of
him; he chose to top up the OpenArt balance rather than swap providers.

**Generation tools, named:** `mcp__openart__openart_generate_image` and
`mcp__openart__openart_generate_video`. Both are asynchronous — they return a `historyId` with
status `PENDING`, and on a text-only/CLI host the documented completion path is
`mcp__openart__openart_creation_wait(historyId)`, which returns `COMPLETED` with resource URLs
(re-called on `STILL_RUNNING`). Model ids must be read from `mcp__openart__openart_model_list` and
the per-mode field schema from `mcp__openart__openart_model_form_get`; **no model id may be
hand-constructed**.

**Why this is a genuinely different code shape** (D-09's actual intent, not just its letter): the
Higgsfield leg is a CLI wrapper shelling out to a binary; the fal.ai leg is a from-scratch HTTP
queue/poll client with its own auth header; this leg is an **in-session MCP tool invocation** with
no HTTP client and no credential of its own. Three distinct shapes, all writing the same sidecar.

**Environment variable NAME required:** `MEDIA_VAULT_ROOT` — where `/studio-generate` writes the
downloaded asset and its sidecar. **This leg requires no provider credential environment variable
at all**, which is a real difference from the other two (`FAL_KEY`, `HIGGSFIELD_API_KEY`) and a
D-12-relevant fact: `recipeMd` for an OpenArt model documents the MCP tool invocation — tool name
and argument shape — and names no key, because none exists. OpenArt auth is an OAuth session held
by the MCP client, never an env var and never stored in Convex.

**Blocking prerequisite for wave 9:** the balance must be ≥ 10 credits before `118-14` can run its
proof. `118-14` should re-read the balance with `openart_account_get` and refuse with an honest
message rather than attempt a generation it cannot pay for.

**Known constraint 118-13 must respect:** MCP tools are invokable only from inside an MCP-capable
session. `/studio-generate` is a Claude Code skill and so satisfies this, but the scheduled watcher
(`hooks/studioWatch.mjs`) **cannot** invoke MCP tools — there is no headless path. The watcher's
role for this leg is unchanged and unaffected: it ingests whatever lands in the vault, and does not
generate.

## Defect found in this plan's own Task 1 verify command

The plan's `<automated>` check for Task 1 is **blind to the thing it exists to assert**, and this
was caught by mutation-testing the check rather than by running it. Recorded here because `118-14`
asserts against this file mechanically, so the strength of the check that guards it matters.

The original check ends with:

```js
if(!/AUTH_REQUIRED|GENERATION_TOOLS_ALREADY_VISIBLE|SERVER_NOT_CONNECTED/.test(s))
  throw new Error('no pre-auth verdict recorded');
```

`s` is the **entire file**. This document legitimately names `SERVER_NOT_CONNECTED` in prose in the
Pre-auth surface section (explaining why that verdict does *not* apply), so the regex matches on the
prose alone. Replacing the real verdict `**AUTH_REQUIRED**` with `**MAYBE**` leaves the check
**GREEN** — measured, not theorised. Any file that merely *discusses* the three strings passes with
no verdict recorded at all. The check also never enforces the acceptance criterion's actual wording,
"`## Verdict (pre-auth)` contains **exactly one** of the three literal verdict strings" — it is
satisfied by a file containing all three.

The corrected assertion isolates the `## Verdict (pre-auth)` section and requires exactly one
verdict string inside **that section**. Mutation-proved against three ways of breaking it:

| Mutation | Original check | Corrected check |
|---|---|---|
| `## Control` heading removed | RED | RED |
| real verdict replaced with `MAYBE` | **GREEN — blind** | RED (found 0) |
| two verdict strings in the section | GREEN — blind | RED (found 2) |
| unmodified file | GREEN | GREEN |

Both checks were run; the plan's original is recorded above as passing, but that pass carries no
information. The corrected form returns `VERDICT RECORDED: AUTH_REQUIRED`. Plans in this repo are
drafts, not specs — this is a correction, not a deviation.

## Second defect: Task 3's cross-file control is half-blind

Task 3's acceptance criteria assert that its automated check "fails if the two disagree (**the
control: a mismatched copy is caught**)". That claim was mutation-tested rather than taken on trust,
because `118-14` asserts against these two files agreeing. It is true for one mismatch shape and
**false for the other** — and the one it misses is the likelier mistake.

The check ends with a plain substring test:

```js
if(!c.includes(m[1])) throw new Error('CONTEXT.md amendment does not name the same third leg: '+m[1]);
```

`m[1]` is `openart-mcp`, and `openart-mcp` is a **substring of `openart-mcp-interactive`**. So if the
evidence file says `openart-mcp` while `118-CONTEXT.md` says `openart-mcp-interactive` — a genuine
disagreement between the two adjacent OpenArt branches, and by far the most plausible way these
files drift — `c.includes("openart-mcp")` returns true and the check passes.

Measured, all three against the real files:

| Mutation | Plan's check |
|---|---|
| unmodified (must pass) | GREEN ✓ |
| CONTEXT swapped to `second-direct-api` | RED ✓ (caught) |
| CONTEXT swapped to `openart-mcp-interactive` | **GREEN ✗ — blind** |

The sound form matches the whole token rather than a substring: anchor on the `THIRD_LEG` label
followed by a colon, then the captured value, then a **word boundary** (`\b`) — so `openart-mcp`
cannot satisfy a check against a file that actually says `openart-mcp-interactive`.

(Deliberately written without the literal label-plus-colon sequence. Task 3's acceptance criterion
counts that sequence across the **whole file**, so quoting it in prose here would inflate the count
past one and fail the criterion — the exact prose-pollution failure documented for Task 1's check
one section above. Noting it because the same trap will bite any future edit to this artifact.)

**This does not affect the recorded result.** The two files genuinely agree here — both say
`openart-mcp`, confirmed by direct reading, not merely by the weak check. The defect is recorded
because `118-14` will re-run an assertion of this shape, and a guard that cannot distinguish
`openart-mcp` from `openart-mcp-interactive` is exactly the wrong guard for the decision it protects.
