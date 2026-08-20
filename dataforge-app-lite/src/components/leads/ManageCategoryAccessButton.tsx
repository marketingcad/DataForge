"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Search, ChevronLeft, Loader2, Users, Folder, Inbox } from "lucide-react";
import {
  getLeadSpecialistsAction,
  getCategoriesForAccessAction,
  getCategoryAccessAction,
  setCategoryAccessAction,
} from "@/actions/category-access.actions";
import { toast } from "sonner";

type Specialist = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
  image: string | null;
  _count: { categoryAccess: number };
};
type Category = { id: string; name: string; color: string; _count: { folders: number } };

// industryId === null (Uncategorized) is represented by this sentinel in state.
const UNCATEGORIZED = "__uncategorized__";

export function ManageCategoryAccessButton() {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Specialist[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selected, setSelected] = useState<Specialist | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  // Set of granted keys: category id, or UNCATEGORIZED.
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  // Load specialists when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setUserSearch("");
    setLoadingUsers(true);
    getLeadSpecialistsAction()
      .then((u) => setUsers(u as Specialist[]))
      .catch(() => toast.error("Could not load users"))
      .finally(() => setLoadingUsers(false));
  }, [open]);

  // Load categories + the selected user's current grants.
  useEffect(() => {
    if (!selected) return;
    setCatSearch("");
    setLoadingCats(true);
    Promise.all([getCategoriesForAccessAction(), getCategoryAccessAction(selected.id)])
      .then(([cats, access]) => {
        setCategories(cats as Category[]);
        const g = new Set<string>(access.industryIds);
        if (access.uncategorized) g.add(UNCATEGORIZED);
        setGranted(g);
      })
      .catch(() => toast.error("Could not load categories"))
      .finally(() => setLoadingCats(false));
  }, [selected]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.nickname, u.email].some((v) => v?.toLowerCase().includes(q))
    );
  }, [users, userSearch]);

  const filteredCategories = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catSearch]);

  async function toggle(key: string, industryId: string | null, next: boolean) {
    if (!selected) return;
    // Optimistic update + autosave (no save button).
    setGranted((prev) => {
      const n = new Set(prev);
      if (next) n.add(key); else n.delete(key);
      return n;
    });
    setSaving((prev) => new Set(prev).add(key));
    try {
      await setCategoryAccessAction(selected.id, industryId, next);
      // Keep the user-list badge count in sync.
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selected.id
            ? { ...u, _count: { categoryAccess: Math.max(0, u._count.categoryAccess + (next ? 1 : -1)) } }
            : u
        )
      );
    } catch {
      // Revert on failure.
      setGranted((prev) => {
        const n = new Set(prev);
        if (next) n.delete(key); else n.add(key);
        return n;
      });
      toast.error("Failed to update access. Please try again.");
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  }

  const displayName = (u: Specialist) => u.name || u.nickname || u.email;

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Shield className="h-4 w-4" />
        Manage Access
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          {!selected ? (
            <>
              <DialogHeader className="px-5 pt-5 pb-3 border-b">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4 text-primary" />
                  Category access
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick a lead specialist to choose which categories they can see.
                </p>
              </DialogHeader>
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-1">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {users.length === 0 ? "No lead specialists yet." : "No users match your search."}
                    </p>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => setSelected(u)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{displayName(u)}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          {u._count.categoryAccess} categor{u._count.categoryAccess !== 1 ? "ies" : "y"}
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="px-5 pt-5 pb-3 border-b">
                <button
                  onClick={() => setSelected(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-fit mb-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> All users
                </button>
                <DialogTitle className="text-base truncate">{displayName(selected)}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tick a category to grant access — changes save automatically.
                </p>
              </DialogHeader>
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search categories…"
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-1">
                  {loadingCats ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : (
                    <>
                      {/* Uncategorized bucket — only when not filtered out by search */}
                      {"uncategorized".includes(catSearch.trim().toLowerCase()) && (
                        <AccessRow
                          label="Uncategorized"
                          hint="Folders with no category + unfiled leads"
                          color="#64748b"
                          icon="inbox"
                          checked={granted.has(UNCATEGORIZED)}
                          saving={saving.has(UNCATEGORIZED)}
                          onToggle={(next) => toggle(UNCATEGORIZED, null, next)}
                        />
                      )}
                      {filteredCategories.map((c) => (
                        <AccessRow
                          key={c.id}
                          label={c.name}
                          hint={`${c._count.folders} folder${c._count.folders !== 1 ? "s" : ""}`}
                          color={c.color}
                          icon="folder"
                          checked={granted.has(c.id)}
                          saving={saving.has(c.id)}
                          onToggle={(next) => toggle(c.id, c.id, next)}
                        />
                      ))}
                      {filteredCategories.length === 0 && !"uncategorized".includes(catSearch.trim().toLowerCase()) && (
                        <p className="py-10 text-center text-sm text-muted-foreground">No categories match your search.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccessRow({
  label, hint, color, icon, checked, saving, onToggle,
}: {
  label: string;
  hint: string;
  color: string;
  icon: "folder" | "inbox";
  checked: boolean;
  saving: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
      <div className="flex h-8 w-8 items-center justify-center rounded-md shrink-0" style={{ backgroundColor: color + "22" }}>
        {icon === "inbox"
          ? <Inbox className="h-4 w-4" style={{ color }} />
          : <Folder className="h-4 w-4" style={{ color }} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{hint}</p>
      </div>
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={`Grant access to ${label}`}
      />
    </label>
  );
}
