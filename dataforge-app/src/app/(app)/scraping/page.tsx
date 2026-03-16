import { getJobs } from "@/lib/services/scraping.service";
import { JobForm } from "@/components/scraping/JobForm";
import { JobsTable } from "@/components/scraping/JobsTable";
import { DomainScrapeForm } from "@/components/scraping/DomainScrapeForm";
import { GoogleScrapeForm } from "@/components/scraping/GoogleScrapeForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Search, ScanSearch } from "lucide-react";

export default async function ScrapingPage() {
  const { jobs } = await getJobs({});

  return (
    <div className="space-y-6">
      <Tabs defaultValue="domain">
        <TabsList className="mb-4">
          <TabsTrigger value="domain" className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" />
            Scrape a Website
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-1.5">
            <Search className="h-4 w-4" />
            Bulk by Industry
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center gap-1.5">
            <ScanSearch className="h-4 w-4" />
            Search by Google
          </TabsTrigger>
        </TabsList>

        <TabsContent value="domain">
          <DomainScrapeForm />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-6">
          <JobForm />
          <JobsTable jobs={jobs} />
        </TabsContent>

        <TabsContent value="google" className="mt-0" style={{ height: "calc(100vh - 10rem)" }}>
          <GoogleScrapeForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
