"use client";

import { useState } from "react";
import { Star, Phone, Award } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import { UserDetailModal } from "./UserDetailModal";

export type UserData = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date;
  _count: { callLogs: number; userBadges: number };
};

export type SectionStyle = {
  tag: string;
  tagClass: string;
  avatarClass: string;
  pill1: string;
  pill2: string;
  title: string;
};

interface Props {
  user: UserData;
  actorRole: Role;
  currentUserId: string;
  sectionStyle: SectionStyle;
  isPinned: boolean;
  onTogglePin: () => void;
}

function memberDuration(createdAt: Date): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  if (days < 1)   return "Today";
  if (days < 30)  return `${days} d`;
  if (days < 365) return `${Math.floor(days / 30)} mo ${days % 30} d`;
  return `${Math.floor(days / 365)} y ${Math.floor((days % 365) / 30)} mo`;
}

export function UserCard({ user: u, actorRole, currentUserId, sectionStyle: s, isPinned, onTogglePin }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  const isMe = u.id === currentUserId;
  const initial = (u.name ?? u.email)[0].toUpperCase();
  const isSalesRep = u.role === "sales_rep";
  const nameParts = (u.name ?? u.email).split(" ");
  const nameFirstLine = nameParts.slice(0, 2).join(" ");
  const nameSecondLine = nameParts.slice(2).join(" ");

  return (
    <>
      <div
        className="rounded-2xl bg-[#f4f7fb] dark:bg-muted/30 overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setModalOpen(true)}
      >
        {/* Top section */}
        <div className="p-3">
          <div className="flex items-start gap-4">

            {/* Avatar */}
            <div className="relative shrink-0">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold ${s.avatarClass}`}>
                {initial}
              </div>
              <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-rose-400 ring-2 ring-white dark:ring-muted/30" />
            </div>

            {/* Name + tags */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-snug">
                {nameFirstLine}
                {nameSecondLine && <><br />{nameSecondLine}</>}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s.tagClass}`}>
                  {s.tag}
                </span>
              </div>
            </div>

            {/* Pin button */}
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              title={isPinned ? "Unpin" : "Pin to top"}
              className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                isPinned ? "bg-amber-400" : "bg-white dark:bg-card hover:bg-amber-50"
              }`}
            >
              <Star className={`h-3.5 w-3.5 transition-colors ${isPinned ? "text-white fill-white" : "text-gray-300"}`} />
            </button>
          </div>
        </div>

        {/* Stats table */}
        <div className="mx-4 mb-4 rounded-xl bg-white dark:bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-border">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${isSalesRep ? "bg-rose-400" : "bg-blue-400"}`}>
              {isSalesRep ? (u._count.callLogs > 99 ? "99+" : u._count.callLogs) : "—"}
            </div>
            <p className="text-xs font-semibold">{isSalesRep ? "Performance" : "Access"}</p>
            {isSalesRep && (
              <p className="ml-auto text-[11px] text-muted-foreground">Calls &amp; Badges</p>
            )}
          </div>

          {isSalesRep ? (
            <div className="divide-y divide-gray-50 dark:divide-border">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <p className="text-xs text-muted-foreground w-16 shrink-0">Total calls</p>
                <div className="flex-1" />
                <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${s.pill1}`}>
                  <Phone className="h-3 w-3" />
                  <span className="text-xs font-semibold">{u._count.callLogs}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <p className="text-xs text-muted-foreground w-16 shrink-0">Badges</p>
                <div className="flex-1" />
                <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${s.pill2}`}>
                  <Award className="h-3 w-3" />
                  <span className="text-xs font-semibold">{u._count.userBadges} earned</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-border">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <p className="text-xs text-muted-foreground w-24 shrink-0">Leads</p>
                <div className="flex-1" />
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${s.pill1}`}>Full access</div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <p className="text-xs text-muted-foreground w-24 shrink-0">Scraping</p>
                <div className="flex-1" />
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${s.pill2}`}>Full access</div>
              </div>
              {(u.role === "boss" || u.role === "admin") && (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <p className="text-xs text-muted-foreground w-24 shrink-0">Marketing</p>
                  <div className="flex-1" />
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${s.pill1}`}>Full access</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <UserDetailModal
          user={u}
          actorRole={actorRole}
          isCurrentUser={isMe}
          sectionStyle={s}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
