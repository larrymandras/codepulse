/**
 * DeleteSkillDialog test (Phase 98, LIFE-04 / D-06) — jsdom render assertions.
 *
 * Asserts the type-to-confirm gate contract:
 *  - Destructive button disabled until an exact, case-sensitive, trimmed
 *    match against skillName
 *  - No pre-fill (initial confirmText is empty)
 *  - Confirm calls enqueueLifecycle with action:"delete", destination:"cold"
 *  - Title/body/placeholder/button copy match the verbatim Copywriting
 *    Contract
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { toast } from "sonner";
import { useMutation } from "convex/react";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => vi.fn()),
}));

import { DeleteSkillDialog } from "./DeleteSkillDialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof DeleteSkillDialog>> = {}) {
  const onOpenChange = vi.fn();
  const utils = render(
    <DeleteSkillDialog
      skillName="legal"
      sourceOrigin="claude-code:available"
      hostId="desktop"
      open={true}
      onOpenChange={onOpenChange}
      {...overrides}
    />
  );
  return { ...utils, onOpenChange };
}

function getDeleteButton() {
  return screen.getByRole("button", { name: "Delete Permanently" });
}

function getConfirmInput() {
  return screen.getByPlaceholderText('Type "legal" to confirm');
}

describe("DeleteSkillDialog", () => {
  let enqueueLifecycleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    enqueueLifecycleMock = vi.fn(() => Promise.resolve());
    vi.mocked(useMutation).mockReturnValue(
      enqueueLifecycleMock as unknown as ReturnType<typeof useMutation>
    );
  });

  it("renders the verbatim title, body, and placeholder copy", () => {
    renderDialog();
    expect(
      screen.getByText('Delete "legal" permanently?')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This removes the file from disk. There is no undo and no git history for .claude/ — type the skill name to confirm."
      )
    ).toBeInTheDocument();
    expect(getConfirmInput()).toBeInTheDocument();
  });

  it("appends the active-copy-unaffected line when shadowed (D-05 target-scoped, WR-04)", () => {
    renderDialog({ shadowed: true });
    expect(
      screen.getByText(/The active copy of this skill is not affected/)
    ).toBeInTheDocument();
  });

  it("omits the active-copy-unaffected line by default (not shadowed)", () => {
    renderDialog();
    expect(
      screen.queryByText(/The active copy of this skill is not affected/)
    ).not.toBeInTheDocument();
  });

  it("renders 'Delete Permanently' and default 'Cancel' buttons", () => {
    renderDialog();
    expect(getDeleteButton()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("is not pre-filled — the input starts empty", () => {
    renderDialog();
    expect(getConfirmInput()).toHaveValue("");
  });

  it("keeps the destructive button disabled when the input is empty", () => {
    renderDialog();
    expect(getDeleteButton()).toBeDisabled();
  });

  it("keeps the destructive button disabled on a partial match", () => {
    renderDialog();
    fireEvent.change(getConfirmInput(), { target: { value: "leg" } });
    expect(getDeleteButton()).toBeDisabled();
  });

  it("keeps the destructive button disabled on a case-mismatched match (no case-fold)", () => {
    renderDialog();
    fireEvent.change(getConfirmInput(), { target: { value: "Legal" } });
    expect(getDeleteButton()).toBeDisabled();
  });

  it("enables the destructive button on an exact, trimmed match", () => {
    renderDialog();
    fireEvent.change(getConfirmInput(), { target: { value: "  legal  " } });
    expect(getDeleteButton()).not.toBeDisabled();
  });

  it("enables the destructive button on an exact match with no surrounding whitespace", () => {
    renderDialog();
    fireEvent.change(getConfirmInput(), { target: { value: "legal" } });
    expect(getDeleteButton()).not.toBeDisabled();
  });

  it("calls enqueueLifecycle with action delete, destination cold, and sourceOrigin on confirm", async () => {
    renderDialog({ skillName: "legal", sourceOrigin: "claude-code:available" });
    fireEvent.change(getConfirmInput(), { target: { value: "legal" } });
    fireEvent.click(getDeleteButton());

    await waitFor(() => expect(enqueueLifecycleMock).toHaveBeenCalledTimes(1));
    const args = enqueueLifecycleMock.mock.calls[0][0];
    expect(args).toMatchObject({
      hostId: "desktop",
      action: "delete",
      skillName: "legal",
      sourceOrigin: "claude-code:available",
      destination: "cold",
      workspaceId: null,
    });
    expect(typeof args.commandId).toBe("string");
    expect(args.commandId.length).toBeGreaterThan(0);
  });

  it("closes the dialog (onOpenChange(false)) after a successful confirm", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(getConfirmInput(), { target: { value: "legal" } });
    fireEvent.click(getDeleteButton());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the dialog open and toasts the stripped refusal when enqueueLifecycle rejects (98-REVIEW CR-03)", async () => {
    enqueueLifecycleMock.mockReturnValue(
      Promise.reject(
        new Error("lifecycle-refused:not-cold:skill exists outside cold storage")
      )
    );
    const { onOpenChange } = renderDialog();
    fireEvent.change(getConfirmInput(), { target: { value: "legal" } });
    fireEvent.click(getDeleteButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("skill exists outside cold storage")
    );
    // Neither our success path nor Radix's Action auto-close may close it.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("does not call enqueueLifecycle when the destructive button is clicked while disabled", () => {
    renderDialog();
    fireEvent.click(getDeleteButton());
    expect(enqueueLifecycleMock).not.toHaveBeenCalled();
  });

  it("does not call enqueueLifecycle when Cancel is clicked", () => {
    renderDialog();
    fireEvent.change(getConfirmInput(), { target: { value: "legal" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(enqueueLifecycleMock).not.toHaveBeenCalled();
  });

  it("resets the confirm text each time the dialog re-opens", () => {
    const { rerender } = render(
      <DeleteSkillDialog
        skillName="legal"
        sourceOrigin="claude-code:available"
        hostId="desktop"
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    fireEvent.change(getConfirmInput(), { target: { value: "legal" } });
    expect(getDeleteButton()).not.toBeDisabled();

    rerender(
      <DeleteSkillDialog
        skillName="legal"
        sourceOrigin="claude-code:available"
        hostId="desktop"
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    rerender(
      <DeleteSkillDialog
        skillName="legal"
        sourceOrigin="claude-code:available"
        hostId="desktop"
        open={true}
        onOpenChange={vi.fn()}
      />
    );
    expect(getConfirmInput()).toHaveValue("");
    expect(getDeleteButton()).toBeDisabled();
  });
});
