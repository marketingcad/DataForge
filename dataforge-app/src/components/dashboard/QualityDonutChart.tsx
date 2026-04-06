"use client";

import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
} from "recharts";

interface QualityDonutChartProps {
  data: { name: string; value: number; color: string }[];
}

export function QualityDonutChart({ data }: QualityDonutChartProps) {
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <span className="text-2xl">🎯</span>
        <p className="text-xs">No data yet — start scraping</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            fontSize: 12,
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            background: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
          formatter={(value) => [value, "leads"]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
