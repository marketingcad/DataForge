"use client";

import { useState, useMemo } from "react";
import { Search, X, ChevronsUpDown } from "lucide-react";
import { type Role } from "@/lib/rbac/roles";
import { UserCard, type UserData } from "./UserCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const ROLE_FILTERS = [
  { label: "All Roles",  value: "all"            },
  { label: "Sales Reps", value: "sales_rep"       },
  { label: "Lead Spec.", value: "lead_specialist" },
  { label: "Admins",     value: "boss,admin"      },
];

const SORT_OPTIONS = [
  { label: "Newest",     value: "newest"   },
  { label: "Oldest",     value: "oldest"   },
  { label: "Name A–Z",   value: "name_asc" },
  { label: "Most Calls", value: "calls"    },
];

const PAGE_SIZES = [
  { label: "10", value: "10" },
  { label: "20", value: "20" },
  { label: "50", value: "50" },
];

/* ── Combobox ── */
function FilterCombobox({
  options,
  value,
  onChange,
  placeholder,
  className,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "inline-flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
          >
            <span className="truncate">{current?.label ?? placeholder}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </button>
        }
      />
      <PopoverContent className="w-[180px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                  data-checked={value === o.value}
                >
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Main client ── */
interface Props {
  users: UserData[];
  actorRole: Role;
  currentUserId: string;
}

export function UsersClient({ users, actorRole, currentUserId }: Props) {
  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort,       setSort]       = useState("newest");
  const [pageSize,   setPageSize]   = useState(20);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = users.filter((u) => {
      if (q && !u.name?.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && !roleFilter.split(",").includes(u.role)) return false;
      return true;
    });
    if (sort === "newest")   list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === "oldest")   list = [...list].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    if (sort === "name_asc") list = [...list].sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
    if (sort === "calls")    list = [...list].sort((a, b) => b._count.callLogs - a._count.callLogs);
    return list;
  }, [users, search, roleFilter, sort]);

  const visible     = filtered.slice(0, pageSize);
  const isFiltering = search.trim() !== "" || roleFilter !== "all";

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-card border border-border/60 shadow-sm px-4 py-3">

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Employee name…"
            className="pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Role combobox */}
        <FilterCombobox
          options={ROLE_FILTERS}
          value={roleFilter}
          onChange={(v) => setRoleFilter(v)}
          placeholder="Select Role"
          className="w-[140px]"
        />

        {/* Sort combobox */}
        <FilterCombobox
          options={SORT_OPTIONS}
          value={sort}
          onChange={(v) => setSort(v)}
          placeholder="Sort By"
          className="w-[140px]"
        />

        {/* Search button */}
        <Button size="icon" className="bg-blue-600 hover:bg-blue-700 shrink-0">
          <Search className="h-4 w-4" />
        </Button>

        <div className="flex-1" />

        {/* Clear */}
        {isFiltering && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setRoleFilter("all"); }}
            className="gap-1.5 text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}

        {/* Show entries */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <span>Show</span>
          <FilterCombobox
            options={PAGE_SIZES}
            value={String(pageSize)}
            onChange={(v) => setPageSize(Number(v))}
            placeholder="20"
            className="w-[70px]"
          />
          <span>of {filtered.length}</span>
        </div>
      </div>

      {/* ── Grid ── */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed py-16 text-center text-sm text-muted-foreground">
          No users match your filters.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visible.map((u) => (
              <UserCard key={u.id} user={u} actorRole={actorRole} currentUserId={currentUserId} />
            ))}
          </div>

          {filtered.length > pageSize && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setPageSize((p) => p + 20)}>
                Show more ({filtered.length - pageSize} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
