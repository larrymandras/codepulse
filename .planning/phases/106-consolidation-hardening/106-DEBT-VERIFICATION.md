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

VERDICT: NO-GO — a functional writer to `tidy-whale-981` exists today (3 CI workflow files across both repos hardcoding `CODEPULSE_INGEST_URL`/telemetry POSTs), and the frontend's actual `VITE_CONVEX_URL` cannot be confirmed by this sweep (2 doc-only references, 5 manual `.env*` checks pending). Plan 106-03 must not run until: (a) Larry completes the 5 manual `.env*` checks above, and (b) the CI workflow `CODEPULSE_INGEST_URL` values are either repointed to the self-hosted deployment's ingest URL or the export/cancel plan explicitly accounts for updating them as part of its own scope.

No secret value appears anywhere in this artifact.
