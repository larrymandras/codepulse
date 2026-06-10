# CodePulse — Production Deploy Checklist

This checklist covers the production-hardening configuration introduced in Phase 77.
Run through it whenever you deploy CodePulse to a new (or freshly reset) Convex deployment.

## Deploy command

```bash
npm run deploy   # = npx convex deploy && npx vite build
```

`npx convex deploy` pushes the Convex functions; `npx vite build` builds the frontend.
Set the environment variables below **before** the first production deploy so CORS is
correct on the very first request.

---

## 1. CORS allowlist — `CODEPULSE_ALLOWED_ORIGIN` (OPS-01) — REQUIRED in prod

CodePulse's ingest endpoints emit CORS headers via `getCorsHeaders(request)` in
`convex/ingestAuth.ts`. That function parses `CODEPULSE_ALLOWED_ORIGIN` into an
allowlist and **echoes the request `Origin` only when it matches** (fail-closed).

### What to set it to

The deployed frontend origin (your Vercel/Netlify URL) **plus** the localhost dev
origin, comma-separated, with **NO spaces around the commas**. For example
(substitute your real deployed origin — do not copy this verbatim):

```
https://<your-frontend>.vercel.app,http://localhost:5173
```

> Do **not** hardcode someone else's origin. Use the host CodePulse is actually served from.

### Where to set it

On the **Convex production deployment's** environment variables — not in source,
not in `.env`.

### How to set it

```bash
# Set it (targets the deployment for your CONVEX_DEPLOY_KEY / active prod context):
npx convex env set CODEPULSE_ALLOWED_ORIGIN 'https://<your-frontend>.vercel.app,http://localhost:5173'

# Explicit prod targeting:
npx convex env set --prod CODEPULSE_ALLOWED_ORIGIN '<value>'

# Verify it landed:
npx convex env list   # confirm CODEPULSE_ALLOWED_ORIGIN appears with the expected value
```

Fallback: the **Convex Dashboard → prod deployment → Settings → Environment Variables**
UI sets the same variable if you prefer not to use the CLI.

### Why it MUST be set in prod (fail-closed semantics)

When `CODEPULSE_ALLOWED_ORIGIN` is **unset**, `getCorsHeaders` falls back to a
permissive `Access-Control-Allow-Origin: "*"`. That fallback is **for local dev only**.
If you ship prod without setting this variable, every origin is allowed — the exact
fail-open behavior Phase 77 closed. Setting the variable is what makes the allowlist
actually closed in production.

---

## 2. Which control does what (don't conflate them)

| Control | Protects against | Where |
|---------|------------------|-------|
| **CORS allowlist** (`CODEPULSE_ALLOWED_ORIGIN`) | **Browser-initiated** cross-origin requests | `convex/ingestAuth.ts → getCorsHeaders` |
| **Ingest auth** (`validateIngestAuth`) | **Server-to-server** ingest (e.g. Ástríðr agents POSTing directly) | ingest handlers (separate control, deferred) |

CORS is a **browser** enforcement mechanism. Non-browser callers (the Ástríðr agent
is a server-side HTTP client) can set the `Origin` header arbitrarily, so CORS does
**not** gate server-to-server traffic — `validateIngestAuth()` is the control for that.
Both layers are independent. Setting `CODEPULSE_ALLOWED_ORIGIN` hardens browser access
only; it is **not** a substitute for ingest API-key auth.

---

## 3. Secret scanning (OPS-02)

`.github/workflows/gitleaks-scan.yml` runs Gitleaks on `master` and on PRs and
**blocks** (exit 1) when a real secret is found. The baseline scan over full history
is clean (see `.planning/phases/77-ci-production-hardening/77-02-SUMMARY.md`).
Nothing to configure at deploy time — just keep secrets out of commits. False-positive
placeholders are allowlisted in `.gitleaks.toml`.

---

## 4. Supabase migration drift (OPS-03) — N/A for CodePulse

CodePulse has no `supabase/` schema directory, so there is nothing to drift-check.
The migration-drift CI control lives **upstream in Ástríðr**
(`astridr-repo/.github/workflows/supabase-migration-check.yml`). No CodePulse action required.
