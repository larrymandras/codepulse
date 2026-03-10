import { query } from "./_generated/server";

export const current = query({
  args: {},
  handler: async (ctx) => {
    // Check wsl2Status for CPU/memory data
    const wslEntries = await ctx.db.query("wsl2Status").collect();

    if (wslEntries.length > 0) {
      // Aggregate from WSL2 status entries
      let totalCpu = 0;
      let totalMem = 0;
      let count = 0;
      for (const entry of wslEntries) {
        if (entry.cpuPercent != null) {
          totalCpu += entry.cpuPercent;
          count++;
        }
        if (entry.memoryMb != null) {
          totalMem += entry.memoryMb;
        }
      }
      return {
        cpu: count > 0 ? totalCpu / count : null,
        ram: totalMem > 0 ? { used: totalMem, total: 16384 } : null,
        disk: null,
      };
    }

    // Check dockerContainers for CPU/memory aggregation
    const containers = await ctx.db
      .query("dockerContainers")
      .collect();

    if (containers.length > 0) {
      let totalCpu = 0;
      let totalMem = 0;
      let hasCpu = false;
      let hasMem = false;
      for (const c of containers) {
        if (c.cpuPercent != null) {
          totalCpu += c.cpuPercent;
          hasCpu = true;
        }
        if (c.memoryMb != null) {
          totalMem += c.memoryMb;
          hasMem = true;
        }
      }
      return {
        cpu: hasCpu ? totalCpu : null,
        ram: hasMem ? { used: totalMem, total: 16384 } : null,
        disk: null,
      };
    }

    // Check metricSnapshots for system-level metrics
    const cpuMetric = await ctx.db
      .query("metricSnapshots")
      .withIndex("by_metric", (q) => q.eq("metricName", "cpu_percent"))
      .order("desc")
      .first();

    const ramMetric = await ctx.db
      .query("metricSnapshots")
      .withIndex("by_metric", (q) => q.eq("metricName", "ram_used_mb"))
      .order("desc")
      .first();

    const diskMetric = await ctx.db
      .query("metricSnapshots")
      .withIndex("by_metric", (q) => q.eq("metricName", "disk_used_mb"))
      .order("desc")
      .first();

    if (cpuMetric || ramMetric || diskMetric) {
      return {
        cpu: cpuMetric ? cpuMetric.value : null,
        ram: ramMetric ? { used: ramMetric.value, total: 16384 } : null,
        disk: diskMetric ? { used: diskMetric.value, total: 512000 } : null,
      };
    }

    // No data available
    return null;
  },
});
