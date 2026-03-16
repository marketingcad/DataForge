import Link from "next/link";
import { JobStatusBadge } from "./JobStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface ScrapingJob {
  id: string;
  industry: string;
  location: string;
  maxLeads: number;
  status: string;
  leadsDiscovered: number;
  leadsProcessed: number;
  duplicatesFound: number;
  failedRecords: number;
  createdAt: Date;
}

export function JobsTable({ jobs }: { jobs: ScrapingJob[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Jobs</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {jobs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No jobs yet. Create one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Industry / Location</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Discovered</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Processed</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Dupes</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-muted/20">
                    <td className="px-6 py-3">
                      <Link href={`/scraping/${job.id}`} className="font-medium hover:underline text-foreground">
                        {job.industry}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{job.location}</div>
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{job.leadsDiscovered}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{job.leadsProcessed}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{job.duplicatesFound}</td>
                    <td className="px-6 py-3 text-right text-muted-foreground">
                      {timeAgo(job.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
