"use client";

import { useMigration } from "@/contexts/MigrationContext";

/**
 * Shows a live migration indicator in the header when running in background.
 * Clicking it restores the migration modal.
 */
export function MigrationStatusBadge() {
  const { state, restore, dismiss } = useMigration();

  // Only show when active AND minimized
  if (!state.active || !state.minimized) return null;

  const pct = state.total > 0 ? Math.round(((state.done + state.errors) / state.total) * 100) : 0;
  const isFinished = !state.running;

  return (
    <button
      onClick={restore}
      className={`
        group relative flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold
        transition-all border
        ${isFinished
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20"
          : "bg-violet-500/10 border-violet-500/20 text-violet-600 hover:bg-violet-500/20"
        }
      `}
      title="Click to view migration progress"
    >
      {/* Animated dot (only while running) */}
      {!isFinished && (
        <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
      )}

      <span>
        {isFinished
          ? `GHL ✓ ${state.done}/${state.total}`
          : `GHL ${state.done}/${state.total} (${pct}%)`}
      </span>

      {/* Dismiss button */}
      <span
        role="button"
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        className="ml-0.5 opacity-50 group-hover:opacity-100 hover:text-foreground transition-opacity"
        title="Dismiss"
      >
        ✕
      </span>
    </button>
  );
}
