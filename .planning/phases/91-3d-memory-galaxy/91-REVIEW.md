---
phase: 91-3d-memory-galaxy
reviewed: 2026-06-29T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/components/graph/CodeVaultGraph.tsx
  - src/components/graph/ForceGraph3D.tsx
  - src/lib/graph-center.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 91: Code Review Report

**Reviewed:** 2026-06-29
**Depth:** standard (per-file + cross-file for focus-param race; useFocusParam inspected as context)
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the three source files added/modified in Phase 91 (3D Memory Galaxy): `CodeVaultGraph.tsx` (toggle, idb persistence, lazy swap, 3D callbacks, ?focus= branch), `ForceGraph3D.tsx` (lazy Three.js wrapper + handle), and `graph-center.ts` (centerNode3DWhenReady).

SC#2 chunk isolation is sound — the `import { type ForceGraph3DHandle }` on line 41 is a TypeScript type-only import, erased at compile time (confirmed by Plan 04 build manifest: 0 three.js markers in all index chunks). The idb-keyval guard is well-constructed (synchronous try/catch + async .catch + cancelled unmount flag). The `colorFn3D`/`linkColorFn3D` are hex-only for Three.js. `graph-center.ts` is clean.

Two bugs found: a link-color misclassification in `linkColorFn3D` that activates after the d3 simulation mutates link endpoints, and a confirmed race condition that defeats 3D ?focus= centering when the user has "3d" stored in IDB. Two spec-compliance gaps noted at INFO level.

---

## Warnings

### WR-01: `linkColorFn3D` node-object branch uses `.source` field for vault detection — always false after simulation mutation

**File:** `src/components/graph/CodeVaultGraph.tsx:382-386`
**Confidence:** HIGH

**Evidence:**

```tsx
// lines 382-386 — linkColorFn3D vault detection when link.source is a node object
const srcIsVault = typeof link.source === "string"
  ? link.source.startsWith("vault:")
  : link.source?.source?.startsWith("vault:") ?? false;   // ← line 383: wrong field
const tgtIsVault = typeof link.target === "string"
  ? link.target.startsWith("vault:")
  : link.target?.source?.startsWith("vault:") ?? false;   // ← line 385: wrong field
```

The code comment at lines 103-111 (the `isVaultNode` declaration) explicitly documents why `.source.startsWith("vault:")` does not work on real node objects:

```tsx
// "astridr-repo"), NOT a prefixed string, so `source.startsWith("vault:")` never
// matches real data — it mis-colored the vault node green and made the Vault
// filter show 0 nodes (UAT-84). Node ids are reliably prefixed; use them.
function isVaultNode(node: { id?: string }): boolean {
  return node.id?.startsWith("vault:") ?? false;  // ← correct: use .id, not .source
}
```

The `node.source` field is a bare name (`"vault"`, `"codepulse"`), so `"vault".startsWith("vault:")` evaluates to `false`. When d3-force-3d mutates `link.source` from the string ID `"vault:Note.md"` to the node reference object, the object branch fires — and misclassifies every vault endpoint as non-vault. The result: after the simulation settles, vault↔vault links render as cross-source (muted white `#94a3b8`) instead of the vault hue from `colors.vaultNode`.

The same bug exists in the pre-existing `linkColorFn` (2D) at lines 196-200 and apparently slipped through UAT there (vault links are a minority of the graph). The 3D version inherits the same defect.

**Fix:**
```tsx
const srcIsVault = typeof link.source === "string"
  ? link.source.startsWith("vault:")
  : link.source?.id?.startsWith("vault:") ?? false;   // .id, not .source
const tgtIsVault = typeof link.target === "string"
  ? link.target.startsWith("vault:")
  : link.target?.id?.startsWith("vault:") ?? false;   // .id, not .source
```

Apply the same fix to the pre-existing `linkColorFn` (2D) at lines 196-200 for consistency.

---

### WR-02: `?focus=` 3D centering branch is unreachable when IDB resolves after the first focus effect fires

**File:** `src/components/graph/CodeVaultGraph.tsx:213-226` (onFocus callback), `140-161` (idb hydration effect)
**Confidence:** HIGH (confirmed by reading `useFocusParam`'s implementation)

**Evidence — the race:**

`onFocus` is a plain function literal (not `useCallback`), so it captures `renderMode` from its enclosing render's scope:

```tsx
// CodeVaultGraph.tsx lines 213-226
const { fromParam } = useFocusParam({
  nodes: snapshot.nodes,
  getId: (n) => n.id,
  onFocus: (node) => {
    setSelectedNodeId(node.id);
    if (renderMode === "2d") {               // ← closes over renderMode from *this* render
      centerNodeWhenReady(fgRef2d, ...);
    } else {
      centerNode3DWhenReady(fgRef3d, ...);
    }
  },
});
```

`useFocusParam`'s effect (src/hooks/useFocusParam.ts:54-68) includes `onFocus` in its dep array, and uses a one-shot `appliedRef`:

```ts
// useFocusParam.ts lines 54-68
useEffect(() => {
  if (!focusParam) return;
  if (appliedRef.current) return;           // ← one-shot guard
  if (nodes === undefined) return;
  appliedRef.current = true;
  const target = nodes.find(...);
  if (target) onFocus(target);
}, [focusParam, nodes, getId, onFocus]);    // ← onFocus in deps
```

Execution order on a page load with `?focus=X` and `"3d"` in IDB:

1. `GraphContent` renders: `renderMode = "2d"` (useState default); `onFocus` (v1) captures `"2d"`.
2. idb hydration effect starts: `idbGet(...)` returns a Promise — resolution is async.
3. `useFocusParam` effect fires: `nodes` is defined (GraphContent only renders when snapshot is non-null); `appliedRef.current = false`; calls `onFocus(v1)` → enters the `"2d"` branch; `centerNodeWhenReady(fgRef2d, ...)` runs on an unwired ref (3D graph isn't mounted yet); `appliedRef.current = true`.
4. IDB resolves: `setRenderMode("3d")` — component re-renders; new `onFocus` (v2) captures `"3d"`.
5. `useFocusParam` effect fires for v2: `appliedRef.current === true` → **exits immediately**.
6. `centerNode3DWhenReady` is **never called**.

Result: the node is selected (detail panel opens) but the 3D camera is not centered on the focus target. The 3D centering branch (`centerNode3DWhenReady`) is effectively dead code for this path.

**Fix:** Read `renderMode` from a ref instead of from the closure, so the call always uses the committed mode regardless of capture timing:

```tsx
// Add near the renderMode state declaration:
const renderModeRef = useRef<"2d" | "3d">("2d");
useEffect(() => {
  renderModeRef.current = renderMode;
}, [renderMode]);

// In the onFocus callback:
onFocus: (node) => {
  setSelectedNodeId(node.id);
  if (renderModeRef.current === "2d") {
    centerNodeWhenReady(fgRef2d, node as { x?: number; y?: number });
  } else {
    centerNode3DWhenReady(fgRef3d, node as { x?: number; y?: number; z?: number });
  }
},
```

---

## Info

### IN-01: 3D chip missing `disabled` state and loading class during lazy chunk load

**File:** `src/components/graph/CodeVaultGraph.tsx:549-564`
**Confidence:** HIGH

The UI-SPEC (D-04 Toggle State Machine and Chip Class Specification) requires the "3D" button to be `disabled` and receive the disabled chip class while the three.js chunk is loading. The implemented toggle tracks `renderMode` but not the chunk-loading state:

```tsx
// lines 549-564 — no disabled attribute; no loading-state tracking
<div role="group" aria-label="Render mode" className="flex items-center gap-1">
  <button className={renderModeChipClass("2d")} aria-pressed={renderMode === "2d"}
    onClick={() => handleModeToggle("2d")}>2D</button>
  <button className={renderModeChipClass("3d")} aria-pressed={renderMode === "3d"}
    onClick={() => handleModeToggle("3d")}>3D</button>
</div>
```

The spec's disabled chip class and `pointer-events-none` are absent. Functionally, clicking "3D" during load is harmless (it's already "3d" from the state toggle); the Suspense fallback text in the canvas provides loading feedback. But this is a spec non-compliance gap and may confuse keyboard/AT users who see an active-looking button during load.

**Fix:** Track chunk loading with `useTransition` or a separate boolean state; apply the disabled chip class and `disabled` attribute to the 3D button while loading.

---

### IN-02: Cancel return values from centering helpers discarded in `onFocus`

**File:** `src/components/graph/CodeVaultGraph.tsx:220, 223`
**Confidence:** HIGH

Both `centerNodeWhenReady` and `centerNode3DWhenReady` return cancel functions, but the caller discards them:

```tsx
// lines 219-224
if (renderMode === "2d") {
  centerNodeWhenReady(fgRef2d, node as { x?: number; y?: number });   // cancel discarded
} else {
  centerNode3DWhenReady(fgRef3d, node as { x?: number; y?: number; z?: number }); // cancel discarded
}
```

In the nominal path this is harmless: `useFocusParam` fires once (`appliedRef.current` guard), the ref is null after unmount (optional chaining makes the callbacks no-ops), and `maxFrames=90` bounds the polling loop. No crash or data corruption results.

The design intent of the cancel return — to abort a polling loop if the focus target changes or the component unmounts before coordinates are assigned — is not exercised here. If `useFocusParam`'s one-shot guard is ever relaxed, concurrent polling loops would accumulate silently.

**Fix:** Capture and invoke the cancel on component unmount or on a new focus call:

```tsx
const cancelRef = useRef<(() => void) | null>(null);
// In onFocus:
cancelRef.current?.();
if (renderModeRef.current === "2d") {
  cancelRef.current = centerNodeWhenReady(fgRef2d, node as { x?: number; y?: number });
} else {
  cancelRef.current = centerNode3DWhenReady(fgRef3d, node as { x?: number; y?: number; z?: number });
}
```

---

## What Was Dropped and Why

- **SC#2 type-import concern** (CodeVaultGraph.tsx:41 `import { type ForceGraph3DHandle }`): NOT a chunk-isolation issue. `type` keyword on the import specifier guarantees compile-time erasure (TS 4.5+, esbuild-supported). Plan 04 build manifest confirmed 0 three.js markers in all index chunks. Dropped.
- **ForceGraph3D.tsx no explicit useEffect WebGL disposal**: The library's `_destructor` runs automatically on unmount (RESEARCH Pattern 6). Plan 05 operator sign-off observed no accumulation across repeated toggles. I cannot prove a leak without a heap snapshot. Dropped.
- **`refresh()` may not re-apply colors to cached Three.js materials**: RESEARCH Open Question 1 — I can't confirm the runtime behavior without a running app. Plan 05 manual QA did not surface a visible color-state bug. Dropped (acknowledged as a deferred verification item in the plan).
- **`filteredData` link source/target mutation under source filter change**: Pre-existing before Phase 91; not introduced by these changes. Dropped.
- **`useEffect` at line 233 missing `snapshot.nodes` / `kg` deps**: Pre-existing eslint-disable comment from prior phase. Not a Phase 91 regression. Dropped.
- **`handleModeToggle` not `useCallback`**: Not a bug; the onClick lambdas in JSX create closures anyway. Code smell only. Dropped.

---

_Reviewed: 2026-06-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Resolution (execute-phase, 2026-06-29)

- **WR-01** — FIXED (commit `c53089f`): both 2D `linkColorFn` and 3D `linkColorFn3D` now use `link.source?.id` / `link.target?.id` (prefixed id), matching the documented `isVaultNode` contract. Vault↔vault links color correctly after d3 mutation.
- **WR-02** — FIXED (commit `655d71a`): `?focus=` one-shot is now gated on idb render-mode hydration (`focusReady`), so a persisted-3d deep-link takes the 3D centering branch. Two regression tests added (persisted-3d → 3D branch; default-2d → 2D branch).
- **IN-01** (3D chip `disabled` during lazy load) — ACCEPTED, not fixed: no functional breakage; the Suspense fallback provides loading feedback. Minor UI-SPEC polish; logged for a future pass.
- **IN-02** (discarded cancel return values) — ACCEPTED, not fixed: harmless under `useFocusParam`'s one-shot guard; documented for future hardening if the guard is relaxed.

Also fixed during the regression gate (pre-verification): `idb-keyval` synchronous `indexedDB`-open crash guard (commit `c729c18`) — restored `CodeVaultGraph.tooltip.test.tsx` to GREEN.
