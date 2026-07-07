"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Search, ChevronLeft, Loader2, Users, Tags } from "lucide-react";
import {
  getKeywordSpecialistsAction,
  getKeywordsForAccessAction,
  getKeywordAccessAction,
  setKeywordAccessAction,
} from "@/actions/keyword-access.actions";
import { toast } from "sonner";

type Specialist = {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
  _count: { keywordAccess: number };
};
type KeywordOpt = { id: string; keyword: string; location: string; category: string };

export function ManageKeywordAccessButton() {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Specialist[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selected, setSelected] = useState<Specialist | null>(null);

  const [keywords, setKeywords] = useState<KeywordOpt[]>([]);
  const [loadingKw, setLoadingKw] = useState(false);
  const [kwSearch, setKwSearch] = useState("");
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setUserSearch("");
    setLoadingUsers(true);
    getKeywordSpecialistsAction()
      .then((u) => setUsers(u as Specialist[]))
      .catch(() => toast.error("Could not load users"))
      .finally(() => setLoadingUsers(false));
  }, [open]);

  useEffect(() => {
    if (!selected) return;
    setKwSearch("");
    setLoadingKw(true);
    Promise.all([getKeywordsForAccessAction(), getKeywordAccessAction(selected.id)])
      .then(([kws, ids]) => {
        setKeywords(kws as KeywordOpt[]);
        setGranted(new Set(ids));
      })
      .catch(() => toast.error("Could not load keywords"))
      .finally(() => setLoadingKw(false));
  }, [selected]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.name, u.nickname, u.email].some((v) => v?.toLowerCase().includes(q)));
  }, [users, userSearch]);

  const filteredKeywords = useMemo(() => {
    const q = kwSearch.trim().toLowerCase();
    if (!q) return keywords;
    return keywords.filter((k) =>
      [k.keyword, k.location, k.category].some((v) => v?.toLowerCase().includes(q))
    );
  }, [keywords, kwSearch]);

  async function toggle(keywordId: string, next: boolean) {
    if (!selected) return;
    setGranted((prev) => {
      const n = new Set(prev);
      if (next) n.add(keywordId); else n.delete(keywordId);
      return n;
    });
    setSaving((prev) => new Set(prev).add(keywordId));
    try {
      await setKeywordAccessAction(selected.id, keywordId, next);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selected.id
            ? { ...u, _count: { keywordAccess: Math.max(0, u._count.keywordAccess + (next ? 1 : -1)) } }
            : u
        )
      );
    } catch {
      setGranted((prev) => {
        const n = new Set(prev);
        if (next) n.delete(keywordId); else n.add(keywordId);
        return n;
      });
      toast.error("Failed to update access. Please try again.");
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(keywordId); return n; });
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
                  Keyword access
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick a lead specialist to choose which keywords they can see and run.
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
                          {u._count.keywordAccess} keyword{u._count.keywordAccess !== 1 ? "s" : ""}
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
                  Tick a keyword to grant access — changes save automatically.
                </p>
              </DialogHeader>
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search keywords, location or category…"
                    value={kwSearch}
                    onChange={(e) => setKwSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 space-y-1">
                  {loadingKw ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : filteredKeywords.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      {keywords.length === 0 ? "No keywords yet." : "No keywords match your search."}
                    </p>
                  ) : (
                    filteredKeywords.map((k) => (
                      <label
                        key={k.id}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{k.keyword}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                            <span className="truncate">{k.location}</span>
                            <Tags className="h-3 w-3 shrink-0" />
                            <span className="truncate">{k.category || "Uncategorized"}</span>
                          </p>
                        </div>
                        {saving.has(k.id) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                        <Checkbox
                          checked={granted.has(k.id)}
                          onCheckedChange={(v) => toggle(k.id, v === true)}
                          aria-label={`Grant access to ${k.keyword}`}
                        />
                      </label>
                    ))
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
