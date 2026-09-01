"use client";

import { useState, useTransition, useEffect, useCallback, useMemo } from "react";
import {
  getDuplicateGroupsAction,
  mergeDuplicatesAction,
  bulkMergeDuplicatesAction,
} from "@/actions/duplicates.actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { formatPhone } from "@/lib/utils/normalize";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DuplicateLead = {
  id: string;
  businessName: string;
  phone: string;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  source: string;
  dataQualityScore: number;
  dateCollected: string | Date;
  savedByName: string | null;
  folderName: string | null;
  callCount: number;
  hasCommission: boolean;
};

type DuplicateGroup = {
  key: string;
  matchedOn: "name" | "phone";
  leads: DuplicateLead[];
};

type HistoryFilter = "any" | "calls" | "commission" | "clean";

const groupId = (g: DuplicateGroup) => `${g.matchedOn}:${g.key}`;

function when(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Phone numbers are stored digits-only, which is unreadable in a list.
 *
 * formatPhone() assumes a North American number, so it is only applied where that
 * holds. A leading zero means it is not one — 498 leads are Philippine landlines
 * like 0277395300, and formatting those as "(027) 739-5300" invents a US area
 * code. Those, and the 128 numbers that are neither 10 nor 11 digits, are shown
 * as dialled.
 */
function displayPhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) return digits;
  return formatPhone(raw);
}

/** How a group is resolved when it is not picked copy-by-copy. */
type KeepStrategy = "strongest" | "other";

/**
 * Rank copies strongest-first: highest quality score, then most call history, then
 * one carrying a commission, and finally the oldest record — the original entry.
 */
function ranked(leads: DuplicateLead[]): DuplicateLead[] {
  return [...leads].sort(
    (a, b) =>
      b.dataQualityScore - a.dataQualityScore ||
      b.callCount - a.callCount ||
      Number(b.hasCommission) - Number(a.hasCommission) ||
      new Date(a.dateCollected).getTime() - new Date(b.dateCollected).getTime()
  );
}

const bestCopy = (leads: DuplicateLead[]) => ranked(leads)[0];

/**
 * The copy a strategy would keep.
 *
 * "other" keeps the weakest instead of the strongest — useful when the automatic
 * ranking picks the wrong one, for instance when the higher-scoring copy is the
 * scrape and the lower-scoring one is the record someone has actually been working.
 * With two copies that is unambiguous; with three or more it keeps the last in the
 * ranking, which is why the UI shows the chosen row for every group before you commit.
 */
function keeperFor(leads: DuplicateLead[], strategy: KeepStrategy): DuplicateLead {
  const order = ranked(leads);
  return strategy === "strongest" ? order[0] : order[order.length - 1];
}

/**
 * Banner + review list for duplicated leads.
 *
 * Several people and devices scrape at once, so the same business can be reached from two
 * directions. Identical rows are already blocked at write time; what lands here are the
 * calls a machine cannot make — the same name under two different phone numbers, or the
 * same number under two different names.
 */
export function DuplicatesBanner({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [query, setQuery] = useState("");
  const [matchFilter, setMatchFilter] = useState<"all" | "name" | "phone">("all");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("any");
  /** Which copy bulk resolve keeps. Also drives the "will keep" marker per group. */
  const [keepStrategy, setKeepStrategy] = useState<KeepStrategy>("strongest");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = (await getDuplicateGroupsAction(200)) as unknown as DuplicateGroup[];
      setGroups(g);
      setCount(g.length);
      setSelected(new Set());
    } catch {
      toast.error("Could not load duplicates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && groups === null) load();
  }, [open, groups, load]);

  const visible = useMemo(() => {
    if (!groups) return [];
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return groups.filter((g) => {
      if (matchFilter !== "all" && g.matchedOn !== matchFilter) return false;

      if (historyFilter === "calls" && !g.leads.some((l) => l.callCount > 0)) return false;
      if (historyFilter === "commission" && !g.leads.some((l) => l.hasCommission)) return false;
      if (historyFilter === "clean" && g.leads.some((l) => l.callCount > 0 || l.hasCommission)) return false;

      if (!q) return true;
      return g.leads.some(
        (l) =>
          l.businessName.toLowerCase().includes(q) ||
          (digits.length >= 3 && l.phone.includes(digits)) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          (l.city ?? "").toLowerCase().includes(q) ||
          (l.state ?? "").toLowerCase().includes(q)
      );
    });
  }, [groups, query, matchFilter, historyFilter]);

  const visibleIds = useMemo(() => visible.map(groupId), [visible]);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  if (count < 1) return null;

  function toggleGroup(g: DuplicateGroup) {
    const id = groupId(g);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  /** Drop resolved groups from the list and keep the badge in step. */
  function removeGroups(ids: string[]) {
    const gone = new Set(ids);
    setGroups((prev) => {
      const next = (prev ?? []).filter((g) => !gone.has(groupId(g)));
      setCount(next.length);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function keep(group: DuplicateGroup, keepId: string) {
    const removeIds = group.leads.filter((l) => l.id !== keepId).map((l) => l.id);
    setBusyKey(groupId(group));
    startTransition(async () => {
      const res = await mergeDuplicatesAction(keepId, removeIds);
      setBusyKey(null);
      if (!res.ok) {
        toast.error(res.reason, { duration: 8000 });
        return;
      }
      const moved = res.movedCalls > 0 ? `, ${res.movedCalls} call${res.movedCalls === 1 ? "" : "s"} moved` : "";
      const comm = res.movedCommission ? ", commission moved" : "";
      toast.success(`Kept 1 lead, removed ${res.removed}${moved}${comm}.`);
      removeGroups([groupId(group)]);
    });
  }

  /** Resolve every selected group, keeping whichever copy the strategy picks. */
  function mergeSelected() {
    const chosen = visible.filter((g) => selected.has(groupId(g)));
    if (!chosen.length) return;
    const plans = chosen.map((g) => {
      const keepLead = keeperFor(g.leads, keepStrategy);
      return { keepId: keepLead.id, removeIds: g.leads.filter((l) => l.id !== keepLead.id).map((l) => l.id) };
    });
    setBusyKey("__bulk__");
    startTransition(async () => {
      const outcomes = await bulkMergeDuplicatesAction(plans);
      setBusyKey(null);
      const okIds = new Set(outcomes.filter((o) => o.ok).map((o) => o.keepId));
      const resolved = chosen.filter((g) => g.leads.some((l) => okIds.has(l.id))).map(groupId);
      const failed = outcomes.filter((o) => !o.ok);
      const removed = outcomes.reduce((n, o) => n + (o.removed ?? 0), 0);

      if (resolved.length) {
        toast.success(
          `Resolved ${resolved.length} group${resolved.length === 1 ? "" : "s"}, removed ${removed} duplicate${removed === 1 ? "" : "s"}.`
        );
        removeGroups(resolved);
      }
      if (failed.length) {
        toast.error(
          `${failed.length} group${failed.length === 1 ? "" : "s"} left alone — ${failed[0].reason}`,
          { duration: 9000 }
        );
      }
    });
  }

  const bulkBusy = pending && busyKey === "__bulk__";

  return (
    <>
      {/* Red rather than amber: duplicates are a data-integrity problem worth acting
          on, so the banner should read as a warning rather than a mild notice. */}
      <div className="mb-4 rounded-lg border border-red-500/45 bg-red-500/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              There {count === 1 ? "is" : "are"} {count} possible duplicate{count === 1 ? "" : "s"} in your leads.
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Duplicate leads are listed here because we have multiple users and scrapers running,
              which can end up saving the same lead.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            View them
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Possible duplicate leads</DialogTitle>
            <DialogDescription>
              Choose which copy to keep. The others are folded into it — call history, GHL links and
              any commission move across first, and anything only they knew (an email, a website) is
              copied over. Nothing is lost.
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 border-b pb-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone, email, city…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Select value={matchFilter} onValueChange={(v) => setMatchFilter(v as typeof matchFilter)}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any match</SelectItem>
                <SelectItem value="name">Same name</SelectItem>
                <SelectItem value="phone">Same phone</SelectItem>
              </SelectContent>
            </Select>
            <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as HistoryFilter)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any history</SelectItem>
                <SelectItem value="calls">Has calls</SelectItem>
                <SelectItem value="commission">Has commission</SelectItem>
                <SelectItem value="clean">No history</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-8">
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Selection bar */}
          <div className="flex flex-wrap items-center gap-3 pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleAllVisible}
                disabled={!visible.length}
                aria-label="Select all shown groups"
              />
              Select all shown
            </label>
            <span className="text-xs text-muted-foreground">
              {groups
                ? `${visible.length} of ${groups.length} group${groups.length === 1 ? "" : "s"}`
                : "Loading…"}
            </span>
            {selectedVisible.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">{selectedVisible.length} selected</span>
                <span className="text-xs text-muted-foreground">keep:</span>
                <Select value={keepStrategy} onValueChange={(v) => setKeepStrategy(v as KeepStrategy)}>
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strongest">Strongest copy</SelectItem>
                    <SelectItem value="other">The other copy</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs" disabled={bulkBusy} onClick={mergeSelected}>
                  {bulkBusy ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Resolving…
                    </>
                  ) : (
                    `Keep ${keepStrategy === "strongest" ? "strongest" : "the other"} in ${selectedVisible.length}`
                  )}
                </Button>
              </div>
            )}
          </div>
          {selectedVisible.length > 0 && (
            <p className="pb-2 text-xs text-muted-foreground">
              {keepStrategy === "strongest"
                ? "Keeps the strongest copy in each group — best quality score, then most call history — and folds the rest into it."
                : "Keeps the other copy in each group instead of the strongest, and folds the rest into it."}{" "}
              The row marked <span className="font-medium text-foreground">will keep</span> below shows
              the choice for every group before you commit.
            </p>
          )}

          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {loading && !groups && (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding duplicates…
              </div>
            )}

            {groups && !visible.length && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {groups.length ? "No groups match these filters." : "No duplicates left. 🎉"}
              </p>
            )}

            {visible.map((group) => {
              const id = groupId(group);
              const isSelected = selected.has(id);
              const best = bestCopy(group.leads);
              // Which copy bulk resolve would keep for this group under the current
              // strategy — shown only while the group is selected, so the marker never
              // implies an action that is not about to happen.
              const keeper = keeperFor(group.leads, keepStrategy);
              return (
                <div key={id} className={cn("rounded-lg border", isSelected && "border-primary/60 bg-primary/5")}>
                  <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleGroup(group)}
                      aria-label={`Select ${group.key}`}
                    />
                    <Badge variant="outline" className="text-[10px] uppercase">
                      same {group.matchedOn}
                    </Badge>
                    <span className="truncate text-xs text-muted-foreground">
                      {group.matchedOn === "phone" ? displayPhone(group.key) : group.key}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {group.leads.length} copies
                    </span>
                  </div>

                  <div className="divide-y">
                    {group.leads.map((lead) => (
                      <div key={lead.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-sm font-medium">
                            {lead.businessName}
                            {lead.id === best.id && (
                              <Badge variant="secondary" className="text-[10px]">
                                strongest
                              </Badge>
                            )}
                            {isSelected && lead.id === keeper.id && (
                              <Badge className="text-[10px]">will keep</Badge>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[lead.phone ? displayPhone(lead.phone) : "no phone", lead.email, lead.website]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {[
                              [lead.city, lead.state].filter(Boolean).join(", ") || null,
                              lead.folderName ? `folder: ${lead.folderName}` : null,
                              `score ${lead.dataQualityScore}`,
                              `collected ${when(lead.dateCollected)}`,
                              lead.savedByName ? `saved by ${lead.savedByName}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {(lead.callCount > 0 || lead.hasCommission) && (
                            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-500">
                              {[
                                lead.callCount > 0
                                  ? `${lead.callCount} call${lead.callCount === 1 ? "" : "s"} logged`
                                  : null,
                                lead.hasCommission ? "has a commission" : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending && (busyKey === id || busyKey === "__bulk__")}
                          onClick={() => keep(group, lead.id)}
                        >
                          {pending && busyKey === id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Keep this one"
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
