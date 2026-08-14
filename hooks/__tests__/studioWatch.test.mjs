// Control-paired tests for hooks/studioWatch.mjs's scan core (Phase 118 Plan 07,
// D-05/D-06/D-07). Every fixture lives under os.tmpdir() and is torn down in afterEach —
// NEVER point a test at C:\Users\mandr\media-vault, which is real operator data (T-118-25).
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  resolveConfig,
  classifyFile,
  hashFile,
  readSidecar,
  scanVault,
  encodeThumbnail,
  uploadThumbnail,
  ingestCandidate,
  reconcileTrash,
  runWatchCycle,
  main,
  THUMB_MAX_BYTES,
  THUMB_MAX_ATTEMPTS,
} from "../studioWatch.mjs";

/** Minimal fetch-Response-shaped mock — every injected fetchImpl below returns one of these. */
function jsonResp(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const fixtureRoots = [];

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "studio-watch-fixture-"));
  for (const d of ["gen", "refs", "styles", "trash"]) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }
  fixtureRoots.push(root);
  return root;
}

function writeMedia(root, relPath, content) {
  const abs = path.join(root, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function writeSidecarRaw(root, relPath, raw) {
  writeMedia(root, relPath, raw);
}

/** Wraps the real hashFile so a test can assert exactly how many times it was called. */
function makeCountingHash() {
  const calls = { count: 0 };
  const fn = async (absPath, deps) => {
    calls.count++;
    return hashFile(absPath, deps);
  };
  return { fn, calls };
}

afterEach(() => {
  while (fixtureRoots.length) {
    const root = fixtureRoots.pop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── D-05: content identity ──────────────────────────────────────────────────────────────
describe("hashFile — D-05 content identity", () => {
  it("#1 same bytes hash identically regardless of path/mtime; different bytes hash differently (control)", async () => {
    const root = makeFixture();
    const p1 = writeMedia(root, "gen/a.png", "identical-bytes");
    const p2 = writeMedia(root, "refs/b.png", "identical-bytes");
    // Different mtimes on purpose — mtime must never enter the hash.
    const past = new Date(Date.now() - 100_000);
    fs.utimesSync(p1, past, past);

    const h1 = await hashFile(p1);
    const h2 = await hashFile(p2);
    expect(h1).toBe(h2);

    // Control: a one-sided test (same bytes -> same hash) would pass against a function
    // returning a constant. Different bytes must produce a different hash.
    const p3 = writeMedia(root, "gen/c.png", "different-bytes");
    const h3 = await hashFile(p3);
    expect(h3).not.toBe(h1);
  });

  it("#2 rename stability: hash unchanged across rename+move; candidate identity is the hash, not path-derived", async () => {
    const root = makeFixture();
    const original = writeMedia(root, "gen/original-name.png", "stable-bytes");
    const beforeHash = await hashFile(original);

    const renamed = path.join(root, "refs", "renamed-name.png");
    fs.renameSync(original, renamed);
    const afterHash = await hashFile(renamed);
    expect(afterHash).toBe(beforeHash);

    const { candidates } = await scanVault(root, {});
    expect(candidates).toHaveLength(1);
    const c = candidates[0];
    expect(c.contentHash).toBe(beforeHash);
    // The assertion that fails if someone later "optimises" identity to a path.
    expect(c.contentHash).not.toBe(c.absPath);
    expect(c.contentHash).not.toBe(c.relPath);
    expect(c.contentHash).not.toContain("renamed-name");
  });
});

// ── D-06: mtime-gated re-hash cache is a performance shortcut, never identity ───────────
describe("scanVault — D-06 mtime-gated cache", () => {
  it("#3 warm rescan of an unchanged vault re-hashes ZERO files", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/a.png", "aaa");
    writeMedia(root, "gen/b.png", "bbb");

    const counter1 = makeCountingHash();
    const first = await scanVault(root, {}, { hashFileImpl: counter1.fn });
    expect(counter1.calls.count).toBe(2);
    expect(first.candidates).toHaveLength(2);

    const counter2 = makeCountingHash();
    const second = await scanVault(root, first.cache, { hashFileImpl: counter2.fn });
    // Instrumented call count, not a wall-clock or "it felt fast" proxy.
    expect(counter2.calls.count).toBe(0);
    expect(second.candidates).toHaveLength(2);
  });

  it("#4 cold rescan (cache deleted) re-hashes every file, and every hash matches the warm run (control for #3)", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/a.png", "aaa");
    writeMedia(root, "gen/b.png", "bbb");

    const counterWarm = makeCountingHash();
    const warm = await scanVault(root, {}, { hashFileImpl: counterWarm.fn });

    // "Cold" = cache deleted, i.e. scan again with an empty cache object.
    const counterCold = makeCountingHash();
    const cold = await scanVault(root, {}, { hashFileImpl: counterCold.fn });
    expect(counterCold.calls.count).toBe(2);

    // This is the pair that proves the cache is a shortcut, not the identity: an
    // implementation that stored identity IN the cache would produce different (or
    // missing) hashes here.
    const warmByRel = Object.fromEntries(warm.candidates.map((c) => [c.relPath, c.contentHash]));
    const coldByRel = Object.fromEntries(cold.candidates.map((c) => [c.relPath, c.contentHash]));
    expect(coldByRel).toEqual(warmByRel);
  });

  it("#5 mtime change without a byte change triggers a re-hash, and the resulting hash is unchanged", async () => {
    const root = makeFixture();
    const p = writeMedia(root, "gen/a.png", "aaa");

    const counter1 = makeCountingHash();
    const first = await scanVault(root, {}, { hashFileImpl: counter1.fn });
    const originalHash = first.candidates[0].contentHash;

    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(p, future, future);

    const counter2 = makeCountingHash();
    const second = await scanVault(root, first.cache, { hashFileImpl: counter2.fn });
    // Half 1: the cache correctly invalidates on mtime change.
    expect(counter2.calls.count).toBe(1);
    // Half 2: mtime never entered the key — the hash itself is unchanged.
    expect(second.candidates[0].contentHash).toBe(originalHash);
  });
});

// ── D-07: sidecar absence / malformation are first-class states ────────────────────────
describe("readSidecar / scanVault — D-07 sidecar tri-state", () => {
  it("#6 a file with no sidecar is present with sidecarStatus 'absent'; a sibling WITH a sidecar is 'present' (control)", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/no-sidecar.png", "aaa");
    writeMedia(root, "gen/has-sidecar.png", "bbb");
    writeSidecarRaw(root, "gen/has-sidecar.png.json", JSON.stringify({ prompt: "a cat" }));

    const { candidates } = await scanVault(root, {});
    // A test with only the sidecar-less file would pass against a scanner that returns
    // "absent" for everything.
    expect(candidates).toHaveLength(2);

    const absent = candidates.find((c) => c.filename === "no-sidecar.png");
    const present = candidates.find((c) => c.filename === "has-sidecar.png");
    expect(absent.sidecarStatus).toBe("absent");
    expect(absent.sidecar).toBeNull();
    expect(present.sidecarStatus).toBe("present");
    expect(present.sidecar).toEqual({ prompt: "a cat" });
  });

  it("#7 malformed JSON and a JSON array both produce 'malformed' with the file STILL in the candidate list", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/bad-json.png", "aaa");
    writeSidecarRaw(root, "gen/bad-json.png.json", "{not valid json");
    writeMedia(root, "gen/array-sidecar.png", "bbb");
    writeSidecarRaw(root, "gen/array-sidecar.png.json", "[1,2,3]");

    const { candidates } = await scanVault(root, {});
    // Candidate count equals media-file count — the failure this guards against is a file
    // silently disappearing.
    expect(candidates).toHaveLength(2);

    const badJson = candidates.find((c) => c.filename === "bad-json.png");
    const arraySidecar = candidates.find((c) => c.filename === "array-sidecar.png");
    expect(badJson.sidecarStatus).toBe("malformed");
    expect(badJson.sidecar).toBeNull();
    expect(arraySidecar.sidecarStatus).toBe("malformed");
    expect(arraySidecar.sidecar).toBeNull();
  });

  it("#8 no filename inference: a prompt-shaped filename never leaks into a provenance-bearing field", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/a-photorealistic-sunset-over-mountains.png", "aaa");

    const { candidates } = await scanVault(root, {});
    expect(candidates).toHaveLength(1);
    const c = candidates[0];
    expect(c.sidecar).toBeNull();

    // CORRECTION to the plan's literal wording (see 118-07-SUMMARY.md "Deviations"):
    // filename/absPath/relPath are structural path fields that legitimately and necessarily
    // contain the filename text — asserting the whole candidate object never contains
    // "sunset" would fail against a CORRECT implementation for that reason alone. The
    // property this test actually guards is that no PROVENANCE-bearing field is inferred
    // from the name, so the check excludes exactly those three structural fields.
    const { filename, absPath, relPath, ...rest } = c;
    expect(JSON.stringify(rest)).not.toContain("sunset");
  });
});

// ── Sidecar naming precedence ────────────────────────────────────────────────────────────
describe("readSidecar — naming precedence", () => {
  it("#9 primary form (<full path>.json) wins over the fallback (<stem>.json) when both exist", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/foo.png", "aaa");
    writeSidecarRaw(root, "gen/foo.png.json", JSON.stringify({ prompt: "primary" }));
    writeSidecarRaw(root, "gen/foo.json", JSON.stringify({ prompt: "fallback" }));

    const { candidates } = await scanVault(root, {});
    expect(candidates).toHaveLength(1);
    expect(candidates[0].sidecar).toEqual({ prompt: "primary" });
  });
});

// ── Classification: allowlist, not denylist (T-118-06/T-118-24) ────────────────────────
describe("classifyFile — extension allowlist", () => {
  it("#10 .json, README.md and an unknown extension classify as null; one file of each media type classifies correctly (control)", () => {
    expect(classifyFile("gen/a.json")).toBeNull();
    expect(classifyFile("gen/README.md")).toBeNull();
    expect(classifyFile("README.md")).toBeNull(); // not even inside a vault subdirectory
    expect(classifyFile("gen/a.xyz")).toBeNull();

    expect(classifyFile("gen/a.png")).toEqual({ kind: "gen", mediaType: "image" });
    expect(classifyFile("refs/a.mp4")).toEqual({ kind: "ref", mediaType: "video" });
    expect(classifyFile("styles/a.mp3")).toEqual({ kind: "style", mediaType: "audio" });
  });

  it("#10b scanVault: the same non-media files are absent from the candidate list end-to-end", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/pic.png", "aaa");
    writeMedia(root, "gen/clip.mp4", "bbb");
    writeMedia(root, "gen/song.mp3", "ccc");
    writeMedia(root, "gen/orphan.json", "{}"); // a sidecar with no matching media stem
    fs.writeFileSync(path.join(root, "README.md"), "not media");
    writeMedia(root, "gen/unknown.xyz", "ddd");

    const { candidates } = await scanVault(root, {});
    const names = candidates.map((c) => c.filename).sort();
    expect(names).toEqual(["clip.mp4", "pic.png", "song.mp3"]);

    const mediaTypeByName = Object.fromEntries(candidates.map((c) => [c.filename, c.mediaType]));
    expect(mediaTypeByName["pic.png"]).toBe("image");
    expect(mediaTypeByName["clip.mp4"]).toBe("video");
    expect(mediaTypeByName["song.mp3"]).toBe("audio");
  });
});

// ── D-15: resolveConfig has no default for STUDIO_API_KEY ──────────────────────────────
describe("resolveConfig — STUDIO_API_KEY has no default (D-15)", () => {
  it("resolves undefined when the key is absent from env and no skill env file exists", () => {
    const config = resolveConfig(
      { MEDIA_VAULT_ROOT: "C:\\fake\\vault" },
      { existsSyncImpl: () => false }
    );
    expect(config.studioApiKey).toBeUndefined();
    expect(config.mediaVaultRoot).toBe("C:\\fake\\vault");
    expect(config.codepulseUrl).toBe("http://127.0.0.1:3211");
  });

  it("control: a dummy value set in env IS resolved (proves the missing-key path and the present-key path differ)", () => {
    const config = resolveConfig(
      { STUDIO_API_KEY: "dummy-value-not-real" },
      { existsSyncImpl: () => false }
    );
    expect(config.studioApiKey).toBe("dummy-value-not-real");
  });
});

describe("main() — missing STUDIO_API_KEY is a configuration error, exit code 2 (D-15)", () => {
  it("exits 2 when STUDIO_API_KEY is unset", () => {
    const root = makeFixture();
    const result = spawnSync(
      process.execPath,
      [path.resolve("hooks/studioWatch.mjs")],
      {
        cwd: path.resolve("."),
        env: { ...process.env, MEDIA_VAULT_ROOT: root, STUDIO_API_KEY: "" },
        encoding: "utf-8",
      }
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("STUDIO_API_KEY is not set");
  });

  it("control: exits 0 when a dummy STUDIO_API_KEY IS set, proving the two paths discriminate", () => {
    const root = makeFixture();
    const result = spawnSync(
      process.execPath,
      [path.resolve("hooks/studioWatch.mjs")],
      {
        cwd: path.resolve("."),
        env: { ...process.env, MEDIA_VAULT_ROOT: root, STUDIO_API_KEY: "dummy-value-not-real" },
        encoding: "utf-8",
      }
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("candidate(s) found");
  });

  it("control: with STUDIO_API_KEY unset, main() exits 2 and fetchImpl is NEVER called (in-process, via injected exitImpl — proves the halt happens before any network call, not just that an error is eventually returned)", async () => {
    const root = makeFixture();
    const fetchImpl = vi.fn();
    const exitCalls = [];
    await main(
      { MEDIA_VAULT_ROOT: root, STUDIO_API_KEY: "" },
      { fetchImpl, existsSyncImpl: () => false, exitImpl: (code) => exitCalls.push(code) }
    );
    expect(exitCalls).toEqual([2]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ── D-02: encodeThumbnail — bounded ffmpeg webp encoder (plan 118-08 Task 1) ───────────────
describe("encodeThumbnail — D-02 bounded search", () => {
  const stillCandidate = { absPath: "C:\\vault\\gen\\pic.png", mediaType: "image" };
  const videoCandidate = { absPath: "C:\\vault\\gen\\clip.mp4", mediaType: "video" };
  const audioCandidate = { mediaType: "audio" };

  it("under-cap on the first attempt -> exactly one invocation, attempts=1. Control: always-oversized -> exactly THUMB_MAX_ATTEMPTS invocations, ok=false, THUMB_OVER_CAP", async () => {
    const underCalls = [];
    const underResult = await encodeThumbnail(stillCandidate, "C:\\out\\under.webp", {
      runFfmpeg: (args) => {
        underCalls.push(args);
        return { ok: true, stderr: "" };
      },
      statSyncImpl: () => ({ size: 1000 }),
      unlinkSyncImpl: () => {},
    });
    expect(underResult.ok).toBe(true);
    expect(underResult.attempts).toBe(1);
    expect(underCalls.length).toBe(1);

    // Control: a loop that never iterates would also pass a one-sided "eventually refuses"
    // check — assert the exact invocation count, not just the final ok:false.
    const overCalls = [];
    const overResult = await encodeThumbnail(stillCandidate, "C:\\out\\over.webp", {
      runFfmpeg: (args) => {
        overCalls.push(args);
        return { ok: true, stderr: "" };
      },
      statSyncImpl: () => ({ size: THUMB_MAX_BYTES + 1 }),
      unlinkSyncImpl: () => {},
    });
    expect(overResult.ok).toBe(false);
    expect(overResult.reason).toBe("THUMB_OVER_CAP");
    expect(overCalls.length).toBe(THUMB_MAX_ATTEMPTS);
  });

  it("oversized for two attempts then under -> ok=true, attempts=3, and the quality used on attempt 3 is strictly lower than on attempt 1 (asserts the STEPPING, not just eventual success)", async () => {
    const calls = [];
    const sizes = [THUMB_MAX_BYTES + 500, THUMB_MAX_BYTES + 100, 1000];
    let i = 0;
    const result = await encodeThumbnail(stillCandidate, "C:\\out\\step.webp", {
      runFfmpeg: (args) => {
        calls.push(args);
        return { ok: true, stderr: "" };
      },
      statSyncImpl: () => ({ size: sizes[i++] }),
      unlinkSyncImpl: () => {},
    });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(3);
    expect(calls.length).toBe(3);

    function qualityOf(args) {
      return Number(args[args.indexOf("-quality") + 1]);
    }
    expect(qualityOf(calls[2])).toBeLessThan(qualityOf(calls[0]));
  });

  it("the refusal path deletes the oversized temp output — asserted via the unlink call", async () => {
    const unlinkCalls = [];
    const result = await encodeThumbnail(stillCandidate, "C:\\out\\refuse.webp", {
      runFfmpeg: () => ({ ok: true, stderr: "" }),
      statSyncImpl: () => ({ size: THUMB_MAX_BYTES + 1 }),
      unlinkSyncImpl: (p) => unlinkCalls.push(p),
    });
    expect(result.ok).toBe(false);
    expect(unlinkCalls).toEqual(["C:\\out\\refuse.webp"]);
  });

  it("every generated argument list contains -quality and never the older per-frame quality flag ffmpeg silently ignores for libwebp", async () => {
    const calls = [];
    await encodeThumbnail(stillCandidate, "C:\\out\\q.webp", {
      runFfmpeg: (args) => {
        calls.push(args);
        return { ok: true, stderr: "" };
      },
      statSyncImpl: () => ({ size: 1000 }),
    });
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(args).toContain("-quality");
      expect(args.join(" ")).not.toContain("-q:v");
    }
  });

  it("video candidates include the thumbnail filter and -frames:v; still candidates include neither (both asserted together)", async () => {
    const stillCalls = [];
    await encodeThumbnail(stillCandidate, "C:\\out\\still.webp", {
      runFfmpeg: (args) => {
        stillCalls.push(args);
        return { ok: true, stderr: "" };
      },
      statSyncImpl: () => ({ size: 1000 }),
    });
    const videoCalls = [];
    await encodeThumbnail(videoCandidate, "C:\\out\\video.webp", {
      runFfmpeg: (args) => {
        videoCalls.push(args);
        return { ok: true, stderr: "" };
      },
      statSyncImpl: () => ({ size: 1000 }),
    });

    expect(stillCalls[0].some((a) => typeof a === "string" && a.includes("thumbnail,"))).toBe(false);
    expect(stillCalls[0]).not.toContain("-frames:v");

    expect(videoCalls[0].some((a) => typeof a === "string" && a.includes("thumbnail,"))).toBe(true);
    expect(videoCalls[0]).toContain("-frames:v");
  });

  it("audio candidates produce no ffmpeg invocation at all and a no-thumbnail result", async () => {
    const calls = [];
    const result = await encodeThumbnail(audioCandidate, "C:\\out\\audio.webp", {
      runFfmpeg: (args) => {
        calls.push(args);
        return { ok: true, stderr: "" };
      },
    });
    expect(calls.length).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.noThumbnail).toBe(true);
  });

  it("arguments are passed as an Array, and a filename with a space and & survives intact as one argument value", async () => {
    const trickyCandidate = { absPath: "C:\\vault\\gen\\a tricky & file.png", mediaType: "image" };
    const calls = [];
    await encodeThumbnail(trickyCandidate, "C:\\out\\tricky.webp", {
      runFfmpeg: (args) => {
        calls.push(args);
        return { ok: true, stderr: "" };
      },
      statSyncImpl: () => ({ size: 1000 }),
    });
    expect(Array.isArray(calls[0])).toBe(true);
    expect(calls[0]).toContain("C:\\vault\\gen\\a tricky & file.png");
  });

  it("ffmpeg absent from PATH (ENOENT) refuses immediately with FFMPEG_NOT_FOUND after exactly one invocation, not the whole ladder", async () => {
    const calls = [];
    const result = await encodeThumbnail(stillCandidate, "C:\\out\\missing.webp", {
      runFfmpeg: (args) => {
        calls.push(args);
        return { ok: false, notFound: true, error: "spawn ffmpeg ENOENT", stderr: "" };
      },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("FFMPEG_NOT_FOUND");
    expect(calls.length).toBe(1);
  });
});

// ── D-15: uploadThumbnail + ingestCandidate — bearer-authenticated pipeline (plan 118-08 Task 2) ──
describe("uploadThumbnail + ingestCandidate — full network pipeline", () => {
  it("a candidate with a good thumbnail: exactly one upload-url mint, one raw upload, one ingest POST IN THAT ORDER; ingest body carries contentHash/thumbStorageId/thumbBytes; every /studio/* call carries the bearer header", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/pic.png", "fake-image-bytes");

    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith("/studio/upload-url")) {
        return jsonResp(200, { ok: true, uploadUrl: "https://storage.example/upload?token=x" });
      }
      if (url.includes("/upload?token=")) {
        return jsonResp(200, { storageId: "storage-abc" });
      }
      if (url.endsWith("/studio/ingest")) {
        return jsonResp(200, { ok: true, mediaId: "m1", created: true });
      }
      if (url.endsWith("/studio/media-hashes")) {
        return jsonResp(200, { ok: true, rows: [], truncated: false });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const config = {
      mediaVaultRoot: root,
      codepulseUrl: "http://127.0.0.1:3211",
      studioApiKey: "test-key-123",
    };
    const deps = {
      fetchImpl,
      runFfmpeg: () => ({ ok: true, stderr: "" }),
      statSyncImpl: () => ({ size: 1000 }),
      readFileSyncImpl: () => Buffer.from("thumb-bytes"),
      unlinkSyncImpl: () => {},
    };

    const result = await runWatchCycle(config, deps);
    expect(result.totals.ingested).toBe(1);

    const mintCall = calls.find((c) => c.url.endsWith("/studio/upload-url"));
    const uploadCall = calls.find((c) => c.url.includes("/upload?token="));
    const ingestCall = calls.find((c) => c.url.endsWith("/studio/ingest"));
    expect(mintCall).toBeDefined();
    expect(uploadCall).toBeDefined();
    expect(ingestCall).toBeDefined();

    // Order: mint, then raw upload, then ingest.
    expect(calls.indexOf(mintCall)).toBeLessThan(calls.indexOf(uploadCall));
    expect(calls.indexOf(uploadCall)).toBeLessThan(calls.indexOf(ingestCall));

    // Bearer header on every /studio/* call.
    expect(mintCall.init.headers.Authorization).toBe("Bearer test-key-123");
    expect(ingestCall.init.headers.Authorization).toBe("Bearer test-key-123");

    const ingestBody = JSON.parse(ingestCall.init.body);
    expect(ingestBody.contentHash).toBeTruthy();
    expect(ingestBody.thumbStorageId).toBe("storage-abc");
    expect(ingestBody.thumbBytes).toBe(1000);
  });

  it("a 401 from /studio/ingest halts the run immediately — later candidates are never processed, asserted on the fetch call count", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/a.mp3", "aaa");
    writeMedia(root, "gen/b.mp3", "bbb");

    let fetchCallCount = 0;
    const fetchImpl = async (url) => {
      fetchCallCount++;
      if (url.endsWith("/studio/ingest")) return jsonResp(401, { error: "Unauthorized" });
      throw new Error(`unexpected fetch: ${url}`);
    };

    const config = { mediaVaultRoot: root, codepulseUrl: "http://127.0.0.1:3211", studioApiKey: "wrong-key" };
    const result = await runWatchCycle(config, { fetchImpl, warn: () => {} });

    expect(result.haltedUnauthorized).toBe(true);
    expect(result.totals.scanned).toBe(1);
    // Audio candidates skip encode entirely (no upload-url/upload calls), so ONE ingest POST is
    // the only fetch call this run should ever make — the second candidate is never reached, and
    // reconcileTrash is skipped entirely on a halted run.
    expect(fetchCallCount).toBe(1);
  });

  it("200 with created:false counts as a duplicate: no warning, no retry, no non-zero halt", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/song.mp3", "aaa");

    const warnCalls = [];
    const fetchImpl = async (url) => {
      if (url.endsWith("/studio/ingest")) {
        return jsonResp(200, { ok: true, mediaId: "existing", created: false });
      }
      if (url.endsWith("/studio/media-hashes")) return jsonResp(200, { ok: true, rows: [], truncated: false });
      throw new Error(`unexpected fetch: ${url}`);
    };

    const config = { mediaVaultRoot: root, codepulseUrl: "http://127.0.0.1:3211", studioApiKey: "k" };
    const result = await runWatchCycle(config, { fetchImpl, warn: (m) => warnCalls.push(m) });

    expect(result.haltedUnauthorized).toBe(false);
    expect(result.totals.duplicates).toBe(1);
    expect(result.totals.refused).toBe(0);
    expect(warnCalls.some((m) => /refused/i.test(m))).toBe(false);
  });

  it("a THUMB_OVER_CAP-refused candidate is STILL ingested with no thumbStorageId/thumbBytes; a candidate with a good thumbnail DOES carry them (control pair, same test — proves an oversized file becomes a thumbnail-less row rather than disappearing)", async () => {
    const candidate = {
      contentHash: "hash-1",
      filename: "pic.png",
      absPath: "C:\\vault\\gen\\pic.png",
      mediaType: "image",
      kind: "gen",
      sizeBytes: 5000,
    };
    const config = { codepulseUrl: "http://127.0.0.1:3211", studioApiKey: "k" };

    let refusedBody;
    await ingestCandidate(candidate, { ok: false, reason: "THUMB_OVER_CAP" }, config, {
      fetchImpl: async (_url, init) => {
        refusedBody = JSON.parse(init.body);
        return jsonResp(200, { ok: true, mediaId: "m1", created: true });
      },
    });
    expect(refusedBody.thumbStorageId).toBeUndefined();
    expect(refusedBody.thumbBytes).toBeUndefined();

    let goodBody;
    await ingestCandidate(
      candidate,
      { ok: true, noThumbnail: false, bytes: 12345, thumbStorageId: "storage-xyz", width: 100, height: 80 },
      config,
      {
        fetchImpl: async (_url, init) => {
          goodBody = JSON.parse(init.body);
          return jsonResp(200, { ok: true, mediaId: "m2", created: true });
        },
      }
    );
    expect(goodBody.thumbStorageId).toBe("storage-xyz");
    expect(goodBody.thumbBytes).toBe(12345);
  });

  it("no captured log line contains the actual STUDIO_API_KEY value, exercised via a 401 halt (control: the captured log IS non-empty, so this isn't a vacuous pass)", async () => {
    const SECRET = "super-secret-studio-key-do-not-leak";
    const root = makeFixture();
    writeMedia(root, "gen/a.mp3", "aaa");

    const captured = [];
    const fetchImpl = async (url) => {
      if (url.endsWith("/studio/ingest")) return jsonResp(401, { error: "Unauthorized" });
      throw new Error(`unexpected fetch: ${url}`);
    };
    const config = { mediaVaultRoot: root, codepulseUrl: "http://127.0.0.1:3211", studioApiKey: SECRET };
    await runWatchCycle(config, { fetchImpl, warn: (msg) => captured.push(msg) });

    expect(captured.length).toBeGreaterThan(0);
    expect(captured.join("\n")).not.toContain(SECRET);
  });
});

// ── D-08: reconcileTrash — move out / move back / reclaim orphans (plan 118-08 Task 3) ────
describe("reconcileTrash — D-08 host-side reconciliation", () => {
  const baseConfig = { codepulseUrl: "http://127.0.0.1:3211", studioApiKey: "k" };

  it("move-out: a gen\\ file whose row has deletedAt set moves to trash\\ with its sidecar; a sibling with no deletedAt stays put (control)", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/deleted.png", "deleted-bytes");
    writeSidecarRaw(root, "gen/deleted.png.json", JSON.stringify({ prompt: "x" }));
    writeMedia(root, "gen/kept.png", "kept-bytes");

    const { candidates } = await scanVault(root, {});
    const deletedCandidate = candidates.find((c) => c.filename === "deleted.png");
    const keptCandidate = candidates.find((c) => c.filename === "kept.png");

    const fetchImpl = async () =>
      jsonResp(200, {
        ok: true,
        truncated: false,
        rows: [
          { contentHash: deletedCandidate.contentHash, deletedAt: 12345, kind: "gen" },
          { contentHash: keptCandidate.contentHash, deletedAt: undefined, kind: "gen" },
        ],
      });

    const result = await reconcileTrash(root, candidates, baseConfig, { fetchImpl });

    expect(result.skipped).toBe(false);
    expect(result.moved).toBe(1);
    expect(fs.existsSync(path.join(root, "trash", "deleted.png"))).toBe(true);
    expect(fs.existsSync(path.join(root, "trash", "deleted.png.json"))).toBe(true);
    expect(fs.existsSync(path.join(root, "gen", "deleted.png"))).toBe(false);
    // Control: the sibling with no deletedAt stays exactly where it was.
    expect(fs.existsSync(path.join(root, "gen", "kept.png"))).toBe(true);
    expect(fs.existsSync(path.join(root, "trash", "kept.png"))).toBe(false);
  });

  it("move-back: a trash\\ file whose row has deletedAt cleared returns to gen\\; a trash\\ file whose row is still deleted stays in trash\\ (control)", async () => {
    const root = makeFixture();
    const restoredAbs = writeMedia(root, "trash/restored.png", "restored-bytes");
    const stillDeletedAbs = writeMedia(root, "trash/still-deleted.png", "still-bytes");
    const restoredHash = await hashFile(restoredAbs);
    const stillDeletedHash = await hashFile(stillDeletedAbs);

    const fetchImpl = async () =>
      jsonResp(200, {
        ok: true,
        truncated: false,
        rows: [
          { contentHash: restoredHash, deletedAt: undefined, kind: "gen" },
          { contentHash: stillDeletedHash, deletedAt: 99999, kind: "gen" },
        ],
      });

    const result = await reconcileTrash(root, [], baseConfig, { fetchImpl });

    expect(result.skipped).toBe(false);
    expect(result.movedBack).toBe(1);
    expect(fs.existsSync(path.join(root, "gen", "restored.png"))).toBe(true);
    expect(fs.existsSync(path.join(root, "trash", "restored.png"))).toBe(false);
    // Control: the still-deleted file stays exactly in trash.
    expect(fs.existsSync(path.join(root, "trash", "still-deleted.png"))).toBe(true);
  });

  it("orphan reclaim: a trash\\ file matching no row is deleted; a trash\\ file whose hash IS in a row (still deleted) survives (control)", async () => {
    const root = makeFixture();
    const orphanAbs = writeMedia(root, "trash/orphan.png", "orphan-bytes");
    const knownAbs = writeMedia(root, "trash/known.png", "known-bytes");
    const knownHash = await hashFile(knownAbs);

    const fetchImpl = async () =>
      jsonResp(200, {
        ok: true,
        truncated: false,
        rows: [{ contentHash: knownHash, deletedAt: 55555, kind: "gen" }],
      });

    const result = await reconcileTrash(root, [], baseConfig, { fetchImpl });

    expect(result.skipped).toBe(false);
    expect(result.reclaimed).toBe(1);
    expect(fs.existsSync(orphanAbs)).toBe(false);
    expect(fs.existsSync(knownAbs)).toBe(true);
  });

  it("read-failure safety: a FAILED read causes zero unlinks/renames; a SUCCEEDED-but-EMPTY read over one orphan trash file causes exactly one unlink (control pair — distinguishes 'the read failed' from 'there genuinely are no rows')", async () => {
    const rootFail = makeFixture();
    const orphanFailAbs = writeMedia(rootFail, "trash/orphan.png", "aaa");
    const failFetch = async () => {
      throw new Error("network down");
    };
    const failResult = await reconcileTrash(rootFail, [], baseConfig, { fetchImpl: failFetch, warn: () => {} });
    expect(failResult.skipped).toBe(true);
    expect(fs.existsSync(orphanFailAbs)).toBe(true);

    const rootEmpty = makeFixture();
    const orphanEmptyAbs = writeMedia(rootEmpty, "trash/orphan.png", "bbb");
    const emptyFetch = async () => jsonResp(200, { ok: true, truncated: false, rows: [] });
    const emptyResult = await reconcileTrash(rootEmpty, [], baseConfig, { fetchImpl: emptyFetch });
    expect(emptyResult.skipped).toBe(false);
    expect(emptyResult.reclaimed).toBe(1);
    expect(fs.existsSync(orphanEmptyAbs)).toBe(false);
  });

  it("truncated: true is treated identically to a failed read — zero unlinks, reconciliation skipped", async () => {
    const root = makeFixture();
    const orphanAbs = writeMedia(root, "trash/orphan.png", "aaa");
    const fetchImpl = async () => jsonResp(200, { ok: true, truncated: true, rows: [] });
    const result = await reconcileTrash(root, [], baseConfig, { fetchImpl, warn: () => {} });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("TRUNCATED");
    expect(fs.existsSync(orphanAbs)).toBe(true);
  });

  it("traversal refusal: a crafted candidate path resolving outside the vault root is refused with NO fs call (existsSync/renameSync both unspied-on)", async () => {
    const root = makeFixture();
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-watch-outside-"));
    fixtureRoots.push(outsideDir);
    const outsideFile = writeMedia(outsideDir, "evil.png", "evil-bytes");
    const outsideHash = await hashFile(outsideFile);

    const craftedCandidate = { absPath: outsideFile, contentHash: outsideHash };
    const fetchImpl = async () =>
      jsonResp(200, { ok: true, truncated: false, rows: [{ contentHash: outsideHash, deletedAt: 111, kind: "gen" }] });

    const renameCalls = [];
    const existsCalls = [];
    const result = await reconcileTrash(root, [craftedCandidate], baseConfig, {
      fetchImpl,
      renameSyncImpl: (...args) => renameCalls.push(args),
      existsSyncImpl: (...args) => {
        existsCalls.push(args);
        return fs.existsSync(...args);
      },
    });

    expect(result.moved).toBe(0);
    expect(renameCalls.length).toBe(0);
    expect(existsCalls.length).toBe(0);
    expect(fs.existsSync(outsideFile)).toBe(true);
  });

  it("collision: an existing destination filename does not get overwritten — the moved file lands under a suffixed name instead", async () => {
    const root = makeFixture();
    writeMedia(root, "gen/photo.png", "new-content");
    const preExistingAbs = path.join(root, "trash", "photo.png");
    fs.writeFileSync(preExistingAbs, "PRE-EXISTING-TRASH-CONTENT");
    // The pre-existing trash\ file must correspond to a row that is STILL deleted, or Rules
    // 2/3 (which also run this same cycle) would treat it as an orphan/restore candidate and
    // move or delete it — this test isolates the COLLISION property from those two rules.
    const preExistingHash = await hashFile(preExistingAbs);

    const { candidates } = await scanVault(root, {});
    const candidate = candidates[0];
    const fetchImpl = async () =>
      jsonResp(200, {
        ok: true,
        truncated: false,
        rows: [
          { contentHash: candidate.contentHash, deletedAt: 777, kind: "gen" },
          { contentHash: preExistingHash, deletedAt: 888, kind: "gen" },
        ],
      });

    const result = await reconcileTrash(root, candidates, baseConfig, { fetchImpl });

    expect(result.moved).toBe(1);
    expect(fs.readFileSync(path.join(root, "trash", "photo.png"), "utf-8")).toBe("PRE-EXISTING-TRASH-CONTENT");
    expect(fs.existsSync(path.join(root, "trash", "photo (1).png"))).toBe(true);
    expect(fs.readFileSync(path.join(root, "trash", "photo (1).png"), "utf-8")).toBe("new-content");
  });

  it("nothing to reconcile: empty active candidates AND an empty trash\\ directory makes ZERO network calls", async () => {
    const root = makeFixture();
    const fetchImpl = vi.fn();
    const result = await reconcileTrash(root, [], baseConfig, { fetchImpl });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("NOTHING_TO_RECONCILE");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
