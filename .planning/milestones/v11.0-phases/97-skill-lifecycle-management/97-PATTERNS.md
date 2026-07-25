# Phase 97: Real Skill Intake & Daemon Foundation - Pattern Map

**Mapped:** 2026-07-17
**Files analyzed:** 8 (2 forge modify, 2 forge new, 1 forge test-extend, 1 new forge test, 2 codepulse modify)
**Analogs found:** 8 / 8

**Note:** RESEARCH.md found the daemon execution harness already merged (`feat/forge-intake-daemon` → `master`, commit `a364adf`, 2026-07-16). This phase's real surface is narrower than CONTEXT.md assumed — mostly extension of two already-existing forge files, plus one genuinely new forge module (DAEMON-03 rescan) and a small codepulse-side adapter decision. Analogs below are drawn from forge's own already-shipped sibling modules wherever possible (same repo, same author conventions, verified merged).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `forge/src/process/intake-exec.ts` (MODIFY: `buildAdmitArgs`, `mapExitCodeToResult`) | utility (pure argv builder + exit-code classifier) | transform | *(self — extending existing function, same file)* | exact |
| `forge/src/process/intake-exec.test.ts` (MODIFY: extend) | test | transform | *(self — existing describe blocks, same file)* | exact |
| `forge/src/emit/rescan-snapshot-builder.ts` (NEW, name TBD by planner) | service (filesystem walker + payload builder) | batch / file-I/O | `forge/src/workspace/enumerate.ts` (walker) + `forge/src/emit/codepulse-emitter.ts` (POST/retry) | role-match (composite of two exact-pattern donors) |
| `forge/src/emit/rescan-snapshot-builder.test.ts` (NEW) | test | batch | `forge/src/emit/codepulse-emitter.test.ts` | role-match |
| `forge/src/emit/command-poller.ts` (MODIFY: trigger rescan after successful intake write) | service (orchestrator) | event-driven | *(self — `executeIntake` already has the hook point)* | exact |
| `codepulse/convex/forge.ts` and/or `codepulse/convex/forgeCommands.ts` (MODIFY: refusal-reason adapter, Open Question 2 — location TBD by planner) | service (Convex mutation/httpAction) | request-response | `codepulse/convex/forge.ts` `capAckReport`/`ackCommand` (same file, established defensive-serialization pattern) | exact |
| `codepulse/src/components/skills/IntakeReportView.tsx` (MODIFY: render refusal-reason as a synthesized finding — zero new UI branch per UI-SPEC preference) | component | request-response | *(self — `Finding` table already renders `rule_id`/`severity`/`message`; no new component needed)* | exact |
| `~/.claude/skills/` write-ACL concern (no new file — precedent only) | n/a | file-I/O | `forge/src/workspace/promote.ts` `grantDaemonReadAccess` (icacls precedent) | precedent-only, confirmed NOT reproducing (Pitfall 6) |

## Pattern Assignments

### `forge/src/process/intake-exec.ts` (utility, transform) — MODIFY

**Analog:** itself — extend the existing exported functions in place; no external analog needed, the file's own header comment documents the exact contract to extend.

**Current state — `buildAdmitArgs`** (lines 35-47, live):
```typescript
export function buildAdmitArgs(
  positional: string,
  destination: IntakePayload['destination'],
  projectRootPath: string | null,
): string[] {
  if (destination === 'project') {
    if (projectRootPath === null) {
      throw new Error('buildAdmitArgs: projectRootPath is required for destination "project"');
    }
    return ['admit', positional, '--to', 'project', '--project', projectRootPath, '--format', 'json'];
  }
  return ['admit', positional, '--to', destination, '--format', 'json'];
  // ⚠ Never appends --write. Never appends --allow-unrecoverable.
}
```
**Required extension (per RESEARCH Pitfall 1 + D-02):** append `'--write'` unconditionally, and append `'--allow-unrecoverable'` whenever `destination !== 'cold'` (never for cold — its gate is the ASTRIDR-01 marker, not this flag). Never append `--allow-overwrite` (D-07 — the CLI's own `NO_OVERWRITE_OVERRIDE` refusal on exit 5 is the collision-prevention mechanism; adding this flag would silently defeat D-07).

**Current state — `mapExitCodeToResult`** (lines 70-96, live):
```typescript
export function mapExitCodeToResult(exitCode: number, stdout: string, stderr: string): IntakeResult {
  if (exitCode === 2) {
    return { status: 'failed', error: stderr.trim() };
  }
  if (exitCode === 0 || exitCode === 1 || exitCode === 3) {
    const parsed = parseIntakeStdout(stdout);
    if (parsed !== null) {
      return { status: 'done', report: parsed };
    }
    return { status: 'failed', error: `Intake CLI exited ${exitCode} but stdout was not parseable JSON` };
  }
  // Any other exit code: unmapped/unexpected — reads stderr (EMPTY for router refusals, Pitfall 3)
  const stderrTrimmed = stderr.trim();
  return {
    status: 'failed',
    error: stderrTrimmed
      ? `Intake CLI exited with unexpected code ${exitCode}: ${stderrTrimmed}`
      : `Intake CLI exited with unexpected code ${exitCode}`,
  };
}
```
**Required extension (per RESEARCH Pitfalls 3 & 4 + the exact exit-code table in RESEARCH.md "Code Examples"):**
- Exit codes 4-7 (router refusals: `NO_UNRECOVERABLE_OVERRIDE`, `NO_OVERWRITE_OVERRIDE`/D-07 collision, `ASTRIDR_MARKER_ABSENT`, `PROJECT_GIT_TOPLEVEL_UNRESOLVED`): still parse the first stdout line as the `ReportEnvelope` (validation ran before the router decision, so it's always present), AND extract the human-readable `outcome.message` text from the remaining stdout lines (NOT stderr — it's empty for these). Compose an `IntakeResult` that carries both the report and the actionable refusal reason — this is the input to the codepulse-side adapter below.
- Exit codes 8-9 (`EXIT_CATALOG_REGEN_FAILED_AFTER_PLACEMENT` / `EXIT_LEDGER_WRITE_FAILED_AFTER_PLACEMENT`): "loud, not rolled back" — the skill IS on disk. Must NOT collapse into the same `status: 'failed'` bucket as 4-7 with generic "nothing was written" semantics (would directly contradict what the Skills page shows after rescan). Surface as a distinct partial-success/warning outcome.

**Error handling pattern to preserve:** never throw, always resolve/return a discriminated `IntakeResult` (`status: 'done' | 'failed'`) — this contract is enforced by every caller up the chain (`intake-runner.ts`, `command-poller.ts`).

---

### `forge/src/process/intake-exec.test.ts` (test) — MODIFY (extend)

**Analog:** itself. Existing `describe('mapExitCodeToResult', ...)` block (lines 75-119) already has the exact `it(...)` shape to copy for the new exit-code-4-9 cases:
```typescript
// Source: forge/src/process/intake-exec.test.ts, lines 107-118 (live) — pattern to replicate
it('unmapped exit code → failed, includes exit code and stderr fallback', () => {
  const result = mapExitCodeToResult(9, '', 'unexpected crash');
  expect(result.status).toBe('failed');
  expect(result.error).toContain('9');
  expect(result.error).toContain('unexpected crash');
});
```
New cases needed: exit 4/6/7 (generic refusal → parse stdout report + extract refusal text), exit 5 (collision → assert the message surfaces the D-07-shaped actionable text), exit 8/9 (assert `status` is NOT the same bucket as 4-7 — a distinct discriminant your `IntakeResult` shape must carry). Also extend `describe('buildAdmitArgs', ...)` (lines 25-50) with cases asserting `--write` IS present and `--allow-unrecoverable` is present for `global`/`project` but absent for `cold`, and `--allow-overwrite` is NEVER present in any case (D-07 regression guard).

---

### `forge/src/emit/rescan-snapshot-builder.ts` (NEW — DAEMON-03) — service, batch/file-I/O

**No existing file to modify — this module does not exist.** RESEARCH.md confirms `skill_intake.provenance.report_query.scan()` is NOT reusable (Pitfall 5 — only walks provenance-ledger'd skills, not the full active tree). Build fresh, composing two already-shipped forge patterns:

**Analog 1 (the walk):** `forge/src/workspace/enumerate.ts` — `enumerateWorkspace()` (full file read, lines 1-263). Directly reusable shape: recursive stack/function walk with an `IGNORE_DIRS` skip-set, per-entry classification, and defensive `try/catch` around every `fs` call so one bad directory doesn't kill the whole walk.

Adapt this pattern for three walk targets (per RESEARCH's architecture diagram and D-03/D-04):
- `~/.claude/skills/` (global, origin `"claude-code"`)
- `~/.claude/skills-available/` (cold storage, origin `"claude-code:available"` — confirm exact string against `schema.ts` comment below)
- `<workspace.rootPath>/.claude/skills/` for each row from `forge/src/store/workspaces.ts`'s `listWorkspaces(db)` (project, origin `"claude-code:project:<key>"`)

**Origin-string convention (already established, use verbatim):**
```typescript
// Source: codepulse/convex/schema.ts, line 199 (live)
origin: v.optional(v.string()), // "native" | "bridge" | "cc" | "catalog" | "claude-code[:available|:project:<key>]"
```

**Analog 2 (the POST):** `forge/src/emit/codepulse-emitter.ts` — `emitWorkspaces()` (lines 253-295) is the closest-shape existing emitter (small array payload, fire-and-forget, bounded retry). Reuse its exact structure:
```typescript
// Source: forge/src/emit/codepulse-emitter.ts, lines 253-295 (live) — structural pattern to replicate
export async function emitWorkspaces(cfg: EmitCfg, workspaces: Workspace[]): Promise<void> {
  const { ingestUrl, apiKey, hostId, fetchImpl = fetch } = cfg;
  if (!ingestUrl || !apiKey) return;               // no-op gate
  const payload = buildWorkspacesPayload(hostId, workspaces);
  const url = `${ingestUrl}/forge-ingest`;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
      if (resp.ok) return;
      if (resp.status >= 400 && resp.status < 500) { /* log once for 401/403, drop */ return; }
      // 5xx: fall through to retry
    } catch { /* network error: fall through to retry */ }
    if (attempt < MAX_ATTEMPTS - 1) await new Promise<void>((r) => setTimeout(r, 200 * 2 ** attempt));
  }
}
```
**Endpoint target for the rescan (differs from `codepulse-emitter.ts`'s `/forge-ingest`):** RESEARCH's architecture diagram states the rescan snapshot POSTs to the **existing `/scan` endpoint** (`convex/scan.ts` `scanEndpoint` → `registry.syncInventory`), not `/forge-ingest`. Confirm the exact URL/auth shape of `/scan` before wiring — `codepulse-emitter.ts`'s bearer-auth + fire-and-forget + `MAX_ATTEMPTS` retry discipline still applies, only the URL and payload shape differ.

**Auth/security pattern to copy:** apiKey NEVER interpolated into any `console.error` message (every emitter function in `codepulse-emitter.ts` enforces this); 401/403 logged once-per-process via `loggedAuthStatuses` Set, non-auth 4xx logged per-call, 5xx/network gets bounded exponential backoff then silently drops.

**Trigger point (in `command-poller.ts`):** call the rescan-and-post function from `executeIntake()` (lines 287-319, live) only after a successful write outcome (status `'done'` from the new intake-exec exit-code mapping) — NOT after every intake command (a validation-only failure never wrote anything, so a rescan would be wasted work).

---

### `forge/src/emit/rescan-snapshot-builder.test.ts` (NEW) — test

**Analog:** `forge/src/emit/codepulse-emitter.test.ts` — mirror its fetch-mocking / retry-assertion structure (injectable `fetchImpl`, no real network I/O, assert retry count on 5xx, assert single log line on repeated 401). Also mirror `forge/src/workspace/enumerate.ts`'s sibling test file's directory-fixture pattern (temp-dir-based walk assertions) for the filesystem-walk half of this module — check `forge/src/workspace/enumerate.test.ts` if it exists (glob it before authoring; not read this session, but the module clearly has a live sibling walker being tested this way per its own header comment).

---

### `forge/src/emit/command-poller.ts` (service, event-driven) — MODIFY

**Analog:** itself — `executeIntake()` (lines 287-319, live, full method already read). The hook point already exists structurally:
```typescript
// Source: forge/src/emit/command-poller.ts, lines 287-303 (live) — insertion point
private async executeIntake(cmd: ForgeCommand): Promise<void> {
  let status: 'done' | 'failed' = 'done';
  let error: string | undefined;
  let report: unknown | undefined;

  try {
    if (!this.intakeFn) {
      throw new Error('intake not supported on this host');
    }
    const result = await this.intakeFn(cmd.commandId, cmd.intakePayload!, cmd.downloadUrl ?? null);
    status = result.status;
    error  = result.error;
    report = result.report;
    // ⬅ INSERTION POINT (DAEMON-03): if status === 'done' (real write succeeded,
    //    not just validation-clean), fire the rescan-and-post here. Fire-and-forget
    //    per the codepulse-emitter.ts discipline — do NOT await-block the ack below
    //    on the rescan's own network round-trip; the ack must still fire even if
    //    the rescan silently fails (mirrors emitJob's "never delays or fails the
    //    caller" invariant).
  } catch (err) {
    status = 'failed';
    error  = err instanceof Error ? err.message : String(err);
  }
  // ...ack fires unconditionally below (unchanged)
}
```
**Design constraint to preserve:** the serial intake queue (`enqueueIntake`/`drainIntakeQueue`, lines 255-274) must still process one command at a time — the rescan trigger should NOT block `drainIntakeQueue`'s `await this.executeIntake(cmd)` waiting on the rescan's own retry backoff; call it as `void rescanAndSync(...)` (fire-and-forget) inside `executeIntake`, matching `codepulse-emitter.ts`'s own "never await on a job-critical path" convention.

---

### `codepulse/convex/forge.ts` and/or `codepulse/convex/forgeCommands.ts` (service, request-response) — MODIFY, location per Open Question 2

**Analog:** `codepulse/convex/forge.ts` — `capAckReport()` (lines 46-... — read, defensive-serialization pattern) and `ackCommand` (lines 755-800, live, full method read). This is the established "the ack handler defensively reshapes what the daemon sends before persisting" pattern — the refusal-reason adapter should follow the same shape if it lands here.

**Core pattern — `ackCommand`** (lines 789-798, live):
```typescript
// Source: codepulse/convex/forge.ts, lines 789-798 (live)
await ctx.db.patch(cmd._id, {
  status:             args.status,
  resolvedForgeJobId: args.resolvedForgeJobId,
  error:              args.error,
  completedAt:        args.now,
  // WR-03: an oversized report is replaced with a truncation stub so the
  // terminal patch (and the blob delete above) always commits — the ack
  // must never fail because the report is too large.
  report:             capAckReport(args.report ?? null),
});
```
**Adapter insertion point (RESEARCH Open Question 2, recommendation (a) — synthetic finding, zero UI changes):** before `capAckReport(args.report ?? null)` is called, if the daemon's ack payload carries a write-refusal reason (from the extended `mapExitCodeToResult` above) that isn't already a `findings[]` entry, inject one:
```typescript
// Pattern to add — mirrors the existing defensive-reshape discipline of capAckReport
{ rule_id: "write-refused", severity: "error", path: null, line: null, message: <extracted refusal reason> }
```
This reuses `IntakeReportView.tsx`'s existing `findings` table with zero new UI branches, per UI-SPEC's stated preference (cited directly in RESEARCH.md Open Question 2).

**Where the extracted reason travels from:** the daemon's `IntakeResult.error` field (already plumbed end-to-end: `intake-exec.ts` → `intake-types.ts` → `command-poller.ts`'s `executeIntake` → the ack POST body's `error` field, per `forgeCommandsAck`'s existing handler). Planner must decide: does the daemon pre-inject the synthetic finding into `report.findings` itself (before acking), or does `ackCommand` do it server-side from `args.error`? Either is viable; RESEARCH flags this as the one genuinely undecided design point for planning.

---

### `codepulse/src/components/skills/IntakeReportView.tsx` (component, request-response) — MODIFY (minimal, if adapter injects into `findings[]`)

**Analog:** itself — the `Finding` interface and its render loop (lines 50-56 and 146-162, live, full file read) already handle exactly this shape with zero code change needed if the adapter above lands server-side or daemon-side as a `findings[]` entry:
```typescript
// Source: codepulse/src/components/skills/IntakeReportView.tsx, lines 50-56 (live)
interface Finding {
  rule_id: string;
  severity: string;
  path: string | null;
  line: number | null;
  message: string;
}
```
```typescript
// Source: codepulse/src/components/skills/IntakeReportView.tsx, lines 146-162 (live) — render loop, unchanged
{((report?.findings ?? []) as Finding[]).map((finding, i) => (
  <TableRow key={`${finding.rule_id}-${i}`}>
    <TableCell>{finding.rule_id}</TableCell>
    <TableCell><SeverityBadge severity={finding.severity} /></TableCell>
    <TableCell>
      <span className="font-mono text-xs">
        {finding.path ?? "—"}{finding.line ? `:${finding.line}` : ""}
      </span>
    </TableCell>
    <TableCell><span className="text-sm">{finding.message}</span></TableCell>
  </TableRow>
))}
```
**Only genuinely new UI work here (if any):** if D-07's collision copy needs to be MORE prominent than a generic error-severity table row (UI-SPEC decision, not this file's concern per the header comment's scope note), that's a UI-SPEC-driven addition — but the default path is "no new UI branch," confirmed by RESEARCH.

**Security pattern to preserve:** every report-derived string renders via React's default JSX escaping — no `dangerouslySetInnerHTML` anywhere in this file (verified, security comment lines 10-14). Any new refusal-reason text (which can contain an attacker-influenced path/skill name per RESEARCH's Security Domain table) must go through the SAME JSX text-node rendering, and if it's ever interpolated into the copyable CLI command string (line 108's `command` template), it MUST go through the existing `quoteArg()` helper (line 107) — do not add a second unescaped interpolation site.

---

## Shared Patterns

### Fire-and-forget outbound HTTP (apply to: rescan-snapshot-builder.ts's POST, command-poller.ts's rescan trigger)
**Source:** `forge/src/emit/codepulse-emitter.ts` (whole file, lines 116-295 read this session)
```typescript
// No-op gate — every emitter in this codebase starts with this:
if (!ingestUrl || !apiKey) return;
// MAX_ATTEMPTS = 3 total, exponential backoff 200ms/400ms between attempts
// 4xx (non-auth) logs per-call; 401/403 logs ONCE per process via a Set; 5xx/network retries then silently drops
// apiKey is NEVER interpolated into any console message, anywhere
```
Apply this exact discipline to the new rescan POST — do not invent a different retry/logging shape.

### Never-throw discriminated result contract (apply to: intake-exec.ts's extended mapExitCodeToResult, rescan-snapshot-builder.ts)
**Source:** `forge/src/process/intake-exec.ts` (`IntakeResult` union), `forge/src/emit/intake-types.ts` lines 43-59
Every function on this call chain (`mapExitCodeToResult` → `runIntakeCli` → `createIntakeRunner`'s returned `IntakeFn` → `CommandPoller.executeIntake`) returns/resolves a discriminated result object and NEVER throws or rejects past its own boundary. The new exit-code-4-9 handling and the new rescan module must preserve this — callers up the chain assume it unconditionally.

### Defensive server-side reshape before persist (apply to: the refusal-reason adapter, wherever it lands)
**Source:** `codepulse/convex/forge.ts` `capAckReport()` (lines 46-...) — the established pattern for "the daemon's payload may be malformed/oversized/incomplete; the Convex mutation defensively reshapes it before `ctx.db.patch` so the terminal state transition always commits."

### Windows-only best-effort ACL grant (apply to: ONLY if a live write EPERMs during execution — not a pre-emptive task)
**Source:** `forge/src/workspace/promote.ts` `grantDaemonReadAccess()` (lines 267-280)
```typescript
// /T recurse, /C continue-on-error, /Q quiet; (OI)(CI)F = full control, inheritable.
execFileSync('icacls', [dest, '/grant', `${user}:(OI)(CI)F`, '/T', '/C', '/Q'], {
  stdio: 'ignore',
  windowsHide: true,
});
```
**RESEARCH Pitfall 6 explicitly confirms this does NOT currently reproduce** — `icacls` on `~/.claude/skills` already shows full inherited control for the daemon's own user. Do not pre-emptively apply this grant to skill destination dirs; only reach for this pattern if a live write actually EPERMs during execution testing.

## No Analog Found

None. Every file in scope has at least a role-match analog within the same repo (forge or codepulse), mostly from siblings already merged in the same feature branch (`feat/forge-intake-daemon`) or the same command-bridge generation (Phase 80/82).

## Open Design Decisions for Planner (not pattern gaps — explicit RESEARCH flags)

1. **Rescan module name/location** — RESEARCH does not prescribe a filename; `rescan-snapshot-builder.ts` above is a placeholder. Natural home is `forge/src/emit/` (sibling to `codepulse-emitter.ts`, `command-poller.ts`) since it POSTs to CodePulse, but the filesystem-walk half could also justify `forge/src/workspace/` (sibling to `enumerate.ts`). Planner should pick one; both are defensible.
2. **Refusal-reason adapter location** (RESEARCH Open Question 2) — daemon-side (`intake-exec.ts` synthesizes the finding before acking) vs. Convex-side (`ackCommand` synthesizes it from `args.error`). RESEARCH recommends daemon-side synthetic-finding injection as the more surgical fit but flags this as an explicit plan-phase decision, not a closed one.
3. **`/scan` endpoint's exact contract** — RESEARCH's Open Question 1 notes the current live feeder of `/scan` was not located this session (likely astridr-repo or a standalone script, outside the three repos in scope). Before wiring the rescan POST, read `convex/scan.ts`'s `scanEndpoint` directly to confirm its request shape (bearer auth? same as `/forge-ingest`? a different `FORGE_*_URL` env var gate?) — do not assume it matches `codepulse-emitter.ts`'s `/forge-ingest` contract verbatim, only its retry/logging discipline.

## Metadata

**Analog search scope:** `C:\Users\mandr\forge\src\` (emit/, process/, workspace/, store/), `C:\Users\mandr\codepulse\convex\` (forge.ts, forgeCommands.ts, registry.ts, schema.ts), `C:\Users\mandr\codepulse\src\components\skills\` (IntakeReportView.tsx)
**Files scanned (read in full or targeted this session):** `intake-exec.ts`, `intake-exec.test.ts` (partial), `intake-types.ts`, `intake-config.ts`, `intake-runner.ts`, `command-poller.ts`, `codepulse-emitter.ts`, `enumerate.ts`, `promote.ts`, `workspaces.ts`, `forge.ts` (partial), `forgeCommands.ts` (partial), `registry.ts`, `schema.ts` (targeted grep), `IntakeReportView.tsx`
**Pattern extraction date:** 2026-07-17
**Live-code confirmation:** `forge`'s `master` HEAD verified at commit `a364adf` (2026-07-16) during this session — matches RESEARCH.md's stated confidence window (valid 14 days from research date; re-verify HEAD hasn't moved before executing).
