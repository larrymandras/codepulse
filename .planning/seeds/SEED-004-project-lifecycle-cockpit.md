---
id: SEED-004
status: absorbed
absorbed: 2026-08-27
absorbed_by: [COCKPIT-01, COCKPIT-02, COCKPIT-03, COCKPIT-04, COCKPIT-05, COCKPIT-06]
planted: 2026-08-07
planted_during: v14.0 (agentic-OS daily-driver design session)
trigger_when: "Next milestone planning after v14.0 (version TBD - v15.0 is earmarked for the Borealis UI overhaul per CLAUDE.md), gated on Forge v4.0 Interactive Sessions shipping (Phases 21-26) - the Inbox/composer half is Mission Control Slice 3 and depends on Forge's permission relay"
scope: Large
origin: "Daily-driver design interview 2026-08-07. Full spec: C:\\Users\\mandr\\Mandras\\runbooks\\agentic-os-project-runbook.md (sections: Target Workflow, Build Roadmap items 2-4, 6-7). Decisions table there is binding."
paired_seed: astridr-repo/.planning/seeds/SEED-027-astridr-forge-dispatch.md
---

> **Absorbed 2026-08-27 (Phase 128, full coverage).** v16.0's COCKPIT-01..06 map 1:1 onto this
> seed's five components (Inbox/composer → COCKPIT-01, Factory → COCKPIT-02, Projects view →
> COCKPIT-03, ship gates → COCKPIT-04, tailnet cockpit → COCKPIT-05) plus the Non-negotiables
> (COCKPIT-06). See `128-SEED-RECONCILIATION.md`.

# SEED-004: Project Lifecycle Cockpit — Factory, Projects view, Inbox, ship gates

Make CodePulse the daily driver for the full project lifecycle — create → plan → build →
review → ship → archive — with the Claude Code terminal eliminated as a required surface.
Philosophy (decided): **relay the terminal, don't replace the tooling** — GSD runs unchanged
inside relayed Forge sessions; this milestone builds the surfaces that answer them.

## Components (one milestone, likely 4-5 phases)

1. **Dispatch composer + unified session Inbox** (Mission Control Slice 3). One Inbox for
   permission prompts, AskUserQuestion gates, and UAT questions across all Forge sessions;
   composer to start/steer sessions. Consumes Forge v4.0's hooks-based permission relay
   (NDJSON → daemon → Convex). This is the zero-terminal threshold.
2. **Project Factory.** "New Project" wizard: name + one-liner + template → bootstrap job
   (mkdir `C:\dev\<name>`, git init, `gh repo create larrymandras/<name> --private`,
   scaffold, graphify, vault note from template) → chains into a relayed `/gsd-new-project`
   session whose Q&A lands in the Inbox. Establishes `C:\dev` as the new project root.
3. **Projects view — the lifecycle manager.** Card grid, tier tabs **Active / Archived /
   Scrapped**, search + sort (last activity, size, status). Card: vault `machine-summary`,
   phase progress from `.planning/`, last git activity, disk footprint, staleness badge,
   running-session indicator, GitHub link. Actions by tier:
   - Active: open sessions · discuss/plan/execute phase · project-filtered Inbox · Archive · Scrap
   - Archived: Restore to `C:\dev` · Scrap · view catalog entry
   - Scrapped: Restore · **Purge** (typed confirmation — the ONLY true destroy)
   Every action dispatches a Forge job wrapping the existing /archive-repo mechanism
   (G:\My Drive\repo-archive\ + CATALOG.md), extended with a `scrapped/` section, a purge
   verb, and `gh repo archive`/`unarchive`. **Safety preflights refuse rather than guess:**
   unpushed commits, uncommitted changes, untracked-secrets scan block archive/scrap.
   Includes the disk guard: `C:\dev` footprint breakdown, auto-surfaced archive candidates.
   Data sources: filesystem scan (C:\dev + legacy roots), G: CATALOG.md, vault-note
   frontmatter, GitHub API.
4. **Ship gates.** Deploy-with-approval job templates per hosting target (Vercel/Netlify):
   build → preview URL to Inbox → approve → promote. No un-gated production deploys.
5. **Tailnet cockpit (ops).** Serve CodePulse over Tailscale; verify WS attach remotely;
   mobile-usable Inbox styling. Phone = full cockpit; Telegram stays alerts-only.

## Non-negotiables
- Delete is never one click: Scrap (recoverable) → Purge (typed confirmation). GitHub repo
  deletion on purge is a per-project choice, never automatic.
- Local archive → `gh repo archive` (reversible); restore → unarchive.
- GitHub is the sync for live repos; Google Drive is the archive tier only — no Drive
  mirroring of active project dirs.
- Billing: cockpit sessions bill the Max subscription; `ANTHROPIC_API_KEY` must never reach
  the Forge daemon env (paired forge roadmap item removes the passthrough).
