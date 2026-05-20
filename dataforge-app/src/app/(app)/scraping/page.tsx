import { getJobs } from "@/lib/scraping/jobs/service";
import { getKeywords } from "@/lib/keywords/service";
import { Separator } from "@/components/ui/separator";
import { withDbRetry } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ScrapingPageTabsClient } from "@/components/scraping/ScrapingPageTabsClient";

const SCRAPING_ROLES = ["boss", "admin", "lead_specialist"];
const KEYWORD_ROLES = ["boss", "admin"];

export default async function ScrapingPage() {
  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  if (!role || !SCRAPING_ROLES.includes(role)) redirect("/unauthorized");
  const canUseKeywords = KEYWORD_ROLES.includes(role);

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

      <ScrapingPageTabsClient
        canUseKeywords={canUseKeywords}
        keywords={keywords as never[]}
        jobs={jobs}
      />
    </div>
  );
}
