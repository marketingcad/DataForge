import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getAgentProfile } from "@/lib/marketing/agent.service";
import { ProfileView } from "./ProfileView";

export default async function MyProfilePage() {
  const session = await auth();
  if (!session) redirect("/sign-in");
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!["boss", "admin", "sales_rep"].includes(role)) redirect("/unauthorized");

  const data = await withDbRetry(() => getAgentProfile(session.user.id!));
  return <ProfileView data={data} isOwn />;
}
