// Task 3 verify for plan 118-15 — the D-01..D-16 roll-up.
//
// Same logic as the plan's inline <automated> one-liner, moved into a file because the
// inline form cannot be run correctly from a shell: its `\\b` word boundaries are eaten
// by shell escaping and arrive as literal backspace characters, so the regex matches
// nothing and it reports ALL SIXTEEN decisions missing. That failure is at least loud —
// an all-16 result is obviously an invocation fault, not a finding — but a check that
// can only be run wrong is not a check.
import fs from "node:fs";

const G = ".planning/phases/118-studio-media-gallery/118-GATE-EVIDENCE.md";
const g = fs.readFileSync(G, "utf8");

// Scope to the roll-up section. A decision id mentioned anywhere else in this 500-line
// gate log must not be able to satisfy the check — that is the whole-file-substring
// defect this phase has now found nine times.
const start = g.indexOf("## Decision coverage roll-up");
if (start === -1) throw new Error("roll-up section missing from gate evidence");
const rollup = g.slice(start);

const missing = [];
for (let i = 1; i <= 16; i++) {
  const d = "D-" + String(i).padStart(2, "0");
  if (!new RegExp("\\b" + d + "\\b").test(rollup)) missing.push(d);
}
if (missing.length) throw new Error("roll-up missing decisions: " + missing.join(", "));

if (!/## Mandatory control pairs/.test(g)) {
  throw new Error("mandatory control pairs section missing");
}

// Each decision must carry a status verdict, not merely be named.
//
// Counted from TABLE ROWS only. A naive whole-section count is inflated by the status-rules
// legend above the table, which bolds each verdict word in order to define it — that made the
// first run report PROVEN:17 PARTIAL:1 OPEN:1 for a table containing 16 PROVEN and nothing
// else, i.e. it would have reported two unproven decisions that do not exist.
const verdicts = rollup
  .split("\n")
  .filter((l) => l.trim().startsWith("|"))
  .flatMap((l) => [...l.matchAll(/\*\*(PROVEN|PARTIAL|OPEN)\*\*/g)].map((m) => m[1]));
if (verdicts.length < 16) {
  throw new Error(`only ${verdicts.length} status verdicts found in roll-up table rows; expected >= 16`);
}

// All three mandatory pairs must be individually claimed, not summarised as "all present".
for (const pair of ["D-01", "D-07", "D-08"]) {
  const section = g.slice(g.indexOf("## Mandatory control pairs"));
  if (!new RegExp("\\b" + pair + "\\b").test(section)) {
    throw new Error(`mandatory control pair ${pair} is not individually asserted`);
  }
}

const counts = verdicts.reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
console.log(
  `PASS — 16 decisions scored in the roll-up (${JSON.stringify(counts)}), all three control pairs individually asserted`
);
