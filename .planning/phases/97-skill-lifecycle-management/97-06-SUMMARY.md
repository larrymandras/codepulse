# 97-06 SUMMARY — Cold-storage marker + live cross-repo round-trip

**Status:** ✅ complete (operator-verified live, 2026-07-19)
**Plan:** 97-06 (checkpoint, non-autonomous) · **Requirements:** INTAKE-01, INTAKE-02, INTAKE-03

## What this closed

The two host/operator preconditions that could not be automated or unit-tested — the cold-storage
marker file and the live cross-repo intake round-trip that is the only real proof of INTAKE-01/02/03.

## Task 1 — cold-storage confirmation marker

Operator hand-created `~/.claude/skill-intake.toml` on host `lmofficenew` with `[astridr]`
`confirmed = true` (verified `cat` reads it back). By design no code path writes this key.
Proven at Task 2 Case 3: a `--to cold --write` install passed the exit-6 gate and landed a file.

## Task 2 — live end-to-end round-trip (all cases PASSED)

Preconditions established live: forge daemon rebuilt + restarted on `lmofficenew` with
`CONVEX_FORGE_INGEST_URL` + `FORGE_INGEST_API_KEY` + `ASTRIDR_INGEST_API_KEY` set (startup log
`[forge] skill rescan: enabled`); codepulse Convex deployed to `tidy-whale-981`.

| Case | Result (disk-verified) |
|------|------------------------|
| upload → global | ✅ real file at `~/.claude/skills/…/SKILL.md`, auto-reflected (no manual refresh) |
| upload → project | ✅ real file under `<workspace>/.claude/skills/…` (after the picked workspace was a git repo); also proved exit-7 refusal + 97-05 house copy live |
| upload → cold | ✅ real file at `~/.claude/skills-available/…`, cold marker passed the exit-6 gate |
| GitHub URL fan-out | ✅ 14 skills, real names, confirm-first honored (operator installed all 14 deliberately), auto-reflected |
| traversal guard | ✅ `../../etc/passwd` rejected pre-write ("escapes the extracted repository root"), nothing written |
| collision | ✅ 97-01 exit-5 → 97-05 D-07 house copy ("A skill already exists at cold…"), on-disk skill byte-unchanged (no overwrite) |

INTAKE-01/02/03/04 + DAEMON-01/03/04 all demonstrated against the live stack.

## Finding surfaced + fixed (the reason live QA exists)

**Finding 1 (upload naming):** uploaded skills installed under the temp-dir UUID (`intake-<commandId>`)
instead of their frontmatter `name`, because the CLI derives the name from the staging dir's parent.
Fixed in forge `8a144c1` — parse the downloaded SKILL.md frontmatter (reusing 97-02's
`parseFrontmatter`), sanitize to a traversal-proof segment, stage under `<safeName>`; fall back to
`intake-<commandId>` when nameless. 18/18 tests, tsc clean. **Re-verified live:** re-upload installed
to `~/.claude/skills/phase97-smoke-test/` (correct name). Full detail in `97-06-FINDINGS.md`.

## Follow-ups (deferred, see 97-06-FINDINGS.md / deferred-items.md)

- No manual/on-delete registry reconciliation — the rescan fires only post-install; skills removed
  out-of-band linger on the Skills page until the next install. Lands in Phase 98 (delete/archive
  mutations rescan). Optional: fire one rescan at daemon startup.
- `index.ts` rescan workspaces are a startup snapshot (mid-session workspace syncs need a restart).

## Test-artifact cleanup

All round-trip test skills removed from disk (the phase97-smoke-test dirs across all 3 scopes, the
14 superpowers skills installed to cold, `Downloads/SKILL.md`), and the `git init` on `testWorkspace`
was undone. Note: the Skills page will show these until the next install triggers a rescan (see
follow-up above).
