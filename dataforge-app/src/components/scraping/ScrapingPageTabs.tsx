"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobForm } from "@/components/scraping/JobForm";
import { JobsTable } from "@/components/scraping/JobsTable";
import { DomainScrapeForm } from "@/components/scraping/DomainScrapeForm";
import { GoogleScrapeForm } from "@/components/scraping/GoogleScrapeForm";
import { KeywordsManager } from "@/components/scraping/KeywordsManager";
import { Globe, ScanSearch, Wand2 } from "lucide-react";

const VALID_TABS = ["domain", "google", "keywords"];

interface ScrapingPageTabsProps {
  canUseKeywords: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  keywords: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jobs: any[];
  canManageAll: boolean;
  currentUserId: string;
}

export function ScrapingPageTabs({ canUseKeywords, keywords, jobs, canManageAll, currentUserId }: ScrapingPageTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramTab = searchParams.get("tab");
  const activeTab =
    paramTab && VALID_TABS.includes(paramTab) && (paramTab !== "keywords" || canUseKeywords)
      ? paramTab
      : "domain";

  // If URL has no tab param, set it to the default so sidebar highlights correctly
  useEffect(() => {
    if (!paramTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "domain");
      router.replace(`/scraping?${params.toString()}`, { scroll: false });
    }
  }, [paramTab, router, searchParams]);

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`/scraping?${params.toString()}`, { scroll: false });
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <TabsList className="h-9">
        <TabsTrigger value="domain" className="flex items-center gap-1.5 text-sm">
          <Globe className="h-3.5 w-3.5" />
          Scrape a Website
        </TabsTrigger>
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
        <TabsContent value="keywords" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <KeywordsManager initial={keywords} canManageAll={canManageAll} currentUserId={currentUserId} />
        </TabsContent>
      )}
    </Tabs>
  );
}
