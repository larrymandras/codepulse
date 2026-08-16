// Task 1 verify for plan 118-14, replacing the plan's own <automated> one-liner.
//
// The plan's version was `e.includes(m[1])` — a WHOLE-FILE substring test — and it is blind to
// the exact case it names ("D09 evidence names a different branch than the openart measurement").
// Measured 2026-08-16: replacing `**THIRD_LEG: openart-mcp**` in 118-D09-EVIDENCE.md with
// `**THIRD_LEG: second-direct-api**` left it GREEN, because an unrelated table header cell
// elsewhere in the file (`| **leg 3 — openart-mcp** |`) still contained the captured string.
// Its regex also captured the trailing markdown bold markers, so m[1] was `openart-mcp**`.
//
// This version does what 118-OPENART-EVIDENCE.md's own note prescribes: anchor on the THIRD_LEG
// label and match the WHOLE token, on both sides, and read the D09 side only from inside the
// `## LEG: third` section rather than from the whole file.
import fs from 'node:fs';

const D = '.planning/phases/118-studio-media-gallery/118-D09-EVIDENCE.md';
const O = '.planning/phases/118-studio-media-gallery/118-OPENART-EVIDENCE.md';

// Whole token only: letters/digits/hyphens, bounded by the label and the end of the token.
// `openart-mcp` and `openart-mcp-interactive` are prefix-related, so a substring test cannot
// tell them apart — equality on the full capture is the only sound comparison.
const LABEL = /THIRD_LEG:\s*\**\s*([A-Za-z0-9-]+)/;

const d = fs.readFileSync(D, 'utf8');
const o = fs.readFileSync(O, 'utf8');

const mo = o.match(LABEL);
if (!mo) throw new Error('no THIRD_LEG label in the openart measurement');
const measured = mo[1];

// Scope the D09 read to the selected-shape section. A branch string appearing anywhere else in
// this 500-line evidence log must not be able to satisfy the check.
const start = d.indexOf('## LEG: third');
if (start === -1) throw new Error('selected-shape section missing from D09 evidence');
const rest = d.slice(start + 1);
const nextTop = rest.indexOf('\n## ');
const section = nextTop === -1 ? rest : rest.slice(0, nextTop);

const md = section.match(LABEL);
if (!md) throw new Error('the LEG: third section records no THIRD_LEG label of its own');
const carried = md[1];

if (carried !== measured) {
  throw new Error(
    `branch mismatch: measurement says "${measured}", LEG: third section says "${carried}"`
  );
}

// A near-duplicate collapse of leg 3 into leg 2 is the failure D-09 actually cares about, so the
// section must argue shape against BOTH prior legs, not just the CLI one.
for (const needle of ['leg 1', 'leg 2']) {
  if (!section.includes(needle)) {
    throw new Error(`shape-difference argument does not reference ${needle}`);
  }
}

console.log(`PASS — whole-token branch agreement on "${measured}", shape argued against both legs`);
