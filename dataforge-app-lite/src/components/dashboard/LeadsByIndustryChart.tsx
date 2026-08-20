"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface LeadsByIndustryChartProps {
  data: { industry: string; count: number }[];
}

export function LeadsByIndustryChart({ data }: LeadsByIndustryChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Leads by Industry</CardTitle>
        <CardDescription className="text-xs">Distribution across all categories</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
            <p className="text-xs">No data yet — start scraping to see results</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="industry" width={110} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
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
        )}
      </CardContent>
    </Card>
  );
}
