import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import BriefingFeedItem from "./BriefingFeedItem";

// Source-shape guard (R-6 defect class): read from disk, not via import,
// since a module import would erase the exact text of the import
// statement -- the thing under test IS the source shape, per the
// App.test.tsx:229-283 precedent this plan's read_first points to.
const briefingsSource = readFileSync(
  resolve(process.cwd(), "src/pages/Briefings.tsx"),
  "utf8",
);
const indexHtmlSource = readFileSync(
  resolve(process.cwd(), "index.html"),
  "utf8",
);
const mainTsxSource = readFileSync(
  resolve(process.cwd(), "src/main.tsx"),
  "utf8",
);
const indexCssSource = readFileSync(
  resolve(process.cwd(), "src/index.css"),
  "utf8",
);

const baseBriefing = {
  _id: "b1",
  type: "daily_digest",
  narrative:
    "Line one of her narrative.\nLine two continues across a second line.",
  summary: "A short summary of the day.",
  generatedAt: 1_700_000_000,
};

describe("BriefingFeedItem source shape (D-14 subpath + chunk-scope guard)", () => {
  it("imports the ITALIC SUBPATH, not the bare package root", () => {
    expect(briefingsSource).toContain(
      "@fontsource/instrument-serif/400-italic.css",
    );
  });

  it("does not import the bare @fontsource/instrument-serif package root", () => {
    // A bare-root import line has no trailing subpath before the closing
    // quote -- this must NOT match the 400-italic.css import above.
    const bareRootImport =
      /from\s+["']@fontsource\/instrument-serif["']|import\s+["']@fontsource\/instrument-serif["']/;
    expect(briefingsSource).not.toMatch(bareRootImport);
  });

  it("does not leak the font family into index.html, main.tsx, or index.css", () => {
    expect(indexHtmlSource).not.toMatch(/instrument-serif/i);
    expect(mainTsxSource).not.toMatch(/instrument-serif/i);
    // index.css legitimately carries the --font-voice fallback stack
    // ('Instrument Serif', Georgia, serif) landed by plan 125-01 -- that is
    // a CSS custom-property VALUE, not an import of the package or its
    // font files. This guard is scoped to the actual leak this task cares
    // about: the npm package specifier.
    expect(indexCssSource).not.toMatch(/@fontsource\/instrument-serif/);
  });
});

describe("BriefingFeedItem class application (D-13/D-14 scope)", () => {
  it("applies briefing-voice to the collapsed summary/narrative span", () => {
    render(<BriefingFeedItem briefing={baseBriefing} />);
    const summary = screen.getByText("A short summary of the day.");
    expect(summary.className).toContain("briefing-voice");
  });

  it("applies briefing-voice to the expanded narrative paragraph when the row is expanded", () => {
    render(<BriefingFeedItem briefing={baseBriefing} />);
    // Exercise the expansion for real -- click the collapsed row, then
    // assert on the now-rendered narrative paragraph. Asserting on the
    // collapsed DOM alone would not cover this surface.
    fireEvent.click(screen.getByText("A short summary of the day."));
    const narrative = screen.getByText(
      /Line one of her narrative\./,
    );
    expect(narrative.tagName).toBe("P");
    expect(narrative.className).toContain("briefing-voice");
  });

  it("does not apply briefing-voice to the type pill or the date", () => {
    render(<BriefingFeedItem briefing={baseBriefing} />);
    const pill = screen.getByText("DIGEST");
    expect(pill.className).not.toContain("briefing-voice");
    // formatDate renders month/day/year/time -- find the mono-font sibling
    // span next to the pill by its font-mono class, which is the date.
    const dateEl = pill.parentElement?.querySelector(".font-mono");
    expect(dateEl).not.toBeNull();
    expect(dateEl?.className).not.toContain("briefing-voice");
  });
});

describe("BriefingFeedItem theme scope (D-15)", () => {
  it("has a [data-theme=\"readable\"] override for .briefing-voice that sets Geist and normal style, after the base rule", () => {
    const baseIndex = indexCssSource.indexOf(".briefing-voice {");
    const overrideIndex = indexCssSource.indexOf(
      '[data-theme="readable"] .briefing-voice',
    );
    expect(baseIndex).toBeGreaterThan(-1);
    expect(overrideIndex).toBeGreaterThan(-1);
    // Source order decides the cascade for two rules of equal specificity
    // class -- the override must appear AFTER the base rule.
    expect(overrideIndex).toBeGreaterThan(baseIndex);

    const overrideBlock = indexCssSource.slice(
      overrideIndex,
      indexCssSource.indexOf("}", overrideIndex) + 1,
    );
    expect(overrideBlock).toContain("font-family: var(--font-geist)");
    expect(overrideBlock).toContain("font-style: normal");
  });

  // NOTE: this is a SOURCE assertion about the override rule's existence
  // and ordering, not a rendered-pixel measurement -- jsdom does not apply
  // real CSS cascade or load webfonts. The rendered claim (does it actually
  // look right in all five themes) belongs to plan 125-10's operator
  // checkpoint, where a human looks at the real thing.
});
