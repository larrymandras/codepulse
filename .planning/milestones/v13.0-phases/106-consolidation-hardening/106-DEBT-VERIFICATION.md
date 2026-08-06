# Phase 106 — Debt Verification (DEBT-01 / DEBT-02)

**Session:** 2026-08-04 · Plan 106-01 · Read-only verification, zero source files modified.

---

## DEBT-01 — Typed-api sweep (verify-and-close)

**Scope statement (D-06):** this sweep covers **codepulse only**. astridr-repo does not call CodePulse's Convex API object at all — it POSTs to CodePulse's HTTP ingest endpoints (`/ingest`, `/runtime-ingest`, `/reminders-ingest`, etc.), which is a different integration surface entirely (bearer-authed HTTP, not a typed `api.*` client). There is nothing in astridr-repo for this sweep to check.

### Step 1 — Raw hit count (generated code excluded)

Command:
```
grep -rn "anyApi" src convex --include=*.ts --include=*.tsx | grep -v "^convex/_generated/"
```

Verbatim output (3 hits):
```
convex/costBudgetEval.test.ts:406:    // Note: `internal.webhookDelivery.sendAlertWebhook` (convex's anyApi) is a
convex/costBudgetEval.test.ts:583:    // guard the identity-unstable anyApi Proxy (see the prior test's note)
convex/evalScores.test.ts:876:  // reference was passed) — comparing anyApi Proxy references captured
```

### Step 2 — Comment-filtered gate

Command:
```
grep -rn "anyApi" src convex --include=*.ts --include=*.tsx | grep -v "^convex/_generated/" | grep -vE ':[0-9]+:[[:space:]]*(//|\*|/\*)'
```

Output: *(empty)*
Exit status: `1` (grep found no matching lines — this is the expected PASS condition)

### Step 3 — Import-shaped gate

Command:
```
grep -rn "anyApi" src convex --include=*.ts --include=*.tsx | grep -v "^convex/_generated/" | grep -E "^[^:]+:[0-9]+:[[:space:]]*import|from \"convex/server\"|require\("
```

Output: *(empty)*
Exit status: `1` (no import-shaped hits — PASS)

### Step 4 — Type checker

Command: `npx tsc --noEmit`
Output: *(no output — clean)*
Exit code: `0`

### Step 5 — `src/pages/Ideation.tsx` spot-check

Import line (line 3):
```ts
import { api } from "../../convex/_generated/api";
```

Representative call site (line 32-33), showing the typed `api.<module>.<fn>` object, not an `anyApi`-derived reference:
```ts
const findings = useQuery(api.ideation.listFindings, { dismissed: false }) ?? [];
const stats = useQuery(api.ideation.findingStats);
```

Also present in the same file: `useMutation(api.tasks.create)`, `useMutation(api.ideation.updateFindingStatus)`, `useMutation(api.ideation.linkTask)` — every Convex call in this file routes through the typed `api` object.

### Classification of every step-1 hit

| file:line | verbatim line content | classification |
|---|---|---|
| `convex/costBudgetEval.test.ts:406` | `// Note: \`internal.webhookDelivery.sendAlertWebhook\` (convex's anyApi) is a` | comment |
| `convex/costBudgetEval.test.ts:583` | `// guard the identity-unstable anyApi Proxy (see the prior test's note)` | comment |
| `convex/evalScores.test.ts:876` | `// reference was passed) — comparing anyApi Proxy references captured` | comment |

Zero rows classify as `real usage`. Zero rows classify as `generated` (the generated file itself was already excluded by the `^convex/_generated/` filter, and none of the 3 hits land there anyway).

### Source-file diff check

`git status --porcelain src convex` — empty, confirmed before writing this artifact. This task modified no source file.

VERDICT: PASS — 0 real `anyApi` usages (3 raw hits, all comments), `tsc --noEmit` clean (exit 0), scope = codepulse only.

---

## DEBT-02 — Pre-flight reference sweep (D-03)

**Purpose:** confirm nothing in either repo functionally reads from or writes to cloud Convex `tidy-whale-981` before plan 106-03 exports and cancels it. Both repos swept: `C:\Users\mandr\codepulse` and `C:\Users\mandr\astridr-repo`.

### Pattern 1 — Deployment name `tidy-whale-981`

**codepulse** — command: `grep -rln "tidy-whale-981" .` (full-repo, non-node_modules), narrowed to non-`.git` paths.

Representative hits (full match list is long; every hit below is planning-doc/history, not application/runtime code):
```
.github/workflows/gitleaks-scan.yml:16:  CODEPULSE_INGEST_URL: https://tidy-whale-981.convex.site   <-- FUNCTIONAL, see below
docs/superpowers/specs/2026-07-19-reminders-calendar-command-center-design.md:107
.planning/MILESTONES.md:47,56,72,93
.planning/STATE.md:724
.planning/REQUIREMENTS.md:34
docs/proposals/human-in-the-doc-RUNBOOK.md:50,134
(plus additional .planning/ history references — all doc-only)
```
Zero hits in `src/` or `convex/` (application/runtime code) for this pattern.

**astridr-repo** — command: `grep -rln "tidy-whale-981" .`

Hits fall into three buckets:
1. **FUNCTIONAL — CI workflows** (see "Deploy/CI surfaces" below for full detail):
   - `.github/workflows/gitleaks-scan.yml:16`
   - `.github/workflows/supabase-migration-check.yml:15`
   - `.github/workflows/kg-benchmark.yml:246`
2. **FUNCTIONAL-ADJACENT — one runtime default value**:
   - `astridr/channels/web.py:973` — `prod_origin = os.environ.get("CODEPULSE_ORIGIN", "https://tidy-whale-981.convex.site")` — a CORS allow-list **fallback default** for the `CODEPULSE_ORIGIN` env var. This governs which origins astridr will accept browser requests *from*; it is not astridr *reading data from* tidy-whale-981. If `CODEPULSE_ORIGIN` is explicitly set in the deployed environment (which it should be, pointing at the real Vercel/prod frontend origin), this fallback is never exercised. The live value of `CODEPULSE_ORIGIN` lives in `.env` (astridr-repo), which is hook-blocked from reading — see the `.env*` manual-check list below.
3. **Test fixtures (monkeypatched, not live)**: `tests/test_langfuse_eval.py`, `tests/tools/test_reminders.py`, `tests/automation/test_reminder_nudge.py`, `tests/unit/engine/bootstrap/test_cron_dispatcher.py`, `tests/unit/channels/test_web_cors.py`, `tests/unit/automation/test_focus_digest.py` — each sets `_CONVEX_URL`/`CODEPULSE_ORIGIN` to a `tidy-whale-981` string via `monkeypatch.setattr`/`setenv` purely as a test double; none of these run against the real deployment.
4. **`.env.example`** (astridr-repo) — lines 60/69/71 document `CODEPULSE_URL`/`CODEPULSE_ORIGIN` defaults as `https://tidy-whale-981.convex.site`. This is a committed example/template file (not the real `.env`), readable and confirmed to contain no secret — it documents what the *default* was, not what the live deployment currently uses.
5. Extensive `.planning/` phase-history references (Phases 96, 98, 180, 128, 133, 149, 157, and others) — all doc-only, describing past deploys or research notes, not live code paths.

### Pattern 2 — Cloud Convex hostnames `convex.cloud` / `convex.site`

**codepulse** — command: `grep -rn "convex\.cloud|convex\.site"` (repo-root, node_modules excluded).

Real/functional hits, beyond the tidy-whale-981 CI reference already logged above:
- `.env.example:1` — `VITE_CONVEX_URL=https://your-deployment.convex.cloud` — a **placeholder example**, not a real deployment slug.
- `src/main.tsx:12` — `const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);` — reads the URL from the build-time env var; **the actual runtime value is whatever `VITE_CONVEX_URL` resolves to at build time** (from `.env.local` locally, or the Vercel project's env var config in prod). Neither is machine-readable here (`.env.local` is hook-blocked; Vercel dashboard is outside this sweep's reach) — flagged as a manual check below.
- `src/pages/Settings.tsx:33-34,444` — same `VITE_CONVEX_URL` read, used only to display the deployment slug in the Settings UI (no independent connection).
- Everything else matching this pattern is `.planning/`, `docs/`, or `convex/*.test.ts` comment-only references (documentation/history, not live code).

**astridr-repo** — command: `grep -rn "convex\.cloud|convex\.site"`.

Real/functional hits:
- `astridr/channels/web.py:973` — already logged under Pattern 1 (CORS fallback default).
- `astridr/channels/war_room/dispatcher.py:42-43`, `astridr/channels/war_room/agents/base_norse_agent.py:34`, `astridr/integrations/langfuse_eval.py:25` — each reads `_CONVEX_URL = os.environ.get("CONVEX_URL", "")` — **empty-string default, not a cloud URL fallback**. Confirmed by reading the surrounding code: these deliberately no-op/skip emission when `CONVEX_URL` is unset, rather than falling back to any hardcoded cloud host. Not a cloud-Convex reader.
- `astridr/tools/reminders.py:49`, `astridr/automation/focus_digest.py:48`, `astridr/automation/reminder_nudge.py:74` — each resolves `_CONVEX_URL = _CP_URL or _LOCAL_URL`, where `_LOCAL_URL = os.environ.get("CONVEX_URL", "")` (empty default) and `_CP_URL = os.environ.get("CODEPULSE_CONVEX_URL", "")` (empty default, explicitly documented as "leave it UNSET for the normal all-local setup"). No cloud fallback. Confirmed by reading the file headers: `CONVEX_URL` is meant to resolve to the **local self-hosted** backend (`http://convex-backend:3211`, per `docker-compose.yml`), not cloud.
- `hooks/codepulse-hook.mjs`, `hooks/README.md`, `hooks/install.mjs`, `hooks/scanner.mjs`, `hooks/test-connection.mjs` — these fall back to `https://ideal-sandpiper-297.convex.site` when auto-detection from `.env.local` fails. **This is a different Convex deployment slug than `tidy-whale-981`** — out of scope for this specific DEBT-02 sweep (which targets tidy-whale-981's retirement), but flagged here as a side-finding: an apparently separate/possibly-stale cloud Convex deployment (`ideal-sandpiper-297`) is referenced as a fallback default in these Claude-Code-hook connector scripts. Not investigated further — record only.
- `docker-compose.yml:44,391` — `CONVEX_URL: ${CONVEX_URL:-http://convex-backend:3211}` — self-hosted default, **not** a cloud URL. Confirmed clean.
- Remaining hits are test fixtures (`tests/unit/foundation/test_telemetry.py`, `tests/integration/test_tier2_wiring.py` — all use `example.convex.cloud`/`codepulse.convex.site` placeholder strings for unit-test doubles, never a real deployment) or `.planning/`/`docs/` history.

### Pattern 3 — `VITE_CONVEX_URL` / `CONVEX_DEPLOYMENT`

**codepulse:**
- `src/main.tsx:12` — `import.meta.env.VITE_CONVEX_URL` — build-time variable reference, not a literal. **Actual value unknown from this sweep** (see manual-check list).
- `src/pages/Settings.tsx:33-34` — same variable reference, display-only.
- `.env.example:1` — literal placeholder `https://your-deployment.convex.cloud` (not real).
- `.env.local` — exists, hook-blocked, cannot be read (see manual-check list).
- `CLAUDE.md:94` — documents `VITE_CONVEX_URL` as "Required. Convex deployment URL." (doc, not a value).
- All other hits are `.planning/` history/plan text discussing this variable, not live values.

**astridr-repo:** No `VITE_CONVEX_URL` (astridr-repo has no Vite frontend) and no `CONVEX_DEPLOYMENT` literal-value hits in application code — only `.planning/` history references discussing codepulse's own env var by name (e.g. `157-RESEARCH.md:267`, which itself states "CodePulse runs against cloud Convex (`VITE_CONVEX_URL` in `.env.local`)" — this is a **doc-only claim in a later astridr-repo research file** that has not been re-verified against current reality; flagged alongside the AVATAR-HANDOFF.md stale claim below, same class of issue).

**Conclusion for Pattern 3:** the one variable that would definitively answer "does prod read cloud Convex" — `VITE_CONVEX_URL`'s actual resolved value — sits in a hook-blocked `.env.local` file locally, and in Vercel's dashboard env-var config for the deployed site (outside this sweep's reach entirely; no Vercel CLI/API call was made, per D-01's instruction that prod verification is not required before planning). This is the load-bearing unresolved item — see Manual Checks below and the VERDICT.

### Pattern 4 — Deploy/CI surfaces

| File | Exists in codepulse? | Exists in astridr-repo? | Names a cloud Convex target? |
|---|---|---|---|
| `vercel.json` | Yes | No | No — build/rewrite/headers config only, no env vars, no Convex reference of any kind. |
| `.github/workflows/**` | `ci.yml`, `gitleaks-scan.yml` | `eval-net.yml`, `gitleaks-scan.yml`, `kg-benchmark.yml`, `supabase-migration-check.yml` | **YES — functional.** codepulse's `gitleaks-scan.yml` and all three of astridr-repo's `gitleaks-scan.yml` / `kg-benchmark.yml` / `supabase-migration-check.yml` hardcode `CODEPULSE_INGEST_URL: https://tidy-whale-981.convex.site` and POST live `runtime-ingest` telemetry events to it — codepulse's on every push/PR to master, astridr-repo's on every push/PR (gitleaks) plus a **daily 7:00 AM UTC cron** (supabase-migration-check) plus its own push/PR/dispatch triggers (kg-benchmark). `ci.yml` (codepulse) and `eval-net.yml` (astridr-repo) have no Convex reference. |
| `netlify.toml` | No | No | N/A |
| `convex.json` | Yes (codepulse only — astridr-repo has no Convex functions dir) | No | No — `{"functions": "convex/"}` only, no deployment/URL reference. |
| `package.json` scripts | Yes | No `package.json` (Python project) | codepulse's `deploy` script (`npx convex deploy && npx vite build`) targets **whatever deployment `npx convex` is currently configured against** (CLI-local `.env.local`/`CONVEX_DEPLOYMENT`, not a hardcoded slug in the script itself) — not a literal cloud reference, but the *effective* target depends on the same unresolved `.env.local` value as Pattern 3. |
| `Dockerfile` / `docker-compose*.yml` | Neither exists in codepulse | `Dockerfile` (no Convex reference — grepped, zero hits) and `docker-compose.yml` (2 hits, both `CONVEX_URL: ${CONVEX_URL:-http://convex-backend:3211}` — self-hosted default) | No — astridr-repo's Docker config defaults to the local self-hosted backend, not cloud. |

**Forge daemon config check:** searched `astridr/` and any `.forge`/daemon config files in astridr-repo for `convex` references. No dedicated Forge command-bridge daemon directory or config file was found inside astridr-repo itself (`find . -iname "*forge*"` at repo root returns nothing beyond unrelated `/tmp/forge-test-*` ephemeral test scratch dirs from an unrelated prior test run, and a targeted grep of `.forge`/`astridr/**forge**` for `convex` returned zero hits). The `hooks/` directory (Claude-Code-hook connector scripts, not the Forge command-bridge daemon documented in `codepulse/CLAUDE.md`'s v7.0 history) is covered above under Pattern 2 with its own separate deployment slug (`ideal-sandpiper-297`, not `tidy-whale-981`). **If a separate Forge daemon repository exists outside the two repos swept here, it is unreachable by this sweep — flagged for Larry to check independently before 106-03 runs**, per D-03's "check both codepulse and astridr-repo" instruction not covering a third location.

### Pattern 5 — `.env*` files (un-sweepable surface)

Per the env-file-guard hook, `.env`/`.env.local` and siblings cannot be read by any tool available here (Read/Write/Edit and Bash `cat`/`source` are all blocked). `.env.example` files ARE readable (no secrets by convention) and were read directly above. Every `.env*` file that **exists** in either repo:

| Path | Readable? | Status |
|---|---|---|
| `C:\Users\mandr\codepulse\.env.example` | Yes — read directly, contains only placeholder `your-deployment.convex.cloud`, no `tidy-whale-981` literal. | Confirmed clean. |
| `C:\Users\mandr\codepulse\.env.local` | **No — hook-blocked.** | **MANUAL — PENDING LARRY**: open `C:\Users\mandr\codepulse\.env.local` and confirm no line's value contains `tidy-whale-981`, `.convex.cloud`, or `.convex.site` — specifically check `VITE_CONVEX_URL`. This is the single most load-bearing unresolved check in this whole sweep (see Pattern 3 conclusion). |
| `C:\Users\mandr\astridr-repo\.env` | **No — hook-blocked.** | **MANUAL — PENDING LARRY**: open `C:\Users\mandr\astridr-repo\.env` and confirm no line's value contains `tidy-whale-981`, `.convex.cloud`, or `.convex.site` — specifically check `CONVEX_URL`, `CODEPULSE_CONVEX_URL`, and `CODEPULSE_ORIGIN`. |
| `C:\Users\mandr\astridr-repo\.env.bak.20260730-173554` | **No — hook-blocked.** | **MANUAL — PENDING LARRY**: open and confirm no line's value contains `tidy-whale-981`, `.convex.cloud`, or `.convex.site`. (Backup file — likely stale, but un-sweepable, so listed rather than assumed clean.) |
| `C:\Users\mandr\astridr-repo\.env.bak.20260731-081147` | **No — hook-blocked.** | **MANUAL — PENDING LARRY**: same check as above. |
| `C:\Users\mandr\astridr-repo\.env.example` | Yes — read directly. Contains `CODEPULSE_URL=https://tidy-whale-981.convex.site` (line 60) and `CODEPULSE_ORIGIN=https://tidy-whale-981.convex.site` (line 71) as **documented example defaults** (matching the live fallback default in `web.py:973`). | Confirmed as expected — matches the code's own fallback, not a hidden extra reference. |

### AVATAR-HANDOFF.md — stale claim, doc-only

`.planning/AVATAR-HANDOFF.md` line 24 (verbatim):
> **Deployment:** CodePulse is live on **Vercel** at `https://codepulse-jade-omega.vercel.app` (Clerk-gated, `pk_test`). It reads **Convex** (cloud `tidy-whale-981`) + **Ástríðr** over **Tailscale** (`https://lmofficenew.tail5bb6b3.ts.net`, CORS-allowlisted). Ástríðr runs in Docker (`astridr-agent`). Pushes to master auto-deploy.

**Classification: doc-only, not a functional reader.** This file is dated 2026-07-08 (per its own header) and is a planning handoff doc, not application code or CI config — it makes no runtime call and gates no deploy. Per CONTEXT.md D-01 and this repo's Stale Docs rule, it is flagged here for correction by plan 106-03 (which owns the actual doc fix); this plan does not edit it.

**Second doc-only stale claim found during this sweep** (same class, in the *other* repo): `astridr-repo/.planning/milestones/v23.0-phases/157-live-uat-close/157-RESEARCH.md:267` states "CodePulse runs against cloud Convex (`VITE_CONVEX_URL` in `.env.local`)." This is a later research doc than AVATAR-HANDOFF.md, still asserting the pre-migration topology. Also doc-only — not application code, gates nothing — flagged here rather than corrected (out of this plan's scope; it lives in astridr-repo, which plan 106-03 does not own).

### Verdict

Two classes of finding change this from a clean "confirm and proceed" sweep to a **blocking finding that must reach Larry before 106-03 runs**:

1. **Three live CI workflows (one in codepulse, three in astridr-repo — `gitleaks-scan.yml` ×2, `kg-benchmark.yml`, `supabase-migration-check.yml`) POST real telemetry to `https://tidy-whale-981.convex.site/runtime-ingest` today**, on every push/PR to master plus a daily 7 AM UTC cron. This is a genuine **functional writer** to the cloud deployment, currently active — not documentation. Cancelling `tidy-whale-981` without first repointing or removing these `CODEPULSE_INGEST_URL` env values will make every one of these CI steps fail to deliver telemetry (most are written non-fatally — `|| echo "...non-fatal"` in gitleaks-scan.yml, and kg-benchmark.yml's telemetry step is explicitly NOT `continue-on-error`, meaning **that one would fail the job outright**).
2. **The one variable that would definitively prove or disprove "does prod CodePulse read cloud Convex" — `VITE_CONVEX_URL`'s actual resolved value — is not machine-readable** (`.env.local` hook-blocked; Vercel dashboard env vars outside this sweep's reach). D-01 says Larry is confident this is already repointed to self-hosted and that pre-verification is not required to *plan* the export — but this sweep cannot independently confirm it, and the `deploy` npm script's actual target has the identical unresolved dependency.

VERDICT (2026-08-04 — **SUPERSEDED**, see § DEBT-02 pre-flight amendment below): NO-GO — a functional writer to `tidy-whale-981` exists today (3 CI workflow files across both repos hardcoding `CODEPULSE_INGEST_URL`/telemetry POSTs), and the frontend's actual `VITE_CONVEX_URL` cannot be confirmed by this sweep (2 doc-only references, 5 manual `.env*` checks pending). Plan 106-03 must not run until: (a) Larry completes the 5 manual `.env*` checks above, and (b) the CI workflow `CODEPULSE_INGEST_URL` values are either repointed to the self-hosted deployment's ingest URL or the export/cancel plan explicitly accounts for updating them as part of its own scope.

No secret value appears anywhere in this artifact.

---

## DEBT-02 pre-flight amendment (2026-08-05)

The 2026-08-04 `NO-GO` above is superseded. It is retained verbatim because one of its two
load-bearing factual claims turned out to be **wrong**, and that matters more than the verdict
flip: it was asserted from a workflow's own inline comment rather than from the code path.

### Correction 1 — `kg-benchmark.yml` would NOT have hard-failed

The original verdict states that `kg-benchmark.yml`'s telemetry step is "explicitly not
`continue-on-error`, so it would hard-fail the job once tidy-whale-981 is cancelled."

**This is false.** The step's *step-level* `continue-on-error` is indeed absent, but that step
runs `scripts/kg_benchmark_ci.py`, and the exit code is the script's, not curl's:

- `scripts/kg_benchmark_ci.py:126` — `os.environ.get("CODEPULSE_INGEST_URL")`, documented
  `None => ConvexHandler local-only (D-11)`. An unset URL is a supported state, not an error.
- `scripts/kg_benchmark_ci.py:158-167` — the entire emit path, *including* `ConvexHandler`
  construction, sits inside `try/except Exception` whose handler only logs a warning
  (`# noqa: BLE001 — telemetry must never break the job`).
- `scripts/kg_benchmark_ci.py:178` — `sys.exit(0 if verdict == "pass" else 1)`, where `verdict`
  derives from RESULTS.json freshness plus the pytest exit code. Telemetry cannot reach it.

The original claim was taken from the step's inline comment. The comment's own next line
("Telemetry-send failures are non-fatal inside the wrapper (D-11)") already contradicted the
conclusion drawn from it. Per this repo's CLAUDE.md: comments are claims, not evidence.

The other three workflows each terminate their POST with `|| echo "CodePulse notification
failed (non-fatal)"`, so all four were non-fatal all along. **Cancelling `tidy-whale-981` would
not have broken a single CI job.** The real cost was always silent telemetry loss, not breakage.

### Correction 2 — `VITE_CONVEX_URL` is confirmed, and the one cloud reference is inert

The original verdict called this "the single most load-bearing unresolved check". It is resolved.
Larry supplied the contents of the hook-blocked `codepulse/.env.local` directly:

- `VITE_CONVEX_URL=https://lmofficenew.tail5bb6b3.ts.net` — the self-hosted tailnet host. **Not cloud.**
- `# CONVEX_SITE_URL=https://tidy-whale-981.convex.site` — present but **commented out, and provably
  inert**: every reader matches it with the `^`-anchored regex `/^CONVEX_SITE_URL\s*=\s*(.+)$/m`
  (`hooks/codepulse-hook.mjs:185`, `hooks/scanner.mjs:271`, `hooks/test-connection.mjs:32`), which
  a `# `-prefixed line cannot satisfy. `resolveUrl()` therefore falls through to `VITE_CONVEX_URL`
  (the tailnet) and the hardcoded `ideal-sandpiper-297` fallback at `hooks/codepulse-hook.mjs:193`
  is unreachable while that var is set.

`astridr-repo/.env` also confirmed clean: `CONVEX_URL=http://convex-backend:3211` (self-hosted),
`CODEPULSE_ORIGIN` pointing at the Vercel host, and no `CODEPULSE_CONVEX_URL` key at all.

### Gate conditions — disposition

**(a) The five manual `.env*` checks.** Two live files checked and clean (above). The remaining
two — `astridr-repo/.env.bak.20260730-173554` and `.env.bak.20260731-081147` — were **accepted
as low-risk without inspection**, on Larry's explicit decision (2026-08-05): they are inert
backup files loaded by no process, and the runtime question they existed to answer is already
settled by the live `.env` being clean. Recorded as an accepted residual, not as a passed check.
(Note: the original verdict says "5 manual checks" while its own table lists 4 hook-blocked
files; the count in the prose was off by one.)

**(b) CI workflows repointed or accounted for.** Repointing was found to be **impossible**, not
merely unattractive: `tailscale funnel status` on the office PC shows every published endpoint
marked `(tailnet only)` — nothing is exposed to the public internet — so GitHub-hosted runners
cannot reach the self-hosted backend without adding Tailscale auth to CI. Larry chose removal
over that. The dead telemetry is now gone from all four workflows:

- `astridr-repo` — commit `22027c71` (3 files; `gitleaks-scan.yml` −48, `supabase-migration-check.yml`
  −47, `kg-benchmark.yml` URL env line only, D-10 gate step deliberately preserved).
- `codepulse` — commit `7d4a0439` (`gitleaks-scan.yml`).
- `grep -rn "tidy-whale-981|CODEPULSE_INGEST_URL" .github/workflows/` returns zero hits in both
  repos; all four files re-validated as parseable YAML.

**Caveat, stated rather than glossed:** `22027c71` is on astridr-repo's `feature/brain-swap`
branch, not its default `origin/main`. GitHub runs `schedule:` triggers from the **default
branch**, so `supabase-migration-check.yml`'s daily 07:00 UTC cron will keep POSTing to the dead
host until that branch merges. This is harmless (non-fatal, per Correction 1) but it means the
cleanup is **not yet live on main**.

### Follow-up found during this amendment (reported, not fixed)

`astridr/channels/web.py:973` — `os.environ.get("CODEPULSE_ORIGIN", "https://tidy-whale-981.convex.site")`
defaults the CORS allowlist to the decommissioned host. Not reached in Larry's deployment
(`CODEPULSE_ORIGIN` is set explicitly), but any deploy relying on the default would allowlist a
dead origin. Out of scope here; flagged for a later phase.

### Amended verdict

Both original blocking conditions are resolved: no CI job can break on cancel (Correction 1,
plus removal), and the frontend provably reads the self-hosted backend (Correction 2). Plan
106-03 is cleared to run.

VERDICT: GO — superseding the 2026-08-04 NO-GO. Cleared on evidence, not on re-running the sweep.

No secret value appears anywhere in this amendment.

---

## DEBT-02 — Export & verification

**Session:** 2026-08-05 · Plan 106-03 · Read-only against Convex. Zero write commands issued to
either the cloud or the self-hosted deployment.

### Gate

The operative verdict is the `## DEBT-02 pre-flight amendment (2026-08-05)` section above, verbatim:

```
VERDICT: GO — superseding the 2026-08-04 NO-GO. Cleared on evidence, not on re-running the sweep.
```

The 2026-08-04 `NO-GO` at line ~193 is explicitly self-marked **SUPERSEDED** and was not acted on.
(The `VERDICT: PASS` earlier in this file belongs to DEBT-01, a different requirement.)

### Pre-flight — free space on `C:`

Command: `df -h /c` (Git Bash), before the export:

```
Filesystem      Size  Used Avail Use% Mounted on
C:              931G  565G  366G  61% /c
```

**366 GB free** — above the 120 GB floor the plan requires. Cleared to start.

### Export command

Run from **Git Bash** (not PowerShell — PS 5.1 *deletes* a variable assigned `''` rather than
emptying it, project memory `feedback-ps51-empty-env-var-deletes`), with both self-hosted
variables emptied on the invocation so the CLI could not resolve to the live backend:

```
CONVEX_SELF_HOSTED_URL= CONVEX_SELF_HOSTED_ADMIN_KEY= npx convex export \
  --deployment tidy-whale-981 \
  --include-file-storage \
  --path /c/convex-cloud-archive/tidy-whale-981
```

CLI version: `npx convex --version` → `1.42.1`. No package was installed; this is the
already-present `convex@1.42.1` from `node_modules`.

### Verbatim CLI output — target proof

```
- Creating snapshot export

✔ Created snapshot export at timestamp 1785939855853263751
✔ Export is available at https://dashboard.convex.dev/d/tidy-whale-981/settings/snapshot-export
- Downloading snapshot export to C:/convex-cloud-archive/tidy-whale-981

✔ Downloaded snapshot export to C:/convex-cloud-archive/tidy-whale-981
EXIT=0
```

**Target proven from the CLI's own output.** Line 3 names the deployment explicitly —
`dashboard.convex.dev/d/`**`tidy-whale-981`**`/settings/snapshot-export`. That is a
`dashboard.convex.dev` *cloud* URL. It is not a tailnet host, not `127.0.0.1:3210`, not
`convex-backend`, and not `lmofficenew.tail5bb6b3.ts.net`. No abort condition was triggered.

No authentication error occurred — `npx convex login` was **not** needed and was not run. No
API-key fallback was introduced or considered.

### Timing and resulting size

| Measure | Value |
|---|---|
| Started (UTC) | `2026-08-05T14:24:10Z` |
| Completed (UTC) | `2026-08-05T14:30:13Z` (archive mtime `2026-08-05 10:30:13.547 -0400`) |
| Wall clock | **~6 min 03 s** |
| Output | a single **ZIP file** at `C:\convex-cloud-archive\tidy-whale-981`, `646,669,127` bytes |
| `du -sh` | `617M` |
| Free space after (`df -h /c`) | `359G` avail (`572G` used) — 7 GB consumed incl. the Task-2 extraction |

### Deviation — output is a ZIP file, not a directory tree

The plan's `<interfaces>` block and its automated `test -d` check both anticipated a directory
tree. `npx convex export --path <p>` writes a **ZIP** unless `<p>` already exists as a directory;
the given path did not exist, so the CLI produced a single extension-less ZIP at exactly that
path. Reconciled during Task 2 (renamed to `tidy-whale-981.zip`, then extracted alongside it) —
see § Structure below. Both forms are now on disk; nothing was re-exported.

### Deviation — the archive is 617 MB, not the ~56 GB the plan budgeted

`106-CONTEXT.md` D-02 describes "~56 GB pre-2026-07-15 cloud history". **That figure does not
belong to this deployment.** It traces to the *self-hosted* Convex incident of 2026-07-17 to
-07-22, where a full snapshot export peaked at ~56 GB of scratch on a ~1M-document DB — a
different instance, and a transient peak rather than an archive size.

The real cloud archive is **617 MB compressed / 2.0 GiB uncompressed / 602,932 rows**. A
2%-of-expected result is exactly the shape of a truncated export, so it was **not** taken on
faith: it is corroborated independently in Task 2 by a full-archive CRC pass, an 80-table row
census, and an events span covering 2026-05-21 → 2026-07-15 with the newest row landing on the
recorded freeze minute. `106-CONTEXT.md` D-02 has been annotated in place with a dated correction
so a later reader does not mistake a complete archive for a failed one.

### Convex-write check

No `convex import`, `convex deploy`, `convex run`, `--replace-all`, bulk delete, or bulk patch was
executed at any point. Every Convex command issued in this plan is read-only:
`npx convex --version`, `npx convex --help`, `npx convex export --help`,
`npx convex dashboard --help`, and the single `npx convex export` above. Every occurrence of the
words `import`/`deploy`/`--replace-all` in this file is a prohibition or a citation, never an
executed command.

The archive was **not** deleted and remains on disk pending the cancel.

---

### Archive verification — read out of the archive, not inferred from the exit code

All figures below come from reading bytes out of the archive with Python's `zipfile` +
`json.loads`. The exporter's `EXIT=0` is recorded above but is **not** used as evidence of
completeness anywhere in this section.

#### 1. Integrity

`zipfile.ZipFile.testzip()` over the whole archive — every entry's stored CRC recomputed against
its decompressed bytes:

```
ZIP CRC integrity: OK (all 318 entries)
```

No truncated, corrupt, or unreadable member. This is a whole-archive check, not a sample.

#### 2. Structure

Both forms of the archive now exist:

| Path | Form | Size |
|---|---|---|
| `C:\convex-cloud-archive\tidy-whale-981.zip` | original CRC-verified ZIP as written by the CLI | `617M` (`646,669,127` bytes) |
| `C:\convex-cloud-archive\tidy-whale-981\` | extracted directory tree | `2.0G`, 318 entries |

The extraction was done from the local ZIP — **no second export was run**, so the cloud
deployment was read exactly once. Keeping both costs 2 GiB against 359 GB free and removes the
single-point-of-failure of one ZIP header; the plan's own `test -d` check now passes.

Cross-check that the extracted tree agrees with the ZIP:
`wc -l < tidy-whale-981/events/documents.jsonl` → `263718`, identical to the count read from
inside the ZIP.

Top level: `README.md`, `_tables/`, `_storage/`, `_components/` (Convex's rate-limiter component:
`_components/rateLimiter/rateLimits|_storage|_tables`), plus **143 table directories**, each
holding `documents.jsonl` + `generated_schema.jsonl`.

#### 3. Cross-check against `convex/schema.ts`

`convex/schema.ts` declares **130** tables (`defineTable` count). Archive holds **143** table
directories. Overlap: **124**.

**In the archive but not in today's `schema.ts` (19)** — tables that existed on the cloud
deployment and have since been dropped from the schema. Their data is captured:
`agentStatusEvents`, `agentToolAssignments`, `canonicalEvents`, `complexityAssessments`,
`contextPressure`, `dailyRhythmEntries`, `designProjects`, `designTemplates`, `llmGateEvents`,
`networkEgressSummary`, `networkPolicyRules`, `pipelineStepEvents`, `promptAssembly`,
`rateLimitEvents`, `rawMessages`, `scheduledWakeups`, `superLoopIterations`,
`toolAssignmentChanges`, `toolClassifications`.

**In `schema.ts` but absent from the archive (6):** `activeEngineSnapshots`, `costBudgets`,
`inbox`, `kgAnswerSync`, `modelPricing`, `toolPolicyEvents`.

**Correction to the plan's stated interpretation of absence.** The plan instructed that an absent
table "means it held zero rows on the cloud instance". The archive itself disproves that reading:
**63 tables are present with a 0-byte `documents.jsonl`**, so Convex exports a declared table even
when it holds no rows. Absence therefore means something stricter and more useful — those six
tables **did not exist on the cloud deployment at snapshot time**. They were added to
`schema.ts` after `tidy-whale-981` was retired on 2026-07-15 and were only ever pushed to the
self-hosted backend. Nothing is missing from the archive on their account.

#### 4. Readability — first and last line of `documents.jsonl` parsed as JSON

Eight tables checked (the plan requires five, including `events` and `sessions`). Both the first
and the **last** line of each file were `json.loads`-parsed; a truncated export shows up as a
final-line parse failure.

| Table | Rows | First line | Last line |
|---|---:|---|---|
| `events` | 263,718 | OK (`kx70000mn80k…`) | OK (`kx7fzzpnztgx…`) |
| `sessions` | 979 | OK (`nx7001x194wm…`) | OK (`nx7fzhbkn7v7…`) |
| `graphSnapshotLinks` | 122,773 | OK | OK |
| `graphSnapshotNodes` | 95,406 | OK | OK |
| `aggregates` | 25,476 | OK | OK |
| `llmMetrics` | 13,536 | OK | OK |
| `advisorEvents` | 11,973 | OK | OK |
| `episodicEvents` | 8,515 | OK | OK |

Zero parse failures. Separately, all **263,718** `events` rows were parsed individually during the
provenance pass below — `unparsable/no-timestamp: 0`. That is a full-table parse, not a sample.

Census: **80 non-empty tables, 63 empty, 602,932 rows total.** Top tables by row count:
`events` 263,718 · `graphSnapshotLinks` 122,773 · `graphSnapshotNodes` 95,406 · `aggregates`
25,476 · `llmMetrics` 13,536 · `advisorEvents` 11,973 · `episodicEvents` 8,515 · `configChanges`
8,216 · `promptSubmissions` 5,876 · `run_blocks` 5,381.

#### 5. PROVENANCE PROOF — cloud, not the live self-hosted instance

Computed over **all 263,718** `events` rows (not a sample):

```
rows: 263718   unit buckets: {'sec': 263718, 'ms': 0, 'other': 0}
MIN raw 1779368855.0 -> 2026-05-21T13:07:35Z
MAX raw 1784073865.0 -> 2026-07-15T00:04:25Z
gate raw 1784160000.0 -> 2026-07-16T00:00:00Z
PROVENANCE: PASS max<=gate
```

**Newest `events` row: `2026-07-15T00:04:25Z` — 21 days before today (2026-08-05), and inside the
required pre-`2026-07-16T00:00Z` window.** Had this export come from the live self-hosted backend
the newest row would be minutes old.

Two independent corroborations:

- Project memory `convex-topology-all-local` records the cloud deployment's telemetry as frozen
  with its newest `events` row at approximately **`2026-07-15T00:04Z`**. The archive's measured
  maximum matches that to the minute — a figure recorded before this export was taken.
- `sessions.startedAt` spans **`2026-05-07T21:04:56Z` → `2026-07-14T22:59:43Z`** across all 979
  rows, independently landing on the same freeze point from a different table and a different
  field.

*Unit note, since a wrong verdict was nearly recorded here:* the first pass divided `timestamp` by
1000 assuming milliseconds and printed 1970 dates. It happened to still emit "PASS", which would
have been a correct verdict reached by broken arithmetic. `timestamp` is **seconds** — all 263,718
values fall in the seconds bucket with zero mixed-unit outliers — and the figures above are the
re-derived ones.

#### 6. History coverage

Span captured: **`2026-05-21T13:07:35Z` → `2026-07-15T00:04:25Z`** (~55 days) in `events`, and
back to **`2026-05-07`** in `sessions`. Pre-2026-07-15 history — DEBT-02's entire subject — **is
present**, running right up to the retirement moment.

#### 7. File storage

`--include-file-storage` took effect. `_storage/` is present with **25 stored files** (PNG/JPEG)
totalling **7,448,950** uncompressed bytes, plus `_storage/documents.jsonl` carrying **25**
metadata rows — one per file, so no orphaned metadata and no unreferenced blob. The
`_components/rateLimiter/_storage/` sub-entry is present as well.

#### Verdict

**ARCHIVE VERDICT: COMPLETE & READABLE** — 318 entries, all CRC-valid; 143 table directories (80
non-empty, 63 empty) holding **602,932 rows**; 25 stored files; first *and* last `documents.jsonl`
lines parse as JSON for 8 tables and all 263,718 `events` rows parse individually; provenance
proven cloud-sourced by a newest-`events` timestamp of **2026-07-15T00:04:25Z**, matching the
independently-recorded freeze point.

---

### Cancel handoff

D-04 is satisfied: Claude issued **no** cancel, delete, or billing call at any point. Larry
performed both actions himself in the Convex dashboard on 2026-08-05.

#### Larry's reply, verbatim

> tidy-whale-981 deployment deleted

#### Billing follow-up

His reply named only the deployment. Deleting a deployment and cancelling the plan are separate
actions, and the former does not necessarily stop billing, so it was asked explicitly:

> **Q:** "Did you also cancel the subscription under account Billing?"
> **A:** "Yes, plan cancelled too."

Both D-04 actions therefore complete: **deployment deleted AND subscription cancelled.**

#### Independent verification of the deletion

A self-report is a claim; these probes are the evidence. Run 2026-08-05T15:54Z, after his
confirmation:

```
404  https://tidy-whale-981.convex.site/health
404  https://tidy-whale-981.convex.site/
404  https://tidy-whale-981.convex.cloud/instance_name
```

`GET /health` is a real route on this codebase — `convex/http.ts:37`,
`http.route({ path: "/health", method: "GET", handler: healthCheck })` — so a 404 there is not a
missing-route artifact.

**Control, because 404 alone is ambiguous.** A slug that never existed returns exactly the same
thing:

```
404  https://definitely-not-a-real-deployment-9x7q2.convex.site/health
404  https://definitely-not-a-real-deployment-9x7q2.convex.cloud/instance_name
```

So the 404 proves "no deployment answers at this host" — it does not by itself distinguish
*deleted* from *never existed*. What closes that gap is a first-hand liveness baseline from
earlier the same day: **the Task 1 export pulled 602,932 rows out of this exact deployment
between 14:24Z and 14:30Z**, and it 404s at 15:54Z. That is a proven state change over ~85
minutes, from the strongest possible evidence of liveness (a full data read) to nothing.

*Attribution note:* the pre-deletion baseline is the export itself, not a `/health` probe. No live
`/health` response from `tidy-whale-981` was ever captured while it was up, so none is quoted here.

**DNS still resolves — this is not evidence the deployment survived.** `nslookup
tidy-whale-981.convex.site` returns `104.18.10.59`, `104.18.11.59`, `2606:4700::6812:a3b`,
`2606:4700::6812:b3b`. Those are **Cloudflare wildcard addresses for `*.convex.site`**, returned
for any slug at all — the control hostname above resolves the same way. A future reader repeating
this nslookup should not read a successful resolution as a live deployment; the HTTP status is the
signal, not the A/AAAA records.

#### Disposition of the `.env*` manual checks

These were settled **before** this checkpoint, not by it — see
`## DEBT-02 pre-flight amendment (2026-08-05)` § "Gate conditions — disposition" above for the
evidence. In short: the two live files were supplied and confirmed clean, and the two `.bak`
backups were accepted as an inert residual on Larry's explicit decision rather than inspected.
They were deliberately **not** re-asked at this checkpoint. Not restated here so there is one
place to correct if it ever changes.

#### DEBT-02 status

**SATISFIED / CLOSED.** Archive exported and verified by reading rows out of it; provenance proven
cloud-sourced; deployment deleted; subscription cancelled; the one stale doc corrected.

The archive at `C:\convex-cloud-archive\` is now the **only** copy of that history. D-02 permits
deleting it at Larry's discretion; nothing in this phase deletes it.

No secret value appears anywhere in this section.
