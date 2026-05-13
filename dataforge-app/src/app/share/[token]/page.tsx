import { getSharedDocAction } from "@/actions/documents.actions";
import { SharedDocViewer } from "./SharedDocViewer";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SharedDocPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getSharedDocAction(token);

  if ("error" in result) notFound();

  const { type, doc } = result;
  const ownerName =
    type === "note"
      ? (doc as { user?: { nickname?: string | null; name?: string | null } | null }).user?.nickname ??
        (doc as { user?: { name?: string | null } | null }).user?.name ??
        null
      : (doc as { createdBy?: { nickname?: string | null; name?: string | null } | null }).createdBy?.nickname ??
        (doc as { createdBy?: { name?: string | null } | null }).createdBy?.name ??
        null;

  return (
    <SharedDocViewer
      title={doc.title}
      content={doc.content as object}
      files={doc.files}
      ownerName={ownerName}
      type={type}
    />
  );
}
