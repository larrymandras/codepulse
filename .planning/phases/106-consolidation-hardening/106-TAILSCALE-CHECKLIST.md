---
status: pending
phase: 106-consolidation-hardening
requirement: DEBT-03 (D-10)
written: 2026-08-04
revised: 2026-08-05
machine-of-record: lmofficenew.tail5bb6b3.ts.net (100.93.234.6)
---

# Tailscale Laptop Onboarding + Reachability Checklist

This checklist proves that Larry's laptop can reach the same self-hosted stack the office PC (`lmofficenew`) reaches, over Tailscale. Every endpoint below was read off the live office PC, not assumed from documentation. Claude cannot run any step in `## Steps` — Tailscale device auth and browser verification happen on the laptop itself.

**Revision note (2026-08-05):** this file was first written 2026-08-04 17:37. Two of the three blockers it recorded have since been resolved, one of its recorded probe results is no longer true, and one of its expected values was wrong on its own terms. Everything below has been re-measured today; the 2026-08-04 findings that changed are called out explicitly rather than silently overwritten, so the correction is auditable.

## Discovered endpoints

All command output and probe results in this section were captured on the office PC on **2026-08-05**.

### Raw `tailscale status` (office PC)

Executable used: `C:\Program Files\Tailscale\tailscale.exe` (not on `PATH` in this shell; invoked by full path).

```
100.93.234.6   lmofficenew    mandrasle@  windows  -
100.73.69.18   homeassistant  mandrasle@  linux    -
100.64.160.94  lmlaptop       mandrasle@  windows  offline, last seen 5m ago
100.81.2.115   srv1313241     mandrasle@  linux    -
```

Machine identity from `tailscale status --json` (field extract, not the full dump):

```
MagicDNSSuffix: tail5bb6b3.ts.net
Self.DNSName:   lmofficenew.tail5bb6b3.ts.net.
Self.HostName:  lmofficenew
Self.Online:    true
TailscaleIPs:   ["100.93.234.6","fd7a:115c:a1e0::6f38:ea07"]

peers:
  homeassistant | homeassistant.tail5bb6b3.ts.net. | 100.73.69.18  | online=true
  srv1313241    | srv1313241.tail5bb6b3.ts.net.    | 100.81.2.115  | online=true
  LMLaptop      | lmlaptop.tail5bb6b3.ts.net.      | 100.64.160.94 | online=false | LastSeen=2026-08-05T13:40:00Z | OS=windows
```

**Correction to D-10's premise:** D-10 frames this task as "adding Larry's laptop to the existing tailnet." The laptop is **already on the tailnet** as `LMLaptop` / `lmlaptop.tail5bb6b3.ts.net` (100.64.160.94) and was last seen **today, 2026-08-05 at 13:40 UTC** — it is simply not connected at this moment. Unless the machine you are onboarding is a *different* laptop, Steps 1-2 are confirmation steps, not installation steps.

(The 2026-08-04 capture of this file recorded `lmlaptop` as `"Online": true`. Today it reads `offline, last seen 5m ago`. Both readings are real; the device comes and goes. Its presence on the tailnet is the durable fact.)

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

```
https://lmofficenew.tail5bb6b3.ts.net:9443 (tailnet only)
|-- / proxy http://127.0.0.1:6791

https://lmofficenew.tail5bb6b3.ts.net (tailnet only)
|-- / proxy http://127.0.0.1:3210

https://lmofficenew.tail5bb6b3.ts.net:8443 (tailnet only)
|-- / proxy http://127.0.0.1:3211
```

Same three entries as `serve status`, every one marked `(tailnet only)`. **Nothing on this machine is exposed to the public internet** — no funnel is active (T-106-17 confirmed clean).

`tailscale debug prefs` (read-only) additionally reports `ShieldsUp: false`, i.e. Tailscale itself is not blocking inbound connections from tailnet peers. Whether a *given port* is reachable still depends on the Windows Firewall and on what the service binds to — see the probe table.

### What is actually behind each port

From `docker ps` and `Get-NetTCPConnection`:

| Local port | Owner | What it is | Published on the tailnet as |
|---|---|---|---|
| 3210 | container `convex-backend` (`0.0.0.0:3210`) | self-hosted Convex **client/backend API** — this is what `ConvexReactClient` talks to | `https://lmofficenew.tail5bb6b3.ts.net` (via `serve`, port 443) |
| 3211 | container `convex-backend` (`0.0.0.0:3211`) | Convex **HTTP-actions "site" server** — serves `/ingest`, `/runtime-ingest`, `/health` | `https://lmofficenew.tail5bb6b3.ts.net:8443` (via `serve`) |
| 6791 | container `convex-dashboard` (`0.0.0.0:6791`) | self-hosted Convex **admin Dashboard** (not needed for the app to work) | `https://lmofficenew.tail5bb6b3.ts.net:9443` (via `serve`) |
| 8181 | container `astridr-agent` (`0.0.0.0:8181`) | **Ástríðr API + telemetry WebSocket** | **not** published via `serve`; reached directly at `http://lmofficenew.tail5bb6b3.ts.net:8181` |
| 5173 | `node.exe` (Vite dev server, `::` all-interfaces) | **CodePulse UI** (kept alive by the `\CodePulseUI` scheduled task) | **not** published via `serve`; reached directly at `http://lmofficenew.tail5bb6b3.ts.net:5173` |

**Correction to CONTEXT.md D-10's `:8443` recollection.** `:8443` is real and live, and it is genuinely Convex — but it is the Convex **site/actions** server (local port 3211), *not* the backend the browser's Convex client connects to. The client-facing backend (local port 3210) is served at the **root tailnet URL with no port suffix**, `https://lmofficenew.tail5bb6b3.ts.net`. D-10 was right that Convex lives at `:8443`; it named the wrong one of the two Convex ports as "the backend." Both are needed and both are checked below.

### Two vendor URLs referenced by `## Steps`

These are Tailscale's own web properties, not endpoints of the office PC. They are listed here so that every URL used in `## Steps` is accounted for in this section:

- `https://tailscale.com/download` — Tailscale client download (only needed if the laptop is genuinely not installed).
- `https://login.tailscale.com/admin/machines` — Tailscale admin console, Machines list.

### Probe results (run from the office PC, to establish the expected healthy response)

| # | Endpoint | Probed as | Status | Body (first line) |
|---|---|---|---|---|
| P1 | `http://127.0.0.1:3210/version` | IPv4 loopback | 200 | `unknown` |
| P2 | `http://localhost:3210/version` | hostname | 200 | `unknown` |
| P3 | `http://[::1]:3210/version` | IPv6 loopback | 200 | `unknown` |
| P4 | `http://127.0.0.1:3210/instance_name` | IPv4 loopback | 200 | `codepulse` |
| P5 | `https://lmofficenew.tail5bb6b3.ts.net/version` | tailnet HTTPS | 200 | `unknown` |
| P6 | `https://lmofficenew.tail5bb6b3.ts.net/instance_name` | tailnet HTTPS | 200 | `codepulse` |
| P7 | `http://127.0.0.1:3211/health` | IPv4 loopback | 200 | `{"status":"ok","timestamp":1785937610367,"version":"0.1.0","sessions":20,"activeAlerts":1}` |
| P8 | `http://localhost:3211/health` | hostname | 200 | same shape |
| P9 | `https://lmofficenew.tail5bb6b3.ts.net:8443/health` | tailnet HTTPS | 200 | `{"status":"ok","timestamp":1785937626950,"version":"0.1.0","sessions":20,"activeAlerts":1}` |
| P10 | `https://lmofficenew.tail5bb6b3.ts.net:9443/` | tailnet HTTPS | 200 | `<!DOCTYPE html>…<title>Convex Dashboard</title>` |
| P11 | `http://127.0.0.1:8181/api/health` | IPv4 loopback | 200 | `{"status":"ok","channel":"web"}` |
| P12 | `http://lmofficenew.tail5bb6b3.ts.net:8181/api/health` | tailnet, plain HTTP | 200 | `{"status":"ok","channel":"web"}` |
| P13 | `http://127.0.0.1:8181/api/status` (no auth header) | IPv4 loopback | 401 | `{"detail":"Unauthorized"}` |
| P14 | `http://lmofficenew.tail5bb6b3.ts.net:8181/api/status` (no auth header) | tailnet, plain HTTP | 401 | `{"detail":"Unauthorized"}` |
| P15 | `http://127.0.0.1:8181/ws/telemetry` (WebSocket upgrade, no bearer subprotocol) | IPv4 loopback | 403 | *(empty body)* |
| P16 | `http://lmofficenew.tail5bb6b3.ts.net:8181/ws/telemetry` (WebSocket upgrade, no bearer subprotocol) | tailnet, plain HTTP | 403 | *(empty body)* |
| P17 | `http://127.0.0.1:5173/` | IPv4 loopback | 200 | `<!DOCTYPE html><html lang="en" class="dark">` |
| P18 | `http://localhost:5173/` | hostname | 200 | same |
| P19 | `http://[::1]:5173/` | IPv6 loopback | 200 | same |
| P20 | `http://100.93.234.6:5173/` | tailnet IP | 200 | same |
| P21 | `http://lmofficenew.tail5bb6b3.ts.net:5173/` | tailnet MagicDNS | **403 → 200** | was `Blocked request. This host … is not allowed.`; **fixed today**, see below |

Reading the probes:

- **P13/P14 (401) and P15/P16 (403) are passes, not failures.** A 401 on `/api/status` and a 403 on the WebSocket upgrade mean the request *reached the Ástríðr app* and its auth gate rejected an anonymous caller — which is exactly correct behaviour. The network path is what these probes prove, and it works over the tailnet identically to loopback. `/ws/telemetry` expects the bearer as a `Sec-WebSocket-Protocol` subprotocol, which `curl` cannot supply; a 403 there is the auth gate, **not** a down service.
- **The authenticated `Authorization: Bearer` probe the plan asked for was deliberately not run.** The token lives in `.env.local`, which this project's rules and the env-file-guard hook both forbid reading, and it is not present in this shell's environment (checked by name, value never printed). Putting it on a command line would have echoed it into the session transcript — the exact thing T-106-16 forbids. The unauthenticated 401/403 pair above already proves the network path and the auth gate, and Step 4 has Larry exercise the real authenticated path through his own browser session, which is the load-bearing proof anyway. **No credential value appears anywhere in this file.**
- **P3/P19 cover the `::1`-only-binding trap** called out in this project's LESSONS. Both loopback families answer on both services; neither is IPv6-only.

### Resolved frontend configuration (read from the live dev bundle, not from `.env.local`)

Vite inlines `import.meta.env.VITE_*` into the modules it serves, so the office PC's *effective* configuration can be read from the running dev server without touching the `.env` file. Extracting only URL-shaped values from `http://127.0.0.1:5173/src/main.tsx`:

```
"VITE_CONVEX_URL":       "https://lmofficenew.tail5bb6b3.ts.net"
"VITE_CONVEX_SITE_URL":  "https://lmofficenew.tail5bb6b3.ts.net:8443"
"VITE_ASTRIDR_API_URL":  "http://lmofficenew.tail5bb6b3.ts.net:8181"
"VITE_ASTRIDR_WS_URL":   "ws://127.0.0.1:8181"
```

**Config finding — `VITE_ASTRIDR_WS_URL` is the one value in this set that is not tailnet-qualified.** Three of the four resolve to `lmofficenew.tail5bb6b3.ts.net`, which means the same thing on every device on the tailnet. The fourth is `ws://127.0.0.1:8181`, which is *host-relative*: it means "this machine," so it silently means something different in a tab on the laptop than in a tab on the office PC. Nothing about Tailscale can compensate for that.

Its two read sites, both confirmed by reading the files:

- `src/contexts/AstridrWSContext.tsx:230` — `const wsUrl = (import.meta.env.VITE_ASTRIDR_WS_URL as string | undefined) ?? "ws://localhost:8181";`, with line 231 appending `/ws/telemetry`. `AstridrWSProvider` is mounted app-wide in the provider stack (`src/App.tsx:99`) and `DashboardLayout.tsx:402` renders its `status`, so this socket is attempted on **every page**, not just one.
- `src/components/ConnectionPopover.tsx:24` — same env var, different fallback (`ws://localhost:8765`). The fallbacks only apply if the var is unset; it is set, so both sites use `ws://127.0.0.1:8181`.

See Blocker B below for the consequence and the fix.

(2026-08-04 recorded `VITE_CONVEX_URL = http://127.0.0.1:3210` and `VITE_ASTRIDR_API_URL = http://localhost:8181`. Those were repointed at the tailnet between then and now. That change is real and is why the old file's "Cause B" is now only one-quarter outstanding.)

### Live values a laptop-side check can be compared against

Read from the self-hosted Convex with a read-only public query (`heroStats:summary`, no write, no admin key), at the same moment as the probes above:

```
activeSessions: 279     runningAgents: 493
activeAlerts:   1       criticalAlerts: 0
errorRate:      0       health: "green"
eventsThisHour: 500     knownTools: 396
```

**Do not compare the Dashboard's Sessions tile against `/health`'s `sessions` field.** They are different numbers by construction: `/health` returns `sessions.listActive`, which is `.take(20)`-capped, so it reads `20` whenever there are 20 or more active sessions; the Hero Stats Bar's Sessions tile reads `heroStats.summary.activeSessions`, which is uncapped and currently **279**. The 2026-08-04 version of this file told Larry to compare those two and call a match a pass — that expectation was wrong and would have produced a false FAIL. Step 5 below uses a comparison that actually holds.

### Blockers

**Blocker A — Vite rejected the MagicDNS hostname. FIXED 2026-08-05 (`vite.config.ts`).**
`host: true` (added 2026-08-04 by commit `bbfdae78` during the first pass at this plan) made Vite listen on all interfaces, so `http://100.93.234.6:5173/` returned 200. But Vite's DNS-rebinding guard still rejected the *hostname* form: `http://lmofficenew.tail5bb6b3.ts.net:5173/` returned **403 `Blocked request. This host ("lmofficenew.tail5bb6b3.ts.net") is not allowed.`** Vite's own error names the fix. `server.allowedHosts: ["lmofficenew.tail5bb6b3.ts.net"]` was added — a single explicit host, not `true` and not a wildcard, so no other name gains access. Re-probed after the dev server auto-restarted: MagicDNS 200, and `localhost` / `127.0.0.1` / `100.93.234.6` all still 200 (no regression). This is P21 above.

**Blocker B — `VITE_ASTRIDR_WS_URL` still points at loopback. NOT FIXED — Larry-only.**
`VITE_ASTRIDR_WS_URL = ws://127.0.0.1:8181`. `src/contexts/AstridrWSContext.tsx:231` appends `/ws/telemetry` to it, so the URL the browser actually dials is `ws://127.0.0.1:8181/ws/telemetry`. `AstridrWSProvider` wraps the whole app (`src/App.tsx:99`) and `DashboardLayout` renders its `status` on every page, so a browser tab **on the laptop** will resolve `127.0.0.1` to the laptop, find nothing, and sit in a reconnect loop showing `Disconnected`. The Convex data path is unaffected (that URL is correct), so the Dashboard will still render live numbers — but the Ástríðr connection indicator will be red and the console will show repeated WebSocket failures.
The one-line change is in the office PC's `.env.local`:
`VITE_ASTRIDR_WS_URL=ws://lmofficenew.tail5bb6b3.ts.net:8181`
followed by a Vite restart. Claude cannot make this edit — `.env` files are blocked by this project's env-file-guard for read *and* write. Steps 6 and 7 are written to distinguish this known cause from a new one.

## Steps

Work through these on the **laptop**. Compare each result against its `expected:` line and record what actually happened on the `result:` line.

### 1. Confirm the laptop is on the tailnet
Run `tailscale status` on the laptop. Install from `https://tailscale.com/download` and sign in to the same account first *only if* Tailscale is genuinely not present — per `## Discovered endpoints`, a Windows device named `LMLaptop` (100.64.160.94) is already a member of this tailnet and was last seen 2026-08-05 13:40 UTC.
expected: the laptop's `tailscale status` lists `lmofficenew` at `100.93.234.6`, and the laptop's own line shows `100.64.160.94` (or a new IP, if this is a different machine than the `LMLaptop` already registered — say which).
result:

### 2. Confirm the device is approved, not pending
Open `https://login.tailscale.com/admin/machines`.
expected: the laptop appears in the Machines list as connected, with no "Needs approval" / "Expired" badge against it.
result:

### 3. Reach the self-hosted Convex backend from the laptop
Open `https://lmofficenew.tail5bb6b3.ts.net/instance_name` and `https://lmofficenew.tail5bb6b3.ts.net:8443/health` in a browser (or `curl` them).
expected: the first returns HTTP 200 with the exact body `codepulse` (probe P6). The second returns HTTP 200 with a JSON body beginning `{"status":"ok","timestamp":` and containing `"version":"0.1.0"` (probe P9) — the `sessions` and `activeAlerts` numbers will differ from P9's, that is fine and expected; what must hold is `"status":"ok"`, not an error page and not a TLS warning.
result:

### 4. Reach the Ástríðr API from the laptop
Open `http://lmofficenew.tail5bb6b3.ts.net:8181/api/health`, then `http://lmofficenew.tail5bb6b3.ts.net:8181/api/status`.
expected: `/api/health` returns HTTP 200 with the exact body `{"status":"ok","channel":"web"}` (probe P12). `/api/status` returns HTTP **401** with body `{"detail":"Unauthorized"}` (probe P14) — **that 401 is a pass**: it proves the request crossed the tailnet and reached Ástríðr's auth gate. A connection timeout or "site can't be reached" on either is the failure to record.
result:

### 5. Open the CodePulse UI on the laptop and confirm it shows live data
Go to `http://lmofficenew.tail5bb6b3.ts.net:5173/`. (If that fails, also try `http://100.93.234.6:5173/` and say which of the two worked — the IP form was already proven at P20, the hostname form was fixed today at P21.)
expected: the Dashboard renders, and the **Hero Stats Bar** ("Live Metrics") **Sessions** tile shows a number in the hundreds — it read **279** with a `493 agents` sub-label when this was written. The load-bearing check: open the same Dashboard on the office PC at `http://localhost:5173/` at the same moment; **both machines must show the same Sessions number**, because both read the same self-hosted Convex. A laptop showing `0`, `—`, or a blank tile while the office PC shows a live number is a FAIL, not a slow load.
result:

### 6. Check the Ástríðr connection indicator in the header
With the Dashboard open on the laptop, look at the connection status in the header/`ConnectionPopover`.
expected: **this is expected to read `Disconnected` today** — Blocker B above, `VITE_ASTRIDR_WS_URL` is still `ws://127.0.0.1:8181`. Record what it actually says. If it reads `Connected`, Blocker B was fixed before you ran this and you should say so. If it reads `Disconnected`, that is the known cause and does **not** invalidate Steps 3-5.
result:

### 7. Confirm the browser console shows no *unexpected* connection errors
Open DevTools → Console on the laptop's Dashboard tab and reload. This step is scored on the **host each error names**, not on the error count — sort what you see into these three buckets before marking it.

expected: mark this step **PASS** if the only connection errors name `127.0.0.1:8181` (or `localhost:8181`) — those are the known Blocker B, a config bug in `VITE_ASTRIDR_WS_URL`, and they say nothing about Tailscale. Mark it **FAIL** if any error names `lmofficenew.tail5bb6b3.ts.net` — that is the Convex/tailnet path and it must be clean (no failed queries, no websocket reconnect loop against that host). An error naming any **third** host is a new finding: copy its exact text and mark FAIL. A console with no connection errors at all is also a PASS and means Blocker B was fixed before you ran this.
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
| 7 | | |

## Troubleshooting

**(i) A container can pass its own healthcheck and serve fine on the docker network while host port-publishing returns an empty reply.** Before concluding a service is down, probe several routes on that port from the office PC itself, not just the one route the laptop tried. One stack answering every local route while every tailnet route returns nothing points at the publishing layer, not the app. Escalation order that has actually worked here: `docker restart <container>` first, `docker compose up -d --force-recreate` only if that fails. (Project memory: `convex-topology-all-local`.)

**(ii) A service reachable at `localhost` but not `127.0.0.1` (or vice versa) is an IPv4/IPv6 binding mismatch, not a down service.** Some Node/Vite servers bind `::1` only. Check `Get-NetTCPConnection -State Listen -LocalPort <port>` on the office PC and read the `LocalAddress` column before assuming the process crashed. Probes P1-P3 and P17-P19 above show both loopback families currently answer on both services, so a one-sided failure would be new.

**(iii) HTTP 403 with the body `Blocked request. This host … is not allowed.` is Vite's DNS-rebinding guard, not a network problem.** The tailnet path is working; Vite is refusing the `Host:` header. The fix is `server.allowedHosts` in `vite.config.ts` — Vite's own error message names the host to add. This was Blocker A, fixed 2026-08-05. If it reappears under a *different* hostname, add that hostname explicitly; do not set `allowedHosts: true`, which disables the guard for every host.

**(iv) A 401 or 403 from Ástríðr is reachability proof, not a failure.** `/api/status` returns 401 and `/ws/telemetry` returns 403 to any unauthenticated caller, from loopback and from the tailnet alike (P13-P16). Only a timeout, a DNS failure, or "site can't be reached" indicates the tailnet path is broken.

**(v) If port 5173 or 8181 times out from the laptop while 443/8443/9443 work, suspect the Windows Firewall, not Tailscale.** The `serve`-published ports (443/8443/9443) are terminated by Tailscale itself and never traverse the host firewall; 5173 and 8181 are direct connections that do. The Tailscale adapter is categorised `Private` on this machine, and `node.exe` has enabled inbound Allow rules on both the Private and Public profiles — but Docker-published 8181 depends on Docker Desktop's own rules. There is no port-specific rule for 5173 or 8181; if either times out from the laptop, that is where to look first.

**(vi) To make the Ástríðr WebSocket work from the laptop, repoint one env var on the OFFICE PC.** This is the fix for Blocker B and for a Step-6 `Disconnected` / Step-7 `127.0.0.1:8181` result. Edit `C:\Users\mandr\codepulse\.env.local` by hand and change:

```
VITE_ASTRIDR_WS_URL=ws://127.0.0.1:8181
```

to:

```
VITE_ASTRIDR_WS_URL=ws://lmofficenew.tail5bb6b3.ts.net:8181
```

then restart the Vite dev server (the `\CodePulseUI` scheduled task supervises it) — Vite reads `.env` files at start, not per-request, so an unrestarted server keeps serving the old value. **Claude cannot make this edit**: `.env` files are blocked for read and write by this project's env-file-guard hook, and this one is yours. Note the tradeoff before applying it: the tailnet hostname also resolves *from the office PC*, so this change is safe there and is not a laptop-only setting. After restarting, re-run Steps 6 and 7 — the indicator should read `Connected` and the `127.0.0.1:8181` console errors should be gone.
