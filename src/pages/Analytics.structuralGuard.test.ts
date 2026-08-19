/**
 * D-04 structural ratchet: derives — from the AST of `src/pages/Analytics.tsx` itself — whether
 * any query-shaped hook sits unprotected in the page's own function body, and whether any custom
 * JSX element it renders lacks a `SectionErrorBoundary` ancestor. Contains no list of today's
 * query names: `REACT_SAFE_HOOKS` below is a closed, framework-owned allowlist (React and
 * react-router builtins only), so a query hook invented tomorrow is a violation by construction,
 * not because anyone remembered to add its name here.
 *
 * Precedent and departure: `LlmAnalyticsPanel.test.tsx`'s
 * `readFileSync(resolve(process.cwd(), ...))` idiom is reused for locating the source file. Its
 * matching strategy — a regex for one known-bad literal — is exactly what this ratchet does NOT
 * do; every check here is a real AST walk instead of a string match.
 *
 * KNOWN LIMITATION (stated, not hedged): this walk covers exactly one file. It is sound only
 * while `Analytics.tsx` composes its own sections inline, as it does today. If a later phase
 * extracts a layout/composition component out of this page's body, this test silently stops
 * covering whatever moved out — the file target below must move with it, or the ratchet quietly
 * stops constraining anything.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";

const ANALYTICS_SOURCE_PATH = resolve(process.cwd(), "src/pages/Analytics.tsx");
const REAL_SOURCE = readFileSync(ANALYTICS_SOURCE_PATH, "utf-8");

/**
 * React and react-router builtins only. Nothing Convex-shaped and nothing domain-specific — a
 * query hook invented tomorrow is not in this set by construction, so it fails CHECK 1 without
 * this file ever being touched again.
 */
const REACT_SAFE_HOOKS = new Set([
  "useState",
  "useEffect",
  "useMemo",
  "useCallback",
  "useRef",
  "useReducer",
  "useContext",
  "useId",
  "useLayoutEffect",
  "useImperativeHandle",
  "useDeferredValue",
  "useTransition",
  "useSyncExternalStore",
  "useNavigate",
  "useParams",
  "useLocation",
  "useSearchParams",
]);

/**
 * Small, closed set of presentational primitives that are rendered today without their own
 * `SectionErrorBoundary` ancestor and are verified to own no query of their own. Every entry
 * must actually appear in `Analytics.tsx` — an allowlist entry for a tag no longer present is an
 * unexamined exemption waiting for a future reintroduction — and must be grepped for
 * `useQuery`/`usePaginatedQuery` before being added.
 *
 * - "GlassPanel" (`src/components/GlassPanel.tsx`) — a pure `motion.div` styling wrapper around
 *   `children`, nothing else. Grepped for `useQuery|usePaginatedQuery` 2026-08-18: 0 matches.
 *   Rendered bare (no boundary ancestor of its own) as the Summary Row's outer wrapper, around
 *   four already-independently-boundary-wrapped cards — the exact shape this allowlist exists
 *   for: presentational, no query, safe to leave unwrapped.
 * - "SectionHeader" (`src/components/SectionHeader.tsx`) — renders a title string and a
 *   separator from props only. Grepped for `useQuery|usePaginatedQuery` 2026-08-18: 0 matches.
 *   Rendered bare twice, as section dividers ("Advanced Visualizations", "Agent Telemetry").
 * - "PageHeader" (`src/components/PageHeader.tsx`) — renders title/eyebrow/subtitle/icon/actions
 *   from props only (122-11, D-17's page-layer contract). Grepped for
 *   `useQuery|usePaginatedQuery` 2026-08-19: 0 matches. Rendered bare once, as this page's own
 *   title, replacing the hand-rolled `<h1>` it previously used in the same unwrapped position.
 */
const PRESENTATIONAL_ALLOWLIST = new Set(["GlassPanel", "SectionHeader", "PageHeader"]);

interface ImportBinding {
  localName: string;
  /** The name as exported by its module; "default" for a default import. */
  importedName: string;
  moduleSpecifier: string;
}

function collectImportBindings(sourceFile: ts.SourceFile): ImportBinding[] {
  const bindings: ImportBinding[] = [];
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || !stmt.importClause) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const moduleSpecifier = stmt.moduleSpecifier.text;
    const clause = stmt.importClause;
    if (clause.name) {
      bindings.push({ localName: clause.name.text, importedName: "default", moduleSpecifier });
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const spec of clause.namedBindings.elements) {
        const importedName = (spec.propertyName ?? spec.name).text;
        bindings.push({ localName: spec.name.text, importedName, moduleSpecifier });
      }
    }
  }
  return bindings;
}

/**
 * Resolves a JSX tag's local identifier to the name it was actually imported as, so an aliased
 * import (`import Foo as SectionErrorBoundary`) cannot defeat either the boundary check or the
 * presentational allowlist by presenting a different literal tag string than what it really is.
 * The current import block is unaliased (verified by reading it in full) — this resolution is
 * currently a no-op in practice; it exists so that stays true rather than becoming an assumption.
 */
function resolveTagIdentity(localTag: string, bindings: ImportBinding[]): string {
  const binding = bindings.find((b) => b.localName === localTag);
  if (!binding) return localTag;
  if (binding.importedName !== "default") return binding.importedName;
  // Default import: recover the canonical name from the module specifier's own file name,
  // e.g. "../components/SectionErrorBoundary" -> "SectionErrorBoundary".
  const fileName = binding.moduleSpecifier.split("/").pop();
  return fileName && fileName.length > 0 ? fileName : localTag;
}

function findAnalyticsFunction(sourceFile: ts.SourceFile): ts.FunctionDeclaration {
  let found: ts.FunctionDeclaration | undefined;
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "Analytics") {
      found = node;
    }
  });
  if (!found) {
    throw new Error("analyzeAnalyticsSource: could not find `function Analytics` in source");
  }
  return found;
}

/**
 * CHECK 1: every `use*` call sitting at the top level of `Analytics()`'s own function body — i.e.
 * NOT inside the JSX subtree it returns — excluding `REACT_SAFE_HOOKS`. Derived from AST shape,
 * not from a name list: a hook name invented tomorrow is caught by construction.
 */
function collectHoistedHooks(fn: ts.FunctionDeclaration): string[] {
  const violations: string[] = [];
  if (!fn.body) return violations;

  function walk(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if (/^use[A-Z]/.test(name) && !REACT_SAFE_HOOKS.has(name)) {
        violations.push(name);
      }
    }
    ts.forEachChild(node, walk);
  }

  for (const stmt of fn.body.statements) {
    // Deliberately skip the return statement — that is the JSX subtree, CHECK 2's territory,
    // not CHECK 1's. Every other top-level statement is walked in full.
    if (ts.isReturnStatement(stmt)) continue;
    walk(stmt);
  }
  return violations;
}

/**
 * CHECK 2: every custom (capitalized) JSX element in the JSX `Analytics()` returns must have a
 * `SectionErrorBoundary` ancestor within that same tree, unless it is itself
 * `SectionErrorBoundary` or sits on the closed `PRESENTATIONAL_ALLOWLIST`.
 */
function collectUnwrappedElements(fn: ts.FunctionDeclaration, bindings: ImportBinding[]): string[] {
  const violations: string[] = [];
  if (!fn.body) return violations;
  const returnStmt = fn.body.statements.find(ts.isReturnStatement);
  if (!returnStmt || !returnStmt.expression) return violations;

  function tagNameOf(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
    const tagNameNode = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
    return tagNameNode.getText();
  }

  function walk(node: ts.Node, insideBoundary: boolean): void {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const localTag = tagNameOf(node);
      const resolvedTag = resolveTagIdentity(localTag, bindings);
      const isCustom = /^[A-Z]/.test(resolvedTag);
      if (isCustom && resolvedTag === "SectionErrorBoundary") {
        // Everything nested inside a boundary is protected by it — descend with the flag set,
        // and do not also flag the boundary element itself.
        ts.forEachChild(node, (child) => walk(child, true));
        return;
      }
      if (isCustom && !PRESENTATIONAL_ALLOWLIST.has(resolvedTag) && !insideBoundary) {
        violations.push(resolvedTag);
      }
    }
    ts.forEachChild(node, (child) => walk(child, insideBoundary));
  }

  walk(returnStmt.expression, false);
  return violations;
}

/**
 * Pure function of source text — analysis never touches the filesystem or executes the page's
 * code. Purity is what makes the mutation tests below possible without ever writing a mutated
 * file to disk: every mutation is a string transform on `REAL_SOURCE`, held entirely in memory.
 */
function analyzeAnalyticsSource(src: string): { hoistedHooks: string[]; unwrappedElements: string[] } {
  const sourceFile = ts.createSourceFile(
    "Analytics.tsx",
    src,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );
  const fn = findAnalyticsFunction(sourceFile);
  const bindings = collectImportBindings(sourceFile);
  return {
    hoistedHooks: collectHoistedHooks(fn),
    unwrappedElements: collectUnwrappedElements(fn, bindings),
  };
}

describe("Analytics.tsx structural ratchet (D-04)", () => {
  it("has no query-shaped hook call in Analytics()'s own function body", () => {
    // Expected value after Phase 121 Plan 04: 0. Before that plan's relocation (the
    // god-component shape this ratchet exists to prevent regressing to), the true value was 10
    // hoisted calls — recorded here as the floor this test was set against, not as a name list
    // to keep up to date.
    const { hoistedHooks } = analyzeAnalyticsSource(REAL_SOURCE);
    expect(hoistedHooks).toEqual([]);
  });

  it("has a SectionErrorBoundary ancestor for every custom element it renders", () => {
    const { unwrappedElements } = analyzeAnalyticsSource(REAL_SOURCE);
    expect(unwrappedElements).toEqual([]);
  });
});

describe("the ratchet actually constrains", () => {
  /**
   * Inserts a synthetic hook call immediately after the function's opening brace. Never written
   * to disk — the mutated text lives only in this test's memory.
   */
  function insertSyntheticHookCall(src: string): string {
    const marker = "export default function Analytics() {";
    const idx = src.indexOf(marker);
    expect(idx, "marker for Analytics()'s opening brace not found in real source").toBeGreaterThan(-1);
    const insertAt = idx + marker.length;
    return (
      src.slice(0, insertAt) +
      "\n  const __syntheticProbe = useTotallyNewThingNobodyHasWrittenYet();" +
      src.slice(insertAt)
    );
  }

  /**
   * Inserts a synthetic, un-wrapped custom element as the first child of the page's outer grid
   * div — the same position class as the unwrapped Summary Row this ratchet was built to catch.
   * Never written to disk.
   */
  function insertSyntheticUnwrappedElement(src: string): string {
    const marker = 'className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">';
    const idx = src.indexOf(marker);
    expect(idx, "marker for the outer grid div not found in real source").toBeGreaterThan(-1);
    const insertAt = idx + marker.length;
    return (
      src.slice(0, insertAt) + "\n        <SomeBrandNewPanelNobodyHasWrittenYet />" + src.slice(insertAt)
    );
  }

  it("Case A: a synthetic hoisted hook, never seen in this repo, fails the ratchet", () => {
    const mutated = insertSyntheticHookCall(REAL_SOURCE);
    // Case C (validity precondition), asserted BEFORE the failure assertion below: a
    // syntactically invalid mutation would produce a parse error that reads exactly like the
    // guard firing. If this were not empty, the failure below would be evidence of nothing.
    const { diagnostics } = ts.transpileModule(mutated, {
      fileName: "Analytics.tsx",
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve },
    });
    expect(diagnostics ?? []).toEqual([]);

    const { hoistedHooks } = analyzeAnalyticsSource(mutated);
    expect(hoistedHooks).toContain("useTotallyNewThingNobodyHasWrittenYet");
  });

  it("Case B: a synthetic unwrapped element, never seen in this repo, fails the ratchet", () => {
    const mutated = insertSyntheticUnwrappedElement(REAL_SOURCE);
    // Case C again, for this mutation specifically — see Case A's comment.
    const { diagnostics } = ts.transpileModule(mutated, {
      fileName: "Analytics.tsx",
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve },
    });
    expect(diagnostics ?? []).toEqual([]);

    const { unwrappedElements } = analyzeAnalyticsSource(mutated);
    expect(unwrappedElements).toContain("SomeBrandNewPanelNobodyHasWrittenYet");
  });

  it("negative control: the unmutated real source trips neither check", () => {
    // Without this, an analyzer that reports a violation for every input would pass Case A and
    // Case B while proving nothing about the real file.
    const result = analyzeAnalyticsSource(REAL_SOURCE);
    expect(result.hoistedHooks).toEqual([]);
    expect(result.unwrappedElements).toEqual([]);
  });
});
