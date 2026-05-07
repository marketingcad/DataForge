"use client";

import { useState, useTransition } from "react";
import {
  setBalloonPrizeAction,
  resetBalloonAction,
  resetAllBalloonsAction,
  adjustBalloonPointsAction,
  setBalloonSuspensionAction,
  updateBalloonRuleAction,
} from "@/actions/balloons.actions";
import { RotateCcw, Trophy, Plus, Minus, Ban, CheckCircle, Settings2, History } from "lucide-react";

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

type Rules = {
  enabled: boolean;
  pointsPerAppointment: number;
};

type AuditLog = {
  id: string;
  detail: string;
  createdAt: Date;
  actor: { name: string | null; email: string };
};

// ── Balloon admin card ────────────────────────────────────────────────────────

function BalloonAdminCard({ balloon, onReset }: { balloon: Balloon; onReset: () => void }) {
  const [prize, setPrize] = useState(balloon.prize);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await setBalloonPrizeAction(balloon.position, prize);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function handleReset() {
    startTransition(async () => {
      await resetBalloonAction(balloon.id);
      onReset();
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
          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-semibold">READY</span>
        )}
      </div>

      <input
        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
        placeholder="Set prize..."
        value={prize}
        onChange={(e) => setPrize(e.target.value)}
        disabled={isPending}
      />

      <button
        onClick={handleSave}
        disabled={isPending || !prize.trim()}
        className="w-full rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold py-1 transition-colors disabled:opacity-40"
      >
        {saved ? "Saved ✓" : "Save Prize"}
      </button>

      {balloon.isPopped && displayName && (
        <p className="text-[10px] text-muted-foreground">
          Won by <span className="font-semibold">{displayName}</span>
          {balloon.poppedAt && ` · ${new Date(balloon.poppedAt).toLocaleDateString()}`}
        </p>
      )}
    </div>
  );
}

// ── Rep row ───────────────────────────────────────────────────────────────────

function RepRow({ rep, onUpdate }: { rep: Rep; onUpdate: (id: string, newPoints: number) => void }) {
  const [isPending, startTransition] = useTransition();
  const isSuspended = rep.balloonSuspendedUntil && new Date(rep.balloonSuspendedUntil) > new Date();

  function adjust(delta: number) {
    startTransition(async () => {
      const result = await adjustBalloonPointsAction(rep.id, delta);
      if (result.success) onUpdate(rep.id, result.newPoints);
    });
  }

  function toggleSuspend() {
    startTransition(async () => {
      const until = isSuspended ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await setBalloonSuspensionAction(rep.id, until);
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

// ── Rules card ────────────────────────────────────────────────────────────────

function RulesCard({ rules }: { rules: Rules }) {
  const [enabled, setEnabled] = useState(rules.enabled);
  const [pts, setPts] = useState(String(rules.pointsPerAppointment));
  const [ptsPending, startPts] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [ptsSaved, setPtsSaved] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    startToggle(async () => {
      await updateBalloonRuleAction("enabled", next);
    });
  }

  function handleSavePts() {
    const n = Math.max(1, parseInt(pts) || 1);
    setPts(String(n));
    startPts(async () => {
      await updateBalloonRuleAction("pointsPerAppointment", n);
      setPtsSaved(true);
      setTimeout(() => setPtsSaved(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40">
        <p className="font-bold text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" /> Rules & Settings
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Configure how the balloon pop game works</p>
      </div>

      <div className="p-5 space-y-5">
        {/* Enable / disable toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Balloon Pop enabled</p>
            <p className="text-xs text-muted-foreground mt-0.5">When disabled, reps cannot pop balloons and no points are awarded</p>
          </div>
          <button
            onClick={handleToggle}
            disabled={togglePending}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${enabled ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Points per appointment */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Points per booked appointment</p>
            <p className="text-xs text-muted-foreground mt-0.5">How many balloon points a rep earns each time they book an appointment</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              min={1}
              max={10}
              value={pts}
              onChange={(e) => setPts(e.target.value)}
              disabled={ptsPending}
              className="w-16 rounded-lg border bg-background px-2.5 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={handleSavePts}
              disabled={ptsPending}
              className="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold px-3 py-1.5 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {ptsSaved ? "Saved ✓" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Activity log ──────────────────────────────────────────────────────────────

function ActivityLog({ logs }: { logs: AuditLog[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? logs : logs.slice(0, 20);

  function formatTime(d: Date) {
    return new Date(d).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  }

  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <div>
          <p className="font-bold text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" /> Activity Log
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Complete record of all admin actions on balloon pop</p>
        </div>
        <span className="text-xs text-muted-foreground">{logs.length} entries</span>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No activity recorded yet.</p>
      ) : (
        <>
          <div className="divide-y divide-border/30">
            {visible.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{log.detail}</p>
                </div>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                  {formatTime(log.createdAt)}
                </p>
              </div>
            ))}
          </div>

          {logs.length > 20 && (
            <div className="px-5 py-3 border-t border-border/30">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs text-primary hover:underline"
              >
                {expanded ? "Show less" : `Show all ${logs.length} entries`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function AdminBalloonsClient({
  initialBalloons,
  initialReps,
  initialRules,
  initialAuditLogs,
}: {
  initialBalloons: Balloon[];
  initialReps: Rep[];
  initialRules: Rules;
  initialAuditLogs: AuditLog[];
}) {
  const [balloons, setBalloons] = useState(initialBalloons);
  const [reps, setReps] = useState(initialReps);
  const [isPending, startTransition] = useTransition();

  function handleResetAll() {
    if (!confirm("Reset all 16 balloons? This cannot be undone.")) return;
    startTransition(async () => {
      await resetAllBalloonsAction();
      setBalloons((prev) => prev.map((b) => ({ ...b, isPopped: false, poppedAt: null, poppedBy: null })));
    });
  }

  function handleBalloonReset() {
    // Re-fetching would require router.refresh(); optimistic clear is fine
    setBalloons((prev) => prev.map((b) => ({ ...b })));
  }

  function handlePointsUpdate(userId: string, newPoints: number) {
    setReps((prev) => prev.map((r) => r.id === userId ? { ...r, balloonPoints: newPoints } : r));
  }

  const poppedCount = balloons.filter((b) => b.isPopped).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Balloons", value: 16,               icon: "🎈" },
          { label: "Popped",         value: poppedCount,      icon: "🎉" },
          { label: "Remaining",      value: 16 - poppedCount, icon: "✨" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rules */}
      <RulesCard rules={initialRules} />

      {/* Balloon prizes + Rep management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            {Array.from({ length: 16 }, (_, i) => {
              const b = balloons.find((x) => x.position === i + 1);
              if (b) return <BalloonAdminCard key={b.id} balloon={b} onReset={handleBalloonReset} />;
              return (
                <div key={i} className="rounded-xl border border-dashed border-border/40 p-3 flex items-center justify-center min-h-[100px]">
                  <span className="text-muted-foreground/30 text-xs text-center">#{i + 1}<br />No record</span>
                </div>
              );
            })}
          </div>
        </div>

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
              <RepRow key={rep.id} rep={rep} onUpdate={handlePointsUpdate} />
            ))}
          </div>
        </div>
      </div>

      {/* Activity log */}
      <ActivityLog logs={initialAuditLogs} />
    </div>
  );
}
