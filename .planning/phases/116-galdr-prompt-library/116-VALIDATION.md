---
phase: 116
slug: galdr-prompt-library
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 116 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `116-RESEARCH.md` § Validation Architecture (lines 422-462).
> **No `REQ-XX` IDs exist for this phase** (`phase_req_ids` is null / ROADMAP says TBD) — rows are keyed by CONTEXT.md decision ID `D-01`..`D-16` instead.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Convex + React unit/integration), Playwright (e2e) |
| **Config file** | `package.json` scripts (`"test": "vitest"`, `"test:e2e": "playwright test"`) — verified 2026-08-10. Convex tests live in `convex/__tests__/*.test.ts` and colocated `convex/*.test.ts`; React tests `src/**/*.test.tsx`; e2e `e2e/*.spec.ts` |
| **Quick run command** | `npx vitest run <changed test file>` then `npx tsc --noEmit` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Phase-gate command** | Full suite **plus** `npm run test:e2e` |
| **Estimated runtime** | ~60s unit + typecheck; e2e adds ~90s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file> && npx tsc --noEmit`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite green, **plus** `npm run test:e2e`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner. Each row below is a **behaviour that must be claimed by at least one task's `<automated>` verify**; the planner fills the Task ID column when plans are written.

| Task ID | Plan | Wave | Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| _(planner)_ | — | 1 | D-01, D-02 | V2 Authentication | `validateGaldrAuth` denies when `GALDR_API_KEY` is unset (unless explicit `GALDR_ALLOW_ANON=true`); accepts a correct Bearer key; denies a wrong one | unit | `npx vitest run convex/__tests__/ingestAuth.test.ts` | ✅ file exists — extend with galdr cases | ⬜ pending |
| _(planner)_ | — | 1 | D-04 | V4 Access Control | `/galdr/prompt` and `/galdr-save` responses carry **no** `Access-Control-Allow-Origin` header and no `OPTIONS` route is registered | unit/integration | `npx vitest run convex/__tests__/galdrHttp.test.ts` | ❌ W0 | ⬜ pending |
| _(planner)_ | — | 1 | D-06 | Tampering | A second `/galdr-save` with a colliding slug throws `ConvexError` carrying the existing prompt's title + `updatedAt`; the `prompts` row count is unchanged and the existing body is byte-identical | unit | `npx vitest run convex/__tests__/galdr.test.ts` | ❌ W0 | ⬜ pending |
| _(planner)_ | — | 1 | D-14 | N/A | Saving a 21st version for one prompt leaves exactly 20 `promptVersions` rows for that `promptId`, and rows for **other** prompts are untouched | unit | `npx vitest run convex/__tests__/galdr.test.ts` | ❌ W0 | ⬜ pending |
| _(planner)_ | — | 1 | D-15 | N/A | Restore **appends** a new `promptVersions` snapshot; the restored-from row still exists and the version count increases by exactly 1 | unit | `npx vitest run convex/__tests__/galdr.test.ts` | ❌ W0 | ⬜ pending |
| _(planner)_ | — | 1 | D-16 | N/A | Archiving sets `archived: true`; the row is excluded from `list` and from skill lookup; its `promptVersions` rows still exist (count unchanged) | unit | `npx vitest run convex/__tests__/galdr.test.ts` | ❌ W0 | ⬜ pending |
| _(planner)_ | — | 1 | D-13 | N/A | `prompts` is **not** a key in `RETENTION_DAYS`, and the inline exemption comment is present in `convex/retention.ts` | unit (static assertion) | `npx vitest run convex/retention.test.ts` | ✅ file exists — extend it | ⬜ pending |
| _(planner)_ | — | 1 | D-09, D-10 | Tampering | The shared `{{variable}}` detection function extracts every placeholder from a body and reports the unresolved set; an unresolved set that is non-empty blocks injection | unit | `npx vitest run` on the shared-function test | ❌ W0 (requires the extraction below) | ⬜ pending |
| _(planner)_ | — | 2 | D-11 | Tampering | The Copy control is `disabled` while any variable is empty or whitespace-only, and enabled only once all are filled | unit (React Testing Library) | `npx vitest run src/components/galdr/FillVariablesDialog.test.tsx` | ❌ W0 | ⬜ pending |
| _(planner)_ | — | 2 | D-12 | Tampering | Send-to-Chat navigates only after every variable resolves; the body handed to the autoSend handoff contains **no** `{{…}}` substring | e2e | `npx playwright test e2e/galdr-send-to-chat.spec.ts` | ❌ W0 (model: `e2e/navigation.spec.ts`, verified present) | ⬜ pending |
| _(planner)_ | — | final | Schema deploy | Tampering / DoS | New tables land on the **live self-hosted** instance, never the cloud deployment | manual, evidence-gated (Phase 107-05 precedent — run inline in the main session, not delegated) | `npx convex deploy` — assert CLI output contains `127.0.0.1:3210` and never `.convex.cloud` | ✅ established procedure | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/__tests__/galdr.test.ts` — new. Covers D-06, D-14, D-15, D-16.
- [ ] `convex/__tests__/galdrHttp.test.ts` — new. Covers D-04 (header **absence** asserted on a real `Response`) plus request/response shape of both httpAction handlers.
- [ ] Extend `convex/__tests__/ingestAuth.test.ts` — covers D-01/D-02, mirroring the existing validator cases.
- [ ] Extend `convex/retention.test.ts` — covers D-13.
- [ ] `src/components/galdr/FillVariablesDialog.test.tsx` — new. Covers D-11.
- [ ] `e2e/galdr-send-to-chat.spec.ts` — new (or extend `e2e/navigation.spec.ts`). Covers D-12 and the nav-registry entry.
- [ ] **Extract a shared pure `{{variable}}` detection function** used by BOTH the skill script and the UI. No such extraction exists in the repo today. Without it, D-09/D-10's logic is duplicated and can silently drift between skill and UI — which contradicts CONTEXT.md's explicit "these four are one contract, not four independent choices" framing for D-09..D-12. **This is a Wave 0 blocker, not a refactor.**

---

## Manual-Only Verifications

| Behavior | Decision | Why Manual | Test Instructions |
|----------|----------|------------|-------------------|
| `/galdr <slug>` refuses to inject and names the missing variables | D-09, D-10 | The refusal is Claude Code reasoning inside SKILL.md, not a callable function. The underlying detection helper IS unit-tested (Wave 0), but the refusal behaviour itself is not. | In a live Claude Code session run `/galdr <slug>` for a prompt with an unfilled variable. Assert the response names the missing variable(s) and that **no** prompt body was injected. Then re-run supplying the value and assert injection succeeds. |
| `/galdr-save` collision message is legible to the operator | D-06 | Convex redacts plain `Error` messages client-side; only a `ConvexError`'s `.data` survives. The server-side throw is unit-tested; that the *skill* surfaces it readably is not. | Save a prompt, then `/galdr-save` the same title again. Assert the session shows the existing prompt's title and `updatedAt`, not "Server Error". |
| End-to-end live gate (design doc §4.1) | phase goal | Requires the live self-hosted Convex stack, a real Ástríðr turn, and two separate Claude Code sessions. | 1. Save a prompt from a Claude Code session on the desktop. 2. In a **second** session, `/galdr` retrieves it. 3. It appears in the CodePulse `/galdr` UI. 4. Send-to-Chat produces a real Ástríðr turn. 5. Version history shows the edit trail. |
| Skill reaches the laptop | D-07 | Filesystem + git operation outside the repo. | `git -C C:\Users\mandr\.claude add -f skills/galdr/SKILL.md` (plus any bundled script), commit, push. Assert `git ls-files skills/galdr/` is non-empty — `.gitignore:72` ignores `skills/` wholesale, so an unforced add silently no-ops. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ references above
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`; `playwright test`, never `--ui`)
- [ ] Feedback latency < 60s
- [ ] Manual-only rows each have concrete, observable instructions — no proxy signals
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
