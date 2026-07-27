# Bug: Forge page shows completed lifecycle commands as permanent "Queued…" cards

**Found:** 2026-07-26 · **Severity:** cosmetic/UX (no data loss, daemon healthy) · **Confidence:** high
**Repo:** codepulse (frontend) — NOT forge, NOT the daemon.

## Symptom
The Forge page (`/forge`) shows a growing stack of blue **"Queued…"** cards (each with a `<>` icon, host `LMOFFICE…`, "—", "Just now") that never clear, plus a red "Archive failed: …" card. Looks like a flooded/stuck queue.

## Reality
Nothing is stuck. Live local Convex backend (which the page reads):
- 24 `forgeCommands`: **20 lifecycle**, 4 launch. Statuses: `lifecycle:done ×18`, `lifecycle:failed ×1`, `lifecycle:expired ×1`, `launch:done ×4`.
- All 4 launch commands have `resolvedForgeJobId` set → reconcile away correctly.
- **18 `lifecycle:done` commands render as permanent "Queued…" cards** = the visible stack.
- The red "Archive failed: test-driven-development…" is a *separate, benign* real event (skill already gone: "no longer exists at its source location… Nothing changed on disk"). Correctly shown as failed.

## Root cause (three cooperating facts)
1. `src/hooks/useForge.ts:205` — `useForgeCommands` subscribes to `api.forge.listForgeCommands`, which returns **all** command types with **no `commandType` filter**. `adaptCommand` maps every row, even though `ForgeCommandRow.commandType` is typed `"launch" | "stop"` (the type lies; lifecycle/intake leak in at runtime).
2. `src/hooks/useForge.ts:120` — `mapCommandStatus` maps **`done` → `"pending"`** → `ForgeJobList`/`PendingRow` render the blue **"Queued…"** badge. (`PendingRow` also hardcodes the literal **"Just now"** at `src/components/forge/ForgeJobList.tsx:125`, so age is meaningless — it misleads toward "fresh flood".)
3. `src/components/forge/ForgeJobList.tsx:64` — `visiblePendingRows` drops a pending row only when `resolvedForgeJobId != null && matching job exists`. **Lifecycle/intake commands never create a `forgeJob`**, so `resolvedForgeJobId` stays null → **never reconciled away**. One permanent card accumulates per skill archive/restore/intake, forever.

## Ruled out
Queue flood (0 genuinely-queued), dead daemon (PID alive, polling `/forge-commands-claim` every 7s), cloud/local split-brain (the failed-archive card lives only in local DB *and* shows on the page → page reads local), re-enqueue loop (the archive-fail changed nothing and was not retried).

## Fix
Filter the pending-command list feeding the job UI to `commandType === "launch"` (the only type that becomes a job and reconciles). Lifecycle & intake already have dedicated surfaces (`listLifecycleCommands` / `listIntakeCommands`) and must not render in the job list. Smallest change: filter in `useForgeCommands`'s `raw.map(adaptCommand)` (or in ForgePage's merge). Add a regression test: a `done` lifecycle command produces **no** pending row. Consider also making `mapCommandStatus` not map `done → pending` for defense-in-depth.

## Repro / evidence commands
```
cd /c/Users/mandr/codepulse
ADMIN_KEY=$(docker exec convex-backend ./generate_admin_key.sh)
npx convex run forge:listForgeCommands '{}' --url http://127.0.0.1:3210 --admin-key "$ADMIN_KEY"
# -> 20 lifecycle / 4 launch; 18 lifecycle:done with resolvedForgeJobId=null are the stuck cards
```
