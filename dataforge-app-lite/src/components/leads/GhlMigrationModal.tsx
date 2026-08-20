"use client";

import { Link2 } from "lucide-react";
import { useMigration } from "@/contexts/MigrationContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function GhlMigrationModal() {
  const { state, stop, minimize, dismiss } = useMigration();

  const pct = state.total > 0 ? Math.round(((state.done + state.errors) / state.total) * 100) : 0;
  const isFinished = !state.running && state.active;

  return (
    <Dialog open={state.active && !state.minimized} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" showCloseButton={false}>

        <DialogHeader>
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className="relative h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <Link2 className="h-4 w-4 text-violet-500" />
              {state.running && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>

            {/* Title + folder name */}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-bold leading-none">
                {isFinished ? "Migration Complete" : "Migrating to GoHighLevel"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5 font-normal">
                {state.folderName}
              </p>
            </div>

            {/* Minimize */}
            {!isFinished && (
              <Button
                variant="ghost"
                size="sm"
                onClick={minimize}
                className="text-xs text-muted-foreground shrink-0"
              >
                Minimize
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Progress section */}
        <div className="space-y-4">

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {state.done + state.errors} of {state.total} leads processed
              </span>
              <span className="font-bold tabular-nums">{pct}%</span>
            </div>
            <Progress
              value={pct}
              className={
                isFinished && state.errors === 0
                  ? "[&>div]:bg-emerald-500"
                  : isFinished
                  ? "[&>div]:bg-amber-500"
                  : ""
              }
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-emerald-500/10 py-2.5">
              <p className="text-lg font-black text-emerald-600 tabular-nums">{state.done}</p>
              <p className="text-[10px] text-muted-foreground font-semibold">Migrated</p>
            </div>
            <div className="rounded-xl bg-red-500/10 py-2.5">
              <p className="text-lg font-black text-red-600 tabular-nums">{state.errors}</p>
              <p className="text-[10px] text-muted-foreground font-semibold">Errors</p>
            </div>
            <div className="rounded-xl bg-muted/40 py-2.5">
              <p className="text-lg font-black text-foreground tabular-nums">
                {state.total - state.done - state.errors}
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold">Remaining</p>
            </div>
          </div>

          {/* Current lead */}
          {state.current && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
              <p className="text-xs text-muted-foreground truncate">
                Processing: <span className="font-semibold text-foreground">{state.current}</span>
              </p>
            </div>
          )}

          {/* Results list */}
          {state.results.length > 0 && (
            <ScrollArea className="h-40 rounded-xl border border-border/40">
              <div className="divide-y divide-border/30">
                {[...state.results].reverse().map((r) => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                    <span className={`text-sm shrink-0 ${r.success ? "text-emerald-500" : "text-red-500"}`}>
                      {r.success ? "✓" : "✗"}
                    </span>
                    <p className="text-xs font-medium truncate flex-1">{r.name}</p>
                    {!r.success && r.error && (
                      <Badge variant="destructive" className="text-[10px] max-w-[120px] truncate shrink-0 font-normal">
                        {r.error}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          {!isFinished ? (
            <>
              <Button variant="outline" className="flex-1" onClick={minimize}>
                Run in Background
              </Button>
              <Button variant="destructive" className="flex-1" onClick={stop}>
                Stop Migration
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={dismiss}>
              {state.errors === 0
                ? `Done — ${state.done} lead${state.done !== 1 ? "s" : ""} migrated ✓`
                : `Done — ${state.done} migrated, ${state.errors} failed`}
            </Button>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
