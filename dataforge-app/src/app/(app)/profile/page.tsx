import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getAgentProfile } from "@/lib/marketing/agent.service";
import { getSettings } from "@/lib/settings/service";
import { prisma } from "@/lib/prisma";
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
    entries: { id: string; name: string | null; email: string; totalCalls: number; points: number; rank: number }[];
    myRank: number;
    total: number;
  } | null = null;

  if (role === "sales_rep") {
    const [allReps, callCounts] = await Promise.all([
      prisma.user.findMany({
        where: { role: "sales_rep" },
        select: { id: true, name: true, email: true, points: true },
      }),
      prisma.callLog.groupBy({
        by: ["agentId"],
        _count: { id: true },
      }),
    ]);

    const callMap = Object.fromEntries(callCounts.map((c) => [c.agentId, c._count.id]));
    const ranked = allReps
      .map((r) => ({ ...r, totalCalls: callMap[r.id] ?? 0 }))
      .sort((a, b) => b.totalCalls - a.totalCalls || b.points - a.points)
      .map((r, i) => ({ ...r, rank: i + 1 }));

    const myRankIdx = ranked.findIndex((r) => r.id === userId);
    rankings = {
      entries: ranked.slice(0, 5),
      myRank: myRankIdx + 1,
      total: ranked.length,
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
