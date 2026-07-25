# Phase 97: Real Skill Intake & Daemon Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 97-skill-lifecycle-management
**Areas discussed:** Daemon home & write engine, Registry rescan trigger, Project-scope path resolution, GitHub install scope & auth, Name collision (done-check)

---

## Daemon home & write engine

### Executor home
| Option | Description | Selected |
|--------|-------------|----------|
| Extend Forge daemon | Add `intake` branch to existing CommandPoller (`C:\Users\mandr\forge`); one poller/auth path | ✓ |
| astridr-repo owns it | Second poller in astridr-repo where the scanner lives; splits transport across two daemons | |

### Write engine
| Option | Description | Selected |
|--------|-------------|----------|
| Shell out to skill-intake / manage-skills | Reuse canonical installer; single source of truth; capture real report/exit (INTAKE-04) | ✓ |
| Native TS write in the daemon | Reimplement validate+write in Node fs; no Python dep but risks drift from canonical installer | |
| You decide | Let research compare skill-intake API vs port cost | |

**User's choice:** Extend Forge daemon + shell out to skill-intake / manage-skills.
**Notes:** Daemon at `C:\Users\mandr\forge` already claims/acks forgeCommands for launch/stop/logs/files (Phases 80-82) — intake is just a new commandType. Implies Python + skill-intake available on the daemon host.

---

## Registry rescan trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Full rescan → syncInventory | Re-scan host, post whole snapshot; host-truth + per-origin prune handles fan-out | ✓ |
| Targeted single-skill upsert | Post only new skill(s); fast but bypasses prune, risks drift | |
| You decide | Let research check full-scan cost first | |

**User's choice:** Full rescan → syncInventory after each success.
**Notes:** Intake is low-frequency, so the heavier rescan is acceptable in exchange for correctness (fan-out, shadowing, no drift).

---

## Project-scope path resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Synced Forge workspaces only | Keep today's workspace picker; daemon maps workspaceId → known path → `<ws>/.claude/skills/`; no free-text path surface | ✓ |
| Also allow an explicit host path | Free-text path adds untrusted-path/traversal surface the daemon must sanitize | |
| You decide | Let research confirm workspaceId → absolute path mapping | |

**User's choice:** Synced Forge workspaces only.
**Notes:** Matches the existing IntakeModal UI; if no workspace synced, "project" is effectively unavailable and the UI already says so.

---

## GitHub install scope & auth

### Repo auth
| Option | Description | Selected |
|--------|-------------|----------|
| Public repos only | No token handling this phase; keeps foundation lean | ✓ |
| Private repos too (token) | Daemon needs a GitHub token/secret handling; adds a credential surface | |

### Fan-out
| Option | Description | Selected |
|--------|-------------|----------|
| Confirm the set first | Enumerate candidates, user confirms before write; pairs with no-partial-state | ✓ |
| Install all automatically | Any skill under URL/subpath installed in one shot; risk of surprise bulk-install | |
| You decide | Let research check what skill-intake returns for multi-skill subpath | |

**User's choice:** Public repos only + confirm the set first.
**Notes:** Fetch mechanism (clone vs download) is skill-intake's internal concern. ⚠ Research must confirm skill-intake exposes a resolve/enumerate step separate from write for the confirm-first UX.

---

## Name collision (done-check)

| Option | Description | Selected |
|--------|-------------|----------|
| Reject collision, then write context | First-install only; same-name collision = clean failed install (INTAKE-04), never silent overwrite | ✓ |
| Explore more gray areas | Surface atomicity/ACL, cold-storage path, offline UX | |
| I'm ready for context | Leave collision to research/planning | |

**User's choice:** Reject collision, then write context.
**Notes:** Overwrite/update stays deferred (Future Requirements); isShadowing-aware activation is Phase 98.

## Claude's Discretion

- Failure atomicity mechanics + "no partial directory on disk" guarantee — delegate to skill-intake semantics where possible.
- Cold-storage destination path convention (`.claude/skills-available/` / dormant origin) — follow existing manage-skills/registry convention.
- Exact intake `commandType`/payload shape + how `supportedTypes` advertises `intake` (DAEMON-04) — follow launch/stop precedent.

## Deferred Ideas

- Private-repo GitHub auth — future phase.
- Skill versioning / overwrite-update — Future Requirements.
- Lifecycle mutations + DAEMON-02 — Phase 98.
- Launch/dispatch — Phase 99.
- Control-surface UX (⋯, drag lanes, in-app Cold Storage restore) — Phase 100.
- Bulk multi-select + importSkills catalog bulk-import UI — deferred per REQUIREMENTS.
