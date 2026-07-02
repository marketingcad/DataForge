import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getScriptsAction } from "@/actions/documents.actions";
import { assertFeatureEnabled } from "@/lib/features-guard";
import { ScriptsClient } from "./ScriptsClient";

export const dynamic = "force-dynamic";

export default async function ScriptsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");
  await assertFeatureEnabled("scripts");

  const result = await getScriptsAction();
  const scripts = result.scripts ?? [];

  const role = (session.user as { role?: string }).role ?? "";
  const isBossAdmin = ["boss", "admin"].includes(role);

  return (
    <ScriptsClient
      initialScripts={scripts as Parameters<typeof ScriptsClient>[0]["initialScripts"]}
      isBossAdmin={isBossAdmin}
    />
  );
}
