import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeadTable } from "@/components/leads/LeadTable";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { LeadPagination } from "@/components/leads/LeadPagination";
import { FolderFilter } from "@/components/leads/FolderFilter";
import { getLeads } from "@/lib/services/leads.service";
import { getFolders } from "@/lib/services/folders.service";
import { auth } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const [params, session] = await Promise.all([searchParams, auth()]);

  const folderId = getString(params.folder);

  const [result, folders] = await Promise.all([
    getLeads({
      search: getString(params.search),
      industry: getString(params.industry),
      state: getString(params.state),
      status: getString(params.status),
      folderId,
      page: Number(getString(params.page)) || 1,
      pageSize: 20,
    }),
    session?.user?.id ? getFolders(session.user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {result.total.toLocaleString()} total leads in database
          </p>
        </div>
        <Link href="/leads/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </Link>
      </div>

      <Separator />

      {/* Folder filter pills */}
      <Suspense>
        <FolderFilter folders={folders} activeFolderId={folderId} />
      </Suspense>

      {/* Search / column filters */}
      <Suspense>
        <LeadFilters />
      </Suspense>

      {/* Table */}
      <LeadTable leads={result.leads} />

      {/* Pagination */}
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
