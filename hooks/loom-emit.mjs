#!/usr/bin/env node
/**
 * loom-emit.mjs — post one pipeline step event to CodePulse (Phase 119, D-02).
 *
 * The whole point of Loom's live mode: anything that can run this line can
 * drive the /loom view — workflow scripts, skills, Ástríðr crons, GSD
 * executors. There is no WebSocket layer; the row updates and the UI animates
 * through its existing Convex subscription.
 *
 * Usage (the form the design doc documents):
 *   node hooks/loom-emit.mjs step:complete 2
 *   node hooks/loom-emit.mjs step:start 1 "fetching the diff"
 * with LOOM_PIPELINE naming the pipeline. Or fully explicit:
 *   node hooks/loom-emit.mjs --pipeline review-verify --step 2 --event complete
 *
 * ENV, resolved in this order and documented so the next reader need not
 * reverse-engineer it:
 *   1. process.env.LOOM_API_KEY / CODEPULSE_URL / LOOM_PIPELINE
 *   2. <homedir>/.claude/skills/loom/.env, built from os.homedir() as an
 *      ABSOLUTE path — never relative to import.meta.url or cwd, because this
 *      script runs from arbitrary directories.
 *   3. For the URL only, the documented default below. There is NO default for
 *      the key: a missing key is a hard failure, never an anonymous emit.
 *
 * UNLIKE codepulse-hook.mjs's fire-and-forget postJson, this FAILS LOUD. A
 * silently-dropped step event produces a pipeline that renders as stalled
 * forever, which is worse than a visible non-zero exit in the script that
 * emitted it.
 *
 * Exit codes: 0 ok · 2 configuration · 3 transport/server · 4 refusal
 * (unknown pipeline — author it first; nothing was written).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** Self-hosted Convex HTTP-ACTIONS port. NOT 3210, which is the backend API. */
const DEFAULT_BASE_URL = "http://127.0.0.1:3211";
const TIMEOUT_MS = 10_000;

const USAGE = `loom-emit.mjs — emit one Loom pipeline step event

  node hooks/loom-emit.mjs step:<event> <stepId> [text]
  node hooks/loom-emit.mjs --pipeline <slug> --step <id> --event <event> [--text "..."]

  <event> is one of: start | action | complete | error | warn

Environment:
  LOOM_API_KEY   required, no default
  LOOM_PIPELINE  pipeline slug, unless --pipeline is given
  CODEPULSE_URL  optional, defaults to ${DEFAULT_BASE_URL}
`;

const VALID_EVENTS = ["start", "action", "complete", "error", "warn"];

function readEnvFile() {
  const path = join(homedir(), ".claude", "skills", "loom", ".env");
  if (!existsSync(path)) return {};
  try {
    const out = {};
    for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

const fileEnv = readEnvFile();
const baseUrl = (
  process.env.CODEPULSE_URL ||
  fileEnv.CODEPULSE_URL ||
  DEFAULT_BASE_URL
).replace(/\/+$/, "");

/** Every diagnostic names the base URL so a wrong target is visible at once. */
function die(code, message) {
  console.error(`loom-emit: ${message} (base URL: ${baseUrl})`);
  process.exit(code);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(USAGE);
    process.exit(0);
  }

  // Explicit flag form.
  if (argv[0].startsWith("--")) {
    const out = {};
    for (let i = 0; i < argv.length; i += 2) {
      const name = argv[i].replace(/^--/, "");
      const value = argv[i + 1];
      if (value === undefined) die(2, `flag --${name} needs a value`);
      out[name] = value;
    }
    return {
      pipelineSlug: out.pipeline ?? process.env.LOOM_PIPELINE ?? fileEnv.LOOM_PIPELINE,
      stepId: out.step,
      event: out.event,
      text: out.text,
    };
  }

  // Documented shorthand: `step:<event> <stepId> [text]`.
  const m = argv[0].match(/^step:(\w+)$/);
  if (!m) die(2, `unrecognised argument "${argv[0]}" — see --help`);
  return {
    pipelineSlug: process.env.LOOM_PIPELINE ?? fileEnv.LOOM_PIPELINE,
    stepId: argv[1],
    event: m[1],
    text: argv.slice(2).join(" ") || undefined,
  };
}

async function main() {
  const { pipelineSlug, stepId, event, text } = parseArgs(process.argv.slice(2));

  const key = process.env.LOOM_API_KEY || fileEnv.LOOM_API_KEY;
  if (!key) {
    die(2, "LOOM_API_KEY is not set. Set it in your environment or in <homedir>/.claude/skills/loom/.env");
  }
  if (!pipelineSlug) die(2, "no pipeline — pass --pipeline or set LOOM_PIPELINE");
  if (!stepId) die(2, "no step id");
  if (!event) die(2, "no event");
  if (!VALID_EVENTS.includes(event)) {
    die(2, `unknown event "${event}" — one of: ${VALID_EVENTS.join(", ")}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${baseUrl}/loom/event`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pipelineSlug, stepId, event, text }),
      signal: controller.signal,
    });
  } catch (err) {
    die(
      3,
      err.name === "AbortError"
        ? `timed out after ${TIMEOUT_MS}ms`
        : `request failed: ${err.message}`
    );
  } finally {
    clearTimeout(timer);
  }

  const body = await response.text();
  if (response.status === 404) {
    die(4, `no pipeline "${pipelineSlug}" — author it first; nothing was written`);
  }
  if (!response.ok) {
    die(3, `POST /loom/event returned HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  console.log(body);
}

main().catch((err) => die(3, `unexpected error: ${err.message}`));
