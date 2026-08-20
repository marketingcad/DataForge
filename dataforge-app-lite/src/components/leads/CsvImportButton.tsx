"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CsvImportDialog } from "./CsvImportDialog";

type Folder = { id: string; name: string; industryName?: string | null };

interface Props {
  folders: Folder[];
  userId: string;
}

export function CsvImportButton({ folders, userId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" />
        Import CSV
      </Button>
      <CsvImportDialog open={open} onClose={() => setOpen(false)} folders={folders} userId={userId} />
    </>
  );
}
