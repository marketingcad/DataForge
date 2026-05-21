import { Button } from "@/components/ui/button";
import { IndustryBoard } from "@/components/leads/IndustryBoard";
import { GlobeSection } from "@/components/leads/GlobeSection";
import { LeadsEmptyState } from "@/components/leads/LeadsEmptyState";
import { getIndustries } from "@/lib/industry/service";
import { getFolders } from "@/lib/folders/service";
import { getLeads } from "@/lib/leads/service";
import { getLeadLocations } from "@/lib/leads/locations";
import { getUsers } from "@/lib/users/service";
import { auth } from "@/lib/auth";
import { withDbRetry } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!["boss", "admin", "lead_specialist"].includes(role)) redirect("/unauthorized");

  const isAdmin = role === "boss" || role === "admin";
  const sp = await searchParams;
  const filterUserId = typeof sp.filter === "string" ? sp.filter : undefined;
  const savedById = filterUserId || undefined;

  // All roles see all leads (no userId scoping) but may filter by savedById
  const scopedUserId = undefined;

  const [industries, allFolders, unfiledResult, locations, users] = await withDbRetry(() =>
    Promise.all([
      getIndustries(scopedUserId, savedById),
      getFolders(scopedUserId, savedById),
      getLeads({ folderId: "unfiled", pageSize: 1, savedById }),
      isAdmin ? getLeadLocations() : Promise.resolve([]),
      isAdmin ? getUsers().then((u) => u.filter((x) => x.role === "lead_specialist")) : Promise.resolve([]),
    ])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unfiledFolders = (allFolders as any[]).filter((f) => !f.industryId);

  const totalLeads =
    allFolders.reduce((sum: number, f: { _count: { leads: number } }) => sum + f._count.leads, 0) +
    unfiledResult.total;

  const isEmpty = industries.length === 0 && allFolders.length === 0 && unfiledResult.total === 0;

  const cookieStore = await cookies();
  const globeVisible = cookieStore.get("df-globe-visible")?.value !== "false";

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
        <div className="flex items-center gap-2">
          <Link href="/leads/new">
            <Button size="sm" variant="outline" className="gap-1.5">
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Globe — boss/admin only */}
      {isAdmin && locations.length > 0 && (
        <GlobeSection points={locations} defaultVisible={globeVisible} />
      )}

      <Separator />

      {isEmpty ? (
        <LeadsEmptyState
          userId={session.user.id!}
          savedById={savedById}
          folders={(allFolders as { id: string; name: string; industry?: { name: string } | null }[]).map((f) => ({
            id: f.id,
            name: f.name,
            industryName: f.industry?.name ?? null,
          }))}
          categories={(industries as { name: string }[]).map((ind) => ind.name)}
        />
      ) : (
        <IndustryBoard
          key={filterUserId ?? "all"}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          industries={industries as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          unfiledFolders={unfiledFolders as any}
          filterUserId={filterUserId}
          filterUsers={isAdmin && users.length > 0 ? users.map((u) => ({ id: u.id, name: u.name, email: u.email })) : undefined}
          userId={session.user.id!}
          csvFolders={(allFolders as { id: string; name: string; industry?: { name: string } | null }[]).map((f) => ({
            id: f.id,
            name: f.name,
            industryName: f.industry?.name ?? null,
          }))}
          csvCategories={(industries as { name: string }[]).map((ind) => ind.name)}
        />
      )}
    </div>
  );
}
