"use client";

import { useEffect, useState, useCallback } from "react";
import { JobStatusBadge } from "./JobStatusBadge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Job {
  id: string;
  industry: string;
  location: string;
  maxLeads: number;
  status: string;
  leadsDiscovered: number;
  leadsProcessed: number;
  duplicatesFound: number;
  failedRecords: number;
  errorMessage: string | null;
  startTime: string | null;
  completedTime: string | null;
  createdAt: string;
}

export function JobDetailPoller({ initialJob }: { initialJob: Job }) {
  const [job, setJob] = useState(initialJob);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/scraping/jobs/${job.id}`);
    if (res.ok) {
      const data = await res.json();
      setJob(data);
    }
  }, [job.id]);

  useEffect(() => {
    if (job.status === "completed" || job.status === "failed") return;
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [job.status, poll]);

  const total = job.leadsDiscovered || job.maxLeads;
  const handled = job.leadsProcessed + job.duplicatesFound + job.failedRecords;
  const progress = total > 0 ? Math.round((handled / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{job.industry}</h1>
        <JobStatusBadge status={job.status} />
      </div>
      <p className="text-muted-foreground">{job.location} · up to {job.maxLeads} leads</p>

      {(job.status === "running" || job.status === "completed") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">{handled} / {total} handled ({progress}%)</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBox label="Discovered" value={job.leadsDiscovered} />
        <StatBox label="Processed" value={job.leadsProcessed} color="text-green-600" />
        <StatBox label="Duplicates" value={job.duplicatesFound} color="text-yellow-600" />
        <StatBox label="Failed" value={job.failedRecords} color="text-red-500" />
      </div>

      {job.errorMessage && (
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-4 text-sm text-red-600">{job.errorMessage}</CardContent>
        </Card>
      )}

      {job.status === "pending" && (
        <p className="text-sm text-muted-foreground">Job is queued and will start on the next cron tick (every minute).</p>
      )}
    </div>
  );
}

function StatBox({ label, value, color = "text-foreground" }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}
