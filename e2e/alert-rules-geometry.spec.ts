import { test, expect, type Page } from '@playwright/test';

/**
 * Geometry proof for 126-07 (SWEEP-04, D-07).
 *
 * `.planning/todos/pending/alert-rules-engine-rows-overlap.md` records an operator screenshot of
 * `/alerts`'s "Alert Rules Engine" panel with rule-name/condition text overlapping and the left
 * column (toggle + severity badge) marching at a visibly tighter pitch than the name column — but
 * explicitly says the mechanism is NOT ROOT-CAUSED and warns that "a plausible mechanism the code
 * does not contain will fit the screenshot just as well as the real one." D-07 (126-CONTEXT.md)
 * makes this file's job MEASUREMENT, not diagnosis: no class in AlertRulesEngine.tsx is touched by
 * this task.
 *
 * Reuses this repo's established idioms rather than inventing new ones:
 *   - `gateOrSkip` — identical Clerk-gate race check to e2e/polish-geometry.spec.ts:74-83.
 *   - fail-don't-skip render wait — e2e/serif-trial.spec.ts:57-70's idiom: a measurement taken
 *     before rows exist records a page that is not there, so a missing row is a FAILURE, not a
 *     skip. Plan 126-04 fixed this exact class of defect for the header-zones block first.
 *   - the culprit/overlap-walker JSON-log-then-assert shape from
 *     e2e/polish-geometry.spec.ts:211-326 (`readHeaderZonesEvidence`) and :570-641 (the 900px
 *     Settings collision walk), including its `sr-only` exclusion.
 *
 * TASK 2 (post-measurement fix, Branch A): the measurement located a real layout cause — see the
 * SUMMARY for the full mutation-proof trail. In short, `StaticRuleRow`/`CustomRuleRow`'s outer
 * `<div>` carries `overflow-hidden` (to clip the decorative hover scanline) and sits, unconstrained
 * by any `flex-shrink-0`/`shrink-0`, inside `.custom-scrollbar` (`flex flex-col max-h-[500px]
 * overflow-y-auto`). Per the CSS Flexbox spec (`min-size: auto` resolution, §4.5), a flex item whose
 * own `overflow` is not `visible` has its AUTOMATIC minimum main-size forced to 0 rather than its
 * content-based minimum — so with 66 rows whose combined natural height (~5,135px) exceeds the
 * container's 500px cap, the default `flex-shrink: 1` compresses every row uniformly, with nothing
 * left to stop it at the content floor. `overflow-y-auto` still works (excess scrolls), but only
 * AFTER the shrink has already crushed each row to ~33px. Fix: `shrink-0` on the row container
 * (both variants) — content asserts its own size and the excess overflow becomes a real scrollbar
 * instead of compression. This spec now asserts on that fixed geometry permanently (below), scoped
 * PER SECTION (`static` vs `custom`, discriminated by presence of the toggle `<button>` — only
 * StaticRuleRow renders one) so the cross-section DOM-order artifact (the single seeded custom rule
 * sits in a separate, unclipped sibling container and is not "the next row" of the static list) does
 * not pollute the pitch assertion.
 */

const ROW_WIDTHS = [1512, 900];
const VIEWPORT_HEIGHT = 900;

// Permanent regression guard (Task 2). Derived from the FIXED row's own
// measured content requirement, not a round number: padding-top 16px + name
// line-height 24px + condition margin-top 2px + condition line-height 20px +
// padding-bottom 16px = 78px, plus the row's own 1px border-bottom = 79px —
// exactly what post-fix measurement recorded for every static row at both
// 1512px and 900px (see SUMMARY). 70px leaves ~8-9px of margin for sub-pixel/
// font-rendering variance while staying far above the pre-fix 33px defect
// (roughly half the correct pitch, matching the original todo's own
// estimate) — the mutation proof below reverts the fix and confirms this
// threshold actually catches that regression rather than passing vacuously.
const MIN_STATIC_ROW_PITCH_PX = 70;

interface RectLike {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

interface AncestorEvidence {
  tagName: string;
  className: string;
  display: string;
  radixAttrs: string[];
}

interface AlertRowEvidence {
  rowIndex: number;
  // Discriminated by the toggle `<button style="...">`, which only
  // StaticRuleRow renders (AlertRulesEngine.tsx:87-93; CustomRuleRow has no
  // toggle). Used to scope the pitch/overlap assertions to same-section
  // neighbours only.
  section: 'static' | 'custom';
  ruleName: string;
  severityText: string;
  rect: RectLike;
  paddingTop: string;
  paddingBottom: string;
  cssHeight: string;
  minHeight: string;
  alignItems: string;
  overflow: string;
  nameRect: RectLike | null;
  nameLineHeight: string | null;
  nameFontSize: string | null;
  conditionRect: RectLike | null;
  conditionLineHeight: string | null;
  conditionFontSize: string | null;
  conditionMarginTop: string | null;
  nameConditionOverlapPx: number | null;
  toggleRect: RectLike | null;
  toggleHeight: number | null;
  toggleInlineStyleHeight: string | null;
  badgeRect: RectLike | null;
  badgeHeight: number | null;
}

interface AlertRowsEvidence {
  requestedWidth: number;
  innerWidth: number;
  rowCount: number;
  rows: AlertRowEvidence[];
  // Raw (unscoped) figures — kept for the record, but NOT what the permanent
  // assertion below uses, because they include the one cross-section jump
  // from the last static row to the separately-positioned custom-rule row
  // (an artifact of the two sections living in different DOM containers, not
  // a defect — see staticSectionPitch* for the assertion-grade figures).
  pitchArray: number[];
  pitchMin: number | null;
  pitchMax: number | null;
  pitchMean: number | null;
  crossRowTextOverlapPx: number[];
  // Same-section-only figures (consecutive pairs where both rows share
  // `section`). These are what Task 2's permanent assertion below checks.
  staticSectionPitchArray: number[];
  staticSectionPitchMin: number | null;
  staticSectionCrossRowTextOverlapPx: number[];
  ancestorChain: AncestorEvidence[];
}

/** Identical Clerk-gate race check to e2e/polish-geometry.spec.ts:74-83. */
async function gateOrSkip(
  page: Page,
  target: ReturnType<Page['getByRole']> | ReturnType<Page['locator']>,
  label: string
) {
  const signInText = page.getByText('Sign in to access the telemetry dashboard');
  await expect(signInText.or(target).first()).toBeVisible({ timeout: 15000 });
  if (await signInText.count()) {
    test.skip(
      true,
      `Clerk auth gate present — ${label} could not be honestly rendered or measured. This spec must be run against the keyless dev:noauth server (see npm run test:e2e:noauth:help).`
    );
  }
}

function toRectLike(r: DOMRect): RectLike {
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
}

async function readAlertRowsEvidence(page: Page, width: number): Promise<AlertRowsEvidence> {
  return page.evaluate((w) => {
    function toRect(r: DOMRect) {
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    }
    // Vertical overlap in px between two rects; 0 (or negative, clamped to 0) means no overlap.
    function vOverlap(a: { top: number; bottom: number } | null, b: { top: number; bottom: number } | null) {
      if (!a || !b) return null;
      return Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    }

    const listContainer = document.querySelector('.custom-scrollbar');

    // Row containers: both StaticRuleRow and CustomRuleRow share identical
    // classes (`... flex items-center gap-4 px-5 py-4 border-b ...`) per
    // AlertRulesEngine.tsx:75/205 — filtered on className.includes rather
    // than a CSS selector to avoid escaping the slash-bearing Tailwind
    // classes (`border-primary/10`) that are also present on non-row
    // elements (the header, the rule-info sub-div).
    const rowEls = Array.from(document.querySelectorAll('div')).filter((d) => {
      const cls = typeof d.className === 'string' ? d.className : '';
      return cls.includes('px-5') && cls.includes('py-4') && cls.includes('border-b') && cls.includes('items-center') && cls.includes('gap-4');
    });

    const rows = rowEls.map((row, rowIndex) => {
      const cs = getComputedStyle(row);
      const rect = row.getBoundingClientRect();

      // Rule-info wrapper: `flex-1 min-w-0 ... flex flex-col ...` (:107/:217)
      const infoDiv = Array.from(row.querySelectorAll('div')).find((d) => {
        const cls = typeof d.className === 'string' ? d.className : '';
        return cls.includes('flex-1') && cls.includes('min-w-0') && cls.includes('flex-col');
      });
      const nameEl = infoDiv?.querySelector('span') ?? null;
      const conditionEl = infoDiv?.querySelector('p') ?? null;
      const nameRect = nameEl ? toRect(nameEl.getBoundingClientRect()) : null;
      const conditionRect = conditionEl ? toRect(conditionEl.getBoundingClientRect()) : null;
      const nameCs = nameEl ? getComputedStyle(nameEl) : null;
      const conditionCs = conditionEl ? getComputedStyle(conditionEl) : null;

      // Toggle button: StaticRuleRow only, identified by its inline `style`
      // attribute (AlertRulesEngine.tsx:87-93) — CustomRuleRow has none.
      const toggleEl = row.querySelector('button[style]') as HTMLElement | null;
      const toggleRect = toggleEl ? toRect(toggleEl.getBoundingClientRect()) : null;

      // Severity badge: distinguished from the (also font-mono/uppercase/
      // tracking-wider) category badge by `font-bold`, which only the
      // severity span carries (:102, :214 vs :132).
      const badgeEl = Array.from(row.querySelectorAll('span')).find((s) => {
        const cls = typeof s.className === 'string' ? s.className : '';
        return cls.includes('font-bold') && cls.includes('font-mono') && cls.includes('uppercase');
      }) as HTMLElement | undefined;
      const badgeRect = badgeEl ? toRect(badgeEl.getBoundingClientRect()) : null;

      return {
        rowIndex,
        section: (toggleEl ? 'static' : 'custom') as 'static' | 'custom',
        ruleName: (nameEl?.textContent ?? '').trim(),
        severityText: (badgeEl?.textContent ?? '').trim(),
        rect: toRect(rect),
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        cssHeight: cs.height,
        minHeight: cs.minHeight,
        alignItems: cs.alignItems,
        overflow: cs.overflow,
        nameRect,
        nameLineHeight: nameCs?.lineHeight ?? null,
        nameFontSize: nameCs?.fontSize ?? null,
        conditionRect,
        conditionLineHeight: conditionCs?.lineHeight ?? null,
        conditionFontSize: conditionCs?.fontSize ?? null,
        conditionMarginTop: conditionCs?.marginTop ?? null,
        nameConditionOverlapPx: vOverlap(nameRect, conditionRect),
        toggleRect,
        toggleHeight: toggleEl ? toggleEl.getBoundingClientRect().height : null,
        toggleInlineStyleHeight: toggleEl ? toggleEl.style.height || null : null,
        badgeRect,
        badgeHeight: badgeEl ? badgeEl.getBoundingClientRect().height : null,
      };
    });

    // Row-to-row PITCH: consecutive rect.top deltas.
    const pitchArray: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      pitchArray.push(rows[i].rect.top - rows[i - 1].rect.top);
    }
    const pitchMin = pitchArray.length ? Math.min(...pitchArray) : null;
    const pitchMax = pitchArray.length ? Math.max(...pitchArray) : null;
    const pitchMean = pitchArray.length ? pitchArray.reduce((a, b) => a + b, 0) / pitchArray.length : null;

    // Cross-row text bunching: this row's condition <p> vs the NEXT row's name <span>.
    const crossRowTextOverlapPx: number[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const ov = vOverlap(rows[i].conditionRect, rows[i + 1].nameRect);
      crossRowTextOverlapPx.push(ov ?? 0);
    }

    // Same-section-only figures: only compare a row against its neighbour
    // when both share `section`, so the one cross-section DOM-order jump
    // (static list -> separately-positioned custom-rule section) never
    // enters the pitch/overlap figures the permanent assertion checks.
    const staticSectionPitchArray: number[] = [];
    const staticSectionCrossRowTextOverlapPx: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].section !== rows[i - 1].section) continue;
      staticSectionPitchArray.push(rows[i].rect.top - rows[i - 1].rect.top);
      const ov = vOverlap(rows[i - 1].conditionRect, rows[i].nameRect);
      staticSectionCrossRowTextOverlapPx.push(ov ?? 0);
    }
    const staticSectionPitchMin = staticSectionPitchArray.length ? Math.min(...staticSectionPitchArray) : null;

    // Ancestor chain: list container up to <body> — settles or rules out the Radix ScrollArea lead.
    const ancestorChain: { tagName: string; className: string; display: string; radixAttrs: string[] }[] = [];
    let cur: Element | null = listContainer;
    while (cur) {
      const cs = getComputedStyle(cur);
      const radixAttrs = Array.from(cur.attributes)
        .map((a) => a.name)
        .filter((n) => n.startsWith('data-radix'));
      ancestorChain.push({
        tagName: cur.tagName,
        className: typeof cur.className === 'string' ? cur.className : String(cur.className),
        display: cs.display,
        radixAttrs,
      });
      if (cur.tagName === 'BODY') break;
      cur = cur.parentElement;
    }

    return {
      requestedWidth: w,
      innerWidth: window.innerWidth,
      rowCount: rows.length,
      rows,
      pitchArray,
      pitchMin,
      pitchMax,
      pitchMean,
      crossRowTextOverlapPx,
      staticSectionPitchArray,
      staticSectionPitchMin,
      staticSectionCrossRowTextOverlapPx,
      ancestorChain,
    } satisfies AlertRowsEvidence;
  }, width);
}

test.describe('Alert Rules Engine row geometry — D-07 measurement (SWEEP-04)', () => {
  for (const width of ROW_WIDTHS) {
    test(`${width}px — Alert Rules row pitch, text overlap, ancestor chain, badge text`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/alerts');

      const panelHeading = page.getByRole('heading', { name: /Alert Rules Engine/ });
      await gateOrSkip(page, panelHeading, `the ${width}px Alert Rules geometry measurement`);

      await expect(panelHeading).toBeVisible();

      // Fail-don't-skip wait on a real rendered rule row, per
      // e2e/serif-trial.spec.ts:57-70's idiom (plan 126-04 fixed this exact
      // class of defect for the sibling header-zones spec first). `alertRules`
      // is a static, non-empty module-level array (convex/alertRules.ts) so
      // StaticRuleRow rows do not depend on a Convex query resolving — but the
      // wait still guards against a genuinely broken render (e.g. a thrown
      // query elsewhere in the tree unmounting this page, per this repo's own
      // "a throwing useQuery blanks the whole app" lesson).
      const firstRow = page.locator('.custom-scrollbar > div.px-5.py-4.border-b.items-center').first();
      try {
        await expect(firstRow).toBeVisible({ timeout: 15000 });
      } catch (err) {
        throw new Error(
          `ALERT-ROWS measurement cannot be honestly taken: no rule row rendered within 15s at ` +
            `${width}px inside .custom-scrollbar. A measurement taken before rows exist records a ` +
            `page that is not there — this is a FAILURE, not a skip. Original error: ${err}`
        );
      }

      const evidence = await readAlertRowsEvidence(page, width);

      // eslint-disable-next-line no-console
      console.log(`ALERT-ROWS-EVIDENCE ${JSON.stringify(evidence)}`);

      expect(
        evidence.innerWidth,
        `in-page window.innerWidth (${evidence.innerWidth}) must match the requested viewport width (${width}) or this tier is VOID`
      ).toBe(width);

      // The one gate this task asserts: rows > 0 (D-07 sanity check). A
      // zero-row page would otherwise produce an empty pitch array / NaN
      // that could misread as "no overlap found."
      expect(
        evidence.rowCount,
        `rowCount must be > 0 or this measurement is void (recorded a page with no rendered rows): ${JSON.stringify(evidence)}`
      ).toBeGreaterThan(0);

      // ─── Permanent regression guard (Task 2, D-07 Branch A fix) ──────────
      // Scoped to same-section neighbours only (staticSectionPitchArray/
      // staticSectionCrossRowTextOverlapPx) — see the interface comment for
      // why the raw/global figures are unsuitable here.
      expect(
        evidence.staticSectionPitchMin,
        `every consecutive same-section row pair must be at least ${MIN_STATIC_ROW_PITCH_PX}px apart ` +
          `(min observed: ${evidence.staticSectionPitchMin}px, full array: ` +
          `${JSON.stringify(evidence.staticSectionPitchArray)}) — a value near 33px means the ` +
          `flex-shrink/overflow-hidden row-compression regression (D-07 Branch A) is back`
      ).toBeGreaterThanOrEqual(MIN_STATIC_ROW_PITCH_PX);

      const withinRowOverlaps = evidence.rows
        .map((r) => r.nameConditionOverlapPx)
        .filter((v): v is number => v !== null);
      expect(
        Math.max(...withinRowOverlaps),
        `every row's own name/condition text must not overlap (max observed: ` +
          `${Math.max(...withinRowOverlaps)}px, per-row: ${JSON.stringify(
            evidence.rows.map((r) => ({ ruleName: r.ruleName, nameConditionOverlapPx: r.nameConditionOverlapPx }))
          )})`
      ).toBe(0);

      const crossRowMax = evidence.staticSectionCrossRowTextOverlapPx.length
        ? Math.max(...evidence.staticSectionCrossRowTextOverlapPx)
        : 0;
      expect(
        crossRowMax,
        `no row's condition text may overlap the next same-section row's name text (max observed: ` +
          `${crossRowMax}px, full array: ${JSON.stringify(evidence.staticSectionCrossRowTextOverlapPx)}) — ` +
          `a nonzero value is exactly the "bunches up the text" symptom the operator reported`
      ).toBe(0);
    });
  }
});
