# Phase 120 — Sanctioned Toast-Action Patterns

Written by Plan 120-03. Records patterns that resemble the POLISH-03 defect
(a destructive/command-dispatching decision carried by a toast) but are NOT
the defect, so a future sweep does not "fix" a legitimate pattern into a
dialog.

## D-13 — sanctioned toast-action patterns (do NOT convert)

### `src/components/brains/GlobalSwapModal.tsx` — "Revert global swap"

- **Location:** `handleDismiss()`, `src/components/brains/GlobalSwapModal.tsx:494-508`.
  The toast call is at lines 500-507; the action label is at line 502.
- **Verbatim action label:** `"Revert global swap"`
- **Verbatim call site (verified against live code, not transcribed from the plan):**

  ```ts
  function handleDismiss() {
    if (lastAction === "swap") {
      if (outcome.status === "error") {
        toast(`Swap to ${target.name} failed — ${outcome.reason}.`);
      } else {
        const verb = outcome.status === "confirmed" ? "switched" : "accepted, unconfirmed";
        toast(`All profiles ${verb} to ${target.name}.`, {
          action: {
            label: "Revert global swap",
            onClick: () => {
              void runRevert();
            },
          },
        });
      }
    } else if (outcome.status === "error") {
      ...
    }
    onOpenChange(false);
  }
  ```

- **Why it is sanctioned, not a defect:** `handleDismiss` only reaches the
  `"Revert global swap"` branch when `lastAction === "swap"` AND
  `outcome.status !== "error"` — i.e. the swap has already resolved to
  `"confirmed"` (server-pushed `swap.state` readback landed) or `"accepted,
  unconfirmed"` (the bounded `GLOBAL_SWAP_CONFIRM_TIMEOUT_MS` fallback fired
  without inventing a success claim). Both are POST-swap states. The toast
  fires when the operator dismisses the modal AFTER the swap has already
  completed, and its action is an **undo affordance** — it reverts a
  completed change — not a **pre-action gate** guarding a change that has not
  happened yet. POLISH-03's rule ("a destructive/dispatching action must be
  confirmed in a dialog, never a toast") governs pre-action gates; this is
  the opposite shape, so it does not apply.
- **A future sweep must leave this file alone.** `GlobalSwapModal.tsx` is
  explicitly excluded from Plan 120-03's `files_modified` and was not
  touched by this plan (`git diff --stat` for this plan's changes does not
  include it).
