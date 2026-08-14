// Control-paired tests for hooks/studioWatch.mjs's scan core (Phase 118 Plan 07,
// D-05/D-06/D-07). Every fixture lives under os.tmpdir() and is torn down in afterEach —
// NEVER point a test at C:\Users\mandr\media-vault, which is real operator data (T-118-25).
import { describe, it, expect, afterEach } from "vitest";
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
} from "../studioWatch.mjs";

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
});
