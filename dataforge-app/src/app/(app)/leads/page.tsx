import { Button } from "@/components/ui/button";
import { IndustryBoard } from "@/components/leads/IndustryBoard";
import { LeadsGlobe } from "@/components/leads/LeadsGlobe";
import { getIndustries } from "@/lib/industry/service";
import { getFolders } from "@/lib/folders/service";
import { getLeads } from "@/lib/leads/service";
import { getLeadLocations } from "@/lib/leads/locations";
import { auth } from "@/lib/auth";
import { withDbRetry } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default async function LeadsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!["boss", "admin", "lead_specialist"].includes(role)) redirect("/unauthorized");

  const isAdmin = role === "boss" || role === "admin";

  // Boss/admin see all data; lead_specialist sees only their own
  const scopedUserId = isAdmin ? undefined : session.user.id ?? undefined;

  const [industries, allFolders, unfiledResult, locations] = await withDbRetry(() =>
    Promise.all([
      getIndustries(scopedUserId),
      getFolders(scopedUserId),
      getLeads({ folderId: "unfiled", pageSize: 1 }),
      isAdmin ? getLeadLocations() : Promise.resolve([]),
    ])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unfiledFolders = (allFolders as any[]).filter((f) => !f.industryId);

  const totalLeads =
    allFolders.reduce((sum: number, f: { _count: { leads: number } }) => sum + f._count.leads, 0) +
    unfiledResult.total;

  const isEmpty = industries.length === 0 && allFolders.length === 0 && unfiledResult.total === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalLeads.toLocaleString()} total leads · {industries.length} industr{industries.length !== 1 ? "ies" : "y"} · {allFolders.length} folder{allFolders.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/leads/new">
          <Button size="sm" variant="outline" className="gap-1.5">
            Add Lead
          </Button>
        </Link>
      </div>

      {/* Globe — boss/admin only */}
      {isAdmin && locations.length > 0 && (
        <LeadsGlobe points={locations} />
      )}

      <Separator />

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Building2 className="h-14 w-14 text-muted-foreground/20" />
          <p className="text-sm font-medium">No leads yet</p>
          <p className="text-sm max-w-xs text-center">
            Scrape leads from Google — they will appear here organized by industry and folder.
          </p>
          <Link href="/scraping">
            <Button size="sm" variant="outline" className="mt-2">Go to Scraping</Button>
          </Link>
        </div>
      ) : (
        <IndustryBoard
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          industries={industries as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unfiledFolders={unfiledFolders as any}
        />
      )}
    </div>
  );
}
