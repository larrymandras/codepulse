// CodePulse Workspace Scanner — D-12 structural dry-run gate
//
// Implements CONTEXT.md D-12: the dry-run gate is STRUCTURAL, not procedural. The ingest path
// must hard-refuse until an approval marker recording a reviewed report exists. Per this
// project's standing rule that a gate which can skip itself must be shown to have evaluated
// something, the refusal implemented here is mutation-tested (see
// hooks/__tests__/workspaceApproval.test.mjs), not merely asserted.
//
// Zero I/O by design: no filesystem module import, no direct disk reads or existence checks of
// any kind. Every function in this file is pure — string/object in, string/boolean out — which
// is what makes the refusal provable by unit test rather than resting on discipline. The caller
// (115-08's entry point) owns reading the report and marker files off disk and passes their
// contents in; this module only decides.
//
// `stableStringify` deliberately does NOT use JSON.stringify's second-argument-as-array trick
// (passing a sorted list of the report's own top-level key names as the replacer). That form was
// proposed in 115-RESEARCH.md and is measurably wrong: that second argument is a key ALLOWLIST
// applied at EVERY nesting level, not a sort order — so a nested key whose name doesn't also
// appear as a TOP-LEVEL key of the report is silently dropped from the serialization, and a
// report that changed in a nested field (e.g. a per-department count two levels down) would hash
// IDENTICALLY to the original. That is a gate that reports green without having evaluated the
// thing it exists to check. The recursive serializer below sorts object keys at every level and
// never drops a key.

import { createHash } from "node:crypto";

/** Gitignored by plan 115-02's .gitignore block — never committed to this public repo. */
export const REPORT_RELPATH = "config/workspace-scan-report.json";

/** Gitignored alongside REPORT_RELPATH — the marker approving a specific report hash. */
export const APPROVAL_MARKER_RELPATH = "config/workspace-scan.approved.sha256";

/**
 * Recursive canonical serializer. Produces a deterministic string representation of `value`
 * where object keys are sorted at every nesting level (so key insertion order never affects the
 * output) and array element order is PRESERVED (array order is semantically meaningful in the
 * report — e.g. the Unclassified root list is ordered — so arrays are never sorted).
 *
 * Matches `JSON.stringify` semantics for scalars, `undefined` (omitted from objects, `null`
 * inside arrays per JSON.stringify's own behavior), and non-finite numbers (`NaN`/`Infinity`
 * serialize as `null`) so a report field that goes `NaN` (e.g. a division by a zero file count)
 * can never make the hash nondeterministic or throw.
 *
 * @param {*} value
 * @returns {string}
 */
export function stableStringify(value) {
  if (value === null) return "null";

  const t = typeof value;

  if (t === "number") {
    // NaN / Infinity / -Infinity all serialize as "null", matching JSON.stringify.
    return Number.isFinite(value) ? JSON.stringify(value) : "null";
  }

  if (t === "boolean" || t === "string") {
    return JSON.stringify(value);
  }

  if (t === "undefined") {
    // Only reachable when stableStringify(undefined) is called directly (e.g. from inside an
    // array, where JSON.stringify also renders undefined as null).
    return "null";
  }

  if (Array.isArray(value)) {
    // Order preserved deliberately — see module header.
    return "[" + value.map((el) => stableStringify(el === undefined ? null : el)).join(",") + "]";
  }

  if (t === "object") {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined) // omit undefined-valued keys, matching JSON.stringify
      .sort();
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") +
      "}"
    );
  }

  // Functions, symbols, bigints: not expected in a report; fall back to JSON.stringify's
  // behavior (undefined/omitted) rather than throwing.
  return "null";
}

/**
 * sha256 hex digest of the report's canonical serialization.
 *
 * @param {object} report
 * @returns {string} 64-char lowercase hex digest
 */
export function canonicalReportHash(report) {
  return createHash("sha256").update(stableStringify(report), "utf8").digest("hex");
}

/**
 * Fail-closed structural gate: does `approvalFileContents` approve `reportHash`?
 *
 * The comparison is a plain string equality on the marker's first non-empty, non-comment line —
 * never a prefix/startsWith/includes match, which would let a marker containing extra trailing
 * content approve a different report than the one it names.
 *
 * @param {string} reportHash - the freshly computed hash of the CURRENT report (canonicalReportHash output)
 * @param {string|null|undefined} approvalFileContents - the marker file's contents, or null/undefined if absent
 * @returns {boolean} true only if the marker's hash line matches reportHash exactly
 */
export function isDryRunApproved(reportHash, approvalFileContents) {
  // A malformed hash can never approve anything.
  if (typeof reportHash !== "string" || reportHash.length !== 64) return false;

  // Covers null/undefined — i.e. no marker file at all.
  if (typeof approvalFileContents !== "string") return false;

  const markerHash = firstNonCommentLine(approvalFileContents);
  if (markerHash === null) return false;

  return markerHash.trim().toLowerCase() === reportHash.trim().toLowerCase();
}

/**
 * Returns the first non-empty, non-`#`-prefixed line of `text`, or null if none exists.
 * Used to tolerate a marker written by buildApprovalMarkerContents (hash line + optional
 * `#`-prefixed comment lines).
 *
 * @param {string} text
 * @returns {string|null}
 */
function firstNonCommentLine(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith("#")) continue;
    return trimmed;
  }
  return null;
}

/**
 * Builds the exact text to write to the approval marker file: the bare 64-char hex hash on line
 * 1, then optional `#`-prefixed comment lines carrying `meta` (e.g. approval timestamp, scanner
 * version). `isDryRunApproved` reads only the first non-comment line, so this and the checker
 * agree by construction.
 *
 * @param {string} reportHash
 * @param {Record<string, string|number|boolean>} [meta]
 * @returns {string}
 */
export function buildApprovalMarkerContents(reportHash, meta = {}) {
  const lines = [reportHash];
  for (const [key, value] of Object.entries(meta)) {
    lines.push(`# ${key}: ${value}`);
  }
  return lines.join("\n") + "\n";
}
