# Forge Ingest — Deploy Checklist (OPS-01)

This checklist covers every environment variable required to run the Forge ingest bridge
(file listing, artifact bytes, log streaming, and CORS). Set each variable in the target
**Convex deployment** via `npx convex env set <VAR> <VALUE>` or through the Convex Dashboard
→ Settings → Environment Variables. Variables marked "forge daemon env" must also be set in
the environment of the process running the Forge daemon.

See `docs/DEPLOY.md` for the broader CodePulse setup checklist (CORS semantics, secret
scanning, etc.).

---

## Environment Variables

| Variable | Required | Where set | Purpose |
|----------|----------|-----------|---------|
| `CODEPULSE_ALLOWED_ORIGIN` | **Required in prod** | Convex deployment env | Production CORS allowlist. When set, `getCorsHeaders` echoes the matching `Origin` header instead of falling back to the wildcard `*`. Must be set to your frontend origin (e.g. `http://localhost:5173`) — currently commented out in `.env.example`. Omitting it leaves the wildcard fallback active (fail-open). |
| `FORGE_INGEST_API_KEY` | **Required** | Convex deployment env **and** forge daemon process env | Shared bearer secret for `/forge-ingest`, `/forge-log-ingest`, and `/forge-file-ingest`. Server-to-server only — **never** include in browser code or client bundles. The daemon presents this as `Authorization: Bearer <key>`; the Convex httpAction validates it via `validateForgeIngestAuth`. |
| `FORGE_INGEST_ALLOW_ANON` | Optional (default: unset → fail-closed) | Convex deployment env | Explicit opt-in to allow unauthenticated ingest. Leave **unset in production**. Only useful for local dev smoke-testing when no API key is configured. Setting this to `true` in prod disables the bearer gate for all three Forge ingest endpoints. |
| `CONVEX_FORGE_INGEST_URL` | Required (forge daemon) | Forge daemon process env | Base URL the daemon appends `/forge-ingest` to for job-state events. Example: `https://<deployment>.convex.site`. Do **not** include `/forge-ingest` here — the daemon constructs the full path. |
| `FORGE_LOG_INGEST_URL` | Required for log streaming | Forge daemon process env | Full endpoint URL for log chunk ingest, including the path. Example: `https://<deployment>.convex.site/forge-log-ingest`. Must be the complete path — the daemon posts directly to this URL without appending anything. |
| `FORGE_FILE_INGEST_URL` | Required for file/artifact ingest | Forge daemon process env | Full endpoint URL for file listing + artifact byte ingest, including the path. Example: `https://<deployment>.convex.site/forge-file-ingest`. **Must include `/forge-file-ingest`** — omitting the path suffix causes a 404 (Pitfall 5: double-path bug if the daemon also appends a suffix). Store the complete path here. |

---

> **⚠ Host gotcha — use `.convex.site`, NOT `.convex.cloud`, for all three Forge ingest URLs.**
> Convex serves **HTTP actions** (`/forge-ingest`, `/forge-log-ingest`, `/forge-file-ingest`) on the
> **`.convex.site`** host. The **`.convex.cloud`** host is the data/function + websocket API (that one
> is `VITE_CONVEX_URL` for the frontend). A daemon configured with `.cloud` URLs will appear to POST
> successfully but **nothing lands** in the `jobs`/`workspaces` tables — the classic silent-failure trap.
> For the current prod deployment the correct base is `https://tidy-whale-981.convex.site`
> (verified 2026-07-05; see the `forge-deployment-tidy-whale-981` memory).

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
# CONVEX_FORGE_INGEST_URL=https://<deployment>.convex.site
# FORGE_LOG_INGEST_URL=https://<deployment>.convex.site/forge-log-ingest
# FORGE_FILE_INGEST_URL=https://<deployment>.convex.site/forge-file-ingest

# Verify what is set:
npx convex env list
```
