"use client";

interface Task {
  id: string;
  title: string;
  description: string | null;
  targetCalls: number;
  pointReward: number;
  endDate: Date;
}

interface Progress {
  callCount: number;
  completed: boolean;
}

export function TaskCard({
  task,
  myProgress,
  teamCompleted,
  isBoss,
}: {
  task: Task;
  myProgress: Progress | null;
  teamCompleted: number | null;
  isBoss: boolean;
}) {
  const progress  = myProgress?.callCount ?? 0;
  const pct       = Math.min(100, Math.round((progress / task.targetCalls) * 100));
  const completed = myProgress?.completed ?? false;
  const daysLeft  = Math.max(
    0,
    Math.ceil((new Date(task.endDate).getTime() - Date.now()) / 86400000)
  );

  return (
    <div className={`px-5 py-4 space-y-3 ${completed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {completed && <span className="text-sm">✅</span>}
            <p className="text-sm font-bold truncate">{task.title}</p>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </div>
        <span className="shrink-0 text-xs font-bold text-violet-600 bg-violet-500/10 px-2.5 py-1 rounded-full whitespace-nowrap">
          +{task.pointReward} pts
        </span>
      </div>

      {!isBoss && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
            <span>{progress} / {task.targetCalls} calls</span>
            <span className={pct >= 100 ? "text-emerald-600 font-bold" : ""}>{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completed ? "bg-emerald-500" : "bg-gradient-to-r from-violet-500 to-violet-400"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {isBoss && teamCompleted !== null && (
        <p className="text-xs text-muted-foreground">
          {teamCompleted} rep{teamCompleted !== 1 ? "s" : ""} completed
        </p>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>⏰</span>
        {daysLeft === 0 ? "Ends today" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
      </div>
    </div>
  );
}
