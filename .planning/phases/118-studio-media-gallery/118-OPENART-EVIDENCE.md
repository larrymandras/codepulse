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
