"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getLeaderboardAction } from "@/actions/marketing.actions";
import { SalesLeaderboard, type LeaderboardEntry } from "./SalesLeaderboard";
import type { Metric } from "./MetricToggle";
import type { Period } from "./PeriodToggle";

interface Props {
  initialLeaderboard: LeaderboardEntry[];
  initialPeriod: Period;
  initialMetric: Metric;
}

export function LeaderboardClientWrapper({ initialLeaderboard, initialPeriod, initialMetric }: Props) {
  const searchParams = useSearchParams();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard);
  const [currentMetric, setCurrentMetric] = useState<Metric>(initialMetric);
  const [isPending, startTransition] = useTransition();

  const period = (searchParams.get("period") ?? initialPeriod) as Period;
  const metric = (searchParams.get("metric") ?? initialMetric) as Metric;

  useEffect(() => {
    startTransition(async () => {
      const data = await getLeaderboardAction(period, metric);
      setLeaderboard(data);
      setCurrentMetric(metric);
    });
  }, [period, metric]);

  return (
    <div className="relative">
      {isPending && (
        <div className="absolute inset-0 z-10 bg-background/50 rounded-3xl flex items-center justify-center">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}
      <SalesLeaderboard leaderboard={leaderboard} metric={currentMetric} />
    </div>
  );
}
