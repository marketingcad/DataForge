"use client";

import { useState, useTransition } from "react";
import {
  setBalloonPrizeAction,
  resetBalloonAction,
  resetAllBalloonsAction,
  adjustBalloonPointsAction,
  setBalloonSuspensionAction,
  updateBalloonRuleAction,
  markBalloonPaymentAction,
  setBalloonPaymentNoteAction,
} from "@/actions/balloons.actions";
import { RotateCcw, Trophy, Plus, Minus, Ban, CheckCircle, Settings2, History, DollarSign } from "lucide-react";

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
  apptsPerPoint: number;
};

type AuditLog = {
  id: string;
  detail: string;
  createdAt: Date;
  actor: { name: string | null; email: string };
};

type Payout = {
  id: string;
  position: number;
  prize: string;
  poppedAt: Date | null;
  isPaid: boolean;
  paidAt: Date | null;
  paymentNote: string | null;
  poppedBy: { id: string; name: string | null; nickname: string | null; email: string } | null;
  paidBy:   { name: string | null; nickname: string | null } | null;
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
  const [pendingDelta, setPendingDelta] = useState<1 | -1 | null>(null);
  const [reason, setReason] = useState("");
  const isSuspended = rep.balloonSuspendedUntil && new Date(rep.balloonSuspendedUntil) > new Date();

  function confirmAdjust() {
    if (pendingDelta === null) return;
    const delta = pendingDelta;
    const r = reason.trim();
    setPendingDelta(null);
    setReason("");
    startTransition(async () => {
      const result = await adjustBalloonPointsAction(rep.id, delta, r || undefined);
      if (result.success) onUpdate(rep.id, result.newPoints);
    });
  }

  function cancelAdjust() {
    setPendingDelta(null);
    setReason("");
  }

  function toggleSuspend() {
    startTransition(async () => {
      const until = isSuspended ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await setBalloonSuspensionAction(rep.id, until);
    });
  }

  return (
    <div className="px-4 py-3 hover:bg-muted/20 transition-colors space-y-2">
      <div className="flex items-center gap-3">
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
            onClick={() => { cancelAdjust(); setPendingDelta(-1); }}
            disabled={isPending || rep.balloonPoints <= 0}
            className="h-7 w-7 rounded-lg bg-muted hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-colors disabled:opacity-30"
          >
            <Minus className="h-3 w-3 text-destructive" />
          </button>

          <span className="text-sm font-black tabular-nums w-6 text-center">
            {rep.balloonPoints}
          </span>

          <button
            onClick={() => { cancelAdjust(); setPendingDelta(1); }}
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

      {pendingDelta !== null && (
        <div className="flex items-center gap-2 pl-0.5">
          <input
            autoFocus
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirmAdjust(); if (e.key === "Escape") cancelAdjust(); }}
            placeholder={`Reason for ${pendingDelta === 1 ? "adding" : "removing"} a point…`}
            className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
          />
          <button
            onClick={confirmAdjust}
            disabled={isPending}
            className="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold px-3 py-1 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            Confirm
          </button>
          <button
            onClick={cancelAdjust}
            className="rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground text-[10px] font-bold px-2 py-1 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Rules card ────────────────────────────────────────────────────────────────

function RulesCard({ rules }: { rules: Rules }) {
  const [enabled, setEnabled] = useState(rules.enabled);
  const [pts, setPts] = useState(String(rules.apptsPerPoint));
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
      await updateBalloonRuleAction("apptsPerPoint", n);
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

        {/* Appointments per point */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">Appointments needed to get 1 balloon point</p>
            <p className="text-xs text-muted-foreground mt-0.5">Reps earn 1 balloon point for every {pts} appointment{parseInt(pts) !== 1 ? "s" : ""} booked within the same 24-hour window.</p>
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

// ── Payouts tab ───────────────────────────────────────────────────────────────

function PayoutRow({ payout, onUpdate }: { payout: Payout; onUpdate: (id: string, isPaid: boolean, note: string | null) => void }) {
  const [isPending, startTransition] = useTransition();
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(payout.paymentNote ?? "");

  const repName = payout.poppedBy?.nickname ?? payout.poppedBy?.name ?? payout.poppedBy?.email ?? "Unknown";
  const paidByName = payout.paidBy?.nickname ?? payout.paidBy?.name ?? null;

  function togglePaid() {
    startTransition(async () => {
      await markBalloonPaymentAction(payout.id, !payout.isPaid, note || undefined);
      onUpdate(payout.id, !payout.isPaid, note || null);
    });
  }

  function saveNote() {
    setEditingNote(false);
    startTransition(async () => {
      await setBalloonPaymentNoteAction(payout.id, note);
      onUpdate(payout.id, payout.isPaid, note || null);
    });
  }

  return (
    <div className={`px-5 py-3.5 hover:bg-muted/20 transition-colors space-y-2 ${isPending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Rep + balloon info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{repName}</p>
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">#{payout.position}</span>
          </div>
          <p className="text-base font-black" style={{ color: "#92400e" }}>₱{payout.prize}</p>
          <p className="text-[10px] text-muted-foreground">
            Popped {payout.poppedAt ? new Date(payout.poppedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            {payout.isPaid && paidByName && ` · Paid by ${paidByName}`}
            {payout.isPaid && payout.paidAt && ` on ${new Date(payout.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </p>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
            payout.isPaid
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
          }`}>
            {payout.isPaid ? "PAID" : "PENDING"}
          </span>
          <button
            onClick={togglePaid}
            disabled={isPending}
            className={`h-7 px-2.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 ${
              payout.isPaid
                ? "bg-muted hover:bg-muted/80 text-muted-foreground"
                : "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400"
            }`}
          >
            {payout.isPaid ? "Mark Unpaid" : "Mark Paid"}
          </button>
          <button
            onClick={() => setEditingNote((v) => !v)}
            className="h-7 w-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
            title="Add / edit note"
          >
            <DollarSign className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Note row */}
      {(payout.paymentNote || editingNote) && !editingNote && (
        <p className="text-xs text-muted-foreground italic pl-0.5 cursor-pointer hover:text-foreground" onClick={() => setEditingNote(true)}>
          📝 {payout.paymentNote}
        </p>
      )}
      {editingNote && (
        <div className="flex items-center gap-2 pl-0.5">
          <input
            autoFocus
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") { setNote(payout.paymentNote ?? ""); setEditingNote(false); } }}
            placeholder="Add a note (e.g. paid via GCash)…"
            className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
          />
          <button onClick={saveNote} className="rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold px-3 py-1 transition-colors whitespace-nowrap">Save</button>
          <button onClick={() => { setNote(payout.paymentNote ?? ""); setEditingNote(false); }} className="rounded-lg bg-muted text-muted-foreground text-[10px] font-bold px-2 py-1 transition-colors">Cancel</button>
        </div>
      )}
    </div>
  );
}

function PayoutsTab({ initialPayouts }: { initialPayouts: Payout[] }) {
  const [payouts, setPayouts] = useState(initialPayouts);

  const totalPrizes = payouts.length;
  const paidCount   = payouts.filter((p) => p.isPaid).length;

  function handleUpdate(id: string, isPaid: boolean, paymentNote: string | null) {
    setPayouts((prev) => prev.map((p) => p.id === id ? { ...p, isPaid, paymentNote, paidAt: isPaid ? new Date() : null } : p));
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Prizes", value: totalPrizes,              icon: "🎁" },
          { label: "Paid",         value: paidCount,                icon: "✅" },
          { label: "Pending",      value: totalPrizes - paidCount,  icon: "⏳" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 text-center">
            <p className="text-xl mb-1">{s.icon}</p>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-card border border-border/40 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/40">
          <p className="font-bold text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" /> Prize Payouts
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Mark prizes as paid and add payment notes for each rep</p>
        </div>

        {payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No balloons have been popped yet.</p>
        ) : (
          <div className="divide-y divide-border/30">
            {payouts.map((p) => (
              <PayoutRow key={p.id} payout={p} onUpdate={handleUpdate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

type Tab = "balloons" | "reps" | "payouts" | "settings" | "activity";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "balloons", label: "Balloons",  icon: "🎈" },
  { id: "reps",     label: "Reps",      icon: "👥" },
  { id: "payouts",  label: "Payouts",   icon: "💰" },
  { id: "settings", label: "Settings",  icon: "⚙️" },
  { id: "activity", label: "Activity",  icon: "📋" },
];

export function AdminBalloonsClient({
  initialBalloons,
  initialReps,
  initialRules,
  initialAuditLogs,
  initialPayouts,
}: {
  initialBalloons: Balloon[];
  initialReps: Rep[];
  initialRules: Rules;
  initialAuditLogs: AuditLog[];
  initialPayouts: Payout[];
}) {
  const [tab, setTab]           = useState<Tab>("balloons");
  const [balloons, setBalloons] = useState(initialBalloons);
  const [reps, setReps]         = useState(initialReps);
  const [isPending, startTransition] = useTransition();

  function handleResetAll() {
    if (!confirm("Reset all 16 balloons? This cannot be undone.")) return;
    startTransition(async () => {
      await resetAllBalloonsAction();
      setBalloons((prev) => prev.map((b) => ({ ...b, isPopped: false, poppedAt: null, poppedBy: null })));
    });
  }

  function handleBalloonReset() {
    setBalloons((prev) => prev.map((b) => ({ ...b })));
  }

  function handlePointsUpdate(userId: string, newPoints: number) {
    setReps((prev) => prev.map((r) => r.id === userId ? { ...r, balloonPoints: newPoints } : r));
  }

  const poppedCount = balloons.filter((b) => b.isPopped).length;
  const prizesSet   = balloons.filter((b) => b.prize.trim() !== "").length;

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1 border border-border/40">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
              tab === t.id
                ? "bg-card shadow-sm text-foreground border border-border/40"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {t.id === "activity" && initialAuditLogs.length > 0 && (
              <span className="hidden sm:inline rounded-full bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 leading-none">
                {initialAuditLogs.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Balloons tab ── */}
      {tab === "balloons" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total",      value: 16,               icon: "🎈" },
              { label: "Popped",     value: poppedCount,      icon: "🎉" },
              { label: "Remaining",  value: 16 - poppedCount, icon: "✨" },
              { label: "Prizes Set", value: prizesSet,        icon: "🏆" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-card border border-border/40 shadow-sm p-4 text-center">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

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
        </div>
      )}

      {/* ── Reps tab ── */}
      {tab === "reps" && (
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
      )}

      {/* ── Payouts tab ── */}
      {tab === "payouts" && <PayoutsTab initialPayouts={initialPayouts} />}

      {/* ── Settings tab ── */}
      {tab === "settings" && <RulesCard rules={initialRules} />}

      {/* ── Activity tab ── */}
      {tab === "activity" && <ActivityLog logs={initialAuditLogs} />}
    </div>
  );
}
