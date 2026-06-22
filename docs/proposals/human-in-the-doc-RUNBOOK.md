# Runbook: v9.0 "Human-in-the-Doc" — GSD kickoff

> Copy-paste starters to formalize the Doc-Comment-Loop (+ optional Links hub) as GSD work.
> **Run these from a CodePulse session** (`cd C:\Users\mandr\codepulse`, launch Claude Code there) — NOT from the vault/home, per the GSD CWD + worktree-isolation rules.
> SPEC content already drafted: `docs/proposals/doc-comment-loop-SPEC.md`.

---

## Decision first: milestone vs. standalone phases

- **Recommended — small milestone v9.0 "Human-in-the-Doc"** (comment-loop + links hub): cohesive theme, clean archive boundary. Two phases.
- **Lighter alternative** — skip the milestone, append both as standalone phases (like Phase 88). Less ceremony; fine if you'd rather not open a version. Use the `/gsd-phase` blocks in Step 2 directly and ignore Step 1.

Phase numbers below (89/90) are suggestions — GSD assigns the real ones; adjust to the next free.

---

## Step 1 — Open the milestone (recommended path)

Run:

```
/gsd-new-milestone
```

When it asks for the milestone intent, paste:

```
Milestone: v9.0 "Human-in-the-Doc"

Goal: Let me hand work to the agents asynchronously *through documents* — highlight
text in CodePulse, leave a comment, and have Ástríðr (or a local Claude Code session)
pick it up as an instruction, act, and resolve it — plus a fast Links hub for the URLs
I re-find constantly. Cross-machine for free via Convex cloud (no Google Drive).

Source: the RUBRIC toolkit teardown (getrubric.app), vault [[rubric-toolkit-teardown]].
Of the four RUBRIC tabs, only the Docs comment-loop and Links are net-new vs CodePulse
v8.0; Skill-Trees/Generations/scaffold are already surpassed.

Phases:
1. Doc-Comment-Loop (substantial — Convex schema, dual auth, agent loop, UI). Full GSD.
   SPEC already drafted at docs/proposals/doc-comment-loop-SPEC.md.
2. Links Hub (trivial — one Convex doc + a categorized panel). Light/quick.

Requirements:
- DC-01  docComments Convex table + by_doc / by_resolved indexes
- DC-02  Clerk-authed browser CRUD: add / edit / resolve / reopen / delete / list
- DC-03  Bearer fail-closed agent endpoints: GET /doc-comments/summary (plain text) + POST /doc-comments/resolve
- DC-04  Comments panel on ONE doc surface: highlight -> comment -> list -> resolve, with visual marking
- DC-05  One agent consumer wired E2E (Ástríðr poll OR Claude Code SessionStart hook), verified live on tidy-whale-981
- DC-06  Cross-machine proof: same comment actionable from desktop AND laptop, no Drive sync
- LNK-01 links Convex doc/table + listLinks query
- LNK-02 Categorized Links panel UI (groups + per-link icon)
- LNK-03 Agent-populated: scan workspace (CLAUDE.md/.env/config) -> recommend -> confirm -> write
```

---

## Step 2 — Add the phases (or use directly if skipping the milestone)

```
/gsd-phase add "Doc-Comment-Loop" --after 88
```
```
/gsd-phase add "Links Hub" --after 89
```

(If `--after` syntax differs in your GSD build, just describe the insert point when prompted.)

---

## Step 3 — Phase 1: Doc-Comment-Loop → discuss

This phase has UI, so the gate is **discuss → ui-phase (UI-SPEC) → plan → execute.**

Run:

```
/gsd-discuss-phase 89
```

Paste this context so the questioning is fast (it pre-answers the SPEC's open questions):

```
Context: implement the Doc-Comment-Loop per docs/proposals/doc-comment-loop-SPEC.md.

Pre-answered decisions (the SPEC's open questions):
1. MVP doc surface = (a) a NEW thin CodePulse-native markdown doc, markdown stored in
   Convex. Lowest-risk slice; design docSource so vault (Phase 84) and Forge artifacts
   (Phase 82) become additive later — do NOT couple the slice to them.
2. Primary consumer = Ástríðr cron poll (autonomous) for the slice. A Claude Code
   SessionStart hook is a fast-follow, same summary endpoint — note it, don't build it.
3. Anchor = store selection text + lineStart as a best-effort anchor; accept staleness on
   doc edits for v1 (RUBRIC does the same). No re-anchoring engine.
4. Auth = reuse existing patterns exactly: Clerk requireAuth on all browser writes;
   bearer fail-closed (reuse ingestAuth, missing key -> 401) on the agent endpoints.

Non-goals: file CRUD, rich-text editor, multiplayer cursors, replacing vault/Obsidian.

Conventions to honor: routed pages render outside DashboardLayout's TooltipProvider — any
shadcn Tooltip needs a local provider (Phase 84 lesson). Verify fixtures against a real
`npx convex run` payload, not the spec (Phase 84 fixture-faithfulness lesson).
```

Then continue the gate:

```
/gsd-ui-phase 89
```
```
/gsd-plan-phase 89
```
```
/gsd-execute-phase 89
```

---

## Step 4 — Phase 2: Links Hub → quick

Trivial surface — skip the heavy planning:

```
/gsd-quick 90
```

Paste:

```
Build the Links Hub per LNK-01..03. One Convex table `links` (category, title, url,
description, icon) + `listLinks` query; a categorized panel (reuse existing shadcn card
styling + the Matrix Emerald tokens). Seed it by scanning CLAUDE.md / .env.example /
config for the URLs I hit constantly (Supabase local+hosted, n8n cloud, Vercel, GitHub
repos, Convex dashboard tidy-whale-981, Forge) — present grouped, get my confirmation,
then write. No agent-write loop needed for v1; manual/seed is fine.
```

---

## After execute

- Verify DC-05/DC-06 live on `tidy-whale-981` (real outcome, not "wired" — the proxy-vs-outcome rule).
- `/gsd-verify-work` then `/gsd-audit-milestone` before archiving v9.0 (cross-check counters vs git ground truth — `phase.complete` miscounts).
- Update vault `02-projects/codepulse.md` (`last-verified`, machine-summary) and `[[rubric-toolkit-teardown]]` Decision section.
