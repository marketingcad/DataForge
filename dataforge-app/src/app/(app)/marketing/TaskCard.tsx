"use client";
import { Clock } from "lucide-react";

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
  const progress = myProgress?.callCount ?? 0;
  const pct = Math.min(100, Math.round((progress / task.targetCalls) * 100));
  const completed = myProgress?.completed ?? false;
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(task.endDate).getTime() - Date.now()) / 86400000)
  );

  return (
    <div className={`px-5 py-4 space-y-3 ${completed ? "opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            {completed && <span className="text-xs">✅</span>}
            <p className="text-sm font-semibold">{task.title}</p>
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {task.description}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs font-semibold text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded-full">
          +{task.pointReward} pts
        </span>
      </div>

      {!isBoss && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {progress} / {task.targetCalls} calls
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completed ? "bg-emerald-500" : "bg-primary"
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

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        {daysLeft === 0
          ? "Ends today"
          : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
      </div>
    </div>
  );
}
