"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LeadsByIndustryChartProps {
  data: { industry: string; count: number }[];
}

export function LeadsByIndustryChart({ data }: LeadsByIndustryChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leads by Industry</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="industry" width={110} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                cursor={{ fill: "hsl(var(--muted))" }}
              />
              <Bar dataKey="count" fill="hsl(221 83% 53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
