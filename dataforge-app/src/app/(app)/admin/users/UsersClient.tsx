"use client";

import { useState, useMemo } from "react";
import { Search, Users, Megaphone, ShieldCheck, Award, X } from "lucide-react";
import { type Role } from "@/lib/rbac/roles";
import { UsersSection, type SectionStyle } from "./UsersSection";
import type { UserData } from "./UserCard";

type DeptSection = {
  title: string;
  icon: React.ElementType;
  roles: Role[];
  style: SectionStyle;
};

const DEPT_SECTIONS: DeptSection[] = [
  {
    title: "Leads Department",
    icon: Users,
    roles: ["lead_specialist"],
    style: {
      title: "Leads Department",
      tag: "Leads",
      tagClass: "bg-blue-100 text-blue-700",
      avatarClass: "bg-blue-100 text-blue-700",
      pill1: "bg-blue-100 text-blue-700",
      pill2: "bg-cyan-100 text-cyan-700",
    },
  },
  {
    title: "Marketing Department",
    icon: Megaphone,
    roles: ["sales_rep"],
    style: {
      title: "Marketing Department",
      tag: "Marketing",
      tagClass: "bg-rose-100 text-rose-700",
      avatarClass: "bg-rose-100 text-rose-700",
      pill1: "bg-purple-100 text-purple-700",
      pill2: "bg-amber-100 text-amber-700",
    },
  },
  {
    title: "Administration",
    icon: ShieldCheck,
    roles: ["boss", "admin"],
    style: {
      title: "Administration",
      tag: "Admin",
      tagClass: "bg-violet-100 text-violet-700",
      avatarClass: "bg-violet-100 text-violet-700",
      pill1: "bg-violet-100 text-violet-700",
      pill2: "bg-purple-100 text-purple-700",
    },
  },
];

const BADGE_OPTIONS = [
  { label: "Any",  value: 0  },
  { label: "1+",   value: 1  },
  { label: "5+",   value: 5  },
  { label: "10+",  value: 10 },
  { label: "25+",  value: 25 },
];

interface Props {
  users: UserData[];
  actorRole: Role;
  currentUserId: string;
}

function SegmentButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function UsersClient({ users, actorRole, currentUserId }: Props) {
  const [search,     setSearch]     = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [minBadges,  setMinBadges]  = useState(0);

  const isFiltering = search.trim() !== "" || deptFilter !== "all" || minBadges > 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (q && !u.name?.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (minBadges > 0 && u._count.userBadges < minBadges) return false;
      return true;
    });
  }, [users, search, minBadges]);

  const visibleSections = deptFilter === "all"
    ? DEPT_SECTIONS
    : DEPT_SECTIONS.filter((s) => s.title === deptFilter);

  function clearFilters() {
    setSearch("");
    setDeptFilter("all");
    setMinBadges(0);
  }

  return (
    <div className="space-y-8">

      {/* ── Filter bar ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">

          {/* Search input */}
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-xl border bg-background pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Clear filters */}
          {isFiltering && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-center">

          {/* Department segmented control */}
          <div className="flex items-center gap-0.5 rounded-xl border bg-muted/40 p-1">
            <SegmentButton active={deptFilter === "all"} onClick={() => setDeptFilter("all")}>
              All
            </SegmentButton>
            {DEPT_SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <SegmentButton
                  key={s.title}
                  active={deptFilter === s.title}
                  onClick={() => setDeptFilter(deptFilter === s.title ? "all" : s.title)}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3" />
                    {s.title.replace(" Department", "")}
                  </span>
                </SegmentButton>
              );
            })}
          </div>

          {/* Badges segmented control */}
          <div className="flex items-center gap-0.5 rounded-xl border bg-muted/40 p-1">
            <div className="flex items-center gap-1 px-2 text-xs text-muted-foreground select-none">
              <Award className="h-3 w-3" />
              Badges
            </div>
            {BADGE_OPTIONS.map((opt) => (
              <SegmentButton
                key={opt.value}
                active={minBadges === opt.value}
                onClick={() => setMinBadges(opt.value)}
              >
                {opt.label}
              </SegmentButton>
            ))}
          </div>
        </div>

        {/* Result summary */}
        {isFiltering && (
          <p className="text-xs text-muted-foreground">
            {filtered.length === 0
              ? "No users match your filters."
              : `${filtered.length} user${filtered.length !== 1 ? "s" : ""} found`}
            {search.trim() && ` for "${search.trim()}"`}
          </p>
        )}
      </div>

      {/* ── Sections ── */}
      {visibleSections.map((section) => {
        const sectionUsers = filtered.filter((u) => section.roles.includes(u.role as Role));
        const Icon = section.icon;

        return (
          <div key={section.title}>
            <div className="flex items-center gap-2 mb-5">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{section.title}</h2>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                {sectionUsers.length}
              </span>
            </div>

            {sectionUsers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed py-10 text-center text-sm text-muted-foreground">
                {isFiltering ? "No users match your filters." : "No users in this department yet."}
              </div>
            ) : (
              <UsersSection
                users={sectionUsers}
                actorRole={actorRole}
                currentUserId={currentUserId}
                sectionStyle={section.style}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
