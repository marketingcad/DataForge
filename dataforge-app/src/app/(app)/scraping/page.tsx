import { getJobs } from "@/lib/scraping/jobs/service";
import { getKeywords } from "@/lib/keywords/service";
import { JobForm } from "@/components/scraping/JobForm";
import { JobsTable } from "@/components/scraping/JobsTable";
import { DomainScrapeForm } from "@/components/scraping/DomainScrapeForm";
import { GoogleScrapeForm } from "@/components/scraping/GoogleScrapeForm";
import { KeywordsManager } from "@/components/scraping/KeywordsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Globe, Layers, ScanSearch, Wand2 } from "lucide-react";
import { withDbRetry } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const KEYWORD_ROLES = ["boss", "admin", "lead_data_analyst"];

export default async function ScrapingPage() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  const canUseKeywords = role ? KEYWORD_ROLES.includes(role) : false;

  const [{ jobs }, keywords] = await Promise.all([
    withDbRetry(() => getJobs({})).catch(() => ({ jobs: [] })),
    canUseKeywords ? withDbRetry(() => getKeywords()).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Scraping</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Collect leads from websites, bulk industry search, or Google results.
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="domain" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="domain" className="flex items-center gap-1.5 text-sm">
            <Globe className="h-3.5 w-3.5" />
            Scrape a Website
          </TabsTrigger>
          {/* <TabsTrigger value="bulk" className="flex items-center gap-1.5 text-sm">
            <Layers className="h-3.5 w-3.5" />
            Bulk by Industry
          </TabsTrigger> */}
          <TabsTrigger value="google" className="flex items-center gap-1.5 text-sm">
            <ScanSearch className="h-3.5 w-3.5" />
            Search by Google
          </TabsTrigger>
          {canUseKeywords && (
            <TabsTrigger value="keywords" className="flex items-center gap-1.5 text-sm">
              <Wand2 className="h-3.5 w-3.5" />
              Auto Keywords
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="domain">
          <DomainScrapeForm />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <JobForm />
          <JobsTable jobs={jobs} />
        </TabsContent>

        <TabsContent value="google" className="mt-0" style={{ height: "calc(100vh - 14rem)" }}>
          <GoogleScrapeForm />
        </TabsContent>

        {canUseKeywords && (
          <TabsContent value="keywords" className="space-y-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <KeywordsManager initial={keywords as any} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
