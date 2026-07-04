# Phase 91: 3D Memory Galaxy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 91-3d-memory-galaxy
**Areas discussed:** 3D↔2D interaction parity, 3D visual treatment, performance fallback posture, toggle UI

---

## 3D ↔ 2D Interaction Parity

| Option | Description | Selected |
|--------|-------------|----------|
| Full parity | 3D reuses the same `GraphContent` shell — detail panel, source filter, fullscreen, focus param, KG links all work identically. Only the render surface swaps. | ✓ |
| Core parity | Keep node-click → detail panel + source filter + fullscreen. Drop the heavier `?focus` deep-link / KG-cross-link wiring in 3D. | |
| Immersive/minimal | 3D is a stripped 'explore' surface: node-click + light tooltip, no source filter or cross-graph plumbing. | |

**User's choice:** Full parity
**Notes:** Treat 2D/3D as one surface, two render modes. Implication captured in CONTEXT D-01a/D-01b: parity is about the interaction shell, not paint primitives — the 2D canvas `paintNode` (selection ring + community halo) and `fgRef` zoom/center helpers don't translate 1:1; the 3D path needs library-native encoding (`nodeColor`/`nodeVal`) and `cameraPosition`-based centering.

---

## 3D Visual Treatment (primary FPS lever at ~4,038 nodes)

| Option | Description | Selected |
|--------|-------------|----------|
| Spheres + hover labels | Theme-colored spheres; labels only on hover (`nodeLabel`); thin links. Cheapest to hit ≥30 FPS. | ✓ |
| Spheres + on-demand labels | Spheres + labels for selected/neighbor nodes only; links visible. Slightly richer. | |
| Always-on text sprites | Every node renders a text sprite — most readable but the #1 FPS killer at 4k nodes; risks missing the 30 FPS gate. | |

**User's choice:** Spheres + hover labels
**Notes:** Keep the dark-space backdrop consistent with the 2D surface so both modes feel unified.

---

## Performance Fallback Posture

| Option | Description | Selected |
|--------|-------------|----------|
| Ship opt-in, no fallback | Opt-in mode — accept slower on weak GPUs. Benchmark on the operator's machine to confirm ≥30 FPS; build no runtime degradation. | ✓ |
| Auto-degrade | On low measured FPS, reduce cost at runtime (hide links, freeze sim, drop labels). | |
| Warn + let user choose | Detect low FPS and surface a one-time "this device may struggle" notice. | |

**User's choice:** Ship opt-in, no fallback
**Notes:** ≥30 FPS (SC#3) verified once, manually, against the live ~4,038-node `graphSnapshots` snapshot — a plan checkpoint, not shipped UI. Clean WebGL disposal on toggle (SC#4) remains mandatory regardless (correctness, not perf-degradation).

---

## Toggle UI

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented 2D\|3D control | Small segmented control in the header's right cluster next to fullscreen, matching the Code/Vault/Both chip pattern. | ✓ |
| Icon toggle button | Single ghost icon button (cube/box) beside fullscreen that flips modes. | |
| Labeled switch | A labeled toggle/switch ('3D') in the header. | |

**User's choice:** Segmented 2D|3D control
**Notes:** Reuse the existing `chipClass` pattern (`aria-pressed`, `role="group"`) for consistency and discoverability.

---

## Claude's Discretion

- `react-force-graph-3d` prop tuning (`cooldownTicks`, `warmupTicks`, `nodeResolution`, `linkOpacity`, sphere radius) to hit ≥30 FPS — determined empirically against the live snapshot.
- Internal structure of the render-surface swap (lifting a `renderMode` state into `GraphContent`).
- Where the `idb-keyval` toggle persistence is wired (hook vs inline effect).

## Deferred Ideas

- R3F (`@react-three/fiber` + `drei`) render path — out of scope for v9.0.
- 3D post-processing (bloom/glow) — needs R3F; deferred.
- 3D community-cluster bubbles + node-size-by-degree — deferred.
- Dedicated immersive 3D page/route — explicitly rejected (3D is a mode, not a surface).
- Runtime performance auto-degradation / low-FPS warning — considered and declined.
