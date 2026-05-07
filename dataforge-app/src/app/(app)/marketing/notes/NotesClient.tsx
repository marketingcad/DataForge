"use client";

import { DocumentsClient } from "@/components/documents/DocumentsClient";
import type { DocItem } from "@/components/documents/DocumentsClient";

export function NotesClient({
  initialNotes,
  isBossAdmin,
}: {
  initialNotes: DocItem[];
  isBossAdmin: boolean;
}) {
  return (
    <DocumentsClient
      type="note"
      initialDocs={initialNotes}
      isBossAdmin={isBossAdmin}
      title="Notes"
      emptyLabel="No notes yet"
      emptyHint="Create a note to capture ideas, meeting recaps, or anything you need."
      newLabel="New Note"
      ownerLabel="note"
    />
  );
}
