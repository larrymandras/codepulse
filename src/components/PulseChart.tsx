import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, YAxis, CartesianGrid } from "recharts";
import InfoTooltip from "./InfoTooltip";

interface PulseChartProps {
  events: any[];
}

export default function PulseChart({ events }: PulseChartProps) {
  // Group events into 1-minute buckets
  const buckets = new Map<string, number>();
  for (const event of events) {
    const ts = event.timestamp ?? 0;
    const date = new Date(ts * 1000);
    const key = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const data = Array.from(buckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Activity Pulse
        <InfoTooltip text="Real-time event activity over the last hour, grouped into 1-minute buckets" />
      </h2>
      <div className="flex-1 min-h-[200px]">
        {data.length === 0 ? (
          <p className="text-sm font-mono text-muted-foreground py-12 text-center">No activity data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="label" 
                stroke="#666" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis 
                stroke="#666" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.8)', borderColor: '#374151', backdropFilter: 'blur(8px)', borderRadius: '0.5rem', color: '#fff' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorPulse)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
