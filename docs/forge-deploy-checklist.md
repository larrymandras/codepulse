# Forge Ingest — Deploy Checklist (OPS-01)

This checklist covers every environment variable required to run the Forge ingest bridge
(file listing, artifact bytes, log streaming, and CORS). Set each variable in the target
**Convex deployment** via `npx convex env set <VAR> <VALUE>`, with the CLI pointed at the
self-hosted backend (see the origin table below) rather than a Convex Cloud project. The hosted
Convex Dashboard does not manage this deployment — the self-hosted dashboard is a separate
service and is not currently published on the tailnet, so treat the CLI as the mechanism.
Variables marked "forge daemon env" must also be set in the environment of the process running
the Forge daemon.

See `docs/DEPLOY.md` for the broader CodePulse setup checklist (CORS semantics, secret
scanning, etc.).

---

## Environment Variables

| Variable | Required | Where set | Purpose |
|----------|----------|-----------|---------|
| `CODEPULSE_ALLOWED_ORIGIN` | **Required in prod** | Convex deployment env | Production CORS allowlist. When set, `getCorsHeaders` echoes the matching `Origin` header instead of falling back to the wildcard `*`. Must be set to your frontend origin (e.g. `http://localhost:5173`) — currently commented out in `.env.example`. Omitting it leaves the wildcard fallback active (fail-open). |
| `FORGE_INGEST_API_KEY` | **Required** | Convex deployment env **and** forge daemon process env | Shared bearer secret for `/forge-ingest`, `/forge-log-ingest`, and `/forge-file-ingest`. Server-to-server only — **never** include in browser code or client bundles. The daemon presents this as `Authorization: Bearer <key>`; the Convex httpAction validates it via `validateForgeIngestAuth`. |
| `FORGE_INGEST_ALLOW_ANON` | Optional (default: unset → fail-closed) | Convex deployment env | Explicit opt-in to allow unauthenticated ingest. Leave **unset in production**. Only useful for local dev smoke-testing when no API key is configured. Setting this to `true` in prod disables the bearer gate for all three Forge ingest endpoints. |
| `CONVEX_FORGE_INGEST_URL` | Required (forge daemon) | Forge daemon process env | Base URL the daemon appends `/forge-ingest` to for job-state events. Example: `<site-origin>`. Do **not** include `/forge-ingest` here — the daemon constructs the full path. |
| `FORGE_LOG_INGEST_URL` | Required for log streaming | Forge daemon process env | Full endpoint URL for log chunk ingest, including the path. Example: `<site-origin>/forge-log-ingest`. Must be the complete path — the daemon posts directly to this URL without appending anything. |
| `FORGE_FILE_INGEST_URL` | Required for file/artifact ingest | Forge daemon process env | Full endpoint URL for file listing + artifact byte ingest, including the path. Example: `<site-origin>/forge-file-ingest`. **Must include `/forge-file-ingest`** — omitting the path suffix causes a 404 (Pitfall 5: double-path bug if the daemon also appends a suffix). Store the complete path here. |

---

> **⚠ Host gotcha — the ingest URLs must use the SITE origin, not the API origin.**
> Convex serves **HTTP actions** (`/forge-ingest`, `/forge-log-ingest`, `/forge-file-ingest`) on the
> **site** origin. The **API** origin is the data/function + websocket endpoint (that one is
> `VITE_CONVEX_URL` for the frontend). A daemon configured with the API origin will appear to POST
> successfully but **nothing lands** in the `jobs`/`workspaces` tables — the classic silent-failure trap.
> On Convex Cloud the split is by hostname suffix (`.convex.site` vs `.convex.cloud`); on the
> self-hosted backend it is by **port on the same host**.
>
> **Current deployment (self-hosted) — corrected 2026-08-05:**
>
> | Origin | URL | Used for |
> |--------|-----|----------|
> | Site (HTTP actions) | `https://lmofficenew.tail5bb6b3.ts.net:8443` | the three Forge ingest URLs above |
> | API (data + websocket) | `https://lmofficenew.tail5bb6b3.ts.net` | `VITE_CONVEX_URL` |
>
> Throughout this checklist, `<site-origin>` means the **Site** row of that table.
>
> Verified live 2026-08-05: `GET :8443/health` returns the CodePulse health payload (the httpAction
> registered at `convex/http.ts`), while `GET :443/health` returns 404 and `GET :443/instance_name`
> returns `codepulse`.
>
> This previously named `https://tidy-whale-981.convex.site`, the retired cloud deployment. That host
> is decommissioned; the `forge-deployment-tidy-whale-981` memory is superseded by
> `convex-topology-all-local`.
>
> **Tailnet-only.** Every published endpoint is `(tailnet only)` — nothing is on the public internet —
> so only a daemon on a tailnet-joined machine can reach these. GitHub-hosted CI runners cannot, which
> is why the CI telemetry was removed rather than repointed (astridr-repo `22027c71`, codepulse `7d4a0439`).

## Gate independence

The three Forge ingest gates are independent at the daemon level:

- **`CONVEX_FORGE_INGEST_URL` unset** — job-state events (launch/stop/status) are a no-op.
- **`FORGE_LOG_INGEST_URL` unset** — log streaming is a no-op; job-state events still flow.
- **`FORGE_FILE_INGEST_URL` unset** — file listing + artifact ingest is a no-op; logs and
  job-state events still flow.

An unset `FORGE_FILE_INGEST_URL` makes file/artifact ingest silently skip without affecting
log streaming or job-state reporting. This is intentional: the daemon gates each channel
separately so partial deployments remain functional.

> **Phase 82-04** wires the daemon side (`codepulse-emitter.ts → emitFiles`) and documents
> the exact daemon environment setup for file ingest.

---

## Quick setup

```bash
# Set in Convex deployment (dev):
npx convex env set CODEPULSE_ALLOWED_ORIGIN 'http://localhost:5173'
npx convex env set FORGE_INGEST_API_KEY '<your-secret-key>'

# Set in forge daemon process (add to forge daemon .env or shell profile):
# FORGE_INGEST_API_KEY=<same-secret-key>
# CONVEX_FORGE_INGEST_URL=<site-origin>
# FORGE_LOG_INGEST_URL=<site-origin>/forge-log-ingest
# FORGE_FILE_INGEST_URL=<site-origin>/forge-file-ingest

# Verify what is set:
npx convex env list
```
