---
phase: 108-per-profile-engine-telemetry-astridr-backend
threats_registered: 39
threats_open: 0
threats_closed: 39
unregistered_flags: 0
asvs_level: not specified in phase plans (treated as informational; no <config> block present)
audited: 2026-08-07
---

# Phase 108 — Security Verification

Per-profile engine telemetry + astridr backend (7 plans, cross-repo: codepulse `master` +
astridr-repo `feature/brain-swap`). This document verifies every `<threat_model>` row declared
across `108-01-PLAN.md` … `108-07-PLAN.md` against the LIVE code at HEAD (and, where the plan's
own disposition points to it, the live-operation evidence in `108-ENGINE-05-EVIDENCE.md`). No
implementation file was modified to produce this report.

39 STRIDE rows were declared across the 7 plans (some threat IDs recur across plans because a
single underlying threat has mitigation legs in more than one plan — e.g. T-108-02's fail-closed
validation is implemented in plan 04, deliberately NOT re-validated in plan 05 [`transfer`], and
proven live in plan 07). All 39 resolved CLOSED. Zero unregistered attack-surface flags — every
plan's SUMMARY.md `## Threat Flags` section reported "None" and independent review found no new
surface the register missed.

## STRIDE Threat Register — Verification

| Threat ID | Plan | Category | Disposition | Verdict | Evidence |
|-----------|------|----------|-------------|---------|----------|
| T-108-07 | 01 | Tampering | mitigate | **CLOSED** | `astridr/engine/telemetry.py:697-708` (`set_profile_context`/`reset_profile_context`, token-paired). Both live set-points wrap the reset in `finally:`: `astridr/channels/agent_processor.py:124` (set) / `:163-165` (`finally: reset_profile_context(_profile_token)`, covers the `except Exception:` path at `:154`), and `astridr/engine/bootstrap/wiring.py:351` (set) / `:615-616` (`finally: reset_profile_context(_profile_token)`). |
| T-108-08 | 01 | Spoofing | mitigate | **CLOSED** | `astridr/providers/router.py:493` — `profile_id = get_profile_context()` (ContextVar read only); `payload["profileId"] = profile_id` at `:553`. No code path in `_emit_model_routing` reads `profileId` from caller-supplied args. |
| T-108-09 | 01 | Information Disclosure | accept | **CLOSED** (acceptance holds) | `router.py:499-503,518-522` — `logger.debug` lines carry only `reason`/`selection_path`, no key/token/message text. |
| T-108-10 | 01 | Denial of Service | mitigate | **CLOSED** | `router.py:150` (`self._last_routing_emit: dict[str, tuple] = {}`), `:541-549` — emit-on-change memo keyed by `profile_id`, skips when `(model, mode, selection_path, status)` is unchanged. |
| T-108-11 | 01 | Repudiation | accept | **CLOSED** (acceptance holds) | Both refusal branches emit `logger.debug("router.model_routing_skipped", reason=...)` — `router.py:499-503` (no profile context) and `:518-522` (unresolved model). |
| T-108-SC | 01 | Tampering | accept | **CLOSED** | No `pyproject.toml`/`uv.lock` diff attributable to Phase 108 commits (`git log` on those files shows only unrelated Dependabot/security-bump commits). |
| T-108-03 | 02, 03 | Spoofing | mitigate | **CLOSED** | `convex/controlVerbSwaps.ts:52` — `record` is `internalMutation` (absent from `api.*`). Reached only via `internal.controlVerbSwaps.record` at `convex/runtimeIngest.ts:1049`. No `api.controlVerbSwaps.record` reference exists anywhere in the repo (checked). |
| T-108-05 | 02 | Denial of Service | mitigate | **CLOSED** | `convex/retention.ts:70,77` — `activeEngineSnapshots: 30`, `controlVerbSwaps: 30` added to `RETENTION_DAYS`, pruned by the existing cursor-seeked, batch-capped sweep (`BATCH_SIZE=200`, `MAX_BATCHES_PER_NIGHT=600`, `:81-83`). No bespoke delete path added. |
| T-108-12 | 02, 06 | Denial of Service | mitigate | **CLOSED** | Server: `convex/controlVerbSwaps.ts:82-93` — `listByScope` uses `.withIndex("by_scope", ...).order("desc").take(SWAP_HISTORY_CAP)` (`SWAP_HISTORY_CAP = 20`), never `.collect()`. Client: `src/components/brains/GlobalSwapModal.tsx:288-289` — `.slice(0, SWAP_HISTORY_CAP)` belt-and-suspenders bound, `atCap` gates the on-screen truncation caption (line 326 area) so a short list is never mislabeled as capped. |
| T-108-13 | 02 | Tampering | accept | **CLOSED** (acceptance holds) | `convex/schema.ts:2094,2106` — `verb: v.string()`, `path: v.string()` (not Literal unions), matching the file's stated defensive-boundary convention. |
| T-108-SC | 02 | Tampering | accept | **CLOSED** | No package install in this plan's diff. |
| T-108-14 | 03 | Denial of Service | mitigate | **CLOSED** | `convex/runtimeIngest.ts:509-521,1611-1621` — every event in the ingest loop is wrapped in a per-event `try {...} catch (err) { droppedCount++; ... }`; a throw in one event's switch case cannot abort sibling events in the same batch. `droppedCount` is surfaced in the response body (`:1635`, `JSON.stringify({ ingested, dropped: droppedCount, skipped: skippedCount })`), not just incremented internally. |
| T-108-15 | 03 | Tampering | mitigate | **CLOSED** | `convex/runtimeIngest.ts:297-299` — `resolveModelRoutingEvent` returns `null` on `d.status === "failed"`; the `"model_routing"` case (`:1007-1020`) checks `if (!resolved) { skippedCount++; ...; break; }` before ever calling `internal.activeEngine.recordRouting` — a failed resolution never reaches the table `latestByProfile` (no status filter) would render as live. |
| T-108-16 | 03 | Information Disclosure | accept | **CLOSED** (acceptance holds) | No `dangerouslySetInnerHTML`/`innerHTML` introduced by this plan (ingest-side; storage only). |
| T-108-SC | 03 | Tampering | accept | **CLOSED** | No package install in this plan's diff. |
| T-108-01 | 04 | Elevation of Privilege | accept | **CLOSED** (acceptance holds) | `astridr/security/command_auth.py` untouched by Phase 108 (`git log` on the file shows only the original Phase 47 commit; `grep -c "swap.set"` on it returns 0). Existing gates intact: `CommandAuth.check` (`ADMIN_COMMANDS` frozenset, `:15,41`) and the WS handshake's constant-time `hmac.compare_digest` dual-key check (`astridr/engine/ws_telemetry.py:147-155`). |
| T-108-02 | 04 | Tampering / Spoofing | mitigate | **CLOSED** | `astridr/api/ws_commands.py:1121-1138` — three fail-closed reject branches, each `raise ValueError(...)` strictly BEFORE `verb.execute(args, ctx)` at `:1152`: (1) voice target + `profile_id` → reject (`:1127-1128`); (2) no `message_router` / no `known_profile_ids` accessor → reject rather than proceed unvalidated (`:1133-1134`); (3) `cmd.profile_id not in known_ids` → reject, naming the id (`:1137-1138`). All three raises occur before dispatch — an unknown/unvalidatable profile_id never reaches `verb.execute`, so it cannot silently apply globally. |
| T-108-17 | 04 | Elevation of Privilege | mitigate | **CLOSED** | `astridr/security/command_auth.py:15` — `ADMIN_COMMANDS: frozenset[str] = frozenset({"estop.activate", "estop.deactivate"})`; `grep -c "swap.set"` on the file returns 0. `swap.set` is not admin-gated. |
| T-108-18 | 04 | Tampering | mitigate | **CLOSED** | `astridr/engine/control_verbs/registry.py:38-51` — `ControlVerbContext` still has exactly 3 fields (`session_id`, `channel`, `telemetry`), unchanged. `ws_commands.py:1149-1151` constructs it with `session_id=None, channel=..., telemetry=...` — no `profile_id` field added to the frozen dataclass. The scope travels through `SwapSetCommand.profile_id` (`:253`) → `args["profile_id"]` (`:1146-1147`) only. |
| T-108-19 | 04 | Denial of Service | accept | **CLOSED** (acceptance holds) | `astridr/providers/router.py:792-793` (`set_profile_override`) is reachable only from `swap_model.py`'s `_execute` (`:606-608`) with `profile_id` sourced from `args["profile_id"]`, which is only populated after `_handle_swap_set`'s `known_profile_ids()` validation. Cardinality bounded by configured profile count. |
| T-108-SC | 04 | Tampering | accept | **CLOSED** | No package install in this plan's diff. |
| T-108-02 | 05 | Tampering | transfer | **CLOSED** (transfer documented) | `astridr/engine/control_verbs/swap_model.py:504-513` — explicit comment: this verb deliberately does NOT re-validate `args["profile_id"]`, naming `_handle_swap_set` (plan 04) as the sole validating entry point. The transfer's consequence is stated in the plan and mirrored in code comments, satisfying the "auditable transfer" requirement. |
| T-108-20 | 05 | Repudiation | mitigate | **CLOSED** | `swap_model.py` sends `control_verb_swap` telemetry on all 4 outcome branches when `ctx.telemetry is not None`: restore (`:549-550`), refused/unhandled (`:578-579`), affinity-guard refusal (`:589-590`), success (`:611-612`). `astridr/engine/control_verbs/swap_voice.py:221,242` likewise sends on its outcome branches. |
| T-108-21 | 05 | Tampering | mitigate | **CLOSED** | `astridr/engine/bootstrap/core.py:189-203` — boot-seed rows carry `"mode": "inherited"`, `"selectionPath": selection_path` (default `"boot-seed"`, or `"restore-to-default"` for the live-restore reuse path) — distinguishable from a resolved live reading. `:190-196` — a profile with a falsy `model_default` is `continue`d (skipped), never seeded with a placeholder. |
| T-108-22 | 05 | Elevation of Privilege | mitigate | **CLOSED** | `swap_model.py:525-537` (restore) and `:600-610` (success) are both mutually-exclusive `if profile_id: <profile-only mutation> else: <global-only mutation>` — no code path writes both the per-profile and the global override/clear in the same call. |
| T-108-SC | 05 | Tampering | accept | **CLOSED** | No package install in this plan's diff. |
| T-108-16 | 06 | Information Disclosure / XSS | mitigate | **CLOSED** | `src/components/brains/GlobalSwapModal.tsx:318` — `{row.target ?? "—"} → {row.resolved ?? "—"}` renders as plain JSX text children. Repo-wide grep of this plan's two touched files for `dangerouslySetInnerHTML`/`innerHTML` returns zero hits. |
| T-108-23 | 06 | Information Disclosure | accept | **CLOSED** (acceptance holds) | `convex/schema.ts:2093-2112` — `controlVerbSwaps` fields are `verb`, `target`, `resolved`, `providerAffinity`, `voiceId`, `path`, `reason`, `scope`, `sessionId`, `channel`, `timestamp` — no message content or credential field. `listByScope` (`convex/controlVerbSwaps.ts:82-93`) is a public `query`, matching the sibling `activeEngine.latestByProfile` precedent. |
| T-108-12 | 06 | Denial of Service | mitigate | **CLOSED** | (see T-108-12 / plan 02 row above — same evidence, client-side belt-and-suspenders half verified in `GlobalSwapModal.tsx:288-289`.) |
| T-108-24 | 06 | Tampering | mitigate | **CLOSED** | `src/hooks/useControlVerbSwaps.ts:90-108` — `describeSwapOutcome` maps `path==="restore"` → `restore`, `path==="refused"` → `refused`, `resolved==null` → `unresolved`, else → `success`; four distinct kinds, distinct icon/label per kind in `GlobalSwapModal.tsx:302-313`. A refusal cannot render as a success. |
| T-108-SC | 06 | Tampering | accept | **CLOSED** | No package install in this plan's diff (`lucide-react`, `convex/react`, shadcn primitives pre-existing). |
| T-108-25 | 07 | Information Disclosure | mitigate | **CLOSED** | `108-ENGINE-05-EVIDENCE.md:191,700,1039,1319` — service key read via `os.environ["ASTRIDR_WEB_API_KEY"]` inside the running `astridr-agent` container, never printed. Convex admin key captured into a shell variable (`ADMIN_KEY=$(...)`) and referenced only as `"$ADMIN_KEY"` in every `npx convex` invocation shown. Phase-directory-wide credential scan (Bearer-token pattern, JWT `eyJ...` pattern, 32-64 char hex pattern, 32+ char alnum pattern excluding test names/doc IDs/UUIDs) returned **zero matches** for actual key material across all `108-*.md` files. |
| T-108-26 | 07 | Denial of Service | mitigate | **CLOSED** | No `import --replace-all` or bulk delete in the evidence transcript (grepped, zero hits). The one temporary delete mutation (`controlVerbSwaps:_purgeSyntheticTestRow`) was single-document, `_id`+`scope`-guarded, added/exercised/reverted within plan 07 — confirmed absent from `convex/controlVerbSwaps.ts` at HEAD (only `record` and `listByScope` exist in that file, read in full) AND confirmed absent live post-redeploy (`108-ENGINE-05-EVIDENCE.md:1464-1468`: `Could not find function for 'controlVerbSwaps:_purgeSyntheticTestRow'`, function catalogue shows only `record`/`listByScope` remaining). |
| T-108-27 | 07 | Tampering | mitigate | **CLOSED** | `108-ENGINE-05-EVIDENCE.md:1400-1419` — both overrides restored and read back: final `activeEngine:latestByProfile` shows all three profiles `mode: "inherited"`, none pinned to a test model, cross-checked against real agent turns (`claude-sonnet-5` served), not acks alone. |
| T-108-28 | 07 | Repudiation | mitigate | **CLOSED** | Evidence file structure pastes raw command output above every PASS/FAIL verdict throughout (spot-checked at lines 42-56, 1435-1456). Operator sign-off recorded: `108-07-SUMMARY.md:196-212`, Larry's "approved" quoted verbatim with date. |
| T-108-29 | 07 | Spoofing | mitigate | **CLOSED** | Every literal `npx convex` invocation shown in the evidence file carries `--url http://127.0.0.1:3210` explicitly (spot-checked at lines 39, 65; declared as a blanket rule at line 7-9 and consistent with every fully-written invocation in the file — abbreviated `...` invocations are a documented transcript convention for the shared boilerplate, not an omission of the flag in the actual commands run). |
| T-108-SC | 07 | Tampering | accept | **CLOSED** | No package install; `websockets` 16.0 confirmed already present rather than installed (`108-ENGINE-05-EVIDENCE.md:191`). |

## Unregistered Flags

None. Every plan's `SUMMARY.md` `## Threat Flags` section reports "None beyond the plan's own
`<threat_model>`" (checked: `108-01-SUMMARY.md:193-195`, `108-02-SUMMARY.md:133-135`,
`108-03-SUMMARY.md:312-314`, `108-04-SUMMARY.md:319-324`, `108-05-SUMMARY.md:358-363`,
`108-06-SUMMARY.md:176-178`, `108-07-SUMMARY.md:283-288`). Independent verification found no new
network endpoint, auth path, file-access pattern, or schema surface introduced by this phase's
commits beyond what the register above already covers.

## Highest-Value Findings (per audit dispatch)

1. **T-108-02 (scoped-request-applies-globally class).** VERIFIED at the code level, not just
   asserted: `_handle_swap_set` (`astridr/api/ws_commands.py:1089-1165`) raises on all three
   failure modes (voice+scope, unvalidatable source, unknown id) strictly before
   `verb.execute()` is ever called (`:1152`). `swap_model.py`'s scope-branching (`:525-537`,
   `:600-610`) is exclusive `if/else` — no path writes both the per-profile and global override
   in one call. Both the unit-level guarantee and the live-run negative control
   (`108-ENGINE-05-EVIDENCE.md`, Step 7 area) agree.
2. **Secret handling.** Zero credential-shaped strings found anywhere under the phase directory
   (evidence file, all 14 PLAN/SUMMARY files, discussion log, research, validation, context,
   patterns docs). No `.env` file was read or printed during this audit.
3. **T-108-14 (ingest batch poisoning).** Per-event `try/catch` confirmed at the loop level
   (`convex/runtimeIngest.ts:509,1611`), covering every case in the ~80-case switch. Both
   `dropped` and `skipped` counters are incremented at their respective sites AND surfaced in the
   HTTP response body (`:1635`) — not just incremented into an internal-only variable, closing
   the "silent data-loss channel" concern the dispatch flagged.
4. **T-108-26 (live single-node Convex instance).** No bulk delete or `import --replace-all`
   anywhere in this phase's commits or its live-evidence transcript. The one temporary
   single-document delete mutation used during 108-07's live proof is confirmed absent from the
   file at HEAD (read in full: only `record` and `listByScope` remain) and confirmed absent live
   by a post-redeploy negative probe recorded in the evidence file.
5. **T-108-23 (`listByScope` public query, accept).** Acceptance still holds: the table schema
   carries no message content, credential, or PII field; the query is bounded server-side
   (`.take(SWAP_HISTORY_CAP)`) and mirrors an existing accepted precedent
   (`activeEngine.latestByProfile`).

## Scope Note

This audit covers only the threats declared in `108-01-PLAN.md` … `108-07-PLAN.md`'s
`<threat_model>` blocks. It does not re-scan the ~80-case `runtimeIngest.ts` switch for defects
outside this phase's touched cases, and does not re-audit pre-existing gates (`command_auth.py`,
`ws_telemetry.py`'s handshake) beyond confirming they were left untouched where a threat's
disposition depends on that.
