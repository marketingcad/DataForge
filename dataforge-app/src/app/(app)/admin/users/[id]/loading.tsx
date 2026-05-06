import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUserDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-4">

      {/* ── Admin toolbar card ── */}
      <div className="rounded-2xl border border-border/40 bg-card shadow-sm px-5 py-3.5 flex items-center gap-3">
        <Skeleton className="h-4 w-16" />
        <span className="text-border">·</span>
        <Skeleton className="h-3.5 w-28" />
        <div className="ml-auto flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-lg" />
          ))}
        </div>
      </div>

      {/* ── Profile header card ── */}
      <div className="rounded-2xl overflow-hidden border border-border/40 bg-card shadow-sm">
        {/* Banner */}
        <Skeleton className="h-28 w-full rounded-none" />

        <div className="px-6 pb-5 relative">
          {/* Avatar row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-9 mb-4 gap-3">
            <Skeleton className="h-[72px] w-[72px] rounded-full border-4 border-card shrink-0" />
            <div className="flex gap-2 sm:pb-1">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>

          {/* Name + role */}
          <Skeleton className="h-7 w-48 mb-1.5" />
          <Skeleton className="h-4 w-36 mb-2" />

          {/* Meta row */}
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0 border-t border-border/40 px-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Overview content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">

        {/* Left column */}
        <div className="space-y-4 min-w-0">

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/40 bg-card shadow-sm px-4 py-4 space-y-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-14" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>

          {/* Call activity chart */}
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-1 text-right">
                <Skeleton className="h-3 w-20 ml-auto" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            </div>
            {/* Bar chart placeholder */}
            <div className="flex items-end gap-[3px] h-[180px] pt-4">
              {Array.from({ length: 30 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{ height: `${20 + Math.sin(i * 0.6) * 30 + Math.random() * 40}%` }}
                />
              ))}
            </div>
          </div>

          {/* Performance breakdown */}
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-4">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Right column — leaderboard */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm p-5 space-y-4">
            <Skeleton className="h-4 w-32" />
            <div className="space-y-1.5">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-3 w-24 mx-auto" />
            </div>
            {/* Top 5 rep rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3.5 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
