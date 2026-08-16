// Control-paired tests for hooks/studioThirdLeg.mjs — D-09's THIRD leg (Phase 118 plan 118-14).
//
// NOTHING here reaches the network and nothing reaches C:\Users\mandr\media-vault,
// which is real operator data (T-118-25). Every filesystem-touching test injects
// writeFileImpl / createWriteStreamImpl / mkdirImpl, so a refusal can be proven to
// have performed ZERO writes rather than merely to have thrown.
//
// The load-bearing test in this file is the LAST describe block: the sidecar this
// leg produces is compared against the sidecar LEG 2 ACTUALLY PRODUCES, by running
// studioFal's `generate` with a mocked fetch. Comparing against a hand-written
// expectation would only prove this module matches my belief about the contract;
// comparing against the other leg's real output is what proves the contract is not
// generator-specific, which is D-09's entire stated purpose.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, PassThrough } from "node:stream";
import {
  resolveThirdLegConfig,
  assertInsideGen,
  buildSidecar,
  sidecarPathFor,
  writeSidecar,
  downloadAsset,
  writeAssetBytes,
  place,
  parseArgs,
  defaultDestPath,
  redactUrl,
  main,
  PROVIDER,
} from "../studioThirdLeg.mjs";
import { generate as falGenerate } from "../studioFal.mjs";

const CONFIG = { vaultRoot: "C:\\tmp\\vault-fixture" };
const GEN = path.resolve(CONFIG.vaultRoot, "gen");

/** Minimal fetch-Response-shaped mock, matching studioFal.test.mjs's helper. */
function jsonResp(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

/** A body that can only be consumed by streaming — reading it any other way throws,
 * so "it streams" is proven by the alternative being impossible rather than asserted. */
function streamOnlyResp(chunks = ["bytes"]) {
  return {
    ok: true,
    status: 200,
    body: Readable.from(chunks.map((c) => Buffer.from(c))),
    get arrayBuffer() {
      throw new Error("arrayBuffer() must never be called — the asset must stream");
    },
    get text() {
      throw new Error("text() must never be called — the asset must stream");
    },
  };
}

/** Collects everything written to it, so a stream assertion can check BYTES. */
function collectingSink(bucket) {
  const s = new PassThrough();
  s.on("data", (d) => bucket.push(d.toString()));
  return s;
}

/* ──────────────────────────────────────────────────────────────────────── */

describe("resolveThirdLegConfig: one variable, and NO credential of any kind", () => {
  it("defaults the vault root when MEDIA_VAULT_ROOT is unset", () => {
    expect(resolveThirdLegConfig({}).vaultRoot).toBe("C:\\Users\\mandr\\media-vault");
  });

  it("MEDIA_VAULT_ROOT overrides the default — the CONTROL proving the resolver reads env at all", () => {
    expect(resolveThirdLegConfig({ MEDIA_VAULT_ROOT: "D:\\v" }).vaultRoot).toBe("D:\\v");
  });

  it("reads NO *_KEY/_TOKEN/_SECRET variable — leg 3's differentiating fact, asserted not assumed", () => {
    // A Proxy over env records every key the resolver actually touches. Without the
    // control above, "touched no key" would also pass if the resolver read nothing.
    const touched = [];
    const env = new Proxy(
      { MEDIA_VAULT_ROOT: "D:\\v", OPENART_API_KEY: "x", FAL_KEY: "y", OPENART_TOKEN: "z" },
      {
        get(t, p) {
          touched.push(String(p));
          return t[p];
        },
      }
    );
    const cfg = resolveThirdLegConfig(env);
    expect(cfg.vaultRoot).toBe("D:\\v"); // control: it DID read something
    expect(touched).toContain("MEDIA_VAULT_ROOT");
    expect(touched.filter((k) => /_KEY$|_TOKEN$|_SECRET$/.test(k))).toEqual([]);
  });
});

describe("assertInsideGen: refuses traversal, siblings and prefix collisions", () => {
  it("accepts a path inside gen\\", () => {
    expect(assertInsideGen(path.join(GEN, "a.png"), CONFIG.vaultRoot)).toBe(path.join(GEN, "a.png"));
  });

  it("refuses a traversal, a sibling directory and a PREFIX collision", () => {
    for (const bad of [
      path.join(GEN, "..", "trash", "a.png"),
      path.join(CONFIG.vaultRoot, "refs", "a.png"),
      `${GEN}-evil\\a.png`,
    ]) {
      expect(() => assertInsideGen(bad, CONFIG.vaultRoot)).toThrow(/refusing to write outside/);
    }
  });
});

describe("writeSidecar: primary naming form, and zero writes on refusal", () => {
  it("uses the media file's FULL path plus .json (contract §2 primary), never the stem fallback", () => {
    expect(sidecarPathFor("C:\\v\\gen\\sunset_v3.png")).toBe("C:\\v\\gen\\sunset_v3.png.json");
    expect(sidecarPathFor("C:\\v\\gen\\sunset_v3.png")).not.toBe("C:\\v\\gen\\sunset_v3.json");
  });

  it("writes pretty JSON with a trailing newline next to the media file", async () => {
    const writeFileImpl = vi.fn(async () => {});
    const mkdirImpl = vi.fn(async () => {});
    const p = await writeSidecar(path.join(GEN, "a.png"), { provider: "openart" }, CONFIG, {
      writeFileImpl,
      mkdirImpl,
    });
    expect(p).toBe(path.join(GEN, "a.png.json"));
    const [, contents, enc] = writeFileImpl.mock.calls[0];
    expect(enc).toBe("utf8");
    expect(contents.endsWith("\n")).toBe(true);
    expect(JSON.parse(contents)).toEqual({ provider: "openart" });
  });

  it("CONTROL PAIR: a sidecar destined outside gen\\ throws and performs ZERO writes", async () => {
    const writeFileImpl = vi.fn(async () => {});
    const mkdirImpl = vi.fn(async () => {});
    await expect(
      writeSidecar(path.join(CONFIG.vaultRoot, "trash", "a.png"), {}, CONFIG, { writeFileImpl, mkdirImpl })
    ).rejects.toThrow(/refusing to write outside/);
    expect(writeFileImpl).not.toHaveBeenCalled();
    expect(mkdirImpl).not.toHaveBeenCalled();
  });
});

describe("buildSidecar: contract §3 shapes", () => {
  it("params is ALWAYS a string — an object is serialised, because sanitizeSidecar drops objects", () => {
    const s = buildSidecar({ prompt: "p", model: "m", params: { aspect_ratio: "16:9" } });
    expect(typeof s.params).toBe("string");
    expect(JSON.parse(s.params)).toEqual({ aspect_ratio: "16:9" });
  });

  it("an already-serialised params string passes through unchanged rather than being double-encoded", () => {
    const s = buildSidecar({ params: '{"a":1}' });
    expect(s.params).toBe('{"a":1}');
  });

  it("always stamps provider, and it names the BACKEND not the tool or the agent", () => {
    expect(buildSidecar({}).provider).toBe("openart");
    expect(PROVIDER).toBe("openart");
  });

  it("OMITS empty fields rather than writing null — absent is a defined state, a null is a dropped field", () => {
    const s = buildSidecar({ prompt: "", model: undefined, tags: [] });
    expect(Object.keys(s)).toEqual(["provider"]);
    expect("prompt" in s).toBe(false);
    expect("tags" in s).toBe(false);
  });

  it("does not invent provenance from anything — an empty call yields provider only", () => {
    expect(buildSidecar()).toEqual({ provider: "openart" });
  });
});

describe("downloadAsset: streams, refuses, and sends no credential", () => {
  it("streams the body rather than buffering — arrayBuffer() throws if touched", async () => {
    const writes = [];
    const createWriteStreamImpl = () => collectingSink(writes);
    const fetchImpl = vi.fn(async () => streamOnlyResp(["ab", "cd"]));
    await downloadAsset("https://cdn.example/x.png", path.join(GEN, "x.png"), CONFIG, {
      fetchImpl,
      createWriteStreamImpl,
      mkdirImpl: async () => {},
    });
    expect(writes.join("")).toBe("abcd");
  });

  it("sends NO Authorization header — this leg has no credential and the CDN is third-party", async () => {
    const fetchImpl = vi.fn(async () => streamOnlyResp());
    await downloadAsset("https://cdn.example/x.png", path.join(GEN, "x.png"), CONFIG, {
      fetchImpl,
      createWriteStreamImpl: () => new PassThrough(),
      mkdirImpl: async () => {},
    });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers).toBeUndefined();
    expect(init.signal).toBeDefined(); // every fetch carries an abort signal
  });

  it("CONTROL PAIR: a traversal destination refuses BEFORE fetching — zero fetches, zero writes", async () => {
    const fetchImpl = vi.fn();
    const createWriteStreamImpl = vi.fn();
    const mkdirImpl = vi.fn();
    await expect(
      downloadAsset("https://cdn.example/x.png", path.join(GEN, "..", "trash", "x.png"), CONFIG, {
        fetchImpl,
        createWriteStreamImpl,
        mkdirImpl,
      })
    ).rejects.toThrow(/refusing to write outside/);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(createWriteStreamImpl).not.toHaveBeenCalled();
    expect(mkdirImpl).not.toHaveBeenCalled();
  });

  it("redactUrl strips a query string so a signed asset url cannot reach a log intact", () => {
    expect(redactUrl("https://cdn.example/a.png?sig=abc123&exp=9")).toBe("https://cdn.example/a.png");
    expect(redactUrl("not a url")).toBe("[unparseable url]");
  });
});

describe("writeAssetBytes: the inline-bytes path obeys the same refusal", () => {
  it("writes bytes inside gen\\", async () => {
    const writeFileImpl = vi.fn(async () => {});
    const p = await writeAssetBytes(Buffer.from("x"), path.join(GEN, "b.png"), CONFIG, {
      writeFileImpl,
      mkdirImpl: async () => {},
    });
    expect(p).toBe(path.join(GEN, "b.png"));
  });

  it("CONTROL PAIR: refuses outside gen\\ with zero writes", async () => {
    const writeFileImpl = vi.fn(async () => {});
    const mkdirImpl = vi.fn(async () => {});
    await expect(
      writeAssetBytes(Buffer.from("x"), "C:\\evil\\b.png", CONFIG, { writeFileImpl, mkdirImpl })
    ).rejects.toThrow(/refusing to write outside/);
    expect(writeFileImpl).not.toHaveBeenCalled();
  });
});

describe("place: the sidecar is written BEFORE the media, and that order is load-bearing", () => {
  it("sidecar first — a media file ingested before its sidecar loses provenance permanently (contract §6)", async () => {
    const order = [];
    const writeFileImpl = vi.fn(async (p) => {
      order.push(String(p).endsWith(".json") ? "sidecar" : "media");
    });
    await place(
      { bytes: Buffer.from("x"), destPath: path.join(GEN, "c.png"), provenance: { prompt: "p", model: "m" } },
      CONFIG,
      { writeFileImpl, mkdirImpl: async () => {} }
    );
    expect(order).toEqual(["sidecar", "media"]);
  });

  it("requires either assetUrl or bytes rather than silently producing a sidecar with no media", async () => {
    await expect(place({ destPath: path.join(GEN, "c.png") }, CONFIG, {})).rejects.toThrow(
      /needs either assetUrl or bytes/
    );
  });

  it("CONTROL PAIR: an out-of-vault destination refuses before ANY write, sidecar included", async () => {
    const writeFileImpl = vi.fn(async () => {});
    await expect(
      place({ bytes: Buffer.from("x"), destPath: "C:\\evil\\c.png" }, CONFIG, {
        writeFileImpl,
        mkdirImpl: async () => {},
      })
    ).rejects.toThrow(/refusing to write outside/);
    expect(writeFileImpl).not.toHaveBeenCalled();
  });
});

describe("main(): fails loud on missing provenance rather than inventing it", () => {
  const base = ["--url", "https://cdn.example/x.png", "--model", "m", "--prompt", "p"];

  it("exits 2 with no --prompt — a filename-derived prompt is exactly what contract §5 forbids", async () => {
    const errorLog = vi.fn();
    const fetchImpl = vi.fn();
    const code = await main(["--url", "u", "--model", "m"], { errorLog, fetchImpl, env: {} });
    expect(code).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exits 2 with no --model, and never fetches", async () => {
    const fetchImpl = vi.fn();
    expect(await main(["--url", "u", "--prompt", "p"], { errorLog: vi.fn(), fetchImpl, env: {} })).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exits 2 with neither --url nor --file — this leg places, it does not generate", async () => {
    expect(await main(["--model", "m", "--prompt", "p"], { errorLog: vi.fn(), env: {} })).toBe(2);
  });

  it("CONTROL: the same argv WITH every required flag reaches the write path and exits 0", async () => {
    const writeFileImpl = vi.fn(async () => {});
    const code = await main([...base, "--out", path.join(GEN, "ok.png")], {
      env: { MEDIA_VAULT_ROOT: CONFIG.vaultRoot },
      log: vi.fn(),
      errorLog: vi.fn(),
      fetchImpl: async () => streamOnlyResp(),
      createWriteStreamImpl: () => new PassThrough(),
      mkdirImpl: async () => {},
      writeFileImpl,
    });
    expect(code).toBe(0);
  });

  it("parseArgs rejects a flag with no value rather than silently taking undefined", () => {
    expect(() => parseArgs(["--model"])).toThrow(/needs a value/);
  });

  it("defaultDestPath lands in gen\\ with a SHORT stem (detectCredentialValue rule C is length-sensitive)", () => {
    const p = defaultDestPath(CONFIG.vaultRoot, "openart/kling-3-omni", "image/png", Date.parse("2026-08-16T12:00:00Z"));
    expect(assertInsideGen(p, CONFIG.vaultRoot)).toBe(path.resolve(p));
    expect(path.basename(p).length).toBeLessThan(40);
    expect(p.endsWith(".png")).toBe(true);
  });
});

describe("source hygiene: no stub markers, with a control proving the pattern finds them", () => {
  // Resolved from the repo root rather than import.meta.url: under vitest the module
  // url is not a file: scheme, and `new URL(...)` throws before any test runs.
  const SRC = fs.readFileSync(path.resolve("hooks/studioThirdLeg.mjs"), "utf8");

  /**
   * Strip FULL-LINE comments only (a line whose trimmed form starts with `//` or `*`).
   * Deliberately not a general comment parser: a mid-line strip would mangle every
   * `https://` in the file, and this codebase writes its comments on their own lines.
   *
   * This exists because the naive whole-file version of the assertion below is the
   * SAME defect class this plan already found in its own Task 1 check — the module's
   * header comment says "sends NO Authorization header", so a whole-file grep matches
   * the prose and reports the opposite of the truth.
   */
  function codeOnly(src) {
    return src
      .split("\n")
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join("\n");
  }


  it("has no shebang and imports only node: builtins", () => {
    expect(SRC.startsWith("#!")).toBe(false);
    const specs = [...SRC.matchAll(/^import\s.*?from\s+"([^"]+)"/gm)].map((m) => m[1]);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs.every((s) => s.startsWith("node:"))).toBe(true);
  });

  it("contains no unimplemented-stub marker — CONTROL: the same patterns DO find them in veo.ts", () => {
    const patterns = [/not\s+implemented/i, /\bTODO\b/];
    for (const p of patterns) expect(p.test(SRC)).toBe(false);

    const control = path.join(
      os.homedir(),
      ".claude/skills/mandras_made_skills/caught_on_camera/src/ai/veo.ts"
    );
    // The control is what makes the zeros above mean something. If it is missing,
    // fail rather than silently downgrading to an unproven assertion.
    expect(fs.existsSync(control)).toBe(true);
    const ctl = fs.readFileSync(control, "utf8");
    expect(patterns.some((p) => p.test(ctl))).toBe(true);
  });

  it("carries no HTTP-client shape borrowed from leg 2 — asserted on CODE, not on prose", () => {
    const code = codeOnly(SRC);

    // CONTROL: the stripper must not simply erase everything, and the patterns must
    // be capable of matching. studioFal.mjs genuinely HAS an Authorization header and
    // a retry policy in its code, so it is the known-positive that proves both.
    const falCode = codeOnly(fs.readFileSync(path.resolve("hooks/studioFal.mjs"), "utf8"));
    expect(falCode.length).toBeGreaterThan(1000);
    expect(/Authorization/i.test(falCode)).toBe(true);
    expect(/withRetry|maxAttempts|backoffFactor/.test(falCode)).toBe(true);
    expect(/status_url|queue\.fal\.run|pollJob/.test(falCode)).toBe(true);

    // The subject. These four absences are what make this a third shape rather than
    // a second copy of leg 2. If a future edit adds them, leg 3 has collapsed into
    // leg 2 and D-09's intent is defeated even though its letter still reads as met.
    expect(code.length).toBeGreaterThan(1000); // the stripper left real code behind
    expect(/Authorization/i.test(code)).toBe(false);
    expect(/withRetry|maxAttempts|backoffFactor/.test(code)).toBe(false);
    expect(/status_url|queue\.fal\.run|pollJob/.test(code)).toBe(false);
  });

  it("HAS a CLI entry point guarded to this filename — a module with a main() and no entry point exits 0 having done nothing", () => {
    // This is a regression test for a real defect, not a hypothetical. The first
    // real placement run returned exit 0, printed nothing and wrote no file,
    // because main() was exported but never invoked. At the shell that is
    // indistinguishable from success, so the exit code could not catch it.
    const code = codeOnly(SRC);
    expect(/process\.argv\[1\]/.test(code)).toBe(true);
    expect(/endsWith\("studioThirdLeg\.mjs"\)/.test(code)).toBe(true);
    expect(/\bmain\(\)/.test(code)).toBe(true);
    // The guard must name THIS file: a copy-pasted guard naming another module
    // would never fire, reproducing the same silent no-op.
    expect(/endsWith\("studioFal\.mjs"\)/.test(code)).toBe(false);
  });

  it("contains no credential value: no long high-entropy token-shaped literal", () => {
    const literals = [...codeOnly(SRC).matchAll(/["'`]([A-Za-z0-9_\-]{32,})["'`]/g)].map((m) => m[1]);
    expect(literals).toEqual([]);
  });
});

describe("THE LOAD-BEARING TEST: this leg's sidecar is structurally identical to leg 2's REAL output", () => {
  /** Run studioFal's real `generate` with a mocked fetch to obtain leg 2's ACTUAL
   * sidecar. Comparing against a hand-written expectation would only prove this
   * module matches my belief about the contract. */
  async function realFalSidecar() {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push(String(url));
      if (init?.method === "POST") {
        return jsonResp(200, {
          request_id: "r1",
          status_url: "https://queue.fal.run/s",
          response_url: "https://queue.fal.run/r",
        });
      }
      if (String(url).endsWith("/s")) return jsonResp(200, { status: "COMPLETED" });
      if (String(url).endsWith("/r")) {
        return jsonResp(200, { images: [{ url: "https://cdn.fal/x.png", content_type: "image/png" }] });
      }
      return streamOnlyResp();
    });
    const out = await falGenerate(
      { modelId: "fal-ai/flux/dev", prompt: "a cyan lighthouse", params: { aspect_ratio: "1:1" }, destPath: path.join(GEN, "f.png") },
      { falKey: "falfake-7q2v8m1p0zt4x9c3n6", vaultRoot: CONFIG.vaultRoot },
      {
        fetchImpl,
        createWriteStreamImpl: () => new PassThrough(),
        mkdirImpl: async () => {},
        sleep: async () => {},
      }
    );
    return out.sidecar;
  }

  it("same key set, in the same order, with the same value types", async () => {
    const fal = await realFalSidecar();
    const mine = buildSidecar({
      prompt: "a cyan lighthouse",
      model: "openart/kling-3-omni",
      params: { aspect_ratio: "1:1" },
    });

    expect(Object.keys(mine)).toEqual(Object.keys(fal));
    for (const k of Object.keys(fal)) {
      expect(typeof mine[k]).toBe(typeof fal[k]);
    }
  });

  it("params is a STRING on BOTH legs — the one contract rule that looks like it should work the other way", async () => {
    const fal = await realFalSidecar();
    const mine = buildSidecar({ prompt: "p", model: "m", params: { a: 1 } });
    expect(typeof fal.params).toBe("string");
    expect(typeof mine.params).toBe("string");
  });

  it("provider is the ONE field whose value must differ — it names the backend, and that is the point", async () => {
    const fal = await realFalSidecar();
    const mine = buildSidecar({ prompt: "p", model: "m", params: {} });
    expect(fal.provider).toBe("fal");
    expect(mine.provider).toBe("openart");
    expect(mine.provider).not.toBe(fal.provider);
  });
});

