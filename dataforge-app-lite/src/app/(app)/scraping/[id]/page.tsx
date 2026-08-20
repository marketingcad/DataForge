import { notFound, redirect } from "next/navigation";
import { getJobById } from "@/lib/scraping/jobs/service";
import { JobDetailPoller } from "@/components/scraping/JobDetailPoller";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";

const SCRAPING_ROLES = ["boss", "admin", "lead_specialist"];

export default async function ScrapingJobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!role || !SCRAPING_ROLES.includes(role)) redirect("/unauthorized");

  const { id } = await params;

  let job;
  try {
    job = await getJobById(id);
  } catch {
    notFound();
  }

  const serialized = {
    ...job,
    startTime: job.startTime?.toISOString() ?? null,
    completedTime: job.completedTime?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  };

  return (
    <div className="space-y-6">
      <Link href="/scraping" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to jobs
      </Link>
      <JobDetailPoller initialJob={serialized} />
    </div>
  );
}
