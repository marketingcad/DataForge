import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getAgentProfile } from "@/lib/marketing/agent.service";
import { getSettings } from "@/lib/settings/service";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/enums";
import { ProfileView } from "./ProfileView";

export default async function MyProfilePage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  const userId = session.user.id!;

  const [data, settings] = await Promise.all([
    withDbRetry(() => getAgentProfile(userId)),
    getSettings(),
  ]);

  // For sales reps, compute leaderboard rankings
  let rankings: {
    entries: { id: string; name: string | null; email: string; appointmentsSet: number; points: number; rank: number }[];
    myRank: number;
    total: number;
    myEntry: { id: string; name: string | null; email: string; appointmentsSet: number; points: number; rank: number } | null;
  } | null = null;

  if (role === "sales_rep") {
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
    const ranked = allReps
      .map((r) => ({ ...r, appointmentsSet: apptMap[r.id] ?? 0 }))
      .sort((a, b) => b.appointmentsSet - a.appointmentsSet || b.points - a.points)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const myRankIdx = ranked.findIndex((r) => r.id === userId);
    rankings = {
      entries: ranked.slice(0, 5),
      myRank: myRankIdx + 1,
      total: ranked.length,
      myEntry: ranked[myRankIdx] ?? null,
    };
  }

  return (
    <ProfileView
      data={data}
      isOwn
      currency={settings.commissionCurrency ?? "₱"}
      rankings={rankings}
    />
  );
}
