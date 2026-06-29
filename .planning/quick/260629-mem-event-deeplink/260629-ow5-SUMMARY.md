---
quick_id: 260629-ow5
slug: memory-event-deeplink
status: complete
date: 2026-06-29
code_commit: 58b999f
---

# Quick Task 260629-ow5 — Summary

**Done:** Closed the last real gap in the "extend deep-links to the newer
surfaces" parked work — Memory now honors `?event=`.

## What the investigation found
- **Capabilities** — already reads `?try=` from CommandPalette. No work.
- **Hive** — no inbound deep-link, no consumer. Deferred (speculative).
- **Memory** — KGDetailsPanel provenance links navigate to
  `/memory?event=<id>` but Memory ignored the param → dead link. Fixed here.

## Changes
- `src/pages/Memory.tsx` — `useSearchParams` reads `?event=`; forces the inner
  `timeline` tab; each timeline event gets `data-event-id` + `data-focused`;
  the matched event is highlighted (indigo ring/border) and `scrollIntoView`'d.
  Graceful no-op if the event isn't in the loaded timeline window.
- `src/pages/Memory.test.tsx` — **new** (Memory had no tests): asserts
  `?event=evt-2` focuses evt-2 + scrolls, and no focus without the param.

## Verification
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → **1491 passed, 0 failed** (+2 tests, new file).

## Result
The KG fact → "memory" provenance link now lands on and highlights the exact
episodic event. Combined with the reverse cross-graph links (260629-oki), the
graph surfaces are fully cross-navigable where a real data path exists.

## Out of scope / deferred
- Hive `?goal=` deep-link — no consumer; would be speculative.
- Branch: `quick/260629-mem-event-deeplink`.
