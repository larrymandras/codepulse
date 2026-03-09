import { query } from "./_generated/server";

export const activityHeatmap = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(5000);

    const cells: Record<string, number> = {};
    let maxCount = 0;

    for (const e of events) {
      const d = new Date(e.timestamp * 1000);
      const day = d.getDay(); // 0=Sun … 6=Sat
      const hour = d.getHours();
      const key = `${day}-${hour}`;
      cells[key] = (cells[key] ?? 0) + 1;
      if (cells[key] > maxCount) maxCount = cells[key];
    }

    return {
      cells: Object.entries(cells).map(([key, count]) => {
        const [day, hour] = key.split("-").map(Number);
        return { day, hour, count };
      }),
      maxCount: maxCount || 1,
    };
  },
});

export const toolFlowSankey = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .take(2000);

    const nodeSet = new Set<string>();
    const linkMap: Record<string, number> = {};

    const categoryOf = (eventType: string): string => {
      if (eventType.startsWith("tool_")) return "Tool Use";
      if (eventType.startsWith("llm_") || eventType.startsWith("model_")) return "LLM";
      if (eventType.startsWith("file_")) return "File Ops";
      if (eventType.startsWith("agent_")) return "Agents";
      return "Other";
    };

    const outcomeOf = (e: { eventType: string; payload: any }): string => {
      if (e.eventType.includes("error") || e.eventType.includes("fail")) return "Error";
      if (e.eventType.includes("hitl") || e.eventType.includes("review")) return "HITL";
      return "Success";
    };

    for (const e of events) {
      const category = categoryOf(e.eventType);
      const tool = e.toolName ?? e.eventType;
      const outcome = outcomeOf(e);

      nodeSet.add(category);
      nodeSet.add(tool);
      nodeSet.add(outcome);

      const linkA = `${category}::${tool}`;
      linkMap[linkA] = (linkMap[linkA] ?? 0) + 1;

      const linkB = `${tool}::${outcome}`;
      linkMap[linkB] = (linkMap[linkB] ?? 0) + 1;
    }

    const nodes = [...nodeSet];
    const nodeIndex = Object.fromEntries(nodes.map((n, i) => [n, i]));

    const links = Object.entries(linkMap).map(([key, value]) => {
      const [source, target] = key.split("::");
      return { source: nodeIndex[source], target: nodeIndex[target], value };
    });

    return {
      nodes: nodes.map((name) => ({ name })),
      links,
    };
  },
});

export const tokenSunburst = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("llmMetrics").collect();

    let totalCost = 0;
    let totalTokens = 0;
    const grouped: Record<
      string,
      Record<string, { prompt: number; completion: number; cost: number }>
    > = {};

    for (const r of all) {
      totalCost += r.cost ?? 0;
      totalTokens += r.totalTokens;

      if (!grouped[r.provider]) grouped[r.provider] = {};
      if (!grouped[r.provider][r.model])
        grouped[r.provider][r.model] = { prompt: 0, completion: 0, cost: 0 };

      grouped[r.provider][r.model].prompt += r.promptTokens;
      grouped[r.provider][r.model].completion += r.completionTokens;
      grouped[r.provider][r.model].cost += r.cost ?? 0;
    }

    const tree = {
      name: "All Providers",
      children: Object.entries(grouped).map(([provider, models]) => ({
        name: provider,
        children: Object.entries(models).map(([model, data]) => ({
          name: model,
          children: [
            { name: "Prompt", value: data.prompt },
            { name: "Completion", value: data.completion },
          ],
        })),
      })),
    };

    return { tree, totalCost, totalTokens };
  },
});

export const tokenWaterfall = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 60; // last 30 minutes
    const all = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("asc")
      .collect();

    return all
      .filter((r) => r.timestamp >= cutoff)
      .map((r) => ({
        timestamp: r.timestamp,
        model: r.model,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
      }));
  },
});
