"use client";

import { useState } from "react";
import { Phone, Settings, MoreHorizontal } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import { UserDetailModal } from "./UserDetailModal";

export type UserData = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date;
  _count: { callLogs: number; userBadges: number; savedLeads: number };
};

// Keep SectionStyle exported so other files that import it don't break
export type SectionStyle = {
  tag: string;
  tagClass: string;
  avatarClass: string;
  pill1: string;
  pill2: string;
  title: string;
};

const ROLE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  boss:              { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-400" },
  admin:             { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300", dot: "bg-violet-400" },
  sales_rep:         { bg: "bg-rose-100 dark:bg-rose-900/40",     text: "text-rose-700 dark:text-rose-300",     dot: "bg-rose-400"   },
  lead_specialist:   { bg: "bg-blue-100 dark:bg-blue-900/40",     text: "text-blue-700 dark:text-blue-300",     dot: "bg-blue-400"   },
  team_lead:         { bg: "bg-rose-100 dark:bg-rose-900/40",     text: "text-rose-700 dark:text-rose-300",     dot: "bg-rose-400"   },
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

interface Props {
  user: UserData;
  actorRole: Role;
  currentUserId: string;
  // kept optional so UsersSection.tsx callers don't break if still passing sectionStyle
  sectionStyle?: SectionStyle;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export function UserCard({ user: u, actorRole, currentUserId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const isMe      = u.id === currentUserId;
  const initial   = (u.name ?? u.email)[0].toUpperCase();
  const shortId   = `Emp-${u.id.slice(0, 6).toUpperCase()}`;
  const colors    = ROLE_COLORS[u.role] ?? ROLE_COLORS["lead_specialist"];
  const roleLabel = ROLE_LABELS[u.role as Role] ?? u.role;

  return (
    <>
      <div
        className="rounded-2xl bg-white dark:bg-card border border-border/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer group"
        onClick={() => setModalOpen(true)}
      >
        {/* Top row: "you" badge + three-dot */}
        <div className="flex items-center justify-between px-3 pt-3 min-h-[28px]">
          {isMe ? (
            <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">You</span>
          ) : <span />}
          <button
            onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
            className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center px-4 pb-5 gap-3">
          <div className="relative">
            <div className={`h-[72px] w-[72px] rounded-full flex items-center justify-center text-2xl font-black select-none ${colors.bg} ${colors.text}`}>
              {initial}
            </div>
            {/* Online dot */}
            <span className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full ${colors.dot} ring-2 ring-white dark:ring-card`} />
          </div>

          {/* Name + role */}
          <div className="text-center space-y-1">
            <p className="font-bold text-sm leading-tight">
              {u.name ?? u.email}
            </p>
            <span className={`inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
              {roleLabel}
            </span>
          </div>

          {/* Divider + meta */}
          <div className="w-full border-t border-border/50 pt-3 grid grid-cols-2 gap-x-2 gap-y-0.5 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Join Date</p>
              <p className="text-[11px] font-semibold tabular-nums">{formatDate(u.createdAt)}</p>
            </div>
            {u.role === "sales_rep" && (
              <div className="col-span-2 grid grid-cols-3 gap-x-2 mt-1.5">
                <div>
                  <p className="text-[10px] text-muted-foreground">Leads</p>
                  <p className="text-[11px] font-semibold tabular-nums">{u._count.savedLeads}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Calls</p>
                  <p className="text-[11px] font-semibold tabular-nums">{u._count.callLogs}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Badges</p>
                  <p className="text-[11px] font-semibold tabular-nums">{u._count.userBadges}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <UserDetailModal
          user={u}
          actorRole={actorRole}
          isCurrentUser={isMe}
          sectionStyle={{
            title: roleLabel,
            tag: roleLabel,
            tagClass: `${colors.bg} ${colors.text}`,
            avatarClass: `${colors.bg} ${colors.text}`,
            pill1: `${colors.bg} ${colors.text}`,
            pill2: `${colors.bg} ${colors.text}`,
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
