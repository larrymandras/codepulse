/**
 * Tasks.test.tsx — RED test for the merged Tasks/Mission Control board (96-04, Task 1).
 *
 * Encodes the D-01/D-02 contract: a single Tasks board with a "By Status" /
 * "By Agent" segmented control, deep-linkable via ?view=agent, plus the
 * F7 <PageHeader> migration. Fails against the pre-merge Tasks.tsx (no view
 * toggle, no PageHeader, no per-agent grouping).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── dnd-kit mocks (avoid real drag machinery in jsdom) ────────────────────

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useSensor: () => null,
  useSensors: () => [],
  PointerSensor: class {},
  TouchSensor: class {},
  KeyboardSensor: class {},
  closestCenter: vi.fn(),
  closestCorners: vi.fn(),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  arrayMove: (arr: unknown[]) => arr,
  verticalListSortingStrategy: {},
  sortableKeyboardCoordinates: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

// ─── Convex mocks ───────────────────────────────────────────────────────────

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    tasks: {
      listByColumn: "api.tasks.listByColumn",
      moveColumn: "api.tasks.moveColumn",
      create: "api.tasks.create",
    },
    missionControl: {
      listTasksByAgent: "api.missionControl.listTasksByAgent",
      reassignTask: "api.missionControl.reassignTask",
    },
    agentProfiles: {
      list: "api.agentProfiles.list",
    },
  },
}));

const sampleStatusTasks = [
  {
    _id: "t1",
    taskId: "task-1",
    title: "Status Task One",
    description: undefined,
    priority: "medium",
    column: "backlog",
    agentId: undefined,
    agentName: undefined,
    labels: [],
    dueAt: undefined,
    columnEnteredAt: Date.now() / 1000,
    findingId: undefined,
    createdAt: Date.now() / 1000,
  },
];

const sampleAgentTasks = [
  {
    _id: "t2",
    taskId: "task-2",
    title: "Agent Task Two",
    priority: "medium",
    agentId: "astrid",
    agentName: "Astridr",
    source: "chat",
    progress: 50,
    createdAt: Date.now() / 1000,
  },
];

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

// ─── App hook / context mocks ───────────────────────────────────────────────

vi.mock("@/hooks/useCommandDispatch", () => ({
  useCommandDispatch: () => ({ dispatch: vi.fn(), isConnected: true }),
}));

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: vi.fn().mockResolvedValue({ status: "ok" }),
    subscribeEvent: vi.fn(() => () => {}),
  }),
}));

vi.mock("@/hooks/useRosterAgents", () => ({
  useRosterAgents: () => ({ agents: [], isLoading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("@/hooks/useAvatars", () => ({
  useAvatars: () => [],
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Tasks from "../Tasks";

function renderTasks(initialPath = "/tasks") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Tasks />
    </MemoryRouter>
  );
}

describe("Tasks — merged board (By Status / By Agent)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockImplementation((ref: unknown) => {
      if (ref === api.tasks.listByColumn) return sampleStatusTasks;
      if (ref === api.missionControl.listTasksByAgent) return sampleAgentTasks;
      if (ref === api.agentProfiles.list) return [];
      return undefined;
    });
  });

  test("with no ?view param, renders in By Status mode (Kanban columns present)", () => {
    renderTasks("/tasks");
    expect(screen.getByText(/Backlog/)).toBeInTheDocument();
  });

  test("with ?view=agent, renders the per-agent grouping", () => {
    renderTasks("/tasks?view=agent");
    expect(screen.getByText("Astridr")).toBeInTheDocument();
  });

  test("clicking the By Agent segment switches the active view", () => {
    renderTasks("/tasks");
    // Board starts in status mode
    expect(screen.getByText(/Backlog/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "By Agent" }));

    expect(screen.getByText("Astridr")).toBeInTheDocument();
  });

  test("page header renders via PageHeader with title Tasks", () => {
    renderTasks("/tasks");
    const heading = screen.getByRole("heading", { level: 1, name: "Tasks" });
    // PageHeader's signature typography (F7) — text-2xl font-bold — distinguishes
    // it from the pre-merge bespoke `text-lg font-semibold` header.
    expect(heading.className).toContain("text-2xl");
    expect(heading.className).toContain("font-bold");
  });
});
