---
id: TODO-public-repo-exposes-user-path-and-operational-posture
status: pending
planted: 2026-08-24
planted_during: Phase 126 planning — surfaced by a Codex adversarial review of an untracked `html-out/` deliverable, then scoped repo-wide by the orchestrator
trigger_when: Before the next decision about what `.planning/` and `CLAUDE.md` contain, or immediately if the repo gains a collaborator, the tailnet gains a device that is not Larry's, or any credential VALUE is ever committed. Not urgent as a leak — no secrets are exposed — but it is a standing decision that has never actually been made.
scope: Unknown until the decision is made — ranges from one `.gitignore` line to a repo-visibility change. Sanitizing 272 files is NOT recommended without a reason better than tidiness.
source: repo-wide; `CLAUDE.md`, `.planning/**`, `html-out/`
resolves_phase: 138
last_reviewed: 2026-08-24
---

# `codepulse` is a PUBLIC repo, and nobody has decided what belongs in it

## Measured 2026-08-24 (all counts are tracked files at HEAD)

`gh repo view larrymandras/codepulse` → `{"isPrivate": false, "visibility": "PUBLIC"}`

| What | Tracked files |
|---|---|
| `C:\Users\mandr\` (Windows username in absolute paths) | **272** |
| Private LAN IP (`10.0.0.x`) | 2 |
| Firewall rule name `Block-Convex-*` | `CLAUDE.md` |
| `INSTANCE_SECRET` — the variable NAME only, never a value | 19 |
| **Actual credential values** | **none found** |

`git ls-files` surfaces no env files, keys, or certificates. **This is not a secret leak.** That
distinction is the whole reason this is a todo and not an incident.

## What is and is not actually exposed

- **The username is not a new disclosure.** The GitHub account is `larrymandras`; `mandr` as a
  Windows account name adds nothing an observer did not have.
- **The LAN IP is RFC1918** — unroutable from outside, and the LAN path to Convex was firewalled
  on 2026-08-11 (`convex-selfhost\restrict-convex-lan.ps1`).
- **The item genuinely worth a decision** is that public `CLAUDE.md` documents the self-hosted
  Convex operational posture — including SEED-008's decision that *the tailnet is the auth
  boundary*, that ~215 public mutations are ungated, and that only 8 files reference `ctx.auth`.
  That is not a secret, but it is a map, and it is the one item whose value to a reader scales
  with their intent.

## Why this was NOT fixed when found

Larry's call, 2026-08-24: log it, change nothing. Reasons recorded so the next reader does not
re-litigate them:

1. Sanitizing the flagged file would have fixed **1 of 273** instances — treating an instance while
   the class sits untouched.
2. Rewriting 272 files or git history is destructive, and nothing measured justifies it.
3. The absolute paths are not accidental: `CLAUDE.md` **mandates** the deploy command
   `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`, and
   `--env-file` is explicitly not optional. Every plan that quotes it correctly inherits the path.
   Phase 126's own plans added 15 instances **by following instructions**. Any "fix" that does not
   address the mandated command will be undone by the next correctly-written plan.

## The actual question, when it is next picked up

Not "how do we scrub the username" — that is the instance. The question is: **should `.planning/`
and `CLAUDE.md` be in a public repo at all?** They are a detailed, continuously-updated record of
this system's internals, decisions, weaknesses, and operational procedures. Every option below is
cheaper than sanitizing:

- make the repo private (one action, reversible, closes the class — does not un-publish existing
  clones or forks)
- keep the code public and move `.planning/` to a private repo or submodule
- accept it deliberately and write that acceptance down, so this stops resurfacing

## Immediate, unrelated-to-the-decision hygiene

`html-out/` is **not** gitignored and already holds six tracked files, so anything written there is
one `git add -A` from being published. At the time of writing, `html-out/seidr-suite-what-they-do.html`
is untracked and contains a user path, localhost ports, and the `StudioWatch` task name and
schedule. It belongs to another session and was deliberately not edited. If `html-out/` is a
scratch directory for local deliverables, it should be gitignored regardless of how the larger
question is answered.

## Verification note for whoever picks this up

**Use fixed-string matching.** A `git grep` with a hand-escaped backslash pattern returned **2**
files against a true count of **272** during this very investigation — a false negative that would
have closed the todo as trivial. Use `git grep -F 'C:\Users\mandr'`, and confirm any count against
a control that could have come out the other way.
