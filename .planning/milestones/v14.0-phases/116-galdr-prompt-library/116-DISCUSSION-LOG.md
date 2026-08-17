# Phase 116: Galdr Prompt Library - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 116-galdr-prompt-library
**Areas discussed:** Read-endpoint auth, Lookup & save semantics, Variable fill-in contract, Versioning & retention

---

## Read-endpoint auth

**Q: How should the /galdr skill read a prompt body out of Convex?**

| Option | Description | Selected |
|--------|-------------|----------|
| GET + new galdr key | `GET /galdr/prompt?slug=`, guarded by a new `GALDR_API_KEY` validator alongside the two in `ingestAuth.ts:76,96`. A leaked galdr key cannot write telemetry. | ✓ |
| GET + existing ingest key | Reuse `validateIngestAuth`. No new secret, but widens that key from write-only-telemetry to reading the prompt library. | |
| POST /galdr/query | Stay inside the all-POST shape (only `/health:37` is GET today). No new route-method precedent. | |

**Q: Should reading and writing share a key?**

| Option | Description | Selected |
|--------|-------------|----------|
| One galdr key, both | Simplest to configure across machines; holders are Larry's own CLI sessions only. | ✓ |
| Separate read / write keys | More correct scoping, two secrets to sync across `.claude`, `.claude-alt`, laptop. | |
| You decide | Defer to the planner. | |

**Q: What should /galdr do when Convex is unreachable?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fail loudly, no cache | Preserves the "zero sync, live fetch" property exactly — never a stale second copy. | ✓ |
| Cache last-fetched locally | Offline use, but reintroduces the sync problem the design rejected. | |
| Fail, but list cached slugs | Middle ground; refuses stale bodies but can still enumerate. | |

**Q: Should the /galdr routes be browser-reachable?**

| Option | Description | Selected |
|--------|-------------|----------|
| Agent/CLI only, no CORS | No OPTIONS, no allowlist. Browser writes use the Clerk-authed mutation path (design §3). | ✓ |
| CORS like other ingest | Pair each route with OPTIONS + allowlist, matching 20+ existing ingest pairs. | |

**Notes:** This is CodePulse's first authenticated *read* endpoint — worth flagging to reviewers, since both the GET method and the absent OPTIONS pairing are deliberate departures from a 56-route convention, not oversights.

---

## Lookup & save semantics

**Q: `/galdr <search terms>` matches 3 prompts. What should the skill do?**

| Option | Description | Selected |
|--------|-------------|----------|
| List, wait for pick | Show matches and stop until a choice is made; never injects on a fuzzy match. | ✓ |
| Auto-pick best match | Rank exact-slug → title → body, tie-break on usageCount. One less turn, silent wrong-pick risk. | |
| Exact slug only | Fuzzy search becomes list-only; injection requires an exact slug. | |

**Q: `/galdr-save <title>` collides with an existing slug.**

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse, show the existing | Server rejects with the existing title/updatedAt; nothing silently overwritten. | ✓ |
| Auto-suffix -2 | Never blocks, but accumulates near-duplicates that make search noisy. | |
| Update as new version | Treat as an edit and snapshot. Convenient when intended, dangerous when accidental. | |

**Q: Where does the galdr skill get installed?**

| Option | Description | Selected |
|--------|-------------|----------|
| Both roots + laptop sync | Cover `.claude`, `.claude-alt`, and the laptop — stranded state in one root is a known repeat failure. | ✓ |
| Primary .claude only | Single install, fewer copies to drift. | |
| You decide | Let the planner match existing cross-root skills. | |

**Q: How much does the skill do beyond fetch-and-inject?**

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch, fill, inject, bump | Exactly the design doc §4.1 surface, including `/galdr-save`. | ✓ |
| Add browse/search subcommands | `--category`, `--recent`, `--favorites` as first-class flags. | |
| Minimal: fetch + inject only | Smallest phase, but breaks the design's stated gate. | |

**Notes:** The install answer was refined by a live check *after* the choice, and the refinement mattered. `.claude-alt\skills` turned out to be a **Junction** to `.claude\skills`, so "both roots" costs nothing and a second copy would be the same directory. The laptop half is the real work: `.gitignore:72` ignores `skills/` wholesale (131 dirs on disk, 9 force-added), so galdr needs `git add -f`.

---

## Variable fill-in contract

**Q: How should the skill resolve `{{variables}}`?**

| Option | Description | Selected |
|--------|-------------|----------|
| Args, then ask for gaps | `key=value` args fill what they can; skill asks only for what remains. | ✓ |
| Always ask each one | Most predictable, tedious on repeat use. | |
| Infer from conversation | Fewest keystrokes; risks confidently filling from unrelated context. | |

**Q: A variable is still unfilled at injection time.**

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse to inject | Hard stop naming the missing variables. | ✓ |
| Inject literal `{{name}}` | Model usually notices — but not always, and an unnoticed one is invisible in the output. | |
| Treat as optional | Substitute empty string. Only sane if variables are garnish, not inputs. | |

**Q: Must the UI Copy dialog require every variable?**

| Option | Description | Selected |
|--------|-------------|----------|
| Require all, mirror skill | Same contract everywhere, so a prompt behaves identically wherever used. | ✓ |
| Allow partial copy | Placeholders come along literally; diverges from the skill's rule. | |
| Two buttons | "Copy filled" and "Copy raw" — covers both intents explicitly. | |

**Q: Should send-to-Chat resolve variables first?**

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve, then send | Only a fully-resolved body reaches `Chat.tsx:517`. | ✓ |
| Send raw, let her ask | The autoSend path fires immediately, so she'd answer a half-formed prompt before asking. | |
| Prefill without auto-send | Editable before sending; needs a new flag on the handoff shape. | |

**Notes:** These four are one contract rather than four independent picks — fully resolved or nothing happens, on every surface.

---

## Versioning & retention

**Q: Should `prompts` get a RETENTION_DAYS entry?**

| Option | Description | Selected |
|--------|-------------|----------|
| Exempt, documented | A curated library is not a firehose; a 90-day window would delete unused prompts. Needs an inline WHY comment. | ✓ |
| Only archived age out | Live prompts never expire, archived rows prune. Adds a conditional the cron doesn't do today. | |
| Long window, e.g. 3650d | Satisfies the rule mechanically; arguably fiction dressed as a bound. | |

**Q: How should `promptVersions` be bounded?**

| Option | Description | Selected |
|--------|-------------|----------|
| Cap N per prompt | Newest ~20 per prompt, pruned on write. Bounds by the real growth driver. | ✓ |
| RETENTION_DAYS only | Reuses the existing cron with no new code, but ages out old prompts' entire trails. | |
| Both: cap + TTL | Strictest; two mechanisms to reason about and test. | |

**Q: What creates a snapshot?**

| Option | Description | Selected |
|--------|-------------|----------|
| Every body change | UI save, `/galdr-save` update, restore. Complete append-only trail. | ✓ |
| Explicit save-version only | Fewer rows, holes exactly where you edited without thinking. | |
| Change + meaningful diff | Skips no-op saves; slightly more mutation logic. | |

**Q: What does deleting a prompt do?**

| Option | Description | Selected |
|--------|-------------|----------|
| Archive only, no hard delete | `archived: true`, hidden everywhere, versions retained. Matches the house archive-don't-rm rule. | ✓ |
| Archive + explicit purge | Type-to-confirm purge as a second action (the `DeleteSkillDialog` pattern). | |
| Hard delete with confirm | Simplest model, nothing to recover from. | |

**Notes:** The retention question was posed only after reading `convex/retention.ts` and confirming the pre-emptive-bounding rule is real and repeatedly applied (`gatewayQuotaSnapshots: 30`, `toolPolicyEvents: 90`, Phase 108's pair). Larry's answer makes `prompts` a deliberate, argued exception — which is why the inline comment is a deliverable rather than a nicety.

---

## Claude's Discretion

- Category model — plain string field vs a `skillCategories`-style table with overrides.
- `usageCount` semantics — whether listing or copying counts as a use, or only injection.
- Nav placement and Lucide icon within the `COMMAND` group.
- Whether to seed starter prompts or begin empty.
- Naming hygiene against the pre-existing, unrelated `promptSubmissions` table.

## Deferred Ideas

- Forge prompt-picker in the session composer (needs Forge Phase 23; tracked in forge's ROADMAP).
- Ástríðr `galdr_lookup` tool (astridr SEED-028, v29).
- Richer skill flags (`--category`, `--recent`, `--favorites`).
- Hard delete / purge for prompts.
- Separate read vs write keys.
