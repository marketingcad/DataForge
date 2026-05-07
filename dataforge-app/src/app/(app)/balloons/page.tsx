import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getMyPopsAction } from "@/actions/balloons.actions";
import { BalloonGrid } from "./BalloonGrid";

export const dynamic = "force-dynamic";

export default async function BalloonsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as { role?: string }).role ?? "";
  if (!["sales_rep", "team_lead", "boss", "admin"].includes(role)) redirect("/dashboard");

  const userId = session.user.id!;

  const isRepOrLead = ["sales_rep", "team_lead"].includes(role);

  const [balloons, dbUser, myPops] = await Promise.all([
    prisma.balloon.findMany({
      orderBy: { position: "asc" },
      include: { poppedBy: { select: { id: true, name: true, nickname: true } } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { balloonPoints: true, balloonSuspendedUntil: true, name: true, nickname: true },
    }),
    isRepOrLead ? getMyPopsAction() : Promise.resolve([]),
  ]);

  const isSuspended = dbUser?.balloonSuspendedUntil && dbUser.balloonSuspendedUntil > new Date();

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {["boss", "admin"].includes(role) ? (
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tight">🎈 Balloon Pop</h1>
          <Link
            href="/admin/balloons"
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold px-3 py-1.5 transition-colors"
          >
            ⚙️ Manage Balloons
          </Link>
        </div>
      ) : (
        <div>
          <h1 className="text-xl font-black tracking-tight">🎈 Balloon Pop</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Book appointments to earn balloon points. Spend points to pop balloons and win prizes!
          </p>
        </div>
      )}

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
        readOnly={["boss", "admin"].includes(role)}
        myPops={myPops as Parameters<typeof BalloonGrid>[0]["myPops"]}
      />
    </div>
  );
}
