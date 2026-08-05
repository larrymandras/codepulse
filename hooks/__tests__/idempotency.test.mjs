import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { buildIdempotencyKey } from "../idempotency.mjs";

// NB: under vitest `import.meta.url` is an http:// dev-server URL, not file://,
// so it cannot be used to locate the module for a child process.
const MODULE_PATH = join(process.cwd(), "hooks", "idempotency.mjs");
const MODULE_URL = pathToFileURL(MODULE_PATH).href;

/** Compute the key in a FRESH node process — the only way to prove the key is
 *  not process-local. An in-process repeat shares pid and usually the same
 *  millisecond, so it cannot distinguish a pure key from one seeded with
 *  process.pid / Date.now(). */
function keyInSeparateProcess(payload) {
  const src = `import("${MODULE_URL}").then(m => process.stdout.write(String(m.buildIdempotencyKey(${JSON.stringify(payload)}))));`;
  return execFileSync(process.execPath, ["--input-type=module", "-e", src], {
    encoding: "utf-8",
    timeout: 20000,
  }).trim();
}

// Shape taken from a real captured PostToolUse payload (astridr-repo session).
const postToolUse = {
  cwd: "C:\\Users\\mandr\\astridr-repo",
  duration_ms: 0,
  hook_event_name: "PostToolUse",
  permission_mode: "auto",
  prompt_id: "ae06c32b-2dee-4ed1-b727-f010149ceac4",
  session_id: "827df920-ee3e-4535-a5f3-2792a2ad46e7",
  tool_input: { a: 1 },
  tool_name: "AskUserQuestion",
  tool_response: { b: 2 },
  tool_use_id: "toolu_01WukYk6JdsB8qwTXH9Fz4um",
};

describe("buildIdempotencyKey — the duplicate-wiring case it exists for", () => {
  it("produces the SAME key for two deliveries of one event", () => {
    // Two hook wirings receive byte-identical payloads in separate processes.
    const a = buildIdempotencyKey(JSON.parse(JSON.stringify(postToolUse)));
    const b = buildIdempotencyKey(JSON.parse(JSON.stringify(postToolUse)));
    expect(a).toBeDefined();
    expect(a).toBe(b);
  });

  it("is exactly the derived string — no extra components", () => {
    // Exact equality is what catches a stray pid/timestamp/random suffix; a
    // set-size or self-comparison check cannot, because both calls would share
    // the same pid and millisecond.
    expect(buildIdempotencyKey(postToolUse)).toBe(
      "827df920-ee3e-4535-a5f3-2792a2ad46e7:PostToolUse:toolu_01WukYk6JdsB8qwTXH9Fz4um"
    );
  });

  it("matches across two SEPARATE processes (the real deployment shape)", () => {
    // The duplicate deliveries this key exists to collapse come from two
    // distinct hook processes. Anything process-local diverges here.
    expect(existsSync(MODULE_PATH)).toBe(true); // fail loudly if layout moves
    const inProcess = buildIdempotencyKey(postToolUse);
    const childA = keyInSeparateProcess(postToolUse);
    const childB = keyInSeparateProcess(postToolUse);
    expect(childA).toBe(inProcess);
    expect(childB).toBe(inProcess);
  });
});

describe("buildIdempotencyKey — must NOT over-dedup", () => {
  it("does not collide PreToolUse with PostToolUse of the same call", () => {
    // Both share one tool_use_id; keying on the id alone would silently drop
    // the result event.
    const pre = buildIdempotencyKey({ ...postToolUse, hook_event_name: "PreToolUse" });
    const post = buildIdempotencyKey(postToolUse);
    expect(pre).not.toBe(post);
  });

  it("distinguishes different tool calls", () => {
    const other = buildIdempotencyKey({ ...postToolUse, tool_use_id: "toolu_DIFFERENT" });
    expect(other).not.toBe(buildIdempotencyKey(postToolUse));
  });

  it("distinguishes the same tool_use_id across different sessions", () => {
    const other = buildIdempotencyKey({ ...postToolUse, session_id: "other-session" });
    expect(other).not.toBe(buildIdempotencyKey(postToolUse));
  });
});

describe("buildIdempotencyKey — un-keyed events stay always-counted (D-05)", () => {
  it("returns undefined when there is no tool_use_id", () => {
    // SessionStart / Stop / UserPromptSubmit carry no tool_use_id.
    expect(buildIdempotencyKey({ hook_event_name: "SessionStart", session_id: "s", source: "startup" })).toBeUndefined();
    expect(buildIdempotencyKey({ hook_event_name: "Stop", session_id: "s", prompt_id: "p" })).toBeUndefined();
  });

  it("returns undefined for an empty or non-string tool_use_id", () => {
    expect(buildIdempotencyKey({ ...postToolUse, tool_use_id: "" })).toBeUndefined();
    expect(buildIdempotencyKey({ ...postToolUse, tool_use_id: 42 })).toBeUndefined();
    expect(buildIdempotencyKey({ ...postToolUse, tool_use_id: null })).toBeUndefined();
  });

  it("tolerates junk input without throwing", () => {
    expect(buildIdempotencyKey(undefined)).toBeUndefined();
    expect(buildIdempotencyKey(null)).toBeUndefined();
    expect(buildIdempotencyKey("not an object")).toBeUndefined();
    expect(buildIdempotencyKey(42)).toBeUndefined();
  });

  it("still keys when session_id / hook_event_name are missing", () => {
    const k = buildIdempotencyKey({ tool_use_id: "toolu_x" });
    expect(k).toBe("unknown:unknown:toolu_x");
  });
});
