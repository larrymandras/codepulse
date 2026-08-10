/**
 * galdrSlug.ts — the single implementation of a Galdr prompt's ASCII kebab slug.
 *
 * Phase 116 (Galdr Prompt Library), D-06: the slug is derived on the SERVER from the title
 * (`convex/galdr.ts`'s `createPromptHandler`, plan 116-03, calls `slugify`), and the UI's
 * editor drawer calls the same function to show a live slug preview — so there is exactly one
 * derivation, and "when `/galdr-save <title>` produces an existing slug" has exactly one
 * meaning. Suite-wide locked decision (2026-08-07 Seiðr suite design §2): slugs are ASCII.
 *
 * Pure and import-free, like `galdrVariables.ts` — no `convex/values`, no `./_generated/*`, no
 * React — so both the Convex server bundle and the browser bundle can import it directly.
 */

/**
 * Explicit transliteration map applied BEFORE Unicode normalization. These characters do not
 * decompose under NFKD, so a generic normalizer alone would turn them into separator runs
 * (dropped entirely) rather than a readable ASCII letter. This project's own vocabulary uses
 * them constantly (Ástríðr, Bifröst, Seiðr), so this map is not a hypothetical edge case.
 */
const TRANSLITERATION_MAP: Record<string, string> = {
  // eth (þ's voiced sibling, as in "Ástríðr")
  "Ð": "D",
  "ð": "d",
  // thorn
  "Þ": "Th",
  "þ": "th",
  // slashed o (as in "Bifröst" — note: ö itself is o-with-diaeresis, handled by NFKD; ø is
  // the non-decomposing slashed form some Nordic sources also use)
  "Ø": "O",
  "ø": "o",
  // ae ligature
  "Æ": "Ae",
  "æ": "ae",
  // sharp s
  "ß": "ss",
};

const TRANSLITERATION_PATTERN = new RegExp(
  Object.keys(TRANSLITERATION_MAP).join("|"),
  "g"
);

/** Combining-marks range stripped after NFKD normalization (U+0300 - U+036F). */
const COMBINING_MARKS_PATTERN = /[̀-ͯ]/g;

/** Apostrophes and right single quotation marks, removed entirely so a possessive collapses. */
const APOSTROPHE_PATTERN = /['’]/g;

/** Any run of characters outside a-z0-9, collapsed to a single hyphen. */
const NON_ALPHANUMERIC_RUN_PATTERN = /[^a-z0-9]+/g;

/** Leading/trailing hyphens, trimmed. */
const EDGE_HYPHEN_PATTERN = /^-+|-+$/g;

/**
 * Upper bound on a slug's length. Reason: the slug is a URL query parameter and a card label —
 * an unbounded slug from a paragraph-length title is a usability problem, not a correctness one,
 * but it is cheaper to bound now than to migrate later.
 */
export const MAX_SLUG_LENGTH = 80;

/**
 * slugify — derive an ASCII kebab-case slug from a title.
 *
 * Order matters:
 *   1. Transliterate non-decomposing Nordic characters (map above).
 *   2. NFKD-normalize and strip combining marks — turns accented Latin letters into their base
 *      letters (e.g. e-acute -> e).
 *   3. Lowercase.
 *   4. Remove apostrophes / right single quotes entirely (a possessive collapses, not a hyphen).
 *   5. Collapse every run of non a-z0-9 characters to a single hyphen.
 *   6. Trim leading/trailing hyphens.
 *   7. Truncate to MAX_SLUG_LENGTH, re-trimming any trailing hyphen truncation creates.
 *
 * Returns the empty string when nothing survives. Does not throw — the caller (116-03's
 * createPromptHandler) decides what an empty slug means (refuses the save with EMPTY_SLUG).
 */
export function slugify(title: string): string {
  const transliterated = title.replace(
    TRANSLITERATION_PATTERN,
    (char) => TRANSLITERATION_MAP[char] ?? char
  );
  const normalized = transliterated.normalize("NFKD").replace(COMBINING_MARKS_PATTERN, "");
  const lowered = normalized.toLowerCase();
  const noApostrophes = lowered.replace(APOSTROPHE_PATTERN, "");
  const hyphenated = noApostrophes.replace(NON_ALPHANUMERIC_RUN_PATTERN, "-");
  const trimmed = hyphenated.replace(EDGE_HYPHEN_PATTERN, "");
  const truncated = trimmed.slice(0, MAX_SLUG_LENGTH);
  return truncated.replace(EDGE_HYPHEN_PATTERN, "");
}
