/**
 * IntakeModal test (Phase 07-02) — jsdom render assertions.
 *
 * Mocks convex/react (useQuery/useMutation) and @/hooks/useForge's
 * useForgeHostsRaw following ForgeLaunchModal.test.tsx's established
 * convention. Also mocks the shadcn Select primitive: Radix Select's
 * portal/pointer-capture behavior is not implemented in jsdom —
 * ThemeSwitcher.test.tsx established the precedent of mocking
 * @/components/ui/select wholesale; this file extends that mock with a
 * React-context-scoped onValueChange wiring so tests can simulate a
 * selection via a plain click on the (always-rendered, non-portal) item.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContext, useContext } from "react";
import { useQuery, useMutation } from "convex/react";
import { useForgeHostsRaw } from "@/hooks/useForge";
import { useGithubTreeScan } from "@/hooks/useGithubTreeScan";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

// Task 2b: mock the scan hook so batch-submission tests can drive
// SkillCollectionPicker with a fixed "done, N skillPaths" scanState without
// hitting the real GitHub API. Single-skill tests (Plan 07-02) never call
// scan(), so the default idle state (set per-test below) never renders the
// picker beyond its no-op idle branch.
vi.mock("@/hooks/useGithubTreeScan", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useGithubTreeScan")>(
    "@/hooks/useGithubTreeScan"
  );
  return {
    ...actual,
    useGithubTreeScan: vi.fn(),
  };
});

vi.mock("@/hooks/useForge", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useForge")>(
    "@/hooks/useForge"
  );
  return {
    ...actual,
    useForgeHostsRaw: vi.fn(() => [
      { hostId: "desktop", lastSeenAt: Date.now(), hostname: "Desktop" },
    ]),
  };
});

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

import { IntakeModal } from "./IntakeModal";

const noop = () => {};

function renderModal() {
  const onEnqueued = vi.fn();
  const onEnqueueFailed = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <IntakeModal
      open={true}
      onClose={onClose}
      onEnqueued={onEnqueued}
      onEnqueueFailed={onEnqueueFailed}
    />
  );
  return { ...utils, onEnqueued, onEnqueueFailed, onClose };
}

function pickDestination(name: "Global" | "Project" | "Cold storage") {
  fireEvent.click(screen.getByRole("radio", { name }));
}

function selectFile(name = "SKILL.md") {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["# skill"], name, { type: "text/markdown" });
  fireEvent.change(input, { target: { files: [file] } });
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /validate skill/i });
}

describe("IntakeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue([]);
    vi.mocked(useMutation).mockReturnValue(
      vi.fn() as unknown as ReturnType<typeof useMutation>
    );
    vi.mocked(useForgeHostsRaw).mockReturnValue([
      { hostId: "desktop", lastSeenAt: Date.now(), hostname: "Desktop" },
    ]);
    vi.mocked(useGithubTreeScan).mockReturnValue({
      status: "idle",
      scan: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("renders 'Validate skill' as both the DialogTitle and the submit button", () => {
    renderModal();
    const matches = screen.getAllByText("Validate skill");
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(
      matches.some((el) => el.getAttribute("data-slot") === "dialog-title")
    ).toBe(true);
  });

  it("renders the destination ToggleGroup with none of the three items pressed initially", () => {
    renderModal();
    expect(screen.getByRole("radio", { name: "Global" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("radio", { name: "Project" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(
      screen.getByRole("radio", { name: "Cold storage" })
    ).toHaveAttribute("aria-checked", "false");
  });

  it("renders the drop-zone copy and URL field placeholder verbatim", () => {
    renderModal();
    expect(
      screen.getByText("Drop a SKILL.md here, or click to browse")
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("or paste a GitHub URL")
    ).toBeInTheDocument();
  });

  it("renders the dry-run posture note verbatim", () => {
    renderModal();
    expect(
      screen.getByText("Validation only — nothing is written.")
    ).toBeInTheDocument();
  });

  it("submit is disabled when neither file nor URL is set", () => {
    renderModal();
    pickDestination("Global");
    expect(getSubmitButton()).toBeDisabled();
  });

  it("submit is disabled when no destination is picked (file set)", () => {
    renderModal();
    selectFile();
    expect(getSubmitButton()).toBeDisabled();
  });

  it("submit is disabled when destination is Project and no workspace is picked", () => {
    renderModal();
    selectFile();
    pickDestination("Project");
    expect(getSubmitButton()).toBeDisabled();
  });

  it("submit stays disabled while no host is selected, and enables once one is picked (WR-03 regression)", () => {
    // Every host offline → the D-08 auto-select never fires → hostId stays "".
    vi.mocked(useForgeHostsRaw).mockReturnValue([
      { hostId: "laptop", lastSeenAt: Date.now() - 5 * 60_000, hostname: "Laptop" },
    ]);
    renderModal();
    selectFile();
    pickDestination("Global");
    // Pre-fix this was enabled and enqueued a command with hostId: "" —
    // unclaimable by any daemon, silently expiring after its TTL.
    expect(getSubmitButton()).toBeDisabled();

    // An offline host remains manually selectable (D-P7-12) and unblocks submit.
    fireEvent.click(screen.getByTestId("select-item-laptop"));
    expect(getSubmitButton()).not.toBeDisabled();
  });

  it("submit is enabled once exactly one of file/url is set and a non-project destination is picked", () => {
    renderModal();
    selectFile();
    pickDestination("Global");
    expect(getSubmitButton()).not.toBeDisabled();
  });

  it("enables submit for a Project destination once a workspace is picked", () => {
    vi.mocked(useQuery).mockImplementation(((_ref: unknown, args: unknown) =>
      args && args !== "skip"
        ? [{ workspaceId: "ws-1", name: "my-repo", class: "synced", rootPath: "/repo" }]
        : []) as typeof useQuery);
    renderModal();
    selectFile();
    pickDestination("Project");
    expect(getSubmitButton()).toBeDisabled();
    fireEvent.click(screen.getByTestId("select-item-ws-1"));
    expect(getSubmitButton()).not.toBeDisabled();
  });

  it("selecting a file clears a previously entered GitHub URL (XOR enforced in state)", () => {
    renderModal();
    const urlInput = screen.getByPlaceholderText("or paste a GitHub URL");
    fireEvent.change(urlInput, { target: { value: "https://github.com/owner/repo" } });
    expect(urlInput).toHaveValue("https://github.com/owner/repo");

    selectFile();
    expect(urlInput).toHaveValue("");
    expect(screen.getByText("SKILL.md")).toBeInTheDocument();
  });

  it("typing a GitHub URL clears a previously selected file (XOR enforced in state)", () => {
    renderModal();
    selectFile();
    expect(screen.getByText("SKILL.md")).toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText("or paste a GitHub URL");
    fireEvent.change(urlInput, { target: { value: "https://github.com/owner/repo" } });
    expect(urlInput).toHaveValue("https://github.com/owner/repo");
    expect(
      screen.getByText("Drop a SKILL.md here, or click to browse")
    ).toBeInTheDocument();
  });

  it("selecting a file clears scan state and any scanned subpath — no stale subpath rides a file upload (WR-02 regression)", () => {
    const reset = vi.fn();
    vi.mocked(useGithubTreeScan).mockReturnValue({
      status: "done",
      result: { skillPaths: ["skills/foo/SKILL.md"], truncated: false },
      scan: vi.fn(),
      reset,
    });
    vi.mocked(useMutation).mockReturnValue(
      vi.fn(() => new Promise(() => {})) as unknown as ReturnType<typeof useMutation>
    );

    const { onEnqueued } = renderModal();
    const urlInput = screen.getByPlaceholderText("or paste a GitHub URL");
    fireEvent.change(urlInput, { target: { value: "https://github.com/owner/repo" } });
    // Picker mounts against the done scanState and auto-selects the single path.

    // Now switch to a file upload instead.
    selectFile();
    expect(reset).toHaveBeenCalled();

    pickDestination("Global");
    fireEvent.click(getSubmitButton());

    expect(onEnqueued).toHaveBeenCalledTimes(1);
    const row = onEnqueued.mock.calls[0][0];
    expect(row.fileName).toBe("SKILL.md");
    expect(row.subpath).toBeNull();
  });

  it("an offline host is selectable and shows the inline warning", () => {
    vi.mocked(useForgeHostsRaw).mockReturnValue([
      { hostId: "laptop", lastSeenAt: Date.now() - 5 * 60_000, hostname: "Laptop" },
    ]);
    renderModal();

    const item = screen.getByTestId("select-item-laptop");
    expect(item).not.toBeDisabled();
    fireEvent.click(item);

    expect(
      screen.getByText(
        "Host offline — command will expire in 5 min unless a daemon claims it."
      )
    ).toBeInTheDocument();
  });

  it("paints an optimistic row via onEnqueued and closes the modal before the mutation resolves", () => {
    vi.mocked(useMutation).mockReturnValue(
      vi.fn(() => new Promise(() => {})) as unknown as ReturnType<typeof useMutation>
    );
    const { onEnqueued, onClose } = renderModal();
    const urlInput = screen.getByPlaceholderText("or paste a GitHub URL");
    fireEvent.change(urlInput, { target: { value: "https://github.com/owner/repo" } });
    pickDestination("Global");

    fireEvent.click(getSubmitButton());

    expect(onEnqueued).toHaveBeenCalledTimes(1);
    const row = onEnqueued.mock.calls[0][0];
    expect(row.status).toBe("pending");
    expect(row.destination).toBe("global");
    expect(row.githubUrl).toBe("https://github.com/owner/repo");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submitting with 3 selected skills calls onEnqueued exactly 3 times, synchronously, before enqueueIntake resolves", () => {
    vi.mocked(useMutation).mockReturnValue(
      vi.fn(() => new Promise(() => {})) as unknown as ReturnType<typeof useMutation>
    );
    vi.mocked(useGithubTreeScan).mockReturnValue({
      status: "done",
      result: {
        skillPaths: ["skills/a/SKILL.md", "skills/b/SKILL.md", "skills/c/SKILL.md"],
        truncated: false,
      },
      scan: vi.fn(),
      reset: vi.fn(),
    });

    const { onEnqueued, onClose } = renderModal();
    const urlInput = screen.getByPlaceholderText("or paste a GitHub URL");
    fireEvent.change(urlInput, { target: { value: "https://github.com/owner/repo" } });
    pickDestination("Global");

    const selectAll = screen.getByRole("checkbox", { name: /select all/i });
    fireEvent.click(selectAll);

    expect(screen.getByText(/validate 3 skills/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /validate 3 skills/i }));

    expect(onEnqueued).toHaveBeenCalledTimes(3);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
