import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeadTable } from "@/components/leads/LeadTable";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { LeadPagination } from "@/components/leads/LeadPagination";
import { FolderFilter } from "@/components/leads/FolderFilter";
import { DeleteAllUnfiledButton } from "@/components/leads/DeleteAllUnfiledButton";
import { getLeads } from "@/lib/leads/service";
import { getFolders } from "@/lib/folders/service";
import { getCategoryGrants, hasFullLeadAccess, canSeeCategory } from "@/lib/leads/access";
import { auth } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus } from "lucide-react";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export default async function LeadsListPage({ searchParams }: PageProps) {
  const [params, session] = await Promise.all([searchParams, auth()]);
  if (!session) redirect("/sign-in");
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!["boss", "admin", "lead_specialist"].includes(role)) redirect("/unauthorized");

  const folderId = getString(params.folder);

  // Lead specialists only see leads in categories granted to them.
  const grants = hasFullLeadAccess(role) ? null : await getCategoryGrants(session.user.id!);

  const [result, allFolders] = await Promise.all([
    getLeads({
      search: getString(params.search),
      industry: getString(params.industry),
      location: getString(params.location),
      status: getString(params.status),
      folderId,
      page: Number(getString(params.page)) || 1,
      pageSize: 20,
      ...(grants ? { access: grants } : {}),
    }),
    getFolders(),
  ]);

  // Only offer folder filters the user is allowed to see.
  const folders = grants
    ? allFolders.filter((f) => canSeeCategory(grants, f.industryId ?? null))
    : allFolders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/leads">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Folders
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">All Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {result.total.toLocaleString()} leads
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {folderId === "unfiled" && result.total > 0 && hasFullLeadAccess(role) && (
            <DeleteAllUnfiledButton count={result.total} />
          )}
          <Link href="/leads/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      <Suspense>
        <FolderFilter folders={folders} activeFolderId={folderId} />
      </Suspense>

      <Suspense>
        <LeadFilters />
      </Suspense>

      <LeadTable leads={result.leads} />

      <Suspense>
        <LeadPagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
        />
      </Suspense>
    </div>
  );
}
