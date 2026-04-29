"use client";

import type { Role } from "@/lib/rbac/roles";
import { UserCard, type UserData, type SectionStyle } from "./UserCard";
export type { SectionStyle };

interface Props {
  users: UserData[];
  actorRole: Role;
  currentUserId: string;
  sectionStyle: SectionStyle;
}

export function UsersSection({ users, actorRole, currentUserId }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {users.map((u) => (
        <UserCard
          key={u.id}
          user={u}
          actorRole={actorRole}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
