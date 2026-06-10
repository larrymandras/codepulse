---
phase: 75-agent-console
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - .planning/phases/75-agent-console/75-GATEWAY-PREREQ.md
  - .env.example
autonomous: false
requirements: [CON-01, CON-03]
user_setup:
  - service: astridr-gateway
    why: "Browser-direct POST/DELETE to the gateway requires CORS to allow those methods and a model field on TaskRequest. These are cross-repo (astridr-repo/gateway) changes Larry must land before runtime success criteria can be verified end-to-end."
    env_vars:
      - name: VITE_GATEWAY_URL
        source: "CodePulse .env — base URL for the gateway, default http://localhost:8200"
      - name: VITE_GATEWAY_WS_URL
        source: "CodePulse .env — WS base for task streams, default ws://localhost:8200 (derived from VITE_GATEWAY_URL if unset)"
      - name: VITE_GATEWAY_API_KEY
        source: "CodePulse .env — Bearer key matching the gateway GATEWAY_API_KEY env var (separate from VITE_ASTRIDR_API_KEY)"
    dashboard_config:
      - task: "In astridr-repo/gateway/gateway/app.py _configure_cors(): add POST and DELETE to allow_methods (currently GET, OPTIONS only at app.py:165). Ensure CODEPULSE_GATEWAY_ORIGIN is set so CORS middleware is registered."
        location: "C:/Users/mandr/astridr-repo/gateway/gateway/app.py"
      - task: "In astridr-repo/gateway/gateway/models.py: add an optional `model: str | None = None` field to TaskRequest, and thread it through the claude_cli and codex_cli adapters so the selected model reaches the CLI invocation."
        location: "C:/Users/mandr/astridr-repo/gateway/gateway/models.py + adapters/"

must_haves:
  truths:
    - "A coordination doc enumerates the two required gateway changes (CORS allow POST+DELETE; model field on TaskRequest) with exact file/line references"
    - "The three new gateway env vars are documented in .env.example with defaults and a note that they are separate from the Ástríðr main-API vars"
  artifacts:
    - path: ".planning/phases/75-agent-console/75-GATEWAY-PREREQ.md"
      provides: "Cross-repo gateway change checklist + verification steps"
      min_lines: 25
    - path: ".env.example"
      provides: "VITE_GATEWAY_URL, VITE_GATEWAY_WS_URL, VITE_GATEWAY_API_KEY documentation"
      contains: "VITE_GATEWAY_URL"
  key_links:
    - from: ".env.example"
      to: "src/lib/astridrApi.ts gateway section"
      via: "import.meta.env env var names"
      pattern: "VITE_GATEWAY_(URL|WS_URL|API_KEY)"
---

<objective>
Document the cross-repo Ástríðr gateway prerequisites that must land before Phase 75's runtime success criteria (CON-01, CON-03) can be verified end-to-end, and document the three new CodePulse env vars the gateway client will read.

This plan writes NO CodePulse application code that edits the gateway — the gateway lives in a separate repo (astridr-repo) and Larry makes those edits manually. This plan produces a coordination/checklist doc and the .env.example documentation only.

Purpose: The current gateway CORS config allows only GET+OPTIONS (app.py:165) which blocks browser POST/DELETE, and TaskRequest has no `model` field. Without these two paired changes, browser-direct task submission and the model selector cannot work against a live gateway. This plan makes the dependency explicit and verifiable.

Output: 75-GATEWAY-PREREQ.md (cross-repo checklist) + .env.example env var documentation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/75-agent-console/75-CONTEXT.md
@.planning/phases/75-agent-console/75-RESEARCH.md

<interfaces>
<!-- The env var names the downstream gateway client (Plan 75-02) will read via import.meta.env -->
VITE_GATEWAY_URL        # default http://localhost:8200 — base for POST/DELETE /tasks
VITE_GATEWAY_WS_URL     # default ws://localhost:8200 — base for WS /tasks/{id}/stream (derived from VITE_GATEWAY_URL if unset)
VITE_GATEWAY_API_KEY    # Bearer key for POST/DELETE /tasks — matches gateway GATEWAY_API_KEY, SEPARATE from VITE_ASTRIDR_API_KEY

<!-- Verified gateway facts (from 75-RESEARCH.md, against live astridr-repo source) -->
app.py:165  allow_methods=["GET", "OPTIONS"]   # POST + DELETE NOT allowed → browser preflight blocks task submit/cancel
models.py   TaskRequest has NO `model` field   # model selection silently dropped by Pydantic until added
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Document the two cross-repo gateway changes (CORS + model field)</name>
  <read_first>
    - .planning/phases/75-agent-console/75-RESEARCH.md (§ "CORS Requirement for Gateway POST/DELETE", § "Pitfall 4: No model Field", Open Questions 1 + 2)
    - .planning/phases/75-agent-console/75-CONTEXT.md (Gate-Lift Reconciliation, D-04)
  </read_first>
  <action>
    Create .planning/phases/75-agent-console/75-GATEWAY-PREREQ.md documenting, as a checklist Larry executes manually in C:/Users/mandr/astridr-repo, the two paired gateway changes required before CON-01/CON-03 can be verified live:
    (1) CORS — in gateway/gateway/app.py `_configure_cors()`, change `allow_methods` from `["GET", "OPTIONS"]` (currently app.py:165) to include `"POST"` and `"DELETE"`; note that the CORS middleware is only registered when `CODEPULSE_GATEWAY_ORIGIN` is set on the gateway, so that env var must point at the CodePulse dev origin (http://localhost:5173).
    (2) model field — in gateway/gateway/models.py add `model: str | None = None` to `TaskRequest`, and thread it through `adapters/claude_cli.py` + `adapters/codex_cli.py` so the value reaches the CLI invocation (per D-04 paired Ástríðr change).
    For each change include: exact file path, the current state (cite line where known), the target state, and a one-line manual verification (e.g., curl an OPTIONS preflight and confirm POST/DELETE in Access-Control-Allow-Methods; submit a task with `model` and confirm it is not dropped). Add a header note that this is cross-repo coordination work, NOT codepulse implementation, and that Phase 75 unit tests do NOT depend on it (they mock fetch/WS) but the manual integration pass in 75-VALIDATION.md does. Cross-reference that the phase was gate-lifted 2026-06-10 (Ástríðr v18.0 shipped M1.P0 + M1.P3) and only these two small changes remain.
  </action>
  <verify>
    <automated>MISSING — doc-only task; verify file exists and contains both change anchors: powershell -Command "if ((Select-String -Path '.planning/phases/75-agent-console/75-GATEWAY-PREREQ.md' -Pattern 'allow_methods','TaskRequest','model').Count -ge 3) { 'ok' } else { throw 'missing anchors' }"</automated>
  </verify>
  <acceptance_criteria>
    - 75-GATEWAY-PREREQ.md exists and references gateway/gateway/app.py CORS allow_methods and gateway/gateway/models.py TaskRequest model field
    - Each change has a current-state cite, a target state, and a manual verification step
    - Doc explicitly marks the work as cross-repo (astridr-repo) and non-blocking for unit tests
  </acceptance_criteria>
  <done>75-GATEWAY-PREREQ.md documents both paired gateway changes with file paths, current/target state, and manual verification; flagged as cross-repo coordination.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Document the three new gateway env vars in .env.example</name>
  <read_first>
    - .env.example (the file being modified)
    - C:/Users/mandr/codepulse/CLAUDE.md (§ Environment Variables — VITE_ASTRIDR_API_URL / VITE_ASTRIDR_API_KEY existing pattern)
    - .planning/phases/75-agent-console/75-PATTERNS.md (astridrApi.ts gateway section — GATEWAY_API_BASE / GATEWAY_API_KEY / gatewayWsBase)
  </read_first>
  <action>
    Append three new env var entries to .env.example, mirroring the existing VITE_ASTRIDR_* documentation style: `VITE_GATEWAY_URL` (default http://localhost:8200 — base URL for POST/DELETE /tasks), `VITE_GATEWAY_WS_URL` (default ws://localhost:8200 — WS base for task streams; if unset the client derives it from VITE_GATEWAY_URL by swapping http→ws), and `VITE_GATEWAY_API_KEY` (Bearer key for POST/DELETE /tasks, matching the gateway's GATEWAY_API_KEY). Add a comment that these three are SEPARATE from VITE_ASTRIDR_API_URL / VITE_ASTRIDR_API_KEY (gateway runs on :8200, Ástríðr main API on :8181) and that the WS task-stream route requires NO auth. Do NOT edit the real .env (Larry edits it manually per project rule); only .env.example. If .env.example does not exist, create it from the env vars documented in CLAUDE.md § Environment Variables plus these three new ones.
  </action>
  <verify>
    <automated>powershell -Command "if ((Select-String -Path '.env.example' -Pattern 'VITE_GATEWAY_URL','VITE_GATEWAY_WS_URL','VITE_GATEWAY_API_KEY').Count -ge 3) { 'ok' } else { throw 'missing gateway env vars' }"</automated>
  </verify>
  <acceptance_criteria>
    - .env.example contains VITE_GATEWAY_URL, VITE_GATEWAY_WS_URL, VITE_GATEWAY_API_KEY with defaults
    - A comment notes these are separate from the VITE_ASTRIDR_* vars and that the WS route is unauthenticated
    - The real .env was NOT modified by Claude tools
  </acceptance_criteria>
  <done>.env.example documents all three new gateway env vars with defaults and the separation note; .env untouched.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → gateway (:8200) | Untrusted browser origin crosses CORS into the gateway's mutating endpoints (POST/DELETE /tasks) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-75-01 | Spoofing | gateway POST/DELETE auth | mitigate | Doc mandates Bearer GATEWAY_API_KEY (V2) on POST/DELETE; CORS scoped to the explicit CODEPULSE_GATEWAY_ORIGIN, not wildcard |
| T-75-02 | Information Disclosure | VITE_GATEWAY_API_KEY in browser bundle | accept | Key is exposed in the client bundle by Vite design; mitigated by localhost-only deployment (no public surface). Documented as an accepted risk in 75-RESEARCH § Security Domain |
| T-75-SC | Tampering | npm/pip/cargo installs | mitigate | No package installs in this plan (doc-only); alert-dialog already present in src/components/ui/. No legitimacy gate needed |
</threat_model>

<verification>
- 75-GATEWAY-PREREQ.md exists with both gateway change anchors (CORS allow_methods, TaskRequest model)
- .env.example documents all three VITE_GATEWAY_* vars
- No .env edits performed by Claude tools
</verification>

<success_criteria>
- Cross-repo gateway prerequisite is documented with exact file references and manual verification steps (supports CON-01, CON-03 runtime verification)
- Three new gateway env vars documented in .env.example, separate from VITE_ASTRIDR_* vars
</success_criteria>

<output>
Create `.planning/phases/75-agent-console/75-01-SUMMARY.md` when done
</output>
