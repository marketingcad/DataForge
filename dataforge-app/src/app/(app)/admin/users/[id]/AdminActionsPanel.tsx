"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Shield, Tag, Trash2, AlertTriangle,
  Ban, Clock, ShieldOff, X, KeyRound, Eye, EyeOff, Link2,
} from "lucide-react";
import { ROLE_LABELS, ROLE_ORDER, ROLE_CAN_CREATE, type Role } from "@/lib/rbac/roles";
import {
  updateUserRoleAction,
  deleteUserAction,
  updateUserNicknameAction,
  banUserAction,
  suspendUserAction,
  unbanUserAction,
  changeUserPasswordAction,
  updateUserGhlLinkAction,
} from "@/actions/users.actions";
import { useNotifications } from "@/lib/notifications";

type ActiveModal =
  | "role" | "nickname" | "password" | "ghlLink"
  | "ban" | "suspend" | "waive"
  | "delete"
  | null;

interface Props {
  userId: string;
  userName: string | null;
  userEmail: string;
  userRole: string;
  userNickname: string | null;
  userGhlUserId: string | null;
  actorRole: Role;
  isCurrentUser: boolean;
  isBanned: boolean;
  bannedUntil: Date | null;
  banReason: string | null;
}

const SUSPEND_PRESETS = [
  { label: "1 hour",   hours: 1   },
  { label: "12 hours", hours: 12  },
  { label: "1 day",    hours: 24  },
  { label: "3 days",   hours: 72  },
  { label: "7 days",   hours: 168 },
  { label: "14 days",  hours: 336 },
  { label: "30 days",  hours: 720 },
];

export function AdminActionsPanel({
  userId, userName, userEmail, userRole, userNickname, userGhlUserId,
  actorRole, isCurrentUser,
  isBanned, bannedUntil, banReason,
}: Props) {
  const router = useRouter();
  const { add } = useNotifications();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  const assignableRoles = ROLE_CAN_CREATE[actorRole] ?? [];
  const showNickname    = ["sales_rep", "lead_specialist"].includes(userRole);
  const displayName     = userName ?? userEmail;

  // Determine live ban status (bannedUntil in the past = effectively not banned)
  const isEffectivelyBanned = isBanned && (bannedUntil === null || new Date(bannedUntil) > new Date());
  const isSuspended         = isBanned && bannedUntil !== null && new Date(bannedUntil) > new Date();

  if (isCurrentUser) return (
    <div className="rounded-2xl border border-border/40 bg-card shadow-sm px-5 py-3.5 flex items-center gap-3">
      <button onClick={() => router.push("/admin/users")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Users
      </button>
    </div>
  );

  return (
    <>
      {/* ── Toolbar card ── */}
      <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 flex-wrap gap-y-2">
          <button
            onClick={() => router.push("/admin/users")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Users
          </button>
          <span className="text-border">·</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admin Controls</span>

          {/* Ban status badge */}
          {isEffectivelyBanned && (
            <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${isSuspended ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" : "bg-destructive/10 text-destructive"}`}>
              {isSuspended ? <Clock className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
              {isSuspended
                ? `Suspended until ${new Date(bannedUntil!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : "Permanently banned"}
            </span>
          )}

          <div className="ml-auto flex items-center flex-wrap gap-2">
            {assignableRoles.length > 0 && (
              <ToolbarBtn icon={<Shield className="h-3.5 w-3.5" />} label="Change Role"   onClick={() => setActiveModal("role")} />
            )}
            {showNickname && (
              <ToolbarBtn icon={<Tag    className="h-3.5 w-3.5" />} label="Edit Nickname" onClick={() => setActiveModal("nickname")} />
            )}
            <ToolbarBtn icon={<Link2 className="h-3.5 w-3.5" />} label={userGhlUserId ? "GHL Linked" : "Link GHL"} onClick={() => setActiveModal("ghlLink")} />
            <ToolbarBtn icon={<KeyRound className="h-3.5 w-3.5" />} label="Change Password" onClick={() => setActiveModal("password")} />
            <ToolbarBtn icon={<Clock className="h-3.5 w-3.5" />} label="Suspend" onClick={() => setActiveModal("suspend")} warning />
            <ToolbarBtn icon={<Ban   className="h-3.5 w-3.5" />} label="Ban"     onClick={() => setActiveModal("ban")}     danger />
            {isEffectivelyBanned && (
              <ToolbarBtn icon={<ShieldOff className="h-3.5 w-3.5" />} label="Waive" onClick={() => setActiveModal("waive")} warning />
            )}
            <ToolbarBtn icon={<Trash2 className="h-3.5 w-3.5" />} label="Remove"         onClick={() => setActiveModal("delete")} danger />
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {activeModal && (
        <ActionModal title={MODAL_TITLES[activeModal]} onClose={() => setActiveModal(null)}>
          {activeModal === "role" && (
            <RolePanel
              userId={userId} userRole={userRole}
              assignableRoles={assignableRoles}
              onDone={() => { setActiveModal(null); router.refresh(); }}
              onError={(e) => add({ title: "Error", message: e, type: "error" })}
            />
          )}
          {activeModal === "nickname" && (
            <NicknamePanel
              userId={userId} userNickname={userNickname}
              onDone={() => { setActiveModal(null); router.refresh(); }}
              onError={(e) => add({ title: "Error", message: e, type: "error" })}
            />
          )}
          {activeModal === "ghlLink" && (
            <GhlLinkPanel
              userId={userId} currentGhlUserId={userGhlUserId}
              onDone={() => { setActiveModal(null); router.refresh(); add({ title: "GHL link updated", type: "success" }); }}
              onError={(e) => add({ title: "Error", message: e, type: "error" })}
            />
          )}
          {activeModal === "password" && (
            <PasswordPanel
              userId={userId} displayName={displayName}
              onDone={() => { setActiveModal(null); add({ title: "Password updated", type: "success" }); }}
              onError={(e) => add({ title: "Error", message: e, type: "error" })}
            />
          )}
          {activeModal === "suspend" && (
            <SuspendPanel
              userId={userId} displayName={displayName}
              isEffectivelyBanned={isEffectivelyBanned} isSuspended={isSuspended}
              bannedUntil={bannedUntil} banReason={banReason}
              onDone={() => { setActiveModal(null); router.refresh(); add({ title: "User suspended", type: "success" }); }}
              onWaiveDone={() => { setActiveModal(null); router.refresh(); add({ title: "Restriction waived", type: "success" }); }}
              onError={(e) => add({ title: "Error", message: e, type: "error" })}
            />
          )}
          {activeModal === "ban" && (
            <BanPanel
              userId={userId} displayName={displayName}
              isEffectivelyBanned={isEffectivelyBanned} isSuspended={isSuspended}
              bannedUntil={bannedUntil} banReason={banReason}
              onDone={() => { setActiveModal(null); router.refresh(); add({ title: "User banned", type: "success" }); }}
              onWaiveDone={() => { setActiveModal(null); router.refresh(); add({ title: "Restriction waived", type: "success" }); }}
              onError={(e) => add({ title: "Error", message: e, type: "error" })}
            />
          )}
          {activeModal === "waive" && (
            <WaivePanel
              userId={userId} displayName={displayName}
              isSuspended={isSuspended} bannedUntil={bannedUntil} banReason={banReason}
              onDone={() => { setActiveModal(null); router.refresh(); add({ title: "Restriction waived", type: "success" }); }}
              onError={(e) => add({ title: "Error", message: e, type: "error" })}
            />
          )}
          {activeModal === "delete" && (
            <DeletePanel
              userId={userId} displayName={displayName}
              onDone={() => { router.push("/admin/users"); add({ title: "User removed", type: "success" }); }}
              onError={(e) => add({ title: "Error", message: e, type: "error" })}
            />
          )}
        </ActionModal>
      )}
    </>
  );
}

// ── Modal titles ────────────────────────────────────────────────────────────────

const MODAL_TITLES: Record<NonNullable<ActiveModal>, string> = {
  role:     "Change Role",
  nickname: "Edit Nickname",
  ghlLink:  "Link GHL User",
  password: "Change Password",
  suspend:  "Suspend User",
  ban:      "Ban User",
  waive:    "Waive Restriction",
  delete:   "Remove User",
};

// ── Shared modal shell ──────────────────────────────────────────────────────────

function ActionModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-background shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="font-semibold text-base">{title}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ── Toolbar button ──────────────────────────────────────────────────────────────

function ToolbarBtn({ icon, label, onClick, danger, warning }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  danger?: boolean; warning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors",
        danger  ? "border-transparent text-muted-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
        : warning ? "border-transparent text-muted-foreground hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-amber-400"
                : "border-transparent text-muted-foreground hover:bg-muted",
      ].join(" ")}
    >
      {icon}{label}
    </button>
  );
}

// ── Role panel ──────────────────────────────────────────────────────────────────

function RolePanel({ userId, userRole, assignableRoles, onDone, onError }: {
  userId: string; userRole: string; assignableRoles: Role[];
  onDone: () => void; onError: (e: string) => void;
}) {
  const [pending, start] = useTransition();
  function handle(r: Role) {
    start(async () => {
      try { await updateUserRoleAction(userId, r); onDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }
  return (
    <div className="space-y-2">
      {ROLE_ORDER.filter((r) => assignableRoles.includes(r)).map((r) => (
        <label key={r} className="relative flex cursor-pointer rounded-xl border p-3 gap-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors hover:bg-muted/40">
          <input type="radio" name="modal-role" value={r} defaultChecked={userRole === r} disabled={pending} onChange={() => handle(r)} className="mt-0.5 accent-primary" />
          <div>
            <p className="text-sm font-medium">{ROLE_LABELS[r]}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {r === "boss"            && "Full access to everything"}
              {r === "admin"           && "Full access, manages users"}
              {r === "team_lead"       && "Marketing team management"}
              {r === "lead_specialist" && "Leads department only"}
              {r === "sales_rep"       && "Marketing department only"}
            </p>
          </div>
        </label>
      ))}
      {pending && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  );
}

// ── Nickname panel ──────────────────────────────────────────────────────────────

function NicknamePanel({ userId, userNickname, onDone, onError }: {
  userId: string; userNickname: string | null; onDone: () => void; onError: (e: string) => void;
}) {
  const [nick, setNick] = useState(userNickname ?? "");
  const [pending, start] = useTransition();
  function save() {
    start(async () => {
      try { await updateUserNicknameAction(userId, nick); onDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Used for GHL webhook name matching. Leave blank to remove.</p>
      <input type="text" value={nick} onChange={(e) => setNick(e.target.value)} disabled={pending}
        placeholder="e.g. Will, Billy, Chris…"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
      <div className="flex justify-end">
        <button onClick={save} disabled={pending || nick.trim() === (userNickname ?? "")}
          className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {pending ? "Saving…" : "Save Nickname"}
        </button>
      </div>
    </div>
  );
}

// ── Suspend panel ───────────────────────────────────────────────────────────────

function SuspendPanel({ userId, displayName, isEffectivelyBanned, isSuspended, bannedUntil, banReason, onDone, onWaiveDone, onError }: {
  userId: string; displayName: string;
  isEffectivelyBanned: boolean; isSuspended: boolean;
  bannedUntil: Date | null; banReason: string | null;
  onDone: () => void; onWaiveDone: () => void; onError: (e: string) => void;
}) {
  const [preset,  setPreset]  = useState<number | null>(24);
  const [custom,  setCustom]  = useState("");
  const [reason,  setReason]  = useState("");
  const [pending, start]      = useTransition();

  function getUntil(): Date | null {
    if (preset !== null) {
      return new Date(Date.now() + preset * 60 * 60 * 1000);
    }
    if (custom) return new Date(custom);
    return null;
  }

  function save() {
    const until = getUntil();
    if (!until) { onError("Please select a suspension duration."); return; }
    start(async () => {
      try { await suspendUserAction(userId, until, reason); onDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }

  function waive() {
    start(async () => {
      try { await unbanUserAction(userId); onWaiveDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }

  return (
    <div className="space-y-4">
      {/* Current suspension info + quick waive */}
      {isEffectivelyBanned && isSuspended && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Currently suspended</p>
            </div>
            <button onClick={waive} disabled={pending}
              className="rounded-lg border border-amber-400/50 text-amber-700 dark:text-amber-400 px-3 py-1 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors">
              {pending ? "Waiving…" : "Waive Suspension"}
            </button>
          </div>
          {bannedUntil && (
            <p className="text-xs text-muted-foreground">
              Expires <strong>{new Date(bannedUntil).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</strong>
            </p>
          )}
          {banReason && <p className="text-xs text-muted-foreground">Reason: <span className="italic">{banReason}</span></p>}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          <strong>{displayName}</strong> will be temporarily blocked from logging in until the suspension expires.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Duration</p>
        <div className="grid grid-cols-4 gap-2">
          {SUSPEND_PRESETS.map((p) => (
            <button
              key={p.hours}
              onClick={() => { setPreset(p.hours); setCustom(""); }}
              className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${preset === p.hours ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setPreset(null)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${preset === null ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
          >
            Custom
          </button>
        </div>
        {preset === null && (
          <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reason <span className="font-normal normal-case">(optional)</span></p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Violated conduct policy…"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={pending}
          className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
          {pending ? "Suspending…" : "Suspend User"}
        </button>
      </div>
    </div>
  );
}

// ── Ban panel ───────────────────────────────────────────────────────────────────

function BanPanel({ userId, displayName, isEffectivelyBanned, isSuspended, bannedUntil, banReason, onDone, onWaiveDone, onError }: {
  userId: string; displayName: string;
  isEffectivelyBanned: boolean; isSuspended: boolean;
  bannedUntil: Date | null; banReason: string | null;
  onDone: () => void; onWaiveDone: () => void; onError: (e: string) => void;
}) {
  const [reason,  setReason]  = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, start]      = useTransition();

  function save() {
    start(async () => {
      try { await banUserAction(userId, reason); onDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }

  function waive() {
    start(async () => {
      try { await unbanUserAction(userId); onWaiveDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }

  return (
    <div className="space-y-4">
      {/* Current ban info + quick waive (permanent ban only — suspension is shown in SuspendPanel) */}
      {isEffectivelyBanned && !isSuspended && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Ban className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs font-semibold text-destructive">Currently permanently banned</p>
            </div>
            <button onClick={waive} disabled={pending}
              className="rounded-lg border border-destructive/30 text-destructive px-3 py-1 text-xs font-medium hover:bg-destructive/10 disabled:opacity-50 transition-colors">
              {pending ? "Waiving…" : "Waive Ban"}
            </button>
          </div>
          {banReason && <p className="text-xs text-muted-foreground">Reason: <span className="italic">{banReason}</span></p>}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
        <Ban className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-xs text-destructive">
          <strong>{displayName}</strong> will be permanently blocked from logging in. You can lift this ban at any time.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reason <span className="font-normal normal-case">(optional)</span></p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Repeated policy violations…"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      {!confirm ? (
        <div className="flex justify-end">
          <button onClick={() => setConfirm(true)}
            className="rounded-lg border border-destructive/30 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/10 transition-colors">
            Continue to Ban
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">Are you sure? This will immediately block <strong>{displayName}</strong> from the platform.</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirm(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={save} disabled={pending}
              className="rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors">
              {pending ? "Banning…" : "Yes, Ban User"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Waive panel ─────────────────────────────────────────────────────────────────

function WaivePanel({ userId, displayName, isSuspended, bannedUntil, banReason, onDone, onError }: {
  userId: string; displayName: string; isSuspended: boolean;
  bannedUntil: Date | null; banReason: string | null;
  onDone: () => void; onError: (e: string) => void;
}) {
  const [pending, start] = useTransition();
  function save() {
    start(async () => {
      try { await unbanUserAction(userId); onDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }
  return (
    <div className="space-y-4">
      {/* Current restriction summary */}
      <div className={`rounded-xl border p-4 space-y-2 ${isSuspended ? "border-amber-200 bg-amber-50 dark:bg-amber-950/30" : "border-destructive/20 bg-destructive/5"}`}>
        <div className="flex items-center gap-2">
          {isSuspended ? <Clock className="h-4 w-4 text-amber-600 shrink-0" /> : <Ban className="h-4 w-4 text-destructive shrink-0" />}
          <p className={`text-xs font-semibold ${isSuspended ? "text-amber-700 dark:text-amber-400" : "text-destructive"}`}>
            {isSuspended ? "Currently suspended" : "Currently banned"}
          </p>
        </div>
        {isSuspended && bannedUntil && (
          <p className="text-xs text-muted-foreground">
            Suspension expires <strong>{new Date(bannedUntil).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</strong>
          </p>
        )}
        {banReason && (
          <p className="text-xs text-muted-foreground">Reason: <span className="italic">{banReason}</span></p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Waiving this restriction will immediately restore <strong>{displayName}</strong>&apos;s access to the platform.
      </p>

      <div className="flex justify-end">
        <button onClick={save} disabled={pending}
          className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {pending ? "Waiving…" : isSuspended ? "Waive Suspension" : "Waive Ban"}
        </button>
      </div>
    </div>
  );
}

// ── GHL link panel ──────────────────────────────────────────────────────────────

interface GhlAgentOption { id: string; name: string; email: string; alreadyLinked: boolean; }

function GhlLinkPanel({ userId, currentGhlUserId, onDone, onError }: {
  userId: string; currentGhlUserId: string | null;
  onDone: () => void; onError: (e: string) => void;
}) {
  const [pending, start] = useTransition();
  const [agents, setAgents] = useState<GhlAgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(currentGhlUserId ?? "");
  const [manual, setManual] = useState("");
  const [useManual, setUseManual] = useState(false);

  useEffect(() => {
    fetch("/api/ghl/agents")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function save() {
    const id = useManual ? manual.trim() : selected;
    start(async () => {
      try { await updateUserGhlLinkAction(userId, id || null); onDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Link this DataForge user to a GHL agent so inbound/outbound call webhooks are attributed correctly.
      </p>

      {currentGhlUserId && (
        <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-mono break-all">
          Currently linked: <span className="text-foreground">{currentGhlUserId}</span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading GHL agents…</p>
      ) : agents.length > 0 && !useManual ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pick GHL Agent</p>
          <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border p-2">
            <label className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/50">
              <input type="radio" name="ghl-agent" value="" checked={selected === ""} onChange={() => setSelected("")} />
              <span className="text-sm text-muted-foreground italic">Unlink (remove GHL ID)</span>
            </label>
            {agents.map((a) => (
              <label key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted/50">
                <input type="radio" name="ghl-agent" value={a.id} checked={selected === a.id} onChange={() => setSelected(a.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                </div>
                {a.alreadyLinked && a.id !== currentGhlUserId && (
                  <span className="text-xs text-amber-500 shrink-0">In use</span>
                )}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setUseManual(true)} className="text-xs text-muted-foreground underline hover:text-foreground">
            Enter GHL User ID manually instead
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GHL User ID</p>
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Paste the GHL User ID…"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {agents.length > 0 && (
            <button type="button" onClick={() => setUseManual(false)} className="text-xs text-muted-foreground underline hover:text-foreground">
              Pick from GHL agent list instead
            </button>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={save} disabled={pending}
          className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {pending ? "Saving…" : "Save Link"}
        </button>
      </div>
    </div>
  );
}

// ── Password panel ──────────────────────────────────────────────────────────────

function PasswordPanel({ userId, displayName, onDone, onError }: {
  userId: string; displayName: string; onDone: () => void; onError: (e: string) => void;
}) {
  const [password, setPassword]   = useState("");
  const [confirm,  setConfirm]    = useState("");
  const [showPw,   setShowPw]     = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [pending,  start]         = useTransition();

  function save() {
    if (password.length < 8) { onError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { onError("Passwords do not match."); return; }
    start(async () => {
      try { await changeUserPasswordAction(userId, password); onDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set a new password for <strong>{displayName}</strong>. They will need to use it on their next login.
      </p>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">New Password</p>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              placeholder="Min. 8 characters"
              className="w-full rounded-lg border bg-background px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Confirm Password</p>
          <div className="relative">
            <input
              type={showConf ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={pending}
              placeholder="Repeat password"
              className="w-full rounded-lg border bg-background px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button type="button" onClick={() => setShowConf((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showConf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={pending || !password || !confirm}
          className="rounded-lg bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {pending ? "Saving…" : "Set Password"}
        </button>
      </div>
    </div>
  );
}

// ── Delete panel ────────────────────────────────────────────────────────────────

function DeletePanel({ userId, displayName, onDone, onError }: {
  userId: string; displayName: string; onDone: () => void; onError: (e: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start]      = useTransition();
  function del() {
    start(async () => {
      try { await deleteUserAction(userId); onDone(); }
      catch (e) { onError((e as Error).message); }
    });
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl bg-destructive/5 border border-destructive/20 p-3">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-xs text-destructive">
          Permanently deletes <strong>{displayName}</strong> and all associated data. This cannot be undone.
          Consider suspending or banning instead if you want to preserve their data.
        </p>
      </div>
      {!confirm ? (
        <div className="flex justify-end">
          <button onClick={() => setConfirm(true)}
            className="flex items-center gap-2 rounded-lg border border-destructive/30 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-4 w-4" /> Permanently Remove Account
          </button>
        </div>
      ) : (
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirm(false)} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
          <button onClick={del} disabled={pending}
            className="rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors">
            {pending ? "Removing…" : "Yes, Remove"}
          </button>
        </div>
      )}
    </div>
  );
}
