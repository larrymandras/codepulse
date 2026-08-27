# Phase 128 — Deferred Items (out of plan scope, logged not fixed)

## From 128-01 (Task 2, `checks/closed-todos.mjs` build)

**Two files in `.planning/todos/completed/` carry `status: pending`, contradicting their own
location.** Found while building the structural closure checker; unrelated to this plan's five
todos and to any file this plan modifies, so left untouched per CLAUDE.md's scope boundary
("only auto-fix issues DIRECTLY caused by the current task's changes... pre-existing warnings
are out of scope").

- `.planning/todos/completed/eval-and-trace-observability-v10.md` — frontmatter `status: pending`
- `.planning/todos/completed/llm-analytics-rollup-migration-cr01.md` — frontmatter `status: pending`

Neither carries a `closed_by:` field, so both predate the `status: closed` / `closed:` /
`closed_by:` convention this plan's ledger and checker follow. `checks/closed-todos.mjs`
WARNS about both (does not fail the run — see the script's SCOPE NOTE header comment) so they
stay visible without being silently swept under a passing checker. A future phase touching the
todo corpus should either backfill their closure frontmatter (if the underlying work really did
ship) or move them back to `pending/` (if it did not).

**Seven completed todos predate the `status: closed` + `closed:` + `closed_by:` convention
entirely**, using older vocabulary (`status: resolved`, `status: closed-fixed`,
`status: closed-accepted-by-design`, a bare `resolved:` date field, no `closed_by:` at all):
`118-detectcredentialvalue-misses-fal-key.md`, `flaky-workspacescan-deep-tree.md`,
`114-clerk-bounce-tracking-and-dev-keys.md`, `onboarding-modal-blocks-app.md`,
`85-focus-centering-and-kg-effect-robustness.md` (which carries no `status:` field at all --
a third sub-case, distinct from both the modern triple and the two anomalies), plus the two
`status: pending` anomalies above. `checks/closed-todos.mjs` does not enforce the strict triple
against these — only against todos that carry a `closed_by:` field at all. Retroactively
normalizing all seven to the modern convention is a reasonable future-phase cleanup, not this
plan's scope (this plan's `files_modified` names five specific pending todos, not the historical
completed corpus).
