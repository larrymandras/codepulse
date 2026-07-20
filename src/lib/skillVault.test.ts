import { describe, it, expect } from "vitest";
import {
  buildVaultModel,
  computeVaultLayout,
  containersForSkill,
  CONTAINER_ORDER,
  type VaultSkillInput,
} from "./skillVault";

function skill(name: string, origins: string[], extra: Partial<VaultSkillInput> = {}): VaultSkillInput {
  return { name, origins, categoryName: "gsd", categoryColor: "cyan", ...extra };
}

describe("containersForSkill", () => {
  it("maps claude-code -> global", () => {
    expect(containersForSkill(["claude-code"])).toEqual(["global"]);
  });
  it("maps claude-code:available -> cold", () => {
    expect(containersForSkill(["claude-code:available"])).toEqual(["cold"]);
  });
  it("maps claude-code:project:<key> -> project", () => {
    expect(containersForSkill(["claude-code:project:abc123"])).toEqual(["project"]);
  });
  it("maps unknown/legacy origins -> global", () => {
    expect(containersForSkill(["native"])).toEqual(["global"]);
    expect(containersForSkill(["cc"])).toEqual(["global"]);
  });
  it("empty origins -> global (installed default)", () => {
    expect(containersForSkill([])).toEqual(["global"]);
    expect(containersForSkill(undefined)).toEqual(["global"]);
  });
  it("multi-origin skill belongs to multiple containers, in CONTAINER_ORDER", () => {
    expect(containersForSkill(["claude-code:available", "claude-code"])).toEqual(["global", "cold"]);
  });
});

describe("buildVaultModel", () => {
  it("groups skills into the right containers with counts", () => {
    const model = buildVaultModel([
      skill("a", ["claude-code"]),
      skill("b", ["claude-code"]),
      skill("c", ["claude-code:available"]),
      skill("d", ["claude-code:project:xyz"]),
    ]);
    const byId = Object.fromEntries(model.containers.map((c) => [c.id, c]));
    expect(byId.global.count).toBe(2);
    expect(byId.cold.count).toBe(1);
    expect(byId.project.count).toBe(1);
    expect(model.total).toBe(4);
  });

  it("always returns all three containers in order, even when empty", () => {
    const model = buildVaultModel([skill("a", ["claude-code"])]);
    expect(model.containers.map((c) => c.id)).toEqual(CONTAINER_ORDER);
    expect(model.containers.find((c) => c.id === "cold")!.count).toBe(0);
  });

  it("creates a shadow link for a skill present in cold AND global", () => {
    const model = buildVaultModel([
      skill("shadowed", ["claude-code", "claude-code:available"]),
    ]);
    expect(model.containers.find((c) => c.id === "global")!.count).toBe(1);
    expect(model.containers.find((c) => c.id === "cold")!.count).toBe(1);
    expect(model.shadowLinks).toHaveLength(1);
    expect(model.shadowLinks[0]).toMatchObject({
      fromId: "cold:shadowed",
      toId: "global:shadowed",
      name: "shadowed",
    });
  });

  it("groups by category into clusters and sorts clusters by size desc", () => {
    const model = buildVaultModel([
      skill("a", ["claude-code"], { categoryName: "gsd" }),
      skill("b", ["claude-code"], { categoryName: "gsd" }),
      skill("c", ["claude-code"], { categoryName: "n8n" }),
    ]);
    const global = model.containers.find((c) => c.id === "global")!;
    expect(global.clusters).toHaveLength(2);
    expect(global.clusters[0].categoryKey).toBe("gsd"); // 2 skills, first
    expect(global.clusters[0].skills).toHaveLength(2);
  });

  it("uses categoryHex for cluster/skill color", () => {
    const model = buildVaultModel([skill("a", ["claude-code"], { categoryColor: "cyan" })]);
    expect(model.containers[0].clusters[0].color).toBe("#06b6d4");
  });

  it("falls back to Uncategorized when no category", () => {
    const model = buildVaultModel([
      { name: "x", origins: ["claude-code"], categoryName: null },
    ]);
    expect(model.containers[0].clusters[0].categoryLabel).toBe("Uncategorized");
  });
});

describe("computeVaultLayout", () => {
  it("emits container, cluster and skill nodes with fixed positions", () => {
    const model = buildVaultModel([
      skill("a", ["claude-code"], { categoryName: "gsd" }),
      skill("b", ["claude-code"], { categoryName: "n8n" }),
      skill("c", ["claude-code:available"], { categoryName: "legal" }),
    ]);
    const { nodes } = computeVaultLayout(model);
    const containers = nodes.filter((n) => n.type === "container");
    const clusters = nodes.filter((n) => n.type === "cluster");
    const skills = nodes.filter((n) => n.type === "skill");
    expect(containers).toHaveLength(3); // always all three
    expect(clusters).toHaveLength(3); // gsd, n8n (global) + legal (cold)
    expect(skills).toHaveLength(3);
    for (const n of nodes) {
      expect(Number.isFinite(n.fx)).toBe(true);
      expect(Number.isFinite(n.fy)).toBe(true);
      expect(Number.isFinite(n.fz)).toBe(true);
    }
  });

  it("separates containers horizontally (global left, cold right)", () => {
    const model = buildVaultModel([
      skill("a", ["claude-code"]),
      skill("c", ["claude-code:available"]),
    ]);
    const { nodes } = computeVaultLayout(model);
    const g = nodes.find((n) => n.id === "container:global")!;
    const p = nodes.find((n) => n.id === "container:project")!;
    const c = nodes.find((n) => n.id === "container:cold")!;
    expect(g.fx).toBeLessThan(p.fx);
    expect(p.fx).toBeLessThan(c.fx);
  });

  it("carries skill payload on skill nodes and shadow links through", () => {
    const model = buildVaultModel([
      skill("shadowed", ["claude-code", "claude-code:available"], { useCount: 5, command: "/x" }),
    ]);
    const { nodes, links } = computeVaultLayout(model);
    const skillNode = nodes.find((n) => n.type === "skill" && n.container === "global")!;
    expect(skillNode.skill?.name).toBe("shadowed");
    expect(skillNode.skill?.command).toBe("/x");
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ source: "cold:shadowed", target: "global:shadowed", kind: "shadow" });
  });

  it("is deterministic (same input -> identical positions)", () => {
    const mk = () => buildVaultModel([skill("a", ["claude-code"]), skill("b", ["claude-code"])]);
    const l1 = computeVaultLayout(mk());
    const l2 = computeVaultLayout(mk());
    expect(l1.nodes.map((n) => [n.id, n.fx, n.fy, n.fz])).toEqual(
      l2.nodes.map((n) => [n.id, n.fx, n.fy, n.fz]),
    );
  });
});
