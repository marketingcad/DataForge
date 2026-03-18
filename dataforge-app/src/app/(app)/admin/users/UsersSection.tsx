"use client";

import { useState, useEffect } from "react";
import type { Role } from "@/lib/rbac/roles";
import { UserCard, type UserData } from "./UserCard";
export type { SectionStyle } from "./UserCard";

const STORAGE_KEY = "dataforge_pinned_users";

function getPinnedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

interface Props {
  users: UserData[];
  actorRole: Role;
  currentUserId: string;
  sectionStyle: SectionStyle;
}

export function UsersSection({ users, actorRole, currentUserId, sectionStyle }: Props) {
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    setPinnedIds(getPinnedIds());
  }, []);

  function togglePin(userId: string) {
    setPinnedIds((prev) => {
      const next = prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const sorted = [...users].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id) ? 0 : 1;
    const bPinned = pinnedIds.includes(b.id) ? 0 : 1;
    return aPinned - bPinned;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
      {sorted.map((u) => (
        <UserCard
          key={u.id}
          user={u}
          actorRole={actorRole}
          currentUserId={currentUserId}
          sectionStyle={sectionStyle}
          isPinned={pinnedIds.includes(u.id)}
          onTogglePin={() => togglePin(u.id)}
        />
      ))}
    </div>
  );
}
