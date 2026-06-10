# CodePulse — Setup & Convex Environment Checklist

CodePulse runs **locally only** — the frontend is served by Vite at `http://localhost:5173`
(`npm run dev`) and there is no Vercel/Netlify deployment. The backend, however, is
**Convex Cloud**, so the browser at `localhost:5173` still makes cross-origin requests to a
`https://<deployment>.convex.cloud` URL. This checklist covers the environment config that
hardening in Phase 77 depends on.

## Run it

```bash
npm run dev          # frontend (Vite) at http://localhost:5173
npm run dev:backend  # npx convex dev — connects to your Convex Cloud dev deployment
```

There is no production deploy in normal use. (`npm run deploy` exists but is unused —
CodePulse is run locally.)

---

## 1. CORS allowlist — `CODEPULSE_ALLOWED_ORIGIN` (OPS-01)

CodePulse's ingest endpoints emit CORS headers via `getCorsHeaders(request)` in
`convex/ingestAuth.ts`. That function parses `CODEPULSE_ALLOWED_ORIGIN` into an allowlist
and **echoes the request `Origin` only when it matches** (fail-closed).

### Why CORS still applies to a local-only app

The frontend is local (`localhost:5173`) but Convex is **cloud**. Your browser POSTs to the
cloud Convex deployment — a cross-origin request — so CORS is enforced. The allowlist value
is simply your **local dev origin**, not any deployed host.

### What to set it to

```
http://localhost:5173
```

(If you ever serve the dashboard from another local port or `127.0.0.1`, add those too,
comma-separated with **NO spaces** — e.g. `http://localhost:5173,http://127.0.0.1:5173`.)

### Where + how to set it

On the **Convex deployment your local app points at** — i.e. the one `npx convex dev` uses.
Set it there (no `--prod`, since there is no prod deploy):

```bash
npx convex env set CODEPULSE_ALLOWED_ORIGIN 'http://localhost:5173'
npx convex env list   # confirm CODEPULSE_ALLOWED_ORIGIN appears
```

Fallback: **Convex Dashboard → your deployment → Settings → Environment Variables**.

### Why set it at all (fail-closed semantics)

When `CODEPULSE_ALLOWED_ORIGIN` is **unset**, `getCorsHeaders` falls back to a permissive
`Access-Control-Allow-Origin: "*"` — the fail-open state Phase 77 set out to close. Setting
it to `http://localhost:5173` makes the allowlist actually closed even for local use. It is
low-stakes for a single-user local tool (and ingest is independently API-key gated — see
below), but it's a one-liner and removes the wildcard.

---

## 2. Which control does what (don't conflate them)

| Control | Protects against | Where |
|---------|------------------|-------|
| **CORS allowlist** (`CODEPULSE_ALLOWED_ORIGIN`) | **Browser-initiated** cross-origin requests | `convex/ingestAuth.ts → getCorsHeaders` |
| **Ingest auth** (`validateIngestAuth`) | **Server-to-server** ingest (e.g. Ástríðr agents POSTing directly) | ingest handlers (separate control, deferred) |

CORS is a **browser** enforcement mechanism. Non-browser callers (the Ástríðr agent is a
server-side HTTP client) can set the `Origin` header arbitrarily, so CORS does **not** gate
server-to-server traffic — `validateIngestAuth()` is the control for that. Both layers are
independent.

---

## 3. Secret scanning (OPS-02)

`.github/workflows/gitleaks-scan.yml` runs Gitleaks on `master` and on PRs and **blocks**
(exit 1) when a real secret is found. The baseline scan over full history is clean (see
`.planning/phases/77-ci-production-hardening/77-02-SUMMARY.md`). Nothing to configure — just
keep secrets out of commits. False-positive placeholders are allowlisted in `.gitleaks.toml`.

---

## 4. Supabase migration drift (OPS-03) — N/A for CodePulse

CodePulse has no `supabase/` schema directory, so there is nothing to drift-check. The
migration-drift CI control lives **upstream in Ástríðr**
(`astridr-repo/.github/workflows/supabase-migration-check.yml`). No CodePulse action required.
