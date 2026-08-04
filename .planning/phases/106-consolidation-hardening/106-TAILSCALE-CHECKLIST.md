---
status: pending
phase: 106-consolidation-hardening
requirement: DEBT-03 (D-10)
written: 2026-08-04
machine-of-record: lmofficenew.tail5bb6b3.ts.net (100.93.234.6)
---

# Tailscale Laptop Onboarding + Reachability Checklist

This checklist proves that Larry's laptop can reach the same self-hosted stack the office PC (`lmofficenew`) reaches, over Tailscale. Every endpoint below was read off the live office PC on 2026-08-04, not assumed from documentation. Claude cannot run any step below — Tailscale device auth and browser verification happen on the laptop itself.

## Discovered endpoints

### Raw `tailscale status` (office PC)

```
100.93.234.6   lmofficenew    mandrasle@  windows  -
100.73.69.18   homeassistant  mandrasle@  linux    -
100.64.160.94  lmlaptop       mandrasle@  windows  -
100.81.2.115   srv1313241     mandrasle@  linux    -
```

**⚠ Important correction to D-10's premise:** `tailscale status` already lists a Windows device named `lmlaptop` (100.64.160.94) on this tailnet, and `tailscale status --json` reports it `"Online": true` at the time this was written:

```json
"LMLaptop": { "HostName": "LMLaptop", "OS": "windows", "Online": true,
  "TailscaleIPs": ["100.64.160.94", "fd7a:115c:a1e0::7c01:a096"] }
```

D-10's framing ("adding Larry's laptop to the existing tailnet") assumed the laptop is not yet on the tailnet. It may already be. **Before running Steps 1-2 below, confirm whether `lmlaptop` is the same physical laptop you're onboarding now.** If it is, Steps 1-2 may already be satisfied — verify with `tailscale status` on the laptop itself rather than reinstalling. If it's a different or stale device, proceed with Steps 1-2 as written.

### Raw `tailscale serve status` (office PC)

```
https://lmofficenew.tail5bb6b3.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:3210

https://lmofficenew.tail5bb6b3.ts.net:8443 (tailnet only)
|-- / proxy http://127.0.0.1:3211

https://lmofficenew.tail5bb6b3.ts.net:9443 (tailnet only)
|-- / proxy http://127.0.0.1:6791
```

### Raw `tailscale funnel status` (office PC)

Identical output to `serve status` above, every entry marked `(tailnet only)` — **nothing on this machine is exposed to the public internet.** No funnel is active (T-106-17 confirmed clean).

### Raw `tailscale ip -4` (office PC)

```
100.93.234.6
```

### Port ownership (via `docker ps`, confirms what each serve proxy target actually is)

- `127.0.0.1:3210` / `3211` → container `convex-backend` (self-hosted Convex: 3210 = client/backend API, 3211 = HTTP-actions "site" server that serves `/ingest`, `/health`, etc.)
- `127.0.0.1:6791` → the Convex self-hosted admin **Dashboard** (not needed for the app to work, included for completeness)
- `0.0.0.0:8181` → container `astridr-agent` (Ástríðr API/WebSocket). **Not published via `tailscale serve`, but reachable directly** at `http://lmofficenew.tail5bb6b3.ts.net:8181` because Tailscale exposes any port a service binds on a non-loopback interface to tailnet peers by default — `serve` is only needed for the HTTPS-terminated `*.ts.net` paths on 443/8443/9443.

**Correction to CONTEXT.md D-10's `:8443` recollection:** `:8443` is real and live, but it is the Convex **site/actions** server (port 3211), not "the self-hosted Convex backend" the browser talks to. The endpoint `VITE_CONVEX_URL` actually needs (the client-facing backend, port 3210) is served at the **root tailnet URL with no port suffix** — `https://lmofficenew.tail5bb6b3.ts.net` (port 443). Both are genuinely Convex, so D-10's recollection wasn't wrong that Convex lives at `:8443` — it just named the wrong one of the two Convex ports as "the backend."

### Probe results (run from the office PC itself, to establish the expected healthy response)

| Endpoint | Probed as | Status | Body (first line) |
|---|---|---|---|
| Convex backend, `127.0.0.1:3210` | IPv4 | 200 | `unknown` (version string; self-hosted builds report this) |
| Convex backend, `localhost:3210` | hostname (covers `::1`) | 200 | same as above |
| Convex backend, tailnet root `https://lmofficenew.tail5bb6b3.ts.net/version` | tailnet HTTPS | 200 | `unknown` |
| Convex site/health, `127.0.0.1:3211/health` | IPv4 | 200 | `{"status":"ok","timestamp":<epoch-ms>,"version":"0.1.0","sessions":20,"activeAlerts":0}` |
| Convex site/health, tailnet `https://lmofficenew.tail5bb6b3.ts.net:8443/health` | tailnet HTTPS | 200 | same shape, `sessions: 20` matched the local probe run seconds apart |
| Convex site/agents-route probe, tailnet `:8443/api/agents` | tailnet HTTPS | 404 | confirms `:8443` is the Convex site, NOT the Ástríðr API — `/api/agents` is not a Convex route |
| Ástríðr API health, `localhost:8181/api/health` | IPv4/loopback | 200 | `{"status":"ok","channel":"web"}` |
| Ástríðr API health, tailnet `http://lmofficenew.tail5bb6b3.ts.net:8181/api/health` | tailnet, plain HTTP | 200 | `{"status":"ok","channel":"web"}` |
| Ástríðr API protected route, `localhost:8181/api/agents` (no auth header) | IPv4/loopback | 401 | `{"detail":"Unauthorized"}` |
| Ástríðr API protected route, tailnet `:8181/api/agents` (no auth header) | tailnet, plain HTTP | 401 | same — 401 over the tailnet is a **valid reachability proof** per this task's own guidance; the network path works and the auth gate correctly rejects an anonymous request |
| CodePulse UI (Vite), `localhost:5173/` | IPv4/loopback | 200 | HTML app shell |
| CodePulse UI (Vite), tailnet `http://lmofficenew.tail5bb6b3.ts.net:5173/` | tailnet | **000 (connection failed)** | see BLOCKER below |
| CodePulse UI (Vite), tailnet IP `http://100.93.234.6:5173/` | tailnet IP | **000 (connection failed)** | same |

**Note on the Ástríðr authenticated-header probe:** the plan asks for a probe carrying the real `Authorization: Bearer` header. Doing that from this automation would require putting the live `VITE_ASTRIDR_API_KEY` value into a shell command, which would print it into this session's own transcript — exactly what "never print the token value" forbids. The unauthenticated 401 above already proves the network path and the auth gate both work correctly; Step 4 below has Larry exercise the real authenticated path through his own signed-in browser session on the laptop, which is the actual load-bearing proof anyway.

### ⚠ BLOCKER found live: the CodePulse UI is not currently reachable from the tailnet at all

`netstat` on the office PC shows Vite's dev server bound only to `[::1]:5173` (IPv6 loopback) — not `0.0.0.0:5173`. This is the exact "IPv6-only binding, not a down service" failure mode this project has hit before, except here it's worse: it isn't bound to any non-loopback interface at all, so **no tailnet peer can reach port 5173 today**, regardless of the IPv4-vs-`localhost` distinction.

A second, independent problem sits behind that one: the page Vite serves has three backend URLs **baked in at dev-server-start time** from the office PC's local `.env.local` (confirmed by inspecting the served dev bundle's `import.meta.env`, not by reading the `.env` file directly):
- `VITE_CONVEX_URL = http://127.0.0.1:3210`
- `VITE_ASTRIDR_API_URL = http://localhost:8181`
- `VITE_ASTRIDR_WS_URL = ws://127.0.0.1:8181`
- `VITE_CONVEX_SITE_URL = https://lmofficenew.tail5bb6b3.ts.net:8443` (this one is already correctly tailnet-addressed)

Three of the four backend URLs the app needs are `127.0.0.1`/`localhost`. Even if Vite's bind address were fixed, a browser loading this page **on the laptop** would resolve `127.0.0.1`/`localhost` to the laptop itself, not the office PC — the Convex client and the Ástríðr WebSocket would try to connect to nothing and the app would render disconnected, not "live data missing," a disconnected shell.

**This was not fixed as part of writing this checklist** — both fixes (rebinding Vite's host, and/or repointing three dev env vars at tailnet hostnames) are office-PC-side changes outside this task's scope (this task only writes the checklist file, and `.env.local` cannot be edited by Claude under this project's rules). **Step 5 below is expected to fail today** unless this is resolved first. See `## Troubleshooting` for the two concrete fixes and their tradeoffs — decide with Larry which one to apply before re-running Step 5.

## Steps

Work through these on the **laptop**. Compare each result against its `expected:` line and record what actually happened on the `result:` line.

### 1. Confirm the laptop is on the tailnet
Install Tailscale (tailscale.com/download) if not already installed, and sign in with the same account/tailnet used on the office PC. Then run `tailscale status` on the laptop.
expected: the output lists `lmofficenew` (100.93.234.6) as a peer. (Also check: does the laptop already appear as `lmlaptop`/`LMLaptop` in the office PC's own `tailscale status`, per the note above? If so, say so — Step 1 may already have been satisfied before today.)
result:

### 2. Approve the device if required
If the tailnet requires device approval, approve it at https://login.tailscale.com/admin/machines.
expected: the laptop shows as connected, not "needs approval", in the admin console.
result:

### 3. Reach the self-hosted Convex backend from the laptop
Open both of these in a browser on the laptop (or `curl` them): `https://lmofficenew.tail5bb6b3.ts.net/version` and `https://lmofficenew.tail5bb6b3.ts.net:8443/health`.
expected: the first returns HTTP 200 with body `unknown`; the second returns HTTP 200 with a JSON body starting `{"status":"ok",...,"sessions":` and a non-negative `sessions` count (was 20 when this was written — the live number will differ, that's fine, it just must be a real number, not an error page).
result:

### 4. Reach the Ástríðr API from the laptop
Open `http://lmofficenew.tail5bb6b3.ts.net:8181/api/health` in a browser or via `curl` on the laptop.
expected: HTTP 200, body `{"status":"ok","channel":"web"}`. (If you additionally try `http://lmofficenew.tail5bb6b3.ts.net:8181/api/agents` with no login, a 401 `{"detail":"Unauthorized"}` is also a pass — it proves the network path works and the auth gate is doing its job, per this checklist's own note above.)
result:

### 5. Open the CodePulse UI in the laptop's browser and confirm live data
Go to `http://lmofficenew.tail5bb6b3.ts.net:5173/` (or whatever URL the office-PC-side fix from the BLOCKER note above ends up using — update this step if that changes).
expected: **as configured today, this is expected to FAIL** (the browser will be unable to connect, or the page will load with a disconnected Convex/WebSocket state) — see the BLOCKER note above. Once the office-PC-side fix is applied, the honest pass criterion is: the Dashboard page loads AND shows a non-zero Sessions count that matches (or is close to, if time has passed) the number the office PC's own `/health` probe reports at the same moment.
result:

### 6. Confirm the browser console is clean
With the CodePulse UI open on the laptop, open the browser DevTools console.
expected: no repeating Convex WebSocket connect/reconnect errors, no failed-fetch errors to `127.0.0.1` or `localhost` (those specific errors would confirm the BLOCKER above rather than a new problem).
result:

## Result

| Step | Pass/Fail | Note |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |

## Troubleshooting

**(i) A container can pass its own healthcheck and serve fine on the docker network while host port-publishing returns an empty reply.** Before concluding a service is down, probe several routes on that port from the office PC itself (not just the one the laptop tried) — an app answering every local route while every tailnet route returns nothing points at the publishing layer, not the app. (Project memory: `convex-topology-all-local`.)

**(ii) A service reachable at `localhost` but not `127.0.0.1` (or vice versa) is an IPv6/IPv4 binding mismatch, not a down service.** Some Node/Vite dev servers bind `::1` only. Check with `netstat -ano | findstr :<port>` on the office PC and look at which local address is LISTENING before assuming the process crashed.

**(iii) [Found live while writing this checklist] The CodePulse UI itself is unreachable from the tailnet today — two independent causes, two independent fixes, needs a decision before Step 5 can pass:**
- *Cause A — Vite's bind address.* Vite listens on `[::1]:5173` only. Running `vite --host 0.0.0.0` (or setting `server.host` in `vite.config.ts`) would expose it on all interfaces, including the tailnet. Tradeoff: this also exposes the dev server to every other device already on the tailnet, not just the laptop — worth a deliberate decision, not a silent default.
- *Cause B — baked-in localhost backend URLs.* `VITE_CONVEX_URL`, `VITE_ASTRIDR_API_URL`, and `VITE_ASTRIDR_WS_URL` in the office PC's `.env.local` all point at `127.0.0.1`/`localhost`, which only resolves to the office PC for a browser tab already running there. Repointing these three at the tailnet hostname (`https://lmofficenew.tail5bb6b3.ts.net` and the `:8443` site URL respectively, mirroring how `VITE_CONVEX_SITE_URL` is already configured) would make a laptop-loaded tab work — but `.env.local` cannot be edited under this project's env-file-guard rule, so this is a manual edit only Larry can make, followed by a Vite restart.
- If neither fix is applied, Step 5's "fail" result is expected, not evidence of a broken tailnet — the tailnet path itself (Steps 1-4) can be fully green while Step 5 still fails for these separate, already-diagnosed reasons.
