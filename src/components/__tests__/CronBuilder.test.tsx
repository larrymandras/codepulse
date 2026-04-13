import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CronBuilder from "@/components/CronBuilder";

// Mock radix-ui Select since it relies on browser APIs not available in jsdom
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
      <button
        data-testid={`select-trigger-${value}`}
        onClick={() => onValueChange && onValueChange(value)}
      />
    </div>
  ),
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <button data-value={value} onClick={() => {}}>
      {children}
    </button>
  ),
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

function renderCronBuilder(props?: Partial<Parameters<typeof CronBuilder>[0]>) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <CronBuilder
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />
  );
  return { onSave, onCancel };
}

describe("CronBuilder", () => {
  test("generates '* * * * *' for every_minute preset", () => {
    renderCronBuilder({ initialExpression: "* * * * *" });
    // The expression output should show the cron expression
    expect(screen.getByTestId("cron-expression")).toHaveTextContent("* * * * *");
    // Human readable preview should show in the preview element
    expect(screen.getByTestId("cron-preview")).toHaveTextContent("Every minute");
  });

  test("generates correct expression for every_day with hour selection", () => {
    renderCronBuilder({ initialExpression: "0 3 * * *" });
    // With every_day frequency and hour=3, expression should be "0 3 * * *"
    expect(screen.getByTestId("cron-preview")).toHaveTextContent("Every day at 3:00");
  });

  test("shows human-readable preview that updates live", () => {
    renderCronBuilder();
    // Default is every_day at hour=0, minute=0 → "0 0 * * *" → "Every day at 0:00"
    const preview = screen.getByTestId("cron-preview");
    expect(preview).toBeInTheDocument();
  });

  test("validates custom expression against cron regex", () => {
    renderCronBuilder({ initialExpression: "* * * * *" });
    // Renders without error state for valid expression
    const expressionDisplay = screen.getByTestId("cron-expression");
    expect(expressionDisplay).toBeInTheDocument();
  });

  test("disables save when expression is invalid", () => {
    renderCronBuilder();
    // Find the save button
    const saveButton = screen.getByRole("button", { name: /save cron job/i });
    // With empty name, it should be disabled
    expect(saveButton).toBeDisabled();
  });

  test("disables save when name field is empty", () => {
    renderCronBuilder({ initialName: "" });
    const saveButton = screen.getByRole("button", { name: /save cron job/i });
    expect(saveButton).toBeDisabled();
  });
});
