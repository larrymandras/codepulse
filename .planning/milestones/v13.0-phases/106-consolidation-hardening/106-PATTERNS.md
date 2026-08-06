# Phase 106: Consolidation & Hardening - Pattern Map

**Mapped:** 2026-08-04
**Files analyzed:** ~7 (this phase is verify-and-close; most requirements produce zero or few new files)
**Analogs found:** 6 / 7

## Phase-shape note for the planner

This is NOT a typical new-feature phase. Three of four requirements (DEBT-01, DEBT-02, DEBT-04-UAT-portion) are verification/operational work with little or no source-file output. Only DEBT-03 (chunk-splitting) and possibly DEBT-04's bug-fix portion touch real source files. Classify plans accordingly — don't force a controller/service/component file list where the real deliverable is a verification report or a live UAT session.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `vite.config.ts` (modify — possible `manualChunks`/lazy boundary wiring) | config | batch (build-time) | `vite.config.ts` itself (existing `drop-unused-ort-wasm` plugin shows the project's convention for build-time asset surgery) | exact (self) |
| Voice-engine lazy boundary (new small wrapper file OR direct `lazy()` call at the `ChatInput.tsx` import site — exact shape is Claude's discretion per D-09/CONTEXT) | component / lazy-boundary | request-response (React render) | `src/components/graph/CodeVaultGraph.tsx` (module-level `lazy()` + `Suspense` wrapping `ForceGraph3D.tsx`) | exact |
| `src/components/ChatInput.tsx` (modify — swap static `useSpeechRecognition` import for the lazy boundary, if the real build data warrants it) | component | event-driven (Web Speech API) | `src/components/graph/ForceGraph3D.tsx` (isolation-rule docstring pattern: "this is the ONLY file permitted to import X") | role-match |
| DEBT-02 export/verify script (scratch, e.g. `scripts/verify-cloud-convex-export.mjs` or a plain shell/PowerShell transcript — Claude's discretion) | utility / script | file-I/O + batch | `scripts/verify-intake-claim.mjs` | role-match |
| DEBT-02 grep-for-references check (can be inline bash, not necessarily a file) | utility | transform | `scripts/verify-skills-page.mjs` (ok/fail PASS-FAIL convention) | role-match |
| `convex/skillSync.ts` and/or `convex/registry.ts` (modify — ONLY if live re-repro of the "stale project-origin row" bug shows it is NOT actually fixed; see flag below) | service (Convex mutation/pure-helper module) | CRUD (skills registry sync) | `convex/skillSync.ts` itself — already contains `computeSkillPrunes`/`sanitizeScannedOrigins`, the exact functions the Phase 98 gap-closure (98-05) touched | exact (self) |
| `convex/__tests__/skillSync.test.ts` (modify — add regression test if a fix lands) | test | transform (pure-function unit tests) | `convex/__tests__/skillSync.test.ts` itself | exact (self) |
| `src/components/skills/SkillLifecycleMenu.tsx` (read-only reference; modify only if the ⋯-menu gating bug is UI-side, not registry-side) | component | request-response (Convex mutation via `enqueueLifecycle`) | itself — already implements the `dormant / shadowed / multiScope` scope-gating branches referenced by D-07 | exact (self) |

## CRITICAL FLAG for the planner — DEBT-04's "known open bug" may already be fixed

CONTEXT.md D-07 describes the stale-project-origin-row bug as "still open," citing `98-HUMAN-UAT.md` Test 1 (severity: major). I read that file directly:

- `98-HUMAN-UAT.md` **Gaps** section (lines 97-114) shows `status: resolved`, `resolution: "Gap-closure plan 98-05 executed 2026-07-22 (forge 360e8a5 + codepulse 107e64d, hardened by GC-01..03 fixes)... buildSkillSnapshot declares a scannedOrigins manifest... computeSkillPrunes prunes declared-but-empty origins."`
- **Test 6** (lines 56-66), dated 2026-07-23, is a **live, post-deploy re-repro that PASSED**: "VERIFIED: 0 registry rows carry claude-code:project:559ce8ebf812 (uat-ws-placeholder row fully pruned; declared-but-empty origin reconciled). No skill renders multi-scope from that workspace anymore."
- **Test 7** (lines 68-76) also passed, confirming the safety-valve side of the same fix.
- Current `convex/skillSync.ts` (read in full, lines 1-141) already contains `sanitizeScannedOrigins` and the per-origin `computeSkillPrunes` logic with the `scannedOrigins` manifest union — i.e., the exact fix the gap-resolution note describes is present in the live source today, not a stale doc.

**Per this repo's Stale Docs rule** ("If project docs contradict observed code behavior, trust the code, say so explicitly, and update the doc in the same commit"), the planner should treat DEBT-04's bug-fix sub-task as **re-verify via live UAT (re-run something like Test 1's repro), not assume code changes are needed**. If the live re-repro confirms the fix holds, DEBT-04's D-07 code-fix branch is a no-op — only the deferred UAT sessions (Test 4 sub-cases, voice sequence, Phase 100 drag round-trip) remain real work. Correct CONTEXT.md's "still open" framing during execution per the Stale Docs rule, and only touch `convex/skillSync.ts`/`SkillLifecycleMenu.tsx` if the live re-repro produces a NEW failure.

## Pattern Assignments

### DEBT-03 — Chunk-splitting: real build evidence (supersedes CONTEXT.md's D-09 hypothesis)

I ran `npm run build` directly (not delegated) to get ground truth per D-09's instruction to "run a real npm run build" before deciding what to split. Actual chunks over the 500 kB warning threshold today:

```
dist/assets/index-B146e1Pu.js                2,047.37 kB   <- main entry chunk, NOT flagged in REQUIREMENTS.md at all
dist/assets/react-force-graph-3d-*.js        1,293.89 kB   <- already lazy (CodeVaultGraph.tsx), loads only on 3D toggle
dist/assets/useSpeechRecognition-*.js          638.56 kB   <- genuinely oversized, confirmed NOT lazy
dist/assets/WarRoom-*.js                       485.00 kB   <- UNDER 500kB threshold, NOT actually flagged by the build
```

Key findings for the planner:
1. **`WarRoom` is a non-issue** — 485 kB, under the warning threshold. CONTEXT.md/REQUIREMENTS.md naming it is outdated; do not spend a plan on it.
2. **`react-force-graph-3d` (1.29 MB) is large but already correctly isolated** — it's dynamically imported only when the user switches to 3D mode (`CodeVaultGraph.tsx` lines 63-69, 672-697). This is precedent-quality code, not a defect. The build tool still flags it because the warning fires per-chunk regardless of load timing; no action needed unless the planner wants to raise `build.chunkSizeWarningLimit` to silence the noise (see `vite.config.ts` for where that option would land).
3. **`useSpeechRecognition` (638 kB) is the real, confirmed problem.** It is reachable via `ChatInput.tsx` → `InsightsChat.tsx` (lazy route, fine) but ALSO composed into the much larger voice engine (`useAstridrVoice.ts` imports `useWakeWord` + `useSpeechRecognition` + `useDuplexEars`), which `Chat.tsx` (also lazy) pulls in. Rollup's automatic chunk-splitting grouped these into one shared 638 kB chunk keyed off the `useSpeechRecognition` module name — this is genuinely NOT yet isolated behind its own lazy boundary at the `ChatInput.tsx` call site the way `react-force-graph-3d` is at the `ForceGraph3D.tsx` call site. This is the file the plan should actually act on.
4. **The main `index-*.js` entry chunk itself is 2.05 MB** — the single biggest chunk in the build and not named anywhere in REQUIREMENTS.md/CONTEXT.md. This loads on every page view (it's the entry, not a route chunk). Investigating its composition (likely non-lazy top-level imports in `App.tsx`, `DashboardLayout.tsx`, or a barrel export pulling in more than intended) is almost certainly higher-value than anything the requirements originally named. Flag this explicitly to Larry/the plan — treat REQUIREMENTS.md's named chunks as a "starting hypothesis, not ground truth" exactly as D-09 says, and this is the concrete result of following that instruction.

**Analog:** `src/components/graph/CodeVaultGraph.tsx` (lines 17-25, 63-69, 672-697) — the established lazy-boundary pattern in this codebase.

**Imports pattern** (module-level lazy declaration, avoids "lazy inside component" React warning):
```typescript
import { lazy, Suspense, /* ... */ } from "react";
import { type ForceGraph3DHandle } from "./ForceGraph3D"; // type-only import is safe, doesn't pull the runtime module

// ── Lazy-load 3D render surface so three.js stays in a separate chunk (SC#2) ─
// Module-level declaration — avoids "lazy inside component" React warning. The
// dynamic import boundary keeps `react-force-graph-3d` / `three` out of the
// main bundle until the user switches to 3D mode.
const LazyForceGraph3D = lazy(() =>
  import("./ForceGraph3D").then((m) => ({ default: m.ForceGraph3D }))
);
```

**Core lazy-boundary + Suspense pattern** (CodeVaultGraph.tsx lines 672-697):
```typescript
<Suspense
  fallback={
    <div className={canvasClass}>
      <div className="flex h-full items-center justify-center">
        <p className="text-primary/70 font-mono text-base animate-pulse">
          Loading 3D render…
        </p>
      </div>
    </div>
  }
>
  <LazyForceGraph3D
    ref={fgRef3d}
    data={filteredData}
    /* ...props passed straight through... */
  />
</Suspense>
```

**Isolation-rule docstring convention** (`ForceGraph3D.tsx` lines 10-17) — apply the same discipline to whatever file ends up as the sole import site for the voice-engine stack:
```typescript
/**
 * ISOLATION RULE: This is the ONLY file permitted to import `react-force-graph-3d`,
 * `three`, or `3d-force-graph`. The dynamic-import boundary (`React.lazy` in
 * CodeVaultGraph.tsx) keeps Three.js out of the main bundle (SC#2). Importing
 * any of those packages from any file statically reachable from main would break
 * chunk isolation.
 */
```

**Route-level lazy pattern for comparison** (`src/App.tsx` lines 26, 36, 54, 108-114) — this is the OTHER lazy pattern already in the codebase (whole-page lazy, not sub-component lazy). Use this shape if the planner decides to split at the page level instead of the hook/component level:
```typescript
const Chat = lazy(() => import("./pages/Chat"));
// ...
<Route path="/chat" element={<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Chat...</div>}><Chat /></Suspense>} />
```

**vite.config.ts — where any new build-time config lands** (existing pattern for build-time surgery, lines 10-24):
```typescript
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "drop-unused-ort-wasm",
      generateBundle(_options, bundle) {
        for (const fileName of Object.keys(bundle)) {
          if (/ort-wasm.*\.wasm$/.test(fileName)) {
            delete bundle[fileName];
          }
        }
      },
    },
  ],
  // ...
  server: { port: 5173 },
});
```
No `build.rollupOptions.output.manualChunks` exists yet — if the planner decides the `index` entry chunk needs deliberate `manualChunks` splitting (vs. just fixing errant static imports), this is a new addition, not an extension of an existing pattern. Prefer fixing the root cause (an unwanted static import) over `manualChunks` band-aids, consistent with how `react-force-graph-3d` was actually isolated (via a lazy import site, not a rollup config rule).

---

### DEBT-02 — Cloud Convex export + verification script

**Analog:** `scripts/verify-intake-claim.mjs` (full file read, 147 lines) — plain-Node, no framework, `execFileSync`/`fetch`-based, `ok(cond, label)` PASS/FAIL convention, hard-fails on missing required env vars rather than silently falling back (this repo's Secrets & Auth rule — "never fall back to reading .env files").

**Script skeleton pattern to copy** (lines 26-45):
```javascript
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const SITE_URL = process.env.CONVEX_SITE_URL;
const API_KEY = process.env.FORGE_INGEST_API_KEY;

if (!SITE_URL || !API_KEY) {
  console.error(
    "ERROR: CONVEX_SITE_URL and FORGE_INGEST_API_KEY must both be set in the environment.\n" +
      "Never fall back to reading .env files — set them explicitly for this run."
  );
  process.exit(1);
}

const fail = [];
const ok = (cond, label, extra = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!cond) fail.push(label);
};
// ... steps using ok(...) ...
console.log(`\n  ${fail.length === 0 ? "ALL CHECKS PASSED" : `FAILED: ${JSON.stringify(fail)}`}`);
process.exit(fail.length === 0 ? 0 : 1);
```

**CLI-invocation helper for talking to Convex from a script** (lines 47-74) — reusable if the export verification needs to run `npx convex export`/`convex run` and parse output:
```javascript
function convexRun(fn, argsJson) {
  const argv = ["node_modules/convex/bin/main.js", "run", fn, argsJson];
  if (ENV_FILE) argv.push("--env-file", ENV_FILE);
  const stdout = execFileSync(process.execPath, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // ...parse stdout as JSON, tolerating informational lines...
}
```

**For the "grep both repos for tidy-whale-981 references" step (D-03):** no script analog needed — this is a direct `Grep` tool sweep across `codepulse` and `astridr-repo`, same as the sweep already reported clean in CONTEXT.md D-03. Document the exact grep invocations and their output in the verification artifact rather than writing throwaway tooling for it.

**Convex export CLI:** no in-repo analog exists (this repo has never exported the self-hosted or cloud instance via script — `CLAUDE.md`'s self-hosted rules explicitly forbid `--replace-all` imports, which is a different operation). Use `npx convex export --path <scratch-dir> --deployment-name tidy-whale-981` (verify exact flags against the installed `convex` CLI version per this repo's rule: delegate a quick "does X exist in this CLI version" check rather than trial-and-erroring the export flags in the main thread).

---

### DEBT-01 — Typed-api sweep (verify-and-close, no source pattern needed)

No file classification needed — confirmed via direct grep during this pattern-mapping pass:
```
grep -rn "anyApi" --include="*.ts" --include="*.tsx" codepulse/  →  2 hits, both in convex/costBudgetEval.test.ts and convex/evalScores.test.ts, both inside COMMENTS explaining Proxy identity instability, not imports.
```
This matches CONTEXT.md D-05 exactly. The plan's action here is `tsc --noEmit` + a clean grep re-run + a written confirmation — no analog file needed since nothing gets created or modified.

---

### DEBT-04 — Deferred UAT (live sessions, no source pattern needed for most of it)

The three deferred UAT sequences (Phase 98 Test 4 menu sub-cases, full voice wake/barge-in/re-arm, Phase 100 drag round-trip) are live Claude-guided browser sessions with Larry — no code pattern applies; follow the session shape already documented in `98-HUMAN-UAT.md` (Clerk-signed-in session, Claude drives, Larry confirms, findings appended to a `-HUMAN-UAT.md`-style file). Use `98-HUMAN-UAT.md` itself as the structural template for whatever UAT-log artifact this phase produces (frontmatter `status`/`phase`/`source`/`started`/`updated`, numbered `### N. <test name>` sections with `expected`/`result`/`notes`, closing `## Summary` with pass/issue/pending/blocked counts).

If the live re-repro in the CRITICAL FLAG above surfaces a genuine regression, apply the shared patterns below (`convex/skillSync.ts` service pattern + `convex/__tests__/skillSync.test.ts` test pattern) rather than writing new files.

## Shared Patterns

### Lazy-boundary isolation (the core DEBT-03 pattern)
**Source:** `src/components/graph/CodeVaultGraph.tsx` (lazy declaration + Suspense) + `src/components/graph/ForceGraph3D.tsx` (isolation-rule docstring)
**Apply to:** Whatever file becomes the sole non-lazy import site currently pulling in the voice-engine stack (`ChatInput.tsx` and/or wherever `useAstridrVoice`/`useWakeWord`/`useDuplexEars` get statically imported by a non-lazy ancestor).
```typescript
const LazyX = lazy(() => import("./X").then((m) => ({ default: m.X })));
// ...
<Suspense fallback={<LoadingPlaceholder />}>
  <LazyX {...props} />
</Suspense>
```

### Route-level lazy loading (alternative/complementary DEBT-03 pattern)
**Source:** `src/App.tsx` lines 26-87 (27 lazy-loaded pages), 108-171 (matching `<Suspense>`-wrapped `<Route>` elements)
**Apply to:** Any new or currently-non-lazy page found to be contributing to the oversized `index` entry chunk.

### Verification-script PASS/FAIL convention
**Source:** `scripts/verify-intake-claim.mjs` (mirrors `scripts/verify-skills-page.mjs`)
**Apply to:** DEBT-02's export/reference-grep verification artifact, and DEBT-01's re-confirmation output, if either is captured as a script rather than prose.

### Convex pure-helper + unit-test pairing
**Source:** `convex/skillSync.ts` (pure functions, no `ctx`) + `convex/__tests__/skillSync.test.ts` (`describe`/`it`/`expect` from vitest, table-style fixtures like `const cc = {...}; const proj = {...};`)
**Apply to:** Only if DEBT-04's live re-repro surfaces a genuine new registry-pruning defect.

### Stale-doc correction discipline
**Source:** `CLAUDE.md` § "Stale Docs" (project root)
**Apply to:** Both `.planning/AVATAR-HANDOFF.md` (D-01, already flagged in CONTEXT.md) and — per the CRITICAL FLAG above — CONTEXT.md's own D-07 characterization of the stale-origin bug as "still open." Correct in the same commit/session that discovers the discrepancy, per repo convention.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Tailscale laptop setup checklist (D-10) | N/A — operational checklist, not code | N/A | No code artifact; plan should produce a Larry-run verification checklist (URLs to hit: `https://lmofficenew.tail5bb6b3.ts.net`, `:8443`), not a source file. No existing "ops checklist" file pattern exists in this repo to copy from — write it as plain planning prose or a `.planning/phases/106-.../` checklist doc, not application code. |
| Cloud Convex account cancellation (D-04) | N/A — manual billing action | N/A | Explicitly out of scope for code; hand Larry the exact dashboard step per D-04. No analog needed. |

## Metadata

**Analog search scope:** `src/App.tsx`, `src/components/graph/` (CodeVaultGraph.tsx, ForceGraph3D.tsx), `vite.config.ts`, `src/components/ChatInput.tsx`, `src/hooks/` (useSpeechRecognition.ts, useAstridrVoice.ts, useDuplexEars.ts, useWakeWord.ts), `convex/skillSync.ts`, `convex/registry.ts`, `convex/__tests__/skillSync.test.ts`, `src/components/skills/SkillLifecycleMenu.tsx`, `scripts/` (verify-intake-claim.mjs, verify-skills-page.mjs, upload-avatars.mjs), `.planning/milestones/v11.0-phases/98-.../98-HUMAN-UAT.md`
**Files scanned:** ~20 read/grepped directly; `npm run build` executed live for ground-truth chunk sizes (see DEBT-03 section)
**Pattern extraction date:** 2026-08-04
