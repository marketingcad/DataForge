"use client";

import { useMigration } from "@/contexts/MigrationContext";

export function GhlMigrationModal() {
  const { state, stop, minimize, restore, dismiss } = useMigration();

  if (!state.active || state.minimized) return null;

  const pct = state.total > 0 ? Math.round(((state.done + state.errors) / state.total) * 100) : 0;
  const isFinished = !state.running && state.active;

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-card shadow-2xl border border-border/60 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <span className="text-lg">🔗</span>
              {state.running && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">
                {isFinished ? "Migration Complete" : "Migrating to GoHighLevel"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {state.folderName}
              </p>
            </div>
            {!isFinished && (
              <button
                onClick={minimize}
                className="text-xs text-muted-foreground hover:text-foreground font-medium px-2 py-1 rounded-lg hover:bg-muted/40 transition-colors"
                title="Run in background"
              >
                Minimize
              </button>
            )}
          </div>
        </div>

        {/* Progress section */}
        <div className="px-6 py-5 space-y-4">

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {state.done + state.errors} of {state.total} leads processed
              </span>
              <span className="font-bold tabular-nums">{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFinished && state.errors === 0
                    ? "bg-emerald-500"
                    : isFinished
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-violet-500 to-indigo-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
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
              <p className="text-lg font-black tabular-nums">
                {state.total - state.done - state.errors}
              </p>
              <p className="text-[10px] text-muted-foreground font-semibold">Remaining</p>
            </div>
          </div>

          {/* Current lead being processed */}
          {state.current && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
              <p className="text-xs text-muted-foreground truncate">
                Processing: <span className="font-semibold text-foreground">{state.current}</span>
              </p>
            </div>
          )}

          {/* Results scroll list */}
          {state.results.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-border/40 divide-y divide-border/30">
              {[...state.results].reverse().map((r) => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2">
                  <span className={`text-sm shrink-0 ${r.success ? "text-emerald-500" : "text-red-500"}`}>
                    {r.success ? "✓" : "✗"}
                  </span>
                  <p className="text-xs font-medium truncate flex-1">{r.name}</p>
                  {!r.success && r.error && (
                    <p className="text-[10px] text-red-500 shrink-0 max-w-[120px] truncate">{r.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-5 flex gap-3">
          {!isFinished ? (
            <>
              <button
                onClick={minimize}
                className="flex-1 rounded-xl border border-border/60 py-2.5 text-sm font-semibold hover:bg-muted/40 transition-colors"
              >
                Run in Background
              </button>
              <button
                onClick={stop}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white py-2.5 text-sm font-bold transition-colors"
              >
                Stop Migration
              </button>
            </>
          ) : (
            <button
              onClick={dismiss}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-2.5 text-sm font-bold transition-colors"
            >
              {state.errors === 0
                ? `Done — ${state.done} lead${state.done !== 1 ? "s" : ""} migrated ✓`
                : `Done — ${state.done} migrated, ${state.errors} failed`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
