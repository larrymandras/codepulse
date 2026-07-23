/**
 * SkillLaunchProvider test (Phase 99 Plan 04, LAUNCH-02/04, D-10/D-11/D-12).
 *
 * ForgeLaunchModal is mocked to a lightweight stub exposing buttons that
 * invoke onLaunched/onLaunchFailed/onClose directly — this isolates the
 * provider's own contract (context value, initialPrompt composition,
 * recordSkillLaunch gating) from the modal's own host/agent/workspace
 * picker + enqueueLaunch machinery (already covered by
 * ForgeLaunchModal.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const recordSkillLaunchMock = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => recordSkillLaunchMock),
}));

vi.mock("@/components/forge/ForgeLaunchModal", () => ({
  ForgeLaunchModal: (props: {
    open: boolean;
    initialPrompt?: string;
    onLaunched: (row: unknown) => void;
    onLaunchFailed: (commandId: string, message: string) => void;
    onClose: () => void;
  }) => (
    <div
      data-testid="forge-modal-stub"
      data-open={String(props.open)}
      data-initial-prompt={props.initialPrompt ?? ""}
    >
      <button
        onClick={() =>
          props.onLaunched({
            commandId: "c1",
            commandType: "launch",
            status: "pending",
            agent: "codex",
            mode: "goal",
            prompt: null,
            hostId: "h",
            resolvedForgeJobId: null,
            error: null,
            createdAt: Date.now(),
          })
        }
      >
        stub-onLaunched
      </button>
      <button onClick={() => props.onLaunchFailed("c1", "boom")}>
        stub-onLaunchFailed
      </button>
      <button onClick={() => props.onClose()}>stub-onClose</button>
    </div>
  ),
}));

import {
  SkillLaunchProvider,
  useSkillLaunch,
  type ForgeLaunchableSkill,
} from "./SkillLaunchProvider";
import { RUN_TARGET_STORAGE_KEY } from "@/lib/skillRun";

const TEST_SKILL: ForgeLaunchableSkill = { name: "x", displayName: "X" };

function Harness({ skill }: { skill: ForgeLaunchableSkill }) {
  const { lastTarget, setLastTarget, launchForge } = useSkillLaunch();
  return (
    <div>
      <div data-testid="last-target">{lastTarget}</div>
      <button onClick={() => launchForge(skill)}>launch-forge</button>
      <button onClick={() => setLastTarget("forge")}>set-last-target-forge</button>
    </div>
  );
}

function renderWithProvider(skill: ForgeLaunchableSkill = TEST_SKILL) {
  return render(
    <SkillLaunchProvider>
      <Harness skill={skill} />
    </SkillLaunchProvider>
  );
}

function Consumer() {
  useSkillLaunch();
  return null;
}

describe("SkillLaunchProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("Test 1: useSkillLaunch() outside a provider throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      /useSkillLaunch must be used within SkillLaunchProvider/
    );
    spy.mockRestore();
  });

  it("Test 2: launchForge opens the modal with initialPrompt === skillInvocation(skill) + ' '", () => {
    renderWithProvider();
    expect(screen.getByTestId("forge-modal-stub")).toHaveAttribute(
      "data-open",
      "false"
    );

    fireEvent.click(screen.getByText("launch-forge"));

    const stub = screen.getByTestId("forge-modal-stub");
    expect(stub).toHaveAttribute("data-open", "true");
    expect(stub).toHaveAttribute("data-initial-prompt", "/x ");
  });

  it("Test 3: the modal's onLaunched callback calls recordSkillLaunch({ name: 'x' }) exactly once", () => {
    renderWithProvider();
    fireEvent.click(screen.getByText("launch-forge"));
    fireEvent.click(screen.getByText("stub-onLaunched"));

    expect(recordSkillLaunchMock).toHaveBeenCalledTimes(1);
    expect(recordSkillLaunchMock).toHaveBeenCalledWith({ name: "x" });
  });

  it("Test 4: onLaunchFailed / onClose do NOT call recordSkillLaunch (D-12)", () => {
    renderWithProvider();
    fireEvent.click(screen.getByText("launch-forge"));
    fireEvent.click(screen.getByText("stub-onLaunchFailed"));
    expect(recordSkillLaunchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("launch-forge"));
    fireEvent.click(screen.getByText("stub-onClose"));
    expect(recordSkillLaunchMock).not.toHaveBeenCalled();
  });

  it("Test 5: setLastTarget('forge') persists via storeRunTarget and updates lastTarget", () => {
    renderWithProvider();
    expect(screen.getByTestId("last-target").textContent).toBe("chat");

    fireEvent.click(screen.getByText("set-last-target-forge"));

    expect(screen.getByTestId("last-target").textContent).toBe("forge");
    expect(window.localStorage.getItem(RUN_TARGET_STORAGE_KEY)).toBe("forge");
  });
});
