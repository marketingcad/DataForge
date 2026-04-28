"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export type RepMeta = {
  id: string;
  name: string;
  callCount: number; // for the period — used in legend
  metricLabel?: string; // override the stat shown in legend (e.g. "14 leads")
};

interface Props {
  data: ({ label: string } & Record<string, number | string>)[];
  reps: RepMeta[];
  title?: string;
  subtitle?: string;
  myId?: string; // highlights the current user's line (sales rep view)
}

// Palette matching the image: violet, pink, lime, blue, orange
const COLORS = [
  "#8b5cf6", // violet
  "#ec4899", // pink / magenta
  "#84cc16", // lime
  "#3b82f6", // blue
  "#f97316", // orange
];

function CustomTooltip({
  active, payload, label, reps,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: string;
  reps: RepMeta[];
}) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="rounded-xl border border-border bg-card shadow-lg px-4 py-3 min-w-[160px]">
      <p className="text-xs font-bold text-muted-foreground mb-2">{label}</p>
      {sorted.map((p) => {
        const rep = reps.find((r) => r.id === p.dataKey);
        return (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs py-0.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
              <span className="font-medium truncate max-w-[100px]">{rep?.name ?? p.dataKey}</span>
            </div>
            <span className="font-black tabular-nums">{p.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function CustomLegend({
  reps, myId, colors,
}: {
  reps: RepMeta[];
  myId?: string;
  colors: string[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mt-2">
      {reps.map((rep, i) => (
        <div key={rep.id} className="flex items-center gap-1.5">
          <span className="h-[3px] w-5 rounded-full inline-block shrink-0" style={{ background: colors[i % colors.length] }} />
          <span className={`text-[11px] font-semibold ${rep.id === myId ? "text-foreground" : "text-muted-foreground"}`}>
            {rep.id === myId ? `${rep.name} (you)` : rep.name}
          </span>
          <span className="text-[10px] text-muted-foreground">· {rep.metricLabel ?? rep.callCount}</span>
        </div>
      ))}
    </div>
  );
}
export function RepPerformanceChart({ data, reps, title = "Rep Performance", subtitle, myId }: Props) {
  if (reps.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-8 text-center">
        <p className="text-sm font-bold">No rep data yet</p>
        <p className="text-xs text-muted-foreground mt-1">Call data will appear here once reps are active.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-sm p-5 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 rounded-full px-2.5 py-1 shrink-0">
          Last 30 days
        </span>
      </div>

      <CustomLegend reps={reps} myId={myId} colors={COLORS} />

      <div className="mt-2">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
            />
            <Tooltip
              content={<CustomTooltip reps={reps} />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Legend wrapperStyle={{ display: "none" }} />

            {reps.map((rep, i) => {
              const color = COLORS[i % COLORS.length];
              const isMe  = rep.id === myId;
              return (
                <Line
                  key={rep.id}
                  type="monotone"
                  dataKey={rep.id}
                  stroke={color}
                  strokeWidth={isMe ? 3 : 1.5}
                  strokeOpacity={isMe ? 1 : 0.65}
                  dot={false}
                  activeDot={{ r: isMe ? 5 : 4, fill: color, strokeWidth: 0 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}