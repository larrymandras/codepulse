---
phase: 92-voice-activated-command-palette-jarvis-mode
plan: "05"
subsystem: voice/shell
tags: [voice, mic-toggle, wake-word, dashboard-layout, tdd, privacy]
dependency_graph:
  requires:
    - "92-03 (useWakeWord: start/stop/status/errorReason/onWake)"
    - "92-04 (CommandPalette: voiceMode/voiceState/onVoiceClose props)"
  provides:
    - "src/components/MicToggle.tsx"
    - "src/components/ListeningIndicatorPill.tsx"
    - "src/layouts/DashboardLayout.tsx (voice engine wired)"
  affects:
    - "App smoke test (TooltipProvider required in header)"
tech_stack:
  added: []
  patterns:
    - "CrtToggle button shape adapted for MicToggle (three icon/className combos)"
    - "localStorage-persisted voiceModeEnabled state (codepulse-voice-mode, default false)"
    - "useWakeWord onWake callback opens palette in voice mode from anywhere"
    - "TooltipProvider added to header control group for MicToggle Tooltip"
    - "voiceMode state false on Cmd+K (keyboard = text mode; wake = voice mode)"
key_files:
  created:
    - src/components/MicToggle.tsx
    - src/components/MicToggle.test.tsx
    - src/components/ListeningIndicatorPill.tsx
  modified:
    - src/layouts/DashboardLayout.tsx
decisions:
  - "MicToggle wraps Tooltip in TooltipProvider at the header control group level, not inside the component, to match existing sidebar TooltipProvider scoping pattern"
  - "voiceMode state set to false on Cmd+K open to guarantee keyboard opens text mode (coexist criterion VOX-01)"
  - "ListeningIndicatorPill guarded by voiceModeEnabled && wakeWordStatus === 'ready' -- pill absent while loading or idle, never visible on error-disabled"
metrics:
  duration: 15min
  completed: "2026-06-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 92 Plan 05: DashboardLayout Voice Integration Summary

**One-liner:** OFF-by-default persisted MicToggle (three states + tooltip) + ListeningIndicatorPill wired into DashboardLayout header; useWakeWord wake event opens CommandPalette in voice mode from anywhere, coexisting with Cmd+K text mode; graceful error-disabled degradation with no crash and no silent hot mic.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 0 | TDD RED gate -- MicToggle test suite | `101f472` | src/components/MicToggle.test.tsx |
| 1 | MicToggle + ListeningIndicatorPill components (GREEN) | `72e1707` | MicToggle.tsx, MicToggle.test.tsx, ListeningIndicatorPill.tsx |
| 2 | Wire useWakeWord + toggle + pill + wake handler into DashboardLayout | `fd27727` | src/layouts/DashboardLayout.tsx |

TDD RED gate commit: `101f472`
TDD GREEN gate commit: `72e1707`

## What Was Built

### MicToggle.tsx

Three-state icon toggle button (w-9 h-9 rounded-md):
- **OFF** (enabled=false, non-error status): Mic h-4 w-4 text-muted-foreground, transparent bg + hover:bg-accent/50. aria-label: "Enable voice mode". Tooltip: "Voice mode -- say 'Hey Astrid'".
- **ON** (enabled=true, status=ready): MicVocal h-4 w-4 text-primary, bg-primary/10 border border-primary/30 shadow-[var(--glow-xs)]. aria-label: "Disable voice mode". Tooltip: "Voice mode active -- click to disable".
- **DISABLED** (status='error-disabled'): MicOff h-4 w-4 text-muted-foreground, opacity-40 cursor-not-allowed, disabled attribute set. aria-label: "Voice mode unavailable". Tooltip: "Voice mode unavailable: {errorReason}".

All states use only var(--primary) accent -- no hardcoded hex. Wrapped in shadcn Tooltip. onClick calls onToggle(!enabled) only when not disabled.

### ListeningIndicatorPill.tsx

VOICE ACTIVE pill visible only when mounted (parent guards with voiceModeEnabled && wakeWordStatus === 'ready'). Matches existing Telemetry pill pattern with py-1 (on-grid). voice-listening-dot class for the pulsing dot with prefers-reduced-motion override in src/index.css (from plan 92-04). sr-only aria-live="polite" span announces "Voice mode active, listening for Hey Astrid".

### DashboardLayout.tsx (additive)

New state/hook additions:
- `const [voiceMode, setVoiceMode] = useState(false)` -- whether palette opened in voice mode
- `const [voiceModeEnabled, setVoiceModeEnabled] = useState(...)` -- localStorage-persisted from key `codepulse-voice-mode`, default `false` (OFF by default, VOX-04 / D-06)
- `useWakeWord({ baseUrl:'/openwakeword', onWake: () => { setPaletteOpen(true); setVoiceMode(true); } })` -- returns wakeWordStatus, wakeWordErrorReason, wakeWordStart, wakeWordStop
- useEffect drives wakeWordStart() only when voiceModeEnabled && wakeWordStatus !== 'error-disabled'; otherwise calls wakeWordStop()

Header control group (additive, before EStopButton):
- ListeningIndicatorPill guarded: `{voiceModeEnabled && wakeWordStatus === 'ready' && <ListeningIndicatorPill />}`
- MicToggle with onToggle writing to localStorage
- TooltipProvider wrapping the header control group div

Keyboard handler: Cmd+K now calls `setVoiceMode(false)` before `setPaletteOpen` -- keyboard always opens text mode.

CommandPalette extended with voiceMode, voiceState ('listening' when voiceMode), onVoiceClose props. onOpenChange also clears voiceMode when palette closes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TooltipProvider missing for MicToggle in header context**
- **Found during:** Task 2 -- full test suite run (App.test.tsx smoke test failed: "Tooltip must be used within TooltipProvider")
- **Issue:** MicToggle uses Tooltip from shadcn Radix. The header control group was outside any TooltipProvider scope (existing TooltipProvider only wraps SidebarContent).
- **Fix:** Wrapped the header control group div in `<TooltipProvider delayDuration={300}>`, matching the SidebarContent pattern.
- **Files modified:** src/layouts/DashboardLayout.tsx
- **Commit:** fd27727

## TDD Gate Compliance

- RED: `101f472` -- test(92-05): add failing tests for MicToggle (RED gate)
- GREEN: `72e1707` -- feat(92-05): MicToggle (3 states + tooltip) + ListeningIndicatorPill (GREEN)
- REFACTOR: not needed -- clean on first GREEN pass.

## Known Stubs

None. All voice-mode data flows fully wired:
- useWakeWord is the real implementation from plan 92-03 (Worker + AudioWorklet + ONNX pipeline)
- CommandPalette voice props flow to the real VoiceModePanel from plan 92-04
- codepulse-voice-mode persists real operator preference to localStorage

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-92-14 mitigated | src/layouts/DashboardLayout.tsx | start() gated on voiceModeEnabled AND status !== 'error-disabled'; ListeningIndicatorPill only renders when ready; no silent mic |
| threat_flag: T-92-15 mitigated | src/layouts/DashboardLayout.tsx | error-disabled disables MicToggle with tooltip reason; engine never starts on failure |
| threat_flag: T-92-16 mitigated | src/components/MicToggle.tsx | Three-state toggle + persistent pill make listening state continuously observable |

## Self-Check: PASSED

Files verified:
- FOUND: src/components/MicToggle.tsx
- FOUND: src/components/MicToggle.test.tsx
- FOUND: src/components/ListeningIndicatorPill.tsx
- FOUND: src/layouts/DashboardLayout.tsx (modified)
- FOUND: .planning/phases/92-voice-activated-command-palette-jarvis-mode/92-05-SUMMARY.md

Commits verified:
- 101f472 -- test(92-05): add failing tests for MicToggle (RED gate)
- 72e1707 -- feat(92-05): MicToggle (3 states + tooltip) + ListeningIndicatorPill (GREEN)
- fd27727 -- feat(92-05): wire useWakeWord + MicToggle + ListeningIndicatorPill into DashboardLayout

Test results: 11/11 MicToggle tests GREEN; 1435/1435 full suite GREEN; tsc --noEmit: 0 errors.
No hardcoded hex in new component files. No Picovoice/COOP-COEP strings in DashboardLayout.
codepulse-voice-mode: read (line 543) + write (line 737) both present.
