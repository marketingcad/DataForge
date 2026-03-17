import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FolderBoard } from "@/components/leads/FolderBoard";
import { getFolders } from "@/lib/services/folders.service";
import { getLeads } from "@/lib/services/leads.service";
import { auth } from "@/lib/auth";
import { Folder, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default async function LeadsPage() {
  const session = await auth();

  const [folders, unfiledResult] = await Promise.all([
    session?.user?.id ? getFolders(session.user.id) : Promise.resolve([]),
    getLeads({ folderId: "unfiled", pageSize: 1 }),
  ]);

  const totalLeads =
    folders.reduce((sum, f) => sum + f._count.leads, 0) + unfiledResult.total;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalLeads.toLocaleString()} total leads · {folders.length} folder{folders.length !== 1 ? "s" : ""}
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

      {/* Empty state */}
      {folders.length === 0 && unfiledResult.total === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
          <Folder className="h-14 w-14 text-muted-foreground/20" />
          <p className="text-sm font-medium">No leads yet</p>
          <p className="text-xs max-w-xs text-center">
            Scrape leads from Google — they will appear here organized by folder.
          </p>
          <Link href="/scraping">
            <Button size="sm" variant="outline" className="mt-2">Go to Scraping</Button>
          </Link>
        </div>
      ) : (
        <FolderBoard
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          folders={folders as any}
          unfiledCount={unfiledResult.total}
        />
      )}
    </div>
  );
}
