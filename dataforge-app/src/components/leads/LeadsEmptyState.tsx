"use client";

import { useState } from "react";
import { Building2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CsvImportDialog } from "./CsvImportDialog";

interface Props {
  userId: string;
  savedById?: string;
  folders: { id: string; name: string; industryName: string | null }[];
  categories: string[];
}

export function LeadsEmptyState({ userId, savedById, folders, categories }: Props) {
  const [csvOpen, setCsvOpen] = useState(false);

  if (savedById) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Building2 className="h-14 w-14 text-muted-foreground/20" />
        <p className="text-sm font-medium">No leads found for this user</p>
        <p className="text-sm max-w-xs text-center">This user hasn&apos;t saved any leads yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Building2 className="h-14 w-14 text-muted-foreground/20" />
        <p className="text-sm font-medium">No leads yet</p>
        <p className="text-sm max-w-xs text-center">
          Add leads manually, import from CSV, or scrape them from Google Maps.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Link href="/leads/new">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Lead
            </Button>
          </Link>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCsvOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </Button>
          <Link href="/scraping">
            <Button size="sm" variant="ghost">Go to Scraping</Button>
          </Link>
        </div>
      </div>

      <CsvImportDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        folders={folders.map((f) => ({ id: f.id, name: f.name, industryName: f.industryName }))}
        userId={userId}
        categories={categories}
      />
    </>
  );
}
