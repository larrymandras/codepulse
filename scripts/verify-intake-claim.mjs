/**
 * Live verification of the Forge intake command bridge (Phase 06, Plan 06-04).
 *
 * Proves SC5 plus the D-P6-10 (ack-path blob delete) and D-P6-13 (report rides
 * the ack) lifecycle against a REAL Convex dev deployment, with no daemon and
 * no Clerk session:
 *
 *   upload fixture -> seed intake row -> claim (supportedTypes: ["intake"])
 *   -> fetch downloadUrl (byte-identical) -> ack done + report
 *   -> report stored on row -> blob deleted (downloadUrl stops serving).
 *
 * Plain Node, no Playwright — this checks a backend contract, not a browser.
 * Mirrors verify-skills-page.mjs's ok(cond, label) PASS/FAIL convention.
 *
 * Required env:
 *   CONVEX_SITE_URL       HTTP-actions host, e.g. https://<deployment>.convex.site
 *                         (NOT .convex.cloud — see docs/forge-deploy-checklist.md)
 *   FORGE_INGEST_API_KEY  bearer secret configured on the SAME deployment
 * Optional env:
 *   CONVEX_ENV_FILE       path passed as --env-file to every `convex run` call,
 *                         pinning the CLI to the intended (dev) deployment
 *
 * Uses two internal-only test scaffolds (never on the api.* browser surface):
 *   forge:generateVerificationUploadUrl, forge:seedIntakeRowForVerification.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const SITE_URL = process.env.CONVEX_SITE_URL;
const API_KEY = process.env.FORGE_INGEST_API_KEY;
const ENV_FILE = process.env.CONVEX_ENV_FILE; // optional

if (!SITE_URL || !API_KEY) {
  console.error(
    "ERROR: CONVEX_SITE_URL and FORGE_INGEST_API_KEY must both be set in the environment.\n" +
      "Never fall back to reading .env files — set them explicitly for this run."
  );
  process.exit(1);
}

const fail = [];
const ok = (cond, label, extra = "") => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);
  if (!cond) fail.push(label);
};

/** Run a Convex function via the local CLI (no shell — direct node invocation). */
function convexRun(fn, argsJson) {
  const argv = ["node_modules/convex/bin/main.js", "run", fn, argsJson];
  if (ENV_FILE) argv.push("--env-file", ENV_FILE);
  const stdout = execFileSync(process.execPath, argv, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  // A mutation that returns undefined prints nothing — that's a success, not
  // a parse failure (the CLI exits non-zero on real errors, which throws above).
  if (stdout.trim().length === 0) return null;
  // The CLI prints the function's return value as JSON on stdout (possibly
  // after informational lines). Parse the last line that parses as JSON.
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      /* not this line */
    }
  }
  // Whole-output fallback (multi-line JSON result, e.g. an array of rows).
  const start = Math.min(
    ...[stdout.indexOf("{"), stdout.indexOf("["), stdout.indexOf('"')].filter((i) => i >= 0)
  );
  if (Number.isFinite(start)) return JSON.parse(stdout.slice(start));
  throw new Error(`Could not parse JSON from convex run ${fn} output:\n${stdout}`);
}

const FIXTURE =
  "---\nname: verify-fixture\ndescription: fixture for intake claim verification\n---\n\nFixture body.\n";
const commandId = `verify-${Date.now()}-${randomBytes(6).toString("hex")}`;
const hostId = "verify-host";

// --- Step 2: signed upload URL via internal test scaffold -------------------
const uploadUrl = convexRun("forge:generateVerificationUploadUrl", "{}");
ok(typeof uploadUrl === "string" && uploadUrl.startsWith("https://"), "upload URL obtained");

// --- Step 3: upload the fixture, get storageId ------------------------------
const uploadRes = await fetch(uploadUrl, {
  method: "POST",
  headers: { "Content-Type": "text/plain" },
  body: FIXTURE,
});
const uploadJson = await uploadRes.json();
const storageId = uploadJson.storageId;
ok(uploadRes.status === 200 && typeof storageId === "string", "storageId returned", storageId ?? "");

// --- Step 4: seed a queued intake row via internal test scaffold ------------
convexRun(
  "forge:seedIntakeRowForVerification",
  JSON.stringify({ hostId, commandId, destination: "cold", workspaceId: null, storageId })
);
ok(true, "intake row seeded", commandId);

// --- Step 5+6: claim with supportedTypes ["intake"] --------------------------
const claimRes = await fetch(`${SITE_URL}/forge-commands-claim`, {
  method: "POST",
  headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ hostId, supportedTypes: ["intake"] }),
});
const claimJson = await claimRes.json();
const claimed = (claimJson.commands ?? []).find((c) => c.commandId === commandId);
ok(claimRes.status === 200 && claimed !== undefined, "claim response contains the seeded command");
ok(claimed?.commandType === "intake", "claimed command has commandType intake");
const downloadUrl = claimed?.downloadUrl;
ok(typeof downloadUrl === "string" && downloadUrl.length > 0, "downloadUrl is non-null");

// --- Step 7: downloadUrl serves the exact fixture bytes (SC5) ----------------
const dlRes = await fetch(downloadUrl);
const dlText = await dlRes.text();
ok(dlRes.status === 200 && dlText === FIXTURE, "fetch(downloadUrl) returns the exact fixture bytes");

// --- Step 8: ack done with a minimal CLI-02-shaped stub report ---------------
// The script verifies transport/storage, not report content — the real report
// comes from the daemon in Phase 8.
const ackRes = await fetch(`${SITE_URL}/forge-commands-ack`, {
  method: "POST",
  headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    commandId,
    status: "done",
    report: { schema_version: 1, verdict: "admit", findings: [] },
  }),
});
const ackJson = await ackRes.json();
ok(ackRes.status === 200 && ackJson.ok === true, "ack returns 200 { ok: true }");

// --- Step 9: report landed on the row (D-P6-13) ------------------------------
const rows = convexRun("forge:listForgeCommands", JSON.stringify({ hostId }));
const row = (Array.isArray(rows) ? rows : []).find((r) => r.commandId === commandId);
ok(row?.status === "done", "row shows status done");
ok(row?.report != null && row.report.verdict === "admit", "report stored on row (verdict admit)");

// --- Step 10: blob deleted on the done transition (D-P6-10, ack-path site) ---
const dlAfter = await fetch(downloadUrl);
ok(dlAfter.status !== 200, "post-ack fetch(downloadUrl) is non-200 (blob deleted)", `status ${dlAfter.status}`);

console.log(`\n  ${fail.length === 0 ? "ALL CHECKS PASSED" : `FAILED: ${JSON.stringify(fail)}`}`);
process.exit(fail.length === 0 ? 0 : 1);
