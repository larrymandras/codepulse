/**
 * MasonryGrid — true CSS multi-column masonry (Phase 118, plan 118-10).
 *
 * No JS masonry library (forbidden by 118-CONTEXT.md) and no fixed-aspect
 * crop — CSS Grid alone cannot pack variable-height items, so this is the
 * only no-dependency way to satisfy the UI-SPEC's "masonry grid, 2–6
 * columns" Layout Contract. 118-PATTERNS.md confirmed no analog exists
 * anywhere in `src/` for this — it is written fresh here.
 *
 * Known, ACCEPTED tradeoff — do not "fix" this into a uniform CSS Grid: CSS
 * multi-column layout fills top-to-bottom per column before wrapping to the
 * next column, so visual reading order is column-major, not the row-major
 * raster order a CSS Grid would give. The design doc asked for masonry
 * specifically, and rows are sorted (newest-first) independent of the
 * visual packing order, so nothing is lost — only the raster-scan reading
 * habit Galdr's/Bifröst's uniform grids give does not carry over here.
 *
 * Purely presentational: it owns no data-fetching or filtering. `renderCard`
 * must set its own `key` (typically the row id) on the element it returns —
 * this component's own children are each card's outermost element (the
 * `Card` itself carries `break-inside-avoid mb-4`, per the UI-SPEC's Media
 * Card Contract), not a second wrapping div.
 */
export function MasonryGrid<T>({
  rows,
  renderCard,
}: {
  rows: T[];
  renderCard: (row: T) => React.ReactNode;
}) {
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-4">
      {rows.map((row) => renderCard(row))}
    </div>
  );
}
