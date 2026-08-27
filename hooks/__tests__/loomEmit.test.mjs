/**
 * loom-emit.mjs contract tests (Phase 119, D-02).
 *
 * The third of the three gaps in
 * `.planning/milestones/v14.0-phases/119-loom-curated-pipelines/119-VALIDATION.md`.
 *
 * WHY SUBPROCESS, not import. Unlike `ingestPost.mjs`, this script exports
 * nothing: it calls `readEnvFile()` at module scope and `main()` at the bottom,
 * so importing it runs it. Driving the real binary is also the only way to
 * assert the thing its docstring actually promises — the exit-code contract
 * (0 ok / 2 configuration / 3 transport / 4 refusal), which callers branch on
 * and which an exported-function refactor would not exercise.
 *
 * HERMETIC HOME. The script resolves `<homedir>/.claude/skills/loom/.env` via
 * `os.homedir()` and will take a LOOM_API_KEY from it. Whether that file
 * supplies one is OPERATOR MACHINE STATE, not repo state: measured here
 * 2026-08-27, running the script against the real home with no env key exited
 * 2 ("LOOM_API_KEY is not set"), so on this machine today it supplies nothing.
 * On a machine where the operator HAS configured the skill it would, and the
 * config-failure tests below would then fail — or worse, post to a real
 * backend. So every spawn points HOME *and* USERPROFILE at an empty temp dir:
 * `os.homedir()` reads USERPROFILE on Windows and HOME on POSIX, and both are
 * needed for these tests to mean the same thing here and on the Linux CI
 * runner. The override is precautionary today and load-bearing tomorrow.
 *
 * NOT COVERED: the 10s AbortController timeout path (exit 3). Exercising it
 * costs a real 10s wall-clock wait because TIMEOUT_MS is a module constant with
 * no injection point. Stated rather than left as a silent gap.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// NB: under vitest `import.meta.url` is an http:// dev-server URL, not file://,
// so fileURLToPath throws "The URL must be of scheme file". Anchor on cwd
// instead — the same fix hooks/__tests__/idempotency.test.mjs:8 documents.
const SCRIPT = join(process.cwd(), "hooks", "loom-emit.mjs");

/** An empty directory standing in for the operator's home, so the script's
 * `<homedir>/.claude/skills/loom/.env` lookup always misses. */
const FAKE_HOME = mkdtempSync(join(tmpdir(), "loom-emit-home-"));

function runEmit(args, env = {}) {
  return new Promise((resolvePromise) => {
    execFile(
      process.execPath,
      [SCRIPT, ...args],
      {
        env: {
          // A bare {} would inherit nothing and break PATH-less spawns on
          // Windows; inherit, then override precisely what matters.
          ...process.env,
          HOME: FAKE_HOME,
          USERPROFILE: FAKE_HOME,
          LOOM_API_KEY: "",
          LOOM_PIPELINE: "",
          CODEPULSE_URL: "",
          ...env,
        },
      },
      (err, stdout, stderr) => {
        resolvePromise({
          code: err ? (err.code ?? 0) : 0,
          stdout: String(stdout),
          stderr: String(stderr),
        });
      }
    );
  });
}

describe("loom-emit — usage", () => {
  it("prints usage and exits 0 with no arguments", async () => {
    const r = await runEmit([]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("loom-emit.mjs");
    expect(r.stdout).toContain("step:<event>");
  });

  it("prints usage for --help and -h", async () => {
    for (const flag of ["--help", "-h"]) {
      const r = await runEmit([flag]);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain("LOOM_API_KEY");
    }
  });

  it("lists the event vocabulary in the usage text", async () => {
    const r = await runEmit(["--help"]);
    for (const e of ["start", "action", "complete", "error", "warn"]) {
      expect(r.stdout).toContain(e);
    }
  });
});

describe("loom-emit — configuration failures all exit 2", () => {
  it("refuses to emit anonymously when LOOM_API_KEY is unset", async () => {
    // There is deliberately NO default key: a missing key is a hard failure,
    // never an anonymous emit.
    const r = await runEmit(["step:start", "fetch"], { LOOM_PIPELINE: "p" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("LOOM_API_KEY");
  });

  it("fails when no pipeline is given by flag or env", async () => {
    const r = await runEmit(["step:start", "fetch"], { LOOM_API_KEY: "k" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("no pipeline");
  });

  it("fails when the step id is missing", async () => {
    const r = await runEmit(["step:start"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "p",
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("no step id");
  });

  it("rejects an event outside the vocabulary and names the valid ones", async () => {
    const r = await runEmit(["step:finished", "fetch"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "p",
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("unknown event");
    expect(r.stderr).toContain("complete");
  });

  it("rejects an unrecognised positional argument", async () => {
    const r = await runEmit(["start"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "p",
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("unrecognised argument");
  });

  it("rejects a trailing flag with no value", async () => {
    const r = await runEmit(["--pipeline", "p", "--step"], {
      LOOM_API_KEY: "k",
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("needs a value");
  });

  it("names the base URL in diagnostics so a wrong target is visible at once", async () => {
    const r = await runEmit(["step:start", "fetch"], {
      LOOM_API_KEY: "k",
      CODEPULSE_URL: "http://127.0.0.1:9/",
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("127.0.0.1:9");
  });
});

describe("loom-emit — the wire", () => {
  let server;
  let url;
  let received;
  let respond;

  beforeEach(async () => {
    received = [];
    respond = { status: 200, body: JSON.stringify({ ok: true }) };
    server = createServer((req, res) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
        res.writeHead(respond.status, { "Content-Type": "application/json" });
        res.end(respond.body);
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  it("POSTs to /loom/event with the bearer token and the exact body", async () => {
    const r = await runEmit(["step:complete", "build"], {
      LOOM_API_KEY: "secret-key",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: url,
    });

    expect(r.code).toBe(0);
    expect(received).toHaveLength(1);
    expect(received[0].method).toBe("POST");
    expect(received[0].url).toBe("/loom/event");
    expect(received[0].headers.authorization).toBe("Bearer secret-key");
    expect(JSON.parse(received[0].body)).toEqual({
      pipelineSlug: "nightly",
      stepId: "build",
      event: "complete",
    });
  });

  it("echoes the server's response body on success", async () => {
    respond = { status: 200, body: JSON.stringify({ ok: true, runId: "r1" }) };
    const r = await runEmit(["step:start", "fetch"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: url,
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("r1");
  });

  it("joins trailing words into the text field", async () => {
    await runEmit(["step:action", "build", "compiling", "the", "thing"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: url,
    });
    expect(JSON.parse(received[0].body).text).toBe("compiling the thing");
  });

  it("omits text entirely when none is given", async () => {
    await runEmit(["step:action", "build"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: url,
    });
    expect(JSON.parse(received[0].body)).not.toHaveProperty("text");
  });

  it("supports the explicit flag form, including --text", async () => {
    const r = await runEmit(
      ["--pipeline", "review-verify", "--step", "2", "--event", "complete", "--text", "all green"],
      { LOOM_API_KEY: "k", CODEPULSE_URL: url }
    );

    expect(r.code).toBe(0);
    expect(JSON.parse(received[0].body)).toEqual({
      pipelineSlug: "review-verify",
      stepId: "2",
      event: "complete",
      text: "all green",
    });
  });

  it("--pipeline overrides LOOM_PIPELINE", async () => {
    await runEmit(
      ["--pipeline", "explicit", "--step", "1", "--event", "start"],
      { LOOM_API_KEY: "k", LOOM_PIPELINE: "from-env", CODEPULSE_URL: url }
    );
    expect(JSON.parse(received[0].body).pipelineSlug).toBe("explicit");
  });

  it("strips trailing slashes from the base URL rather than posting to //loom/event", async () => {
    const r = await runEmit(["step:start", "fetch"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: `${url}///`,
    });
    expect(r.code).toBe(0);
    expect(received[0].url).toBe("/loom/event");
  });
});

describe("loom-emit — server responses map to the documented exit codes", () => {
  let server;
  let url;
  let respond;

  beforeEach(async () => {
    respond = { status: 200, body: "{}" };
    server = createServer((req, res) => {
      req.on("data", () => {});
      req.on("end", () => {
        res.writeHead(respond.status, { "Content-Type": "application/json" });
        res.end(respond.body);
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((r) => server.close(r));
  });

  it("exit 4 on 404 — a refusal, and it says nothing was written", async () => {
    // D-06: an unknown pipelineSlug is a refusal, never an implicit create.
    // The caller needs to tell that apart from a transport failure, which is
    // why it gets its own code.
    respond = { status: 404, body: JSON.stringify({ error: "UNKNOWN_PIPELINE" }) };
    const r = await runEmit(["step:start", "fetch"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "typo",
      CODEPULSE_URL: url,
    });

    expect(r.code).toBe(4);
    expect(r.stderr).toContain("typo");
    expect(r.stderr).toContain("nothing was written");
  });

  it("exit 3 on a 500, quoting the status and body", async () => {
    respond = { status: 500, body: "boom" };
    const r = await runEmit(["step:start", "fetch"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: url,
    });

    expect(r.code).toBe(3);
    expect(r.stderr).toContain("500");
    expect(r.stderr).toContain("boom");
  });

  it("exit 3 on a 401 — an auth failure is transport, not a refusal", async () => {
    respond = { status: 401, body: "unauthorized" };
    const r = await runEmit(["step:start", "fetch"], {
      LOOM_API_KEY: "wrong",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: url,
    });
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("401");
  });

  it("FAILS LOUD rather than silently succeeding on an error status (control)", async () => {
    // The whole reason this script does not use codepulse-hook.mjs's
    // fire-and-forget post: a dropped step event renders as a pipeline stalled
    // forever. This asserts the success path really is distinguishable.
    respond = { status: 200, body: "{}" };
    const ok = await runEmit(["step:start", "fetch"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: url,
    });
    expect(ok.code).toBe(0);
    expect(ok.stderr).toBe("");
  });
});

describe("loom-emit — transport failure", () => {
  it("exit 3 when nothing is listening", async () => {
    // Port 9 (discard) refuses fast, so this does not wait on the 10s timeout.
    const r = await runEmit(["step:start", "fetch"], {
      LOOM_API_KEY: "k",
      LOOM_PIPELINE: "nightly",
      CODEPULSE_URL: "http://127.0.0.1:9",
    });
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("request failed");
  });
});
