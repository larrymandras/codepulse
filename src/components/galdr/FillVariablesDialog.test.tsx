/**
 * FillVariablesDialog — the one gate both Copy and Send-to-Chat pass through.
 *
 * Phase 116 (Galdr Prompt Library), plan 116-06 Task 1. Covers D-11 (Copy stays
 * disabled while any variable is unresolved) and the resolution half of D-12
 * (the string handed to the caller carries no surviving placeholder).
 *
 * The assertions deliberately land on the REAL button element's disabled state
 * and on the actual STRING the onSubmit spy received — not on internal state, and
 * not on a "did it look right" render check. A half-filled body reaching
 * Chat.tsx's autoSend handoff is answered by Ástríðr before anyone can correct it,
 * so the gate is the product here.
 */
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FillVariablesDialog } from "./FillVariablesDialog";

const TWO_VAR_BODY = "Draft a note for {{company}} about {{topic}} today.";

function renderDialog(
  overrides: Partial<React.ComponentProps<typeof FillVariablesDialog>> = {}
) {
  const onSubmit = vi.fn();
  const props: React.ComponentProps<typeof FillVariablesDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    promptTitle: "Outreach note",
    body: TWO_VAR_BODY,
    mode: "copy",
    onSubmit,
    ...overrides,
  };
  render(<FillVariablesDialog {...props} />);
  return { onSubmit, props };
}

function primaryButton(name: RegExp) {
  return screen.getByRole("button", { name });
}

function fill(variableName: string, value: string) {
  const input = screen.getByLabelText(variableName);
  act(() => {
    fireEvent.change(input, { target: { value } });
  });
}

describe("FillVariablesDialog — D-11 gate", () => {
  test("two variables, nothing filled: primary action disabled and helper text visible", () => {
    renderDialog();
    expect(primaryButton(/^copy$/i)).toBeDisabled();
    expect(
      screen.getByText("Fill in every variable to enable Copy.")
    ).toBeInTheDocument();
  });

  test("one of two filled: still disabled", () => {
    renderDialog();
    fill("company", "ProtectAll");
    expect(primaryButton(/^copy$/i)).toBeDisabled();
  });

  test("both filled: enabled and the helper text is gone", () => {
    renderDialog();
    fill("company", "ProtectAll");
    fill("topic", "renewals");
    expect(primaryButton(/^copy$/i)).not.toBeDisabled();
    expect(
      screen.queryByText("Fill in every variable to enable Copy.")
    ).toBeNull();
  });

  test("a whitespace-only value does not count as resolved", () => {
    renderDialog();
    fill("company", "ProtectAll");
    fill("topic", "   ");
    expect(primaryButton(/^copy$/i)).toBeDisabled();
  });

  test("chat mode uses the Send label and its own helper text", () => {
    renderDialog({ mode: "chat" });
    expect(primaryButton(/send to chat/i)).toBeDisabled();
    expect(
      screen.getByText("Fill in every variable to enable Send.")
    ).toBeInTheDocument();
  });
});

describe("FillVariablesDialog — submission payload (D-12)", () => {
  test("clicking the enabled action submits a fully substituted body with no surviving placeholder", () => {
    const { onSubmit } = renderDialog();
    fill("company", "ProtectAll");
    fill("topic", "renewals");

    act(() => {
      fireEvent.click(primaryButton(/^copy$/i));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const received = onSubmit.mock.calls[0][0] as string;
    expect(received).toBe("Draft a note for ProtectAll about renewals today.");
    expect(received).not.toContain("{{");
  });

  test("a disabled action cannot submit — the negative control for the test above", () => {
    const { onSubmit } = renderDialog();
    fill("company", "ProtectAll");

    act(() => {
      fireEvent.click(primaryButton(/^copy$/i));
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("zero-variable body is the vacuous-truth case: no fields, action enabled immediately", () => {
    const { onSubmit } = renderDialog({ body: "A prompt with no variables." });

    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(primaryButton(/^copy$/i)).not.toBeDisabled();

    act(() => {
      fireEvent.click(primaryButton(/^copy$/i));
    });
    expect(onSubmit).toHaveBeenCalledWith("A prompt with no variables.");
  });
});

describe("FillVariablesDialog — preview", () => {
  test("the preview substitutes filled values and leaves unfilled placeholders visible", () => {
    renderDialog();
    fill("company", "ProtectAll");

    const preview = screen.getByTestId("galdr-variable-preview");
    expect(preview.textContent).toContain("ProtectAll");
    // topic is still unresolved, so its placeholder survives in the preview.
    expect(preview.textContent).toContain("{{topic}}");
  });
});
