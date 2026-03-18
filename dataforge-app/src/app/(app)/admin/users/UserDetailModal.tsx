"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import {
  X, MoreVertical, Trash2, AlertTriangle, Award,
} from "lucide-react";
import { ROLE_LABELS, ROLE_ORDER, ROLE_CAN_CREATE, type Role } from "@/lib/rbac/roles";
import {
  updateUserRoleAction,
  updateUserEmailAction,
  deleteUserAction,
  getUserDetailAction,
} from "@/actions/users.actions";
import { useNotifications } from "@/lib/notifications";
import type { SectionStyle } from "./UserCard";

type DetailData = Awaited<ReturnType<typeof getUserDetailAction>>;

type UserData = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date;
  _count: { callLogs: number; userBadges: number };
};

interface Props {
  user: UserData;
  actorRole: Role;
  isCurrentUser: boolean;
  sectionStyle: SectionStyle;
  onClose: () => void;
}

type ActiveAction = "role" | "email" | "delete" | null;

function memberDuration(createdAt: Date): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days < 1)   return "Today";
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo ${days % 30}d`;
  return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}mo`;
}


export function UserDetailModal({ user, actorRole, isCurrentUser, sectionStyle: s, onClose }: Props) {
  const [detail, setDetail]           = useState<DetailData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);

  const [pendingRole,   startRoleTransition]   = useTransition();
  const [pendingEmail,  startEmailTransition]  = useTransition();
  const [pendingDelete, startDeleteTransition] = useTransition();
  const [email,         setEmail]              = useState(user.email);
  const [confirmDelete, setConfirmDelete]      = useState(false);
  const [roleError,     setRoleError]          = useState<string | null>(null);
  const [emailError,    setEmailError]         = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const { add } = useNotifications();
  const assignableRoles = ROLE_CAN_CREATE[actorRole];
  const initial = (user.name ?? user.email)[0].toUpperCase();

  // Fetch full detail on open
  useEffect(() => {
    getUserDetailAction(user.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [user.id]);

  // Close 3-dot menu when clicking outside
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  function selectAction(a: ActiveAction) {
    setMenuOpen(false);
    setActiveAction((prev) => (prev === a ? null : a));
  }

  function handleRoleChange(newRole: Role) {
    setRoleError(null);
    startRoleTransition(async () => {
      try {
        await updateUserRoleAction(user.id, newRole);
        add({ title: "Role updated", message: `Role changed to ${ROLE_LABELS[newRole]}`, type: "success" });
        setActiveAction(null);
      } catch (e) {
        setRoleError((e as Error).message);
      }
    });
  }

  function handleEmailSave() {
    setEmailError(null);
    startEmailTransition(async () => {
      try {
        await updateUserEmailAction(user.id, email.trim());
        add({ title: "Email updated", message: "Email address saved.", type: "success" });
        setActiveAction(null);
      } catch (e) {
        setEmailError((e as Error).message);
      }
    });
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteUserAction(user.id);
        add({ title: "User removed", message: `${user.name ?? user.email} has been removed.`, type: "success" });
        onClose();
      } catch (e) {
        add({ title: "Error", message: (e as Error).message, type: "error" });
      }
    });
  }

  const dept = s.title.replace(" Department", "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-background shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

        {/* ── Header ── */}
        <div className="p-6 pb-4 shrink-0">
          <div className="flex items-start gap-4">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 ${s.avatarClass}`}>
              {initial}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg leading-tight">{user.name ?? user.email}</h2>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s.tagClass}`}>{s.tag}</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-muted text-gray-600 dark:text-muted-foreground">
                  • {ROLE_LABELS[user.role as Role]}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                &nbsp;·&nbsp;{memberDuration(user.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* 3-dot menu */}
              {!isCurrentUser && (
                <div ref={menuRef} className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-9 w-44 rounded-xl border bg-background shadow-lg z-20 overflow-hidden py-1">
                      <button
                        onClick={() => selectAction("role")}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        Change Role
                      </button>
                      <button
                        onClick={() => selectAction("email")}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        Edit Email
                      </button>
                      <div className="my-1 border-t" />
                      <button
                        onClick={() => selectAction("delete")}
                        className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        Remove User
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Close */}
              <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-5">

          {/* ── Call stats ── */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Call Activity</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Today",      value: loading ? "—" : detail?.callsToday },
                { label: "This Week",  value: loading ? "—" : detail?.callsThisWeek },
                { label: "This Month", value: loading ? "—" : detail?.callsThisMonth },
                { label: "Total",      value: user._count.callLogs },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-muted/40 px-2 py-2.5 text-center">
                  <p className={`text-lg font-bold leading-none ${loading && label !== "Total" ? "animate-pulse text-muted" : ""}`}>
                    {value ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Identity fields ── */}
          <div className="rounded-xl border divide-y overflow-hidden">
            <div className="flex items-center px-4 py-3 gap-3">
              <p className="text-xs text-muted-foreground w-24 shrink-0">Full Name</p>
              <p className="text-sm font-medium">{user.name ?? <span className="text-muted-foreground italic">Not set</span>}</p>
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <p className="text-xs text-muted-foreground w-24 shrink-0">Email</p>
              <p className="text-sm font-medium truncate">{user.email}</p>
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <p className="text-xs text-muted-foreground w-24 shrink-0">Role</p>
              <p className="text-sm font-medium">{ROLE_LABELS[user.role as Role]}</p>
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <p className="text-xs text-muted-foreground w-24 shrink-0">Department</p>
              <p className="text-sm font-medium">{dept}</p>
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <p className="text-xs text-muted-foreground w-24 shrink-0">Joined</p>
              <p className="text-sm font-medium">
                {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <p className="text-xs text-muted-foreground w-24 shrink-0">Tenure</p>
              <p className="text-sm font-medium">{memberDuration(user.createdAt)}</p>
            </div>
            <div className="flex items-center px-4 py-3 gap-3">
              <p className="text-xs text-muted-foreground w-24 shrink-0">Badges</p>
              <div className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-sm font-medium">{user._count.userBadges} earned</p>
              </div>
            </div>
          </div>

          {/* ── Earned badges ── */}
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />)}
              </div>
            </div>
          ) : detail && detail.user.userBadges.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Badges Earned ({detail.user.userBadges.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {detail.user.userBadges.map((ub) => (
                  <div
                    key={ub.id}
                    title={ub.badge.description}
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                    style={{ borderColor: `${ub.badge.color}40`, backgroundColor: `${ub.badge.color}10` }}
                  >
                    <span>{ub.badge.icon}</span>
                    <span>{ub.badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Department access (non-sales_rep) ── */}
          {user.role !== "sales_rep" && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Access</p>
              <div className="rounded-xl border divide-y overflow-hidden">
                {[
                  { label: "Leads", pill: s.pill1 },
                  { label: "Scraping", pill: s.pill2 },
                  ...(user.role === "boss" || user.role === "admin"
                    ? [{ label: "Marketing", pill: s.pill1 }, { label: "Admin Panel", pill: s.pill2 }]
                    : []),
                ].map(({ label, pill }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                    <p className="text-xs text-muted-foreground flex-1">{label}</p>
                    <div className={`rounded-full px-3 py-0.5 text-xs font-semibold ${pill}`}>Full access</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Action panels (from 3-dot menu) ── */}

          {activeAction === "role" && !isCurrentUser && assignableRoles.length > 0 && (
            <div className="rounded-xl border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Change Role</p>
              <div className="space-y-2">
                {ROLE_ORDER.filter((r) => assignableRoles.includes(r)).map((r) => (
                  <label
                    key={r}
                    className="relative flex cursor-pointer rounded-xl border p-3 gap-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors hover:bg-muted/40"
                  >
                    <input
                      type="radio"
                      name="modal-role"
                      value={r}
                      defaultChecked={user.role === r}
                      disabled={pendingRole}
                      onChange={() => handleRoleChange(r)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">{ROLE_LABELS[r]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r === "boss"            && "Full access to everything"}
                        {r === "admin"           && "Full access, manages users"}
                        {r === "lead_specialist" && "Leads department only"}
                        {r === "sales_rep"       && "Marketing department only"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {roleError && <p className="text-xs text-destructive">{roleError}</p>}
            </div>
          )}

          {activeAction === "email" && !isCurrentUser && (
            <div className="rounded-xl border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Email</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pendingEmail}
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <button
                  onClick={handleEmailSave}
                  disabled={pendingEmail || email.trim() === user.email}
                  className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {pendingEmail ? "Saving…" : "Save"}
                </button>
              </div>
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>
          )}

          {activeAction === "delete" && !isCurrentUser && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
              <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Remove User</p>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Permanently Remove Account
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-destructive">
                      This will permanently delete this account and all associated data. This cannot be undone.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={pendingDelete}
                      className="rounded-lg bg-destructive text-destructive-foreground px-3 py-2 text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                    >
                      {pendingDelete ? "Removing…" : "Yes, Remove"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
