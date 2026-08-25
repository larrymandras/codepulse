/**
 * bifrostScan — parsing and classification.
 *
 * The docker fixtures below are VERBATIM lines from `docker ps` on this machine
 * (2026-08-24), not invented shapes. That matters: the two cases that actually
 * bite — a container publishing several ports, and a published RANGE
 * ("0.0.0.0:3210-3211->3210-3211/tcp") — are both real formats this repo's own
 * stack emits, and neither is what you would write from memory.
 *
 * Nothing here touches Docker, the network, or Convex. The probe and the write
 * path are IO and are exercised by running the tool, not by this file.
 */
import { describe, test, expect } from "vitest";
import {
  parsePublishedPorts,
  parseDockerPs,
  classifyContainer,
  normalizeUrl,
  dropExisting,
  titleFromHtml,
  parseNetstatListeners,
  isJunkTitle,
  chooseTitle,
  disambiguateTitles,
  partitionForApply,
  schemeMismatches,
  NON_HTTP_CONTAINER_PORTS,
  ICONS,
} from "./bifrostScan.mjs";

// Verbatim `docker ps --format "{{.Names}}|{{.Ports}}|{{.Image}}|{{.State}}"`
const REAL_PS = [
  "astridr-whatsapp-bridge||astridr-repo-whatsapp-bridge|running",
  "astridr-agent|0.0.0.0:8090->8090/tcp, [::]:8090->8090/tcp, 0.0.0.0:8181->8181/tcp, [::]:8181->8181/tcp, 0.0.0.0:8199->8099/tcp, [::]:8199->8099/tcp|astridr-repo-astridr|running",
  "astridr-war-room-hervor|8080/tcp, 8181/tcp|astridr-repo-war-room-hervor|running",
  "convex-backend|0.0.0.0:3210-3211->3210-3211/tcp, [::]:3210-3211->3210-3211/tcp|ghcr.io/get-convex/convex-backend:latest|running",
  "mimir-pg|0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp|pgvector/pgvector:pg16|running",
  "supabase_studio_multimodal-rag|0.0.0.0:54343->3000/tcp, [::]:54343->3000/tcp|public.ecr.aws/supabase/studio:x|running",
].join("\n");

describe("parseDockerPs", () => {
  test("parses every row of real docker ps output", () => {
    const rows = parseDockerPs(REAL_PS);
    expect(rows).toHaveLength(6);
    expect(rows[1].name).toBe("astridr-agent");
    expect(rows[1].state).toBe("running");
  });

  test("a container with NO ports still parses, with an empty ports string", () => {
    const rows = parseDockerPs(REAL_PS);
    expect(rows[0].name).toBe("astridr-whatsapp-bridge");
    expect(rows[0].ports).toBe("");
  });

  test("blank lines are skipped, not turned into nameless rows", () => {
    expect(parseDockerPs("\n\n" + REAL_PS + "\n\n")).toHaveLength(6);
  });
});

describe("parsePublishedPorts", () => {
  test("IPv4 and IPv6 entries for one publish collapse to a single host port", () => {
    // The real astridr-agent line lists each publish twice (0.0.0.0 and [::]).
    // Without dedupe this container would propose every link twice.
    const ports = parsePublishedPorts(parseDockerPs(REAL_PS)[1].ports);
    expect(ports.map((p) => p.host)).toEqual([8090, 8181, 8199]);
  });

  test("a host port mapped to a DIFFERENT container port keeps both", () => {
    const ports = parsePublishedPorts(parseDockerPs(REAL_PS)[1].ports);
    expect(ports).toContainEqual({ host: 8199, container: 8099 });
  });

  test("exposed-but-unpublished ports yield nothing — they are unreachable", () => {
    // "8080/tcp, 8181/tcp" has no "->" and so is not bound to the host at all.
    // Proposing these would produce links that can never resolve.
    expect(parsePublishedPorts(parseDockerPs(REAL_PS)[2].ports)).toEqual([]);
  });

  test("a published RANGE expands to each port", () => {
    const ports = parsePublishedPorts(parseDockerPs(REAL_PS)[3].ports);
    expect(ports.map((p) => p.host)).toEqual([3210, 3211]);
  });

  test("an empty ports string is empty, not a crash", () => {
    expect(parsePublishedPorts("")).toEqual([]);
    expect(parsePublishedPorts(undefined)).toEqual([]);
  });

  test("UDP publishes are excluded — a UDP port is never a browsable link", () => {
    expect(parsePublishedPorts("0.0.0.0:5000->5000/udp")).toEqual([]);
  });

  test("an absurd range is not expanded into thousands of probes", () => {
    const ports = parsePublishedPorts("0.0.0.0:1000-60000->1000-60000/tcp");
    expect(ports.length).toBeLessThanOrEqual(1);
  });
});

describe("NON_HTTP_CONTAINER_PORTS", () => {
  test("postgres is excluded so mimir-pg never becomes a link", () => {
    const pg = parsePublishedPorts(parseDockerPs(REAL_PS)[4].ports);
    expect(pg).toEqual([{ host: 5432, container: 5432 }]);
    // The scanner filters on the CONTAINER port, which is what identifies the
    // protocol — a postgres remapped to host 55432 is still postgres.
    expect(NON_HTTP_CONTAINER_PORTS.has(pg[0].container)).toBe(true);
  });

  test("an HTTP container port is not excluded — control for the case above", () => {
    expect(NON_HTTP_CONTAINER_PORTS.has(3000)).toBe(false);
    expect(NON_HTTP_CONTAINER_PORTS.has(8181)).toBe(false);
  });
});

describe("classifyContainer", () => {
  test("supabase studio gets a project-qualified title", () => {
    const c = classifyContainer("supabase_studio_multimodal-rag");
    expect(c.title).toBe("Supabase Studio — multimodal-rag");
    expect(c.category).toBe("supabase");
    expect(c.icon).toBe(ICONS.supabaseStudio);
  });

  test("inbucket is named for what it IS (mail), not for its image", () => {
    expect(classifyContainer("supabase_inbucket_global-legal-crisis").title).toBe(
      "Supabase Mail — global-legal-crisis"
    );
  });

  test("the CLI gateway is matched before the generic astridr rule", () => {
    // Ordering matters: the generic /^astridr/ rule would otherwise swallow it
    // and produce "Ástríðr cli gateway".
    expect(classifyContainer("astridr-cli-gateway").title).toBe("Ástríðr CLI Gateway");
  });

  test("a generic astridr container keeps its suffix", () => {
    expect(classifyContainer("astridr-agent").title).toBe("Ástríðr agent");
  });

  test("convex and trading are recognised", () => {
    expect(classifyContainer("convex-backend").title).toBe("Convex backend");
    expect(classifyContainer("convex-backend").category).toBe("infrastructure");
    expect(classifyContainer("trading-dashboard").title).toBe("Trading dashboard");
  });

  test("an unknown container is kept, named after itself, with NO guessed icon", () => {
    const c = classifyContainer("some-random-thing");
    expect(c.title).toBe("some-random-thing");
    expect(c.category).toBe("local services");
    // An invented icon name would silently fall back to a generic glyph anyway;
    // omitting it says "unknown" honestly instead of pretending to classify.
    expect(c.icon).toBeUndefined();
  });

  test("every icon emitted is a real navRegistry key", () => {
    // Guards the one way this can fail silently: LinkCard looks the name up in
    // iconComponents and falls back without erroring, so a typo would never
    // surface at runtime.
    const NAV_KEYS = new Set([
      "grid", "cpu", "chart", "bell", "server", "users", "shield", "idea",
      "refresh", "bot", "hammer", "brain", "moon", "scroll", "clock", "list",
      "gear", "message", "activity", "inbox", "kanban", "sliders", "insights",
      "whatsapp", "radio", "video", "layout", "book-open", "wand-2",
      "users-round", "terminal", "network", "boxes", "share-2", "flame",
      "hexagon", "message-square-text", "gauge", "wrench", "sparkles",
      "link-2", "waypoints", "radar", "images",
    ]);
    for (const [key, icon] of Object.entries(ICONS)) {
      expect(NAV_KEYS.has(icon), `${key} -> "${icon}" is not a navRegistry icon`).toBe(true);
    }
  });
});

describe("normalizeUrl / dropExisting", () => {
  test("localhost and 127.0.0.1 are the same machine", () => {
    expect(normalizeUrl("http://localhost:8181")).toBe(
      normalizeUrl("http://127.0.0.1:8181")
    );
  });

  test("trailing slashes and scheme do not create a new link", () => {
    expect(normalizeUrl("http://localhost:5173/")).toBe(
      normalizeUrl("https://localhost:5173")
    );
  });

  test("different ports stay different — control", () => {
    expect(normalizeUrl("http://localhost:5173")).not.toBe(
      normalizeUrl("http://localhost:5174")
    );
  });

  test("a candidate the hub already holds is dropped", () => {
    const candidates = [
      { url: "http://localhost:8181" },
      { url: "http://localhost:3210" },
    ];
    const fresh = dropExisting(candidates, ["http://127.0.0.1:8181/"]);
    expect(fresh.map((c) => c.url)).toEqual(["http://localhost:3210"]);
  });

  test("an empty hub drops nothing", () => {
    const candidates = [{ url: "http://localhost:8181" }];
    expect(dropExisting(candidates, [])).toHaveLength(1);
  });
});

describe("titleFromHtml", () => {
  test("extracts and collapses whitespace", () => {
    expect(titleFromHtml("<html><title>\n  Convex\n  Dashboard </title>")).toBe(
      "Convex Dashboard"
    );
  });

  test("decodes the entities that actually appear in titles", () => {
    expect(titleFromHtml("<title>Studio &amp; Logs</title>")).toBe("Studio & Logs");
  });

  test("returns null — not an empty string — when there is no usable title", () => {
    // The caller falls back to a derived name on null; an empty string would
    // be written as the link's title and produce a nameless palette row.
    expect(titleFromHtml("<html><body>no title</body></html>")).toBeNull();
    expect(titleFromHtml("<title>   </title>")).toBeNull();
    expect(titleFromHtml("")).toBeNull();
  });

  test("a runaway title is truncated so it cannot wreck a palette row", () => {
    const out = titleFromHtml(`<title>${"x".repeat(500)}</title>`);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith("...")).toBe(true);
  });
});

describe("parseNetstatListeners", () => {
  const NETSTAT = [
    "  Proto  Local Address          Foreign Address        State           PID",
    "  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1234",
    "  TCP    0.0.0.0:5173           0.0.0.0:0              LISTENING       9001",
    "  TCP    [::]:5173              [::]:0                 LISTENING       9001",
    "  TCP    127.0.0.1:8200         0.0.0.0:0              LISTENING       7777",
    "  TCP    0.0.0.0:9999           1.2.3.4:443            ESTABLISHED     4242",
  ].join("\r\n"); // CRLF, as netstat actually emits on Windows

  test("returns distinct listening ports above the system range", () => {
    expect(parseNetstatListeners(NETSTAT)).toEqual([5173, 8200]);
  });

  test("IPv4 and IPv6 rows for one listener collapse to one port", () => {
    expect(parseNetstatListeners(NETSTAT).filter((p) => p === 5173)).toHaveLength(1);
  });

  test("non-LISTENING rows are ignored", () => {
    expect(parseNetstatListeners(NETSTAT)).not.toContain(9999);
  });

  test("system ports below 1024 are dropped", () => {
    expect(parseNetstatListeners(NETSTAT)).not.toContain(135);
  });

  test("the floor is configurable — control proving 135 was dropped BY the rule", () => {
    // Without this, "does not contain 135" could equally mean the parser simply
    // failed to read that line at all.
    expect(parseNetstatListeners(NETSTAT, { minPort: 1 })).toContain(135);
  });
});

/**
 * The three cases below are not hypothetical — each was harvested by an actual
 * scan of this machine before the fix, and each produced a link the operator
 * would have had to clean up by hand.
 */
describe("isJunkTitle / chooseTitle", () => {
  test("a status-prefixed error page title is junk", () => {
    // Verbatim from port 55430 on this machine.
    expect(isJunkTitle("400 The plain HTTP request was sent to HTTPS port")).toBe(true);
    expect(isJunkTitle("404 Not Found")).toBe(true);
  });

  test("bare error-page titles are junk", () => {
    expect(isJunkTitle("Error")).toBe(true);
    expect(isJunkTitle("Service Unavailable")).toBe(true);
    expect(isJunkTitle("  service unavailable  ")).toBe(true);
  });

  test("a real product name is NOT junk — control", () => {
    // Without this the rule could be "reject everything" and still pass above.
    expect(isJunkTitle("Supabase Studio")).toBe(false);
    expect(isJunkTitle("Mailpit")).toBe(false);
    expect(isJunkTitle("Trading Agent")).toBe(false);
  });

  test("a title that merely CONTAINS a number is not junk", () => {
    // The rule anchors on a leading 3-digit status, not on digits anywhere.
    expect(isJunkTitle("Grafana 11 Dashboard")).toBe(false);
  });

  test("chooseTitle prefers the page's own name, falling back on junk", () => {
    expect(chooseTitle("Mailpit", "Supabase Mail — x")).toBe("Mailpit");
    expect(chooseTitle("Error", "Supabase Mail — x")).toBe("Supabase Mail — x");
    expect(chooseTitle(null, "Convex backend")).toBe("Convex backend");
  });
});

describe("disambiguateTitles", () => {
  test("colliding titles fall back to the project-qualified derived name", () => {
    // Three real Mailpit instances, one per Supabase project, all serving the
    // identical <title>. Verbatim shape from a live scan.
    const out = disambiguateTitles([
      { title: "Mailpit", derivedTitle: "Supabase Mail — a", url: "http://localhost:54324" },
      { title: "Mailpit", derivedTitle: "Supabase Mail — b", url: "http://localhost:54344" },
      { title: "Mailpit", derivedTitle: "Supabase Mail — c", url: "http://localhost:54424" },
    ]);
    expect(out.map((o) => o.title).sort()).toEqual([
      "Supabase Mail — a",
      "Supabase Mail — b",
      "Supabase Mail — c",
    ]);
  });

  test("when derived names ALSO collide, the port disambiguates", () => {
    // convex-backend publishes 3210 and 3211; both derive "Convex backend".
    const out = disambiguateTitles([
      { title: "Convex backend", derivedTitle: "Convex backend", url: "http://localhost:3210" },
      { title: "Convex backend", derivedTitle: "Convex backend", url: "http://localhost:3211" },
    ]);
    expect(out.map((o) => o.title).sort()).toEqual([
      "Convex backend (3210)",
      "Convex backend (3211)",
    ]);
  });

  test("a title that is already unique is left alone", () => {
    const input = [
      { title: "Convex Dashboard", derivedTitle: "Convex backend", url: "http://localhost:6791" },
      { title: "Trading Agent", derivedTitle: "Trading dashboard", url: "http://localhost:8180" },
    ];
    expect(disambiguateTitles(input).map((o) => o.title)).toEqual([
      "Convex Dashboard",
      "Trading Agent",
    ]);
  });

  test("every output title is unique — the property the function exists for", () => {
    const out = disambiguateTitles([
      { title: "X", derivedTitle: "D", url: "http://localhost:1" },
      { title: "X", derivedTitle: "D", url: "http://localhost:2" },
      { title: "X", derivedTitle: "D", url: "http://localhost:3" },
    ]);
    expect(new Set(out.map((o) => o.title)).size).toBe(3);
  });

  test("does not mutate its input", () => {
    const input = [
      { title: "X", derivedTitle: "A", url: "http://localhost:1" },
      { title: "X", derivedTitle: "B", url: "http://localhost:2" },
    ];
    disambiguateTitles(input);
    expect(input.map((i) => i.title)).toEqual(["X", "X"]);
  });
});

/**
 * Retry safety for `apply`.
 *
 * `createLink` inserts unconditionally and nothing in the schema enforces URL
 * uniqueness, so without this partition a re-run of the same confirmed file
 * duplicates every link that succeeded the first time. The only cleanup is
 * archiving each duplicate by hand.
 */
describe("partitionForApply", () => {
  const ITEMS = [
    { title: "Convex", url: "http://localhost:3210" },
    { title: "Trading", url: "http://localhost:8180" },
    { title: "Gateway", url: "http://localhost:8200" },
  ];

  test("a fresh hub creates everything", () => {
    const { toCreate, skipped } = partitionForApply(ITEMS, []);
    expect(toCreate).toHaveLength(3);
    expect(skipped).toHaveLength(0);
  });

  test("THE retry case: re-applying after a partial failure creates only the rest", () => {
    // First run created Convex and Trading, then died on Gateway. Re-running
    // the SAME confirmed file must not insert the first two a second time.
    const { toCreate, skipped } = partitionForApply(ITEMS, [
      "http://localhost:3210",
      "http://localhost:8180",
    ]);
    expect(toCreate.map((i) => i.title)).toEqual(["Gateway"]);
    expect(skipped.map((i) => i.title)).toEqual(["Convex", "Trading"]);
  });

  test("applying the same file twice in full is a no-op the second time", () => {
    const first = partitionForApply(ITEMS, []);
    const existing = first.toCreate.map((i) => i.url);
    const second = partitionForApply(ITEMS, existing);
    expect(second.toCreate).toHaveLength(0);
    expect(second.skipped).toHaveLength(3);
  });

  test("matching is by NORMALIZED url — localhost vs 127.0.0.1 is the same link", () => {
    // The hub stores whatever was typed; the scan proposes `localhost`. Without
    // normalization a hand-added 127.0.0.1 entry would be duplicated.
    const { toCreate } = partitionForApply(
      [{ title: "Convex", url: "http://localhost:3210" }],
      ["http://127.0.0.1:3210/"]
    );
    expect(toCreate).toHaveLength(0);
  });

  test("a duplicate WITHIN the confirmed file is created once, not twice", () => {
    const { toCreate, skipped } = partitionForApply(
      [
        { title: "A", url: "http://localhost:1" },
        { title: "A again", url: "http://localhost:1/" },
      ],
      []
    );
    expect(toCreate).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });

  test("a genuinely new link is still created — control", () => {
    // Without this the partition could be "skip everything" and satisfy every
    // assertion above.
    const { toCreate } = partitionForApply(ITEMS, ["http://localhost:3210"]);
    expect(toCreate.map((i) => i.title)).toEqual(["Trading", "Gateway"]);
  });
});

/**
 * The scheme blind spot in `normalizeUrl`.
 *
 * Scheme-insensitive identity is correct for dedupe and wrong for reporting:
 * it is what stops a hand-typed https entry from being duplicated by an http
 * proposal, AND what would silently swallow a TLS-repaired proposal when the
 * hub already holds the broken http one. The mismatch is surfaced instead.
 */
describe("schemeMismatches", () => {
  test("flags an existing http entry for a port that actually speaks https", () => {
    const out = schemeMismatches(
      [{ title: "Kong", url: "https://localhost:55430" }],
      ["http://localhost:55430"]
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      existingUrl: "http://localhost:55430",
      actualUrl: "https://localhost:55430",
    });
  });

  test("says nothing when the schemes agree — control", () => {
    // Without this the function could flag every duplicate and still pass above.
    expect(
      schemeMismatches(
        [{ title: "Convex", url: "http://localhost:3210" }],
        ["http://localhost:3210"]
      )
    ).toEqual([]);
  });

  test("says nothing about a candidate the hub does not hold at all", () => {
    expect(
      schemeMismatches(
        [{ title: "New", url: "https://localhost:9999" }],
        ["http://localhost:3210"]
      )
    ).toEqual([]);
  });

  test("localhost/127.0.0.1 still match, so the flag survives host aliasing", () => {
    const out = schemeMismatches(
      [{ title: "Kong", url: "https://localhost:55430" }],
      ["http://127.0.0.1:55430/"]
    );
    expect(out).toHaveLength(1);
  });

  test("the suppressed candidate is STILL dropped from proposals", () => {
    // The two behaviours are complementary, not alternatives: dedupe keeps
    // doing its job, and the mismatch is reported alongside it.
    const fresh = dropExisting(
      [{ url: "https://localhost:55430" }],
      ["http://localhost:55430"]
    );
    expect(fresh).toHaveLength(0);
  });
});

/**
 * URL identity regressions.
 *
 * Every case here failed against the hand-rolled sequential-replace version and
 * was found by measuring the function rather than reading it. Each is a real
 * failure of the guarantee `normalizeUrl` exists to provide: two spellings of
 * one URL must produce one key, and two different endpoints must not collide.
 */
describe("normalizeUrl — identity regressions", () => {
  test("a trailing slash never changes the key, default port or not", () => {
    // The original stripped ":80$" BEFORE the trailing slash, so the slashed
    // spelling kept its port and the bare one did not -> two keys, one URL,
    // guaranteed duplicate on retry.
    expect(normalizeUrl("http://localhost:80")).toBe(normalizeUrl("http://localhost:80/"));
    expect(normalizeUrl("https://localhost:443")).toBe(normalizeUrl("https://localhost:443/"));
    expect(normalizeUrl("http://localhost:5173")).toBe(normalizeUrl("http://localhost:5173/"));
  });

  test("a default port is dropped only for ITS OWN scheme", () => {
    // :443 is not http's default and :80 is not https's. The original stripped
    // both unconditionally, collapsing distinct endpoints onto one key.
    expect(normalizeUrl("http://localhost:443")).not.toBe(normalizeUrl("http://localhost:80"));
    expect(normalizeUrl("https://localhost:80")).not.toBe(normalizeUrl("https://localhost:443"));
  });

  test("http:80 and https:443 are both the bare host — each IS its own default", () => {
    expect(normalizeUrl("http://localhost:80")).toBe("127.0.0.1");
    expect(normalizeUrl("https://localhost:443")).toBe("127.0.0.1");
  });

  test("a non-default port survives", () => {
    expect(normalizeUrl("http://localhost:443")).toBe("127.0.0.1:443");
    expect(normalizeUrl("https://localhost:80")).toBe("127.0.0.1:80");
  });

  test("host aliases still collapse", () => {
    expect(normalizeUrl("http://localhost:8181")).toBe("127.0.0.1:8181");
    expect(normalizeUrl("http://127.0.0.1:8181")).toBe("127.0.0.1:8181");
    expect(normalizeUrl("http://[::1]:8181")).toBe("127.0.0.1:8181");
  });

  test("identity stays scheme-INSENSITIVE — the documented contract", () => {
    expect(normalizeUrl("http://localhost:55430")).toBe(normalizeUrl("https://localhost:55430"));
  });

  test("a path is part of identity; a trailing slash on it is not", () => {
    expect(normalizeUrl("http://localhost:3000/admin")).toBe(normalizeUrl("http://localhost:3000/admin/"));
    expect(normalizeUrl("http://localhost:3000/admin")).not.toBe(normalizeUrl("http://localhost:3000/other"));
  });

  test("an unparseable string degrades to a key instead of throwing", () => {
    expect(() => normalizeUrl("not a url at all")).not.toThrow();
    expect(normalizeUrl("")).toBe("");
  });

  test("the retry guarantee holds across spellings", () => {
    // The end-to-end property all of the above exists to protect.
    const { toCreate } = partitionForApply(
      [{ title: "X", url: "http://localhost:80/" }],
      ["http://localhost:80"]
    );
    expect(toCreate).toHaveLength(0);
  });
});

/**
 * The two normalizers must not drift.
 *
 * `convex/bifrostUrl.ts` is the authority (the mutation decides what already
 * exists), but `hooks/bifrostScan.mjs` runs under plain node and cannot import
 * TypeScript, so the logic is unavoidably duplicated. Vitest CAN import both,
 * which makes this the one place the duplication is checkable.
 *
 * A drift here is not cosmetic: the scanner would skip a link the mutation
 * would have created, or propose one it then refuses — link identity split in
 * half, silently.
 */
describe("normalizeUrl agrees with convex/bifrostUrl.ts", () => {
  const CASES = [
    "http://localhost:3210",
    "http://127.0.0.1:3210",
    "http://[::1]:3210",
    "http://localhost:3210/",
    "https://localhost:3210",
    "http://localhost:80",
    "http://localhost:80/",
    "http://localhost:443",
    "https://localhost:80",
    "https://localhost:443",
    "http://localhost:54343/project/default",
    "http://localhost:54343/project/default/",
    "http://localhost:8181?x=1",
    "https://example.com",
    "example.com:9000",
    "",
    "   ",
    "not a url at all",
  ];

  test("every case normalizes identically in both implementations", async () => {
    const { normalizeLinkUrl } = await import("../convex/bifrostUrl.ts");
    for (const c of CASES) {
      expect(normalizeUrl(c), `disagreement on ${JSON.stringify(c)}`).toBe(
        normalizeLinkUrl(c)
      );
    }
  });

  test("the comparison is meaningful — the cases are not all the same key", async () => {
    // Control: without this, two functions that both returned "" for everything
    // would pass the agreement test above.
    const keys = new Set(CASES.map(normalizeUrl));
    expect(keys.size).toBeGreaterThan(5);
  });
});
