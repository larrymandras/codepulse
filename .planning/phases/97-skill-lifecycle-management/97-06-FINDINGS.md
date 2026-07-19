# 97-06 Live Round-Trip — Findings

Bugs surfaced by the live cross-repo intake round-trip (the whole point of this manual
checkpoint — behaviors not meaningfully unit-testable). Decision (2026-07-18): collect
all findings across the round-trip, then fix in one focused daemon pass and re-verify.

## Round-trip outcome (operator-driven, 2026-07-19) — all cases PASSED

| Case | Result |
|------|--------|
| 1 upload → global | ✅ real file on disk + auto-reflect (no manual refresh) |
| 2 upload → project | ✅ real file (after `git init` on the picked workspace); also proved exit-7 refusal + 97-05 house copy live |
| 3 upload → cold | ✅ real file + cold marker (Task 1) passed the exit-6 gate |
| 4 GitHub URL fan-out | ✅ 14 skills, real names (finding 1 does NOT affect this path), confirm-first honored (operator selected all 14 deliberately) + auto-reflect |
| 5 traversal guard | ✅ `../../etc/passwd` rejected pre-write ("escapes the extracted repository root"), nothing written |
| 6 collision | ✅ 97-01 exit-5 → 97-05 D-07 house copy ("A skill already exists at cold…"), on-disk skill byte-unchanged (no overwrite) |

INTAKE-01/02/03/04 + DAEMON-01/03/04 all demonstrated live. Only **Finding 1** stands.

## Finding 1 — Upload path names skills with the temp-dir UUID, not the frontmatter name — ✅ FIXED & RE-VERIFIED

**Fixed** in forge `8a144c1` (`fix(97-06): stage uploaded SKILL.md under a name-derived dir`).
Now parses the downloaded SKILL.md frontmatter (reusing 97-02's `parseFrontmatter`), sanitizes
`name` to a safe single path segment (traversal-proof), and stages at
`<tmpRoot>/intake-<commandId>/<safeName>/SKILL.md` so the CLI's parent-dir name = the real skill
name; falls back to `intake-<commandId>` for nameless uploads. 18/18 intake-runner tests, tsc
clean. **Re-verified live 2026-07-19:** re-uploaded the smoke-test → installed to
`~/.claude/skills/phase97-smoke-test/` (correct name), auto-reflected. Original detail below.

## Follow-up — no manual/on-delete registry reconciliation (defer to Phase 98)

The DAEMON-03 rescan fires only **after an install** (`status==='done'`). There is no manual
"rescan now" trigger and no startup rescan, so skills removed/changed on disk out-of-band
(e.g. the round-trip cleanup) keep showing on the Skills page until the next install triggers a
prune. Lands naturally in **Phase 98** (archive/restore/move/delete mutations, which will rescan).
Optional small enhancement: fire one `rescanAndSync` at daemon startup so a restart reconciles.

---



**Severity:** medium (real writes work, but every *uploaded* skill lands under a garbage
`intake-<commandId>` name → shows as "Unknown", and the auto-categorizer files it under
an "Intake" category off that prefix). GitHub-URL path is unaffected.

**Repro:** Upload `SKILL.md` (frontmatter `name: phase97-smoke-test`) → destination global →
Install. File lands at `~/.claude/skills/intake-5c3768fd-…/SKILL.md` (content correct) but
the *directory* — which is the skill's discovery identity — is `intake-5c3768fd-…`.

**Root cause:** `forge/src/emit/intake-runner.ts:90` stages the download into
`<tmpRoot>/intake-<commandId>/SKILL.md` and passes that path to `skill-intake admit`; the
CLI derives the skill name from the parent directory. A bare uploaded SKILL.md has no
inherent dir name, so the daemon's invented temp name becomes the skill name. Pre-existing
Plan-08 staging behavior, invisible until Phase 97's real writes placed a real directory.

**Proposed fix:** In the `payload.storageId` branch, parse the downloaded SKILL.md's
frontmatter `name:` (reuse 97-02's `parseFrontmatter` from `skill-rescan.ts`), sanitize to a
safe dir slug, and stage into `<tmpRoot>/<name>/SKILL.md`. Fall back to `intake-<commandId>`
when `name` is missing/empty/unsafe. Add unit coverage: named-frontmatter → correct dir;
missing/unsafe name → fallback; path-traversal in name → rejected/sanitized.

**Cleanup owed:** remove the mis-named test skill `~/.claude/skills/intake-5c3768fd-…/` (and
HIDE its auto-categorize review row) at round-trip end.
