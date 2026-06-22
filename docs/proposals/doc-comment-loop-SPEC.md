# SPEC (proposal): Doc-Comment-Loop

> **Status:** proposal / not yet a GSD phase. Drafted 2026-06-22 from the RUBRIC toolkit teardown (getrubric.app — the command-centre toolkit, NOT Rubric Labs). To formalize: from a CodePulse session run `/gsd-phase` to add it to ROADMAP, then `/gsd-spec-phase <N>` (this file is the SPEC content, ready to drop in). Standalone — independent of v8.0 (Graph/KG) and the Forge milestone. Suggested placement: next free standalone phase number (e.g. 89), or a small v9.0 "Human-in-the-Doc" milestone if paired with the Links hub.

## User story

As Larry, I want to **highlight text on a doc surface in CodePulse and leave a comment**, and have **Ástríðr (or a local Claude Code session) pick that comment up as an actionable instruction**, act on it, and **mark it resolved** — so I can hand the agent work asynchronously, from any machine, *through the documents themselves* instead of a chat box.

This is the one genuinely-new capability from the RUBRIC toolkit (see vault `[[rubric-toolkit-teardown]]`). It is the cross-machine answer to "share docs+comments between desktop and laptop": **Convex cloud is the shared layer — no Google Drive, no conflict copies.**

## WHAT this delivers (in scope)

1. A `docComments` Convex table + queries/mutations.
2. **Browser write path (Clerk `requireAuth`):** add / edit / resolve / reopen / delete a comment anchored to a text selection on a doc.
3. **Agent read path (bearer token, fail-closed httpAction):**
   - `GET /doc-comments/summary?source=&path=` → **plain-text** list of unresolved comments (mirror RUBRIC's format so the agent prompt is trivial).
   - `POST /doc-comments/resolve` → mark a comment resolved (records `resolvedBy`).
4. A **minimal comments panel on ONE existing doc surface** (vertical slice — pick the lowest-friction surface, see open questions): highlight → comment → see the list → resolve/reopen, with commented text visually marked.
5. **One agent consumer wired end-to-end:** either an Ástríðr poll (cron/runtime) or a Claude Code SessionStart hook that calls the summary endpoint, surfaces unresolved comments into the agent's intake, and resolves after acting.

## NOT in scope (non-goals)

- A full file manager (RUBRIC's Docs does create/rename/delete files — CodePulse is **not** a file CRUD tool; don't port that).
- A rich-text/WYSIWYG markdown editor.
- Multiplayer cursors / live co-editing.
- Replacing the vault or Obsidian as the canonical doc store.

## Convex schema sketch

```ts
docComments: defineTable({
  docSource: v.string(),              // "vault" | "forge" | "codepulse-doc" | ...
  docPath: v.string(),               // logical doc id / path within the source
  selection: v.string(),             // highlighted text (anchor + human context)
  lineStart: v.optional(v.number()),
  lineEnd: v.optional(v.number()),
  comment: v.string(),               // the instruction / note
  author: v.string(),                // Clerk user id
  resolved: v.boolean(),
  resolvedBy: v.optional(v.string()),// agent id that acted
  createdAt: v.number(),
  resolvedAt: v.optional(v.number()),
})
  .index("by_doc", ["docSource", "docPath"])
  .index("by_resolved", ["resolved"])
```

## Endpoint contract

**Browser (Clerk `requireAuth`, existing pattern):**
- `addComment(docSource, docPath, selection, lineStart?, lineEnd?, comment)` → comment
- `updateComment(id, { comment?, resolved? })`
- `deleteComment(id)`
- `listComments(docSource, docPath)` → comments[]

**Agent (bearer token, `httpAction`, fail-closed — mirror `/forge-ingest` / `ASTRIDR_INGEST_API_KEY`):**
- `GET /doc-comments/summary?source=&path=` → `text/plain`, e.g.:
  ```
  Comments on vault/02-projects/codepulse.md:
  Line 14: "next-action: Pick next phase" → "Bump this to Phase 88 first"
  Line 45: "Phase 84 ... COMPLETE" → "Add a link to the UAT video"
  ```
  (No source/path → summary of all unresolved across docs.)
- `POST /doc-comments/resolve` `{ id, resolvedBy }` → `{ ok }`

Auth note: write path uses Clerk (`requireAuth`), agent path uses the existing fail-closed bearer pattern (missing key → 401, never silent allow). Reuse `ingestAuth`.

## Vertical slice / build order

1. **Wave 1 — backend:** table + Clerk-authed queries/mutations + bearer summary/resolve httpActions + unit tests (plain-text summary format is the contract to lock).
2. **Wave 2 — one UI surface:** comments panel + text-selection anchor + visual highlight + resolve/reopen, on the chosen doc surface. (Reuse existing shadcn + the `TooltipProvider`-local-provider convention for routed pages — see Phase 84 decision.)
3. **Wave 3 — one agent consumer:** Ástríðr poll OR Claude Code SessionStart hook → reads summary → acts → resolves; verify the full loop live on `tidy-whale-981`.

## Success criteria (goal-backward)

- Highlight text in CodePulse, leave a comment → it appears in `listComments` and is visually marked.
- Within one poll cycle, the agent sees that comment as plain-text instruction from the summary endpoint.
- Agent acts, calls resolve → comment shows resolved in the UI; reopen works.
- The same comment is visible/actionable from a **second machine** (desktop ↔ laptop) with no Drive sync — proving the Convex-cloud shared-layer claim.
- Bearer auth fails closed (missing key → 401); Clerk gate on all browser writes.

## Open questions (resolve in `/gsd-discuss-phase`)

1. **Which doc surface for the MVP panel?** Options, cheapest first:
   a. A new thin **CodePulse-native markdown doc** (markdown stored in Convex) — fully self-contained, no external coupling. Lowest risk for the slice.
   b. Annotate **vault notes already surfaced** (Phase 84 renders the vault graph; would need a doc-read view).
   c. Annotate **Forge job artifacts/files** (Phase 82 already has file preview) — natural "comment on what the agent produced" loop.
   *Recommendation: (a) for the slice, designed so `docSource` makes (b)/(c) additive later.*
2. **Primary consumer — Ástríðr poll or Claude Code hook?** Ástríðr cron = autonomous; CC SessionStart hook = picks up comments when Larry starts coding. Could do both (both just hit the summary endpoint). Pick one for the slice.
3. **Anchor robustness:** line numbers drift when docs change. Store `selection` text + line as a best-effort anchor; accept staleness for v1 (RUBRIC does).
4. **Pair with the Links hub?** If yes, frame as a small **v9.0 "Human-in-the-Doc"** milestone (comment-loop + links). If no, standalone phase.

## Provenance

Pattern source: RUBRIC `rubric-docs` (`server.js:109-201` comment API, `:122-126` summary format, `:279-289` agent-readable summary). Audited clean 2026-06-22 (zero deps, localhost-bound; the only finding — Docs CORS `*` — is irrelevant here since we reimplement on Convex with Clerk + bearer auth). Full teardown: vault `[[rubric-toolkit-teardown]]`.
