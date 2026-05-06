import { prisma } from "@/lib/prisma";
import Link from "next/link";

export async function BalloonPopFeed() {
  const recentPops = await prisma.balloon.findMany({
    where: { isPopped: true },
    orderBy: { poppedAt: "desc" },
    take: 8,
    include: { poppedBy: { select: { name: true, nickname: true } } },
  });

  function timeAgo(date: Date) {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }

  function initials(name: string | null) {
    if (!name) return "?";
    return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  }

  return (
    <div className="rounded-2xl bg-card shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <div>
          <p className="font-bold text-sm flex items-center gap-2">
            🎈 Balloon Pop Feed
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Latest prizes won by the team</p>
        </div>
        <Link
          href="/admin/balloons"
          className="text-xs text-primary hover:underline font-medium shrink-0"
        >
          Manage →
        </Link>
      </div>

      <div className="flex-1 divide-y divide-border/30 overflow-y-auto">
        {recentPops.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-2xl mb-2">🎈</p>
            <p className="text-sm text-muted-foreground">No balloons popped yet!</p>
            <p className="text-xs text-muted-foreground mt-1">Set prizes and let reps start popping.</p>
          </div>
        ) : (
          recentPops.map((pop) => {
            const name = pop.poppedBy?.nickname ?? pop.poppedBy?.name ?? "Unknown";
            return (
              <div key={pop.id} className="flex items-center gap-3 px-4 py-3">
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm">
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">🎉 {pop.prize}</p>
                </div>
                <p className="text-[10px] text-muted-foreground shrink-0">
                  {pop.poppedAt ? timeAgo(pop.poppedAt) : ""}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
        <p className="text-[10px] text-muted-foreground text-center">
          {recentPops.length} balloon{recentPops.length !== 1 ? "s" : ""} popped total
        </p>
      </div>
    </div>
  );
}
