---
phase: 06-alert-routing
plan: 04
subsystem: frontend
tags: [react, convex, settings, webhook-config, notification-preferences, ui]

requires:
  - phase: 06-alert-routing/06-02
    provides: agentConfigs key-value store, alert lifecycle backend
  - phase: 06-alert-routing/06-03
    provides: webhookDelivery.ts with internalQuery/internalAction helpers, delivery engine

provides:
  - getChannels public query (Discord + Slack webhook URLs from agentConfigs)
  - setChannel public mutation with https:// validation (T-06-09 SSRF mitigation)
  - removeChannel public mutation for clearing stored webhook URLs
  - testWebhook public action (sends Discord embed / Slack Block Kit test message)
  - getPreferences public query with defaults (critical/error: always, warning: digest, info: dashboard_only)
  - setPreferences public mutation with delivery mode validation (always/digest/dashboard_only/disabled)
  - NotificationChannels component with URL inputs, Send Test buttons, status dots, masked URL display
  - NotificationPreferences component with per-severity delivery mode selects and Save button
  - Settings page wired with both new sections appended after existing content

affects: [06-alert-routing plan 05 (any further Settings extensions)]

tech-stack:
  added: []
  patterns:
    - "Convex public query/mutation/action for Settings UI (vs internalQuery/internalMutation for backend-only helpers)"
    - "URL masking (last 8 chars) for stored webhook URLs — T-06-10 information disclosure mitigation"
    - "Inline remove confirm (no dialog) per UI-SPEC copywriting contract"
    - "useAction hook for testWebhook (Convex actions support outbound HTTP)"
    - "useEffect to sync server state into local React state for preference selects"

key-files:
  created:
    - src/components/NotificationChannels.tsx
    - src/components/NotificationPreferences.tsx
  modified:
    - convex/webhookDelivery.ts
    - src/pages/Settings.tsx
    - convex/__tests__/notificationPrefs.test.ts

key-decisions:
  - "Public query/mutation/action wrappers added to webhookDelivery.ts rather than a separate module — keeps all webhook config logic co-located"
  - "URL masking (last 8 chars) on stored URLs implements T-06-10 threat mitigation without hiding the URL structure entirely"
  - "testWebhook as public action (not mutation) since Convex actions allow outbound HTTP fetch calls"
  - "setPreferences validates each delivery mode value server-side — client UI also constrains via Select options but server validation is authoritative"

requirements-completed: [ALR-05]

duration: 12min
completed: 2026-04-14
---

# Phase 06 Plan 04: Settings UI — Notification Channels + Notification Preferences Summary

**Two new Settings sections wired with full Convex persistence: webhook URL configuration with Send Test buttons and masked display, and per-severity delivery mode selects backed by six new public queries/mutations/actions in webhookDelivery.ts**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-14T16:07:00Z
- **Completed:** 2026-04-14T16:19:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added 6 public exports to `convex/webhookDelivery.ts`: `getChannels`, `setChannel`, `removeChannel`, `testWebhook`, `getPreferences`, `setPreferences` — all backed by `agentConfigs` table with proper upsert logic
- Created `src/components/NotificationChannels.tsx` — Discord and Slack webhook URL inputs with font-mono display, masked stored URLs (last 8 chars per T-06-10), status dots (green/red), Send Test button with Loader2 spinner, inline remove confirm, auto-save on blur/Enter
- Created `src/components/NotificationPreferences.tsx` — 4 severity rows with color-coded badges (red/orange/yellow/blue per UI-SPEC) and shadcn Select with 4 delivery modes, Save Preferences primary button with loading/saved states
- Wired both components into `src/pages/Settings.tsx` with `SectionErrorBoundary` wrappers and 48px (mt-12) spacing per UI-SPEC gap-2xl
- Filled 10 passing import-verification tests in `convex/__tests__/notificationPrefs.test.ts`

## Task Commits

1. **Task 1: NotificationChannels component + backend queries** - `fefd20e` (feat)
2. **Task 2: NotificationPreferences component + Settings page wiring** - `54d25ae` (feat)

## Files Created/Modified

- `convex/webhookDelivery.ts` — 6 new public exports prepended: getChannels, setChannel, removeChannel, testWebhook, getPreferences, setPreferences
- `src/components/NotificationChannels.tsx` — Webhook URL configuration UI (created)
- `src/components/NotificationPreferences.tsx` — Per-severity delivery mode selects (created)
- `src/pages/Settings.tsx` — NotificationChannels and NotificationPreferences imported and appended
- `convex/__tests__/notificationPrefs.test.ts` — 10 passing import-verification tests (replaced stubs)

## Decisions Made

- Public query/mutation/action wrappers added to `webhookDelivery.ts` co-located with the delivery engine rather than a separate `webhookConfig.ts` module — avoids cross-module coupling
- URL masking shows only last 8 chars of stored URLs after save; full URL revealed on input focus — implements T-06-10 threat mitigation
- `testWebhook` implemented as a public `action` (not mutation) since Convex requires actions for outbound HTTP fetch calls
- Server-side validation in `setPreferences` is authoritative; client Select options constrain UX but do not replace server checks

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — all exported functions and UI components are fully implemented and wired.

## Threat Flags

No new threat surface beyond what was already in the plan's threat model:
- T-06-09 (SSRF via setChannel): mitigated — https:// validation in setChannel mutation
- T-06-10 (webhook URL disclosure): mitigated — URL masking in NotificationChannels component

## Self-Check: PASSED

- src/components/NotificationChannels.tsx — FOUND
- src/components/NotificationPreferences.tsx — FOUND
- convex/webhookDelivery.ts (getChannels, setChannel, removeChannel, testWebhook, getPreferences, setPreferences) — FOUND
- src/pages/Settings.tsx (NotificationChannels import, NotificationPreferences import) — FOUND
- convex/__tests__/notificationPrefs.test.ts (10 tests passing) — PASSED
- Commit fefd20e (Task 1) — FOUND
- Commit 54d25ae (Task 2) — FOUND
- npx tsc --noEmit — exits 0
- npx vitest run notificationPrefs.test.ts — 10 passed

---
*Phase: 06-alert-routing*
*Completed: 2026-04-14*
