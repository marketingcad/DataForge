import { getJobs } from "@/lib/scraping/jobs/service";
import { getKeywords } from "@/lib/keywords/service";
import { ScrapingPageTabs } from "@/components/scraping/ScrapingPageTabs";
import { Separator } from "@/components/ui/separator";
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

      <ScrapingPageTabs
        canUseKeywords={canUseKeywords}
        keywords={keywords as never[]}
        jobs={jobs}
      />
    </div>
  );
}
