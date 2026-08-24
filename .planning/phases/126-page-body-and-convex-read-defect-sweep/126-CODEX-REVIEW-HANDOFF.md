# 126 — Codex adversarial review, verified findings

**Written:** 2026-08-24 18:44 by session `mandr-3d [164dca]` (a different session from the one
generating these plans). Nothing in this phase directory was edited. This file is inbound review
feedback only — act on it or reject it, but it is not a plan artifact and no GSD verb owns it.

Three Codex adversarial reviews fired during plan generation. I verified all seven findings against
the live files. **Three confirmed, two refuted, two duplicates.** The first two reviews are below;
the third review's one new finding is appended at the end.

---

## CONFIRMED #1 — `126-PATTERNS.md:172` prescribes a boundary test that a correct implementation fails

Codex cited lines 153-156; the actual line is **172**. The substance holds.

The document prescribes the `CAP + 1` truncation idiom in two places:

`126-PATTERNS.md:102-103`
```
For D-03: `.withIndex("by_itemType", q => q.eq("itemType", "held")).take(HELD_COUNT_SCAN_CAP + 1)`,
then `{ count: Math.min(rows.length, CAP), truncated: rows.length > CAP }`. Reuse `2000` verbatim
```

`126-PATTERNS.md:618-619`
```typescript
const rows = await ctx.db.query(TABLE).withIndex(IDX, (q) => q.eq(FIELD, VALUE)).take(CAP + 1);
return { ...derive(rows.slice(0, CAP)), truncated: rows.length > CAP };
```

But the test spec says:

`126-PATTERNS.md:172`
```
- `truncated: true` at exactly `HELD_COUNT_SCAN_CAP` rows, `false` at `CAP - 1` (both boundary
  sides, per the "control that could have come out the other way" discipline).
```

Under `rows.length > CAP`, exactly CAP rows yields `truncated: false`. The spec demands `true`.
An implementation that follows lines 102-103 correctly will FAIL the test at line 172.

**Why it happened:** line 83 quotes the `alerts.ts` analog, which uses the older
`truncated: active.length === ALERT_COUNT_SCAN_CAP` form — under `=== CAP`, `true` at exactly CAP
IS correct. Lines 57-58 explicitly reject that form in favour of `CAP + 1`. The test spec was
written against the analog instead of the prescribed deviation.

**Suggested fix:** rewrite line 172 as `truncated: false` at exactly CAP, `true` at CAP + 1, and
separately assert the DB read limit is `CAP + 1`. Both boundary sides are still covered, so the
"control that could have come out the other way" discipline the line invokes is preserved.

**Check downstream:** plans 126-01 and 126-03 may already have been generated from line 172.
Grep the plan set for the CAP boundary assertion before executing.

---

## CONFIRMED #2 — all 12 cron catalog rows open an edit sheet that can never save

`126-03-PLAN.md:128-134` defers the label-vs-expression split under the heading "What is
deliberately NOT fixed, and why, so it is not read as an oversight." That framing is fair — this
is a scope decision, not a blind spot, and Codex was wrong to call it an oversight.

But the consequence is worth one more look, because it is cheaper to fix than the plan assumes.

Traced end to end in live code:

```
src/lib/cronSchedules.ts:11         interval: "Every 5 min"        <- human label, all 12 rows
src/pages/Automation.tsx:41-44      expression: s.interval         <- label into a field named `expression`
src/pages/Automation.tsx:123        onEdit={(job) => { setEditJob(job); setSheetOpen(true); }}
src/components/CronSheet.tsx:31     initialExpression={editJob?.expression}
src/components/CronBuilder.tsx:39   if (parts.length !== 5) return "custom";   <- "Every 5 min" = 3 parts
src/components/CronBuilder.tsx:77   customExpr = initial
src/components/CronBuilder.tsx:86   isValid = isValidCron(customExpr)
src/components/CronBuilder.tsx:87   canSave = name.trim().length > 0 && isValid
src/components/CronBuilder.tsx:281  disabled={!canSave}
```

The real regex from `src/lib/cronToHuman.ts:26` run against every distinct catalog interval:

```
regex source: /^(\*|[0-9]{1,2})(\/[0-9]+)?( (\*|[0-9]{1,2})(\/[0-9]+)?){4}$/

false  "Every 5 min"      false  "Every 1 min"     false  "Every 2 min"
false  "Every 1 hour"     false  "Every 10 min"    false  "Every 15 min"
false  "Daily"            false  "Daily 03:00 UTC" false  "Daily 03:15 UTC"
false  "Daily 03:30 UTC"
--- control ---
true   "*/5 * * * *"      true   "0 3 * * *"
```

The control fires, so the falses are real. Every catalog row reaches `canSave = false` and the
Save button is disabled. The plan's display-only guard removes the visible "Invalid expression"
text but leaves the click path intact — a dead workflow that now looks healthier than it is.

**Third option the plan did not consider:** if catalog rows are not editable, HIDE or disable the
edit affordance on those rows rather than shipping a click path that cannot complete. That is a
small, in-scope change — it does not require re-shaping `CronJob` or touching the
`cron.trigger`/`cron.create` dispatch to Astridr, which is what 126-03 correctly declined to do.

Cross-reference: this is the same failure shape as memory
[[hardcoded-label-outlives-the-query-it-describes]] — a human-facing label sitting in a field whose
name promises machine semantics, with a downstream consumer trusting the name.

---

## REFUTED #1 — "126-05 is absent from the working tree"

Codex's premise was true when it ran and false minutes later. It raced the generator.

```
21031 Aug 24 18:29  126-01-PLAN.md
30392 Aug 24 18:32  126-02-PLAN.md
26954 Aug 24 18:35  126-03-PLAN.md
22526 Aug 24 18:37  126-04-PLAN.md
25006 Aug 24 18:40  126-05-PLAN.md   <- written AFTER the review
22501 Aug 24 18:43  126-06-PLAN.md
```

The writer to reader dependency Codex asked for is already declared:

```
--- 126-02-PLAN.md ---        --- 126-05-PLAN.md ---
5:wave: 1                     5:wave: 2
6:depends_on: []              6:depends_on: ["126-02"]
```

Wave 2 runs after wave 1, so writer to reader ordering is enforced by the wave scheduler.

The interim broken window is real but deliberate and documented at `126-02-PLAN.md:293-295`, which
instructs the executor to record it in the SUMMARY. Codex's "retain dual writes" alternative only
matters if wave 1 and wave 2 deploy separately to production rather than in one phase execution.

The integration coverage Codex says is missing is assigned to a plan that did not exist yet:
`126-05-PLAN.md:328` names plan 126-08 as the one that proves each reassembly guard FIRES using
out-of-order and gapped fixtures.

---

## REFUTED #2 — "the schema section makes the sequence index optional"

Codex claimed `126-PATTERNS.md:197-199` says the index is needed only "if ordered/unique-per-seq
lookups are needed." That wording does not exist in the file:

```
$ grep -n "if ordered\|unique-per-seq\|are needed" 126-PATTERNS.md
NO MATCH

$ grep -n "must actually be" 126-PATTERNS.md          <- control, proves the grep works
219:**Unlike `forgeLogChunks`, the new table's `by_snapshot_version_seq`-style index must actually be
```

Three places carry the requirement, all imperative:

```
 28: read must sort explicitly on `seq` via a dedicated index (e.g. `by_snapshot_version_seq`)
219: must actually be used to ORDER the read
317: sort explicitly on `seq`
```

Lines 197-212 are a QUOTATION of the existing `forgeLogChunks` table, included as the
counter-example. Its `by_host_job_seq` comment says "NOT used to order any read in this repo,"
which is a factual note about existing code, not guidance for the new table. Codex read the
counter-example as the instruction. Line 194 guards against exactly that: "This is a table-SHAPE
precedent only."

No action needed. The document is already right, and emphatically so.

---

## Note on review timing

At 18:43 the generator was still producing plans and the set still forward-references `126-06`,
`126-08` and `126-09`. Two of Codex's four findings were artifacts of reviewing a half-written plan
set. Worth re-running the adversarial review once generation completes rather than treating this
round as the verdict.

---

# Third review (18:47) — one new finding, CONFIRMED

A third Codex review fired. Two of its three findings restate ones already covered above (the dead
cron edit path; the missing 126-08/126-09 plans). The third is new and is the strongest finding of
the seven so far.

## CONFIRMED #3 — the documented backfill fallback would silently drop every source but the last

`126-05-PLAN.md:282-286` tells the executor to record, in a doc comment and the SUMMARY, that if
the reconstructed mutation exceeds Convex's argument-size limit the fallback is "splitting the
ingest into per-source calls."

That fallback is unsafe against the live contract:

```
convex/graphSnapshots.ts:92    const newVersion = (existing?.activeVersion ?? 0) + 1;
convex/graphSnapshots.ts:153     activeVersion:   newVersion,
```

Each `upsertGraphSnapshot` call creates a COMPLETE new version and flips `activeVersion` to it. It
does not merge into the prior version. N per-source calls therefore produce N versions, each
holding one source, with `activeVersion` pointing at the last. The final active snapshot contains
only the last source and the rest are silently gone — no error, no partial-write signal.

The plan is careful to frame this as "flag, do not guess" rather than an instruction to implement.
That does not defuse it: the text lands in a doc comment next to the recovery command, which is
exactly where an operator looks while a migration is failing. A documented fallback is read as a
sanctioned one.

**Suggested fix:** either delete the fallback sentence outright and let 126-09 own the
argument-limit question with no pre-authorised recovery path, or replace it with a staged protocol
that accumulates all sources under ONE target version and flips `activeVersion` only after every
source is written. If the staged form is documented, it needs a forced multi-source migration test
asserting the final graph contains every source.

Same shape as memory [[hardcoded-label-outlives-the-query-it-describes]]: guidance written next to
a mechanism, describing behaviour the mechanism does not have.
