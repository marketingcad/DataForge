"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface IndustryBarChartProps {
  data: { industry: string; count: number }[];
}

function truncate(str: string, max = 18): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTick({ x, y, payload }: any) {
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="hsl(var(--muted-foreground))"
      fontSize={11}
    >
      {truncate(payload.value)}
    </text>
  );
}

export function IndustryBarChart({ data }: IndustryBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-xs">No data yet — start scraping</p>
      </div>
    );
  }

  const chartHeight = Math.max(220, data.length * 30);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <XAxis
          type="number" fontSize={11} tickLine={false} axisLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          type="category" dataKey="industry" width={130}
          tickLine={false} axisLine={false}
          interval={0}
          tick={<CustomTick />}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            background: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          cursor={{ fill: "hsl(var(--muted))" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={`hsl(221 83% ${Math.max(35, 65 - i * 4)}%)`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
