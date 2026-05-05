import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AgentStatusTile from "./AgentStatusTile";

vi.mock("./AgentAvatar", () => ({
  default: () => <div data-testid="avatar" />,
}));

vi.mock("motion/react", () => ({
  motion: { div: ({ children, className }: any) => <div className={className}>{children}</div> },
}));

describe("AgentStatusTile", () => {
  it("renders agent name", () => {
    render(<AgentStatusTile agentId="astridr" agentName="Astridhr" state="idle" />);
    expect(screen.getByText("Astridhr")).toBeDefined();
  });

  it("applies green background for active state", () => {
    const { container } = render(<AgentStatusTile agentId="a" agentName="A" state="active" />);
    expect(container.querySelector(".bg-green-500\\/20")).not.toBeNull();
  });

  it("applies blue background for waiting state", () => {
    const { container } = render(<AgentStatusTile agentId="a" agentName="A" state="waiting" />);
    expect(container.querySelector(".bg-blue-500\\/20")).not.toBeNull();
  });

  it("applies amber background for recent state", () => {
    const { container } = render(<AgentStatusTile agentId="a" agentName="A" state="recent" />);
    expect(container.querySelector(".bg-amber-500\\/20")).not.toBeNull();
  });

  it("applies gray background for idle state", () => {
    const { container } = render(<AgentStatusTile agentId="a" agentName="A" state="idle" />);
    expect(container.querySelector(".bg-gray-500\\/10")).not.toBeNull();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<AgentStatusTile agentId="a" agentName="A" state="idle" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows currentTask when provided", () => {
    render(<AgentStatusTile agentId="a" agentName="A" state="active" currentTask="Processing email" />);
    expect(screen.getByText("Processing email")).toBeDefined();
  });

  it("has role=button attribute", () => {
    render(<AgentStatusTile agentId="a" agentName="A" state="idle" />);
    expect(screen.getByRole("button")).toBeDefined();
  });
});
