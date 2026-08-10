/**
 * galdrVariables.ts — the single shared definition of a Galdr `{{variable}}` placeholder,
 * of what "unresolved" means, and of how substitution happens.
 *
 * Phase 116 (Galdr Prompt Library), D-09..D-12: the variable fill-in contract is "one contract,
 * not four independent choices" — the skill's args-then-ask resolution (D-09), the skill's
 * refuse-to-inject gate (D-10), the UI's disabled-Copy gate (D-11), and Send-to-Chat's
 * resolve-before-handoff step (D-12) must all agree on the exact same definition of a variable
 * and of "unresolved", or a half-filled prompt reaches a model looking like intentional work.
 *
 * Lives in `convex/`, not `src/lib/`, because the SERVER also needs it — `convex/galdr.ts`
 * (plan 116-03) computes each prompt's `variables[]` and its slug depends on the same body —
 * mirroring the established `convex/<name>Filters.ts` pattern (`activeEngineFilters.ts`,
 * `controlVerbSwapsFilters.ts`) of a module shared across the convex/src boundary.
 *
 * Deliberately dependency-free — no `convex/values`, no `./_generated/*`, no React — so both
 * the Convex server bundle and the browser bundle can import it without either pulling in the
 * other's runtime, and so vitest can load it with zero setup.
 */

/**
 * Single source string every function in this module builds a fresh `RegExp` from. Exported so
 * a test (and any future consumer) can assert two independently-constructed regexes agree.
 * Never export a shared `RegExp` INSTANCE: a `/g` regex carries mutable `lastIndex` state, and a
 * module-level instance reused across calls produces position-dependent misses (T-116-12).
 *
 * Semantics: two literal open braces, optional inner whitespace, a capture group of one-or-more
 * characters from `A-Za-z0-9_.-`, optional inner whitespace, two literal close braces.
 */
export const VARIABLE_PATTERN_SOURCE = "\\{\\{\\s*([A-Za-z0-9_.-]+)\\s*\\}\\}";

function buildPattern(): RegExp {
  return new RegExp(VARIABLE_PATTERN_SOURCE, "g");
}

/**
 * detectVariables — every placeholder name in `body`, whitespace trimmed off the name,
 * de-duplicated, in first-occurrence order. Case-sensitive: `company` and `Company` are two
 * distinct variables (the skill and the UI must both honor this — neither lowercases a name).
 */
export function detectVariables(body: string): string[] {
  const pattern = buildPattern();
  const seen = new Set<string>();
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/**
 * unresolvedVariables — the subset of `detectVariables(body)` whose value in `values` is
 * `undefined`, the empty string, or whitespace-only. This is the SINGLE shared definition of
 * "unresolved" that D-10 (skill refuses to inject) and D-11 (UI Copy stays disabled) both mean.
 * Do not define "resolved" separately anywhere else in the codebase.
 */
export function unresolvedVariables(
  body: string,
  values: Record<string, string | undefined>
): string[] {
  return detectVariables(body).filter((name) => {
    const value = values[name];
    return value === undefined || value.trim() === "";
  });
}

/**
 * isFullyResolved — true when no variable in `body` is unresolved per `values`. The vacuous-truth
 * case (zero variables) is intentional and load-bearing: it is what lets UI-SPEC's "zero-variable
 * prompts skip the fill-in dialog entirely" rule hold without a special case.
 */
export function isFullyResolved(
  body: string,
  values: Record<string, string | undefined>
): boolean {
  return unresolvedVariables(body, values).length === 0;
}

/**
 * substituteVariables — replace each placeholder occurrence with its value in a SINGLE pass
 * using `String.prototype.replace` with a replacer callback. A value that is `undefined`, empty,
 * or whitespace-only leaves the literal placeholder text in place untouched (the editor preview
 * highlights those; no delivery path ever calls this without gating on `isFullyResolved` first).
 *
 * Single-pass is a SECURITY property, not a style choice (T-116-11): a two-pass or
 * loop-until-stable implementation would let a value containing `{{other}}` be expanded from
 * whatever `other` happens to hold, letting one resolved variable's value inject a second,
 * unrelated variable's value into the output. `replace()` with a global regex and a callback
 * scans the ORIGINAL string exactly once — the replacement text it returns is never re-scanned —
 * so this property holds by construction.
 */
export function substituteVariables(
  body: string,
  values: Record<string, string | undefined>
): string {
  const pattern = buildPattern();
  return body.replace(pattern, (whole, name: string) => {
    const value = values[name];
    if (value === undefined || value.trim() === "") {
      return whole;
    }
    return value;
  });
}
