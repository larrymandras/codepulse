# Phase 118, Plan 01 — D-01 Evidence

**Question answered:** does `generateUploadUrl` -> raw upload -> `getUrl` -> HTTP GET actually
round-trip bytes on the live self-hosted Convex backend, discriminated from a known-broken
result by a paired null control?

## Run metadata

- **Date:** 2026-08-14
- **`docker ps` line:** `convex-backend Up 11 hours (healthy)`
- **Exact command:** `node scripts/probe-convex-storage.mjs` (run from `C:\Users\mandr\codepulse`,
  no `CONVEX_SELFHOST_URL` override — default `http://127.0.0.1:3210`)
- **Exit code:** `0`

## Raw probe output

The upload-URL query-string capability token (a Convex-generated, single-use, ~1-hour-expiring
signed token — not a bearer header, admin key, or environment-variable value) is redacted below
out of caution per this plan's secrets discipline, even though it is already consumed and cannot
be replayed. Everything else — host, port, path, response bodies, byte counts — is verbatim.

```
probe-convex-storage: target http://127.0.0.1:3210

=== VERDICT BLOCK ===
CONTROL_ORPHAN_ID: kg2589rnrbawjb3g2867yjn3c586zngt
CONTROL_RESULT: null
MINTED_UPLOAD_URL_ORIGIN: https://lmofficenew.tail5bb6b3.ts.net
UPLOAD_STATUS: 200
NEW_STORAGE_ID: kg28fq286rbx69w8thcepdgf218cf78w
GETURL_RESULT: "https://lmofficenew.tail5bb6b3.ts.net/api/storage/d95a8940-2598-4171-9802-c10618dd38d7"
GET_STATUS: 200
GET_CONTENT_LENGTH_HEADER: 4096
GET_BYTES: 4096
WORKING_ORIGIN: https://lmofficenew.tail5bb6b3.ts.net
UPLOAD_ATTEMPTS: [{"url":"https://lmofficenew.tail5bb6b3.ts.net/api/storage/upload?token=<redacted-one-time-upload-token>","httpStatus":200,"ok":true,"storageId":"kg28fq286rbx69w8thcepdgf218cf78w","raw":"{\"storageId\":\"kg28fq286rbx69w8thcepdgf218cf78w\"}","transportError":null}]
VERDICT: PASS
```

## Control pair

| Run | Query | Result |
|---|---|---|
| **Experimental** — fresh mint -> upload 4096 bytes -> `getImageUrl` -> `GET` | `GET https://lmofficenew.tail5bb6b3.ts.net/api/storage/d95a8940-2598-4171-9802-c10618dd38d7` | HTTP **200**, `Content-Length: 4096`, **4096 bytes actually received** |
| **Control** — orphaned `avatars.imageStorageId` (`kg2589rnrbawjb3g2867yjn3c586zngt`, one of the 11 real persona rows uploaded before the cloud->self-hosted migration) | `POST /api/query avatars:getImageUrl {storageId: kg2589rnrbawjb3g2867yjn3c586zngt}` | `{"status":"success","value":null}` |

The two rows produced **different** results (a resolved 200-with-4096-bytes vs. a `null`). Had the
storage mechanism itself been broken on this backend, the experimental row would have produced the
same `null` (or an error/404) as the control row instead — so this pass is discriminating, not a
probe that would print the same thing regardless of whether the mechanism works.

## Origin finding

The upload and the read-back both succeeded against the URL Convex returned **verbatim** —
`https://lmofficenew.tail5bb6b3.ts.net` (the tailnet hostname, default HTTPS port). The A2
fallback (rewriting the origin to `http://127.0.0.1:3211`) defined in the probe script was never
invoked, because the first attempt against the verbatim URL succeeded (HTTP 200) — this host can
resolve and reach its own tailnet hostname directly, so no origin rewrite was necessary in
practice. This differs from `hooks/loom-emit.mjs`'s pattern, which defaults to
`http://127.0.0.1:3211` for the site/HTTP-actions origin; that default is unnecessary for storage
URLs specifically, which Convex mints already bound to the reachable tailnet origin.

**`hooks/studioWatch.mjs` must use the URL Convex returns verbatim for both
`generateUploadUrl`'s result and `getImageUrl`'s result — no origin rewrite needed.** A defensive
fallback to `http://127.0.0.1:3211` (matching this probe's A2 handling) is cheap insurance to keep
but is not expected to fire based on this measurement.

## Verdict

**PASS.** `generateUploadUrl` -> raw upload -> `getUrl` -> HTTP GET round-trips real bytes on this
backend (4096/4096 bytes, HTTP 200 throughout), discriminated from the known-null control in the
same run. D-01's blocking proof is satisfied on the `convex-storage` primary branch; the
`local-static-origin` fallback is not needed. See "## Resolved transport branch" below (Task 3).

## Discovered but out of scope

While acquiring the control, `avatars:list` returned **4,233 rows**, of which only **11** carry a
non-empty `imageStorageId` (the real persona avatars from `scripts/upload-avatars.mjs`). The
remaining ~4,222 rows carry generated-looking names (e.g. `aexec-118-01-d4844871fc84376b`,
`acheck22gapsB-6ed98f48fe1be7b3`) that look like test/scratch data written by unrelated automated
sessions into the `avatars` table over time. This plan does not call `avatars:saveImage`, patch,
or delete anything, so it neither caused nor touched this — flagged here for visibility only,
since D-01's Task 1 read_first step explicitly names `avatars.ts` as the "only existing `ctx.storage`
usage" this phase copies. Cleaning it up (if warranted) is outside this plan's scope and outside
CLAUDE.md's no-mass-mutation guardrails without an explicit batch-capped design.
