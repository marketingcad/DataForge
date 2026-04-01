"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: { label?: string; date?: string; calls?: number; count?: number }[];
  title: string;
  color?: string;
}

export function CallVolumeChart({ data, title, color = "#6366f1" }: Props) {
  const chartData = data.map((d) => ({
    label: d.label ?? d.date ?? "",
    calls: d.calls ?? d.count ?? 0,
  }));

  return (
    <div className="rounded-2xl bg-card shadow-sm p-5">
      <p className="text-sm font-bold mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-5">Daily call volume across the team</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
          <XAxis
            dataKey="label"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            interval="preserveStartEnd"
          />
          <YAxis
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="calls"
            stroke={color}
            strokeWidth={2.5}
            fill="url(#areaGrad)"
            dot={false}
            activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
