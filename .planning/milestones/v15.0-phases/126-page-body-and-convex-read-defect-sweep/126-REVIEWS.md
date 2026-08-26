---
phase: 126
reviewers: [codex]
reviewed_at: 2026-08-24T23:40:00Z
plans_reviewed: [126-01-PLAN.md, 126-02-PLAN.md, 126-03-PLAN.md, 126-04-PLAN.md, 126-05-PLAN.md, 126-06-PLAN.md, 126-07-PLAN.md, 126-08-PLAN.md, 126-09-PLAN.md]
---

# Cross-AI Plan Review - Phase 126

## Reviewer coverage - read this before treating the verdict as a panel

**ONE reviewer ran.** `codex` (gpt-5.5) was the only independent CLI available.

| CLI | Detected | Used | Why |
|---|---|---|---|
| codex | yes | **yes** | the independent reviewer |
| claude | yes | no | `CLAUDE_CODE_ENTRYPOINT=cli` - the workflow skips self for independence |
| gemini / coderabbit / opencode / qwen / cursor | no | no | not installed |

The workflow's bar ("at least one DIFFERENT CLI") is met, but the premise of cross-AI review is
that different models catch different blind spots. One model gives one set. Installing a second
CLI before the next review would materially raise the value of this step.

## Invocation, and three deliberate deviations from the stock workflow

`cat <prompt> | codex exec -s read-only --skip-git-repo-check -` over a 338,680-byte prompt
(~84k tokens) carrying PROJECT.md (80 lines), the ROADMAP phase section, the SWEEP requirements,
CONTEXT.md, RESEARCH.md, and all nine PLAN.md files.

1. **`-s read-only` was added.** The stock command has no sandbox flag, and `codex exec` runs
   model-generated shell commands. Against a live shared checkout with a self-hosted Convex
   backend, an agentic reviewer with write access could have edited the plans it was reviewing.
   **Verified after the run: HEAD identical before and after** (`88689c2a`), working tree dirty
   only with two pre-existing untracked files belonging to another session.
2. **A precedence block and an explicit trap warning were prepended.** RESEARCH.md is 64KB and
   PARTIALLY SUPERSEDED; without the warning the likeliest failure mode was a confident finding
   that the plans "fail to implement file storage" - the design measured and rejected by
   D-06-REVISED. **It worked:** the reviewer's own "what I dropped" line names file storage and
   `useProjectGraph.ts` as correctly-handled non-issues.
3. **This project's zero-false-positive bar was injected**, plus a pointer at the defect shape that
   recurred four times in planning (a fixture or comment that cannot express the bug beside it).
   **It worked:** finding MED-1 is a fifth instance, in a control the orchestrator wrote.

## Orchestrator verification of every finding

All seven findings were checked against the live plan files before being recorded.
**Confirmed: 7. Refuted: 0.** The evidence is in the Adjudication section below the review.

---

## Codex Review

# Review — Phase 126 (by gpt-5.5)

## Summary

The plans respect the amended decisions, preserve the reactive graph query, correctly sequence one Convex deploy, and use unusually strong measurement-first verification. However, three graph-integrity defects and two ineffective controls remain. The most serious are a chunk-read cap exceeding Convex’s byte ceiling, zero missing chunks being treated as valid “no data,” and a non-idempotent/racy backfill that can publish an empty or stale graph. These should be corrected before execution.

## Strengths

- Correctly follows D-06-REVISED: chunk rows, monotonic `seq`, one indexed query, no file storage, and no `useProjectGraph.ts` changes.
- D-07 is honored for Automation stat cards and Alert Rules; neither hypothesis is prematurely promoted to a diagnosis.
- Rendering criteria generally assert concrete values: node count, schedule text, row pitch, and `9 of 46`.
- The graph tests deliberately use realistic fixtures and measure row reads, not merely returned values.
- Inbox handling preserves the uncapped server consumer while replacing the shell subscription with a bounded count-only query.
- Wave ordering is substantively correct: graph writer before reader, reader before verification, and all backend changes before the single deploy.

## Concerns

- **[HIGH]** (confidence: high) `126-05-PLAN.md:181-186` — the proposed read cap can exceed Convex’s transaction byte ceiling before its named guard runs. The plan specifies: “`GRAPH_BLOB_MAX_CHUNKS` (200 — roughly 25 MB of serialized blob …)” followed by `.take(GRAPH_BLOB_MAX_CHUNKS + 1)`. The phase research records a 16 MiB transaction scan ceiling at `126-RESEARCH.md:727`; Plan 126-02 also budgets each chunk for as much as 512 KB encoded. Consequently, the database can abort the query before the handler sees row 201 and throws its intended `ConvexError`. The fake-context over-cap test would still pass because it models row count but not scanned bytes.

- **[HIGH]** (confidence: high) `126-05-PLAN.md:191-199` — complete chunk loss bypasses the integrity check. The prescribed order is: “If zero rows came back, `return null`,” followed later by “If `meta.blobChunkCount !== undefined && rows.length !== meta.blobChunkCount`, throw.” If a chunked active version says `blobChunkCount: 9` but all nine rows are missing, the query silently reports the legacy/no-data state rather than the corruption. This directly contradicts the plan’s truth that a missing chunk fails loudly.

- **[HIGH]** (confidence: high) `126-05-PLAN.md:262-275` — the backfill is neither idempotent nor protected against a concurrent ingest. It pages entity rows for the captured `meta.activeVersion`, then calls the ordinary writer; its only no-op is when the active version has “zero entity rows AND zero chunk rows.” Plan 126-02 explicitly stops entity writes at `126-02-PLAN.md:19,289`. Therefore:
  - rerunning the backfill after success, or running it after a new producer ingest, finds zero entity rows but nonzero chunks and can publish a new empty version;
  - if a producer advances `activeVersion` while paging, the action can publish stale entity data as a newer version because no expected-version comparison is required.
  
  Plan 126-08 contains no already-chunked or concurrent-version control for either case.

- **[MEDIUM]** (confidence: high) `126-08-PLAN.md:126-127` — the corruption fixture cannot reliably produce the failure it asserts. It says to “drop one character from the middle of one chunk” and require a parse-guard `ConvexError`. Removing a character from a JSON string value—for example `"node123"` → `"node13"`—leaves valid JSON. The handler would return a corrupted but plausible graph, not throw. This is the requested defect shape: a fixture that may be incapable of expressing the bug beside it.

- **[MEDIUM]** (confidence: high) `126-08-PLAN.md:202-208,239-251` — the ordering control exercises `joinGraphBlobChunks`, not the mandated indexed query. The harness is instructed to return insertion order despite `.order("asc")`, then prove removing the helper’s sort makes the test fail. That validates the belt-and-braces helper, but it does not establish that `getProjectGraph` actually selected `by_snapshot_version_seq` and requested ascending order. A reader using the wrong index would still pass because the helper repairs its output. The fake context should record and assert the index name, equality bounds, and `.order("asc")`, separately from the shuffled-input helper control.

- **[MEDIUM]** (confidence: high) `126-05-PLAN.md:272-275` and `126-09-PLAN.md:312,402` — the deploy acceptance criterion requests evidence the backfill contract does not return. Plan 126-05 specifies `{ snapshotId, sourceVersion, nodeCount, linkCount, pages }`; Plan 126-09 requires “the number of chunk rows written” and a “non-zero chunk count.” Execution cannot satisfy that criterion without changing the planned return contract or performing a separate post-backfill query.

- **[LOW]** (confidence: high) `126-01-PLAN.md:75,309` and `126-02-PLAN.md:419` — these plans incorrectly identify 126-08 as the deploy owner. Plan 126-08 is verification; 126-09 owns deployment. The actual wave dependencies remain correct, but these stale references can misroute an executor or summary audit.

## Suggestions

- Derive `GRAPH_BLOB_MAX_CHUNKS` from the 16 MiB scan ceiling with explicit overhead and safety margin; add a byte-budget assertion to the test harness.
- Check `blobChunkCount` before the zero-row legacy fallback: positive expected count plus zero rows must throw; only an absent legacy field should return `null`.
- Make backfill explicitly idempotent and version-guarded:
  - return `alreadyChunked` when the active meta has chunks;
  - require `activeVersion === sourceVersion` immediately before publishing;
  - abort with a named result if a producer advanced it.
- Make corruption deterministic by deleting a known structural delimiter. If valid-but-modified JSON must also be detected, add a stored checksum; parsing alone cannot establish integrity.
- Record and assert the graph reader’s table, index, equality bounds, order, and take limit in the fake context.
- Add `blobChunkCount` and target version to the backfill result, then align Plan 126-09 with that exact contract.
- Replace every stale “126-08 deploy” reference with 126-09.

## Risk Assessment

**HIGH** — the overall architecture is sound, but the current plans can silently classify lost chunks as no data, overwrite a live graph with empty or stale backfill data, and hit Convex’s byte ceiling before the planned guard executes. These are execution-blocking integrity issues, not presentation refinements.

## What I dropped and why

I dropped concerns about file storage, `useProjectGraph.ts`, D-07’s unresolved diagnoses, entity-table retention, and the single-deploy wave structure because they are either explicitly rejected decisions or correctly handled by the plans.

---

## Adjudication - orchestrator's independent check of each finding

Each finding was verified by opening the cited lines. No finding was accepted on the reviewer's
word, and none was dismissed without evidence.

| # | Severity | Verdict | Evidence confirming it |
|---|---|---|---|
| 1 | HIGH | **CONFIRMED** | `126-05-PLAN.md:181-183` sets `GRAPH_BLOB_MAX_CHUNKS` = 200 ("roughly 25 MB"); `126-02-PLAN.md:17,207` budgets each chunk at up to 512 KB encoded; `126-RESEARCH.md:727` cites Convex's **16 MiB scanned per transaction**. `.take(201)` can breach the byte ceiling before row 201 is reached, so the plan's own `ConvexError` guard is UNREACHABLE. The fake-ctx test counts rows, not bytes, so it passes regardless. **Same defect class as D-05 itself.** |
| 2 | HIGH | **CONFIRMED** | `126-05-PLAN.md:191-199` orders `return null` on zero rows BEFORE the `blobChunkCount` comparison. With `blobChunkCount: 9` and all nine chunks lost, the query reports "no data" rather than throwing - total loss bypasses the missing-chunk detector, contradicting the plan's own stated truth that a missing chunk fails loudly. |
| 3 | HIGH | **CONFIRMED** | `126-05-PLAN.md:274-276`: the backfill's only no-op is "zero entity rows AND zero chunk rows". Since `126-02-PLAN.md:19,289` STOPS entity writes, a re-run finds zero entity rows but non-zero chunks, so the AND is false, it proceeds with empty accumulators, and `upsertGraphSnapshot` publishes a NEW EMPTY VERSION and flips `activeVersion`. No expected-version guard exists either, so a concurrent producer ingest can be overwritten with stale data. **Re-running a backfill after apparent success is exactly what an operator does when unsure.** |
| 4 | MEDIUM | **CONFIRMED** | `126-08-PLAN.md:126-127` says "drop one character from the middle of one chunk" and require a parse-guard throw. Dropping a character inside a JSON string value (`"node123"` -> `"node13"`) leaves **valid JSON**; the handler returns a corrupted-but-plausible graph and never throws. A fixture that cannot express the bug it guards - the fifth instance of this shape in this phase, and it is in a control the orchestrator specified. |
| 5 | MEDIUM | **CONFIRMED** | `126-08-PLAN.md:202-208` validates the helper's `seq` sort, not that `getProjectGraph` selected `by_snapshot_version_seq` with `.order("asc")`. Because the reader sorts in JS anyway, a reader using the WRONG INDEX still passes - so the test does not verify D-06-REVISED's binding index requirement. Belt-and-braces sorting masks index misselection. |
| 6 | MEDIUM | **CONFIRMED** | `126-09-PLAN.md:312` requires "the number of chunk rows written" and `:402` "a non-zero chunk count", but `126-05-PLAN.md:273` returns `{snapshotId, sourceVersion, nodeCount, linkCount, pages}` - no chunk count. The acceptance criterion is **unsatisfiable** as specified. |
| 7 | LOW | **CONFIRMED** | `126-01-PLAN.md:309` and `126-02-PLAN.md:419` both state "Plan 126-08 owns the single operator deploy". **126-09 owns it**; 126-08 is verification. Wave dependencies are unaffected, but the references would misroute an executor. |

### What this says about the orchestrator's own prior verification

The self-verification recorded in STATE.md covered structure and procedure - D-07 integrity, scope
fences, deploy discipline, requirement and decision coverage, wave ordering - and all of that held.
It did **not** audit the semantics of the chunked-read handler spec: the cap arithmetic against the
byte ceiling, the ordering of the guard clauses, or the backfill's idempotence. **All three HIGH
findings live exactly there.** A structural pass and a semantic pass are different properties, and
only the second would have caught these.

### Standing recommendation

Do not treat a single-reviewer pass as a panel, and do not read "7 confirmed, 0 refuted" as
evidence that the plans are now correct - it is evidence that this reviewer's findings were real.
Findings not raised remain unexamined.
