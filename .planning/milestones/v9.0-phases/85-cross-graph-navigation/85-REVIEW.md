---
phase: 85-cross-graph-navigation
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/lib/focus-url.ts
  - src/lib/focus-url.test.ts
  - src/hooks/useFocusParam.ts
  - src/hooks/useFocusParam.test.ts
  - src/pages/ToolGalaxy.tsx
  - src/components/graph/CodeVaultGraph.tsx
  - src/pages/KnowledgeGraph.tsx
  - src/components/kg/KGDetailsPanel.tsx
  - src/pages/ToolGalaxy.test.tsx
  - src/components/graph/CodeVaultGraph.test.tsx
  - src/components/graph/CodeVaultGraph.tooltip.test.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
resolved:
  - CR-01  # fixed in bff0d83 — decodeFromParam validate-only (no double decode)
  - WR-01  # fixed in bff0d83 — backslash path rejection
  - WR-03  # fixed in bff0d83 — hops clamped to [1,6]
  - WR-02  # fixed in 429cf29 — centerNodeWhenReady rAF-retries until layout assigns x/y
  - WR-04  # fixed in 429cf29 — KG hydration is reactive state; override effect re-runs explicitly
status: resolved
---

# Phase 85: Code Review Report

> **Resolution (2026-06-22, orchestrator):** ALL findings resolved. CR-01
> (blocker), WR-01, WR-03 fixed in `bff0d83`; WR-02 (centering race) and WR-04
> (KG effect ordering) fixed in `429cf29` (centerNodeWhenReady rAF-retry helper
> + reactive hydration state). Verified by `tsc` + full Vitest suite (1189
> passing, incl. 5 new graph-center tests). INFO items left as-is.

**Reviewed:** 2026-06-22
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 85 wires URL-param-driven deep-linking across the three graph surfaces (Tool Galaxy, Code/Vault Graph, KG Explorer) via `focus-url.ts` + `useFocusParam`. The two security-critical items called out for scrutiny — the `decodeFromParam` open-redirect guard and the `focusKeysMatch` zero-false-positive match gate — are largely sound: `focusKeysMatch` is strict exact-equality with no fuzzy fallback (correct per D-04), and `decodeFromParam` rejects protocol-relative, absolute, and scheme URLs.

The headline defect is a **double-decode of the `?from` param** (CR-01): React Router's `URLSearchParams` decodes the param once, then `decodeFromParam` decodes it a second time. This corrupts return URLs whose `focus` value contains percent-encoded reserved characters, and the test suite bakes in the corrupted expectation, so it passes green while the behavior is wrong. There is also a backslash gap in the same-origin guard (WR-01), a never-retried focus-centering one-shot (WR-02), and a negative-hops passthrough (WR-03).

## Critical Issues

### CR-01: `?from` param is decoded twice — corrupts return URLs with encoded reserved chars

**File:** `src/hooks/useFocusParam.ts:44-49`, `src/lib/focus-url.ts:80-103`

**Issue:** `useSearchParams()` from React Router returns query-param values **already URL-decoded once** (that is `URLSearchParams` behavior). The code then passes that already-decoded value into `decodeFromParam`, which calls `decodeURIComponent` a **second time**:

```ts
// useFocusParam.ts
const [searchParams] = useSearchParams();
const fromRaw = searchParams.get("from");          // already decoded once
const fromParam = decodeFromParam(fromRaw);         // decodes AGAIN
```

```ts
// focus-url.ts
export function decodeFromParam(raw: string | null): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);              // second decode
  } catch { return null; }
  ...
}
```

Trace the real producer path. `CodeVaultGraph.tsx:630` builds the origin URL with the focus value already encoded, then `buildFocusUrl` encodes the whole origin URL again:

- `fromUrl = "/graphs?focus=" + encodeURIComponent(selectedNodeId)` → `/graphs?focus=graphify%3Acodepulse%3AApp`
- `buildFocusUrl(...)` → `from=${encodeURIComponent(fromUrl)}` → the `%3A` becomes `%253A`
- On arrival, `searchParams.get("from")` decodes once → `/graphs?focus=graphify%3Acodepulse%3AApp`
- `decodeFromParam` decodes again → `/graphs?focus=graphify:codepulse:App` ← **the focus value is now mangled**

For node ids containing only `:` the corruption is benign (a colon is valid unescaped in a query value, so the downstream `searchParams.get("focus")` still resolves). But any id/entity name containing a genuinely reserved character that arrives as `%XX` after the first decode — `&`, `#`, `=`, `+`, `/`, or a literal `%` — is destroyed on the second decode, producing a wrong or unroutable return target (and a malformed-`%` sequence throws inside `decodeURIComponent`, silently nulling the chip and dropping the return path entirely). KG entity names and graphify symbol ids are free-form and can contain these characters.

This is masked because the tests never exercise the real `URLSearchParams` decode + `decodeFromParam` decode together as the producer emits them:
- `focus-url.test.ts:111-119` calls `decodeFromParam(encodeFromParam(original))` directly — exactly one encode, one decode, so it round-trips.
- `useFocusParam.test.ts:128-145` builds the URL with a single `encodeURIComponent` of a string that *already* contains `%3A`, then asserts the output is `/tool-galaxy?focus=tool:Read` — i.e. it asserts the double-decoded (corrupted) value as if it were correct.

**Fix:** Decode exactly once. Since `searchParams.get` already decodes, `decodeFromParam` should validate the value as-is without a second `decodeURIComponent`:

```ts
export function decodeFromParam(raw: string | null): string | null {
  if (!raw) return null;
  const decoded = raw; // URLSearchParams already decoded it once
  if (!decoded.startsWith("/")) return null;
  if (decoded.startsWith("//")) return null;
  if (decoded.includes("://")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) return null;
  return decoded;
}
```

Then update `useFocusParam.test.ts:128-145` to build the URL the way producers do (`from=${encodeURIComponent(originUrl)}`) and assert the *exact* origin URL round-trips, and add a regression case for a focus id containing `&` or `%`. Note the round-trip helper pair `encodeFromParam`/`decodeFromParam` in `focus-url.ts` is then asymmetric (encode percent-encodes, decode no longer un-percent-encodes) — `encodeFromParam` is only meaningful at URL-build time via `buildFocusUrl`, so document that `decodeFromParam` consumes a `URLSearchParams`-decoded value, not a raw query string.

## Warnings

### WR-01: same-origin guard does not reject backslash-prefixed paths

**File:** `src/lib/focus-url.ts:90-102`

**Issue:** The guard's stated purpose (lines 70-79) is open-redirect / XSS protection. It blocks `//evil.com` and `://` but not backslash variants. A value like `/\evil.com` or `/\\evil.com` passes every check: it starts with a single `/`, does not start with `//`, contains no `://`, and matches no scheme. Browsers normalize `\` to `/` in URL contexts, so `/\evil.com` is equivalent to `//evil.com` (protocol-relative → external). Today the value is consumed via React Router `navigate(fromParam)` (e.g. `ToolGalaxy.tsx:282`, `CodeVaultGraph.tsx:500`), which treats it as an in-app pathname rather than performing browser URL normalization, so it currently routes to a dead in-app path rather than redirecting off-site — but the guard is advertised as the open-redirect defense and a future caller doing `window.location = fromParam` would be vulnerable. Defense-in-depth for a security guard should not depend on the consumer.

**Fix:** Reject backslashes outright after decoding:

```ts
if (decoded.includes("\\")) return null;
```

Add a test: `decodeFromParam("/\\evil.com")` → `null`.

### WR-02: focus centering fires once before layout exists and is never retried

**File:** `src/pages/ToolGalaxy.tsx:150-161`, `src/components/graph/CodeVaultGraph.tsx:143-153`, `src/pages/KnowledgeGraph.tsx:110-121`

**Issue:** All three `onFocus` callbacks guard the camera move on `node.x != null && node.y != null`:

```ts
onFocus: (node) => {
  setSelectedNodeId(node.id);
  const typedNode = node as GalaxyNode & { x?: number; y?: number };
  if (typedNode.x != null && typedNode.y != null) {
    fgRef.current?.centerAt(typedNode.x, typedNode.y, 800);
    fgRef.current?.zoom(3, 800);
  }
},
```

`useFocusParam` applies `onFocus` exactly once, immediately after `nodes` first resolves (`useFocusParam.ts:62-66`). At that moment the force simulation has not run, so `node.x`/`node.y` are `undefined` and the `centerAt`/`zoom` block is skipped. Because the `appliedRef` one-shot never re-arms, the camera is **never** moved to the focused node — the deep-link selects the node but does not visually center it, which is the primary point of a focus deep-link. The node is selected (panel opens), so the failure is silent. This contradicts the inline promise "Center the focused entity once it resolves" (`KnowledgeGraph.tsx:107`).

**Fix:** Capture the focus target and perform the centering from an `onEngineStop`/settle handler (CodeVaultGraph already wires `onEngineStop` at line 480), or have the canvas expose a `centerOnNode(id)` that the surface calls once coordinates exist. At minimum, store the pending focus id in a ref and center it when the engine reports a tick with coordinates.

### WR-03: negative `hops` value passes through unclamped

**File:** `src/pages/KnowledgeGraph.tsx:104`

**Issue:**
```ts
setFilter("hops", hopsParam ? (Number(hopsParam) || 1) : 1);
```
`Number("0")` and `Number("abc")` are correctly coerced to `1` (falsy → `|| 1`). But `Number("-3")` is `-3`, which is truthy and passes straight through to the entity-lens fetch (`useKnowledgeGraph.ts:190-195`) as `hops: -3`. A negative hop count is not a valid traversal depth; behavior at the fetch/normalize layer is undefined. `buildFocusUrl` never emits negative hops, but `?hops` is user-editable in the URL.

**Fix:** Clamp to a sane range:
```ts
const parsedHops = Number(hopsParam);
setFilter("hops", Number.isFinite(parsedHops) && parsedHops >= 1 ? Math.floor(parsedHops) : 1);
```

### WR-04: KG inbound-focus effect lists deps it does not use and omits one it implicitly relies on

**File:** `src/pages/KnowledgeGraph.tsx:91-105`

**Issue:** The one-shot focus-override effect depends on `loading` (line 105) but reads `hydratedRef.current` (a ref, not reactive) for its gate. The effect's real trigger for "hydration just completed" is the *separate* effect at lines 84-89 that sets `hydratedRef.current = true` — but mutating a ref does **not** re-run this effect. So the override effect only re-evaluates when `loading`/`focusEntity`/`lensParam`/`hopsParam` change. It happens to work because `loading` flips `true→false` at hydration time and that flip re-runs the effect, at which point `hydratedRef.current` is already `true`. This is fragile coupling: the correctness depends on the ordering of two effects both keyed on `loading`, and `setLens`/`setFilter` are in the dep array but are stable `useCallback`s so they add nothing. If the hydration-tracking effect is ever reordered or `hydratedRef` is replaced with different timing, the focus override silently stops firing.

**Fix:** Promote hydration to state so the dependency is explicit and reactive, or gate directly on the `!loading` transition with a single effect. At minimum convert `hydratedRef` to a `useState` boolean and add it to the dep array so the relationship is visible to the linter and future readers.

## Info

### IN-01: unused `ChevronLeft` import

**File:** `src/components/kg/KGDetailsPanel.tsx:2`

**Issue:** `ChevronLeft` is imported from `lucide-react` at the top of the file. It is used (return chips at lines 152 and 211), so this is *not* unused — dropped. (Recorded here only to note it was checked.) The genuinely unused import is in `KnowledgeGraph.tsx:3`: `ChevronLeft` is imported but the return chip is rendered inside `KGDetailsPanel`, not in `KnowledgeGraph.tsx` — `ChevronLeft` is never referenced in that file.

**Fix:** Remove `ChevronLeft` from the `lucide-react` import in `src/pages/KnowledgeGraph.tsx:3`.

### IN-02: duplicated surface-label mapping across three files

**File:** `src/pages/ToolGalaxy.tsx:71-78`, `src/components/graph/CodeVaultGraph.tsx:194-201`, `src/pages/KnowledgeGraph.tsx:38-45`

**Issue:** Each surface re-implements the `fromPath → friendly label` mapping. ToolGalaxy and CodeVaultGraph use `startsWith`; KnowledgeGraph uses exact `===` on the split segment. The three label sets are identical in intent but the matching strategy diverges, which is a latent inconsistency (e.g. a future query-string-on-the-path edge case would behave differently in KG vs. the others).

**Fix:** Extract a single `surfaceLabelFromPath(fromUrl: string)` helper into `src/lib/focus-url.ts` (it is pure and framework-free, consistent with that module's charter) and consume it from all three surfaces.

---

**What I dropped and why:** I dropped a candidate finding that `getId`/`onFocus` inline arrows in `useFocusParam`'s effect deps (`useFocusParam.ts:68`) cause re-fire — they cannot, because the `appliedRef` one-shot guard (lines 58, 62) blocks any second application regardless of identity churn. I also dropped a "backslash bypass is an active open redirect" severity escalation — the current consumers all use React Router `navigate()` which treats the value as an in-app path, so it is a guard-hardening WARNING (WR-01), not a live BLOCKER.

---

_Reviewed: 2026-06-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
