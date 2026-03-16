import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeadTable } from "@/components/leads/LeadTable";
import { LeadFilters } from "@/components/leads/LeadFilters";
import { LeadPagination } from "@/components/leads/LeadPagination";
import { getLeads } from "@/lib/services/leads.service";
import { Plus } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

function getString(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const result = await getLeads({
    search: getString(params.search),
    industry: getString(params.industry),
    state: getString(params.state),
    status: getString(params.status),
    page: Number(getString(params.page)) || 1,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {result.total} total leads in database
          </p>
        </div>
        <Link href="/leads/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </Link>
      </div>

      {/* Filters */}
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
