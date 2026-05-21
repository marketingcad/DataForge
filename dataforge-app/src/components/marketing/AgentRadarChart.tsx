"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { useTheme } from "next-themes";

type DataPoint = {
  month: string;
  calls: number;
  leads: number;
};

interface Props {
  data: DataPoint[];
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card shadow-md px-3 py-2.5 text-xs space-y-1">
      <p className="font-bold text-sm">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function AgentRadarChart({ data }: Props) {
  const { resolvedTheme } = useTheme();
  const textColor    = resolvedTheme === "dark" ? "#f1f5f9" : "#111827";
  const mutedColor   = resolvedTheme === "dark" ? "#94a3b8" : "#6b7280";
  const gridColor    = resolvedTheme === "dark" ? "#334155" : "#e2e8f0";

  const maxVal = Math.max(...data.flatMap((d) => [d.calls, d.leads]), 1);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart
        data={data}
        margin={{ top: 16, right: 24, bottom: 16, left: 24 }}
      >
        <PolarGrid stroke={gridColor} />

        <PolarAngleAxis
          dataKey="month"
          tick={({ x, y, textAnchor, index, fill: _fill, verticalAnchor: _va, ...props }) => {
            const d = data[index];
            const yNum = Number(y);
            return (
              <text
                x={x}
                y={index === 0 ? yNum - 8 : yNum}
                textAnchor={textAnchor}
                fontSize={12}
                fontWeight={600}
                fill={textColor}
                {...props}
              >
                <tspan fill="#a855f7">{d.calls}</tspan>
                <tspan fill={mutedColor}>/</tspan>
                <tspan fill="#3b82f6">{d.leads}</tspan>
                <tspan
                  x={x}
                  dy="1.1rem"
                  fontSize={11}
                  fontWeight={500}
                  fill={mutedColor}
                >
                  {d.month}
                </tspan>
              </text>
            );
          }}
        />

        <Tooltip content={<CustomTooltip />} />

        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 12, fontWeight: 600, color: textColor, textTransform: "capitalize" }}>{value}</span>
          )}
        />

        <Radar
          name="Calls"
          dataKey="calls"
          stroke="hsl(262 83% 58%)"
          fill="hsl(262 83% 58%)"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Radar
          name="Leads"
          dataKey="leads"
          stroke="hsl(217 91% 60%)"
          fill="hsl(217 91% 60%)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
