import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BalloonGrid } from "./BalloonGrid";

export const dynamic = "force-dynamic";

export default async function BalloonsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as { role?: string }).role ?? "";
  if (!["sales_rep", "team_lead"].includes(role)) redirect("/dashboard");

  const userId = session.user.id!;

  const [balloons, dbUser] = await Promise.all([
    prisma.balloon.findMany({
      orderBy: { position: "asc" },
      include: { poppedBy: { select: { id: true, name: true, nickname: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { balloonPoints: true, balloonSuspendedUntil: true, name: true, nickname: true },
    }),
  ]);

  const isSuspended = dbUser?.balloonSuspendedUntil && dbUser.balloonSuspendedUntil > new Date();

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-black tracking-tight">🎈 Balloon Pop</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Book appointments to earn balloon points. Spend points to pop balloons and win prizes!
        </p>
      </div>

      {isSuspended && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-5 py-4">
          <p className="text-sm font-bold text-destructive">You are suspended from popping balloons.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Suspension lifts on {dbUser?.balloonSuspendedUntil?.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.
          </p>
        </div>
      )}

      <BalloonGrid
        initialBalloons={balloons as Parameters<typeof BalloonGrid>[0]["initialBalloons"]}
        myPoints={dbUser?.balloonPoints ?? 0}
        myId={userId}
        myName={dbUser?.nickname ?? dbUser?.name ?? null}
      />
    </div>
  );
}
