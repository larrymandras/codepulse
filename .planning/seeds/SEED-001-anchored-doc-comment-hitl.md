---
id: SEED-001
status: shipped # 2026-07-04 — PR #54 (feat/doc-comment-hitl-ui): /doc-comments page, DocViewer + CommentSidebar + CommentPopover + ApprovedEditCard, backend-mirror docAnchor relocation, Bearer docCommentsApi client. Built outside GSD via superpowers plan (docs/superpowers/plans/2026-07-03-doc-comment-hitl-ui.md). Ástríðr backend half (SEED-014) built same window (feat(alpha) doc-comments endpoints + reviewer loop).
planted: 2026-06-30
planted_during: Rubric toolkit evaluation (third-party RoboLabs agent-dashboard kit)
trigger_when: Next doc/review surface work, OR on demand. The paired Ástríðr backend seed (SEED-014) defines storage + the agent loop; this seed is the human-facing UI half. Either can be built first against an agreed doc_ref/anchor contract, but the loop only closes when both ship.
scope: Medium
origin: "rubric-docs (RoboLabs/RoboNuggets) — the ONLY idea worth mining from the Rubric kit. Verdict (mine + Codex 2026-06-30): skip the rest (Agents/Flows/Crons/Team/Skill-Trees/Links all duplicate existing CodePulse surfaces). Do NOT copy Rubric's code (no auth, sidecar-JSON storage, innerHTML XSS, fragile selection-text matching, MIT+mandatory-attribution license) — rebuild natively on Convex/React/Clerk."
paired_seed: astridr-repo/.planning/seeds/SEED-014-anchored-doc-comment-hitl.md
lightweight_plan: astridr-repo/.planning/proposed/doc-comment-hitl.md
---

> **Lightweight plan + the shared doc_ref/anchor contract live in
> `astridr-repo/.planning/proposed/doc-comment-hitl.md`** (tracked OUTSIDE GSD). This CodePulse
> UI half consumes that contract; build it as a CodePulse phase after the Ástríðr backend
> defines the contract. Decisions locked 2026-06-30: v1 = GSD specs/plans only, propose-then-approve.

# SEED-001: Anchored doc-comment authoring surface (CodePulse UI half)

## One-line ask

Add a CodePulse surface where Larry can **read a document and highlight exact text to leave
an anchored comment** that becomes an agent worklist item — the human-facing half of the
anchored doc-comment → agent HITL loop. The backend store + agent poll/act/resolve loop is
the paired Ástríðr seed (SEED-014).

## Why CodePulse owns the UI half

CodePulse is already the production command center (Convex + Clerk auth + persistence). It
has the chrome, auth, and real backend that Rubric lacks. The doc-comment **authoring +
status UI** belongs here; the **agent that consumes the comments** belongs in Ástríðr.
Crucially: this is the *one* Rubric concept worth adopting — everything else Rubric offers
(status cards, flow viz, cron calendar, org chart, skill graph, links) CodePulse already
does better, so this seed is deliberately scoped to JUST the doc-comment surface.

## Design (rebuild — do NOT copy rubric-docs)

**Doc viewer.** Render a document (markdown) with selectable text. Source candidates: vault
notes / GSD specs surfaced via the existing Ástríðr read APIs, or generated drafts. Reuse
CodePulse's existing markdown rendering — and unlike Rubric, **render safely** (no raw
`innerHTML` of untrusted markdown; sanitize).

**Highlight-to-comment.** Select text → popover → type an instruction → submit. On submit,
capture the **anchor contract** (selected text + line range + a stable content hash) so the
comment survives small edits — agreed verbatim with SEED-014 (this is the cross-repo seam,
like SEED-008's shared TS contract). Persist via the Ástríðr `doc_comments` API (Bearer
auth), NOT a CodePulse-local JSON file.

**Comment + status UI.** Show open/acked/resolved/stale comments inline (amber underline on
anchored text, à la rubric-docs, but driven by the real store). Display resolution notes and
**stale** badges when an anchor no longer matches the current doc — so Larry sees when an
edit orphaned a comment instead of it silently vanishing.

**Auth + persistence.** Through CodePulse's existing Clerk-authed Convex path / Ástríðr
Bearer API. No unauthenticated write endpoint (the Rubric anti-pattern). Respect the
profile/tenant boundary.

## Open questions (resolve at plan time, jointly with SEED-014)

- **Shared `doc_ref` + `anchor` contract** — the integration seam. Lock the TS/JSON shape
  in one place both repos import-from-by-copy (CodePulse `src/lib/*.ts` mirroring the
  Ástríðr API), as done for the KG search contract (SEED-008).
- Which documents are in scope for v1 — pick ONE type (GSD specs OR generated-draft review),
  don't build a general vault editor.
- Realtime vs poll for comment status in the UI (CodePulse already favors polling in places).
- Does CodePulse render the doc from an Ástríðr read API, or does Ástríðr push doc content?

## Acceptance (cross-repo, end to end)

- Larry opens a doc in CodePulse, highlights text, leaves a comment → persisted to the
  Ástríðr `doc_comments` store (auth-protected), anchored, status `open`.
- An Ástríðr persona picks it up, edits the doc, resolves it → CodePulse shows the comment as
  `resolved` with the resolution note; the underline clears.
- Editing the doc so an anchor no longer matches → CodePulse shows that comment as `stale`,
  not silently dropped.

## Provenance

Evaluated from the cloned `rubric-docs` repo (`C:\Users\mandr\rubric-docs`); global memory
note `rubric-toolkit-evaluation.md`. Paired backend seed:
`astridr-repo/.planning/seeds/SEED-014-anchored-doc-comment-hitl.md`.
