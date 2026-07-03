# Anchored Doc-Comment HITL Surface — Design

**Date:** 2026-07-03
**Repos:** CodePulse (UI, primary) + Ástríðr (`astridr-hitl-wt` worktree, backend additions)
**Tracking:** Outside GSD — consumes the lightweight plan at
`astridr-repo/.planning/proposed/doc-comment-hitl.md`. Seeds: CodePulse `SEED-001`,
Ástríðr `SEED-014`. Origin: `rubric-toolkit-evaluation` memory.
**REQs covered:** DCH-09 (render doc, sanitized), DCH-10 (highlight→comment authoring
with full anchor), DCH-11 (inline open/acked/resolved + stale status) — plus the backend
endpoints those REQs implicitly require to close the loop.

## 1. Goal

Add a CodePulse surface where Larry reads an in-scope GSD spec/plan, highlights exact text
to leave an **anchored** comment, and drives the human side of the doc-comment → agent HITL
loop: watch the reviewer persona's proposed edit clear the approval gate, then **apply** it
from one click. An edit that orphans an anchor shows as **stale**, never mis-applied.

End-to-end acceptance (v1):

1. Larry opens a GSD doc in CodePulse, highlights a line, types an instruction → a
   `doc_comments` row appears (anchored, `status=open`), persisted via the Ástríðr API.
2. The reviewer persona (already built, PR #39) drafts a `proposed_edit` through the
   approval gate; on approval the comment becomes `status=approved` with the stored edit.
3. CodePulse shows the approved edit as an inline word-diff; Larry clicks **Apply** → the
   edit lands in the real doc, the comment flips to `resolved` with a note, the underline
   clears.
4. Editing the doc so an anchor no longer matches → the comment shows as `stale`, not
   silently dropped. Unauthenticated request → 401 (fail-closed).

## 2. Why this shape

CodePulse is the production command center (Convex + Clerk auth + real backend), so the
authoring + status UI belongs here; the agent that acts on comments lives in Ástríðr. The
build mirrors the existing KG read-API analog exactly: `src/lib/kgApi.ts` →
`src/pages/KnowledgeGraph.tsx` becomes `src/lib/docCommentsApi.ts` →
`src/pages/DocComments.tsx`, Bearer-authed against `VITE_ASTRIDR_API_URL`.

## 3. The anchoring model (the crux)

The Ástríðr backend's `relocate_anchor(doc_text, anchor)` and `apply_edit(doc_text, anchor,
proposed)` operate on the **raw markdown source** — char offsets into the file are what it
splices. The UI *renders* markdown, so a browser selection is in rendered-DOM coordinates.
Rubric got this wrong by matching selection text naively; we keep the two concerns separate:

### 3a. Authoritative anchor = source coordinates
On selection, capture the selected string as `quote` plus ~32 chars of context before/after
as `prefix`/`suffix`, then run **the same relocation algorithm as the backend** against the
raw source the client already fetched (via the doc-read endpoint) to derive `start`/`end`
and `line_start`/`line_end`. The shared algorithm, verbatim from the contract:

> try `start/end` → verify `quote` still matches there; else search `prefix+quote+suffix`;
> else search `quote` alone (ambiguous ⇒ stale); else stale.

If the quote cannot be **uniquely** located in source at author time → **refuse to save the
comment** ("select cleaner text"). We never persist an anchor the backend's own relocate/
apply would reject. This symmetry is the correctness guarantee and is unit-testable against
the same cases as the backend's `test_doc_comments.py` anchor suite.

### 3b. Underlines = presentation only
For each comment, find its `quote` in the **rendered DOM** with a text-walker (prefix/suffix
disambiguate repeats) and wrap the matched range in a status-colored `<mark>`:
amber = open, blue = acked, green = approved/resolved, gray + strike = stale. If the text
cannot be found in the rendered DOM (it lives inside a transformed construct, e.g. a link
label), the comment still appears in the sidebar without an inline underline — never crash,
never mis-mark.

### 3c. Explicitly deferred to v2
Exact rendered→source offset mapping via react-markdown's mdast `position.offset`. More
precise underlines, but cross-node selections break it. Not needed for a correct v1.

## 4. The shared contract (mirrored by copy, like SEED-008 KG)

TypeScript mirror of the Ástríðr `doc_comments` record. One definition, copied — not a shared
package.

```ts
// src/lib/docCommentsApi.ts
export interface DocRef {
  repo: string;                 // "astridr" | "codepulse" | ...
  path: string;                 // repo-relative, under .planning/ (v1 scope)
  doc_type: "gsd_spec";         // v1 = GSD specs/plans only
  doc_hash: string;             // sha256 of full doc at comment time
}

export interface Anchor {
  quote: string;                // TextQuoteSelector
  prefix: string;               // ~32 chars before (disambiguation)
  suffix: string;               // ~32 chars after
  start: number;                // TextPositionSelector, source char offset
  end: number;
  line_start: number;
  line_end: number;
}

export type DocCommentStatus = "open" | "acked" | "approved" | "resolved" | "stale";

export interface DocComment {
  id: string;
  doc_ref: DocRef;
  anchor: Anchor;
  comment: string;              // the human instruction
  author: string;
  status: DocCommentStatus;
  assignee_persona: string | null;
  proposed_edit: string | null; // set once the reviewer's edit is approved
  resolution_note: string | null;
  profile_id: string;
  created_at: string;
  resolved_at: string | null;
}
```

Note vs. the original contract: `status` gains `approved` (the v1 store-don't-write state
the reviewer persona already emits). `doc_type` is pinned to `gsd_spec` for v1.

## 5. Backend — 5 new endpoints (`astridr-hitl-wt`)

All under `/api/doc-comments/*` so the WebChannel `auth_check` middleware enforces Bearer
fail-closed (same as the existing three). Each adds a thin `DocCommentService` method; they
reuse the existing `resolve_doc_path` containment guard, `apply_edit`, `relocate_anchor`, and
`engine/atomic_io.py`. TDD, mirroring `tests/unit/channels/test_doc_comments.py`.

| # | Endpoint | Behavior |
|---|----------|----------|
| 1 | `POST /api/doc-comments` | **Create.** Body `{doc_ref, anchor, comment, author, profile_id, assignee_persona?}`. Validate `doc_ref` via `resolve_doc_path` (reject out-of-scope: unknown repo / absolute / `..` / non-`.planning`). Insert `status=open`. Return the row. |
| 2 | `GET /api/doc-comments/docs?profile_id=` | **Doc list.** Walk mounted repos' `.planning/` for GSD `SPEC.md`/`PLAN.md`; return `[{repo, path, doc_type}]`. |
| 3 | `GET /api/doc-comments/doc?repo=&path=` | **Doc read.** `resolve_doc_path` → `asyncio.to_thread` read → `{repo, path, content, doc_hash}`. |
| 4 | `GET /api/doc-comments/by-doc?repo=&path=&profile_id=` | **Comments for a doc**, any status, for inline rendering (the existing `/open` is open-only + not doc-scoped). |
| 5 | `POST /api/doc-comments/{id}/apply` | **Apply approved edit.** Guard `status==approved`; `resolve_doc_path` → read → `relocate_anchor`; if now stale → `mark_stale` (do **not** write); else `apply_edit` splice → atomic write → `resolve` with a note. Returns the resolved row. |

Failure posture matches the existing service: best-effort read methods return structured
empties; write methods (create/apply) surface real errors to the HTTP layer so the UI can
show them. `apply` must verify the real outcome (file written) — no silent catch.

## 6. Frontend — new files (CodePulse)

- **`src/lib/docCommentsApi.ts`** — contract types (§4) + Bearer-authed fetchers reusing
  `authHeaders` / `AstridrApiError` / `apiRequest` from `astridrApi.ts`:
  `listDocs`, `readDoc`, `listCommentsForDoc`, `createComment`, `ackComment`,
  `resolveComment`, `applyComment`. 404/501 gate to "backend not deployed" copy (kg pattern).
- **`src/lib/docAnchor.ts`** — pure, TDD'd: `relocateAnchor(source, anchor)` (mirrors
  backend), `captureAnchorFromSelection(source, container, selection)`,
  `computeDocHash(text)` (SubtleCrypto SHA-256). No React, fully unit-tested.
- **`src/hooks/useDocComments.ts`** — polls `listCommentsForDoc` for the active doc
  (CodePulse favors polling; interval consistent with existing hooks).
- **`src/pages/DocComments.tsx`** — 3-pane shell: doc-picker · viewer · comment sidebar.
  Lazy-loaded route.
- **`src/components/doccomments/`**
  - `DocViewer.tsx` — sanitized `react-markdown` + `remark-gfm` (**no `rehype-raw`** →
    satisfies DCH-09), selection handling, underline overlay, popover trigger.
  - `CommentPopover.tsx` — instruction input anchored to the selection; refuses submit if
    `captureAnchorFromSelection` can't uniquely locate the quote.
  - `CommentSidebar.tsx` — comment list with status badges, resolution notes, **stale**
    badges; click scrolls to / flashes the underline.
  - `ApprovedEditCard.tsx` — inline word-diff (via `diff`/jsdiff `diffWords`) of the current
    span vs `proposed_edit`, plus the **Apply** button.
- **Wiring** — route in `src/App.tsx` (lazy) + nav entry in
  `src/layouts/DashboardLayout.tsx` (`navItems` + `iconMap`, Lucide `MessageSquareText`).
  `profile_id` sourced from CodePulse's existing profile context.

**New dependency:** `diff` (jsdiff, MIT, small, tree-shakeable) for the inline word-diff.

## 7. Component boundaries

- `docAnchor.ts` — pure text logic. In: raw source + a selection (or an anchor). Out: an
  anchor (or a located span / `stale`). Depends on nothing. Tested in isolation.
- `docCommentsApi.ts` — the network seam. In: typed params. Out: typed contract objects or
  `AstridrApiError`. Depends only on `astridrApi` auth helpers.
- `DocViewer` — rendering + selection + underline overlay. Depends on `docAnchor` +
  `react-markdown`. Emits "anchor captured" / "comment clicked" upward; owns no data fetching.
- `useDocComments` — the only polling owner. Everything else takes data as props.

Each unit is understandable and testable without reading the others' internals.

## 8. Testing

- **Backend (pytest):** the 5 new methods/endpoints — create happy-path + out-of-scope
  `doc_ref` rejection, doc-list enumeration, doc-read + hash, by-doc filtering across
  statuses, apply happy-path + apply-on-stale ⇒ `mark_stale` (no write) + apply-when-not-
  approved rejected, and 401 fail-closed on an unauth request.
- **Frontend (vitest, jsdom):** `docAnchor` relocation parity with the backend cases
  (located / prefix-suffix / ambiguous⇒stale / missing⇒stale) + `computeDocHash`;
  `docCommentsApi` fetch shapes, auth header present, error/404 gating.
- **Optional (Playwright):** highlight → popover → submit → row created; kept minimal.

## 9. Environment & dev stack

Uses existing `VITE_ASTRIDR_API_URL` (default `http://localhost:8181`) + `VITE_ASTRIDR_API_KEY`.
Local loop: Ástríðr web channel on :8181 + local Supabase :55432 (the `doc_comments` table is
already applied). With the backend absent, the client degrades gracefully (kg 404 pattern) and
unit tests mock `fetch`. RLS stays `service_role`-only (the Ástríðr API holds the key; the
browser never talks to Supabase directly).

## 10. Process

Superpowers TDD, isolated worktrees: `codepulse-doccomments-wt` (this repo, branch
`feat/doc-comment-hitl-ui`) and the existing `astridr-hitl-wt` (branch
`team/alpha/doc-comment-hitl-persona`) for the backend endpoints. Stays outside GSD per the
lightweight plan; promote to a real GSD milestone only after v25.0 ships. Two PRs: the
Ástríðr endpoints and the CodePulse surface, built against this one contract.

## 11. Out of scope (v1)

- Non-GSD doc types (vault notes, generated drafts) — `doc_type` pinned to `gsd_spec`.
- Auto-firing the reviewer persona (deferred on the backend; the reviewer is runnable, only
  auto-trigger is pending).
- Exact rendered→source offset mapping (§3c).
- Realtime subscriptions — polling only.
- A general in-browser doc editor — this is a comment/apply surface, not an editor.
