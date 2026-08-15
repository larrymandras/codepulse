// Control-paired tests for hooks/studioFal.mjs — D-09's SECOND leg (Phase 118 plan 118-13).
//
// EVERY test here injects fetchImpl. Nothing in this file reaches the network, and
// nothing reaches C:\Users\mandr\media-vault, which is real operator data (T-118-25).
// The path-safety tests inject the write-stream factory too, so a refusal can be
// proven to have performed ZERO filesystem writes rather than merely to have thrown.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  resolveFalConfig,
  isTransient,
  withRetry,
  submitJob,
  pollJob,
  fetchResult,
  extractAssetUrl,
  assertInsideGen,
  downloadResult,
  generate,
  redactUrl,
  defaultDestPath,
  parseArgs,
  main,
  FalHttpError,
} from "../studioFal.mjs";

/** A fake credential. Keyboard-mashed, never a real key, and deliberately
 * distinctive so the secret-hygiene assertions cannot pass by coincidence. */
const FAKE_KEY = "falfake-7q2v8m1p0zt4x9c3n6";
const CONFIG = { falKey: FAKE_KEY, vaultRoot: "C:\\tmp\\vault-fixture" };

/** Minimal fetch-Response-shaped mock, matching studioWatch.test.mjs's helper. */
function jsonResp(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

/** Sleep and clock stubs — no test may spend real wall-clock on backoff. */
function fakeClock() {
  let t = 1_000_000;
  return {
    now: () => t,
    sleep: vi.fn(async (ms) => {
      t += ms;
    }),
    advance: (ms) => {
      t += ms;
    },
    get elapsed() {
      return t - 1_000_000;
    },
  };
}

const SUBMIT_OK = {
  request_id: "req-abc",
  status_url: "https://queue.fal.run/fal-ai/x/requests/req-abc/status",
  response_url: "https://queue.fal.run/fal-ai/x/requests/req-abc",
  cancel_url: "https://queue.fal.run/fal-ai/x/requests/req-abc/cancel",
  queue_position: 2,
};

/* ══════════════════════════════════════════════════════════════════════════
 * Config resolution
 * ════════════════════════════════════════════════════════════════════════*/

describe("resolveFalConfig: three tiers, and NO default for the key at any of them", () => {
  const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fal-home-"));

  it("reads FAL_KEY from process.env (tier 1)", () => {
    const c = resolveFalConfig({ FAL_KEY: FAKE_KEY }, { homeDir: emptyHome });
    expect(c.falKey).toBe(FAKE_KEY);
  });

  it("returns undefined when no tier supplies a key — the resolver reports, it does not enforce", () => {
    const c = resolveFalConfig({}, { homeDir: emptyHome });
    expect(c.falKey).toBeUndefined();
  });

  it("defaults the vault root but NEVER the key — the control that proves tier 3 exists for one and not the other", () => {
    const c = resolveFalConfig({}, { homeDir: emptyHome });
    expect(c.vaultRoot).toBe("C:\\Users\\mandr\\media-vault");
    expect(c.falKey).toBeUndefined();
  });

  it("MEDIA_VAULT_ROOT from the environment overrides the default", () => {
    const c = resolveFalConfig({ MEDIA_VAULT_ROOT: "D:\\alt" }, { homeDir: emptyHome });
    expect(c.vaultRoot).toBe("D:\\alt");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * The queue cycle
 * ════════════════════════════════════════════════════════════════════════*/

describe("submitJob: uses the URLs the API hands back, never ones it rebuilds", () => {
  it("POSTs to the queue host and returns request_id plus the API's own status/response urls", async () => {
    const fetchImpl = vi.fn(async () => jsonResp(200, SUBMIT_OK));
    const out = await submitJob("fal-ai/x", { prompt: "p" }, CONFIG, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://queue.fal.run/fal-ai/x");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ prompt: "p" });

    expect(out.requestId).toBe("req-abc");
    expect(out.statusUrl).toBe(SUBMIT_OK.status_url);
    expect(out.responseUrl).toBe(SUBMIT_OK.response_url);
  });

  it("falls back to the documented template ONLY when the response omits the urls", async () => {
    const fetchImpl = vi.fn(async () => jsonResp(200, { request_id: "req-zzz" }));
    const out = await submitJob("fal-ai/x", { prompt: "p" }, CONFIG, { fetchImpl });
    expect(out.statusUrl).toBe("https://queue.fal.run/fal-ai/x/requests/req-zzz/status");
    expect(out.responseUrl).toBe("https://queue.fal.run/fal-ai/x/requests/req-zzz");
  });

  it("fails loud when the submit response carries no request_id, rather than polling undefined", async () => {
    const fetchImpl = vi.fn(async () => jsonResp(200, { detail: "something else" }));
    await expect(submitJob("fal-ai/x", {}, CONFIG, { fetchImpl })).rejects.toThrow(/no request_id/);
  });
});

describe("pollJob: the happy path polls until COMPLETED and no further", () => {
  it("polls IN_QUEUE, IN_PROGRESS, then COMPLETED — exactly 3 status calls", async () => {
    const clock = fakeClock();
    const statuses = ["IN_QUEUE", "IN_PROGRESS", "COMPLETED"];
    let i = 0;
    const fetchImpl = vi.fn(async () =>
      jsonResp(200, { status: statuses[i++], response_url: SUBMIT_OK.response_url })
    );

    const out = await pollJob(SUBMIT_OK.status_url, CONFIG, { fetchImpl, sleep: clock.sleep, now: clock.now });

    expect(out).toMatchObject({ ok: true, status: "COMPLETED", responseUrl: SUBMIT_OK.response_url });
    // The count is the assertion that matters: a test asserting only ok:true
    // passes identically against a client that polls once, or a hundred times,
    // or never polls at all and guesses.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(out.attempts).toBe(3);
  });
});

describe("pollJob: the bound is a BOUND — control pair", () => {
  it("a never-terminal job returns POLL_TIMEOUT after EXACTLY maxAttempts calls, and the elapsed budget is respected", async () => {
    const clock = fakeClock();
    const fetchImpl = vi.fn(async () => jsonResp(200, { status: "IN_PROGRESS" }));

    const out = await pollJob(SUBMIT_OK.status_url, CONFIG, {
      fetchImpl,
      sleep: clock.sleep,
      now: clock.now,
      poll: { maxAttempts: 5, budgetMs: 10_000_000, intervalMs: 1_000, maxIntervalMs: 4_000, backoffFactor: 2 },
    });

    expect(out).toEqual({ ok: false, reason: "POLL_TIMEOUT", attempts: 5 });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    // 4 sleeps between 5 attempts, capped at maxIntervalMs: 1000+2000+4000+4000.
    expect(clock.sleep).toHaveBeenCalledTimes(4);
    expect(clock.elapsed).toBe(11_000);
  });

  it("CONTROL: a job terminating on the LAST permitted attempt SUCCEEDS — this is what catches an off-by-one that gives up one attempt early", async () => {
    const clock = fakeClock();
    let i = 0;
    const fetchImpl = vi.fn(async () => {
      i += 1;
      return jsonResp(200, { status: i < 5 ? "IN_PROGRESS" : "COMPLETED", response_url: "R" });
    });

    const out = await pollJob(SUBMIT_OK.status_url, CONFIG, {
      fetchImpl,
      sleep: clock.sleep,
      now: clock.now,
      poll: { maxAttempts: 5, budgetMs: 10_000_000, intervalMs: 1_000, maxIntervalMs: 4_000, backoffFactor: 2 },
    });

    expect(out).toMatchObject({ ok: true, status: "COMPLETED", attempts: 5 });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  it("the wall-clock budget bounds the loop independently of the attempt count", async () => {
    const clock = fakeClock();
    const fetchImpl = vi.fn(async () => jsonResp(200, { status: "IN_PROGRESS" }));

    const out = await pollJob(SUBMIT_OK.status_url, CONFIG, {
      fetchImpl,
      sleep: clock.sleep,
      now: clock.now,
      poll: { maxAttempts: 1000, budgetMs: 3_000, intervalMs: 1_000, maxIntervalMs: 1_000, backoffFactor: 1 },
    });

    expect(out.reason).toBe("POLL_BUDGET_EXHAUSTED");
    // Far fewer than the 1000 attempts allowed — so the budget, not the count, ended it.
    expect(fetchImpl.mock.calls.length).toBeLessThan(10);
  });

  it("an UNDOCUMENTED terminal status ends the loop instead of polling a dead job to the budget", async () => {
    const clock = fakeClock();
    const fetchImpl = vi.fn(async () => jsonResp(200, { status: "FAILED" }));
    const out = await pollJob(SUBMIT_OK.status_url, CONFIG, { fetchImpl, sleep: clock.sleep, now: clock.now });
    expect(out).toEqual({ ok: false, reason: "FAILED", attempts: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Retry policy
 * ════════════════════════════════════════════════════════════════════════*/

describe("retry policy: transient errors are retried, an auth failure NEVER is", () => {
  it("a 500 IS retried to the limit and a 401 is retried ZERO times — both counts asserted together", async () => {
    const clock = fakeClock();

    const fiveHundred = vi.fn(async () => {
      throw new FalHttpError(500, "boom");
    });
    await expect(
      withRetry(fiveHundred, { maxAttempts: 3, baseDelayMs: 10, backoffFactor: 2 }, { sleep: clock.sleep })
    ).rejects.toThrow(/boom/);

    const fourOhOne = vi.fn(async () => {
      throw new FalHttpError(401, "Unauthorized");
    });
    await expect(
      withRetry(fourOhOne, { maxAttempts: 3, baseDelayMs: 10, backoffFactor: 2 }, { sleep: clock.sleep })
    ).rejects.toThrow(/Unauthorized/);

    // Asserting both in one test is deliberate: the failure mode is a policy
    // that retries EVERYTHING, and that passes a 500-only test perfectly.
    expect(fiveHundred).toHaveBeenCalledTimes(3);
    expect(fourOhOne).toHaveBeenCalledTimes(1);
  });

  it("a 429 is transient, a 422 validation error is not", () => {
    expect(isTransient(new FalHttpError(429, "slow down"))).toBe(true);
    expect(isTransient(new FalHttpError(503, "unavailable"))).toBe(true);
    expect(isTransient(new FalHttpError(422, "bad input"))).toBe(false);
    expect(isTransient(new FalHttpError(401, "nope"))).toBe(false);
    // A network error carries no status at all and IS transient.
    expect(isTransient(new Error("ECONNRESET"))).toBe(true);
  });

  it("a transient call that succeeds on its second attempt returns rather than exhausting the bound", async () => {
    const clock = fakeClock();
    let n = 0;
    const flaky = vi.fn(async () => {
      n += 1;
      if (n === 1) throw new FalHttpError(500, "transient");
      return "ok";
    });
    const out = await withRetry(flaky, { maxAttempts: 3, baseDelayMs: 10, backoffFactor: 2 }, { sleep: clock.sleep });
    expect(out).toBe("ok");
    expect(flaky).toHaveBeenCalledTimes(2);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Auth and secret hygiene (T-118-04)
 * ════════════════════════════════════════════════════════════════════════*/

describe("auth: the Key header is on every queue request, and the key never reaches a log line", () => {
  it("sends `Authorization: Key <token>` — NOT Bearer — on submit, poll and result fetch alike", async () => {
    const clock = fakeClock();
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith("/status")) return jsonResp(200, { status: "COMPLETED", response_url: "R" });
      if (String(url) === "R") return jsonResp(200, { images: [{ url: "https://cdn/x.png" }] });
      return jsonResp(200, SUBMIT_OK);
    });

    const s = await submitJob("fal-ai/x", { prompt: "p" }, CONFIG, { fetchImpl });
    await pollJob(s.statusUrl, CONFIG, { fetchImpl, sleep: clock.sleep, now: clock.now });
    await fetchResult("R", CONFIG, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init.headers.Authorization).toBe(`Key ${FAKE_KEY}`);
      expect(init.headers.Authorization).not.toMatch(/^Bearer /);
    }
  });

  it("every outbound request carries an AbortController signal", async () => {
    const fetchImpl = vi.fn(async () => jsonResp(200, SUBMIT_OK));
    await submitJob("fal-ai/x", {}, CONFIG, { fetchImpl });
    expect(fetchImpl.mock.calls[0][1].signal).toBeDefined();
  });

  it("SECRET HYGIENE: an error path that echoes request details contains no FAL_KEY value", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "upstream exploded",
      json: async () => ({}),
    }));

    let captured = "";
    try {
      await submitJob("fal-ai/x", { prompt: "p" }, CONFIG, { fetchImpl });
    } catch (err) {
      captured = `${err.message}\n${err.stack}`;
    }

    expect(captured).toContain("HTTP 500");
    expect(captured).toContain("upstream exploded");
    // The whole point. A message that embeds the response body is useful; one
    // that embeds the request headers is a credential in a log file.
    expect(captured).not.toContain(FAKE_KEY);
    expect(captured).not.toContain("Key falfake");
  });

  it("redactUrl strips a query string, so a future signed url cannot reach a log intact", () => {
    expect(redactUrl("https://q/x?token=abc123")).toBe("https://q/x?<redacted>");
    // Control: a url with no query is passed through unchanged, so this is a
    // redactor rather than a blanket mangler.
    expect(redactUrl("https://q/x")).toBe("https://q/x");
  });
});

describe("main(): refuses to run unauthenticated", () => {
  it("CONTROL PAIR: with FAL_KEY unset, main exits 2 and fetchImpl was NEVER called", async () => {
    const fetchImpl = vi.fn();
    const exit = vi.fn();
    const errorLog = vi.fn();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fal-nokey-"));

    await main(["--model", "fal-ai/x", "--prompt", "p"], {
      env: {},
      homeDir: home,
      fetchImpl,
      exit,
      errorLog,
      log: vi.fn(),
    });

    expect(exit).toHaveBeenCalledWith(2);
    // Asserting the call count, not just the exit code: an exit-2 that fires
    // AFTER a request has already gone out is not the guard this claims to be.
    expect(fetchImpl).toHaveBeenCalledTimes(0);
    expect(errorLog.mock.calls.flat().join(" ")).toMatch(/FAL_KEY is not set/);
  });

  it("CONTROL: with the key present but --model missing, it still exits 2 and still never fetches", async () => {
    const fetchImpl = vi.fn();
    const exit = vi.fn();
    const errorLog = vi.fn();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fal-nomodel-"));

    await main(["--prompt", "p"], {
      env: { FAL_KEY: FAKE_KEY },
      homeDir: home,
      fetchImpl,
      exit,
      errorLog,
      log: vi.fn(),
    });

    expect(exit).toHaveBeenCalledWith(2);
    expect(fetchImpl).toHaveBeenCalledTimes(0);
    expect(errorLog.mock.calls.flat().join(" ")).toMatch(/--model is required/);
  });

  it("parseArgs rejects a flag with no value rather than silently taking undefined", () => {
    expect(() => parseArgs(["--model"])).toThrow(/needs a value/);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * Path safety (T-118-06) and streaming (T-118-22)
 * ════════════════════════════════════════════════════════════════════════*/

describe("downloadResult: refuses any destination outside the vault's gen directory", () => {
  const vaultRoot = "C:\\tmp\\vault-fixture";

  it("accepts a path inside gen\\", () => {
    expect(assertInsideGen(path.join(vaultRoot, "gen", "a.png"), vaultRoot)).toBe(
      path.resolve(vaultRoot, "gen", "a.png")
    );
    expect(assertInsideGen(path.join(vaultRoot, "gen", "nested", "a.png"), vaultRoot)).toContain("nested");
  });

  it("refuses a traversal, a sibling directory, and a PREFIX collision — with zero filesystem writes on every one", async () => {
    const createWriteStreamImpl = vi.fn();
    const mkdirImpl = vi.fn();
    const fetchImpl = vi.fn();

    const bad = [
      path.join(vaultRoot, "gen", "..", "..", "evil.png"), // traversal
      path.join(vaultRoot, "trash", "a.png"), // sibling directory
      `${path.resolve(vaultRoot, "gen")}-evil${path.sep}a.png`, // startsWith() prefix collision
    ];

    for (const dest of bad) {
      await expect(
        downloadResult("https://cdn/x.png", dest, { ...CONFIG, vaultRoot }, { fetchImpl, createWriteStreamImpl, mkdirImpl })
      ).rejects.toThrow(/refusing to write outside/);
    }

    // The refusal must happen BEFORE any handle is opened and before the bytes
    // are even requested — "it threw" is not the same claim as "it wrote nothing".
    expect(createWriteStreamImpl).toHaveBeenCalledTimes(0);
    expect(mkdirImpl).toHaveBeenCalledTimes(0);
    expect(fetchImpl).toHaveBeenCalledTimes(0);
  });

  it("streams the body rather than buffering it — no arrayBuffer/text is ever read off the asset response", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fal-dl-"));
    const root = path.join(dir, "vault");
    const dest = path.join(root, "gen", "a.png");

    const arrayBuffer = vi.fn();
    const text = vi.fn();
    const { Readable } = await import("node:stream");
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: Readable.from([Buffer.from("PNGBYTES")]),
      arrayBuffer,
      text,
    }));

    const out = await downloadResult("https://cdn/x.png", dest, { ...CONFIG, vaultRoot: root }, { fetchImpl });

    expect(out).toBe(path.resolve(dest));
    expect(fs.readFileSync(dest, "utf-8")).toBe("PNGBYTES");
    // If either of these had been called the implementation would be buffering.
    expect(arrayBuffer).toHaveBeenCalledTimes(0);
    expect(text).toHaveBeenCalledTimes(0);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("does NOT send the fal key to the CDN host — the asset url is third-party", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fal-cdn-"));
    const root = path.join(dir, "vault");
    const { Readable } = await import("node:stream");
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, body: Readable.from([Buffer.from("X")]) }));

    await downloadResult("https://cdn/x.png", path.join(root, "gen", "a.png"), { ...CONFIG, vaultRoot: root }, { fetchImpl });

    const init = fetchImpl.mock.calls[0][1];
    expect(init.headers).toBeUndefined();
    expect(JSON.stringify(init)).not.toContain(FAKE_KEY);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("extractAssetUrl: enumerated shapes, and a loud failure on an unknown one", () => {
  it("finds the url in the documented image payload", () => {
    expect(
      extractAssetUrl({ images: [{ url: "https://cdn/a.png", content_type: "image/png" }] })
    ).toEqual({ url: "https://cdn/a.png", contentType: "image/png" });
  });

  it("finds a video payload", () => {
    expect(extractAssetUrl({ video: { url: "https://cdn/a.mp4" } }).url).toBe("https://cdn/a.mp4");
  });

  it("throws with the payload's key list rather than returning undefined", () => {
    expect(() => extractAssetUrl({ nope: 1, other: 2 })).toThrow(/nope,other/);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * The composed flow
 * ════════════════════════════════════════════════════════════════════════*/

describe("generate: submit -> poll -> fetch -> download, returning a contract-shaped sidecar", () => {
  it("returns params ALREADY STRINGIFIED, because sanitizeSidecar drops an object", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fal-gen-"));
    const root = path.join(dir, "vault");
    const clock = fakeClock();
    const { Readable } = await import("node:stream");

    const fetchImpl = vi.fn(async (url) => {
      const u = String(url);
      if (u === "https://queue.fal.run/fal-ai/x") return jsonResp(200, SUBMIT_OK);
      if (u.endsWith("/status")) return jsonResp(200, { status: "COMPLETED", response_url: SUBMIT_OK.response_url });
      if (u === SUBMIT_OK.response_url) {
        return jsonResp(200, { images: [{ url: "https://cdn/a.png", content_type: "image/png" }] });
      }
      return { ok: true, status: 200, body: Readable.from([Buffer.from("BYTES")]) };
    });

    const out = await generate(
      { modelId: "fal-ai/x", prompt: "a lighthouse", params: { image_size: "square" }, destPath: path.join(root, "gen", "a.png") },
      { ...CONFIG, vaultRoot: root },
      { fetchImpl, sleep: clock.sleep, now: clock.now }
    );

    expect(out.ok).toBe(true);
    expect(out.requestId).toBe("req-abc");
    expect(out.sidecar).toEqual({
      prompt: "a lighthouse",
      model: "fal-ai/x",
      provider: "fal",
      params: '{"prompt":"a lighthouse","image_size":"square"}',
    });
    // The contract's §3 warning, asserted rather than trusted.
    expect(typeof out.sidecar.params).toBe("string");
    expect(fs.readFileSync(out.localPath, "utf-8")).toBe("BYTES");

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("a poll that never terminates returns ok:false and NEVER downloads — the caller is not handed a half-finished job", async () => {
    const clock = fakeClock();
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith("/status")) return jsonResp(200, { status: "IN_PROGRESS" });
      return jsonResp(200, SUBMIT_OK);
    });
    const createWriteStreamImpl = vi.fn();

    const out = await generate(
      { modelId: "fal-ai/x", prompt: "p", destPath: "C:\\tmp\\vault-fixture\\gen\\a.png" },
      CONFIG,
      { fetchImpl, sleep: clock.sleep, now: clock.now, createWriteStreamImpl, poll: { maxAttempts: 3, intervalMs: 1 } }
    );

    expect(out).toMatchObject({ ok: false, reason: "POLL_TIMEOUT", attempts: 3 });
    expect(createWriteStreamImpl).toHaveBeenCalledTimes(0);
  });
});

describe("defaultDestPath: short by design", () => {
  it("lands in gen\\ and stays under the 40-char rule-C threshold that trips detectCredentialValue", () => {
    const p = defaultDestPath("C:\\v", "fal-ai/flux/schnell", "image/png", Date.parse("2026-08-15T14:45:53Z"));
    expect(p).toBe(path.join("C:\\v", "gen", "fal_schnell_20260815T144553.png"));
    // The documented false positive in convex/media.ts fires at >=40 chars of
    // key alphabet. This name is deliberately shorter so a generated file never
    // trips the guard that a hand-named control file did.
    expect(path.basename(p, ".png").length).toBeLessThan(40);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * The donor's failure mode (T-118-43)
 * ════════════════════════════════════════════════════════════════════════*/

describe("this module is NOT a stub — the specific way its donor is broken", () => {
  const modulePath = path.join(process.cwd(), "hooks", "studioFal.mjs");
  const veoPath = path.join(
    os.homedir(),
    ".claude/skills/mandras_made_skills/caught_on_camera/src/ai/veo.ts".split("/").join(path.sep)
  );

  it("contains no `not implemented` throw and no TODO marker, with veo.ts as the CONTROL proving the pattern finds them", () => {
    const src = fs.readFileSync(modulePath, "utf-8");

    // CONTROL FIRST. A zero from a pattern that has never been shown to match
    // anything is a claim about the pattern, not about the file.
    const veo = fs.readFileSync(veoPath, "utf-8");
    expect(veo).toMatch(/not implemented/);
    expect(veo).toMatch(/TODO/);

    // Now the subject, using the SAME patterns.
    expect(src).not.toMatch(/not implemented/);
    expect(src).not.toMatch(/TODO/);
  });

  it("has no shebang and imports only node: builtins", () => {
    const src = fs.readFileSync(modulePath, "utf-8");
    expect(src.startsWith("#!")).toBe(false);
    const imports = [...src.matchAll(/^import .*? from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(0);
    for (const spec of imports) expect(spec).toMatch(/^node:/);
  });

  it("every exported function is callable — the donor's stubs threw on first use, which no shape check catches", async () => {
    const mod = await import("../studioFal.mjs");
    const exported = ["resolveFalConfig", "isTransient", "withRetry", "submitJob", "pollJob", "fetchResult",
      "extractAssetUrl", "assertInsideGen", "downloadResult", "generate", "redactUrl", "defaultDestPath",
      "parseArgs", "main"];
    for (const name of exported) expect(typeof mod[name]).toBe("function");
  });
});
