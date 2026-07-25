# Deferred Items — Phase 100 (Control-Surface UX)

Out-of-scope discoveries logged during execution, not fixed (per executor scope boundary — only issues directly caused by the current task's changes are auto-fixed).

## 100-05

- **`src/pages/Inbox.tsx` TS7006 errors (4x, lines 298/299/393/394)** — surfaced by `npx tsc --noEmit` while executing 100-05 Task 2. Caused by a concurrent unrelated session's in-progress edit to `src/components/InboxFilterBar.tsx`/`src/pages/Inbox.tsx` (unrelated phase 186-01 voice-debug work, per STATE.md's noted concurrent-session pattern). Not touched by any 100-05 task file. Left unstaged/uncommitted by this executor — belongs to the other session to fix or commit.
