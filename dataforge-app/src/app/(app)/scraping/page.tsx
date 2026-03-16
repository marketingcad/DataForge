import { getJobs } from "@/lib/services/scraping.service";
import { JobForm } from "@/components/scraping/JobForm";
import { JobsTable } from "@/components/scraping/JobsTable";

export default async function ScrapingPage() {
  const { jobs } = await getJobs({});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Scraping Jobs</h1>
        <p className="text-muted-foreground">Discover and scrape leads by industry and location.</p>
      </div>
      <JobForm />
      <JobsTable jobs={jobs} />
    </div>
  );
}
