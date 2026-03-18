import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getAgentProfile } from "@/lib/marketing/agent.service";
import { ProfileView } from "../ProfileView";

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/sign-in");
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!["boss", "admin"].includes(role)) redirect("/unauthorized");

  const { id } = await params;
  const data = await withDbRetry(() => getAgentProfile(id));
  return <ProfileView data={data} isOwn={false} />;
}
