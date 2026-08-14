---
created: 2026-08-14
source: 114-11-PLAN.md Task 1 step 4 (operator checkpoint, D-18)
phase_origin: 114
owning_code: Clerk integration (src/main.tsx ClerkProvider), NOT the workspace map
priority: low
type: unexamined-observation
---

# Chrome bounce-tracking notice for `accounts.dev`, plus the Clerk dev-keys warning

Recorded at the Phase 114 operator checkpoint (2026-08-14) on `localhost:5173/workspace-map`,
in an **incognito window with extensions disabled** — so this is not extension noise. Filed
here rather than fixed, because D-18's rule is that a finding is filed against the phase
owning the offending code, and this is the Clerk integration, not the workspace map.

## What is actually known — verbatim

DevTools **Issues** tab, the single genuine entry:

> **Chrome may soon delete state for intermediate websites in a recent navigation chain**
>
> In a recent navigation chain, one or more websites without prior user interaction were
> visited. If these websites don't get such an interaction soon, Chrome will delete their
> state.
>
> **AFFECTED RESOURCES**
> 1 potentially tracking website
> `accounts.dev`
>
> *Learn more: Bounce tracking mitigations*

DevTools **Console**, the single warning:

> `Clerk: Clerk has been loaded with development keys. Development instances have strict
> usage limits and should not be used when deploying your application to production.`
> — `clerk.browser.js:19`

Control that establishes these are ours and not an extension's:

| Measurement | Normal window | Incognito (extensions off) |
|---|---|---|
| Console errors | 3 | No errors |
| Issues | 3 | 1 (the entry above) |

The 3 console errors present in the normal window were all
`A listener indicated an asynchronous response by returning true, but the message channel
closed before a response was received` — extension-emitted, and separately ruled out as ours
by a control-paired grep showing this repo contains zero references to `chrome.runtime`,
`browser.runtime`, `runtime.sendMessage` or `.onMessage`.

## What is NOT known

- **Whether this has any practical consequence for auth.** `accounts.dev` is Clerk's
  dev-instance domain. Chrome's bounce-tracking mitigation deletes state for sites visited in
  a navigation chain without direct user interaction. Whether that would actually disrupt a
  Clerk session here — and whether it applies at all to a production Clerk instance on a
  custom domain rather than a dev instance on `accounts.dev` — was **not** investigated. Do
  not assume either way; the checkpoint's scope was to record, not to diagnose.
- **Whether the dev-keys warning matters.** It is the expected notice for a development Clerk
  instance and was already present at the Phase 111 checkpoint. It is only actionable if
  CodePulse is ever deployed somewhere real with those keys still in place.

## Why this is not a Phase 114 item

Neither entry names the workspace map, and neither reproduces from anything Phase 114 built.
The workspace map surfaced them only because it is the page that happened to be open. Phase
114's D-18 step exists to convert an unread badge into a recorded fact, which it has done.

## How to close it

1. Decide whether CodePulse will ever run with a production Clerk instance. If it stays a
   tailnet-local dev tool, both entries are accepted-by-design and this file can be closed
   with that reason recorded.
2. If a production instance is ever wanted, re-check the bounce-tracking notice against the
   custom domain rather than `accounts.dev` — the finding may not survive the move, and
   assuming it does (or does not) without re-measuring would repeat the mistake the Phase 111
   todo was written to prevent.

Related: `.planning/todos/completed/111-devtools-issues-panel-entry-unexamined.md`, which this
finding closed. That file declined to guess the unopened Phase 111 badge was Clerk-related;
the guess proved correct, but it is now measured rather than assumed.
