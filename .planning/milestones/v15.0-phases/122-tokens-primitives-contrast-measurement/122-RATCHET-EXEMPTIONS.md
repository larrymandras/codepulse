# 122-17 Ratchet Exemptions — narrative record

This is the prose behind each `KNOWN_EXEMPT` entry in `src/tokenSweep.ratchet.test.ts`. The test
file cross-references this document by row; this document exists so the test file's
`KNOWN_EXEMPT` block can stay short while the full reasoning stays available and checkable.

Per D-25: this is a **record**, not a blessing. Every entry below is traceable to a specific row
in a specific ledger this phase's sweep plans actually produced. If a file starts failing the
ratchet and does not appear here, the correct response is to fix the file — never to add a row to
this document as a way of making the ratchet pass. That instruction is followed literally in this
plan's own history: building this ratchet's corpus derivation surfaced 8 real, previously-unswept
violations across 8 files (`src/lib/eventIcons.ts`, `ChannelHealthPanel.tsx`,
`CostBreakdownTable.tsx`, `GovernorDecisionLog.tsx`, `ModelPricingAdmin.tsx`,
`forge/ForgeMetadataPanel.tsx` (6 sites), `kg/KGDetailsPanel.tsx`, `skills/vault/SkillRecencyView.tsx`)
that no phase-122 sweep plan (122-04 through 122-16) had ever touched, because none of them lived
under those plans' `files_modified` lists. Every one was fixed, not exempted — see
122-17-SUMMARY.md's Deviations section for the full account. Zero entries below are the product of
"add an exemption to make a red test go green."

---

## `src/pages/Chat.tsx` — PageHeader bucket

**Status: Exempt** (a genuine design decision, not deferred work).

**Ledger:** `122-PAGEHEADER-ADOPTION.md`, "Named exemption register", row 1 (`Chat.tsx:928`).

**Reason:** `/chat` is a full-bleed presence view, not a dashboard page. The `<h1>ÁSTRÍÐR</h1>` at
`:928` is an 11px-scale mono brand wordmark (`font-mono font-bold tracking-[0.15em] text-base`)
sitting inside a voice/avatar status row (`border-b border-border`, alongside a live
listening-state line) — not a page title competing with the content below it. There is no "page"
in the dashboard sense for `PageHeader` to head. `122-CONTEXT.md` D-18 predicted this as the
likely genuine exemption case before the corpus was measured, and the measurement confirmed it.

**Re-check command:**
```bash
git grep -lF 'PageHeader' -- src/pages/Chat.tsx   # expect: no match
sed -n '920,935p' src/pages/Chat.tsx              # confirm the wordmark's actual context
```

---

## `src/pages/ForgePage.tsx` — PageHeader bucket

**Status: Deferred, not exempt** (recorded as an exemption entry here only because the ratchet
needs a binary pass/fail today; the underlying position is that this page SHOULD adopt
`PageHeader` and currently does not).

**Ledger:** `122-PAGEHEADER-ADOPTION.md`, "Named exemption register", row 2 (`ForgePage.tsx:151`).

**Reason:** `ForgePage.tsx:151` hand-rolls the identical visual shape `PageHeader` produces — its
own comment says so ("standard CodePulse pattern (BuildProgress.tsx:24)") — and is convertible.
It was NOT converted during Phase 122: it sits outside every wave-4 sweep plan's `files_modified`
list (122-08 touched only a `duration-NNN` motion class at `:175` in the same file, never the
header block), and a straight substitution would double the vertical spacing above the
master-detail body (`PageHeader` bakes in `mb-4`; `ForgePage`'s current header carries none,
relying entirely on the parent's `space-y-4`).

**Follow-up:** `.planning/todos/pending/forgepage-pageheader-adoption.md` carries the exact
conversion and a visual-regression check for a future plan to pick up. When that todo lands, this
exemption entry must be REMOVED from `src/tokenSweep.ratchet.test.ts`, not left in place — an
exemption whose underlying reason has been resolved is a blessing, not a record.

**Re-check command:**
```bash
git grep -lF 'PageHeader' -- src/pages/ForgePage.tsx   # expect: no match, until the todo lands
cat .planning/todos/pending/forgepage-pageheader-adoption.md
```

---

## Buckets with zero exemption entries (deliberate, not an oversight)

Re-derived at the time this file was written (`2026-08-19`, after the 122-17 fix commit):

| Bucket | Corpus-wide hits (non-test `src/`) | Why zero exemptions |
|---|---|---|
| palette | 0 | Every one of the five sweep slices (122-04..08) drove its own file list to 0/0/0/0; nothing survived that needed an exception rather than a conversion. |
| hex | 0 | Every genuinely data-driven hex value in this repo (chart series colours, category legends) is consumed via a plain JS `style={{ backgroundColor }}` prop or a bare `Record<string,string>` map, never a `bg-/border-/text-[#...]` Tailwind class literal — so it never matches this bucket's regex in the first place. There is nothing to exempt because there is nothing the pattern can see that isn't a real violation. |
| duration | 0 | "None expected" per `122-CONTEXT.md`'s own D-25 table — confirmed live. |
| violet | 0 | D-08's adjudication converted every raw violet site in the corpus to `var(--astridr)`, `--primary`, `--status-*`, or a neutral/indigo re-hue — by design, nothing should ever remain raw. The one shadow-glow exception (`SwarmTaskNode.tsx`) is outside every bucket's regex shape (see the test file's own header comment, scope limitation 1) and needs no exemption entry because this ratchet structurally cannot see it. |
| loading | 0 | 122-15/122-16 converted every bare `>Loading` JSX text node to a shaped `LoadingState`/skeleton. |
| emdash | 0 | 122-15/122-16 converted every value-slot em-dash placeholder found by their own scoped sweeps, and this plan's own corpus-wide re-derivation (Task 1) found and fixed 9 further sites those sweeps had missed (see the Deviations section of 122-17-SUMMARY.md). The one remaining `"—"` corpus hit (`src/components/chat/RadialGauge.tsx:11`) is a JSDoc sentence *quoting* the character in prose, not a rendered placeholder — excluded by the bucket's comment-line filter, not by a `KNOWN_EXEMPT` entry, since it was never a violation to begin with. |

An empty `KNOWN_EXEMPT` set for five of the ratchet's six buckets is the intended end state — the
phase's stated success criterion is "every route/component/hex site/motion site/violet site" with
NO exceptions in five of the six categories, and the sixth (`pageheader`) carries exactly the two
named, checkable rows above.
