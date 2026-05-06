"use client";

import { useState, useTransition } from "react";
import {
  setBalloonPrizeAction,
  resetBalloonAction,
  resetAllBalloonsAction,
  adjustBalloonPointsAction,
  setBalloonSuspensionAction,
} from "@/actions/balloons.actions";
import { RotateCcw, Trophy, Plus, Minus, Ban, CheckCircle } from "lucide-react";

type Balloon = {
  id: string;
  position: number;
  prize: string;
  isPopped: boolean;
  poppedAt: Date | null;
  poppedBy: { id: string; name: string | null; nickname: string | null } | null;
};

type Rep = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
  role: string;
  balloonPoints: number;
  balloonSuspendedUntil: Date | null;
};

function BalloonAdminCard({ balloon, onUpdate }: { balloon: Balloon; onUpdate: () => void }) {
  const [prize, setPrize] = useState(balloon.prize);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await setBalloonPrizeAction(balloon.position, prize);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onUpdate();
    });
  }

  function handleReset() {
    startTransition(async () => {
      await resetBalloonAction(balloon.id);
      onUpdate();
    });
  }

  const displayName = balloon.poppedBy?.nickname ?? balloon.poppedBy?.name ?? null;

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${balloon.isPopped ? "bg-muted/40 border-border/30" : "bg-card border-border/60"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground">#{balloon.position}</span>
        {balloon.isPopped ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full font-semibold">POPPED</span>
            <button
              onClick={handleReset}
              disabled={isPending}
              className="h-6 w-6 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
              title="Reset balloon"
            >
              <RotateCcw className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-semibold">READY</span>
        )}
      </div>

      <input
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
        placeholder="Set prize..."
        value={prize}
        onChange={(e) => setPrize(e.target.value)}
        disabled={isPending}
      />

      <div className="flex items-center gap-1.5">
        <button
          onClick={handleSave}
          disabled={isPending || !prize.trim()}
          className="flex-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold py-1 transition-colors disabled:opacity-40"
        >
          {saved ? "Saved ✓" : "Save Prize"}
        </button>
      </div>

      {balloon.isPopped && displayName && (
        <p className="text-[10px] text-muted-foreground">
          Won by <span className="font-semibold">{displayName}</span>
          {balloon.poppedAt && ` · ${new Date(balloon.poppedAt).toLocaleDateString()}`}
        </p>
      )}
    </div>
  );
}

function RepRow({ rep, onUpdate }: { rep: Rep; onUpdate: () => void }) {
  const [isPending, startTransition] = useTransition();
  const isSuspended = rep.balloonSuspendedUntil && new Date(rep.balloonSuspendedUntil) > new Date();

  function adjust(delta: number) {
    startTransition(async () => {
      await adjustBalloonPointsAction(rep.id, delta);
      onUpdate();
    });
  }

  function toggleSuspend() {
    startTransition(async () => {
      const until = isSuspended ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await setBalloonSuspensionAction(rep.id, until);
      onUpdate();
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{rep.nickname ?? rep.name ?? rep.email}</p>
        <p className="text-[10px] text-muted-foreground">{rep.email}</p>
        {isSuspended && (
          <p className="text-[10px] text-destructive font-medium">
            Suspended until {new Date(rep.balloonSuspendedUntil!).toLocaleDateString()}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => adjust(-1)}
          disabled={isPending || rep.balloonPoints <= 0}
          className="h-7 w-7 rounded-lg bg-muted hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors disabled:opacity-30"
        >
          <Minus className="h-3 w-3 text-destructive" />
        </button>

        <span className="text-sm font-black tabular-nums w-6 text-center">
          {rep.balloonPoints}
        </span>

        <button
          onClick={() => adjust(1)}
          disabled={isPending}
          className="h-7 w-7 rounded-lg bg-muted hover:bg-green-100 dark:hover:bg-green-900/30 flex items-center justify-center transition-colors"
        >
          <Plus className="h-3 w-3 text-emerald-600" />
        </button>

        <button
          onClick={toggleSuspend}
          disabled={isPending}
          className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
            isSuspended
              ? "bg-amber-100 dark:bg-amber-900/30 hover:bg-muted"
              : "bg-muted hover:bg-destructive/10"
          }`}
          title={isSuspended ? "Lift suspension" : "Suspend 7 days"}
        >
          {isSuspended
            ? <CheckCircle className="h-3 w-3 text-amber-600" />
            : <Ban className="h-3 w-3 text-destructive" />
          }
        </button>
      </div>
    </div>
  );
}

export function AdminBalloonsClient({
  initialBalloons,
  initialReps,
}: {
  initialBalloons: Balloon[];
  initialReps: Rep[];
}) {
  const [balloons, setBalloons] = useState(initialBalloons);
  const [reps, setReps] = useState(initialReps);
  const [isPending, startTransition] = useTransition();

  function refreshData() {
    // Trigger server revalidation — components will re-render on next navigate
    // For real-time updates we rely on router.refresh() from parent or optimistic updates
  }

  function handleResetAll() {
    if (!confirm("Reset all 16 balloons? This cannot be undone.")) return;
    startTransition(async () => {
      await resetAllBalloonsAction();
      setBalloons((prev) => prev.map((b) => ({ ...b, isPopped: false, poppedAt: null, poppedBy: null })));
    });
  }

  const poppedCount = balloons.filter((b) => b.isPopped).length;

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Balloons", value: 16, icon: "🎈" },
          { label: "Popped", value: poppedCount, icon: "🎉" },
          { label: "Remaining", value: 16 - poppedCount, icon: "✨" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Balloon grid management */}
        <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Balloon Prizes
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Set prizes and reset individual balloons</p>
            </div>
            <button
              onClick={handleResetAll}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-bold px-3 py-1.5 transition-colors disabled:opacity-40"
            >
              <RotateCcw className="h-3 w-3" /> Reset All
            </button>
          </div>
          <div className="p-4 grid grid-cols-4 gap-2">
            {/* Ensure 16 slots */}
            {Array.from({ length: 16 }, (_, i) => {
              const b = balloons.find((x) => x.position === i + 1);
              if (b) {
                return (
                  <BalloonAdminCard
                    key={b.id}
                    balloon={b}
                    onUpdate={refreshData}
                  />
                );
              }
              return (
                <div key={i} className="rounded-xl border border-dashed border-border/40 p-3 flex items-center justify-center min-h-[100px]">
                  <span className="text-muted-foreground/30 text-xs text-center">#{i + 1}<br />No record</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rep management */}
        <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <p className="font-bold text-sm">Rep Points & Access</p>
            <p className="text-xs text-muted-foreground mt-0.5">Adjust balloon points and suspend reps from popping</p>
          </div>
          <div className="divide-y divide-border/30">
            {reps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">No sales reps found.</p>
            )}
            {reps.map((rep) => (
              <RepRow key={rep.id} rep={rep} onUpdate={refreshData} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
