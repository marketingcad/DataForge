"use client";

import { DocumentsClient } from "@/components/documents/DocumentsClient";
import type { DocItem } from "@/components/documents/DocumentsClient";

export function ScriptsClient({
  initialScripts,
  isBossAdmin,
}: {
  initialScripts: DocItem[];
  isBossAdmin: boolean;
}) {
  return (
    <DocumentsClient
      type="script"
      initialDocs={initialScripts}
      isBossAdmin={isBossAdmin}
      title="Call Scripts"
      emptyLabel="No scripts yet"
      emptyHint="Create call scripts to guide your team during outreach calls. Scripts are shared across all team members."
      newLabel="New Script"
      ownerLabel="script"
    />
  );
}
