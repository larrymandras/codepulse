# HANDOFF — Phase 101 Execution (Reminders & Calendar Command Center)

**Created:** 2026-07-19
**For:** the next codepulse-rooted session that runs `/gsd-execute-phase 101`
**Why this exists:** Phase 101 was invoked from an astridr-repo-rooted session (wrong CWD). Execution was deferred so the GSD orchestrator's SDK state-writes land on codepulse's STATE.md instead of astridr's. This note carries the decided parameters into the correct session.

## How to run

```
cd C:\Users\mandr\codepulse
claude
/gsd-execute-phase 101
```

## Decided parameters (confirmed with Larry 2026-07-19)

1. **Run from codepulse CWD** — not from astridr-repo. The orchestrator resolves project root + STATE.md from CWD; running elsewhere risks clobbering astridr's state.
2. **Activate milestone v12.0 FIRST.** Phase 101 is registered under **v12.0 (Personal Productivity — Reminders & Calendar)**, but codepulse's active milestone is currently **v11.0 (Skills Command Center)**. Flip STATE.md active milestone v11.0 → v12.0 before executing — invoking execute-phase 101 IS the "you say go" activation signal Larry left pending.

## Standing rules for this phase (it is cross-repo: codepulse ↔ astridr)

- **Worktrees OFF, run sequential.** Cross-repo / compose live-verify breaks under worktrees.
- **Commit per-repo via `git -C`** — never a shared `git add -A`. Re-check `git branch --show-current` immediately before every commit. NOTE: astridr side is on branch `feature/brain-swap`; a concurrent session can switch it, so verify branch + `git diff --cached --name-only` right before each commit and `git show --stat HEAD` right after.
- **Do NOT trust `gsd-sdk state.*` counters.** Every state verb double-counts / clobbers STATE.md (well-documented recurring disease). After any state mutation, diff STATE.md against git ground truth and hand-reconcile the full counter set; prefer hand-edits with a reconciliation comment over trusting the verb.

## Confirmed-ready facts (verified 2026-07-19)

- **6 plans, all INCOMPLETE** (no SUMMARY files yet) → fresh full execution, nothing to skip.
  - `101-01-PLAN.md` … `101-06-PLAN.md`
- **Pre-flight gate passes:** `101-CONTEXT.md` (decisions D-01…D-12, canonical refs, prerequisites) + `101-UI-SPEC.md` (design contract) both present.
- Plans are GSD/TDD format with threat models; D-NN decisions cited in plan `truths:` so the decision-coverage gate credits them.
- codepulse active milestone at time of writing: **v11.0**, Phase 97 (skill-lifecycle-management) COMPLETE (6/6 plans, operator-verified live 2026-07-19).

## State at handoff

- Nothing was changed in either repo by the deferring session.
- v12.0 remains registered-but-not-activated in ROADMAP.md.
- Next action: activate v12.0 → `/gsd-execute-phase 101` from codepulse.
