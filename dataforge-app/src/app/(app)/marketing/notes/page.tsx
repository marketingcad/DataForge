import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getNotesAction } from "@/actions/documents.actions";
import { NotesClient } from "./NotesClient";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const result = await getNotesAction();
  const notes = result.notes ?? [];

  const role = (session.user as { role?: string }).role ?? "";
  const isBossAdmin = ["boss", "admin"].includes(role);

  return (
    <NotesClient
      initialNotes={notes as Parameters<typeof NotesClient>[0]["initialNotes"]}
      isBossAdmin={isBossAdmin}
    />
  );
}
