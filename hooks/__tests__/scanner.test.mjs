// DEFECT 3 (adversarial gate on 113-01): hooks/scanner.mjs had ZERO automated test
// coverage — `grep -rn "scanner.mjs" --include=*.test.*` returned no hits, and a mutation
// hardcoding `snapshot.scannedOrigins` to a fixed array survived all 579 pre-existing tests.
// These tests exercise runScan end-to-end against a REAL local HTTP server (never the live
// Convex backend) and assert on the actual POST body bytes it builds, so a hardcoded
// scannedOrigins value cannot pass both tests below (their fixtures produce different real
// coverage sets).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runScan } from "../scanner.mjs";

/** Resolves with the raw body of the server's NEXT incoming request. */
function nextRequestBody(server) {
  return new Promise((resolve) => {
    server.once("request", (req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
    });
  });
}

describe("runScan — /scan wire contract (D-03, D-07)", () => {
  let server, url;

  beforeEach(async () => {
    server = createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("puts the real collector's coveredOrigins on the wire as scannedOrigins + scannedOriginsComplete: true", async () => {
    const home = mkdtempSync(join(tmpdir(), "home-scan-wire-"));
    const cwd = mkdtempSync(join(tmpdir(), "repo-scan-wire-"));
    try {
      // Only the personal skills dir exists: no plugins, no cold storage, no project skills
      // dir (findRepoRoot(cwd) === cwd since cwd/.git exists, but cwd !== home so the
      // project-origin guard doesn't fire — it's simply that no .claude/skills exists at
      // cwd, so readSkillDir returns false there and no project origin is declared).
      // The real, honest result is EXACTLY ["claude-code"] — a hardcoded stub anywhere
      // near the plugin/cold-storage/project origins would not match this.
      mkdirSync(join(home, ".claude", "skills", "alpha"), { recursive: true });
      writeFileSync(join(home, ".claude", "skills", "alpha", "SKILL.md"),
        "---\nname: alpha\ndescription: A test skill\n---\n");
      mkdirSync(join(cwd, ".git"), { recursive: true });

      const bodyPromise = nextRequestBody(server);
      await runScan("sess-wire-1", url, "test-key", { home, cwd });
      const body = JSON.parse(await bodyPromise);

      expect(body.scannedOrigins).toEqual(["claude-code"]);
      expect(body.scannedOriginsComplete).toBe(true);
      expect(body.skills.some((s) => s.name === "alpha" && s.origin === "claude-code")).toBe(true);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 15000);

  it("REGRESSION: an empty/unreadable environment still yields scannedOriginsComplete: true with an empty scannedOrigins array, not a hardcoded non-empty one", async () => {
    // A DIFFERENT real coverage outcome from the previous test's fixture — a fixed,
    // hardcoded scannedOrigins value could not satisfy both this test and the one above.
    const home = mkdtempSync(join(tmpdir(), "home-scan-wire-empty-"));
    const cwd = mkdtempSync(join(tmpdir(), "repo-scan-wire-empty-"));
    try {
      // Deliberately no .claude/skills, no plugins, no cold storage anywhere under home.
      mkdirSync(join(cwd, ".git"), { recursive: true });

      const bodyPromise = nextRequestBody(server);
      await runScan("sess-wire-2", url, "test-key", { home, cwd });
      const body = JSON.parse(await bodyPromise);

      expect(body.scannedOrigins).toEqual([]);
      expect(body.scannedOriginsComplete).toBe(true);
      expect(body.skills).toEqual([]);
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 15000);

  // DEFECT 3 / D-07: success_criteria (113-01-PLAN.md:381) requires an aborted scan to carry
  // NEITHER key. ESM live bindings mean collectClaudeCodeSkillsWithCoverage cannot be
  // monkeypatched from a test module (reassigning an imported binding is a SyntaxError) —
  // reached instead via the `collectSkills` injection point added to runScan for exactly
  // this purpose (see the JSDoc on runScan: every real call site omits `deps` and gets
  // identical behavior to before that parameter existed).
  it("REGRESSION: a thrown skill scan (D-07 abort path) carries neither scannedOrigins nor scannedOriginsComplete", async () => {
    const home = mkdtempSync(join(tmpdir(), "home-scan-abort-"));
    const cwd = mkdtempSync(join(tmpdir(), "repo-scan-abort-"));
    try {
      mkdirSync(join(cwd, ".git"), { recursive: true });
      const throwingCollector = () => {
        throw new Error("simulated skill-scan failure");
      };

      const bodyPromise = nextRequestBody(server);
      await runScan("sess-abort-1", url, "test-key", { home, cwd, collectSkills: throwingCollector });
      const body = JSON.parse(await bodyPromise);

      expect("scannedOrigins" in body).toBe(false);
      expect("scannedOriginsComplete" in body).toBe(false);
      // The rest of the snapshot must still be present and current (D-07): the abort is
      // isolated to the skill scan, not the whole scan.
      expect(body.skills).toEqual([]);
      expect(body.sessionId).toBe("sess-abort-1");
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
    }
  }, 15000);
});
