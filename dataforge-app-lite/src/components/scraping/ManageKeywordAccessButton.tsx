"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Search, Loader2, Users, Tags, Folder } from "lucide-react";
import {
  getKeywordSpecialistsAction,
  getKeywordsForAccessAction,
  getKeywordAccessAction,
  setKeywordAccessBulkAction,
} from "@/actions/keyword-access.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  // Group the (filtered) keywords by their folder/category, sorted by name.
  const grouped = useMemo(() => {
    const map = new Map<string, KeywordOpt[]>();
    for (const k of filteredKeywords) {
      const cat = k.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(k);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredKeywords]);

  // Grant/revoke one or more keywords in a single call (a folder shares all its
  // keywords at once). Optimistic, autosaved.
  async function commit(ids: string[], next: boolean) {
    if (!selected || ids.length === 0) return;
    const prevGranted = new Set(granted);
    const newGranted = new Set(granted);
    if (next) ids.forEach((id) => newGranted.add(id)); else ids.forEach((id) => newGranted.delete(id));
    setGranted(newGranted);
    setSaving((prev) => { const n = new Set(prev); ids.forEach((id) => n.add(id)); return n; });
    try {
      await setKeywordAccessBulkAction(selected.id, ids, next);
      setUsers((prev) =>
        prev.map((u) => (u.id === selected.id ? { ...u, _count: { keywordAccess: newGranted.size } } : u))
      );
    } catch {
      setGranted(prevGranted);
      toast.error("Failed to update access. Please try again.");
    } finally {
      setSaving((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
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
        <DialogContent
          className="p-0 gap-0 overflow-hidden flex flex-col sm:max-w-none"
          style={{ width: "min(1040px, calc(100vw - 64px))", maxWidth: "min(1040px, calc(100vw - 64px))", height: "min(760px, calc(100vh - 120px))" }}
        >
          <DialogHeader className="px-5 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Keyword access
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a lead specialist, then tick a folder to share all its keywords or individual keywords — changes save automatically.
            </p>
          </DialogHeader>

          {/* Two-pane master–detail layout */}
          <div className="flex flex-1 min-h-0">
            {/* Left: users */}
            <div className="w-72 shrink-0 border-r flex flex-col min-h-0">
              <div className="p-3 border-b shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search users…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingUsers ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {users.length === 0 ? "No lead specialists yet." : "No users match."}
                  </p>
                ) : (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelected(u)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        selected?.id === u.id ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{displayName(u)}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums text-[11px]">
                        {u._count.keywordAccess}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: the selected user's keywords, grouped by folder */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {!selected ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm">Pick a lead specialist on the left to manage their keyword access.</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-3 border-b shrink-0 space-y-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold truncate">{displayName(selected)}</p>
                      <span className="text-xs text-muted-foreground shrink-0">· {granted.size} shared</span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search keywords, location or folder…"
                        value={kwSearch}
                        onChange={(e) => setKwSearch(e.target.value)}
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loadingKw ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                      </div>
                    ) : filteredKeywords.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        {keywords.length === 0 ? "No keywords yet." : "No keywords match your search."}
                      </p>
                    ) : (
                      grouped.map(([cat, kws]) => {
                        const catIds = kws.map((k) => k.id);
                        const grantedInCat = catIds.filter((id) => granted.has(id)).length;
                        const catChecked: boolean | "indeterminate" =
                          grantedInCat === 0 ? false : grantedInCat === catIds.length ? true : "indeterminate";
                        const catSaving = catIds.some((id) => saving.has(id));
                        return (
                          <div key={cat} className="rounded-xl border overflow-hidden">
                            {/* Folder (category) row — shares/unshares all keywords in it */}
                            <label className="flex items-center gap-3 bg-muted/40 px-3 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors border-b">
                              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{cat}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {grantedInCat}/{catIds.length} keyword{catIds.length !== 1 ? "s" : ""} shared
                                </p>
                              </div>
                              {catSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                              <Checkbox
                                checked={catChecked}
                                onCheckedChange={(v) => commit(catIds, v === true)}
                                aria-label={`Share all keywords in ${cat}`}
                              />
                            </label>

                            {/* Individual keywords in this folder */}
                            <div className="divide-y">
                              {kws.map((k) => (
                                <label
                                  key={k.id}
                                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{k.keyword}</p>
                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                                      <Tags className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{k.location}</span>
                                    </p>
                                  </div>
                                  {saving.has(k.id) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                                  <Checkbox
                                    checked={granted.has(k.id)}
                                    onCheckedChange={(v) => commit([k.id], v === true)}
                                    aria-label={`Grant access to ${k.keyword}`}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
