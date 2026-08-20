import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getAgentProfile } from "@/lib/marketing/agent.service";
import { getSettings } from "@/lib/settings/service";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { ProfileView } from "@/app/(app)/profile/ProfileView";
import { AdminActionsPanel } from "./AdminActionsPanel";
import type { Role } from "@/lib/rbac/roles";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const actorRole = session.user.role as Role;
  if (!["boss", "admin"].includes(actorRole)) redirect("/dashboard");

  const { id } = await params;

  const [data, settings] = await Promise.all([
    withDbRetry(() => getAgentProfile(id)),
    getSettings(),
  ]);

  const userRole = (data.user as unknown as { role?: string }).role ?? "";

  let rankings: {
    entries: { id: string; name: string | null; email: string; appointmentsSet: number; points: number; rank: number }[];
    myRank: number;
    total: number;
    myEntry: { id: string; name: string | null; email: string; appointmentsSet: number; points: number; rank: number } | null;
  } | null = null;

  if (userRole === "sales_rep") {
    const [allReps, apptCounts] = await Promise.all([
      prisma.user.findMany({
        where: { role: UserRole.sales_rep },
        select: { id: true, name: true, email: true, points: true },
      }),
      prisma.bookedAppointment.groupBy({
        by: ["agentId"],
        where: { agent: { role: UserRole.sales_rep } },
        _count: { id: true },
      }),
    ]);

    const apptMap = Object.fromEntries(apptCounts.map((c) => [c.agentId, c._count.id]));
    const ranked  = allReps
      .map((r) => ({ ...r, appointmentsSet: apptMap[r.id] ?? 0 }))
      .sort((a, b) => b.appointmentsSet - a.appointmentsSet || b.points - a.points)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const myRankIdx = ranked.findIndex((r) => r.id === id);
    rankings = {
      entries: ranked.slice(0, 5),
      myRank:  myRankIdx + 1,
      total:   ranked.length,
      myEntry: ranked[myRankIdx] ?? null,
    };
  }

  const user = data.user as unknown as {
    id: string; name: string | null; nickname: string | null; email: string;
    isBanned: boolean; bannedUntil: Date | null; banReason: string | null;
    ghlUserId: string | null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <AdminActionsPanel
        userId={id}
        userName={user.name}
        userEmail={user.email}
        userRole={userRole}
        userNickname={user.nickname}
        userGhlUserId={user.ghlUserId}
        actorRole={actorRole}
        isCurrentUser={id === session.user.id}
        isBanned={user.isBanned}
        bannedUntil={user.bannedUntil}
        banReason={user.banReason}
      />
      <ProfileView
        data={data}
        isOwn={false}
        currency={settings.commissionCurrency ?? "₱"}
        rankings={rankings}
      />
    </div>
  );
}
