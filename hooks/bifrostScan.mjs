/**
 * bifrostScan.mjs — the Bifröst curation loop: scan the machine, propose links,
 * write only what the operator confirms.
 *
 * This is the piece the Phase 117 design doc named as the whole reason the
 * link-hub pattern was worth copying ("Workspace-scan → propose → confirm →
 * write curation loop") and that the phase then deferred at D-06. Without it the
 * only intake path is typing into a dialog, which is why the hub sat at 2 links.
 *
 * ─── The one design rule ───────────────────────────────────────────────────
 * EVERY proposed link is HTTP-probed before it is proposed. Nothing is inferred
 * from a port number, an image name, or a compose file. A published port is a
 * claim that something *might* be listening; a 200/302/401/404 is evidence that
 * something *is*. This matters because the alternative — enumerating ports and
 * guessing — produces a hub full of dead URLs, and a launcher whose entries
 * might not work is worse than no launcher.
 *
 * The same rule is why a container publishing three ports does not yield three
 * links: only the ports that actually answer do.
 *
 * ─── What it does NOT do ───────────────────────────────────────────────────
 * It never writes on its own. `scan` prints JSON and exits; `apply` writes only
 * the entries handed back to it. The confirm step lives in the skill, with the
 * operator, exactly as the donor pattern specified — an auto-writing scanner
 * would be curating the hub *for* Larry, which is the one thing a curated hub
 * must not do.
 *
 * Writes go through the Convex CLI (`bifrost:createLink`), deliberately, rather
 * than POSTing the ungated `/api/mutation` endpoint. That endpoint does work
 * (repo CLAUDE.md documents it), but building a tool on it would establish
 * unauthenticated writes as a convention here. The CLI path is slower and
 * correct; this is a once-in-a-while operation and can afford it. See
 * `convexCli` for why it is not spawned as `npx`.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ===========================================================================
// Pure helpers — everything below this line up to the IO section is testable
// with no Docker, no network and no Convex.
// ===========================================================================

/**
 * Container ports that speak a protocol a browser link cannot use. A published
 * Postgres port is a real service, but "open http://localhost:5432" is never
 * the right link, and the HTTP probe would reject it anyway after burning a
 * timeout. Filtering here keeps the probe list honest and fast.
 */
export const NON_HTTP_CONTAINER_PORTS = new Set([
  5432, // postgres
  3306, // mysql
  27017, // mongodb
  6379, // redis
  5672, // amqp
  9092, // kafka
  11211, // memcached
]);

/**
 * `docker ps --format "{{.Ports}}"` emits one comma-separated list mixing
 * PUBLISHED mappings ("0.0.0.0:8181->8181/tcp") with merely-EXPOSED container
 * ports ("8080/tcp"). Only the former is reachable from the host, so only the
 * former can become a link.
 *
 * IPv4 and IPv6 are listed as separate entries for the same publish
 * ("0.0.0.0:8090->8090/tcp, [::]:8090->8090/tcp"), so host ports are
 * de-duplicated — otherwise every container would propose each link twice.
 *
 * Ranges ("0.0.0.0:3210-3211->3210-3211/tcp") expand to each port in the range;
 * convex-backend publishes exactly this shape and 3210 is the one that matters.
 */
export function parsePublishedPorts(portsStr) {
  const out = [];
  const seen = new Set();
  if (!portsStr) return out;

  for (const chunk of String(portsStr).split(",")) {
    const entry = chunk.trim();
    if (!entry || !entry.includes("->")) continue; // exposed-only, not published

    const [left, right] = entry.split("->");
    // Host side: strip the bind address, keeping only the port(s).
    const hostPart = left.trim().replace(/^\[?[0-9a-f.:]*\]?:/i, "");
    // Container side: "8080/tcp" or "3210-3211/tcp"
    const containerPart = right.trim().replace(/\/(tcp|udp)$/i, "");
    if (/\/udp$/i.test(right.trim())) continue; // a UDP publish is never a link

    const hostRange = expandRange(hostPart);
    const containerRange = expandRange(containerPart);
    if (hostRange.length === 0) continue;

    for (let i = 0; i < hostRange.length; i++) {
      const host = hostRange[i];
      const container = containerRange[i] ?? containerRange[0] ?? host;
      if (!Number.isFinite(host) || seen.has(host)) continue;
      seen.add(host);
      out.push({ host, container });
    }
  }
  return out;
}

function expandRange(text) {
  const m = String(text).match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return [];
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  if (end < start || end - start > 64) return [start]; // guard a silly range
  const out = [];
  for (let p = start; p <= end; p++) out.push(p);
  return out;
}

/** `docker ps` rows, one per line, pipe-delimited by the caller's --format. */
export function parseDockerPs(stdout) {
  const rows = [];
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, ports, image, state] = line.split("|");
    if (!name) continue;
    rows.push({
      name: name.trim(),
      ports: (ports ?? "").trim(),
      image: (image ?? "").trim(),
      state: (state ?? "").trim(),
    });
  }
  return rows;
}

/**
 * Icon names are keys into `src/lib/navRegistry.ts`'s `iconComponents` map —
 * NEVER arbitrary strings. `LinkCard` looks the name up there and silently
 * falls back to a generic glyph on a miss, so a typo here degrades quietly
 * instead of erroring. Anything not confidently recognised gets NO icon rather
 * than a guessed one; the fallback is the honest default.
 */
export const ICONS = {
  astridr: "bot",
  supabaseStudio: "boxes",
  supabaseMail: "inbox",
  supabaseApi: "network",
  convex: "server",
  trading: "chart",
  gateway: "terminal",
};

/**
 * Turns a container name into a human title and category. Recognition is by
 * explicit pattern, not by cleverness: an unrecognised container still gets a
 * usable title (its own name) and lands in a catch-all category, because
 * dropping it would hide a service that genuinely answered an HTTP probe.
 */
export function classifyContainer(name) {
  const n = String(name || "");

  // supabase_<service>_<project> — the local-dev stacks.
  //
  // The service class is [a-z0-9] and NOT \w on purpose: \w includes the
  // underscore, and being greedy it swallowed the separator, splitting
  // "supabase_inbucket_global-legal-crisis" into service "inbucket_global" and
  // project "legal-crisis". Every multi-segment project name mis-parsed that
  // way, and the damage was a wrong TITLE rather than an error — the kind of
  // defect that ships looking fine.
  const sb = n.match(/^supabase[_-]([a-z0-9]+)[_-](.+)$/i);
  if (sb) {
    const [, service, project] = sb;
    const svc = service.toLowerCase();
    if (svc === "studio") {
      return { title: `Supabase Studio — ${project}`, category: "supabase", icon: ICONS.supabaseStudio };
    }
    if (svc === "inbucket" || svc === "mailpit") {
      return { title: `Supabase Mail — ${project}`, category: "supabase", icon: ICONS.supabaseMail };
    }
    if (svc === "kong") {
      return { title: `Supabase API — ${project}`, category: "supabase", icon: ICONS.supabaseApi };
    }
    if (svc === "analytics") {
      return { title: `Supabase Analytics — ${project}`, category: "supabase", icon: ICONS.supabaseStudio };
    }
    return { title: `Supabase ${service} — ${project}`, category: "supabase", icon: ICONS.supabaseApi };
  }

  if (/^astridr[-_]cli[-_]gateway/i.test(n)) {
    return { title: "Ástríðr CLI Gateway", category: "astridr", icon: ICONS.gateway };
  }
  if (/^astridr/i.test(n)) {
    const suffix = n.replace(/^astridr[-_]?/i, "").replace(/[-_]/g, " ").trim();
    return {
      title: suffix ? `Ástríðr ${suffix}` : "Ástríðr",
      category: "astridr",
      icon: ICONS.astridr,
    };
  }
  if (/^convex/i.test(n)) {
    return { title: "Convex backend", category: "infrastructure", icon: ICONS.convex };
  }
  if (/^trading/i.test(n)) {
    const suffix = n.replace(/^trading[-_]?/i, "").replace(/[-_]/g, " ").trim();
    return {
      title: suffix ? `Trading ${suffix}` : "Trading",
      category: "trading",
      icon: ICONS.trading,
    };
  }

  return { title: n, category: "local services", icon: undefined };
}

/**
 * URL equality for dedupe. Trailing slashes and default ports are cosmetic, and
 * `localhost` / `127.0.0.1` are the same machine — treating them as distinct
 * would re-propose a link the operator already has, every single run, which is
 * how a scan tool teaches you to stop reading its output.
 */
export function normalizeUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  // Parsed, not string-chopped. The hand-rolled version this replaces applied
  // its rewrites in sequence, and the sequence was wrong in two ways that a
  // measurement caught and a reading did not:
  //
  //   `http://localhost:80`  -> "127.0.0.1"      (":80$" matched)
  //   `http://localhost:80/` -> "127.0.0.1:80"   (":80$" did NOT match, the
  //                                               trailing slash was still on)
  //
  // Two spellings of one URL producing two keys is precisely the duplicate this
  // function exists to prevent. It also stripped `:80` and `:443` regardless of
  // scheme, so `http://localhost:443` collapsed to a bare host as though 443
  // were its default port.
  //
  // The WHATWG parser gets both right on its own: it drops a port only when it
  // is the default FOR THAT SCHEME, and it normalises the path, so `:80` stays
  // put under https and disappears under http without any special-casing here.
  let u;
  try {
    u = new URL(raw.includes("://") ? raw : `http://${raw}`);
  } catch {
    // An unparseable string is still an identity — just a degenerate one.
    // Returning it lowercased keeps dedupe working rather than throwing on a
    // hand-typed hub entry that was never a valid URL.
    return raw.toLowerCase();
  }

  let host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "[::1]" || host === "::1") {
    host = "127.0.0.1";
  }

  // The SCHEME is deliberately absent from the returned key — see
  // `schemeMismatches` for why identity stays scheme-insensitive and the
  // disagreement is reported instead of encoded here.
  const port = u.port ? `:${u.port}` : "";
  const path = u.pathname.replace(/\/+$/, "");
  return `${host}${port}${path}${u.search}`;
}

/** Candidates whose URL the hub does not already hold. */
export function dropExisting(candidates, existingUrls) {
  const have = new Set(existingUrls.map(normalizeUrl));
  return candidates.filter((c) => !have.has(normalizeUrl(c.url)));
}

/**
 * A page's own <title> beats any name derived from a container or a port —
 * it is what the service calls itself. Capped and sanitised because this string
 * ends up in the command palette: newlines and runaway lengths would wreck the
 * row layout. Returns null (not "") when there is nothing usable, so the caller
 * can fall back rather than write an empty title.
 */
export function titleFromHtml(html) {
  if (!html) return null;
  const m = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const text = m[1]
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  if (!text) return null;
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

/**
 * A page's <title> is usually the best name available — but an ERROR page has a
 * title too, and it is never a name. Measured against this machine, the probe
 * harvested "400 The plain HTTP request was sent to HTTPS port", "Error" and
 * "Service Unavailable" as proposed link titles. Those are worse than the
 * derived fallback because they look deliberate.
 *
 * Anything starting with a 3-digit status, or matching a known error-page
 * title, is rejected in favour of the derived name.
 */
const JUNK_TITLES = new Set([
  "error",
  "not found",
  "bad request",
  "forbidden",
  "unauthorized",
  "service unavailable",
  "internal server error",
  "bad gateway",
  "gateway timeout",
  "problem loading page",
]);

export function isJunkTitle(title) {
  if (!title) return true;
  const t = String(title).trim().toLowerCase();
  if (!t) return true;
  if (/^\d{3}\b/.test(t)) return true; // "400 The plain HTTP request was..."
  return JUNK_TITLES.has(t);
}

/** The page's own name when it is usable; the derived name otherwise. */
export function chooseTitle(probedTitle, derivedTitle) {
  return isJunkTitle(probedTitle) ? derivedTitle : probedTitle;
}

/**
 * Makes every proposed title unique.
 *
 * Measured on this machine: three separate Supabase mail servers all render
 * `<title>Mailpit</title>`, so taking the page title verbatim produced three
 * indistinguishable "Mailpit" rows — in a LAUNCHER, where the entire job of the
 * title is to tell them apart. The derived name carries the project qualifier
 * the page title lacks, so a collision falls back to it.
 *
 * When the derived names collide too (convex-backend publishes both 3210 and
 * 3211), the port is appended — it is the only thing left that differs, and an
 * ambiguous name is worse than an ugly one.
 */
export function disambiguateTitles(proposals) {
  const byTitle = new Map();
  for (const p of proposals) {
    const list = byTitle.get(p.title) ?? [];
    list.push(p);
    byTitle.set(p.title, list);
  }

  const out = proposals.map((p) => ({ ...p }));
  for (const [, group] of byTitle) {
    if (group.length < 2) continue;
    const derived = group.map((g) => g.derivedTitle);
    const derivedUnique = new Set(derived).size === derived.length;
    for (const p of group) {
      const target = out.find((o) => o.url === p.url);
      if (!target) continue;
      target.title = derivedUnique
        ? p.derivedTitle
        : `${p.title} (${portOf(p.url)})`;
    }
  }
  return out;
}

function portOf(url) {
  const m = String(url).match(/:(\d+)(?:\/|$)/);
  return m ? m[1] : "";
}

function schemeOf(url) {
  const m = String(url).match(/^(https?):/i);
  return m ? m[1].toLowerCase() : "";
}

/**
 * Candidates that match an existing link EXCEPT for the scheme.
 *
 * `normalizeUrl` strips the scheme deliberately — a hub entry hand-typed as
 * `https://foo` and a scan proposing `http://foo` are the same link, and
 * treating them as distinct would duplicate it. But that same insensitivity
 * silently swallows the one case where the difference is the whole point: the
 * TLS retry can UPGRADE a candidate to `https://`, and if the hub already holds
 * the broken `http://` entry for that port, the repaired proposal is dropped as
 * a duplicate and the stale entry stays broken forever.
 *
 * Rather than making identity scheme-sensitive (which reintroduces the
 * duplicates the insensitivity prevents), the suppression is REPORTED. The
 * operator sees that an existing link disagrees with what the port actually
 * speaks, and can fix it — which is the propose-don't-decide contract this tool
 * runs on, applied to its own blind spot.
 */
export function schemeMismatches(candidates, existingUrls) {
  const byKey = new Map();
  for (const u of existingUrls) byKey.set(normalizeUrl(u), u);

  const out = [];
  for (const c of candidates) {
    const existing = byKey.get(normalizeUrl(c.url));
    if (!existing) continue;
    if (schemeOf(existing) !== schemeOf(c.url)) {
      out.push({
        title: c.probedTitle || c.title,
        existingUrl: existing,
        actualUrl: c.url,
      });
    }
  }
  return out;
}

/**
 * Splits an apply set into what to create and what already exists.
 *
 * This is what makes `apply` RETRY-SAFE, and it is not a nicety. `createLink`
 * (convex/bifrost.ts) inserts unconditionally — there is no URL uniqueness
 * anywhere in the schema or the mutation — so re-running the same confirmed
 * file after a partial failure would insert every previously-successful item a
 * second time. The only cleanup available is soft-archiving each duplicate by
 * hand.
 *
 * Deliberately fixed HERE rather than in the mutation, even though the mutation
 * is where a uniqueness constraint conceptually belongs: `QuickAddDialog`
 * (src/pages/Bifrost.tsx) calls `createLink` as a bare `void createLink(input)`
 * with no error handling, so making the mutation throw on a duplicate would
 * turn the Add-link dialog into a silent no-op. Adding uniqueness there needs a
 * UI error path as its companion — a separate change to a shipped surface, not
 * a side effect of this tool.
 *
 * Also re-checked at APPLY time rather than trusting the scan's own filter,
 * which closes the window between scanning and confirming.
 */
export function partitionForApply(items, existingUrls) {
  const have = new Set(existingUrls.map(normalizeUrl));
  const toCreate = [];
  const skipped = [];
  for (const item of items) {
    const key = normalizeUrl(item.url);
    // Guards the within-file case too: a confirmed list containing the same URL
    // twice must not create it twice.
    if (have.has(key)) {
      skipped.push(item);
      continue;
    }
    have.add(key);
    toCreate.push(item);
  }
  return { toCreate, skipped };
}

/**
 * `netstat -ano -p tcp` LISTENING lines → distinct host ports.
 *
 * Ports below 1024 are dropped: on Windows those are system services (RPC, SMB,
 * NetBIOS) that are never a link the operator wants, and probing them wastes a
 * timeout each. Everything above is kept and left for the HTTP probe to judge —
 * the probe is the filter, not a port guess.
 */
export function parseNetstatListeners(stdout, { minPort = 1024 } = {}) {
  const ports = new Set();
  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!/LISTENING/i.test(line)) continue;
    const cols = line.trim().split(/\s+/);
    const local = cols[1];
    if (!local) continue;
    const m = String(local).match(/:(\d+)$/);
    if (!m) continue;
    const port = Number(m[1]);
    if (Number.isFinite(port) && port >= minPort) ports.add(port);
  }
  return [...ports].sort((a, b) => a - b);
}

// ===========================================================================
// IO
// ===========================================================================

const ENV_FILE =
  process.env.CONVEX_ENV_FILE ||
  "C:\\Users\\mandr\\convex-selfhost\\selfhosted.envfile";

/** Hard ceiling on probes, so a machine with hundreds of listeners cannot turn
 *  a scan into a multi-minute hang. Any drop is REPORTED, never silent. */
export const MAX_PROBES = 300;
const PROBE_TIMEOUT_MS = 1500;
const PROBE_CONCURRENCY = 16;

function sh(cmd, args) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
}

/**
 * The Convex CLI, invoked as plain JS through the current node binary.
 *
 * NOT `npx convex`: on Windows `npx` resolves to `npx.cmd`, which
 * `execFileSync` cannot spawn without `shell: true` — and turning the shell on
 * would hand our JSON argument to cmd.exe's parser, which strips the inner
 * double quotes and turns `{"linkId":"abc"}` into `{linkId:abc}`. (That exact
 * mangling is a live failure mode, seen once already this session when the same
 * JSON was passed through PowerShell.)
 *
 * Calling `bin/main.js` directly keeps the argv array intact end to end: no
 * shell, no quoting layer, no `.cmd` resolution.
 */
function convexCli(args) {
  return sh(process.execPath, ["node_modules/convex/bin/main.js", ...args]);
}

/**
 * One HTTP GET. ANY complete HTTP response counts as "something is serving
 * here" — including 401 and 404. A service that requires auth or has no route
 * at `/` is still a service worth linking; demanding a 200 would silently drop
 * exactly the dashboards that sit behind a login.
 */
async function probe(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    let title = null;
    const ctype = res.headers.get("content-type") || "";
    if (/text\/html/i.test(ctype)) {
      try {
        title = titleFromHtml(await res.text());
      } catch {
        title = null; // a body that will not read is not a reason to drop the hit
      }
    }
    return { alive: true, status: res.status, title };
  } catch {
    return { alive: false, status: null, title: null };
  }
}

/**
 * Probe, and if the server says "you spoke HTTP to an HTTPS port", believe it
 * and try again over TLS.
 *
 * This is not speculative: port 55430 on this machine answers plain HTTP with
 * exactly that 400, and without the retry it was proposed as a link titled
 * "400 The plain HTTP request was sent to HTTPS port" pointing at a URL that
 * cannot work. One retry turns a guaranteed-broken proposal into a correct one.
 */
async function probeWithTlsRetry(url) {
  const first = await probe(url);
  const saysTls =
    first.alive &&
    first.status === 400 &&
    /sent to https/i.test(String(first.title || ""));
  if (!saysTls) return { ...first, url };

  const httpsUrl = url.replace(/^http:/, "https:");
  const second = await probe(httpsUrl);
  if (second.alive) return { ...second, url: httpsUrl };

  // The TLS probe failed, but we still upgrade the URL. The server ITSELF said
  // this port speaks HTTPS, and that is better evidence than our probe's
  // silence — Node's fetch rejects self-signed certificates, which is exactly
  // what a local dev service presents, so a failed TLS probe here is the
  // expected outcome rather than a signal the port is dead.
  //
  // The title is dropped rather than kept: `first.title` is the 400 error page,
  // which `isJunkTitle` would reject anyway, and carrying it forward would only
  // risk it surviving into a link name.
  return { ...first, title: null, url: httpsUrl };
}

async function probeAll(candidates, onProgress) {
  const results = [];
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < candidates.length) {
      const c = candidates[cursor++];
      const r = await probeWithTlsRetry(c.url);
      done++;
      if (onProgress) onProgress(done, candidates.length);
      // `r.url`, not `c.url` — the TLS retry may have upgraded the scheme.
      if (r.alive) {
        results.push({ ...c, url: r.url, status: r.status, probedTitle: r.title });
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PROBE_CONCURRENCY, candidates.length) }, worker)
  );
  return results;
}

function dockerCandidates() {
  let stdout = "";
  try {
    stdout = sh("docker", ["ps", "--format", "{{.Names}}|{{.Ports}}|{{.Image}}|{{.State}}"]);
  } catch {
    process.stderr.write("[bifrostScan] docker unavailable — skipping container source\n");
    return [];
  }
  const out = [];
  for (const row of parseDockerPs(stdout)) {
    for (const { host, container } of parsePublishedPorts(row.ports)) {
      if (NON_HTTP_CONTAINER_PORTS.has(container)) continue;
      const meta = classifyContainer(row.name);
      out.push({
        source: "docker",
        url: `http://localhost:${host}`,
        title: meta.title,
        category: meta.category,
        icon: meta.icon,
        containerName: row.name,
        isLocalService: true,
        hostPort: host,
      });
    }
  }
  return out;
}

function hostPortCandidates(takenPorts) {
  let stdout = "";
  try {
    stdout = sh("netstat", ["-ano", "-p", "tcp"]);
  } catch {
    process.stderr.write("[bifrostScan] netstat unavailable — skipping host-port source\n");
    return [];
  }
  return parseNetstatListeners(stdout)
    .filter((p) => !takenPorts.has(p))
    .map((port) => ({
      source: "host",
      url: `http://localhost:${port}`,
      // Deliberately provisional: the probe's <title> replaces this whenever the
      // service names itself. A port number is a placeholder, not a name.
      title: `localhost:${port}`,
      category: "local services",
      icon: undefined,
      containerName: undefined,
      isLocalService: true,
      hostPort: port,
    }));
}

async function existingLinkUrls() {
  try {
    const out = convexCli(["run", "bifrost:list", "{}", "--env-file", ENV_FILE]);
    const rows = JSON.parse(out);
    return Array.isArray(rows) ? rows.map((r) => r.url) : [];
  } catch (err) {
    process.stderr.write(
      `[bifrostScan] could not read existing links (${err.message}). ` +
        "Refusing to scan rather than propose duplicates of links you already have.\n"
    );
    process.exit(2);
  }
}

async function cmdScan() {
  const docker = dockerCandidates();
  const taken = new Set(docker.map((c) => c.hostPort));
  const host = hostPortCandidates(taken);

  let all = [...docker, ...host];
  let droppedForCap = 0;
  if (all.length > MAX_PROBES) {
    droppedForCap = all.length - MAX_PROBES;
    all = all.slice(0, MAX_PROBES);
  }

  process.stderr.write(`[bifrostScan] probing ${all.length} candidate ports...\n`);
  const alive = await probeAll(all);

  const existing = await existingLinkUrls();
  const fresh = dropExisting(alive, existing);

  const proposals = disambiguateTitles(
    fresh.map((c) => ({
      // The page's own name wins, unless it is an error page's name.
      title: chooseTitle(c.probedTitle, c.title),
      // Carried so `disambiguateTitles` has something project-qualified to fall
      // back to on a collision; stripped from the output below.
      derivedTitle: c.title,
      url: c.url,
      category: c.category,
      icon: c.icon,
      containerName: c.containerName,
      isLocalService: c.isLocalService,
      description:
        c.source === "docker"
          ? `Container ${c.containerName} · HTTP ${c.status}`
          : `Host process on port ${c.hostPort} · HTTP ${c.status}`,
    }))
  )
    .map(({ derivedTitle: _drop, ...rest }) => rest)
    .sort((a, b) =>
      a.category === b.category
        ? a.title.localeCompare(b.title)
        : a.category.localeCompare(b.category)
    );

  process.stdout.write(
    JSON.stringify(
      {
        proposals,
        summary: {
          candidatesProbed: all.length,
          responded: alive.length,
          alreadyInHub: alive.length - fresh.length,
          proposed: proposals.length,
          // Surfaced, never silent: a scan that quietly capped its own coverage
          // reads as "this is everything on the machine" when it is not.
          droppedForProbeCap: droppedForCap,
        },
        // Existing hub entries whose scheme disagrees with what the port
        // actually answers on. Not proposals — these are links Larry ALREADY
        // has that are probably broken, and the dedupe would otherwise hide
        // the evidence. Empty in the normal case.
        staleSchemeEntries: schemeMismatches(alive, existing),
      },
      null,
      2
    ) + "\n"
  );
}

async function cmdApply(jsonPath) {
  const list = JSON.parse(readFileSync(jsonPath, "utf8"));
  const items = Array.isArray(list) ? list : list.proposals;
  if (!Array.isArray(items) || items.length === 0) {
    process.stderr.write("[bifrostScan] nothing to apply\n");
    return;
  }
  // Re-read the hub NOW, not at scan time. `existingLinkUrls` exits 2 rather
  // than returning an empty list on failure, so a backend it cannot reach can
  // never be mistaken for an empty hub — which would make every skip decision
  // wrong in the duplicating direction.
  const { toCreate, skipped } = partitionForApply(items, await existingLinkUrls());
  for (const s of skipped) {
    process.stderr.write(`  = ${s.title} (already in the hub)\n`);
  }

  let ok = 0;
  const failed = [];
  for (const item of toCreate) {
    const args = {
      title: item.title,
      url: item.url,
      category: item.category,
      description: item.description,
      icon: item.icon,
      containerName: item.containerName,
      isLocalService: item.isLocalService,
    };
    for (const k of Object.keys(args)) if (args[k] === undefined) delete args[k];
    try {
      convexCli(["run", "bifrost:createLink", JSON.stringify(args), "--env-file", ENV_FILE]);
      ok++;
      process.stderr.write(`  + ${item.title}\n`);
    } catch (err) {
      failed.push({ title: item.title, error: err.message });
      process.stderr.write(`  ! ${item.title} — ${err.message}\n`);
    }
  }
  process.stdout.write(
    JSON.stringify(
      { created: ok, skipped: skipped.length, failed },
      null,
      2
    ) + "\n"
  );

  // A partial write is NOT a success. Exiting 0 here told any caller — a script,
  // a skill, a future me reading only the status — that the whole confirmed set
  // landed, while some of it silently did not.
  if (failed.length > 0) process.exitCode = 1;
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "scan") return cmdScan();
  if (cmd === "apply") {
    if (!arg) {
      process.stderr.write("usage: bifrostScan.mjs apply <proposals.json>\n");
      process.exit(1);
    }
    return cmdApply(arg);
  }
  process.stderr.write(
    "usage:\n" +
      "  node hooks/bifrostScan.mjs scan              # probe and print proposals as JSON\n" +
      "  node hooks/bifrostScan.mjs apply <file.json> # create the confirmed links\n"
  );
  process.exit(1);
}

// Only run when invoked directly, so the test file can import the pure helpers.
if (process.argv[1] && process.argv[1].endsWith("bifrostScan.mjs")) {
  main().catch((err) => {
    process.stderr.write(`[bifrostScan] ${err.stack || err.message}\n`);
    process.exit(1);
  });
}
