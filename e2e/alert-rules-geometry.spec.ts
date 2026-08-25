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
 * NO pass/fail assertion is made on the measured pitch in this task beyond the `rows > 0` sanity
 * gate — the threshold isn't known until the measurement exists (D-07). Task 2 turns this into a
 * permanent assertion once the mechanism (or its absence) is established.
 */

const ROW_WIDTHS = [1512, 900];
const VIEWPORT_HEIGHT = 900;

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
  pitchArray: number[];
  pitchMin: number | null;
  pitchMax: number | null;
  pitchMean: number | null;
  crossRowTextOverlapPx: number[];
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
    });
  }
});
