"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { useTheme } from "next-themes";

interface Props {
  data: { key: string; label: string; count: number }[];
  /** Key of the currently selected month — highlighted in the chart. */
  selectedKey?: string;
  color?: string;
}

export function GhlApptMonthlyChart({ data, selectedKey, color = "#0ea5e9" }: Props) {
  const { resolvedTheme } = useTheme();
  const tickColor = resolvedTheme === "dark" ? "#94a3b8" : "#6b7280";

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
        <XAxis
          dataKey="label"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tick={{ fill: tickColor }}
          interval="preserveStartEnd"
        />
        <YAxis
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tick={{ fill: tickColor }}
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
          cursor={{ fill: color, fillOpacity: 0.08 }}
          formatter={(value) => [value as number, "Appointments"]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((d) => (
            <Cell
              key={d.key}
              fill={color}
              fillOpacity={selectedKey && d.key !== selectedKey ? 0.35 : 1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
