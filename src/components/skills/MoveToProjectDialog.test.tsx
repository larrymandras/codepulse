/**
 * MoveToProjectDialog test (Phase 98, LIFE-03) — jsdom render assertions.
 *
 * Mocks convex/react (useQuery/useMutation) and the shadcn Select primitive
 * wholesale, following IntakeModal.test.tsx's established convention (Radix
 * Select's portal/pointer-capture behavior is not implemented in jsdom).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContext, useContext } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

interface SelectCtxValue {
  onValueChange?: (v: string) => void;
}
const SelectCtx = createContext<SelectCtxValue>({});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <SelectCtx.Provider value={{ onValueChange }}>
      <div data-testid="select-root" data-value={value}>
        {children}
      </div>
    </SelectCtx.Provider>
  ),
  SelectTrigger: ({
    children,
    id,
    ...props
  }: {
    children: React.ReactNode;
    id?: string;
    [key: string]: unknown;
  }) => (
    <button
      type="button"
      id={id}
      data-testid={`select-trigger-${id ?? "select"}`}
      {...props}
    >
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    disabled?: boolean;
  }) => {
    const { onValueChange } = useContext(SelectCtx);
    return (
      <button
        type="button"
        data-testid={`select-item-${value}`}
        disabled={disabled}
        onClick={() => onValueChange?.(value)}
      >
        {children}
      </button>
    );
  },
}));

import { MoveToProjectDialog } from "./MoveToProjectDialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof MoveToProjectDialog>> = {}) {
  const onOpenChange = vi.fn();
  const utils = render(
    <MoveToProjectDialog
      skillName="legal"
      sourceOrigin="claude-code"
      hostId="desktop"
      open={true}
      onOpenChange={onOpenChange}
      {...overrides}
    />
  );
  return { ...utils, onOpenChange };
}

function getMoveButton() {
  return screen.getByRole("button", { name: "Move skill" });
}

describe("MoveToProjectDialog", () => {
  let enqueueLifecycleMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    enqueueLifecycleMock = vi.fn(() => Promise.resolve());
    vi.mocked(useMutation).mockReturnValue(
      enqueueLifecycleMock as unknown as ReturnType<typeof useMutation>
    );
    vi.mocked(useQuery).mockReturnValue([]);
  });

  it("renders the verbatim title, body, and button copy", () => {
    renderDialog();
    expect(
      screen.getByText('Move "legal" to Project')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Choose a synced workspace. The skill moves immediately once you confirm."
      )
    ).toBeInTheDocument();
    expect(getMoveButton()).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel Move" })
    ).toBeInTheDocument();
  });

  it("renders a Select fed by api.forge.listWorkspaces with no class-based filter — both synced and local-only workspaces appear", () => {
    vi.mocked(useQuery).mockReturnValue([
      { workspaceId: "ws-1", name: "repo-a", class: "synced", rootPath: "/a" },
      { workspaceId: "ws-2", name: "repo-b", class: "local-only", rootPath: "/b" },
    ]);
    renderDialog();
    expect(screen.getByTestId("select-item-ws-1")).toBeInTheDocument();
    expect(screen.getByTestId("select-item-ws-2")).toBeInTheDocument();
  });

  it('shows "No workspaces synced from this host yet." and disables confirm when the list is empty', () => {
    vi.mocked(useQuery).mockReturnValue([]);
    renderDialog();
    expect(
      screen.getByText("No workspaces synced from this host yet.")
    ).toBeInTheDocument();
    expect(getMoveButton()).toBeDisabled();
  });

  it("keeps confirm disabled until a workspace is selected", () => {
    vi.mocked(useQuery).mockReturnValue([
      { workspaceId: "ws-1", name: "repo-a", class: "synced", rootPath: "/a" },
    ]);
    renderDialog();
    expect(getMoveButton()).toBeDisabled();
    fireEvent.click(screen.getByTestId("select-item-ws-1"));
    expect(getMoveButton()).not.toBeDisabled();
  });

  it("calls enqueueLifecycle with action move, destination project, the selected workspaceId, and sourceOrigin on confirm", async () => {
    vi.mocked(useQuery).mockReturnValue([
      { workspaceId: "ws-1", name: "repo-a", class: "synced", rootPath: "/a" },
    ]);
    renderDialog({ skillName: "legal", sourceOrigin: "claude-code" });
    fireEvent.click(screen.getByTestId("select-item-ws-1"));
    fireEvent.click(getMoveButton());

    await waitFor(() => expect(enqueueLifecycleMock).toHaveBeenCalledTimes(1));
    const args = enqueueLifecycleMock.mock.calls[0][0];
    expect(args).toMatchObject({
      hostId: "desktop",
      action: "move",
      skillName: "legal",
      sourceOrigin: "claude-code",
      destination: "project",
      workspaceId: "ws-1",
    });
    expect(typeof args.commandId).toBe("string");
    expect(args.commandId.length).toBeGreaterThan(0);
  });

  it("closes the dialog (onOpenChange(false)) after a successful confirm", async () => {
    vi.mocked(useQuery).mockReturnValue([
      { workspaceId: "ws-1", name: "repo-a", class: "synced", rootPath: "/a" },
    ]);
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByTestId("select-item-ws-1"));
    fireEvent.click(getMoveButton());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps the dialog open and toasts the stripped refusal when enqueueLifecycle rejects (98-REVIEW CR-03)", async () => {
    enqueueLifecycleMock.mockReturnValue(
      Promise.reject(
        new Error("lifecycle-refused:collision:already active in this project")
      )
    );
    vi.mocked(useQuery).mockReturnValue([
      { workspaceId: "ws-1", name: "repo-a", class: "synced", rootPath: "/a" },
    ]);
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByTestId("select-item-ws-1"));
    fireEvent.click(getMoveButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("already active in this project")
    );
    // The dialog must NOT close as if the move succeeded.
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not call enqueueLifecycle when Cancel Move is clicked", () => {
    vi.mocked(useQuery).mockReturnValue([
      { workspaceId: "ws-1", name: "repo-a", class: "synced", rootPath: "/a" },
    ]);
    renderDialog();
    fireEvent.click(screen.getByTestId("select-item-ws-1"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel Move" }));
    expect(enqueueLifecycleMock).not.toHaveBeenCalled();
  });
});
