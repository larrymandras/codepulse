import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { useFocusParam } from "./useFocusParam";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SimpleNode = { id: string; name: string };

function makeWrapper(url: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      MemoryRouter,
      { initialEntries: [url] },
      children,
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useFocusParam", () => {
  it("does NOT call onFocus while nodes is undefined (loading)", () => {
    const onFocus = vi.fn();
    renderHook(
      () =>
        useFocusParam<SimpleNode>({
          nodes: undefined,
          getId: (n) => n.id,
          onFocus,
        }),
      { wrapper: makeWrapper("/page?focus=node-1") },
    );
    expect(onFocus).not.toHaveBeenCalled();
  });

  it("calls onFocus exactly once after nodes resolves and a matching node is found", () => {
    const onFocus = vi.fn();
    const nodes: SimpleNode[] = [{ id: "node-1", name: "Alpha" }];

    renderHook(
      () =>
        useFocusParam<SimpleNode>({
          nodes,
          getId: (n) => n.id,
          onFocus,
        }),
      { wrapper: makeWrapper("/page?focus=node-1") },
    );

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith(nodes[0]);
  });

  it("does NOT call onFocus again on subsequent re-renders (one-shot appliedRef guard)", () => {
    const onFocus = vi.fn();
    const nodes: SimpleNode[] = [{ id: "node-1", name: "Alpha" }];

    const { rerender } = renderHook(
      () =>
        useFocusParam<SimpleNode>({
          nodes,
          getId: (n) => n.id,
          onFocus,
        }),
      { wrapper: makeWrapper("/page?focus=node-1") },
    );

    // Re-render with the same data — should not fire again
    rerender();
    rerender();

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onFocus when nodes resolves but no node matches the focus param (silent no-op)", () => {
    const onFocus = vi.fn();
    const nodes: SimpleNode[] = [
      { id: "node-2", name: "Beta" },
      { id: "node-3", name: "Gamma" },
    ];

    renderHook(
      () =>
        useFocusParam<SimpleNode>({
          nodes,
          getId: (n) => n.id,
          onFocus,
        }),
      { wrapper: makeWrapper("/page?focus=node-99") },
    );

    expect(onFocus).not.toHaveBeenCalled();
  });

  it("applies focus once nodes transitions from undefined to a matching array", () => {
    const onFocus = vi.fn();
    const nodes: SimpleNode[] = [{ id: "agent-skuld", name: "Skuld" }];

    // First render: still loading
    const { rerender } = renderHook(
      ({ nodeList }: { nodeList: SimpleNode[] | undefined }) =>
        useFocusParam<SimpleNode>({
          nodes: nodeList,
          getId: (n) => n.id,
          onFocus,
        }),
      {
        initialProps: { nodeList: undefined as SimpleNode[] | undefined },
        wrapper: makeWrapper("/page?focus=agent-skuld"),
      },
    );

    expect(onFocus).not.toHaveBeenCalled();

    // Nodes resolve
    rerender({ nodeList: nodes });

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith(nodes[0]);
  });

  it("returns fromParam as the decoded, same-origin-guarded ?from value", () => {
    const onFocus = vi.fn();
    const encoded = encodeURIComponent("/tool-galaxy?focus=tool%3ARead");
    const url = `/page?focus=node-1&from=${encoded}`;

    const { result } = renderHook(
      () =>
        useFocusParam<SimpleNode>({
          nodes: [],
          getId: (n) => n.id,
          onFocus,
        }),
      { wrapper: makeWrapper(url) },
    );

    // decodeFromParam runs decodeURIComponent, so %3A → :
    expect(result.current.fromParam).toBe("/tool-galaxy?focus=tool:Read");
  });

  it("returns fromParam as null when ?from is absent", () => {
    const onFocus = vi.fn();

    const { result } = renderHook(
      () =>
        useFocusParam<SimpleNode>({
          nodes: [],
          getId: (n) => n.id,
          onFocus,
        }),
      { wrapper: makeWrapper("/page?focus=node-1") },
    );

    expect(result.current.fromParam).toBeNull();
  });

  it("returns fromParam as null when ?from fails the same-origin guard (external URL)", () => {
    const onFocus = vi.fn();
    const encoded = encodeURIComponent("https://evil.com");
    const url = `/page?focus=node-1&from=${encoded}`;

    const { result } = renderHook(
      () =>
        useFocusParam<SimpleNode>({
          nodes: [],
          getId: (n) => n.id,
          onFocus,
        }),
      { wrapper: makeWrapper(url) },
    );

    expect(result.current.fromParam).toBeNull();
  });

  it("does NOT call onFocus when ?focus param is absent", () => {
    const onFocus = vi.fn();
    const nodes: SimpleNode[] = [{ id: "node-1", name: "Alpha" }];

    renderHook(
      () =>
        useFocusParam<SimpleNode>({
          nodes,
          getId: (n) => n.id,
          onFocus,
        }),
      { wrapper: makeWrapper("/page") },
    );

    expect(onFocus).not.toHaveBeenCalled();
  });
});
